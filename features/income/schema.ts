import { z } from "zod";
import { parseBRL } from "@/lib/money";
import type { Enums } from "@/lib/supabase/database.types";

export type IncomeKind = Enums<"income_kind">;
export type ContextKind = Enums<"context_kind">;

export const INCOME_KINDS = ["guaranteed", "variable"] as const satisfies readonly IncomeKind[];
export const CONTEXT_KINDS = ["personal", "work", "freelance"] as const satisfies readonly ContextKind[];

export const KIND_LABELS: Record<IncomeKind, string> = {
  guaranteed: "Garantida",
  variable: "Variável",
};

export const KIND_HINTS: Record<IncomeKind, string> = {
  guaranteed: "CLT, salário, benefício fixo",
  variable: "PJ, freelance, comissão",
};

export const RANGES = [6, 12, 24] as const;
export type Range = (typeof RANGES)[number];

export const rangeSchema = z.preprocess(
  (v) => Number(Array.isArray(v) ? v[0] : v),
  z.union([z.literal(6), z.literal(12), z.literal(24)]).catch(12),
);

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

function toCents(v: string, ctx: z.RefinementCtx): number {
  const cents = parseBRL(v);
  if (cents === null || cents <= 0) {
    ctx.addIssue({ code: "custom", message: "Use um valor positivo, ex.: 1.234,56" });
    return z.NEVER;
  }
  return cents;
}

const optionalMoney = z
  .string()
  .trim()
  .transform((v, ctx) => (v === "" ? null : toCents(v, ctx)));

const requiredMoney = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Informe ${label}`)
    .transform((v, ctx) => toCents(v, ctx));

const emptyToUndefined = z.literal("").transform(() => undefined);

export const sourceInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  name: z.string().trim().min(1, "Informe o nome").max(80, "Máximo de 80 caracteres"),
  kind: z.enum(INCOME_KINDS, { error: "Escolha o tipo" }),
  context: z.enum(CONTEXT_KINDS, { error: "Contexto inválido" }),
  default_amount_cents: optionalMoney,
  payday: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        ctx.addIssue({ code: "custom", message: "Dia entre 1 e 31" });
        return z.NEVER;
      }
      return n;
    }),
  active: z.string().transform((v) => v === "on" || v === "true"),
});

export type SourceField = Exclude<keyof z.infer<typeof sourceInputSchema>, "id">;

export const incomeInputSchema = z
  .object({
    id: z.uuid().optional().or(emptyToUndefined),
    source_id: z.uuid({ error: "Escolha a fonte" }),
    competence_month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Escolha o mês de competência")
      .transform((v) => `${v}-01`),
    received_on: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
      .transform((v) => (v === "" ? null : v)),
    amount_cents: requiredMoney("o valor líquido"),
    gross_cents: optionalMoney,
    description: optionalText(200, "Máximo de 200 caracteres"),
  })
  .superRefine((value, ctx) => {
    if (value.gross_cents !== null && value.gross_cents < value.amount_cents) {
      ctx.addIssue({
        code: "custom",
        path: ["gross_cents"],
        message: "O bruto não pode ser menor que o líquido",
      });
    }
  });

export type IncomeField = Exclude<keyof z.infer<typeof incomeInputSchema>, "id">;
