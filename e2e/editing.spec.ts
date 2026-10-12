import { test, expect } from '@playwright/test'
import { boot, objectCount, objects } from './helpers'

test('library drag-drop places an object, move/rotate/delete/undo work', async ({ page }) => {
  await boot(page)
  expect(await objectCount(page)).toBe(0)
  // drag "Apple" from the library onto the terrain
  const item = page.locator('.lib-item', { hasText: 'Apple' }).first()
  const canvas = page.locator('canvas').first()
  const box = (await canvas.boundingBox())!
  await item.dragTo(canvas, { targetPosition: { x: box.width * 0.45, y: box.height * 0.62 } })
  await expect.poll(() => objectCount(page)).toBe(1)
  let [o] = await objects(page)
  expect(o.type).toBe('apple')
  expect(o.x).toBeGreaterThan(0); expect(o.x).toBeLessThan(33)

  // numeric edit through the properties panel, then undo
  await page.locator('#p-x').fill('10')
  await page.locator('#p-x').press('Enter')
  ;[o] = await objects(page)
  expect(o.x).toBe(10)
  await page.keyboard.press('Control+z')
  ;[o] = await objects(page)
  expect(o.x).not.toBe(10)
  await page.keyboard.press('Control+Shift+z')
  ;[o] = await objects(page)
  expect(o.x).toBe(10)

  // rotate through the field
  await page.locator('#p-rot').fill('90'); await page.locator('#p-rot').press('Enter')
  ;[o] = await objects(page)
  expect(o.rotY).toBeCloseTo(Math.PI / 2, 3)

  // duplicate, then delete one, then undo delete
  await page.locator('canvas').first().focus()
  await page.keyboard.press('Control+d')
  expect(await objectCount(page)).toBe(2)
  await page.keyboard.press('Delete')
  expect(await objectCount(page)).toBe(1)
  await page.keyboard.press('Control+z')
  expect(await objectCount(page)).toBe(2)
})

test('clicking in the view selects, dragging moves the object', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => { const a = (window as any).__garden.actions; a.placeObject('raised-bed', 12, 12); a.select([]) })
  await page.waitForTimeout(600)
  const screen = await page.evaluate(() => { const e = (window as any).__engine; return e.worldToScreen(12, e.terrain.heightAt(12, 12) + 0.3, 12) })
  await page.mouse.click(screen.x, screen.y)
  await expect.poll(() => page.evaluate(() => (window as any).__garden.store.getState().ui.selection.length)).toBe(1)
  await page.mouse.move(screen.x, screen.y)
  await page.mouse.down()
  await page.mouse.move(screen.x + 30, screen.y, { steps: 4 })
  await page.mouse.move(screen.x + 70, screen.y, { steps: 4 })
  await page.mouse.up()
  const [o] = await objects(page)
  expect(o.x).toBeGreaterThan(12.5)
  // undo restores the position in one step
  await page.keyboard.press('Control+z')
  const [o2] = await objects(page)
  expect(o2.x).toBe(12)
})
