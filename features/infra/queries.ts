import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { applyContext, type AppContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export const TIMELINE_HOURS = 168;
export const TIMELINE_BUCKETS = 28;

export async function getServices(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const [services, uptime, timeline] = await Promise.all([
    applyContext(
      supabase
        .from("services")
        .select(
          "id, context, name, kind, provider, url, check_method, expected_status, keyword, latency_warn_ms, interval_minutes, heartbeat_token, last_state, last_checked_at, last_latency_ms, last_status_code, last_error, last_change_at, tls_expires_on, active, notes",
        ),
      context,
    )
      .order("active", { ascending: false })
      .order("name"),
    supabase.from("v_service_uptime").select("service_id, uptime_7d, avg_latency_7d, down_checks_7d"),
    supabase.rpc("service_timeline", { p_hours: TIMELINE_HOURS, p_buckets: TIMELINE_BUCKETS }),
  ]);
  if (services.error) throw new Error(`Falha ao carregar serviços: ${services.error.message}`);
  if (uptime.error || timeline.error) throw new Error("Falha ao carregar o histórico dos serviços.");

  const uptimeBy = new Map(uptime.data.map((u) => [u.service_id, u]));
  const now = Date.now();
  return services.data.map((s) => {
    const buckets = Array.from(
      { length: TIMELINE_BUCKETS },
      () => "none" as "none" | "up" | "degraded" | "down",
    );
    for (const t of timeline.data.filter((t) => t.service_id === s.id)) {
      if (t.bucket < 0 || t.bucket >= TIMELINE_BUCKETS) continue;
      buckets[t.bucket] = t.down > 0 ? "down" : t.degraded > 0 ? "degraded" : "up";
    }
    const u = uptimeBy.get(s.id);
    return {
      ...s,
      uptime_7d: u?.uptime_7d ?? null,
      avg_latency_7d: u?.avg_latency_7d ?? null,
      down_checks_7d: u?.down_checks_7d ?? 0,
      minutes_since_check: s.last_checked_at
        ? Math.max(0, Math.round((now - new Date(s.last_checked_at).getTime()) / 60_000))
        : null,
      timeline: buckets,
    };
  });
}

export type ServiceRow = Awaited<ReturnType<typeof getServices>>[number];

export async function getRenewals(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await applyContext(
    supabase
      .from("v_renewals_due")
      .select(
        "id, service_id, kind, name, provider, context, expires_on, currency, cost_cents, billing_cycle, balance_cents, monthly_burn_cents, balance_updated_on, owner_is_client, auto_renew, alert_days, notes, days_left, urgency",
      ),
    context,
  ).order("expires_on");
  if (error) throw new Error(`Falha ao carregar vencimentos: ${error.message}`);
  return data.map((r) => ({
    ...r,
    id: r.id!,
    kind: r.kind!,
    name: r.name!,
    context: r.context!,
    expires_on: r.expires_on!,
    currency: r.currency ?? "BRL",
    billing_cycle: r.billing_cycle ?? "other",
    owner_is_client: r.owner_is_client ?? false,
    auto_renew: r.auto_renew ?? false,
    alert_days: r.alert_days ?? [],
    days_left: r.days_left ?? 0,
    urgency: (r.urgency ?? "ok") as "expired" | "critical" | "warning" | "ok",
  }));
}

export type RenewalRow = Awaited<ReturnType<typeof getRenewals>>[number];

export async function getRecentAlerts(limit = 8) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alert_events")
    .select("id, kind, payload, delivered_at, delivery_error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao carregar alertas: ${error.message}`);
  return data;
}

export type AlertRow = Awaited<ReturnType<typeof getRecentAlerts>>[number];

export async function getIncidents24h() {
  await getCurrentUser();
  const supabase = await createClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error } = await supabase
    .from("alert_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "service_down")
    .gte("created_at", since);
  if (error) throw new Error(`Falha ao contar incidentes: ${error.message}`);
  return count ?? 0;
}
