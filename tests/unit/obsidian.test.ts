import { describe, expect, it } from "vitest";
import { normalizeCourseLinks } from "@/features/courses/schema";
import { noteFromObsidianLink, normalizeNotePath, obsidianUri } from "@/lib/obsidian";

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

describe("noteFromObsidianLink", () => {
  it.each([
    ["obsidian://open?vault=Estudos&file=Cursos%2FDocker%20avan%C3%A7ado", "Cursos/Docker avançado"],
    ["obsidian://open?vault=Estudos&file=Cursos/Docker.md", "Cursos/Docker"],
    ["obsidian://Cursos/Docker avançado", "Cursos/Docker avançado"],
    ["obsidian://Cursos/Docker avançado →", "Cursos/Docker avançado"],
    ["obsidian://vault/Estudos/Cursos/Docker", "Cursos/Docker"],
    ["obsidian://adv-uri?vault=Estudos&filepath=Cursos%2FDocker.md", "Cursos/Docker"],
    ["  OBSIDIAN://open?file=C%2B%2B&vault=x", "C++"],
  ])("%s → %s", (input, expected) => {
    expect(noteFromObsidianLink(input)).toBe(expected);
  });

  it.each(["https://udemy.com", "obsidian://open?vault=Estudos", "obsidian://", ""])("ignora %s", (input) => {
    expect(noteFromObsidianLink(input)).toBeNull();
  });

  it("roundtrip com obsidianUri", () => {
    const note = "Cursos/C# & .NET?";
    expect(noteFromObsidianLink(obsidianUri("Meu Vault", note))).toBe(note);
  });
});

describe("normalizeCourseLinks", () => {
  it("move link do Obsidian colado no campo do site para a nota vazia", () => {
    expect(
      normalizeCourseLinks({ url: "obsidian://Cursos/Docker avançado", obsidian_note: "" }),
    ).toMatchObject({
      url: "",
      obsidian_note: "Cursos/Docker avançado",
    });
  });

  it("não sobrescreve uma nota já preenchida, mas limpa o campo do site", () => {
    expect(normalizeCourseLinks({ url: "obsidian://Cursos/X", obsidian_note: "testando" })).toMatchObject({
      url: "",
      obsidian_note: "testando",
    });
  });

  it("converte link colado no campo da nota e normaliza o caminho", () => {
    expect(
      normalizeCourseLinks({
        url: "https://udemy.com/x",
        obsidian_note: "obsidian://open?vault=E&file=A%2FB.md",
      }),
    ).toMatchObject({ url: "https://udemy.com/x", obsidian_note: "A/B" });
    expect(normalizeCourseLinks({ url: "", obsidian_note: " /Cursos/Docker.md " }).obsidian_note).toBe(
      "Cursos/Docker",
    );
  });
});
