import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHead } from "@/components/ui/display";
import { getGraphSnapshot } from "@/features/graph/queries";
import { getCurrentUser } from "@/lib/auth";
import { getActiveContext, getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { GraphView } from "./graph-view";

export const metadata: Metadata = { title: "Conexões" };

export default function ConnectionsPage() {
  return (
    <>
      <PageHead title="Conexões" meta="Cursos, projetos, objetivos, finanças, servidores e notas" />
      <Suspense fallback={<div className="h-[560px] border border-border-soft" />}>
        <Graph />
      </Suspense>
    </>
  );
}

async function Graph() {
  const context = await getActiveContext();
  await getCurrentUser();
  const supabase = await createClient();
  const [snapshot, settings, notes] = await Promise.all([
    getGraphSnapshot(context),
    getSettings(),
    supabase.from("obsidian_notes").select("id, path"),
  ]);
  const notePaths = Object.fromEntries((notes.data ?? []).map((n) => [n.id, n.path]));
  return <GraphView data={snapshot} vault={settings.obsidian_vault} notePaths={notePaths} />;
}
