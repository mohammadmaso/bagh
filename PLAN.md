# Garden Studio — Plan

Offline 3D garden planner for one real plot (33 × 30 m, 10° slope falling south, Alborz foothills).

## Milestones (commit after each; app works at every step)
- **M1** Scaffold, site model, `heightAt`, terrain mesh, fence + gates, cabin, lawn, sky/sun basics, orbit camera, Site Setup panel.
- **M2** Catalog v1 (data-driven, procedural models), library → drag onto terrain, select/move/rotate/scale, numeric fields, snapping, undo/redo (Immer patches), copy/paste, delete, collisions.
- **M3** Rendering quality (ACES, shadows, GTAO/SMAA, grass, wind foliage), sun/season/time sliders, Jalali date, horizon.
- **M4** Analysis workers (sun-hours, slope, flow), rules engine, quantities panel.
- **M5** Growth timeline, terrain sculpt, reference imagery, scenarios, polyline tools (path/pipe), measure.
- **M6** Export (PNG 4K / PDF / JSON / GLB / CSV), i18n en/fa + RTL, PWA, autosave.
- **M7** Tests (unit + Playwright), docs, perf, screenshots, final self-review (docs/REQUIREMENTS.md).

## Principles
- Pure functions in `src/core/*` with unit tests; UI is thin.
- All tunables in `src/data/*` (site defaults, catalog, rules, plants).
- Procedural assets first; no network at runtime.
- Coordinates: X east, Z south, Y up, origin NW corner. `heightAt(x,z)` is the single terrain source.
