import { describe, expect, it } from "vitest";
import { contributionInputSchema, goalInputSchema } from "@/features/goals/schema";

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
