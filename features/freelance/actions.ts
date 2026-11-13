"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clientInputSchema, dealInputSchema, OPEN_STAGES, winInputSchema } from "./schema";

export type ActionState = {
  status: "idle" | "saved" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

function collect(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

function invalid(issues: z.core.$ZodIssue[], values: Record<string, string>): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return { status: "error", message: "Revise os campos destacados.", fieldErrors, values };
}

export async function saveClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["id", "name", "company", "email", "phone", "notes"]);
  const parsed = clientInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error } = id
    ? await supabase.from("clients").update(values).eq("id", id)
    : await supabase.from("clients").insert({ ...values, user_id: user.id });
  if (error) return { status: "error", message: "Não foi possível salvar o cliente.", values: raw };

  refresh();
  return { status: "saved", message: id ? "Cliente atualizado." : "Cliente cadastrado." };
}

export async function deleteClient(id: string) {
  const clientId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error?.code === "23503") throw new Error("Este cliente tem negócios; exclua ou mantenha o histórico.");
  if (error) throw new Error("Não foi possível excluir o cliente.");
  refresh();
}

export async function saveDeal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["id", "client_id", "title", "stage", "value_cents", "expected_close_on"]);
  const parsed = dealInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error } = id
    ? await supabase.from("deals").update(values).eq("id", id)
    : await supabase.from("deals").insert({ ...values, user_id: user.id });
  if (error) return { status: "error", message: "Não foi possível salvar o negócio.", values: raw };

  refresh();
  return { status: "saved", message: id ? "Negócio atualizado." : "Negócio criado." };
}

export async function moveDealStage(id: string, stage: string) {
  const parsed = z.object({ id: z.uuid(), stage: z.enum(OPEN_STAGES) }).parse({ id, stage });
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("deals").update({ stage: parsed.stage }).eq("id", parsed.id);
  if (error) throw new Error("Não foi possível mudar o estágio.");
  refresh();
}

export async function winDeal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["deal_id", "source_id", "received_on", "create_project"]);
  const parsed = winInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("win_deal", {
    p_deal_id: parsed.data.deal_id,
    p_source_id: parsed.data.source_id ?? undefined,
    p_received_on: parsed.data.received_on,
    p_create_project: parsed.data.create_project,
  });
  if (error) {
    console.error("[freelance] win_deal", { code: error.code, message: error.message });
    return { status: "error", message: "Não foi possível fechar o negócio.", values: raw };
  }

  const result = data as { income_id: string | null; project_id: string | null };
  refresh();
  return {
    status: "saved",
    message: [
      "Negócio ganho.",
      result.income_id ? "Ganho lançado em Finanças." : null,
      result.project_id ? "Projeto criado." : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export async function loseDeal(id: string, reason: string) {
  const parsed = z.object({ id: z.uuid(), reason: z.string().trim().max(200) }).parse({ id, reason });
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ stage: "lost", lost_reason: parsed.reason || null })
    .eq("id", parsed.id);
  if (error) throw new Error("Não foi possível marcar como perdido.");
  refresh();
}

export async function reopenDeal(id: string) {
  const dealId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("deals").update({ stage: "negotiation" }).eq("id", dealId);
  if (error) throw new Error("Não foi possível reabrir o negócio.");
  refresh();
}

export async function deleteDeal(id: string) {
  const dealId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("deals").delete().eq("id", dealId);
  if (error) throw new Error("Não foi possível excluir o negócio.");
  refresh();
}
