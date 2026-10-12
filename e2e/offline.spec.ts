import { test, expect } from '@playwright/test'
import { boot } from './helpers'

test.setTimeout(180_000)

test('makes no external requests, installs the service worker, and runs fully offline after first load', async ({ page, context }) => {
  const external: string[] = []
  page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== 'http://localhost:4173' && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) external.push(r.url()) })
  await boot(page)
  // wait for the service worker to take control and finish precaching
  await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; return !!reg.active })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller || true)
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 })
  expect(external).toEqual([])
  await context.setOffline(true)
  await page.reload()
  await page.waitForFunction(() => (window as any).__engine && (window as any).__garden, null, { timeout: 60_000 })
  await expect(page.locator('canvas').first()).toBeVisible()
  // the app is functional offline: place an object
  await page.evaluate(() => (window as any).__garden.actions.placeObject('apple', 10, 10))
  const n = await page.evaluate(() => { const s = (window as any).__garden.store.getState(); return Object.keys(s.project.scenarios[s.project.activeScenarioId].objects).length })
  expect(n).toBe(1)
  expect(external).toEqual([])
})
