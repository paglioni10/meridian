"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runChecks } from "./monitor";
import { estimateBalance, nextExpiry } from "./rules";
import { renewalInputSchema, serviceInputSchema, topUpInputSchema } from "./schema";

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

async function ownedServiceId(id: string) {
  const serviceId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id").eq("id", serviceId).maybeSingle();
  if (!data) throw new Error("Serviço não encontrado.");
  return serviceId;
}

export async function saveService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [
    "id",
    "name",
    "kind",
    "provider",
    "url",
    "check_method",
    "expected_status",
    "keyword",
    "latency_warn_ms",
    "interval_minutes",
    "context",
    "active",
    "notes",
  ]);
  const parsed = serviceInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const payload = { ...values, keyword: values.check_method === "keyword" ? values.keyword : null };
  const { data, error } = id
    ? await supabase.from("services").update(payload).eq("id", id).select("id").single()
    : await supabase
        .from("services")
        .insert({ ...payload, user_id: user.id })
        .select("id")
        .single();
  if (error) {
    console.error("[infra]", { code: error.code, detail: error.message });
    return { status: "error", message: "Não foi possível salvar o serviço.", values: raw };
  }

  if (payload.active && (payload.check_method === "http" || payload.check_method === "keyword")) {
    await runChecks(createAdminClient(), { serviceIds: [data.id], force: true }).catch(() => undefined);
  }
  refresh();
  return { status: "saved", message: id ? "Serviço atualizado." : "Serviço cadastrado e verificado." };
}

export async function checkService(id: string) {
  const serviceId = await ownedServiceId(id);
  const result = await runChecks(createAdminClient(), { serviceIds: [serviceId], force: true });
  refresh();
  return result.down > 0 ? "down" : "ok";
}

export async function setServiceActive(id: string, active: boolean) {
  const serviceId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("services").update({ active }).eq("id", serviceId);
  if (error) throw new Error("Não foi possível atualizar o serviço.");
  refresh();
}

export async function deleteService(id: string) {
  const serviceId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", serviceId);
  if (error) throw new Error("Não foi possível excluir o serviço.");
  refresh();
}

export async function saveRenewal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [
    "id",
    "kind",
    "name",
    "provider",
    "service_id",
    "context",
    "expires_on",
    "currency",
    "cost_cents",
    "billing_cycle",
    "balance_cents",
    "monthly_burn_cents",
    "balance_updated_on",
    "owner_is_client",
    "auto_renew",
    "alert_days",
    "notes",
  ]);
  const parsed = renewalInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const isCredit = values.kind === "credit";
  const payload = {
    ...values,
    expires_on: values.expires_on ?? values.balance_updated_on ?? todayISO(),
    balance_cents: isCredit ? values.balance_cents : null,
    monthly_burn_cents: isCredit ? values.monthly_burn_cents : null,
    balance_updated_on: isCredit ? values.balance_updated_on : null,
  };
  const { error } = id
    ? await supabase.from("renewals").update(payload).eq("id", id)
    : await supabase.from("renewals").insert({ ...payload, user_id: user.id });
  if (error) {
    console.error("[infra]", { code: error.code, detail: error.message });
    return { status: "error", message: "Não foi possível salvar o vencimento.", values: raw };
  }

  refresh();
  return { status: "saved", message: id ? "Vencimento atualizado." : "Vencimento cadastrado." };
}

export async function renewNow(id: string) {
  const renewalId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("renewals")
    .select("kind, expires_on, billing_cycle")
    .eq("id", renewalId)
    .single();
  if (error || !data) throw new Error("Vencimento não encontrado.");
  if (data.kind === "credit") throw new Error("Crédito pré-pago se renova com uma recarga.");
  if (data.billing_cycle === "other") throw new Error("Ciclo livre: edite a data do próximo vencimento.");

  const expires = nextExpiry(data.expires_on, data.billing_cycle as "monthly" | "yearly", todayISO());
  const { error: updateError } = await supabase
    .from("renewals")
    .update({ expires_on: expires })
    .eq("id", renewalId);
  if (updateError) throw new Error("Não foi possível renovar.");
  refresh();
  return expires;
}

export async function topUpCredit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["id", "amount_cents", "balance_updated_on"]);
  const parsed = topUpInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("renewals")
    .select("kind, balance_cents, monthly_burn_cents, balance_updated_on")
    .eq("id", parsed.data.id)
    .single();
  if (error || !data || data.kind !== "credit") {
    return { status: "error", message: "Crédito não encontrado.", values: raw };
  }

  const remaining = estimateBalance(
    data.balance_cents ?? 0,
    data.monthly_burn_cents ?? 1,
    data.balance_updated_on ?? parsed.data.balance_updated_on,
    parsed.data.balance_updated_on,
  );
  const { error: updateError } = await supabase
    .from("renewals")
    .update({
      balance_cents: remaining + parsed.data.amount_cents,
      balance_updated_on: parsed.data.balance_updated_on,
    })
    .eq("id", parsed.data.id);
  if (updateError) return { status: "error", message: "Não foi possível registrar a recarga.", values: raw };

  refresh();
  return { status: "saved", message: "Recarga registrada e vencimento reprojetado." };
}

export async function deleteRenewal(id: string) {
  const renewalId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("renewals").delete().eq("id", renewalId);
  if (error) throw new Error("Não foi possível excluir o vencimento.");
  refresh();
}
