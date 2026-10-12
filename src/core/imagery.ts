/** Two-point calibration of a top-down photo against the ground plan (pure, tested). */
export interface Calibration {
  cx: number
  cz: number
  widthM: number
  rotY: number
}

export interface CalibrationInput {
  /** image size in pixels */
  w: number
  h: number
  /** two reference points in image pixels (u right, v down) */
  a: { u: number; v: number }
  b: { u: number; v: number }
  /** where those points really are on the ground (x east, z south) */
  A: { x: number; z: number }
  B: { x: number; z: number }
}

/**
 * Overlay convention: the image is a plane centred at (cx,cz); local x runs along image-u, local z along image-v;
 * world = centre + R(rot)·(s·(u − w/2), s·(v − h/2)) with R matching three.js rotation.y: (x,z) → (x·cos + z·sin, −x·sin + z·cos).
 */
export function calibrateOverlay(i: CalibrationInput): Calibration {
  const du = i.b.u - i.a.u, dv = i.b.v - i.a.v
  const dx = i.B.x - i.A.x, dz = i.B.z - i.A.z
  const s = Math.hypot(dx, dz) / Math.hypot(du, dv)
  const rot = -(Math.atan2(dz, dx) - Math.atan2(dv, du))
  const c = Math.cos(rot), sn = Math.sin(rot)
  const lx = s * (i.a.u - i.w / 2), lz = s * (i.a.v - i.h / 2)
  const rx = lx * c + lz * sn, rz = -lx * sn + lz * c
  return { cx: i.A.x - rx, cz: i.A.z - rz, widthM: s * i.w, rotY: rot }
}

export function overlayToWorld(c: Calibration, w: number, h: number, u: number, v: number) {
  const s = c.widthM / w
  const lx = s * (u - w / 2), lz = s * (v - h / 2)
  const cs = Math.cos(c.rotY), sn = Math.sin(c.rotY)
  return { x: c.cx + lx * cs + lz * sn, z: c.cz - lx * sn + lz * cs }
}
