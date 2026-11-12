begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.income_sources (id, name, kind, context) values
  ('aaaaaaaa-0000-0000-0000-00000000000c', 'Empresa CLT', 'guaranteed', 'work'),
  ('aaaaaaaa-0000-0000-0000-00000000000f', 'Freelas', 'variable', 'freelance');

insert into public.incomes (source_id, competence_month, amount_cents)
select 'aaaaaaaa-0000-0000-0000-00000000000c', m, 500000
from generate_series('2026-06-01'::date, '2026-11-01'::date, interval '1 month') as m;

insert into public.incomes (source_id, competence_month, amount_cents, description)
values ('aaaaaaaa-0000-0000-0000-00000000000c', '2026-11-01', 500000, '13º salário');

insert into public.incomes (source_id, competence_month, amount_cents)
values
  ('aaaaaaaa-0000-0000-0000-00000000000f', '2026-06-01', 150000),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '2026-07-01', 300000),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '2026-08-01', 100000),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '2026-09-01', 250000),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '2026-10-01', 400000),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '2026-11-01', 200000),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '2026-12-01', 900000);

select results_eq(
  $$ select distinct kind::text, context::text from public.incomes where source_id = 'aaaaaaaa-0000-0000-0000-00000000000f' $$,
  $$ values ('variable', 'freelance') $$,
  'kind and context copied from source'
);

select results_eq(
  $$ select guaranteed_cents, variable_floor_cents, safe_base_cents, months_considered, months_with_income
     from public.safe_monthly_base(6, 'all', '2026-12-15') $$,
  $$ values (500000::bigint, 150000::bigint, 650000::bigint, 6, 6) $$,
  'median guaranteed ignores 13th, P20 of variable, current month excluded'
);

select results_eq(
  $$ select safe_base_cents from public.safe_monthly_base(6, 'work', '2026-12-15') $$,
  $$ values (500000::bigint) $$,
  'context filter keeps only work incomes'
);

select results_eq(
  $$ select variable_floor_cents, months_considered from public.safe_monthly_base(3, 'all', '2026-12-15') $$,
  $$ values (200000::bigint, 3) $$,
  'window of 3 months'
);

select results_eq(
  $$ select months_considered from public.safe_monthly_base(12, 'all', '2026-12-15') $$,
  $$ values (6) $$,
  'window starts at first income month'
);

select results_eq(
  $$ select count(*)::int, sum(total_cents)::bigint from public.income_series(12, 'all', '2026-12-15') $$,
  $$ values (12, 5800000::bigint) $$,
  'series has one row per month including current'
);

select results_eq(
  $$ select guaranteed_cents, variable_cents from public.income_series(12, 'all', '2026-12-15') where month = '2026-11-01' $$,
  $$ values (1000000::bigint, 200000::bigint) $$,
  'series splits guaranteed and variable'
);

select results_eq(
  $$ select total_cents from public.income_series(12, 'all', '2026-12-15') where month = '2026-01-01' $$,
  $$ values (0::bigint) $$,
  'months without income are zero'
);

update public.user_settings set safe_base_months = 6;
insert into public.user_settings (safe_base_months) values (3) on conflict (user_id) do update set safe_base_months = 3;
select results_eq(
  $$ select months_considered from public.safe_monthly_base(null, 'all', '2026-12-15') $$,
  $$ values (3) $$,
  'uses safe_base_months from settings'
);

select throws_ok(
  $$ insert into public.incomes (source_id, competence_month, amount_cents) values ('aaaaaaaa-0000-0000-0000-00000000000c', '2026-11-15', 100) $$,
  '23514',
  null,
  'competence must be first day of month'
);

select throws_ok(
  $$ insert into public.incomes (source_id, competence_month, amount_cents, gross_cents) values ('aaaaaaaa-0000-0000-0000-00000000000c', '2026-11-01', 1000, 500) $$,
  '23514',
  null,
  'gross cannot be lower than net'
);

select throws_ok(
  $$ delete from public.income_sources where id = 'aaaaaaaa-0000-0000-0000-00000000000c' $$,
  '23503',
  null,
  'source with incomes cannot be deleted'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.incomes), 0, 'B does not see A incomes');

select results_eq(
  $$ select safe_base_cents, months_considered from public.safe_monthly_base(6, 'all', '2026-12-15') $$,
  $$ values (0::bigint, 0) $$,
  'B without history has zero base'
);

select throws_ok(
  $$ insert into public.incomes (source_id, competence_month, amount_cents) values ('aaaaaaaa-0000-0000-0000-00000000000c', '2026-11-01', 100) $$,
  '23503',
  null,
  'B cannot use A source'
);

insert into public.income_sources (id, name, kind, context)
values ('bbbbbbbb-0000-0000-0000-00000000000c', 'CLT B', 'guaranteed', 'work');
insert into public.incomes (source_id, competence_month, amount_cents)
values ('bbbbbbbb-0000-0000-0000-00000000000c', '2026-10-01', 300000),
       ('bbbbbbbb-0000-0000-0000-00000000000c', '2026-11-01', 300000);

select results_eq(
  $$ select safe_base_cents, months_considered from public.safe_monthly_base(6, 'all', '2026-12-15') $$,
  $$ values (300000::bigint, 2) $$,
  'short history uses only months since first income'
);

select * from finish();

rollback;
