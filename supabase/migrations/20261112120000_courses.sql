create type public.course_status as enum ('backlog', 'in_progress', 'paused', 'done', 'dropped');

create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context public.context_kind not null default 'personal',
  category_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  url text check (url is null or url ~* '^https?://'),
  provider text check (provider is null or length(provider) <= 80),
  priority public.priority_level not null default 'medium',
  status public.course_status not null default 'backlog',
  estimated_hours numeric(6,1) check (estimated_hours > 0),
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  obsidian_note text check (obsidian_note is null or length(obsidian_note) <= 300),
  started_on date,
  finished_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.course_categories (id, user_id) on delete set null (category_id)
);

create index courses_user_status_idx on public.courses (user_id, status, priority);
create index courses_category_idx on public.courses (category_id);

create or replace function private.course_status_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'in_progress' and new.started_on is null then
    new.started_on = current_date;
  end if;
  if new.status = 'done' then
    new.finished_on = coalesce(new.finished_on, current_date);
    new.progress_pct = 100;
    new.started_on = coalesce(new.started_on, new.finished_on);
  elsif tg_op = 'UPDATE' and old.status = 'done' then
    new.finished_on = null;
  end if;
  return new;
end;
$$;

create trigger courses_status_dates
  before insert or update of status on public.courses
  for each row execute function private.course_status_dates();

select private.secure_table('public.course_categories', false);
select private.secure_table('public.courses');

grant select, insert, update, delete on public.course_categories to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
