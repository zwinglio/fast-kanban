<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { LOCALES, nextLocale, setLocale, type Locale } from "../lib/locale";

const { t, locale } = useI18n();

const current = computed<Locale>(() => (locale.value === "pt-BR" ? "pt-BR" : "en"));
const next = computed<Locale>(() => nextLocale(current.value));
const nextLabel = computed(() => LOCALES.find((option) => option.value === next.value)?.label ?? "");
const short = computed(() => LOCALES.find((option) => option.value === current.value)?.short ?? "EN");

function toggle() {
  setLocale(next.value);
}
</script>

<!-- Small icon button that cycles through the supported languages. -->
<template>
  <button
    class="icon-btn language-toggle"
    type="button"
    :aria-label="`${t('common.language')}: ${nextLabel}`"
    :title="`${t('common.language')}: ${nextLabel}`"
    @click="toggle"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
    </svg>
    <span class="language-code" aria-hidden="true">{{ short }}</span>
  </button>
</template>

<style scoped>
.language-toggle {
  width: auto;
  padding: 0 8px 0 6px;
  gap: 3px;
  grid-auto-flow: column;
}

.language-code {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
}
</style>
