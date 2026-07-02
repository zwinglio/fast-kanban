<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../api";

const props = defineProps<{
  card: Card;
  prefix: string;
}>();

defineEmits<{ open: [] }>();

const displayId = computed(() => `${props.prefix}-${props.card.seq}`);
</script>

<template>
  <div class="card-tile" @click="$emit('open')">
    <div class="card-id">{{ displayId }}</div>
    <div class="card-title">{{ card.title }}</div>
  </div>
</template>

<style scoped>
.card-tile {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  box-shadow: 0 1px 2px var(--shadow-color);
}

.card-tile:hover {
  border-color: var(--accent);
}

.card-id {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.02em;
}

.card-title {
  margin-top: 4px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
