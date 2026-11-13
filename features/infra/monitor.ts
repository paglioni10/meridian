import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";
import { deliverPending, queueAlert } from "./alerts";
import { fetchDomainExpiry, probeHttp, probeTlsExpiry } from "./probe";
import {
  classifyProbe,
  heartbeatState,
  isDue,
  renewalAlert,
  tlsAlertDedupe,
  transitionAlert,
  type ProbeResult,
} from "./rules";
import type { ServiceState } from "./schema";

type Admin = SupabaseClient<Database>;

const SERVICE_COLUMNS =
  "id, user_id, name, url, check_method, expected_status, keyword, latency_warn_ms, interval_minutes, last_state, last_checked_at, last_change_at";

type Service = {
  id: string;
  user_id: string;
  name: string;
  url: string | null;
  check_method: Database["public"]["Enums"]["check_method"];
  expected_status: number;
  keyword: string | null;
  latency_warn_ms: number;
  interval_minutes: number;
  last_state: ServiceState;
  last_checked_at: string | null;
  last_change_at: string | null;
};

type Outcome = {
  state: ServiceState;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function record(admin: Admin, service: Service, outcome: Outcome, at: Date) {
  const changed = outcome.state !== service.last_state;
  const changeAt = changed ? at.toISOString() : (service.last_change_at ?? at.toISOString());

  await admin.from("service_checks").insert({
    user_id: service.user_id,
    service_id: service.id,
    checked_at: at.toISOString(),
    state: outcome.state,
    status_code: outcome.statusCode,
    latency_ms: outcome.latencyMs,
    error: outcome.error?.slice(0, 300) ?? null,
  });
  await admin
    .from("services")
    .update({
      last_state: outcome.state,
      last_checked_at: at.toISOString(),
      last_latency_ms: outcome.latencyMs,
      last_status_code: outcome.statusCode,
      last_error: outcome.error?.slice(0, 300) ?? null,
      last_change_at: changeAt,
    })
    .eq("id", service.id);

  const transition = transitionAlert(service.last_state, outcome.state);
  if (transition) {
    await queueAlert(admin, {
      userId: service.user_id,
      kind: transition.kind,
      dedupe: `service:${service.id}:${transition.kind}:${changeAt}`,
      serviceId: service.id,
      payload: {
        service: service.name,
        url: service.url,
        state: outcome.state,
        error: outcome.error,
        at: at.toISOString(),
      },
    });
  }
  return transition;
}

async function probeService(service: Service): Promise<Outcome> {
  const run = async () => {
    const probe: ProbeResult = await probeHttp(
      service.url!,
      service.check_method === "keyword" ? service.keyword : null,
    );
    const { state, error } = classifyProbe(probe, service.expected_status, service.latency_warn_ms);
    return { state, error, statusCode: probe.statusCode, latencyMs: probe.latencyMs };
  };
  const first = await run();
  if (first.state !== "down" || service.last_state === "down") return first;
  await sleep(1500);
  return run();
}

export async function runChecks(
  admin: Admin,
  options: { serviceIds?: string[]; force?: boolean } = {},
): Promise<{ checked: number; down: number; alerts: number }> {
  let query = admin.from("services").select(SERVICE_COLUMNS).eq("active", true);
  if (options.serviceIds?.length) query = query.in("id", options.serviceIds);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar serviços: ${error.message}`);

  const now = new Date();
  const services = data as Service[];
  let alerts = 0;
  let down = 0;

  for (const service of services.filter((s) => s.check_method === "heartbeat")) {
    if (
      heartbeatState(service.last_checked_at, service.interval_minutes, now) === "down" &&
      service.last_state !== "down"
    ) {
      const transition = await record(
        admin,
        { ...service },
        { state: "down", statusCode: null, latencyMs: null, error: "Heartbeat ausente" },
        now,
      );
      await admin.from("services").update({ last_checked_at: service.last_checked_at }).eq("id", service.id);
      if (transition) alerts++;
      down++;
    }
  }

  const due = services.filter(
    (s) =>
      (s.check_method === "http" || s.check_method === "keyword") &&
      s.url &&
      (options.force || isDue(s.last_checked_at, s.interval_minutes, now)),
  );

  for (let i = 0; i < due.length; i += 6) {
    const batch = due.slice(i, i + 6);
    const outcomes = await Promise.all(batch.map((s) => probeService(s)));
    for (let j = 0; j < batch.length; j++) {
      const transition = await record(admin, batch[j], outcomes[j], new Date());
      if (transition) alerts++;
      if (outcomes[j].state === "down") down++;
    }
  }

  await deliverPending(admin);
  return { checked: due.length, down, alerts };
}

export async function recordHeartbeat(admin: Admin, token: string): Promise<boolean> {
  const { data, error } = await admin
    .from("services")
    .select(SERVICE_COLUMNS)
    .eq("heartbeat_token", token)
    .eq("check_method", "heartbeat")
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return false;
  await record(
    admin,
    data as Service,
    { state: "up", statusCode: null, latencyMs: null, error: null },
    new Date(),
  );
  await deliverPending(admin);
  return true;
}

export async function runDaily(admin: Admin) {
  const today = todayISO();
  const result = { tls: 0, domains: 0, alerts: 0 };

  const { data: services } = await admin
    .from("services")
    .select("id, user_id, name, url, tls_expires_on")
    .eq("active", true)
    .ilike("url", "https://%");
  for (const service of services ?? []) {
    const expires = await probeTlsExpiry(service.url!);
    if (!expires) continue;
    result.tls++;
    if (expires !== service.tls_expires_on) {
      await admin.from("services").update({ tls_expires_on: expires }).eq("id", service.id);
    }
    const dedupe = tlsAlertDedupe(service.id, expires, today);
    if (dedupe) {
      const queued = await queueAlert(admin, {
        userId: service.user_id,
        kind: "tls_due",
        dedupe,
        serviceId: service.id,
        payload: { service: service.name, url: service.url, expires_on: expires },
      });
      if (queued) result.alerts++;
    }
  }

  const { data: domains } = await admin.from("renewals").select("id, name, expires_on").eq("kind", "domain");
  for (const domain of domains ?? []) {
    const expires = await fetchDomainExpiry(domain.name);
    if (expires && expires !== domain.expires_on) {
      await admin.from("renewals").update({ expires_on: expires }).eq("id", domain.id);
      result.domains++;
    }
  }

  const { data: renewals } = await admin
    .from("renewals")
    .select("id, user_id, kind, name, provider, expires_on, alert_days, auto_renew, cost_cents, currency");
  for (const renewal of renewals ?? []) {
    const alert = renewalAlert(renewal, today);
    if (!alert) continue;
    const queued = await queueAlert(admin, {
      userId: renewal.user_id,
      kind: alert.kind,
      dedupe: alert.dedupe,
      renewalId: renewal.id,
      payload: {
        renewal: renewal.name,
        type: renewal.kind,
        provider: renewal.provider,
        expires_on: renewal.expires_on,
        days_left: alert.daysLeft,
        cost_cents: renewal.cost_cents,
        currency: renewal.currency,
      },
    });
    if (queued) result.alerts++;
  }

  const delivery = await deliverPending(admin);
  return { ...result, ...delivery };
}
