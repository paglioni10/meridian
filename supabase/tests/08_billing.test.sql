begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

insert into public.clients (id, user_id, name) values
  ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cliente Alfa'),
  ('90000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cliente Beta'),
  ('90000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Cliente de B');

insert into public.deals (id, user_id, client_id, title) values
  ('91000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '90000000-0000-0000-0000-000000000001', 'Landing');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.billing_reminders (id, client_id, deal_id, amount_cents, remind_on, recurrence)
values ('92000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 180000, '2026-12-20', 'once');

insert into public.billing_reminders (id, client_id, amount_cents, remind_on, recurrence)
values ('92000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 50000, '2026-12-05', 'monthly');

select is(
  (select day_of_month from public.billing_reminders where id = '92000000-0000-0000-0000-000000000002'),
  5::smallint,
  'monthly reminder stores the day of month'
);

select is(
  (select day_of_month from public.billing_reminders where id = '92000000-0000-0000-0000-000000000001'),
  null,
  'one-off reminder has no day of month'
);

select throws_ok(
  $$ insert into public.billing_reminders (client_id, remind_on) values ('90000000-0000-0000-0000-000000000003', '2026-12-01') $$,
  '23503',
  null,
  'cannot remind about another user client'
);

select throws_ok(
  $$ insert into public.billing_reminders (client_id, deal_id, remind_on) values ('90000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '2026-12-01') $$,
  '23514',
  null,
  'deal must belong to the same client'
);

update public.billing_reminders set done_at = now() where id = '92000000-0000-0000-0000-000000000002';
select ok(
  (select done_at is null from public.billing_reminders where id = '92000000-0000-0000-0000-000000000002'),
  'monthly reminders never close'
);

delete from public.deals where id = '91000000-0000-0000-0000-000000000001';
select is(
  (select deal_id from public.billing_reminders where id = '92000000-0000-0000-0000-000000000001'),
  null,
  'deleting the deal keeps the reminder'
);

delete from public.clients where id = '90000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.billing_reminders where id = '92000000-0000-0000-0000-000000000002'),
  0,
  'deleting the client removes its reminders'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.billing_reminders), 0, 'user B does not see reminders of A');

select * from finish();
rollback;
