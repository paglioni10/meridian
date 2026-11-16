begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

insert into public.projects (id, user_id, name) values
  ('b0000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'Projeto de B');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.courses (id, title, obsidian_note) values
  ('b0000000-0000-0000-0000-000000000001', 'Next.js avançado', 'Estudos/Next.md');
insert into public.projects (id, name) values ('b0000000-0000-0000-0000-000000000002', 'Site pessoal');
insert into public.clients (id, name) values ('b0000000-0000-0000-0000-000000000003', 'Cliente Alfa');
insert into public.deals (id, client_id, title) values
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'Landing');

select is(
  (select count(*)::int from public.obsidian_notes where path = 'Estudos/Next.md'),
  1,
  'course note is registered automatically'
);

select ok(
  exists (select 1 from public.v_graph_edges where source_type = 'course' and target_type = 'note'),
  'derived edge course to note'
);
select ok(
  exists (select 1 from public.v_graph_edges where source_type = 'deal' and target_type = 'client'),
  'derived edge deal to client'
);

select lives_ok(
  $$ insert into public.entity_links (source_type, source_id, target_type, target_id, label)
     values ('course', 'b0000000-0000-0000-0000-000000000001', 'project', 'b0000000-0000-0000-0000-000000000002', 'aplicado em') $$,
  'manual link between own entities'
);

select throws_ok(
  $$ insert into public.entity_links (source_type, source_id, target_type, target_id)
     values ('course', 'b0000000-0000-0000-0000-000000000001', 'project', 'b0000000-0000-0000-0000-000000000009') $$,
  '23503',
  null,
  'link to another user entity fails'
);

select throws_ok(
  $$ insert into public.entity_links (source_type, source_id, target_type, target_id)
     values ('project', 'b0000000-0000-0000-0000-000000000002', 'project', 'b0000000-0000-0000-0000-000000000002') $$,
  '23514',
  null,
  'self link is rejected'
);

select throws_ok(
  $$ insert into public.entity_links (source_type, source_id, target_type, target_id)
     values ('course', 'b0000000-0000-0000-0000-000000000001', 'project', 'b0000000-0000-0000-0000-000000000002') $$,
  '23505',
  null,
  'duplicate link is rejected'
);

delete from public.courses where id = 'b0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.entity_links), 0, 'deleting the course removes its links');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is(
  jsonb_array_length(public.graph_snapshot() -> 'nodes'),
  1,
  'user B sees only own nodes'
);

select * from finish();
rollback;
