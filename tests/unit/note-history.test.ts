import { describe, expect, it } from 'vitest'
import { createNoteHistory } from '~/utils/note-history'
import { makeNote } from '../helpers/notes'

describe('note history', () => {
  it('undoes and redoes a title change', () => {
    const note = makeNote()
    const history = createNoteHistory(note)
    note.title = 'Выходные'
    history.record({ type: 'set-title', before: 'Покупки', after: 'Выходные' })

    expect(history.canUndo).toBe(true)
    expect(history.undo()).toBe(true)
    expect(note.title).toBe('Покупки')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)
    expect(history.redo()).toBe(true)
    expect(note.title).toBe('Выходные')
    expect(history.canRedo).toBe(false)
  })

  it('keeps text and checkbox changes as separate steps for the correct todo', () => {
    const note = makeNote({
      todos: [
        { id: 'todo-1', text: 'Хлеб', completed: false },
        { id: 'todo-2', text: 'Кофе', completed: false },
      ],
    })
    const history = createNoteHistory(note)
    note.todos[1]!.text = 'Чай'
    history.record({ type: 'set-todo-text', id: 'todo-2', before: 'Кофе', after: 'Чай' })
    note.todos[1]!.completed = true
    history.record({ type: 'set-todo-completed', id: 'todo-2', before: false, after: true })

    history.undo()
    expect(note.todos[1]).toEqual({ id: 'todo-2', text: 'Чай', completed: false })
    history.undo()
    expect(note.todos[1]).toEqual({ id: 'todo-2', text: 'Кофе', completed: false })
    history.redo()
    history.redo()
    expect(note.todos).toEqual([
      { id: 'todo-1', text: 'Хлеб', completed: false },
      { id: 'todo-2', text: 'Чай', completed: true },
    ])
  })

  it('records an already applied insertion and keeps a detached copy for redo', () => {
    const note = makeNote()
    const history = createNoteHistory(note)
    const todo = { id: 'todo-2', text: 'Кофе', completed: false }
    note.todos.splice(0, 0, todo)
    history.record({ type: 'insert-todo', todo, index: 0 })

    expect(note.todos).toHaveLength(2)
    history.undo()
    expect(note.todos.map((item) => item.id)).toEqual(['todo-1'])
    todo.text = 'Изменён внешний объект'
    history.redo()
    expect(note.todos[0]).toEqual({ id: 'todo-2', text: 'Кофе', completed: false })
    expect(note.todos.map((item) => item.id)).toEqual(['todo-2', 'todo-1'])
  })

  it('restores a removed todo at its original position with its original values', () => {
    const note = makeNote({
      todos: [
        { id: 'a', text: 'Первый', completed: false },
        { id: 'b', text: 'Второй', completed: true },
        { id: 'c', text: 'Третий', completed: false },
      ],
    })
    const history = createNoteHistory(note)
    const removed = note.todos.splice(1, 1)[0]!
    history.record({ type: 'remove-todo', todo: removed, index: 1 })
    removed.text = 'Изменён внешний объект'

    history.undo()
    expect(note.todos.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(note.todos[1]).toEqual({ id: 'b', text: 'Второй', completed: true })
    history.redo()
    expect(note.todos.map((item) => item.id)).toEqual(['a', 'c'])
  })

  it('replaces the redo branch with a new change, while ignoring no-op records', () => {
    const note = makeNote()
    const history = createNoteHistory(note)
    note.title = 'Выходные'
    history.record({ type: 'set-title', before: 'Покупки', after: 'Выходные' })
    history.undo()
    history.record({ type: 'set-title', before: 'Покупки', after: 'Покупки' })
    expect(history.canRedo).toBe(true)

    note.title = 'Работа'
    history.record({ type: 'set-title', before: 'Покупки', after: 'Работа' })
    expect(history.redo()).toBe(false)
    history.undo()
    expect(note.title).toBe('Покупки')
    history.redo()
    expect(note.title).toBe('Работа')
  })

  it('discards redo before a pending text edit is recorded', () => {
    const note = makeNote()
    const history = createNoteHistory(note)
    note.title = 'Выходные'
    history.record({ type: 'set-title', before: 'Покупки', after: 'Выходные' })
    history.undo()

    history.discardRedo()

    expect(history.canRedo).toBe(false)
    expect(history.redo()).toBe(false)
    expect(note.title).toBe('Покупки')
  })

  it('keeps only the latest 50 steps and can redo all of them', () => {
    const note = makeNote({ title: '0' })
    const history = createNoteHistory(note)
    for (let step = 1; step <= 51; step++) {
      note.title = String(step)
      history.record({ type: 'set-title', before: String(step - 1), after: String(step) })
    }

    for (let step = 0; step < 50; step++) expect(history.undo()).toBe(true)
    expect(history.undo()).toBe(false)
    expect(note.title).toBe('1')
    for (let step = 0; step < 50; step++) expect(history.redo()).toBe(true)
    expect(history.redo()).toBe(false)
    expect(note.title).toBe('51')
  })

  it('clears both directions without changing the current note', () => {
    const note = makeNote({ title: '0' })
    const history = createNoteHistory(note)
    expect(history.undo()).toBe(false)
    expect(history.redo()).toBe(false)
    note.title = '1'
    history.record({ type: 'set-title', before: '0', after: '1' })
    note.title = '2'
    history.record({ type: 'set-title', before: '1', after: '2' })
    history.undo()

    history.clear()

    expect(note.title).toBe('1')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })
})
