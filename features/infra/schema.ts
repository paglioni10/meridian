import { z } from "zod";
import type { Enums } from "@/lib/supabase/database.types";
import { optionalMoney, requiredMoney } from "@/lib/zod-money";

export type ServiceKind = Enums<"service_kind">;
export type CheckMethod = Enums<"check_method">;
export type ServiceState = Enums<"service_state">;
export type RenewalKind = Enums<"renewal_kind">;
export type AlertKind = Enums<"alert_kind">;

export const SERVICE_KINDS = [
  "vps",
  "automation",
  "api",
  "website",
  "database",
  "other",
] as const satisfies readonly ServiceKind[];
export const CHECK_METHODS = [
  "http",
  "keyword",
  "heartbeat",
  "manual",
] as const satisfies readonly CheckMethod[];
export const RENEWAL_KINDS = [
  "domain",
  "hosting",
  "license",
  "certificate",
  "subscription",
  "credit",
] as const satisfies readonly RenewalKind[];
export const CONTEXTS = ["personal", "work", "freelance"] as const;
export const CURRENCIES = ["BRL", "USD", "EUR"] as const;
export const BILLING_CYCLES = ["monthly", "yearly", "other"] as const;

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  vps: "VPS",
  automation: "Automação",
  api: "API",
  website: "Site",
  database: "Banco de dados",
  other: "Outro",
};

export const CHECK_METHOD_LABELS: Record<CheckMethod, string> = {
  http: "HTTP (status)",
  keyword: "HTTP + palavra-chave",
  heartbeat: "Heartbeat (o serviço avisa)",
  manual: "Manual",
};

export const STATE_LABELS: Record<ServiceState, string> = {
  up: "Online",
  degraded: "Lento",
  down: "Offline",
  unknown: "Sem dados",
};

export const RENEWAL_KIND_LABELS: Record<RenewalKind, string> = {
  domain: "Domínio",
  hosting: "Hospedagem",
  license: "Licença",
  certificate: "Certificado",
  subscription: "Assinatura",
  credit: "Crédito pré-pago",
};

export const BILLING_LABELS: Record<(typeof BILLING_CYCLES)[number], string> = {
  monthly: "Mensal",
  yearly: "Anual",
  other: "Outro",
};

const emptyToUndefined = z.literal("").transform(() => undefined);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
  .transform((v) => (v === "" ? null : v));
const intIn = (min: number, max: number, label: string) =>
  z.coerce
    .number({ error: `Informe ${label}` })
    .int("Use um número inteiro")
    .min(min, `Entre ${min} e ${max}`)
    .max(max, `Entre ${min} e ${max}`);
const checkbox = z.string().transform((v) => v === "on" || v === "true");

export const serviceInputSchema = z
  .object({
    id: z.uuid().optional().or(emptyToUndefined),
    name: z.string().trim().min(1, "Informe o nome").max(80, "Máximo de 80 caracteres"),
    kind: z.enum(SERVICE_KINDS, { error: "Tipo inválido" }),
    provider: optionalText(80),
    url: z
      .string()
      .trim()
      .max(500, "Máximo de 500 caracteres")
      .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Use uma URL com http:// ou https://")
      .transform((v) => (v === "" ? null : v)),
    check_method: z.enum(CHECK_METHODS, { error: "Verificação inválida" }),
    expected_status: intIn(100, 599, "o status"),
    keyword: optionalText(120),
    latency_warn_ms: intIn(100, 60000, "o limite"),
    interval_minutes: intIn(5, 1440, "o intervalo"),
    context: z.enum(CONTEXTS, { error: "Contexto inválido" }),
    active: checkbox,
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if ((v.check_method === "http" || v.check_method === "keyword") && !v.url) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Informe a URL verificada" });
    }
    if (v.check_method === "keyword" && !v.keyword) {
      ctx.addIssue({ code: "custom", path: ["keyword"], message: "Informe o texto esperado na página" });
    }
  });

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const alertDaysSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const parts = v === "" ? ["30", "7", "1"] : v.split(/[\s,;]+/).filter(Boolean);
    const days = parts.map(Number);
    if (days.length > 6 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 365)) {
      ctx.addIssue({ code: "custom", message: "Use até 6 números entre 0 e 365, ex.: 30, 7, 1" });
      return z.NEVER;
    }
    return [...new Set(days)].sort((a, b) => b - a);
  });

export const renewalInputSchema = z
  .object({
    id: z.uuid().optional().or(emptyToUndefined),
    kind: z.enum(RENEWAL_KINDS, { error: "Tipo inválido" }),
    name: z.string().trim().min(1, "Informe o nome").max(120, "Máximo de 120 caracteres"),
    provider: optionalText(80),
    service_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid({ error: "Serviço inválido" }).nullable()),
    context: z.enum(CONTEXTS, { error: "Contexto inválido" }),
    expires_on: optionalDate,
    currency: z.enum(CURRENCIES, { error: "Moeda inválida" }),
    cost_cents: optionalMoney,
    billing_cycle: z.enum(BILLING_CYCLES, { error: "Ciclo inválido" }),
    balance_cents: optionalMoney,
    monthly_burn_cents: optionalMoney,
    balance_updated_on: optionalDate,
    owner_is_client: checkbox,
    auto_renew: checkbox,
    alert_days: alertDaysSchema,
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "credit") {
      if (v.balance_cents === null)
        ctx.addIssue({ code: "custom", path: ["balance_cents"], message: "Informe o saldo atual" });
      if (v.monthly_burn_cents === null)
        ctx.addIssue({ code: "custom", path: ["monthly_burn_cents"], message: "Informe o consumo mensal" });
      if (v.balance_updated_on === null)
        ctx.addIssue({ code: "custom", path: ["balance_updated_on"], message: "Informe a data do saldo" });
    } else if (v.expires_on === null) {
      ctx.addIssue({ code: "custom", path: ["expires_on"], message: "Informe o vencimento" });
    }
  });

export type RenewalInput = z.infer<typeof renewalInputSchema>;

export const topUpInputSchema = z.object({
  id: z.uuid(),
  amount_cents: requiredMoney("Informe o valor da recarga"),
  balance_updated_on: isoDate,
});
