const formatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatBRL(cents: number, options: { sign?: boolean } = {}): string {
  const abs = formatter.format(Math.abs(cents) / 100);
  if (cents < 0) return `−${abs}`;
  if (options.sign && cents > 0) return `+${abs}`;
  return abs;
}

export function parseBRL(input: string): number | null {
  const raw = input
    .trim()
    .replace(/\s|R\$/g, "")
    .replace(/^[−–]/, "-");
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(raw)) return null;
  const negative = raw.startsWith("-");
  const [intPart, decPart = ""] = raw.replace("-", "").replace(/\./g, "").split(",");
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}
