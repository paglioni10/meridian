import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { isAllowedEmail, safeNextPath } from "@/lib/allowlist";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  let failed = true;
  if (code) {
    failed = Boolean((await supabase.auth.exchangeCodeForSession(code)).error);
  } else if (tokenHash && type) {
    failed = Boolean((await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error);
  }
  if (failed) return NextResponse.redirect(new URL("/login?error=link", origin));

  const { data } = await supabase.auth.getClaims();
  if (!isAllowedEmail(String(data?.claims?.email ?? ""), serverEnv().ALLOWED_EMAILS)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=denied", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
