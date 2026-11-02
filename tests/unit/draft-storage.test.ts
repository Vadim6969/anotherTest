import { readonly } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draftStorageKey, readDraft, removeDraft, writeDraft } from '~/utils/draft-storage'
import { createMemoryStorage, makeNote } from '../helpers/notes'

describe('draft storage', () => {
  let storage: Storage
  beforeEach(() => {
    storage = createMemoryStorage()
    vi.stubGlobal('sessionStorage', storage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips incomplete drafts separately for new and existing notes', () => {
    const note = makeNote({ title: '', todos: [{ id: 'a', text: '', completed: true }] })
    expect(readDraft(null)).toEqual({ status: 'ok', note: null })
    expect(writeDraft(null, readonly(note))).toEqual({ status: 'ok' })
    expect(writeDraft(note.id, makeNote())).toEqual({ status: 'ok' })
    expect(readDraft(null)).toEqual({ status: 'ok', note })
    expect(readDraft(note.id)).toEqual({ status: 'ok', note: makeNote() })
    expect(JSON.parse(storage.getItem('notes-app:draft:new')!)).toEqual({
      schemaVersion: 1,
      noteId: null,
      note,
    })
    expect(removeDraft(null)).toEqual({ status: 'ok' })
    expect(readDraft(null)).toEqual({ status: 'ok', note: null })
    expect(readDraft(note.id)).toEqual({ status: 'ok', note: makeNote() })
  })

  it.each([
    ['broken JSON', '{', 'invalid-data'],
    ['null payload', 'null', 'invalid-data'],
    ['array payload', '[]', 'invalid-data'],
    ['missing version', JSON.stringify({ noteId: 'note-1', note: makeNote() }), 'invalid-data'],
    ['non-integer version', JSON.stringify({ schemaVersion: 1.5 }), 'invalid-data'],
    ['unknown version', JSON.stringify({ schemaVersion: 2 }), 'unsupported-version'],
    [
      'wrong route',
      JSON.stringify({ schemaVersion: 1, noteId: 'other', note: makeNote() }),
      'invalid-data',
    ],
    [
      'wrong note id',
      JSON.stringify({ schemaVersion: 1, noteId: 'note-1', note: makeNote({ id: 'other' }) }),
      'invalid-data',
    ],
    [
      'invalid Todo',
      JSON.stringify({ schemaVersion: 1, noteId: 'note-1', note: { ...makeNote(), todos: [{}] } }),
      'invalid-data',
    ],
  ])('reports %s without deleting the data', (_name, raw, error) => {
    storage.setItem(draftStorageKey('note-1'), raw)
    expect(readDraft('note-1')).toEqual({ status: 'storage-error', error })
    expect(storage.getItem(draftStorageKey('note-1'))).toBe(raw)
  })

  it('rejects invalid writes without replacing an existing draft', () => {
    writeDraft('note-1', makeNote())
    const before = storage.getItem(draftStorageKey('note-1'))
    expect(writeDraft('note-1', makeNote({ id: 'other' }))).toEqual({
      status: 'storage-error',
      error: 'invalid-data',
    })
    expect(storage.getItem(draftStorageKey('note-1'))).toBe(before)
  })

  it('reports blocked session storage for reads, writes and cleanup', () => {
    vi.stubGlobal('sessionStorage', undefined)
    const failure = { status: 'storage-error', error: 'unavailable' }
    expect(readDraft(null)).toEqual(failure)
    expect(writeDraft(null, makeNote())).toEqual(failure)
    expect(removeDraft(null)).toEqual(failure)
  })
})
