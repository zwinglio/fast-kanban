export interface DefaultColumn {
  name: string;
  color: string;
  position: number;
}

export const DEFAULT_COLUMNS: DefaultColumn[] = [
  { name: "Backlog", color: "#5e6c84", position: 0 },
  { name: "Todo", color: "#4c9aff", position: 1 },
  { name: "Doing", color: "#0052cc", position: 2 },
  { name: "Done", color: "#36b37e", position: 3 },
];

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
