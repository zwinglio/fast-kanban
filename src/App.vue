<script setup lang="ts">
</script>

<template>
  <!-- Key the board view on the board id, not the full path: the open card now lives in the
       path (/b/:id/:cardSlug?), so keying on the path would remount the board every time a
       card opens/closes or its slug is corrected — losing in-page filters and unsaved drafts. -->
  <router-view :key="$route.name === 'board' ? 'board-' + String($route.params.id) : $route.path" />
</template>
