export const en = {
  appName: 'Garden Studio',
  'view.persp': 'Perspective', 'view.plan': 'Plan', 'view.section': 'Section', 'view.walk': 'Walk',
  'panel.library': 'Library', 'panel.properties': 'Properties', 'panel.site': 'Site', 'panel.analysis': 'Analysis',
  'panel.rules': 'Rules', 'panel.quantities': 'Quantities', 'panel.images': 'Imagery', 'panel.scenarios': 'Plans',
  'time.date': 'Date', 'time.time': 'Time', 'time.season': 'Season', 'time.age': 'Tree age', 'time.years': 'yr',
  'season.auto': 'Auto', 'season.spring': 'Spring', 'season.summer': 'Summer', 'season.autumn': 'Autumn', 'season.winter': 'Winter',
  'time.snow': 'Snow', 'time.springEq': 'Spring equinox', 'time.summerSol': 'Summer solstice', 'time.autumnEq': 'Autumn equinox', 'time.winterSol': 'Winter solstice',
  'site.title': 'Site setup', 'site.width': 'Width E–W (m)', 'site.depth': 'Depth N–S (m)', 'site.latlon': 'Latitude, longitude',
  'site.latlonHint': 'Paste "lat, lon"', 'site.elevation': 'Elevation (m)', 'site.slope': 'Slope (°)', 'site.aspect': 'Slope faces (° compass)',
  'site.cross': 'Cross slope (°)', 'site.fence': 'Fence', 'site.fenceHeight': 'Height (m)', 'site.postSpacing': 'Post spacing (m)',
  'site.gates': 'Gates', 'site.gateEdge': 'Edge', 'site.gateOffset': 'Offset (m)', 'site.gateWidth': 'Width (m)',
  'site.house': 'Cabin', 'site.houseW': 'Width (m)', 'site.houseD': 'Depth (m)', 'site.wallH': 'Wall height (m)', 'site.pitch': 'Roof pitch (°)',
  'site.overhang': 'Overhang (m)', 'site.setback': 'South setback (m)', 'site.offsetX': 'East offset (m)',
  'site.horizon': 'Horizon profile (elevation ° by azimuth)', 'site.reset': 'Reset to defaults',
  'site.assumed': 'Assumed – please verify', 'site.edge.north': 'North', 'site.edge.south': 'South', 'site.edge.east': 'East', 'site.edge.west': 'West',
  'site.terrainNote': 'Origin at NW corner. X east, Z south. South edge is the lowest point.',
  'btn.undo': 'Undo', 'btn.redo': 'Redo', 'btn.delete': 'Delete', 'btn.duplicate': 'Duplicate', 'btn.close': 'Close',
  'ui.language': 'Language', 'ui.theme': 'Theme', 'ui.quality': 'Quality', 'ui.digits': 'Persian digits',
  'quality.low': 'Low', 'quality.medium': 'Medium', 'quality.high': 'High', 'quality.ultra': 'Ultra', 'quality.auto': 'Auto',
  'compass.north': 'N',
} as const

export type Key = keyof typeof en
