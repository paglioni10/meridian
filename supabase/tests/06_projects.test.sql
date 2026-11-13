begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.projects (id, name, context) values ('70000000-0000-0000-0000-000000000001', 'Site pessoal', 'personal');
insert into public.tasks (id, title, project_id, context, position) values
  ('71000000-0000-0000-0000-000000000001', 'A', '70000000-0000-0000-0000-000000000001', 'work', 1024),
  ('71000000-0000-0000-0000-000000000002', 'B', null, 'work', 2048),
  ('71000000-0000-0000-0000-000000000003', 'C', null, 'work', 3072);

select is((select context::text from public.tasks where title = 'A'), 'personal', 'task inherits project context');

update public.projects set context = 'freelance' where id = '70000000-0000-0000-0000-000000000001';
select is((select context::text from public.tasks where title = 'A'), 'freelance', 'project context change cascades to tasks');

select is(
  public.move_task('71000000-0000-0000-0000-000000000003', 'todo', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002'),
  1536::numeric,
  'move between neighbors takes the midpoint'
);
select results_eq(
  $$ select title from public.tasks where status = 'todo' order by position $$,
  $$ values ('A'), ('C'), ('B') $$,
  'order persisted'
);

select is(
  public.move_task('71000000-0000-0000-0000-000000000002', 'done', null, null),
  1024::numeric,
  'moving to an empty column starts at 1024'
);
select ok((select completed_at is not null from public.tasks where title = 'B'), 'done sets completed_at');

select public.move_task('71000000-0000-0000-0000-000000000002', 'doing', null, null);
select ok((select completed_at is null from public.tasks where title = 'B'), 'leaving done clears completed_at');

update public.tasks set position = 2000 where title = 'A';
update public.tasks set position = 2000.0000001 where title = 'C';
insert into public.tasks (id, title, context, position) values ('71000000-0000-0000-0000-000000000004', 'D', 'work', 9000);
select public.move_task('71000000-0000-0000-0000-000000000004', 'todo', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003');
select results_eq(
  $$ select title from public.tasks where status = 'todo' order by position $$,
  $$ values ('A'), ('D'), ('C') $$,
  'tiny gap triggers renumbering and keeps order'
);

insert into public.income_sources (id, name, kind, context) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Freelas', 'variable', 'freelance');
insert into public.clients (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Cliente Alfa');
insert into public.deals (id, client_id, title, value_cents, stage) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Landing page', 180000, 'proposal');

select lives_ok(
  $$ select public.win_deal('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-20', true) $$,
  'win deal'
);
select results_eq(
  $$ select d.stage::text, d.closed_at is not null, i.amount_cents, i.kind::text, i.competence_month from public.deals d join public.incomes i on i.id = d.income_id $$,
  $$ values ('won', true, 180000::bigint, 'variable', '2026-11-01'::date) $$,
  'won deal creates variable income in the received month'
);
select results_eq(
  $$ select name, context::text from public.projects where deal_id = 'd0000000-0000-0000-0000-000000000001' $$,
  $$ values ('Landing page'::text, 'freelance'::text) $$,
  'won deal creates freelance project'
);

select public.win_deal('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-20', true);
select is((select count(*)::int from public.incomes), 1, 'winning again does not duplicate income');
select is((select count(*)::int from public.projects where deal_id is not null), 1, 'winning again does not duplicate project');

select throws_ok(
  $$ delete from public.clients where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23503',
  null,
  'client with deals cannot be deleted'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.tasks), 0, 'B does not see A tasks');

select throws_ok(
  $$ insert into public.tasks (title, project_id) values ('x', '70000000-0000-0000-0000-000000000001') $$,
  '23503',
  null,
  'B cannot add tasks to A project'
);

select * from finish();

rollback;
