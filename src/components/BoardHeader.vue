<script setup lang="ts">
import BoardSwitcher from "./BoardSwitcher.vue";
import BoardConfigMenu from "./BoardConfigMenu.vue";
import ThemeToggle from "./ThemeToggle.vue";

defineProps<{
  boardId: string;
  title: string;
  prefix: string;
  readOnly: boolean;
  cardCount: number;
  columnCount: number;
  tagCount: number;
  archivedCount: number;
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
      <router-link to="/" class="brand" title="Fast Kanban — create a board" aria-label="Fast Kanban home">
        <img src="/favicon.svg" alt="" width="24" height="24" />
      </router-link>
      <div class="tb-titles">
        <BoardSwitcher :current-id="boardId" :current-title="title" :current-has-key="!readOnly" />
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
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
  transition: border-color 0.15s ease;
}
.brand:hover {
  border-color: color-mix(in srgb, var(--border) 45%, var(--text));
}
.brand img {
  display: block;
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
  .brand {
    width: 36px;
    height: 36px;
    border-radius: 10px;
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
