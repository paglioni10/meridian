import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedCapture } from "@/lib/capture/parse";
import { normalizeDescription } from "@/lib/parsers/text";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;
type Context = "personal" | "work" | "freelance";
type Table = "expenses" | "incomes" | "tasks" | "courses" | "goals" | "investment_transactions";

export type RouteResult = { table: Table; id: string; label: string } | { table: null; reason: string };

const COURSE_HOSTS = [
  "udemy.com",
  "alura.com.br",
  "coursera.org",
  "rocketseat.com.br",
  "dio.me",
  "edx.org",
  "domestika.org",
  "hotmart.com",
  "youtube.com",
  "youtu.be",
  "frontendmasters.com",
  "egghead.io",
];

function strip(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function isCourseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return COURSE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function routeCapture(
  db: Db,
  userId: string,
  parsed: ParsedCapture,
  context: Context,
  today: string,
): Promise<RouteResult> {
  switch (parsed.kind) {
    case "expense": {
      let categoryId: string | null = null;
      let nature: "fixed" | "variable" = "variable";
      if (parsed.tag) {
        const { data: categories } = await db.from("expense_categories").select("id, name, nature");
        const match = (categories ?? []).find(
          (c) => strip(c.name).replace(/\s+/g, "") === strip(parsed.tag!),
        );
        if (match) {
          categoryId = match.id;
          nature = match.nature;
        }
      }
      const { data, error } = await db
        .from("expenses")
        .insert({
          user_id: userId,
          description: parsed.description,
          description_normalized: normalizeDescription(parsed.description),
          amount_cents: parsed.amount_cents,
          occurred_on: parsed.date ?? today,
          category_id: categoryId,
          nature,
          context,
          source: "capture",
        })
        .select("id")
        .single();
      if (error) return { table: null, reason: "Não foi possível lançar a despesa." };
      return {
        table: "expenses",
        id: data.id,
        label: categoryId ? "Despesa lançada" : "Despesa lançada sem categoria",
      };
    }
    case "income": {
      const { data: sources } = await db
        .from("income_sources")
        .select("id, context")
        .eq("active", true)
        .eq("kind", "variable");
      const source = (sources ?? []).find((s) => s.context === context) ?? sources?.[0];
      if (!source) return { table: null, reason: "Cadastre uma fonte de renda variável para lançar ganhos." };
      const date = parsed.date ?? today;
      const { data, error } = await db
        .from("incomes")
        .insert({
          user_id: userId,
          source_id: source.id,
          kind: "variable",
          context,
          competence_month: `${date.slice(0, 7)}-01`,
          received_on: date,
          amount_cents: parsed.amount_cents,
          description: parsed.description.slice(0, 200),
        })
        .select("id")
        .single();
      if (error) return { table: null, reason: "Não foi possível lançar o ganho." };
      return { table: "incomes", id: data.id, label: "Ganho lançado" };
    }
    case "task": {
      const { data: last } = await db
        .from("tasks")
        .select("position")
        .eq("status", "todo")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data, error } = await db
        .from("tasks")
        .insert({
          user_id: userId,
          title: parsed.title.slice(0, 160),
          priority: parsed.priority,
          due_on: parsed.due_on,
          context,
          status: "todo",
          position: Number(last?.position ?? 0) + 1024,
        })
        .select("id")
        .single();
      if (error) return { table: null, reason: "Não foi possível criar a tarefa." };
      return { table: "tasks", id: data.id, label: "Tarefa criada" };
    }
    case "link": {
      if (!isCourseUrl(parsed.url)) return { table: null, reason: "Link guardado na inbox." };
      const title = parsed.title ?? new URL(parsed.url).hostname.replace(/^www\./, "");
      const { data, error } = await db
        .from("courses")
        .insert({ user_id: userId, title: title.slice(0, 200), url: parsed.url, context })
        .select("id")
        .single();
      if (error) return { table: null, reason: "Não foi possível adicionar o curso." };
      return { table: "courses", id: data.id, label: "Curso adicionado ao backlog" };
    }
    case "goal": {
      const { data, error } = await db
        .from("goals")
        .insert({
          user_id: userId,
          title: parsed.title.slice(0, 80),
          horizon: "short",
          target_cents: parsed.target_cents,
          context,
        })
        .select("id")
        .single();
      if (error) return { table: null, reason: "Não foi possível criar o objetivo." };
      return { table: "goals", id: data.id, label: "Objetivo criado" };
    }
    case "investment": {
      const ref = strip(parsed.asset);
      const { data: assets } = await db
        .from("investment_assets")
        .select("id, ticker_or_name, quote_symbol, valuation_mode")
        .is("archived_at", null);
      const matches = (assets ?? []).filter(
        (a) => strip(a.ticker_or_name).includes(ref) || (a.quote_symbol && strip(a.quote_symbol) === ref),
      );
      if (matches.length !== 1) {
        return {
          table: null,
          reason: matches.length ? "Mais de um ativo combina; escolha na inbox." : "Ativo não encontrado.",
        };
      }
      const asset = matches[0];
      if (asset.valuation_mode === "quote") {
        return {
          table: null,
          reason: `${asset.ticker_or_name} usa cotação: lance com quantidade em Investimentos.`,
        };
      }
      const { data, error } = await db
        .from("investment_transactions")
        .insert({
          user_id: userId,
          asset_id: asset.id,
          type: "contribution",
          total_amount_cents: parsed.amount_cents,
          occurred_on: today,
        })
        .select("id")
        .single();
      if (error) return { table: null, reason: "Não foi possível lançar o aporte." };
      return { table: "investment_transactions", id: data.id, label: `Aporte em ${asset.ticker_or_name}` };
    }
    default:
      return { table: null, reason: "Ideia guardada na inbox." };
  }
}
