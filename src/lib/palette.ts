export interface Swatch {
  name: string;
  hex: string;
}

export const PALETTE: Swatch[] = [
  { name: "Slate", hex: "#5e6c84" },
  { name: "Blue", hex: "#4c9aff" },
  { name: "Dark Blue", hex: "#0052cc" },
  { name: "Green", hex: "#36b37e" },
  { name: "Red", hex: "#ff5630" },
  { name: "Yellow", hex: "#ffab00" },
  { name: "Purple", hex: "#6554c0" },
  { name: "Teal", hex: "#00b8d9" },
  { name: "Lavender", hex: "#8777d9" },
  { name: "Crimson", hex: "#e5493a" },
  { name: "Forest", hex: "#00875a" },
  { name: "Navy", hex: "#172b4d" },
];

export const PALETTE_HEXES = PALETTE.map((s) => s.hex);
