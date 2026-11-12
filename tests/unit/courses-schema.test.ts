import { describe, expect, it } from "vitest";
import { courseInputSchema, filtersSchema } from "@/features/courses/schema";

const base = {
  id: "",
  title: "Docker avançado",
  url: "",
  provider: "",
  category: "",
  context: "personal",
  priority: "high",
  status: "backlog",
  estimated_hours: "",
  progress_pct: "0",
  obsidian_note: "",
};

describe("courseInputSchema", () => {
  it("converte vazios em null e id vazio em undefined", () => {
    const r = courseInputSchema.parse(base);
    expect(r.id).toBeUndefined();
    expect(r.url).toBeNull();
    expect(r.estimated_hours).toBeNull();
    expect(r.progress_pct).toBe(0);
  });

  it("aceita horas com vírgula e arredonda para 1 casa", () => {
    expect(courseInputSchema.parse({ ...base, estimated_hours: "12,25" }).estimated_hours).toBe(12.3);
  });

  it.each([
    ["title", "   ", "Informe o título"],
    ["url", "javascript:alert(1)", "Use um link http:// ou https://"],
    ["url", "ftp://x.com", "Use um link http:// ou https://"],
    ["estimated_hours", "0", "Use um número de horas maior que zero"],
    ["estimated_hours", "abc", "Use um número de horas maior que zero"],
    ["progress_pct", "101", "Máximo 100"],
    ["priority", "urgent", "Prioridade inválida"],
  ])("rejeita %s = %s", (field, value, message) => {
    const r = courseInputSchema.safeParse({ ...base, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(message);
  });
});

describe("filtersSchema", () => {
  it("usa Abertos por padrão e ignora valores inválidos", () => {
    expect(filtersSchema.parse({})).toEqual({ status: "abertos" });
    expect(
      filtersSchema.parse({ status: "xyz", categoria: "nope", prioridade: "urgent", horas: "-3" }),
    ).toEqual({
      status: "abertos",
    });
  });

  it("lê horas com vírgula e o primeiro valor repetido", () => {
    const r = filtersSchema.parse({ horas: "7,5", status: ["concluidos", "todos"] });
    expect(r.horas).toBe(7.5);
    expect(r.status).toBe("concluidos");
  });
});
