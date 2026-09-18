<script setup lang="ts">
import { onMounted, ref } from "vue";
import { updateBoard, ApiError, type Board } from "../api";
import ModalShell from "./ModalShell.vue";

const props = defineProps<{
  boardId: string;
  title: string;
  prefix: string;
}>();

const emit = defineEmits<{
  close: [];
  saved: [board: Board];
}>();

const title = ref(props.title);
const saving = ref(false);
const error = ref("");
const titleEl = ref<HTMLInputElement | null>(null);

onMounted(() => titleEl.value?.select());

async function save() {
  const trimmed = title.value.trim();
  if (!trimmed || trimmed.length > 255) {
    error.value = "Title is required (max 255 chars)";
    return;
  }
  if (trimmed === props.title) {
    emit("close");
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    const updated = await updateBoard(props.boardId, { title: trimmed });
    emit("saved", updated);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to save board";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ModalShell title="General" subtitle="Board name and card identifier." :width="460" @close="emit('close')">
    <section class="sheet-section">
      <div class="sheet-section-head">
        <label class="sheet-label" for="board-title">Title</label>
      </div>
      <input
        id="board-title"
        ref="titleEl"
        v-model="title"
        type="text"
        maxlength="255"
        class="sheet-input"
        placeholder="Board title"
        @keydown.enter.prevent="save"
      />
    </section>

    <section class="sheet-section">
      <div class="sheet-section-head">
        <span class="sheet-label">Prefix</span>
      </div>
      <span class="sheet-key">{{ prefix }}</span>
      <p class="sheet-note">Used in card IDs like <b>{{ prefix }}-12</b>. It can't be changed.</p>
    </section>

    <p v-if="error" class="sheet-error">{{ error }}</p>

    <template #footer>
      <button class="btn secondary" type="button" @click="emit('close')">Cancel</button>
      <button class="btn" type="button" :disabled="saving" @click="save">
        {{ saving ? "Saving..." : "Save" }}
      </button>
    </template>
  </ModalShell>
</template>
