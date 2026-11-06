import { Hono } from "hono";
import { prisma } from "../db.js";
import { notifyBoard } from "../live.js";
import { verifyEditKey } from "../auth.js";
import { isValidPaletteColor } from "../columns.js";
import { fail, type ErrorCode } from "../errors.js";

export const columns = new Hono();

/** Edit-key auth failure that routes turn into `fail(c, status, code, error)`. */
function editKeyFailure(status: 401 | 404, code: ErrorCode, error: string) {
  return { ok: false as const, status, code, error };
}

async function requireColumnEditKey(columnId: number, key: string | undefined) {
  if (!key) return editKeyFailure(401, "MISSING_EDIT_KEY", "Missing edit key");
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) return editKeyFailure(404, "COLUMN_NOT_FOUND", "Column not found");
  const board = await prisma.board.findUnique({ where: { id: column.boardId } });
  if (!board) return editKeyFailure(404, "BOARD_NOT_FOUND", "Board not found");
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return editKeyFailure(401, "INVALID_EDIT_KEY", "Invalid edit key");
  return { ok: true as const, column };
}

// PATCH /api/columns/:id - update name, color, or position
columns.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return fail(c, 400, "INVALID_COLUMN_ID", "Invalid column id");

  const check = await requireColumnEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return fail(c, check.status, check.code, check.error);

  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, 400, "INVALID_BODY", "Invalid body");

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 50) {
      return fail(c, 400, "COLUMN_NAME_LENGTH", "Column name must be 1-50 chars", { min: 1, max: 50 });
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

  const updated = await prisma.column.update({
    where: { id },
    data,
  });
  notifyBoard(c, check.column.boardId, "board");
  return c.json(updated);
});

// DELETE /api/columns/:id - refuse if column has cards or is the last column
columns.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return fail(c, 400, "INVALID_COLUMN_ID", "Invalid column id");

  const check = await requireColumnEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return fail(c, check.status, check.code, check.error);

  const cardCount = await prisma.card.count({ where: { columnId: id } });
  if (cardCount > 0) {
    return fail(c, 400, "COLUMN_NOT_EMPTY", "Cannot delete a column that still has cards");
  }

  const columnCount = await prisma.column.count({ where: { boardId: check.column.boardId } });
  if (columnCount <= 1) {
    return fail(c, 400, "COLUMN_LAST_CANNOT_DELETE", "Cannot delete the last column");
  }

  await prisma.column.delete({ where: { id } });
  notifyBoard(c, check.column.boardId, "board");
  return c.json({ ok: true });
});
