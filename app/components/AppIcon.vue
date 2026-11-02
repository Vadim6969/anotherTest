<script setup lang="ts">
defineProps<{ name: 'note' | 'plus' | 'back' | 'undo' | 'redo' | 'trash' | 'check' }>()

const paths = {
  note: 'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3M8 2h8v4H8zM7 11h10M7 16h7',
  plus: 'M12 5v14M5 12h14',
  back: 'M19 12H5m6-6-6 6 6 6',
  undo: 'm9 4-5 5 5 5M4 9h9a6 6 0 0 1 0 12',
  redo: 'm15 4 5 5-5 5m5-5h-9a6 6 0 0 0 0 12',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  check: 'm5 12 4 4L19 6',
}
</script>

<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>
