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
        <span class="config-icon">▦</span>
        <span>Columns &amp; statuses</span>
      </button>
      <button class="config-item" type="button" @click="openTags">
        <span class="config-icon">🏷</span>
        <span>Tags</span>
      </button>
      <button class="config-item" type="button" @click="openGeneral">
        <span class="config-icon">✎</span>
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
  min-width: 190px;
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

.config-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  text-align: left;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
}

.config-item:hover {
  background: var(--badge-bg);
}

.config-icon {
  width: 18px;
  text-align: center;
  color: var(--muted);
  flex-shrink: 0;
}
</style>
