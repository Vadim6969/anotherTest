<template>
  <main class="notes-page">
    <h1>Заметки</h1>
    <p>Заметки и списки задач — в одном месте.</p>
  </main>
</template>

<style scoped lang="scss">
.notes-page {
  width: min(100%, 64rem);
  margin-inline: auto;
  padding: clamp(1.5rem, 5vw, 4rem) 1.5rem;

  h1 {
    margin: 0 0 0.75rem;
    font-size: clamp(2rem, 5vw, 3rem);
    line-height: 1.2;
  }

  p {
    margin: 0;
    color: var(--color-text-muted);
  }
}
</style>
