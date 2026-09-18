<script setup lang="ts">
defineProps<{
  color?: string | null;
  size?: number;
}>();
</script>

<!-- Flag glyph used wherever a priority is shown; hollow + muted when there is none. -->
<template>
  <svg
    class="priority-icon"
    viewBox="0 0 24 24"
    :width="size ?? 14"
    :height="size ?? 14"
    :style="{ color: color || 'var(--muted)' }"
    aria-hidden="true"
  >
    <path
      d="M5 21V4.5M5 4.5c2.5-1.6 5-1.6 7.5 0s5 1.6 7.5 0v9c-2.5 1.6-5 1.6-7.5 0s-5-1.6-7.5 0"
      :fill="color ? 'currentColor' : 'none'"
      :fill-opacity="color ? 0.9 : 0"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.priority-icon {
  display: block;
  flex: none;
}
</style>
