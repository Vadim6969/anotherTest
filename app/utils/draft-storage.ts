import type { Note, StorageFailure } from '~/types/note'
import { isNote } from '~/utils/notes-storage'

type ReadResult = { status: 'ok'; note: Note | null } | StorageFailure
type WriteResult = { status: 'ok' } | StorageFailure

function key(noteId: string | null): string {
  return `notes-app:draft:${noteId ?? 'new'}`
}

export function readDraft(noteId: string | null): ReadResult {
  let raw: string | null
  try {
    raw = globalThis.sessionStorage.getItem(key(noteId))
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
  if (
    typeof data !== 'object' ||
    data === null ||
    !('schemaVersion' in data) ||
    !Number.isInteger(data.schemaVersion)
  ) {
    return { status: 'storage-error', error: 'invalid-data' }
  }
  if (data.schemaVersion !== 1) return { status: 'storage-error', error: 'unsupported-version' }
  if (
    !('noteId' in data) ||
    data.noteId !== noteId ||
    !('note' in data) ||
    !isNote(data.note) ||
    (noteId !== null && data.note.id !== noteId)
  ) {
    return { status: 'storage-error', error: 'invalid-data' }
  }
  return { status: 'ok', note: data.note }
}

export function writeDraft(noteId: string | null, note: Note): WriteResult {
  if (!isNote(note) || (noteId !== null && note.id !== noteId)) {
    return { status: 'storage-error', error: 'invalid-data' }
  }
  try {
    globalThis.sessionStorage.setItem(
      key(noteId),
      JSON.stringify({ schemaVersion: 1, noteId, note }),
    )
    return { status: 'ok' }
  } catch {
    return { status: 'storage-error', error: 'unavailable' }
  }
}

export function removeDraft(noteId: string | null): WriteResult {
  try {
    globalThis.sessionStorage.removeItem(key(noteId))
    return { status: 'ok' }
  } catch {
    return { status: 'storage-error', error: 'unavailable' }
  }
}
