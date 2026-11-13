import { z } from "zod";
import { parseBRL } from "@/lib/money";
import { normalizeDescription } from "@/lib/parsers/text";
import type { Enums } from "@/lib/supabase/database.types";

export type ExpenseNature = Enums<"expense_nature">;
export type ContextKind = Enums<"context_kind">;
export type ImportFormat = Enums<"import_format">;

export const NATURES = ["fixed", "variable"] as const satisfies readonly ExpenseNature[];
export const CONTEXT_KINDS = ["personal", "work", "freelance"] as const satisfies readonly ContextKind[];

export const NATURE_LABELS: Record<ExpenseNature, string> = { fixed: "Fixa", variable: "Variável" };
export const FORMAT_LABELS: Record<ImportFormat, string> = {
  ofx: "OFX",
  nubank_account_csv: "CSV da conta",
  nubank_card_csv: "CSV do cartão",
};

const emptyToUndefined = z.literal("").transform(() => undefined);
const optionalUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid({ error: "Opção inválida" }).nullable());

function toCents(v: string, ctx: z.RefinementCtx): number {
  const cents = parseBRL(v);
  if (cents === null || cents <= 0) {
    ctx.addIssue({ code: "custom", message: "Use um valor positivo, ex.: 1.234,56" });
    return z.NEVER;
  }
  return cents;
}

const requiredMoney = z
  .string()
  .trim()
  .min(1, "Informe o valor")
  .transform((v, ctx) => toCents(v, ctx));

const optionalMoney = z
  .string()
  .trim()
  .transform((v, ctx) => (v === "" ? null : toCents(v, ctx)));

const pattern = z
  .string()
  .trim()
  .transform((v) => normalizeDescription(v))
  .pipe(z.string().min(2, "Mínimo de 2 caracteres").max(60, "Máximo de 60 caracteres"));

const optionalPattern = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : normalizeDescription(v)))
  .pipe(z.string().min(2, "Mínimo de 2 caracteres").max(60, "Máximo de 60 caracteres").nullable());

export const monthParamSchema = z.preprocess(
  (v) => (Array.isArray(v) ? v[0] : v),
  z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .transform((v) => `${v}-01`)
    .optional()
    .catch(undefined),
);

export const expenseFiltersSchema = z.object({
  mes: monthParamSchema,
  categoria: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().optional().catch(undefined)),
  natureza: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.enum(NATURES).optional().catch(undefined)),
});

export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;

export const expenseInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  description: z.string().trim().min(1, "Informe a descrição").max(200, "Máximo de 200 caracteres"),
  amount_cents: requiredMoney,
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  category_id: optionalUuid,
  nature: z.enum(NATURES, { error: "Escolha fixa ou variável" }),
  context: z.enum(CONTEXT_KINDS, { error: "Contexto inválido" }),
  recurring_expense_id: optionalUuid,
  project_id: optionalUuid,
});

export const categoryInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  name: z.string().trim().min(1, "Informe o nome").max(40, "Máximo de 40 caracteres"),
  nature: z.enum(NATURES, { error: "Escolha fixa ou variável" }),
  monthly_budget_cents: optionalMoney,
});

export const ruleInputSchema = z.object({
  pattern,
  category_id: z.uuid({ error: "Escolha a categoria" }),
});

export const recurringInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  description: z.string().trim().min(1, "Informe a descrição").max(80, "Máximo de 80 caracteres"),
  amount_cents: requiredMoney,
  due_day: z.coerce
    .number({ error: "Informe o dia" })
    .int("Dia inteiro")
    .min(1, "Dia entre 1 e 31")
    .max(31, "Dia entre 1 e 31"),
  category_id: optionalUuid,
  context: z.enum(CONTEXT_KINDS, { error: "Contexto inválido" }),
  match_pattern: optionalPattern,
  active: z.string().transform((v) => v === "on" || v === "true"),
});

export const commitRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z
    .number()
    .int()
    .refine((v) => v !== 0),
  description: z.string().min(1).max(200),
  externalId: z.string().max(120).nullable(),
  ordinal: z.number().int().min(0),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  action: z.enum(["expense", "income", "ignore"]),
  categoryId: z.uuid().nullable(),
  recurringId: z.uuid().nullable(),
  nature: z.enum(NATURES),
});

export const commitSchema = z.object({
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  filename: z.string().min(1).max(200),
  format: z.enum(["ofx", "nubank_account_csv", "nubank_card_csv"]),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  context: z.enum(CONTEXT_KINDS),
  incomeSourceId: z.uuid().nullable(),
  rows: z.array(commitRowSchema).min(1).max(3000),
});

export type CommitRow = z.infer<typeof commitRowSchema>;
export type CommitInput = z.infer<typeof commitSchema>;
