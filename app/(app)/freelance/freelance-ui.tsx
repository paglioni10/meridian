"use client";

import { useActionState, useEffect, useEffectEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/display";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  deleteClient,
  deleteDeal,
  deleteReminder,
  loseDeal,
  markReminderPaid,
  moveDealStage,
  reopenDeal,
  saveClient,
  saveDeal,
  saveReminder,
  winDeal,
  type ActionState,
} from "@/features/freelance/actions";
import { reminderStatus } from "@/features/freelance/billing";
import {
  OPEN_STAGES,
  RECURRENCE_LABELS,
  RECURRENCES,
  STAGE_LABELS,
  type DealStage,
} from "@/features/freelance/schema";
import { cn } from "@/lib/cn";
import { formatDateFull, formatDayMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

const initial: ActionState = { status: "idle", message: "" };

type OpenStage = (typeof OPEN_STAGES)[number];

export type ClientOption = { id: string; name: string };
export type SourceOption = { id: string; name: string };
export type DealOption = { id: string; title: string; client_id: string };

export type ReminderItem = {
  id: string;
  client_id: string;
  deal_id: string | null;
  amount_cents: number | null;
  remind_on: string;
  recurrence: "once" | "monthly";
  note: string | null;
  last_paid_on: string | null;
  client: string;
  deal: string | null;
};

export type DealItem = {
  id: string;
  title: string;
  stage: DealStage;
  value_cents: number | null;
  expected_close_on: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  client_id: string;
  client: string;
  hasIncome: boolean;
  hasProject: boolean;
};

export type ClientItem = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  deals: number;
  openDeals: number;
  revenue: number;
  costs: number;
  margin: number;
};

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
  const run = (task: () => Promise<void>, success: string) =>
    startTransition(async () => {
      try {
        await task();
        toast(success);
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

function ClientForm({ value, onDone }: { value?: ClientItem; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveClient, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
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
          {(a) => <Input {...a} name="name" defaultValue={v("name", value?.name ?? "")} autoFocus />}
        </Field>
        <Field label="Empresa" error={e.company}>
          {(a) => <Input {...a} name="company" defaultValue={v("company", value?.company ?? "")} />}
        </Field>
        <Field label="E-mail" error={e.email}>
          {(a) => (
            <Input
              {...a}
              name="email"
              type="email"
              inputMode="email"
              defaultValue={v("email", value?.email ?? "")}
            />
          )}
        </Field>
        <Field label="Telefone" error={e.phone}>
          {(a) => <Input {...a} name="phone" inputMode="tel" defaultValue={v("phone", value?.phone ?? "")} />}
        </Field>
      </div>
      <Field label="Notas" error={e.notes}>
        {(a) => <Textarea {...a} name="notes" defaultValue={v("notes", value?.notes ?? "")} />}
      </Field>
      <FormActions onCancel={onDone} pending={pending} label={value ? "Salvar" : "Cadastrar"} />
    </form>
  );
}

function DealForm({
  value,
  clients,
  onDone,
}: {
  value?: DealItem;
  clients: ClientOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveDeal, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  const stage = value && (OPEN_STAGES as readonly string[]).includes(value.stage) ? value.stage : "lead";
  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={value?.id ?? ""} />
      <Field label="Projeto ou serviço" error={e.title}>
        {(a) => (
          <Input
            {...a}
            name="title"
            defaultValue={v("title", value?.title ?? "")}
            placeholder="Landing page"
            autoFocus
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" error={e.client_id}>
          {(a) => (
            <Select
              {...a}
              name="client_id"
              defaultValue={v("client_id", value?.client_id ?? (clients.length === 1 ? clients[0].id : ""))}
            >
              <option value="" disabled>
                Escolha o cliente
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Estágio" error={e.stage}>
          {(a) => (
            <Select {...a} name="stage" defaultValue={v("stage", stage)}>
              {OPEN_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Valor (R$)" error={e.value_cents} hint="Opcional; entra no pipeline e no ganho">
          {(a) => (
            <Input
              {...a}
              name="value_cents"
              inputMode="decimal"
              defaultValue={v("value_cents", value?.value_cents ? formatBRL(value.value_cents) : "")}
            />
          )}
        </Field>
        <Field label="Previsão de fechamento" error={e.expected_close_on}>
          {(a) => (
            <Input
              {...a}
              name="expected_close_on"
              type="date"
              defaultValue={v("expected_close_on", value?.expected_close_on ?? "")}
            />
          )}
        </Field>
      </div>
      <FormActions onCancel={onDone} pending={pending} label={value ? "Salvar" : "Criar"} />
    </form>
  );
}

function WinForm({
  deal,
  sources,
  today,
  onDone,
}: {
  deal: DealItem;
  sources: SourceOption[];
  today: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(winDeal, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const canLaunch = deal.value_cents !== null && !deal.hasIncome;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="deal_id" value={deal.id} />
      <p>
        <strong>{deal.title}</strong> · {deal.client}
        {deal.value_cents ? ` · ${formatBRL(deal.value_cents)}` : ""}
      </p>
      {canLaunch ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lançar ganho em" error={e.source_id} hint="Fonte de renda variável">
            {(a) => (
              <Select {...a} name="source_id" defaultValue={sources[0]?.id ?? ""}>
                <option value="">Não lançar agora</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Recebido em" error={e.received_on}>
            {(a) => <Input {...a} name="received_on" type="date" defaultValue={today} />}
          </Field>
        </div>
      ) : (
        <>
          <input type="hidden" name="source_id" value="" />
          <input type="hidden" name="received_on" value={today} />
          <p className="label">
            {deal.hasIncome
              ? "O ganho deste negócio já foi lançado."
              : "Sem valor definido: nenhum ganho será lançado."}
          </p>
        </>
      )}
      {sources.length === 0 && canLaunch ? (
        <p className="label">
          Cadastre uma fonte de renda variável em Finanças → Ganhos para lançar automaticamente.
        </p>
      ) : null}
      <label className="flex min-h-tap items-center gap-3 font-mono text-data">
        <input
          type="checkbox"
          name="create_project"
          defaultChecked={!deal.hasProject}
          disabled={deal.hasProject}
          className="h-5 w-5 accent-[var(--ink)]"
        />
        {deal.hasProject ? "Projeto já criado" : "Criar projeto freelance com as tarefas"}
      </label>
      <FormActions onCancel={onDone} pending={pending} label="Marcar como ganho" />
    </form>
  );
}

function DealCard({
  deal,
  clients,
  sources,
  today,
}: {
  deal: DealItem;
  clients: ClientOption[];
  sources: SourceOption[];
  today: string;
}) {
  const [dialog, setDialog] = useState<"edit" | "win" | "lose" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const { pending, run } = useRunner();
  const stageIndex = OPEN_STAGES.indexOf(deal.stage as OpenStage);
  const late = deal.expected_close_on !== null && deal.expected_close_on < today;

  return (
    <li className={cn("flex flex-col gap-1.5 border-t border-border pt-2 pb-3", pending && "opacity-60")}>
      <span className="font-medium">{deal.title}</span>
      <span className="label">{deal.client}</span>
      <span className="flex items-center justify-between gap-2 font-mono text-data tabular-nums">
        <span>{deal.value_cents ? formatBRL(deal.value_cents) : "Sem valor"}</span>
        {deal.expected_close_on ? (
          <span className={cn("text-label", late ? "text-danger" : "text-muted")}>
            {late ? "Atrasado · " : ""}
            {formatDayMonth(deal.expected_close_on)}
          </span>
        ) : null}
      </span>
      <span className="-ml-2 flex flex-wrap items-center">
        <Button
          variant="ghost"
          className="min-h-9 w-9 px-0"
          aria-label={`Voltar ${deal.title} para ${stageIndex > 0 ? STAGE_LABELS[OPEN_STAGES[stageIndex - 1]] : ""}`}
          disabled={pending || stageIndex <= 0}
          onClick={() =>
            run(() => moveDealStage(deal.id, OPEN_STAGES[stageIndex - 1]), "Estágio atualizado.")
          }
        >
          ←
        </Button>
        <Button
          variant="ghost"
          className="min-h-9 w-9 px-0"
          aria-label={`Avançar ${deal.title} para ${stageIndex < OPEN_STAGES.length - 1 ? STAGE_LABELS[OPEN_STAGES[stageIndex + 1]] : ""}`}
          disabled={pending || stageIndex >= OPEN_STAGES.length - 1}
          onClick={() =>
            run(() => moveDealStage(deal.id, OPEN_STAGES[stageIndex + 1]), "Estágio atualizado.")
          }
        >
          →
        </Button>
        <Button
          variant="ghost"
          className="min-h-9 text-secondary"
          disabled={pending}
          onClick={() => setDialog("win")}
        >
          Ganhar
        </Button>
        <Button variant="ghost" className="min-h-9" disabled={pending} onClick={() => setDialog("lose")}>
          Perder
        </Button>
        <Button variant="ghost" className="min-h-9" disabled={pending} onClick={() => setDialog("edit")}>
          Editar
        </Button>
      </span>
      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar negócio">
        {dialog === "edit" ? (
          <DealForm value={deal} clients={clients} onDone={() => setDialog(null)} />
        ) : null}
      </Dialog>
      <Dialog open={dialog === "win"} onClose={() => setDialog(null)} title="Negócio ganho">
        {dialog === "win" ? (
          <WinForm deal={deal} sources={sources} today={today} onDone={() => setDialog(null)} />
        ) : null}
      </Dialog>
      <Dialog
        open={dialog === "lose"}
        onClose={() => setDialog(null)}
        title="Negócio perdido"
        actions={
          <>
            <Button variant="ghost" className="text-danger sm:mr-auto" onClick={() => setDialog("delete")}>
              Excluir em vez disso
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDialog(null);
                run(() => loseDeal(deal.id, reason), "Negócio marcado como perdido.");
              }}
            >
              Marcar como perdido
            </Button>
          </>
        }
      >
        <label className="field">
          <span className="field-label">Motivo (opcional)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Preço, prazo, cliente desistiu…"
            className="input"
          />
        </label>
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Excluir negócio?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialog(null);
                run(() => deleteDeal(deal.id), "Negócio excluído.");
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          <strong>{deal.title}</strong> sai do histórico e da taxa de conversão. Para manter o registro,
          marque como perdido.
        </p>
      </Dialog>
    </li>
  );
}

export function Pipeline({
  deals,
  clients,
  sources,
  today,
}: {
  deals: DealItem[];
  clients: ClientOption[];
  sources: SourceOption[];
  today: string;
}) {
  return (
    <div className="-mx-4 grid snap-x snap-mandatory scroll-px-4 [scrollbar-width:thin] auto-cols-[80%] grid-flow-col gap-6 overflow-x-auto px-4 pb-2 sm:auto-cols-[45%] md:mx-0 md:scroll-px-0 md:auto-cols-auto md:grid-flow-row md:grid-cols-4 md:overflow-visible md:px-0">
      {OPEN_STAGES.map((stage) => {
        const items = deals.filter((d) => d.stage === stage);
        const total = items.reduce((s, d) => s + (d.value_cents ?? 0), 0);
        return (
          <section
            key={stage}
            aria-labelledby={`stage-${stage}`}
            className="flex min-w-0 snap-start flex-col gap-3"
          >
            <div className="flex items-baseline justify-between border-b border-border pb-1.5">
              <h3 id={`stage-${stage}`} className="font-mono text-label uppercase">
                {STAGE_LABELS[stage]} · {items.length}
              </h3>
              <span className="font-mono text-label text-muted tabular-nums">
                {total ? formatBRL(total) : ""}
              </span>
            </div>
            <ul className="flex min-h-16 flex-col gap-2">
              {items.map((d) => (
                <DealCard key={d.id} deal={d} clients={clients} sources={sources} today={today} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function ClosedDeals({ deals }: { deals: DealItem[] }) {
  const { pending, run } = useRunner();
  return (
    <details>
      <summary className="label cursor-pointer list-none py-2 hover:text-danger">
        Fechados · {deals.length}
      </summary>
      <ul className={cn("mt-2 flex flex-col", pending && "opacity-60")}>
        {deals.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-soft py-2"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">
                {d.title} <span className="text-muted">· {d.client}</span>
              </span>
              <span className="label">
                {d.closed_at
                  ? new Date(d.closed_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                  : ""}
                {d.stage === "lost" && d.lost_reason ? ` · ${d.lost_reason}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-2 font-mono text-data tabular-nums">
              {d.value_cents ? formatBRL(d.value_cents) : "—"}
              <Tag tone={d.stage === "won" ? "blue" : "outline"}>{STAGE_LABELS[d.stage]}</Tag>
              {d.stage === "lost" ? (
                <Button
                  variant="ghost"
                  className="min-h-9"
                  disabled={pending}
                  onClick={() => run(() => reopenDeal(d.id), "Negócio reaberto.")}
                >
                  Reabrir
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function NewDealButton({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" disabled={clients.length === 0} onClick={() => setOpen(true)}>
        Novo negócio
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Novo negócio">
        {open ? <DealForm clients={clients} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}

export function NewClientButton({ primary }: { primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={primary ? "primary" : "default"} onClick={() => setOpen(true)}>
        Novo cliente
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Novo cliente">
        {open ? <ClientForm onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}

function ClientRow({
  client,
  clients,
  deals,
  today,
}: {
  client: ClientItem;
  clients: ClientOption[];
  deals: DealOption[];
  today: string;
}) {
  const [dialog, setDialog] = useState<"edit" | "delete" | "remind" | null>(null);
  const { pending, run } = useRunner();
  return (
    <li className={cn("flex flex-col gap-1 border-b border-border-soft py-2", pending && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate">
          {client.name}
          {client.company ? <span className="text-muted"> · {client.company}</span> : null}
        </span>
        <span className={cn("shrink-0 font-mono text-data tabular-nums", client.margin < 0 && "text-danger")}>
          {formatBRL(client.margin, { sign: client.margin !== 0 })}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">
          {client.deals} {client.deals === 1 ? "negócio" : "negócios"}
          {client.openDeals ? ` · ${client.openDeals} em aberto` : ""} · receita {formatBRL(client.revenue)} ·
          custos {formatBRL(client.costs)}
        </span>
        <span className="-mr-2 flex flex-wrap">
          <Button variant="ghost" className="min-h-9" onClick={() => setDialog("remind")}>
            Lembrar de cobrar
          </Button>
          <Button variant="ghost" className="min-h-9" onClick={() => setDialog("edit")}>
            Editar
          </Button>
          <Button variant="ghost" className="min-h-9 text-danger" onClick={() => setDialog("delete")}>
            Excluir
          </Button>
        </span>
      </div>
      {client.email || client.phone ? (
        <span className="font-mono text-label text-muted">
          {[client.email, client.phone].filter(Boolean).join(" · ")}
        </span>
      ) : null}
      <Dialog open={dialog === "remind"} onClose={() => setDialog(null)} title={`Cobrar ${client.name}`}>
        {dialog === "remind" ? (
          <ReminderForm
            clients={clients}
            deals={deals}
            today={today}
            clientId={client.id}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </Dialog>
      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar cliente">
        {dialog === "edit" ? <ClientForm value={client} onDone={() => setDialog(null)} /> : null}
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Excluir cliente?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialog(null);
                run(() => deleteClient(client.id), "Cliente excluído.");
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          <strong>{client.name}</strong> será excluído. Clientes com negócios não podem ser excluídos.
        </p>
      </Dialog>
    </li>
  );
}

export function ClientList({
  clients,
  deals,
  today,
}: {
  clients: ClientItem[];
  deals: DealOption[];
  today: string;
}) {
  const options = clients.map((c) => ({ id: c.id, name: c.name }));
  return (
    <ul className="flex flex-col">
      {clients.map((c) => (
        <ClientRow key={c.id} client={c} clients={options} deals={deals} today={today} />
      ))}
    </ul>
  );
}

function ReminderForm({
  value,
  clients,
  deals,
  today,
  clientId,
  onDone,
}: {
  value?: ReminderItem;
  clients: ClientOption[];
  deals: DealOption[];
  today: string;
  clientId?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveReminder, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  const [client, setClient] = useState(
    state.values?.client_id ?? value?.client_id ?? clientId ?? (clients.length === 1 ? clients[0].id : ""),
  );
  const clientDeals = deals.filter((d) => d.client_id === client);
  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={value?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" error={e.client_id}>
          {(a) => (
            <Select {...a} name="client_id" value={client} onChange={(ev) => setClient(ev.target.value)}>
              <option value="" disabled>
                Escolha o cliente
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Negócio" error={e.deal_id} hint="Opcional">
          {(a) => (
            <Select {...a} key={client} name="deal_id" defaultValue={v("deal_id", value?.deal_id ?? "")}>
              <option value="">Nenhum</option>
              {clientDeals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Cobrar em" error={e.remind_on} hint="O e-mail chega às 9h desse dia">
          {(a) => (
            <Input
              {...a}
              name="remind_on"
              type="date"
              defaultValue={v("remind_on", value?.remind_on ?? today)}
            />
          )}
        </Field>
        <Field label="Valor (R$)" error={e.amount_cents} hint="Opcional">
          {(a) => (
            <Input
              {...a}
              name="amount_cents"
              inputMode="decimal"
              defaultValue={v("amount_cents", value?.amount_cents ? formatBRL(value.amount_cents) : "")}
            />
          )}
        </Field>
        <Field label="Repetir" error={e.recurrence}>
          {(a) => (
            <Select {...a} name="recurrence" defaultValue={v("recurrence", value?.recurrence ?? "once")}>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Observação" error={e.note}>
        {(a) => (
          <Input
            {...a}
            name="note"
            defaultValue={v("note", value?.note ?? "")}
            placeholder="Parcela 2 de 3, manutenção mensal…"
          />
        )}
      </Field>
      <FormActions onCancel={onDone} pending={pending} label={value ? "Salvar" : "Criar lembrete"} />
    </form>
  );
}

function PaidForm({
  reminder,
  sources,
  today,
  onDone,
}: {
  reminder: ReminderItem;
  sources: SourceOption[];
  today: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(markReminderPaid, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const canLaunch = reminder.amount_cents !== null;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={reminder.id} />
      <p>
        <strong>{reminder.client}</strong>
        {reminder.deal ? ` · ${reminder.deal}` : ""}
        {reminder.amount_cents ? ` · ${formatBRL(reminder.amount_cents)}` : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {canLaunch ? (
          <Field label="Lançar ganho em" error={e.source_id} hint="Fonte de renda variável">
            {(a) => (
              <Select {...a} name="source_id" defaultValue="">
                <option value="">Não lançar</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <input type="hidden" name="source_id" value="" />
        )}
        <Field label="Recebido em" error={e.received_on}>
          {(a) => <Input {...a} name="received_on" type="date" defaultValue={today} />}
        </Field>
      </div>
      <p className="label">
        {reminder.recurrence === "monthly"
          ? "O lembrete continua e passa para o mês seguinte."
          : "O lembrete sai da lista."}
      </p>
      <FormActions onCancel={onDone} pending={pending} label="Marcar como cobrado" />
    </form>
  );
}

function ReminderRow({
  reminder,
  clients,
  deals,
  sources,
  today,
}: {
  reminder: ReminderItem;
  clients: ClientOption[];
  deals: DealOption[];
  sources: SourceOption[];
  today: string;
}) {
  const [dialog, setDialog] = useState<"paid" | "edit" | "delete" | null>(null);
  const { pending, run } = useRunner();
  const status = reminderStatus(reminder.remind_on, today);
  return (
    <li className={cn("flex flex-col gap-1.5 border-b border-border-soft py-2.5", pending && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">
          {reminder.client}
          {reminder.deal ? <span className="text-muted"> · {reminder.deal}</span> : null}
        </span>
        <span className="shrink-0 font-mono text-data tabular-nums">
          {reminder.amount_cents ? formatBRL(reminder.amount_cents) : "—"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === "late" ? <Tag>Atrasado</Tag> : null}
        {status === "today" ? <Tag>Hoje</Tag> : null}
        <span
          className={cn(
            "font-mono text-label tabular-nums",
            status === "late" ? "text-danger" : "text-muted",
          )}
        >
          {formatDateFull(reminder.remind_on)}
          {reminder.recurrence === "monthly" ? " · todo mês" : ""}
          {reminder.note ? ` · ${reminder.note}` : ""}
        </span>
      </div>
      <span className="-ml-2 flex flex-wrap">
        <Button variant="ghost" className="min-h-9 text-secondary" onClick={() => setDialog("paid")}>
          Cobrado
        </Button>
        <Button variant="ghost" className="min-h-9" onClick={() => setDialog("edit")}>
          Editar
        </Button>
        <Button variant="ghost" className="min-h-9 text-danger" onClick={() => setDialog("delete")}>
          Excluir
        </Button>
      </span>
      <Dialog open={dialog === "paid"} onClose={() => setDialog(null)} title="Marcar como cobrado">
        {dialog === "paid" ? (
          <PaidForm reminder={reminder} sources={sources} today={today} onDone={() => setDialog(null)} />
        ) : null}
      </Dialog>
      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar cobrança">
        {dialog === "edit" ? (
          <ReminderForm
            value={reminder}
            clients={clients}
            deals={deals}
            today={today}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Excluir cobrança?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialog(null);
                run(() => deleteReminder(reminder.id), "Cobrança excluída.");
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          O lembrete de <strong>{reminder.client}</strong> deixa de existir
          {reminder.recurrence === "monthly" ? " e os próximos meses não serão lembrados" : ""}.
        </p>
      </Dialog>
    </li>
  );
}

export function ReminderList({
  reminders,
  clients,
  deals,
  sources,
  today,
}: {
  reminders: ReminderItem[];
  clients: ClientOption[];
  deals: DealOption[];
  sources: SourceOption[];
  today: string;
}) {
  return (
    <ul className="flex flex-col">
      {reminders.map((r) => (
        <ReminderRow
          key={r.id}
          reminder={r}
          clients={clients}
          deals={deals}
          sources={sources}
          today={today}
        />
      ))}
    </ul>
  );
}

export function NewReminderButton({
  clients,
  deals,
  today,
}: {
  clients: ClientOption[];
  deals: DealOption[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button disabled={clients.length === 0} onClick={() => setOpen(true)}>
        Nova cobrança
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Lembrar de cobrar">
        {open ? (
          <ReminderForm clients={clients} deals={deals} today={today} onDone={() => setOpen(false)} />
        ) : null}
      </Dialog>
    </>
  );
}
