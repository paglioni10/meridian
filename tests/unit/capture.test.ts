import { describe, expect, it } from "vitest";
import { parseCapture, parseWhen } from "@/lib/capture/parse";

const today = "2026-11-18";

describe("parseCapture", () => {
  it("despesa com e sem centavos, tag e contexto", () => {
    expect(parseCapture("$ 35,90 almoço #alimentacao", today)).toEqual({
      kind: "expense",
      context: null,
      amount_cents: 3590,
      description: "almoço",
      tag: "alimentacao",
      date: null,
    });
    expect(parseCapture("$35 uber @trabalho", today)).toMatchObject({
      kind: "expense",
      amount_cents: 3500,
      context: "work",
    });
  });

  it("ganho", () => {
    expect(parseCapture("+ 1.200 site cliente X @freelance", today)).toEqual({
      kind: "income",
      context: "freelance",
      amount_cents: 120000,
      description: "site cliente X",
      date: null,
    });
  });

  it("tarefa com prioridade e prazo", () => {
    expect(parseCapture("t: revisar proposta !alta ^sexta", today)).toEqual({
      kind: "task",
      context: null,
      title: "revisar proposta",
      priority: "high",
      due_on: "2026-11-20",
    });
    expect(parseCapture("t: ligar", today)).toMatchObject({ priority: "medium", due_on: null });
  });

  it("link, objetivo e aporte", () => {
    expect(parseCapture("https://curso.dev/next curso de next", today)).toEqual({
      kind: "link",
      context: null,
      url: "https://curso.dev/next",
      title: "curso de next",
    });
    expect(parseCapture("m: notebook 750", today)).toEqual({
      kind: "goal",
      context: null,
      title: "notebook",
      target_cents: 75000,
    });
    expect(parseCapture("m: aprender piano", today)).toMatchObject({
      title: "aprender piano",
      target_cents: null,
    });
    expect(parseCapture("a: 500 ivvb11", today)).toEqual({
      kind: "investment",
      context: null,
      amount_cents: 50000,
      asset: "ivvb11",
    });
  });

  it("entradas ambíguas viram ideia", () => {
    expect(parseCapture("$ almoço sem valor", today).kind).toBe("idea");
    expect(parseCapture("t:", today).kind).toBe("idea");
    expect(parseCapture("lembrar de #comprar pão", today)).toMatchObject({
      kind: "idea",
      text: "lembrar de #comprar pão",
    });
    expect(parseCapture("@inexistente algo", today)).toMatchObject({
      kind: "idea",
      text: "@inexistente algo",
    });
  });
});

describe("parseWhen", () => {
  it("dias relativos e datas", () => {
    expect(parseWhen("hoje", today)).toBe(today);
    expect(parseWhen("amanhã", today)).toBe("2026-11-19");
    expect(parseWhen("quarta", today)).toBe("2026-11-25");
    expect(parseWhen("25/12", today)).toBe("2026-12-25");
    expect(parseWhen("10/01", today)).toBe("2027-01-10");
    expect(parseWhen("31/02", today)).toBeNull();
    expect(parseWhen("xyz", today)).toBeNull();
  });
});
