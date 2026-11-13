import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await connection();
  const started = performance.now();
  const { error } = await createAdminClient()
    .from("services")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  const db = error ? "down" : "up";
  return Response.json(
    { ok: !error, db, latency_ms: Math.round(performance.now() - started) },
    { status: error ? 503 : 200, headers: { "cache-control": "no-store" } },
  );
}
