<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  label: string;
  hint?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>

<!-- Full-width on/off row: switch + label + optional hint. -->
<template>
  <button
    type="button"
    class="switch-row"
    role="switch"
    :aria-checked="modelValue"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="switch" aria-hidden="true"><span class="knob" /></span>
    <span class="switch-text">
      <span class="switch-title">{{ label }}</span>
      <span v-if="hint" class="switch-hint">{{ hint }}</span>
    </span>
  </button>
</template>

<style scoped>
.switch-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  text-align: left;
  transition: border-color 0.15s ease;
}
.switch-row:hover {
  border-color: color-mix(in srgb, var(--border) 50%, var(--text));
}
.switch-row[aria-checked="true"] {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}
.switch-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
  margin-top: 1px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 18%, transparent);
  transition: background 0.15s ease;
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease;
}
.switch-row[aria-checked="true"] .switch {
  background: var(--accent);
}
.switch-row[aria-checked="true"] .knob {
  transform: translateX(14px);
}
.switch-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.switch-title {
  font-size: 14px;
  font-weight: 600;
}
.switch-hint {
  font-size: 12.5px;
  color: var(--muted);
}
@media (prefers-reduced-motion: reduce) {
  .knob,
  .switch {
    transition: none;
  }
}
</style>
