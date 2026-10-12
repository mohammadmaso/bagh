# Garden Studio

An offline, browser-based 3D garden planner for one real plot: **33 × 30 m, ~10° slope falling south, fenced, both gates on the west side, 5 × 5 m cabin at the bottom** (Marzanabad / Kelardasht, Alborz foothills). Decide where every tree, hive, coop, bed, path, tank and structure goes, and see the result at any date, hour, season and tree age.

Everything is procedural or bundled: **no CDN, no remote fonts, no network calls at runtime.** A PWA service worker makes it work with no internet after the first load.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # -> dist/ (plain static folder; serve with any static server)
npm run preview      # serve dist/ on http://localhost:4173
npm test             # unit tests (Vitest)
npm run e2e          # Playwright (needs `npm run build` first; uses the preview server)
```

`dist/` uses relative URLs (`base: './'`), so `python3 -m http.server -d dist` works too. After the first visit the service worker caches everything; reload with the network off and it still runs. Install it from the browser menu for a standalone app.

Add `?fresh` to the URL to ignore autosave, `?q=low|medium|high|ultra` to force a quality preset, `?gallery` for a catalog thumbnail contact sheet.

## What you can do

* **Library** (90+ items, searchable): fruit & nut trees (19 species, 4 seasons, ages 0–15), windbreak, shrubs/vines/herbs, beds, greenhouse/tunnel, ginseng & shiitake, coops/hutches/goose/goat, hives & bee water & flight barrier, cabin/shed/pergola/gazebo/compost, tanks, well, pond, solar, taps, paths (polyline tool), steps, retaining walls, swales, fences, drip lines, scale references, your own GLB models.
* **Place & edit**: drag from the library (or click, then click the terrain), auto-snap to terrain (levelled pads for houses/coops/tanks…), W/E/R gizmos, numeric fields, grid & edge snap, multi-select (Shift-click / Shift-drag box), copy/paste/duplicate, array tool (row of N at spacing S along a line or **a contour**), lock/hide, groups, labels, undo/redo, context menu, red overlap ghost (optional "allow overlaps").
* **Views**: perspective, plan (drafting style, grid, labels), section along the slope (with a cut slider), first-person walk at 1.7 m with fence/house/object collision; camera bookmarks; turntable and fly-through video export.
* **Time**: date slider with Solar Hijri display, time of day, season (auto from date or forced, snow option), **tree age 0–15 yr**. Real sun position for the site, sky synced to the sun, shadows, horizon profile.
* **Analysis (Web Worker)**: sun-hours heatmap (selected date, equinoxes, solstices; terrain, horizon, fence, cabin, every object at its current age and leaf cover) and a per-object report ("Bed 3: 7.2 h on Jun 21, 3.1 h on Dec 21"); slope heatmap; 0.5 m contours; water-flow overlay (D8 + depression filling, with the uphill catchment) with ponding; cut/fill for pads.
* **Rules**: 13 editable rules (canopy overlap at maturity, tree-to-fence/house, bed sun, juglone, hive facing/clearance/water, livestock & compost runoff uphill of wells/tanks/leafy beds, coop clearance, path width/slope, tall tree shading a bed, frost pocket). Click a warning to fly to it; coloured rings and pins in 3D.
* **Terrain**: sculpt brushes (raise/lower/smooth/flatten, boundary stays exact), level pads, contour **terrace generator** with retaining walls and cut/fill.
* **Imagery**: top-down photo overlay with two-point calibration, pinned ground photos, 360° sky photo. All local.
* **Plans**: several named layouts, quick switching, side-by-side compare with a summary table.
* **Save/export**: autosave (IndexedDB), project JSON (versioned, migrating), PNG up to 4K (clean mode), vector **PDF plan** (title block, scale bar, north arrow, legend, dimensions, contours, Persian supported), GLB of the whole scene, CSV quantities, WebM videos.
* **English / فارسی** with full RTL, Persian digits option, bundled Vazirmatn; light/dark; touch support; guided tour; a built-in example layout (File → Load example layout; remove it from the same menu or keep it as a plan).

## Keyboard shortcuts

`V` select · `W/E/R` move/rotate/scale · `M` measure · `P` path · `Esc` cancel · `Ctrl+Z / Ctrl+Shift+Z` undo/redo · `Ctrl+C / V / D` copy/paste/duplicate · `Del` delete · `Ctrl+A` select all · `Ctrl+G / Ctrl+Shift+G` group/ungroup · `L / H` lock/hide · `F` focus · arrows nudge (Shift = 1 m) · `1 2 3 4` perspective/plan/section/walk · `G` cycle grid · Shift-drag box select · `R` while placing rotates the ghost · `Enter` finish path · `Backspace` remove last point · walk mode: `WASD`/arrows, `Q/E` turn, Shift run, drag to look. (Help → Keyboard shortcuts.)

## How to add a catalog item

1. Append an entry to `CATALOG` in `src/data/catalog.ts` (id, category, names en/fa, `kind`, `model`, footprint `fp`, `height`, `role`, optional `params`, `pad`, `meta`).
2. If it needs a new 3D shape, add a builder under the same `model` key in `src/render/models/structures.ts` (see `growing.ts`, `animals.ts`, `buildings.ts`; helpers in `kit.ts`). The model's origin is the ground anchor; +Z is "front" (south at rotation 0).
3. For plants add a species to `src/data/plants.ts` (all values approximate) and a `plant-tree` entry.
4. `npm test`, then open `?gallery` to eyeball the thumbnail.

## How to add a rule

1. Add `{ id, severity, enabled, params }` to `RULES` in `src/data/rules.ts`.
2. Add an evaluator with the same id in `src/core/rules.ts` (pure function of site, terrain, objects, optional analysis grids).
3. Add `rule.<id>.title`, `rule.<id>.msg`, and `param.<name>` strings to `src/i18n/dyn.ts` (en + fa).
4. Add a unit test in `tests/rules.test.ts`.

## Layout of the code

```
src/core      pure geometry/sun/terrain/rules/analysis/quantities (unit tested)
src/data      site, catalog, plants, rules, example layout (everything configurable)
src/render    three.js engine, layers (terrain, sky, objects, trees, grass, overlay…), models, thumbnails
src/store     zustand + immer (undo/redo via patches), analysis, scenarios, autosave
src/workers   sun-hours analysis worker
src/export    PNG, PDF, GLB, video
src/ui        React shell and panels
src/i18n      English/Persian
docs/         ASSUMPTIONS, DECISIONS, SCHEMA, LIMITATIONS, PERF, REQUIREMENTS
```

Coordinates: **X east, Z south, Y up, origin at the NW corner.** `terrain.heightAt(x, z)` is the single height function used for rendering, snapping, analysis and rules.

All plant data (heights, canopies, years to fruit, bloom/harvest months, sun needs) is **approximate** for 400–800 m Alborz north-slope conditions — verify locally. It lives in `src/data/plants.ts`.
