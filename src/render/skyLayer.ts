import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { horizonElevation } from '../core/sun'
import { smoothstep, lerp } from '../core/noise'
import type { HorizonPoint } from '../core/types'

export interface SkyState {
  azimuthDeg: number
  elevationDeg: number
  dir: [number, number, number]
}

const DAY_FOG = new THREE.Color(0.66, 0.76, 0.88)
const DUSK_FOG = new THREE.Color(0.9, 0.62, 0.45)
const NIGHT_FOG = new THREE.Color(0.02, 0.03, 0.06)

export class SkyLayer {
  readonly group = new THREE.Group()
  readonly sky = new Sky()
  readonly envSky = new Sky()
  readonly sun = new THREE.DirectionalLight(0xffffff, 3)
  readonly hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5b6b3a, 0.6)
  readonly fog = new THREE.FogExp2(0xaabbcc, 0.0011)
  readonly envScene = new THREE.Scene()
  envRT: THREE.WebGLRenderTarget | null = null
  private lastEnvDir = new THREE.Vector3()
  private pmrem: THREE.PMREMGenerator
  shadowCenter = new THREE.Vector3(16.5, 2.5, 15)
  shadowRadius = 34

  constructor(private renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer)
    for (const s of [this.sky, this.envSky]) {
      s.scale.setScalar(4000)
      const u = s.material.uniforms
      u.turbidity.value = 3.2
      u.rayleigh.value = 1.4
      u.mieCoefficient.value = 0.004
      u.mieDirectionalG.value = 0.82
    }
    this.envSky.material.uniforms.showSunDisc.value = 0 // the sun is a real shadow-casting light; keep it out of the IBL
    this.envSky.material.uniforms.mieCoefficient.value = 0.0012
    this.envScene.add(this.envSky)
    this.group.add(this.sky, this.sun, this.sun.target, this.hemi)
    this.sun.castShadow = true
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    this.sun.shadow.radius = 2.5
    this.setShadowMapSize(2048)
  }

  setShadowMapSize(n: number) {
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
    this.sun.shadow.mapSize.set(n, n)
  }

  update(sun: SkyState, horizon: HorizonPoint[], forceEnv = false) {
    const el = sun.elevationDeg
    const d = new THREE.Vector3(...sun.dir)
    const horEl = horizonElevation(horizon, sun.azimuthDeg)
    // direct sun fades as it dips under the (editable) horizon profile
    const visible = smoothstep(horEl - 1.0, horEl + 2.5, el)
    const day = smoothstep(-6, 8, el)
    const elevFactor = smoothstep(0, 25, el)

    this.sky.material.uniforms.sunPosition.value.copy(d)
    this.envSky.material.uniforms.sunPosition.value.copy(d)

    // colour of direct light: warm near horizon
    const warm = 1 - smoothstep(2, 24, el)
    this.sun.color.setRGB(1, lerp(0.97, 0.58, warm), lerp(0.93, 0.32, warm))
    this.sun.intensity = 3.4 * visible * lerp(0.35, 1, elevFactor) * (el > 0 ? 1 : 0)

    // sky light
    this.hemi.intensity = lerp(0.02, 0.14, day)
    this.hemi.color.setRGB(lerp(0.2, 0.62, day), lerp(0.25, 0.78, day), lerp(0.4, 1.0, day))
    this.hemi.groundColor.setRGB(lerp(0.04, 0.34, day), lerp(0.05, 0.38, day), lerp(0.04, 0.2, day))

    // fog / haze
    const fogC = DAY_FOG.clone().lerp(DUSK_FOG, warm * smoothstep(-6, 3, el)).lerp(NIGHT_FOG, 1 - day)
    this.fog.color.copy(fogC)
    this.fog.density = lerp(0.0016, 0.0009, elevFactor)

    // position the shadow camera along the sun direction
    this.sun.position.copy(this.shadowCenter).addScaledVector(d, 220)
    this.sun.target.position.copy(this.shadowCenter)
    const sc = this.sun.shadow.camera
    const R = this.shadowRadius
    sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R
    sc.near = 20; sc.far = 480
    sc.updateProjectionMatrix()
    this.sun.target.updateMatrixWorld()

    // image-based lighting: re-render the sky into a PMREM only when the sun has moved noticeably
    if (forceEnv || this.lastEnvDir.angleTo(d) > 0.012 || !this.envRT) {
      this.lastEnvDir.copy(d)
      const prev = this.envRT
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 6000)
      prev?.dispose()
    }
    return { day, visible, elevFactor }
  }
}
