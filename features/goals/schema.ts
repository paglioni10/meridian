import { z } from "zod";
import { todayISO } from "@/lib/dates";
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

export const CUSTOM_HORIZON = "custom";

export function monthsBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(y, m - 1 + months, Math.min(d, last)));
  return date.toISOString().slice(0, 10);
}

export function horizonForDate(targetISO: string, todayValue = todayISO()): GoalHorizon {
  if (targetISO <= addMonthsISO(todayValue, 12)) return "short";
  if (targetISO <= addMonthsISO(todayValue, 36)) return "medium";
  return "long";
}

export function describeDistance(targetISO: string, todayValue = todayISO()): string {
  const months = monthsBetween(todayValue, targetISO);
  if (targetISO < todayValue) return "data já passou";
  if (months < 1) return "este mês";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years ? `${years} ${years === 1 ? "ano" : "anos"}` : null,
    rest ? `${rest} ${rest === 1 ? "mês" : "meses"}` : null,
  ].filter(Boolean);
  return `em ${parts.join(" e ")}`;
}

const emptyToUndefined = z.literal("").transform(() => undefined);

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
  .transform((v) => (v === "" ? null : v));

export const goalInputSchema = z
  .object({
    id: z.uuid().optional().or(emptyToUndefined),
    title: z.string().trim().min(1, "Informe o objetivo").max(80, "Máximo de 80 caracteres"),
    description: z
      .string()
      .trim()
      .max(300, "Máximo de 300 caracteres")
      .transform((v) => (v === "" ? null : v)),
    horizon: z.enum([...HORIZONS, CUSTOM_HORIZON], { error: "Escolha o prazo" }),
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
  })
  .superRefine((value, ctx) => {
    if (value.horizon === CUSTOM_HORIZON && !value.target_date) {
      ctx.addIssue({
        code: "custom",
        path: ["target_date"],
        message: "Escolha a data do prazo personalizado",
      });
    }
  })
  .transform(({ horizon, ...rest }) => ({
    ...rest,
    horizon: horizon === CUSTOM_HORIZON ? horizonForDate(rest.target_date!) : horizon,
  }));

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
