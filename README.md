# Заметки

SPA на Nuxt 4, Vue, TypeScript и Pinia. Стили написаны на SCSS.

Пока настроена основа проекта. Работа с заметками и списками задач будет добавлена следующими этапами.

## Запуск

Нужен Node.js 24 (не ниже 24.15). При использовании nvm:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Приложение доступно по адресу http://localhost:3000.

## Проверки

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
```

`npm run lint:fix` исправляет доступные ESLint ошибки, `npm run format` форматирует файлы через Prettier. Настройки форматирования находятся в `.prettierrc.json` и `.editorconfig`.

## Тесты

Vitest настроен для файлов `tests/unit/**/*.test.ts`. Тесты истории изменений и стора появятся вместе с соответствующей логикой.

```sh
npm test
npm run test:watch
```

Пока тестовых файлов нет, `npm test` сообщает `No test files found` и завершает работу с кодом 1.

## Сборка

```sh
npm run build
npm run preview
```
