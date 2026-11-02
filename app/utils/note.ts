import type { Note, ReadonlyNote, Todo } from '~/types/note'
import { isRecord } from '~/utils/validation'

export function copyNote(note: ReadonlyNote): Note {
  return {
    id: note.id,
    title: note.title,
    todos: note.todos.map((todo) => ({ ...todo })),
    updatedAt: note.updatedAt,
  }
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function hasUniqueIds(items: readonly { readonly id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length
}

function isTodo(value: unknown): value is Todo {
  return (
    isRecord(value) &&
    isId(value.id) &&
    typeof value.text === 'string' &&
    typeof value.completed === 'boolean'
  )
}

export function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    isId(value.id) &&
    typeof value.title === 'string' &&
    typeof value.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.updatedAt)) &&
    Array.isArray(value.todos) &&
    value.todos.every(isTodo) &&
    hasUniqueIds(value.todos)
  )
}
