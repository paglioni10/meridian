import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHead, Section, Stat } from "@/components/ui/display";
import {
  getIncidents24h,
  getRecentAlerts,
  getRenewals,
  getServices,
  type AlertRow,
} from "@/features/infra/queries";
import { RENEWAL_KIND_LABELS } from "@/features/infra/schema";
import { cn } from "@/lib/cn";
import { formatDateFull as formatDate, todayISO } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { getActiveContext } from "@/lib/settings";
import { NewRenewalButton, NewServiceButton, RenewalList, ServiceList, type ServiceItem } from "./infra-ui";

export const metadata: Metadata = { title: "Servidores" };

export default function InfraPage() {
  return (
    <>
      <PageHead
        title="Servidores"
        meta="VPS, automações, sites e vencimentos"
        actions={
          <Suspense fallback={null}>
            <HeadActions />
          </Suspense>
        }
      />
      <Suspense fallback={<p className="label">Carregando</p>}>
        <Stats />
      </Suspense>
      <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Serviços">
          <Suspense fallback={<p className="label">Carregando serviços</p>}>
            <Services />
          </Suspense>
        </Section>
        <div className="flex flex-col gap-8">
          <Section title="Vencimentos">
            <Suspense fallback={<p className="label">Carregando vencimentos</p>}>
              <Renewals />
            </Suspense>
          </Section>
          <Section title="Alertas recentes">
            <Suspense fallback={<p className="label">Carregando alertas</p>}>
              <Alerts />
            </Suspense>
          </Section>
        </div>
      </div>
    </>
  );
}

async function HeadActions() {
  const services = await getServices("all");
  return (
    <>
      <NewServiceButton primary={services.length === 0} />
      <NewRenewalButton services={services.map((s) => ({ id: s.id, name: s.name }))} today={todayISO()} />
    </>
  );
}

async function Stats() {
  const context = await getActiveContext();
  const [services, renewals, incidents] = await Promise.all([
    getServices(context),
    getRenewals(context),
    getIncidents24h(),
  ]);
  const monitored = services.filter((s) => s.active && s.check_method !== "manual");
  const down = monitored.filter((s) => s.last_state === "down");
  const online = monitored.filter((s) => s.last_state === "up" || s.last_state === "degraded");
  const next = renewals.find((r) => r.days_left >= 0) ?? null;
  const expired = renewals.filter((r) => r.urgency === "expired").length;

  return (
    <div className="stats-grid">
      <Stat
        label="Online"
        size="display"
        alert={down.length > 0}
        value={monitored.length ? `${online.length}/${monitored.length}` : "—"}
        hint={
          down.length
            ? `Offline: ${down.map((s) => s.name).join(", ")}`
            : monitored.length
              ? "Todos respondendo"
              : "Nenhum serviço monitorado"
        }
      />
      <Stat
        label="Incidentes 24 h"
        value={String(incidents)}
        alert={incidents > 0}
        hint={incidents ? "Quedas detectadas" : "Sem quedas"}
      />
      <Stat
        label="Próximo vencimento"
        value={next ? `${next.days_left} d` : "—"}
        alert={expired > 0 || (next !== null && next.days_left <= 7)}
        hint={
          expired
            ? `${expired} ${expired === 1 ? "vencido" : "vencidos"}`
            : next
              ? `${next.name} · ${formatDate(next.expires_on)}`
              : "Nada cadastrado"
        }
      />
    </div>
  );
}

async function Services() {
  const services = await getServices(await getActiveContext());
  if (services.length === 0) {
    return (
      <EmptyState title="Nenhum serviço">
        Cadastre a VPS, o n8n e os sites. Serviços HTTP são verificados a cada intervalo; automações podem
        avisar que estão vivas com um heartbeat.
      </EmptyState>
    );
  }
  return <ServiceList services={services as ServiceItem[]} siteUrl={publicEnv.NEXT_PUBLIC_SITE_URL} />;
}

async function Renewals() {
  const context = await getActiveContext();
  const [renewals, services] = await Promise.all([getRenewals(context), getServices("all")]);
  if (renewals.length === 0) {
    return (
      <EmptyState title="Nenhum vencimento">
        Domínios, hospedagens, licenças e créditos pré-pagos. Avisos saem 30, 7 e 1 dia antes.
      </EmptyState>
    );
  }
  return (
    <RenewalList
      renewals={renewals}
      services={services.map((s) => ({ id: s.id, name: s.name }))}
      today={todayISO()}
    />
  );
}

const ALERT_LABELS: Record<AlertRow["kind"], string> = {
  service_down: "Offline",
  service_up: "Voltou",
  renewal_due: "A vencer",
  renewal_expired: "Vencido",
  credit_low: "Crédito acabando",
  tls_due: "Certificado",
};

function alertSubject(alert: AlertRow) {
  const p = (alert.payload ?? {}) as Record<string, unknown>;
  const name = String(p.service ?? p.renewal ?? "");
  const type =
    typeof p.type === "string" && p.type in RENEWAL_KIND_LABELS
      ? ` · ${RENEWAL_KIND_LABELS[p.type as "domain"]}`
      : "";
  return name + type;
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

async function Alerts() {
  const alerts = await getRecentAlerts();
  if (alerts.length === 0) return <p className="label">Nenhum alerta ainda.</p>;
  return (
    <ul className="flex flex-col">
      {alerts.map((a) => (
        <li key={a.id} className="flex items-baseline justify-between gap-3 border-b border-border-soft py-2">
          <span className="min-w-0 truncate">
            <span
              className={cn(
                "mr-2 font-mono text-label uppercase",
                a.kind === "service_up" ? "text-muted" : "text-danger",
              )}
            >
              {ALERT_LABELS[a.kind]}
            </span>
            {alertSubject(a)}
          </span>
          <span className="shrink-0 font-mono text-label text-muted tabular-nums">
            {formatDateTime(a.created_at)}
            {a.delivered_at ? " · enviado" : a.delivery_error ? " · falha no envio" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
