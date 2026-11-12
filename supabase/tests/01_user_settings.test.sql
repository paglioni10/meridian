begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.user_settings'::regclass),
  'user_settings has forced RLS'
);

select ok(
  not has_table_privilege('anon', 'public.user_settings', 'select'),
  'anon cannot read user_settings'
);

select ok(
  not has_table_privilege('authenticated', 'public.user_settings', 'delete'),
  'authenticated cannot delete user_settings'
);

create table public.privilege_probe (id int);

select ok(
  not has_table_privilege('authenticated', 'public.privilege_probe', 'select'),
  'new tables are not exposed to authenticated by default'
);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.user_settings (theme) values ('dark');

select is((select theme from public.user_settings), 'dark', 'A writes own settings');

select throws_ok(
  $$ insert into public.user_settings (active_context) values ('nope') $$,
  '23514',
  null,
  'invalid context rejected'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.user_settings), 0, 'B does not see A settings');

select throws_ok(
  $$ insert into public.user_settings (user_id, theme) values ('11111111-1111-1111-1111-111111111111', 'light') $$,
  '42501',
  null,
  'B cannot write settings for A'
);

select * from finish();

rollback;
