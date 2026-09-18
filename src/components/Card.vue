<script setup lang="ts">
import { computed } from "vue";
import type { Card, Priority } from "../api";
import PriorityIcon from "./PriorityIcon.vue";
import type { Density } from "../lib/density";

const props = defineProps<{
  card: Card;
  prefix: string;
  density: Density;
  priorities: Priority[];
  pointsEnabled: boolean;
  openBlockers: string[]; // IDs of blockers that aren't done yet
}>();

defineEmits<{ open: [] }>();

const displayId = computed(() => `${props.prefix}-${props.card.seq}`);
const priority = computed(() =>
  props.card.priorityId === null ? null : props.priorities.find((p) => p.id === props.card.priorityId) ?? null
);
const hasBody = computed(() => !!props.card.body?.trim());

// Plain-text excerpt for the comfortable density; strips the common markdown syntax.
const excerpt = computed(() => {
  if (props.density !== "comfortable" || !props.card.body) return "";
  return props.card.body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
});

const updatedLabel = computed(() => {
  const d = new Date(props.card.updatedAt);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
});
</script>

<template>
  <div
    class="card-tile"
    :class="[`d-${density}`, { 'is-archived': card.archivedAt }]"
    role="button"
    tabindex="0"
    @click="$emit('open')"
    @keydown.enter.prevent="$emit('open')"
  >
    <div class="card-top">
      <span class="card-id">{{ displayId }}</span>
      <span class="card-signals">
        <span
          v-if="openBlockers.length"
          class="blocked-chip"
          :title="`Blocked by ${openBlockers.join(', ')}`"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" />
          </svg>
          <span v-if="density !== 'compact'">Blocked<template v-if="openBlockers.length > 1"> · {{ openBlockers.length }}</template></span>
        </span>
        <span v-if="card.archivedAt" class="archived-chip" title="Archived">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="5" rx="1.5" />
            <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
          </svg>
          <span v-if="density !== 'compact'">Archived</span>
        </span>
        <span v-if="hasBody && density !== 'comfortable'" class="has-body" title="Has description" aria-label="Has description">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </span>
        <span
          v-if="card.commentCount"
          class="comment-count"
          :title="`${card.commentCount} ${card.commentCount === 1 ? 'comment' : 'comments'}`"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" />
          </svg>
          {{ card.commentCount }}
        </span>
        <span
          v-if="pointsEnabled && card.points !== null"
          class="card-points"
          :title="`${card.points} story ${card.points === 1 ? 'point' : 'points'}`"
        >{{ card.points }}</span>
        <span
          v-if="priority"
          class="card-priority"
          :class="{ 'icon-only': density === 'compact' }"
          :style="{ '--p': priority.color }"
          :title="`Priority: ${priority.name}`"
        >
          <PriorityIcon :color="priority.color" :size="12" />
          <span v-if="density !== 'compact'">{{ priority.name }}</span>
        </span>
      </span>
    </div>

    <div class="card-title">{{ card.title }}</div>

    <p v-if="excerpt" class="card-excerpt">{{ excerpt }}</p>

    <div v-if="density !== 'compact' && card.tags?.length" class="card-tags">
      <span v-for="tag in card.tags" :key="tag.id" class="card-tag">{{ tag.name }}</span>
    </div>

    <div v-if="density === 'comfortable'" class="card-foot">
      <span>Updated {{ updatedLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.card-tile {
  --soft: color-mix(in srgb, var(--text) 7%, transparent);

  position: relative;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px 11px;
  cursor: pointer;
  box-shadow: 0 1px 2px var(--shadow-color);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.card-tile:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  box-shadow: 0 6px 16px -8px var(--shadow-color);
}

.card-tile:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-id {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--accent);
}

.card-tile.is-archived {
  background: color-mix(in srgb, var(--panel) 55%, transparent);
  border-style: dashed;
  box-shadow: none;
}
.card-tile.is-archived .card-title,
.card-tile.is-archived .card-tags {
  opacity: 0.7;
}
.archived-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}
.archived-chip svg {
  width: 12px;
  height: 12px;
}

.card-signals {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.card-priority {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 120px;
  padding: 1px 7px 1px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--p) 14%, transparent);
  color: color-mix(in srgb, var(--p) 75%, var(--text));
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
}
.card-priority span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-priority.icon-only {
  padding: 0;
  background: none;
}

.blocked-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px 1px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 13%, transparent);
  color: var(--danger);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}
.blocked-chip svg {
  width: 12px;
  height: 12px;
}
.d-compact .blocked-chip {
  padding: 0;
  background: none;
}

.comment-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.comment-count svg {
  width: 12px;
  height: 12px;
}

.card-points {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--soft);
  font-size: 11px;
  font-weight: 700;
  color: color-mix(in srgb, var(--text) 80%, var(--muted));
  font-variant-numeric: tabular-nums;
}

.has-body {
  display: grid;
  place-items: center;
  color: var(--muted);
}
.has-body svg {
  width: 13px;
  height: 13px;
}

.card-title {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.card-excerpt {
  margin: 6px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.card-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--soft);
  font-size: 11.5px;
  line-height: 1.5;
  color: color-mix(in srgb, var(--text) 80%, var(--muted));
  white-space: nowrap;
}

.card-foot {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 11.5px;
  color: var(--muted);
}

/* compact: one tight block, title clamped to two lines */
.card-tile.d-compact {
  padding: 7px 10px 8px;
  border-radius: 8px;
}
.d-compact .card-title {
  margin-top: 2px;
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
}

/* comfortable: more air around everything */
.card-tile.d-comfortable {
  padding: 13px 15px 12px;
  border-radius: 12px;
}
.d-comfortable .card-title {
  margin-top: 6px;
  font-size: 14.5px;
  font-weight: 500;
}
.d-comfortable .card-tags {
  margin-top: 11px;
}
</style>
