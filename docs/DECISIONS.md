# Decisions

Deviations from the brief's stack, with justification.

- **suncalc v2 (`getPosition` named export)**: the brief allows SunCalc; v2 returns compass-bearing azimuth in degrees, wrapped in `src/core/sun.ts`.
- **Pads inside `heightAt`**: levelled pads (house, coops, tanks…) are part of the single terrain function so rendering, snapping, and analysis agree.
- **Shadow rendering**: one fitted directional shadow map (4096² on High ≈ 7 cm texels over the 45 m plot diagonal) instead of CSM; the plot is small enough that cascades add cost without gain. Revisit if a larger plot is configured.
