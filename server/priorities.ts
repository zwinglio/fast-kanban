import type { BoardLocale } from "./locale.js";
import { isValidPaletteColor } from "./columns.js";

export interface DefaultPriority {
  name: string;
  color: string;
  position: number;
}

// Colors and positions are identical in every locale; only the names are translated.
const PRIORITY_COLORS: string[] = ["#ff5630", "#ffab00", "#4c9aff", "#5e6c84"];

// position 0 is the most urgent; the board's list is always shown in this order.
const PRIORITY_NAMES: Record<BoardLocale, string[]> = {
  en: ["Urgent", "High", "Medium", "Low"],
  "pt-BR": ["Urgente", "Alta", "Média", "Baixa"],
};

/** Priorities a new board is seeded with, named in the board's creation locale. */
export function defaultPriorities(locale: BoardLocale): DefaultPriority[] {
  return PRIORITY_NAMES[locale].map((name, position) => ({
    name,
    color: PRIORITY_COLORS[position],
    position,
  }));
}

export const MAX_PRIORITIES = 6;

export function isValidPriorityName(name: string): boolean {
  return name.length > 0 && name.length <= 30;
}

export { isValidPaletteColor };
