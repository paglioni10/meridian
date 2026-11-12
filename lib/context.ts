export const CONTEXT_COOKIE = "meridian-ctx";
export const APP_CONTEXTS = ["all", "personal", "work", "freelance"] as const;
export type AppContext = (typeof APP_CONTEXTS)[number];
export type ContextKind = Exclude<AppContext, "all">;

export const CONTEXT_LABELS: Record<AppContext, string> = {
  all: "Tudo",
  personal: "Pessoal",
  work: "Trabalho",
  freelance: "Freelance",
};

export function isAppContext(value: unknown): value is AppContext {
  return typeof value === "string" && (APP_CONTEXTS as readonly string[]).includes(value);
}

export function applyContext<Q extends { eq(column: string, value: string): Q }>(
  query: Q,
  context: AppContext,
  column = "context",
): Q {
  return context === "all" ? query : query.eq(column, context);
}
