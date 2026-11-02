import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readNotes, writeNotes } from '~/utils/notes-storage'
import { createMemoryStorage, makeNote } from '../helpers/notes'

describe('notes storage', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createMemoryStorage()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads an unused storage without creating an entry', () => {
    expect(readNotes()).toEqual({ status: 'ok', notes: [] })
    expect(storage.getItem('notes-app:notes')).toBeNull()
  })

  it('persists the schema version and restores note and todo fields', () => {
    const note = makeNote({
      todos: [
        { id: 'todo-1', text: 'Хлеб', completed: true },
        { id: 'todo-2', text: 'Молоко', completed: false },
      ],
    })

    expect(writeNotes([note])).toEqual({ status: 'ok' })
    expect(JSON.parse(storage.getItem('notes-app:notes')!)).toEqual({
      schemaVersion: 1,
      notes: [note],
    })
    expect(readNotes()).toEqual({ status: 'ok', notes: [note] })
  })

  it.each([
    ['broken JSON', '{'],
    ['null payload', 'null'],
    ['missing version', JSON.stringify({ notes: [] })],
    ['non-array notes', JSON.stringify({ schemaVersion: 1, notes: {} })],
    ['empty id', JSON.stringify({ schemaVersion: 1, notes: [makeNote({ id: '' })] })],
    [
      'invalid timestamp',
      JSON.stringify({ schemaVersion: 1, notes: [makeNote({ updatedAt: 'not-a-date' })] }),
    ],
    [
      'invalid nested todo',
      JSON.stringify({
        schemaVersion: 1,
        notes: [{ ...makeNote(), todos: [{ id: 'todo-1', text: 'Хлеб', completed: 'false' }] }],
      }),
    ],
    ['duplicate note ids', JSON.stringify({ schemaVersion: 1, notes: [makeNote(), makeNote()] })],
    [
      'duplicate todo ids',
      JSON.stringify({
        schemaVersion: 1,
        notes: [
          makeNote({
            todos: [
              { id: 'todo-1', text: 'Хлеб', completed: false },
              { id: 'todo-1', text: 'Молоко', completed: true },
            ],
          }),
        ],
      }),
    ],
  ])('rejects %s without changing the stored value', (_, raw) => {
    storage.setItem('notes-app:notes', raw)

    expect(readNotes()).toEqual({ status: 'storage-error', error: 'invalid-data' })
    expect(storage.getItem('notes-app:notes')).toBe(raw)
  })

  it('reports an unsupported schema without replacing it', () => {
    const raw = JSON.stringify({ schemaVersion: 2, notes: [] })
    storage.setItem('notes-app:notes', raw)

    expect(readNotes()).toEqual({ status: 'storage-error', error: 'unsupported-version' })
    expect(storage.getItem('notes-app:notes')).toBe(raw)
  })

  it('returns an error when the browser denies access to localStorage', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is disabled', 'SecurityError')
      },
    })

    expect(readNotes()).toEqual({ status: 'storage-error', error: 'unavailable' })
    expect(writeNotes([makeNote()])).toEqual({ status: 'storage-error', error: 'unavailable' })
  })

  it('does not report success when the storage quota is exceeded', () => {
    storage.setItem('notes-app:notes', '{"schemaVersion":1,"notes":[]}')
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError')
    })

    expect(writeNotes([makeNote()])).toEqual({ status: 'storage-error', error: 'unavailable' })
    expect(readNotes()).toEqual({ status: 'ok', notes: [] })
  })
})
