<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const emit = defineEmits<{
  openColumns: [];
  openTags: [];
  openGeneral: [];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function openColumns() {
  open.value = false;
  emit("openColumns");
}

function openTags() {
  open.value = false;
  emit("openTags");
}

function openGeneral() {
  open.value = false;
  emit("openGeneral");
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
  document.addEventListener("mousedown", onDocumentMousedown);
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onDocumentMousedown);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="root" class="config-menu">
    <button
      class="icon-btn"
      type="button"
      title="Board settings"
      aria-label="Board settings"
      :aria-expanded="open"
      @click="toggle"
    >
      ⚙️
    </button>
    <div v-if="open" class="config-panel">
      <button class="config-item" type="button" @click="openColumns">
        <span class="config-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" />
          </svg>
        </span>
        <span>Columns &amp; statuses</span>
      </button>
      <button class="config-item" type="button" @click="openTags">
        <span class="config-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="8" cy="8" r="1.4" />
          </svg>
        </span>
        <span>Tags</span>
      </button>
      <button class="config-item" type="button" @click="openGeneral">
        <span class="config-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" />
          </svg>
        </span>
        <span>General</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.config-menu {
  position: relative;
  display: inline-flex;
}

.config-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 210px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 18px 40px -16px var(--shadow-color), 0 2px 6px var(--shadow-color);
  padding: 5px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 7px;
  text-align: left;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
}

.config-item:hover,
.config-item:focus-visible {
  background: color-mix(in srgb, var(--text) 7%, transparent);
  outline: none;
}

.config-icon {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: var(--muted);
  flex-shrink: 0;
}

.config-icon svg {
  width: 16px;
  height: 16px;
}

.config-item:hover .config-icon,
.config-item:focus-visible .config-icon {
  color: var(--text);
}
</style>
