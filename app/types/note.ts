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

export type StorageError = 'invalid-data' | 'unsupported-version' | 'unavailable'

export interface StorageFailure {
  status: 'storage-error'
  error: StorageError
}

export type SaveResult = { status: 'ok' | 'missing' | 'conflict' } | StorageFailure
