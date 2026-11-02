<script setup lang="ts">
useNotesSync()
</script>

<template>
  <a class="skip-link" href="#main-content">К содержимому</a>
  <header class="site-header">
    <div class="site-header__inner">
      <NuxtLink class="brand" to="/"><AppIcon name="note" /> Заметки</NuxtLink>
      <span class="site-header__caption">Место для ваших планов</span>
    </div>
  </header>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
