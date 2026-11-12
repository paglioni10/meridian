import { createHash } from "node:crypto";
import { detectCsvFormat, parseNubankCsv } from "./nubank-csv";
import { isOfx, parseOfx } from "./ofx";
import { decodeStatement, normalizeDescription } from "./text";
import {
  StatementError,
  type ParsedStatement,
  type ParsedTransaction,
  type RawTransaction,
  type StatementFormat,
  type StatementKind,
} from "./types";

export const MAX_STATEMENT_BYTES = 2 * 1024 * 1024;
export const MAX_STATEMENT_ROWS = 3000;

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function transactionHash(
  date: string,
  amountCents: number,
  normalized: string,
  ordinal: number,
): string {
  return sha256(`${date}|${amountCents}|${normalized}|${ordinal}`);
}

export function withHashes(rows: RawTransaction[]): ParsedTransaction[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const normalized = normalizeDescription(row.description);
    const key = `${row.date}|${row.amountCents}|${normalized}`;
    const ordinal = seen.get(key) ?? 0;
    seen.set(key, ordinal + 1);
    return {
      ...row,
      normalized,
      ordinal,
      hash: transactionHash(row.date, row.amountCents, normalized, ordinal),
    };
  });
}

export function parseStatement(bytes: Uint8Array): ParsedStatement {
  if (bytes.byteLength === 0) throw new StatementError("O arquivo está vazio.");
  if (bytes.byteLength > MAX_STATEMENT_BYTES) throw new StatementError("O arquivo passa de 2 MB.");
  const text = decodeStatement(bytes);

  let format: StatementFormat;
  let kind: StatementKind;
  let rows: RawTransaction[];
  let invalid: number;

  if (isOfx(text)) {
    const ofx = parseOfx(text);
    format = "ofx";
    kind = ofx.kind;
    rows = ofx.rows;
    invalid = ofx.invalid;
  } else {
    const csvFormat = detectCsvFormat(text);
    if (!csvFormat) {
      throw new StatementError("Formato não reconhecido. Envie o OFX ou o CSV exportado pelo app do Nubank.");
    }
    const csv = parseNubankCsv(text, csvFormat);
    format = csvFormat;
    kind = csvFormat === "nubank_card_csv" ? "card" : "account";
    rows = csv.rows;
    invalid = csv.invalid;
  }

  if (rows.length === 0) throw new StatementError("Nenhuma transação encontrada no arquivo.");
  if (rows.length > MAX_STATEMENT_ROWS) {
    throw new StatementError(`O arquivo tem mais de ${MAX_STATEMENT_ROWS} transações; divida por período.`);
  }

  const dates = rows.map((r) => r.date).sort();
  return {
    format,
    kind,
    invalidLines: invalid,
    transactions: withHashes(rows),
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
  };
}
