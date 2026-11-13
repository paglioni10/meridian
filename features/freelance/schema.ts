import { z } from "zod";
import type { Enums } from "@/lib/supabase/database.types";
import { optionalMoney } from "@/lib/zod-money";

export type DealStage = Enums<"deal_stage">;

export const OPEN_STAGES = [
  "lead",
  "briefing",
  "proposal",
  "negotiation",
] as const satisfies readonly DealStage[];
export const DEAL_STAGES = [...OPEN_STAGES, "won", "lost"] as const satisfies readonly DealStage[];

export const STAGE_LABELS: Record<DealStage, string> = {
  lead: "Contato",
  briefing: "Briefing",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

const emptyToUndefined = z.literal("").transform(() => undefined);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

export const clientInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  name: z.string().trim().min(1, "Informe o nome").max(80, "Máximo de 80 caracteres"),
  company: optionalText(80),
  email: z
    .string()
    .trim()
    .max(120, "Máximo de 120 caracteres")
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido")
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  phone: optionalText(40),
  notes: optionalText(500),
});

export const dealInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  client_id: z.uuid({ error: "Escolha o cliente" }),
  title: z.string().trim().min(1, "Informe o projeto ou serviço").max(120, "Máximo de 120 caracteres"),
  stage: z.enum(OPEN_STAGES, { error: "Estágio inválido" }),
  value_cents: optionalMoney,
  expected_close_on: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
    .transform((v) => (v === "" ? null : v)),
});

export const winInputSchema = z.object({
  deal_id: z.uuid(),
  source_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid({ error: "Fonte inválida" }).nullable()),
  received_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  create_project: z.string().transform((v) => v === "on"),
});
