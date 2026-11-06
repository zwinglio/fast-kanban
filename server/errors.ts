import type { Context } from "hono";

/**
 * Stable, machine-readable error codes.
 *
 * Every API error response carries both:
 *   { error: "<English message>", code: "<CODE>", params?: { ... } }
 *
 * `error` stays English on purpose (agents, curl users, older clients), while
 * the SPA translates `code` through its `errors.*` message namespace. Append
 * new codes here and add the matching message to BOTH locale files
 * (src/i18n/locales/en.ts and src/i18n/locales/pt-BR.ts).
 */
export type ErrorCode =
  // Auth / lookup
  | "MISSING_EDIT_KEY"
  | "INVALID_EDIT_KEY"
  | "BOARD_NOT_FOUND"
  | "CARD_NOT_FOUND"
  | "COLUMN_NOT_FOUND"
  | "PRIORITY_NOT_FOUND"
  | "TAG_NOT_FOUND"
  | "COMMENT_NOT_FOUND"
  | "DEPENDENCY_NOT_FOUND"
  // Malformed requests
  | "MISSING_BOARD_ID"
  | "INVALID_CARD_ID"
  | "INVALID_COLUMN_ID"
  | "INVALID_PRIORITY_ID"
  | "INVALID_TAG_ID"
  | "INVALID_COMMENT_ID"
  | "INVALID_BODY"
  | "INVALID_CURSOR"
  | "INVALID_COLOR"
  | "INVALID_POSITION"
  | "INVALID_COLUMN"
  | "INVALID_PRIORITY"
  | "INVALID_BLOCKER_CARD"
  // Board settings
  | "BOARD_TITLE_LENGTH"
  | "BOARD_PREFIX_INVALID"
  | "BOARD_START_SEQ_RANGE"
  | "BOARD_NEXT_SEQ_RANGE"
  | "BOARD_NEXT_SEQ_TOO_LOW"
  | "BOARD_ICON_UNKNOWN"
  | "BOARD_POINTS_SETTING_INVALID"
  | "BOARD_DEPENDENCIES_SETTING_INVALID"
  | "BOARD_NOTHING_TO_UPDATE"
  | "BOARD_CONFIRM_TITLE"
  | "BOARD_NO_COLUMNS"
  | "BOARD_MAX_COLUMNS"
  | "BOARD_MAX_PRIORITIES"
  | "BOARD_MAX_TAGS"
  // Cards
  | "CARD_TITLE_LENGTH"
  | "CARD_STORY_POINTS_RANGE"
  | "CARD_ARCHIVED_FLAG_INVALID"
  | "CARD_SELF_DEPENDENCY"
  | "CARD_BLOCKER_OTHER_BOARD"
  | "CARD_DEPENDENCY_EXISTS"
  | "CARD_MAX_BLOCKERS"
  | "CARD_DEPENDENCY_CYCLE"
  // Columns
  | "COLUMN_NAME_LENGTH"
  | "COLUMN_NOT_EMPTY"
  | "COLUMN_LAST_CANNOT_DELETE"
  // Priorities
  | "PRIORITY_NAME_LENGTH"
  | "PRIORITY_NAME_EXISTS"
  // Tags
  | "TAG_NAME_LENGTH"
  | "TAG_NAME_EXISTS"
  // Comments
  | "COMMENT_LENGTH"
  | "COMMENT_AUTHOR_LENGTH";

/** Interpolation values for the localised message, e.g. { max: 255 }. */
export type ErrorParams = Record<string, string | number>;

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

/**
 * Sends a JSON error body with its stable code (and optional params).
 * Keeps the English `error` field for agents/curl and backward compatibility.
 */
export function fail(
  c: Context,
  status: ErrorStatus,
  code: ErrorCode,
  message: string,
  params?: ErrorParams
) {
  return c.json({ error: message, code, ...(params ? { params } : {}) }, status);
}
