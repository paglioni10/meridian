import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHead, Section } from "@/components/ui/display";
import { getCurrentUser } from "@/lib/auth";
import { KIND_LABELS } from "@/lib/capture/parse";
import { createClient } from "@/lib/supabase/server";
import { InboxList, type InboxItem } from "./inbox-ui";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <>
      <PageHead
        title="Inbox"
        meta="Capturas que ainda não foram para um módulo · Ctrl/Cmd + K para capturar"
      />
      <Section title="Pendentes">
        <Suspense fallback={<p className="label">Carregando</p>}>
          <Pending />
        </Suspense>
      </Section>
    </>
  );
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

async function Pending() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_items")
    .select("id, kind, raw_text, url, payload, created_at")
    .is("processed_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Falha ao carregar a inbox: ${error.message}`);
  if (data.length === 0) {
    return (
      <EmptyState title="Inbox vazia">
        Tudo o que você captura e não tem destino certo aparece aqui: ideias, links e lançamentos que precisam
        de ajuste.
      </EmptyState>
    );
  }
  const items: InboxItem[] = data.map((i) => ({
    id: i.id,
    kind: i.kind,
    kindLabel: KIND_LABELS[i.kind],
    raw_text: i.raw_text,
    url: i.url,
    reason:
      typeof (i.payload as Record<string, unknown>)?.reason === "string"
        ? String((i.payload as Record<string, unknown>).reason)
        : null,
    created: dateTime.format(new Date(i.created_at)),
  }));
  return <InboxList items={items} />;
}
