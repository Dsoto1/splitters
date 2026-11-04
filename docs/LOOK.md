# Look: the world's grade and surfaces

The owner's note (2026-11-04): "everything looks too much like a toy". Two easy wins, approved first:
a filmic, calmer grade for the world (this page), and real surfaces on man-made Kenney props
(docs/CONTENT_PIPELINE.md, "Prop surfaces").

## The grade (`applyWorldGrade`, game/graphicsSettings.ts)

Matches and MapMaker draw through it; the main menu's lineup, Character Select's portraits and the
Character Designer keep the brighter menu grade (`applyToneMapping`), and HTML (HUD, menus) never goes
through either.

- **Tone mapping**: ACES (filmic) at exposure 1.05 (was 1.15) and contrast 1.15 (was 1.12): whites roll
  off instead of glowing, shade keeps its depth. Vignette 1.0 (was 1.2).
- **Colour curves** (`WORLD_GRADE`): saturation -12 overall and -20 in the highlights. Kenney's candy
  colours calm down; no tint, so the hue of every part is kept and props stay recognisable. (A cool tint in
  the shadows was tried and dropped: it turned beige walls grey.)
- **Light balance** (`LIGHT_BALANCE`, backdrop.ts): each sky's own `light` (content/skies.json) times
  0.8 for the sky fill (was 0.9) and 1.6 for the sun (was 1.5), and a darker ground bounce (0.5, was
  0.62): sunlit faces stand out from shade, corners and the ground under things read darker (contact).
  Per-sky retunes are data: change `light` in content/skies.json, never code for one map.
- **Shadows** (medium and high): bias 0.001 and normal bias 0.014 (were 0.0015 / 0.02), so a shadow
  meets what casts it.
- **Ambient occlusion** (high, WebGL2): radius 1.3 m (was 1.6), strength 1.15 (was 0.9).

Cost: none on low and medium. The grade is Babylon's image-processing step, which every material (or,
on high, the post-process) already runs; colour curves add a few instructions to it. Shadow bias and
light levels are numbers. The same code runs on WebGPU and WebGL2.

## Tuning

Change the grade in `WORLD_GRADE`, the light balance in `LIGHT_BALANCE`, a sky's light in
content/skies.json. Then review a city, an industrial, an interior and a snow map at eye level and from
above (the screenshots in the HANDOFF entry of 2026-11-04 were made that way) and regenerate the visual
baselines (`pnpm e2e:baselines`).
