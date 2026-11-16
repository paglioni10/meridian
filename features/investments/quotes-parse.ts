import { z } from "zod";

const brapiSchema = z.object({
  results: z.array(z.object({ symbol: z.string(), regularMarketPrice: z.number().positive() })).min(1),
});

const coingeckoSchema = z.record(z.string(), z.object({ brl: z.number().positive() }));

export function parseBrapi(body: unknown): number | null {
  const parsed = brapiSchema.safeParse(body);
  return parsed.success ? parsed.data.results[0].regularMarketPrice : null;
}

export function parseCoingecko(body: unknown, ids: string[]): Record<string, number> {
  const parsed = coingeckoSchema.safeParse(body);
  if (!parsed.success) return {};
  return Object.fromEntries(ids.filter((id) => parsed.data[id]).map((id) => [id, parsed.data[id].brl]));
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Za-z0-9.\-]{1,40}$/.test(symbol);
}
