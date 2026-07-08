import { Hono } from "hono";
import { prisma } from "../db.js";
import { verifyEditKey } from "../auth.js";
import { isValidPaletteColor } from "../columns.js";

export const columns = new Hono();

async function requireColumnEditKey(columnId: number, key: string | undefined) {
  if (!key) return { ok: false as const, status: 401 as const, error: "Missing edit key" };
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) return { ok: false as const, status: 404 as const, error: "Column not found" };
  const board = await prisma.board.findUnique({ where: { id: column.boardId } });
  if (!board) return { ok: false as const, status: 404 as const, error: "Board not found" };
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return { ok: false as const, status: 401 as const, error: "Invalid edit key" };
  return { ok: true as const, column };
}

// PATCH /api/columns/:id - update name, color, or position
columns.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid column id" }, 400);

  const check = await requireColumnEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid body" }, 400);

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 50) {
      return c.json({ error: "Column name must be 1-50 chars" }, 400);
    }
    data.name = name;
  }

  if (body.color !== undefined) {
    const color = String(body.color);
    if (!isValidPaletteColor(color)) {
      return c.json({ error: "Invalid color" }, 400);
    }
    data.color = color;
  }

  if (body.position !== undefined) {
    const position = Number(body.position);
    if (!Number.isInteger(position) || position < 0) {
      return c.json({ error: "Invalid position" }, 400);
    }
    data.position = position;
  }

  const updated = await prisma.column.update({
    where: { id },
    data,
  });
  return c.json(updated);
});

// DELETE /api/columns/:id - refuse if column has cards or is the last column
columns.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid column id" }, 400);

  const check = await requireColumnEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const cardCount = await prisma.card.count({ where: { columnId: id } });
  if (cardCount > 0) {
    return c.json({ error: "Cannot delete a column that still has cards" }, 400);
  }

  const columnCount = await prisma.column.count({ where: { boardId: check.column.boardId } });
  if (columnCount <= 1) {
    return c.json({ error: "Cannot delete the last column" }, 400);
  }

  await prisma.column.delete({ where: { id } });
  return c.json({ ok: true });
});
