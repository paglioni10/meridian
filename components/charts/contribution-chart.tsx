"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { formatMonthLong, formatMonthShort } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export type ContributionPoint = { month: string; contributed: number; surplus: number };

const HEIGHT = 220;
const PAD = { top: 16, right: 12, bottom: 28, left: 56 };
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function niceMax(value: number): number {
  if (value <= 0) return 100000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value / 4) ?? 10;
  return Math.ceil(value / (step * exp)) * step * exp;
}

export function ContributionChart({ points }: { points: ContributionPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [table, setTable] = useState(false);
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

  const visible = width > 0 && width < 640 ? points.slice(-6) : points;
  const n = visible.length;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const maxV = niceMax(Math.max(...visible.flatMap((p) => [p.contributed, p.surplus, 0])));
  const minV = Math.min(0, ...visible.flatMap((p) => [p.contributed, p.surplus]));
  const span = maxV - minV || 1;
  const y = (v: number) => PAD.top + ((maxV - v) / span) * innerH;
  const slot = n ? innerW / n : innerW;
  const bar = Math.max(4, Math.min(18, slot / 3));
  const totalSurplus = points.reduce((s, p) => s + Math.max(0, p.surplus), 0);
  const totalContributed = points.reduce((s, p) => s + Math.max(0, p.contributed), 0);
  const idle = totalSurplus - totalContributed;

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption
        id={titleId}
        className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 font-mono text-label text-muted uppercase"
      >
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          <span className="flex items-center gap-2">
            <svg width="10" height="10" aria-hidden>
              <rect width="10" height="10" fill="var(--ink)" />
            </svg>
            Aporte líquido
          </span>
          <span className="flex items-center gap-2">
            <svg width="10" height="10" aria-hidden>
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="var(--ink)" />
            </svg>
            Sobra de caixa
          </span>
        </span>
        <button type="button" className="uppercase hover:text-danger" onClick={() => setTable((t) => !t)}>
          {table ? "Ver gráfico" : "Ver tabela"}
        </button>
      </figcaption>

      {table ? (
        <table className="w-full font-mono text-data tabular-nums">
          <thead>
            <tr className="text-label text-muted uppercase">
              <th className="py-1 text-left font-medium">Mês</th>
              <th className="py-1 text-right font-medium">Aporte</th>
              <th className="py-1 text-right font-medium">Sobra</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month} className="border-t border-border-soft">
                <td className="py-1">{formatMonthLong(p.month)}</td>
                <td className="py-1 text-right">{formatBRL(p.contributed, { sign: p.contributed < 0 })}</td>
                <td className="py-1 text-right">{formatBRL(p.surplus, { sign: p.surplus < 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={wrapRef} className="w-full min-w-0" style={{ minHeight: HEIGHT }}>
          {width > 0 ? (
            <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="block">
              {[maxV, maxV / 2, 0, ...(minV < 0 ? [minV] : [])].map((t) => (
                <g key={t}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y(t)}
                    y2={y(t)}
                    stroke={t === 0 ? "var(--ink)" : "var(--rule)"}
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
              {visible.map((p, i) => {
                const cx = PAD.left + slot * i + slot / 2;
                const top = (v: number) => Math.min(y(v), y(0));
                const h = (v: number) => Math.max(1, Math.abs(y(v) - y(0)));
                return (
                  <g key={p.month}>
                    <title>{`${formatMonthLong(p.month)}: aporte ${formatBRL(p.contributed)}, sobra ${formatBRL(p.surplus)}`}</title>
                    <rect
                      x={cx - bar - 1}
                      y={top(p.contributed)}
                      width={bar}
                      height={h(p.contributed)}
                      fill="var(--ink)"
                    />
                    <rect
                      x={cx + 1.5}
                      y={top(p.surplus)}
                      width={bar - 1}
                      height={h(p.surplus)}
                      fill="none"
                      stroke="var(--ink)"
                    />
                    <text
                      x={cx}
                      y={HEIGHT - 8}
                      textAnchor="middle"
                      className="fill-muted font-mono text-[11px] uppercase"
                    >
                      {formatMonthShort(p.month)}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : null}
        </div>
      )}
      {idle > 0 ? <p className="label">Sobrou {formatBRL(idle)} no período que não foi investido.</p> : null}
    </figure>
  );
}
