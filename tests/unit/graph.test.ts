import { describe, expect, it } from "vitest";
import { connectionsOf, neighborhood } from "@/features/graph/neighbors";
import { normalizeSnapshot, type GraphLink } from "@/features/graph/schema";

const node = (type: string, id: string, state: string | null = null) => ({
  id: `${type}:${id}`,
  type: type as "course",
  entityId: id,
  label: id,
  context: "personal",
  state,
});

const link = (s: string, t: string, origin: "manual" | "derived" = "derived"): GraphLink => ({
  source: s,
  target: t,
  label: null,
  origin,
  linkId: origin === "manual" ? "l1" : null,
});

describe("grafo", () => {
  const data = normalizeSnapshot({
    nodes: [
      node("course", "c1"),
      node("note", "n1"),
      node("note", "solta"),
      node("project", "p1"),
      node("goal", "g1", "late"),
    ],
    links: [link("course:c1", "note:n1"), link("course:c1", "project:p1", "manual")],
  });

  it("calcula grau, marca alerta e esconde notas sem conexão", () => {
    expect(data.nodes.map((n) => n.id)).not.toContain("note:solta");
    expect(data.nodes.find((n) => n.id === "course:c1")?.degree).toBe(2);
    expect(data.nodes.find((n) => n.id === "goal:g1")?.alert).toBe(true);
  });

  it("vizinhança e conexões", () => {
    const focus = neighborhood(data, "course:c1")!;
    expect([...focus.nodes].sort()).toEqual(["course:c1", "note:n1", "project:p1"]);
    expect(focus.links.size).toBe(2);
    expect(neighborhood(data, null)).toBeNull();
    expect(connectionsOf(data, "project:p1").map((c) => c.other?.id)).toEqual(["course:c1"]);
  });
});
