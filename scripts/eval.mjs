// usage: node scripts/eval.mjs "<js expression using window.__garden / window.__engine>"
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto(process.env.URL ?? 'http://localhost:5173/')
await page.waitForFunction(() => window.__engine && window.__garden)
if (process.env.SETUP) await page.evaluate(`(async()=>{${fs.readFileSync(process.env.SETUP, 'utf8')}})()`)
await page.waitForTimeout(Number(process.env.WAIT ?? 3000))
console.log(JSON.stringify(await page.evaluate(`(async()=>{ return ${process.argv[2]} })()`), null, 1))
await browser.close()
