// usage: node scripts/shot.mjs out.png [js-to-eval-before-shot] [viewportWxH]
import { chromium } from '@playwright/test'
const [, , out = 'shots/a.png', js = '', vp = '1400x860'] = process.argv
const [w, h] = vp.split('x').map(Number)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: w, height: h } })
const logs = []
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()))
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))
await page.goto(process.env.URL ?? 'http://localhost:4173/')
await page.waitForSelector('canvas')
await page.waitForTimeout(2500)
if (js) { await page.evaluate(js); await page.waitForTimeout(2500) }
await page.screenshot({ path: out })
console.log(logs.filter((l) => !l.startsWith('log')).slice(0, 15).join('\n'))
await browser.close()
