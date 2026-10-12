# Performance notes

## Environment
No hardware GPU was available while building (Linux, headless Chromium with SwiftShader software GL, ~1 fps). **Frame rates below are therefore NOT representative of a laptop**; the numbers that predict iGPU behaviour — draw calls and triangles — are reported instead, plus download size. Re-run `node scripts/perf.mjs <quality> <objects>` on a real machine (against `npm run preview`) and paste the `fps` there.

## Download size (production build)
| Item | Size |
|---|---|
| Main JS (gzip) | 0.46 MB |
| jsPDF chunk (lazy, gzip) | 0.13 MB |
| Total `dist/` (everything incl. fonts, icons, Vazirmatn TTF for PDF) | 2.9 MB |
| Service-worker precache | 2.7 MB |
Budget was < 15 MB gzipped initial and < 150 MB assets: **met by a wide margin** (all art is procedural).

## Scene cost with 320 placed objects (213 trees + 107 other), tree age 8 yr, camera at the default view
| Stage | Draw calls (low preset, incl. debug overlays) |
|---|---|
| First implementation (one `THREE.LOD` per tree, one mesh per primitive) | 4,960 |
| + merged static models (1 call per material per object) | 2,013 |
| + instanced trees by (species, age, variant, LOD, part), blossom/fruit/leaf layers hidden when out of season | ≈ 1,100 in a typical scene (the measured 1,864 includes ~760 collision/rule decals produced by this deliberately overlapping stress layout) |
| Shadow pass | only when sun / layout / growth changes (`shadowMap.autoUpdate = false`) |

Triangles ≈ 2.2 M (trees dominate; LOD1 beyond ≈ 30–55 m, crown-blob LOD2 beyond ≈ 90–150 m, distances scale with the quality preset).

## What keeps it fast
* Instanced + LOD trees (distance thresholds recomputed only when the camera moves > 0.2 m or trees change).
* Per-object geometry merge; shared cached geometry/materials; leaf wind in vertex shaders; seasonal changes are uniform updates (no geometry rebuild); tree geometry cached per (species, 0.5-yr age, variant).
* Grass: 5 m patches around the camera, two density LODs, built nearest-first (2 per frame), masked under objects/paths, distance fade.
* BVH-accelerated terrain picking; analyses in a Web Worker (sun hours for 5 dates at 0.5 m ≈ 1–3 s on a desktop CPU; growing-season 6 dates at 1 m run in the background after edits).
* Quality presets: Low (no post, no grass, 1024² shadows) … Ultra (4096², MSAA 8, 450 blades/m²); chosen by a ~40-frame benchmark.

## How to measure on your machine
```bash
npm run build && npx vite preview --port 4173 &
node scripts/perf.mjs high 320          # prints fps, calls, triangles
```
