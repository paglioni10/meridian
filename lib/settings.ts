import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { APP_CONTEXTS, CONTEXT_COOKIE, isAppContext, type AppContext } from "@/lib/context";
import { THEMES } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";

export const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Cuiaba",
  "America/Rio_Branco",
  "America/Noronha",
] as const;

export const settingsSchema = z.object({
  theme: z.enum(THEMES).default("system"),
  active_context: z.enum(APP_CONTEXTS).default("all"),
  obsidian_vault: z.string().trim().min(1).max(120).nullable().default(null),
  safe_base_months: z.coerce.number().int().min(3).max(24).default(6),
  timezone: z.enum(TIMEZONES).catch("America/Sao_Paulo").default("America/Sao_Paulo"),
});

export type UserSettings = z.infer<typeof settingsSchema>;

export const getSettings = cache(async (): Promise<UserSettings> => {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("theme, active_context, obsidian_vault, safe_base_months, timezone")
    .maybeSingle();
  return settingsSchema.parse(data ?? {});
});

export const getActiveContext = cache(async (): Promise<AppContext> => {
  const fromCookie = (await cookies()).get(CONTEXT_COOKIE)?.value;
  if (isAppContext(fromCookie)) return fromCookie;
  return (await getSettings()).active_context;
});
