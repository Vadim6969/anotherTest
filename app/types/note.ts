import type { StorageWriteResult } from './storage'

export interface Todo {
  id: string
  text: string
  completed: boolean
}

export interface Note {
  id: string
  title: string
  todos: Todo[]
  updatedAt: string
}

export interface ReadonlyNote extends Readonly<Omit<Note, 'todos'>> {
  readonly todos: readonly Readonly<Todo>[]
}

export type SaveResult = StorageWriteResult | { status: 'missing' } | { status: 'conflict' }
