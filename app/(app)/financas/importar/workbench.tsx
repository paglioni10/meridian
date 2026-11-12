"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Tag } from "@/components/ui/display";
import { useToast } from "@/components/ui/toast";
import type { RowAction } from "@/features/expenses/classify";
import {
  commitStatement,
  previewStatement,
  type PreviewResult,
  type PreviewRow,
} from "@/features/expenses/import-actions";
import { CONTEXT_KINDS, FORMAT_LABELS, type ContextKind } from "@/features/expenses/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatDayMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

type Option = { id: string; name: string };
type Preview = Extract<PreviewResult, { status: "ok" }>;
type View = "todas" | "novas" | "duplicadas" | "ignoradas";

const VIEWS = [
  { value: "todas", label: "Todas" },
  { value: "novas", label: "Novas" },
  { value: "duplicadas", label: "Duplicadas" },
  { value: "ignoradas", label: "Ignoradas" },
] as const;

const ACTION_LABELS: Record<RowAction, string> = { expense: "Despesa", income: "Ganho", ignore: "Ignorar" };

export function ImportWorkbench({
  categories,
  incomeSources,
  defaultContext,
}: {
  categories: Option[];
  incomeSources: Option[];
  defaultContext: ContextKind;
}) {
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("todas");
  const [context, setContext] = useState<ContextKind>(defaultContext);
  const [incomeSourceId, setIncomeSourceId] = useState<string>(incomeSources[0]?.id ?? "");
  const [inputKey, setInputKey] = useState(0);
  const [analyzing, startAnalyze] = useTransition();
  const [committing, startCommit] = useTransition();

  const counts = useMemo(() => {
    const live = rows.filter((r) => !r.duplicate);
    return {
      expense: live.filter((r) => r.action === "expense").length,
      income: live.filter((r) => r.action === "income").length,
      ignore: live.filter((r) => r.action === "ignore").length,
      duplicate: rows.length - live.length,
      expenseTotal: live.filter((r) => r.action === "expense").reduce((s, r) => s - r.amountCents, 0),
    };
  }, [rows]);

  const visible = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) =>
      view === "todas"
        ? true
        : view === "duplicadas"
          ? row.duplicate
          : view === "ignoradas"
            ? !row.duplicate && row.action === "ignore"
            : !row.duplicate && row.action !== "ignore",
    );

  function analyze(formData: FormData) {
    setError(null);
    startAnalyze(async () => {
      const result = await previewStatement(formData);
      if (result.status === "error") {
        setError(result.message);
        setPreview(null);
        setRows([]);
        return;
      }
      setPreview(result);
      setRows(result.rows);
      setView("todas");
    });
  }

  function update(index: number, patch: Partial<PreviewRow>) {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function reset() {
    setPreview(null);
    setRows([]);
    setInputKey((k) => k + 1);
  }

  function commit() {
    if (!preview) return;
    startCommit(async () => {
      const result = await commitStatement({
        fileHash: preview.fileHash,
        filename: preview.filename,
        format: preview.format,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        context,
        incomeSourceId: counts.income > 0 ? incomeSourceId || null : null,
        rows: rows
          .filter((r) => !r.duplicate)
          .map((r) => ({
            date: r.date,
            amountCents: r.amountCents,
            description: r.description,
            externalId: r.externalId,
            ordinal: r.ordinal,
            hash: r.hash,
            action: r.action,
            categoryId: r.action === "expense" ? r.categoryId : null,
            recurringId: r.action === "expense" ? r.recurringId : null,
            nature: r.nature,
          })),
      });
      if (result.status === "error") {
        toast(result.message, "alert");
        return;
      }
      toast(
        `Importado: ${result.expenses} despesas, ${result.incomes} ganhos` +
          (result.skipped ? `, ${result.skipped} já existentes.` : "."),
      );
      reset();
    });
  }

  const pendingCount = counts.expense + counts.income;

  return (
    <div className="flex flex-col gap-6">
      <form action={analyze} className="flex flex-col gap-3">
        <label htmlFor="statement-file" className="field-label">
          Extrato do Nubank (OFX ou CSV, até 2 MB)
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            key={inputKey}
            id="statement-file"
            name="file"
            type="file"
            accept=".ofx,.csv,text/csv,application/x-ofx"
            required
            className="input cursor-pointer py-2 file:mr-3 file:border file:border-border file:bg-transparent file:px-3 file:py-1 file:font-mono file:text-[12px] file:uppercase"
          />
          <Button type="submit" variant="primary" disabled={analyzing}>
            {analyzing ? "Analisando" : "Analisar"}
          </Button>
        </div>
        <p className="label">
          App do Nubank → Conta ou Cartão → Exportar extrato. O arquivo é lido no servidor e não fica
          guardado.
        </p>
        {error ? (
          <p role="alert" className="field-error">
            {error}
          </p>
        ) : null}
      </form>

      {preview ? (
        <section className="flex flex-col gap-4" aria-label="Prévia da importação">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-1.5">
            <h2 className="font-display text-h2 font-extrabold">Prévia</h2>
            <span className="label">
              {FORMAT_LABELS[preview.format]} · {preview.kind === "card" ? "Cartão" : "Conta"} ·{" "}
              {preview.periodStart ? formatDayMonth(preview.periodStart) : "—"} a{" "}
              {preview.periodEnd ? formatDayMonth(preview.periodEnd) : "—"}
              {preview.invalidLines ? ` · ${preview.invalidLines} linhas ilegíveis ignoradas` : ""}
            </span>
          </div>

          <div className="stats-grid">
            <div className="stat">
              <span className="label">Despesas novas</span>
              <span className="figure">{counts.expense}</span>
              <span className="label">{formatBRL(counts.expenseTotal)}</span>
            </div>
            <div className="stat">
              <span className="label">Ganhos</span>
              <span className="figure">{counts.income}</span>
            </div>
            <div className="stat">
              <span className="label">Ignoradas</span>
              <span className="figure">{counts.ignore}</span>
            </div>
            <div className="stat">
              <span className="label">Já importadas</span>
              <span className="figure">{counts.duplicate}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="field-label">Contexto das despesas</span>
              <Select value={context} onChange={(e) => setContext(e.target.value as ContextKind)}>
                {CONTEXT_KINDS.map((c) => (
                  <option key={c} value={c}>
                    {CONTEXT_LABELS[c]}
                  </option>
                ))}
              </Select>
            </label>
            {counts.income > 0 ? (
              <label className="field">
                <span className="field-label">Fonte de renda dos créditos</span>
                <Select value={incomeSourceId} onChange={(e) => setIncomeSourceId(e.target.value)}>
                  {incomeSources.length === 0 ? <option value="">Cadastre uma fonte em Ganhos</option> : null}
                  {incomeSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
          </div>

          <Segmented
            label="Filtrar linhas"
            options={VIEWS}
            value={view}
            onChange={(v) => setView(v)}
            className="w-full md:w-auto"
          />

          <ul className="flex flex-col">
            {visible.map(({ row, index }) => {
              const isCredit = row.amountCents > 0;
              const actions: RowAction[] = isCredit ? ["income", "ignore"] : ["expense", "ignore"];
              return (
                <li
                  key={row.hash}
                  className={cn(
                    "flex flex-col gap-2 border-b border-border-soft py-2",
                    (row.duplicate || row.action === "ignore") && "text-muted",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3 font-mono text-data">
                    <span className="flex min-w-0 items-baseline gap-3">
                      <span className="w-11 shrink-0 tabular-nums">{formatDayMonth(row.date)}</span>
                      <span className="truncate">{row.description}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatBRL(row.amountCents, { sign: true })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-14">
                    {row.duplicate ? (
                      <Tag tone="outline">Já importada</Tag>
                    ) : (
                      <>
                        <select
                          aria-label={`Ação para ${row.description}`}
                          value={row.action}
                          onChange={(e) => update(index, { action: e.target.value as RowAction })}
                          className="min-h-9 border border-border bg-transparent px-2 font-mono text-[12px] uppercase"
                        >
                          {actions.map((a) => (
                            <option key={a} value={a}>
                              {ACTION_LABELS[a]}
                            </option>
                          ))}
                        </select>
                        {row.action === "expense" ? (
                          <select
                            aria-label={`Categoria de ${row.description}`}
                            value={row.categoryId ?? ""}
                            onChange={(e) => update(index, { categoryId: e.target.value || null })}
                            className="min-h-9 max-w-48 border border-border bg-transparent px-2 font-mono text-[12px]"
                          >
                            <option value="">Sem categoria</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {row.action === "expense" && row.recurringId ? <Tag tone="ink">Fixa</Tag> : null}
                        {row.reason ? <span className="label">{row.reason}</span> : null}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={reset} disabled={committing}>
              Descartar
            </Button>
            <Button
              variant="primary"
              onClick={commit}
              disabled={committing || pendingCount === 0 || (counts.income > 0 && !incomeSourceId)}
            >
              {committing
                ? "Importando"
                : `Importar ${pendingCount} ${pendingCount === 1 ? "linha" : "linhas"}`}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
