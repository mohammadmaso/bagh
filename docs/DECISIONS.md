# Decisions

Deviations from the brief's stack, with justification.

- **suncalc v2 (`getPosition` named export)**: the brief allows SunCalc; v2 returns compass-bearing azimuth in degrees, wrapped in `src/core/sun.ts`.
- **Pads inside `heightAt`**: levelled pads (house, coops, tanks…) are part of the single terrain function so rendering, snapping, and analysis agree.
- **Shadow rendering**: one fitted directional shadow map (4096² on High ≈ 7 cm texels over the 45 m plot diagonal) instead of CSM; the plot is small enough that cascades add cost without gain. Revisit if a larger plot is configured.
- **Instanced trees + merged static models**: a THREE.LOD per tree meant ~1000 draw calls for 300 objects; trees are now InstancedMesh per (species, age, variant, LOD, part) re-assigned to LODs each frame, and every other model is merged to one draw call per material. Draw calls fell ~60 %.
- **Second WebGL context for plan comparison**: the compare view runs a read-only Engine (own canvas) with a scenario override and a camera follower — simplest correct way to show two different terrains/pads side by side.
- **jsPDF (vector) for the plan** instead of a screenshot: crisp at any scale; Persian via `processArabic` + bundled Vazirmatn TTF loaded only when exporting in Persian.
- **Terrain sculpt stored as one base64 Float32Array** so a whole brush stroke is a single `replace` patch (deduped while dragging) and undo stays cheap.
