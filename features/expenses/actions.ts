"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { currentMonthISO, paydayISO } from "@/lib/dates";
import { normalizeDescription } from "@/lib/parsers/text";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES, matchRule } from "./classify";
import { categoryInputSchema, expenseInputSchema, recurringInputSchema, ruleInputSchema } from "./schema";

export type ActionState = {
  status: "idle" | "saved" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

function collect(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

function invalid(issues: z.core.$ZodIssue[], values: Record<string, string>): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return { status: "error", message: "Revise os campos destacados.", fieldErrors, values };
}

function failed(
  message: string,
  values: Record<string, string>,
  code?: string,
  detail?: string,
): ActionState {
  if (code) console.error("[expenses]", { code, detail });
  return { status: "error", message, values };
}

export async function saveExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [
    "id",
    "description",
    "amount_cents",
    "occurred_on",
    "category_id",
    "nature",
    "context",
    "recurring_expense_id",
  ]);
  const parsed = expenseInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const payload = { ...values, description_normalized: normalizeDescription(values.description) };
  const { error } = id
    ? await supabase.from("expenses").update(payload).eq("id", id)
    : await supabase.from("expenses").insert({ ...payload, user_id: user.id, source: "manual" });
  if (error) return failed("Não foi possível salvar a despesa.", raw, error.code, error.message);

  refresh();
  return { status: "saved", message: id ? "Despesa atualizada." : "Despesa lançada." };
}

export async function deleteExpense(id: string) {
  const expenseId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) throw new Error("Não foi possível excluir a despesa.");
  refresh();
}

export async function markRecurringPaid(id: string, month: string) {
  const parsed = z.object({ id: z.uuid(), month: z.string().regex(/^\d{4}-\d{2}-01$/) }).parse({ id, month });
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: rec, error: recError } = await supabase
    .from("recurring_expenses")
    .select("id, description, amount_cents, due_day, category_id, context")
    .eq("id", parsed.id)
    .single();
  if (recError || !rec) throw new Error("Despesa fixa não encontrada.");

  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    description: rec.description,
    description_normalized: normalizeDescription(rec.description),
    amount_cents: rec.amount_cents,
    occurred_on: paydayISO(parsed.month, rec.due_day),
    category_id: rec.category_id,
    recurring_expense_id: rec.id,
    nature: "fixed",
    context: rec.context,
    source: "recurring",
  });
  if (error) throw new Error("Não foi possível marcar como paga.");
  refresh();
}

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["id", "name", "nature", "monthly_budget_cents"]);
  const parsed = categoryInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error } = id
    ? await supabase.from("expense_categories").update(values).eq("id", id)
    : await supabase.from("expense_categories").insert({ ...values, user_id: user.id });
  if (error?.code === "23505") {
    return {
      status: "error",
      message: "Já existe.",
      fieldErrors: { name: "Já existe uma categoria com esse nome" },
      values: raw,
    };
  }
  if (error) return failed("Não foi possível salvar a categoria.", raw, error.code, error.message);

  refresh();
  return { status: "saved", message: id ? "Categoria atualizada." : "Categoria criada." };
}

export async function deleteCategory(id: string) {
  const categoryId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").delete().eq("id", categoryId);
  if (error) throw new Error("Não foi possível excluir a categoria.");
  refresh();
}

export async function seedDefaultCategories() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("expense_categories").select("name");
  const have = new Set((existing ?? []).map((c) => c.name));
  const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(c.name));
  if (missing.length > 0) {
    const { error } = await supabase
      .from("expense_categories")
      .insert(missing.map((c) => ({ user_id: user.id, name: c.name, nature: c.nature })));
    if (error) throw new Error("Não foi possível criar as categorias.");
  }

  const { data: categories } = await supabase.from("expense_categories").select("id, name");
  const byName = new Map((categories ?? []).map((c) => [c.name, c.id]));
  const rules = DEFAULT_CATEGORIES.flatMap((c) =>
    c.patterns.map((pattern) => ({ user_id: user.id, pattern, category_id: byName.get(c.name)! })),
  ).filter((r) => r.category_id);
  if (rules.length > 0) {
    const { error } = await supabase
      .from("category_rules")
      .upsert(rules, { onConflict: "user_id,pattern", ignoreDuplicates: true });
    if (error) throw new Error("Não foi possível criar as regras.");
  }
  refresh();
}

export async function saveRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["pattern", "category_id"]);
  const parsed = ruleInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("category_rules").insert({ ...parsed.data, user_id: user.id });
  if (error?.code === "23505") {
    return {
      status: "error",
      message: "Já existe.",
      fieldErrors: { pattern: "Já existe uma regra com esse texto" },
      values: raw,
    };
  }
  if (error) return failed("Não foi possível salvar a regra.", raw, error.code, error.message);

  refresh();
  return { status: "saved", message: "Regra criada." };
}

export async function deleteRule(id: string) {
  const ruleId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("category_rules").delete().eq("id", ruleId);
  if (error) throw new Error("Não foi possível excluir a regra.");
  refresh();
}

export async function applyRulesToUncategorized(): Promise<number> {
  await getCurrentUser();
  const supabase = await createClient();
  const [{ data: rules }, { data: categories }, { data: expenses }] = await Promise.all([
    supabase.from("category_rules").select("pattern, category_id"),
    supabase.from("expense_categories").select("id, nature"),
    supabase
      .from("expenses")
      .select("id, description_normalized, recurring_expense_id")
      .is("category_id", null)
      .limit(2000),
  ]);
  const ruleInput = (rules ?? []).map((r) => ({ pattern: r.pattern, categoryId: r.category_id }));
  const nature = new Map((categories ?? []).map((c) => [c.id, c.nature]));
  let updated = 0;
  for (const e of expenses ?? []) {
    const categoryId = matchRule(e.description_normalized, ruleInput);
    if (!categoryId) continue;
    const { error } = await supabase
      .from("expenses")
      .update({
        category_id: categoryId,
        ...(e.recurring_expense_id ? {} : { nature: nature.get(categoryId) ?? "variable" }),
      })
      .eq("id", e.id);
    if (!error) updated++;
  }
  refresh();
  return updated;
}

export async function saveRecurring(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [
    "id",
    "description",
    "amount_cents",
    "due_day",
    "category_id",
    "context",
    "match_pattern",
    "active",
  ]);
  const parsed = recurringInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error } = id
    ? await supabase.from("recurring_expenses").update(values).eq("id", id)
    : await supabase
        .from("recurring_expenses")
        .insert({ ...values, user_id: user.id, starts_on: currentMonthISO() });
  if (error) return failed("Não foi possível salvar a despesa fixa.", raw, error.code, error.message);

  refresh();
  return { status: "saved", message: id ? "Despesa fixa atualizada." : "Despesa fixa criada." };
}

export async function deleteRecurring(id: string) {
  const recurringId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", recurringId);
  if (error) throw new Error("Não foi possível excluir a despesa fixa.");
  refresh();
}
