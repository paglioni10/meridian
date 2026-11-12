import { describe, expect, it } from "vitest";
import { applyContext, isAppContext } from "@/lib/context";
import { isThemePreference } from "@/lib/theme";

class FakeQuery {
  filters: Array<[string, string]> = [];
  eq(column: string, value: string) {
    this.filters.push([column, value]);
    return this;
  }
}

describe("contexto", () => {
  it("valida valores", () => {
    expect(isAppContext("freelance")).toBe(true);
    expect(isAppContext("all")).toBe(true);
    expect(isAppContext("other")).toBe(false);
    expect(isAppContext(undefined)).toBe(false);
  });

  it("não filtra em Tudo", () => {
    expect(applyContext(new FakeQuery(), "all").filters).toEqual([]);
  });

  it("filtra pela coluna de contexto", () => {
    expect(applyContext(new FakeQuery(), "work").filters).toEqual([["context", "work"]]);
    expect(applyContext(new FakeQuery(), "personal", "ctx").filters).toEqual([["ctx", "personal"]]);
  });
});

describe("tema", () => {
  it("valida preferência", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("blue")).toBe(false);
  });
});
