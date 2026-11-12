import { describe, expect, it } from "vitest";
import {
  contributionInputSchema,
  describeDistance,
  goalInputSchema,
  horizonForDate,
} from "@/features/goals/schema";

const goal = {
  id: "",
  title: "Notebook novo",
  description: "",
  horizon: "short",
  context: "personal",
  target_cents: "750,00",
  target_date: "2027-01-31",
  milestones: "Pesquisar modelos\r\n\r\n  Juntar 50%  \nComprar",
};

describe("goalInputSchema", () => {
  it("converte valor, data e marcos (um por linha, sem vazios)", () => {
    expect(goalInputSchema.parse(goal)).toEqual({
      id: undefined,
      title: "Notebook novo",
      description: null,
      horizon: "short",
      context: "personal",
      target_cents: 75000,
      target_date: "2027-01-31",
      milestones: ["Pesquisar modelos", "Juntar 50%", "Comprar"],
    });
  });

  it("aceita objetivo sem valor e sem data", () => {
    const r = goalInputSchema.parse({ ...goal, target_cents: "", target_date: "", milestones: "" });
    expect([r.target_cents, r.target_date, r.milestones]).toEqual([null, null, []]);
  });

  it.each([
    ["title", "", "Informe o objetivo"],
    ["horizon", "eterno", "Escolha o prazo"],
    ["target_cents", "0", "Use um valor positivo, ex.: 1.234,56"],
    ["target_date", "31/01/2027", "Data inválida"],
  ])("rejeita %s = %s", (field, value, message) => {
    const r = goalInputSchema.safeParse({ ...goal, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(message);
  });

  it("limita a 20 marcos", () => {
    const many = Array.from({ length: 21 }, (_, i) => `Marco ${i}`).join("\n");
    expect(goalInputSchema.safeParse({ ...goal, milestones: many }).success).toBe(false);
  });
});

describe("contributionInputSchema", () => {
  const base = {
    goal_id: "aaaaaaaa-0000-4000-8000-000000000001",
    direction: "deposit",
    amount_cents: "200",
    contributed_on: "2026-11-12",
    note: "",
  };

  it("valor sempre positivo; o sinal vem da direção", () => {
    expect(contributionInputSchema.parse(base)).toMatchObject({
      amount_cents: 20000,
      direction: "deposit",
      note: null,
    });
    expect(contributionInputSchema.parse({ ...base, direction: "withdraw" }).amount_cents).toBe(20000);
  });

  it.each([
    ["amount_cents", "", "Informe o valor"],
    ["amount_cents", "-50", "Use um valor positivo, ex.: 1.234,56"],
    ["contributed_on", "", "Informe a data"],
  ])("rejeita %s = %s", (field, value, message) => {
    const r = contributionInputSchema.safeParse({ ...base, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(message);
  });
});

describe("prazo personalizado", () => {
  it("exige a data e encaixa na faixa pela distância", () => {
    const missing = goalInputSchema.safeParse({ ...goal, horizon: "custom", target_date: "" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]).toMatchObject({
      path: ["target_date"],
      message: "Escolha a data do prazo personalizado",
    });
    const far = goalInputSchema.parse({ ...goal, horizon: "custom", target_date: "2099-01-01" });
    expect(far.horizon).toBe("long");
  });

  it("faixa escolhida manualmente prevalece sobre a data", () => {
    expect(goalInputSchema.parse({ ...goal, horizon: "long", target_date: "2027-01-31" }).horizon).toBe(
      "long",
    );
  });

  it.each([
    ["2026-12-01", "short"],
    ["2027-11-12", "short"],
    ["2027-11-13", "medium"],
    ["2029-11-12", "medium"],
    ["2029-12-01", "long"],
    ["2026-01-01", "short"],
  ] as const)("%s a partir de 12/11/2026 é %s", (date, horizon) => {
    expect(horizonForDate(date, "2026-11-12")).toBe(horizon);
  });

  it.each([
    ["2028-03-12", "em 1 ano e 4 meses"],
    ["2027-11-12", "em 1 ano"],
    ["2027-02-12", "em 3 meses"],
    ["2026-11-30", "este mês"],
    ["2026-10-01", "data já passou"],
  ])("%s → %s", (date, text) => {
    expect(describeDistance(date, "2026-11-12")).toBe(text);
  });
});
