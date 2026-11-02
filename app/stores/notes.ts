import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Note, ReadonlyNote } from '~/types/note'
import type { StorageError, StorageWriteResult } from '~/types/storage'
import { copyNote } from '~/utils/note'
import { readNotes, writeNotes } from '~/utils/notes-storage'

function prepareNote(note: ReadonlyNote): Note {
  return {
    ...copyNote(note),
    updatedAt: new Date().toISOString(),
  }
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const storageError = ref<StorageError | null>(null)

  function readLatest() {
    const result = readNotes()
    storageError.value = result.status === 'storage-error' ? result.error : null
    return result
  }

  function load(): void {
    const result = readLatest()
    if (result.status === 'ok') notes.value = result.notes
  }

  function persist(next: Note[]): StorageWriteResult {
    const result = writeNotes(next)
    if (result.status === 'ok') {
      notes.value = next
      storageError.value = null
    } else {
      storageError.value = result.error
    }
    return result
  }

  function create(note: ReadonlyNote): StorageWriteResult | { status: 'conflict' } {
    const latest = readLatest()
    if (latest.status === 'storage-error') return latest

    if (latest.notes.some((saved) => saved.id === note.id)) {
      notes.value = latest.notes
      return { status: 'conflict' }
    }

    return persist([...latest.notes, prepareNote(note)])
  }

  function update(note: ReadonlyNote): StorageWriteResult | { status: 'missing' } {
    const latest = readLatest()
    if (latest.status === 'storage-error') return latest

    if (!latest.notes.some((saved) => saved.id === note.id)) {
      notes.value = latest.notes
      return { status: 'missing' }
    }

    const savedNote = prepareNote(note)
    return persist(latest.notes.map((saved) => (saved.id === note.id ? savedNote : saved)))
  }

  function remove(id: string): StorageWriteResult | { status: 'missing' } {
    const latest = readLatest()
    if (latest.status === 'storage-error') return latest

    if (!latest.notes.some((saved) => saved.id === id)) {
      notes.value = latest.notes
      return { status: 'missing' }
    }

    return persist(latest.notes.filter((saved) => saved.id !== id))
  }

  return { notes, storageError, load, create, update, remove }
})
