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
**Options → Accessibility → Reduce flashing**, also in the pause menu (Settings → Accessibility): **on by default**,
saved as `tiletrigger.reduceFlashing` (`game/reduceFlashing.ts`), applied at once in a running match. Off, everything
looks as it always did.

What flickered, and what the setting does to each:

| What | Off (as before) | On |
|---|---|---|
| Lightning: the Arc Caster, arc turrets, electric fences (`view.addArc`, Binbun's Electric FX bolts and crackles) | a new crackling bolt and a crackle for every arc, 7 a second from an Arc Caster, 10 from a turret | one steady beam per source (`steadyArcs.ts`: a thin core in a soft glow and a glow where it lands); its ends glide after the targets, it comes up over 0.1 s, holds while arcs keep coming and fades over 0.35 s after the last |
| Fast beam weapons (Arc Caster, lasers) | a beam flash per shot | the same steady beam |
| An arc turret's charge | its glow and ball flicker 7 times a second; the pack's crackling ball of lightning | steady glow, the plain ball |
| Electric fence wires (border and placed) | hum at 2 and 7.5 Hz plus random crackles | a steady glow breathing slowly |
| Blasts (`blastFx`, the plain fireball, vehicle explosions) | full brightness at once; a white-hot flash ball on vehicles | dimmed the nearer they are to the camera (`blastStrength`: 30 % within 0.6 radii, full beyond 3.6 radii) and drawn smaller there (`blastSize`: half size within 0.6 radii, full beyond 3.6 radii, so the camera is never inside a fireball whose sheets sweep across the whole view: four grenades 3-5 m off read up to 7 transitions a second at full size, none at half), brought up over 0.12 s (`GodotVfx` gain and fade-in: each brightness step a copy of the effect's materials; additive pieces are scaled down, pieces drawn over the scene (smoke, debris, cut-out fireballs) only have their bright parts capped, at 0.3 + 0.7 × gain, so smoke keeps its grey), no white flash ball |
| Muzzle flashes (yours and others') | as the pack draws them | 75 % size, 45 % opacity (`SAFE_MUZZLE`) |
| A pair's muzzle flashes (dual wielding, your own two guns in first person; `pairView.ts` `PairFlashGate`) | every round of both guns flashes | the two guns share one flash, each at `SAFE_MUZZLE`: never two at once, never more often than one gun's rounds come (a round's flash is left out when either gun flashed within the gun's firing interval; both triggers on one tick take turns). Its moment: `pair` |
| Someone else's pair's muzzle flashes (dual wielding in third person: another player's two guns, or yours in third person; `view.ts` `remoteFlash`) | every round of both guns flashes at its own gun's muzzle | the same shared flash per character (`PairFlashGate`, one per character): both guns' rounds arriving in one snapshot take turns, never two at once, never more often than one gun's rounds. Its moment: `pairtp` |
| Map lights logic drives (`blink`, `light_blink`, `light_flash`, colour changes) | hard on/off up to 10 times a second; "Flash" flares to 2.5 × | a smooth pulse at most once a second between 55 % and full (`blinkLevel`); "Flash" flares to 1.35 ×; level and colour ease (off to full in about 0.4 s) |
| Candles that gutter | random drops near dark | a slow, slight sway |
| Small blinking indicators (a mine's light, a thrown mine, a sticky grenade, the bomb, a laser trap's warning) | blink 1-12 times a second | a gentle pulse at most once a second; the laser warning shows its beams faint and steady |
| The hurt vignette (HUD) | saturated red edge, snapping on with each hit | a duller red (not a saturated red by WCAG's test), reaching less far in, eased in over 0.15 s, held steady under fire, gone over 0.8 s (`hurtVignette.ts`) |
| Diving into water or another liquid | the haze snaps on and off at the surface | eased over a third of a second |
| Pickups' floor glows (`lootGlow.ts`, Binbun's Loot VFX) | streaks turning slowly, a slow bob, sparkles drifting up; eased in over a second | held still, no sparkles, 0.5 of its strength instead of 0.8, eased in over two seconds; its dark outline as dark as with the setting off (it adds no light) |
| Status auras on other characters (`statusFx.ts`, Binbun's Stylized Status FX: burning, poisoned, slowed by goo, chilled or frozen) and the plain shell | flames, bubbles and ice crystals drifting at the pack's speed, eased in over a quarter second; the plain shell pulses about twice a second | half speed, 0.65 of its strength instead of 0.8, eased in over about 0.8 s; the plain shell holds still |
| The low-health warning (`lowHealth.ts`, below 35 % health) | the screen's edges darken toward near-black and the world loses colour, eased in over 0.6 s and out over 1 s; a heartbeat every 1.35 s at 35 % to every 1 s near death; the health bar brightens 25 % with each beat (a soft sin² bump over 0.4 s) | the same darkening and grey, eased in over 1.2 s; the bar's bump at 0.6 of that. Never a red, never brighter than the scene, never more than once a second. Its moment in the flicker check: `lowhealth` |
| A portal's swirl and a jump pad's lift (`fixtureFx.ts`, Binbun's Portal VFX and Magic Area VFX) | the swirl turns slowly and draws inward, the lift's streaks rise slowly; eased in over about a second | held still, dimmer (portal 0.7 of its strength, pad 0.6), eased in over about two seconds |
| Blood by character's sparks and wisps (`bloodVisuals.ts`; Binbun's Electric FX off a robot, Hit FX tinted white-grey off a ghost) | at the pack's size and strength (the wisp 0.45 of it, eased in), at most one of each every 60 ms | 0.8 of the size, 0.55 of the strength, eased in over 0.12 s, at most one of each a second (a machine gun on a robot no longer crackles ten times a second); the `flashing` flow's `blood` moment |
| A rank-up's badge (`rankGlow.ts`; Options → Ranks & badges, the kill feed and over the head) | swells to 1.45 × and a soft halo in its colour rises and fades over a second | swells to 1.2 ×, the halo at most 0.3, eased in and out over the second |
| A scope's surround and shadow (`scopeFeel.ts`; the Sniper Rifle, Railgun, Marksman and Battle Rifle) | the black round the glass comes in at once with the zoom and fades out over 0.1 s; the shadow at the glass's edge slides up to half the glass's radius with a turn or a kick, at 0.94 darkness | it fades out over 0.22 s; the shadow moves at most 0.3 of the radius, at 0.6 darkness, through a quarter-second filter (hard turns left and right barely move it). Its moment: `scope` |
| The sniper glint (`scopeGlint.ts`: a sniper scope aimed your way, seen from 18 m) | a small soft point at 0.85, up over 0.15 s; steady, under the bloom threshold | 0.5, up over half a second. Its moment: `glint` |

Not changed (nothing flashes there): smoke grenades' haze (already eased), status tints (CSS transitions), the sky (no
storm lightning exists; a storm flash would have to be capped and eased the same way).

### The flicker check (e2e flows `flashing` to `flashing5`, `e2e/flicker.mjs`)

`E2E_ONLY=flashing,flashing2,flashing3,flashing4,flashing5 node e2e/run.mjs` (`E2E_FLASH_MOMENTS=arc,blast` records just
those moments, in their flows). The check is five flows, each some 5 min on CI (a moment is 35-100 s drawn in software),
so a retry fits in a shard; `FLASHING_PARTS` in `e2e/run.mjs` lists each flow's moments by scene, and each flow makes
the scenes its moments need:

| Flow | Night scene | Day scene |
|---|---|---|
| `flashing` | arc, fence, blast, cookoff, pairtp | |
| `flashing2` | muzzle, pair, jackpot, fight, rankup, glint | |
| `flashing3` | rain, snow, loot, fixtures, status | |
| `flashing4` | blood, alarm | lowhealth, scope |
| `flashing5` | | shelves, tunnel, lootlight, hitkick |

**A new moment goes in the shortest flow** (`e2e/timings.json`): add it to the scene, then its name to that flow's
list in `FLASHING_PARTS` (a moment in no flow fails the check). All five are mapped wherever the check is
(`e2e/flowMap.mjs`, `FLASHING_FLOWS`).

MapMaker makes a night scene with its own edits (two dark rooms, one lit by a red alarm light blinking four times a
second, an Arc Turret, an electric fence); in play the brightest moments are
recorded frame by frame at 30 frames a second of the page's own time (`e2e/frameClock.mjs` freezes the page's clock
and steps it a frame at a time, so a recorded second is a second of play however slowly CI draws), each canvas frame
with the HUD's hurt tint (and a scope's surround and shadow) drawn over it, at 160 × 90:
- an arc fight up close (an Arc Turret locked on you 4.5 m off, your Arc Caster on three bots between you);
- the electric fence (three bots against it 2-4 m in front of you, zapped twice a second each);
- four grenade blasts 3-5 m in front of the camera in 0.8 s;
- a machine gun firing at a wall 3.5 m off in the dark room;
- six pickups' floor glows coming up 2-4 m in front of you at night, as High graphics draws them;
- a rank-up twice, a second apart: a bot's badge 3 m in front swelling and glowing over its head and in the kill feed (`rankup`);
- by day, the low-health warning coming up over white tiles as your health drops to 10 % (`lowhealth`);
- a sniper's glint coming up twice 32 m off at night, the second time through your own scope coming up (`glint`);
- the alarm light in its dark room;
- by day, a sniper scope coming up and going away three times in two seconds over white tiles, then hard turns through it (`scope`);
- by day (its second scene): sprinting out of a lit tunnel and back, and four pickups' glows coming up on white tiles
  (`lootlight`), where the rings must read too: WCAG contrast at least 1.3 on average over each ring with the setting
  on (`lootRingContrast`: the pickups' models hidden, the frame with the glows against the frame without).

The measure is WCAG 2.3.1 ("Three Flashes or Below Threshold"), the way photosensitivity analysers apply it:
- relative luminance per pixel; a frame's change is the largest change at least **a quarter of the screen** made
  (brightening or darkening), counting only pixels whose darker state is **below 0.8**;
- same-way changes add up over frames; reaching **0.1** is a transition (a fade over several frames counts once);
- a flash is a pair of opposing transitions: **more than 3 flashes in any second (more than 6 transitions) fails**;
- the same on red saturation ((R − G − B) × 320 in linear light where R / (R + G + B) ≥ 0.8; a change of 20 is a
  red transition), and **a quarter of the screen turning saturated red within 0.25 s fails at once**.

With the setting on every moment must pass; the same moments with it off are measured and reported as numbers only.
The flow writes frame strips (every 4th frame) and the numbers to `e2e-artifacts/` (`flashing-<moment>-<on|off>.png`,
`flashing-<night|day>-<the flow's first moment>.json`). A new effect that can fill a large part of the screen gets a moment here (CLAUDE.md, "Accessibility").

## Camera shake, toggle aim and controller vibration (next to Reduce flashing)

Three more settings sit beside Reduce flashing, in **Options → Accessibility** and the pause menu's **Settings →
Accessibility**; saved in this browser (`tiletrigger.combat`, `game/combatPrefs.ts`) and applied at once in a running
match (GUNPLAY_SPEC §42).

| Setting | Default | What it covers |
|---|---|---|
| **Camera shake** Off / Reduced / Full | Full | Every movement of the view that isn't your own aim, all in `game/cameraShake.ts`: blasts and vehicle crashes near you, the jolt of a heavy round leaving the barrel (revolver, slamming rifles, shotguns; automatics never shake), the hit kick when you're struck (`hitKick.ts`), and the gentle roll as you lean or ride a zipline (that roll is also off with the system's reduce-motion setting). Reduced keeps 35 %, Off none. The weapon's mechanical recoil and a scope's sway move your real aim, so they stay (fairness). There is no landing jolt. A unit test fails if a new `view.shake` call doesn't take its amount from `cameraShake.ts`. |
| **Aim** Hold / Toggle | Hold (Toggle on a phone or tablet) | Mouse, X, a controller's LT, touch's Aim. Toggle: one press aims, the next stops. It lets go when you sprint (Shift, L3, touch's Sprint; not with a scope or optic in hand, where Shift holds your breath), change weapons, get in a vehicle, die or leave play. A reload keeps it: the sights come back up when it ends (as in most shooters). A melee heavy swing and a pair's second trigger are always held. |
| **Controller vibration** on / off, strength 10-100 % | On, 70 % | Light rumble on firing (a buzz a round for automatics, a thump for heavy shots), hits taken, and blasts and crashes near you; only a controller in use rumbles (`game/rumble.ts`). The Gamepad API's dual-rumble `vibrationActuator`, else the older `hapticActuators` pulse; where neither exists the row is hidden and nothing happens. |

None of them adds light or flicker, so the flicker check is unchanged.

