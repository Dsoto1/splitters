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
