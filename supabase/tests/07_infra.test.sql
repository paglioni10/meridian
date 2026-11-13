begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@meridian.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@meridian.test');

insert into public.services (id, user_id, name, kind, url, check_method) values
  ('80000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'VPS', 'vps', 'https://a.test/healthz', 'http'),
  ('80000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Site B', 'website', 'https://b.test', 'http');

insert into public.service_checks (user_id, service_id, checked_at, state, latency_ms) values
  ('11111111-1111-1111-1111-111111111111', '80000000-0000-0000-0000-000000000001', now() - interval '1 hour', 'up', 120),
  ('11111111-1111-1111-1111-111111111111', '80000000-0000-0000-0000-000000000001', now() - interval '2 hours', 'down', null),
  ('11111111-1111-1111-1111-111111111111', '80000000-0000-0000-0000-000000000001', now() - interval '3 hours', 'up', 80),
  ('11111111-1111-1111-1111-111111111111', '80000000-0000-0000-0000-000000000001', now() - interval '4 hours', 'up', 100);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.services), 1, 'user sees only own services');

select throws_ok(
  $$ update public.services set last_state = 'up' where id = '80000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'monitor columns are not writable by the user'
);

select throws_ok(
  $$ insert into public.services (name, kind, url, check_method) values ('Sem palavra', 'website', 'https://x.test', 'keyword') $$,
  '23514',
  null,
  'keyword check requires a keyword'
);

select throws_ok(
  $$ insert into public.services (name, kind, check_method) values ('Sem URL', 'api', 'http') $$,
  '23514',
  null,
  'http check requires a url'
);

select lives_ok(
  $$ insert into public.services (name, kind, check_method) values ('n8n fluxo', 'automation', 'heartbeat') $$,
  'heartbeat service needs no url'
);

insert into public.renewals (id, kind, name, expires_on, balance_cents, monthly_burn_cents, balance_updated_on, currency)
values ('81000000-0000-0000-0000-000000000001', 'credit', 'Crédito Hetzner', '2000-01-01', 2500, 709, '2026-11-01', 'USD');

select is(
  (select expires_on from public.renewals where id = '81000000-0000-0000-0000-000000000001'),
  '2026-11-01'::date + floor(2500::numeric / 709 * 30.4375)::int,
  'credit expiry is projected from balance and burn'
);

select throws_ok(
  $$ insert into public.renewals (kind, name, expires_on, service_id) values ('domain', 'outro.com', '2027-01-01', '80000000-0000-0000-0000-000000000002') $$,
  '23503',
  null,
  'renewal cannot point to another user service'
);

insert into public.renewals (id, kind, name, expires_on, service_id) values
  ('81000000-0000-0000-0000-000000000002', 'domain', 'meusite.com.br', (now() at time zone 'America/Sao_Paulo')::date + 5, '80000000-0000-0000-0000-000000000001'),
  ('81000000-0000-0000-0000-000000000003', 'hosting', 'Hospedagem', (now() at time zone 'America/Sao_Paulo')::date - 1, null);

select results_eq(
  $$ select name, urgency, days_left from public.v_renewals_due where kind <> 'credit' order by name $$,
  $$ values ('Hospedagem'::text, 'expired'::text, -1), ('meusite.com.br', 'critical', 5) $$,
  'renewals get urgency and days left'
);

select throws_ok(
  $$ insert into public.service_checks (user_id, service_id, state) values ('11111111-1111-1111-1111-111111111111', '80000000-0000-0000-0000-000000000001', 'up') $$,
  '42501',
  null,
  'checks are written only by the server'
);

select throws_ok(
  $$ insert into public.alert_events (user_id, kind, dedupe_key) values ('11111111-1111-1111-1111-111111111111', 'service_down', 'x') $$,
  '42501',
  null,
  'alerts are written only by the server'
);

select results_eq(
  $$ select uptime_7d, down_checks_7d from public.v_service_uptime where service_id = '80000000-0000-0000-0000-000000000001' $$,
  $$ values (75.00::numeric, 1) $$,
  'uptime counts up checks over 7 days'
);

select is(
  (select sum(down)::int from public.service_timeline(24, 24) where service_id = '80000000-0000-0000-0000-000000000001'),
  1,
  'timeline buckets the down check'
);

delete from public.services where id = '80000000-0000-0000-0000-000000000001';
select is(
  (select service_id from public.renewals where id = '81000000-0000-0000-0000-000000000002'),
  null,
  'deleting a service keeps the renewal and clears the link'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.renewals), 0, 'user B does not see renewals of A');

select * from finish();
rollback;
