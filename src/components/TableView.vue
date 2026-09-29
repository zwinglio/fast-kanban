<script setup lang="ts">
import { computed, ref } from "vue";
import type { Card, Column, Priority } from "../api";
import PriorityIcon from "./PriorityIcon.vue";

const props = defineProps<{
  cards: Card[];
  columns: Column[];
  priorities: Priority[];
  prefix: string;
  pointsEnabled: boolean;
  dependenciesEnabled: boolean;
  openBlockers: Record<number, string[]>;
}>();

const emit = defineEmits<{ open: [card: Card] }>();

type SortKey = "key" | "title" | "status" | "priority" | "points" | "updated";
type SortState = { key: SortKey; direction: "asc" | "desc" };

const sort = ref<SortState | null>(null);
const visibleColumnCount = computed(() => 6 + Number(props.pointsEnabled) + Number(props.dependenciesEnabled));

const sortedCards = computed(() => {
  if (!sort.value) return props.cards;

  const { key, direction } = sort.value;
  const sign = direction === "asc" ? 1 : -1;
  return [...props.cards].sort((a, b) => {
    if (key === "key") return (a.seq - b.seq) * sign;
    if (key === "title") return a.title.localeCompare(b.title) * sign;
    if (key === "status") {
      const aIndex = props.columns.findIndex((column) => column.id === a.columnId);
      const bIndex = props.columns.findIndex((column) => column.id === b.columnId);
      return (aIndex - bIndex) * sign;
    }
    if (key === "priority") {
      const aIndex = props.priorities.findIndex((priority) => priority.id === a.priorityId);
      const bIndex = props.priorities.findIndex((priority) => priority.id === b.priorityId);
      const aRank = aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex;
      const bRank = bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex;
      return (aRank - bRank) * sign;
    }
    if (key === "points") {
      if (a.points === null) return b.points === null ? 0 : 1;
      if (b.points === null) return -1;
      return (a.points - b.points) * sign;
    }
    return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sign;
  });
});

function cycleSort(key: SortKey) {
  if (sort.value?.key !== key) {
    sort.value = { key, direction: "asc" };
  } else if (sort.value.direction === "asc") {
    sort.value = { key, direction: "desc" };
  } else {
    sort.value = null;
  }
}

function ariaSort(key: SortKey) {
  if (sort.value?.key !== key) return "none";
  return sort.value.direction === "asc" ? "ascending" : "descending";
}

function sortIndicator(key: SortKey) {
  if (sort.value?.key !== key) return "↕";
  return sort.value.direction === "asc" ? "↑" : "↓";
}

function columnFor(card: Card) {
  return props.columns.find((column) => column.id === card.columnId);
}

function priorityFor(card: Card) {
  return props.priorities.find((priority) => priority.id === card.priorityId);
}

function updatedLabel(timestamp: string) {
  const date = new Date(timestamp);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function openFromKeyboard(event: KeyboardEvent, card: Card) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("open", card);
  }
}
</script>

<template>
  <div class="table-wrap">
    <table class="card-table">
      <thead>
        <tr>
          <th class="key-col" scope="col" :aria-sort="ariaSort('key')">
            <button type="button" @click="cycleSort('key')">Key <span aria-hidden="true">{{ sortIndicator('key') }}</span></button>
          </th>
          <th class="title-col" scope="col" :aria-sort="ariaSort('title')">
            <button type="button" @click="cycleSort('title')">Title <span aria-hidden="true">{{ sortIndicator('title') }}</span></button>
          </th>
          <th scope="col" :aria-sort="ariaSort('status')">
            <button type="button" @click="cycleSort('status')">Status <span aria-hidden="true">{{ sortIndicator('status') }}</span></button>
          </th>
          <th scope="col" :aria-sort="ariaSort('priority')">
            <button type="button" @click="cycleSort('priority')">Priority <span aria-hidden="true">{{ sortIndicator('priority') }}</span></button>
          </th>
          <th scope="col">Tags</th>
          <th v-if="pointsEnabled" scope="col" :aria-sort="ariaSort('points')">
            <button type="button" @click="cycleSort('points')">Points <span aria-hidden="true">{{ sortIndicator('points') }}</span></button>
          </th>
          <th v-if="dependenciesEnabled" scope="col">Blocked by</th>
          <th scope="col" :aria-sort="ariaSort('updated')">
            <button type="button" @click="cycleSort('updated')">Updated <span aria-hidden="true">{{ sortIndicator('updated') }}</span></button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!sortedCards.length">
          <td class="empty-state" :colspan="visibleColumnCount">No cards match the current filters.</td>
        </tr>
        <tr
          v-for="card in sortedCards"
          :key="card.id"
          class="card-row"
          tabindex="0"
          :aria-label="`Open ${prefix}-${card.seq}: ${card.title}`"
          @click="emit('open', card)"
          @keydown="openFromKeyboard($event, card)"
        >
          <td class="key-col card-key">{{ prefix }}-{{ card.seq }}</td>
          <td class="title-col">
            <span class="title-content">
              <span class="title-text" :title="card.title">{{ card.title }}</span>
              <span v-if="card.archivedAt" class="archived-badge">Archived</span>
            </span>
          </td>
          <td>
            <span class="status-cell">
              <span v-if="columnFor(card)" class="status-dot" :style="{ backgroundColor: columnFor(card)?.color }" aria-hidden="true" />
              {{ columnFor(card)?.name ?? "—" }}
            </span>
          </td>
          <td>
            <span v-if="priorityFor(card)" class="priority-cell">
              <PriorityIcon :color="priorityFor(card)?.color" :size="14" />
              {{ priorityFor(card)?.name }}
            </span>
            <span v-else class="muted">—</span>
          </td>
          <td>
            <span v-if="card.tags?.length" class="tag-list">
              <span v-for="tag in card.tags" :key="tag.id" class="tag-chip">{{ tag.name }}</span>
            </span>
            <span v-else class="muted">—</span>
          </td>
          <td v-if="pointsEnabled" class="numeric-cell">{{ card.points ?? "—" }}</td>
          <td v-if="dependenciesEnabled" class="blocked-cell">
            <span v-if="openBlockers[card.id]?.length" class="blocker-list">
              {{ openBlockers[card.id]?.join(", ") }}
            </span>
            <span v-else class="muted">—</span>
          </td>
          <td>
            <time class="updated-cell" :datetime="card.updatedAt" :title="new Date(card.updatedAt).toLocaleString()">
              {{ updatedLabel(card.updatedAt) }}
            </time>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
}

.card-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: separate;
  border-spacing: 0;
  color: var(--text);
  font-size: 13px;
}

.card-table th,
.card-table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
}

.card-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--panel);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.card-table th button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}
.card-table th button:hover,
.card-table th button:focus-visible {
  color: var(--accent);
}
.card-table th button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 2px;
}
.card-table th button span {
  color: var(--accent);
  font-size: 13px;
  letter-spacing: 0;
}

.card-table .key-col {
  position: sticky;
  left: 0;
  width: 115px;
  min-width: 115px;
  max-width: 115px;
}
.card-table .title-col {
  position: sticky;
  left: 115px;
  width: 300px;
  min-width: 300px;
  max-width: 300px;
}
.card-table th.key-col,
.card-table th.title-col {
  z-index: 4;
}
.card-table td.key-col,
.card-table td.title-col {
  z-index: 1;
  background: var(--panel);
}
.card-table .card-row {
  cursor: pointer;
  outline: none;
}
.card-table .card-row:hover td,
.card-table .card-row:focus-visible td {
  background: color-mix(in srgb, var(--accent) 6%, var(--panel));
}
.card-table .card-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.card-table .card-row:last-child td {
  border-bottom: 0;
}

.card-key {
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.title-content {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
.title-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  white-space: nowrap;
}
.title-col {
  white-space: nowrap;
}
.archived-badge {
  flex: none;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
}
.status-cell,
.priority-cell {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}
.status-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
}
.priority-cell {
  color: var(--text);
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 130px;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 7%, transparent);
  color: color-mix(in srgb, var(--text) 80%, var(--muted));
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
}
.numeric-cell {
  font-variant-numeric: tabular-nums;
}
.blocked-cell {
  min-width: 120px;
  white-space: nowrap;
}
.blocker-list {
  color: var(--danger);
}
.updated-cell {
  color: var(--muted);
  white-space: nowrap;
}
.muted,
.empty-state {
  color: var(--muted);
}
.empty-state {
  padding: 42px 20px !important;
  text-align: center !important;
}

@media (max-width: 640px) {
  .card-table th,
  .card-table td {
    padding: 10px 12px;
  }
}
</style>
