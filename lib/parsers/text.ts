export function cleanDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeDescription(value: string): string {
  return cleanDescription(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function decodeStatement(bytes: Uint8Array): string {
  const withoutBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(withoutBom);
  } catch {
    return new TextDecoder("windows-1252").decode(withoutBom);
  }
}

export function parseStatementAmount(value: string): number | null {
  const raw = value
    .trim()
    .replace(/\s|R\$/g, "")
    .replace(/^\p{Dash_Punctuation}|^−/u, "-");
  if (!raw) return null;
  const commaDecimal = raw.lastIndexOf(",") > raw.lastIndexOf(".");
  const valid = commaDecimal
    ? /^[-+]?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/
    : /^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;
  if (!valid.test(raw)) return null;
  const numeric = commaDecimal ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  const cents = Math.round(Number(numeric) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function validDate(y: string, m: string, d: string): string | null {
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

export function parseStatementDate(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validDate(m[1], m[2], m[3]);
  m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return validDate(m[3], m[2], m[1]);
  m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return validDate(m[1], m[2], m[3]);
  return null;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}
