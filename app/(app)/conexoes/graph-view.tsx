"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { createLink, deleteLink, hideEdge, searchEntities, unhideEdge } from "@/features/graph/actions";
import { connectionsOf } from "@/features/graph/neighbors";
import {
  ENTITY_HREF,
  ENTITY_LABELS,
  ENTITY_TYPES,
  endId,
  splitNodeId,
  type EntityType,
  type GraphData,
  type GraphLink,
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
      <span>linha tracejada = automática</span>
      <span className="text-danger">vermelho = alerta</span>
    </div>
  );
}

function useLinkOps() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function connect(
    from: { type: EntityType; id: string },
    to: { type: EntityType; id: string },
    label: string,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const r = await createLink({
        source_type: from.type,
        source_id: from.id,
        target_type: to.type,
        target_id: to.id,
        label,
      });
      if (!r.ok || !r.id) {
        toast(r.message, "alert");
        return;
      }
      onDone?.();
      const id = r.id;
      toast("Conexão criada.", "default", {
        label: "Desfazer",
        onAction: () =>
          startTransition(async () =>
            deleteLink(id).catch(() => toast("Não foi possível desfazer.", "alert")),
          ),
      });
    });
  }

  function undo(link: GraphLink) {
    const s = endId(link.source);
    const t = endId(link.target);
    startTransition(async () => {
      try {
        if (link.origin === "manual" && link.linkId) {
          await deleteLink(link.linkId);
          const from = splitNodeId(s);
          const to = splitNodeId(t);
          toast("Conexão desfeita.", "default", {
            label: "Refazer",
            onAction: () =>
              startTransition(async () => {
                await createLink({
                  source_type: from.type,
                  source_id: from.id,
                  target_type: to.type,
                  target_id: to.id,
                  label: link.label ?? "",
                });
              }),
          });
        } else {
          await hideEdge(s, t);
          toast("Conexão automática desfeita no grafo.", "default", {
            label: "Refazer",
            onAction: () => startTransition(async () => unhideEdge(s, t)),
          });
        }
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  }

  function restore(link: GraphLink) {
    startTransition(async () => {
      try {
        await unhideEdge(endId(link.source), endId(link.target));
        toast("Conexão restaurada.");
      } catch (e) {
        toast((e as Error).message, "alert");
      }
    });
  }

  return { pending, connect, undo, restore };
}

function LinkPicker({ node, onDone }: { node: GraphNode; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchEntities>>>([]);
  const [searching, startSearch] = useTransition();
  const ops = useLinkOps();

  function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => setResults(await searchEntities(value)));
  }

  return (
    <div className="flex flex-col gap-3">
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
      <ul className={cn("flex flex-col", (searching || ops.pending) && "opacity-60")} aria-live="polite">
        {results
          .filter((r) => !(r.type === node.type && r.id === node.entityId))
          .map((r) => (
            <li key={`${r.type}:${r.id}`}>
              <button
                type="button"
                onClick={() => ops.connect({ type: node.type, id: node.entityId }, r, label, onDone)}
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
  onStartLink,
}: {
  node: GraphNode;
  data: GraphData;
  vault: string | null;
  notePaths: Record<string, string>;
  onSelect: (id: string) => void;
  onStartLink: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const ops = useLinkOps();
  const connections = connectionsOf(data, node.id);
  const noteEntity =
    node.type === "note"
      ? node.entityId
      : node.type === "course"
        ? connections.find((c) => c.other?.type === "note")?.other?.entityId
        : undefined;
  const path = noteEntity ? notePaths[noteEntity] : undefined;

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
      </dl>
      <div className="-ml-2 flex flex-wrap">
        <Button variant="primary" className="ml-2 min-h-9" onClick={onStartLink}>
          Conectar clicando
        </Button>
        <Button variant="ghost" className="min-h-9" onClick={() => setPicking(true)}>
          Buscar e conectar
        </Button>
      </div>
      {connections.length ? (
        <ul className={cn("flex flex-col", ops.pending && "opacity-60")}>
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
                  {link.origin === "derived" ? " · auto" : ""}
                </span>
                {other!.label}
              </button>
              <button
                type="button"
                disabled={ops.pending}
                aria-label={`Desfazer conexão com ${other!.label}`}
                className="shrink-0 font-mono text-label text-danger uppercase"
                onClick={() => ops.undo(link)}
              >
                Desfazer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="label">Sem conexões ainda.</p>
      )}
      <div className="-ml-2 flex flex-wrap">
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

function HiddenLinks({ data }: { data: GraphData }) {
  const ops = useLinkOps();
  const byId = new Map(data.nodes.map((n) => [n.id, n.label]));
  const hidden = data.hidden ?? [];
  if (hidden.length === 0) return null;
  return (
    <details className="border-t border-border-soft pt-2">
      <summary className="label cursor-pointer">Conexões automáticas desfeitas · {hidden.length}</summary>
      <ul className={cn("mt-2 flex flex-col", ops.pending && "opacity-60")}>
        {hidden.map((l) => (
          <li
            key={`${endId(l.source)}-${endId(l.target)}`}
            className="flex items-center justify-between gap-2 border-b border-border-soft py-1.5"
          >
            <span className="min-w-0 truncate">
              {byId.get(endId(l.source)) ?? "Item"} → {byId.get(endId(l.target)) ?? "Item"}
              {l.label ? <span className="text-muted"> · {l.label}</span> : null}
            </span>
            <button
              type="button"
              className="shrink-0 font-mono text-label text-secondary uppercase"
              onClick={() => ops.restore(l)}
            >
              Restaurar
            </button>
          </li>
        ))}
      </ul>
    </details>
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
  const [linkFrom, setLinkFrom] = useState<GraphNode | null>(null);
  const [query, setQuery] = useState("");
  const [centerOn, setCenterOn] = useState<{ id: string; at: number } | null>(null);
  const ops = useLinkOps();

  useEffect(() => {
    if (!linkFrom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLinkFrom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linkFrom]);

  const filtered = useMemo<GraphData>(() => {
    const nodes = data.nodes.filter((n) => !hidden.has(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, links: data.links.filter((l) => ids.has(endId(l.source)) && ids.has(endId(l.target))) };
  }, [data, hidden]);

  const selected = data.nodes.find((n) => n.id === selectedId) ?? null;
  const present = ENTITY_TYPES.filter((t) => data.nodes.some((n) => n.type === t));

  function pick(id: string) {
    if (linkFrom) {
      if (id === linkFrom.id) {
        setLinkFrom(null);
        return;
      }
      const target = data.nodes.find((n) => n.id === id);
      if (target) {
        ops.connect(
          { type: linkFrom.type, id: linkFrom.entityId },
          { type: target.type, id: target.entityId },
          "",
        );
      }
      setLinkFrom(null);
      return;
    }
    setSelectedId(id);
  }

  function find(value: string) {
    setQuery(value);
    const q = value.trim().toLowerCase();
    if (q.length < 2) return;
    const match = filtered.nodes.find((n) => n.label.toLowerCase().includes(q));
    if (match) {
      if (!linkFrom) setSelectedId(match.id);
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
        <label className="field md:w-72">
          <span className="field-label">Buscar item</span>
          <input className="input" value={query} onChange={(e) => find(e.target.value)} placeholder="Nome" />
        </label>
      </div>
      {linkFrom ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border border-secondary px-3 py-2 font-mono text-data"
        >
          <span>
            Conectando <strong>{linkFrom.label}</strong>: clique no outro item{" "}
            {mode === "graph" ? "no grafo" : "na lista"}.
          </span>
          <Button variant="ghost" className="min-h-9" onClick={() => setLinkFrom(null)}>
            Cancelar
          </Button>
        </div>
      ) : null}
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
            selectedId={linkFrom?.id ?? selectedId}
            onSelect={(n) => pick(n.id)}
            centerOn={centerOn}
            height={560}
          />
          <Legend />
        </>
      ) : (
        <GraphList data={data} onOpen={pick} />
      )}
      <HiddenLinks data={data} />
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
            onStartLink={() => {
              setLinkFrom(selected);
              setSelectedId(null);
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
