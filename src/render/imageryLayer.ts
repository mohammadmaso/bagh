import * as THREE from 'three'
import type { EngineContext, EngineLayer } from './engine'
import type { ReferenceImage } from '../core/project'

const loader = new THREE.TextureLoader()
const texCache = new Map<string, { tex: THREE.Texture; w: number; h: number }>()
function tex(img: ReferenceImage): { tex: THREE.Texture; w: number; h: number } | null {
  const key = img.id + ':' + img.dataUrl.length
  const hit = texCache.get(key)
  if (hit) return hit
  const t = loader.load(img.dataUrl, (tx) => { const im = tx.image as HTMLImageElement; entry.w = im.width; entry.h = im.height; layerDirty = true })
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  const entry = { tex: t, w: 0, h: 0 }
  texCache.set(key, entry)
  return entry
}
let layerDirty = false

/** Draws reference imagery: ground overlays (draped), pinned photo markers, and an optional 360° sky photo. */
export class ImageryLayer implements EngineLayer {
  readonly group = new THREE.Group()
  private lastKey = ''
  private skyTex: THREE.Texture | null = null
  private skyKey = ''
  onSkyChange?: (tex: THREE.Texture | null) => void

  sync(ctx: EngineContext) {
    const imgs = ctx.project.images
    const key = imgs.map((i) => `${i.id}${i.dataUrl.length}${i.opacity}${i.cx}${i.cz}${i.widthM}${i.rotY}${i.visible}${i.kind}`).join('|') + ctx.terrainRev
    if (key === this.lastKey && !layerDirty) return
    layerDirty = false
    this.lastKey = key
    this.group.traverse((o: any) => { o.geometry?.dispose?.() })
    this.group.clear()
    const t = ctx.terrain
    for (const im of imgs) {
      if (!im.visible) continue
      if (im.kind === 'overlay') {
        const e = tex(im)
        if (!e || !e.w) continue
        const W = im.widthM, H = (im.widthM * e.h) / e.w
        const nx = Math.max(2, Math.ceil(W / 1.0)), nz = Math.max(2, Math.ceil(H / 1.0))
        const pos: number[] = [], uv: number[] = [], idx: number[] = []
        const c = Math.cos(im.rotY), s = Math.sin(im.rotY)
        for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
          const lx = (i / nx - 0.5) * W, lz = (j / nz - 0.5) * H
          const x = im.cx + lx * c + lz * s, z = im.cz - lx * s + lz * c
          pos.push(x, t.heightAt(x, z) + 0.06, z)
          uv.push(i / nx, 1 - j / nz)
        }
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, f = d + 1; idx.push(a, b, d, b, f, d) }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: e.tex, transparent: true, opacity: im.opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false, side: THREE.DoubleSide }))
        m.renderOrder = 5
        m.name = 'overlay-' + im.id
        this.group.add(m)
      } else if (im.kind === 'pin') {
        const y = t.heightAt(im.cx, im.cz)
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }))
        pole.position.set(im.cx, y + 1, im.cz)
        const e = tex(im)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: e?.tex ?? null, depthTest: false, toneMapped: false }))
        sprite.scale.set(1.2, 0.9, 1)
        sprite.position.set(im.cx, y + 2.5, im.cz)
        sprite.renderOrder = 40
        sprite.userData.imageId = im.id
        const border = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, depthTest: false, toneMapped: false }))
        border.scale.set(1.28, 0.98, 1); border.position.copy(sprite.position); border.renderOrder = 39
        this.group.add(pole, border, sprite)
      }
    }
    // 360 sky photo
    const sky = imgs.find((i) => i.kind === 'sky' && i.visible)
    const sk = sky ? sky.id + sky.dataUrl.length : ''
    if (sk !== this.skyKey) {
      this.skyKey = sk
      this.skyTex?.dispose()
      this.skyTex = null
      if (sky) {
        this.skyTex = loader.load(sky.dataUrl, () => { layerDirty = true })
        this.skyTex.mapping = THREE.EquirectangularReflectionMapping
        this.skyTex.colorSpace = THREE.SRGBColorSpace
      }
      this.onSkyChange?.(this.skyTex)
    }
  }
}
