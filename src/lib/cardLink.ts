import type { LocationQuery } from "vue-router";

/**
 * Notion-style card links: /b/<boardId>/<prefix>-<seq>-<title-slug>-<uuid-hex>
 *
 * The trailing 32-hex UUID is what identifies the card; the readable part is decoration,
 * so a link keeps working after the card is renamed and the URL can be corrected in place.
 */

/** The card fields a shareable link needs. */
export interface LinkableCard {
  seq: number;
  title: string;
  uuid: string;
}

const MAX_SLUG_LENGTH = 60;
// 32 hex characters, no dashes, at the very end of the segment.
const UUID_HEX_RE = /([0-9a-f]{32})$/i;

/**
 * Lowercase, accent-free, dash-separated words, capped at ~60 characters.
 * Returns an empty string when the title has nothing linkable in it (e.g. "!!!").
 */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accents: "Ação" -> "Acao"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // every run of non-alphanumerics becomes one dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
}

/** The identifying part of the UUID: 32 lowercase hex characters, no dashes. */
function uuidHex(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

/**
 * URL segment for a card: `${prefix}-${seq}-${slug}-${uuidHex}`, e.g.
 * "proj-12-fix-login-bug-3f2a9c1e4b7d4e0f9a1b2c3d4e5f6a7b".
 * The title slug is omitted (no trailing dash) when the title has no slug-able characters.
 */
export function cardSlug(prefix: string, card: LinkableCard): string {
  const slug = slugify(card.title);
  const head = `${prefix.toLowerCase()}-${card.seq}`;
  return slug ? `${head}-${slug}-${uuidHex(card.uuid)}` : `${head}-${uuidHex(card.uuid)}`;
}

/** Reads the trailing 32 hex characters of a card slug as a dashed UUID; null if absent/invalid. */
export function parseCardSlug(param: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (typeof raw !== "string") return null;
  const match = raw.match(UUID_HEX_RE);
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A vue-router location for a card on a board. */
export interface CardRoute {
  name: "board";
  params: { id: string; cardSlug: string };
  query: LocationQuery;
}

/**
 * Route to a card on a board, keeping the current query (view / filters).
 * The legacy `?card=<seq>` param is not a filter, so it is dropped.
 */
export function cardRoute(
  boardId: string,
  prefix: string,
  card: LinkableCard,
  query: LocationQuery = {}
): CardRoute {
  const rest = { ...query };
  delete rest.card;
  return {
    name: "board",
    params: { id: boardId, cardSlug: cardSlug(prefix, card) },
    query: rest,
  };
}
