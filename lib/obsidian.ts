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
