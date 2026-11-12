begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.goals (id, title, horizon, target_cents, target_date) values
  ('99999999-0000-0000-0000-000000000001', 'Notebook', 'short', 75000, '2027-01-31'),
  ('99999999-0000-0000-0000-000000000002', 'Viagem', 'medium', 300000, '2026-10-31'),
  ('99999999-0000-0000-0000-000000000003', 'Inglês fluente', 'long', null, null),
  ('99999999-0000-0000-0000-000000000004', 'Reserva', 'short', 100000, '2026-11-30');

insert into public.goal_contributions (goal_id, amount_cents, contributed_on) values
  ('99999999-0000-0000-0000-000000000001', 20000, '2026-11-01'),
  ('99999999-0000-0000-0000-000000000004', 150000, '2026-11-01');

insert into public.goal_milestones (goal_id, title, done_at) values
  ('99999999-0000-0000-0000-000000000003', 'B1', now()),
  ('99999999-0000-0000-0000-000000000003', 'B2', null),
  ('99999999-0000-0000-0000-000000000003', 'C1', null),
  ('99999999-0000-0000-0000-000000000003', 'C2', null);

select results_eq(
  $$ select saved_cents, pct, months_left, monthly_needed_cents, is_late from public.goal_progress('all', '2026-11-12') where title = 'Notebook' $$,
  $$ values (20000::bigint, 26.7::numeric, 3, 18334::bigint, false) $$,
  'R$ 200 of R$ 750: 26.7%, 3 months left, rounded-up monthly need'
);

select results_eq(
  $$ select months_left, monthly_needed_cents, is_late from public.goal_progress('all', '2026-11-12') where title = 'Viagem' $$,
  $$ values (null::int, null::bigint, true) $$,
  'past deadline without reaching target is late'
);

select results_eq(
  $$ select pct, monthly_needed_cents, months_left from public.goal_progress('all', '2026-11-12') where title = 'Reserva' $$,
  $$ values (100::numeric, 0::bigint, 1) $$,
  'exceeded target caps at 100% and needs nothing; deadline this month counts as 1'
);

select results_eq(
  $$ select pct, milestones_done, milestones_total from public.goal_progress('all', '2026-11-12') where title = 'Inglês fluente' $$,
  $$ values (25::numeric, 1, 4) $$,
  'goal without amount uses milestones'
);

select lives_ok(
  $$ insert into public.goal_contributions (goal_id, amount_cents) values ('99999999-0000-0000-0000-000000000001', -5000) $$,
  'withdrawal within saved amount is allowed'
);

select results_eq(
  $$ select saved_cents, pct from public.goal_progress('all', '2026-11-12') where title = 'Notebook' $$,
  $$ values (15000::bigint, 20::numeric) $$,
  'withdrawal reduces progress'
);

select throws_ok(
  $$ insert into public.goal_contributions (goal_id, amount_cents) values ('99999999-0000-0000-0000-000000000001', -20000) $$,
  '23514',
  null,
  'cannot withdraw more than saved'
);

select throws_ok(
  $$ update public.goals set status = 'achieved' where title = 'Notebook' $$,
  '23514',
  null,
  'achieved requires achieved_at'
);

update public.goals set status = 'achieved', achieved_at = now() where title = 'Notebook';
select results_eq(
  $$ select pct from public.goal_progress('all', '2026-11-12') where title = 'Notebook' $$,
  $$ values (100::numeric) $$,
  'achieved goal shows 100%'
);

select results_eq(
  $$ select count(*)::int from public.goal_progress('freelance', '2026-11-12') $$,
  $$ values (0) $$,
  'context filter'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.goal_progress('all', '2026-11-12')), 0, 'B does not see A goals');

select throws_ok(
  $$ insert into public.goal_contributions (goal_id, amount_cents) values ('99999999-0000-0000-0000-000000000004', 100) $$,
  '23503',
  null,
  'B cannot contribute to A goal'
);

select throws_ok(
  $$ insert into public.goal_milestones (goal_id, title) values ('99999999-0000-0000-0000-000000000004', 'x') $$,
  '23503',
  null,
  'B cannot add milestones to A goal'
);

select * from finish();

rollback;
