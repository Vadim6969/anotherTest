<script setup lang="ts">
import { computed } from 'vue'
import type { ReadonlyNote } from '~/types/note'
import { noteLinkId } from '~/utils/element-ids'

const TODO_PREVIEW_LIMIT = 3

const props = defineProps<{ note: ReadonlyNote }>()
defineEmits<{ delete: [id: string] }>()
const completed = computed(() => props.note.todos.filter((todo) => todo.completed).length)
const date = computed(() =>
  new Date(props.note.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
)
</script>

<template>
  <article class="note-card">
    <div class="note-card__heading">
      <h2>
        <NuxtLink
          :id="noteLinkId(note.id)"
          :to="`/notes/${encodeURIComponent(note.id)}`"
          :title="note.title"
          >{{ note.title }}</NuxtLink
        >
      </h2>
      <button
        class="icon-button icon-button--danger"
        type="button"
        :aria-label="`Удалить заметку «${note.title}»`"
        @click="$emit('delete', note.id)"
      >
        <AppIcon name="trash" />
      </button>
    </div>
    <ul v-if="note.todos.length" class="note-card__preview" role="list">
      <li
        v-for="todo in note.todos.slice(0, TODO_PREVIEW_LIMIT)"
        :key="todo.id"
        :class="{ 'is-complete': todo.completed }"
      >
        <span class="preview-check" aria-hidden="true"
          ><AppIcon v-if="todo.completed" name="check"
        /></span>
        <span class="sr-only">{{ todo.completed ? 'Выполнено:' : 'Не выполнено:' }}</span>
        <span class="note-card__text" :title="todo.text">{{ todo.text }}</span>
      </li>
    </ul>
    <p v-else class="note-card__empty">Пока без задач</p>
    <p v-if="note.todos.length > TODO_PREVIEW_LIMIT" class="note-card__more">
      Ещё {{ note.todos.length - TODO_PREVIEW_LIMIT }}
    </p>
    <footer class="note-card__footer">
      <span>{{
        note.todos.length ? `${completed} из ${note.todos.length} выполнено` : 'Без списка задач'
      }}</span>
      <time :datetime="note.updatedAt" :title="`Обновлено ${date}`">{{ date }}</time>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.note-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-surface);

  &__heading {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1.25rem;

    h2 {
      flex: 1;
      min-width: 0;
      margin: 0;
      font-size: 1.125rem;
      line-height: 1.5;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
    a:hover {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }
    .icon-button {
      margin: -0.5rem -0.5rem 0 0;
    }
  }

  &__preview {
    display: grid;
    gap: 0.625rem;
    padding: 0;
    margin: 0;
    list-style: none;

    li {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
    }
    .is-complete .note-card__text {
      color: var(--color-text-muted);
      text-decoration: line-through;
    }
  }

  &__heading a,
  &__text {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  &__empty,
  &__more {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }
  &__more {
    margin-top: 0.75rem;
  }
  &__footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: auto;
    padding-top: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }
}

.preview-check {
  display: grid;
  place-items: center;
  flex: 0 0 1rem;
  height: 1rem;
  margin-top: 0.25rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.25rem;
  color: var(--color-accent);

  .app-icon {
    width: 0.875rem;
    height: 0.875rem;
  }
}
</style>
