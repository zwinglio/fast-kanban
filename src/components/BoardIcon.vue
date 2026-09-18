<script setup lang="ts">
import { computed } from "vue";
import { findBoardIcon } from "../lib/boardIcons";

const props = withDefaults(
  defineProps<{
    icon?: string | null;
    title?: string;
    size?: number; // tile size in px
    muted?: boolean; // neutral colors, e.g. for non-current rows
  }>(),
  { icon: null, title: "", size: 32, muted: false }
);

const def = computed(() => findBoardIcon(props.icon));
const letter = computed(() => props.title.trim().charAt(0) || "?");
</script>

<!-- A board's icon tile; falls back to the title's first letter when no icon is set. -->
<template>
  <span
    class="board-icon"
    :class="{ muted }"
    :style="{ width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.28)}px` }"
    aria-hidden="true"
  >
    <svg
      v-if="def"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      :style="{ width: `${Math.round(size * 0.55)}px`, height: `${Math.round(size * 0.55)}px` }"
    >
      <path v-for="(d, i) in def.paths" :key="i" :d="d" />
    </svg>
    <span v-else class="letter" :style="{ fontSize: `${Math.round(size * 0.44)}px` }">{{ letter }}</span>
  </span>
</template>

<style scoped>
.board-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}
.board-icon.muted {
  background: color-mix(in srgb, var(--text) 7%, transparent);
  color: var(--muted);
}
.letter {
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}
</style>
