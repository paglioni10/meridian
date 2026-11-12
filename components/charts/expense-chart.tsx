"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatMonthLong, formatMonthShort } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export type ExpenseChartPoint = {
  month: string;
  fixed: number;
  variable: number;
  income: number;
};

const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function niceMax(value: number): number {
  if (value <= 0) return 100000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value / 4) ?? 10;
  return Math.ceil(value / (step * exp)) * step * exp;
}

export function ExpenseChart({ points }: { points: ExpenseChartPoint[] }) {
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

  const n = points.length;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...points.map((p) => Math.max(p.fixed + p.variable, p.income))));
  const slot = innerW / Math.max(n, 1);
  const barW = Math.max(6, Math.min(28, slot * 0.5));
  const cx = (i: number) => PAD.left + slot * (i + 0.5);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const h = (v: number) => (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));
  const incomePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(p.income).toFixed(1)}`)
    .join(" ");
  const hasIncome = points.some((p) => p.income > 0);
  const current = active !== null ? points[active] : null;
  const tooltipLeft = active !== null ? Math.min(Math.max(cx(active) - 95, 0), width - 190) : 0;

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setActive((c) => Math.min(n - 1, Math.max(0, (c ?? n - 1) + delta)));
    }
    if (event.key === "Escape") setActive(null);
  }

  function onPointer(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const index = Math.floor((clientX - rect.left - PAD.left) / slot);
    setActive(Math.min(n - 1, Math.max(0, index)));
  }

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption
        id={titleId}
        className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-label text-muted uppercase"
      >
        <span className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden>
            <rect x="0" y="0" width="12" height="12" fill="var(--ink)" />
          </svg>
          Fixas
        </span>
        <span className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden>
            <rect x="0.5" y="0.5" width="11" height="11" fill="none" stroke="var(--ink)" strokeWidth="1" />
          </svg>
          Variáveis
        </span>
        {hasIncome ? (
          <span className="flex items-center gap-2">
            <svg width="24" height="8" aria-hidden>
              <line x1="0" y1="4" x2="24" y2="4" stroke="var(--blue)" strokeWidth="1" />
            </svg>
            Ganhos
          </span>
        ) : null}
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
              Despesas fixas e variáveis por mês, com os ganhos do mês como linha. Use as setas para
              percorrer.
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
                  {compact.format(t / 100)}
                </text>
              </g>
            ))}

            {points.map((p, i) => {
              const fixedH = h(p.fixed);
              const varH = h(p.variable);
              const gap = p.fixed > 0 && p.variable > 0 ? 2 : 0;
              const x = cx(i) - barW / 2;
              return (
                <g key={p.month} opacity={active === null || active === i ? 1 : 0.45}>
                  {p.fixed > 0 ? (
                    <rect x={x} y={y(p.fixed)} width={barW} height={Math.max(fixedH, 1)} fill="var(--ink)" />
                  ) : null}
                  {p.variable > 0 ? (
                    <rect
                      x={x + 0.5}
                      y={y(p.fixed + p.variable) + 0.5}
                      width={barW - 1}
                      height={Math.max(varH - gap - 1, 1)}
                      fill="var(--paper)"
                      stroke="var(--ink)"
                      strokeWidth="1"
                    />
                  ) : null}
                </g>
              );
            })}

            {hasIncome ? (
              <>
                <path d={incomePath} fill="none" stroke="var(--blue)" strokeWidth="1" />
                {points.map((p, i) => (
                  <rect
                    key={p.month}
                    x={cx(i) - 3}
                    y={y(p.income) - 3}
                    width="6"
                    height="6"
                    fill="var(--blue)"
                  />
                ))}
              </>
            ) : null}

            {points.map((p, i) =>
              (n - 1 - i) % labelEvery === 0 ? (
                <text
                  key={p.month}
                  x={cx(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted font-mono text-[11px] uppercase"
                >
                  {formatMonthShort(p.month)}
                </text>
              ) : null,
            )}
          </svg>
        ) : null}

        {current ? (
          <div
            role="status"
            className="pointer-events-none absolute top-2 flex w-[190px] flex-col gap-1 border border-border bg-background p-3 font-mono text-data"
            style={{ left: tooltipLeft }}
          >
            <span className="text-label text-muted uppercase">{formatMonthLong(current.month)}</span>
            <span className="flex justify-between">
              <span>Despesas</span>
              <span className="tabular-nums">{formatBRL(current.fixed + current.variable)}</span>
            </span>
            <span className="flex justify-between text-muted">
              <span>Fixas</span>
              <span className="tabular-nums">{formatBRL(current.fixed)}</span>
            </span>
            <span className="flex justify-between text-muted">
              <span>Variáveis</span>
              <span className="tabular-nums">{formatBRL(current.variable)}</span>
            </span>
            <span className="flex justify-between text-secondary">
              <span>Ganhos</span>
              <span className="tabular-nums">{formatBRL(current.income)}</span>
            </span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
