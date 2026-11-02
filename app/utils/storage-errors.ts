import type { StorageError } from '~/types/storage'

export const storageErrorMessages: Readonly<Record<StorageError, string>> = {
  'invalid-data':
    'Не удалось прочитать сохранённые заметки: данные повреждены. Они остались без изменений.',
  'unsupported-version':
    'Эти заметки сохранены в другой версии приложения. Данные остались без изменений.',
  unavailable:
    'Не удалось обратиться к хранилищу браузера. Проверьте, разрешено ли сохранение данных и достаточно ли свободного места.',
}
