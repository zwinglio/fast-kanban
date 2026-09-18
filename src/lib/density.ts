export type Density = "compact" | "default" | "comfortable";

export const DENSITIES: { value: Density; label: string; hint: string }[] = [
  { value: "compact", label: "Compact", hint: "ID and title only" },
  { value: "default", label: "Default", hint: "Title and tags" },
  { value: "comfortable", label: "Comfortable", hint: "Adds a description preview" },
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
