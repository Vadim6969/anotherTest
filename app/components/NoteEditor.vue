<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import type ConfirmDialog from './ConfirmDialog.vue'
import type { ReadonlyNote } from '~/types/note'
import { DELETE_NOTE_CONFIRMATION, DISCARD_CHANGES_CONFIRMATION } from '~/constants/confirmations'
import { todoInputId } from '~/utils/element-ids'
import { storageErrorMessages } from '~/utils/storage-errors'

const props = defineProps<{ note?: ReadonlyNote; noteId: string | null }>()
const store = useNotesStore()
const editor = useNoteEditor(props.note, props.noteId ?? undefined)
const { draft, isNew, canUndo, canRedo, isDirty, validationErrors } = editor
const recovery = useNoteDraft(props.noteId, editor)
const { pendingDraft, error: draftError, finishing } = recovery
const editingDisabled = computed(() => !!pendingDraft.value || finishing.value)
const currentSavedNote = computed(() => store.notes.find((note) => note.id === draft.id))
const deleted = computed(() => !isNew.value && !store.storageError && !currentSavedNote.value)
const changedElsewhere = computed(
  () => currentSavedNote.value && currentSavedNote.value.updatedAt !== draft.updatedAt,
)
const confirmation = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const addButton = ref<HTMLButtonElement | null>(null)
const submitted = ref(false)
const actionError = ref('')

useHead(() => ({ title: isNew.value ? 'Новая заметка — Заметки' : `${draft.title} — Заметки` }))
useEditorShortcuts(
  () => !editingDisabled.value && editor.undo(),
  () => !editingDisabled.value && editor.redo(),
)

async function offerRecovery(): Promise<void> {
  if (!pendingDraft.value) return
  const answer = await confirmation.value?.ask({
    title: 'Восстановить черновик?',
    description:
      'В этой вкладке остались несохранённые изменения. Можно продолжить работу с ними или удалить черновик.',
    confirmLabel: 'Восстановить',
    cancelLabel: 'Удалить черновик',
    focusConfirm: true,
  })
  if (answer === true) recovery.restore()
  else if (answer === false && recovery.clear() && !props.note && props.noteId !== null) {
    await navigateTo('/')
  }
}

onMounted(offerRecovery)

async function confirmDiscard(): Promise<boolean> {
  return (await confirmation.value?.ask(DISCARD_CHANGES_CONFIRMATION)) ?? false
}

async function leave(): Promise<boolean> {
  if (!isDirty.value) return true
  if (!(await confirmDiscard()) || !recovery.clear()) return false
  editor.cancel()
  return true
}

onBeforeRouteLeave(leave)
onBeforeRouteUpdate((to, from) => to.path === from.path || leave())

async function cancel(): Promise<void> {
  if (!(await confirmDiscard()) || !recovery.clear()) return
  editor.cancel()
  await navigateTo('/')
}

function changeTitle(event: Event): void {
  if (event.currentTarget instanceof HTMLInputElement) {
    editor.setTitle(event.currentTarget.value)
  }
}

async function addTodo(): Promise<void> {
  const id = editor.addTodo()
  await nextTick()
  document.getElementById(todoInputId(id))?.focus()
}

async function removeTodo(id: string): Promise<void> {
  const index = draft.todos.findIndex((todo) => todo.id === id)
  if (!editor.removeTodo(id)) return
  await nextTick()
  const next = draft.todos[index] ?? draft.todos[index - 1]
  if (next) document.getElementById(todoInputId(next.id))?.focus()
  else addButton.value?.focus()
}

async function save(asNew = false): Promise<void> {
  if (editingDisabled.value || (deleted.value && !asNew)) return
  submitted.value = true
  actionError.value = ''
  const result = asNew ? editor.saveAsNew() : editor.save()
  if (result.status === 'ok') {
    await finishSession()
  } else if (result.status === 'invalid') {
    await nextTick()
    if (validationErrors.value.title) titleInput.value?.focus()
    else {
      const firstInvalidTodo = validationErrors.value.todos[0]
      if (firstInvalidTodo) document.getElementById(todoInputId(firstInvalidTodo))?.focus()
    }
  } else if (result.status === 'storage-error') {
    actionError.value = storageErrorMessages[result.error]
  } else if (result.status === 'missing') {
    actionError.value = 'Эта заметка уже удалена. Ваши изменения остались в редакторе.'
  } else {
    actionError.value = 'Заметка с таким идентификатором уже существует. Изменения не сохранены.'
  }
}

async function finishSession(): Promise<void> {
  if (!recovery.finish()) return
  editor.cancel()
  await navigateTo('/')
}

async function deleteNote(): Promise<void> {
  const confirmed = await confirmation.value?.ask(DELETE_NOTE_CONFIRMATION)
  if (!confirmed) return
  const result = store.remove(draft.id)
  if (result.status === 'ok' || result.status === 'missing') {
    await finishSession()
  } else if (result.status === 'storage-error') {
    actionError.value = storageErrorMessages[result.error]
  }
}
</script>

<template>
  <main id="main-content" class="page editor-page" tabindex="-1">
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
          :disabled="!canUndo || editingDisabled"
          aria-label="Отменить действие"
          title="Отменить действие (Ctrl/Cmd+Z вне текстового поля)"
          @click="editor.undo"
        >
          <AppIcon name="undo" />
        </button>
        <button
          class="icon-button"
          type="button"
          :disabled="!canRedo || editingDisabled"
          aria-label="Повторить действие"
          title="Повторить действие (Ctrl/Cmd+Shift+Z вне текстового поля)"
          @click="editor.redo"
        >
          <AppIcon name="redo" />
        </button>
      </div>
    </header>

    <div v-if="pendingDraft" class="notice" role="status">
      <p>
        Найден несохранённый черновик. Выберите, восстановить его или удалить, чтобы продолжить
        редактирование.
      </p>
      <button class="button button--secondary" type="button" @click="offerRecovery">
        Открыть черновик
      </button>
    </div>
    <div v-if="finishing" class="notice notice--error" role="alert">
      <p>Действие выполнено, но удалить резервный черновик не удалось. Повторите очистку.</p>
      <button class="button button--secondary" type="button" @click="finishSession">
        Повторить очистку
      </button>
    </div>
    <div v-else-if="draftError" class="notice notice--error" role="alert">
      {{
        draftError === 'unavailable'
          ? 'Не удалось сохранить или очистить черновик в этой вкладке. Не закрывайте страницу до успешного сохранения заметки.'
          : 'Сохранённый черновик повреждён или создан в другой версии приложения. Автосохранение черновика приостановлено; исходные данные не изменены.'
      }}
    </div>
    <div v-if="store.storageError" class="notice notice--error" role="alert">
      {{ storageErrorMessages[store.storageError] }}
    </div>
    <div v-else-if="deleted" class="notice" role="status">
      Эта заметка удалена в другой вкладке. Текущий текст остался в редакторе: его можно сохранить
      как новую заметку.
    </div>
    <div v-else-if="changedElsewhere" class="notice" role="status">
      Заметка изменена в другой вкладке. Ваш текст остался прежним. Сохранение заменит текущую
      версию вашими правками.
    </div>

    <form class="editor-form" novalidate @submit.prevent="save()">
      <fieldset class="editor-fields" :disabled="editingDisabled">
        <legend class="sr-only">Данные заметки</legend>
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
          <ul v-if="draft.todos.length" class="todo-list" role="list">
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
          <button
            v-if="!isNew && !deleted"
            class="button button--danger-text"
            type="button"
            @click="deleteNote"
          >
            <AppIcon name="trash" /> Удалить заметку
          </button>
          <div class="editor-actions__save">
            <button class="button button--secondary" type="button" @click="cancel">Отмена</button>
            <button v-if="deleted" class="button button--primary" type="button" @click="save(true)">
              Сохранить как новую
            </button>
            <button v-else class="button button--primary" type="submit">Сохранить</button>
          </div>
        </footer>
      </fieldset>
    </form>
    <ConfirmDialog ref="confirmation" />
  </main>
</template>

<style scoped lang="scss">
@use '~/assets/scss/variables' as *;

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
  padding: 2rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-surface);
}
.editor-fields {
  display: grid;
  gap: 2rem;
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
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
@media (max-width: $mobile-breakpoint) {
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
