<script setup lang="ts">
import draggable from "vuedraggable";
import type { Card as CardType } from "../api";
import type { Density } from "../lib/density";
import CardTile from "./Card.vue";

defineProps<{
  title: string;
  color: string;
  columnId: number;
  cards: CardType[];
  prefix: string;
  readOnly: boolean;
  disableDrag?: boolean;
  density: Density;
}>();

const emit = defineEmits<{
  change: [];
  open: [card: CardType];
  addCard: [];
}>();
</script>

<template>
  <section class="column" :class="`d-${density}`" :style="{ '--column-accent': color }">
    <header class="column-header">
      <span class="dot" aria-hidden="true" />
      <span class="title">{{ title }}</span>
      <span class="count">{{ cards.length }}</span>
      <button
        v-if="!readOnly"
        class="head-add"
        type="button"
        :title="`Add card to ${title}`"
        :aria-label="`Add card to ${title}`"
        @click="emit('addCard')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </header>

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
        <CardTile :card="element" :prefix="prefix" :density="density" @open="emit('open', element)" />
      </template>
    </draggable>

    <button v-if="!readOnly" class="add-card" type="button" @click="emit('addCard')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add card
    </button>
  </section>
</template>

<style scoped>
.column {
  --soft: color-mix(in srgb, var(--text) 7%, transparent);
  --col-width: 280px;
  --col-gap: 8px;

  display: flex;
  flex-direction: column;
  flex: 0 0 var(--col-width);
  width: var(--col-width);
  padding: 10px 8px 8px;
  background: color-mix(in srgb, var(--column-accent) 5%, var(--column-bg));
  border: 1px solid color-mix(in srgb, var(--column-accent) 14%, var(--border));
  border-radius: 12px;
}
.column.d-compact {
  --col-width: 244px;
  --col-gap: 5px;
  padding: 8px 6px 6px;
  border-radius: 10px;
}
.column.d-comfortable {
  --col-width: 316px;
  --col-gap: 10px;
  padding: 12px 10px 10px;
  border-radius: 14px;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 10px 6px;
  min-height: 28px;
}
.d-compact .column-header {
  padding-bottom: 7px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
  background: var(--column-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--column-accent) 22%, transparent);
}

.title {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-size: 11.5px;
  color: var(--muted);
  background: var(--soft);
  border-radius: 999px;
  padding: 1px 8px;
}

.head-add {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: none;
  color: var(--muted);
}
.head-add:hover {
  background: var(--soft);
  color: var(--text);
}
.head-add svg {
  width: 14px;
  height: 14px;
}

.column-body {
  display: flex;
  flex-direction: column;
  gap: var(--col-gap);
  min-height: 44px;
  flex: 1;
}

/* nothing to show: a quiet drop target instead of blank space */
.column-body:empty::after {
  content: "No cards";
  display: grid;
  place-items: center;
  min-height: 56px;
  border: 1px dashed color-mix(in srgb, var(--column-accent) 30%, var(--border));
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--muted);
}

.ghost-card {
  opacity: 0.4;
}

.add-card {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 7px 8px;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--muted);
  font-size: 13px;
  text-align: left;
}
.add-card:hover {
  background: var(--soft);
  color: var(--text);
}
.add-card svg {
  width: 14px;
  height: 14px;
}
.d-compact .add-card {
  margin-top: 4px;
  padding: 5px 8px;
}
</style>
