import type { Confirmation } from '~/types/confirmation'

export const DELETE_NOTE_CONFIRMATION: Readonly<Confirmation> = {
  title: 'Удалить заметку?',
  description: 'Заметка и все её задачи будут удалены. Это действие нельзя отменить.',
  confirmLabel: 'Удалить заметку',
  danger: true,
}

export const DISCARD_CHANGES_CONFIRMATION: Readonly<Confirmation> = {
  title: 'Отменить изменения?',
  description: 'Несохранённые изменения будут потеряны.',
  confirmLabel: 'Отменить изменения',
  cancelLabel: 'Продолжить редактирование',
  danger: true,
}
