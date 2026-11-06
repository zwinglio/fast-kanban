import type { BoardLocale } from "./locale.js";

export interface DefaultColumn {
  name: string;
  color: string;
  position: number;
}

// Colors and positions are identical in every locale; only the names are translated.
const COLUMN_COLORS: string[] = ["#5e6c84", "#4c9aff", "#0052cc", "#36b37e"];

const COLUMN_NAMES: Record<BoardLocale, string[]> = {
  en: ["Backlog", "Todo", "Doing", "Done"],
  "pt-BR": ["Backlog", "A fazer", "Em andamento", "Concluído"],
};

/** Columns a new board is seeded with, named in the board's creation locale. */
export function defaultColumns(locale: BoardLocale): DefaultColumn[] {
  return COLUMN_NAMES[locale].map((name, position) => ({
    name,
    color: COLUMN_COLORS[position],
    position,
  }));
}

export const MAX_COLUMNS = 8;

export const PALETTE: string[] = [
  "#5e6c84",
  "#4c9aff",
  "#0052cc",
  "#36b37e",
  "#ff5630",
  "#ffab00",
  "#6554c0",
  "#00b8d9",
  "#8777d9",
  "#e5493a",
  "#00875a",
  "#172b4d",
];

export function isValidPaletteColor(color: string): boolean {
  return PALETTE.includes(color);
}
