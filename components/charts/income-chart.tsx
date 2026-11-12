"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatMonthLong, formatMonthShort } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export type IncomeChartPoint = {
  month: string;
  total: number;
  guaranteed: number;
  variable: number;
};

const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

function niceMax(value: number): number {
  if (value <= 0) return 100000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value / 4) ?? 10;
  return Math.ceil(value / (step * exp)) * step * exp;
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function axisLabel(cents: number) {
  return compact.format(cents / 100);
}

export function IncomeChart({ points, safeBase }: { points: IncomeChartPoint[]; safeBase: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.round(entry.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(safeBase, ...points.map((p) => p.total)));
  const n = points.length;
  const x = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));

  const path = (key: "total" | "guaranteed") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setActive((current) => Math.min(n - 1, Math.max(0, (current ?? n - 1) + delta)));
    }
    if (event.key === "Escape") setActive(null);
  }

  function onPointer(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const rel = clientX - rect.left - PAD.left;
    const index = n === 1 ? 0 : Math.round((rel / innerW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, index)));
  }

  const current = active !== null ? points[active] : null;
  const last = points[n - 1];
  const tooltipLeft = active !== null ? Math.min(Math.max(x(active) - 90, 0), width - 180) : 0;

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption
        id={titleId}
        className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-label text-muted uppercase"
      >
        <span className="flex items-center gap-2">
          <svg width="24" height="8" aria-hidden>
            <line x1="0" y1="4" x2="24" y2="4" stroke="var(--ink)" strokeWidth="1" />
            <rect x="9" y="1" width="6" height="6" fill="var(--ink)" />
          </svg>
          Total
        </span>
        <span className="flex items-center gap-2">
          <svg width="24" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="24"
              y2="4"
              stroke="var(--ink-muted)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          </svg>
          Garantida
        </span>
        <span className="flex items-center gap-2">
          <svg width="24" height="8" aria-hidden>
            <line x1="0" y1="4" x2="24" y2="4" stroke="var(--blue)" strokeWidth="1" />
          </svg>
          Base segura
        </span>
      </figcaption>

      <div ref={wrapRef} className="relative w-full min-w-0" style={{ minHeight: HEIGHT }}>
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-labelledby={titleId}
            aria-describedby={`${titleId}-desc`}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerMove={(e) => onPointer(e.clientX)}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            className="block touch-pan-y focus-visible:outline-3 focus-visible:outline-secondary"
          >
            <desc id={`${titleId}-desc`}>
              Evolução mensal dos ganhos. Use as setas para percorrer os meses.
            </desc>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "var(--ink)" : "var(--rule)"}
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted font-mono text-[11px] tabular-nums"
                >
                  {axisLabel(t)}
                </text>
              </g>
            ))}

            {points.map((p, i) =>
              (n - 1 - i) % labelEvery === 0 ? (
                <text
                  key={p.month}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  className="fill-muted font-mono text-[11px] uppercase"
                >
                  {formatMonthShort(p.month)}
                </text>
              ) : null,
            )}

            {safeBase > 0 ? (
              <g>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(safeBase)}
                  y2={y(safeBase)}
                  stroke="var(--blue)"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left + 4}
                  y={y(safeBase) - 6}
                  className="fill-secondary font-mono text-[11px] uppercase tabular-nums"
                >
                  Base {formatBRL(safeBase)}
                </text>
              </g>
            ) : null}

            <path
              d={path("guaranteed")}
              fill="none"
              stroke="var(--ink-muted)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <path d={path("total")} fill="none" stroke="var(--ink)" strokeWidth="1" />

            {points.map((p, i) => (
              <rect
                key={p.month}
                x={x(i) - 3.5}
                y={y(p.total) - 3.5}
                width="7"
                height="7"
                fill={active === i ? "var(--blue)" : "var(--ink)"}
              />
            ))}

            {last && active === null ? (
              <text
                x={x(n - 1) - 8}
                y={y(last.total) - 10}
                textAnchor="end"
                className="fill-foreground font-mono text-[11px] tabular-nums"
              >
                {formatBRL(last.total)}
              </text>
            ) : null}

            {active !== null ? (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke="var(--ink-muted)"
                strokeWidth="1"
              />
            ) : null}
          </svg>
        ) : null}

        {current ? (
          <div
            role="status"
            className="pointer-events-none absolute top-2 flex w-[180px] flex-col gap-1 border border-border bg-background p-3 font-mono text-data"
            style={{ left: tooltipLeft }}
          >
            <span className="text-label text-muted uppercase">{formatMonthLong(current.month)}</span>
            <span className="flex justify-between">
              <span>Total</span>
              <span className="tabular-nums">{formatBRL(current.total)}</span>
            </span>
            <span className="flex justify-between text-muted">
              <span>Garantida</span>
              <span className="tabular-nums">{formatBRL(current.guaranteed)}</span>
            </span>
            <span className="flex justify-between text-muted">
              <span>Variável</span>
              <span className="tabular-nums">{formatBRL(current.variable)}</span>
            </span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
