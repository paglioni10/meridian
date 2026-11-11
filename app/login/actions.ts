"use server";

import { z } from "zod";
import { publicEnv, serverEnv } from "@/lib/env";
import { isAllowedEmail, safeNextPath } from "@/lib/allowlist";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message: string };

const schema = z.object({
  email: z.email("E-mail inválido"),
  next: z.string().optional(),
});

const SENT: LoginState = {
  status: "sent",
  message: "Se o e-mail estiver autorizado, o link de acesso chega em instantes.",
};

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "E-mail inválido" };
  }

  const email = parsed.data.email.toLowerCase();
  if (!isAllowedEmail(email, serverEnv().ALLOWED_EMAILS)) return SENT;

  const callback = new URL("/auth/callback", publicEnv.NEXT_PUBLIC_SITE_URL);
  callback.searchParams.set("next", safeNextPath(parsed.data.next));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
  });

  if (error && error.status !== 422) {
    return { status: "error", message: "Não foi possível enviar o link. Tente novamente em instantes." };
  }
  return SENT;
}
