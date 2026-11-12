import { z } from "zod";
import type { Enums } from "@/lib/supabase/database.types";

export type CourseStatus = Enums<"course_status">;
export type Priority = Enums<"priority_level">;
export type ContextKind = Enums<"context_kind">;

export const COURSE_STATUSES = [
  "backlog",
  "in_progress",
  "paused",
  "done",
  "dropped",
] as const satisfies readonly CourseStatus[];
export const PRIORITIES = ["critical", "high", "medium", "low"] as const satisfies readonly Priority[];
export const CONTEXT_KINDS = ["personal", "work", "freelance"] as const satisfies readonly ContextKind[];
export const OPEN_STATUSES: CourseStatus[] = ["backlog", "in_progress", "paused"];

export const STATUS_LABELS: Record<CourseStatus, string> = {
  backlog: "Backlog",
  in_progress: "Em curso",
  paused: "Pausado",
  done: "Concluído",
  dropped: "Abandonado",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const STATUS_FILTERS = ["abertos", "em-curso", "backlog", "concluidos", "todos"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  abertos: "Abertos",
  "em-curso": "Em curso",
  backlog: "Backlog",
  concluidos: "Concluídos",
  todos: "Todos",
};

export const STATUS_FILTER_VALUES: Record<StatusFilter, CourseStatus[]> = {
  abertos: OPEN_STATUSES,
  "em-curso": ["in_progress"],
  backlog: ["backlog"],
  concluidos: ["done"],
  todos: [...COURSE_STATUSES],
};

function firstParam(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

const hoursParam = z
  .string()
  .trim()
  .transform((v) => Number(v.replace(",", ".")))
  .pipe(z.number().positive().max(10000));

export const filtersSchema = z.object({
  status: z.preprocess(firstParam, z.enum(STATUS_FILTERS).catch("abertos")).default("abertos"),
  categoria: z.preprocess(firstParam, z.uuid().optional().catch(undefined)),
  prioridade: z.preprocess(firstParam, z.enum(PRIORITIES).optional().catch(undefined)),
  horas: z.preprocess(firstParam, hoursParam.optional().catch(undefined)),
});

export type CourseFilters = z.infer<typeof filtersSchema>;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

export const courseInputSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  title: z.string().trim().min(1, "Informe o título").max(200, "Máximo de 200 caracteres"),
  url: optionalText(500, "URL muito longa").refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), {
    message: "Use um link http:// ou https://",
  }),
  provider: optionalText(80, "Máximo de 80 caracteres"),
  category: optionalText(60, "Máximo de 60 caracteres"),
  context: z.enum(CONTEXT_KINDS, { error: "Contexto inválido" }),
  priority: z.enum(PRIORITIES, { error: "Prioridade inválida" }),
  status: z.enum(COURSE_STATUSES, { error: "Status inválido" }),
  estimated_hours: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0 || n > 99999) {
        ctx.addIssue({ code: "custom", message: "Use um número de horas maior que zero" });
        return z.NEVER;
      }
      return Math.round(n * 10) / 10;
    }),
  progress_pct: z.coerce
    .number({ error: "Use um número" })
    .int("Use um número inteiro")
    .min(0, "Mínimo 0")
    .max(100, "Máximo 100"),
  obsidian_note: optionalText(300, "Máximo de 300 caracteres"),
});

export type CourseInput = z.infer<typeof courseInputSchema>;
export type CourseField = Exclude<keyof CourseInput, "id">;
