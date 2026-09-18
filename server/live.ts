import type { Context } from "hono";

// In-memory fan-out of board changes to open SSE streams. Production runs a single
// Node process (PM2 fork mode); running several would need a shared channel (e.g. Redis).

export type LiveChange = {
  kind: "card" | "board"; // "card": one card (or its links/comments) changed; "board": settings, columns, tags…
  cardId?: number;
  by: string | null; // X-Client-Id of the tab that made the change, so it can ignore its own echo
};

type Listener = {
  clientId: string;
  send: (event: string, data: unknown) => void;
};

const listeners = new Map<string, Set<Listener>>();

export function viewerCount(boardId: string): number {
  return listeners.get(boardId)?.size ?? 0;
}

function broadcast(boardId: string, event: string, data: unknown) {
  for (const l of listeners.get(boardId) ?? []) l.send(event, data);
}

export function subscribe(boardId: string, listener: Listener): () => void {
  let set = listeners.get(boardId);
  if (!set) listeners.set(boardId, (set = new Set()));
  set.add(listener);
  broadcast(boardId, "presence", { viewers: viewerCount(boardId) });
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(boardId);
    else broadcast(boardId, "presence", { viewers: viewerCount(boardId) });
  };
}

export function publish(boardId: string, change: LiveChange) {
  broadcast(boardId, "change", change);
}

/** Call after a successful write: tells every open stream on the board what changed. */
export function notifyBoard(c: Context, boardId: string, kind: LiveChange["kind"], cardId?: number) {
  const by = c.req.header("X-Client-Id") ?? null;
  publish(boardId, { kind, cardId, by });
}
