import { describe, expect, it } from "vitest";
import { normalizeNotePath, obsidianUri } from "@/lib/obsidian";

describe("obsidianUri", () => {
  it("monta o link com vault e arquivo", () => {
    expect(obsidianUri("Estudos", "Docker")).toBe("obsidian://open?vault=Estudos&file=Docker");
  });

  it("codifica espaços como %20, não como +", () => {
    expect(obsidianUri("Meu Vault", "Docker avançado")).toBe(
      "obsidian://open?vault=Meu%20Vault&file=Docker%20avan%C3%A7ado",
    );
  });

  it("codifica subpastas, #, & e ?", () => {
    expect(obsidianUri("Estudos", "Cursos/C# & .NET?")).toBe(
      "obsidian://open?vault=Estudos&file=Cursos%2FC%23%20%26%20.NET%3F",
    );
  });
});

describe("normalizeNotePath", () => {
  it.each([
    ["Cursos/Docker.md", "Cursos/Docker"],
    ["  /Cursos//Docker/ ", "Cursos/Docker"],
    ["Cursos\\Docker", "Cursos/Docker"],
    ["Notas.MD", "Notas"],
  ])("%s vira %s", (input, expected) => {
    expect(normalizeNotePath(input)).toBe(expected);
  });
});
