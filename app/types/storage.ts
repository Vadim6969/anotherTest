export type StorageError = 'invalid-data' | 'unsupported-version' | 'unavailable'

export interface StorageFailure {
  status: 'storage-error'
  error: StorageError
}

export type StorageWriteResult = { status: 'ok' } | StorageFailure
