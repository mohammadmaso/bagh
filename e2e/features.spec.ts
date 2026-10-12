import { test, expect } from '@playwright/test'
import { boot, objectCount } from './helpers'

test.setTimeout(240_000)

test('real plot loads empty; sanity facts: cabin 5x5, south edge lowest by ~5.3 m, gates on west fence', async ({ page }) => {
  await boot(page)
  expect(await objectCount(page)).toBe(0)
  const f = await page.evaluate(() => {
    const e = (window as any).__engine, s = (window as any).__garden.store.getState().project.site
    return { south: e.terrain.heightAt(10, 30), north: e.terrain.heightAt(10, 0), w: s.width, d: s.depth, house: [s.house.width, s.house.depth, s.house.wallHeight], gates: s.gates.map((g: any) => g.edge) }
  })
  expect(f.south).toBeCloseTo(0, 6)
  expect(f.north).toBeGreaterThan(5.2); expect(f.north).toBeLessThan(5.4)
  expect([f.w, f.d]).toEqual([33, 30]); expect(f.house).toEqual([5, 5, 2.5]); expect(f.gates).toEqual(['west', 'west'])
})

test('date, time, season and tree-age controls change the scene state', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => (window as any).__garden.actions.placeObject('apple', 10, 10))
  const sunBefore = await page.evaluate(() => (window as any).__engine.sky.sun.position.toArray())
  await page.locator('#tb-time').fill('450')
  await page.locator('#tb-age').fill('10')
  await page.getByRole('button', { name: 'Winter', exact: true }).click()
  await page.waitForTimeout(500)
  const st = await page.evaluate(() => (window as any).__garden.store.getState().ui.time)
  expect(st.minutes).toBe(450); expect(st.ageYears).toBe(10); expect(st.seasonMode).toBe('winter')
  const sunAfter = await page.evaluate(() => (window as any).__engine.sky.sun.position.toArray())
  expect(sunAfter).not.toEqual(sunBefore)
  // morning sun is in the east (+x), winter look is bare
  expect(sunAfter[0] - 16.5).toBeGreaterThan(20)
  const leaf = await page.evaluate(() => (window as any).__engine.lookCache.leaf)
  expect(leaf).toBe(0)
})

test('sun-hours analysis runs in the worker and lists beds; rules react to a walnut near a bed', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => { const a = (window as any).__garden.actions; a.placeObject('raised-bed', 12, 12); a.placeObject('walnut', 14, 9) })
  await page.getByRole('tab', { name: 'Analysis' }).click()
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.locator('table.report tbody tr').first()).toBeVisible({ timeout: 120_000 })
  const hours = await page.evaluate(() => (window as any).__garden.analysis.getState().sun.rows[0].values.summer)
  expect(hours).toBeGreaterThan(0)
  await page.getByRole('tab', { name: /Rules/ }).click()
  await expect(page.getByText('Walnut (juglone) near beds')).toBeVisible()
})

test('Persian: RTL layout, Persian labels, Jalali date', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => (window as any).__garden.store.getState().setUI({ tourDone: true }))
  await page.getByRole('button', { name: 'Language' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
  await expect(page.getByRole('tab', { name: 'کتابخانه' })).toBeVisible()
  // sidebar (library) is on the right in RTL
  const lib = await page.locator('aside.side').first().boundingBox()
  expect(lib!.x).toBeGreaterThan(700)
  await expect(page.locator('.timebar')).toContainText('خرداد')
})

test('views: plan, section and walk switch; walking moves the camera and respects the fence', async ({ page }) => {
  await boot(page)
  for (const v of ['plan', 'section', 'persp']) {
    await page.evaluate((v) => (window as any).__garden.store.getState().setUI({ view: v }), v)
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => (window as any).__engine.view)).toBe(v)
  }
  await page.evaluate(() => (window as any).__garden.store.getState().setUI({ view: 'walk' }))
  await page.waitForTimeout(500)
  const p0 = await page.evaluate(() => (window as any).__engine.camera.position.toArray())
  // (software GL renders ~1 fps, so drive the walker deterministically)
  await page.evaluate(() => { const w = (window as any).__engine.walk; w.yaw = -Math.PI / 2; for (let i = 0; i < 30; i++) { (w as any).keys.add('w'); w.update(0.1) } ; (w as any).keys.clear() })
  const p1 = await page.evaluate(() => (window as any).__engine.camera.position.toArray())
  expect(Math.hypot(p1[0] - p0[0], p1[2] - p0[2])).toBeGreaterThan(0.3)
  // eye height 1.7 m above terrain
  const h = await page.evaluate(() => { const e = (window as any).__engine; return e.camera.position.y - e.terrain.heightAt(e.camera.position.x, e.camera.position.z) })
  expect(h).toBeCloseTo(1.7, 2)
  // walk toward the north fence for a long time: stopped by it
  await page.evaluate(() => { const w = (window as any).__engine.walk; w.yaw = 0 })
  await page.evaluate(() => { const w = (window as any).__engine.walk; for (let i = 0; i < 400; i++) { (w as any).keys.add('w'); w.update(0.1) } ; (w as any).keys.clear() })
  const z = await page.evaluate(() => (window as any).__engine.camera.position.z)
  expect(z).toBeGreaterThan(0)
})

test('scenarios: duplicate a plan, edit it independently, compare view mounts', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => { (window as any).__garden.actions.placeObject('apple', 10, 10) })
  await page.getByRole('tab', { name: 'Plans' }).click()
  await page.getByRole('button', { name: 'Duplicate current plan' }).click()
  await page.evaluate(() => (window as any).__garden.actions.placeObject('pear', 20, 20))
  const counts = await page.evaluate(() => { const p = (window as any).__garden.store.getState().project; return p.scenarioOrder.map((id: string) => Object.keys(p.scenarios[id].objects).length) })
  expect(counts).toEqual([1, 2])
  await page.getByRole('button', { name: 'Compare side by side' }).first().click()
  await expect(page.locator('.compare .pane')).toHaveCount(2)
})
