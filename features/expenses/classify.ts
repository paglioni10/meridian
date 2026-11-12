import type { StatementKind } from "@/lib/parsers/types";

export type RowAction = "expense" | "income" | "ignore";
export type Nature = "fixed" | "variable";

export type RuleInput = { pattern: string; categoryId: string };
export type CategoryInput = { id: string; nature: Nature };
export type RecurringInput = { id: string; matchPattern: string | null; categoryId: string | null };

export type Classification = {
  action: RowAction;
  reason: string | null;
  categoryId: string | null;
  recurringId: string | null;
  nature: Nature;
};

const IGNORE_DEBITS: Array<[RegExp, string]> = [
  [
    /pagamento de fatura|pagamento da fatura/,
    "Pagamento da fatura do cartão: as compras já entram pelo extrato do cartão",
  ],
  [/aplicacao|resgate|caixinha|rdb|investimento/, "Movimentação de investimento"],
];

const IGNORE_CREDITS: Array<[RegExp, string]> = [
  [/estorno|reembolso|devolucao/, "Estorno: não é renda"],
  [/resgate|caixinha|rdb|investimento/, "Resgate de investimento: não é renda"],
];

export function matchRule(normalized: string, rules: RuleInput[]): string | null {
  const sorted = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);
  return sorted.find((r) => normalized.includes(r.pattern))?.categoryId ?? null;
}

export function classifyTransaction(
  tx: { amountCents: number; normalized: string },
  kind: StatementKind,
  rules: RuleInput[],
  categories: CategoryInput[],
  recurring: RecurringInput[],
): Classification {
  const isCredit = tx.amountCents > 0;

  if (isCredit) {
    if (kind === "card") {
      return {
        action: "ignore",
        reason: "Pagamento ou estorno na fatura do cartão",
        categoryId: null,
        recurringId: null,
        nature: "variable",
      };
    }
    const ignored = IGNORE_CREDITS.find(([re]) => re.test(tx.normalized));
    return {
      action: ignored ? "ignore" : "income",
      reason: ignored ? ignored[1] : null,
      categoryId: null,
      recurringId: null,
      nature: "variable",
    };
  }

  if (kind === "account") {
    const ignored = IGNORE_DEBITS.find(([re]) => re.test(tx.normalized));
    if (ignored) {
      return {
        action: "ignore",
        reason: ignored[1],
        categoryId: null,
        recurringId: null,
        nature: "variable",
      };
    }
  }

  const fixed = recurring.find((r) => r.matchPattern && tx.normalized.includes(r.matchPattern));
  const categoryId = matchRule(tx.normalized, rules) ?? fixed?.categoryId ?? null;
  const categoryNature = categories.find((c) => c.id === categoryId)?.nature ?? "variable";

  return {
    action: "expense",
    reason: null,
    categoryId,
    recurringId: fixed?.id ?? null,
    nature: fixed ? "fixed" : categoryNature,
  };
}

export const DEFAULT_CATEGORIES: Array<{ name: string; nature: Nature; patterns: string[] }> = [
  {
    name: "Moradia",
    nature: "fixed",
    patterns: [
      "aluguel",
      "condominio",
      "imobiliaria",
      "enel",
      "sabesp",
      "copel",
      "cemig",
      "light s",
      "comgas",
    ],
  },
  {
    name: "Assinaturas",
    nature: "fixed",
    patterns: [
      "netflix",
      "spotify",
      "amazon prime",
      "disney",
      "youtube",
      "icloud",
      "google one",
      "hbo",
      "globoplay",
    ],
  },
  {
    name: "Mercado",
    nature: "variable",
    patterns: ["supermercado", "mercado", "atacadao", "carrefour", "assai", "pao de acucar", "hortifruti"],
  },
  {
    name: "Alimentação",
    nature: "variable",
    patterns: ["ifood", "rappi", "restaurante", "lanchonete", "padaria", "cafe", "pizzaria", "burger"],
  },
  {
    name: "Transporte",
    nature: "variable",
    patterns: [
      "uber",
      "99app",
      "99 pop",
      "posto",
      "combustivel",
      "shell",
      "ipiranga",
      "estacionamento",
      "sem parar",
    ],
  },
  {
    name: "Saúde",
    nature: "variable",
    patterns: [
      "farmacia",
      "drogaria",
      "drogasil",
      "raia",
      "pague menos",
      "hospital",
      "clinica",
      "laboratorio",
      "unimed",
    ],
  },
  {
    name: "Tecnologia",
    nature: "variable",
    patterns: [
      "hetzner",
      "vercel",
      "github",
      "registro.br",
      "cloudflare",
      "openai",
      "anthropic",
      "digitalocean",
    ],
  },
  {
    name: "Educação",
    nature: "variable",
    patterns: ["udemy", "alura", "coursera", "livraria", "escola", "faculdade"],
  },
  {
    name: "Compras",
    nature: "variable",
    patterns: ["amazon", "mercadolivre", "mercado livre", "shopee", "magalu", "aliexpress"],
  },
  { name: "Lazer", nature: "variable", patterns: ["cinema", "ingresso", "steam", "playstation"] },
  { name: "Taxas", nature: "variable", patterns: ["iof", "juros", "tarifa", "anuidade", "multa"] },
  { name: "Outros", nature: "variable", patterns: [] },
];
