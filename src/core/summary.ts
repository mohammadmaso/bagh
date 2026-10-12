import type { Project } from './project'
import type { Terrain } from './terrain'
import { computeQuantities } from './quantities'
import { evaluateRules, type SunGrid } from './rules'

/** Headline numbers of a plan for the comparison table. */
export function summarizeScenario(project: Project, scenarioId: string, terrain: Terrain, growingSun?: SunGrid | null) {
  const sc = project.scenarios[scenarioId]
  const objects = Object.values(sc.objects)
  const q = computeQuantities(objects, project.site)
  const v = evaluateRules({ site: project.site, terrain, objects, growingSun }, project.ruleConfig)
  return {
    objects: objects.length,
    trees: q.totals.trees, beds: q.totals.beds, bedArea: q.totals.bedArea, hives: q.totals.hives, coops: q.totals.coops,
    pathLength: q.totals.pathLength, pipeLength: q.totals.pipeLength, tankL: q.totals.tankCapacityL,
    errors: v.filter((x) => x.severity === 'error').length, warnings: v.filter((x) => x.severity === 'warning').length, notes: v.filter((x) => x.severity === 'info').length,
  }
}
