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
