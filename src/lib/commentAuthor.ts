const STORAGE_KEY = "fk_comment_name";
export const MAX_AUTHOR_LENGTH = 40;

/** The display name this browser comments as; empty = anonymous. Never leaves the device except on comments. */
export function getCommentAuthor(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setCommentAuthor(name: string): void {
  try {
    const clean = name.trim().slice(0, MAX_AUTHOR_LENGTH);
    if (clean) localStorage.setItem(STORAGE_KEY, clean);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable; the name just won't be remembered.
  }
}
