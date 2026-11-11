import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowlist, safeNextPath } from "@/lib/allowlist";

describe("parseAllowlist", () => {
  it("aceita vírgula, ponto e vírgula e espaços", () => {
    expect([...parseAllowlist("a@x.com, B@x.com;c@x.com  d@x.com")]).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("retorna vazio para entrada ausente", () => {
    expect(parseAllowlist(undefined).size).toBe(0);
    expect(parseAllowlist("").size).toBe(0);
  });
});

describe("isAllowedEmail", () => {
  it("ignora caixa e espaços", () => {
    expect(isAllowedEmail("  A@X.com ", "a@x.com")).toBe(true);
  });

  it("rejeita e-mail fora da lista, vazio ou lista vazia", () => {
    expect(isAllowedEmail("z@x.com", "a@x.com")).toBe(false);
    expect(isAllowedEmail("", "a@x.com")).toBe(false);
    expect(isAllowedEmail(null, "a@x.com")).toBe(false);
    expect(isAllowedEmail("a@x.com", "")).toBe(false);
  });

  it("não aceita correspondência parcial", () => {
    expect(isAllowedEmail("a@x.com.evil", "a@x.com")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("mantém caminhos internos", () => {
    expect(safeNextPath("/financas/ganhos")).toBe("/financas/ganhos");
  });

  it("bloqueia redirecionamento aberto", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});
