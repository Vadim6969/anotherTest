<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Note, StorageError } from '~/types/note'
import { storageErrorMessages } from '~/utils/storage-errors'
import { readDraft } from '~/utils/draft-storage'

definePageMeta({ key: (route) => route.path })
const route = useRoute()
const store = useNotesStore()
const isNew = route.params.id === 'new'
const noteId = isNew ? null : String(route.params.id)
const initialNote = shallowRef<Note>()
const loadError = ref<StorageError | null>(null)
const draftResult = readDraft(noteId)
const hasDraft = draftResult.status === 'ok' && draftResult.note !== null

function loadNote(): void {
  store.load()
  loadError.value = store.storageError
  initialNote.value = store.notes.find((note) => note.id === route.params.id)
}

loadNote()
useHead({ title: 'Редактор — Заметки' })
</script>

<template>
  <main v-if="loadError" id="main-content" class="page" tabindex="-1">
    <NuxtLink class="back-link" to="/"><AppIcon name="back" /> Все заметки</NuxtLink>
    <section class="empty-state">
      <h1>Не удалось открыть заметку</h1>
      <p role="alert">{{ storageErrorMessages[loadError] }}</p>
      <button class="button button--primary" type="button" @click="loadNote">Повторить</button>
    </section>
  </main>
  <NoteEditor v-else-if="isNew || initialNote || hasDraft" :note="initialNote" :note-id="noteId" />
  <main v-else id="main-content" class="page" tabindex="-1">
    <NuxtLink class="back-link" to="/"><AppIcon name="back" /> Все заметки</NuxtLink>
    <section class="empty-state">
      <h1>Заметка не найдена</h1>
      <p>Возможно, она была удалена или в ссылке есть ошибка.</p>
      <NuxtLink class="button button--primary" to="/">К списку заметок</NuxtLink>
    </section>
  </main>
</template>
