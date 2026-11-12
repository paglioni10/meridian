"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { CONTEXT_COOKIE, isAppContext } from "@/lib/context";
import { TIMEZONES } from "@/lib/settings";
import { THEME_COOKIE, isThemePreference } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";

const YEAR = 60 * 60 * 24 * 365;

async function saveSettings(values: Record<string, unknown>) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, ...values }, { onConflict: "user_id" });
  if (error) {
    console.error("[settings] upsert falhou", { code: error.code, message: error.message });
    throw new Error("Não foi possível salvar as preferências.");
  }
}

export async function setTheme(theme: string) {
  if (!isThemePreference(theme)) throw new Error("Tema inválido");
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: false });
  await saveSettings({ theme });
}

export async function setContext(context: string) {
  if (!isAppContext(context)) throw new Error("Contexto inválido");
  (await cookies()).set(CONTEXT_COOKIE, context, {
    path: "/",
    maxAge: YEAR,
    sameSite: "lax",
    httpOnly: true,
  });
  await saveSettings({ active_context: context });
  refresh();
}

export type SettingsFormState = {
  status: "idle" | "saved" | "error";
  message: string;
  fieldErrors?: Partial<Record<"obsidian_vault" | "safe_base_months" | "timezone", string>>;
};

const formSchema = z.object({
  obsidian_vault: z
    .string()
    .trim()
    .max(120, "Máximo de 120 caracteres")
    .transform((v) => (v === "" ? null : v)),
  safe_base_months: z.coerce
    .number({ error: "Informe um número" })
    .int("Use um número inteiro")
    .min(3, "Mínimo de 3 meses")
    .max(24, "Máximo de 24 meses"),
  timezone: z.enum(TIMEZONES, { error: "Fuso inválido" }),
});

export async function updateSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const parsed = formSchema.safeParse({
    obsidian_vault: formData.get("obsidian_vault") ?? "",
    safe_base_months: formData.get("safe_base_months"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    const fieldErrors: SettingsFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<SettingsFormState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Revise os campos destacados.", fieldErrors };
  }

  try {
    await saveSettings(parsed.data);
  } catch (e) {
    return { status: "error", message: (e as Error).message };
  }
  refresh();
  return { status: "saved", message: "Preferências salvas." };
}
