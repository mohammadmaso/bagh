import * as THREE from 'three'
import type { Terrain } from '../core/terrain'
import { landscapeHeight } from '../core/landscape'
import { makeGrassTexture, makeNoiseTexture } from './textures'

/** Build a coordinate list that is fine inside [a,b] and grows geometrically outside until min/max. */
function axis(min: number, max: number, a: number, b: number, fine: number): number[] {
  const out: number[] = []
  for (let x = a; x < b - 1e-6; x += fine) out.push(x)
  out.push(b)
  let step = fine * 1.5, x = b
  while (x < max) { x += step; out.push(Math.min(x, max)); step = Math.min(step * 1.35, 90) }
  x = a; step = fine * 1.5
  while (x > min) { x -= step; out.unshift(Math.max(x, min)); step = Math.min(step * 1.35, 90) }
  return out
}

function outer(x: number, z: number, site: { width: number; depth: number }) {
  return x < -100 || x > site.width + 100 || z < -100 || z > site.depth + 100
}
function landNormal(t: Terrain, x: number, z: number): [number, number, number] {
  const e = 4
  const dx = landscapeHeight(t, x + e, z) - landscapeHeight(t, x - e, z)
  const dz = landscapeHeight(t, x, z + e) - landscapeHeight(t, x, z - e)
  const nx = -dx / (2 * e), nz = -dz / (2 * e)
  const l = Math.hypot(nx, 1, nz)
  return [nx / l, 1 / l, nz / l]
}

export interface TerrainUniforms {
  uOverlay: { value: THREE.Texture | null }
  uOverlayMix: { value: number }
  uContours: { value: number }
  uPlot: { value: THREE.Vector4 }
  uSnow: { value: number }
  uSeasonTint: { value: THREE.Vector3 } // multiplier (dry/autumn/spring)
}

export class TerrainLayer {
  readonly group = new THREE.Group()
  mesh: THREE.Mesh | null = null
  uniforms: TerrainUniforms
  private material: THREE.MeshStandardMaterial
  private grass: THREE.Texture
  private noise: THREE.Texture
  extent = { minX: -2400, maxX: 2433, minZ: -2400, maxZ: 2430 }

  constructor() {
    this.grass = makeGrassTexture(1024)
    this.noise = makeNoiseTexture(256)
    this.uniforms = {
      uOverlay: { value: null },
      uOverlayMix: { value: 0 },
      uContours: { value: 0 },
      uPlot: { value: new THREE.Vector4(0, 0, 33, 30) },
      uSnow: { value: 0 },
      uSeasonTint: { value: new THREE.Vector3(1, 1, 1) },
    }
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 })
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms, { tGrass: { value: this.grass }, tNoise: { value: this.noise } })
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vWPos;
uniform sampler2D tGrass; uniform sampler2D tNoise;
uniform sampler2D uOverlay; uniform float uOverlayMix; uniform float uContours;
uniform vec4 uPlot; uniform float uSnow; uniform vec3 uSeasonTint;`)
        .replace('#include <map_fragment>', `
vec2 wuv = vWPos.xz;
float lowN = texture2D(tNoise, wuv * 0.011).g;
float midN = texture2D(tNoise, wuv * 0.043 + 0.37).g;
float fineN = texture2D(tNoise, wuv * 0.31).b;
// two grass samples at different scale/rotation to hide tiling
vec2 uvA = wuv / 2.4;
vec2 uvB = mat2(0.8, -0.6, 0.6, 0.8) * wuv / 5.7 + 0.31;
vec3 gA = texture2D(tGrass, uvA).rgb;
vec3 gB = texture2D(tGrass, uvB).rgb;
vec3 g = mix(gA, gB, smoothstep(0.3, 0.7, lowN)) * (0.85 + 0.35 * midN);
g = mix(g, g * vec3(1.18, 1.05, 0.62), smoothstep(0.62, 0.9, lowN) * 0.5); // dry patches
g *= 0.92 + 0.16 * fineN;
// outside the plot: taller, drier meadow & scrub
vec2 q = vec2(max(max(uPlot.x - vWPos.x, vWPos.x - uPlot.z), 0.0), max(max(uPlot.y - vWPos.z, vWPos.z - uPlot.w), 0.0));
float outside = smoothstep(0.0, 3.0, length(q));
vec3 wild = g * vec3(1.05, 0.95, 0.6) * (0.75 + 0.5 * midN);
g = mix(g, wild, outside * 0.85);
// far hillsides darken & get forest-ish
float far = smoothstep(40.0, 260.0, length(q));
g = mix(g, vec3(0.10, 0.17, 0.07) * (0.7 + 0.6 * lowN), far * 0.75);
g *= uSeasonTint;
g = mix(g, vec3(0.9, 0.93, 0.98), uSnow * smoothstep(0.1, 0.5, lowN + 0.4));
diffuseColor.rgb *= g;
if (uOverlayMix > 0.0) {
  vec2 ouv = (vWPos.xz - uPlot.xy) / (uPlot.zw - uPlot.xy);
  if (ouv.x >= 0.0 && ouv.x <= 1.0 && ouv.y >= 0.0 && ouv.y <= 1.0) {
    vec4 o = texture2D(uOverlay, ouv);
    diffuseColor.rgb = mix(diffuseColor.rgb, o.rgb, o.a * uOverlayMix);
  }
}
if (uContours > 0.5) {
  float h = vWPos.y / 0.5;
  float w = fwidth(h) * 1.2;
  float line = 1.0 - smoothstep(0.0, w, abs(fract(h - 0.5) - 0.5));
  float major = 1.0 - smoothstep(0.0, w, abs(fract(h / 2.0 - 0.5) - 0.5) * 2.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.05, 0.0), max(line * 0.55, major * 0.9) * (1.0 - far));
}
`)
    }
    this.material = m
  }

  rebuild(terrain: Terrain) {
    const { site } = terrain
    const e = this.extent
    const xs = axis(e.minX, e.maxX, 0, site.width, 0.5)
    const zs = axis(e.minZ, e.maxZ, 0, site.depth, 0.5)
    const nx = xs.length, nz = zs.length
    const pos = new Float32Array(nx * nz * 3)
    const nor = new Float32Array(nx * nz * 3)
    const uv = new Float32Array(nx * nz * 2)
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      const x = xs[i], z = zs[j]
      pos[k * 3] = x; pos[k * 3 + 1] = landscapeHeight(terrain, x, z); pos[k * 3 + 2] = z
      const n = outer(x, z, site) ? landNormal(terrain, x, z) : terrain.normalAt(x, z)
      nor[k * 3] = n[0]; nor[k * 3 + 1] = n[1]; nor[k * 3 + 2] = n[2]
      uv[k * 2] = x; uv[k * 2 + 1] = z
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6)
    let p = 0
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
      idx[p++] = a; idx[p++] = c; idx[p++] = b
      idx[p++] = b; idx[p++] = c; idx[p++] = d
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.geometry = g } else {
      this.mesh = new THREE.Mesh(g, this.material)
      this.mesh.receiveShadow = true
      this.mesh.name = 'terrain'
      this.group.add(this.mesh)
    }
    this.uniforms.uPlot.value.set(0, 0, site.width, site.depth)
  }
}
