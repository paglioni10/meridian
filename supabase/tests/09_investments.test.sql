begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

insert into public.goals (id, user_id, title, horizon, target_cents) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Óculos', 'short', 100000),
  ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Meta de B', 'short', 100000);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.investment_assets (id, ticker_or_name, asset_class, valuation_mode, quote_source, quote_symbol) values
  ('a1000000-0000-0000-0000-000000000001', 'IVVB11', 'international', 'quote', 'brapi', 'IVVB11');
insert into public.investment_assets (id, ticker_or_name, asset_class, valuation_mode, linked_goal_id) values
  ('a1000000-0000-0000-0000-000000000002', 'Caixinha Óculos', 'cash', 'balance', 'a0000000-0000-0000-0000-000000000001');

insert into public.investment_transactions (asset_id, type, quantity, unit_price, total_amount_cents, occurred_on) values
  ('a1000000-0000-0000-0000-000000000001', 'contribution', 10, 10, 10000, '2026-10-01'),
  ('a1000000-0000-0000-0000-000000000001', 'contribution', 10, 20, 20000, '2026-10-15'),
  ('a1000000-0000-0000-0000-000000000001', 'withdrawal', 5, 24, 12000, '2026-11-01');

select results_eq(
  $$ select quantity, avg_price, invested_cents from public.investment_assets where id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (15::numeric, 15::numeric, 22500::bigint) $$,
  'weighted average price survives a withdrawal'
);

select throws_ok(
  $$ insert into public.investment_transactions (asset_id, type, quantity, unit_price, total_amount_cents) values ('a1000000-0000-0000-0000-000000000001', 'withdrawal', 100, 10, 100000) $$,
  '23514',
  null,
  'withdrawal above the position fails'
);

select throws_ok(
  $$ insert into public.investment_transactions (asset_id, type, total_amount_cents) values ('a1000000-0000-0000-0000-000000000001', 'contribution', 1000) $$,
  '23514',
  null,
  'quote asset needs quantity and price'
);

insert into public.investment_transactions (id, asset_id, type, total_amount_cents) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'contribution', 30000);
select is(
  (select current_balance_cents from public.investment_assets where id = 'a1000000-0000-0000-0000-000000000002'),
  30000::bigint,
  'contribution raises balance of a balance asset'
);

select is(
  (select saved_cents from public.goal_progress() where id = 'a0000000-0000-0000-0000-000000000001'),
  30000::bigint,
  'goal progress reads linked asset value'
);
select ok(
  (select from_investments from public.goal_progress() where id = 'a0000000-0000-0000-0000-000000000001'),
  'goal flags investment source'
);

delete from public.investment_transactions where id = 'a2000000-0000-0000-0000-000000000001';
select is(
  (select current_balance_cents from public.investment_assets where id = 'a1000000-0000-0000-0000-000000000002'),
  0::bigint,
  'deleting the contribution undoes the balance'
);

select throws_ok(
  $$ update public.investment_assets set quantity = 999 where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'positions are written only by triggers'
);

insert into public.investment_targets (asset_class, target_pct) values ('cash', 60), ('fixed_income', 41);
select throws_ok(
  $$ set constraints all immediate $$,
  '23514',
  null,
  'targets above 100 percent fail'
);

select throws_ok(
  $$ insert into public.investment_assets (ticker_or_name, asset_class, valuation_mode, linked_goal_id) values ('X', 'cash', 'balance', 'a0000000-0000-0000-0000-000000000002') $$,
  '23503',
  null,
  'cannot link to another user goal'
);

select is(
  jsonb_array_length(public.portfolio_summary() -> 'classes'),
  5,
  'summary always returns the five classes'
);

delete from public.goals where id = 'a0000000-0000-0000-0000-000000000001';
select is(
  (select linked_goal_id from public.investment_assets where id = 'a1000000-0000-0000-0000-000000000002'),
  null,
  'deleting the goal unlinks the asset'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.investment_assets), 0, 'user B does not see assets of A');

select * from finish();
rollback;
