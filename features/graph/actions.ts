"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ENTITY_TYPES, linkInputSchema, type EntityType } from "./schema";

export async function createLink(input: {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  label: string;
}): Promise<{ ok: boolean; message: string }> {
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Conexão inválida." };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("entity_links").insert({ ...parsed.data, user_id: user.id });
  if (error?.code === "23505") return { ok: false, message: "Essa conexão já existe." };
  if (error?.code === "23503") return { ok: false, message: "Item não encontrado." };
  if (error) return { ok: false, message: "Não foi possível conectar." };
  refresh();
  return { ok: true, message: "Conexão criada." };
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
