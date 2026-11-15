# St. John's in a match, 2026-11-14 (owner's recording)

Read by lane A's lead session. Files are in the owner's Drive (`tiletrigger-perf-st_john_s-2026-11-14-15-39-27.json`, `tiletrigger-st_john_s-2026-11-14-15-38-48.trace.json`); not in the repo.

**Setup:** M1 Pro, Chrome (ANGLE Metal), High graphics, render scale auto, build 0.9.0 (80d9116), Team Deathmatch, 65 players (63 bots), local match, 164 s, 5,850 frames.

## Against 2026-11-10

The matches differ (11-10 was Roulette with 104 players), so read the trend, not the exact numbers.

| Per-frame median | 2026-11-10 | 2026-11-14 |
|---|---|---|
| Frame | 40 ms (about 25 fps) | **29.3 ms (about 34 fps)** |
| Frame p95 (per-second median) | 52 ms | 35.1 ms |
| Hitches over 50 ms | 546 in 204 s | **28 in 164 s** |
| characters | 13.6 ms | **5.5 ms** (charAnim 3.5) |
| renderScene | 11.5 ms | 11.2 ms |
| renderShadow | 6.7 ms (about 290 casters) | 6.9 ms (246 casters) |
| renderCull | 3.3 ms | 3.3 ms |
| net / game | 2.7 / 1.5 ms | 0.5 / 0.8 ms |
| Draw calls / meshes | about 1,540 / 740 | 1,519 / 764 |
| Server tick | 1.6 ms | 1.4 ms |

## What it says

1. **The character work since 11-10 paid off:** characters cost less than half, hitches fell about twentyfold.
2. **Rendering is now the frame:** scene, shadows and culling are about 21 of 29 ms, and the draw count has not moved. Fewer draws (merging or instancing St. John's static props and blocks, fewer shadow casters at a distance) is the next big gain: St. John's performance step 1.
3. **One match-start spike:** at 5.0 s one frame spent 185 ms busy, 157 ms of it charAnim, with 34 characters animated and 63 skinned in that frame (the animation budget not applied, or every character's first full pose taken in the same frame). Spread first poses over frames. Lane A, small.
4. **The other 27 hitches** are 50 to 120 ms frames with about 30 ms busy and 18 to 60 ms "outside" our code (GPU or browser); they should shrink with the draw count.

## The match-start spike: found and fixed (2026-11-14, `wip/anim-spike`)

**Cause.** Two kinds of first-time character work all landed in one frame when a crowd came into view together (the camera cut as play begins, everyone settling into the aim at the same moment):
- **The torso measurement.** A character's first settled long-gun pose measures the front of its torso for the rifle stock (`TorsoSurface.measure`): it skins every torso vertex on the CPU and forces extra skeleton updates (the frame's `skinned` count above `animated`). Timed in the page on this box: 10–33 ms a character (some 4–5 ms on an M1 Pro); about 30 of them in one frame is the 157 ms.
- **The first evaluation in a stepped band was at once** (`StepClock`), so everyone coming out of view, or from near into a 15 m+ band, was evaluated in the same frame regardless of their phase.

**Fix** (`client/src/game/animLod.ts`, `characterAnimator.ts`, `view.ts`):
- At most one torso measurement a frame across all characters (`FrameCap`, `TORSO_MEASURES_PER_FRAME`); the rest wait a frame or two with the stock unfitted (it is pushed out of the chest from then on).
- A character's first evaluation in a stepped band waits for its own frame of the band's grid (up to frames−1 frames: 1 at 15–25 m, 3 at 40–80 m), so a crowd is spread over the band's frames. Near characters still go every frame. A character never posed yet (its bind pose) stays hidden until that frame instead of showing a T-pose. Creatures unchanged.
- Unit tests: `client/test/animLod.test.ts` ("a crowd coming into view together").

**Measured** (scratch Playwright driver, not in the repo: Frost Basin, 64 bots, Low, SwiftShader; the bots held behind you, then all put 10–60 m in front of you in one tick, their torso measurements still to come, as at a match's start; 40 s of frames):

| | max animated a frame | max skinned | max charAnim (ms) | median charAnim (ms) |
|---|---|---|---|---|
| before (main 7b914c0e) | 38, 47 | 55, 65 | 333, 195 | 16, 13 |
| after | 15, 13 | 38, 25 | 52, 39 | 20, 23 |

(Two runs each; the bots in view differ a little between runs. Timings are this box's CPU, about 2–5 times an M1 Pro's.)

## St. John's performance step 1: the draws (2026-11-14, `wip/render-draws`)

**Where the 1,519 came from.** Measured with `PERF_STILL=1 PERF_GRAPHICS=high PERF_BREAKDOWN=1` (`tools/perf/client-perf.mjs`: every draw put down to its pass and the mesh drawing it), St. John's, nobody else in the map, SwiftShader. The "before" build is main (c681e8bc) with one change: the sun shafts' occluder list refreshed every 2 s instead of every 120 frames, as on a real GPU at about 34 fps (120 frames in software rendering was a minute, so the pass was often still empty). The eye-level views came to 1,312-1,663 draws, the owner's 1,519. Typical eye-level view, "eye, sun" (1,411):

| Source | Sun shafts pass | Main view | Shadow map (3 cascades) | Water reflection, depth | All |
|---|---|---|---|---|---|
| Environment trees and shrubs (thin-instance batches) | 219 | 107 | 192 | 8 | 526 |
| Shadow proxies (static geometry merged for shadows) | 206 | 0 | 0 (cached) | 0 | 206 |
| Prop batches (beds, dressers, chairs, trees) | 115 | 46 | 18 | 1 | 180 |
| Terrain plants (grass, flowers) | 72 | 34 | 0 | 0 | 106 |
| Paths and roads | 49 | 36 | 0 | 0 | 85 |
| Level (merged blocks, terrain) | 28 | 19 | 0 | 30 | 77 |
| Props drawn as instances | 17 | 48 | 0 | 2 | 67 |
| Doors (oak doors, about 13 boxes each) | 0 | 39 | 0-72 | 0 | 39-111 |
| Everything else (vehicles, pickups, fixtures, backdrop, post) | 20 | 46 | 5 | 8 | 79 |

So: **the sun shafts' occluder pass (High, sunny skies) was half of it** (700-740 draws a frame, as many as the main view), then the environment's batches (St. John's 139 trees in 8 variants made 133 batches: one or two trees each, in the view, the shafts and three cascades), the doors, the paths.

**What changed (general code, every map; looks the same on High):**
1. **Sun shafts** (`game/skyEffects.ts`): the pass is cleared black and occluders draw black, so only an occluder that hides the sun's disc changes a pixel. Each frame it now draws the disc and only the occluders whose bounds reach the narrow cone from the camera to the disc (`coversSun`), and the disc alone when the sun is out of view (`sunInView`, with a 20 degree margin). Its list is gathered every 2 s (was every 120 frames). 700+ draws to 1-90.
2. **Environment batches** (`environment/environmentVisuals.ts`): batched by squares that grow with the level of detail (64 m at full detail, 128, 256, then 512 m: `sectorSize`), so far trees of a variant share a batch. Same levels per tree, same geometry.
3. **Shadow cascades test thin-instanced batches** (`game/atmosphere.ts`): an environment or prop batch draws only into the cascades its bounds reach (it drew into all three).
4. **Prop batches** (`game/propBatches.ts`): lighter levels by wider squares (128, 256, 512 m: `propSectorSize`); which copies cast is kept as before (by their 128 m square).
5. **Doors** (`game/scenarioVisuals.ts` `mergeRigidParts`): a door's parts that move together and share a material are one mesh (an oak door's 13 boxes are 4). The game only; MapMaker keeps the parts.
6. **Paths** (`pathMeshes.ts` `mergePathMeshes`): ribbons and paint of the same material (style and draw rank) merged per 128 m square. The game only.

**Before and after** (High, still cameras; draw calls, all passes; "casters" as the tool counts them):

| View | Draws before | Draws after | Meshes drawn before / after | Triangles before / after | Casters before / after |
|---|---|---|---|---|---|
| overview SW | 1,492 | 542 | 974 / 820 | 2.77 / 1.35 M | 91 / 47 |
| overview NE | 1,533 | 555 | 857 / 699 | 2.92 / 1.51 M | 95 / 51 |
| eye, middle spawn | 1,510 | 568 | 617 / 526 | 2.69 / 1.47 M | 583 / 467 |
| eye, far spawn | 1,663 | 627 | 851 / 701 | 3.19 / 1.73 M | 158 / 76 |
| eye, sun (the sun in view) | 1,412 | 518 | 575 / 492 | 2.60 / 1.46 M | 583 / 497 |
| eye, quad | 1,313 | 480 | 441 / 384 | 2.54 / 1.32 M | 561 / 491 |
| eye, east | 1,479 | 523 | 504 / 422 | 2.80 / 1.27 M | 572 / 492 |
| **mean of 7** | **1,486** | **545** | 688 / 578 | 2.79 / 1.44 M | 378 / 303 |

(Two "before" runs agreed within 1 draw on the mean. Timings are not given: this is software rendering. The match adds the players: about 5.5 ms of characters on the owner's recording.)

**Other big maps** (High, the four standard still views, mean; Norman Shores and Backwoods have the sun in some views):

| Map | Draws before | Draws after | Meshes drawn before / after | Triangles before / after | Casters before / after |
|---|---|---|---|---|---|
| St. John's (7 views) | 1,486 | 545 | 688 / 578 | 2.79 / 1.44 M | 378 / 303 |
| Norman Shores | 2,206 | 1,058 | 951 / 825 | 5.03 / 3.32 M | 380 / 304 |
| Capitol Mall | 969 | 529 | 709 / 708 | 3.51 / 2.03 M | 437 / 440 |
| Backwoods | 1,690 | 851 | 771 / 730 | 3.24 / 2.13 M | 940 / 880 |

Norman Shores keeps about 310 draws in the scene's own depth map (`DepthRenderer`: the mist and water read it; on High it should come from the pre-pass), the next thing to look at there; it was not changed here.

**Looks:** pictures of every view before and after (the helper's scratchpad, `compare/`: before, after, difference ×4) differ only where things move by the clock (grass and leaves in the wind, water ripples, a boat, a spinning pickup): mean difference 0.1-2.9 levels of 255. The sun's shafts with the sun in view (St. John's "eye, sun", Norman Shores' middle spawn) are the same.

**Not changed:** MapMaker (doors and paths stay one mesh a part; the environment and prop batches are the same code there), destructibles (breakable props are not batched; destructible blocks unchanged), quality tiers (Low has no shadows or shafts: it gets the batch, door and path savings). Not yet on a real GPU: the owner's next recording will say what the 21 ms of rendering became.

## Re-recorded 2026-11-15 (after render cost step 1, the draws)

The owner's recording `tiletrigger-perf-st_john_s-2026-11-15-02-01-45.json` (build 613b8e0, which has step 1): same M1 Pro, High, 65 players, local; Capture the Flag this time (11-14 was Team Deathmatch), 451 s.

| Per second, mean | 11-14 | 11-15 |
|---|---|---|
| Frames per second | 36.1 | 41.1 (median 39) |
| Frame | 28.8 ms | 25.3 ms |
| Draws | 1,491 | 625 |
| Meshes / casters | 731 / 254 | 622 / 139 |
| renderShadow | 7.0 ms | 4.2 ms |
| renderScene | 10.7 ms | 9.6 ms |
| renderCull | 3.2 ms | 3.1 ms |
| characters (charAnim) | 5.4 (3.5) ms | 5.3 (3.8) ms |
| effects + ragdolls | 0.8 ms | 1.5 ms (CTF: more fights in view) |
| Hitches over 50 ms | 28 in 164 s (0.17/s) | 31 in 451 s (0.07/s) |

- The draws fell as measured in software (about 1,490 to 625); shadows saved about 3 ms. renderScene fell only 1 ms for 58 % fewer draws, so the main pass is no longer bound by draw count: next look at what it spends (per-mesh CPU, material/uniform updates, or GPU fill at 1920x1080@2).
- The match-start spike is gone (no charAnim hitch at 5 s). Of 31 hitches: 13 are outside the frame (browser or GC), 13 renderScene, 3 characters, 2 net (a 10 ms net step).
- Biggest left per frame: renderScene ~10 ms, characters ~5 ms, shadow ~4 ms, cull ~3 ms.

## The hitches left in the 11-15 recording (2026-11-15, `wip/hitches-1115`)

Read by a helper of lane A's lead from the owner's 11-15 recording and its 10 s trace, then measured in a scratch
Playwright driver (not in the repo): St. John's, Low, 63 bots, SwiftShader on a loaded 4-core box, three bots killed
a second so the bodies run past the 32-body limit, then a new round (`clearCorpses`). Going bodies' work (taking a
body past the limit out, the bodies of a new round, the spread steps) timed in the page per frame; before and after
in the same build (`?perfoff=bodyspread` is the old code), two runs each.

**Bodies going (the character-body disposal).** When a body goes (past MAX_CORPSES, sunk away on Fade, a new round,
a look changed, a player gone) its character went back to the body pool, or was disposed, in that frame: thawing its
frozen pose recomputes every joint (most of it), then the clips, materials and node tree. One body was 1-6 ms here; a
frame with several deaths paid for each, and a new round all of them at once. Now `View.retireAvatar` hides it and
drops its ragdoll, hitbox, flash and canopy at once, and the rest goes over the next frames (`game/frameSpread.ts`:
1.5 ms a frame after the first step, and at least a twentieth of what waits, so a slow page still keeps up). The
pool is topped up first thing in `updateAvatars`, before that frame's respawns.

| ms of body work in a frame (this box) | before | after |
|---|---|---|
| in play: p95 | 4.9, 7.3 | 3.0, 2.7 |
| in play: worst frame | 15.0 (42.6 when the match replayed and cleared its bodies) | 7.4, 5.1 |
| a new round with 32 bodies: worst frame | 32.4 (and 42.6, 51.6 at a replay) | 4.7, 7.4 (53 and 44 ms in all, over 31 and 12+ frames) |

Unit tests: `client/test/frameSpread.test.ts`. On an M1 Pro expect roughly a third to a half of these figures.

**The rest of the recording's 31 hitches, not changed here:**
- **13 outside the frame (60-110 ms, our own work about 25 ms):** garbage collection or the browser. An allocation
  profile of the page (St. John's, 40 s) puts most of the frame's garbage in Babylon itself: starting and stopping
  clips (`driveClipGait`: Animatables for every clip change, about 13 MB), the scene's per-frame instance lists
  (`_registerInstanceForRenderId`, 9 MB), skinning on the CPU (`getPositionData` for `TorsoSurface.measure`, once per
  new body: 17 MB in 40 s with bots respawning, the biggest site that is ours), `propVisuals.apply` iterating every
  prop visual as `[id, visual]` pairs each frame (6 MB; Smythe Hall's claim, left alone), interpolation's `sample`
  (4 MB). Candidates: the torso surface measured once per look instead of once per body (it is a few ms a body too,
  4-5 ms on an M1 Pro); `propVisuals.apply` over only the visuals that animate.
- **13 renderScene (8-23 ms of a 50-60 ms frame):** the main pass itself, the "Main scene drawing" item in the queue.
- **3 characters (10-13 ms, charAnim 5-10 ms):** the frames where several characters' clips start together and a
  new body measures its torso; the clip starts are Babylon's (`beginDirectAnimation`), the measure is capped at one a
  frame (match-start fix).
- **2 net (about 10 ms; one message of 6-13 ms in the trace):** a snapshot with many events, plus the per-snapshot work:
  reconciling the local player (replaying its inputs), and committing the prediction world after the vehicles move
  (`mountState.apply`: a physics pipeline step per snapshot, about a tenth of the net time in a profile). Doing them
  once a frame instead of once a snapshot needs the reconcile moved out of `session.ts`'s message handler (the
  colliders must be current when it replays), so it is left for its own change.
- Also seen: a material glow change (`setGlow`, the spawn-protection shimmer easing in tenths) marks every mesh of
  the scene for a shader check (`_markAllSubMeshesAsDirty` walks `scene.meshes`): about 1 ms a respawn here.

## Main scene drawing: what renderScene spends (2026-11-15, `wip/render-scene-2`)

The queue item "Main scene drawing on St. John's": renderScene stayed about 9.6 ms on the owner's M1 Pro when the draws
fell 58 %. Measured by a helper of lane A's lead in a scratch Playwright driver (not in the repo; built on
`client-perf.mjs`'s still mode): St. John's, High, nobody else in the map, the eye-level views "eye, middle spawn" and
"eye, far spawn", an unminified build, SwiftShader on a shared 4-core box at a load of 11-16. Two readings per frame:
every WebGL call counted by the pass it falls in (the render targets: shadow cascades and sun shafts; the main
pass: Babylon's draw phase) and whether it changed anything (a uniform set to the value its program already holds, a
binding to what is already bound); and a CDP CPU profile of the page's main thread. The owner's recording and trace
of 11-15 were not on this machine any more (the scratch folder was cleared by a restart), so the trace's own samples
were not read; what the owner's next recording should show is listed at the end.

**Where the main pass goes (before):**

| Per frame | eye, middle spawn | eye, far spawn |
|---|---|---|
| Draws (all passes) / meshes drawn | 584 / 683 | 638 / 877 |
| GL calls, main pass | 3,992 (1,276 change nothing) | 5,174 |
| GL calls, render targets (shadows, shafts) | 1,196 (309 change nothing) | 948 |
| Uniform numbers sent, main pass | 20,890 | 26,677 |
| Of the main pass's calls | `drawBuffers` 728, `uniform1fv` 613 (all unchanged values), `uniformMatrix4fv` 577 (550 unchanged), `bindVertexArray` 450, `bindTexture` 291 (77 unchanged) | about the same shares |

- **The sun's shadow, sent again on every draw.** Each draw that receives the sun's shadow sets the three cascades'
  `lightMatrix` (48 numbers), `viewFrustumZ` and `frustumLengths` (307 of each a frame at the middle spawn, every
  one the value already set): Babylon caches single values per program, never arrays or lists of matrices. Thin
  instanced batches set the same identity `world` matrix again (243 of 270 in the main pass, 237 of 243 in the
  shadow cascades).
- **Draw buffers switched twice a draw.** The pre-pass renderer (the scene's extra targets on High) sets the draw
  buffers to its targets before each draw and back to one after it, though most neighbours want the same: 728 calls.
- **The page's own JavaScript** under the render, from the profile: about 24 ms a frame on this loaded box (likely
  3-5 ms on an M1 Pro): active-mesh evaluation 1.8-2.1 ms, `isReady` checks 1.6-1.8 (the shadow generator's
  per-draw readiness check builds its defines each time), light binding (`_bindLight`, `_updateLightData`) 1.5-2.5
  (a material that isn't frozen binds the lights on every draw), the rendering manager's lists 0.3-1.0. The rest of
  the sampled time was spent blocked inside GL calls, waiting for SwiftShader to draw: here that is the software
  renderer and says nothing about a real GPU.
- **What a GL call costs here** (a scratch page, 100,000 calls, no drawing): 0.10 µs (`uniform1fv`), 0.13 µs
  (`uniformMatrix4fv`, 48 numbers), 0.25 µs (`drawBuffers` switching) of page time each, on this box. Each call is
  also decoded and checked in the GPU process and translated by ANGLE to Metal on a Mac; that part was not
  measurable here.

**What changed (general code, every map; WebGL2 only):**
1. **`src/glStateCache.ts`** (installed by `createEngine`; `?perfoff=glcache` turns it off): a uniform set to the value
   its program already holds is dropped (kept per program and uniform name; a sub-range, a transposed matrix or more
   than 64 numbers go straight through; linking a program again starts it afresh), and a `drawBuffers` call is held
   until a draw, clear or framebuffer switch uses it and is sent only when it differs from what that framebuffer
   has. Both follow GL's own rules (uniform values belong to their program, draw buffers to their framebuffer), so
   what is drawn cannot change. Unit tests: `client/test/glStateCache.test.ts`.
2. **`ScenarioVisuals.apply`** walks only the visuals that animate (doors, lights, breakables), not every visual as
   `[index, visual]` pairs each frame (6 MB of garbage in 40 s in the hitches profile); the glass panes' changed
   set is reused.
3. **The torso surface measured once per look** (`TorsoSurface.measure(ch, look)`, the avatar's spec): its points
   are in the chest joint's own space, the same for every body of a look, so a second body of a look takes the
   first one's (it skinned the torso on the CPU for every new body: 17 MB in 40 s and a few ms a body).

**After (same views, same counts of draws and meshes):**

| Per frame | eye, middle spawn before / after | eye, far spawn before / after |
|---|---|---|
| GL calls, main pass | 3,992 / 2,206 (-45 %) | 5,174 / 2,714 (-48 %) |
| GL calls, render targets | 1,196 / 946 (-21 %) | 948 / 723 (-24 %) |
| Uniform numbers sent, main pass | 20,890 / 458 | 26,677 / 696 |
| `drawBuffers` calls, main pass | 728 / 8 | 1,010 / 10 |
| Draws, all passes | 584 / 584 | 638 / 638 |

On the page alone this saves about 0.3-0.5 ms a frame at this box's per-call cost (2,000-2,700 calls); the GPU
process does the same less. Whether it moves the owner's 9.6 ms depends on what that time is, which only the owner's
machine can say.

**Looks:** pictures of the three views (overview SW, eye middle spawn, eye far spawn; 640 x 360, High) before and after differ only where the wind moves things: overview 0.18 levels of 255 on average (0.35 % of pixels by more than 8), far spawn 0.43 (0.72 %), middle spawn 2.71 (8 %: the oak in front and the grass swaying, the walls, sky and gun identical). The helper's scratchpad, `shots/` (before, after, difference x4).

**For the owner's next recording (St. John's, a match, High; F3's copy plus a 10 s trace):**
- renderScene against 9.6 ms, and the frame rate. A fall of 1-2 ms says the page's GL calls were the cost.
- In the trace, the **GPU process's main thread** (`CrGpuMain`): how busy it is in a frame. If it is busy nearly the
  whole frame, the page waits on it inside GL calls (the wait shows as renderScene on the page), and these cuts
  should show there first. If it has room, the next cut is the page's own per-draw JavaScript (the shadow generator's
  `isReady` per draw, light binding for unfrozen materials: the backdrop belt's props and the set-piece props, about
  220 of the 683 meshes drawn at the middle spawn, use materials that are not frozen).
- The **GPU's own time** (the trace's GPU rows, or Chrome's `--enable-gpu-benchmarking`): at 1920 x 1080 on a 2x
  screen the default render scale draws 2400 x 1350 (`renderRatio`: at most 1.25); if the GPU is the bound one, the
  tests are the render scale (Options → Display) and Medium's shadows on the same view.
- Which render scale the recording used (Options → Display; say it with the recording if the report does not).
