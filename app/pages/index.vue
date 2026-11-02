<script setup lang="ts">
import { computed, ref } from 'vue'
import type ConfirmDialog from '~/components/ConfirmDialog.vue'
import { storageErrorMessages } from '~/utils/storage-errors'

const store = useNotesStore()
const confirmation = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const notes = computed(() =>
  [...store.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
)
store.load()
useHead({ title: 'Заметки' })

async function deleteNote(id: string): Promise<void> {
  const confirmed = await confirmation.value?.ask({
    title: 'Удалить заметку?',
    description: 'Заметка и все её задачи будут удалены. Это действие нельзя отменить.',
    confirmLabel: 'Удалить заметку',
    danger: true,
  })
  if (confirmed) store.remove(id)
}
</script>

<template>
  <main id="main-content" class="page">
    <header class="page-heading">
      <div>
        <h1>Мои заметки</h1>
        <p>Планы и задачи — всё под рукой.</p>
      </div>
      <NuxtLink class="button button--primary" to="/notes/new"
        ><AppIcon name="plus" /> Создать заметку</NuxtLink
      >
    </header>
    <div v-if="store.storageError" class="notice notice--error" role="alert">
      <p>{{ storageErrorMessages[store.storageError] }}</p>
      <button class="button button--secondary" type="button" @click="store.load">Повторить</button>
    </div>
    <div v-if="notes.length" class="notes-grid">
      <NoteCard v-for="note in notes" :key="note.id" :note="note" @delete="deleteNote" />
    </div>
    <section v-else-if="!store.storageError" class="empty-state">
      <span class="empty-state__icon"><AppIcon name="note" /></span>
      <h2>Здесь появятся ваши заметки</h2>
      <p>Создайте заметку, добавьте задачи и отмечайте выполненное.</p>
      <NuxtLink class="button button--primary" to="/notes/new"
        ><AppIcon name="plus" /> Создать первую заметку</NuxtLink
      >
    </section>
    <ConfirmDialog ref="confirmation" />
  </main>
</template>

<style scoped lang="scss">
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  gap: 1.25rem;
}
.empty-state {
  margin-top: 2rem;
}
.empty-state__icon {
  display: inline-grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  margin-bottom: 0.5rem;
  border-radius: 1rem;
  background: var(--color-accent-soft);
  color: var(--color-accent);
}
.empty-state__icon .app-icon {
  width: 1.75rem;
  height: 1.75rem;
}
</style>
