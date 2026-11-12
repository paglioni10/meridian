export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function parts(date: Date, timeZone: string) {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

export function dayOfYear(date: Date, timeZone = DEFAULT_TIMEZONE): number {
  const { year, month, day } = parts(date, timeZone);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
}

export function formatEditionTitle(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const text = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "long", day: "numeric", month: "long" })
    .format(date)
    .replace("-feira", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatEditionMeta(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const month = new Intl.DateTimeFormat("pt-BR", { timeZone, month: "short" }).format(date).replace(".", "");
  const { year } = parts(date, timeZone);
  return `Edição ${dayOfYear(date, timeZone)} · ${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}

export function formatDayMonth(value: string | Date, timeZone = DEFAULT_TIMEZONE): string {
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00Z`)
      : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit" }).format(date);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function todayISO(date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const { year, month, day } = parts(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function currentMonthISO(date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const { year, month } = parts(date, timeZone);
  return `${year}-${pad(month)}-01`;
}

export function paydayISO(monthISO: string, payday: number): string {
  const [year, month] = monthISO.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(payday, last))}`;
}

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function formatMonthShort(monthISO: string): string {
  const [year, month] = monthISO.split("-").map(Number);
  return `${MONTHS_SHORT[month - 1]}/${String(year).slice(2)}`;
}

export function formatMonthLong(monthISO: string): string {
  const [year, month] = monthISO.split("-").map(Number);
  const name = MONTHS_LONG[month - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}
