import { describe, expect, it } from "vitest";
import { incomeInputSchema, rangeSchema, sourceInputSchema } from "@/features/income/schema";
import { currentMonthISO, formatMonthLong, formatMonthShort, paydayISO, todayISO } from "@/lib/dates";

const SOURCE = "aaaaaaaa-0000-4000-8000-000000000001";

const income = {
  id: "",
  source_id: SOURCE,
  competence_month: "2026-11",
  received_on: "2026-11-05",
  amount_cents: "5.200,00",
  gross_cents: "",
  description: "",
};

describe("incomeInputSchema", () => {
  it("converte mês, valores e vazios", () => {
    expect(incomeInputSchema.parse(income)).toEqual({
      id: undefined,
      source_id: SOURCE,
      competence_month: "2026-11-01",
      received_on: "2026-11-05",
      amount_cents: 520000,
      gross_cents: null,
      description: null,
    });
  });

  it.each([
    ["amount_cents", "", "Informe o valor líquido"],
    ["amount_cents", "-10", "Use um valor positivo, ex.: 1.234,56"],
    ["amount_cents", "abc", "Use um valor positivo, ex.: 1.234,56"],
    ["competence_month", "2026-13", "Escolha o mês de competência"],
    ["source_id", "", "Escolha a fonte"],
    ["received_on", "05/11/2026", "Data inválida"],
  ])("rejeita %s = %s", (field, value, message) => {
    const r = incomeInputSchema.safeParse({ ...income, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(message);
  });

  it("rejeita bruto menor que o líquido no campo do bruto", () => {
    const r = incomeInputSchema.safeParse({ ...income, gross_cents: "1.000,00" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["gross_cents"]);
  });
});

describe("sourceInputSchema", () => {
  const source = {
    id: "",
    name: "Empresa X",
    kind: "guaranteed",
    context: "work",
    default_amount_cents: "",
    payday: "",
    active: "on",
  };

  it("aceita fonte sem valor padrão nem dia", () => {
    expect(sourceInputSchema.parse(source)).toMatchObject({
      default_amount_cents: null,
      payday: null,
      active: true,
    });
  });

  it("checkbox desmarcado vira inativa", () => {
    expect(sourceInputSchema.parse({ ...source, active: "" }).active).toBe(false);
  });

  it.each(["0", "32", "1.5"])("rejeita dia %s", (payday) => {
    expect(sourceInputSchema.safeParse({ ...source, payday }).success).toBe(false);
  });
});

describe("rangeSchema", () => {
  it.each([
    ["6", 6],
    ["24", 24],
    [undefined, 12],
    ["7", 12],
    [["24", "6"], 24],
  ])("%s vira %d", (input, expected) => {
    expect(rangeSchema.parse(input)).toBe(expected);
  });
});

describe("datas de competência", () => {
  it("usa o fuso de São Paulo na virada do mês", () => {
    const utcNextMonth = new Date("2026-12-01T02:00:00Z");
    expect(currentMonthISO(utcNextMonth)).toBe("2026-11-01");
    expect(todayISO(utcNextMonth)).toBe("2026-11-30");
  });

  it("dia de pagamento cabe no mês", () => {
    expect(paydayISO("2026-02-01", 31)).toBe("2026-02-28");
    expect(paydayISO("2028-02-01", 30)).toBe("2028-02-29");
    expect(paydayISO("2026-11-01", 5)).toBe("2026-11-05");
  });

  it("formata meses", () => {
    expect(formatMonthShort("2026-03-01")).toBe("mar/26");
    expect(formatMonthLong("2026-03-01")).toBe("Março 2026");
  });
});
