import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHead, Section, Stat } from "@/components/ui/display";
import { getClientsWithTotals, getDeals } from "@/features/freelance/queries";
import { getIncomeSources } from "@/features/income/queries";
import { currentMonthISO, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import {
  ClientList,
  ClosedDeals,
  NewClientButton,
  NewDealButton,
  Pipeline,
  type DealItem,
} from "./freelance-ui";

export const metadata: Metadata = { title: "Freelance" };

export default function FreelancePage() {
  return (
    <>
      <PageHead
        title="Freelance"
        meta="Pipeline de clientes e orçamentos"
        actions={
          <Suspense fallback={null}>
            <HeadActions />
          </Suspense>
        }
      />
      <Suspense fallback={<p className="label">Carregando pipeline</p>}>
        <PipelineSection />
      </Suspense>
      <Section title="Clientes">
        <Suspense fallback={<p className="label">Carregando</p>}>
          <Clients />
        </Suspense>
      </Section>
    </>
  );
}

async function HeadActions() {
  const clients = await getClientsWithTotals();
  return (
    <>
      <NewClientButton primary={clients.length === 0} />
      {clients.length > 0 ? (
        <NewDealButton clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      ) : null}
    </>
  );
}

async function PipelineSection() {
  const [deals, clients, sources] = await Promise.all([
    getDeals(),
    getClientsWithTotals(),
    getIncomeSources("all"),
  ]);
  const today = todayISO();
  const month = currentMonthISO();
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;

  const items: DealItem[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    stage: d.stage,
    value_cents: d.value_cents,
    expected_close_on: d.expected_close_on,
    closed_at: d.closed_at,
    lost_reason: d.lost_reason,
    client_id: d.client_id,
    client: d.client?.name ?? "Cliente",
    hasIncome: d.income_id !== null,
    hasProject: d.projects.length > 0,
  }));

  if (items.length === 0) {
    return (
      <EmptyState title="Nenhum negócio ainda">
        Cadastre um cliente e registre cada orçamento como negócio: do contato à proposta. Ao marcar como
        ganho, o Meridian lança o valor em Ganhos e cria o projeto com o quadro de tarefas.
      </EmptyState>
    );
  }

  const open = items.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const closed = items.filter((d) => d.stage === "won" || d.stage === "lost");
  const recent = closed.filter((d) => d.closed_at && d.closed_at >= yearAgo);
  const won = recent.filter((d) => d.stage === "won").length;
  const wonThisMonth = closed
    .filter((d) => d.stage === "won" && d.closed_at && d.closed_at.slice(0, 7) === month.slice(0, 7))
    .reduce((s, d) => s + (d.value_cents ?? 0), 0);

  return (
    <>
      <div className="stats-grid">
        <Stat
          label="Pipeline aberto"
          size="display"
          value={formatBRL(open.reduce((s, d) => s + (d.value_cents ?? 0), 0))}
          hint={`${open.length} ${open.length === 1 ? "negócio" : "negócios"} em andamento`}
        />
        <Stat label="Ganho no mês" value={formatBRL(wonThisMonth)} hint="Negócios fechados" />
        <Stat
          label="Conversão"
          value={recent.length ? `${Math.round((won / recent.length) * 100)}%` : "—"}
          hint={recent.length ? `${won} de ${recent.length} em 12 meses` : "Sem negócios fechados"}
        />
      </div>
      <Pipeline
        deals={open}
        today={today}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        sources={sources
          .filter((s) => s.active && s.kind === "variable")
          .map((s) => ({ id: s.id, name: s.name }))}
      />
      {closed.length > 0 ? <ClosedDeals deals={closed} /> : null}
    </>
  );
}

async function Clients() {
  const clients = await getClientsWithTotals();
  if (clients.length === 0) {
    return <EmptyState title="Nenhum cliente">Cadastre quem contrata seus serviços.</EmptyState>;
  }
  return (
    <>
      <p className="label">Margem = receita dos negócios ganhos − despesas ligadas aos projetos do cliente</p>
      <ClientList clients={clients} />
    </>
  );
}
