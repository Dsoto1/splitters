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

## No flicker: props (`propFaces.ts`, the level's depth bias)

The owner's report on Flatpack Depot (2026-11-05, "significant flickering", on an Android phone) was mostly props:
many models have flat faces lying in the planes of their own bounding box, so placed on a floor, against a wall or on
another prop they share a plane with what they touch. Where both faces can be seen from the same side they fight:
- a rug whose cloth is its base (the Quaternius Rug lies at y = 0 facing up: exactly in the floor's plane);
- double-sided bases and backs (most Kenney factory, shop and sci-fi props: open shelving's bottom board, crates, the
  freezers' backs): seen from above, a double-sided base is in the floor's plane;
- props stacked flush on props (a box on a crate, shelves back to back, rail lengths laid end over end).
The faces are measured from the built models (`tools/content/prop-contacts.mjs` → `propContacts.generated.ts`, part
of `pnpm content:check` and `content:rebuild`): for each of the six planes of a prop's bounding box, its triangles in
that plane, by which way they face (or both, for a double-sided material).

- **Props against the level**: every level material (the per-style ones, the merged level and terrain) carries a small
  depth bias (`LEVEL_DEPTH_BIAS`: polygon offset factor 1, units 2): the level draws a hair behind anything lying in
  its planes, so the prop always wins. The bias is in depth-buffer steps, so it holds at any range and on any depth
  buffer (a phone's too); a slope factor of 1 is about one pixel's depth, nothing shows through a wall. Level faces
  never share a plane with each other (visibleFaces above), so it changes nothing else; decals (bullet holes, blood,
  roads) keep their own negative offsets and only gain margin.
- **Props against props**: `propFlushLifts` draws the later prop of each flush pair FLUSH_LIFT (4 mm) away from the
  other along the shared plane's normal (onto, or into itself), alternating along chains so lifts never pile up (the
  most on any map: 11 mm). Drawn only, in the game and in MapMaker (worked out again when props change): collision, the
  map file and the server never see it.
- The audit (`packages/shared/test/zfight.test.ts`) runs both over every map: props in a level plane (4,915 over the 89
  maps, 298 on Flatpack Depot) are drawn by the bias (a client test checks every level material has it); prop pairs
  flush (754, 58 on Flatpack Depot) all clear after the lifts: none left, no allow-list.

Not seen in the container: SwiftShader's float depth buffer draws an exact tie the same way every frame, so these
spots looked steady here; a phone's or a desktop GPU's 24-bit buffer breaks the tie differently pixel by pixel and
frame by frame (the flicker).

## No flicker: glass and texture shimmer

- **Glass** writes no depth (glassVisuals.ts `glassMaterial`). Panes are drawn in 32 m chunks sorted by distance; with
  depth writes, a nearer chunk drawn first hid the panes behind it until the order flipped as you moved (windows seen
  through windows popping). Now every pane blends in any order (one tint: the same colour either way).
- **Texture shimmer on phones** (`levelMipBias`, levelMerge.ts). A phone draws at 0.75 px per CSS pixel on a 2.5-3x
  screen, so each drawn pixel is shown 3-4 screen pixels wide; a speckled floor (terrazzo, gravel, carpet) whose
  specks are about a drawn pixel twinkles as you turn, mipmaps or not. The merged level's colour and normal lookups
  take a mip bias of a level per doubling of that magnification past 1.5x (a whole level on a phone at Performance,
  about 0.1 on a desktop at its usual scale, at most 1): a touch softer, steady. Set when the level is built (a render scale
  changed mid-match applies from the next map). The normal-map lookup is taken on every pixel and then chosen (it sat
  in a branch: undefined mip level on some phone GPUs). WebGL2 (the merged level); WebGPU draws the level unmerged.

### Depth buffer

WebGL2 keeps reverse depth on, though it buys little there: the canvas's depth buffer is 24-bit fixed point and
WebGL's depth range is [-1, 1] (Babylon has no clip-control path), so precision stays about d² × 6e-7 m (1.5 mm at
50 m, 6 mm at 100 m, 24 mm at 200 m) either way. A float depth target plus EXT_clip_control would make it
sub-millimetre at any range but needs a full-screen copy every frame and patching Babylon; with no coplanar faces
left it isn't needed. WebGPU (opt-in, `?renderer=webgpu`) now runs without a stencil buffer (nothing uses one), so
Babylon gives it a 32-bit float depth buffer, and with reverse depth on WebGPU's [0, 1] range that is the precise
setup at no cost. Not measurable in the container (SwiftShader's depth is float either way); not judged on a GPU.

## Reduce flashing (seizure safety)

The owner dropped a planned flashbang ("I don't want to give people seizures", 2026-11-06) and asked for this setting.
**Options → Accessibility → Reduce flashing**, also in the pause menu (Settings → Sound and screen): **on by default**,
saved as `tiletrigger.reduceFlashing` (`game/reduceFlashing.ts`), applied at once in a running match. Off, everything
looks as it always did.

What flickered, and what the setting does to each:

| What | Off (as before) | On |
|---|---|---|
| Lightning: the Arc Caster, arc turrets, electric fences (`view.addArc`, Binbun's Electric FX bolts and crackles) | a new crackling bolt and a crackle for every arc, 7 a second from an Arc Caster, 10 from a turret | one steady beam per source (`steadyArcs.ts`: a thin core in a soft glow and a glow where it lands); its ends glide after the targets, it comes up over 0.1 s, holds while arcs keep coming and fades over 0.35 s after the last |
| Fast beam weapons (Arc Caster, lasers) | a beam flash per shot | the same steady beam |
| An arc turret's charge | its glow and ball flicker 7 times a second; the pack's crackling ball of lightning | steady glow, the plain ball |
| Electric fence wires (border and placed) | hum at 2 and 7.5 Hz plus random crackles | a steady glow breathing slowly |
| Blasts (`blastFx`, the plain fireball, vehicle explosions) | full brightness at once; a white-hot flash ball on vehicles | dimmed the nearer they are to the camera (`blastStrength`: 30 % within 0.6 radii, full beyond 3.6 radii), brought up over 0.12 s (`GodotVfx` gain and fade-in: each brightness step a copy of the effect's materials; additive pieces are scaled down, pieces drawn over the scene (smoke, debris, cut-out fireballs) only have their bright parts capped, at 0.3 + 0.7 × gain, so smoke keeps its grey), no white flash ball |
| Muzzle flashes (yours and others') | as the pack draws them | 75 % size, 45 % opacity (`SAFE_MUZZLE`) |
| Map lights logic drives (`blink`, `light_blink`, `light_flash`, colour changes) | hard on/off up to 10 times a second; "Flash" flares to 2.5 × | a smooth pulse at most once a second between 55 % and full (`blinkLevel`); "Flash" flares to 1.35 ×; level and colour ease (off to full in about 0.4 s) |
| Candles that gutter | random drops near dark | a slow, slight sway |
| Small blinking indicators (a mine's light, a thrown mine, a sticky grenade, the bomb, a laser trap's warning) | blink 1-12 times a second | a gentle pulse at most once a second; the laser warning shows its beams faint and steady |
| The hurt vignette (HUD) | saturated red edge, snapping on with each hit | a duller red (not a saturated red by WCAG's test), reaching less far in, eased in over 0.15 s, held steady under fire, gone over 0.8 s (`hurtVignette.ts`) |
| Diving into water or another liquid | the haze snaps on and off at the surface | eased over a third of a second |

Not changed (nothing flashes there): smoke grenades' haze (already eased), status tints (CSS transitions), the sky (no
storm lightning exists; a storm flash would have to be capped and eased the same way), the health bar (no low-health
pulse exists).

### The flicker check (e2e flow `flashing`, `e2e/flicker.mjs`)

`E2E_ONLY=flashing node e2e/run.mjs`. MapMaker makes a night scene with its own edits (two dark rooms, one lit by a
red alarm light blinking four times a second, an Arc Turret, an electric fence); in play the brightest moments are
recorded frame by frame at 30 frames a second of the page's own time (`e2e/frameClock.mjs` freezes the page's clock
and steps it a frame at a time, so a recorded second is a second of play however slowly CI draws), each canvas frame
with the HUD's hurt tint drawn over it, at 160 × 90:
- an arc fight up close (an Arc Turret locked on you 4.5 m off, your Arc Caster on three bots between you);
- the electric fence (three bots against it 2-4 m in front of you, zapped twice a second each);
- four grenade blasts 3-5 m in front of the camera in 0.8 s;
- a machine gun firing at a wall 3.5 m off in the dark room;
- the alarm light in its dark room.

The measure is WCAG 2.3.1 ("Three Flashes or Below Threshold"), the way photosensitivity analysers apply it:
- relative luminance per pixel; a frame's change is the largest change at least **a quarter of the screen** made
  (brightening or darkening), counting only pixels whose darker state is **below 0.8**;
- same-way changes add up over frames; reaching **0.1** is a transition (a fade over several frames counts once);
- a flash is a pair of opposing transitions: **more than 3 flashes in any second (more than 6 transitions) fails**;
- the same on red saturation ((R − G − B) × 320 in linear light where R / (R + G + B) ≥ 0.8; a change of 20 is a
  red transition), and **a quarter of the screen turning saturated red within 0.25 s fails at once**.

With the setting on every moment must pass; the same moments with it off are measured and reported as numbers only.
The flow writes frame strips (every 4th frame) and the numbers to `e2e-artifacts/` (`flashing-<moment>-<on|off>.png`,
`flashing.json`). A new effect that can fill a large part of the screen gets a moment here (CLAUDE.md, "Accessibility").
