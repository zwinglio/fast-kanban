export const MAX_COMMENT_LENGTH = 5000;
export const MAX_AUTHOR_LENGTH = 40;

export function parseCommentBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const body = value.trim();
  return body && body.length <= MAX_COMMENT_LENGTH ? body : null;
}

/** Optional display name; empty or missing means anonymous. */
export function parseAuthor(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const author = value.trim();
  if (author.length > MAX_AUTHOR_LENGTH) return { ok: false };
  return { ok: true, value: author || null };
}

// Cards carry a comment count for the board view instead of the comments themselves.
export function withCommentCount<T extends { _count: { comments: number } }>(card: T) {
  const { _count, ...rest } = card;
  return { ...rest, commentCount: _count.comments };
}

// Short plain-text preview of a comment for the activity log.
export function commentExcerpt(body: string, max = 80): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

export const commentCountInclude = { _count: { select: { comments: true } } } as const;
