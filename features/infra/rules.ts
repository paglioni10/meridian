import { createHmac } from "node:crypto";
import type { AlertKind, ServiceState } from "./schema";

export type ProbeResult = {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  keywordFound: boolean | null;
  error: string | null;
};

export function classifyProbe(
  probe: ProbeResult,
  expectedStatus: number,
  latencyWarnMs: number,
): { state: ServiceState; error: string | null } {
  if (!probe.ok || probe.statusCode === null) return { state: "down", error: probe.error ?? "Sem resposta" };
  if (probe.statusCode !== expectedStatus) {
    return { state: "down", error: `Status ${probe.statusCode}, esperado ${expectedStatus}` };
  }
  if (probe.keywordFound === false) return { state: "down", error: "Palavra-chave não encontrada" };
  if (probe.latencyMs !== null && probe.latencyMs > latencyWarnMs) {
    return { state: "degraded", error: `Resposta em ${probe.latencyMs} ms` };
  }
  return { state: "up", error: null };
}

export function isDue(lastCheckedAt: string | null, intervalMinutes: number, now: Date): boolean {
  if (!lastCheckedAt) return true;
  return now.getTime() - new Date(lastCheckedAt).getTime() >= (intervalMinutes * 60 - 30) * 1000;
}

export function heartbeatState(
  lastCheckedAt: string | null,
  intervalMinutes: number,
  now: Date,
): ServiceState | null {
  if (!lastCheckedAt) return null;
  const silentMs = now.getTime() - new Date(lastCheckedAt).getTime();
  return silentMs > 2 * intervalMinutes * 60_000 ? "down" : null;
}

export type Transition = { kind: Extract<AlertKind, "service_down" | "service_up"> } | null;

export function transitionAlert(previous: ServiceState, next: ServiceState): Transition {
  const wasDown = previous === "down";
  const isDown = next === "down";
  if (!wasDown && isDown) return { kind: "service_down" };
  if (wasDown && !isDown && next !== "unknown") return { kind: "service_up" };
  return null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

export function nextExpiry(expiresOn: string, cycle: "monthly" | "yearly" | "other", today: string): string {
  const base = expiresOn < today ? today : expiresOn;
  const d = new Date(`${base}T00:00:00Z`);
  const day = d.getUTCDate();
  if (cycle === "monthly") d.setUTCMonth(d.getUTCMonth() + 1, 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1, d.getUTCMonth(), 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export function estimateBalance(
  balanceCents: number,
  monthlyBurnCents: number,
  updatedOn: string,
  today: string,
): number {
  const days = Math.max(0, daysBetween(updatedOn, today));
  return Math.max(0, balanceCents - Math.round((monthlyBurnCents * days) / 30.4375));
}

export function projectCreditExpiry(
  balanceCents: number,
  monthlyBurnCents: number,
  updatedOn: string,
): string {
  return addDays(updatedOn, Math.floor((balanceCents / monthlyBurnCents) * 30.4375));
}

export type RenewalAlert = {
  kind: Extract<AlertKind, "renewal_due" | "renewal_expired" | "credit_low">;
  dedupe: string;
  daysLeft: number;
};

export function renewalAlert(
  renewal: { id: string; kind: string; expires_on: string; alert_days: number[]; auto_renew: boolean },
  today: string,
): RenewalAlert | null {
  const daysLeft = daysBetween(today, renewal.expires_on);
  if (daysLeft < 0) {
    if (renewal.auto_renew) return null;
    return {
      kind: "renewal_expired",
      dedupe: `renewal:${renewal.id}:${renewal.expires_on}:expired`,
      daysLeft,
    };
  }
  const threshold = [...renewal.alert_days].sort((a, b) => a - b).find((d) => daysLeft <= d);
  if (threshold === undefined) return null;
  if (renewal.auto_renew && renewal.kind !== "credit") return null;
  return {
    kind: renewal.kind === "credit" ? "credit_low" : "renewal_due",
    dedupe: `renewal:${renewal.id}:${renewal.expires_on}:${threshold}d`,
    daysLeft,
  };
}

export function tlsAlertDedupe(serviceId: string, expiresOn: string, today: string): string | null {
  const daysLeft = daysBetween(today, expiresOn);
  const threshold = [1, 7, 14].find((d) => daysLeft <= d);
  return threshold === undefined ? null : `tls:${serviceId}:${expiresOn}:${threshold}d`;
}

export function parseRdapExpiration(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return null;
  for (const e of events) {
    if (
      e &&
      typeof e === "object" &&
      (e as { eventAction?: unknown }).eventAction === "expiration" &&
      typeof (e as { eventDate?: unknown }).eventDate === "string"
    ) {
      const date = new Date((e as { eventDate: string }).eventDate);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function rdapUrl(domain: string): string | null {
  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
  return host.endsWith(".br") ? `https://rdap.registro.br/domain/${host}` : `https://rdap.org/domain/${host}`;
}

export function signBody(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}
