import { Hono } from "hono";
import { prisma } from "../db.js";
import { notifyBoard } from "../live.js";
import { verifyEditKey } from "../auth.js";
import { isValidPaletteColor, isValidPriorityName } from "../priorities.js";
import { fail, type ErrorCode } from "../errors.js";
import { eventRows } from "../events.js";

export const priorities = new Hono();

/** Edit-key auth failure that routes turn into `fail(c, status, code, error)`. */
function editKeyFailure(status: 401 | 404, code: ErrorCode, error: string) {
  return { ok: false as const, status, code, error };
}

async function requirePriorityEditKey(priorityId: number, key: string | undefined) {
  if (!key) return editKeyFailure(401, "MISSING_EDIT_KEY", "Missing edit key");
  const priority = await prisma.priority.findUnique({ where: { id: priorityId } });
  if (!priority) return editKeyFailure(404, "PRIORITY_NOT_FOUND", "Priority not found");
  const board = await prisma.board.findUnique({ where: { id: priority.boardId } });
  if (!board) return editKeyFailure(404, "BOARD_NOT_FOUND", "Board not found");
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return editKeyFailure(401, "INVALID_EDIT_KEY", "Invalid edit key");
  return { ok: true as const, priority };
}

// PATCH /api/priorities/:id - update name, color, or position
priorities.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return fail(c, 400, "INVALID_PRIORITY_ID", "Invalid priority id");

  const check = await requirePriorityEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return fail(c, check.status, check.code, check.error);

  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, 400, "INVALID_BODY", "Invalid body");

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!isValidPriorityName(name)) {
      return fail(c, 400, "PRIORITY_NAME_LENGTH", "Priority name must be 1-30 chars", { min: 1, max: 30 });
    }
    const siblings = await prisma.priority.findMany({
      where: { boardId: check.priority.boardId, NOT: { id } },
      select: { name: true },
    });
    if (siblings.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return fail(c, 400, "PRIORITY_NAME_EXISTS", "A priority with this name already exists");
    }
    data.name = name;
  }

  if (body.color !== undefined) {
    const color = String(body.color);
    if (!isValidPaletteColor(color)) {
      return fail(c, 400, "INVALID_COLOR", "Invalid color");
    }
    data.color = color;
  }

  if (body.position !== undefined) {
    const position = Number(body.position);
    if (!Number.isInteger(position) || position < 0) {
      return fail(c, 400, "INVALID_POSITION", "Invalid position");
    }
    data.position = position;
  }

  const updated = await prisma.priority.update({ where: { id }, data });
  notifyBoard(c, check.priority.boardId, "board");
  return c.json(updated);
});

// DELETE /api/priorities/:id - cards using it fall back to "no priority" (FK is ON DELETE SET NULL)
priorities.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return fail(c, 400, "INVALID_PRIORITY_ID", "Invalid priority id");

  const check = await requirePriorityEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return fail(c, check.status, check.code, check.error);

  const affected = await prisma.card.findMany({ where: { priorityId: id }, select: { id: true } });
  await prisma.$transaction([
    prisma.priority.delete({ where: { id } }),
    prisma.cardEvent.createMany({
      data: affected.flatMap((card) =>
        eventRows(card.id, check.priority.boardId, [
          { type: "priority", data: { from: check.priority.name, to: null, reason: "deleted" } },
        ])
      ),
    }),
  ]);
  notifyBoard(c, check.priority.boardId, "board");
  return c.json({ ok: true });
});
