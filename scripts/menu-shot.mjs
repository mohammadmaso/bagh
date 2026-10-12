import { chromium } from '@playwright/test'
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1400, height: 800 } })
await p.goto('http://localhost:4173/?q=low'); await p.waitForFunction(() => window.__engine)
await p.evaluate(() => window.__garden.store.getState().setUI({ tourDone: true }))
await p.getByRole('button', { name: /File/ }).click(); await p.waitForTimeout(500)
await p.screenshot({ path: 'shots/menu.png', clip: { x: 0, y: 0, width: 700, height: 300 } })
await b.close()
