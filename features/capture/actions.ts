"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { parseCapture, type ParsedCapture } from "@/lib/capture/parse";
import { todayISO } from "@/lib/dates";
import { getActiveContext } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { routeCapture } from "./route";

export type CaptureResult = { ok: boolean; routed: boolean; message: string };

async function defaultContext(): Promise<"personal" | "work" | "freelance"> {
  const active = await getActiveContext();
  return active === "all" ? "personal" : active;
}

function urlOf(parsed: ParsedCapture): string | null {
  return parsed.kind === "link" ? parsed.url : null;
}

export async function capture(raw: string): Promise<CaptureResult> {
  const text = z.string().trim().min(1).max(500).safeParse(raw);
  if (!text.success) return { ok: false, routed: false, message: "Escreva algo para capturar." };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const today = todayISO();
  const parsed = parseCapture(text.data, today);
  const context = parsed.context ?? (await defaultContext());
  const result = await routeCapture(supabase, user.id, parsed, context, today);

  const { error } = await supabase.from("inbox_items").insert({
    user_id: user.id,
    context,
    kind: parsed.kind,
    raw_text: text.data,
    url: urlOf(parsed),
    payload: { ...parsed, reason: result.table ? null : result.reason },
    routed_table: result.table,
    routed_id: result.table ? result.id : null,
    processed_at: result.table ? new Date().toISOString() : null,
  });
  if (error && !result.table) return { ok: false, routed: false, message: "Não foi possível capturar." };

  refresh();
  return result.table
    ? { ok: true, routed: true, message: result.label }
    : { ok: true, routed: false, message: result.reason };
}

export async function retryItem(id: string): Promise<CaptureResult> {
  const itemId = z.uuid().parse(id);
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("inbox_items")
    .select("id, raw_text, context")
    .eq("id", itemId)
    .is("processed_at", null)
    .single();
  if (!item) return { ok: false, routed: false, message: "Item não encontrado." };

  const today = todayISO();
  const parsed = parseCapture(item.raw_text, today);
  const result = await routeCapture(supabase, user.id, parsed, parsed.context ?? item.context, today);
  if (!result.table) return { ok: false, routed: false, message: result.reason };

  await supabase
    .from("inbox_items")
    .update({ routed_table: result.table, routed_id: result.id, processed_at: new Date().toISOString() })
    .eq("id", itemId);
  refresh();
  return { ok: true, routed: true, message: result.label };
}

export async function itemToTask(id: string): Promise<CaptureResult> {
  const itemId = z.uuid().parse(id);
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("inbox_items")
    .select("id, raw_text, context")
    .eq("id", itemId)
    .is("processed_at", null)
    .single();
  if (!item) return { ok: false, routed: false, message: "Item não encontrado." };

  const result = await routeCapture(
    supabase,
    user.id,
    { kind: "task", context: null, title: item.raw_text, priority: "medium", due_on: null },
    item.context,
    todayISO(),
  );
  if (!result.table) return { ok: false, routed: false, message: result.reason };
  await supabase
    .from("inbox_items")
    .update({ routed_table: result.table, routed_id: result.id, processed_at: new Date().toISOString() })
    .eq("id", itemId);
  refresh();
  return { ok: true, routed: true, message: result.label };
}

export async function discardItem(id: string) {
  const itemId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("inbox_items")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error("Não foi possível descartar.");
  refresh();
}
