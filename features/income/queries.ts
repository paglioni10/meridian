import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { applyContext, type AppContext } from "@/lib/context";
import { currentMonthISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Range } from "./schema";

export async function getIncomeSeries(context: AppContext, months: Range) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("income_series", { p_months: months, p_context: context });
  if (error) throw new Error(`Falha ao carregar a série de ganhos: ${error.message}`);
  return data;
}

export type IncomePoint = Awaited<ReturnType<typeof getIncomeSeries>>[number];

export async function getSafeBase(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("safe_monthly_base", { p_context: context }).single();
  if (error) throw new Error(`Falha ao calcular a base segura: ${error.message}`);
  return data;
}

export async function getIncomeSources(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const month = currentMonthISO();
  const { data, error } = await applyContext(
    supabase
      .from("income_sources")
      .select("id, name, kind, context, default_amount_cents, payday, active, incomes(competence_month)")
      .eq("incomes.competence_month", month),
    context,
  )
    .order("active", { ascending: false })
    .order("kind")
    .order("name");
  if (error) throw new Error(`Falha ao carregar as fontes: ${error.message}`);
  return data.map(({ incomes, ...source }) => ({ ...source, launchedThisMonth: incomes.length > 0 }));
}

export type IncomeSourceRow = Awaited<ReturnType<typeof getIncomeSources>>[number];

export async function getIncomes(context: AppContext, fromMonth: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await applyContext(
    supabase
      .from("incomes")
      .select(
        "id, source_id, kind, context, competence_month, received_on, amount_cents, gross_cents, description, source:income_sources(name)",
      )
      .gte("competence_month", fromMonth),
    context,
  )
    .order("competence_month", { ascending: false })
    .order("received_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar os ganhos: ${error.message}`);
  return data;
}

export type IncomeRow = Awaited<ReturnType<typeof getIncomes>>[number];
