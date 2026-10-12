/**
 * Rule definitions: default severity, enabled flag and thresholds. Users can override any of them in the Rules panel
 * (stored per project). Add a rule: add an entry here, a function with the same id in src/core/rules.ts, and i18n keys
 * `rule.<id>.title`, `rule.<id>.msg` and `rule.<id>.p.<param>`.
 */
export type Severity = 'error' | 'warning' | 'info'

export interface RuleDef {
  id: string
  severity: Severity
  enabled: boolean
  params: Record<string, number>
}

export const RULES: RuleDef[] = [
  { id: 'canopyOverlap', severity: 'warning', enabled: true, params: { tolerance: 0.5 } },
  { id: 'treeFence', severity: 'warning', enabled: true, params: { fenceFactor: 0.6, minFence: 1.0 } },
  { id: 'treeHouse', severity: 'warning', enabled: true, params: { houseFactor: 1.0, minHouse: 4.0 } },
  { id: 'bedSun', severity: 'warning', enabled: true, params: { minHours: 6 } },
  { id: 'juglone', severity: 'error', enabled: true, params: { distance: 10 } },
  { id: 'hiveFacing', severity: 'warning', enabled: true, params: { idealAz: 135, okTol: 60 } },
  { id: 'hiveClearance', severity: 'warning', enabled: true, params: { distance: 5, barrierHeight: 2, barrierReach: 3 } },
  { id: 'hiveWater', severity: 'warning', enabled: true, params: { distance: 50 } },
  { id: 'runoff', severity: 'warning', enabled: true, params: { distance: 25, coneDeg: 70 } },
  { id: 'coopClearance', severity: 'warning', enabled: true, params: { fromBeds: 3, fromBoundary: 3 } },
  { id: 'pathLimits', severity: 'warning', enabled: true, params: { minWidth: 0.9, accessWidth: 1.2, accessSlope: 8.3, wheelbarrowSlope: 12, maxSlope: 20 } },
  { id: 'treeShadesBed', severity: 'warning', enabled: true, params: { minHeight: 4, shadowFactor: 1.8, azTolerance: 55 } },
  { id: 'frostPocket', severity: 'warning', enabled: true, params: { bottomFraction: 0.25, flatDeg: 6 } },
]

export const RULE_BY_ID: Record<string, RuleDef> = Object.fromEntries(RULES.map((r) => [r.id, r]))
export interface RuleOverride { enabled?: boolean; severity?: Severity; params?: Record<string, number> }
export type RuleConfig = Record<string, RuleOverride>
