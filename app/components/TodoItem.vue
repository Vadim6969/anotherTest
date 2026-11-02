<script setup lang="ts">
import type { Todo } from '~/types/note'

defineProps<{ todo: Readonly<Todo>; number: number; error?: boolean }>()
const emit = defineEmits<{
  'update:text': [value: string]
  'update:completed': [value: boolean]
  blur: []
  remove: []
}>()

function changeText(event: Event): void {
  emit('update:text', (event.target as HTMLTextAreaElement).value)
}

function changeCompleted(event: Event): void {
  emit('update:completed', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <li class="todo-item" :class="{ 'is-complete': todo.completed }">
    <label class="todo-item__check-target">
      <input
        class="todo-item__checkbox"
        type="checkbox"
        :checked="todo.completed"
        :aria-label="`Отметить задачу ${number} выполненной`"
        @change="changeCompleted"
      />
    </label>
    <div class="todo-item__field">
      <textarea
        :id="`todo-${todo.id}`"
        class="text-input"
        rows="2"
        :value="todo.text"
        :aria-label="`Задача ${number}`"
        :aria-invalid="error || undefined"
        :aria-describedby="error ? `todo-error-${todo.id}` : undefined"
        placeholder="Что нужно сделать?"
        autocomplete="off"
        @input="changeText"
        @blur="$emit('blur')"
      />
      <p v-if="error" :id="`todo-error-${todo.id}`" class="field-error">Введите текст задачи</p>
    </div>
    <button
      class="icon-button icon-button--danger"
      type="button"
      :aria-label="`Удалить задачу ${number}`"
      @click="$emit('remove')"
    >
      <AppIcon name="trash" />
    </button>
  </li>
</template>

<style scoped lang="scss">
.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;

  &__check-target {
    display: grid;
    place-items: center;
    flex: 0 0 2.75rem;
    min-height: 2.75rem;
    cursor: pointer;
    border-radius: 0.5rem;
  }

  &__check-target:hover {
    background: var(--color-accent-soft);
  }

  &__checkbox {
    flex-shrink: 0;
    width: 1.125rem;
    height: 1.125rem;
    margin: 0;
    accent-color: var(--color-accent);
    cursor: pointer;
  }
  &__field {
    flex: 1;
    min-width: 0;
  }
  textarea {
    resize: vertical;
    overflow-wrap: anywhere;
  }
  .icon-button {
    margin-top: 0.125rem;
  }
  &.is-complete .text-input {
    text-decoration: line-through;
    color: var(--color-text-muted);
  }
}
</style>
