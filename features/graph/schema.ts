import { z } from "zod";

export const ENTITY_TYPES = [
  "course",
  "project",
  "goal",
  "income_source",
  "client",
  "deal",
  "service",
  "note",
  "asset",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_LABELS: Record<EntityType, string> = {
  course: "Curso",
  project: "Projeto",
  goal: "Objetivo",
  income_source: "Fonte de renda",
  client: "Cliente",
  deal: "Negócio",
  service: "Servidor",
  note: "Nota",
  asset: "Investimento",
};

export const ENTITY_HREF: Record<EntityType, string> = {
  course: "/cursos",
  project: "/projetos",
  goal: "/objetivos",
  income_source: "/financas/ganhos",
  client: "/freelance",
  deal: "/freelance",
  service: "/infra",
  note: "/cursos",
  asset: "/financas/investimentos",
};

export type GraphNode = {
  id: string;
  type: EntityType;
  entityId: string;
  label: string;
  context: string | null;
  state: string | null;
  degree: number;
  alert: boolean;
  x?: number;
  y?: number;
};

export type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string | null;
  origin: "manual" | "derived";
  linkId: string | null;
};

export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

export const ALERT_STATES = new Set(["late", "down"]);

export const linkInputSchema = z
  .object({
    source_type: z.enum(ENTITY_TYPES),
    source_id: z.uuid(),
    target_type: z.enum(ENTITY_TYPES),
    target_id: z.uuid(),
    label: z
      .string()
      .trim()
      .max(40, "Máximo de 40 caracteres")
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((v) => !(v.source_type === v.target_type && v.source_id === v.target_id), "Escolha outro item");

export function endId(end: string | GraphNode): string {
  return typeof end === "string" ? end : end.id;
}

export function normalizeSnapshot(raw: {
  nodes: Omit<GraphNode, "degree" | "alert">[];
  links: GraphLink[];
}): GraphData {
  const degree = new Map<string, number>();
  for (const l of raw.links) {
    degree.set(endId(l.source), (degree.get(endId(l.source)) ?? 0) + 1);
    degree.set(endId(l.target), (degree.get(endId(l.target)) ?? 0) + 1);
  }
  const nodes = raw.nodes
    .filter((n) => n.type !== "note" || degree.has(n.id))
    .map((n) => ({ ...n, degree: degree.get(n.id) ?? 0, alert: ALERT_STATES.has(n.state ?? "") }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = raw.links.filter((l) => ids.has(endId(l.source)) && ids.has(endId(l.target)));
  return { nodes, links };
}
