// usage: node scripts/scenes.mjs [setName]  -> shots/<name>.png for a set of time/season configs
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const set = process.argv[2] ?? 'times'
const URL = (process.env.URL ?? 'http://localhost:5173/') + '?q=medium'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } })
const logs = []
page.on('console', (m) => { if (!['debug', 'info', 'log'].includes(m.type())) logs.push(m.type() + ': ' + m.text()) })
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))
await page.goto(URL)
await page.waitForFunction(() => window.__engine && window.__garden); await page.evaluate(() => window.__garden.store.getState().setUI({ tourDone: true }))
const setup = fs.readFileSync('scripts/scene-setup.js', 'utf8')
await page.evaluate(`(async()=>{${setup}})()`)
await page.waitForTimeout(1500)
const configs = {
  times: [
    ['morning', { month: 6, day: 21, minutes: 7 * 60 + 30, ageYears: 8 }],
    ['noon', { month: 6, day: 21, minutes: 12 * 60 + 30, ageYears: 8 }],
    ['evening', { month: 6, day: 21, minutes: 18 * 60 + 40, ageYears: 8 }],
  ],
  seasons: [
    ['spring', { month: 4, day: 8, minutes: 11 * 60, ageYears: 8 }],
    ['winter', { month: 1, day: 10, minutes: 12 * 60, ageYears: 8 }],
    ['autumn', { month: 10, day: 25, minutes: 14 * 60, ageYears: 8 }],
    ['snow', { month: 1, day: 10, minutes: 12 * 60, ageYears: 8, snow: true }],
  ],
  ages: [['age0', { month: 6, day: 21, minutes: 12 * 60, ageYears: 0 }], ['age3', { month: 6, day: 21, minutes: 12 * 60, ageYears: 3 }], ['age15', { month: 6, day: 21, minutes: 12 * 60, ageYears: 15 }]],
}[set]
for (const [name, t] of configs) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue
  await page.evaluate((t) => window.__garden.store.getState().setTime(t), t)
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `shots/${set}_${name}.png` })
}
console.log(logs.slice(0, 20).join('\n'))
await browser.close()
