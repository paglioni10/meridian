import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatBRL } from "@/lib/money";
import { formatDayMonth } from "@/lib/dates";

export function PageHead({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="flex flex-col gap-1">
        <h1 className="h1">{title}</h1>
        {meta ? <p className="label">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  action,
  wide,
  children,
}: {
  title: string;
  action?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel", wide && "panel-wide")}>
      <div className="flex items-end justify-between gap-3 border-b border-border pb-1.5">
        <h2 className="font-display text-h2 font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  alert,
  size = "figure",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  alert?: boolean;
  size?: "figure" | "display";
}) {
  return (
    <div className={cn("stat", alert && "stat-alert", size === "display" && "col-span-2")}>
      <span className="label">{label}</span>
      <span className={size === "display" ? "figure-xl" : "figure"}>{value}</span>
      {hint ? <span className="label">{hint}</span> : null}
    </div>
  );
}

export function Row({ left, right, className }: { left: ReactNode; right: ReactNode; className?: string }) {
  return (
    <div className={cn("row", className)}>
      <span className="min-w-0 truncate">{left}</span>
      <span className="shrink-0 tabular-nums">{right}</span>
    </div>
  );
}

export function Progress({
  value,
  tone = "ink",
  label,
}: {
  value: number;
  tone?: "ink" | "active" | "alert";
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("progress", tone === "active" && "progress-active", tone === "alert" && "progress-alert")}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tag({
  tone = "alert",
  children,
}: {
  tone?: "alert" | "ink" | "blue" | "outline";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "tag",
        tone === "ink" && "tag-ink",
        tone === "blue" && "tag-blue",
        tone === "outline" && "tag-outline",
      )}
    >
      {children}
    </span>
  );
}

export function Status({ state }: { state: "online" | "offline" | "warning" }) {
  const text = { online: "Online", offline: "Offline", warning: "Atenção" }[state];
  return (
    <span className={cn("status", `status-${state}`)}>
      <span className="status-dot" aria-hidden />
      {text}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Money({ cents, sign, className }: { cents: number; sign?: boolean; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{formatBRL(cents, { sign })}</span>;
}

export function DateMono({ value, timeZone }: { value: string | Date; timeZone?: string }) {
  const iso = typeof value === "string" ? value : value.toISOString();
  return (
    <time dateTime={iso} className="font-mono text-data tabular-nums">
      {formatDayMonth(value, timeZone)}
    </time>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="font-display text-h2 font-extrabold">{title}</p>
      {children ? <p className="max-w-prose text-muted">{children}</p> : null}
      {action}
    </div>
  );
}
