import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesSync } from '~/composables/useNotesSync'
import { useNoteEditor } from '~/composables/useNoteEditor'
import { useNotesStore } from '~/stores/notes'
import { NOTES_STORAGE_KEY, writeNotes } from '~/utils/notes-storage'
import { createMemoryStorage, makeNote } from '../helpers/notes'

describe('cross-tab notes sync', () => {
  let storage: Storage
  let page: EventTarget
  const scopes: ReturnType<typeof effectScope>[] = []
  beforeEach(() => {
    storage = createMemoryStorage()
    page = new EventTarget()
    vi.stubGlobal('window', page)
    vi.stubGlobal('localStorage', storage)
    setActivePinia(createPinia())
  })
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
    vi.unstubAllGlobals()
  })

  function start() {
    const scope = effectScope()
    scopes.push(scope)
    scope.run(() => useNotesSync())
    return scope
  }

  function notify(key: string | null = NOTES_STORAGE_KEY, storageArea = storage) {
    page.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea }))
  }

  it('refreshes saved notes without changing the active editor draft', () => {
    const store = useNotesStore()
    store.create(makeNote())
    const editor = useNoteEditor(store.notes[0])
    editor.setTitle('Локальная правка')
    start()
    writeNotes([makeNote({ title: 'Из другой вкладки' })])
    notify()
    expect(store.notes[0]!.title).toBe('Из другой вкладки')
    expect(editor.draft.title).toBe('Локальная правка')
    expect(editor.canUndo.value).toBe(true)
  })

  it('handles deletion by a second store and cannot update the deleted id even without an event', () => {
    const piniaB = createPinia()
    const tabB = useNotesStore(piniaB)
    const tabA = useNotesStore(createPinia())
    setActivePinia(piniaB)
    tabA.create(makeNote())
    tabB.load()
    start()
    tabA.remove('note-1')
    expect(tabB.notes).toHaveLength(1)
    expect(tabB.update(makeNote({ title: 'Не воскрешать' }))).toEqual({ status: 'missing' })
    notify()
    expect(tabB.notes).toEqual([])
    tabA.load()
    expect(tabA.notes).toEqual([])
  })

  it('filters unrelated events, handles clear and releases its listener', () => {
    const store = useNotesStore()
    store.create(makeNote())
    const scope = start()
    storage.clear()
    notify('unrelated')
    notify(NOTES_STORAGE_KEY, createMemoryStorage())
    expect(store.notes).toHaveLength(1)
    notify(null)
    expect(store.notes).toEqual([])
    scope.stop()
    writeNotes([makeNote()])
    notify()
    expect(store.notes).toEqual([])
  })
})
