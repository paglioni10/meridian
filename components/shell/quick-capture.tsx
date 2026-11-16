"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { capture } from "@/features/capture/actions";
import { KIND_LABELS, parseCapture, type ParsedCapture } from "@/lib/capture/parse";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatDateFull } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

const PRIORITY_LABELS = { low: "baixa", medium: "média", high: "alta", critical: "crítica" } as const;

function describe(p: ParsedCapture): string {
  const ctx = p.context ? ` · ${CONTEXT_LABELS[p.context]}` : "";
  switch (p.kind) {
    case "expense":
      return `${formatBRL(p.amount_cents)} · ${p.description}${p.tag ? ` · #${p.tag}` : ""}${p.date ? ` · ${formatDateFull(p.date)}` : ""}${ctx}`;
    case "income":
      return `${formatBRL(p.amount_cents)} · ${p.description}${ctx}`;
    case "task":
      return `${p.title} · prioridade ${PRIORITY_LABELS[p.priority]}${p.due_on ? ` · até ${formatDateFull(p.due_on)}` : ""}${ctx}`;
    case "link":
      return `${p.title ?? p.url}${ctx}`;
    case "goal":
      return `${p.title}${p.target_cents ? ` · alvo ${formatBRL(p.target_cents)}` : ""}${ctx}`;
    case "investment":
      return `${formatBRL(p.amount_cents)} em ${p.asset}${ctx}`;
    default:
      return `Vai para a inbox${ctx}`;
  }
}

export function QuickCapture({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const parsed = text.trim() ? parseCapture(text, today) : null;

  function submit() {
    if (!text.trim() || pending) return;
    startTransition(async () => {
      try {
        const result = await capture(text);
        toast(result.message, result.ok ? undefined : "alert");
        if (result.ok) {
          setText("");
          setOpen(false);
        }
      } catch {
        toast("Não foi possível capturar.", "alert");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Capturar"
        className="capture-fab fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center border border-border bg-primary font-mono text-2xl text-primary-foreground lg:hidden"
      >
        +
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Capturar">
        {open ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="field">
              <span className="field-label">O que você quer guardar?</span>
              <input
                className="input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                autoFocus
                autoComplete="off"
                placeholder="$ 35,90 almoço #alimentacao"
                aria-describedby="capture-preview capture-help"
              />
            </label>
            <p id="capture-preview" aria-live="polite" className="min-h-6 font-mono text-data">
              {parsed ? (
                <>
                  <span className="mr-2 text-secondary uppercase">{KIND_LABELS[parsed.kind]}</span>
                  {describe(parsed)}
                </>
              ) : null}
            </p>
            <ul
              id="capture-help"
              className="grid gap-x-4 gap-y-1 font-mono text-label text-muted sm:grid-cols-2"
            >
              <li>$ 35,90 almoço #categoria</li>
              <li>+ 1.200 site cliente</li>
              <li>t: revisar !alta ^sexta</li>
              <li>m: notebook 750</li>
              <li>a: 500 caixinha</li>
              <li>@trabalho · @freelance · @pessoal</li>
            </ul>
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={pending || !text.trim()}>
                {pending ? "Salvando" : "Capturar"}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
