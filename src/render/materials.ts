import * as THREE from 'three'
import { makeWoodTexture, makeRoofTexture, makeWireTexture, makeGravelTexture, makeBarkTexture } from './textures'

let cache: ReturnType<typeof create> | null = null

function tiled(t: THREE.Texture, rx: number, ry: number) {
  const c = t.clone()
  c.repeat.set(rx, ry)
  c.needsUpdate = true
  return c
}

function create() {
  const wood = makeWoodTexture(512, [158, 116, 78], 8, 3)
  const woodDark = makeWoodTexture(512, [96, 66, 42], 6, 8)
  const roof = makeRoofTexture(512, [96, 58, 48], 8)
  const wire = makeWireTexture(256)
  const gravel = makeGravelTexture(256)
  const bark = makeBarkTexture(256)
  return {
    wood: new THREE.MeshStandardMaterial({ map: tiled(wood, 1 / 1.2, 1 / 1.2), roughness: 0.82 }),
    woodDark: new THREE.MeshStandardMaterial({ map: tiled(woodDark, 1 / 1.0, 1 / 1.0), roughness: 0.85 }),
    woodPlain: new THREE.MeshStandardMaterial({ color: 0xb08a5e, roughness: 0.8 }),
    roof: new THREE.MeshStandardMaterial({ map: tiled(roof, 1 / 1.1, 1 / 1.1), roughness: 0.45, metalness: 0.55 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.95 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8b867b, roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1d2a33, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.55, envMapIntensity: 1.6, clearcoat: 1 }),
    interior: new THREE.MeshStandardMaterial({ color: 0xcfc4b0, roughness: 0.9, side: THREE.BackSide }),
    galvanised: new THREE.MeshStandardMaterial({ color: 0xa9b0b4, roughness: 0.42, metalness: 0.85 }),
    gateGreen: new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 0.5, metalness: 0.4 }),
    wire: new THREE.MeshStandardMaterial({
      map: tiled(wire, 1 / 0.3, 1 / 0.3), transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.8, depthWrite: false,
    }),
    gravel: new THREE.MeshStandardMaterial({ map: tiled(gravel, 1 / 1.5, 1 / 1.5), roughness: 1 }),
    bark: new THREE.MeshStandardMaterial({ map: tiled(bark, 1, 1), roughness: 0.95 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x35393c, roughness: 0.4, metalness: 0.8 }),
  }
}

export function mats() {
  return (cache ??= create())
}
