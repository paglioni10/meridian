import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { applyContext, type AppContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseNature } from "./schema";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start: month, end: next };
}

export async function getCategories() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name, nature, monthly_budget_cents")
    .order("name");
  if (error) throw new Error(`Falha ao carregar categorias: ${error.message}`);
  return data;
}

export type CategoryRow = Awaited<ReturnType<typeof getCategories>>[number];

export async function getRules() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("category_rules")
    .select("id, pattern, category_id, category:expense_categories(name)")
    .order("pattern");
  if (error) throw new Error(`Falha ao carregar regras: ${error.message}`);
  return data;
}

export async function getRecurring(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await applyContext(
    supabase
      .from("recurring_expenses")
      .select(
        "id, description, amount_cents, due_day, category_id, context, match_pattern, starts_on, ends_on, active, category:expense_categories(name)",
      ),
    context,
  )
    .order("active", { ascending: false })
    .order("due_day");
  if (error) throw new Error(`Falha ao carregar despesas fixas: ${error.message}`);
  return data;
}

export type RecurringRow = Awaited<ReturnType<typeof getRecurring>>[number];

export async function getRecurringPayments(month: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { start, end } = monthBounds(month);
  const { data, error } = await supabase
    .from("expenses")
    .select("recurring_expense_id, amount_cents, occurred_on")
    .not("recurring_expense_id", "is", null)
    .gte("occurred_on", start)
    .lt("occurred_on", end);
  if (error) throw new Error(`Falha ao carregar pagamentos: ${error.message}`);
  return data;
}

export async function getExpenseSeries(context: AppContext, months: number) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expense_series", { p_months: months, p_context: context });
  if (error) throw new Error(`Falha ao carregar o histórico: ${error.message}`);
  return data;
}

export async function getMonthSeries(context: AppContext, month: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expense_series", {
    p_months: 1,
    p_context: context,
    p_today: month,
  });
  if (error) throw new Error(`Falha ao carregar o mês: ${error.message}`);
  return data[0];
}

export async function getRanking(context: AppContext, month: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expense_ranking", { p_month: month, p_context: context });
  if (error) throw new Error(`Falha ao carregar o ranking: ${error.message}`);
  return data;
}

export async function getExpenses(
  context: AppContext,
  month: string,
  filters: { categoria?: string; natureza?: ExpenseNature },
) {
  await getCurrentUser();
  const supabase = await createClient();
  const { start, end } = monthBounds(month);
  let query = applyContext(
    supabase
      .from("expenses")
      .select(
        "id, description, amount_cents, occurred_on, category_id, nature, context, source, recurring_expense_id, category:expense_categories(name)",
      )
      .gte("occurred_on", start)
      .lt("occurred_on", end),
    context,
  );
  if (filters.categoria === "sem") query = query.is("category_id", null);
  else if (filters.categoria) query = query.eq("category_id", filters.categoria);
  if (filters.natureza) query = query.eq("nature", filters.natureza);

  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar despesas: ${error.message}`);
  return data;
}

export type ExpenseRow = Awaited<ReturnType<typeof getExpenses>>[number];

export async function getImportBatches() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select(
      "id, format, filename, period_start, period_end, total_rows, inserted_rows, skipped_rows, income_rows, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Falha ao carregar importações: ${error.message}`);
  return data;
}

export type ImportBatchRow = Awaited<ReturnType<typeof getImportBatches>>[number];
