import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 1900 } })
const logs = []
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()))
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))
await page.goto((process.env.URL ?? 'http://localhost:5173/') + '?gallery')
await page.waitForFunction(() => window.__galleryDone, null, { timeout: 180000 }).catch(() => logs.push('timeout'))
await page.screenshot({ path: process.argv[2] ?? 'shots/gallery.png', fullPage: false })
await page.evaluate(() => document.querySelector('div').scrollTo(0, 1500))
await page.screenshot({ path: (process.argv[2] ?? 'shots/gallery.png').replace('.png', '2.png') })
console.log(logs.filter((l) => !l.startsWith('debug') && !l.startsWith('info')).slice(0, 20).join('\n'))
await browser.close()
