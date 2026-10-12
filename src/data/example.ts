import type { PlacedObject } from '../core/project'
import { defaultParams, CATALOG_BY_ID } from './catalog'
import type { Terrain } from '../core/terrain'
import { contourAcross } from '../core/contour'
import type { Vec2 } from '../core/types'

export const EXAMPLE_PLAN_ID = 'plan-example'
export const EXAMPLE_PLAN_NAME = 'Example layout'

let n = 0
const mk = (type: string, x: number, z: number, extra: Partial<PlacedObject> = {}): PlacedObject => ({
  id: `ex-${type}-${++n}`, type, x, z, rotY: 0, scale: 1, params: { ...defaultParams(CATALOG_BY_ID[type]), ...(extra.params ?? {}) }, ageOffset: 0, ...extra, ...(extra.params ? { params: { ...defaultParams(CATALOG_BY_ID[type]), ...extra.params } } : {}),
})

/**
 * A worked layout for the real plot: tall trees and windbreak on the north, a contour-aligned orchard, vegetable beds in the
 * sunny middle, rainwater at the cabin, livestock downhill of the well, and a hive facing south-east behind a flight barrier.
 */
export function buildExample(terrain: Terrain): PlacedObject[] {
  n = 0
  const out: PlacedObject[] = []
  const add = (o: PlacedObject) => out.push(o)
  // windbreak along the north fence (stops short of the walnut)
  for (let i = 0; i < 4; i++) add(mk('cypress', 3 + i * 6, 1.4, { ageOffset: 3 }))
  // tall trees on the north side: sweet cherries and the walnut (far from every bed)
  for (const x of [5.5, 12, 18.5]) add(mk('cherry', x, 6.2, { ageOffset: 2 }))
  add(mk('walnut', 28.8, 5, { ageOffset: 2 }))
  // apple & pear rows along the contour
  for (let i = 0; i < 3; i++) add(mk('apple', 8 + i * 5, 11.6, { ageOffset: 2 }))
  for (let i = 0; i < 2; i++) add(mk('pear', 24.5 + i * 4, 13.8, { ageOffset: 2 }))
  // stone fruit / figs on the warm lower slope
  add(mk('fig', 20.2, 19.6, { ageOffset: 1 })); add(mk('pomegranate', 2.8, 16.4, { ageOffset: 1 })); add(mk('peach', 25, 22, { ageOffset: 1 }))
  // vegetable beds (sunny middle, south of the tall trees)
  for (const [x, z] of [[8, 15.2], [8, 17.6], [11.4, 15.2], [11.4, 17.6]]) add(mk('raised-bed', x, z))
  add(mk('herb-spiral', 7, 22.4)); add(mk('greenhouse', 25.5, 17.5, { params: { length: 4, width: 3 } })); add(mk('cold-frame', 4.8, 19.4)); add(mk('lavender', 15.4, 21.2, { rotY: 0 }))
  add(mk('raspberry', 3.4, 12.2, { rotY: Math.PI / 2, params: { length: 3, rows: 1 } }))
  add(mk('grape-pergola', 3.6, 26, { rotY: 0, params: { width: 3, depth: 3 } }))
  // water & utilities: rainwater at the cabin, well uphill of all livestock and compost
  add(mk('tank-poly', 11.6, 26.4, { params: { liters: '3000' } })); add(mk('tank-ibc', 11.2, 22.8)); add(mk('well', 28.5, 8.6)); add(mk('compost-bins', 31, 21.4, { rotY: Math.PI / 2 }))
  add(mk('tool-shed', 24.5, 28.2, { params: { width: 3, depth: 2.4 } }))
  // livestock downhill of the well, > 3 m from beds
  add(mk('chicken-coop', 26.6, 24.2, { rotY: 0 }))
  // bees facing SE on the east side behind a flight-barrier hedge, water close by
  add(mk('hive-langstroth', 30.2, 17.4, { rotY: Math.PI / 4, params: { boxes: 2 } })); add(mk('hive-langstroth', 31.1, 16.1, { rotY: Math.PI / 4, params: { boxes: 2 } }))
  add(mk('bee-water', 28.8, 18.8)); add(mk('tap', 27.6, 20.4))
  add({ ...mk('flight-barrier', 0, 0), points: [{ x: 32.1, z: 19.2 }, { x: 32.3, z: 17.4 }, { x: 32.2, z: 15.2 }], params: { height: 2.4, width: 0.6 } })
  // paths traverse the slope (≤ 12 % wheelbarrow limit)
  add({ ...mk('path-gravel', 0, 0), points: [{ x: 0.2, z: 5.5 }, { x: 6, z: 8 }, { x: 11, z: 12.2 }, { x: 15, z: 13.6 }, { x: 20, z: 14.4 }], params: { width: 1.2 } })
  add({ ...mk('path-stone', 0, 0), points: [{ x: 0.2, z: 22.5 }, { x: 5, z: 24 }, { x: 9, z: 27 }, { x: 14, z: 29.3 }], params: { width: 1 } })
  // drip line from the tank to the beds
  add({ ...mk('drip-line', 0, 0), points: [{ x: 11.6, z: 24.7 }, { x: 13.5, z: 19.6 }, { x: 9.7, z: 19.4 }, { x: 9.7, z: 15 }], params: { width: 0.03 } })
  // swale on the contour below the beds
  const sw = contourAcross(terrain, 10, 20.2, 0.5).filter((p: Vec2) => p.x > 4 && p.x < 19)
  if (sw.length > 2) add({ ...mk('swale', 0, 0), points: sw, params: { width: 1.0, depth: 0.3 } })
  // scale reference
  add(mk('human', 6.5, 12))
  return out
}
