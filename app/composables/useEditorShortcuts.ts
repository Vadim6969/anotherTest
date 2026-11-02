import { onMounted, onUnmounted } from 'vue'

export function useEditorShortcuts(undo: () => boolean, redo: () => boolean): void {
  function handleKeydown(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      !(event.ctrlKey || event.metaKey) ||
      (event.code !== 'KeyZ' && event.key.toLowerCase() !== 'z') ||
      document.querySelector('dialog[open]')
    )
      return

    const target = event.target
    const textInput =
      target instanceof HTMLInputElement &&
      ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(target.type)
    if (
      textInput ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    )
      return

    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
