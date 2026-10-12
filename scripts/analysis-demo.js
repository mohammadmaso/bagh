const g = window.__garden, a = g.actions
const mk = (type, x, z, extra) => a.placeObject(type, x, z, 0, extra)
mk('raised-bed', 10, 10); mk('raised-bed', 10, 13); mk('raised-bed', 14, 10)
mk('walnut', 11, 7, { ageOffset: 10 }); mk('apple', 24, 9, { ageOffset: 6 }); mk('pear', 26, 14, { ageOffset: 6 })
mk('hive-langstroth', 4, 8); mk('chicken-coop', 20, 6); mk('well', 21, 18); mk('greenhouse', 6, 20)
a.placePolyline('path-gravel', [{x:2,z:10},{x:8,z:12},{x:14,z:15},{x:20,z:20}])
g.store.getState().setTime({ ageYears: 10 })
g.store.getState().setUI({ panel: 'analysis' })
const e = window.__engine
e.camera.position.set(-10, 20, 45); e.controls.target.set(16, 2, 14); e.controls.update()
