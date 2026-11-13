"use client";

import { useActionState, useEffect, useEffectEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/display";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  checkService,
  deleteRenewal,
  deleteService,
  renewNow,
  saveRenewal,
  saveService,
  setServiceActive,
  topUpCredit,
  type ActionState,
} from "@/features/infra/actions";
import {
  BILLING_CYCLES,
  BILLING_LABELS,
  CHECK_METHOD_LABELS,
  CHECK_METHODS,
  CURRENCIES,
  RENEWAL_KIND_LABELS,
  RENEWAL_KINDS,
  SERVICE_KIND_LABELS,
  SERVICE_KINDS,
  STATE_LABELS,
  type CheckMethod,
  type RenewalKind,
  type ServiceKind,
  type ServiceState,
} from "@/features/infra/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS, type ContextKind } from "@/lib/context";
import { formatDateFull as formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

const initial: ActionState = { status: "idle", message: "" };
const CONTEXT_OPTIONS = ["personal", "work", "freelance"] as const;
const CURRENCY_SYMBOL = { BRL: "R$", USD: "US$", EUR: "€" } as Record<string, string>;

export type ServiceItem = {
  id: string;
  context: ContextKind;
  name: string;
  kind: ServiceKind;
  provider: string | null;
  url: string | null;
  check_method: CheckMethod;
  expected_status: number;
  keyword: string | null;
  latency_warn_ms: number;
  interval_minutes: number;
  heartbeat_token: string;
  last_state: ServiceState;
  last_latency_ms: number | null;
  last_status_code: number | null;
  last_error: string | null;
  tls_expires_on: string | null;
  active: boolean;
  notes: string | null;
  uptime_7d: number | null;
  minutes_since_check: number | null;
  timeline: ("none" | "up" | "degraded" | "down")[];
};

export type RenewalItem = {
  id: string;
  service_id: string | null;
  kind: RenewalKind;
  name: string;
  provider: string | null;
  context: ContextKind;
  expires_on: string;
  currency: string;
  cost_cents: number | null;
  billing_cycle: string;
  balance_cents: number | null;
  monthly_burn_cents: number | null;
  balance_updated_on: string | null;
  owner_is_client: boolean;
  auto_renew: boolean;
  alert_days: number[];
  notes: string | null;
  days_left: number;
  urgency: "expired" | "critical" | "warning" | "ok";
};

export type ServiceOption = { id: string; name: string };

function money(cents: number, currency: string) {
  return `${CURRENCY_SYMBOL[currency] ?? currency} ${formatBRL(cents)}`;
}

function ago(minutes: number | null) {
  if (minutes === null) return "nunca verificado";
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.round(minutes / 60)} h`;
  return `há ${Math.round(minutes / 1440)} d`;
}

function useResult(state: ActionState, onDone: () => void) {
  const toast = useToast();
  const onResult = useEffectEvent((r: ActionState) => {
    if (r.status === "saved") {
      toast(r.message);
      onDone();
    }
    if (r.status === "error" && !r.fieldErrors) toast(r.message, "alert");
  });
  useEffect(() => {
    onResult(state);
  }, [state]);
}

function useRunner() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const run = <T,>(task: () => Promise<T>, success: (value: T) => string) =>
    startTransition(async () => {
      try {
        const value = await task();
        toast(success(value));
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  return { pending, run };
}

function FormActions({
  onCancel,
  pending,
  label,
}: {
  onCancel: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <div className="modal-actions">
      <Button variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Salvando" : label}
      </Button>
    </div>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex min-h-tap items-center gap-3 font-mono text-data">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-5 w-5 accent-[var(--ink)]"
      />
      {label}
    </label>
  );
}

export function StateBadge({ state, active = true }: { state: ServiceState; active?: boolean }) {
  if (!active) return <span className="status text-muted">Pausado</span>;
  const cls = {
    up: "status-online",
    degraded: "status-warning",
    down: "status-offline",
    unknown: "text-muted",
  }[state];
  return (
    <span className={cn("status", cls)}>
      <span className="status-dot" aria-hidden />
      {STATE_LABELS[state]}
    </span>
  );
}

function Timeline({ buckets, name }: { buckets: ServiceItem["timeline"]; name: string }) {
  const down = buckets.filter((b) => b === "down").length;
  const known = buckets.filter((b) => b !== "none").length;
  return (
    <div
      role="img"
      aria-label={`${name}: últimos 7 dias, ${known ? `${down} de ${known} períodos com queda` : "sem verificações"}`}
      className="flex h-3 w-full max-w-56 gap-px"
    >
      {buckets.map((b, i) => (
        <span
          key={i}
          className={cn(
            "flex-1",
            b === "none" && "bg-border-soft",
            b === "up" && "bg-foreground",
            b === "degraded" && "border border-danger",
            b === "down" && "bg-danger",
          )}
        />
      ))}
    </div>
  );
}

function ServiceForm({ value, onDone }: { value?: ServiceItem; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveService, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  const [method, setMethod] = useState<CheckMethod>(
    (state.values?.check_method as CheckMethod) ?? value?.check_method ?? "http",
  );
  const probes = method === "http" || method === "keyword";
  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={value?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" error={e.name}>
          {(a) => (
            <Input
              {...a}
              name="name"
              defaultValue={v("name", value?.name ?? "")}
              placeholder="VPS Hetzner"
              autoFocus
            />
          )}
        </Field>
        <Field label="Tipo" error={e.kind}>
          {(a) => (
            <Select {...a} name="kind" defaultValue={v("kind", value?.kind ?? "website")}>
              {SERVICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SERVICE_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Verificação" error={e.check_method}>
          {(a) => (
            <Select
              {...a}
              name="check_method"
              value={method}
              onChange={(ev) => setMethod(ev.target.value as CheckMethod)}
            >
              {CHECK_METHODS.map((m) => (
                <option key={m} value={m}>
                  {CHECK_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Provedor" error={e.provider}>
          {(a) => (
            <Input
              {...a}
              name="provider"
              defaultValue={v("provider", value?.provider ?? "")}
              placeholder="Hetzner"
            />
          )}
        </Field>
      </div>
      <Field
        label="URL"
        error={e.url}
        hint={probes ? "Endereço verificado a cada intervalo" : "Opcional, só para referência"}
      >
        {(a) => (
          <Input
            {...a}
            name="url"
            type="url"
            inputMode="url"
            defaultValue={v("url", value?.url ?? "")}
            placeholder="https://"
          />
        )}
      </Field>
      {method === "keyword" ? (
        <Field label="Texto esperado na página" error={e.keyword}>
          {(a) => <Input {...a} name="keyword" defaultValue={v("keyword", value?.keyword ?? "")} />}
        </Field>
      ) : (
        <input type="hidden" name="keyword" value="" />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {probes ? (
          <>
            <Field label="Status esperado" error={e.expected_status} hint="301 para redirecionamentos">
              {(a) => (
                <Input
                  {...a}
                  name="expected_status"
                  inputMode="numeric"
                  defaultValue={v("expected_status", String(value?.expected_status ?? 200))}
                />
              )}
            </Field>
            <Field label="Lento acima de (ms)" error={e.latency_warn_ms}>
              {(a) => (
                <Input
                  {...a}
                  name="latency_warn_ms"
                  inputMode="numeric"
                  defaultValue={v("latency_warn_ms", String(value?.latency_warn_ms ?? 1500))}
                />
              )}
            </Field>
          </>
        ) : (
          <>
            <input type="hidden" name="expected_status" value={String(value?.expected_status ?? 200)} />
            <input type="hidden" name="latency_warn_ms" value={String(value?.latency_warn_ms ?? 1500)} />
          </>
        )}
        <Field
          label="Intervalo (min)"
          error={e.interval_minutes}
          hint={method === "heartbeat" ? "Offline após 2× sem sinal" : "Mínimo 5"}
        >
          {(a) => (
            <Input
              {...a}
              name="interval_minutes"
              inputMode="numeric"
              defaultValue={v("interval_minutes", String(value?.interval_minutes ?? 10))}
            />
          )}
        </Field>
        <Field label="Contexto" error={e.context}>
          {(a) => (
            <Select {...a} name="context" defaultValue={v("context", value?.context ?? "personal")}>
              {CONTEXT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CONTEXT_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Notas" error={e.notes}>
        {(a) => <Textarea {...a} name="notes" defaultValue={v("notes", value?.notes ?? "")} />}
      </Field>
      <Checkbox
        name="active"
        label="Monitorar este serviço"
        defaultChecked={state.values ? state.values.active === "on" : (value?.active ?? true)}
      />
      {method === "heartbeat" && !value ? (
        <p className="label">O endereço de heartbeat aparece depois de salvar.</p>
      ) : null}
      <FormActions onCancel={onDone} pending={pending} label={value ? "Salvar" : "Cadastrar"} />
    </form>
  );
}

function HeartbeatSnippet({ siteUrl, token }: { siteUrl: string; token: string }) {
  const toast = useToast();
  const command = `curl -fsS -X POST ${siteUrl}/api/heartbeat/${token}`;
  return (
    <div className="flex flex-col gap-1">
      <span className="label">Heartbeat · último passo do fluxo ou cron</span>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto border border-border-soft px-2 py-2 font-mono text-label whitespace-nowrap">
          {command}
        </code>
        <Button
          variant="ghost"
          className="min-h-9 shrink-0"
          onClick={() =>
            navigator.clipboard
              .writeText(command)
              .then(() => toast("Comando copiado."))
              .catch(() => toast("Não foi possível copiar.", "alert"))
          }
        >
          Copiar
        </Button>
      </div>
    </div>
  );
}

function ServiceRow({ service, siteUrl }: { service: ServiceItem; siteUrl: string }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | "details" | null>(null);
  const { pending, run } = useRunner();
  const probes = service.check_method === "http" || service.check_method === "keyword";
  return (
    <li className={cn("flex flex-col gap-2 border-b border-border-soft py-3", pending && "opacity-60")}>
      <div className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] md:items-center">
        <div className="flex min-w-0 flex-col">
          <button
            type="button"
            onClick={() => setDialog("details")}
            className="truncate text-left font-medium hover:text-danger"
          >
            {service.name}
          </button>
          <span className="label truncate">
            {SERVICE_KIND_LABELS[service.kind]}
            {service.provider ? ` · ${service.provider}` : ""} · {CONTEXT_LABELS[service.context]}
          </span>
        </div>
        <div className="justify-self-end md:order-last">
          <StateBadge state={service.last_state} active={service.active} />
        </div>
        <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
          <Timeline buckets={service.timeline} name={service.name} />
          <span className="font-mono text-label text-muted tabular-nums">
            {service.uptime_7d !== null
              ? `${service.uptime_7d.toFixed(1).replace(".", ",")}% em 7 d`
              : "Sem histórico"}
          </span>
        </div>
        <span className="col-span-2 font-mono text-data tabular-nums md:col-span-1 md:text-right">
          {service.last_latency_ms !== null ? `${service.last_latency_ms} ms` : "—"}
          <span className="text-muted"> · {ago(service.minutes_since_check)}</span>
        </span>
      </div>
      {service.last_state !== "up" && service.last_error && service.active ? (
        <span className="font-mono text-label text-danger">{service.last_error}</span>
      ) : null}
      <div className="-ml-2 flex flex-wrap items-center">
        {probes && service.active ? (
          <Button
            variant="ghost"
            className="min-h-9"
            disabled={pending}
            onClick={() =>
              run(
                () => checkService(service.id),
                (r) => (r === "down" ? `${service.name} está offline.` : `${service.name} verificado.`),
              )
            }
          >
            Verificar agora
          </Button>
        ) : null}
        <Button variant="ghost" className="min-h-9" disabled={pending} onClick={() => setDialog("edit")}>
          Editar
        </Button>
        <Button
          variant="ghost"
          className="min-h-9"
          disabled={pending}
          onClick={() =>
            run(
              () => setServiceActive(service.id, !service.active),
              () => (service.active ? "Monitoramento pausado." : "Monitoramento retomado."),
            )
          }
        >
          {service.active ? "Pausar" : "Retomar"}
        </Button>
        <Button
          variant="ghost"
          className="min-h-9 text-danger"
          disabled={pending}
          onClick={() => setDialog("delete")}
        >
          Excluir
        </Button>
      </div>
      <Dialog open={dialog === "details"} onClose={() => setDialog(null)} title={service.name}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-data">
          <dt className="label">Estado</dt>
          <dd>
            <StateBadge state={service.last_state} active={service.active} />
          </dd>
          <dt className="label">Verificação</dt>
          <dd>{CHECK_METHOD_LABELS[service.check_method]}</dd>
          {service.url ? (
            <>
              <dt className="label">URL</dt>
              <dd className="break-all">{service.url}</dd>
            </>
          ) : null}
          {service.last_status_code !== null ? (
            <>
              <dt className="label">Último status</dt>
              <dd>{service.last_status_code}</dd>
            </>
          ) : null}
          <dt className="label">Intervalo</dt>
          <dd>{service.interval_minutes} min</dd>
          {service.tls_expires_on ? (
            <>
              <dt className="label">Certificado TLS</dt>
              <dd>até {formatDate(service.tls_expires_on)}</dd>
            </>
          ) : null}
          {service.notes ? (
            <>
              <dt className="label">Notas</dt>
              <dd className="font-body whitespace-pre-wrap">{service.notes}</dd>
            </>
          ) : null}
        </dl>
        {service.check_method === "heartbeat" ? (
          <HeartbeatSnippet siteUrl={siteUrl} token={service.heartbeat_token} />
        ) : null}
      </Dialog>
      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar serviço">
        {dialog === "edit" ? (
          <>
            <ServiceForm value={service} onDone={() => setDialog(null)} />
            {service.check_method === "heartbeat" ? (
              <HeartbeatSnippet siteUrl={siteUrl} token={service.heartbeat_token} />
            ) : null}
          </>
        ) : null}
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Excluir serviço?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialog(null);
                run(
                  () => deleteService(service.id),
                  () => "Serviço excluído.",
                );
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          <strong>{service.name}</strong> e todo o histórico de verificações serão excluídos. Para parar só o
          monitoramento, use Pausar.
        </p>
      </Dialog>
    </li>
  );
}

export function ServiceList({ services, siteUrl }: { services: ServiceItem[]; siteUrl: string }) {
  return (
    <ul className="flex flex-col">
      {services.map((s) => (
        <ServiceRow key={s.id} service={s} siteUrl={siteUrl} />
      ))}
    </ul>
  );
}

export function NewServiceButton({ primary }: { primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={primary ? "primary" : "default"} onClick={() => setOpen(true)}>
        Novo serviço
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Novo serviço">
        {open ? <ServiceForm onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}

function RenewalForm({
  value,
  services,
  today,
  onDone,
}: {
  value?: RenewalItem;
  services: ServiceOption[];
  today: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveRenewal, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  const [kind, setKind] = useState<RenewalKind>(
    (state.values?.kind as RenewalKind) ?? value?.kind ?? "domain",
  );
  const credit = kind === "credit";
  const checked = (k: "owner_is_client" | "auto_renew") =>
    state.values ? state.values[k] === "on" : (value?.[k] ?? false);
  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={value?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" error={e.kind}>
          {(a) => (
            <Select
              {...a}
              name="kind"
              value={kind}
              onChange={(ev) => setKind(ev.target.value as RenewalKind)}
            >
              {RENEWAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {RENEWAL_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={kind === "domain" ? "Domínio" : "Nome"}
          error={e.name}
          hint={kind === "domain" ? "Ex.: meusite.com.br; o vencimento é conferido no RDAP" : undefined}
        >
          {(a) => <Input {...a} name="name" defaultValue={v("name", value?.name ?? "")} autoFocus />}
        </Field>
        <Field label="Provedor" error={e.provider}>
          {(a) => (
            <Input
              {...a}
              name="provider"
              defaultValue={v("provider", value?.provider ?? "")}
              placeholder="Registro.br"
            />
          )}
        </Field>
        <Field label="Serviço relacionado" error={e.service_id}>
          {(a) => (
            <Select {...a} name="service_id" defaultValue={v("service_id", value?.service_id ?? "")}>
              <option value="">Nenhum</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {credit ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Saldo atual" error={e.balance_cents}>
            {(a) => (
              <Input
                {...a}
                name="balance_cents"
                inputMode="decimal"
                defaultValue={v("balance_cents", value?.balance_cents ? formatBRL(value.balance_cents) : "")}
              />
            )}
          </Field>
          <Field label="Consumo por mês" error={e.monthly_burn_cents}>
            {(a) => (
              <Input
                {...a}
                name="monthly_burn_cents"
                inputMode="decimal"
                defaultValue={v(
                  "monthly_burn_cents",
                  value?.monthly_burn_cents ? formatBRL(value.monthly_burn_cents) : "",
                )}
              />
            )}
          </Field>
          <Field label="Saldo em" error={e.balance_updated_on}>
            {(a) => (
              <Input
                {...a}
                name="balance_updated_on"
                type="date"
                defaultValue={v("balance_updated_on", value?.balance_updated_on ?? today)}
              />
            )}
          </Field>
          <input type="hidden" name="expires_on" value="" />
        </div>
      ) : (
        <>
          <input type="hidden" name="balance_cents" value="" />
          <input type="hidden" name="monthly_burn_cents" value="" />
          <input type="hidden" name="balance_updated_on" value="" />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {credit ? null : (
          <Field label="Vencimento" error={e.expires_on}>
            {(a) => (
              <Input
                {...a}
                name="expires_on"
                type="date"
                defaultValue={v("expires_on", value?.expires_on ?? "")}
              />
            )}
          </Field>
        )}
        <Field label={credit ? "Valor da recarga" : "Custo"} error={e.cost_cents}>
          {(a) => (
            <Input
              {...a}
              name="cost_cents"
              inputMode="decimal"
              defaultValue={v("cost_cents", value?.cost_cents ? formatBRL(value.cost_cents) : "")}
            />
          )}
        </Field>
        <Field label="Moeda" error={e.currency}>
          {(a) => (
            <Select {...a} name="currency" defaultValue={v("currency", value?.currency ?? "BRL")}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ciclo" error={e.billing_cycle}>
          {(a) => (
            <Select
              {...a}
              name="billing_cycle"
              defaultValue={v("billing_cycle", value?.billing_cycle ?? "yearly")}
            >
              {BILLING_CYCLES.map((c) => (
                <option key={c} value={c}>
                  {BILLING_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Avisar com (dias)" error={e.alert_days} hint="Separados por vírgula">
          {(a) => (
            <Input
              {...a}
              name="alert_days"
              inputMode="numeric"
              defaultValue={v("alert_days", (value?.alert_days ?? [30, 7, 1]).join(", "))}
            />
          )}
        </Field>
        <Field label="Contexto" error={e.context}>
          {(a) => (
            <Select {...a} name="context" defaultValue={v("context", value?.context ?? "personal")}>
              {CONTEXT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CONTEXT_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Notas" error={e.notes}>
        {(a) => <Textarea {...a} name="notes" defaultValue={v("notes", value?.notes ?? "")} />}
      </Field>
      <div className="flex flex-wrap gap-x-6">
        <Checkbox name="auto_renew" label="Renovação automática" defaultChecked={checked("auto_renew")} />
        <Checkbox
          name="owner_is_client"
          label="Pago pelo cliente"
          defaultChecked={checked("owner_is_client")}
        />
      </div>
      <FormActions onCancel={onDone} pending={pending} label={value ? "Salvar" : "Cadastrar"} />
    </form>
  );
}

function TopUpForm({ renewal, today, onDone }: { renewal: RenewalItem; today: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(topUpCredit, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={renewal.id} />
      <p className="label">
        O saldo restante é estimado pelo consumo desde {formatDate(renewal.balance_updated_on ?? today)} e
        somado à recarga.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Recarga (${renewal.currency})`} error={e.amount_cents}>
          {(a) => (
            <Input
              {...a}
              name="amount_cents"
              inputMode="decimal"
              defaultValue={
                state.values?.amount_cents ?? (renewal.cost_cents ? formatBRL(renewal.cost_cents) : "")
              }
              autoFocus
            />
          )}
        </Field>
        <Field label="Data" error={e.balance_updated_on}>
          {(a) => (
            <Input
              {...a}
              name="balance_updated_on"
              type="date"
              defaultValue={state.values?.balance_updated_on ?? today}
            />
          )}
        </Field>
      </div>
      <FormActions onCancel={onDone} pending={pending} label="Registrar recarga" />
    </form>
  );
}

function urgencyTag(r: RenewalItem) {
  if (r.urgency === "expired") return <Tag>Vencido</Tag>;
  if (r.urgency === "critical") return <Tag>A vencer</Tag>;
  if (r.urgency === "warning") return <Tag tone="outline">A vencer</Tag>;
  return null;
}

function daysText(days: number) {
  if (days < 0) return `venceu há ${-days} ${days === -1 ? "dia" : "dias"}`;
  if (days === 0) return "vence hoje";
  return `em ${days} ${days === 1 ? "dia" : "dias"}`;
}

function RenewalRow({
  renewal,
  services,
  today,
}: {
  renewal: RenewalItem;
  services: ServiceOption[];
  today: string;
}) {
  const [dialog, setDialog] = useState<"edit" | "delete" | "topup" | null>(null);
  const { pending, run } = useRunner();
  const credit = renewal.kind === "credit";
  const late = renewal.urgency === "expired";
  return (
    <li className={cn("flex flex-col gap-1.5 border-b border-border-soft py-3", pending && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{renewal.name}</span>
          <span className="label truncate">
            {RENEWAL_KIND_LABELS[renewal.kind]}
            {renewal.provider ? ` · ${renewal.provider}` : ""}
            {renewal.owner_is_client ? " · pago pelo cliente" : ""}
            {renewal.auto_renew ? " · automática" : ""}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("font-mono text-data tabular-nums", late && "text-danger")}>
            {formatDate(renewal.expires_on)}
          </span>
          <span className={cn("font-mono text-label", late ? "text-danger" : "text-muted")}>
            {credit ? "esgota " : ""}
            {daysText(renewal.days_left)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {urgencyTag(renewal)}
        {credit && renewal.balance_cents !== null && renewal.monthly_burn_cents !== null ? (
          <span className="font-mono text-label text-muted tabular-nums">
            Saldo {money(renewal.balance_cents, renewal.currency)} em{" "}
            {formatDate(renewal.balance_updated_on ?? renewal.expires_on)} · consumo{" "}
            {money(renewal.monthly_burn_cents, renewal.currency)}/mês
          </span>
        ) : renewal.cost_cents ? (
          <span className="font-mono text-label text-muted tabular-nums">
            {money(renewal.cost_cents, renewal.currency)} ·{" "}
            {BILLING_LABELS[renewal.billing_cycle as "monthly"]}
          </span>
        ) : null}
      </div>
      <div className="-ml-2 flex flex-wrap items-center">
        {credit ? (
          <Button variant="ghost" className="min-h-9" disabled={pending} onClick={() => setDialog("topup")}>
            Recarregar
          </Button>
        ) : renewal.billing_cycle !== "other" ? (
          <Button
            variant="ghost"
            className="min-h-9"
            disabled={pending}
            onClick={() =>
              run(
                () => renewNow(renewal.id),
                (date) => `Renovado até ${formatDate(date)}.`,
              )
            }
          >
            Renovado
          </Button>
        ) : null}
        <Button variant="ghost" className="min-h-9" disabled={pending} onClick={() => setDialog("edit")}>
          Editar
        </Button>
        <Button
          variant="ghost"
          className="min-h-9 text-danger"
          disabled={pending}
          onClick={() => setDialog("delete")}
        >
          Excluir
        </Button>
      </div>
      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar vencimento">
        {dialog === "edit" ? (
          <RenewalForm value={renewal} services={services} today={today} onDone={() => setDialog(null)} />
        ) : null}
      </Dialog>
      <Dialog open={dialog === "topup"} onClose={() => setDialog(null)} title={`Recarga · ${renewal.name}`}>
        {dialog === "topup" ? (
          <TopUpForm renewal={renewal} today={today} onDone={() => setDialog(null)} />
        ) : null}
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Excluir vencimento?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialog(null);
                run(
                  () => deleteRenewal(renewal.id),
                  () => "Vencimento excluído.",
                );
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          <strong>{renewal.name}</strong> deixa de ser acompanhado e não gera mais alertas.
        </p>
      </Dialog>
    </li>
  );
}

export function RenewalList({
  renewals,
  services,
  today,
}: {
  renewals: RenewalItem[];
  services: ServiceOption[];
  today: string;
}) {
  return (
    <ul className="flex flex-col">
      {renewals.map((r) => (
        <RenewalRow key={r.id} renewal={r} services={services} today={today} />
      ))}
    </ul>
  );
}

export function NewRenewalButton({
  services,
  today,
  primary,
}: {
  services: ServiceOption[];
  today: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={primary ? "primary" : "default"} onClick={() => setOpen(true)}>
        Novo vencimento
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Novo vencimento">
        {open ? <RenewalForm services={services} today={today} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}
