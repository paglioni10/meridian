import {
  cleanDescription,
  normalizeDescription,
  parseCsv,
  parseStatementAmount,
  parseStatementDate,
} from "./text";
import { StatementError, type RawTransaction, type StatementFormat } from "./types";

export type CsvFormat = Exclude<StatementFormat, "ofx">;

export function detectCsvFormat(text: string): CsvFormat | null {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const [header] = parseCsv(firstLine);
  if (!header) return null;
  const cols = header.map((h) => normalizeDescription(h));
  if (cols.includes("data") && cols.includes("valor") && cols.includes("descricao"))
    return "nubank_account_csv";
  if (cols.includes("date") && cols.includes("title") && cols.includes("amount")) return "nubank_card_csv";
  return null;
}

export function parseNubankCsv(text: string, format: CsvFormat): { rows: RawTransaction[]; invalid: number } {
  const [header, ...lines] = parseCsv(text);
  if (!header) throw new StatementError("Arquivo CSV vazio.");
  const cols = header.map((h) => normalizeDescription(h));
  const idx = (name: string) => cols.indexOf(name);

  const map =
    format === "nubank_account_csv"
      ? {
          date: idx("data"),
          amount: idx("valor"),
          description: idx("descricao"),
          id: idx("identificador"),
          sign: 1,
        }
      : { date: idx("date"), amount: idx("amount"), description: idx("title"), id: -1, sign: -1 };

  if (map.date < 0 || map.amount < 0 || map.description < 0) {
    throw new StatementError("Colunas obrigatórias ausentes no CSV.");
  }

  const rows: RawTransaction[] = [];
  let invalid = 0;
  for (const line of lines) {
    const date = parseStatementDate(line[map.date] ?? "");
    const amount = parseStatementAmount(line[map.amount] ?? "");
    const description = cleanDescription(line[map.description] ?? "");
    if (!date || amount === null || amount === 0 || !description) {
      invalid++;
      continue;
    }
    rows.push({
      date,
      amountCents: amount * map.sign,
      description,
      externalId: map.id >= 0 ? (line[map.id] ?? "").trim() || null : null,
    });
  }
  return { rows, invalid };
}
