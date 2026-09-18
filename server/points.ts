export const MAX_POINTS = 100;

/** Story points are whole numbers from 0 to MAX_POINTS; null clears the estimate. */
export function parsePoints(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_POINTS) {
    return { ok: true, value };
  }
  return { ok: false };
}
