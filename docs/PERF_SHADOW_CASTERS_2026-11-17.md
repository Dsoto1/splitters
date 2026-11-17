# Cheaper small shadow casters, 2026-11-17

QUEUE Features, lane B (owner, 2026-11-17: "4a"), for St. John's step 4b: photo 16's spruces and photo 18's curved
limestone wall were left out because they put Scott Johnston / Hazelwood's front view over the plan's 10 % rule in
shadow casters (PLAN_2026-11-12.md "4c", "4e": Medium 46 → 61). Branch `wip/shadow-casters`. `?perfoff=smallcasters`
turns the whole change off on the same build (game/perfSwitches.ts).

## What made the casters

Read with `tools/perf/client-perf.mjs` still mode and its new `casters:` breakdown (`PERF_BREAKDOWN=1`), on St. John's
with the spruces and wall added (a scratch copy of the map, below), Medium:

- **Trees, shrubs and hedges** (`env_*` batches: one mesh per species variant, level of detail, part and 64 m square).
  They cast as they were drawn, so every frame: thin-instanced, they never joined the static shadow cache (it keeps a
  thin-instanced mesh only when it says when its copies change), and a batch changes whenever a copy moves between
  levels as the camera walks. Two new spruces in a square were two more meshes in every frame's shadow pass.
- **Props with levels of detail.** Every kit prop has levels (kit walls, piers, lamp posts, benches). In fewer than 8
  copies a model is GPU instances of a source with Babylon levels; with 8 or more, prop batches per level and square. Both
  were left out of the merged shadow proxies (shadowProxy.ts: "no levels of detail") and so cast on their own every
  frame. The six wall segments were six entries in the shadow map's list and a draw a frame; the two lamp posts took the
  map's banner lamp posts to 8 copies, so they became a batch with levels (two more draws a frame).
- Not the cost: characters (their own rules), effects (no shadow), static level geometry (proxies, cached).

## The change

`game/shadowCasters.ts` holds the rules (tested in `packages/client/test/shadowCasters.test.ts`).

1. **Static shadow sets for trees and rocks, by cascade** (`environment/environmentVisuals.ts`, `shadowSets`). The drawn
   batches cast nothing. Each species variant casts through shadow-only batches made once when the map is placed (layer
   mask 0: no camera draws them), one per square and part, never changed as the camera walks. They are static casters
   from the first frame (`staticCaster`, shadowCache.ts `isStaticCaster`): the static shadow cache draws them only when a
   cascade moves (Medium: the box moved 6 m; High: a cascade past its margin), not every frame. Cascade-aware
   (`shadowLayers`, read by atmosphere.ts's per-cascade test): the near cascades and Medium's one map take the full
   detail (level 0, 64 m squares), the far cascade on High the lightest level that cast before (level 2 of a tree,
   256 m squares; a far cascade's texel is a quarter metre). The card stand-in never casts, as before. Near shadows are
   the full detail they were; mid-distance trees (24-56 m on Medium) now cast their full detail instead of level 1.
2. **Props with levels of detail cast at full detail through the shadow proxies.** A GPU instance of a model with
   levels is merged into the proxies (one mesh per 48 m square, cached) at its full detail, unless a level is a turning
   picture card or nothing, or the prop can break (a proxy would keep a broken prop's shadow). Batched props with levels
   (`game/propBatches.ts`, `shadowSets`) cast through static shadow-only batches of their full detail per 128 m square,
   which are merged into the proxies like the never-changing batches already were. Indoor and small copies cast as before
   (nothing, and the near batch).
3. **Small clutter in a band.** Small props, pickups and held guns cast within 20 m (was 15) and stop past 24 m; between
   them a caster keeps what it had, so a shadow never blinks at the line as you strafe across it (`smallCasts`; the
   shadow list and the prop batches' near shadow batches both use it).
4. The cascade test leaves a static set for other cascades out of a map's list altogether (Medium never lists the far
   set).

What it does to the look: no shadow pops or changes within 20 m (near shadows are the full detail they were; small
clutter now casts to 20 m); shadows no longer change shape when a tree or prop switches level (they did: a prop cast
with the level the camera drew); far trees on High cast their level 2 as before; small clutter's shadow ends at 20-24 m
with hysteresis. Nothing flashes (Reduce flashing: no new bright moment; shadow changes are fewer than before). The
static cache redraws a cascade when it moves, as it did: those frames draw the trees' sets with the proxies (the "max"
readings below).

## Before and after

SwiftShader on a loaded 4-core box (load 4-11 from other agents' work), client-perf's still mode (`PERF_STILL=1`), one
build, `?perfoff=smallcasters` for before. Columns: draw calls (all passes), the **shadow pass's own draws a frame**
(`PERF_SPLIT=1`: the real count; in brackets the most in one frame, a static-cache redraw), the Shadow casters column
(the shadow map's list length: see the note), and the shadow pass's time a frame (ms, SwiftShader: compare runs only).
`PERF_WALK=10` walks the camera 10 m ahead at 0.1 m a frame: cascades move and levels change, which a still view hides.

### St. John's: the hall front with the spruces and the wall (the step 4 plan's case)

A scratch copy of `maps/st_johns.json` (not committed) with what PLAN "4c" placed and took out: two spruces either side
of Scott Johnston / Hazelwood's arch (-117.5, -57) and (-106.5, -57), a low curved wall of six Low Stone Wall segments
(sandstone) on a 7 m arc west of the spur, a Stone Pier at its end, and two banner lamp posts by the spur (11 entities).
Views: "SJH front" from the north walk (eye -112, 1.8, -30 looking at the arch) and "SJH arch close" (eye 16 m from the
arch). Medium.

| View | Map, code | Draws | Shadow draws a frame (max) | Casters | Walk 10 m: shadow draws (max) |
|---|---|---|---|---|---|
| SJH front | main's map, main's code (the rule's base) | 199 | 16 (16) | 33 | 17.2 (74) |
| SJH front | + spruces and wall, main's code | 212 | 22 (22) | 45 (+36 %) | 23.2 (79) |
| SJH front | + spruces and wall, **this branch** | **190** | **0 (0)** | **19 (-42 %)** | **1.7 (83)** |
| SJH arch close | main's map, main's code | 205 | 21.9 (70) | 41 | 14.2 (76) |
| SJH arch close | + spruces and wall, main's code | 220 | 27.9 (75) | 52 (+27 %) | 21.7 (81) |
| SJH arch close | + spruces and wall, **this branch** | **201** | **10.6 (79)** | **20 (-51 %)** | **0.8 (82)** |

With the spruces and the wall in, the hall front reads fewer casters and draws than main's map without them: well
inside the 10 % rule (-42 % casters, -5 % draws at the front; -51 %, -2 % close up). What is left in the list there is the
ambient animals and the avatars' caps (moving). A static-cache redraw (the max column) costs about what it did (79-83
against 74-81: the trees at full detail): it happens once per few metres walked, not every frame.

### St. John's as it is (main's map), the four standard views, Medium

| View | Draws before → after | Shadow draws a frame | Casters |
|---|---|---|---|
| overview SW | 452 → 450 | 11 → 8 | 29 → 19 |
| overview NE | 458 → 455 | 12 → 8 | 15 → 9 |
| eye, middle spawn | 374 → 349 | 33 → 8 | 421 → 364 |
| eye, far spawn | 516 → 501 | 37 → 21 | 41 → 25 |
| mean | 450 → 439 | | 127 → 104 |

### Flavius Rule (`sandfall_colosseum`), Medium

An arena of stone with few trees or props with levels: nothing to gain, and nothing lost. Draws 265 / 269 / 161 / 201
before and 265 / 270 / 164 / 201 after; shadow draws a frame 8 / 8 / 33 / 2 and 8 / 8.5 / 36 / 2; casters 9 / 13 / 347 / 29
and 9 / 14 / 356 / 29 (the middle spawn's +3: pickups now cast to 20 m, was 15; within one run's noise there).

### A forest: The Spillway (390 trees), Medium

View "forest": eye (-48, 3, -100) looking north through the two densest clusters.

| | Draws | Shadow draws a frame (max) | Casters | Walk 10 m: shadow draws (max) | Shadow ms (still / walk) |
|---|---|---|---|---|---|
| before | 457 | 86 (86) | 101 | 88.1 (114) | 4.2 / 4.2 |
| after | 372 | 1 (1) | 2 | 1.3 (132) | 2.6 / 2.3 |

86 of the view's 457 draws were the trees' and flowers' shadows, every frame; now the static cache holds them and a
frame draws the one moving caster. A redraw frame draws 132 (was 114 at most): once per few metres walked.

### High (three cascades, sun shafts, reflections)

| View | Draws before → after | Shadow draws a frame (max) | Casters | Shadow ms |
|---|---|---|---|---|
| St. John's + spruces and wall, SJH front | 410 → 337 | 89.3 (282) → 11.1 (263) | 458 → 383 | 13.8 → 10.5 |
| The Spillway, forest | 938 → 576 | 372.5 (524) → 28.7 (527) | 548 → 321 | 16.6 → 11.0 |

On High each tree batch drew into every cascade it reached, every frame: The Spillway's forest view spent 365 of its 945
draws on the shadow map. Now a still frame draws the moving casters; a redraw frame costs about what it did.

Pictures (High, device scale 2), before (`?perfoff=smallcasters`) and after, same build: the scratchpad's
`shots-shadows/before/` and `shots-shadows/after/` (`st_johns_sjtest-high-SJH_front.png`,
`the_spillway-high-forest.png`). St. John's is at dusk (its sky), so its shadows are faint either way; the forest's
dappled shadows on the snow are the same trees, their shapes a little crisper where trees 24-56 m off now cast their full
detail.

## Notes

- **The Shadow casters column** is the length of the shadow map's list of casters that frame, not the shadow pass's
  draws: it counts each GPU instance of a prop on its own (one draw for all of them), leaves out what the static cache
  holds, and includes disabled templates near the camera (`env_tpl_*`, the effects' `gvBase_*`: never drawn). The
  ~400-caster readings of views near a map's middle (St. John's middle spawn, Flavius Rule's) are mostly those. This
  change keeps the column comparable with earlier readings (it changes nothing in how it counts); `PERF_SPLIT=1`'s
  shadow draws are the cost.
- **Fixed after (owner, 2026-11-17, "2a"; `wip/breakable-shadow`):** a breakable prop without levels of detail, in
  fewer than 8 copies (its own node of GPU instances), was merged into the shadow proxies and kept its shadow after it
  broke until the proxies were rebuilt. Every prop that can break now casts on its own (`proxyable`: its meshes are
  marked `breakable`, propVisuals.ts), so its shadow goes when its node is switched off; test
  `packages/client/test/breakableShadow.test.ts`. A few more casters a frame on destruction maps (one draw per model).
- The `?perfoff=smallcasters` switch restores the old paths whole (no static sets, levels cast as drawn, 15 m line).
- WebGPU and WebGL1 have no static cache: there the static sets draw every frame (their squares cut by the cascade test),
  about as many draws as the drawn batches made, at full detail near.
- Tools: `tools/perf/client-perf.mjs` gains `PERF_SPLIT`, `PERF_WALK` and the casters breakdown (docs/PERF_TOOLS.md).
