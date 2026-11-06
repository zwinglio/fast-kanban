export interface Swatch {
  /** i18n key for the swatch name; render with t(sw.labelKey). */
  labelKey: string;
  hex: string;
}

export const PALETTE: Swatch[] = [
  { labelKey: "settings.general.colors.slate", hex: "#5e6c84" },
  { labelKey: "settings.general.colors.blue", hex: "#4c9aff" },
  { labelKey: "settings.general.colors.darkBlue", hex: "#0052cc" },
  { labelKey: "settings.general.colors.green", hex: "#36b37e" },
  { labelKey: "settings.general.colors.red", hex: "#ff5630" },
  { labelKey: "settings.general.colors.yellow", hex: "#ffab00" },
  { labelKey: "settings.general.colors.purple", hex: "#6554c0" },
  { labelKey: "settings.general.colors.teal", hex: "#00b8d9" },
  { labelKey: "settings.general.colors.lavender", hex: "#8777d9" },
  { labelKey: "settings.general.colors.crimson", hex: "#e5493a" },
  { labelKey: "settings.general.colors.forest", hex: "#00875a" },
  { labelKey: "settings.general.colors.navy", hex: "#172b4d" },
];

export const PALETTE_HEXES = PALETTE.map((s) => s.hex);
