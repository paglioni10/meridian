"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Money, Tag } from "@/components/ui/display";
import { useToast } from "@/components/ui/toast";
import { deleteIncome, deleteSource, launchFromSource } from "@/features/income/actions";
import { KIND_LABELS, type ContextKind, type IncomeKind } from "@/features/income/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatDayMonth, formatMonthLong } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { IncomeDialog, SourceDialog, type SourceOption } from "./forms";

export type SourceItem = {
  id: string;
  name: string;
  kind: IncomeKind;
  context: ContextKind;
  default_amount_cents: number | null;
  payday: number | null;
  active: boolean;
  launchedThisMonth: boolean;
};

export type IncomeItem = {
  id: string;
  source_id: string;
  source: string;
  kind: IncomeKind;
  context: ContextKind;
  competence_month: string;
  received_on: string | null;
  amount_cents: number;
  gross_cents: number | null;
  description: string | null;
};

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

function ConfirmDialog({
  open,
  title,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Excluir
          </Button>
        </>
      }
    >
      <p>{children}</p>
    </Dialog>
  );
}

function SourceRow({ source, showContext }: { source: SourceItem; showContext: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { pending, run } = useRunner();
  const meta = [
    source.default_amount_cents ? `Padrão ${formatBRL(source.default_amount_cents)}` : "Sem valor padrão",
    source.payday ? `Dia ${source.payday}` : null,
    showContext ? CONTEXT_LABELS[source.context] : null,
    source.active ? null : "Inativa",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("flex flex-col gap-2 border-b border-border-soft py-3", pending && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={cn("font-medium", !source.active && "text-muted")}>{source.name}</span>
          <span className="label">{meta}</span>
        </div>
        <Tag tone={source.kind === "guaranteed" ? "ink" : "outline"}>{KIND_LABELS[source.kind]}</Tag>
      </div>
      <div className="-mr-2 flex flex-wrap items-center justify-end">
        {source.active ? (
          source.launchedThisMonth ? (
            <span className="label px-2">Lançado neste mês</span>
          ) : (
            <Button
              variant="ghost"
              disabled={pending || !source.default_amount_cents}
              title={source.default_amount_cents ? undefined : "Defina um valor padrão para lançar"}
              onClick={() => run(() => launchFromSource(source.id), `${source.name}: mês lançado.`)}
            >
              Lançar mês
            </Button>
          )
        ) : null}
        <Button variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          Excluir
        </Button>
      </div>
      <SourceDialog
        open={editing}
        onClose={() => setEditing(false)}
        values={{
          id: source.id,
          name: source.name,
          kind: source.kind,
          context: source.context,
          default_amount: source.default_amount_cents ? formatBRL(source.default_amount_cents) : "",
          payday: source.payday?.toString() ?? "",
          active: source.active,
        }}
      />
      <ConfirmDialog
        open={confirming}
        title="Excluir fonte?"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          run(() => deleteSource(source.id), "Fonte excluída.");
        }}
      >
        <strong>{source.name}</strong> será excluída. Fontes com lançamentos não podem ser excluídas;
        desative-as em Editar.
      </ConfirmDialog>
    </li>
  );
}

export function SourceList({ sources, showContext }: { sources: SourceItem[]; showContext: boolean }) {
  return (
    <ul className="flex flex-col">
      {sources.map((s) => (
        <SourceRow key={s.id} source={s} showContext={showContext} />
      ))}
    </ul>
  );
}

function IncomeRowItem({
  income,
  sources,
  showContext,
}: {
  income: IncomeItem;
  sources: SourceOption[];
  showContext: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { pending, run } = useRunner();
  const meta = [
    KIND_LABELS[income.kind],
    showContext ? CONTEXT_LABELS[income.context] : null,
    income.gross_cents ? `Bruto ${formatBRL(income.gross_cents)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("flex flex-col gap-1 border-b border-border-soft py-2", pending && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3 font-mono text-data">
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="w-11 shrink-0 text-muted tabular-nums">
            {income.received_on ? formatDayMonth(income.received_on) : "—"}
          </span>
          <span className="truncate">
            {income.source}
            {income.description ? ` · ${income.description}` : ""}
          </span>
        </span>
        <Money cents={income.amount_cents} sign className="shrink-0" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pl-14">
        <span className="label">{meta}</span>
        <span className="-mr-2 flex">
          <Button variant="ghost" className="min-h-9" disabled={pending} onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            className="min-h-9 text-danger"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Excluir
          </Button>
        </span>
      </div>
      <IncomeDialog
        open={editing}
        onClose={() => setEditing(false)}
        sources={sources}
        values={{
          id: income.id,
          source_id: income.source_id,
          competence_month: income.competence_month.slice(0, 7),
          received_on: income.received_on ?? "",
          amount: formatBRL(income.amount_cents),
          gross: income.gross_cents ? formatBRL(income.gross_cents) : "",
          description: income.description ?? "",
        }}
      />
      <ConfirmDialog
        open={confirming}
        title="Excluir ganho?"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          run(() => deleteIncome(income.id), "Ganho excluído.");
        }}
      >
        {income.source} · {formatBRL(income.amount_cents)} em {formatMonthLong(income.competence_month)} será
        excluído. Esta ação não pode ser desfeita.
      </ConfirmDialog>
    </li>
  );
}

export function IncomeList({
  incomes,
  sources,
  showContext,
}: {
  incomes: IncomeItem[];
  sources: SourceOption[];
  showContext: boolean;
}) {
  const months = new Map<string, IncomeItem[]>();
  for (const income of incomes) {
    months.set(income.competence_month, [...(months.get(income.competence_month) ?? []), income]);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...months.entries()].map(([month, items]) => (
        <section key={month} className="flex flex-col">
          <div className="flex items-baseline justify-between border-b border-border pb-1.5">
            <h3 className="font-mono text-label uppercase">{formatMonthLong(month)}</h3>
            <span className="font-mono text-data tabular-nums">
              {formatBRL(items.reduce((sum, i) => sum + i.amount_cents, 0))}
            </span>
          </div>
          <ul className="flex flex-col">
            {items.map((income) => (
              <IncomeRowItem key={income.id} income={income} sources={sources} showContext={showContext} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
