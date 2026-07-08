<script setup lang="ts">
import draggable from "vuedraggable";
import type { Card as CardType } from "../api";
import CardTile from "./Card.vue";

const props = defineProps<{
  title: string;
  color: string;
  columnId: number;
  cards: CardType[];
  prefix: string;
  readOnly: boolean;
  disableDrag?: boolean;
}>();

const emit = defineEmits<{
  change: [];
  open: [card: CardType];
  addCard: [];
}>();
</script>

<template>
  <div class="column" :style="{ '--column-accent': color, '--column-accent-bg': `color-mix(in srgb, ${color} 8%, transparent)` }">
    <div class="column-header">
      <span class="title">{{ title }}</span>
      <span class="count">{{ cards.length }}</span>
    </div>
    <draggable
      :list="cards"
      :group="{ name: 'cards', pull: true, put: true }"
      item-key="id"
      class="column-body"
      :disabled="readOnly || disableDrag"
      :animation="150"
      ghost-class="ghost-card"
      @change="emit('change')"
    >
      <template #item="{ element }">
        <CardTile :card="element" :prefix="prefix" @open="emit('open', element)" />
      </template>
    </draggable>
    <button v-if="!readOnly" class="add-card" @click="emit('addCard')">+ Add card</button>
  </div>
</template>

<style scoped>
.column {
  background: var(--column-accent-bg, var(--column-bg));
  border-radius: 8px;
  border-top: 3px solid var(--column-accent);
  padding: 7px 10px 10px;
  display: flex;
  flex-direction: column;
  min-width: 260px;
  max-width: 300px;
  flex: 1;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--muted);
  padding: 4px 6px 10px;
}

.column-header .title {
  color: var(--column-accent);
}

.count {
  background: var(--badge-bg);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 12px;
}

.column-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 40px;
  flex: 1;
}

.ghost-card {
  opacity: 0.4;
}

.add-card {
  margin-top: 10px;
  background: transparent;
  border: none;
  text-align: left;
  padding: 8px 6px;
  color: var(--muted);
  border-radius: 4px;
  font-size: 14px;
}

.add-card:hover {
  background: var(--column-hover-bg);
  color: var(--text);
}
</style>
