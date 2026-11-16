create type public.entity_type as enum ('course', 'project', 'goal', 'income_source', 'client', 'deal', 'service', 'note', 'asset');

create table public.obsidian_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null check (length(path) between 1 and 300),
  title text generated always as (regexp_replace(path, '^.*/', '')) stored,
  created_at timestamptz not null default now(),
  unique (user_id, path)
);

create table public.entity_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_type public.entity_type not null,
  source_id uuid not null,
  target_type public.entity_type not null,
  target_id uuid not null,
  label text check (label is null or length(btrim(label)) between 1 and 40),
  created_at timestamptz not null default now(),
  check (not (source_type = target_type and source_id = target_id)),
  unique (user_id, source_type, source_id, target_type, target_id)
);

create index entity_links_source_idx on public.entity_links (user_id, source_type, source_id);
create index entity_links_target_idx on public.entity_links (user_id, target_type, target_id);

create or replace function private.entity_links_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_end record;
  v_found boolean;
begin
  for v_end in select * from (values (new.source_type, new.source_id), (new.target_type, new.target_id)) as e(kind, id) loop
    execute format(
      'select exists (select 1 from public.%I where id = $1 and user_id = $2)',
      case v_end.kind
        when 'course' then 'courses'
        when 'project' then 'projects'
        when 'goal' then 'goals'
        when 'income_source' then 'income_sources'
        when 'client' then 'clients'
        when 'deal' then 'deals'
        when 'service' then 'services'
        when 'note' then 'obsidian_notes'
        when 'asset' then 'investment_assets'
      end
    ) into v_found using v_end.id, new.user_id;
    if not v_found then
      raise exception 'entity % % not found', v_end.kind, v_end.id using errcode = '23503';
    end if;
  end loop;
  return new;
end;
$$;

create trigger entity_links_validate
  before insert or update on public.entity_links
  for each row execute function private.entity_links_validate();

create or replace function private.entity_links_cleanup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.entity_links
  where user_id = old.user_id
    and (
      (source_type = tg_argv[0]::public.entity_type and source_id = old.id)
      or (target_type = tg_argv[0]::public.entity_type and target_id = old.id)
    );
  return old;
end;
$$;

create trigger courses_links_cleanup after delete on public.courses
  for each row execute function private.entity_links_cleanup('course');
create trigger projects_links_cleanup after delete on public.projects
  for each row execute function private.entity_links_cleanup('project');
create trigger goals_links_cleanup after delete on public.goals
  for each row execute function private.entity_links_cleanup('goal');
create trigger income_sources_links_cleanup after delete on public.income_sources
  for each row execute function private.entity_links_cleanup('income_source');
create trigger clients_links_cleanup after delete on public.clients
  for each row execute function private.entity_links_cleanup('client');
create trigger deals_links_cleanup after delete on public.deals
  for each row execute function private.entity_links_cleanup('deal');
create trigger services_links_cleanup after delete on public.services
  for each row execute function private.entity_links_cleanup('service');
create trigger obsidian_notes_links_cleanup after delete on public.obsidian_notes
  for each row execute function private.entity_links_cleanup('note');
create trigger investment_assets_links_cleanup after delete on public.investment_assets
  for each row execute function private.entity_links_cleanup('asset');

create or replace function private.courses_register_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.obsidian_note is not null then
    insert into public.obsidian_notes (user_id, path)
    values (new.user_id, new.obsidian_note)
    on conflict (user_id, path) do nothing;
  end if;
  return new;
end;
$$;

create trigger courses_register_note
  after insert or update of obsidian_note on public.courses
  for each row execute function private.courses_register_note();

create view public.v_graph_nodes with (security_invoker = true) as
select 'course'::public.entity_type as type, id, user_id, title as label, context::text as context, status::text as state from public.courses
union all
select 'project', id, user_id, name, context::text, status::text from public.projects
union all
select 'goal', id, user_id, title, context::text, case when status = 'active' and target_date < (now() at time zone 'America/Sao_Paulo')::date then 'late' else status::text end from public.goals
union all
select 'income_source', id, user_id, name, context::text, case when active then 'active' else 'inactive' end from public.income_sources
union all
select 'client', id, user_id, name, 'freelance', null from public.clients
union all
select 'deal', id, user_id, title, 'freelance', stage::text from public.deals
union all
select 'service', id, user_id, name, context::text, last_state::text from public.services
union all
select 'note', id, user_id, title, null, null from public.obsidian_notes
union all
select 'asset', id, user_id, ticker_or_name, context::text, asset_class::text from public.investment_assets where archived_at is null;

create view public.v_graph_edges with (security_invoker = true) as
select user_id, source_type, source_id, target_type, target_id, label, 'manual' as origin, id as link_id
from public.entity_links
union all
select c.user_id, 'course', c.id, 'note', n.id, 'nota', 'derived', null
from public.courses c
join public.obsidian_notes n on n.user_id = c.user_id and n.path = c.obsidian_note
union all
select user_id, 'deal', id, 'client', client_id, 'cliente', 'derived', null
from public.deals
union all
select user_id, 'project', id, 'deal', deal_id, 'origem', 'derived', null
from public.projects
where deal_id is not null
union all
select i.user_id, 'income_source', i.source_id, 'deal', d.id, 'receita', 'derived', null
from public.deals d
join public.incomes i on i.id = d.income_id
union all
select user_id, 'asset', id, 'goal', linked_goal_id, 'financia', 'derived', null
from public.investment_assets
where linked_goal_id is not null and archived_at is null;

create or replace function public.graph_snapshot(p_context text default 'all')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with nodes as (
    select type, id, label, context, state
    from public.v_graph_nodes
    where p_context = 'all' or context is null or context = p_context
  ),
  edges as (
    select e.*
    from public.v_graph_edges e
    join nodes s on s.type = e.source_type and s.id = e.source_id
    join nodes t on t.type = e.target_type and t.id = e.target_id
  )
  select jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', type || ':' || id, 'type', type, 'entityId', id,
        'label', label, 'context', context, 'state', state
      )) from nodes
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', source_type || ':' || source_id, 'target', target_type || ':' || target_id,
        'label', label, 'origin', origin, 'linkId', link_id
      )) from edges
    ), '[]'::jsonb)
  );
$$;

create or replace function public.search_entities(p_query text, p_limit int default 12)
returns table (type public.entity_type, id uuid, label text, context text)
language sql
stable
security invoker
set search_path = ''
as $$
  select type, id, label, context
  from public.v_graph_nodes
  where label ilike '%' || p_query || '%'
  order by position(lower(p_query) in lower(label)), length(label)
  limit least(greatest(p_limit, 1), 50);
$$;

select private.secure_table('public.obsidian_notes', false);
select private.secure_table('public.entity_links', false);

grant select, insert, delete on public.obsidian_notes to authenticated;
grant select, insert, update, delete on public.entity_links to authenticated;
grant select on public.v_graph_nodes, public.v_graph_edges to authenticated;
grant execute on function public.graph_snapshot(text), public.search_entities(text, int) to authenticated;

insert into public.obsidian_notes (user_id, path)
select distinct user_id, obsidian_note from public.courses where obsidian_note is not null
on conflict (user_id, path) do nothing;
