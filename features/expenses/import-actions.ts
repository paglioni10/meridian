"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { parseStatement, sha256, transactionHash } from "@/lib/parsers/statement";
import { normalizeDescription } from "@/lib/parsers/text";
import { StatementError, type StatementFormat, type StatementKind } from "@/lib/parsers/types";
import { createClient } from "@/lib/supabase/server";
import { classifyTransaction, type Classification } from "./classify";
import { commitSchema, type CommitInput } from "./schema";

export type PreviewRow = {
  date: string;
  amountCents: number;
  description: string;
  externalId: string | null;
  ordinal: number;
  hash: string;
  duplicate: boolean;
} & Classification;

export type PreviewResult =
  | { status: "error"; message: string }
  | {
      status: "ok";
      fileHash: string;
      filename: string;
      format: StatementFormat;
      kind: StatementKind;
      periodStart: string | null;
      periodEnd: string | null;
      invalidLines: number;
      rows: PreviewRow[];
    };

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function previewStatement(formData: FormData): Promise<PreviewResult> {
  await getCurrentUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Escolha um arquivo." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileHash = sha256(bytes);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("import_batches")
    .select("created_at")
    .eq("file_sha256", fileHash)
    .maybeSingle();
  if (existing) {
    return {
      status: "error",
      message: `Este arquivo já foi importado em ${new Date(existing.created_at).toLocaleDateString("pt-BR")}.`,
    };
  }

  let statement;
  try {
    statement = parseStatement(bytes);
  } catch (e) {
    if (e instanceof StatementError) return { status: "error", message: e.message };
    throw e;
  }

  const [{ data: rules }, { data: categories }, { data: recurring }] = await Promise.all([
    supabase.from("category_rules").select("pattern, category_id"),
    supabase.from("expense_categories").select("id, nature"),
    supabase.from("recurring_expenses").select("id, match_pattern, category_id").eq("active", true),
  ]);

  const hashes = statement.transactions.map((t) => t.hash);
  const externalIds = statement.transactions.map((t) => t.externalId).filter((v): v is string => Boolean(v));
  const known = new Set<string>();
  const knownIds = new Set<string>();
  for (const part of chunks(hashes, 100)) {
    const [exp, inc] = await Promise.all([
      supabase.from("expenses").select("dedupe_hash").in("dedupe_hash", part),
      supabase.from("incomes").select("import_hash").in("import_hash", part),
    ]);
    exp.data?.forEach((r) => r.dedupe_hash && known.add(r.dedupe_hash));
    inc.data?.forEach((r) => r.import_hash && known.add(r.import_hash));
  }
  for (const part of chunks(externalIds, 100)) {
    const { data } = await supabase.from("expenses").select("external_id").in("external_id", part);
    data?.forEach((r) => r.external_id && knownIds.add(r.external_id));
  }

  const ruleInput = (rules ?? []).map((r) => ({ pattern: r.pattern, categoryId: r.category_id }));
  const categoryInput = (categories ?? []).map((c) => ({ id: c.id, nature: c.nature }));
  const recurringInput = (recurring ?? []).map((r) => ({
    id: r.id,
    matchPattern: r.match_pattern,
    categoryId: r.category_id,
  }));

  const existingIncomes = new Map<string, number>();
  if (statement.kind === "account" && statement.periodStart && statement.periodEnd) {
    const { data: incomes } = await supabase
      .from("incomes")
      .select("competence_month, amount_cents")
      .gte("competence_month", `${statement.periodStart.slice(0, 7)}-01`)
      .lte("competence_month", `${statement.periodEnd.slice(0, 7)}-01`)
      .is("import_hash", null);
    for (const i of incomes ?? []) {
      const key = `${i.competence_month.slice(0, 7)}|${i.amount_cents}`;
      existingIncomes.set(key, (existingIncomes.get(key) ?? 0) + 1);
    }
  }

  return {
    status: "ok",
    fileHash,
    filename: file.name.slice(0, 200),
    format: statement.format,
    kind: statement.kind,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    invalidLines: statement.invalidLines,
    rows: statement.transactions.map((t) => {
      const classification = classifyTransaction(t, statement.kind, ruleInput, categoryInput, recurringInput);
      const incomeKey = `${t.date.slice(0, 7)}|${t.amountCents}`;
      const matchesLaunched = classification.action === "income" && (existingIncomes.get(incomeKey) ?? 0) > 0;
      if (matchesLaunched) existingIncomes.set(incomeKey, existingIncomes.get(incomeKey)! - 1);
      return {
        date: t.date,
        amountCents: t.amountCents,
        description: t.description,
        externalId: t.externalId,
        ordinal: t.ordinal,
        hash: t.hash,
        duplicate: known.has(t.hash) || (t.externalId !== null && knownIds.has(t.externalId)),
        ...classification,
        ...(matchesLaunched
          ? { action: "ignore" as const, reason: "Já existe um ganho lançado com este valor neste mês" }
          : {}),
      };
    }),
  };
}

export type CommitResult =
  { status: "error"; message: string } | { status: "ok"; expenses: number; incomes: number; skipped: number };

export async function commitStatement(input: CommitInput): Promise<CommitResult> {
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Dados da importação inválidos." };
  const data = parsed.data;

  const rows = data.rows.filter((r) => r.action !== "ignore");
  for (const row of rows) {
    if (
      transactionHash(row.date, row.amountCents, normalizeDescription(row.description), row.ordinal) !==
      row.hash
    ) {
      return { status: "error", message: "A prévia foi alterada; envie o arquivo de novo." };
    }
  }
  if (rows.some((r) => r.action === "income") && !data.incomeSourceId) {
    return { status: "error", message: "Escolha a fonte de renda para os créditos marcados como ganho." };
  }
  if (rows.length === 0) return { status: "error", message: "Nenhuma linha marcada para importar." };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      user_id: user.id,
      format: data.format,
      filename: data.filename,
      file_sha256: data.fileHash,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      total_rows: rows.length,
    })
    .select("id")
    .single();

  if (batchError) {
    if (batchError.code === "23505") return { status: "error", message: "Este arquivo já foi importado." };
    console.error("[import] batch", { code: batchError.code, message: batchError.message });
    return { status: "error", message: "Não foi possível registrar a importação." };
  }

  const expenses = rows
    .filter((r) => r.action === "expense" && r.amountCents < 0)
    .map((r) => ({
      occurred_on: r.date,
      amount_cents: String(-r.amountCents),
      description: r.description,
      description_normalized: normalizeDescription(r.description),
      dedupe_hash: r.hash,
      external_id: r.externalId ?? "",
      category_id: r.categoryId ?? "",
      recurring_expense_id: r.recurringId ?? "",
      nature: r.nature,
      context: data.context,
    }));
  const incomes = rows
    .filter((r) => r.action === "income" && r.amountCents > 0)
    .map((r) => ({
      source_id: data.incomeSourceId,
      received_on: r.date,
      amount_cents: String(r.amountCents),
      description: r.description,
      import_hash: r.hash,
    }));

  const { data: result, error } = await supabase.rpc("import_statement", {
    p_batch_id: batch.id,
    p_expenses: expenses,
    p_incomes: incomes,
  });
  if (error) {
    console.error("[import] commit", { code: error.code, message: error.message });
    await supabase.from("import_batches").delete().eq("id", batch.id);
    return { status: "error", message: "Não foi possível importar as linhas. Nada foi gravado." };
  }

  const counts = result as { expenses: number; incomes: number };
  refresh();
  return {
    status: "ok",
    expenses: counts.expenses,
    incomes: counts.incomes,
    skipped: rows.length - counts.expenses - counts.incomes,
  };
}

export async function undoImport(id: string) {
  const batchId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("import_batches").delete().eq("id", batchId);
  if (error) throw new Error("Não foi possível desfazer a importação.");
  refresh();
}
