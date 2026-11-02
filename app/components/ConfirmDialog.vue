<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, useId } from 'vue'

interface Confirmation {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  focusConfirm?: boolean
}

const dialog = ref<HTMLDialogElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
const options = shallowRef<Confirmation>({
  title: '',
  description: '',
  confirmLabel: 'Подтвердить',
})
const titleId = useId()
const descriptionId = useId()
let resolvePending: ((answer: boolean | null) => void) | null = null
let previousFocus: HTMLElement | null = null

function finish(answer: boolean | null): void {
  if (!resolvePending) return
  const resolve = resolvePending
  resolvePending = null
  dialog.value?.close()
  if (previousFocus?.isConnected) previousFocus.focus()
  resolve(answer)
}

function ask(confirmation: Confirmation): Promise<boolean | null> {
  if (resolvePending || !dialog.value) return Promise.resolve(null)
  options.value = confirmation
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null

  return new Promise((resolve) => {
    resolvePending = resolve
    void nextTick(() => {
      if (!resolvePending) return
      if (!dialog.value) return finish(null)
      dialog.value.showModal()
      if (options.value.focusConfirm) confirmButton.value?.focus()
      else cancelButton.value?.focus()
    })
  })
}

function trapFocus(event: KeyboardEvent): void {
  if (event.shiftKey && document.activeElement === cancelButton.value) {
    event.preventDefault()
    confirmButton.value?.focus()
  } else if (!event.shiftKey && document.activeElement === confirmButton.value) {
    event.preventDefault()
    cancelButton.value?.focus()
  }
}

onBeforeUnmount(() => finish(null))
defineExpose({ ask })
</script>

<template>
  <dialog
    ref="dialog"
    class="confirm-dialog"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
    @cancel.prevent="finish(null)"
    @close="finish(null)"
    @keydown.tab="trapFocus"
  >
    <h2 :id="titleId">{{ options.title }}</h2>
    <p :id="descriptionId">{{ options.description }}</p>
    <div class="confirm-dialog__actions">
      <button
        ref="cancelButton"
        class="button button--secondary"
        type="button"
        @click="finish(false)"
      >
        {{ options.cancelLabel || 'Отмена' }}
      </button>
      <button
        ref="confirmButton"
        class="button"
        :class="options.danger ? 'button--danger' : 'button--primary'"
        type="button"
        @click="finish(true)"
      >
        {{ options.confirmLabel }}
      </button>
    </div>
  </dialog>
</template>

<style scoped lang="scss">
.confirm-dialog {
  width: min(28rem, calc(100% - 2rem));
  max-height: calc(100dvh - 2rem);
  padding: 1.75rem;
  overflow-wrap: anywhere;
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 1.5rem 4rem #142d2526;

  &::backdrop {
    background: #17282166;
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: 1.375rem;
  }

  p {
    margin: 0;
    color: var(--color-text-muted);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.75rem;
  }
}
</style>
