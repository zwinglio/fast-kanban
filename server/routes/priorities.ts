import { Hono } from "hono";
import { prisma } from "../db.js";
import { verifyEditKey } from "../auth.js";
import { isValidPaletteColor, isValidPriorityName } from "../priorities.js";
import { eventRows } from "../events.js";

export const priorities = new Hono();

async function requirePriorityEditKey(priorityId: number, key: string | undefined) {
  if (!key) return { ok: false as const, status: 401 as const, error: "Missing edit key" };
  const priority = await prisma.priority.findUnique({ where: { id: priorityId } });
  if (!priority) return { ok: false as const, status: 404 as const, error: "Priority not found" };
  const board = await prisma.board.findUnique({ where: { id: priority.boardId } });
  if (!board) return { ok: false as const, status: 404 as const, error: "Board not found" };
  const valid = await verifyEditKey(key, board.editHash);
  if (!valid) return { ok: false as const, status: 401 as const, error: "Invalid edit key" };
  return { ok: true as const, priority };
}

// PATCH /api/priorities/:id - update name, color, or position
priorities.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid priority id" }, 400);

  const check = await requirePriorityEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid body" }, 400);

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!isValidPriorityName(name)) {
      return c.json({ error: "Priority name must be 1-30 chars" }, 400);
    }
    const siblings = await prisma.priority.findMany({
      where: { boardId: check.priority.boardId, NOT: { id } },
      select: { name: true },
    });
    if (siblings.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return c.json({ error: "A priority with this name already exists" }, 400);
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

  const updated = await prisma.priority.update({ where: { id }, data });
  return c.json(updated);
});

// DELETE /api/priorities/:id - cards using it fall back to "no priority" (FK is ON DELETE SET NULL)
priorities.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid priority id" }, 400);

  const check = await requirePriorityEditKey(id, c.req.header("X-Edit-Key"));
  if (!check.ok) return c.json({ error: check.error }, check.status);

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
  return c.json({ ok: true });
});
