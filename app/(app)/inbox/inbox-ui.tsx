"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { discardItem, itemToTask, retryItem, type CaptureResult } from "@/features/capture/actions";
import { cn } from "@/lib/cn";

export type InboxItem = {
  id: string;
  kind: string;
  kindLabel: string;
  raw_text: string;
  url: string | null;
  reason: string | null;
  created: string;
};

function Item({ item }: { item: InboxItem }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const run = (task: () => Promise<CaptureResult | void>, fallback: string) =>
    startTransition(async () => {
      try {
        const r = await task();
        toast(r ? r.message : fallback, r && !r.ok ? "alert" : undefined);
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  return (
    <li className={cn("flex flex-col gap-1.5 border-b border-border-soft py-2.5", pending && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 break-words">
          <span className="mr-2 font-mono text-label text-muted uppercase">{item.kindLabel}</span>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="break-all">
              {item.raw_text}
            </a>
          ) : (
            item.raw_text
          )}
        </span>
        <span className="shrink-0 font-mono text-label text-muted">{item.created}</span>
      </div>
      {item.reason ? <span className="font-mono text-label text-muted">{item.reason}</span> : null}
      <span className="-ml-2 flex flex-wrap">
        {item.kind !== "idea" && item.kind !== "link" ? (
          <Button
            variant="ghost"
            className="min-h-9"
            disabled={pending}
            onClick={() => run(() => retryItem(item.id), "")}
          >
            Tentar enviar
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="min-h-9"
          disabled={pending}
          onClick={() => run(() => itemToTask(item.id), "")}
        >
          Virar tarefa
        </Button>
        <Button
          variant="ghost"
          className="min-h-9 text-danger"
          disabled={pending}
          onClick={() => run(() => discardItem(item.id), "Item descartado.")}
        >
          Descartar
        </Button>
      </span>
    </li>
  );
}

export function InboxList({ items }: { items: InboxItem[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((i) => (
        <Item key={i.id} item={i} />
      ))}
    </ul>
  );
}
