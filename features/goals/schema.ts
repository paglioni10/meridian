import { z } from "zod";
import type { Enums } from "@/lib/supabase/database.types";
import { optionalMoney, requiredMoney } from "@/lib/zod-money";

export type GoalHorizon = Enums<"goal_horizon">;
export type GoalStatus = Enums<"goal_status">;
export type ContextKind = Enums<"context_kind">;

export const HORIZONS = ["short", "medium", "long"] as const satisfies readonly GoalHorizon[];
export const CONTEXT_KINDS = ["personal", "work", "freelance"] as const satisfies readonly ContextKind[];

export const HORIZON_LABELS: Record<GoalHorizon, string> = {
  short: "Curto prazo",
  medium: "Médio prazo",
  long: "Longo prazo",
};

export const HORIZON_HINTS: Record<GoalHorizon, string> = {
  short: "Até 1 ano",
  medium: "De 1 a 3 anos",
  long: "Mais de 3 anos",
};

export const STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  achieved: "Concluído",
  archived: "Arquivado",
};

const emptyToUndefined = z.literal("").transform(() => undefined);

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
  .transform((v) => (v === "" ? null : v));

export const goalInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  title: z.string().trim().min(1, "Informe o objetivo").max(80, "Máximo de 80 caracteres"),
  description: z
    .string()
    .trim()
    .max(300, "Máximo de 300 caracteres")
    .transform((v) => (v === "" ? null : v)),
  horizon: z.enum(HORIZONS, { error: "Escolha o prazo" }),
  context: z.enum(CONTEXT_KINDS, { error: "Contexto inválido" }),
  target_cents: optionalMoney,
  target_date: optionalDate,
  milestones: z
    .string()
    .transform((v) =>
      v
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(80, "Cada marco com até 80 caracteres")).max(20, "Até 20 marcos")),
});

export const contributionInputSchema = z.object({
  goal_id: z.uuid(),
  direction: z.enum(["deposit", "withdraw"]),
  amount_cents: requiredMoney(),
  contributed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  note: z
    .string()
    .trim()
    .max(120, "Máximo de 120 caracteres")
    .transform((v) => (v === "" ? null : v)),
});
