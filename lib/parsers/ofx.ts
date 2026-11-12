import { cleanDescription, parseStatementAmount, parseStatementDate } from "./text";
import { StatementError, type RawTransaction, type StatementKind } from "./types";

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  return match ? match[1].trim() : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function isOfx(text: string): boolean {
  return /^\s*OFXHEADER:/i.test(text) || /<OFX>/i.test(text.slice(0, 4000));
}

export function parseOfx(text: string): { kind: StatementKind; rows: RawTransaction[]; invalid: number } {
  if (!/<OFX>/i.test(text)) throw new StatementError("Arquivo OFX sem o bloco <OFX>.");
  const kind: StatementKind = /<(CREDITCARDMSGSRSV1|CCSTMTRS)>/i.test(text) ? "card" : "account";
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const rows: RawTransaction[] = [];
  let invalid = 0;
  for (const chunk of blocks) {
    const block = chunk.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0];
    const date = parseStatementDate(tag(block, "DTPOSTED") ?? "");
    const amount = parseStatementAmount(tag(block, "TRNAMT") ?? "");
    const description = cleanDescription(decodeEntities(tag(block, "MEMO") || tag(block, "NAME") || ""));
    if (!date || amount === null || amount === 0 || !description) {
      invalid++;
      continue;
    }
    rows.push({ date, amountCents: amount, description, externalId: tag(block, "FITID") || null });
  }
  return { kind, rows, invalid };
}
