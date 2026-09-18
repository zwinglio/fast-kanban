<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { addComment, deleteComment, editComment, getComments, ApiError, type CardComment } from "../api";
import { renderMarkdown } from "../lib/markdown";
import { MAX_AUTHOR_LENGTH, getCommentAuthor, setCommentAuthor } from "../lib/commentAuthor";

const PAGE = 5;
const MAX_LENGTH = 5000;

const props = defineProps<{
  boardId: string;
  cardId: number;
  readOnly: boolean;
}>();

const emit = defineEmits<{
  countChanged: [count: number];
  changed: []; // a comment was posted, edited or deleted (activity has a new entry)
}>();

const comments = ref<CardComment[]>([]);
const total = ref(0);
const hasEarlier = ref(false);
const loading = ref(true);
const loadingEarlier = ref(false);
const loadError = ref("");

const draft = ref("");
const posting = ref(false);
const postError = ref("");
const composerEl = ref<HTMLTextAreaElement | null>(null);

const author = ref(getCommentAuthor());
const editingName = ref(false);
const nameDraft = ref("");
const nameEl = ref<HTMLInputElement | null>(null);

const editingId = ref<number | null>(null);
const editDraft = ref("");
const savingEdit = ref(false);
const confirmDeleteId = ref<number | null>(null);
const actionError = ref("");

const earlierCount = computed(() => Math.max(0, total.value - comments.value.length));

function setTotal(n: number) {
  total.value = n;
  emit("countChanged", n);
}

async function loadLatest() {
  loading.value = true;
  loadError.value = "";
  try {
    const res = await getComments(props.cardId, { limit: PAGE });
    comments.value = res.comments;
    hasEarlier.value = res.hasMore;
    setTotal(res.total);
  } catch {
    loadError.value = "Couldn't load comments.";
  } finally {
    loading.value = false;
  }
}

async function loadEarlier() {
  if (loadingEarlier.value || !comments.value.length) return;
  loadingEarlier.value = true;
  try {
    const res = await getComments(props.cardId, { limit: 10, before: comments.value[0].id });
    comments.value = [...res.comments, ...comments.value];
    hasEarlier.value = res.hasMore;
    setTotal(res.total);
  } catch {
    actionError.value = "Couldn't load earlier comments.";
  } finally {
    loadingEarlier.value = false;
  }
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
}

async function post() {
  const body = draft.value.trim();
  if (!body || posting.value) return;
  posting.value = true;
  postError.value = "";
  try {
    const created = await addComment(props.boardId, props.cardId, body, author.value.trim() || null);
    comments.value = [...comments.value, created];
    setTotal(total.value + 1);
    emit("changed");
    draft.value = "";
    nextTick(() => autoGrow(composerEl.value));
  } catch (e) {
    postError.value = e instanceof ApiError ? e.message : "Couldn't post the comment.";
  } finally {
    posting.value = false;
  }
}

// Ctrl/Cmd+Enter posts; preventDefault stops the card modal from treating it as "save card".
function onComposerKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    post();
  } else if (e.key === "Escape" && draft.value) {
    e.preventDefault();
    draft.value = "";
    nextTick(() => autoGrow(composerEl.value));
  }
}

function startName() {
  nameDraft.value = author.value;
  editingName.value = true;
  nextTick(() => nameEl.value?.select());
}

function saveName() {
  setCommentAuthor(nameDraft.value);
  author.value = getCommentAuthor();
  editingName.value = false;
}

function onNameKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    saveName();
  } else if (e.key === "Escape") {
    e.preventDefault();
    editingName.value = false;
  }
}

function startEdit(c: CardComment) {
  editingId.value = c.id;
  editDraft.value = c.body;
  confirmDeleteId.value = null;
  actionError.value = "";
}

async function saveEdit(c: CardComment) {
  const body = editDraft.value.trim();
  if (!body || savingEdit.value) return;
  if (body === c.body) {
    editingId.value = null;
    return;
  }
  savingEdit.value = true;
  actionError.value = "";
  try {
    const updated = await editComment(props.boardId, c.id, body);
    comments.value = comments.value.map((x) => (x.id === c.id ? updated : x));
    editingId.value = null;
    emit("changed");
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : "Couldn't save the comment.";
  } finally {
    savingEdit.value = false;
  }
}

function onEditKeydown(e: KeyboardEvent, c: CardComment) {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    saveEdit(c);
  } else if (e.key === "Escape") {
    e.preventDefault();
    editingId.value = null;
  }
}

async function remove(c: CardComment) {
  actionError.value = "";
  try {
    await deleteComment(props.boardId, c.id);
    comments.value = comments.value.filter((x) => x.id !== c.id);
    confirmDeleteId.value = null;
    setTotal(Math.max(0, total.value - 1));
    emit("changed");
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : "Couldn't delete the comment.";
  }
}

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
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

function isEdited(c: CardComment) {
  return new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000;
}

onMounted(loadLatest);
</script>

<template>
  <section class="comments" aria-label="Comments">
    <div class="block-head">
      <span class="label">Comments</span>
      <span v-if="total" class="count">{{ total }}</span>
    </div>

    <p v-if="loading" class="muted-line">Loading comments…</p>
    <p v-else-if="loadError" class="muted-line">
      {{ loadError }} <button type="button" class="link" @click="loadLatest">Try again</button>
    </p>

    <template v-else>
      <button v-if="hasEarlier" type="button" class="earlier" :disabled="loadingEarlier" @click="loadEarlier">
        {{ loadingEarlier ? "Loading…" : `Show earlier comments (${earlierCount})` }}
      </button>

      <ol v-if="comments.length" class="thread">
        <li v-for="c in comments" :key="c.id" class="comment">
          <span class="avatar" :class="{ anon: !c.author }" aria-hidden="true">{{ initials(c.author) }}</span>
          <div class="comment-main">
            <div class="comment-meta">
              <b>{{ c.author || "Anonymous" }}</b>
              <time :datetime="c.createdAt" :title="absolute(c.createdAt)">{{ relative(c.createdAt) }}</time>
              <span v-if="isEdited(c)" class="edited" :title="`Edited ${absolute(c.updatedAt)}`">edited</span>
              <span v-if="!readOnly && editingId !== c.id && confirmDeleteId !== c.id" class="comment-actions">
                <button type="button" class="link muted" @click="startEdit(c)">Edit</button>
                <button type="button" class="link danger" @click="confirmDeleteId = c.id">Delete</button>
              </span>
            </div>

            <div v-if="editingId === c.id" class="edit-box">
              <textarea
                v-model="editDraft"
                class="comment-input"
                rows="3"
                :maxlength="MAX_LENGTH"
                aria-label="Edit comment"
                @keydown="onEditKeydown($event, c)"
              />
              <div class="edit-actions">
                <button type="button" class="link muted" @click="editingId = null">Cancel</button>
                <button type="button" class="btn small" :disabled="savingEdit || !editDraft.trim()" @click="saveEdit(c)">
                  {{ savingEdit ? "Saving…" : "Save" }}
                </button>
              </div>
            </div>
            <div v-else class="comment-body markdown-body" v-html="renderMarkdown(c.body)" />

            <div v-if="confirmDeleteId === c.id" class="confirm-line">
              <span>Delete this comment?</span>
              <button type="button" class="go" @click="remove(c)">Delete</button>
              <button type="button" class="link muted" @click="confirmDeleteId = null">Cancel</button>
            </div>
          </div>
        </li>
      </ol>
      <p v-else-if="readOnly" class="muted-line">No comments yet.</p>

      <p v-if="actionError" class="error">{{ actionError }}</p>

      <div v-if="!readOnly" class="composer">
        <textarea
          ref="composerEl"
          v-model="draft"
          class="comment-input"
          rows="2"
          :maxlength="MAX_LENGTH"
          :placeholder="comments.length ? 'Reply…' : 'Write the first comment…'"
          aria-label="New comment"
          @input="autoGrow(composerEl)"
          @keydown="onComposerKeydown"
        />
        <div class="composer-foot">
          <span class="as">
            <template v-if="editingName">
              <input
                ref="nameEl"
                v-model="nameDraft"
                class="name-input"
                type="text"
                :maxlength="MAX_AUTHOR_LENGTH"
                placeholder="Your name"
                aria-label="Your display name"
                @keydown="onNameKeydown"
                @blur="saveName"
              />
            </template>
            <template v-else>
              Commenting as
              <button type="button" class="name-btn" title="Change the name shown on your comments" @click="startName">
                {{ author || "Anonymous" }}
              </button>
            </template>
          </span>
          <span class="composer-right">
            <span class="hint">Markdown · <kbd>Ctrl</kbd> <kbd>↵</kbd></span>
            <button type="button" class="btn small" :disabled="posting || !draft.trim()" @click="post">
              {{ posting ? "Posting…" : "Comment" }}
            </button>
          </span>
        </div>
        <p v-if="postError" class="error">{{ postError }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.comments {
  margin-top: 28px;
}
.block-head {
  display: flex;
  align-items: center;
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
.muted-line {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--muted);
}

.earlier {
  display: block;
  width: 100%;
  margin-bottom: 10px;
  padding: 6px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: none;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
}
.earlier:hover:not(:disabled) {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.thread {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.comment {
  display: flex;
  gap: 10px;
}
.avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
}
.avatar.anon {
  background: var(--soft);
  color: var(--muted);
}
.comment-main {
  flex: 1;
  min-width: 0;
}
.comment-meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 12.5px;
  color: var(--muted);
}
.comment-meta b {
  color: var(--text);
  font-weight: 600;
  font-size: 13px;
}
.edited {
  font-style: italic;
}
.comment-actions {
  margin-left: auto;
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.comment:hover .comment-actions,
.comment-actions:focus-within {
  opacity: 1;
}
@media (hover: none) {
  .comment-actions {
    opacity: 1;
  }
}
.comment-body {
  margin-top: 3px;
  font-size: 14px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.markdown-body :deep(> :first-child) {
  margin-top: 0;
}
.markdown-body :deep(> :last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 8px;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
}
.markdown-body :deep(code) {
  font-family: var(--mono);
  font-size: 0.86em;
  padding: 1px 5px;
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 5px;
}
.markdown-body :deep(pre) {
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  overflow-x: auto;
}
.markdown-body :deep(pre code) {
  background: none;
  border: 0;
  padding: 0;
}
.markdown-body :deep(blockquote) {
  margin: 0 0 8px;
  padding: 0 0 0 12px;
  border-left: 2px solid var(--border);
  color: var(--muted);
}
.markdown-body :deep(a) {
  color: var(--accent);
}

.comment-input {
  width: 100%;
  min-height: 40px;
  padding: 9px 11px;
  resize: none;
  background: var(--sunken);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
}
.comment-input:focus {
  outline: none;
  border-color: var(--accent);
}
.comment-input::placeholder {
  color: var(--muted);
}
.edit-box {
  margin-top: 6px;
}
.edit-box .comment-input {
  resize: vertical;
}
.edit-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.confirm-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 13px;
  color: var(--danger);
}
.confirm-line .go {
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: var(--danger);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
}
.confirm-line .go:hover {
  background: var(--danger-hover);
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.as {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  color: var(--muted);
}
.name-btn {
  padding: 1px 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text);
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
.name-btn:hover {
  background: var(--soft);
}
.name-input {
  width: 180px;
  min-height: 28px;
  padding: 3px 8px;
  background: var(--sunken);
  border: 1px solid var(--accent);
  border-radius: 7px;
  color: var(--text);
  font-size: 12.5px;
}
.name-input:focus {
  outline: none;
}
.composer-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.hint {
  font-size: 11.5px;
  color: var(--muted);
}
.hint kbd {
  font-family: inherit;
  font-size: 10.5px;
  padding: 0 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.btn.small {
  padding: 5px 12px;
  font-size: 13px;
  border-radius: 7px;
}
.link {
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
}
.link:hover {
  background: var(--soft);
}
.link.muted {
  color: var(--muted);
  font-weight: 500;
}
.link.muted:hover {
  color: var(--text);
}
.link.danger {
  color: var(--muted);
  font-weight: 500;
}
.link.danger:hover {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}
.error {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--danger);
}
@media (max-width: 520px) {
  .hint {
    display: none;
  }
}
</style>
