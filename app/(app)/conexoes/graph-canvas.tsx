"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { drawNode, nodeRadius } from "@/features/graph/draw-node";
import { neighborhood } from "@/features/graph/neighbors";
import type { GraphData, GraphLink, GraphNode } from "@/features/graph/schema";
import { useGraphTheme } from "@/features/graph/use-graph-theme";

export default function GraphCanvas({
  data,
  selectedId,
  onSelect,
  centerOn,
  height,
}: {
  data: GraphData;
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
  centerOn: { id: string; at: number } | null;
  height: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const graph = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [width, setWidth] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const theme = useGraphTheme();
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const focus = useMemo(() => neighborhood(data, hoverId ?? selectedId), [data, hoverId, selectedId]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!centerOn) return;
    const node = data.nodes.find((n) => n.id === centerOn.id);
    if (node?.x !== undefined && node.y !== undefined) {
      graph.current?.centerAt(node.x, node.y, reducedMotion ? 0 : 600);
      graph.current?.zoom(2.2, reducedMotion ? 0 : 600);
    }
  }, [centerOn, data.nodes, reducedMotion]);

  return (
    <div ref={wrap} className="w-full touch-none border border-border-soft" style={{ height }}>
      {width > 0 ? (
        <ForceGraph2D<GraphNode, GraphLink>
          ref={graph}
          graphData={data}
          width={width}
          height={height}
          backgroundColor={theme.paper}
          nodeId="id"
          nodeVal={(n) => 1 + n.degree}
          nodeRelSize={4}
          nodeLabel={(n) => n.label}
          nodeCanvasObject={(n, ctx, scale) => drawNode(n, ctx, scale, theme, focus)}
          nodePointerAreaPaint={(n, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, nodeRadius(n) + 2, 0, Math.PI * 2);
            ctx.fill();
          }}
          linkColor={(l) => (focus?.links.has(l) ? theme.blue : theme.rule)}
          linkWidth={(l) => (focus?.links.has(l) ? 2 : 1)}
          linkLineDash={(l) => (l.origin === "manual" ? null : [3, 2])}
          onNodeHover={(n) => setHoverId(n?.id ?? null)}
          onNodeClick={(n) => onSelect(n)}
          onBackgroundClick={() => setHoverId(null)}
          warmupTicks={reducedMotion ? 300 : 30}
          cooldownTicks={reducedMotion ? 0 : 200}
          cooldownTime={3000}
          enableNodeDrag
        />
      ) : null}
    </div>
  );
}
