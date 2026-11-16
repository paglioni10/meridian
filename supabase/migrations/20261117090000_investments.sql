create type public.asset_class as enum ('cash', 'fixed_income', 'equity', 'international', 'crypto');
create type public.valuation_mode as enum ('quote', 'balance');
create type public.quote_source as enum ('brapi', 'coingecko', 'manual');
create type public.investment_tx_type as enum ('contribution', 'withdrawal', 'dividend', 'yield');

create table public.investment_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context public.context_kind not null default 'personal',
  ticker_or_name text not null check (length(btrim(ticker_or_name)) between 1 and 80),
  asset_class public.asset_class not null,
  institution text check (institution is null or length(btrim(institution)) between 1 and 80),
  valuation_mode public.valuation_mode not null,
  quote_source public.quote_source not null default 'manual',
  quote_symbol text check (quote_symbol is null or quote_symbol ~ '^[A-Za-z0-9.\-]{1,40}$'),
  quantity numeric(28,10) not null default 0 check (quantity >= 0),
  avg_price numeric(24,8) not null default 0 check (avg_price >= 0),
  invested_cents bigint not null default 0 check (invested_cents >= 0),
  current_price numeric(24,8) check (current_price > 0),
  current_balance_cents bigint check (current_balance_cents >= 0),
  price_updated_at timestamptz,
  linked_goal_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique nulls not distinct (user_id, ticker_or_name, institution),
  check (quote_source = 'manual' or (valuation_mode = 'quote' and quote_symbol is not null)),
  check (valuation_mode = 'quote' or current_price is null),
  check (valuation_mode = 'balance' or current_balance_cents is null),
  foreign key (linked_goal_id, user_id) references public.goals (id, user_id) on delete set null (linked_goal_id)
);

create table public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  asset_id uuid not null,
  type public.investment_tx_type not null,
  quantity numeric(28,10) check (quantity > 0),
  unit_price numeric(24,8) check (unit_price > 0),
  total_amount_cents bigint not null check (total_amount_cents > 0),
  occurred_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  notes text check (notes is null or length(notes) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type in ('contribution', 'withdrawal') or (quantity is null and unit_price is null)),
  foreign key (asset_id, user_id) references public.investment_assets (id, user_id) on delete cascade
);

create table public.investment_targets (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  asset_class public.asset_class not null,
  target_pct numeric(5,2) not null check (target_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, asset_class)
);

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  total_invested_cents bigint not null,
  total_equity_cents bigint not null,
  contributions_cents bigint not null default 0,
  dividends_cents bigint not null default 0,
  by_class jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create index investment_assets_user_idx on public.investment_assets (user_id, asset_class) where archived_at is null;
create index investment_assets_goal_idx on public.investment_assets (linked_goal_id) where linked_goal_id is not null;
create index investment_assets_quote_idx on public.investment_assets (quote_source, quote_symbol) where quote_source <> 'manual' and archived_at is null;
create index investment_transactions_asset_idx on public.investment_transactions (asset_id, occurred_on, created_at);
create index investment_transactions_user_month_idx on public.investment_transactions (user_id, occurred_on);

create or replace function private.investment_transactions_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mode public.valuation_mode;
begin
  select a.valuation_mode into v_mode
  from public.investment_assets a
  where a.id = new.asset_id and a.user_id = new.user_id;

  if v_mode = 'quote' and new.type in ('contribution', 'withdrawal')
    and (new.quantity is null or new.unit_price is null) then
    raise exception 'quantity and unit_price are required' using errcode = '23514';
  end if;

  if v_mode = 'balance' then
    new.quantity := null;
    new.unit_price := null;
  end if;

  return new;
end;
$$;

create or replace function private.investment_recompute(p_asset_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_mode public.valuation_mode;
  r record;
  q numeric := 0;
  avg numeric := 0;
  cost bigint := 0;
begin
  select a.valuation_mode into v_mode from public.investment_assets a where a.id = p_asset_id;
  if not found then
    return;
  end if;

  for r in
    select t.type, t.quantity, t.total_amount_cents
    from public.investment_transactions t
    where t.asset_id = p_asset_id and t.type in ('contribution', 'withdrawal')
    order by t.occurred_on, t.created_at
  loop
    if v_mode = 'quote' then
      if r.type = 'contribution' then
        avg := (q * avg + r.total_amount_cents / 100.0) / (q + r.quantity);
        q := q + r.quantity;
      else
        if r.quantity > q then
          raise exception 'withdrawal exceeds position' using errcode = '23514';
        end if;
        q := q - r.quantity;
      end if;
      cost := round(q * avg * 100)::bigint;
    else
      cost := greatest(cost + case r.type when 'contribution' then r.total_amount_cents else -r.total_amount_cents end, 0);
    end if;
  end loop;

  update public.investment_assets
  set quantity = q,
      avg_price = case when q = 0 then 0 else round(avg, 8) end,
      invested_cents = cost
  where id = p_asset_id;
end;
$$;

create or replace function private.investment_transactions_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid := coalesce(new.asset_id, old.asset_id);
  v_delta bigint := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.type in ('contribution', 'withdrawal') then
    v_delta := v_delta - case old.type when 'contribution' then old.total_amount_cents else -old.total_amount_cents end;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.type in ('contribution', 'withdrawal') then
    v_delta := v_delta + case new.type when 'contribution' then new.total_amount_cents else -new.total_amount_cents end;
  end if;

  if v_delta <> 0 then
    update public.investment_assets
    set current_balance_cents = greatest(coalesce(current_balance_cents, 0) + v_delta, 0)
    where id = v_asset and valuation_mode = 'balance';
  end if;

  perform private.investment_recompute(v_asset);
  return null;
end;
$$;

create trigger investment_transactions_validate
  before insert or update on public.investment_transactions
  for each row execute function private.investment_transactions_validate();

create trigger investment_transactions_sync
  after insert or delete or update of type, quantity, total_amount_cents, occurred_on on public.investment_transactions
  for each row execute function private.investment_transactions_sync();

create or replace function private.investment_targets_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select coalesce(sum(t.target_pct), 0) from public.investment_targets t where t.user_id = new.user_id) > 100 then
    raise exception 'allocation targets exceed 100%%' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger investment_targets_total
  after insert or update on public.investment_targets
  deferrable initially deferred
  for each row execute function private.investment_targets_total();

create view public.v_investment_positions with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.context,
  a.ticker_or_name,
  a.asset_class,
  a.institution,
  a.valuation_mode,
  a.quote_source,
  a.quote_symbol,
  a.quantity,
  a.avg_price,
  a.invested_cents,
  a.current_price,
  a.price_updated_at,
  a.linked_goal_id,
  case a.valuation_mode
    when 'quote' then round(a.quantity * coalesce(a.current_price, a.avg_price) * 100)::bigint
    else coalesce(a.current_balance_cents, a.invested_cents)
  end as equity_cents
from public.investment_assets a
where a.archived_at is null;

create or replace function public.portfolio_summary(
  p_context text default 'all',
  p_month date default date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with pos as (
    select p.*
    from public.v_investment_positions p
    where p_context = 'all' or p.context::text = p_context
  ),
  totals as (
    select coalesce(sum(equity_cents), 0)::bigint as equity, coalesce(sum(invested_cents), 0)::bigint as invested
    from pos
  ),
  classes as (
    select
      c.asset_class,
      coalesce(sum(p.equity_cents), 0)::bigint as equity,
      coalesce(max(t.target_pct), 0) as target_pct,
      count(p.id)::int as assets
    from unnest(enum_range(null::public.asset_class)) as c(asset_class)
    left join pos p on p.asset_class = c.asset_class
    left join public.investment_targets t on t.asset_class = c.asset_class
    group by c.asset_class
  ),
  month_flows as (
    select
      coalesce(sum(x.total_amount_cents) filter (where x.type in ('dividend', 'yield')), 0)::bigint as income,
      coalesce(sum(case x.type when 'contribution' then x.total_amount_cents when 'withdrawal' then -x.total_amount_cents end), 0)::bigint as net_contribution
    from public.investment_transactions x
    join pos p on p.id = x.asset_id
    where x.occurred_on >= p_month and x.occurred_on < (p_month + interval '1 month')::date
  )
  select jsonb_build_object(
    'equity_cents', t.equity,
    'invested_cents', t.invested,
    'result_cents', t.equity - t.invested,
    'return_pct', case when t.invested > 0 then round(100.0 * (t.equity - t.invested) / t.invested, 2) end,
    'income_month_cents', f.income,
    'net_contribution_month_cents', f.net_contribution,
    'classes', (
      select jsonb_agg(jsonb_build_object(
        'class', c.asset_class,
        'assets', c.assets,
        'equity_cents', c.equity,
        'current_pct', case when t.equity > 0 then round(100.0 * c.equity / t.equity, 2) else 0 end,
        'target_pct', c.target_pct,
        'gap_cents', round(t.equity * c.target_pct / 100.0)::bigint - c.equity
      ) order by c.asset_class)
      from classes c
    )
  )
  from totals t, month_flows f;
$$;

create or replace function private.refresh_portfolio_snapshots(
  p_month date default date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date
)
returns void
language sql
set search_path = ''
as $$
  insert into public.portfolio_snapshots (
    user_id, month, total_invested_cents, total_equity_cents, contributions_cents, dividends_cents, by_class
  )
  select
    p.user_id,
    p_month,
    sum(p.invested_cents)::bigint,
    sum(p.equity_cents)::bigint,
    coalesce((
      select sum(case x.type when 'contribution' then x.total_amount_cents else -x.total_amount_cents end)
      from public.investment_transactions x
      where x.user_id = p.user_id
        and x.type in ('contribution', 'withdrawal')
        and x.occurred_on >= p_month and x.occurred_on < (p_month + interval '1 month')::date
    ), 0)::bigint,
    coalesce((
      select sum(x.total_amount_cents)
      from public.investment_transactions x
      where x.user_id = p.user_id
        and x.type in ('dividend', 'yield')
        and x.occurred_on >= p_month and x.occurred_on < (p_month + interval '1 month')::date
    ), 0)::bigint,
    (
      select jsonb_object_agg(b.asset_class, b.cents)
      from (
        select v.asset_class, sum(v.equity_cents)::bigint as cents
        from public.v_investment_positions v
        where v.user_id = p.user_id
        group by v.asset_class
      ) b
    )
  from public.v_investment_positions p
  group by p.user_id
  on conflict (user_id, month) do update set
    total_invested_cents = excluded.total_invested_cents,
    total_equity_cents = excluded.total_equity_cents,
    contributions_cents = excluded.contributions_cents,
    dividends_cents = excluded.dividends_cents,
    by_class = excluded.by_class,
    updated_at = now();
$$;

select private.secure_table('public.investment_assets', true);
select private.secure_table('public.investment_transactions', true);
select private.secure_table('public.investment_targets', true);
select private.secure_table('public.portfolio_snapshots', true);

grant select, insert, delete on public.investment_assets to authenticated;
grant update (
  context, ticker_or_name, asset_class, institution, valuation_mode, quote_source, quote_symbol,
  current_price, current_balance_cents, price_updated_at, linked_goal_id, archived_at
) on public.investment_assets to authenticated;
grant select, insert, delete on public.investment_transactions to authenticated;
grant update (type, quantity, unit_price, total_amount_cents, occurred_on, notes) on public.investment_transactions to authenticated;
grant select, insert, update, delete on public.investment_targets to authenticated;
grant select on public.portfolio_snapshots to authenticated;
grant select on public.v_investment_positions to authenticated;
grant execute on function public.portfolio_summary(text, date) to authenticated;
grant select, update (current_price, price_updated_at) on public.investment_assets to service_role;

select cron.schedule('investments-sync', '45 21 * * 1-5', $$ select private.call_app('/api/investments/sync'); $$);

select cron.schedule('investments-snapshots', '50 2 * * *', $$ select private.refresh_portfolio_snapshots(); $$);
select cron.schedule(
  'investments-snapshots-close',
  '55 2 1 * *',
  $$ select private.refresh_portfolio_snapshots((date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month')::date); $$
);

drop function public.goal_progress(text, date);

create or replace function public.goal_progress(
  p_context text default 'all',
  p_today date default (now() at time zone 'America/Sao_Paulo')::date
)
returns table (
  id uuid,
  context public.context_kind,
  title text,
  description text,
  horizon public.goal_horizon,
  status public.goal_status,
  target_cents bigint,
  target_date date,
  sort_order int,
  achieved_at timestamptz,
  saved_cents bigint,
  pct numeric,
  months_left int,
  monthly_needed_cents bigint,
  is_late boolean,
  milestones_total int,
  milestones_done int,
  from_investments boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with saved as (
    select
      g.id as goal_id,
      exists (select 1 from public.v_investment_positions p where p.linked_goal_id = g.id) as from_investments,
      case
        when exists (select 1 from public.v_investment_positions p where p.linked_goal_id = g.id)
          then (select coalesce(sum(p.equity_cents), 0) from public.v_investment_positions p where p.linked_goal_id = g.id)
        else (select coalesce(sum(c.amount_cents), 0) from public.goal_contributions c where c.goal_id = g.id)
      end::bigint as cents
    from public.goals g
  ),
  ms as (
    select m.goal_id, count(*)::int as total, count(m.done_at)::int as done
    from public.goal_milestones m
    group by m.goal_id
  ),
  base as (
    select
      g.*,
      coalesce(s.cents, 0) as saved,
      s.from_investments as from_inv,
      coalesce(ms.total, 0) as mtotal,
      coalesce(ms.done, 0) as mdone,
      case
        when g.target_date is null or g.target_date < p_today then null
        else (extract(year from g.target_date)::int - extract(year from p_today)::int) * 12
          + (extract(month from g.target_date)::int - extract(month from p_today)::int) + 1
      end as mleft
    from public.goals g
    left join saved s on s.goal_id = g.id
    left join ms on ms.goal_id = g.id
    where p_context = 'all' or g.context::text = p_context
  )
  select
    b.id,
    b.context,
    b.title,
    b.description,
    b.horizon,
    b.status,
    b.target_cents,
    b.target_date,
    b."position",
    b.achieved_at,
    b.saved,
    case
      when b.status = 'achieved' then 100
      when b.target_cents is not null then least(100, greatest(0, round(100.0 * b.saved / b.target_cents, 1)))
      when b.mtotal > 0 then round(100.0 * b.mdone / b.mtotal, 1)
      else 0
    end,
    b.mleft,
    case
      when b.target_cents is not null and b.mleft is not null
        then ceil(greatest(b.target_cents - b.saved, 0)::numeric / b.mleft)::bigint
    end,
    b.status = 'active' and b.target_date is not null and b.target_date < p_today
      and (b.target_cents is null or b.saved < b.target_cents),
    b.mtotal,
    b.mdone,
    coalesce(b.from_inv, false)
  from base b
  order by b.horizon, b."position", b.created_at;
$$;

grant execute on function public.goal_progress(text, date) to authenticated;
revoke all on function private.investment_transactions_sync() from public, anon, authenticated;
