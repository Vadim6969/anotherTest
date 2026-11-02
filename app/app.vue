<script setup lang="ts">
useNotesSync()

function focusControl(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return
  // Safari does not focus buttons on pointer activation; dialogs need a reliable return target.
  event.target.closest<HTMLElement>('button, a[href]')?.focus({ preventScroll: true })
}
</script>

<template>
  <div @click.capture="focusControl">
    <a class="skip-link" href="#main-content">К содержимому</a>
    <header class="site-header">
      <div class="site-header__inner">
        <NuxtLink class="brand" to="/"><AppIcon name="note" /> Заметки</NuxtLink>
        <span class="site-header__caption">Место для ваших планов</span>
      </div>
    </header>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
