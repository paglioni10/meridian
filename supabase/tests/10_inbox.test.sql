begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ insert into public.inbox_items (raw_text, kind) values ('ideia solta', 'idea') $$,
  'user captures an idea'
);

select throws_ok(
  $$ insert into public.inbox_items (raw_text, routed_table) values ('x', 'expenses') $$,
  '23514',
  null,
  'routed table requires routed id'
);

select throws_ok(
  $$ insert into public.inbox_items (raw_text, routed_table, routed_id) values ('x', 'auth.users', gen_random_uuid()) $$,
  '23514',
  null,
  'only known destination tables'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.inbox_items), 0, 'user B does not see inbox of A');

select * from finish();
rollback;
