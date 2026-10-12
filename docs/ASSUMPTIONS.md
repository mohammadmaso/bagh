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
10. **"Tall trees on the north side of beds"**: in the northern hemisphere shade falls to the north, so the rule warns when a tall tree (≥ 4 m mature, configurable) is *south* of a bed within its shadow reach (1.8 × height); the message says "put tall trees north of beds".
11. **Livestock/compost runoff** uses the *natural ground* (pads ignored) so a coop on a levelled pad still counts as uphill; a 70° cone around the downhill direction and 25 m reach by default.
12. **Fence opacity in the sun analysis** is 12 % (wire mesh); gates likewise.
13. **Neighbours/forest** are decorative context (no shading); only the editable horizon profile blocks sun.
14. **Example layout** loads into its own plan ("Example layout") so it can be deleted without touching your work.
15. **Quality auto-selection** runs a ~40-frame benchmark after load and picks Low/Medium/High/Ultra; any manual choice or `?q=` disables it.
16. **Scale/units**: metres everywhere; plan PDF auto-picks the largest standard scale that fits (1:150 on A3 for this plot).
