export default defineNuxtConfig({
  compatibilityDate: '2026-11-02',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  css: ['~/assets/scss/main.scss'],
  typescript: {
    strict: true,
    appTsConfig: {
      include: ['../tests/unit/**/*.ts'],
      compilerOptions: {
        noUnusedLocals: true,
        noUnusedParameters: true,
      },
    },
    nodeTsConfig: {
      include: ['../vitest.config.ts'],
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Заметки',
      meta: [
        {
          name: 'description',
          content: 'Заметки и списки задач в одном месте.',
        },
      ],
    },
  },
})
