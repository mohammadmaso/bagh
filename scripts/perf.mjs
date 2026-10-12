// usage: node scripts/perf.mjs [quality] [objects]
import { chromium } from '@playwright/test'
const quality = process.argv[2] ?? 'medium'
const count = Number(process.argv[3] ?? 320)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
const t0 = Date.now()
await page.goto((process.env.URL ?? 'http://localhost:4173/') + `?q=${quality}`)
await page.waitForFunction(() => window.__engine && window.__garden)
const loadMs = Date.now() - t0
const res = await page.evaluate(async (count) => {
  const g = window.__garden, a = g.actions
  const species = ['apple', 'pear', 'cherry', 'plum', 'apricot', 'peach', 'fig', 'pomegranate', 'walnut', 'almond', 'mulberry', 'quince', 'persimmon', 'hazelnut', 'cypress', 'pine']
  const others = ['raised-bed', 'raspberry', 'lavender', 'hive-langstroth', 'chicken-coop', 'bench', 'tank-ibc', 'herb-bed', 'compost-bins', 'greenhouse']
  let i = 0
  const t1 = performance.now()
  g.store.getState().commit((d) => {
    const sc = d.scenarios[d.activeScenarioId]
    for (; i < count; i++) {
      const isTree = i % 3 !== 2
      const type = isTree ? species[i % species.length] : others[i % others.length]
      const x = 1 + ((i * 7.31) % 31), z = 1 + ((i * 3.77) % 28)
      const id = 'perf' + i
      sc.objects[id] = { id, type, x, z, rotY: 0, scale: 1, params: {}, ageOffset: 6 }
      sc.order.push(id)
    }
  })
  g.store.getState().setTime({ ageYears: 8 })
  const buildMs = performance.now() - t1
  await new Promise((r) => setTimeout(r, 4000))
  const e = window.__engine
  e.camera.position.set(-9, 10.5, 42); e.controls.target.set(16.5, 2.2, 15); e.controls.update()
  await new Promise((r) => setTimeout(r, 2500))
  const info = e.renderer.info
  const frames0 = performance.now()
  let n = 0
  await new Promise((resolve) => { const f = () => { n++; if (performance.now() - frames0 > 6000) resolve(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
  const secs = (performance.now() - frames0) / 1000
  return { objects: count, buildMs: Math.round(buildMs), fpsSoftware: +(n / secs).toFixed(2), calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
    sceneObjects: (() => { let c = 0; e.scene.traverse(() => c++); return c })() }
}, count)
console.log(JSON.stringify({ quality, loadMs, ...res }))
await browser.close()
