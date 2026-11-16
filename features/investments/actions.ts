"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ASSET_CLASSES } from "./rebalance";
import { assetInputSchema, balanceInputSchema, targetsInputSchema, transactionInputSchema } from "./schema";
import { fetchBrapi, fetchCoingecko, syncQuotes } from "./sync";

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
  for (const issue of issues) fieldErrors[String(issue.path[0] ?? "_")] ??= issue.message;
  return { status: "error", message: fieldErrors._ ?? "Revise os campos destacados.", fieldErrors, values };
}

function failed(
  message: string,
  values: Record<string, string>,
  error?: { code?: string; message?: string },
) {
  if (error) console.error("[investments]", { code: error.code, detail: error.message });
  return { status: "error" as const, message, values };
}

export async function saveAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [
    "id",
    "ticker_or_name",
    "asset_class",
    "institution",
    "valuation_mode",
    "quote_source",
    "quote_symbol",
    "linked_goal_id",
    "context",
  ]);
  const parsed = assetInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error } = id
    ? await supabase.from("investment_assets").update(values).eq("id", id)
    : await supabase.from("investment_assets").insert({ ...values, user_id: user.id });
  if (error?.code === "23505") {
    return {
      status: "error",
      message: "Já existe.",
      fieldErrors: { ticker_or_name: "Esse ativo já está cadastrado nessa instituição" },
      values: raw,
    };
  }
  if (error) return failed("Não foi possível salvar o ativo.", raw, error);

  if (!id && values.quote_source !== "manual")
    await syncQuotes(supabase, { minAgeMinutes: 0 }).catch(() => undefined);
  refresh();
  return { status: "saved", message: id ? "Ativo atualizado." : "Ativo cadastrado." };
}

export async function testQuote(source: string, symbol: string): Promise<number | null> {
  await getCurrentUser();
  const s = z
    .object({ source: z.enum(["brapi", "coingecko"]), symbol: z.string().trim().min(1).max(40) })
    .parse({
      source,
      symbol,
    });
  if (s.source === "brapi") return fetchBrapi(s.symbol);
  return (await fetchCoingecko([s.symbol]))[s.symbol.toLowerCase()] ?? null;
}

export async function saveTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [
    "asset_id",
    "type",
    "occurred_on",
    "quantity",
    "unit_price",
    "total_amount_cents",
    "notes",
  ]);
  const parsed = transactionInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("investment_assets")
    .select("valuation_mode")
    .eq("id", parsed.data.asset_id)
    .single();
  if (!asset) return failed("Ativo não encontrado.", raw);

  const v = parsed.data;
  const trade = asset.valuation_mode === "quote" && (v.type === "contribution" || v.type === "withdrawal");
  if (trade && (v.quantity === null || v.unit_price === null)) {
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: { quantity: "Informe quantidade e preço unitário" },
      values: raw,
    };
  }
  const total = v.total_amount_cents ?? (trade ? Math.round(v.quantity! * v.unit_price! * 100) : null);
  if (!total) {
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: { total_amount_cents: "Informe o valor" },
      values: raw,
    };
  }

  const { error } = await supabase.from("investment_transactions").insert({
    user_id: user.id,
    asset_id: v.asset_id,
    type: v.type,
    occurred_on: v.occurred_on,
    quantity: trade ? v.quantity : null,
    unit_price: trade ? v.unit_price : null,
    total_amount_cents: total,
    notes: v.notes,
  });
  if (error?.code === "23514") {
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: { quantity: "Resgate maior que a posição atual" },
      values: raw,
    };
  }
  if (error) return failed("Não foi possível lançar a movimentação.", raw, error);

  refresh();
  return { status: "saved", message: "Movimentação lançada." };
}

export async function deleteTransaction(id: string) {
  const txId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("investment_transactions").delete().eq("id", txId);
  if (error?.code === "23514")
    throw new Error("Excluir esse aporte deixaria um resgate maior que a posição.");
  if (error) throw new Error("Não foi possível excluir a movimentação.");
  refresh();
}

export async function updateAssetValue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["id", "value_cents"]);
  const parsed = balanceInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  await getCurrentUser();
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("investment_assets")
    .select("valuation_mode")
    .eq("id", parsed.data.id)
    .single();
  if (!asset) return failed("Ativo não encontrado.", raw);
  const now = new Date().toISOString();
  const update =
    asset.valuation_mode === "balance"
      ? { current_balance_cents: parsed.data.value_cents, price_updated_at: now }
      : { current_price: parsed.data.value_cents / 100, price_updated_at: now };
  const { error } = await supabase.from("investment_assets").update(update).eq("id", parsed.data.id);
  if (error) return failed("Não foi possível atualizar o valor.", raw, error);

  refresh();
  return {
    status: "saved",
    message: asset.valuation_mode === "balance" ? "Saldo atualizado." : "Cotação atualizada.",
  };
}

export async function archiveAsset(id: string) {
  const assetId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_assets")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", assetId);
  if (error) throw new Error("Não foi possível arquivar o ativo.");
  refresh();
}

export async function saveTargets(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [...ASSET_CLASSES]);
  const parsed = targetsInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const rows = ASSET_CLASSES.map((c) => ({ user_id: user.id, asset_class: c, target_pct: parsed.data[c] }));
  const { error } = await supabase
    .from("investment_targets")
    .upsert(rows, { onConflict: "user_id,asset_class" });
  if (error) return failed("Não foi possível salvar as metas.", raw, error);

  refresh();
  return { status: "saved", message: "Metas de alocação salvas." };
}

export async function refreshQuotes() {
  await getCurrentUser();
  const supabase = await createClient();
  const result = await syncQuotes(supabase, { minAgeMinutes: 10 });
  refresh();
  return result;
}
