# Assumptions

Every decision made where the brief left a choice. Edit values in `src/data/*` or the Site Setup panel.

1. **Plot orientation**: 33 m is east–west, 30 m north–south (editable in Site Setup).
2. **Gate positions**: main 3 m gate starts 4 m from the NW corner along the west fence (upper/north part); pedestrian 1 m door starts 22 m from the NW corner (lower/south part).
3. **Height datum**: the lowest plot corner (south edge, no cross slope) is y = 0, so the north edge is 30·tan(10°) ≈ 5.29 m.
4. **Cabin**: 5 × 5 m, walls 2.5 m, roof pitch 25°, 0.4 m overhang, centred east–west, 1.5 m from the south fence, door and two windows on the south wall, one window on each gable end. The ground under it is levelled by an automatic pad.
5. **Coordinates**: X east, Z south, Y up; origin at the NW corner of the plot.
6. **Time zone**: Asia/Tehran fixed UTC+3:30 (Iran abolished DST in 2022).
7. **Horizon profile**: default ridge elevation angles per azimuth are guesses for an Alborz foothill site (higher north, lower south). Edit in Site Setup.
8. **Surrounding landscape**: procedural ridges (not real DEM data).
9. **Plant data**: approximate defaults for 400–800 m Alborz north-slope conditions; flagged "approximate – verify" in the UI.
