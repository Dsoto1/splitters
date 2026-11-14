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
