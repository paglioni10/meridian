import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { isValidSymbol, parseBrapi, parseCoingecko } from "./quotes-parse";

type Db = SupabaseClient<Database>;

const TIMEOUT_MS = 8000;

export type SyncResult = { updated: number; skipped: number; failed: string[] };

export async function fetchBrapi(symbol: string): Promise<number | null> {
  if (!isValidSymbol(symbol)) return null;
  const token = serverEnv().BRAPI_TOKEN;
  try {
    const response = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(symbol.toUpperCase())}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return parseBrapi(await response.json());
  } catch {
    return null;
  }
}

export async function fetchCoingecko(ids: string[]): Promise<Record<string, number>> {
  const valid = ids.filter(isValidSymbol).map((id) => id.toLowerCase());
  if (valid.length === 0) return {};
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", valid.join(","));
  url.searchParams.set("vs_currencies", "brl");
  const key = serverEnv().COINGECKO_DEMO_KEY;
  try {
    const response = await fetch(url, {
      headers: key ? { "x-cg-demo-api-key": key } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return {};
    return parseCoingecko(await response.json(), valid);
  } catch {
    return {};
  }
}

export async function syncQuotes(db: Db, { minAgeMinutes }: { minAgeMinutes: number }): Promise<SyncResult> {
  const threshold = new Date(Date.now() - minAgeMinutes * 60_000).toISOString();
  const { data: assets, error } = await db
    .from("investment_assets")
    .select("id, quote_source, quote_symbol, price_updated_at")
    .in("quote_source", ["brapi", "coingecko"])
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  const stale = assets.filter(
    (a) => a.quote_symbol && (!a.price_updated_at || a.price_updated_at < threshold),
  );
  const brapiSymbols = [
    ...new Set(stale.filter((a) => a.quote_source === "brapi").map((a) => a.quote_symbol!.toUpperCase())),
  ];
  const coinIds = [
    ...new Set(stale.filter((a) => a.quote_source === "coingecko").map((a) => a.quote_symbol!.toLowerCase())),
  ];

  const prices = new Map<string, number>();
  for (let i = 0; i < brapiSymbols.length; i += 4) {
    const batch = brapiSymbols.slice(i, i + 4);
    const results = await Promise.all(batch.map(fetchBrapi));
    batch.forEach((s, j) => results[j] !== null && prices.set(`brapi:${s}`, results[j]!));
  }
  for (const [id, price] of Object.entries(await fetchCoingecko(coinIds)))
    prices.set(`coingecko:${id}`, price);

  const now = new Date().toISOString();
  const failed: string[] = [];
  let updated = 0;
  for (const asset of stale) {
    const key = `${asset.quote_source}:${asset.quote_source === "brapi" ? asset.quote_symbol!.toUpperCase() : asset.quote_symbol!.toLowerCase()}`;
    const price = prices.get(key);
    if (price === undefined) {
      failed.push(asset.quote_symbol!);
      continue;
    }
    const { error: updateError } = await db
      .from("investment_assets")
      .update({ current_price: price, price_updated_at: now })
      .eq("id", asset.id);
    if (updateError) failed.push(asset.quote_symbol!);
    else updated++;
  }

  return { updated, skipped: assets.length - stale.length, failed: [...new Set(failed)] };
}
