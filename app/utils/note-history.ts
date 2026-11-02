import type { Note, Todo } from '~/types/note'

const HISTORY_LIMIT = 50

export type TextChange =
  | { type: 'set-title'; before: string; after: string }
  | { type: 'set-todo-text'; id: string; before: string; after: string }

export type NoteChange =
  | TextChange
  | { type: 'set-todo-completed'; id: string; before: boolean; after: boolean }
  | { type: 'insert-todo' | 'remove-todo'; todo: Todo; index: number }

export function createNoteHistory(note: Note, limit = HISTORY_LIMIT) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('History limit must be a positive integer')
  }

  const changes: NoteChange[] = []
  let cursor = 0

  function apply(change: NoteChange, forward: boolean): boolean {
    if (change.type === 'set-title') {
      note.title = forward ? change.after : change.before
      return true
    }

    if (change.type === 'set-todo-text' || change.type === 'set-todo-completed') {
      const todo = note.todos.find((item) => item.id === change.id)
      if (!todo) return false

      if (change.type === 'set-todo-text') {
        todo.text = forward ? change.after : change.before
      } else {
        todo.completed = forward ? change.after : change.before
      }
      return true
    }

    const inserting = (change.type === 'insert-todo') === forward
    const index = note.todos.findIndex((item) => item.id === change.todo.id)
    if (inserting) {
      if (index !== -1) return false
      note.todos.splice(change.index, 0, { ...change.todo })
    } else {
      if (index === -1) return false
      note.todos.splice(index, 1)
    }
    return true
  }

  function discardRedo(): void {
    changes.splice(cursor)
  }

  function record(change: NoteChange): void {
    if ('before' in change && change.before === change.after) return

    discardRedo()
    changes.push('todo' in change ? { ...change, todo: { ...change.todo } } : { ...change })
    if (changes.length > limit) changes.shift()
    cursor = changes.length
  }

  function undo(): boolean {
    const change = changes[cursor - 1]
    if (!change || !apply(change, false)) return false
    cursor--
    return true
  }

  function redo(): boolean {
    const change = changes[cursor]
    if (!change || !apply(change, true)) return false
    cursor++
    return true
  }

  function clear(): void {
    changes.length = 0
    cursor = 0
  }

  return {
    record,
    undo,
    redo,
    clear,
    discardRedo,
    get canUndo() {
      return cursor > 0
    },
    get canRedo() {
      return cursor < changes.length
    },
  }
}
