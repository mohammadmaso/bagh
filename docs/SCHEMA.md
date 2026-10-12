# Project file schema (v1)

`*.garden.json` (also stored in IndexedDB under `garden:project:v1`). Loading runs `migrateProject()` (src/core/project.ts): older/partial files are upgraded; files with a newer `schemaVersion` are refused.

```jsonc
{
  "schemaVersion": 1,
  "name": "My garden",
  "site": {                          // SiteConfig (src/core/types.ts) – all editable in Site setup
    "width": 33, "depth": 30, "lat": 36.5, "lon": 51.2, "tzOffsetMinutes": 210, "elevation": 600,
    "slopeDeg": 10, "aspectDeg": 180, "crossSlopeDeg": 0,
    "fence": { "height": 1.8, "postSpacing": 3, "postRadius": 0.035 },
    "gates": [{ "id": "main", "edge": "west", "offset": 4, "width": 3, "kind": "vehicle" }],
    "house": { "width": 5, "depth": 5, "wallHeight": 2.5, "roofPitchDeg": 25, "overhang": 0.4, "setbackSouth": 1.5, "offsetX": 0, "door": {…}, "windows": […] },
    "horizon": [{ "az": 0, "el": 14 }, …]    // elevation angle by compass azimuth
  },
  "sculpt": { "res": 0.5, "nx": 67, "nz": 61, "data": "<base64 Float32Array of height deltas>" } | null,
  "scenarios": { "<id>": { "id", "name", "order": ["objId", …], "objects": { "<objId>": PlacedObject } } },
  "scenarioOrder": ["<id>", …], "activeScenarioId": "<id>",
  "images": [{ "id", "kind": "overlay|pin|sky", "name", "dataUrl", "opacity", "cx", "cz", "widthM", "rotY", "visible" }],
  "groups": { "<gid>": { "id", "name" } },
  "ruleConfig": { "<ruleId>": { "enabled"?, "severity"?, "params"? } },
  "assets": { "<id>": { "id", "name", "data": "<base64 glb>" } },
  "bookmarks": [{ "id", "name", "pos": [x,y,z], "target": [x,y,z], "view", "zoom"? }]
}
```

`PlacedObject`: `{ id, type (catalog id), x, z, rotY (rad), scale, points? (polyline kinds, world x/z), params {…}, label?, locked?, hidden?, groupId?, ageOffset (years of growth at timeline 0) }`.

Not stored in the project (UI preferences go to localStorage): date/time/season/tree-age sliders, view, quality, language, theme.

## Migration policy
Bump `SCHEMA_VERSION`, add a branch in `migrateProject` that maps the old shape forward, and add a test in `tests/store.test.ts`. v0 (pre-release drafts with a flat `objects` array) is migrated to a single plan.
