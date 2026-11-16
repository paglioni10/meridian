import "server-only";
import { getCurrentUser } from "@/lib/auth";
import type { AppContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { normalizeSnapshot, type GraphData, type GraphLink, type GraphNode } from "./schema";

export async function getGraphSnapshot(context: AppContext): Promise<GraphData> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("graph_snapshot", { p_context: context });
  if (error) throw new Error(`Falha ao carregar o grafo: ${error.message}`);
  const raw = data as unknown as { nodes: Omit<GraphNode, "degree" | "alert">[]; links: GraphLink[] };
  return normalizeSnapshot({ nodes: raw.nodes ?? [], links: raw.links ?? [] });
}
