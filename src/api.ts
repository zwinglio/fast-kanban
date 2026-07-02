import { getEditKey } from "./lib/editKey";

export type CardStatus = "backlog" | "todo" | "doing" | "done";

export interface Card {
  id: number;
  boardId: string;
  seq: number;
  title: string;
  body: string | null;
  status: CardStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  title: string;
  prefix: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  boardId?: string
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (boardId) {
    const key = getEditKey(boardId);
    if (key) headers.set("X-Edit-Key", key);
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function createBoard(title: string, prefix: string) {
  return request<{ id: string; editKey: string }>("/boards", {
    method: "POST",
    body: JSON.stringify({ title, prefix }),
  });
}

export function getBoard(id: string) {
  return request<{ board: Board; cards: Card[] }>(`/boards/${id}`);
}

export function verifyEditKey(id: string, key: string) {
  return request<{ valid: boolean }>(`/boards/${id}/verify`, {
    headers: { "X-Edit-Key": key },
  });
}

export function createCard(
  boardId: string,
  payload: { title: string; body?: string; status?: CardStatus }
) {
  return request<Card>(`/boards/${boardId}/cards`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, boardId);
}

export function updateCard(
  boardId: string,
  cardId: number,
  payload: Partial<{ title: string; body: string | null; status: CardStatus; position: number }>
) {
  return request<Card>(`/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, boardId);
}

export function deleteCard(boardId: string, cardId: number) {
  return request<{ ok: true }>(`/cards/${cardId}`, { method: "DELETE" }, boardId);
}

export { ApiError };
