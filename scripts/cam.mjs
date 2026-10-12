// usage: node scripts/cam.mjs out.png px py pz tx ty tz [quality] [extra-js]
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const [, , out, px, py, pz, tx, ty, tz, quality = 'medium', extra = ''] = process.argv
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } })
const logs = []
page.on('console', (m) => { if (!['debug', 'info', 'log'].includes(m.type())) logs.push(m.type() + ': ' + m.text()) })
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))
await page.goto((process.env.URL ?? 'http://localhost:5173/') + '?q=medium')
await page.waitForFunction(() => window.__engine && window.__garden); await page.evaluate(() => window.__garden.store.getState().setUI({ tourDone: true }))
await page.evaluate(`(async()=>{${fs.readFileSync('scripts/scene-setup.js', 'utf8')}})()`)
await page.evaluate(`(async()=>{ const g=window.__garden; g.store.getState().setUI({quality:'${quality}', qualityAuto:false}); g.store.getState().setTime({ageYears:8, month:6, day:21, minutes:12*60+30}); const e=window.__engine; e.camera.position.set(${px},${py},${pz}); e.controls.target.set(${tx},${ty},${tz}); e.controls.update(); ${extra} })()`)
await page.waitForTimeout(Number(process.env.WAIT ?? 6000))
await page.screenshot({ path: out })
console.log(logs.slice(0, 20).join('\n'))
await browser.close()
