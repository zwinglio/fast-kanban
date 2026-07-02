import { Hono } from "hono";
import { prisma } from "../db.js";
import { verifyEditKey } from "../auth.js";

export const cards = new Hono();

async function requireCardEditKey(cardId: number, key: string | undefined) {
  if (!key) return { ok: false as const, status: 401 as const, error: "Missing edit key" };
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { ok: false as const, status: 404 as const, error: "Card not found" };
  const board = await prisma.board.findUnique({ where: { id: card.boardId } });
  if (!board) return { ok: false as const, status: 404 as const, error: "Board not found" };
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return { ok: false as const, status: 401 as const, error: "Invalid edit key" };
  return { ok: true as const, card };
}

const VALID_STATUSES = ["backlog", "todo", "doing", "done"];

// PATCH /api/cards/:id - edit fields and/or move (status/position)
cards.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const check = await requireCardEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid body" }, 400);

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title || title.length > 255) {
      return c.json({ error: "Title must be 1-255 chars" }, 400);
    }
    data.title = title;
  }
  if (body.body !== undefined) {
    data.body = body.body === null ? null : String(body.body);
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    data.status = body.status;
  }
  if (body.position !== undefined) {
    const position = Number(body.position);
    if (!Number.isInteger(position) || position < 0) {
      return c.json({ error: "Invalid position" }, 400);
    }
    data.position = position;
  }

  const updated = await prisma.card.update({ where: { id }, data });
  return c.json(updated);
});

// DELETE /api/cards/:id
cards.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid card id" }, 400);

  const check = await requireCardEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await prisma.card.delete({ where: { id } });
  return c.json({ ok: true });
});
