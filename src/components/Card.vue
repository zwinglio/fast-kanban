<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../api";
import type { Density } from "../lib/density";

const props = defineProps<{
  card: Card;
  prefix: string;
  density: Density;
}>();

defineEmits<{ open: [] }>();

const displayId = computed(() => `${props.prefix}-${props.card.seq}`);
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
    :class="`d-${density}`"
    role="button"
    tabindex="0"
    @click="$emit('open')"
    @keydown.enter.prevent="$emit('open')"
  >
    <div class="card-top">
      <span class="card-id">{{ displayId }}</span>
      <span v-if="hasBody && density !== 'comfortable'" class="has-body" title="Has description" aria-label="Has description">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
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
