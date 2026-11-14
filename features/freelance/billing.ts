export type ReminderStatus = "late" | "today" | "soon" | "later";

export function daysUntil(today: string, date: string): number {
  return Math.round(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

export function reminderStatus(remindOn: string, today: string): ReminderStatus {
  const days = daysUntil(today, remindOn);
  if (days < 0) return "late";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

export function nextMonthly(remindOn: string, dayOfMonth: number): string {
  const [y, m] = remindOn.split("-").map(Number);
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, last);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function billingAlert(
  reminder: { id: string; remind_on: string },
  today: string,
): { dedupe: string; daysLate: number } | null {
  const daysLate = daysUntil(reminder.remind_on, today);
  if (daysLate < 0) return null;
  return {
    dedupe: `billing:${reminder.id}:${reminder.remind_on}:w${Math.floor(daysLate / 7)}`,
    daysLate,
  };
}
