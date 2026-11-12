import { describe, expect, it } from "vitest";
import { dayOfYear, formatDayMonth, formatEditionMeta, formatEditionTitle } from "@/lib/dates";

describe("datas da edição", () => {
  const monday = new Date("2026-11-09T15:00:00Z");

  it("dia do ano no fuso de São Paulo", () => {
    expect(dayOfYear(monday)).toBe(313);
    expect(dayOfYear(new Date("2026-01-01T02:00:00Z"))).toBe(365);
    expect(dayOfYear(new Date("2026-01-01T03:30:00Z"))).toBe(1);
  });

  it("título sem -feira e com inicial maiúscula", () => {
    expect(formatEditionTitle(monday)).toBe("Segunda, 9 de novembro");
  });

  it("metadado da edição", () => {
    expect(formatEditionMeta(monday)).toBe("Edição 313 · Nov 2026");
  });

  it("data curta dd/mm sem deslocar o dia", () => {
    expect(formatDayMonth("2026-11-07")).toBe("07/11");
  });
});
