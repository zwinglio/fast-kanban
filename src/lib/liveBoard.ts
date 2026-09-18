import { onBeforeUnmount, ref } from "vue";
import { CLIENT_ID } from "../api";

export type LiveStatus = "connecting" | "live" | "offline";

export interface LiveChange {
  kind: "card" | "board";
  cardId?: number;
  by: string | null;
}

/**
 * Subscribes to a board's Server-Sent Events stream for the lifetime of the calling component.
 * `onChange` fires for changes made in other tabs; `onResync` fires after a reconnect, when
 * events may have been missed. EventSource reconnects by itself (the server suggests 3s).
 */
export function useLiveBoard(
  boardId: string,
  handlers: { onChange: (change: LiveChange) => void; onResync: () => void }
) {
  const status = ref<LiveStatus>("connecting");
  const viewers = ref(0);
  let source: EventSource | null = null;
  let hadError = false;

  function connect() {
    if (typeof EventSource === "undefined") {
      status.value = "offline";
      return;
    }
    source = new EventSource(`/api/boards/${encodeURIComponent(boardId)}/stream?client=${encodeURIComponent(CLIENT_ID)}`);

    source.addEventListener("hello", (e) => {
      status.value = "live";
      viewers.value = readViewers(e) ?? viewers.value;
      if (hadError) handlers.onResync();
      hadError = false;
    });
    source.addEventListener("presence", (e) => {
      viewers.value = readViewers(e) ?? viewers.value;
    });
    source.addEventListener("change", (e) => {
      try {
        const change = JSON.parse((e as MessageEvent).data) as LiveChange;
        if (change.by !== CLIENT_ID) handlers.onChange(change);
      } catch {
        // Ignore malformed events.
      }
    });
    source.onerror = () => {
      hadError = true;
      status.value = source?.readyState === EventSource.CLOSED ? "offline" : "connecting";
    };
  }

  function readViewers(e: Event): number | null {
    try {
      const n = JSON.parse((e as MessageEvent).data)?.viewers;
      return typeof n === "number" ? n : null;
    } catch {
      return null;
    }
  }

  connect();
  onBeforeUnmount(() => {
    source?.close();
    source = null;
  });

  return { status, viewers };
}
