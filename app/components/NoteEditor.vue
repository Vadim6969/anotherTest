<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import type ConfirmDialog from './ConfirmDialog.vue'
import type { Note } from '~/types/note'
import { storageErrorMessages } from '~/utils/storage-errors'

const props = defineProps<{ note?: Note }>()
const store = useNotesStore()
const editor = useNoteEditor(props.note)
const { draft, isNew, canUndo, canRedo, isDirty, validationErrors } = editor
const confirmation = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const addButton = ref<HTMLButtonElement | null>(null)
const submitted = ref(false)
const actionError = ref('')

useHead(() => ({ title: isNew.value ? 'Новая заметка — Заметки' : `${draft.title} — Заметки` }))
useEditorShortcuts(editor.undo, editor.redo)

async function confirmDiscard(): Promise<boolean> {
  return (
    (await confirmation.value?.ask({
      title: 'Отменить изменения?',
      description: 'Несохранённые изменения будут потеряны.',
      confirmLabel: 'Отменить изменения',
      cancelLabel: 'Продолжить редактирование',
      danger: true,
    })) ?? false
  )
}

onBeforeRouteLeave(() => !isDirty.value || confirmDiscard())
onBeforeRouteUpdate((to, from) => to.path === from.path || !isDirty.value || confirmDiscard())

async function cancel(): Promise<void> {
  if (!(await confirmDiscard())) return
  editor.cancel()
  await navigateTo('/')
}

function changeTitle(event: Event): void {
  editor.setTitle((event.target as HTMLInputElement).value)
}

async function addTodo(): Promise<void> {
  const id = editor.addTodo()
  await nextTick()
  document.getElementById(`todo-${id}`)?.focus()
}

async function removeTodo(id: string): Promise<void> {
  const index = draft.todos.findIndex((todo) => todo.id === id)
  if (!editor.removeTodo(id)) return
  await nextTick()
  const next = draft.todos[index] ?? draft.todos[index - 1]
  if (next) document.getElementById(`todo-${next.id}`)?.focus()
  else addButton.value?.focus()
}

async function save(): Promise<void> {
  submitted.value = true
  actionError.value = ''
  const result = editor.save()
  if (result.status === 'ok') {
    await navigateTo('/')
  } else if (result.status === 'invalid') {
    await nextTick()
    if (validationErrors.value.title) titleInput.value?.focus()
    else document.getElementById(`todo-${validationErrors.value.todos[0]}`)?.focus()
  } else if (result.status === 'storage-error') {
    actionError.value = storageErrorMessages[result.error]
  } else if (result.status === 'missing') {
    actionError.value = 'Эта заметка уже удалена. Ваши изменения остались в редакторе.'
  } else {
    actionError.value = 'Заметка с таким идентификатором уже существует. Изменения не сохранены.'
  }
}

async function deleteNote(): Promise<void> {
  const confirmed = await confirmation.value?.ask({
    title: 'Удалить заметку?',
    description: 'Заметка и все её задачи будут удалены. Это действие нельзя отменить.',
    confirmLabel: 'Удалить заметку',
    danger: true,
  })
  if (!confirmed) return
  const result = store.remove(draft.id)
  if (result.status === 'ok' || result.status === 'missing') {
    editor.cancel()
    await navigateTo('/')
  } else if (result.status === 'storage-error') {
    actionError.value = storageErrorMessages[result.error]
  }
}
</script>

<template>
  <main id="main-content" class="page editor-page">
    <NuxtLink class="back-link" to="/"><AppIcon name="back" /> Все заметки</NuxtLink>
    <header class="page-heading editor-heading">
      <div>
        <h1>{{ isNew ? 'Новая заметка' : 'Редактирование' }}</h1>
        <p>{{ isDirty ? 'Есть несохранённые изменения' : 'Изменения сохраняются по кнопке' }}</p>
      </div>
      <div class="history-actions" role="group" aria-label="История изменений">
        <button
          class="icon-button"
          type="button"
          :disabled="!canUndo"
          aria-label="Отменить действие"
          title="Отменить действие (Ctrl/Cmd+Z вне текстового поля)"
          @click="editor.undo"
        >
          <AppIcon name="undo" />
        </button>
        <button
          class="icon-button"
          type="button"
          :disabled="!canRedo"
          aria-label="Повторить действие"
          title="Повторить действие (Ctrl/Cmd+Shift+Z вне текстового поля)"
          @click="editor.redo"
        >
          <AppIcon name="redo" />
        </button>
      </div>
    </header>

    <form class="editor-form" novalidate @submit.prevent="save">
      <div v-if="actionError" class="notice notice--error" role="alert">{{ actionError }}</div>
      <div class="editor-form__title">
        <label class="field-label" for="note-title">Название заметки</label>
        <input
          id="note-title"
          ref="titleInput"
          class="text-input"
          type="text"
          :value="draft.title"
          :aria-invalid="(submitted && validationErrors.title) || undefined"
          :aria-describedby="submitted && validationErrors.title ? 'title-error' : undefined"
          placeholder="Например, планы на выходные"
          autocomplete="off"
          @input="changeTitle"
          @blur="editor.flushTextEdit"
        />
        <p v-if="submitted && validationErrors.title" id="title-error" class="field-error">
          Введите название заметки
        </p>
      </div>

      <section aria-labelledby="tasks-heading">
        <div class="tasks-heading">
          <h2 id="tasks-heading">
            Задачи <span>{{ draft.todos.length }}</span>
          </h2>
        </div>
        <ul v-if="draft.todos.length" class="todo-list">
          <TodoItem
            v-for="(todo, index) in draft.todos"
            :key="todo.id"
            :todo="todo"
            :number="index + 1"
            :error="submitted && validationErrors.todos.includes(todo.id)"
            @update:text="editor.setTodoText(todo.id, $event)"
            @update:completed="editor.setTodoCompleted(todo.id, $event)"
            @blur="editor.flushTextEdit"
            @remove="removeTodo(todo.id)"
          />
        </ul>
        <p v-else class="empty-tasks">
          Добавьте первую задачу или сохраните заметку только с названием.
        </p>
        <button
          ref="addButton"
          class="button button--secondary add-task"
          type="button"
          @click="addTodo"
        >
          <AppIcon name="plus" /> Добавить задачу
        </button>
      </section>

      <footer class="editor-actions">
        <button v-if="!isNew" class="button button--danger-text" type="button" @click="deleteNote">
          <AppIcon name="trash" /> Удалить заметку
        </button>
        <div class="editor-actions__save">
          <button class="button button--secondary" type="button" @click="cancel">Отмена</button>
          <button class="button button--primary" type="submit">Сохранить</button>
        </div>
      </footer>
    </form>
    <ConfirmDialog ref="confirmation" />
  </main>
</template>

<style scoped lang="scss">
.editor-page {
  max-width: 52rem;
}
.editor-heading {
  align-items: center;
  margin-top: 1.5rem;
}
.history-actions {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: 0.625rem;
  background: var(--color-surface);
}
.editor-form {
  display: grid;
  gap: 2rem;
  padding: 2rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-surface);
}
.tasks-heading h2 {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin: 0 0 1rem;
  font-size: 1rem;
}
.tasks-heading span {
  font-weight: 400;
  color: var(--color-text-muted);
}
.todo-list {
  display: grid;
  gap: 0.75rem;
  padding: 0;
  margin: 0 0 1rem;
  list-style: none;
}
.empty-tasks {
  margin: 0 0 1rem;
  color: var(--color-text-muted);
}
.editor-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}
.editor-actions__save {
  display: flex;
  gap: 0.75rem;
  margin-left: auto;
}
@media (max-width: 560px) {
  .editor-heading {
    align-items: flex-start;
  }
  .editor-form {
    padding: 1.25rem 1rem;
  }
  .editor-actions__save {
    width: 100%;
  }
  .editor-actions__save .button {
    flex: 1;
  }
}
</style>
