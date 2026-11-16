import { syncQuotes } from "@/features/investments/sync";
import { isCronRequest } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (isCronRequest(request)) {
    return Response.json(await syncQuotes(createAdminClient(), { minAgeMinutes: 0 }));
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await syncQuotes(supabase, { minAgeMinutes: 10 }));
}
