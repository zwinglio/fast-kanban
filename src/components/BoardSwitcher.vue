<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { forgetBoard, getRecentBoards, type RecentBoard } from "../lib/recentBoards";

const props = defineProps<{
  currentId: string;
  currentTitle: string;
  currentHasKey: boolean;
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
    <button
      class="icon-btn"
      type="button"
      title="Switch board"
      aria-label="Switch board"
      :aria-expanded="open"
      @click="toggle"
    >
      ⇄
    </button>
    <div v-if="open" class="switcher-panel">
      <div class="switcher-row current">
        <div class="switcher-item">
          <span class="switcher-title">{{ currentTitle }}</span>
          <span v-if="!currentHasKey" class="switcher-badge">Read-only</span>
          <span class="switcher-badge current-badge">Current</span>
        </div>
      </div>
      <div v-if="entries.length === 1" class="switcher-empty">No other boards yet</div>
      <div
        v-for="b in entries.slice(1)"
        :key="b.id"
        class="switcher-row"
      >
        <button class="switcher-item" type="button" @click="goTo(b.id)">
          <span class="switcher-title">{{ b.title }}</span>
          <span v-if="!b.hasKey" class="switcher-badge">Read-only</span>
        </button>
        <button
          class="remove-btn"
          type="button"
          title="Remove from list"
          @click.stop="remove(b.id)"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.switcher {
  position: relative;
  display: inline-flex;
}

.switcher-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  max-width: 320px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 20px var(--shadow-color);
  padding: 6px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.switcher-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
}

.switcher-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  text-align: left;
  color: var(--text);
  font-size: 14px;
}

.switcher-row:not(.current) .switcher-item:hover {
  background: var(--badge-bg);
}

.switcher-row.current .switcher-item {
  cursor: default;
  background: var(--secondary-hover-bg);
}

.switcher-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-weight: 600;
}

.switcher-badge {
  flex-shrink: 0;
  background: var(--warning-bg);
  color: var(--warning-text);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
}

.current-badge {
  background: var(--badge-bg);
  color: var(--muted);
}

.remove-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 4px;
}

.remove-btn:hover {
  color: var(--danger);
  background: var(--badge-bg);
}

.switcher-empty {
  padding: 10px;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}
</style>
