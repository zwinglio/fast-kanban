<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { getTheme, setTheme } from "../lib/theme";

const { t } = useI18n();
const theme = ref(getTheme());

function toggle() {
  const next = theme.value === "dark" ? "light" : "dark";
  theme.value = next;
  setTheme(next);
}
</script>

<template>
  <button
    class="icon-btn"
    type="button"
    :aria-label="theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')"
    :title="theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')"
    @click="toggle"
  >
    <svg v-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  </button>
</template>

