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
  // windbreak along the north fence
  for (let i = 0; i < 5; i++) add(mk('cypress', 5 + i * 6, 1.6, { ageOffset: 3 }))
  // sweet cherries + walnut (far from beds)
  add(mk('walnut', 30, 4.5, { ageOffset: 2 }))
  for (const x of [8, 15, 22]) add(mk('cherry', x, 4.5, { ageOffset: 2 }))
  // apple & pear rows along the contour
  for (let i = 0; i < 4; i++) add(mk('apple', 9 + i * 5, 9.2, { ageOffset: 2 }))
  for (let i = 0; i < 3; i++) add(mk('pear', 24 + i * 3.4, 10.5, { ageOffset: 2 }))
  // stone fruit / figs on the warm lower slope
  add(mk('fig', 6, 20.5, { ageOffset: 1 })); add(mk('pomegranate', 3.4, 17.8, { ageOffset: 1 })); add(mk('peach', 22, 20.5, { ageOffset: 1 }))
  // vegetable beds (sunny middle)
  for (const [x, z] of [[8, 14], [8, 16.4], [11.4, 14], [11.4, 16.4]]) add(mk('raised-bed', x, z))
  add(mk('herb-spiral', 21.5, 25.2)); add(mk('greenhouse', 25, 17.2, { params: { length: 4, width: 3 } })); add(mk('cold-frame', 21, 15.2)); add(mk('lavender', 15.2, 20.5, { rotY: 0 }))
  add(mk('raspberry', 3.4, 12.5, { rotY: Math.PI / 2, params: { length: 3, rows: 1 } }))
  add(mk('grape-pergola', 3.6, 25.5, { rotY: 0, params: { width: 3, depth: 3 } }))
  // water & utilities
  add(mk('tank-poly', 12.2, 25.8, { params: { liters: '3000' } })); add(mk('tank-ibc', 12.2, 22.2)); add(mk('well', 28.5, 7.2)); add(mk('compost-bins', 29, 21.2, { rotY: Math.PI / 2 }))
  add(mk('tool-shed', 26.5, 28, { params: { width: 3, depth: 2.4 } }))
  // livestock (downhill of the well, away from beds)
  add(mk('chicken-coop', 29.2, 13.2, { rotY: -Math.PI / 2 }))
  // bees facing SE, with a barrier hedge in front and water close by
  add(mk('hive-langstroth', 30, 25.6, { rotY: Math.PI / 4, params: { boxes: 2 } })); add(mk('hive-langstroth', 30.9, 24.4, { rotY: Math.PI / 4, params: { boxes: 2 } }))
  add(mk('bee-water', 28.2, 24.8)); add(mk('tap', 28, 22.7))
  add({ ...mk('flight-barrier', 0, 0), points: [{ x: 31.9, z: 27 }, { x: 32.2, z: 24 }, { x: 32, z: 22.2 }], params: { height: 2.4, width: 0.6 } })
  // paths
  add({ ...mk('path-gravel', 0, 0), points: [{ x: 0.2, z: 5.5 }, { x: 5, z: 6.6 }, { x: 11, z: 11.5 }, { x: 16, z: 15 }, { x: 16.5, z: 20 }], params: { width: 1.2 } })
  add({ ...mk('path-stone', 0, 0), points: [{ x: 0.2, z: 22.5 }, { x: 5, z: 23 }, { x: 9, z: 26 }, { x: 14.5, z: 29.3 }], params: { width: 1 } })
  // drip line from the tank to the beds
  add({ ...mk('drip-line', 0, 0), points: [{ x: 12.2, z: 24.4 }, { x: 13.6, z: 18.7 }, { x: 9.7, z: 18.4 }, { x: 9.7, z: 14 }], params: { width: 0.03 } })
  // swale on the contour below the beds
  const sw = contourAcross(terrain, 10, 19.4, 0.5).filter((p: Vec2) => p.x > 4 && p.x < 20)
  if (sw.length > 2) add({ ...mk('swale', 0, 0), points: sw, params: { width: 1.0, depth: 0.3 } })
  // scale reference
  add(mk('human', 6.5, 12))
  return out
}
