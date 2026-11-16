import { endId, type GraphData, type GraphLink } from "./schema";

export type Focus = { nodes: Set<string>; links: Set<GraphLink> } | null;

export function neighborhood(data: GraphData, id: string | null): Focus {
  if (!id) return null;
  const nodes = new Set<string>([id]);
  const links = new Set<GraphLink>();
  for (const link of data.links) {
    const s = endId(link.source);
    const t = endId(link.target);
    if (s === id || t === id) {
      links.add(link);
      nodes.add(s);
      nodes.add(t);
    }
  }
  return { nodes, links };
}

export function connectionsOf(data: GraphData, id: string) {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  return data.links
    .filter((l) => endId(l.source) === id || endId(l.target) === id)
    .map((l) => {
      const otherId = endId(l.source) === id ? endId(l.target) : endId(l.source);
      return { link: l, other: byId.get(otherId) };
    })
    .filter((c) => c.other);
}
