const hoursFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatHours(hours: number | null) {
  return hours === null ? "—" : `${hoursFormat.format(hours)} h`;
}
