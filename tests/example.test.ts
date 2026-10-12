import { describe, it, expect } from 'vitest'
import { buildExample } from '../src/data/example'
import { createTerrain } from '../src/core/terrain'
import { DEFAULT_SITE } from '../src/data/site'
import { evaluateRules } from '../src/core/rules'
import { computeCollisions } from '../src/core/collision'
import { CATALOG_BY_ID } from '../src/data/catalog'

describe('built-in example layout', () => {
  const terrain = createTerrain(DEFAULT_SITE)
  const objs = buildExample(terrain)
  it('only uses known catalog items and unique ids', () => {
    for (const o of objs) expect(CATALOG_BY_ID[o.type], o.type).toBeTruthy()
    expect(new Set(objs.map((o) => o.id)).size).toBe(objs.length)
    expect(objs.length).toBeGreaterThan(40)
  })
  it('has no collisions and passes the layout rules (errors and warnings)', () => {
    const col = computeCollisions(objs, DEFAULT_SITE)
    expect(col.map((c) => `${c.id}~${c.with}`)).toEqual([])
    const v = evaluateRules({ site: DEFAULT_SITE, terrain, objects: objs })
    expect(v.filter((x) => x.severity !== 'info').map((x) => `${x.ruleId}:${x.objectIds.join('+')}`)).toEqual([])
  })
})
