"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ENTITY_TYPES, linkInputSchema, splitNodeId, type EntityType } from "./schema";

export async function createLink(input: {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  label: string;
}): Promise<{ ok: boolean; message: string; id?: string }> {
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Conexão inválida." };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entity_links")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, message: "Essa conexão já existe." };
  if (error?.code === "23503") return { ok: false, message: "Item não encontrado." };
  if (error) return { ok: false, message: "Não foi possível conectar." };
  refresh();
  return { ok: true, message: "Conexão criada.", id: data.id };
}

export async function deleteLink(id: string) {
  const linkId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("entity_links").delete().eq("id", linkId);
  if (error) throw new Error("Não foi possível remover a conexão.");
  refresh();
}

export async function searchEntities(query: string) {
  const q = z.string().trim().min(2).max(80).safeParse(query);
  if (!q.success) return [];
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_entities", { p_query: q.data, p_limit: 12 });
  return (data ?? [])
    .filter((r) => (ENTITY_TYPES as readonly string[]).includes(r.type))
    .map((r) => ({ type: r.type as EntityType, id: r.id, label: r.label, context: r.context }));
}

const nodeIdSchema = z.string().regex(/^[a-z_]+:[0-9a-f-]{36}$/);

function edgeRow(sourceNodeId: string, targetNodeId: string) {
  const source = splitNodeId(nodeIdSchema.parse(sourceNodeId));
  const target = splitNodeId(nodeIdSchema.parse(targetNodeId));
  if (
    !(ENTITY_TYPES as readonly string[]).includes(source.type) ||
    !(ENTITY_TYPES as readonly string[]).includes(target.type)
  ) {
    throw new Error("Conexão inválida.");
  }
  return { source_type: source.type, source_id: source.id, target_type: target.type, target_id: target.id };
}

export async function hideEdge(sourceNodeId: string, targetNodeId: string) {
  const row = edgeRow(sourceNodeId, targetNodeId);
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("graph_hidden_edges")
    .upsert(
      { ...row, user_id: user.id },
      { onConflict: "user_id,source_type,source_id,target_type,target_id", ignoreDuplicates: true },
    );
  if (error) throw new Error("Não foi possível desfazer a conexão.");
  refresh();
}

export async function unhideEdge(sourceNodeId: string, targetNodeId: string) {
  const row = edgeRow(sourceNodeId, targetNodeId);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("graph_hidden_edges")
    .delete()
    .eq("source_type", row.source_type)
    .eq("source_id", row.source_id)
    .eq("target_type", row.target_type)
    .eq("target_id", row.target_id);
  if (error) throw new Error("Não foi possível restaurar a conexão.");
  refresh();
}
