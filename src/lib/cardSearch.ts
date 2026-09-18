/**
 * Reads a search term as a card number when it looks like one: "12", "#12" or "PROJ-12"
 * (prefix case-insensitive, dash optional). Returns null for anything else.
 */
export function parseCardNumber(term: string, prefix: string): number | null {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = term.trim().match(new RegExp(`^(?:#|${escaped}-?)?(\\d+)$`, "i"));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}
