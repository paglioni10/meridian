create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create type public.service_kind as enum ('vps', 'automation', 'api', 'website', 'database', 'other');
create type public.check_method as enum ('http', 'keyword', 'heartbeat', 'manual');
create type public.service_state as enum ('up', 'degraded', 'down', 'unknown');
create type public.renewal_kind as enum ('domain', 'hosting', 'license', 'certificate', 'subscription', 'credit');
create type public.alert_kind as enum ('service_down', 'service_up', 'renewal_due', 'renewal_expired', 'credit_low', 'tls_due');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context public.context_kind not null default 'personal',
  name text not null check (length(btrim(name)) between 1 and 80),
  kind public.service_kind not null,
  provider text check (provider is null or length(provider) <= 80),
  url text check (url is null or (length(url) <= 500 and url ~* '^https?://')),
  check_method public.check_method not null default 'http',
  expected_status int not null default 200 check (expected_status between 100 and 599),
  keyword text check (keyword is null or length(keyword) between 1 and 120),
  latency_warn_ms int not null default 1500 check (latency_warn_ms between 100 and 60000),
  interval_minutes int not null default 10 check (interval_minutes between 5 and 1440),
  heartbeat_token uuid not null default gen_random_uuid() unique,
  last_state public.service_state not null default 'unknown',
  last_checked_at timestamptz,
  last_latency_ms int,
  last_status_code int,
  last_error text check (last_error is null or length(last_error) <= 300),
  last_change_at timestamptz,
  tls_expires_on date,
  active boolean not null default true,
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (check_method not in ('http', 'keyword') or url is not null),
  check (check_method <> 'keyword' or keyword is not null)
);

create table public.service_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  service_id uuid not null,
  checked_at timestamptz not null default now(),
  state public.service_state not null,
  status_code int,
  latency_ms int,
  error text check (error is null or length(error) <= 300),
  foreign key (service_id, user_id) references public.services (id, user_id) on delete cascade
);

create index service_checks_service_time_idx on public.service_checks (service_id, checked_at desc);
create index service_checks_time_idx on public.service_checks (checked_at);

create table public.renewals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  service_id uuid,
  kind public.renewal_kind not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  provider text check (provider is null or length(provider) <= 80),
  context public.context_kind not null default 'personal',
  expires_on date not null,
  currency text not null default 'BRL' check (currency in ('BRL', 'USD', 'EUR')),
  cost_cents bigint check (cost_cents > 0),
  billing_cycle text not null default 'yearly' check (billing_cycle in ('monthly', 'yearly', 'other')),
  balance_cents bigint check (balance_cents >= 0),
  monthly_burn_cents bigint check (monthly_burn_cents > 0),
  balance_updated_on date,
  owner_is_client boolean not null default false,
  auto_renew boolean not null default false,
  alert_days int[] not null default '{30,7,1}' check (cardinality(alert_days) between 1 and 6 and 0 <= all (alert_days) and 365 >= all (alert_days)),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (kind <> 'credit' or (balance_cents is not null and monthly_burn_cents is not null and balance_updated_on is not null)),
  foreign key (service_id, user_id) references public.services (id, user_id) on delete set null (service_id)
);

create index renewals_user_expires_idx on public.renewals (user_id, expires_on);

create table public.alert_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  service_id uuid,
  renewal_id uuid,
  kind public.alert_kind not null,
  dedupe_key text not null check (length(dedupe_key) <= 200),
  payload jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  delivery_error text check (delivery_error is null or length(delivery_error) <= 300),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  foreign key (service_id, user_id) references public.services (id, user_id) on delete cascade,
  foreign key (renewal_id, user_id) references public.renewals (id, user_id) on delete cascade
);

create index alert_events_pending_idx on public.alert_events (created_at) where delivered_at is null;
create index alert_events_user_time_idx on public.alert_events (user_id, created_at desc);

create or replace function private.renewals_project_credit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'credit' and new.balance_cents is not null and new.monthly_burn_cents is not null and new.balance_updated_on is not null then
    new.expires_on := new.balance_updated_on + floor(new.balance_cents::numeric / new.monthly_burn_cents * 30.4375)::int;
  end if;
  return new;
end;
$$;

create trigger renewals_project_credit
  before insert or update on public.renewals
  for each row execute function private.renewals_project_credit();

create view public.v_renewals_due with (security_invoker = true) as
select
  r.*,
  (r.expires_on - (now() at time zone 'America/Sao_Paulo')::date) as days_left,
  case
    when r.expires_on < (now() at time zone 'America/Sao_Paulo')::date then 'expired'
    when r.expires_on - (now() at time zone 'America/Sao_Paulo')::date <= 7 then 'critical'
    when r.expires_on - (now() at time zone 'America/Sao_Paulo')::date <= 30 then 'warning'
    else 'ok'
  end as urgency
from public.renewals r;

create view public.v_service_uptime with (security_invoker = true) as
select
  c.service_id,
  c.user_id,
  round(100.0 * count(*) filter (where c.state in ('up', 'degraded')) / nullif(count(*), 0), 2) as uptime_7d,
  round(avg(c.latency_ms))::int as avg_latency_7d,
  count(*) filter (where c.state = 'down')::int as down_checks_7d
from public.service_checks c
where c.checked_at > now() - interval '7 days'
group by c.service_id, c.user_id;

create or replace function public.service_timeline(p_hours int default 168, p_buckets int default 28)
returns table (service_id uuid, bucket int, checks int, down int, degraded int)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.service_id,
    least(
      p_buckets - 1,
      floor(extract(epoch from (c.checked_at - (now() - make_interval(hours => p_hours)))) / (p_hours * 3600.0 / p_buckets))::int
    ) as bucket,
    count(*)::int,
    count(*) filter (where c.state = 'down')::int,
    count(*) filter (where c.state = 'degraded')::int
  from public.service_checks c
  where c.checked_at > now() - make_interval(hours => least(greatest(p_hours, 1), 720))
  group by 1, 2;
$$;

select private.secure_table('public.services');
select private.secure_table('public.renewals');
select private.secure_table('public.service_checks', false);
select private.secure_table('public.alert_events', false);

grant select, insert, delete on public.services to authenticated;
grant update (
  context, name, kind, provider, url, check_method, expected_status, keyword,
  latency_warn_ms, interval_minutes, active, notes
) on public.services to authenticated;
grant select, insert, update, delete on public.renewals to authenticated;
grant select on public.service_checks to authenticated;
grant select on public.alert_events to authenticated;
grant select on public.v_renewals_due, public.v_service_uptime to authenticated;
grant execute on function public.service_timeline(int, int) to authenticated;

create or replace function private.call_app(p_path text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function private.call_app(text) from public, anon, authenticated;

select cron.schedule('meridian-health', '*/5 * * * *', $$ select private.call_app('/api/cron/health'); $$);
select cron.schedule('meridian-daily', '0 12 * * *', $$ select private.call_app('/api/cron/daily'); $$);
select cron.schedule(
  'meridian-checks-retention',
  '15 3 * * *',
  $$
  delete from public.service_checks where checked_at < now() - interval '30 days';
  delete from public.alert_events where created_at < now() - interval '90 days';
  $$
);
