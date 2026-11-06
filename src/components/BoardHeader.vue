<script setup lang="ts">
import { useI18n } from "vue-i18n";
import BoardSwitcher from "./BoardSwitcher.vue";
import BoardConfigMenu from "./BoardConfigMenu.vue";
import ThemeToggle from "./ThemeToggle.vue";
import LanguageToggle from "./LanguageToggle.vue";
import BoardIcon from "./BoardIcon.vue";

defineProps<{
  boardId: string;
  title: string;
  prefix: string;
  icon: string | null;
  readOnly: boolean;
  cardCount: number;
  columnCount: number;
  tagCount: number;
  archivedCount: number;
  liveStatus: "connecting" | "live" | "offline";
  viewers: number;
  view: "board" | "table";
}>();

const { t } = useI18n();

const emit = defineEmits<{
  enterKey: [];
  openColumns: [];
  openTags: [];
  openPriorities: [];
  openGeneral: [];
  openAgents: [];
  "update:view": [view: "board" | "table"];
}>();
</script>

<template>
  <header class="topbar">
    <div class="tb-left">
      <button
        v-if="!readOnly"
        type="button"
        class="brand"
        :title="t('header.changeIcon')"
        :aria-label="t('header.changeIcon')"
        @click="emit('openGeneral')"
      >
        <BoardIcon :icon="icon" :title="title" :size="42" />
      </button>
      <span v-else class="brand static">
        <BoardIcon :icon="icon" :title="title" :size="42" />
      </span>
      <div class="tb-titles">
        <BoardSwitcher :current-id="boardId" :current-title="title" :current-has-key="!readOnly" :current-icon="icon" />
        <div class="tb-meta">
          <span class="tb-key" :title="t('header.cardPrefix')">{{ prefix }}</span>
          <span>{{ t("header.cardCount", cardCount) }}</span>
          <span class="tb-dot" aria-hidden="true" />
          <span>{{ t("header.columnCount", columnCount) }}</span>
          <span class="tb-dot" aria-hidden="true" />
          <span>{{ t("header.tagCount", tagCount) }}</span>
          <template v-if="archivedCount">
            <span class="tb-dot" aria-hidden="true" />
            <span>{{ t("header.archivedCount", archivedCount) }}</span>
          </template>
          <span v-if="readOnly" class="tb-ro" :title="t('header.readOnlyHint')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            {{ t("header.readOnly") }}
          </span>
        </div>
      </div>
    </div>

    <div class="tb-right">
      <div class="tb-view-toggle" role="group" :aria-label="t('header.viewGroup')">
        <button
          class="tb-view-button"
          type="button"
          :aria-pressed="view === 'board'"
          @click="emit('update:view', 'board')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="8" height="16" rx="1.5" />
            <rect x="13" y="4" width="8" height="10" rx="1.5" />
          </svg>
          <span>{{ t("header.viewBoard") }}</span>
        </button>
        <button
          class="tb-view-button"
          type="button"
          :aria-pressed="view === 'table'"
          @click="emit('update:view', 'table')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M9 10v10M16 10v10" />
          </svg>
          <span>{{ t("header.viewTable") }}</span>
        </button>
      </div>
      <span class="tb-divider" aria-hidden="true" />
      <span
        class="live"
        :class="`is-${liveStatus}`"
        :title="
          liveStatus === 'live'
            ? t('header.liveHint', viewers)
            : liveStatus === 'connecting'
              ? t('header.connectingHint')
              : t('header.offlineHint')
        "
      >
        <span class="live-dot" aria-hidden="true" />
        <template v-if="liveStatus === 'live'">
          <span class="live-label">{{ t("header.live") }}</span>
          <span v-if="viewers > 1" class="viewers">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
            </svg>
            {{ viewers }}<span class="sr-only"> {{ t("header.viewing") }}</span>
          </span>
        </template>
        <span v-else class="live-label">{{ liveStatus === "connecting" ? t("header.connecting") : t("header.offline") }}</span>
      </span>
      <span class="tb-divider" aria-hidden="true" />
      <button
        v-if="readOnly"
        class="tb-unlock"
        type="button"
        :title="t('header.enterEditKey')"
        :aria-label="t('header.enterEditKey')"
        @click="emit('enterKey')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="15" r="4" />
          <path d="M10.8 12.2L20 3M17 6l3 3M15 8l2 2" />
        </svg>
        <span>{{ t("header.enterEditKey") }}</span>
      </button>
      <BoardConfigMenu
        v-if="!readOnly"
        @open-columns="emit('openColumns')"
        @open-tags="emit('openTags')"
        @open-priorities="emit('openPriorities')"
        @open-general="emit('openGeneral')"
        @open-agents="emit('openAgents')"
      />
      <span class="tb-divider tb-divider-tools" aria-hidden="true" />
      <LanguageToggle />
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tb-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.brand {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
button.brand:hover {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
}
button.brand:active {
  transform: scale(0.97);
}
button.brand:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tb-titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tb-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  font-size: 13px;
  color: var(--muted);
}

.tb-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}

.tb-key {
  flex: none;
  margin-right: 2px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  padding: 3px 8px;
  border-radius: 6px;
}

.tb-ro {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  padding: 3px 9px 3px 7px;
  border-radius: 999px;
  background: var(--warning-bg);
  color: var(--warning-text);
  font-size: 12px;
  font-weight: 600;
}
.tb-ro svg {
  width: 12px;
  height: 12px;
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel);
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
}
.live.is-live .live-dot {
  background: var(--success-border);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--success-border) 60%, transparent);
  animation: live-pulse 2.4s ease-out infinite;
}
.live.is-connecting .live-dot {
  background: var(--warning-text);
}
.live.is-offline {
  color: var(--danger);
}
.live.is-offline .live-dot {
  background: var(--danger);
}
.viewers {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding-left: 6px;
  border-left: 1px solid var(--border);
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.viewers svg {
  width: 13px;
  height: 13px;
  color: var(--muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--success-border) 55%, transparent); }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .live.is-live .live-dot { animation: none; }
}

.tb-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding-top: 5px;
}

.tb-view-toggle {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--panel);
}
.tb-view-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}
.tb-view-button:hover {
  color: var(--text);
}
.tb-view-button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  color: var(--accent);
}
.tb-view-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.tb-view-button svg {
  width: 14px;
  height: 14px;
  flex: none;
}

.tb-unlock {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.tb-unlock:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
}
.tb-unlock svg {
  width: 15px;
  height: 15px;
  color: var(--accent);
}

.tb-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--border);
}

@media (max-width: 640px) {
  .topbar {
    flex-wrap: wrap;
  }
  .tb-left {
    flex: 1 1 220px;
  }
  .live-label {
    display: none;
  }
  .tb-left {
    gap: 10px;
  }
  .tb-right {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
    padding-top: 1px;
  }
  .tb-divider-tools {
    display: none;
  }
  .tb-unlock span,
  .tb-view-button span {
    display: none;
  }
  .tb-view-button {
    width: 30px;
    padding: 0;
  }
  .tb-unlock {
    width: 34px;
    padding: 0;
    justify-content: center;
  }
}
</style>
