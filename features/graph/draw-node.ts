import type { Focus } from "./neighbors";
import type { GraphNode } from "./schema";

export type GraphTheme = {
  paper: string;
  ink: string;
  muted: string;
  rule: string;
  blue: string;
  red: string;
};

const DASH: Record<string, number[]> = { personal: [], work: [4, 2], freelance: [1, 2] };

export function nodeRadius(node: GraphNode) {
  return 4 + Math.sqrt(1 + node.degree) * 2;
}

function shape(ctx: CanvasRenderingContext2D, node: GraphNode, x: number, y: number, r: number) {
  ctx.beginPath();
  switch (node.type) {
    case "project":
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case "goal":
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x + r * 1.1, y + r * 0.85);
      ctx.lineTo(x - r * 1.1, y + r * 0.85);
      ctx.closePath();
      break;
    case "income_source":
    case "client":
    case "deal":
    case "asset":
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.2, y);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x - r * 1.2, y);
      ctx.closePath();
      break;
    case "service":
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const px = x + r * 1.1 * Math.cos(a);
        const py = y + r * 1.1 * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

export function drawNode(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  scale: number,
  theme: GraphTheme,
  focus: Focus,
  pointer = false,
) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const r = nodeRadius(node);
  const inFocus = !focus || focus.nodes.has(node.id);
  const color = pointer
    ? theme.ink
    : node.alert
      ? theme.red
      : focus && focus.nodes.has(node.id)
        ? theme.blue
        : inFocus
          ? theme.ink
          : theme.muted;

  shape(ctx, node, x, y, r);
  if (pointer) {
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }
  const hollow = node.type === "note";
  ctx.fillStyle = hollow ? theme.paper : color;
  ctx.globalAlpha = inFocus ? 1 : 0.35;
  ctx.fill();
  ctx.lineWidth = 1.5 / Math.max(scale, 0.5);
  ctx.strokeStyle = color;
  ctx.setLineDash((DASH[node.context ?? "personal"] ?? []).map((d) => d / Math.max(scale, 0.5)));
  if (hollow || node.context === "work" || node.context === "freelance") {
    if (!hollow) {
      ctx.fillStyle = theme.paper;
      shape(ctx, node, x, y, r * 0.55);
      ctx.fill();
      shape(ctx, node, x, y, r);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (scale >= 1.5 || (focus && focus.nodes.has(node.id))) {
    const size = 11 / scale;
    ctx.font = `${size}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = node.alert ? theme.red : inFocus ? theme.ink : theme.muted;
    const label = node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label;
    ctx.fillText(label, x, y + r + 2 / scale);
  }
  ctx.globalAlpha = 1;
}
