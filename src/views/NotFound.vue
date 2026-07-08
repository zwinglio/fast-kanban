<script setup lang="ts">
import ThemeToggle from "../components/ThemeToggle.vue";
</script>

<template>
  <div class="not-found">
    <ThemeToggle class="theme-toggle-corner" />
    <div class="card">
      <h1>404 — Page not found</h1>
      <p class="subtitle">The page you're looking for doesn't exist or has been moved.</p>
      <router-link class="btn" :to="{ name: 'home' }">Back to home</router-link>
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

.theme-toggle-corner {
  position: absolute;
  top: 16px;
  right: 16px;
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
