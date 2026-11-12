create type public.income_kind as enum ('guaranteed', 'variable');

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  kind public.income_kind not null,
  context public.context_kind not null,
  default_amount_cents bigint check (default_amount_cents > 0),
  payday smallint check (payday between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null,
  kind public.income_kind not null default 'variable',
  context public.context_kind not null default 'personal',
  competence_month date not null check (competence_month = date_trunc('month', competence_month)::date),
  received_on date,
  gross_cents bigint check (gross_cents > 0),
  amount_cents bigint not null check (amount_cents > 0),
  description text check (description is null or length(description) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gross_cents is null or gross_cents >= amount_cents),
  foreign key (source_id, user_id) references public.income_sources (id, user_id) on delete restrict
);

create index incomes_user_month_idx on public.incomes (user_id, competence_month);
create index incomes_source_idx on public.incomes (source_id);

create or replace function private.incomes_from_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind public.income_kind;
  v_context public.context_kind;
begin
  if tg_op = 'INSERT' or new.source_id is distinct from old.source_id then
    select s.kind, s.context into v_kind, v_context
    from public.income_sources s
    where s.id = new.source_id;
    if found then
      new.kind = v_kind;
      new.context = v_context;
    end if;
  end if;
  return new;
end;
$$;

create trigger incomes_from_source
  before insert or update on public.incomes
  for each row execute function private.incomes_from_source();

select private.secure_table('public.income_sources');
select private.secure_table('public.incomes');

grant select, insert, update, delete on public.income_sources to authenticated;
grant select, insert, update, delete on public.incomes to authenticated;

create or replace function public.income_series(
  p_months int default 12,
  p_context text default 'all',
  p_today date default (now() at time zone 'America/Sao_Paulo')::date
)
returns table (month date, guaranteed_cents bigint, variable_cents bigint, total_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      (date_trunc('month', p_today) - make_interval(months => least(greatest(p_months, 1), 120) - 1))::date,
      date_trunc('month', p_today)::date,
      interval '1 month'
    )::date as month
  )
  select
    m.month,
    coalesce(sum(i.amount_cents) filter (where i.kind = 'guaranteed'), 0)::bigint,
    coalesce(sum(i.amount_cents) filter (where i.kind = 'variable'), 0)::bigint,
    coalesce(sum(i.amount_cents), 0)::bigint
  from months m
  left join public.incomes i
    on i.competence_month = m.month
   and (p_context = 'all' or i.context::text = p_context)
  group by m.month
  order by m.month;
$$;

create or replace function public.safe_monthly_base(
  p_months int default null,
  p_context text default 'all',
  p_today date default (now() at time zone 'America/Sao_Paulo')::date
)
returns table (
  guaranteed_cents bigint,
  variable_floor_cents bigint,
  safe_base_cents bigint,
  months_considered int,
  months_with_income int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with cfg as (
    select
      least(greatest(coalesce(
        p_months,
        (select s.safe_base_months from public.user_settings s where s.user_id = (select auth.uid())),
        6
      ), 1), 120) as n,
      (
        select min(i.competence_month)
        from public.incomes i
        where p_context = 'all' or i.context::text = p_context
      ) as first_month
  ),
  months as (
    select generate_series(
      greatest((date_trunc('month', p_today) - make_interval(months => cfg.n))::date, cfg.first_month),
      (date_trunc('month', p_today) - interval '1 month')::date,
      interval '1 month'
    )::date as month
    from cfg
    where cfg.first_month is not null
  ),
  agg as (
    select
      m.month,
      coalesce(sum(i.amount_cents) filter (where i.kind = 'guaranteed'), 0) as g,
      coalesce(sum(i.amount_cents) filter (where i.kind = 'variable'), 0) as v,
      count(i.id) as c
    from months m
    left join public.incomes i
      on i.competence_month = m.month
     and (p_context = 'all' or i.context::text = p_context)
    group by m.month
  )
  select
    coalesce(percentile_disc(0.5) within group (order by g), 0)::bigint,
    coalesce(percentile_disc(0.2) within group (order by v), 0)::bigint,
    (coalesce(percentile_disc(0.5) within group (order by g), 0)
      + coalesce(percentile_disc(0.2) within group (order by v), 0))::bigint,
    count(*)::int,
    (count(*) filter (where c > 0))::int
  from agg;
$$;

grant execute on function public.income_series(int, text, date) to authenticated;
grant execute on function public.safe_monthly_base(int, text, date) to authenticated;
