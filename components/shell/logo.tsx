import { cn } from "@/lib/cn";

export function MeridianSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("shrink-0", className)}>
      <path d="M12 58V12L32 38L52 12" stroke="var(--ink)" strokeWidth="6" fill="none" />
      <path d="M52 58V34" stroke="var(--ink)" strokeWidth="6" fill="none" />
      <path d="M20 62L62 2" stroke="var(--red)" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <MeridianSymbol className={size === "lg" ? "h-10 w-10" : "h-7 w-7"} />
      <span
        className={cn(
          "font-display font-extrabold tracking-[-0.03em]",
          size === "lg" ? "text-[34px] leading-none" : "text-[22px] leading-none",
        )}
      >
        Meridian
      </span>
    </span>
  );
}
