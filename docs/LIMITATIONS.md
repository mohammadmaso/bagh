# Limitations (what is approximate or not done, and why)

* **Plant data is approximate.** Heights, canopies, years to fruit, bloom/harvest months and sun needs are generic defaults for 400–800 m Alborz north-slope conditions; they are marked "approximate – verify" in the UI. Edit `src/data/plants.ts`.
* **Real photographs vs procedural art.** Trees, structures, grass and textures are procedural (no network, small download). They read as a realistic small orchard but are not photogrammetry; species recognisability is by silhouette, leaf shape, blossom and fruit colour.
* **Shadows use one fitted shadow map, not cascades.** Resolution (up to 4096²) covers the 33 × 30 m plot at ~7 cm/texel; shadows from distant neighbours/forest are not cast. Shadow maps refresh when the sun, layout or growth changes (not for wind).
* **Sun-hours analysis is a model**, not a measurement: foliage is a soft ellipsoid (Beer–Lambert chord attenuation), fences are 12 % opaque, small ground objects (beds, hives) are measured not obstacles, neighbours/forest do not shade (only the editable horizon profile does). 10-minute steps, 0.5 m cells.
* **Surroundings are procedural** (ridges, forest, neighbour plots) — not a DEM of the real valley. Put real ridge angles into the horizon profile for accurate sun-blocking.
* **Water flow** uses D8 routing on the plot plus a 30 m uphill margin of the *same plane*; it does not know about drainage beyond that.
* **Frost-pocket rule** only fires where the ground is actually low and flat (or ponds); the default uniform slope has none.
* **"Tall trees on the north side of beds"** is implemented as: warn when a tall tree is *south* of a bed (its shadow falls on the bed). See ASSUMPTIONS.
* **360° video/GLB**: GLB export bakes leaf cut-outs into textures but not wind/season shaders; blossoms and fruit are omitted. Video is WebM via MediaRecorder (browser support varies; Safari may only offer MP4).
* **PDF in Persian** uses jsPDF's Arabic shaping; complex mixed Latin/Persian lines may order slightly differently than a word processor.
* **Software GL** (no GPU) renders at ~1 fps; the measured numbers in PERF.md are draw calls/triangles, not frame rates, for that reason.
* **Walk mode** is a kinematic walker (no jumping/stairs); gates are treated as open gaps.
