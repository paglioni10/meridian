import type { NextRequest } from "next/server";
import { z } from "zod";
import { recordHeartbeat } from "@/features/infra/monitor";
import { createAdminClient } from "@/lib/supabase/admin";

async function handle(_request: NextRequest, ctx: RouteContext<"/api/heartbeat/[token]">) {
  const { token } = await ctx.params;
  const parsed = z.uuid().safeParse(token);
  if (!parsed.success) return Response.json({ ok: false }, { status: 404 });
  const found = await recordHeartbeat(createAdminClient(), parsed.data);
  return Response.json(
    { ok: found },
    { status: found ? 200 : 404, headers: { "cache-control": "no-store" } },
  );
}

export { handle as GET, handle as POST };
