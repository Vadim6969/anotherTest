import { computed, reactive, readonly, ref, shallowRef, triggerRef } from 'vue'
import { useNotesStore } from '~/stores/notes'
import type { Note, ReadonlyNote, SaveResult } from '~/types/note'
import { copyNote } from '~/utils/note'
import { createNoteHistory } from '~/utils/note-history'
import type { NoteChange, TextChange } from '~/utils/note-history'

type EditorSaveResult = SaveResult | { status: 'invalid' }

export function useNoteEditor(initialNote?: ReadonlyNote, existingId?: string) {
  const store = useNotesStore()
  const baseline = shallowRef<Note>(
    initialNote
      ? copyNote(initialNote)
      : {
          id: existingId ?? crypto.randomUUID(),
          title: '',
          todos: [],
          updatedAt: new Date().toISOString(),
        },
  )
  const draft = reactive(copyNote(baseline.value))
  const isNew = ref(!initialNote && !existingId)
  const history = shallowRef(createNoteHistory(draft))
  const pendingText = shallowRef<TextChange | null>(null)

  const canUndo = computed(
    () =>
      (pendingText.value !== null && pendingText.value.before !== pendingText.value.after) ||
      history.value.canUndo,
  )
  const canRedo = computed(() => history.value.canRedo)
  const isDirty = computed(() => {
    const original = baseline.value
    return (
      draft.title !== original.title ||
      draft.todos.length !== original.todos.length ||
      draft.todos.some((todo, index) => {
        const saved = original.todos[index]
        return (
          !saved ||
          todo.id !== saved.id ||
          todo.text !== saved.text ||
          todo.completed !== saved.completed
        )
      })
    )
  })
  const validationErrors = computed(() => ({
    title: draft.title.trim().length === 0,
    todos: draft.todos.filter((todo) => todo.text.trim().length === 0).map((todo) => todo.id),
  }))

  function record(change: NoteChange): void {
    history.value.record(change)
    triggerRef(history)
  }

  function flushTextEdit(): void {
    const change = pendingText.value
    pendingText.value = null
    if (change) record(change)
  }

  function queueTextChange(change: TextChange): void {
    const previous = pendingText.value
    const sameField =
      previous?.type === change.type &&
      (change.type === 'set-title' ||
        (previous.type === 'set-todo-text' && previous.id === change.id))

    if (!sameField) flushTextEdit()
    pendingText.value = {
      ...change,
      before: previous && sameField ? previous.before : change.before,
    }
    history.value.discardRedo()
    triggerRef(history)
  }

  function setTitle(value: string): void {
    if (draft.title === value) return
    const before = draft.title
    draft.title = value
    queueTextChange({ type: 'set-title', before, after: value })
  }

  function setTodoText(id: string, value: string): void {
    const todo = draft.todos.find((item) => item.id === id)
    if (!todo || todo.text === value) return
    const before = todo.text
    todo.text = value
    queueTextChange({ type: 'set-todo-text', id, before, after: value })
  }

  function setTodoCompleted(id: string, value: boolean): void {
    const todo = draft.todos.find((item) => item.id === id)
    if (!todo || todo.completed === value) return
    flushTextEdit()
    const before = todo.completed
    todo.completed = value
    record({ type: 'set-todo-completed', id, before, after: value })
  }

  function addTodo(text = ''): string {
    flushTextEdit()
    const todo = { id: crypto.randomUUID(), text, completed: false }
    const index = draft.todos.length
    draft.todos.push(todo)
    record({ type: 'insert-todo', todo, index })
    return todo.id
  }

  function removeTodo(id: string): boolean {
    const index = draft.todos.findIndex((todo) => todo.id === id)
    if (index === -1) return false
    flushTextEdit()
    const todo = draft.todos.splice(index, 1)[0]
    if (!todo) return false
    record({ type: 'remove-todo', todo, index })
    return true
  }

  function undo(): boolean {
    flushTextEdit()
    const changed = history.value.undo()
    triggerRef(history)
    return changed
  }

  function redo(): boolean {
    flushTextEdit()
    const changed = history.value.redo()
    triggerRef(history)
    return changed
  }

  function clearHistory(): void {
    pendingText.value = null
    history.value.clear()
    triggerRef(history)
  }

  function persist(asNew: boolean): EditorSaveResult {
    flushTextEdit()
    if (validationErrors.value.title || validationErrors.value.todos.length > 0) {
      return { status: 'invalid' }
    }

    const candidate = asNew ? { ...copyNote(draft), id: crypto.randomUUID() } : draft
    const result = asNew || isNew.value ? store.create(candidate) : store.update(candidate)
    if (result.status === 'ok') {
      const saved = store.notes.find((note) => note.id === candidate.id) ?? candidate
      baseline.value = copyNote(saved)
      Object.assign(draft, copyNote(saved))
      isNew.value = false
      clearHistory()
    }
    return result
  }

  function save(): EditorSaveResult {
    return persist(false)
  }

  function saveAsNew(): EditorSaveResult {
    return persist(true)
  }

  function restoreDraft(note: ReadonlyNote): void {
    Object.assign(draft, copyNote(note))
    clearHistory()
  }

  function cancel(): void {
    Object.assign(draft, copyNote(baseline.value))
    clearHistory()
  }

  return {
    draft: readonly(draft),
    isNew: readonly(isNew),
    canUndo,
    canRedo,
    isDirty,
    validationErrors,
    setTitle,
    setTodoText,
    setTodoCompleted,
    addTodo,
    removeTodo,
    flushTextEdit,
    undo,
    redo,
    save,
    saveAsNew,
    restoreDraft,
    cancel,
  }
}
