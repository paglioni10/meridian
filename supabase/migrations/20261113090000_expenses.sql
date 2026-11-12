create type public.expense_nature as enum ('fixed', 'variable');
create type public.expense_source as enum ('manual', 'import', 'capture', 'recurring');
create type public.import_format as enum ('ofx', 'nubank_account_csv', 'nubank_card_csv');

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  nature public.expense_nature not null default 'variable',
  monthly_budget_cents bigint check (monthly_budget_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern text not null check (length(btrim(pattern)) between 2 and 60 and pattern = lower(pattern)),
  category_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, pattern),
  foreign key (category_id, user_id) references public.expense_categories (id, user_id) on delete cascade
);

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category_id uuid,
  context public.context_kind not null default 'personal',
  description text not null check (length(btrim(description)) between 1 and 80),
  amount_cents bigint not null check (amount_cents > 0),
  due_day smallint not null check (due_day between 1 and 31),
  match_pattern text check (match_pattern is null or (length(btrim(match_pattern)) between 2 and 60 and match_pattern = lower(match_pattern))),
  starts_on date not null default current_date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ends_on is null or ends_on >= starts_on),
  foreign key (category_id, user_id) references public.expense_categories (id, user_id) on delete set null (category_id)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  format public.import_format not null,
  filename text not null check (length(filename) <= 200),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  period_start date,
  period_end date,
  total_rows int not null default 0,
  inserted_rows int not null default 0,
  skipped_rows int not null default 0,
  income_rows int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, file_sha256),
  unique (id, user_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context public.context_kind not null default 'personal',
  category_id uuid,
  recurring_expense_id uuid,
  import_batch_id uuid,
  nature public.expense_nature not null default 'variable',
  source public.expense_source not null default 'manual',
  occurred_on date not null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null check (length(btrim(description)) between 1 and 200),
  description_normalized text not null,
  external_id text check (external_id is null or length(external_id) <= 120),
  dedupe_hash text check (dedupe_hash is null or dedupe_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_hash),
  foreign key (category_id, user_id) references public.expense_categories (id, user_id) on delete set null (category_id),
  foreign key (recurring_expense_id, user_id) references public.recurring_expenses (id, user_id) on delete set null (recurring_expense_id),
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id) on delete cascade
);

create unique index expenses_external_id_uidx on public.expenses (user_id, external_id) where external_id is not null;
create index expenses_user_date_idx on public.expenses (user_id, occurred_on desc);
create index expenses_category_idx on public.expenses (category_id);
create index expenses_recurring_idx on public.expenses (recurring_expense_id);
create index expenses_batch_idx on public.expenses (import_batch_id);
create index category_rules_category_idx on public.category_rules (category_id);
create index recurring_expenses_category_idx on public.recurring_expenses (category_id);

alter table public.incomes add column import_batch_id uuid;
alter table public.incomes add column import_hash text check (import_hash is null or import_hash ~ '^[0-9a-f]{64}$');
alter table public.incomes
  add constraint incomes_import_batch_fk foreign key (import_batch_id, user_id)
  references public.import_batches (id, user_id) on delete cascade;
create unique index incomes_import_hash_uidx on public.incomes (user_id, import_hash) where import_hash is not null;
create index incomes_batch_idx on public.incomes (import_batch_id);

select private.secure_table('public.expense_categories');
select private.secure_table('public.category_rules', false);
select private.secure_table('public.recurring_expenses');
select private.secure_table('public.import_batches', false);
select private.secure_table('public.expenses');

grant select, insert, update, delete on public.expense_categories to authenticated;
grant select, insert, update, delete on public.category_rules to authenticated;
grant select, insert, update, delete on public.recurring_expenses to authenticated;
grant select, insert, update, delete on public.import_batches to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

create or replace function public.import_statement(p_batch_id uuid, p_expenses jsonb, p_incomes jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expenses int;
  v_incomes int;
begin
  with ins as (
    insert into public.expenses (
      occurred_on, amount_cents, description, description_normalized, dedupe_hash, external_id,
      category_id, recurring_expense_id, nature, context, source, import_batch_id
    )
    select
      (r->>'occurred_on')::date,
      (r->>'amount_cents')::bigint,
      r->>'description',
      r->>'description_normalized',
      r->>'dedupe_hash',
      nullif(r->>'external_id', ''),
      nullif(r->>'category_id', '')::uuid,
      nullif(r->>'recurring_expense_id', '')::uuid,
      coalesce(nullif(r->>'nature', '')::public.expense_nature, 'variable'),
      coalesce(nullif(r->>'context', '')::public.context_kind, 'personal'),
      'import',
      p_batch_id
    from jsonb_array_elements(p_expenses) r
    on conflict do nothing
    returning 1
  )
  select count(*) into v_expenses from ins;

  with ins as (
    insert into public.incomes (
      source_id, competence_month, received_on, amount_cents, description, import_hash, import_batch_id
    )
    select
      (r->>'source_id')::uuid,
      date_trunc('month', (r->>'received_on')::date)::date,
      (r->>'received_on')::date,
      (r->>'amount_cents')::bigint,
      left(r->>'description', 200),
      r->>'import_hash',
      p_batch_id
    from jsonb_array_elements(p_incomes) r
    on conflict do nothing
    returning 1
  )
  select count(*) into v_incomes from ins;

  update public.import_batches
  set inserted_rows = v_expenses,
      income_rows = v_incomes,
      skipped_rows = total_rows - v_expenses - v_incomes
  where id = p_batch_id;

  return jsonb_build_object('expenses', v_expenses, 'incomes', v_incomes);
end;
$$;

create or replace function public.expense_series(
  p_months int default 12,
  p_context text default 'all',
  p_today date default (now() at time zone 'America/Sao_Paulo')::date
)
returns table (month date, fixed_cents bigint, variable_cents bigint, total_cents bigint, income_cents bigint)
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
  ),
  spent as (
    select date_trunc('month', e.occurred_on)::date as month,
      sum(e.amount_cents) filter (where e.nature = 'fixed') as fixed_cents,
      sum(e.amount_cents) filter (where e.nature = 'variable') as variable_cents
    from public.expenses e
    where (p_context = 'all' or e.context::text = p_context)
      and e.occurred_on >= (select min(month) from months)
    group by 1
  ),
  earned as (
    select i.competence_month as month, sum(i.amount_cents) as income_cents
    from public.incomes i
    where (p_context = 'all' or i.context::text = p_context)
      and i.competence_month >= (select min(month) from months)
    group by 1
  )
  select
    m.month,
    coalesce(s.fixed_cents, 0)::bigint,
    coalesce(s.variable_cents, 0)::bigint,
    (coalesce(s.fixed_cents, 0) + coalesce(s.variable_cents, 0))::bigint,
    coalesce(e.income_cents, 0)::bigint
  from months m
  left join spent s on s.month = m.month
  left join earned e on e.month = m.month
  order by m.month;
$$;

create or replace function public.expense_ranking(p_month date, p_context text default 'all')
returns table (category_id uuid, name text, nature public.expense_nature, budget_cents bigint, total_cents bigint, qty int)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.category_id,
    coalesce(c.name, 'Sem categoria'),
    coalesce(c.nature, 'variable'::public.expense_nature),
    c.monthly_budget_cents,
    sum(e.amount_cents)::bigint,
    count(*)::int
  from public.expenses e
  left join public.expense_categories c on c.id = e.category_id
  where e.occurred_on >= date_trunc('month', p_month)::date
    and e.occurred_on < (date_trunc('month', p_month) + interval '1 month')::date
    and (p_context = 'all' or e.context::text = p_context)
  group by e.category_id, c.name, c.nature, c.monthly_budget_cents
  order by sum(e.amount_cents) desc;
$$;

grant execute on function public.import_statement(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.expense_series(int, text, date) to authenticated;
grant execute on function public.expense_ranking(date, text) to authenticated;
