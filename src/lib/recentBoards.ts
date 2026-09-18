const STORAGE_KEY = "fk_recent_boards";
const MAX_ENTRIES = 20;

export interface RecentBoard {
  id: string;
  title: string;
  hasKey: boolean;
  lastAccessed: number;
  icon?: string | null; // remembered from the last visit; older entries don't have it
}

function isRecentBoard(value: unknown): value is RecentBoard {
  const b = value as RecentBoard;
  return (
    typeof b === "object" &&
    b !== null &&
    typeof b.id === "string" &&
    typeof b.title === "string" &&
    typeof b.hasKey === "boolean" &&
    typeof b.lastAccessed === "number"
  );
}

export function getRecentBoards(): RecentBoard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentBoard);
  } catch {
    return [];
  }
}

function save(boards: RecentBoard[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  } catch {
    // Storage unavailable (e.g. private mode); keep list in-memory only.
  }
}

export function rememberBoard(board: { id: string; title: string; hasKey: boolean; icon?: string | null }): void {
  const rest = getRecentBoards().filter((b) => b.id !== board.id);
  const next = [{ ...board, lastAccessed: Date.now() }, ...rest].slice(0, MAX_ENTRIES);
  save(next);
}

export function forgetBoard(id: string): void {
  save(getRecentBoards().filter((b) => b.id !== id));
}
