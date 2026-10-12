import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { boot, objectCount } from './helpers'

test.setTimeout(300_000)

async function openExport(page: any) {
  await page.getByRole('button', { name: /File/ }).click()
  await page.getByRole('menuitem', { name: /Export/ }).click()
  await expect(page.getByRole('dialog', { name: 'Export' })).toBeVisible()
}

test('example layout loads; PNG, PDF, GLB, CSV and JSON exports produce valid files', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: /File/ }).click()
  await page.getByRole('menuitem', { name: /Load example layout/ }).click()
  await expect.poll(() => objectCount(page)).toBeGreaterThan(30)
  await page.waitForTimeout(1500)

  fs.mkdirSync('test-results/exports', { recursive: true })
  await openExport(page)

  // PNG 4K
  let [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240_000 }), page.getByRole('button', { name: 'Export PNG' }).click()])
  const pngPath = 'test-results/exports/view-4k.png'
  await dl.saveAs(pngPath)
  const png = fs.readFileSync(pngPath)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(3840); expect(png.readUInt32BE(20)).toBe(2160)

  // PDF
  ;[dl] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.getByRole('button', { name: 'Export plan PDF' }).click()])
  await dl.saveAs('test-results/exports/plan.pdf')
  const pdf = fs.readFileSync('test-results/exports/plan.pdf')
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdf.length).toBeGreaterThan(5000)

  // GLB
  ;[dl] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.getByRole('button', { name: 'Export GLB' }).click()])
  await dl.saveAs('test-results/exports/scene.glb')
  const glb = fs.readFileSync('test-results/exports/scene.glb')
  expect(glb.subarray(0, 4).toString()).toBe('glTF')
  expect(glb.readUInt32LE(8)).toBe(glb.length)

  // CSV
  ;[dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()])
  await dl.saveAs('test-results/exports/quantities.csv')
  const csv = fs.readFileSync('test-results/exports/quantities.csv', 'utf8')
  expect(csv).toContain('Site fence')
  expect(csv.split('\n').length).toBeGreaterThan(10)

  // JSON round-trip
  ;[dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save project' }).click()])
  await dl.saveAs('test-results/exports/project.garden.json')
  const json = JSON.parse(fs.readFileSync('test-results/exports/project.garden.json', 'utf8'))
  expect(json.schemaVersion).toBe(1)
  expect(Object.keys(json.scenarios).length).toBeGreaterThan(1)
})
