import { z } from "zod";
import type { Enums } from "@/lib/supabase/database.types";
import { optionalMoney, requiredMoney } from "@/lib/zod-money";
import { ASSET_CLASSES } from "./rebalance";

export type ValuationMode = Enums<"valuation_mode">;
export type QuoteSource = Enums<"quote_source">;
export type TxType = Enums<"investment_tx_type">;

export const TX_TYPES = [
  "contribution",
  "withdrawal",
  "dividend",
  "yield",
] as const satisfies readonly TxType[];
export const TX_LABELS: Record<TxType, string> = {
  contribution: "Aporte",
  withdrawal: "Resgate",
  dividend: "Provento",
  yield: "Rendimento",
};
export const SOURCE_LABELS: Record<QuoteSource, string> = {
  brapi: "B3 (brapi)",
  coingecko: "Cripto (CoinGecko)",
  manual: "Manual",
};
export const MODE_LABELS: Record<ValuationMode, string> = {
  quote: "Cotação automática",
  balance: "Saldo manual",
};

const emptyToUndefined = z.literal("").transform(() => undefined);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data");

function decimal(label: string) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({ code: "custom", message: `${label} inválido` });
        return z.NEVER;
      }
      return n;
    });
}

export const assetInputSchema = z
  .object({
    id: z.uuid().optional().or(emptyToUndefined),
    ticker_or_name: z.string().trim().min(1, "Informe o ativo").max(80, "Máximo de 80 caracteres"),
    asset_class: z.enum(ASSET_CLASSES, { error: "Classe inválida" }),
    institution: optionalText(80),
    valuation_mode: z.enum(["quote", "balance"], { error: "Modo inválido" }),
    quote_source: z.enum(["brapi", "coingecko", "manual"], { error: "Fonte inválida" }),
    quote_symbol: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[A-Za-z0-9.\-]{1,40}$/.test(v), "Símbolo inválido")
      .transform((v) => (v === "" ? null : v)),
    linked_goal_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid({ error: "Objetivo inválido" }).nullable()),
    context: z.enum(["personal", "work", "freelance"], { error: "Contexto inválido" }),
  })
  .superRefine((v, ctx) => {
    if (v.valuation_mode === "balance" && v.quote_source !== "manual") {
      ctx.addIssue({
        code: "custom",
        path: ["quote_source"],
        message: "Saldo manual não usa cotação automática",
      });
    }
    if (v.quote_source !== "manual" && !v.quote_symbol) {
      ctx.addIssue({
        code: "custom",
        path: ["quote_symbol"],
        message: "Informe o símbolo (ex.: IVVB11 ou bitcoin)",
      });
    }
  });

export const transactionInputSchema = z.object({
  asset_id: z.uuid({ error: "Escolha o ativo" }),
  type: z.enum(TX_TYPES, { error: "Tipo inválido" }),
  occurred_on: isoDate,
  quantity: decimal("Quantidade"),
  unit_price: decimal("Preço"),
  total_amount_cents: optionalMoney,
  notes: optionalText(200),
});

export const balanceInputSchema = z.object({
  id: z.uuid(),
  value_cents: requiredMoney("Informe o valor"),
});

export const targetsInputSchema = z
  .object(
    Object.fromEntries(ASSET_CLASSES.map((c) => [c, z.coerce.number().min(0).max(100)])) as Record<
      (typeof ASSET_CLASSES)[number],
      z.ZodCoercedNumber
    >,
  )
  .refine((v) => Object.values(v).reduce((s, n) => s + n, 0) <= 100, "A soma das metas passa de 100%");
