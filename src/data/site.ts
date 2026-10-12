import type { SiteConfig } from '../core/types'

/** Source-of-truth defaults for the real plot. All values are editable in the Site Setup panel. */
export const DEFAULT_SITE: SiteConfig = {
  width: 33,
  depth: 30,
  lat: 36.5,
  lon: 51.2,
  tzOffsetMinutes: 210,
  elevation: 600,
  slopeDeg: 10,
  aspectDeg: 180,
  crossSlopeDeg: 0,
  fence: { height: 1.8, postSpacing: 3, postRadius: 0.035 },
  gates: [
    { id: 'main', edge: 'west', offset: 4, width: 3, kind: 'vehicle' },
    { id: 'door', edge: 'west', offset: 22, width: 1, kind: 'pedestrian' },
  ],
  house: {
    width: 5,
    depth: 5,
    wallHeight: 2.5,
    roofPitchDeg: 25,
    overhang: 0.4,
    setbackSouth: 1.5,
    offsetX: 0,
    door: { wall: 'south', offset: 0, width: 0.9, height: 2.0 },
    windows: [
      { wall: 'south', offset: -1.5, width: 1.0, height: 1.0, sill: 0.9 },
      { wall: 'south', offset: 1.5, width: 1.0, height: 1.0, sill: 0.9 },
      { wall: 'east', offset: 0, width: 1.0, height: 1.0, sill: 0.9 },
      { wall: 'west', offset: 0, width: 1.0, height: 1.0, sill: 0.9 },
    ],
  },
  // Alborz: high ridge to the north/north-west, gentler to south. Elevation angle by azimuth.
  horizon: [
    { az: 0, el: 14 },
    { az: 45, el: 11 },
    { az: 90, el: 7 },
    { az: 135, el: 4 },
    { az: 180, el: 2 },
    { az: 225, el: 4 },
    { az: 270, el: 8 },
    { az: 315, el: 12 },
  ],
}
