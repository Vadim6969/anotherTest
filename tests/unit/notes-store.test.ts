import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore } from '~/stores/notes'
import type { Note } from '~/types/note'
import { NOTES_STORAGE_KEY } from '~/utils/notes-storage'
import { createMemoryStorage, makeNote } from '../helpers/notes'

const SAVE_TIME = '2026-11-02T12:00:00.000Z'

describe('notes store', () => {
  let storage: Storage

  function seed(notes: Note[]) {
    storage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, notes }))
  }

  beforeEach(() => {
    storage = createMemoryStorage()
    vi.stubGlobal('localStorage', storage)
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(SAVE_TIME))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('creates a note with the save time and restores it in a fresh store', () => {
    const store = useNotesStore()

    expect(store.create(makeNote())).toEqual({ status: 'ok' })
    expect(store.notes).toEqual([makeNote({ updatedAt: SAVE_TIME })])

    const restored = useNotesStore(createPinia())
    restored.load()
    expect(restored.notes).toEqual(store.notes)
    expect(restored.storageError).toBeNull()
  })

  it('updates the title and todos without losing other notes', () => {
    const other = makeNote({ id: 'note-2', title: 'Работа' })
    seed([makeNote(), other])
    const store = useNotesStore()
    store.load()

    const edited = makeNote({
      title: 'Покупки на выходные',
      todos: [{ id: 'todo-2', text: 'Кофе', completed: true }],
    })
    expect(store.update(edited)).toEqual({ status: 'ok' })

    const restored = useNotesStore(createPinia())
    restored.load()
    expect(restored.notes).toEqual([{ ...edited, updatedAt: SAVE_TIME }, other])
  })

  it('persists deletion, including removal of the last note', () => {
    seed([makeNote()])
    const store = useNotesStore()
    store.load()

    expect(store.remove('note-1')).toEqual({ status: 'ok' })
    expect(store.notes).toEqual([])

    const restored = useNotesStore(createPinia())
    restored.load()
    expect(restored.notes).toEqual([])
    expect(JSON.parse(storage.getItem(NOTES_STORAGE_KEY)!)).toEqual({
      schemaVersion: 1,
      notes: [],
    })
  })

  it.each(['create', 'update'] as const)(
    '%s detaches the saved note from subsequent draft edits',
    async (action) => {
      if (action === 'update') seed([makeNote()])
      const store = useNotesStore()
      const draft = makeNote()
      store[action](draft)
      const persisted = storage.getItem(NOTES_STORAGE_KEY)

      draft.title = 'Несохранённый заголовок'
      draft.todos[0]!.text = 'Несохранённая задача'
      draft.todos[0]!.completed = true
      draft.todos.push({ id: 'todo-2', text: 'Новый пункт', completed: false })
      await nextTick()

      expect(store.notes).toEqual([makeNote({ updatedAt: SAVE_TIME })])
      expect(storage.getItem(NOTES_STORAGE_KEY)).toBe(persisted)
    },
  )

  it('loads without writing or automatically persisting changes', async () => {
    seed([makeNote()])
    const write = vi.spyOn(storage, 'setItem')
    const store = useNotesStore()
    store.load()
    store.load()
    await nextTick()

    expect(store.notes).toEqual([makeNote()])
    expect(write).not.toHaveBeenCalled()
  })

  it.each(['update', 'remove'] as const)(
    '%s reports a note deleted since the last load without recreating it',
    (action) => {
      seed([makeNote()])
      const store = useNotesStore()
      store.load()
      seed([])
      const write = vi.spyOn(storage, 'setItem')

      const result = action === 'update' ? store.update(makeNote()) : store.remove('note-1')

      expect(result).toEqual({ status: 'missing' })
      expect(store.notes).toEqual([])
      expect(write).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['create', ['note-1', 'note-2', 'note-3']],
    ['update', ['note-1', 'note-2']],
    ['remove', ['note-2']],
  ] as const)('%s preserves notes added since the last load', (action, expectedIds) => {
    seed([makeNote()])
    const store = useNotesStore()
    store.load()
    const external = makeNote({ id: 'note-2', title: 'Добавлена в другой вкладке' })
    seed([makeNote(), external])

    const result =
      action === 'create'
        ? store.create(makeNote({ id: 'note-3' }))
        : action === 'update'
          ? store.update(makeNote({ title: 'Новый заголовок' }))
          : store.remove('note-1')

    expect(result).toEqual({ status: 'ok' })
    const restored = useNotesStore(createPinia())
    restored.load()
    expect(restored.notes.map((note) => note.id)).toEqual(expectedIds)
    expect(restored.notes.find((note) => note.id === 'note-2')).toEqual(external)
  })

  it('refuses to create a duplicate id without overwriting the existing note', () => {
    seed([makeNote()])
    const store = useNotesStore()
    const before = storage.getItem(NOTES_STORAGE_KEY)

    expect(store.create(makeNote({ title: 'Дубликат' }))).toEqual({ status: 'conflict' })
    expect(store.notes).toEqual([makeNote()])
    expect(storage.getItem(NOTES_STORAGE_KEY)).toBe(before)
  })

  it.each(['create', 'update', 'remove'] as const)(
    '%s leaves both saved state and storage unchanged on a failed write',
    (action) => {
      seed([makeNote()])
      const store = useNotesStore()
      store.load()
      const before = storage.getItem(NOTES_STORAGE_KEY)
      vi.spyOn(storage, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage is full', 'QuotaExceededError')
      })

      const result =
        action === 'create'
          ? store.create(makeNote({ id: 'note-2' }))
          : action === 'update'
            ? store.update(makeNote({ title: 'Не сохранится' }))
            : store.remove('note-1')

      expect(result).toEqual({ status: 'storage-error', error: 'unavailable' })
      expect(store.storageError).toBe('unavailable')
      expect(store.notes).toEqual([makeNote()])
      expect(storage.getItem(NOTES_STORAGE_KEY)).toBe(before)
    },
  )

  it.each([
    ['{', 'invalid-data'],
    ['{"schemaVersion":2,"notes":[]}', 'unsupported-version'],
  ] as const)('keeps existing state and blocks writes for unreadable storage: %s', (raw, error) => {
    seed([makeNote()])
    const store = useNotesStore()
    store.load()
    storage.setItem(NOTES_STORAGE_KEY, raw)

    store.load()
    expect(store.storageError).toBe(error)
    expect(store.notes).toEqual([makeNote()])
    expect(store.create(makeNote({ id: 'note-2' }))).toEqual({ status: 'storage-error', error })
    expect(storage.getItem(NOTES_STORAGE_KEY)).toBe(raw)
  })

  it('clears the storage error after a successful retry', () => {
    const store = useNotesStore()
    const write = vi.spyOn(storage, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError')
    })

    expect(store.create(makeNote()).status).toBe('storage-error')
    write.mockRestore()
    expect(store.create(makeNote())).toEqual({ status: 'ok' })
    expect(store.storageError).toBeNull()
    expect(store.notes).toHaveLength(1)
  })
})
