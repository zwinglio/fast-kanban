import type { Prisma } from "@prisma/client";

// One row per meaningful change to a card. `data` stores names as they were at the
// time, so later renames or deletions don't rewrite history.
export type CardEventInput =
  | { type: "created"; data: { column: string } }
  | { type: "moved"; data: { from: string; to: string } }
  | { type: "title"; data: { from: string; to: string } }
  | { type: "description"; data: null }
  | { type: "priority"; data: { from: string | null; to: string | null } }
  | { type: "tags"; data: { added: string[]; removed: string[] } }
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
