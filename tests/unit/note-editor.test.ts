import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteEditor } from '~/composables/useNoteEditor'
import { useNotesStore } from '~/stores/notes'
import { createMemoryStorage, makeNote } from '../helpers/notes'

describe('note editor', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createMemoryStorage()
    vi.stubGlobal('localStorage', storage)
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function existingEditor() {
    storage.setItem('notes-app:notes', JSON.stringify({ schemaVersion: 1, notes: [makeNote()] }))
    const store = useNotesStore()
    store.load()
    return useNoteEditor(store.notes[0]!)
  }

  it('restores a detached draft with empty history and keeps the saved baseline for cancel', () => {
    const editor = existingEditor()
    const recovered = makeNote({ title: 'Черновик' })
    editor.setTitle('Временная правка')
    editor.restoreDraft(recovered)
    recovered.todos[0]!.text = 'Внешнее изменение'
    expect(editor.draft.title).toBe('Черновик')
    expect(editor.draft.todos[0]!.text).toBe('Купить хлеб')
    expect(editor.isDirty.value).toBe(true)
    expect(editor.canUndo.value).toBe(false)
    expect(editor.canRedo.value).toBe(false)
    editor.cancel()
    expect(editor.draft).toEqual(makeNote())
  })

  it('restores a new draft and saves it under its recovered id', () => {
    const editor = useNoteEditor()
    editor.restoreDraft(makeNote())
    expect(editor.isNew.value).toBe(true)
    expect(editor.save()).toEqual({ status: 'ok' })
    expect(useNotesStore().notes[0]!.id).toBe('note-1')
  })

  it('recovers an orphan draft without resurrecting the deleted id', () => {
    const editor = useNoteEditor(undefined, 'note-1')
    editor.restoreDraft(makeNote({ title: 'Мои правки' }))
    expect(editor.isNew.value).toBe(false)
    expect(editor.save()).toEqual({ status: 'missing' })
    expect(editor.saveAsNew()).toEqual({ status: 'ok' })
    expect(useNotesStore().notes).toHaveLength(1)
    expect(editor.draft.id).not.toBe('note-1')
    expect(editor.draft.title).toBe('Мои правки')
    expect(editor.isDirty.value).toBe(false)
    expect(editor.canUndo.value).toBe(false)
  })

  it('keeps the original id, draft and history when saving as new fails', () => {
    const editor = existingEditor()
    editor.setTitle('Правки')
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Quota')
    })
    expect(editor.saveAsNew().status).toBe('storage-error')
    expect(editor.draft.id).toBe('note-1')
    expect(editor.draft.title).toBe('Правки')
    expect(editor.canUndo.value).toBe(true)
  })

  it('edits a detached draft even when the original note is reactive', () => {
    const original = reactive(makeNote())
    const editor = useNoteEditor(original)
    editor.setTitle('Выходные')
    editor.setTodoText('todo-1', 'Кофе')
    editor.setTodoCompleted('todo-1', true)

    expect(original).toEqual(makeNote())
    expect(editor.draft.title).toBe('Выходные')
    expect(editor.draft.todos[0]).toEqual({ id: 'todo-1', text: 'Кофе', completed: true })
    expect(storage.getItem('notes-app:notes')).toBeNull()
  })

  it('groups continuous title input into one step and updates history flags', () => {
    const editor = useNoteEditor(makeNote())
    expect(editor.canUndo.value).toBe(false)
    expect(editor.isDirty.value).toBe(false)

    editor.setTitle('В')
    editor.setTitle('Вы')
    editor.setTitle('Выходные')
    expect(editor.canUndo.value).toBe(true)
    expect(editor.isDirty.value).toBe(true)
    editor.flushTextEdit()

    expect(editor.undo()).toBe(true)
    expect(editor.draft.title).toBe('Покупки')
    expect(editor.canUndo.value).toBe(false)
    expect(editor.isDirty.value).toBe(false)
    expect(editor.canRedo.value).toBe(true)
    expect(editor.redo()).toBe(true)
    expect(editor.draft.title).toBe('Выходные')
    expect(editor.canRedo.value).toBe(false)
  })

  it('flushes unfinished text before undo and keeps edits in different fields separate', () => {
    const editor = useNoteEditor(makeNote())
    editor.setTitle('Выходные')
    editor.setTodoText('todo-1', 'К')
    editor.setTodoText('todo-1', 'Кофе')

    editor.undo()
    expect(editor.draft.todos[0]!.text).toBe('Купить хлеб')
    expect(editor.draft.title).toBe('Выходные')
    editor.undo()
    expect(editor.draft.title).toBe('Покупки')
    expect(editor.canUndo.value).toBe(false)
    editor.redo()
    editor.redo()
    expect(editor.draft.todos[0]!.text).toBe('Кофе')
  })

  it('starts a separate text step after blur or a switch to another todo', () => {
    const editor = useNoteEditor(
      makeNote({
        todos: [
          { id: 'a', text: 'Первый', completed: false },
          { id: 'b', text: 'Второй', completed: false },
        ],
      }),
    )
    editor.setTodoText('a', 'A')
    editor.flushTextEdit()
    editor.setTodoText('a', 'AA')
    editor.setTodoText('b', 'BB')

    editor.undo()
    expect(editor.draft.todos.map((todo) => todo.text)).toEqual(['AA', 'Второй'])
    editor.undo()
    expect(editor.draft.todos[0]!.text).toBe('A')
    editor.undo()
    expect(editor.draft.todos[0]!.text).toBe('Первый')
  })

  it('does not record unchanged text or a text edit returned to its initial value', () => {
    const editor = useNoteEditor(makeNote())
    editor.setTitle('Покупки')
    editor.setTitle('Другое')
    editor.setTitle('Покупки')
    editor.flushTextEdit()
    editor.setTodoText('todo-1', 'Купить хлеб')

    expect(editor.undo()).toBe(false)
    expect(editor.isDirty.value).toBe(false)
  })

  it('clears redo as soon as new input starts, even if the user then restores the text', () => {
    const editor = useNoteEditor(makeNote())
    editor.setTitle('Выходные')
    editor.undo()
    expect(editor.canRedo.value).toBe(true)

    editor.setTitle('Другая правка')
    expect(editor.canRedo.value).toBe(false)
    editor.setTitle('Покупки')
    expect(editor.redo()).toBe(false)
    expect(editor.canUndo.value).toBe(false)
    expect(editor.draft.title).toBe('Покупки')
  })

  it.each(['add', 'remove', 'check'] as const)(
    '%s commits text before its own atomic step',
    (action) => {
      const editor = useNoteEditor(makeNote())
      editor.setTitle('Выходные')
      if (action === 'add') editor.addTodo('Кофе')
      if (action === 'remove') editor.removeTodo('todo-1')
      if (action === 'check') editor.setTodoCompleted('todo-1', true)

      editor.undo()
      expect(editor.draft.todos).toEqual(makeNote().todos)
      expect(editor.draft.title).toBe('Выходные')
      editor.undo()
      expect(editor.draft.title).toBe('Покупки')
      expect(editor.canUndo.value).toBe(false)
    },
  )

  it('undoes deletion before undoing the removed todo’s unfinished text edit', () => {
    const editor = useNoteEditor(makeNote())
    editor.setTodoText('todo-1', 'Кофе')
    editor.removeTodo('todo-1')

    editor.undo()
    expect(editor.draft.todos[0]!.text).toBe('Кофе')
    editor.undo()
    expect(editor.draft.todos[0]!.text).toBe('Купить хлеб')
    editor.redo()
    editor.redo()
    expect(editor.draft.todos).toEqual([])
  })

  it('replays adding and editing a new todo without leaking later text into its insertion', () => {
    const editor = useNoteEditor(makeNote({ todos: [] }))
    const id = editor.addTodo()
    editor.setTodoText(id, 'Кофе')
    editor.setTodoCompleted(id, true)

    editor.undo()
    editor.undo()
    expect(editor.draft.todos).toEqual([{ id, text: '', completed: false }])
    editor.undo()
    expect(editor.draft.todos).toEqual([])
    editor.redo()
    expect(editor.draft.todos).toEqual([{ id, text: '', completed: false }])
    editor.redo()
    editor.redo()
    expect(editor.draft.todos).toEqual([{ id, text: 'Кофе', completed: true }])
  })

  it('ignores unchanged checkboxes and missing todo ids without clearing redo', () => {
    const editor = useNoteEditor(makeNote())
    editor.setTitle('Выходные')
    editor.undo()
    editor.setTitle('Покупки')
    editor.setTodoCompleted('todo-1', false)
    editor.setTodoCompleted('missing', true)
    editor.setTodoText('missing', 'Текст')
    expect(editor.removeTodo('missing')).toBe(false)

    expect(editor.canRedo.value).toBe(true)
    expect(editor.redo()).toBe(true)
    expect(editor.draft.title).toBe('Выходные')
  })

  it('stays dirty after undoing the retained history when the oldest change was evicted', () => {
    const editor = useNoteEditor(makeNote({ title: '0' }))
    for (let step = 1; step <= 51; step++) {
      editor.setTitle(String(step))
      editor.flushTextEdit()
    }
    for (let step = 0; step < 50; step++) editor.undo()

    expect(editor.draft.title).toBe('1')
    expect(editor.canUndo.value).toBe(false)
    expect(editor.isDirty.value).toBe(true)
    editor.cancel()
    expect(editor.draft.title).toBe('0')
  })

  it('clears history only after a successful save and cancels back to that saved baseline', () => {
    const editor = existingEditor()
    editor.setTitle('Сохранённый заголовок')

    expect(editor.save()).toEqual({ status: 'ok' })
    expect(editor.isDirty.value).toBe(false)
    expect(editor.canUndo.value).toBe(false)
    expect(editor.canRedo.value).toBe(false)
    expect(editor.draft).toEqual(useNotesStore().notes[0])
    editor.setTitle('Несохранённая правка')
    editor.cancel()

    expect(editor.draft.title).toBe('Сохранённый заголовок')
    const restored = useNotesStore(createPinia())
    restored.load()
    expect(restored.notes[0]!.title).toBe('Сохранённый заголовок')
  })

  it('creates a new note on first save and updates it on subsequent saves', () => {
    const editor = useNoteEditor()
    expect(editor.isNew.value).toBe(true)
    expect(storage.getItem('notes-app:notes')).toBeNull()
    editor.setTitle('Планы')
    expect(editor.save()).toEqual({ status: 'ok' })
    const id = editor.draft.id
    expect(editor.isNew.value).toBe(false)
    editor.setTitle('Планы на неделю')
    expect(editor.save()).toEqual({ status: 'ok' })

    expect(useNotesStore().notes).toHaveLength(1)
    expect(useNotesStore().notes[0]).toMatchObject({ id, title: 'Планы на неделю', todos: [] })
  })

  it('reports blank fields without writing or clearing history and preserves meaningful whitespace', () => {
    const editor = useNoteEditor()
    const id = editor.addTodo('   ')
    expect(editor.validationErrors.value).toEqual({ title: true, todos: [id] })
    expect(editor.save()).toEqual({ status: 'invalid' })
    expect(editor.canUndo.value).toBe(true)
    expect(storage.getItem('notes-app:notes')).toBeNull()

    editor.setTitle(' Планы ')
    editor.setTodoText(id, ' Купить хлеб ')
    expect(editor.validationErrors.value).toEqual({ title: false, todos: [] })
    expect(editor.save()).toEqual({ status: 'ok' })
    expect(editor.draft.title).toBe(' Планы ')
    expect(editor.draft.todos[0]!.text).toBe(' Купить хлеб ')
  })

  it.each(['storage-error', 'missing'] as const)(
    'keeps the draft and undo after save returns %s',
    (status) => {
      const editor = existingEditor()
      editor.setTitle('Несохранённая правка')
      if (status === 'missing') {
        storage.setItem('notes-app:notes', '{"schemaVersion":1,"notes":[]}')
      } else {
        vi.spyOn(storage, 'setItem').mockImplementation(() => {
          throw new DOMException('Storage is full', 'QuotaExceededError')
        })
      }

      expect(editor.save().status).toBe(status)
      expect(editor.isDirty.value).toBe(true)
      expect(editor.draft.title).toBe('Несохранённая правка')
      expect(editor.canUndo.value).toBe(true)
      editor.undo()
      expect(editor.draft.title).toBe('Покупки')
      editor.redo()
      expect(editor.draft.title).toBe('Несохранённая правка')
    },
  )

  it('cancels applied changes, redo and pending text without writing to storage', () => {
    const editor = existingEditor()
    const before = storage.getItem('notes-app:notes')
    editor.setTitle('Выходные')
    editor.setTodoCompleted('todo-1', true)
    editor.undo()
    expect(editor.canRedo.value).toBe(true)

    editor.cancel()

    expect(editor.draft).toEqual(makeNote())
    expect(editor.isDirty.value).toBe(false)
    expect(editor.canUndo.value).toBe(false)
    expect(editor.canRedo.value).toBe(false)
    editor.setTitle('Незавершённый ввод')
    editor.cancel()
    expect(editor.draft.title).toBe('Покупки')
    expect(editor.undo()).toBe(false)
    expect(storage.getItem('notes-app:notes')).toBe(before)
  })
})
