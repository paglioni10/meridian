import { describe, expect, it } from "vitest";
import { clientInputSchema, dealInputSchema, winInputSchema } from "@/features/freelance/schema";
import { boardFiltersSchema, projectInputSchema, taskInputSchema } from "@/features/projects/schema";

const UUID = "aaaaaaaa-0000-4000-8000-000000000001";

describe("taskInputSchema", () => {
  const task = {
    id: "",
    title: "Revisar proposta",
    description: "",
    project_id: "",
    context: "freelance",
    priority: "high",
    status: "todo",
    due_on: "",
  };

  it("vazios viram null", () => {
    expect(taskInputSchema.parse(task)).toMatchObject({ project_id: null, description: null, due_on: null });
  });

  it.each([
    ["title", " ", "Informe a tarefa"],
    ["status", "review", "Status inválido"],
    ["project_id", "abc", "Opção inválida"],
    ["due_on", "20/11/2026", "Data inválida"],
  ])("rejeita %s = %s", (field, value, message) => {
    const r = taskInputSchema.safeParse({ ...task, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(message);
  });
});

describe("projectInputSchema e filtros", () => {
  it("aceita projeto mínimo", () => {
    expect(
      projectInputSchema.parse({
        id: "",
        name: "Site pessoal",
        description: "",
        context: "personal",
        status: "active",
        due_on: "",
      }),
    ).toMatchObject({ name: "Site pessoal", due_on: null });
  });

  it("ignora projeto inválido na URL", () => {
    expect(boardFiltersSchema.parse({ projeto: "x" }).projeto).toBeUndefined();
    expect(boardFiltersSchema.parse({ projeto: [UUID] }).projeto).toBe(UUID);
  });
});

describe("freelance", () => {
  it("cliente: e-mail opcional, validado e minúsculo", () => {
    const base = { id: "", name: "Cliente Alfa", company: "", email: "", phone: "", notes: "" };
    expect(clientInputSchema.parse(base).email).toBeNull();
    expect(clientInputSchema.parse({ ...base, email: "Contato@Alfa.COM" }).email).toBe("contato@alfa.com");
    expect(clientInputSchema.safeParse({ ...base, email: "alfa.com" }).success).toBe(false);
  });

  it("negócio: só estágios abertos e valor opcional", () => {
    const deal = {
      id: "",
      client_id: UUID,
      title: "Landing",
      stage: "proposal",
      value_cents: "",
      expected_close_on: "",
    };
    expect(dealInputSchema.parse(deal)).toMatchObject({ value_cents: null, expected_close_on: null });
    expect(dealInputSchema.parse({ ...deal, value_cents: "1.800,00" }).value_cents).toBe(180000);
    expect(dealInputSchema.safeParse({ ...deal, stage: "won" }).success).toBe(false);
    expect(dealInputSchema.safeParse({ ...deal, client_id: "" }).error?.issues[0]?.message).toBe(
      "Escolha o cliente",
    );
  });

  it("ganhar: fonte opcional e checkbox do projeto", () => {
    const base = { deal_id: UUID, source_id: "", received_on: "2026-11-20", create_project: "on" };
    expect(winInputSchema.parse(base)).toMatchObject({ source_id: null, create_project: true });
    expect(winInputSchema.parse({ ...base, create_project: "" }).create_project).toBe(false);
  });
});
