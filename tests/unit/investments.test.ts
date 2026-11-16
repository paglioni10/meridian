import { describe, expect, it } from "vitest";
import { isValidSymbol, parseBrapi, parseCoingecko } from "@/features/investments/quotes-parse";
import { rebalance, weightedAverage, type ClassPosition } from "@/features/investments/rebalance";

const classes: ClassPosition[] = [
  { class: "cash", equity_cents: 1_000_000, target_pct: 20 },
  { class: "fixed_income", equity_cents: 2_000_000, target_pct: 40 },
  { class: "equity", equity_cents: 1_500_000, target_pct: 30 },
  { class: "international", equity_cents: 0, target_pct: 10 },
  { class: "crypto", equity_cents: 500_000, target_pct: 0 },
];

describe("rebalance", () => {
  it("distribui pela falta e não perde centavos", () => {
    const out = rebalance(classes, 100_001);
    expect(out.reduce((s, a) => s + a.cents, 0)).toBe(100_001);
    expect(out.map((a) => a.class)).not.toContain("crypto");
    expect(out.find((a) => a.class === "international")!.cents).toBeGreaterThan(0);
  });

  it("tudo na meta distribui pelas metas", () => {
    const balanced: ClassPosition[] = [
      { class: "fixed_income", equity_cents: 600_000, target_pct: 60 },
      { class: "equity", equity_cents: 400_000, target_pct: 40 },
    ];
    expect(rebalance(balanced, 100_000)).toEqual([
      { class: "fixed_income", cents: 60_000 },
      { class: "equity", cents: 40_000 },
    ]);
  });

  it("sem metas ou sem aporte não sugere nada", () => {
    expect(
      rebalance(
        classes.map((c) => ({ ...c, target_pct: 0 })),
        1000,
      ),
    ).toEqual([]);
    expect(rebalance(classes, 0)).toEqual([]);
  });
});

describe("preço médio ponderado", () => {
  it("aportes e resgate mantêm o preço médio", () => {
    const r = weightedAverage([
      { type: "contribution", quantity: 10, total_cents: 10_000 },
      { type: "contribution", quantity: 10, total_cents: 20_000 },
      { type: "withdrawal", quantity: 5, total_cents: 12_000 },
    ]);
    expect(r.quantity).toBe(15);
    expect(r.avgPrice).toBe(15);
    expect(r.investedCents).toBe(22_500);
  });

  it("frações de cripto e resgate acima da posição", () => {
    expect(weightedAverage([{ type: "contribution", quantity: 0.0025, total_cents: 100_000 }]).avgPrice).toBe(
      400_000,
    );
    expect(() =>
      weightedAverage([
        { type: "contribution", quantity: 1, total_cents: 100 },
        { type: "withdrawal", quantity: 2, total_cents: 100 },
      ]),
    ).toThrow();
  });
});

describe("cotações", () => {
  it("brapi e CoinGecko", () => {
    expect(parseBrapi({ results: [{ symbol: "PETR4", regularMarketPrice: 38.5 }] })).toBe(38.5);
    expect(parseBrapi({ error: true })).toBeNull();
    expect(parseCoingecko({ bitcoin: { brl: 500000 } }, ["bitcoin", "ethereum"])).toEqual({
      bitcoin: 500000,
    });
    expect(parseCoingecko("x", ["bitcoin"])).toEqual({});
  });
  it("símbolo seguro", () => {
    expect(isValidSymbol("IVVB11")).toBe(true);
    expect(isValidSymbol("bitcoin")).toBe(true);
    expect(isValidSymbol("../x?y")).toBe(false);
  });
});
