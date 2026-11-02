import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteEditor } from '~/composables/useNoteEditor'
import { useNoteDraft } from '~/composables/useNoteDraft'
import { readDraft, writeDraft } from '~/utils/draft-storage'
import { createMemoryStorage, makeNote } from '../helpers/notes'

describe('draft recovery lifecycle', () => {
  let storage: Storage
  let page: EventTarget
  let documentEvents: EventTarget & { visibilityState: string }
  const scopes: ReturnType<typeof effectScope>[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    storage = createMemoryStorage()
    page = new EventTarget()
    documentEvents = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.stubGlobal('window', page)
    vi.stubGlobal('document', documentEvents)
    setActivePinia(createPinia())
  })
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function session() {
    const scope = effectScope()
    scopes.push(scope)
    const editor = useNoteEditor()
    const recovery = scope.run(() => useNoteDraft(null, editor))!
    return { editor, recovery, scope }
  }

  it('debounces rapid edits for 700 ms and writes the latest state', () => {
    const { editor } = session()
    editor.setTitle('Первая правка')
    vi.advanceTimersByTime(600)
    editor.setTitle('Последняя правка')
    vi.advanceTimersByTime(699)
    expect(readDraft(null)).toEqual({ status: 'ok', note: null })
    vi.advanceTimersByTime(1)
    expect(readDraft(null)).toMatchObject({ status: 'ok', note: { title: 'Последняя правка' } })
  })

  it.each(['pagehide', 'hidden'] as const)(
    'flushes unfinished input immediately on %s',
    (event) => {
      const { editor } = session()
      editor.setTitle('Ещё не прошли 700 мс')
      if (event === 'pagehide') page.dispatchEvent(new Event('pagehide'))
      else {
        documentEvents.visibilityState = 'hidden'
        documentEvents.dispatchEvent(new Event('visibilitychange'))
      }
      expect(readDraft(null)).toMatchObject({
        status: 'ok',
        note: { title: 'Ещё не прошли 700 мс' },
      })
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each(['save', 'cancel'] as const)(
    '%s clears the draft and prevents a late timer from bringing it back',
    (action) => {
      const { editor, recovery, scope } = session()
      editor.setTitle('Черновик')
      vi.advanceTimersByTime(700)
      editor.setTitle('Новая правка перед действием')
      editor[action]()
      expect(recovery.clear()).toBe(true)
      scope.stop()
      vi.runAllTimers()
      page.dispatchEvent(new Event('pagehide'))
      expect(readDraft(null)).toEqual({ status: 'ok', note: null })
    },
  )

  it('keeps an unresolved recovery untouched until an explicit restore or discard', () => {
    writeDraft(null, makeNote())
    const { editor, recovery, scope } = session()
    expect(recovery.pendingDraft.value).toEqual(makeNote())
    editor.setTitle('Не должен затереть ожидающий черновик')
    vi.runAllTimers()
    page.dispatchEvent(new Event('pagehide'))
    scope.stop()
    expect(readDraft(null)).toEqual({ status: 'ok', note: makeNote() })
  })

  it('restores without old history and continues persisting subsequent edits', () => {
    writeDraft(null, makeNote())
    const { editor, recovery } = session()
    recovery.restore()
    expect(recovery.pendingDraft.value).toBeNull()
    expect(editor.draft.title).toBe('Покупки')
    expect(editor.canUndo.value).toBe(false)
    editor.setTitle('После восстановления')
    vi.advanceTimersByTime(700)
    expect(readDraft(null)).toMatchObject({ status: 'ok', note: { title: 'После восстановления' } })
  })

  it('discards recovery explicitly and permits a fresh draft', () => {
    writeDraft(null, makeNote())
    const { editor, recovery } = session()
    expect(recovery.clear()).toBe(true)
    expect(recovery.pendingDraft.value).toBeNull()
    expect(readDraft(null)).toEqual({ status: 'ok', note: null })
    editor.setTitle('Начать заново')
    vi.advanceTimersByTime(700)
    expect(readDraft(null)).toMatchObject({ status: 'ok', note: { title: 'Начать заново' } })
  })

  it('does not overwrite unsupported stored data', () => {
    storage.setItem('notes-app:draft:new', '{"schemaVersion":2}')
    const { editor, recovery } = session()
    editor.setTitle('Правки')
    vi.runAllTimers()
    recovery.flush()
    expect(recovery.error.value).toBe('unsupported-version')
    expect(storage.getItem('notes-app:draft:new')).toBe('{"schemaVersion":2}')
  })

  it('reports quota and cleanup failures while keeping editor data available', () => {
    const { editor, recovery } = session()
    editor.setTitle('Не потерять')
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Quota')
    })
    vi.advanceTimersByTime(700)
    expect(recovery.error.value).toBe('unavailable')
    expect(editor.draft.title).toBe('Не потерять')
    vi.spyOn(storage, 'removeItem').mockImplementation(() => {
      throw new Error('Denied')
    })
    expect(recovery.clear()).toBe(false)
  })

  it('flushes on disposal and removes listeners and timers', () => {
    const { editor, scope } = session()
    editor.setTitle('Перед уходом')
    scope.stop()
    expect(readDraft(null)).toMatchObject({ status: 'ok', note: { title: 'Перед уходом' } })
    storage.removeItem('notes-app:draft:new')
    editor.setTitle('После ухода')
    page.dispatchEvent(new Event('pagehide'))
    documentEvents.visibilityState = 'hidden'
    documentEvents.dispatchEvent(new Event('visibilitychange'))
    vi.runAllTimers()
    expect(readDraft(null)).toEqual({ status: 'ok', note: null })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('requires cleanup retry after save-as-new before permitting more edits under the old route', () => {
    const scope = effectScope()
    scopes.push(scope)
    const editor = useNoteEditor(undefined, 'note-1')
    const recovery = scope.run(() => useNoteDraft('note-1', editor))!
    editor.restoreDraft(makeNote({ title: 'Спасённый черновик' }))
    recovery.flush()
    const remove = vi.spyOn(storage, 'removeItem').mockImplementation(() => {
      throw new Error('Denied')
    })
    expect(editor.saveAsNew()).toEqual({ status: 'ok' })
    const savedId = editor.draft.id

    expect(recovery.finish()).toBe(false)
    expect(recovery.finishing.value).toBe(true)
    expect(editor.draft.title).toBe('Спасённый черновик')
    expect(editor.draft.id).not.toBe('note-1')
    remove.mockRestore()
    expect(recovery.finish()).toBe(true)
    expect(editor.draft.id).toBe(savedId)
    scope.stop()
    vi.runAllTimers()
    expect(readDraft('note-1')).toEqual({ status: 'ok', note: null })
  })
})
