create type public.project_status as enum ('active', 'on_hold', 'done', 'archived');
create type public.task_status as enum ('todo', 'doing', 'done');
create type public.deal_stage as enum ('lead', 'briefing', 'proposal', 'negotiation', 'won', 'lost');

alter table public.incomes add constraint incomes_id_user_key unique (id, user_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  company text check (company is null or length(company) <= 80),
  email text check (email is null or (length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or length(phone) <= 40),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 120),
  stage public.deal_stage not null default 'lead',
  value_cents bigint check (value_cents > 0),
  expected_close_on date,
  closed_at timestamptz,
  lost_reason text check (lost_reason is null or length(lost_reason) <= 200),
  income_id uuid,
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete restrict,
  foreign key (income_id, user_id) references public.incomes (id, user_id) on delete set null (income_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context public.context_kind not null default 'personal',
  deal_id uuid,
  name text not null check (length(btrim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 300),
  status public.project_status not null default 'active',
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (deal_id, user_id) references public.deals (id, user_id) on delete set null (deal_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context public.context_kind not null default 'personal',
  project_id uuid,
  title text not null check (length(btrim(title)) between 1 and 160),
  description text check (description is null or length(description) <= 2000),
  status public.task_status not null default 'todo',
  priority public.priority_level not null default 'medium',
  due_on date,
  position numeric not null default 0,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);

create index tasks_board_idx on public.tasks (user_id, status, position) where archived_at is null;
create index tasks_project_idx on public.tasks (project_id);
create index deals_board_idx on public.deals (user_id, stage, position);
create index deals_client_idx on public.deals (client_id);
create index deals_income_idx on public.deals (income_id);
create index projects_deal_idx on public.projects (deal_id);

alter table public.expenses add column project_id uuid;
alter table public.expenses
  add constraint expenses_project_fk foreign key (project_id, user_id)
  references public.projects (id, user_id) on delete set null (project_id);
create index expenses_project_idx on public.expenses (project_id);

alter table public.recurring_expenses add column project_id uuid;
alter table public.recurring_expenses
  add constraint recurring_expenses_project_fk foreign key (project_id, user_id)
  references public.projects (id, user_id) on delete set null (project_id);
create index recurring_expenses_project_idx on public.recurring_expenses (project_id);

create or replace function private.tasks_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_context public.context_kind;
begin
  if new.project_id is not null then
    select p.context into v_context from public.projects p where p.id = new.project_id;
    if found then
      new.context = v_context;
    end if;
  end if;
  if new.status = 'done' then
    new.completed_at = coalesce(new.completed_at, now());
  else
    new.completed_at = null;
    new.archived_at = null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync
  before insert or update on public.tasks
  for each row execute function private.tasks_sync();

create or replace function private.projects_context_cascade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.context is distinct from old.context then
    update public.tasks set context = new.context where project_id = new.id;
  end if;
  return new;
end;
$$;

create trigger projects_context_cascade
  after update of context on public.projects
  for each row execute function private.projects_context_cascade();

create or replace function private.deals_closed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage in ('won', 'lost') then
    new.closed_at = coalesce(new.closed_at, now());
  else
    new.closed_at = null;
    new.lost_reason = null;
  end if;
  return new;
end;
$$;

create trigger deals_closed_at
  before insert or update of stage on public.deals
  for each row execute function private.deals_closed_at();

select private.secure_table('public.clients');
select private.secure_table('public.deals');
select private.secure_table('public.projects');
select private.secure_table('public.tasks');

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

create or replace function public.move_task(
  p_task_id uuid,
  p_status public.task_status,
  p_before_id uuid default null,
  p_after_id uuid default null
)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before numeric;
  v_after numeric;
  v_position numeric;
begin
  if not exists (select 1 from public.tasks where id = p_task_id) then
    raise exception 'task not found' using errcode = '23503';
  end if;

  select position into v_before from public.tasks where id = p_before_id and status = p_status;
  select position into v_after from public.tasks where id = p_after_id and status = p_status;

  if v_before is not null and v_after is not null and abs(v_after - v_before) < 0.000001 then
    with ordered as (
      select id, row_number() over (order by position, created_at) * 1024 as pos
      from public.tasks
      where status = p_status and archived_at is null and id <> p_task_id
    )
    update public.tasks t set position = o.pos from ordered o where t.id = o.id;
    select position into v_before from public.tasks where id = p_before_id;
    select position into v_after from public.tasks where id = p_after_id;
  end if;

  v_position := case
    when v_before is not null and v_after is not null then (v_before + v_after) / 2
    when v_before is not null then v_before + 1024
    when v_after is not null then v_after - 1024
    else coalesce((select max(position) + 1024 from public.tasks where status = p_status and archived_at is null and id <> p_task_id), 1024)
  end;

  update public.tasks set status = p_status, position = v_position where id = p_task_id;
  return v_position;
end;
$$;

create or replace function public.win_deal(
  p_deal_id uuid,
  p_source_id uuid default null,
  p_received_on date default null,
  p_create_project boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deal record;
  v_income_id uuid;
  v_project_id uuid;
begin
  select d.id, d.title, d.value_cents, d.income_id, d.stage, c.name as client_name
    into v_deal
  from public.deals d
  join public.clients c on c.id = d.client_id
  where d.id = p_deal_id;

  if not found then
    raise exception 'deal not found' using errcode = '23503';
  end if;

  v_income_id := v_deal.income_id;
  if p_source_id is not null and v_deal.value_cents is not null and v_income_id is null then
    insert into public.incomes (source_id, competence_month, received_on, amount_cents, description)
    values (
      p_source_id,
      date_trunc('month', coalesce(p_received_on, (now() at time zone 'America/Sao_Paulo')::date))::date,
      p_received_on,
      v_deal.value_cents,
      left(v_deal.client_name || ' · ' || v_deal.title, 200)
    )
    returning id into v_income_id;
  end if;

  update public.deals set stage = 'won', income_id = v_income_id where id = p_deal_id;

  if p_create_project then
    select id into v_project_id from public.projects where deal_id = p_deal_id limit 1;
    if v_project_id is null then
      insert into public.projects (context, deal_id, name, description)
      values ('freelance', p_deal_id, left(v_deal.title, 80), left('Cliente: ' || v_deal.client_name, 300))
      returning id into v_project_id;
    end if;
  end if;

  return jsonb_build_object('income_id', v_income_id, 'project_id', v_project_id);
end;
$$;

grant execute on function public.move_task(uuid, public.task_status, uuid, uuid) to authenticated;
grant execute on function public.win_deal(uuid, uuid, date, boolean) to authenticated;
