import { chromium } from '@playwright/test'
import fs from 'node:fs'
const svg = fs.readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
fs.mkdirSync('public/icons', { recursive: true })
for (const s of [192, 512]) {
  await page.setViewportSize({ width: s, height: s })
  await page.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`)
  await page.screenshot({ path: `public/icons/icon-${s}.png`, omitBackground: true })
}
// maskable: pad the artwork inside the safe zone on a solid background
await page.setViewportSize({ width: 512, height: 512 })
await page.setContent(`<body style="margin:0;background:#2f4a33;display:grid;place-items:center;height:512px">${svg.replace('<svg ', '<svg width="360" height="360" ')}</body>`)
await page.screenshot({ path: 'public/icons/maskable-512.png' })
await browser.close()
