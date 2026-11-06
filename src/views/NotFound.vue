<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ThemeToggle from "../components/ThemeToggle.vue";
import LanguageToggle from "../components/LanguageToggle.vue";

const { t } = useI18n();
</script>

<template>
  <div class="not-found">
    <div class="corner-actions">
      <LanguageToggle />
      <ThemeToggle />
    </div>
    <div class="card">
      <h1>{{ t("notFound.title") }}</h1>
      <p class="subtitle">{{ t("notFound.subtitle") }}</p>
      <router-link class="btn" :to="{ name: 'home' }">{{ t("notFound.backHome") }}</router-link>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
}

.corner-actions {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 32px;
  max-width: 420px;
  text-align: center;
}

h1 {
  margin: 0 0 8px;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 24px;
}

.btn {
  display: inline-block;
  text-decoration: none;
}
</style>
