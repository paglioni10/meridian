import { z } from "zod";
import type { Enums } from "@/lib/supabase/database.types";

export type TaskStatus = Enums<"task_status">;
export type ProjectStatus = Enums<"project_status">;
export type Priority = Enums<"priority_level">;
export type ContextKind = Enums<"context_kind">;

export const TASK_STATUSES = ["todo", "doing", "done"] as const satisfies readonly TaskStatus[];
export const PROJECT_STATUSES = [
  "active",
  "on_hold",
  "done",
  "archived",
] as const satisfies readonly ProjectStatus[];
export const PRIORITIES = ["critical", "high", "medium", "low"] as const satisfies readonly Priority[];
export const CONTEXT_KINDS = ["personal", "work", "freelance"] as const satisfies readonly ContextKind[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "A fazer",
  doing: "Em curso",
  done: "Entregue",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Ativo",
  on_hold: "Em espera",
  done: "Concluído",
  archived: "Arquivado",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const emptyToUndefined = z.literal("").transform(() => undefined);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
  .transform((v) => (v === "" ? null : v));
const optionalUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid({ error: "Opção inválida" }).nullable());

export const taskInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  title: z.string().trim().min(1, "Informe a tarefa").max(160, "Máximo de 160 caracteres"),
  description: optionalText(2000),
  project_id: optionalUuid,
  context: z.enum(CONTEXT_KINDS, { error: "Contexto inválido" }),
  priority: z.enum(PRIORITIES, { error: "Prioridade inválida" }),
  status: z.enum(TASK_STATUSES, { error: "Status inválido" }),
  due_on: optionalDate,
});

export const projectInputSchema = z.object({
  id: z.uuid().optional().or(emptyToUndefined),
  name: z.string().trim().min(1, "Informe o nome").max(80, "Máximo de 80 caracteres"),
  description: optionalText(300),
  context: z.enum(CONTEXT_KINDS, { error: "Contexto inválido" }),
  status: z.enum(PROJECT_STATUSES, { error: "Status inválido" }),
  due_on: optionalDate,
});

export const boardFiltersSchema = z.object({
  projeto: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.uuid().optional().catch(undefined)),
});
