import * as THREE from 'three'

export interface GeoBuf {
  pos: number[]
  nor: number[]
  uv: number[]
  idx: number[]
  /** optional per-vertex attributes (leaf cards) */
  rand?: number[]
  sway?: number[]
}

export const newBuf = (extra = false): GeoBuf => ({ pos: [], nor: [], uv: [], idx: [], ...(extra ? { rand: [], sway: [] } : {}) })

export function toGeometry(b: GeoBuf): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2))
  if (b.rand) g.setAttribute('aRand', new THREE.Float32BufferAttribute(b.rand, 1))
  if (b.sway) g.setAttribute('aSway', new THREE.Float32BufferAttribute(b.sway, 1))
  g.setIndex(b.idx)
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _bn = new THREE.Vector3()

/** Append a tapered tube along `pts` (radius per point). Uses parallel-transport frames. */
export function appendTube(buf: GeoBuf, pts: THREE.Vector3[], radii: number[], seg: number, vScale = 1, cap = false) {
  if (pts.length < 2) return
  const base = buf.pos.length / 3
  _t.subVectors(pts[1], pts[0]).normalize()
  _n.set(Math.abs(_t.y) < 0.9 ? 0 : 1, Math.abs(_t.y) < 0.9 ? 1 : 0, 0).cross(_t).normalize()
  let dist = 0
  for (let i = 0; i < pts.length; i++) {
    const t = i === 0 ? _t.subVectors(pts[1], pts[0]) : i === pts.length - 1 ? _t.subVectors(pts[i], pts[i - 1]) : _t.subVectors(pts[i + 1], pts[i - 1])
    t.normalize()
    // transport normal
    _n.sub(_a.copy(t).multiplyScalar(_n.dot(t))).normalize()
    _bn.crossVectors(t, _n)
    if (i > 0) dist += pts[i].distanceTo(pts[i - 1])
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2
      const c = Math.cos(a), sn = Math.sin(a)
      _b.copy(_n).multiplyScalar(c).addScaledVector(_bn, sn)
      buf.pos.push(pts[i].x + _b.x * radii[i], pts[i].y + _b.y * radii[i], pts[i].z + _b.z * radii[i])
      buf.nor.push(_b.x, _b.y, _b.z)
      buf.uv.push(s / seg, dist * vScale)
    }
  }
  const row = seg + 1
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < seg; s++) {
    const a = base + i * row + s, b = a + row
    buf.idx.push(a, b, a + 1, a + 1, b, b + 1)
  }
  if (cap) {
    const c = buf.pos.length / 3
    const last = pts[pts.length - 1]
    buf.pos.push(last.x, last.y, last.z)
    _t.subVectors(pts[pts.length - 1], pts[pts.length - 2]).normalize()
    buf.nor.push(_t.x, _t.y, _t.z)
    buf.uv.push(0.5, dist * vScale)
    const r0 = base + (pts.length - 1) * row
    for (let s = 0; s < seg; s++) buf.idx.push(r0 + s, c, r0 + s + 1)
  }
}

export function appendQuad(buf: GeoBuf, centre: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, normal: THREE.Vector3, rand: number, sway: number, uvRect: [number, number, number, number] = [0, 0, 1, 1]) {
  const b = buf.pos.length / 3
  const [u0, v0, u1, v1] = uvRect
  const c = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]]
  for (const [sx, sy, u, v] of c) {
    buf.pos.push(centre.x + right.x * sx + up.x * sy, centre.y + right.y * sx + up.y * sy, centre.z + right.z * sx + up.z * sy)
    buf.nor.push(normal.x, normal.y, normal.z)
    buf.uv.push(u, v)
    buf.rand?.push(rand)
    buf.sway?.push(sway)
  }
  // keep the geometric front face on the side the supplied normal points to (matters for lighting of double-sided cards)
  const gx = right.y * up.z - right.z * up.y, gy = right.z * up.x - right.x * up.z, gz = right.x * up.y - right.y * up.x
  if (gx * normal.x + gy * normal.y + gz * normal.z >= 0) buf.idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  else buf.idx.push(b, b + 2, b + 1, b, b + 3, b + 2)
}

export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const buf = newBuf()
  for (const g of geos) {
    const base = buf.pos.length / 3
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = g.getAttribute('uv')
    for (let i = 0; i < p.count; i++) {
      buf.pos.push(p.getX(i), p.getY(i), p.getZ(i))
      buf.nor.push(n.getX(i), n.getY(i), n.getZ(i))
      buf.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0)
    }
    const idx = g.getIndex()
    if (idx) for (let i = 0; i < idx.count; i++) buf.idx.push(base + idx.getX(i))
    else for (let i = 0; i < p.count; i++) buf.idx.push(base + i)
  }
  return toGeometry(buf)
}
