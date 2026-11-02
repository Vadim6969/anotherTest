import { onScopeDispose, readonly, ref, shallowRef, watch } from 'vue'
import type { useNoteEditor } from '~/composables/useNoteEditor'
import type { StorageError } from '~/types/note'
import { readDraft, removeDraft, writeDraft } from '~/utils/draft-storage'

export function useNoteDraft(noteId: string | null, editor: ReturnType<typeof useNoteEditor>) {
  const initial = readDraft(noteId)
  const pendingDraft = shallowRef(initial.status === 'ok' ? initial.note : null)
  const error = ref<StorageError | null>(initial.status === 'storage-error' ? initial.error : null)
  const finishing = ref(false)
  let blocked = initial.status === 'storage-error'
  let suspended = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function stopTimer(): void {
    clearTimeout(timer)
    timer = undefined
  }

  function remove(): boolean {
    const result = removeDraft(noteId)
    error.value = result.status === 'storage-error' ? result.error : null
    return result.status === 'ok'
  }

  function clear(): boolean {
    stopTimer()
    if (!remove()) return false
    pendingDraft.value = null
    blocked = false
    suspended = true
    return true
  }

  function flush(): void {
    stopTimer()
    if (blocked || suspended || pendingDraft.value || finishing.value) return
    if (!editor.isDirty.value) {
      remove()
      return
    }
    const note = { ...editor.draft, todos: editor.draft.todos.map((todo) => ({ ...todo })) }
    const result = writeDraft(noteId, note)
    error.value = result.status === 'storage-error' ? result.error : null
  }

  function finish(): boolean {
    finishing.value = true
    return clear()
  }

  function restore(): void {
    if (!pendingDraft.value) return
    editor.restoreDraft(pendingDraft.value)
    pendingDraft.value = null
    suspended = false
    flush()
  }

  watch(
    [editor.draft, editor.isDirty],
    () => {
      stopTimer()
      if (blocked || pendingDraft.value || finishing.value) return
      suspended = false
      if (editor.isDirty.value) timer = setTimeout(flush, 700)
      else remove()
    },
    { deep: true, flush: 'sync' },
  )

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') flush()
  }

  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', onVisibilityChange)
  onScopeDispose(() => {
    flush()
    window.removeEventListener('pagehide', flush)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    pendingDraft: readonly(pendingDraft),
    error: readonly(error),
    finishing: readonly(finishing),
    restore,
    clear,
    flush,
    finish,
  }
}
