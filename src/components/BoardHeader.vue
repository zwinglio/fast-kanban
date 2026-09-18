<script setup lang="ts">
import BoardSwitcher from "./BoardSwitcher.vue";
import BoardConfigMenu from "./BoardConfigMenu.vue";
import ThemeToggle from "./ThemeToggle.vue";
import BoardIcon from "./BoardIcon.vue";

defineProps<{
  boardId: string;
  title: string;
  prefix: string;
  icon: string | null;
  readOnly: boolean;
  cardCount: number;
  columnCount: number;
  tagCount: number;
  archivedCount: number;
  liveStatus: "connecting" | "live" | "offline";
  viewers: number;
}>();

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const emit = defineEmits<{
  enterKey: [];
  openColumns: [];
  openTags: [];
  openPriorities: [];
  openGeneral: [];
}>();
</script>

<template>
  <header class="topbar">
    <div class="tb-left">
      <button
        v-if="!readOnly"
        type="button"
        class="brand"
        title="Change board icon"
        aria-label="Change board icon"
        @click="emit('openGeneral')"
      >
        <BoardIcon :icon="icon" :title="title" :size="42" />
      </button>
      <span v-else class="brand static">
        <BoardIcon :icon="icon" :title="title" :size="42" />
      </span>
      <div class="tb-titles">
        <BoardSwitcher :current-id="boardId" :current-title="title" :current-has-key="!readOnly" :current-icon="icon" />
        <div class="tb-meta">
          <span class="tb-key" title="Card ID prefix">{{ prefix }}</span>
          <span>{{ plural(cardCount, "card") }}</span>
          <span class="tb-dot" aria-hidden="true" />
          <span>{{ plural(columnCount, "column") }}</span>
          <span class="tb-dot" aria-hidden="true" />
          <span>{{ plural(tagCount, "tag") }}</span>
          <template v-if="archivedCount">
            <span class="tb-dot" aria-hidden="true" />
            <span>{{ archivedCount }} archived</span>
          </template>
          <span v-if="readOnly" class="tb-ro" title="You can view this board but not change it">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Read-only
          </span>
        </div>
      </div>
    </div>

    <div class="tb-right">
      <span
        class="live"
        :class="`is-${liveStatus}`"
        :title="
          liveStatus === 'live'
            ? `Live — changes from others appear automatically. ${viewers} ${viewers === 1 ? 'tab has' : 'tabs have'} this board open.`
            : liveStatus === 'connecting'
              ? 'Reconnecting… changes will sync when the connection is back.'
              : 'Offline — reload the page to see the latest changes.'
        "
      >
        <span class="live-dot" aria-hidden="true" />
        <template v-if="liveStatus === 'live'">
          <span class="live-label">Live</span>
          <span v-if="viewers > 1" class="viewers">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
            </svg>
            {{ viewers }}<span class="sr-only"> viewing</span>
          </span>
        </template>
        <span v-else class="live-label">{{ liveStatus === "connecting" ? "Reconnecting…" : "Offline" }}</span>
      </span>
      <span class="tb-divider" aria-hidden="true" />
      <button
        v-if="readOnly"
        class="tb-unlock"
        type="button"
        title="Enter edit key"
        aria-label="Enter edit key"
        @click="emit('enterKey')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="15" r="4" />
          <path d="M10.8 12.2L20 3M17 6l3 3M15 8l2 2" />
        </svg>
        <span>Enter edit key</span>
      </button>
      <BoardConfigMenu
        v-if="!readOnly"
        @open-columns="emit('openColumns')"
        @open-tags="emit('openTags')"
        @open-priorities="emit('openPriorities')"
        @open-general="emit('openGeneral')"
      />
      <span class="tb-divider" aria-hidden="true" />
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tb-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.brand {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
button.brand:hover {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
}
button.brand:active {
  transform: scale(0.97);
}
button.brand:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tb-titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tb-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  font-size: 13px;
  color: var(--muted);
}

.tb-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}

.tb-key {
  flex: none;
  margin-right: 2px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  padding: 3px 8px;
  border-radius: 6px;
}

.tb-ro {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  padding: 3px 9px 3px 7px;
  border-radius: 999px;
  background: var(--warning-bg);
  color: var(--warning-text);
  font-size: 12px;
  font-weight: 600;
}
.tb-ro svg {
  width: 12px;
  height: 12px;
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel);
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
}
.live.is-live .live-dot {
  background: var(--success-border);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--success-border) 60%, transparent);
  animation: live-pulse 2.4s ease-out infinite;
}
.live.is-connecting .live-dot {
  background: var(--warning-text);
}
.live.is-offline {
  color: var(--danger);
}
.live.is-offline .live-dot {
  background: var(--danger);
}
.viewers {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding-left: 6px;
  border-left: 1px solid var(--border);
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.viewers svg {
  width: 13px;
  height: 13px;
  color: var(--muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--success-border) 55%, transparent); }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .live.is-live .live-dot { animation: none; }
}

.tb-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding-top: 5px;
}

.tb-unlock {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.tb-unlock:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
}
.tb-unlock svg {
  width: 15px;
  height: 15px;
  color: var(--accent);
}

.tb-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--border);
}

@media (max-width: 640px) {
  .live-label {
    display: none;
  }
  .tb-left {
    gap: 10px;
  }
  .tb-right {
    padding-top: 1px;
  }
  .tb-unlock span {
    display: none;
  }
  .tb-unlock {
    width: 34px;
    padding: 0;
    justify-content: center;
  }
}
</style>
