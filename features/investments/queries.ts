import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { applyContext, type AppContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import type { AssetClass } from "./rebalance";

export type ClassSummary = {
  class: AssetClass;
  assets: number;
  equity_cents: number;
  current_pct: number;
  target_pct: number;
  gap_cents: number;
};

export type PortfolioSummary = {
  equity_cents: number;
  invested_cents: number;
  result_cents: number;
  return_pct: number | null;
  income_month_cents: number;
  net_contribution_month_cents: number;
  classes: ClassSummary[];
};

export async function getPortfolioSummary(context: AppContext, month: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portfolio_summary", { p_context: context, p_month: month });
  if (error) throw new Error(`Falha ao carregar o patrimônio: ${error.message}`);
  const s = data as unknown as PortfolioSummary;
  return {
    ...s,
    classes: (s.classes ?? []).map((c) => ({
      ...c,
      current_pct: Number(c.current_pct),
      target_pct: Number(c.target_pct),
    })),
  };
}

export async function getPositions(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await applyContext(
    supabase
      .from("v_investment_positions")
      .select(
        "id, context, ticker_or_name, asset_class, institution, valuation_mode, quote_source, quote_symbol, quantity, avg_price, invested_cents, current_price, price_updated_at, linked_goal_id, equity_cents",
      ),
    context,
  ).order("equity_cents", { ascending: false });
  if (error) throw new Error(`Falha ao carregar a carteira: ${error.message}`);
  return data.map((p) => ({
    ...p,
    id: p.id!,
    ticker_or_name: p.ticker_or_name!,
    asset_class: p.asset_class as AssetClass,
    context: p.context!,
    valuation_mode: p.valuation_mode!,
    quote_source: p.quote_source!,
    quantity: Number(p.quantity ?? 0),
    avg_price: Number(p.avg_price ?? 0),
    current_price: p.current_price === null ? null : Number(p.current_price),
    invested_cents: p.invested_cents ?? 0,
    equity_cents: p.equity_cents ?? 0,
  }));
}

export type PositionRow = Awaited<ReturnType<typeof getPositions>>[number];

export async function getTransactions(limit = 30) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_transactions")
    .select(
      "id, asset_id, type, quantity, unit_price, total_amount_cents, occurred_on, notes, asset:investment_assets(ticker_or_name)",
    )
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao carregar movimentações: ${error.message}`);
  return data;
}

export type TransactionRow = Awaited<ReturnType<typeof getTransactions>>[number];

export async function getTargets() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("investment_targets").select("asset_class, target_pct");
  if (error) throw new Error(`Falha ao carregar metas: ${error.message}`);
  return Object.fromEntries(data.map((t) => [t.asset_class, Number(t.target_pct)])) as Partial<
    Record<AssetClass, number>
  >;
}

export async function getMonthlyFlows(context: AppContext, months: number) {
  await getCurrentUser();
  const supabase = await createClient();
  const [incomes, expenses, txs, snapshots] = await Promise.all([
    supabase.rpc("income_series", { p_months: months, p_context: context }),
    supabase.rpc("expense_series", { p_months: months, p_context: context }),
    supabase
      .from("investment_transactions")
      .select("type, total_amount_cents, occurred_on")
      .in("type", ["contribution", "withdrawal"]),
    supabase
      .from("portfolio_snapshots")
      .select("month, total_invested_cents, total_equity_cents")
      .order("month"),
  ]);
  if (incomes.error || expenses.error || txs.error || snapshots.error) {
    throw new Error("Falha ao carregar o histórico de aportes.");
  }
  return {
    incomes: incomes.data as unknown as Record<string, unknown>[],
    expenses: expenses.data as unknown as Record<string, unknown>[],
    transactions: txs.data,
    snapshots: snapshots.data,
  };
}
