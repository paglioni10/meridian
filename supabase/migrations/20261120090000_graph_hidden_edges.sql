create table public.graph_hidden_edges (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_type public.entity_type not null,
  source_id uuid not null,
  target_type public.entity_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_type, source_id, target_type, target_id)
);

select private.secure_table('public.graph_hidden_edges', false);

grant select, insert, delete on public.graph_hidden_edges to authenticated;

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
    select e.*, h.user_id is not null as hidden
    from public.v_graph_edges e
    join nodes s on s.type = e.source_type and s.id = e.source_id
    join nodes t on t.type = e.target_type and t.id = e.target_id
    left join public.graph_hidden_edges h
      on e.origin = 'derived'
     and h.source_type = e.source_type and h.source_id = e.source_id
     and h.target_type = e.target_type and h.target_id = e.target_id
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
      )) from edges where not hidden
    ), '[]'::jsonb),
    'hidden', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', source_type || ':' || source_id, 'target', target_type || ':' || target_id,
        'label', label, 'origin', origin, 'linkId', null
      )) from edges where hidden
    ), '[]'::jsonb)
  );
$$;
