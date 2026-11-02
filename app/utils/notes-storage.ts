import type { Note, StorageFailure, Todo } from '~/types/note'

export const NOTES_STORAGE_KEY = 'notes-app:notes'
const SCHEMA_VERSION = 1

type ReadResult = { status: 'ok'; notes: Note[] } | StorageFailure
type WriteResult = { status: 'ok' } | StorageFailure

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasUniqueIds(items: { id: string }[]): boolean {
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

function isNote(value: unknown): value is Note {
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

function isNotes(value: unknown): value is Note[] {
  return Array.isArray(value) && value.every(isNote) && hasUniqueIds(value)
}

export function readNotes(): ReadResult {
  let raw: string | null

  try {
    raw = globalThis.localStorage.getItem(NOTES_STORAGE_KEY)
  } catch {
    return { status: 'storage-error', error: 'unavailable' }
  }

  if (raw === null) return { status: 'ok', notes: [] }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { status: 'storage-error', error: 'invalid-data' }
  }

  if (!isRecord(data) || !Number.isInteger(data.schemaVersion)) {
    return { status: 'storage-error', error: 'invalid-data' }
  }

  if (data.schemaVersion !== SCHEMA_VERSION) {
    return { status: 'storage-error', error: 'unsupported-version' }
  }

  if (!isNotes(data.notes)) {
    return { status: 'storage-error', error: 'invalid-data' }
  }

  return { status: 'ok', notes: data.notes }
}

export function writeNotes(notes: Note[]): WriteResult {
  if (!isNotes(notes)) return { status: 'storage-error', error: 'invalid-data' }

  try {
    globalThis.localStorage.setItem(
      NOTES_STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, notes }),
    )
    return { status: 'ok' }
  } catch {
    return { status: 'storage-error', error: 'unavailable' }
  }
}
