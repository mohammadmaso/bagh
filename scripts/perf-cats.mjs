import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 800, height: 450 } })
await page.goto((process.env.URL ?? 'http://localhost:4173/') + '?q=low')
await page.waitForFunction(() => window.__engine && window.__garden)
const res = await page.evaluate(async () => {
  const g = window.__garden
  const species = ['apple', 'pear', 'cherry', 'plum', 'apricot', 'peach', 'fig', 'pomegranate', 'walnut', 'almond', 'mulberry', 'quince', 'persimmon', 'hazelnut', 'cypress', 'pine']
  const others = ['raised-bed', 'raspberry', 'lavender', 'hive-langstroth', 'chicken-coop', 'bench', 'tank-ibc', 'herb-bed', 'compost-bins', 'greenhouse']
  g.store.getState().commit((d) => { const sc = d.scenarios[d.activeScenarioId]; for (let i = 0; i < 320; i++) { const type = i % 3 !== 2 ? species[i % species.length] : others[i % others.length]; const id = 'perf' + i; sc.objects[id] = { id, type, x: 1 + ((i * 7.31) % 31), z: 1 + ((i * 3.77) % 28), rotY: 0, scale: 1, params: {}, ageOffset: 6 } ; sc.order.push(id) } })
  g.store.getState().setTime({ ageYears: 8 })
  await new Promise((r) => setTimeout(r, 5000))
  const e = window.__engine
  e.camera.position.set(-9, 10.5, 42); e.controls.target.set(16.5, 2.2, 15); e.controls.update()
  await new Promise((r) => setTimeout(r, 3000))
  const cat = {}; const byType = {}
  const top = {}
  e.scene.traverseVisible((o) => {
    if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite)) return
    let p = o, name = 'scene'
    while (p) { if (p.name) { name = p.name; if (['objects','trees','grass','context','overlay','fence','house','terrain','imagery'].includes(p.name)) break } p = p.parent }
    const arr = Array.isArray(o.material) ? o.material.length : 1
    const inst = o.isInstancedMesh ? (o.count > 0 ? 1 : 0) : 1
    cat[name] = (cat[name] ?? 0) + inst * arr
  })
  for (const [id, en] of Object.entries(window.__objects.entries)) {}; for (const en of window.__objects.entries.values()) { let n = 0; if (en.model) en.model.traverseVisible((o) => { if (o.isMesh) n++ }); byType[en.obj.type] = Math.max(byType[en.obj.type] ?? 0, n) }
  return { byType, cat, calls: e.renderer.info.render.calls, tris: e.renderer.info.render.triangles }
})
console.log(JSON.stringify(res))
await browser.close()
