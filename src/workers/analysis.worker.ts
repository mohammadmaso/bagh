/// <reference lib="webworker" />
import { computeSunHours, type SunHoursInput, type SunHoursResult } from '../core/analysis/sunHours'

export interface WorkerRequest { id: number; jobs: { key: string; input: SunHoursInput }[] }
export type WorkerResponse =
  | { id: number; type: 'progress'; p: number }
  | { id: number; type: 'done'; results: { key: string; result: SunHoursResult }[] }
  | { id: number; type: 'error'; message: string }

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, jobs } = e.data
  try {
    const results: { key: string; result: SunHoursResult }[] = []
    jobs.forEach((job, ji) => {
      const result = computeSunHours(job.input, (p) => (self as unknown as Worker).postMessage({ id, type: 'progress', p: (ji + p) / jobs.length } satisfies WorkerResponse))
      results.push({ key: job.key, result })
    })
    const transfer: Transferable[] = []
    for (const r of results) for (const a of Object.values(r.result.hours)) transfer.push(a.buffer)
    ;(self as unknown as Worker).postMessage({ id, type: 'done', results } satisfies WorkerResponse, transfer)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, type: 'error', message: String((err as Error)?.message ?? err) } satisfies WorkerResponse)
  }
}
