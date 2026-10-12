import * as THREE from 'three'
import { mulberry32 } from '../../core/noise'
import type { LeafKind, PlantSpecies } from '../../data/plants'
import { makeBarkTexture } from '../textures'

/** Leaf-cluster atlases drawn procedurally: colour map (opaque) + alpha mask, so mip-maps have no dark fringes. */
const atlasCache = new Map<string, { map: THREE.CanvasTexture; alpha: THREE.CanvasTexture }>()

function leafPath(ctx: CanvasRenderingContext2D, kind: LeafKind, len: number) {
  ctx.beginPath()
  switch (kind) {
    case 'narrow': ctx.moveTo(0, 0); ctx.bezierCurveTo(len * 0.12, len * 0.25, len * 0.1, len * 0.7, 0, len); ctx.bezierCurveTo(-len * 0.1, len * 0.7, -len * 0.12, len * 0.25, 0, 0); break
    case 'small': ctx.ellipse(0, len * 0.5, len * 0.3, len * 0.5, 0, 0, Math.PI * 2); break
    case 'lobed': {
      const n = 5
      ctx.moveTo(0, 0)
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const a = (-0.5 + t) * 2.4
        const r = len * (0.95 - 0.25 * Math.abs(Math.sin(i * 2.1)))
        ctx.lineTo(Math.sin(a) * r * 0.9, len * 0.15 + Math.cos(a) * r * 0.85 * (0.4 + 0.6 * (1 - Math.abs(a) / 1.3)))
        ctx.lineTo(Math.sin(a + 0.2) * r * 0.45, len * 0.15 + Math.cos(a + 0.2) * r * 0.4)
      }
      ctx.closePath(); break
    }
    case 'needle': ctx.moveTo(-len * 0.018, 0); ctx.lineTo(len * 0.018, 0); ctx.lineTo(0, len); ctx.closePath(); break
    default: ctx.moveTo(0, 0); ctx.bezierCurveTo(len * 0.38, len * 0.25, len * 0.3, len * 0.75, 0, len); ctx.bezierCurveTo(-len * 0.3, len * 0.75, -len * 0.38, len * 0.25, 0, 0)
  }
}

export function getLeafAtlas(kind: LeafKind): { map: THREE.CanvasTexture; alpha: THREE.CanvasTexture } {
  const hit = atlasCache.get(kind)
  if (hit) return hit
  const S = 256
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')!] as const }
  const [cc, cx] = mk(), [ca, ax] = mk()
  cx.fillStyle = 'rgb(150,150,150)'; cx.fillRect(0, 0, S, S)
  ax.fillStyle = '#000'; ax.fillRect(0, 0, S, S)
  const rnd = mulberry32(kind.length * 977 + 3)
  const n = kind === 'needle' ? 70 : kind === 'small' ? 22 : kind === 'lobed' ? 3 : kind === 'compound' ? 11 : kind === 'narrow' ? 9 : 7
  const len = kind === 'needle' ? 105 : kind === 'lobed' ? 120 : kind === 'small' ? 42 : kind === 'compound' ? 60 : kind === 'narrow' ? 100 : 78
  for (let i = 0; i < n; i++) {
    const ang = kind === 'needle' ? (-0.9 + 1.8 * rnd()) + Math.PI : rnd() * Math.PI * 2
    const ox = S / 2 + (rnd() - 0.5) * (kind === 'lobed' ? 20 : 110)
    const oy = S / 2 + (rnd() - 0.5) * (kind === 'lobed' ? 20 : 110)
    const L = len * (0.8 + rnd() * 0.4)
    for (const [ctx, isMask] of [[cx, false], [ax, true]] as const) {
      ctx.save()
      ctx.translate(ox, oy)
      ctx.rotate(ang)
      leafPath(ctx, kind, L)
      if (isMask) { ctx.fillStyle = '#fff'; ctx.fill() } else {
        const g = ctx.createLinearGradient(-L * 0.3, 0, L * 0.3, 0)
        const v = 175 + rnd() * 70
        g.addColorStop(0, `rgb(${v * 0.82},${v * 0.82},${v * 0.82})`); g.addColorStop(0.5, `rgb(${v},${v},${v})`); g.addColorStop(1, `rgb(${v * 0.85},${v * 0.85},${v * 0.85})`)
        ctx.fillStyle = g; ctx.fill()
        if (kind !== 'needle') {
          ctx.strokeStyle = 'rgba(70,70,70,0.55)'; ctx.lineWidth = 1.2
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, L * 0.95); ctx.stroke()
          ctx.lineWidth = 0.7
          for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(0, L * 0.18 * k); ctx.lineTo(L * 0.17, L * (0.18 * k + 0.1)); ctx.moveTo(0, L * 0.18 * k); ctx.lineTo(-L * 0.17, L * (0.18 * k + 0.1)); ctx.stroke() }
        }
      }
      ctx.restore()
    }
  }
  const finish = (c: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t }
  const res = { map: finish(cc, true), alpha: finish(ca, false) }
  atlasCache.set(kind, res)
  return res
}

let blossomTex: { map: THREE.CanvasTexture; alpha: THREE.CanvasTexture } | null = null
function getBlossomAtlas() {
  if (blossomTex) return blossomTex
  const S = 128
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')!] as const }
  const [cc, cx] = mk(), [ca, ax] = mk()
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, S, S); ax.fillStyle = '#000'; ax.fillRect(0, 0, S, S)
  const rnd = mulberry32(5)
  for (let i = 0; i < 9; i++) {
    const x = 20 + rnd() * 88, y = 20 + rnd() * 88
    for (const [ctx, mask] of [[cx, false], [ax, true]] as const) {
      ctx.fillStyle = mask ? '#fff' : `rgb(${235 + rnd() * 20},${225 + rnd() * 25},${225 + rnd() * 25})`
      for (let p = 0; p < 5; p++) {
        ctx.beginPath(); ctx.ellipse(x + Math.cos((p / 5) * 6.283) * 5, y + Math.sin((p / 5) * 6.283) * 5, 5, 3.2, (p / 5) * 6.283, 0, 6.283); ctx.fill()
      }
      if (!mask) { ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.283); ctx.fill() }
    }
  }
  const f = (c: HTMLCanvasElement, s: boolean) => { const t = new THREE.CanvasTexture(c); if (s) t.colorSpace = THREE.SRGBColorSpace; return t }
  return (blossomTex = { map: f(cc, true), alpha: f(ca, false) })
}

export interface SeasonUniforms {
  uTime: { value: number }
  uWind: { value: number }
  uLeafCover: { value: number }
  uAutumnMix: { value: number }
  uBlossom: { value: number }
  uRipe: { value: number }
  uFruitOn: { value: number }
}

export interface PlantMaterialSet {
  bark: THREE.MeshStandardMaterial
  leaf: THREE.MeshStandardMaterial
  leafDepth: THREE.MeshDepthMaterial
  blossom: THREE.MeshStandardMaterial
  blossomDepth: THREE.MeshDepthMaterial
  fruit: THREE.MeshStandardMaterial
  blob: THREE.MeshStandardMaterial
  u: SeasonUniforms
  species: PlantSpecies
}

const WIND_VS = `
attribute float aSway; attribute float aRand;
uniform float uTime; uniform float uWind;
varying float vRand;
`
const WIND_BODY = `
{
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float ph = uTime * 1.7 + wp.x * 0.33 + wp.z * 0.29 + aRand * 6.2831;
  float gust = 0.6 + 0.4 * sin(uTime * 0.37 + wp.x * 0.05);
  transformed += vec3(sin(ph), 0.35 * sin(ph * 1.9 + 1.3), cos(ph * 0.83)) * aSway * uWind * 0.055 * gust;
}
vRand = aRand;
`

function patch(mat: THREE.Material, u: SeasonUniforms, extraUniforms: Record<string, { value: any }>, frag: string, fragHead: string) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, extraUniforms)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + WIND_VS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND_BODY)
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRand;\n' + fragHead)
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n' + frag)
  }
  mat.customProgramCacheKey = () => 'plant-' + (mat as any).name
}

const cache = new Map<string, PlantMaterialSet>()
let barkBase: THREE.Texture | null = null

export function getPlantMaterials(sp: PlantSpecies): PlantMaterialSet {
  const hit = cache.get(sp.id)
  if (hit) return hit
  const u: SeasonUniforms = {
    uTime: { value: 0 }, uWind: { value: 0.6 }, uLeafCover: { value: 1 }, uAutumnMix: { value: 0 }, uBlossom: { value: 0 }, uRipe: { value: 1 }, uFruitOn: { value: 0 },
  }
  const atlas = getLeafAtlas(sp.leaf.kind)
  const leafColor = { value: new THREE.Color(sp.leaf.color) }
  const autumnColor = { value: new THREE.Color(sp.leaf.autumn) }
  const deciduous = { value: sp.deciduous ? 1 : 0 }

  barkBase ??= makeBarkTexture(256, [200, 190, 180])
  const barkMap = barkBase.clone(); barkMap.needsUpdate = true
  const bark = new THREE.MeshStandardMaterial({ map: barkMap, color: new THREE.Color(sp.bark).multiplyScalar(1.15), roughness: 0.95 })

  const leaf = new THREE.MeshStandardMaterial({
    map: atlas.map, alphaMap: atlas.alpha, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.62, metalness: 0, color: 0xffffff,
  })
  leaf.name = 'leaf-' + sp.id
  patch(leaf, u, { uLeaf: leafColor, uAutumn: autumnColor, uDecid: deciduous },
    `
    float cover = uDecid > 0.5 ? uLeafCover : 1.0;
    if (vRand > cover) discard;
    float am = uDecid > 0.5 ? clamp(uAutumnMix * (0.35 + vRand * 1.2), 0.0, 1.0) : 0.0;
    vec3 tint = mix(uLeaf, uAutumn, am);
    tint *= 0.85 + 0.3 * fract(vRand * 7.31);
    diffuseColor.rgb *= tint * 2.1;
    `, 'uniform vec3 uLeaf; uniform vec3 uAutumn; uniform float uDecid; uniform float uLeafCover; uniform float uAutumnMix;')

  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: atlas.alpha, alphaTest: 0.5, side: THREE.DoubleSide })
  leafDepth.name = 'leafdepth-' + sp.id
  patch(leafDepth, u, { uDecid: deciduous }, `if (vRand > (uDecid > 0.5 ? uLeafCover : 1.0)) discard;`, 'uniform float uDecid; uniform float uLeafCover;')

  const b = getBlossomAtlas()
  const blossomColor = { value: new THREE.Color(sp.blossom?.color ?? '#ffffff') }
  const blossom = new THREE.MeshStandardMaterial({ map: b.map, alphaMap: b.alpha, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 })
  blossom.name = 'blossom-' + sp.id
  patch(blossom, u, { uBlossomColor: blossomColor }, `if (vRand > uBlossom) discard; diffuseColor.rgb *= uBlossomColor * 1.15;`, 'uniform vec3 uBlossomColor; uniform float uBlossom;')
  const blossomDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: b.alpha, alphaTest: 0.5, side: THREE.DoubleSide })
  blossomDepth.name = 'blossomdepth-' + sp.id
  patch(blossomDepth, u, {}, `if (vRand > uBlossom) discard;`, 'uniform float uBlossom;')

  const fruitColor = new THREE.Color(sp.fruit?.color ?? '#ff0000')
  const fruit = new THREE.MeshStandardMaterial({ color: fruitColor, roughness: 0.4 })
  fruit.name = 'fruit-' + sp.id
  fruit.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, { uFruitColor: { value: fruitColor } })
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRipe; uniform vec3 uFruitColor;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(vec3(0.28, 0.5, 0.15), uFruitColor, uRipe);')
  }
  const blob = new THREE.MeshStandardMaterial({ color: new THREE.Color(sp.leaf.color).multiplyScalar(0.8), roughness: 0.9 })
  blob.name = 'blob-' + sp.id
  blob.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, { uLeaf: leafColor, uAutumn: autumnColor, uDecid: deciduous })
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLeafCover; uniform float uAutumnMix; uniform vec3 uLeaf; uniform vec3 uAutumn; uniform float uDecid;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n float am = uDecid > 0.5 ? uAutumnMix : 0.0; diffuseColor.rgb = mix(uLeaf, uAutumn, am) * 0.85 * (uDecid > 0.5 ? mix(0.35, 1.0, uLeafCover) : 1.0);')
  }

  const set: PlantMaterialSet = { bark, leaf, leafDepth, blossom, blossomDepth, fruit, blob, u, species: sp }
  cache.set(sp.id, set)
  return set
}

export function forEachPlantMaterial(fn: (m: PlantMaterialSet) => void) { cache.forEach(fn) }
