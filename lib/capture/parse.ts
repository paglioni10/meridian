import { parseBRL } from "@/lib/money";

export type CaptureContext = "personal" | "work" | "freelance";
export type CapturePriority = "low" | "medium" | "high" | "critical";

export type ParsedCapture =
  | {
      kind: "expense";
      context: CaptureContext | null;
      amount_cents: number;
      description: string;
      tag: string | null;
      date: string | null;
    }
  | {
      kind: "income";
      context: CaptureContext | null;
      amount_cents: number;
      description: string;
      date: string | null;
    }
  | {
      kind: "task";
      context: CaptureContext | null;
      title: string;
      priority: CapturePriority;
      due_on: string | null;
    }
  | { kind: "link"; context: CaptureContext | null; url: string; title: string | null }
  | { kind: "goal"; context: CaptureContext | null; title: string; target_cents: number | null }
  | { kind: "investment"; context: CaptureContext | null; amount_cents: number; asset: string }
  | { kind: "idea"; context: CaptureContext | null; text: string };

const CONTEXTS: Record<string, CaptureContext> = {
  pessoal: "personal",
  trabalho: "work",
  freelance: "freelance",
  freela: "freelance",
};

const PRIORITIES: Record<string, CapturePriority> = {
  baixa: "low",
  media: "medium",
  normal: "medium",
  alta: "high",
  urgente: "critical",
  critica: "critical",
};

const WEEKDAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

function strip(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function parseWhen(token: string, today: string): string | null {
  const t = strip(token);
  if (t === "hoje") return today;
  if (t === "amanha") return addDays(today, 1);
  const weekday = WEEKDAYS.findIndex((w) => t === w || t === `${w}-feira`);
  if (weekday >= 0) {
    const current = new Date(`${today}T00:00:00Z`).getUTCDay();
    const diff = (weekday - current + 7) % 7 || 7;
    return addDays(today, diff);
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
    const candidate = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (!m[3] && candidate(year) < today) year += 1;
    const iso = candidate(year);
    const check = new Date(`${iso}T00:00:00Z`);
    return check.getUTCDate() === day ? iso : null;
  }
  return null;
}

function splitMoney(rest: string): { cents: number | null; text: string } {
  const m = rest.match(/^(?:r\$\s*)?(\d[\d.]*(?:,\d{1,2})?)\b\s*(.*)$/i);
  if (!m) return { cents: null, text: rest };
  const cents = parseBRL(m[1]);
  return { cents: cents && cents > 0 ? cents : null, text: m[2] };
}

export function parseCapture(raw: string, today: string): ParsedCapture {
  let text = raw.trim().replace(/\s+/g, " ");
  let context: CaptureContext | null = null;
  let priority: CapturePriority | null = null;
  let when: string | null = null;
  let tag: string | null = null;

  text = text
    .split(" ")
    .filter((word) => {
      const lower = strip(word);
      if (lower.startsWith("@") && CONTEXTS[lower.slice(1)]) {
        context = CONTEXTS[lower.slice(1)];
        return false;
      }
      if (lower.startsWith("!") && PRIORITIES[lower.slice(1)]) {
        priority = PRIORITIES[lower.slice(1)];
        return false;
      }
      if (word.startsWith("^")) {
        const parsed = parseWhen(word.slice(1), today);
        if (parsed) {
          when = parsed;
          return false;
        }
      }
      if (word.startsWith("#") && word.length > 1 && !tag) {
        tag = word.slice(1);
        return false;
      }
      return true;
    })
    .join(" ")
    .trim();

  const url = text.match(/https?:\/\/\S+/i)?.[0] ?? null;

  if (/^\$\s*/.test(text)) {
    const { cents, text: description } = splitMoney(text.replace(/^\$\s*/, ""));
    if (cents && description)
      return { kind: "expense", context, amount_cents: cents, description, tag, date: when };
  }
  if (/^\+\s*/.test(text)) {
    const { cents, text: description } = splitMoney(text.replace(/^\+\s*/, ""));
    if (cents)
      return {
        kind: "income",
        context,
        amount_cents: cents,
        description: description || "Ganho",
        date: when,
      };
  }
  if (/^t:\s*/i.test(text)) {
    const title = text.replace(/^t:\s*/i, "").trim();
    if (title) return { kind: "task", context, title, priority: priority ?? "medium", due_on: when };
  }
  if (/^m:\s*/i.test(text)) {
    const body = text.replace(/^m:\s*/i, "").trim();
    const m = body.match(/^(.*?)\s+(?:r\$\s*)?(\d[\d.]*(?:,\d{1,2})?)$/i);
    const cents = m ? parseBRL(m[2]) : null;
    const title = (m && cents ? m[1] : body).trim();
    if (title) return { kind: "goal", context, title, target_cents: m && cents ? cents : null };
  }
  if (/^a:\s*/i.test(text)) {
    const { cents, text: asset } = splitMoney(text.replace(/^a:\s*/i, ""));
    if (cents && asset) return { kind: "investment", context, amount_cents: cents, asset: asset.trim() };
  }
  if (url) {
    const title = text.replace(url, "").trim();
    return { kind: "link", context, url, title: title || null };
  }
  return { kind: "idea", context, text: raw.trim().replace(/\s+/g, " ") };
}

export const KIND_LABELS: Record<ParsedCapture["kind"], string> = {
  expense: "Despesa",
  income: "Ganho",
  task: "Tarefa",
  link: "Link",
  goal: "Objetivo",
  investment: "Aporte",
  idea: "Ideia",
};
