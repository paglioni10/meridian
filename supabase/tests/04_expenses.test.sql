begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.expense_categories (id, name, nature, monthly_budget_cents) values
  ('cccccccc-0000-0000-0000-000000000001', 'Moradia', 'fixed', null),
  ('cccccccc-0000-0000-0000-000000000002', 'Mercado', 'variable', 50000);

insert into public.income_sources (id, name, kind, context)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Pix recebidos', 'variable', 'personal');

insert into public.import_batches (id, format, filename, file_sha256, total_rows)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'nubank_account_csv', 'nov.csv', repeat('a', 64), 4);

select is(
  (public.import_statement(
    'bbbbbbbb-0000-0000-0000-000000000001',
    '[
      {"occurred_on":"2026-11-05","amount_cents":"150000","description":"Aluguel","description_normalized":"aluguel","dedupe_hash":"1111111111111111111111111111111111111111111111111111111111111111","category_id":"cccccccc-0000-0000-0000-000000000001","nature":"fixed"},
      {"occurred_on":"2026-11-07","amount_cents":"32000","description":"Mercado X","description_normalized":"mercado x","dedupe_hash":"2222222222222222222222222222222222222222222222222222222222222222","external_id":"fit-1","category_id":"cccccccc-0000-0000-0000-000000000002"},
      {"occurred_on":"2026-11-08","amount_cents":"30000","description":"Mercado Y","description_normalized":"mercado y","dedupe_hash":"3333333333333333333333333333333333333333333333333333333333333333","category_id":"cccccccc-0000-0000-0000-000000000002"}
    ]'::jsonb,
    '[{"source_id":"aaaaaaaa-0000-0000-0000-000000000001","received_on":"2026-11-10","amount_cents":"20000","description":"Pix de Fulano","import_hash":"4444444444444444444444444444444444444444444444444444444444444444"}]'::jsonb
  ))::text,
  '{"incomes": 1, "expenses": 3}',
  'first import inserts expenses and incomes'
);

select results_eq(
  $$ select inserted_rows, income_rows, skipped_rows from public.import_batches $$,
  $$ values (3, 1, 0) $$,
  'batch counters updated'
);

insert into public.import_batches (id, format, filename, file_sha256, total_rows)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'ofx', 'nov.ofx', repeat('b', 64), 3);

select is(
  (public.import_statement(
    'bbbbbbbb-0000-0000-0000-000000000002',
    '[
      {"occurred_on":"2026-11-05","amount_cents":"150000","description":"Aluguel","description_normalized":"aluguel","dedupe_hash":"1111111111111111111111111111111111111111111111111111111111111111"},
      {"occurred_on":"2026-11-07","amount_cents":"32000","description":"MERCADO X LTDA","description_normalized":"mercado x ltda","dedupe_hash":"5555555555555555555555555555555555555555555555555555555555555555","external_id":"fit-1"}
    ]'::jsonb,
    '[{"source_id":"aaaaaaaa-0000-0000-0000-000000000001","received_on":"2026-11-10","amount_cents":"20000","description":"Pix de Fulano","import_hash":"4444444444444444444444444444444444444444444444444444444444444444"}]'::jsonb
  ))::text,
  '{"incomes": 0, "expenses": 0}',
  'overlapping import skips by hash and by external id'
);

select results_eq(
  $$ select skipped_rows from public.import_batches where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  $$ values (3) $$,
  'skipped rows counted'
);

select throws_ok(
  $$ insert into public.import_batches (format, filename, file_sha256) values ('ofx', 'again.ofx', repeat('a', 64)) $$,
  '23505',
  null,
  'same file cannot be imported twice'
);

select results_eq(
  $$ select fixed_cents, variable_cents, total_cents, income_cents from public.expense_series(3, 'all', '2026-11-20') where month = '2026-11-01' $$,
  $$ values (150000::bigint, 62000::bigint, 212000::bigint, 20000::bigint) $$,
  'series splits fixed and variable and brings incomes'
);

select results_eq(
  $$ select name, total_cents, qty, budget_cents from public.expense_ranking('2026-11-15', 'all') $$,
  $$ values ('Moradia'::text, 150000::bigint, 1, null::bigint), ('Mercado'::text, 62000::bigint, 2, 50000::bigint) $$,
  'ranking ordered by total with budget'
);

select throws_ok(
  $$ insert into public.category_rules (pattern, category_id) values ('IFOOD', 'cccccccc-0000-0000-0000-000000000002') $$,
  '23514',
  null,
  'rule pattern must be lowercase'
);

insert into public.expenses (occurred_on, amount_cents, description, description_normalized)
values ('2026-11-12', 1000, 'Café', 'cafe'), ('2026-11-12', 1000, 'Café', 'cafe');
select is((select count(*)::int from public.expenses where description = 'Café'), 2, 'manual expenses without hash can repeat');

delete from public.import_batches where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select is((select count(*)::int from public.expenses where import_batch_id is not null), 0, 'undo import removes its expenses');
select is((select count(*)::int from public.incomes), 0, 'undo import removes its incomes');

delete from public.expense_categories where id = 'cccccccc-0000-0000-0000-000000000002';
select is((select count(*)::int from public.category_rules), 0, 'rules follow category deletion');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.expenses), 0, 'B does not see A expenses');

select throws_ok(
  $$ insert into public.expenses (occurred_on, amount_cents, description, description_normalized, category_id)
     values ('2026-11-01', 100, 'x', 'x', 'cccccccc-0000-0000-0000-000000000001') $$,
  '23503',
  null,
  'B cannot use A category'
);

select throws_ok(
  $$ select public.import_statement('bbbbbbbb-0000-0000-0000-000000000002', '[{"occurred_on":"2026-11-01","amount_cents":"100","description":"x","description_normalized":"x","dedupe_hash":"6666666666666666666666666666666666666666666666666666666666666666"}]'::jsonb) $$,
  '23503',
  null,
  'B cannot import into A batch'
);

select * from finish();

rollback;
