import { isValidPaletteColor } from "./columns.js";

export interface DefaultPriority {
  name: string;
  color: string;
  position: number;
}

// position 0 is the most urgent; the board's list is always shown in this order.
export const DEFAULT_PRIORITIES: DefaultPriority[] = [
  { name: "Urgent", color: "#ff5630", position: 0 },
  { name: "High", color: "#ffab00", position: 1 },
  { name: "Medium", color: "#4c9aff", position: 2 },
  { name: "Low", color: "#5e6c84", position: 3 },
];

export const MAX_PRIORITIES = 6;

export function isValidPriorityName(name: string): boolean {
  return name.length > 0 && name.length <= 30;
}

export { isValidPaletteColor };
