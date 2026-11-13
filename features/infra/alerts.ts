import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database, Json } from "@/lib/supabase/database.types";
import { signBody } from "./rules";
import type { AlertKind } from "./schema";

type Admin = SupabaseClient<Database>;

export type AlertInput = {
  userId: string;
  kind: AlertKind;
  dedupe: string;
  serviceId?: string | null;
  renewalId?: string | null;
  payload: Record<string, Json>;
};

export async function queueAlert(admin: Admin, alert: AlertInput): Promise<boolean> {
  const { data, error } = await admin
    .from("alert_events")
    .upsert(
      {
        user_id: alert.userId,
        kind: alert.kind,
        dedupe_key: alert.dedupe,
        service_id: alert.serviceId ?? null,
        renewal_id: alert.renewalId ?? null,
        payload: alert.payload,
      },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) console.error("[alerts] queue", { code: error.code, detail: error.message });
  return (data?.length ?? 0) > 0;
}

export async function deliverPending(admin: Admin): Promise<{ delivered: number; failed: number }> {
  const { ALERT_WEBHOOK_URL: url, ALERT_WEBHOOK_SECRET: secret } = serverEnv();
  if (!url || !secret) return { delivered: 0, failed: 0 };

  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: pending, error } = await admin
    .from("alert_events")
    .select("id, kind, dedupe_key, payload, attempts, created_at")
    .is("delivered_at", null)
    .lt("attempts", 10)
    .gte("created_at", since)
    .order("created_at")
    .limit(50);
  if (error || !pending?.length) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;
  for (const alert of pending) {
    const body = JSON.stringify({
      id: alert.id,
      kind: alert.kind,
      created_at: alert.created_at,
      ...(alert.payload as Record<string, Json>),
    });
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-meridian-signature": signBody(body, secret) },
        body,
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Webhook respondeu ${response.status}`);
      await admin
        .from("alert_events")
        .update({
          delivered_at: new Date().toISOString(),
          delivery_error: null,
          attempts: alert.attempts + 1,
        })
        .eq("id", alert.id);
      delivered++;
    } catch (e) {
      await admin
        .from("alert_events")
        .update({ delivery_error: (e as Error).message.slice(0, 300), attempts: alert.attempts + 1 })
        .eq("id", alert.id);
      failed++;
    }
  }
  return { delivered, failed };
}
