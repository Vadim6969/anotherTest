import type { Note, ReadonlyNote } from '~/types/note'
import type { StorageFailure, StorageWriteResult } from '~/types/storage'
import { isNote } from '~/utils/note'
import { isRecord } from '~/utils/validation'

const SCHEMA_VERSION = 1

type ReadResult = { status: 'ok'; note: Note | null } | StorageFailure

export function draftStorageKey(noteId: string | null): string {
  return `notes-app:draft:${noteId ?? 'new'}`
}

export function readDraft(noteId: string | null): ReadResult {
  let raw: string | null
  try {
    raw = globalThis.sessionStorage.getItem(draftStorageKey(noteId))
  } catch {
    return { status: 'storage-error', error: 'unavailable' }
  }
  if (raw === null) return { status: 'ok', note: null }

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
  if (
    data.noteId !== noteId ||
    !isNote(data.note) ||
    (noteId !== null && data.note.id !== noteId)
  ) {
    return { status: 'storage-error', error: 'invalid-data' }
  }
  return { status: 'ok', note: data.note }
}

export function writeDraft(noteId: string | null, note: ReadonlyNote): StorageWriteResult {
  if (!isNote(note) || (noteId !== null && note.id !== noteId)) {
    return { status: 'storage-error', error: 'invalid-data' }
  }
  try {
    globalThis.sessionStorage.setItem(
      draftStorageKey(noteId),
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, noteId, note }),
    )
    return { status: 'ok' }
  } catch {
    return { status: 'storage-error', error: 'unavailable' }
  }
}

export function removeDraft(noteId: string | null): StorageWriteResult {
  try {
    globalThis.sessionStorage.removeItem(draftStorageKey(noteId))
    return { status: 'ok' }
  } catch {
    return { status: 'storage-error', error: 'unavailable' }
  }
}
