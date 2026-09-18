<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getCardEvents, type CardEvent } from "../api";

const PREVIEW = 4;
const PAGE = 10;

const props = defineProps<{
  cardId: number;
}>();

const events = ref<CardEvent[]>([]);
const total = ref(0);
const hasMore = ref(false);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref("");
const expanded = ref(false);

// Collapsed shows the latest few; expanding pages in more from the server.
const visible = computed(() => (expanded.value ? events.value : events.value.slice(0, PREVIEW)));
const canShowMore = computed(() => hasMore.value || (!expanded.value && events.value.length > PREVIEW));

async function loadFirst() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getCardEvents(props.cardId, { limit: PREVIEW });
    events.value = res.events;
    hasMore.value = res.hasMore;
    total.value = res.total;
  } catch {
    error.value = "Couldn't load activity.";
  } finally {
    loading.value = false;
  }
}

async function showMore() {
  if (!expanded.value && events.value.length > PREVIEW) {
    expanded.value = true;
    return;
  }
  expanded.value = true;
  if (!hasMore.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const last = events.value[events.value.length - 1];
    const res = await getCardEvents(props.cardId, { limit: PAGE, before: last?.id });
    events.value = [...events.value, ...res.events];
    hasMore.value = res.hasMore;
    total.value = res.total;
  } catch {
    error.value = "Couldn't load more activity.";
  } finally {
    loadingMore.value = false;
  }
}

function showLess() {
  expanded.value = false;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function relative(iso: string) {
  const ts = new Date(iso).getTime();
  const minutes = Math.round((ts - Date.now()) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (days > -7) return rtf.format(days, "day");
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function absolute(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type Part = { text: string; strong?: boolean };

function pts(n: number) {
  return `${n} ${n === 1 ? "point" : "points"}`;
}

// Builds the sentence for an entry as plain parts (rendered as text, never as HTML).
function describe(e: CardEvent): Part[] {
  switch (e.type) {
    case "created":
      return [{ text: "Created in " }, { text: e.data.column, strong: true }];
    case "moved":
      return [{ text: "Moved from " }, { text: e.data.from, strong: true }, { text: " to " }, { text: e.data.to, strong: true }];
    case "title":
      return [{ text: "Renamed to " }, { text: `“${e.data.to}”`, strong: true }];
    case "description":
      return [{ text: "Edited the description" }];
    case "priority":
      if (!e.data.to) return [{ text: "Removed priority " }, { text: e.data.from ?? "", strong: true }];
      if (!e.data.from) return [{ text: "Set priority to " }, { text: e.data.to, strong: true }];
      return [{ text: "Priority " }, { text: e.data.from, strong: true }, { text: " → " }, { text: e.data.to, strong: true }];
    case "tags": {
      const parts: Part[] = [];
      if (e.data.added.length) {
        parts.push({ text: e.data.added.length === 1 ? "Added tag " : "Added tags " });
        parts.push({ text: e.data.added.join(", "), strong: true });
      }
      if (e.data.removed.length) {
        parts.push({ text: parts.length ? " · removed " : e.data.removed.length === 1 ? "Removed tag " : "Removed tags " });
        parts.push({ text: e.data.removed.join(", "), strong: true });
      }
      return parts;
    }
    case "points":
      if (e.data.to === null) return [{ text: "Cleared the estimate" }];
      if (e.data.from === null) return [{ text: "Estimated at " }, { text: pts(e.data.to), strong: true }];
      return [{ text: "Estimate " }, { text: pts(e.data.from), strong: true }, { text: " → " }, { text: pts(e.data.to), strong: true }];
    case "archived":
      return [{ text: "Archived" }];
    case "restored":
      return [{ text: "Restored from the archive" }];
  }
}

const ICONS: Record<CardEvent["type"], string> = {
  created: "M12 5v14M5 12h14",
  moved: "M5 12h14M13 6l6 6-6 6",
  title: "M4 20h4L19 9l-4-4L4 16v4z",
  description: "M4 6h16M4 12h16M4 18h10",
  priority: "M5 21V4.5M5 4.5c2.5-1.6 5-1.6 7.5 0s5 1.6 7.5 0v9c-2.5 1.6-5 1.6-7.5 0s-5-1.6-7.5 0",
  points: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  tags: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z",
  archived: "M3 4h18v5H3zM5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4",
  restored: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
};

onMounted(loadFirst);
</script>

<template>
  <section class="activity" aria-label="Card activity">
    <div class="activity-head">
      <span class="label">Activity</span>
      <span v-if="!loading && total" class="count">{{ total }}</span>
    </div>

    <ul v-if="loading" class="timeline" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="item skeleton">
        <span class="icon" />
        <span class="lines"><i /><i class="short" /></span>
      </li>
    </ul>

    <p v-else-if="error && !events.length" class="empty">
      {{ error }} <button type="button" class="link" @click="loadFirst">Try again</button>
    </p>

    <p v-else-if="!events.length" class="empty">No activity yet.</p>

    <template v-else>
      <ol class="timeline">
        <li v-for="e in visible" :key="e.id" class="item" :class="`t-${e.type}`">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path :d="ICONS[e.type]" />
            </svg>
          </span>
          <div class="body">
            <p class="what">
              <template v-for="(part, i) in describe(e)" :key="i">
                <b v-if="part.strong">{{ part.text }}</b><template v-else>{{ part.text }}</template>
              </template>
            </p>
            <time class="when" :datetime="e.createdAt" :title="absolute(e.createdAt)">{{ relative(e.createdAt) }}</time>
          </div>
        </li>
      </ol>

      <p v-if="error" class="more-error">{{ error }}</p>

      <div v-if="canShowMore || expanded" class="activity-foot">
        <button v-if="canShowMore" type="button" class="link" :disabled="loadingMore" @click="showMore">
          {{ loadingMore ? "Loading…" : "Show more" }}
        </button>
        <button v-if="expanded && events.length > 4" type="button" class="link muted" @click="showLess">
          Show less
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.activity-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.count {
  font-size: 11px;
  color: var(--muted);
  background: var(--soft);
  border-radius: 999px;
  padding: 1px 7px;
}

/* vertical timeline: icons joined by a thin rail */
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item {
  position: relative;
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
}
.item:not(:last-child)::before {
  content: "";
  position: absolute;
  left: 11px;
  top: 24px;
  bottom: 2px;
  width: 1px;
  background: var(--border);
}
.icon {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  flex: none;
  border-radius: 50%;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--muted);
}
.icon svg {
  width: 11px;
  height: 11px;
}
.t-created .icon,
.t-restored .icon {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}
.t-archived .icon {
  border-style: dashed;
}
.body {
  min-width: 0;
  padding-top: 2px;
}
.what {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.what b {
  color: var(--text);
  font-weight: 600;
}
.when {
  display: block;
  margin-top: 1px;
  font-size: 11.5px;
  color: var(--muted);
  opacity: 0.8;
}

.activity-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 27px;
}
.link {
  padding: 4px 6px;
  margin-left: -6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
}
.link:hover:not(:disabled) {
  background: var(--accent-soft);
}
.link:disabled {
  opacity: 0.6;
  cursor: default;
}
.link.muted {
  color: var(--muted);
  margin-left: 0;
}
.link.muted:hover {
  background: var(--soft);
  color: var(--text);
}
.empty,
.more-error {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
.more-error {
  margin: 0 0 6px 33px;
  color: var(--danger);
}

/* loading placeholder */
.skeleton .icon {
  background: var(--soft);
  border-color: transparent;
}
.skeleton .lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 5px;
}
.skeleton .lines i {
  display: block;
  height: 8px;
  width: 85%;
  border-radius: 4px;
  background: var(--soft);
  animation: pulse 1.2s ease-in-out infinite;
}
.skeleton .lines i.short {
  width: 40%;
}
@keyframes pulse {
  50% { opacity: 0.45; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton .lines i { animation: none; }
}
</style>
