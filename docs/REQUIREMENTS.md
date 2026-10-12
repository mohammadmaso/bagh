# Final self-review against the brief

DONE = implemented and exercised by a test or screenshot. PARTIAL = implemented with a stated gap.

## 1. Site facts
| Requirement | Status |
|---|---|
| 33 × 30 m plot, editable (Site panel) | DONE (unit + e2e: fence encloses exactly 33 × 30) |
| Lat/lon 36.5/51.2, paste "lat, lon", Asia/Tehran UTC+3:30 | DONE |
| Slope 10° falling south, aspect, cross slope; south edge lowest by ~5.29 m | DONE (tests/terrain.test.ts, e2e) |
| Wire fence 1.8 m, posts ~3 m, parametric | DONE |
| Main 3 m gate (upper/north) + 1 m door (lower/south), both on the WEST fence, editable offsets | DONE (e2e) |
| 5 × 5 m cabin, 2.5 m walls, gable, south, 1.5 m setback, parametric | DONE |
| Surroundings: uphill terrain, Alborz ridge backdrop, neighbour plots, editable horizon profile blocking sun | DONE (neighbours/forest decorative; horizon used in analysis and light) |
| Single `heightAt(x,z)` used everywhere | DONE |

## 2. Tech stack
Vite + strict TS + three.js + React shell + Zustand/Immer patches + three-mesh-bvh + SunCalc + postprocessing (SSAO, SMAA, tone mapping) + Vitest + Playwright: DONE. 100 % offline (e2e asserts zero external requests; offline reload works), Vazirmatn bundled, PWA, static `dist/`: DONE. Assets all procedural (no CC0 downloads needed): DONE. Deviations documented in DECISIONS.md.

## 3. Features
| Item | Status |
|---|---|
| 3.1 Catalog data-driven, searchable, categorised, offscreen thumbnails, params panel; all listed species/items | DONE (kiwi/grape as pergola/trellis; cypress/poplar/pine; polytunnel etc.). Growth ages 0–15 via a continuous curve (not only 6 stops) |
| Custom GLB import with scale/footprint | DONE |
| 3.2 Drag from library, auto-snap, levelled pads, gizmos W/E/R, numeric fields, grid/edge snap, multi-select + box select, copy/paste/duplicate, array tool (line or contour), lock/hide, groups, labels, undo/redo, shortcuts, context menu | DONE |
| Overlap red ghost + allow-overlap option | DONE |
| Measure (distance, area, slope), dimension labels, scale bar, north arrow | DONE |
| Scenarios: named plans, quick switch, side-by-side compare | DONE |
| 3.3 Perspective, ortho plan, side/section along slope, first-person walk 1.7 m with collision; bookmarks, smooth transitions; fly-through and turntable video | DONE |
| 3.4 Date slider + Jalali, time slider, real sun, sky synced, soft shadows from sun on terrain/house/trees/fence, horizon shading | DONE |
| "Cascaded" shadow maps | PARTIAL — one fitted 4096² shadow map instead of cascades (see LIMITATIONS) |
| Seasons: blossom, summer, autumn colour, bare winter, snow option | DONE (snow covers ground/grass; roofs and branches stay un-snowed — PARTIAL detail) |
| Growth timeline 0…15 yr scales every plant, canopies shade beds | DONE |
| 3.5 Sun-hours heatmap in a worker, presets, per-object report | DONE |
| Slope heatmap, 0.5 m contours, cut/fill, terrace generator | DONE |
| Water flow (D8 + accumulation, low spots) | DONE (swale interception is visual — place a swale and watch flow/pits change; no automatic swale suggestions) |
| Rules engine, editable thresholds, severity, click-to-focus; all listed rules | DONE (13 rules; "tall trees north of beds" interpreted, see ASSUMPTIONS) |
| Quantities panel + CSV | DONE |
| Plant data marked "approximate – verify", in one file | DONE |
| 3.6 Sculpt brushes (raise/lower/smooth/flatten), undo, level pads, exact boundary | DONE |
| 3.7 Top-down overlay with opacity + two-point calibration, ground photo pins, 360° sky | DONE (no e2e for imagery; unit-tested calibration maths) |
| 3.8 Autosave IndexedDB, project JSON versioned + migration, PNG ≤ 4K (clean mode), PDF plan, GLB, CSV | DONE (e2e) |
| 3.9 EN/fa full RTL, Persian digits option, Vazirmatn, light/dark, touch (pointer events, OrbitControls pinch/rotate/pan, walk joysticks), tour, example layout (load/delete/keep) | DONE (touch exercised by emulation only, not on a physical tablet) |

## 4. Visual quality
ACES tone mapping, PBR, shadow map, SSAO, SMAA/MSAA, sky + aerial haze, instanced animated grass (LOD), no-tiling ground shader, wind foliage, alpha-cut leaf cards, believable bark/wood/roof/fence materials, presets auto-selected by benchmark: DONE. "Photograph quality": PARTIAL — procedural trees/structures look good at orchard distance but are not photoreal up close.

## 5. Performance
Instancing, LOD, culling, BVH terrain picking, lazy thumbnails/PDF font: DONE. Initial load: 0.47 MB gzipped main JS + 2.7 MB total precache (≪ 15 MB). **60 fps on an integrated GPU with 300+ objects is NOT verified** — no GPU was available; software GL measured draw calls/triangles instead (docs/PERF.md). PARTIAL.

## 6. Architecture
Modules as specified, pure tested functions, versioned schema (docs/SCHEMA.md), data files for configuration, ARIA labels/keyboard-reachable panels/contrast tokens: DONE (no automated a11y audit run).

## 7. Verification
Unit tests (heightAt, slope/aspect, sun vs known values, rules, serialization, undo/redo, sun-hours, flow, sculpt, terraces, collisions…), Playwright e2e (load, place/move/rotate/delete/undo, date/time/season/age, analysis, exports, fa/RTL, views/walk, scenarios, offline), screenshots in docs/screenshots inspected and defects fixed (see commit history): DONE. Sanity checks (cabin 5 × 5 × 2.5, person 1.75 m, 33 × 30 fence, 5.3 m fall, gates west, shadows west→east across the day): DONE.
