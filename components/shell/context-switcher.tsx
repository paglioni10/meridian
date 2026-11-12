"use client";

import { useOptimistic, useTransition } from "react";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { setContext } from "@/features/settings/actions";
import { APP_CONTEXTS, CONTEXT_LABELS, type AppContext } from "@/lib/context";

const OPTIONS = APP_CONTEXTS.map((value) => ({ value, label: CONTEXT_LABELS[value] }));

export function ContextSwitcher({ current, className }: { current: AppContext; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(current);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function choose(next: AppContext) {
    if (next === optimistic) return;
    startTransition(async () => {
      setOptimistic(next);
      try {
        await setContext(next);
      } catch {
        toast("Não foi possível trocar o contexto.", "alert");
      }
    });
  }

  return (
    <div className={className} aria-busy={pending}>
      <Segmented
        label="Contexto"
        options={OPTIONS}
        value={optimistic}
        onChange={choose}
        className="w-full sm:w-auto"
      />
    </div>
  );
}

export function ContextSwitcherFallback({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Segmented
        label="Contexto"
        options={OPTIONS}
        value={null}
        onChange={() => {}}
        disabled
        className="w-full sm:w-auto"
      />
    </div>
  );
}
