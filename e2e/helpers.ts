import type { Page } from '@playwright/test'

export async function boot(page: Page) {
  await page.goto('/')
  await page.waitForSelector('canvas')
  await page.waitForFunction(() => (window as any).__engine && (window as any).__garden)
  await page.waitForTimeout(800)
}

export const objectCount = (page: Page) => page.evaluate(() => {
  const s = (window as any).__garden.store.getState()
  const sc = s.project.scenarios[s.project.activeScenarioId]
  return Object.keys(sc.objects).length
})

export const objects = (page: Page) => page.evaluate(() => {
  const s = (window as any).__garden.store.getState()
  return Object.values(s.project.scenarios[s.project.activeScenarioId].objects) as any[]
})
