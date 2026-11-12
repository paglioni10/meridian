export type StatementFormat = "ofx" | "nubank_account_csv" | "nubank_card_csv";
export type StatementKind = "account" | "card";

export type RawTransaction = {
  date: string;
  amountCents: number;
  description: string;
  externalId: string | null;
};

export type ParsedTransaction = RawTransaction & {
  ordinal: number;
  normalized: string;
  hash: string;
};

export type ParsedStatement = {
  format: StatementFormat;
  kind: StatementKind;
  transactions: ParsedTransaction[];
  periodStart: string | null;
  periodEnd: string | null;
  invalidLines: number;
};

export class StatementError extends Error {}
