export const ASSET_CLASSES = ["cash", "fixed_income", "equity", "international", "crypto"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  cash: "Reserva / Liquidez",
  fixed_income: "Renda Fixa",
  equity: "Renda Variável",
  international: "Internacional",
  crypto: "Cripto",
};

export type ClassPosition = { class: AssetClass; equity_cents: number; target_pct: number };
export type Allocation = { class: AssetClass; cents: number };

export function rebalance(classes: ClassPosition[], contributionCents: number): Allocation[] {
  if (contributionCents <= 0) return [];
  const total = classes.reduce((s, c) => s + c.equity_cents, 0) + contributionCents;
  const targets = classes.filter((c) => c.target_pct > 0);
  if (targets.length === 0) return [];

  const gaps = targets.map((c) => ({
    class: c.class,
    gap: Math.max(0, Math.round((total * c.target_pct) / 100) - c.equity_cents),
    weight: c.target_pct,
  }));
  const totalGap = gaps.reduce((s, g) => s + g.gap, 0);
  const basis =
    totalGap > 0 ? gaps.map((g) => ({ ...g, w: g.gap })) : gaps.map((g) => ({ ...g, w: g.weight }));
  const totalW = basis.reduce((s, g) => s + g.w, 0);

  const out = basis
    .filter((g) => g.w > 0)
    .map((g) => ({ class: g.class, cents: Math.floor((contributionCents * g.w) / totalW), w: g.w }));
  const rest = contributionCents - out.reduce((s, a) => s + a.cents, 0);
  if (rest > 0 && out.length) out.reduce((a, b) => (b.w > a.w ? b : a)).cents += rest;
  return out.filter((a) => a.cents > 0).map(({ class: c, cents }) => ({ class: c, cents }));
}

export function weightedAverage(
  movements: { type: "contribution" | "withdrawal"; quantity: number; total_cents: number }[],
): { quantity: number; avgPrice: number; investedCents: number } {
  let q = 0;
  let avg = 0;
  for (const m of movements) {
    if (m.type === "contribution") {
      avg = (q * avg + m.total_cents / 100) / (q + m.quantity);
      q += m.quantity;
    } else {
      if (m.quantity > q + 1e-12) throw new Error("Resgate maior que a posição");
      q -= m.quantity;
    }
  }
  return { quantity: q, avgPrice: q === 0 ? 0 : avg, investedCents: Math.round(q * avg * 100) };
}
