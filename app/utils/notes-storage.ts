import type { Note, ReadonlyNote } from '~/types/note'
import type { StorageFailure, StorageWriteResult } from '~/types/storage'
import { hasUniqueIds, isNote } from '~/utils/note'
import { isRecord } from '~/utils/validation'

export const NOTES_STORAGE_KEY = 'notes-app:notes'
const SCHEMA_VERSION = 1

type ReadResult = { status: 'ok'; notes: Note[] } | StorageFailure

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

export function writeNotes(notes: readonly ReadonlyNote[]): StorageWriteResult {
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
