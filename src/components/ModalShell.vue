<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    width?: number;
  }>(),
  { width: 480 }
);

const emit = defineEmits<{
  close: [];
}>();

// Only close when the press both starts and ends on the backdrop, so a text
// selection that drifts outside the panel doesn't dismiss it.
const backdropArmed = ref(false);

function handleBackdrop() {
  if (!backdropArmed.value) return;
  backdropArmed.value = false;
  emit("close");
}

// Children can claim Escape (e.g. to revert an inline edit) by calling preventDefault.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  e.preventDefault();
  emit("close");
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="sheet-overlay" @mousedown.self="backdropArmed = true" @click.self="handleBackdrop">
    <div class="sheet" role="dialog" aria-modal="true" :aria-label="title" :style="{ width: `min(${width}px, 100%)` }">
      <header class="sheet-head">
        <div class="sheet-heading">
          <h2 class="sheet-title">{{ title }}</h2>
          <p v-if="subtitle" class="sheet-subtitle">{{ subtitle }}</p>
        </div>
        <button class="sheet-close" type="button" title="Close (Esc)" aria-label="Close" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div class="sheet-body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="sheet-foot">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>

<!-- Unscoped on purpose: these classes style the slot content of every settings modal. -->
<style>
.sheet-overlay {
  --soft: color-mix(in srgb, var(--text) 7%, transparent);
  --sunken: color-mix(in srgb, var(--text) 4%, var(--surface));
  --accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);

  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 32px 16px;
  z-index: 100;
  animation: sheet-fade 0.16s ease-out;
}

@keyframes sheet-fade {
  from { opacity: 0; }
}
@keyframes sheet-rise {
  from { opacity: 0; transform: translateY(8px) scale(0.99); }
}

.sheet {
  max-height: calc(100vh - 64px);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 32px 80px -24px var(--shadow-color);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  animation: sheet-rise 0.2s cubic-bezier(0.2, 0.8, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .sheet-overlay,
  .sheet { animation: none; }
}

.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 16px 16px 22px;
  border-bottom: 1px solid var(--border);
}
.sheet-heading { min-width: 0; }
.sheet-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}
.sheet-subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--muted);
}
.sheet-close {
  width: 34px;
  height: 34px;
  margin-top: -3px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex: none;
  background: none;
  border: 1px solid transparent;
  color: var(--muted);
}
.sheet-close:hover {
  background: var(--soft);
  color: var(--text);
  border-color: var(--border);
}
.sheet-close svg { width: 17px; height: 17px; }

.sheet-body {
  overflow-y: auto;
  padding: 20px 22px 22px;
}

.sheet-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}

/* sections */
.sheet-section + .sheet-section {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
}
.sheet-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.sheet-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.sheet-count {
  font-size: 11px;
  color: var(--muted);
  background: var(--soft);
  border-radius: 999px;
  padding: 1px 8px;
}

/* list rows */
.sheet-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sheet-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 5px 6px 5px 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color 0.15s ease;
}
.sheet-row:hover { border-color: color-mix(in srgb, var(--border) 55%, var(--text)); }
.sheet-row.is-confirming { border-color: color-mix(in srgb, var(--danger) 60%, var(--border)); }

.sheet-grip {
  display: grid;
  place-items: center;
  width: 18px;
  color: var(--muted);
  cursor: grab;
  flex: none;
}
.sheet-grip:active { cursor: grabbing; }
.sheet-grip svg { width: 14px; height: 14px; }

.sheet-meta {
  flex: none;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

/* inputs */
.sheet-input {
  width: 100%;
  min-height: 36px;
  padding: 6px 10px;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
}
.sheet-input:focus {
  outline: none;
  border-color: var(--accent);
}
.sheet-input::placeholder { color: var(--muted); }

/* looks like plain text until hovered/focused — rename in place */
.sheet-inline-input {
  flex: 1;
  min-width: 0;
  min-height: 32px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--text);
  font-size: 14px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.sheet-inline-input:hover:not(:disabled) { background: var(--soft); }
.sheet-inline-input:focus {
  outline: none;
  background: var(--sunken);
  border-color: var(--accent);
}

.sheet-add {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  position: relative;
}
.sheet-add .sheet-input { flex: 1; }

/* icon buttons */
.sheet-icon-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  flex: none;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--muted);
}
.sheet-icon-btn svg { width: 15px; height: 15px; }
.sheet-icon-btn:hover:not(:disabled) {
  background: var(--soft);
  color: var(--text);
}
.sheet-icon-btn.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}
.sheet-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* color swatches */
.sheet-swatch-btn {
  width: 22px;
  height: 22px;
  flex: none;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--panel);
  box-shadow: 0 0 0 1px var(--border);
  cursor: pointer;
}
.sheet-swatch-btn:hover { box-shadow: 0 0 0 1px var(--muted); }
.sheet-swatches {
  position: absolute;
  z-index: 10;
  top: calc(100% + 6px);
  left: 0;
  display: grid;
  grid-template-columns: repeat(6, 24px);
  gap: 6px;
  padding: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 18px 40px -16px var(--shadow-color);
}
.sheet-swatch {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
}
.sheet-swatch:hover { transform: scale(1.08); }
.sheet-swatch.selected {
  border-color: var(--text);
  box-shadow: inset 0 0 0 2px var(--panel);
}

/* badges + notes */
.sheet-key {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 4px 9px;
  border-radius: 6px;
}
.sheet-note {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--muted);
}
.sheet-empty {
  padding: 18px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
  border: 1px dashed var(--border);
  border-radius: 10px;
}
.sheet-error {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--danger);
}

/* inline delete confirmation (replaces window.confirm) */
.sheet-confirm {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding-left: 4px;
}
.sheet-confirm span {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sheet-confirm .go {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 11px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: var(--danger);
}
.sheet-confirm .go:hover:not(:disabled) { background: var(--danger-hover); }
.sheet-confirm .go:disabled { opacity: 0.6; cursor: not-allowed; }
.sheet-confirm .no {
  font-size: 13px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--muted);
}
.sheet-confirm .no:hover { color: var(--text); background: var(--soft); }

@media (max-width: 520px) {
  .sheet-overlay { padding: 0; place-items: stretch; }
  .sheet {
    width: 100% !important;
    max-height: none;
    height: 100dvh;
    border: 0;
    border-radius: 0;
  }
  .sheet-body { padding: 18px 16px; }
  .sheet-foot { padding: 12px 16px; }
}
</style>
