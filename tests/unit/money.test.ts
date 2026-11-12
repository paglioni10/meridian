import { describe, expect, it } from "vitest";
import { formatBRL, parseBRL } from "@/lib/money";

describe("formatBRL", () => {
  it("formata milhar e centavos em pt-BR", () => {
    expect(formatBRL(842015)).toBe("8.420,15");
    expect(formatBRL(0)).toBe("0,00");
    expect(formatBRL(5)).toBe("0,05");
  });

  it("usa sinal de menos tipográfico e sinal opcional de mais", () => {
    expect(formatBRL(-18240)).toBe("−182,40");
    expect(formatBRL(190000, { sign: true })).toBe("+1.900,00");
    expect(formatBRL(0, { sign: true })).toBe("0,00");
  });
});

describe("parseBRL", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234", 123400],
    ["0,5", 50],
    ["R$ 35,90", 3590],
    ["-10,00", -1000],
    ["−10,00", -1000],
    ["1.000.000,00", 100000000],
  ])("%s vira %d", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["", "abc", "1,234", "12.34", "1.23,00", "1,2,3", "--1"])("rejeita %s", (input) => {
    expect(parseBRL(input)).toBeNull();
  });
});
