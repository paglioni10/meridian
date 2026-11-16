"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { createLink, deleteLink, searchEntities } from "@/features/graph/actions";
import { connectionsOf } from "@/features/graph/neighbors";
import {
  ENTITY_HREF,
  ENTITY_LABELS,
  ENTITY_TYPES,
  endId,
  type EntityType,
  type GraphData,
  type GraphNode,
} from "@/features/graph/schema";
import { cn } from "@/lib/cn";
import { CONTEXT_LABELS } from "@/lib/context";
import { obsidianUri } from "@/lib/obsidian";

const GraphCanvas = dynamic(() => import("./graph-canvas"), {
  ssr: false,
  loading: () => <div className="h-[560px] border border-border-soft" />,
});

const SHAPES: Record<string, string> = {
  course: "●",
  project: "■",
  goal: "▲",
  income_source: "◆",
  client: "◆",
  deal: "◆",
  asset: "◆",
  service: "⬢",
  note: "○",
};

const STATE_TEXT: Record<string, string> = { late: "Atrasado", down: "Offline" };

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-label text-muted uppercase">
      <span>● curso</span>
      <span>■ projeto</span>
      <span>▲ objetivo</span>
      <span>◆ finanças e clientes</span>
      <span>⬢ servidor</span>
      <span>○ nota</span>
      <span>— pessoal · ╌ trabalho · ┈ freelance</span>
      <span className="text-danger">vermelho = alerta</span>
    </div>
  );
}

function LinkPicker({ node, onDone }: { node: GraphNode; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchEntities>>>([]);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => setResults(await searchEntities(value)));
  }

  function connect(target: { type: EntityType; id: string }) {
    startTransition(async () => {
      const r = await createLink({
        source_type: node.type,
        source_id: node.entityId,
        target_type: target.type,
        target_id: target.id,
        label,
      });
      toast(r.message, r.ok ? undefined : "alert");
      if (r.ok) onDone();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="field">
        <span className="field-label">Rótulo (opcional)</span>
        <input
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder="aplicado em, financia, documenta"
        />
      </label>
      <label className="field">
        <span className="field-label">Conectar a</span>
        <input
          className="input"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Busque por nome"
          autoFocus
        />
      </label>
      <ul className={cn("flex flex-col", pending && "opacity-60")} aria-live="polite">
        {results
          .filter((r) => !(r.type === node.type && r.id === node.entityId))
          .map((r) => (
            <li key={`${r.type}:${r.id}`}>
              <button
                type="button"
                onClick={() => connect(r)}
                className="flex min-h-tap w-full items-center justify-between gap-3 border-b border-border-soft text-left hover:text-danger"
              >
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 font-mono text-label text-muted uppercase">
                  {ENTITY_LABELS[r.type]}
                </span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

function NodePanel({
  node,
  data,
  vault,
  notePaths,
  onSelect,
}: {
  node: GraphNode;
  data: GraphData;
  vault: string | null;
  notePaths: Record<string, string>;
  onSelect: (id: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const connections = connectionsOf(data, node.id);
  const notePath =
    node.type === "note"
      ? notePaths[node.entityId]
      : node.type === "course"
        ? connections.find((c) => c.other?.type === "note")?.other?.entityId
        : undefined;
  const path = node.type === "note" ? notePath : notePath ? notePaths[notePath] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-data">
        <dt className="label">Tipo</dt>
        <dd>{ENTITY_LABELS[node.type]}</dd>
        {node.context ? (
          <>
            <dt className="label">Contexto</dt>
            <dd>{CONTEXT_LABELS[node.context as "personal"] ?? node.context}</dd>
          </>
        ) : null}
        {node.state ? (
          <>
            <dt className="label">Estado</dt>
            <dd className={cn(node.alert && "text-danger uppercase")}>
              {STATE_TEXT[node.state] ?? node.state}
            </dd>
          </>
        ) : null}
        <dt className="label">Conexões</dt>
        <dd>{node.degree}</dd>
      </dl>
      {connections.length ? (
        <ul className="flex flex-col">
          {connections.map(({ link, other }) => (
            <li
              key={`${endId(link.source)}-${endId(link.target)}-${link.label}`}
              className="flex items-center justify-between gap-2 border-b border-border-soft py-1.5"
            >
              <button
                type="button"
                className="min-w-0 truncate text-left hover:text-danger"
                onClick={() => onSelect(other!.id)}
              >
                <span className="mr-2 font-mono text-label text-muted uppercase">
                  {link.label ?? "ligado a"}
                </span>
                {other!.label}
              </button>
              {link.origin === "manual" && link.linkId ? (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Remover conexão com ${other!.label}`}
                  className="shrink-0 font-mono text-label text-danger uppercase"
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await deleteLink(link.linkId!);
                        toast("Conexão removida.");
                      } catch (e) {
                        toast((e as Error).message, "alert");
                      }
                    })
                  }
                >
                  Remover
                </button>
              ) : (
                <span className="shrink-0 font-mono text-label text-muted">automática</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="label">Sem conexões ainda.</p>
      )}
      <div className="-ml-2 flex flex-wrap">
        <Button variant="ghost" className="min-h-9" onClick={() => setPicking(true)}>
          Conectar a…
        </Button>
        <Link href={ENTITY_HREF[node.type]} className="btn btn-ghost min-h-9 no-underline">
          Abrir no módulo
        </Link>
        {path && vault ? (
          <a href={obsidianUri(vault, path)} className="btn btn-ghost min-h-9 text-secondary no-underline">
            Abrir no Obsidian
          </a>
        ) : null}
      </div>
      <Dialog open={picking} onClose={() => setPicking(false)} title={`Conectar ${node.label}`}>
        {picking ? <LinkPicker node={node} onDone={() => setPicking(false)} /> : null}
      </Dialog>
    </div>
  );
}

function GraphList({ data, onOpen }: { data: GraphData; onOpen: (id: string) => void }) {
  const groups = ENTITY_TYPES.map((t) => ({
    type: t,
    nodes: data.nodes.filter((n) => n.type === t).sort((a, b) => b.degree - a.degree),
  })).filter((g) => g.nodes.length);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.type} aria-label={ENTITY_LABELS[g.type]}>
          <h3 className="label mb-1">
            {SHAPES[g.type]} {ENTITY_LABELS[g.type]} · {g.nodes.length}
          </h3>
          <ul className="flex flex-col">
            {g.nodes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onOpen(n.id)}
                  className="flex min-h-tap w-full items-center justify-between gap-3 border-b border-border-soft text-left hover:text-danger focus-visible:outline-3 focus-visible:outline-secondary"
                >
                  <span className={cn("truncate", n.alert && "text-danger")}>
                    {n.label}
                    {n.alert ? ` · ${STATE_TEXT[n.state ?? ""] ?? "alerta"}` : ""}
                  </span>
                  <span className="shrink-0 font-mono text-label text-muted tabular-nums">
                    {n.degree} {n.degree === 1 ? "conexão" : "conexões"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function GraphView({
  data,
  vault,
  notePaths,
}: {
  data: GraphData;
  vault: string | null;
  notePaths: Record<string, string>;
}) {
  const [mode, setMode] = useState<"graph" | "list">("graph");
  const [hidden, setHidden] = useState<Set<EntityType>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [centerOn, setCenterOn] = useState<{ id: string; at: number } | null>(null);

  const filtered = useMemo<GraphData>(() => {
    const nodes = data.nodes.filter((n) => !hidden.has(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, links: data.links.filter((l) => ids.has(endId(l.source)) && ids.has(endId(l.target))) };
  }, [data, hidden]);

  const selected = data.nodes.find((n) => n.id === selectedId) ?? null;
  const present = ENTITY_TYPES.filter((t) => data.nodes.some((n) => n.type === t));

  function find(value: string) {
    setQuery(value);
    const q = value.trim().toLowerCase();
    if (q.length < 2) return;
    const match = filtered.nodes.find((n) => n.label.toLowerCase().includes(q));
    if (match) {
      setSelectedId(match.id);
      setCenterOn({ id: match.id, at: Date.now() });
    }
  }

  if (data.nodes.length === 0) {
    return (
      <p className="label">
        O grafo aparece quando houver cursos, projetos, objetivos, clientes, servidores ou investimentos
        cadastrados.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Segmented
          label="Visualização"
          options={[
            { value: "graph", label: "Grafo" },
            { value: "list", label: "Lista" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "graph" | "list")}
        />
        {mode === "graph" ? (
          <label className="field md:w-72">
            <span className="field-label">Buscar nó</span>
            <input
              className="input"
              value={query}
              onChange={(e) => find(e.target.value)}
              placeholder="Nome"
            />
          </label>
        ) : null}
      </div>
      {mode === "graph" ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos visíveis">
            {present.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={!hidden.has(t)}
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (next.has(t)) next.delete(t);
                    else next.add(t);
                    return next;
                  })
                }
                className="btn min-h-9 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {SHAPES[t]} {ENTITY_LABELS[t]}
              </button>
            ))}
          </div>
          <GraphCanvas
            data={filtered}
            selectedId={selectedId}
            onSelect={(n) => setSelectedId(n.id)}
            centerOn={centerOn}
            height={560}
          />
          <Legend />
        </>
      ) : (
        <GraphList data={data} onOpen={setSelectedId} />
      )}
      <Dialog open={selected !== null} onClose={() => setSelectedId(null)} title={selected?.label ?? ""}>
        {selected ? (
          <NodePanel
            node={selected}
            data={data}
            vault={vault}
            notePaths={notePaths}
            onSelect={(id) => {
              setSelectedId(id);
              setCenterOn({ id, at: Date.now() });
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
