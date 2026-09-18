import type { Prisma } from "@prisma/client";

// One row per meaningful change to a card. `data` stores names as they were at the
// time, so later renames or deletions don't rewrite history.
export type CardEventInput =
  | { type: "created"; data: { column: string } }
  | { type: "moved"; data: { from: string; to: string } }
  | { type: "title"; data: { from: string; to: string } }
  | { type: "description"; data: null }
  | { type: "priority"; data: { from: string | null; to: string | null; reason?: "deleted" } }
  | { type: "tags"; data: { added: string[]; removed: string[]; reason?: "deleted" } }
  | { type: "points"; data: { from: number | null; to: number | null } }
  | { type: "comment"; data: { action: "added" | "edited" | "deleted"; author: string | null; excerpt: string } }
  | {
      type: "dependency";
      // role is from this card's point of view: it is blocked_by `card`, or it blocks `card`.
      data: {
        action: "added" | "removed";
        role: "blocked_by" | "blocks";
        card: string;
        title: string;
        reason?: "deleted"; // the other card was deleted
      };
    }
  | { type: "archived"; data: null }
  | { type: "restored"; data: null };

export function eventRows(cardId: number, boardId: string, events: CardEventInput[]): Prisma.CardEventCreateManyInput[] {
  return events.map((e) => ({
    cardId,
    boardId,
    type: e.type,
    data: e.data === null ? undefined : (e.data as Prisma.InputJsonValue),
  }));
}
