"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { undoImport } from "@/features/expenses/import-actions";
import { FORMAT_LABELS, type ImportFormat } from "@/features/expenses/schema";
import { cn } from "@/lib/cn";
import { formatDayMonth } from "@/lib/dates";

export type BatchItem = {
  id: string;
  format: ImportFormat;
  filename: string;
  period_start: string | null;
  period_end: string | null;
  inserted_rows: number;
  income_rows: number;
  skipped_rows: number;
  created_at: string;
};

function BatchRow({ batch }: { batch: BatchItem }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const created = new Date(batch.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <li className={cn("flex flex-col gap-1 border-b border-border-soft py-2", pending && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3 font-mono text-data">
        <span className="truncate">{batch.filename}</span>
        <span className="shrink-0 text-muted">{created}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">
          {FORMAT_LABELS[batch.format]} ·{" "}
          {batch.period_start && batch.period_end
            ? `${formatDayMonth(batch.period_start)} a ${formatDayMonth(batch.period_end)}`
            : "—"}{" "}
          · {batch.inserted_rows} despesas · {batch.income_rows} ganhos
          {batch.skipped_rows ? ` · ${batch.skipped_rows} já existiam` : ""}
        </span>
        <Button
          variant="ghost"
          className="min-h-9 text-danger"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          Desfazer
        </Button>
      </div>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Desfazer importação?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                startTransition(async () => {
                  try {
                    await undoImport(batch.id);
                    toast("Importação desfeita.");
                  } catch (e) {
                    toast((e as Error).message, "alert");
                  }
                });
              }}
            >
              Desfazer
            </Button>
          </>
        }
      >
        <p>
          Remove as {batch.inserted_rows} despesas e {batch.income_rows} ganhos criados por{" "}
          <strong>{batch.filename}</strong>. Lançamentos manuais não são afetados. O arquivo poderá ser
          importado de novo.
        </p>
      </Dialog>
    </li>
  );
}

export function BatchList({ batches }: { batches: BatchItem[] }) {
  return (
    <ul className="flex flex-col">
      {batches.map((b) => (
        <BatchRow key={b.id} batch={b} />
      ))}
    </ul>
  );
}
