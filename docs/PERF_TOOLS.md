# Performance tools

Three levels on a player's machine (the overlay, a match recording, a trace) and live figures on the
dedicated host. They measure where each frame's (and each tick's) time goes on real hardware: CI renders
on the CPU and can't see it. Nothing is uploaded anywhere: recordings and traces are files the browser
downloads, and you send them on by hand.

## Recording a match on your host (what to send)

1. Start the host as usual (98 bots, the map you want). On the /host page the status shows the tick
   split (see "On the host" below).
2. Join from Chrome. Play until the slow part (a big fight, the busy area).
3. **Esc → Settings → Record performance → Start recording.** Close the menu and play the whole match
   (or the stretch that's slow). Recording costs a few timer reads per frame.
4. **Esc → Settings → Stop and save** (leaving the match saves it too). Chrome downloads
   `tiletrigger-perf-<map>-<time>.json` (a few hundred KB for a ten-minute match).
5. Optional, at the worst moment: **Capture 10 s trace** (same menu). It downloads
   `tiletrigger-<map>-<time>.trace.json`.
6. From the host computer, `logs/perf-spikes.log` (next to `host.log`, in the Host Service's logs folder:
   the console prints where at start).

Send: the recording(s), the trace if you made one, `perf-spikes.log`, and a line saying the settings
(graphics, render scale) and anything you saw (e.g. "stutter at the boathouse").

To compare two runs (before/after a change, or medium against low):

```
node tools/perf/compare.mjs before.json after.json
node tools/perf/compare.mjs one.json            # a summary of one
```

It prints each system's average and p95 a frame, frame times, draws, shadow casters, characters animated
and skinned a frame, ragdolls, lasting effects, shaders built mid-match, the server's tick (when the match
ran on a server), the hitches (count, per minute, over 100 / 250 ms), the worst ones with what was in view,
and the places (10 m cells) where hitches cluster.

## Reading the overlay (F3)

```
fps        58  (frame 17.2 ms, slowest 5% 24.1 ms, worst 61 ms)
hitches    2 over 50 ms in the last minute
frame split sim on a worker · net 1.0 · game 7.7 · render 32.1 ms
render     scene 22.0 (culling 3.1) · shadows 7.5 · post 1.4 ms
systems    characters 6.2 (clips 2.9, skinning 0.8) · effects 0.6 · ragdolls 0.1 · flames 0.1 · hud 0.4 · other game 2.9 ms
drawn      647 draws · 1,900 meshes · 184 shadow casters
           39 characters (14 animated, 18 skinned a frame) · 3 effects · 2 lasting · 0 ragdolls awake
```

Averages over the last 5 seconds, ms per frame, all on the page's main thread:

- **frame split**: `sim` (the match, on a worker for offline play; a friend's game runs on its host),
  `net` (handling snapshots and events), `game` (the frame's own JS), `render` (Babylon's `scene.render()`).
- **render** splits `scene.render()`:
  - `scene`: the main pass, meaning the active-mesh evaluation (`culling`: frustum checks, LOD choice,
    world matrices) plus issuing the draws. It grows with draw calls and meshes, not with pixels.
  - `shadows`: the shadow map, plus the mist's depth map on misty maps. It grows with shadow casters.
  - `post`: post-processing (high graphics: bloom, SSAO).
  - The characters' clips and skinning run inside `render` but are counted under `characters`.
- **systems** splits `game` (and takes the character parts out of `render`):
  - `characters`: placing every character, the state machines and animation LOD, plus `clips` (Babylon
    evaluating the animation clips, then the aim and grip after them) and `skinning` (bone matrices).
  - `effects`: one-shot and lasting pack effects, hit sparks, blood, remote muzzle flashes.
  - `ragdolls`: the effects physics step (ragdolls, debris, falling bodies) and posing ragdolls.
  - `flames`: picking which prop flames draw.
  - `hud`: scoreboard, minimap, markers, this overlay, the pause menu.
  - `other game`: the rest of the frame's JS (prediction, interpolation, camera, view model, sounds).
- **counts** (timing-free, so they compare across machines): characters animated a frame (animation LOD
  skips far ones on most frames), skeletons skinned a frame, ragdolls awake, lasting effects drawn,
  draws, meshes and shadow casters.

What to look for: if `render` is large but `shadows` and `post` are small, the cost is per draw on the CPU
(fewer draws or characters helps, fewer pixels doesn't). If `characters` is large, compare "animated" with
"characters": every in-view character animating every frame means the LOD isn't reaching them.

**Copy performance report** (same menu) gives the last minute as text, now with the same split (avg,
slowest 5 %, worst per system) and the counts.

## The recording file

`format: "tiletrigger-perf-recording"`, version 1:

- `machine`, `settings`, `match`: browser, cores, GPU, graphics / render scale / frame cap, map, mode,
  players and whether it was a server.
- `perSecond`: one row a second, fields named in `secondFields`: frames, frame avg / p95 / max, each
  system's average and slowest frame (`characters`, `charAnim`, `charSkin`, `effects`, `ragdolls`,
  `flames`, `hud`, `net`, `game`, `renderScene`, `renderCull`, `renderShadow`, `renderPost`), draws,
  meshes, shadow casters, characters drawn, effects drawn, the counts (`animated`, `skinned`, `ragdolls`,
  `lasting`, `effects`, `built`: characters let through to be built), shaders built that second, the
  server's tick average and max (-1 when not on a server).
- `histograms`: per system, frames per bucket (`buckets`, ms edges), for whole-match p95s.
- `hitches`: every frame over 50 ms (up to 2,000): when, how long, how much of it the frame's own work
  covered (`busy`) and how much happened outside it (`outside`: building a character, a garbage collection,
  the browser), the split, the player's position and map, what was in view (characters, effects, lasting
  effects, ragdolls, draws, meshes, shadow casters), shaders built that second, the quality settings, and the
  server's latest tick figures (with its split) when there is a server.

## Level 3: a trace

**Capture 10 s trace** turns every span of the split into a `performance.measure` for 10 s and then
downloads the spans as a Chrome trace-event file.

- **With Chrome DevTools**: F12 → Performance → record (the round button), press Capture 10 s trace in
  the game, play, stop the recording after 10 s. Our spans are on the **Timings** track, all named `tt:`:
  `tt:frame` (a whole frame), `tt:render`, `tt:render: shadow + depth maps`, `tt:render: post-processing`,
  `tt:render: mesh evaluation`, `tt:characters (update)`, `tt:characters (clips + aim)`,
  `tt:characters (skinning)`, `tt:effects`, `tt:ragdolls + effects physics`, `tt:prop flames`, `tt:hud`,
  `tt:net in`. Under each, the Main track shows Babylon's own functions. A long `tt:frame` with little
  inside it means the time went elsewhere (garbage collection, a character being built after the frame,
  the GPU process): look at the Main track around it.
- **Without DevTools**: open the downloaded `.trace.json` in https://ui.perfetto.dev (Open trace file) or
  `chrome://tracing` (Load). It holds the same spans as a flame chart: frames with their systems nested.
  Babylon's own functions aren't in it (that needs the DevTools recording).

## On the host

The dedicated server keeps a per-tick breakdown on by default (`tickSplit`: a few hundred timer reads a
tick, against a 16.7 ms tick):

- **Sections** (ms a tick, averaged over the last second): `bots` (all bot AI) with `botThink`,
  `botPerceive`, `botPath`, `botAim`, `botDecide`, `nav`; the sim's `players`, `mounts`, `projectiles`,
  `scenario`; `snapshot` (building and sending snapshots); and lower-level ones (`move`, `los`, `commit`).
- **Snapshot bytes per client**: average and largest this second.
- **Spikes**: each tick over budget (1000 / 60 ms) is a line in `logs/perf-spikes.log` (JSON: the tick's
  time, its sections, bot AI and snapshot time, bots alive, humans, events, call counts such as how many bots
  thought), at most 5 a second, rolling at 2 MB (`perf-spikes.1.log` keeps the one before).
- **Where you see it**: the /host page's status (the tick split, snapshot size, ticks over budget), the
  launcher's Tick tile (hover for the split), every player's `stats` message (the overlay's server figures
  and a recording's hitch snapshots), and `HOST_STATS=1` prints the full line every second.

## Checks that use the counts

`pnpm perf:budget` (tools/perf/perf96.mjs) prints, per scenario, the split and counts above, skeletons
posed and characters animated a frame (counted from Babylon's own state, so they compare against builds
without these tools), characters in view by distance band, active meshes by kind, and the shader programs
built after the loading gate.

## A map's render counts, repeatably (still cameras)

`tools/perf/client-perf.mjs` plays a map offline in headless Chromium and prints a table row for it. It has two ways
of measuring:

- **Live (the default):** a bot match (`PERF_BOTS`, `PERF_MODE`, `PERF_SECONDS`), sampled from wherever the player
  happens to be while the view turns. It gives a frame rate and shows a busy match's order of magnitude, but its
  counts swing by half from run to run on an unchanged map (docs/map-briefs/urban/PERF_BASELINE.md has two such runs),
  so it cannot show what a change to a map cost.
- **Still (`PERF_STILL=1`):** fixed cameras and nobody else in the map. Use this to compare a map before and after a
  change, or one map against another.

```
pnpm build
PERF_STILL=1 node tools/perf/client-perf.mjs riot_junction neon_spire          # medium graphics
PERF_STILL=1 PERF_GRAPHICS=low node tools/perf/client-perf.mjs riot_junction
PERF_STILL=1 PERF_SHOTS=/tmp/views node tools/perf/client-perf.mjs ironworks   # also a picture of each view
```

What still mode does, per map:

1. Starts the deterministic match (`?test=1`: seed 1, the map's own mode) on the page's own thread and takes every
   other player out before each frame, so no bot, body or gunfire is drawn. The local player stays where it spawned
   (its body is not drawn in first person; its weapon is, the same one every run).
2. Holds the game's own camera at four viewpoints in turn. They come from the map file alone, so there is no per-map
   table and a new map needs nothing: **overview SW** and **overview NE** look at the middle of the play area (the
   map's boundary, else what its tiles and spawns cover) from a tenth of the way in from two opposite corners, a
   quarter of the diagonal up (12 to 60 m above the highest spawn); **eye, middle spawn** stands at the spawn nearest
   the middle, at eye height (1.7 m), looking at the spawn farthest from it; **eye, far spawn** stands at that farthest
   spawn looking at the middle. The camera is placed through the game's own `setCamera`, so plants, the environment
   renderer, shadows and prop flames follow it as they do in play.
3. Effects are left out (`PERF_STILL_FX=1` keeps them): a fire prop's flame sprites and particle bursts animate, so
   their draws never stop changing. At each view it first gives the models and textures the view asks for up to 20 s
   to arrive (a prop's full detail comes in after its stand-in), then waits until the counts have stopped changing: the middle
   reading of the last `PERF_STILL_FRAMES` frames (default 8) agrees within 1% with that of the frames before them,
   on every count. It gives up after `PERF_STILL_WAIT` seconds (default 90) and says so in the row's last column.
4. Prints one row a view (the middle reading of those frames; the range too when the frames differed) and the
   map's mean: draw calls, meshes drawn / all meshes, triangles drawn, shadow casters, materials.

What it does not give: a frame rate (nothing is timed; the software renderer's is meaningless anyway), the cost of
players, effects and gunfire (use the live mode or `pnpm perf:budget` for those), memory, or load time.

How repeatable it is, and what still varies: the urban baseline (docs/map-briefs/urban/PERF_BASELINE.md, "Still-camera
baseline") ran four maps twice at medium and low. Draw calls agreed within about 3% on every row (1% on each map's mean),
meshes drawn and triangles within 1%; at low graphics almost every count repeated exactly. Shadow casters are a rough
count (the shadow cache draws its static casters only on some frames). `PERF_DEBUG=1` prints each view's camera, and
names the meshes that came and went under a row whose frames differed.
