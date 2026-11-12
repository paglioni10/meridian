"use client";

import { useActionState, useEffect, useEffectEvent, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Progress, Tag } from "@/components/ui/display";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  addContribution,
  addMilestone,
  deleteContribution,
  deleteGoal,
  deleteMilestone,
  moveGoal,
  saveGoal,
  setGoalStatus,
  toggleMilestone,
  type ActionState,
} from "@/features/goals/actions";
import {
  CONTEXT_KINDS,
  CUSTOM_HORIZON,
  describeDistance,
  horizonForDate,
  HORIZONS,
  HORIZON_HINTS,
  HORIZON_LABELS,
  type ContextKind,
  type GoalHorizon,
  type GoalStatus,
} from "@/features/goals/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatDayMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

const initial: ActionState = { status: "idle", message: "" };

export type Milestone = { id: string; title: string; done: boolean };
export type Contribution = { id: string; amount_cents: number; contributed_on: string; note: string | null };

export type GoalItem = {
  id: string;
  title: string;
  description: string | null;
  context: ContextKind;
  horizon: GoalHorizon;
  status: GoalStatus;
  target_cents: number | null;
  target_date: string | null;
  saved_cents: number;
  pct: number;
  months_left: number | null;
  monthly_needed_cents: number | null;
  is_late: boolean;
  milestones: Milestone[];
  contributions: Contribution[];
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
  const run = (task: () => Promise<void>, success?: string) =>
    startTransition(async () => {
      try {
        await task();
        if (success) toast(success);
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  return { pending, run };
}

function GoalForm({
  goal,
  defaultHorizon,
  defaultContext,
  onDone,
}: {
  goal?: GoalItem;
  defaultHorizon: GoalHorizon;
  defaultContext: ContextKind;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveGoal, initial);
  useResult(state, onDone);
  const e = state.fieldErrors ?? {};
  const v = (k: string, f: string) => state.values?.[k] ?? f;
  const initialChoice = goal
    ? goal.target_date && horizonForDate(goal.target_date) === goal.horizon
      ? CUSTOM_HORIZON
      : goal.horizon
    : defaultHorizon === "short"
      ? CUSTOM_HORIZON
      : defaultHorizon;
  const [choice, setChoice] = useState<string>(v("horizon", initialChoice));
  const [targetDate, setTargetDate] = useState<string>(v("target_date", goal?.target_date ?? ""));
  const derived = targetDate ? horizonForDate(targetDate) : null;
  const custom = choice === CUSTOM_HORIZON;
  const dateHint = custom
    ? derived
      ? `Entra em ${HORIZON_LABELS[derived]} · ${describeDistance(targetDate)}`
      : "Obrigatória no prazo personalizado"
    : derived && derived !== choice
      ? `Pela data, seria ${HORIZON_LABELS[derived]}; vale o prazo escolhido`
      : "Opcional; calcula o aporte mensal";

  return (
    <form
      key={state.values ? JSON.stringify(state.values) : "i"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="id" value={goal?.id ?? ""} />
      <Field label="Objetivo" error={e.title}>
        {(a) => (
          <Input
            {...a}
            name="title"
            defaultValue={v("title", goal?.title ?? "")}
            placeholder="Notebook novo"
            autoFocus
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prazo" error={e.horizon}>
          {(a) => (
            <Select {...a} name="horizon" value={choice} onChange={(ev) => setChoice(ev.target.value)}>
              <option value={CUSTOM_HORIZON}>Personalizado · por data</option>
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {HORIZON_LABELS[h]} · {HORIZON_HINTS[h].toLowerCase()}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Contexto" error={e.context}>
          {(a) => (
            <Select {...a} name="context" defaultValue={v("context", goal?.context ?? defaultContext)}>
              {CONTEXT_KINDS.map((c) => (
                <option key={c} value={c}>
                  {CONTEXT_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Valor a juntar (R$)"
          error={e.target_cents}
          hint="Opcional; sem valor, o progresso vem dos marcos"
        >
          {(a) => (
            <Input
              {...a}
              name="target_cents"
              inputMode="decimal"
              defaultValue={v("target_cents", goal?.target_cents ? formatBRL(goal.target_cents) : "")}
              placeholder="750,00"
            />
          )}
        </Field>
        <Field label={custom ? "Data do prazo" : "Data-alvo"} error={e.target_date} hint={dateHint}>
          {(a) => (
            <Input
              {...a}
              name="target_date"
              type="date"
              value={targetDate}
              onChange={(ev) => setTargetDate(ev.target.value)}
              required={custom}
            />
          )}
        </Field>
      </div>
      <Field label="Descrição" error={e.description}>
        {(a) => <Input {...a} name="description" defaultValue={v("description", goal?.description ?? "")} />}
      </Field>
      {!goal ? (
        <Field label="Marcos" error={e.milestones} hint="Um por linha, opcional">
          {(a) => (
            <Textarea
              {...a}
              name="milestones"
              defaultValue={v("milestones", "")}
              placeholder={"Pesquisar modelos\nJuntar 50%\nComprar"}
            />
          )}
        </Field>
      ) : (
        <input type="hidden" name="milestones" value="" />
      )}
      <div className="modal-actions">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando" : goal ? "Salvar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}

export function NewGoalButton({ defaultContext }: { defaultContext: ContextKind }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Novo objetivo
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Novo objetivo">
        {open ? (
          <GoalForm defaultHorizon="short" defaultContext={defaultContext} onDone={() => setOpen(false)} />
        ) : null}
      </Dialog>
    </>
  );
}

function ContributionForm({
  goal,
  direction,
  today,
  onDone,
}: {
  goal: GoalItem;
  direction: "deposit" | "withdraw";
  today: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(addContribution, initial);
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
      <input type="hidden" name="goal_id" value={goal.id} />
      <input type="hidden" name="direction" value={direction} />
      <p className="label">
        Guardado: {formatBRL(goal.saved_cents)}
        {goal.target_cents ? ` de ${formatBRL(goal.target_cents)}` : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={direction === "withdraw" ? "Valor a retirar (R$)" : "Valor do aporte (R$)"}
          error={e.amount_cents}
        >
          {(a) => (
            <Input
              {...a}
              name="amount_cents"
              inputMode="decimal"
              defaultValue={v(
                "amount_cents",
                direction === "deposit" && goal.monthly_needed_cents
                  ? formatBRL(goal.monthly_needed_cents)
                  : "",
              )}
              autoFocus
            />
          )}
        </Field>
        <Field label="Data" error={e.contributed_on}>
          {(a) => (
            <Input {...a} name="contributed_on" type="date" defaultValue={v("contributed_on", today)} />
          )}
        </Field>
      </div>
      <Field label="Observação" error={e.note} hint="Opcional">
        {(a) => <Input {...a} name="note" defaultValue={v("note", "")} />}
      </Field>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant={direction === "withdraw" ? "danger" : "primary"} disabled={pending}>
          {pending ? "Salvando" : direction === "withdraw" ? "Retirar" : "Aportar"}
        </Button>
      </div>
    </form>
  );
}

function nodeClass(goal: GoalItem) {
  if (goal.status === "achieved") return "bg-foreground border-border";
  if (goal.is_late) return "bg-danger border-danger";
  if (goal.pct > 0) return "bg-secondary border-secondary";
  return "bg-background border-border";
}

function GoalCard({
  goal,
  today,
  first,
  last,
}: {
  goal: GoalItem;
  today: string;
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState<"deposit" | "withdraw" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const { pending, run } = useRunner();
  const done = goal.status === "achieved";
  const reached = goal.target_cents !== null ? goal.saved_cents >= goal.target_cents : goal.pct >= 100;
  const tone = goal.is_late ? "alert" : done ? "ink" : goal.pct > 0 ? "active" : "ink";

  function submitMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newMilestone.trim();
    if (!title) return;
    run(async () => {
      await addMilestone(goal.id, title);
      setNewMilestone("");
    });
  }

  const meta = [
    goal.target_date ? `Até ${formatDayMonth(goal.target_date)}/${goal.target_date.slice(2, 4)}` : "Sem data",
    goal.months_left ? `${goal.months_left} ${goal.months_left === 1 ? "mês" : "meses"}` : null,
    goal.monthly_needed_cents ? `${formatBRL(goal.monthly_needed_cents)}/mês` : null,
    CONTEXT_LABELS[goal.context],
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("relative flex flex-col gap-2 pb-8 pl-6 last:pb-2", pending && "opacity-60")}>
      <span
        aria-hidden
        className={cn("absolute top-1.5 -left-[6px] h-[11px] w-[11px] border", nodeClass(goal))}
      />
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("text-body font-medium", done && "text-muted")}>{goal.title}</h3>
        <span className="flex shrink-0 gap-1">
          {goal.is_late ? <Tag>Atrasado</Tag> : null}
          {goal.status === "paused" ? <Tag tone="outline">Pausado</Tag> : null}
          {done ? <Tag tone="ink">Concluído</Tag> : null}
        </span>
      </div>
      {goal.description ? <p className="text-muted">{goal.description}</p> : null}

      <div className="flex items-baseline justify-between gap-3 font-mono text-data tabular-nums">
        <span>
          {goal.target_cents !== null ? (
            <>
              {formatBRL(goal.saved_cents)}{" "}
              <span className="text-muted">de {formatBRL(goal.target_cents)}</span>
            </>
          ) : (
            <span className="text-muted">
              {goal.milestones.filter((m) => m.done).length} de {goal.milestones.length} marcos
            </span>
          )}
        </span>
        <span>{goal.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
      </div>
      <Progress value={goal.pct} tone={tone} label={`Progresso de ${goal.title}`} />
      <span className="label">{meta}</span>
      {goal.target_cents !== null && goal.saved_cents > goal.target_cents ? (
        <span className="label">Superado em {formatBRL(goal.saved_cents - goal.target_cents)}</span>
      ) : null}

      {goal.milestones.length > 0 || !done ? (
        <ul className="flex flex-col">
          {goal.milestones.map((m) => (
            <li
              key={m.id}
              className="group flex items-center justify-between gap-2 border-b border-border-soft"
            >
              <label className="flex min-h-tap flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={m.done}
                  disabled={pending}
                  onChange={(ev) => run(() => toggleMilestone(m.id, ev.target.checked))}
                  className="h-5 w-5 shrink-0 accent-[var(--ink)]"
                />
                <span className={cn("font-mono text-data", m.done && "text-muted line-through")}>
                  {m.title}
                </span>
              </label>
              <button
                type="button"
                aria-label={`Excluir marco ${m.title}`}
                disabled={pending}
                onClick={() => run(() => deleteMilestone(m.id))}
                className="label min-h-tap px-2 opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100 touch:opacity-100"
              >
                Excluir
              </button>
            </li>
          ))}
          {!done ? (
            <li>
              <form onSubmit={submitMilestone} className="flex items-end gap-2">
                <input
                  value={newMilestone}
                  onChange={(ev) => setNewMilestone(ev.target.value)}
                  aria-label={`Novo marco em ${goal.title}`}
                  placeholder="Novo marco"
                  maxLength={80}
                  className="input"
                />
                <Button type="submit" variant="ghost" disabled={pending || !newMilestone.trim()}>
                  Adicionar
                </Button>
              </form>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="-ml-2 flex flex-wrap items-center">
        {!done ? (
          <>
            <Button
              variant="ghost"
              className="min-h-9"
              disabled={pending}
              onClick={() => setMoving("deposit")}
            >
              Aportar
            </Button>
            {goal.saved_cents > 0 ? (
              <Button
                variant="ghost"
                className="min-h-9"
                disabled={pending}
                onClick={() => setMoving("withdraw")}
              >
                Retirar
              </Button>
            ) : null}
            {reached ? (
              <Button
                variant="ghost"
                className="min-h-9 text-secondary"
                disabled={pending}
                onClick={() => run(() => setGoalStatus(goal.id, "achieved"), `${goal.title}: concluído.`)}
              >
                Concluir
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            variant="ghost"
            className="min-h-9"
            disabled={pending}
            onClick={() => run(() => setGoalStatus(goal.id, "active"), "Objetivo reaberto.")}
          >
            Reabrir
          </Button>
        )}
        <Button variant="ghost" className="min-h-9" disabled={pending} onClick={() => setEditing(true)}>
          Editar
        </Button>
        {goal.status === "active" ? (
          <Button
            variant="ghost"
            className="min-h-9"
            disabled={pending}
            onClick={() => run(() => setGoalStatus(goal.id, "paused"), "Objetivo pausado.")}
          >
            Pausar
          </Button>
        ) : null}
        {goal.status === "paused" ? (
          <Button
            variant="ghost"
            className="min-h-9"
            disabled={pending}
            onClick={() => run(() => setGoalStatus(goal.id, "active"), "Objetivo retomado.")}
          >
            Retomar
          </Button>
        ) : null}
        {!done && goal.status !== "archived" ? (
          <>
            <Button
              variant="ghost"
              className="min-h-9 w-9 px-0"
              aria-label={`Subir ${goal.title}`}
              disabled={pending || first}
              onClick={() => run(() => moveGoal(goal.id, "up"))}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              className="min-h-9 w-9 px-0"
              aria-label={`Descer ${goal.title}`}
              disabled={pending || last}
              onClick={() => run(() => moveGoal(goal.id, "down"))}
            >
              ↓
            </Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          className="min-h-9 text-danger"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          Excluir
        </Button>
      </div>

      {goal.contributions.length > 0 ? (
        <details className="group/history">
          <summary className="label cursor-pointer list-none hover:text-danger">
            Histórico · {goal.contributions.length}{" "}
            {goal.contributions.length === 1 ? "movimento" : "movimentos"}
          </summary>
          <ul className="mt-2 flex flex-col">
            {goal.contributions.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline justify-between gap-3 border-b border-border-soft py-1 font-mono text-data"
              >
                <span className="flex min-w-0 gap-3">
                  <span className="text-muted tabular-nums">{formatDayMonth(c.contributed_on)}</span>
                  <span className="truncate">{c.note ?? (c.amount_cents > 0 ? "Aporte" : "Retirada")}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular-nums">{formatBRL(c.amount_cents, { sign: true })}</span>
                  <button
                    type="button"
                    aria-label="Excluir movimento"
                    disabled={pending}
                    onClick={() => run(() => deleteContribution(c.id), "Movimento excluído.")}
                    className="label hover:text-danger"
                  >
                    Excluir
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar objetivo">
        {editing ? (
          <GoalForm
            goal={goal}
            defaultHorizon={goal.horizon}
            defaultContext={goal.context}
            onDone={() => setEditing(false)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={moving !== null}
        onClose={() => setMoving(null)}
        title={moving === "withdraw" ? `Retirar de ${goal.title}` : `Aportar em ${goal.title}`}
      >
        {moving ? (
          <ContributionForm goal={goal} direction={moving} today={today} onDone={() => setMoving(null)} />
        ) : null}
      </Dialog>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Excluir objetivo?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                run(() => deleteGoal(goal.id), "Objetivo excluído.");
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          <strong>{goal.title}</strong> será excluído com seus marcos e o histórico de aportes. Para guardar o
          registro, prefira concluir ou pausar.
        </p>
      </Dialog>
    </li>
  );
}

export function GoalTrail({
  horizon,
  goals,
  today,
}: {
  horizon: GoalHorizon;
  goals: GoalItem[];
  today: string;
}) {
  return (
    <section aria-labelledby={`trail-${horizon}`} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
        <h2 id={`trail-${horizon}`} className="font-display text-h2 font-extrabold">
          {HORIZON_LABELS[horizon]}
        </h2>
        <span className="label">{HORIZON_HINTS[horizon]}</span>
      </div>
      {goals.length === 0 ? (
        <p className="text-muted">Nenhum objetivo neste prazo.</p>
      ) : (
        <ol className="ml-[5px] flex flex-col border-l border-border">
          {goals.map((goal, i) => (
            <GoalCard key={goal.id} goal={goal} today={today} first={i === 0} last={i === goals.length - 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

export function ClosedGoals({ goals, today }: { goals: GoalItem[]; today: string }) {
  return (
    <details>
      <summary className="label cursor-pointer list-none py-2 hover:text-danger">
        Concluídos e arquivados · {goals.length}
      </summary>
      <ol className="mt-4 ml-[5px] flex flex-col border-l border-border">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} today={today} first last />
        ))}
      </ol>
    </details>
  );
}
