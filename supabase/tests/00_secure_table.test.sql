begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

create table public.rls_probe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select private.secure_table('public.rls_probe');
grant select, insert, update, delete on public.rls_probe to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

set local role authenticated;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.rls_probe (note, created_at, updated_at) values ('from a', now() - interval '1 day', now() - interval '1 day');

select is((select count(*)::int from public.rls_probe), 1, 'A sees own row');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.rls_probe), 0, 'B does not see A rows');

update public.rls_probe set note = 'hijack';
delete from public.rls_probe;

select is((select count(*)::int from public.rls_probe), 0, 'B update and delete reach no rows');

select throws_ok(
  $$ insert into public.rls_probe (user_id, note) values ('11111111-1111-1111-1111-111111111111', 'spoof') $$,
  '42501',
  null,
  'B cannot insert rows for A'
);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select note from public.rls_probe), 'from a', 'A row untouched');

update public.rls_probe set note = 'edited';
select ok((select updated_at > created_at from public.rls_probe), 'updated_at trigger fires');

select * from finish();

rollback;
