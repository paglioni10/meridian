import { runChecks } from "@/features/infra/monitor";
import { isCronRequest, unauthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

async function handle(request: Request) {
  if (!isCronRequest(request)) return unauthorized();
  const result = await runChecks(createAdminClient());
  return Response.json({ ok: true, ...result });
}

export { handle as GET, handle as POST };
