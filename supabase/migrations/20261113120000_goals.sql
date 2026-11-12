create type public.goal_horizon as enum ('short', 'medium', 'long');
create type public.goal_status as enum ('active', 'paused', 'achieved', 'archived');

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context public.context_kind not null default 'personal',
  title text not null check (length(btrim(title)) between 1 and 80),
  description text check (description is null or length(description) <= 300),
  horizon public.goal_horizon not null,
  status public.goal_status not null default 'active',
  target_cents bigint check (target_cents > 0),
  target_date date,
  position int not null default 0,
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check ((status = 'achieved') = (achieved_at is not null))
);

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 80),
  position int not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id uuid not null,
  amount_cents bigint not null check (amount_cents <> 0),
  contributed_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  note text check (note is null or length(note) <= 120),
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

create index goals_user_idx on public.goals (user_id, horizon, position);
create index goal_milestones_goal_idx on public.goal_milestones (goal_id, position);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id, contributed_on desc);

create or replace function private.goal_contribution_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_saved bigint;
begin
  select coalesce(sum(c.amount_cents), 0) into v_saved
  from public.goal_contributions c
  where c.goal_id = new.goal_id;
  if v_saved + new.amount_cents < 0 then
    raise exception 'withdrawal exceeds saved amount' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger goal_contributions_guard
  before insert on public.goal_contributions
  for each row execute function private.goal_contribution_guard();

select private.secure_table('public.goals');
select private.secure_table('public.goal_milestones', false);
select private.secure_table('public.goal_contributions', false);

grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.goal_milestones to authenticated;
grant select, insert, delete on public.goal_contributions to authenticated;

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
  milestones_done int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with saved as (
    select c.goal_id, sum(c.amount_cents)::bigint as cents
    from public.goal_contributions c
    group by c.goal_id
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
    b.mdone
  from base b
  order by b.horizon, b."position", b.created_at;
$$;

grant execute on function public.goal_progress(text, date) to authenticated;
