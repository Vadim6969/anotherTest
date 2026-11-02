import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Note, SaveResult, StorageError } from '~/types/note'
import { readNotes, writeNotes } from '~/utils/notes-storage'

function prepareNote(note: Note): Note {
  return {
    id: note.id,
    title: note.title,
    todos: note.todos.map((todo) => ({ ...todo })),
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

  function persist(next: Note[]): SaveResult {
    const result = writeNotes(next)
    if (result.status === 'ok') {
      notes.value = next
      storageError.value = null
    } else {
      storageError.value = result.error
    }
    return result
  }

  function create(note: Note): SaveResult {
    const latest = readLatest()
    if (latest.status === 'storage-error') return latest

    if (latest.notes.some((saved) => saved.id === note.id)) {
      notes.value = latest.notes
      return { status: 'conflict' }
    }

    return persist([...latest.notes, prepareNote(note)])
  }

  function update(note: Note): SaveResult {
    const latest = readLatest()
    if (latest.status === 'storage-error') return latest

    if (!latest.notes.some((saved) => saved.id === note.id)) {
      notes.value = latest.notes
      return { status: 'missing' }
    }

    const savedNote = prepareNote(note)
    return persist(latest.notes.map((saved) => (saved.id === note.id ? savedNote : saved)))
  }

  function remove(id: string): SaveResult {
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
