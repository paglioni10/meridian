"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { currentMonthISO, paydayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { incomeInputSchema, sourceInputSchema, type IncomeField, type SourceField } from "./schema";

export type FormState<F extends string> = {
  status: "idle" | "saved" | "error";
  message: string;
  fieldErrors?: Partial<Record<F, string>>;
  values?: Record<string, string>;
};

export type SourceFormState = FormState<SourceField>;
export type IncomeFormState = FormState<IncomeField>;

function collect(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

function fieldErrorsFrom<F extends string>(issues: z.core.$ZodIssue[]): Partial<Record<F, string>> {
  const errors: Partial<Record<F, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0] as F;
    errors[key] ??= issue.message;
  }
  return errors;
}

export async function saveSource(_prev: SourceFormState, formData: FormData): Promise<SourceFormState> {
  const raw = collect(formData, [
    "id",
    "name",
    "kind",
    "context",
    "default_amount_cents",
    "payday",
    "active",
  ]);
  const parsed = sourceInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: fieldErrorsFrom<SourceField>(parsed.error.issues),
      values: raw,
    };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error } = id
    ? await supabase.from("income_sources").update(values).eq("id", id)
    : await supabase.from("income_sources").insert({ ...values, user_id: user.id });

  if (error) {
    const message =
      error.code === "23505" ? "Já existe uma fonte com esse nome." : "Não foi possível salvar a fonte.";
    if (error.code !== "23505")
      console.error("[income] saveSource", { code: error.code, message: error.message });
    return {
      status: "error",
      message,
      fieldErrors: error.code === "23505" ? { name: message } : undefined,
      values: raw,
    };
  }

  refresh();
  return { status: "saved", message: id ? "Fonte atualizada." : "Fonte adicionada." };
}

export async function deleteSource(id: string) {
  const sourceId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("income_sources").delete().eq("id", sourceId);
  if (error?.code === "23503") {
    throw new Error("Essa fonte tem lançamentos. Desative em vez de excluir.");
  }
  if (error) throw new Error("Não foi possível excluir a fonte.");
  refresh();
}

export async function saveIncome(_prev: IncomeFormState, formData: FormData): Promise<IncomeFormState> {
  const raw = collect(formData, [
    "id",
    "source_id",
    "competence_month",
    "received_on",
    "amount_cents",
    "gross_cents",
    "description",
  ]);
  const parsed = incomeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: fieldErrorsFrom<IncomeField>(parsed.error.issues),
      values: raw,
    };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error } = id
    ? await supabase.from("incomes").update(values).eq("id", id)
    : await supabase.from("incomes").insert({ ...values, user_id: user.id });

  if (error) {
    console.error("[income] saveIncome", { code: error.code, message: error.message });
    return { status: "error", message: "Não foi possível salvar o ganho.", values: raw };
  }

  refresh();
  return { status: "saved", message: id ? "Ganho atualizado." : "Ganho lançado." };
}

export async function deleteIncome(id: string) {
  const incomeId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("incomes").delete().eq("id", incomeId);
  if (error) throw new Error("Não foi possível excluir o ganho.");
  refresh();
}

export async function launchFromSource(id: string) {
  const sourceId = z.uuid().parse(id);
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("income_sources")
    .select("id, name, default_amount_cents, payday")
    .eq("id", sourceId)
    .single();
  if (sourceError || !source) throw new Error("Fonte não encontrada.");
  if (!source.default_amount_cents) throw new Error("Defina um valor padrão na fonte antes de lançar.");

  const month = currentMonthISO();
  const { error } = await supabase.from("incomes").insert({
    user_id: user.id,
    source_id: source.id,
    competence_month: month,
    received_on: source.payday ? paydayISO(month, source.payday) : null,
    amount_cents: source.default_amount_cents,
  });
  if (error) throw new Error("Não foi possível lançar o ganho.");
  refresh();
}
