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

## No flicker: coplanar faces (`visibleFaces`, packages/shared/src/map/faces.ts)

Texture flicker on map geometry was z-fighting: two faces in the same plane (a floor slab's edge and the wall
over it, wall-run ends at corners, trim flush with walls, floors over floors, a block's top level with a tile's).
The renderer used to grow every box by a random 2-14 mm so one face would win; at range the depth buffer can't
tell a few millimetres apart (about 6 mm at 100 m on WebGL2), so they fought again, and boxes that drew the same
random amount fought at any range. Now a build-time pass works out the faces to draw:

- Boxes sharing a rotation (axis-aligned, the same yaw give or take quarter turns, the same tilt) are compared in
  that frame. Parts of a face inside another box, or back to back with another box's face, are dropped. Where two
  faces share a plane and facing, one draws, by a fixed priority: on tops, floors (and blocks) over solids over
  walls over trim; on every other face, trim over solids over walls over floors; then a box with its own material
  (style pack pieces, painted blocks) over a themed one; then the later box. A box wholly inside another draws nothing.
- Faces of differently turned boxes that still share a plane (the tops of two blocks at different yaws, curved-wall
  joints) are cut as convex polygons by the same priority.
- A cut face still reaches 0.5 mm under the face that won (the seam), so no pixel cracks open along the joins; the
  sliver is far below a pixel past arm's length.

Rendering only: physics, navigation and the server never see it (the collider list of every map is unchanged).
`packages/shared/test/zfight.test.ts` audits every map in maps/ (coplanar overlaps left: none) and samples that
every open face point draws exactly once. MapMaker warns (`geometry.coplanar`) when a free block's face lies in
the same plane as another piece's in a different look (only one shows), and **Overlaps** in its top bar highlights
those places.

### Depth buffer

WebGL2 keeps reverse depth on, though it buys little there: the canvas's depth buffer is 24-bit fixed point and
WebGL's depth range is [-1, 1] (Babylon has no clip-control path), so precision stays about d² × 6e-7 m (1.5 mm at
50 m, 6 mm at 100 m, 24 mm at 200 m) either way. A float depth target plus EXT_clip_control would make it
sub-millimetre at any range but needs a full-screen copy every frame and patching Babylon; with no coplanar faces
left it isn't needed. WebGPU (opt-in, `?renderer=webgpu`) now runs without a stencil buffer (nothing uses one), so
Babylon gives it a 32-bit float depth buffer, and with reverse depth on WebGPU's [0, 1] range that is the precise
setup at no cost. Not measurable in the container (SwiftShader's depth is float either way); not judged on a GPU.
