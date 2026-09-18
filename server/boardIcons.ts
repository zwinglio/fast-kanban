// Keep in sync with src/lib/boardIcons.ts (the client owns the artwork).
export const BOARD_ICON_IDS = [
  "rocket",
  "briefcase",
  "code",
  "bug",
  "palette",
  "megaphone",
  "book",
  "flask",
  "heart",
  "star",
  "bolt",
  "globe",
  "target",
  "chart",
  "cart",
  "mobile",
  "home",
] as const;

export function isValidBoardIcon(value: unknown): value is string {
  return typeof value === "string" && (BOARD_ICON_IDS as readonly string[]).includes(value);
}
