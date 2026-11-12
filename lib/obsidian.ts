export function normalizeNotePath(note: string): string {
  return note
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/\.md$/i, "");
}

export function obsidianUri(vault: string, note: string): string {
  const file = normalizeNotePath(note);
  return `obsidian://open?vault=${encodeURIComponent(vault.trim())}&file=${encodeURIComponent(file)}`;
}

export function isObsidianLink(value: string): boolean {
  return /^\s*obsidian:\/\//i.test(value);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function noteFromObsidianLink(value: string): string | null {
  if (!isObsidianLink(value)) return null;
  const rest = value
    .trim()
    .replace(/^obsidian:\/\//i, "")
    .replace(/\s*→\s*$/, "");
  const qIndex = rest.indexOf("?");
  const target = qIndex === -1 ? rest : rest.slice(0, qIndex);
  const query = qIndex === -1 ? "" : rest.slice(qIndex + 1);
  const params = new URLSearchParams(query.replace(/\+/g, "%2B"));
  const action = target.replace(/\/+$/, "").toLowerCase();

  if (action === "open" || action === "adv-uri" || action === "new") {
    const file = params.get("file") ?? params.get("filepath") ?? params.get("name");
    if (!file) return null;
    const note = normalizeNotePath(file);
    return note || null;
  }

  const decoded = safeDecode(target);
  const withoutVault = decoded.replace(/^vault\/[^/]+\/?/i, "");
  const note = normalizeNotePath(withoutVault);
  return note || null;
}
