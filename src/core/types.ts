/** Local coordinates: X = east, Z = south, Y = up, origin at the NW corner of the plot. */

export interface Vec2 { x: number; z: number }

export interface GateDef {
  id: string
  edge: 'west' | 'east' | 'north' | 'south'
  /** distance along the edge from its start (north end for west/east, west end for north/south), metres, to the gate's near side */
  offset: number
  width: number
  kind: 'vehicle' | 'pedestrian'
}

export interface HouseDef {
  width: number // east-west
  depth: number // north-south
  wallHeight: number
  roofPitchDeg: number
  overhang: number
  /** distance from the south fence to the south wall */
  setbackSouth: number
  /** centre offset east-west from plot centre */
  offsetX: number
  door: { wall: 'south' | 'north' | 'east' | 'west'; offset: number; width: number; height: number }
  windows: { wall: 'south' | 'north' | 'east' | 'west'; offset: number; width: number; height: number; sill: number }[]
}

export interface FenceDef {
  height: number
  postSpacing: number
  postRadius: number
}

export interface SiteConfig {
  width: number // east-west (m)
  depth: number // north-south (m)
  lat: number
  lon: number
  tzOffsetMinutes: number // 210 for Asia/Tehran
  elevation: number // m a.s.l. (information only; used for haze)
  slopeDeg: number
  aspectDeg: number // compass bearing the slope faces (180 = falls toward south)
  crossSlopeDeg: number
  fence: FenceDef
  gates: GateDef[]
  house: HouseDef
  /** horizon elevation angle (deg) per azimuth (deg, clockwise from north), piecewise linear, wraps */
  horizon: { az: number; el: number }[]
}

export interface HorizonPoint { az: number; el: number }
