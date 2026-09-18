<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { forgetBoard, getRecentBoards, type RecentBoard } from "../lib/recentBoards";
import BoardIcon from "./BoardIcon.vue";

const props = defineProps<{
  currentId: string;
  currentTitle: string;
  currentHasKey: boolean;
  currentIcon: string | null;
}>();

const router = useRouter();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const stored = ref<RecentBoard[]>([]);

const entries = computed<RecentBoard[]>(() => [
  {
    id: props.currentId,
    title: props.currentTitle,
    hasKey: props.currentHasKey,
    icon: props.currentIcon,
    lastAccessed: Date.now(),
  },
  ...stored.value.filter((b) => b.id !== props.currentId),
]);

function refresh() {
  stored.value = getRecentBoards();
}

function toggle() {
  open.value = !open.value;
  if (open.value) refresh();
}

function goTo(id: string) {
  if (id === props.currentId) return;
  open.value = false;
  router.push({ name: "board", params: { id } });
}

function remove(id: string) {
  forgetBoard(id);
  refresh();
}

function onDocumentMousedown(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") open.value = false;
}

onMounted(() => {
  refresh();
  document.addEventListener("mousedown", onDocumentMousedown);
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onDocumentMousedown);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="root" class="switcher">
    <h1 class="board-name">
      <button
        class="title-trigger"
        type="button"
        title="Switch board"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click="toggle"
      >
        <span class="title-text" :title="currentTitle">{{ currentTitle }}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </h1>

    <div v-if="open" class="panel" role="menu">
      <div class="panel-head">Recent boards</div>
      <ul class="panel-list">
        <li class="row current">
          <div class="row-main" aria-current="page">
            <BoardIcon :icon="currentIcon" :title="currentTitle" :size="24" />
            <span class="row-title">{{ currentTitle }}</span>
            <span v-if="!currentHasKey" class="ro-badge">Read-only</span>
            <svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        </li>
        <li v-for="b in entries.slice(1)" :key="b.id" class="row">
          <button class="row-main" type="button" role="menuitem" @click="goTo(b.id)">
            <BoardIcon :icon="b.icon" :title="b.title" :size="24" muted />
            <span class="row-title">{{ b.title || "Untitled board" }}</span>
            <span v-if="!b.hasKey" class="ro-badge">Read-only</span>
          </button>
          <button
            class="row-remove"
            type="button"
            title="Remove from list"
            :aria-label="`Remove ${b.title} from recent boards`"
            @click.stop="remove(b.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </li>
      </ul>
      <p v-if="entries.length === 1" class="panel-empty">No other boards yet.</p>
      <router-link to="/" class="panel-foot" @click="open = false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New board
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.switcher {
  --soft: color-mix(in srgb, var(--text) 7%, transparent);
  --accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);

  position: relative;
  min-width: 0;
}

.board-name {
  margin: 0;
  min-width: 0;
  font-size: inherit;
}

.title-trigger {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  max-width: calc(100% + 8px);
  padding: 2px 8px;
  margin-left: -8px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.title-trigger:hover,
.title-trigger[aria-expanded="true"] {
  background: var(--soft);
}
.title-trigger[aria-expanded="true"] {
  border-color: var(--border);
}

/* wraps instead of truncating; only very long titles get clamped at two lines */
.title-text {
  min-width: 0;
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chev {
  width: 18px;
  height: 18px;
  margin-top: 9px;
  flex: none;
  color: var(--muted);
  transition: transform 0.15s ease;
}
.title-trigger[aria-expanded="true"] .chev {
  transform: rotate(180deg);
}

/* menu */
.panel {
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  left: -8px;
  width: 300px;
  max-width: calc(100vw - 32px);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 18px 40px -16px var(--shadow-color), 0 2px 6px var(--shadow-color);
  overflow: hidden;
}

.panel-head {
  padding: 10px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.panel-list {
  list-style: none;
  margin: 0;
  padding: 0 5px 5px;
  max-height: 300px;
  overflow-y: auto;
}

.row {
  position: relative;
  display: flex;
  align-items: center;
}

.row-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 7px 9px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--text);
  font-size: 13.5px;
  text-align: left;
}
button.row-main:hover,
button.row-main:focus-visible {
  background: var(--soft);
  outline: none;
}
.row.current .row-main {
  background: var(--accent-soft);
}
.row:not(.current) .row-main {
  padding-right: 34px;
}

.row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.ro-badge {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--warning-bg);
  color: var(--warning-text);
  font-size: 11px;
  font-weight: 600;
}

.check {
  width: 14px;
  height: 14px;
  flex: none;
  color: var(--accent);
}

.row-remove {
  position: absolute;
  right: 5px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.row:hover .row-remove,
.row-remove:focus-visible {
  opacity: 1;
}
.row-remove:hover {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}
.row-remove svg {
  width: 10px;
  height: 10px;
}

.panel-empty {
  margin: 0;
  padding: 4px 14px 12px;
  font-size: 13px;
  color: var(--muted);
}

.panel-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.panel-foot:hover {
  background: var(--accent-soft);
}
.panel-foot svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 520px) {
  .title-text {
    font-size: 21px;
  }
  .chev {
    margin-top: 6px;
  }
}
</style>
