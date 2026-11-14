import type { Metadata } from "next";
import { Suspense } from "react";
import { SwitchContextButton } from "@/components/shell/context-switcher";
import { EmptyState, PageHead, Section, Stat } from "@/components/ui/display";
import { getClientsWithTotals, getDeals, getReminders } from "@/features/freelance/queries";
import { getIncomeSources } from "@/features/income/queries";
import { CONTEXT_LABELS } from "@/lib/context";
import { currentMonthISO, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getActiveContext } from "@/lib/settings";
import {
  ClientList,
  ClosedDeals,
  NewClientButton,
  NewDealButton,
  NewReminderButton,
  Pipeline,
  ReminderList,
  type DealItem,
  type ReminderItem,
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
        <FreelanceBody />
      </Suspense>
    </>
  );
}

function inFreelance(context: string) {
  return context === "all" || context === "freelance";
}

async function FreelanceBody() {
  const context = await getActiveContext();
  if (!inFreelance(context)) {
    return (
      <EmptyState
        title={`Fora do contexto ${CONTEXT_LABELS[context]}`}
        action={<SwitchContextButton to="freelance">Ver contexto Freelance</SwitchContextButton>}
      >
        Clientes, negócios e orçamentos pertencem sempre ao contexto Freelance. Escolha Tudo ou Freelance para
        ver o pipeline.
      </EmptyState>
    );
  }
  return (
    <>
      <Section title="Cobranças">
        <Suspense fallback={<p className="label">Carregando</p>}>
          <Reminders />
        </Suspense>
      </Section>
      <PipelineSection />
      <Section title="Clientes">
        <Suspense fallback={<p className="label">Carregando</p>}>
          <Clients />
        </Suspense>
      </Section>
    </>
  );
}

async function HeadActions() {
  if (!inFreelance(await getActiveContext())) return null;
  const clients = await getClientsWithTotals();
  const options = clients.map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <NewClientButton primary={clients.length === 0} />
      {clients.length > 0 ? (
        <>
          <NewReminderButton clients={options} deals={dealOptions(await getDeals())} today={todayISO()} />
          <NewDealButton clients={options} />
        </>
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

function dealOptions(deals: Awaited<ReturnType<typeof getDeals>>) {
  return deals
    .filter((d) => d.stage !== "lost")
    .map((d) => ({ id: d.id, title: d.title, client_id: d.client_id }));
}

async function Reminders() {
  const [reminders, clients, deals, sources] = await Promise.all([
    getReminders(),
    getClientsWithTotals(),
    getDeals(),
    getIncomeSources("all"),
  ]);
  if (reminders.length === 0) {
    return (
      <p className="label">
        Nenhuma cobrança agendada. Use “Lembrar de cobrar” num cliente para receber um e-mail no dia.
      </p>
    );
  }
  const items: ReminderItem[] = reminders.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    deal_id: r.deal_id,
    amount_cents: r.amount_cents,
    remind_on: r.remind_on,
    recurrence: r.recurrence,
    note: r.note,
    last_paid_on: r.last_paid_on,
    client: r.client?.name ?? "Cliente",
    deal: r.deal?.title ?? null,
  }));
  return (
    <ReminderList
      reminders={items}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      deals={dealOptions(deals)}
      sources={sources
        .filter((s) => s.active && s.kind === "variable")
        .map((s) => ({ id: s.id, name: s.name }))}
      today={todayISO()}
    />
  );
}

async function Clients() {
  const [clients, deals] = await Promise.all([getClientsWithTotals(), getDeals()]);
  if (clients.length === 0) {
    return <EmptyState title="Nenhum cliente">Cadastre quem contrata seus serviços.</EmptyState>;
  }
  return (
    <>
      <p className="label">Margem = receita dos negócios ganhos − despesas ligadas aos projetos do cliente</p>
      <ClientList clients={clients} deals={dealOptions(deals)} today={todayISO()} />
    </>
  );
}
