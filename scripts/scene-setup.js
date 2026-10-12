const g = window.__garden, a = g.actions
const mk = () => {
  a.placeObject('apple', 8, 8); a.placeObject('pear', 11, 9.5); a.placeObject('cherry', 6, 13); a.placeObject('walnut', 28, 5); a.placeObject('fig', 25, 18)
  a.placeObject('raised-bed', 12, 14); a.placeObject('raised-bed', 12, 16.5); a.placeObject('hive-langstroth', 25, 9); a.placeObject('chicken-coop', 26, 13)
  a.placeObject('tank-poly', 29, 23); a.placeObject('greenhouse', 8, 21); a.placeObject('cypress', 31, 12)
  a.placePolyline('path-gravel', [{x:2,z:10},{x:8,z:12},{x:14,z:15},{x:20,z:20}])
  a.select([])
}
mk()
const e = window.__engine
e.camera.position.set(-12, 9, 44); e.controls.target.set(16, 2.5, 14); e.controls.update()
