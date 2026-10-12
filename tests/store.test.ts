import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, addObject, updateObjects, deleteObjects, activeScenario } from '../src/store/store'
import { newProject, serializeProject, deserializeProject } from '../src/core/project'

beforeEach(() => useStore.getState().replaceProject(newProject()))

const objs = () => activeScenario(useStore.getState().project).objects

describe('undo/redo', () => {
  it('add, move, delete and undo/redo each step', () => {
    const id = addObject({ type: 'apple', x: 5, z: 5 })
    expect(objs()[id].x).toBe(5)
    updateObjects([id], (o) => { o.x = 9 })
    expect(objs()[id].x).toBe(9)
    deleteObjects([id])
    expect(objs()[id]).toBeUndefined()
    useStore.getState().undo()
    expect(objs()[id].x).toBe(9)
    useStore.getState().undo()
    expect(objs()[id].x).toBe(5)
    useStore.getState().undo()
    expect(objs()[id]).toBeUndefined()
    useStore.getState().redo(); useStore.getState().redo()
    expect(objs()[id].x).toBe(9)
  })
  it('coalesces drag edits into one step', () => {
    const id = addObject({ type: 'apple', x: 0, z: 0 })
    for (let i = 1; i <= 10; i++) updateObjects([id], (o) => { o.x = i }, 'drag:' + id)
    expect(objs()[id].x).toBe(10)
    useStore.getState().undo()
    expect(objs()[id].x).toBe(0)
  })
  it('new edit clears redo stack', () => {
    const id = addObject({ type: 'apple', x: 0, z: 0 })
    useStore.getState().undo()
    addObject({ type: 'pear', x: 1, z: 1 })
    useStore.getState().redo()
    expect(objs()[id]).toBeUndefined()
  })
})

describe('serialization', () => {
  it('round-trips', () => {
    addObject({ type: 'hive-langstroth', x: 3, z: 4, rotY: 1, params: { boxes: 2 } })
    const p = useStore.getState().project
    expect(deserializeProject(serializeProject(p))).toEqual(p)
  })
  it('migrates v0 drafts', () => {
    const p = deserializeProject(JSON.stringify({ schemaVersion: 0, objects: [{ id: 'a', type: 'apple', x: 1, z: 2 }] }))
    expect(Object.keys(p.scenarios[p.activeScenarioId].objects)).toEqual(['a'])
  })
  it('rejects newer schema', () => {
    expect(() => deserializeProject(JSON.stringify({ schemaVersion: 99 }))).toThrow()
  })
})
