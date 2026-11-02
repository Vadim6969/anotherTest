import type { Note } from '~/types/note'

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Покупки',
    todos: [{ id: 'todo-1', text: 'Купить хлеб', completed: false }],
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  }
}

export function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, String(value))
    },
  }
}
