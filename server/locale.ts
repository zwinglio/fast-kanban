/**
 * Locales a board's seeded defaults (column and priority names) can be created in.
 * The board stores plain strings, so this only matters at creation time.
 */
export type BoardLocale = "en" | "pt-BR";

export const BOARD_LOCALES: BoardLocale[] = ["en", "pt-BR"];

/** Narrows an untrusted request value to a supported board locale. */
export function parseBoardLocale(value: unknown): BoardLocale | null {
  return value === "en" || value === "pt-BR" ? value : null;
}
