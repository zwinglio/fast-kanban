import { Hono } from "hono";
import { prisma } from "../db.js";
import { verifyEditKey } from "../auth.js";

export const tags = new Hono();

async function requireTagEditKey(tagId: number, key: string | undefined) {
  if (!key) return { ok: false as const, status: 401 as const, error: "Missing edit key" };
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) return { ok: false as const, status: 404 as const, error: "Tag not found" };
  const board = await prisma.board.findUnique({ where: { id: tag.boardId } });
  if (!board) return { ok: false as const, status: 404 as const, error: "Board not found" };
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return { ok: false as const, status: 401 as const, error: "Invalid edit key" };
  return { ok: true as const, tag };
}

// PATCH /api/tags/:id - rename a tag
tags.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid tag id" }, 400);

  const check = await requireTagEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 50) {
    return c.json({ error: "Tag name must be 1-50 chars" }, 400);
  }

  const existing = await prisma.tag.findUnique({
    where: { boardId_name: { boardId: check.tag.boardId, name } },
    select: { id: true },
  });
  if (existing && existing.id !== id) {
    return c.json({ error: "A tag with this name already exists" }, 400);
  }

  const tag = await prisma.tag.update({ where: { id }, data: { name } });
  return c.json(tag);
});

// DELETE /api/tags/:id - detach a tag from all cards and remove it from the board
tags.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid tag id" }, 400);

  const check = await requireTagEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await prisma.tag.delete({ where: { id } });
  return c.json({ ok: true });
});
