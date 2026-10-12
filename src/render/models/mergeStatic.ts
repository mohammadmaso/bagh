import * as THREE from 'three'

/**
 * Collapse a built model into one draw call per (material, shadow flags): every plain Mesh child is baked into a merged
 * BufferGeometry in the model's local space. Instanced meshes, LODs, sprites and anything flagged `userData.keepSeparate` stay as-is.
 */
export function mergeStatic(root: THREE.Object3D): THREE.Object3D {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  type Bucket = { mat: THREE.Material; cast: boolean; recv: boolean; depth: THREE.Material | undefined; geos: { g: THREE.BufferGeometry; m: THREE.Matrix4 }[] }
  const buckets = new Map<string, Bucket>()
  const mats = new Map<THREE.Material, number>()
  const matId = (m: THREE.Material) => { let i = mats.get(m); if (i === undefined) { i = mats.size; mats.set(m, i) } return i }
  const keep: THREE.Object3D[] = []
  const merged: THREE.Mesh[] = []
  const toRemove: THREE.Object3D[] = []

  root.traverse((o) => {
    if (o === root) return
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || mesh.userData.keepSeparate || Array.isArray(mesh.material) || !mesh.geometry.getAttribute('position')) return
    if (mesh.userData.seasonal) return // toggled per season by the objects layer
    let p: THREE.Object3D | null = mesh.parent
    while (p && p !== root) { if ((p as THREE.LOD).isLOD || p.userData.keepSeparate) return; p = p.parent }
    const mat = mesh.material as THREE.Material
    const key = `${matId(mat)}|${+mesh.castShadow}|${+mesh.receiveShadow}|${mesh.customDepthMaterial ? matId(mesh.customDepthMaterial) : -1}|${mat.transparent ? mesh.renderOrder : 0}`
    let b = buckets.get(key)
    if (!b) { b = { mat, cast: mesh.castShadow, recv: mesh.receiveShadow, depth: mesh.customDepthMaterial, geos: [] }; buckets.set(key, b) }
    mesh.updateWorldMatrix(true, false)
    b.geos.push({ g: mesh.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld) })
    toRemove.push(mesh)
  })
  if (!toRemove.length) return root

  for (const b of buckets.values()) {
    if (b.geos.length === 0) continue
    let total = 0, idxTotal = 0
    for (const { g } of b.geos) { total += g.getAttribute('position').count; idxTotal += g.index ? g.index.count : g.getAttribute('position').count }
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2)
    const idx = new Uint32Array(idxTotal)
    let vo = 0, io = 0
    const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3()
    for (const { g, m } of b.geos) {
      const p = g.getAttribute('position'), nn = g.getAttribute('normal'), u = g.getAttribute('uv')
      nm.getNormalMatrix(m)
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m)
        pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z
        if (nn) { n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = n.x; nor[(vo + i) * 3 + 1] = n.y; nor[(vo + i) * 3 + 2] = n.z } else { nor[(vo + i) * 3 + 1] = 1 }
        if (u) { uv[(vo + i) * 2] = u.getX(i); uv[(vo + i) * 2 + 1] = u.getY(i) }
      }
      // a mirrored transform flips triangle winding
      const flip = m.determinant() < 0
      const src = g.index
      const cnt = src ? src.count : p.count
      for (let i = 0; i < cnt; i += 3) {
        const a = src ? src.getX(i) : i, c = src ? src.getX(i + 1) : i + 1, d = src ? src.getX(i + 2) : i + 2
        idx[io++] = vo + a; idx[io++] = vo + (flip ? d : c); idx[io++] = vo + (flip ? c : d)
      }
      vo += p.count
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    geo.computeBoundingSphere()
    geo.userData.owned = true
    const mesh = new THREE.Mesh(geo, b.mat)
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv
    if (b.depth) mesh.customDepthMaterial = b.depth
    merged.push(mesh)
  }
  for (const m of toRemove) {
    const mm = m as THREE.Mesh
    if (mm.geometry.userData.owned) mm.geometry.dispose()
    m.parent?.remove(m)
  }
  // drop now-empty groups
  const prune = (o: THREE.Object3D) => { for (const c of [...o.children]) prune(c); if (o !== root && o.children.length === 0 && !(o as THREE.Mesh).isMesh && !(o as THREE.LOD).isLOD && !(o as THREE.Sprite).isSprite) o.parent?.remove(o) }
  prune(root)
  for (const m of merged) root.add(m)
  void keep
  return root
}
