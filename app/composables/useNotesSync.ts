import { onScopeDispose } from 'vue'
import { useNotesStore } from '~/stores/notes'
import { NOTES_STORAGE_KEY } from '~/utils/notes-storage'

export function useNotesSync(): void {
  const store = useNotesStore()
  function onStorage(event: StorageEvent): void {
    if (
      event.storageArea === globalThis.localStorage &&
      (event.key === NOTES_STORAGE_KEY || event.key === null)
    )
      store.load()
  }
  window.addEventListener('storage', onStorage)
  onScopeDispose(() => window.removeEventListener('storage', onStorage))
}
