import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { prisma } from "./db.js";

const KEY_LEN = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** Hashes an edit key into "saltHex:hashHex" form for storage. */
export async function hashEditKey(key: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(key, salt);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Verifies a supplied edit key against the stored "saltHex:hashHex" value. */
export async function verifyEditKey(key: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptAsync(key, salt);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

const PREFIX_RE = /^[A-Z0-9]{1,16}$/;

export function isValidPrefix(prefix: string): boolean {
  return PREFIX_RE.test(prefix);
}

/**
 * Hono middleware that requires a valid `X-Edit-Key` header matching the
 * board identified by the `id` route param. On success, stores the board
 * on the context under "board".
 */
export async function requireEditKey(c: Context, next: Next) {
  const boardId = c.req.param("id");
  const key = c.req.header("X-Edit-Key");
  if (!boardId || !key) {
    return c.json({ error: "Missing edit key" }, 401);
  }
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    return c.json({ error: "Board not found" }, 404);
  }
  const ok = await verifyEditKey(key, board.editHash);
  if (!ok) {
    return c.json({ error: "Invalid edit key" }, 401);
  }
  c.set("board", board);
  await next();
}
