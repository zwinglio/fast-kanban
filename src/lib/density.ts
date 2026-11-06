export type Density = "compact" | "default" | "comfortable";

export interface DensityOption {
  value: Density;
  labelKey: string;
  hintKey: string;
}

// Labels are i18n keys so they follow the active locale; render with t(opt.labelKey).
export const DENSITIES: DensityOption[] = [
  { value: "compact", labelKey: "settings.general.density.compact", hintKey: "settings.general.density.compactHint" },
  { value: "default", labelKey: "settings.general.density.default", hintKey: "settings.general.density.defaultHint" },
  { value: "comfortable", labelKey: "settings.general.density.comfortable", hintKey: "settings.general.density.comfortableHint" },
];

const STORAGE_PREFIX = "fk_density:";

function isDensity(v: unknown): v is Density {
  return v === "compact" || v === "default" || v === "comfortable";
}

/** Density is a per-browser view preference, remembered per board. */
export function getDensity(boardId: string): Density {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + boardId);
    if (isDensity(stored)) return stored;
  } catch {
    // Storage blocked; fall back to the default.
  }
  return "default";
}

export function setDensity(boardId: string, density: Density): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + boardId, density);
  } catch {
    // Storage blocked; the choice still applies for this session.
  }
}
