# 96-player frame budget (offline and browser-hosted matches)

Owner report: 48 v 48 bot matches get choppy, worst when the bots bunch up.
The browser's own match (offline play, MapMaker TEST, Host game) used to run
`Match.step()` on the page's thread, in a `setTimeout` loop next to Babylon's
render loop. At 96 players a tick costs 5–9 ms spread out and 9–18 ms in a
clump (measured below), so at 60 Hz the simulation alone wanted 30–100 % of
the core that also renders, and a slow frame made the next one slower.

## What changed

- **The match runs in a module Web Worker** (`game/simWorker.ts`, driving
  `game/matchHost.ts`). `LocalTransport` keeps its interface: snapshots,
  events, rosters, notices and host replies come back as messages; inputs,
  ready, host commands, friends' link traffic (Host game, Go online) and the
  tab's visibility go to it. What the page reads synchronously (host state,
  live rules, carry-over for chains) is mirrored as `facts` the worker sends
  when they change (checked every 30 ticks and after every host command).
- **Fallback**: no `Worker`, a worker that fails to load before the welcome,
  `?sim=main` or `localStorage['tiletrigger.sim'] = 'main'` run the same
  `MatchHost` on the page's thread with the same messages. Browser tests that
  poke `window.__match` synchronously use that mode; everything else reaches
  the match through `window.__sim.eval(src, arg)` (both modes).
- **No catch-up spiral**: a wake runs at most `MAX_CATCH_UP_TICKS` (4) ticks,
  then drops the backlog (reported as `lateTicks` in stats); a hidden tab may
  run up to 150 a wake so the match keeps real time while nothing renders.
- **48 v 48 stays the target, offline and hosted.** Bots fill any match up
  to 96. A player-hosted online game takes up to `BROWSER_HOST_MAX_GUESTS`
  (10) friends: the host's upload carries their snapshots. No warning in the
  Arcade setup; if the device can't keep up (the match falls behind real time
  or frames crawl for 5 s), one quiet HUD line suggests fewer bots or lower
  graphics. See HOSTING.md.

## Measuring

`pnpm build && node tools/perf/perf96.mjs [map ...]` plays a map offline with
96 players in headless Chromium, keeps the player alive, and measures two
scenarios for `PERF_SECONDS` each: bots spread over the map as they play, and
everyone teleported into one 40 m square every 2 s. Per rendered frame it
splits the page thread into sim (ticks run on the page), message handling,
the game frame's JS, `scene.render()` and the rest; per tick (`simProfile`,
wherever the match runs) bots / physics / rest; and the sim loop's wakes,
largest batch and dropped ticks. `PERF_SIM=main|worker` picks the thread.

## Results (26 Oct 2026)

Headless Chromium with SwiftShader (CPU rendering), graphics low, 96 players
TDM. **Caveat**: the 4-core box was shared with several other agents' builds
and browser runs (load average 20–35 throughout), and SwiftShader renders on
the same cores, so frame rates here (0.1–0.4 fps) say nothing about a real
GPU; read the page-thread sim share and the per-tick sim costs, and rerun on
a quiet desktop with `PERF_GPU=1` for frame times.

"Before" is the same build with `PERF_SIM=main` (the old architecture: the
match on the page's thread; the old loop also capped catch-up, at 5 ticks a
wake, then dropped the backlog after 10 ticks behind).

| Map, scenario | Sim on the page thread before (main) | after (worker) | Sim tick ms before / after* | Bots / physics ms a tick (after) | Loop: largest batch, ticks dropped (after) |
|---|---|---|---|---|---|
| Frost Basin, spread | 105 ms/s (55 ticks/s) | **0 ms/s** | 5.0 / 17.2* | 6.1 / 9.2 | 4, 1,064 in 33 s |
| Frost Basin, clumped | 9 ms/s (2.6 ticks/s: starved) | **0 ms/s** | 8.7 / 8.9 | 3.2 / 4.8 | 4, 516 |
| Norman Shores, spread | 234 ms/s (55 ticks/s) | — | 6.3 | 2.2 / 4.0 (before) | 4, 50 |
| Norman Shores, clumped | 2 ms/s (3 ticks/s: starved) | — | 17.6 | 7.3 / 10.0 (before) | 4, 1,163 |

\* Wall-clock per tick on a box at load 20–35: the after/spread run landed in a
busier minute (load 23.5); compare within a row only loosely.

What the numbers show:

- **The page thread no longer runs the simulation**: 105–234 ms of every
  second spread out (10–23 % of the page's core before rendering anything)
  goes to zero; in the worker run the page spends its time on messages
  (snapshots, 49–154 ms/s), its own frame JS and rendering.
- **Clumped, the old layout starves the match**: with the sim on the page,
  a clump made each frame so slow that the match ran at 2.6–3 ticks a second
  (everything else was dropped catch-up). In the worker the match kept
  ticking on its own core whatever the page did (1,910 ticks counted in the
  clumped window against 50–63 with the match on the page; its own drops
  came from the box's load).
- **No spiral**: the largest batch per wake stayed at the cap (4) in every
  run; backlog beyond that is dropped and counted, never chased.
- Per tick, physics (character moves) outweighs bot thinking at 96 players,
  spread or clumped; bot thinking roughly doubles in a clump. The bot-side
  cuts are in MAP_BUDGETS.md ("Clumped 48 v 48").

## Against the target: clumped 48 v 48 offline, default graphics

The owner's target is 48 v 48 with bots running smoothly offline in the
browser. `PERF_GRAPHICS=medium PERF_SIM=worker node tools/perf/perf96.mjs
norman_shores frost_basin` (Medium is the default), 27 Oct 2026, box load
2–4 for the "worker" rows and 4–8 for the "+ bot AI pass" rows (the bot AI
changes of MAP_BUDGETS.md "Clumped 48 v 48" applied on top, measured
together). Frame times are SwiftShader's (CPU rendering on the same 4 cores),
so they are far above any GPU's; the worker's tick times are real CPU time.

| Map, clumped | Page frame p50 / p95 (ms) | Worker tick p50 / p95 (ms) | Largest catch-up batch | Draw calls | Active meshes | Triangles | Skinned meshes (characters) |
|---|---|---|---|---|---|---|---|
| Norman Shores, worker | 1,005 / 10,220 | 2.4 / 7.4 | 3 | 6,316 | 5,492 | 4.75 M | 799 (105) |
| Norman Shores, + bot AI pass | 1,160 / 1,160 (1 frame) | 2.9 / 22.8* | 4 | 5,469 | 8,340 | 5.10 M | 723 (112) |
| Frost Basin, worker | 631 / 4,020 | 2.2 / 6.2 | 4 | 1,611 | 1,436 | 0.85 M | 444 (121) |
| Frost Basin, + bot AI pass | 584 / 2,046 | 2.5 / 7.1 | 2 | 560 | 375 | 0.40 M | 115 (118) |

\* The second run met a busier box (other agents' jobs started); its spread
rows also show a "rest" share three times the first run's. The bot AI pass's
own before/after is measured headless in MAP_BUDGETS.md, where it is
repeatable.

**The simulation fits**: in its worker a clumped 48 v 48 tick takes 2–3 ms at
the median and 6–8 ms at p95 on a quiet box, inside the 16.7 ms a 60 Hz tick
has, on a core of its own. The page's thread spends nothing on it.

**Rendering is what's left above 16 ms** (on any machine whose GPU isn't far
ahead of this CPU-rendered run). What dominates, in order:

1. **Characters and skinning**: ~110 skeletons, and 720–930 skinned meshes
   drawn a frame on Norman Shores (7–8 skinned submeshes per character:
   body parts, gear, weapon), each skinned and drawn separately (and once more
   for the shadow map where characters cast shadows). The clump puts all 96 in view at once.
2. **Draw calls**: 5,500–6,400 a frame on Norman Shores (1,000–1,600 on Frost
   Basin) with 5,500–8,300 active meshes: the map's props and dressing plus
   the characters' submeshes. Frost Basin, a third of the draw calls, renders
   about twice as fast.
3. **Triangles**: 4.1–5.1 M on Norman Shores (terrain plants and props), 0.4–
   1.2 M on Frost Basin.
4. Effects are not a factor here: no particle systems were live in these
   samples, three lights.

The page's own frame JS (prediction, interpolation, visuals, HUD) is 30–500 ms
in these CPU-rendered frames and snapshot handling 10–120 ms a second; both
scale with the slow frames and should be re-read on a GPU machine
(`PERF_GPU=1`). Suggested render pass: merge each character's submeshes
(or bake them into one skinned mesh per look), GPU skinning / animation
textures with instancing for distant characters, impostors or lower LODs for
far bots, and fewer distinct prop draws on Norman Shores.

## Render pass: characters (27 Oct 2026)

Characters were most of the draw calls in a clump: each look is 8–12
skinned parts (torso, belts, legs, feet, arms, hood, head, eyebrows,
eyes, hair), 2–15 rigid gear pieces (hats, goggles, vests, bandoliers), a
cloned gun of 1–5 meshes and a team marker with its own material, every one
drawn again into the shadow map.

What changed:

- **Parts merged per material** (`content/mergeParts.ts`, every match): the
  parts of a character that share the skeleton, world matrix and material
  (which `dress` already made identical: all outfit pieces of a family share
  one texture, the head and arm skin share the skin texture) become one
  skinned mesh, their low-detail copies likewise (one LOD level kept per
  merged mesh). Missing vertex colours fill in white, missing extra bone
  influences with zero weight, the exporter's unused extra UV sets are
  dropped, and vertex alpha is ignored for opaque materials. Same triangles,
  bones and materials: nothing changes on screen.
- **Gear in one draw**: every gear piece is bound wholly to the joint it hung
  on (vertices moved into the skin's bind space through that bone's
  current matrix, faces flipped back where the import mirrors), coloured per
  vertex, and merged into one skinned mesh with one shared material whose
  metallic/roughness come from a small finish table texture by UV.
- **Crowds only** (more than 24 players, as the existing animation LOD):
  held guns are GPU instances (one draw per gun model and part for everyone),
  team markers are instances of one disc per colour, and characters outside
  the view (already left out of drawing) pause their clips and skip the
  after-animation aim and grip until they are seen again.
- Character eyes cast no shadow (it fell inside the head).

Per look (character viewer, all 36 looks): **11.4 → 4.1 meshes on average,
max 25 → 7**. `e2e characters` keeps at most 8 and 5 on average.

**Norman Shores, clumped, Medium**, the same placement for both builds
(every player held on the same spots round one centre by a step hook in the
match, the player 7 m and 30 m off it looking in, blood off; SwiftShader at
box load 6–20):

| View | Build | Draw calls | of which characters | Active meshes | Skinned | Frame ms |
|---|---|---|---|---|---|---|
| 7 m (55 in view) | before | 2,914 | 2,515 | 1,055 | 419 | 7,284 |
| | after | 1,111–1,464 | 600–611 | 671–1,119 | 214–218 | 1,353–2,318 |
| 30 m (all 95 in view) | before | 5,539 | 5,035 | 2,099 | 809 | 9,680 |
| | after | 1,894–2,290 | 1,173–1,375 | 1,235–1,968 | 411–422 | 4,618–4,936 |

(Two after runs; the map's own draws varied between them, characters' did
not.) Characters' draw calls fall by 73–79 %, skinned meshes by half, and
the CPU-rendered frame takes a half to a fifth as long.

`perf96.mjs` (the player's own view, so how many characters are in view
varies; now reported as `shown`), clumped, Medium:

| Map | Build | Draws | Active meshes | Triangles | Skinned (characters in view) | Skinned per character |
|---|---|---|---|---|---|---|
| Norman Shores | before | 4,800 | 5,446 | 4.04 M | 595 (79) | 7.5 |
| | after | 2,436 | 3,642 | 3.22 M | 236 (57) | 4.1 |
| Frost Basin | before | 1,049 | 737 | 0.69 M | 239 (23) | 10.4 |
| | after | 313 | 384 | 0.48 M | 86 (27) | 3.2 |

Draws per character in view (everything else included): Norman Shores
61 → 43, Frost Basin 46 → 12. `PERF_MAX_DRAWS=n` makes `perf96.mjs` exit 1
when a clumped frame averages more draws than `n`.

Left for later (done in the next pass, below): the map side, a character's
remaining 3–5 materials, and animation LOD for far, visible characters.

## Render pass 2: map side, character atlas, animation LOD (27 Oct 2026)

Where a clumped Norman Shores frame's draws went before this pass (Medium,
everyone held round the middle, the player 30 m off looking in, 95 characters
in view; draws attributed per mesh with `scene.render` instrumented):

| Pass | Draws | of which characters | scenario pieces | pickups | the rest |
|---|---|---|---|---|---|
| Main | 1,057 | 411 | 189 | 83 | 374 |
| Ground-mist depth map | 1,004 | 411 | 140 | 83 | 370 |
| Shadow map | 713 | 338 | 93 | 52 | 230 |

The second row was the surprise: maps with ground mist (`backdrop.mist`,
Norman Shores has it; Frost Basin doesn't) render the whole view again into
a depth map for the height-fog post effect on Medium and High, so every
draw saved counts twice there.

What changed:

- **Destructibles are thin instances** (`ScenarioVisuals.batchDestructibles`,
  in the game; MapMaker keeps meshes): every part of the same shape and
  material, on every destructible on the map, is a GPU thin instance of one
  mesh. Bodies share a material per colour and darken with damage through
  their instance colour (the same product the per-body material made); a
  broken one's instances collapse to nothing. Norman Shores' 104 panes and 2
  gas cylinders went from 318 meshes to a handful.
- **Pickups' shapes are GPU instances** of one mesh per shape and material;
  their guns are instances of the gun model.
- **Placed props are instances of their model merged per material**
  (`ModelLibrary.instantiateStatic`): a model of many parts (a dresser of
  drawers, a kitchen unit) is one mesh per material, so one draw per material
  for every copy on the map and far fewer meshes for Babylon to look at every
  frame. Tinted props, and models that animate, skin or morph, keep the old
  path. The loader's empty `__root__` mesh becomes a plain node for instanced
  models and characters (a thousand fewer meshes on Norman Shores).
- **Foliage draws per 64 m sector**: plants are still thinned per 32 m chunk
  (the same plants drawn, the same density by distance), but each plant mesh
  draws per 2 × 2 chunks: a quarter of the meshes.
- **Character atlas** (`content/characterAtlas.ts`, game and character
  viewer): skin, hair and eyes share a handful of textures and differ only
  in tint, so they go on one 2048 × 1536 atlas per scene (each part's UVs
  move into its texture's tile, its tint into its vertex colours: albedo ×
  texture × vertex colour, the same product). Gear joins them on a white
  tile, with its finishes (metallic, roughness) in a small texture laid over
  the atlas. A character is now its outfit (dyed per look) and one atlas
  draw: **4.1 → 2.0 meshes per look on average, max 7 → 3** (character
  viewer, all 36 looks). Eye textures every head file carries a copy of are
  recognised by their pixels and share one tile. Gear is now drawn from both
  sides, as skin is (closed shapes look the same).
- **Crowds only (more than 24 players)**:
  - *True animation LOD*: characters in view past 35 m have their clips
    sampled, bones and aim computed at 15 Hz, past 70 m at 10 Hz, each on its
    own phase (`CharacterAnimator.stepAt`; a gate on the animated nodes makes
    Babylon skip their clips between steps, and their skeletons keep last
    step's matrices). Clips are sampled at the current time when they step,
    so nothing slows down. A death, a ragdoll and anyone nearer than 35 m
    animate every frame, and small matches exactly as before.
  - *Far characters cast no shadow*: past 30 m a crowd's characters drop
    out of the shadow map (they still catch shadows).

Before and after, same placement (`PERF` probe: the player 30 m or 60 m off
the middle of a held clump, Medium, SwiftShader at box load 5–20):

| Norman Shores, clumped | Draws | main / depth / shadow | Characters' draws (main) | Scene meshes | Triangles |
|---|---|---|---|---|---|
| 30 m, before | 2,775 | 1,057 / 1,004 / 713 | 411 | 6,631 | 4.21 M |
| 30 m, after | **1,559** | 596 / 588 / 373 | **192** | **4,009** | 3.97 M |
| 60 m, before | 2,934 | 1,118 / 1,063 / 751 | 411 | 6,631 | 4.43 M |
| 60 m, after | **1,616** | 678 / 655 / 282 | **192** | **4,033** | 4.15 M |

Draws fall by 44–45 %, characters' by 53 %, shadow-map draws by half to
two-thirds, the meshes Babylon evaluates every frame by 40 %.

Animation, measured on its own (JavaScript only, so it carries over to real
hardware better than SwiftShader frame times: 120 steps of a 60 Hz timeline
of Babylon's clip evaluation, the after-animation aim and grip, and the
skeletons' bone matrices for the 95 characters in view, every frame vs.
stepped):

| View | Characters ≤ 35 m / 35–70 m / > 70 m | ms a frame, every frame | stepped |
|---|---|---|---|
| 30 m off the clump | 63 / 32 / 0 | 70–76 | 59–61 (−19 %) |
| 60 m off the clump | 0 / 79 / 16 | 67–70 | 17–21 (−71 %) |

(On a box this loaded these milliseconds are several times a desktop's; the
ratio is the point. In SwiftShader's 1–4 fps frames every character is due
every frame, so the LOD can't show in frame times here.)

`perf96.mjs` (the player's own view, so how many characters are in view
varies a lot run to run; worker sim, Medium, box load 1–10):

| Map, scenario | Build | Draws | Active meshes | Triangles | Skinned (characters in view) | Draws per character in view |
|---|---|---|---|---|---|---|
| Norman Shores, clumped | before | 1,443 | 1,352 | 3.22 M | 101 (26) | 56 |
| | after | 1,835 | 2,701 | 4.09 M | 236 (81) | **23** |
| Norman Shores, spread | before | 3,071 | 4,324 | 4.38 M | 338 (79) | 39 |
| | after | 2,183 | 3,969 | 4.56 M | 236 (84) | **26** |
| Frost Basin, clumped | before | 347 | 496 | 0.53 M | 116 (30) | 12 |
| | after | 229 | 471 | 0.64 M | 98 (43) | **5** |
| Frost Basin, spread | before | 614 | 1,309 | 0.78 M | 179 (56) | 11 |
| | after | 388 | 904 | 0.51 M | 56 (38) | **10** |

`PERF_MAX_DRAWS=2000` passes on both maps after (the clumped Norman Shores
frame with 81 characters in view draws 1,835); before, the same view with
three times the characters showed 2,400–2,800 (first pass's table above and
the probe's). Use 2,000 as the budget for Medium on Norman Shores, 400 on
Frost Basin.

Quality: the character viewer's close-ups before and after differ by
0.3–1.1 / 255 per pixel on average (idle-pose timing; 3.5 where a creature's
clip was mid-swing); Norman Shores from fixed cameras with the map's
destructibles, props and plants in view by 0.01–0.41 / 255, no pixel off by
more than 24 in 0.01 %. Close and mid shots of a 96-player crowd look the
same.

Left for later:

- **The ground-mist depth pass** re-renders the whole view (a third of a
  misty map's draws). Sharing the main pass's depth (a depth texture on the
  post-process input) needs the view model's depth clear (rendering group 1)
  moved or the depth copied before it; or the mist could move into the
  materials.
- **Props**: merging per material cut the scene's meshes but not their draws
  much (Kenney models are a material per colour); a per-kit palette atlas
  (one material per kit) would make most props one draw per model.
- Character outfits stay a draw of their own (dyed per look; a per-look
  atlas would cost a texture per look).
- Materials are not frozen (`material.freeze()`): their checks are cheap when
  nothing changed, and freezing breaks when lights or shadows change.
- The warm-up "hang" seen in this pass is not a hang in the physics: see the
  next section.

## Warm-up hang (27 Oct 2026)

Reported: sometimes, while a 96-player offline match on Norman Shores is in
its warm-up, the page stops inside Rapier's `PhysicsPipeline.step`
(`ScenarioState.apply` → `PhysicsWorld.commit`, on a message from the sim
worker) and never returns; `perf96.mjs` then waits for ever.

**What it is**: the page's main thread stalls for tens of seconds, sometimes
minutes, waiting on the GPU, and the debugger's pause lands in Rapier only
because that is the first JavaScript to run when a stall ends: the queued
worker snapshots, whose hottest part is the scenario and vehicle colliders'
`commit` and the prediction replay. No Rapier call is slow:

- **Node**: the sim and a copy of the page's prediction physics
  (ScenarioState, MountState, covers, LocalPlayer fed every snapshot through
  structured clone), Norman Shores, 96 players, start gate as in the
  browser, 100 seeds × 30–40 s with a worker-thread watchdog: no hang (one
  seed's setup outran the 30 s watchdog on the loaded box; it replayed fine
  twice). Rapier 0.21 fuzzed (330 worlds × 3,000 random creates, removes,
  moves, enables, shape changes, NaN/∞/1e30 transforms, steps): no hang.
- **The page**: every commit and character move timed through the stalls:
  commits 0.14–0.25 ms on average, the slowest 8.6 ms, no move over 100 ms.
  Every Rapier call the page made (up to 1.6 M, queries included) recorded
  at a stall and replayed in Node, in Chromium and in the game's own bundle:
  each finished in milliseconds. A stalled page answers again: three times
  out of four within five more minutes.
- **A Chrome trace** of the page's thread over the first 150 s (box load 16–
  20, SwiftShader): busy 135 s, of it 89 s waiting on the GPU process
  (`WaitForGetOffset`, `WaitForToken`); 74 synchronous `readPixels` (the
  character atlas reading skin, hair and eye textures back, 36 in one task)
  took 54 s, each draining everything the GPU had queued; image-load tasks
  waited 25–27 s for command-buffer space; tasks over 10 s: 19, 25, 52 s.
  Worker messages took 13.5 s, and after each stall hundreds of queued
  snapshots were handled one by one (~6 ms each: colliders, vehicles,
  prediction replay), which made the page fall further behind.

**What changed**:

- **The character atlas reads back without waiting**
  (`content/characterAtlas.ts`): on WebGL2 the read goes into a pixel buffer
  and is collected after a fence (Babylon's `_readPixelsAsync`); the plain
  read stays as the fallback.
- **A page that fell behind handles the waiting snapshots as one**
  (`game/snapshotMerge.ts`, worker mode): the first snapshot of a burst goes
  straight through, those queued behind it are merged (events in order,
  scenario changes and Fort Wars pieces combined, everything else from the
  newest) and delivered once the queue is through. Past a second behind,
  their purely visual events (the hidden-tab list) are dropped. Merges are
  counted in `window.__sim.backlog`, and the first time the page is over a
  second behind it says so in the console.
- **`perf96.mjs` has a watchdog**: a page that doesn't answer for
  `PERF_STALL_S` (300 s) ends that map's run, reported as stalled (exit 1),
  instead of waiting for ever.
- **`tools/perf/hang96.mjs`** reproduces it: a 96-player offline match opened
  again and again, probed every second from loading through the warm-up;
  reports stalls (`STALL_S`, 10 s), hangs (`HANG_S`, 120 s, with the paused
  stack) and the catch-up merges; `HANG_DIAG=1` logs the page's time in
  worker messages, animation frames and tasks over 2 s.

Same trace, same box (load 16–20), before → after: synchronous readbacks
54 s → 0.8 s (54 reads, now asynchronous); worker messages 1,036 in 13.5 s
→ 1,858 in 5.7 s (the page kept up); tasks over 10 s 19, 25, 52 s → 12, 11,
25 s. Time waiting on the GPU stayed at ~90 s: SwiftShader on a box at load
15–20 is that slow, so `hang96.mjs` still sees stalls past 120 s there (2 of
3 runs before, 2 of 2 after; at a 30 s threshold 5 of 5 both). Unit tests:
`client/test/snapshotMerge.test.ts` (twenty seconds of snapshots behind a
long frame cost two deliveries, nothing lost).

Left: the remaining stalls are the GPU process itself (texture uploads and
frames queued behind it). On a quiet box or a real GPU (`PERF_GPU=1`) they
should vanish; rerun `hang96.mjs` there before reading anything into its
counts.

## Glass and water (October 2026)

Glass and water got new looks (BUILDING_KIT.md "Glass", SET_PIECES.md "How
liquids look"); the render budget had to hold. Every pane of glass is now a
thin instance (one mesh per 32 m square and tint, one shared material), where
each Window pane destructible was three meshes and a material of its own; water
is one shader per body with no render target on Medium or Low.

Norman Shores (a 330 m lake, 104 Window panes), Medium, the same three views
with nobody in sight (characters hidden), averaged over three frames
(SwiftShader; draw calls and triangles are what count):

| View | Draw calls before | after | Active meshes before | after | Triangles before | after |
|---|---|---|---|---|---|---|
| Shore, looking over the lake | 1,562 | 1,287 | 1,802 | 1,669 | 2.12 M | 2.16 M |
| Town, glazed houses | 2,033 | 1,587 | 3,082 | 2,838 | 2.57 M | 2.60 M |
| From above, the whole map | 1,878 | 1,377 | 3,593 | 3,299 | 2.52 M | 2.55 M |

Scene totals: 5,046 → 4,751 meshes, 534 → 431 materials, no render targets
either way. Triangles rise ~1.5 % (the lake's surface grid). `perf96.mjs
norman_shores` (Medium, worker, clumped) was too noisy on the shared box to
compare (characters in view varied 16 vs 7 between runs; 1,715 vs 1,656
draws). On High the biggest body of water adds a 40 %-resolution mirror pass of
the level, terrain, border and backdrop, and the scene depth pass (already
there on maps with ground mist).



- Snapshot handling on the page (`msg`) is now the largest sim-related cost
  there; structured-cloned objects from the worker could become transferable
  buffers if it shows up on real hardware.
- Friends' snapshots are still encoded in the host's worker and relayed by
  the page (data channels live on the page).

## Bot behaviour pass (27 Oct 2026)

Spawning, squads, roles and routes (docs/BOTS.md). Before = f5a7f9c with the
same bench (behaviour measures copied in), after = this pass; both
`pnpm bench:96:clump`, two runs each, interleaved, on the shared 4-core box
(load 1.4–2.9). Behaviour numbers are deterministic (identical across runs).

CPU a tick (ms, mean of two runs) and bot think:

| Map | layout | before CPU | after CPU | before think | after think |
|---|---|---|---|---|---|
| norman_shores | spread | 6.60 | 6.54 | 1.60 | 1.75 |
| norman_shores | clumped | 7.97 | 7.50 | 1.70 | 1.60 |
| frost_basin | spread | 5.81 | 4.08 | 1.67 | 1.07 |
| frost_basin | clumped | 5.06 | 5.30 | 1.64 | 1.71 |
| riot_junction | spread | 5.70 | 5.21 | 1.58 | 1.41 |
| riot_junction | clumped | 5.03 | 5.04 | 1.45 | 1.39 |

Clumped total over the three maps 18.06 → 17.84 ms; Frost Basin clumped is
within noise of before (+0.24 ms, all in movement, which the change doesn't
touch; the after runs had the higher load). `clumpPerf.test.ts`: 9.16 ms vs
11.43 spread (x0.80).

Behaviour, 96 bots, 30 s after a 10 s warm-up (spread layout):

| Map | coverage / min | spread | crowd | kills/min | stuck |
|---|---|---|---|---|---|
| norman_shores | 18.0 → 21.3 % | 0.615 → 0.657 | 14.5 → 8.0 | 2 → 6 | 29 → 35 |
| frost_basin | 18.3 → 17.8 % | 0.621 → 0.587 | 11.4 → 10.0 | 38 → 4 | 30 → 23 |
| riot_junction | 26.7 → 31.8 % | 0.653 → 0.690 | 10.7 → 9.8 | 100 → 76 | 114 → 69 |

The same over 120 s (`bench 96 120 … --warmup=10`): Frost Basin coverage
21.4 → 23.0 %, spread 0.657 → 0.680, crowd 9.3 → 8.0, kills/min 66 → 53,
stuck recoveries 211 → 137; Norman Shores coverage 21.6 → 26.2 %, spread
0.634 → 0.682, crowd 13.7 → 9.1, kills/min 8 → 20, stuck 200 → 166. Spawn
deaths in big team matches stay under 1 %. Frost Basin's first fights come
later (squads travel together and spread over the map), so its first 30 s
have few kills.

32 bots on the small arena (`bench 32 30`): CPU 3.05 → 2.90 ms, bot think
1.14 → 1.04; kills/min 276 → 292; spawn deaths 43.5 → 47.3 % (five regions
for 32 players: everyone is in sight of a spawn); idle samples 17 → 29 %
(campers holding spots).

## Hosted 48 v 48: a browser host and its friends (27 Oct 2026)

Owner report: a browser-hosted 48 v 48 bot match with one friend joining
from another computer was unplayable, while 8 v 8 with two connections was
smooth. Offline 48 v 48 had been measured and tuned; the hosted path (the
host's page serving friends, the friend's page applying what it gets) never
had.

### Measuring

- `pnpm build && node tools/perf/host96.mjs [map ...]` opens a browser host
  with 96 players (`?offline=<map>&gamemode=core.tdm&bots=96`, Low graphics by
  default), presses Host game, and joins 1–3 friends (`HOST96_GUESTS`) over the
  real WebRTC path through a local hub's PeerJS broker (as e2e `hostgame`),
  each page in its own browser. For bots spread and clumped (everyone into a
  40 m square every 2 s) it reports per second: the host worker's tick p50/p95,
  catch-up batch and dropped ticks, its time compressing friends' streams; the
  host page's frames, long tasks and its time compressing/sending; per friend
  the messages, characters before and bytes after compression; on the friend:
  snapshot rate and arrival gaps, inflate/parse/apply time, frames drawn past
  the newest snapshot, far players frozen, clock resyncs, input → acknowledged
  latency, frame time and draw calls. `HOST96_PROFILE=dir` saves CPU profiles
  of the host and first friend. `pnpm perf:host96` is a budget check (Frost
  Basin clumped: a friend's stream ≤ 30 KB/s, the host page's compress+send
  ≤ 15 ms/s).
- The numbers come from opt-in probes (`window.__net`, `perfProbe.ts`
  `netProbe`), off unless a perf run turns them on.
- Unit guard (`shared/test/bigMatch.test.ts`, "a hosted 48 v 48 snapshot
  stream"): clumped Frost Basin, 96 bots, 10 friends' streams: characters a
  friend is sent a second (< 220 KB/s; measured 134, full snapshots 325) and
  the time writing all ten copies (< 15 ms a snapshot; measured 1.7–2.8 ms).

### What we found

Same box as the rest of this file (4 cores, SwiftShader, other agents' jobs:
load 14–19 throughout), so frame times are CPU-rendered and slowed; the
network and per-message columns are the portable part. Frost Basin, Low, one
friend, before (the release build with the probes) and after:

| Frost Basin | Wire KB/s a friend | Raw KB/s a friend | Host page compress+send ms/s | Worker compress ms/s | Friend apply ms/s | Friend inflate+parse ms/s | Far players frozen a frame | Input → ack p50 |
|---|---|---|---|---|---|---|---|---|
| spread, before | 31.0 | 302 | 24.4 | 0 | 374 | 11.5 | 11.7 | 55 s |
| spread, after | 15.5 | 96 | 2.9 | 28.8 | 12 | 3.8 | 0 | (frames of 2–12 s) |
| clumped, before | 29.8 | 356 | 38.6 | 0 | 335 | 14.8 | 1.6 | 21 s |
| clumped, after | 13.6 | 94 | 4.8 | 42.9 | 31 | 4.0 | 0 | 1.5 s |

A second pair of runs with the host's page not drawing (`HOST96_HOST_RENDER=0`:
a host whose GPU is far ahead of SwiftShader, so its page only serves; load
5–7), Frost Basin, one friend:

| Frost Basin, host not drawing | Wire KB/s | Raw KB/s | Host page send ms/s | Worker compress ms/s | Friend apply ms/s | Far players frozen a frame | Clock resyncs | Input → ack p50 |
|---|---|---|---|---|---|---|---|---|
| clumped, before | 33.8 | 366 | 31.7 | 0 | 72 | 13.7 | 189 | 5.5 s |
| clumped, after | 17.7 | 112 | 7.8 | 16.1 | 67 | 0 | 13 | (1 sample) |
| spread, before | 41.1 | 355 | 32.6 | 0 | 137 | 13.5 | 98 | 3.8 s |
| spread, after | 22.6 | 143 | 7.8 | 20.5 | 34 | 0 | 1 | 1.1 s |

The friend still draws at 1–2 fps here (96 characters in SwiftShader), so its
input → acknowledged latency and the share of frames drawn past the newest
snapshot are bounded by its own multi-second frames, not the network: read
them on a GPU machine (`PERF_GPU=1`). Norman Shores did not finish loading in
the browser within 10 minutes on this box (host and friend each loading it
in SwiftShader), before or after; its numbers are the headless ones below.

The same streams measured headless (the match in Node, three friends,
`encodeSnapshots` + the host's deflate stream + the friend's inflate and
rebuild; per friend, quieter numbers):

| Map, layout | Raw KB/s full → delta | Wire KB/s full → delta | Compress a friend (ms a snapshot) full → delta |
|---|---|---|---|
| Norman Shores, spread | 271 → 86 | 26.3 → 11.9 | 0.70 → 0.31 |
| Norman Shores, clumped | 512 → 172 | 53.0 → 29.3 | 0.84 → 0.50 |
| Frost Basin, spread | 308 → 92 | 28.6 → 13.6 | 0.83 → 0.69 |
| Frost Basin, clumped | 402 → 147 | 38.5 → 24.2 | 1.02 → 0.72 |

Where the time and bytes went, before:

1. **The friend's page never caught up once behind.** Every snapshot was a
   message handled in full (scenario colliders, vehicles, prediction replay
   of every unacknowledged input), 30 a second; the host's own page already
   merged a backlog from its worker (`SnapshotCoalescer`), a friend's (and a
   dedicated server's client's) did not. One long frame (shaders, a clump in
   view) put it behind, the backlog made the replay longer, and inputs were
   acknowledged tens of seconds late: unplayable, whatever the network. 8 v 8
   is cheap enough per snapshot to recover; 96 players is not. This was the
   dominant fault.
2. **Far players stuttered on the friend's screen.** Past 32 players, far
   players come in every fourth snapshot (133 ms apart) but remote players are
   drawn 100 ms behind: the next copy hadn't arrived, so they stopped and then
   jumped (12 a frame spread out). Players held back from the frame before the
   drawn tick were also drawn at their newest copy (ahead of time).
3. **Bytes**: players were 75–80 % of each snapshot and sent whole every time
   (a bot's debug state, health, weapon… unchanged); the scoreboard and
   vehicles another 20 %. 26–53 KB/s a friend after compression, 270–510 KB/s
   of JSON to compress, inflate and parse.
4. **The host's page compressed every friend's stream** (pako, level 6),
   1–1.5 ms a snapshot a friend under load, on the thread that renders.
5. Not a factor: interest management was applied on the browser host path
   and snapshots were serialised once for every friend already; the host
   worker's tick (2–4 ms p50) is the offline one.

### What changed

- **Friends coalesce** (`peerLink.ts`, `netTransport.ts`): snapshots waiting
  are merged (`SnapshotCoalescer`, as the host's page does), and every frame
  starts by delivering what is waiting (`Transport.flush`), so a frame after a
  burst draws the newest state. Apply time 335–374 → 12–31 ms/s in the runs
  above.
- **Delta snapshots (protocol 4,** `shared/src/net/interest.ts`**)**: the
  host's channel to each receiver is reliable and ordered, so each copy is
  written against the previous one on it (`SnapshotStream` per connection,
  `SnapshotDecoder` in the receiving transport): a player already sent goes as
  `{s, d:[dx,dy,dz] cm, …changed fields}`; others' positions to the cm and
  speeds to 1 cm/s, the receiver's own entry in full and exact (prediction).
  The scoreboard, vehicles, taken pickups, cover and leaders go only when
  changed (`same` names the ones repeated). Receivers who were last sent the
  same copy of a player share one written delta. The dedicated server uses
  the same streams. Raw −65–70 %, wire −45–55 %.
- **Compression in the match worker** (`matchHost.ts` `sinkTo`): the page
  only puts ready pieces on the data channel (transferred, not copied); its
  own few messages (`travel`) go as plain pieces between them. Host page
  24–39 → 3–5 ms/s a friend.
- **Far players keep moving** (`interpolation.ts`): a player held back is
  carried on along their last move (at most one gap) until their next copy,
  and blended between the frames that have them.

### Is 48 v 48 hosted in a browser realistic?

Per friend now: 12–30 KB/s of upload (Norman Shores clumped is the worst),
so 10 friends (`BROWSER_HOST_MAX_GUESTS`) is 0.12–0.3 MB/s, 1–2.4 Mbit/s: most
home uplinks carry it. In the host's worker each friend costs ~0.3–0.7 ms a
snapshot compressing plus ~0.2–0.3 ms writing (snapshots every other tick), on
top of a 2.5–3 ms (p95 6–8 ms) tick: 1–3 friends add well under a millisecond
a tick, 10 friends 2–4 ms, inside the 16.7 ms on a desktop core but tight on a
laptop at p95. The host's page renders the same 96 characters as offline play
plus a few ms a second of sending. So: **48 v 48 with 1–3 friends is
realistic on a desktop-class host** (the render cost of PERF_96 above is what
limits it, not hosting); with 10 friends it needs a strong host CPU and
upload, and anything beyond (more humans, public lobbies, a host that can
leave) belongs on the dedicated server / Host Service, which runs a match in
~0.5–1.5 ms a tick without rendering.

Left for later: a binary encoding of player entries (deflate already takes
most of JSON's overhead; another ~30 % at best); a lower snapshot rate for
far tiers or a per-friend bandwidth budget if 10-friend games show upload
trouble; skipping the prediction replay when the server agrees with the
predicted state at the acknowledged input (Rapier moves are most of a
friend's per-snapshot cost once caught up); measuring frame times on real
GPUs (`PERF_GPU=1`), which this box can't.

## Performance overlay and the effects budget (29 Oct 2026)

**On a player's machine.** F3 (or Options → Display) shows `game/perfOverlay.ts`: perfProbe's frame samples (it turns the probe on and keeps about a minute of frames) and what each frame drew (`GameView.perfCounts`: draw calls, active meshes, `Atmosphere.casterCount`, characters, effects), plus the GPU from WebGL's unmasked renderer. Pause → Settings → Copy performance report gives the last minute as text: machine, settings, match, frame-time percentiles, hitches, and the sim / net / game / render split. Ask for one when a slowdown is reported: CI renders on the CPU and can't see it.

**In CI** (`pnpm perf:budget`, `tools/perf/perf96.mjs`), besides `PERF_MAX_DRAWS`:
- any mesh tagged `metadata.effect` in a shadow map's list fails the run;
- `PERF_MAX_CASTERS=600`: the average shadow casters in a clumped frame. It grows with the characters in view (each casts several meshes): Frost Basin medium was 184–248 here and 446 on GitHub's runner with 46 characters in view; low has none. Effects in the shadow pass have their own exact check;
- `PERF_MAX_FX_MS=40`: starting an explosion, both hits and every muzzle flash on a fresh rig (median of three) mid-fight. Measured 1–3 ms.

Turning off the effect exclusion and the flash materials' blocked dirty mechanism made the run fail with 124–129 effect meshes in the shadow pass and flash starts of 43–73 ms.

**What the flash starts were.** In a 96-player scene (about 5,000 meshes) a new muzzle flash rig took 20–80 ms. Every new `ShaderMaterial`'s `backFaceCulling` / `alphaMode` setters walk every mesh and submesh to mark them dirty (three walks a piece, 15 pieces in a big flash), and `Mesh.clone` deep-copies the source's properties. Flash materials now block their dirty mechanism (they only ever take uniforms), and rig pieces and effect meshes share their source's geometry instead of cloning it.

## Mass casualty: tiered ragdolls (30 Oct 2026)

**Scenario** (`pnpm perf:mass`, CI's perf job): Frost Basin, Medium, a 24 v 24
offline match (48 players, the browser's largest). 20 bots are held in a ring
12 m in front of the camera until their characters stand there in this view,
then one blast kills them all. For the frames after it (4 s, at least 12) it
reports frame times, draws, and the **ragdoll work** per frame: starting the
dead bodies plus the effects physics and posing the ragdolls (the view's
`startRagdoll` and `updateEffects`, timed in the page, so it compares builds and
CPU rendering doesn't inflate it), and the most ragdoll bodies awake at once.
Budget: `PERF_MAX_MASS_MS=120` (a frame's ragdoll work: a stall guard, the
runner renders on the CPU) and `PERF_MAX_MASS_BODIES=300`.

**Before / after** (this shared 4-core box under other agents' load, two runs each, interleaved):

| Build | Deaths handled | Worst frame's ragdoll work | Ragdoll work over 4 s | Game JS, worst frame |
|---|---|---|---|---|
| before (12 ragdolls, the rest the canned death) | 12 ragdolls + 8 canned | 17.8 / 23.8 ms | 145 / 155 ms | 34.6 / 45.1 ms |
| after (tiers, pool, freeze, deaths spread over frames) | all 20 physical (11 full, 9 cheap in run 1) | 13.7 / 22.9 ms | 92 / 106 ms | 29.6 / 48.5 ms |

Frame times themselves (p50 0.6 s, worst 2–3 s) are SwiftShader's and the
box's load, not the game's. Most ragdoll bodies awake at once: 30–110 (of
300). Without spreading the deaths over frames (`DEATH_START_MS`: 4 ms of
starts a frame, at least one) the after build's worst frame was 28–49 ms:
twenty bodies started in one frame. On this slow page a start takes over 4 ms,
so the 20 deaths took about 13 frames to all go down (run 2 had handled 7 by
the end of its window); on a normal machine several start per frame.

## Pack effects pass (3 Nov 2026, `wip/fx-pass`)

Electric, Flame, Poison and Smoke pack effects added (docs/PHYSICS_FX.md, "Pack effects"). `pnpm perf:budget`
(Frost Basin, 96 players, SwiftShader on a shared 4-core box: frame times are noise, compare draws and starts),
main a2fd44b → this branch:

| | medium spread | medium clump | low spread | low clump | slowest effect start |
|---|---|---|---|---|---|
| draws, before | 297 | 237 | 100 | 217 | 5.7 ms (hit heavy) |
| draws, after | 239 | 219 | 280 | 204 | 11.9 ms (`arc`: a 3-jump chain, 3 bolts built) |

Shadow casters 76 → 89 (medium clump; characters in view), effect casters 0. Lasting effects start in 0.1–1.6 ms
each. Draw counts swing with what is in view (low spread 100 → 280 is where the camera landed, not effects: the
scene counts show 15 → 47 characters shown). Menu bundle 837.5 kB gzip before and after (budget 840).

## Busy areas: first fixes from the owner's host data (4 Nov 2026, `wip/perf-toolset`)

Owner's data (M1 Pro, Chrome, dedicated host, ~94 bots, Shingle Point): medium at 1.25× render scale 32.1 ms render,
647 draws, 184 shadow casters, 39 characters drawn; low at 0.75× 20.9 ms, 340 draws, no shadows. 2.8× fewer pixels
and no shadows saved a third: the cost is per draw and per character on the CPU. The per-system split to confirm it
on that machine is the new toolset (docs/PERF_TOOLS.md). Changes, measured on the same frame against the old rule
(SwiftShader here, so counts only; HANDOFF has every sample):

| | old rule | now |
|---|---|---|
| characters casting shadows (crowd, 4 samples) | 9, 6, 8, 14 | 6, 0, 0, 1 |
| small clutter instances in the shadow pass | 25 | 1 |
| character animation evaluations a second at 60 fps | 750, 625, 590, 585 | 570, 595, 590, 585 |
| shader programs built by the first explosion, hits, lightning and lasting effects | 6 | 0 |

- Shadows: the nearest 12 living characters in view cast (and anyone within 10 m); in crowds none past 30 m, the
  dead and corpses included (they all cast before). Small clutter casts within 15 m only.
- Animation: crowds' characters 15–35 m away step at 30 Hz (every 2nd frame at 60 fps); 35–70 m at 15 Hz and past
  70 m at 10 Hz as before. Crowds switch to the low-detail model at 12.6 m (was 18 m).
- Already in place: off-screen characters don't animate or skin in crowds; Shingle Point's 446 props are 38 models,
  all GPU instances merged per material with frozen matrices.
- Not done: merging far characters' draws (each has its own skeleton: needs baked animation textures).
- The loading gate builds every character look's and effect's shaders (GameView.prewarm, programs kept).

## Market Town on an M1 Pro (5 Nov 2026, `wip/perf-market`)

**Owner's capture** (Apple M1 Pro, Chrome 156, WebGL2, high, render scale auto, 60 fps cap, 1920 × 958 at DPR 2;
Market Town TDM, 44 players with 48 bots, local match, 0.7.0 d29e6a8; 25 s recording and two 10 s traces):
23 ms frames (43 fps) with up to ten characters in view, 38-45 ms (22-26 fps) with 20-40; 19 hitches over
50 ms. Per frame in the traces (~26 ms): characters (clips + aim) 8.1-9.6 ms, shadow + depth maps 6.6-7.0,
mesh evaluation 2.9-3.4, characters (update) 1.7-1.9, ragdolls + effects physics 1.0-1.4. In the recording
`animated` was about the characters in view every second (41 of 41 in the worst hitch, 34 ms of clips), shadow
casters 580-620 every frame and draws 950-1,400.

### What it was

1. **The animation LOD gave up exactly when it was needed.** The crowd LOD (on at 44 players) stepped far
   characters at 30 / 15 / 10 Hz by time. At 25-40 fps a frame is 25-40 ms, so a 30 Hz character was due every
   frame and a 15 Hz one every other: the LOD saved nothing in a busy fight. On top of that each evaluation is
   Babylon's clips **and** our after-clip work, and a CPU profile of the scenario below put three quarters of the
   span in the after-clip part, half of that in `closeHand` (24 finger joints a frame, each a forced world
   matrix, a decomposition and a slerp).
2. **Every shot and hit rebuilt an animation group.** A remote shot or a hit flinch stopped the overlay clip and
   started it again: `AnimationGroup.start` makes an animatable and runtime animation per joint (about 70) and
   `stop` frees them. In the scenario this was the largest JS cost of all (onMessage → trigger 415 ms in a 20 s
   profile, against 181 ms for all the after-clip work) and the garbage behind the minor GCs.
3. **The shadow map drew the static level once per material per cascade.** Medieval pack tiles are box-built and
   merged per material, as every pack's are, but each surface carries its own library material: Market Town's
   level is 64 meshes over the whole map, so all 64 went into each of the three cascades (185 draws a frame), and
   the untinted props (instances merged per material, as everywhere) another 207. Pickups' shapes and the held
   guns of the 12 casting characters added 100 more.
4. **High-quality water redrew the whole view for its depth.** Market Town's stream turns on the scene depth
   renderer (soft shores, foam on waders), which drew every active mesh a second time: 300 of the 960
   render-target draws.
5. **Hitches' "outside" time** (see below): character builds after the frame, minor GCs, and on this box the GPU.

Medieval pack tiles and props are merged and instanced like every other pack's (box tiles per material, props
as instances of models merged per material); the main pass's 58 level draws are its 58 materials, and nothing
in the kit needed changing for the draw count. What did change is how they reach the shadow map (3 below).

### What changed

- **Animation LOD by frames as well as time, in every match** (`game/animLod.ts`, `StepClock`): past 15 m a
  character animates at most every 2nd frame (and 30 Hz), past 35 m every 3rd (15 Hz), past 70 m every 4th
  (10 Hz), on its own phase. At 60 fps the time step decides, as before; at 25 fps it is 12.5, 8 and 6 Hz instead
  of every frame. Small matches get it too (they had none). Off-screen sleeping, gun instances and the other
  crowd savings stay crowd-only.
- **Fingers kept past 15 m** (`AnimStep.detail`, `CharacterAnimator.curl`): the last full close of the same grip
  and weight is put back (24 quaternion copies) instead of closing again. Aim, arm IK and the gun in the hands
  are worked out at every distance, so hands stay on the gun.
- **Overlay clips kept**: shot and hit clips stay started, paused at weight 0 between plays, and a new shot goes
  back to the start (`KEPT_OVERLAYS`); remote recoil twitches and hit clips past 35 m are left out
  (`SHOT_OVERLAY_REACH`; the procedural flinch stays).
- **Shadow proxies** (`game/shadowProxy.ts`, Atmosphere): every static, opaque mesh (frozen world matrix, no alpha
  test, skin, morph or LOD levels: the level per material, terrain, roads, untinted props' instances, the border's
  static thin instances) is held back from the shadow list for half a second as it loads, then its triangles are
  merged in world space into one mesh per 48 m square and culling mode, drawn only into the shadow map (layer
  mask 0). Each cascade draws only the squares it covers. The originals still draw and catch shadows. A merged
  mesh that goes away rebuilds its batch. Small clutter keeps casting near the camera only.
- **Pickups and held guns cast within 15 m only** (`castSmall`, `shadowFlags.ts`), as small clutter does.
- **Water's scene depth only round water** (`WaterVisuals.depthNearWater`): the depth map draws the meshes whose
  bounds meet a body of water (its floor and banks, up to a wader's head), unless the height fog shares it
  (misty maps on high: `markWholeSceneDepth`).
- **Blood splats are GPU instances** of one disc faded by instance colour (one draw; 45-50 a busy frame before).
- **One character build a frame** on real GPUs (a 40 ms frame let two or three through before), and **bodies are
  reused**: a going avatar's character (a body that sank away, one past MAX_CORPSES, a player who left) is kept,
  two per look, and the next avatar of that look takes it (`GameView.keepBody`, `CharacterAnimator.standBy`).

### Measured

Same scenario for every build (scratchpad probe, not in the repo: `?offline=market_town&gamemode=core.tdm&bots=44&test=1&god=1`,
graphics high, render scale auto, 640 × 360, SwiftShader; the player pinned at (4, 0, -34) looking north up the
high street, 43 bots held on fixed points 5-60 m ahead, two in three running small circles; 30 s of frames
after they arrive). The 4-core box was shared with another agent's jobs (load 10-22), and SwiftShader frames take
seconds, so compare relative numbers and counts, not milliseconds with the owner's.

Before = main d29e6a8 (the owner's build), after = this branch, run back to back at box load 5-7:

| Per frame, 44 characters in view (10 / 14 / 20 at < 15 / 15-35 / 35-70 m) | before | after |
|---|---|---|
| characters animated (clips evaluated) | 43 | 22.5 |
| characters (clips + aim), ms | 38.5 | 18.0 (-53 %) |
| of which per evaluation, ms | 0.90 | 0.80 |
| skinning, ms | 5.7 | 2.8 |
| shadow + depth maps (all render targets), ms | 26.8 | 12.7 (-53 %) |
| shadow casters drawn (all cascades) | 613 | 287 |
| render-target draws: shadow / water depth / mirror and the rest | 964: ~615 / 267 / 83 | 420: ~290 / 48 / 83 |
| shadow draws of the level / props / held guns / pickups | 185 / 207 / 81 / 26 | merged: ~60 proxy draws / 0 / 24 / near only |
| main-pass draws (blood splats in it) | 315 (50) | 279 (1) |
| all draws | 1,278 | 698 (-45 %) |
| mesh evaluation, ms | 11.7 | 8.5 |
| scene.render() JS, ms | 102.6 | 59.7 |
| frames a second (SwiftShader) | 0.37 | 0.65 |

Earlier, at load 10-20, the animation change alone took clips + aim from 81 to 24 ms and evaluations from 42 to 22
a frame, and the shadow work casters from 607 to 307. A CPU profile of the before build over 20 s of the scenario:
remote shots and hit flinches 415 ms (AnimationGroup start/stop), the after-clip aim and grip 181 ms (closeHand
85 of it), Babylon's own clip evaluation and blending about 60 ms. Building a character after a respawn: 15-25 ms
plus 3-6 ms for its animator (eight looks, in the page); a held gun 0.5 ms.

For the owner's ~26 ms frames that means, roughly: clips + aim 8.5 → about 4 ms, shadow + depth maps 6.6 → about
3 ms, fewer draws in the main pass and the evaluation; on the M1 that should put the few-in-view frames near the
60 fps cap and the busy ones around 25-30 ms. Not measured there: see below.

### Hitches: the "outside" time

The recorder's `outside` is the frame's time not covered by its own spans (sim, messages, game JS, render). A
Chrome trace of the scenario (12 s, devtools.timeline + v8.gc + gpu) shows what runs on the page's thread between
frames: worker messages (40-100 ms tasks here; counted in `net`), minor GCs (four scavenges of 18-83 ms in 19 s on
this box), a timer task, and **character builds**: `characters.create` resolves inside the frame's
onBeforeRender (its turn) but runs right after the frame's callback, so its 15-25 ms here (plus 3-6 ms for the
animator; measured in the page for eight looks) fall outside every span. No shader program was built mid-match
in the owner's recording (shadersNew 0 at every hitch). Everything else between frames here is waiting for the GPU
process (SwiftShader: 3.4-3.9 s gaps, the main thread busy 0.4-0.5 s of each).

So on the M1 the remaining outside time should be: respawn builds (now one a frame, and mostly taken from the
body pool once bodies start sinking away, after the first 33 s), GC (less garbage per shot and per finger now),
and GPU time on high (SSAO at half size with 16 samples, 4× MSAA, three PCF cascades at 2400 × 1200). Not
measurable here: re-record to confirm (below).

### For the owner to re-record on the M1 Pro

The same: Market Town, TDM, 44 players, high, render scale auto, 60 fps cap, a 25 s recording through a big
fight and a 10 s trace. Expect characters (clips + aim) and shadow + depth maps each about half of before,
`animated` well under the characters in view, shadow casters about half (300 instead of 600), draws about a
third fewer. If hitches still show large `outside`, record once more on render scale "sharp" (fewer pixels):
if `outside` falls, it is the GPU.

## Performance round 2 (5 Nov 2026, `wip/perf-2`)

**Owner's second recording** (M1 Pro, Chrome 156, WebGL2, high, render scale auto, 60 fps cap; Market Town TDM,
49 players, build 4e77fab after round 1): 20.3 ms frames on average in the trace (~49 fps), 26-32 ms in big fights,
3 hitches over 50 ms in 49 s. CPU-bound: per frame render 16.4 ms (characters' clips + aim 4.6, shadow + depth maps
3.8, mesh evaluation 3.0, the rest mostly issuing ~700 draws), characters' update 1.4, ragdolls + effects 1.2.
Target: 4-6 ms off.

### What it was

1. **Static shadows drawn every frame.** Round 1 merged the static casters into shadow proxies, but every cascade
   still drew them every frame (~150 of ~290 shadow draws), with doors and ladder gates (not frozen, so not merged)
   another ~55.
2. **The level was 34 meshes (58 draws with roads, paths and the border)**, one per surface style (material and
   tint), drawn again in the water's reflection (38 draws) and its depth map.
3. **Babylon walked every mesh twice a frame**: 3,300 in a 48-player match, about half switched off (pooled sparks,
   chips, dust and blood drops, parked effect sources, characters kept for reuse) and 97 shadow proxies no camera
   draws. That was most of "mesh evaluation".
4. **Clip stops and node disposals scanned 8,000 running animations**: AnimationGroup.stop looks each of its ~70
   joint animations up in the scene's list (an indexOf each), and every disposed mesh (effect emitters every few
   frames) asked the scene to stop its animations (a walk over the list). In a CPU profile of the scenario below, the
   stops alone were a third of the frame's JS.
5. **Animation LOD**: the 15-35 m band still stepped at 30 Hz and the far bands worked out the full arm IK, hand
   turns and stock fitting; creatures' clips ran every frame (only their state machine stepped).

### What changed

- **Static shadow cache** (`game/shadowCache.ts`, Atmosphere): each cascade's square is made a margin bigger than its
  view slice needs (25 / 15 / 12 % of its radius, near to far) and kept while the slice still fits inside it. The
  static casters (shadow proxies, and doors, gates or anything plain that has stood still 60 frames) are drawn into
  a cascade only when it moves, the sun turns, the static set changes, or every ~30 frames (staggered by cascade);
  their depth is then copied aside (a WebGL2 depth blit per layer) and every other frame the cascade starts from that
  copy, with only the moving casters drawn on top. A cascade that moves lands on the same texel grid (stabilised
  cascades), so static shadows don't swim. A caster that moves leaves the cached set at once (all cascades redraw).
  Medium graphics: the single box moves only when the camera's wanted box is 6 m away. WebGPU and WebGL1: as before.
  Off with `?perfoff=shadowcache`.
- **Level draw merging** (`levelMerge.ts`, `MapStyler.merge`, every map): the level's and terrain's per-style meshes
  (opaque, not glowing) are merged into one mesh per texture size and 128 m square over shared array textures (colour
  and normal-map layers); each vertex carries its surface's layers, tint, specular colour and power, and a material
  plugin (`LevelArrayPlugin`) takes those few inputs from the vertex instead of the material. Everything else is
  StandardMaterial's own lighting, so the look is the same (CI's visual baselines: arena 1.0 %, canyon 0.4 % of pixels
  differ, within their noise). Collision never used these meshes. Upper-storey floors (format v26) merge like any
  slab (unit test). The loading gate waits for it (its textures load in a moment). WebGL2 only; `?perfoff=levelmerge`.
- **Live mesh candidates** (`game/meshSelection.ts`): once a frame, Babylon's two walks see only the meshes switched
  on, less frozen ones no camera draws (layer mask 0: the shadow proxies). Market Town: ~830 instead of 3,300.
- **Static materials frozen** (same file): the materials only the level and the props use, once their meshes have
  been in the scene 2 s; a new mesh drawn with one thaws it. Safe because every map light is in the clustered
  container (each mesh sees the same lights) and nothing changes those materials after they are made.
  Both: `?perfoff=meshsel`.
- **Animation LOD, round 2** (`animLod.ts`): 20 Hz / every 3rd frame at 15-35 m (was 30 Hz / 2nd), 12 Hz / 4th at
  35-70 m (was 15 / 3rd), 8 Hz / 5th beyond (was 10 / 4th). Past 35 m (`coarse`, a character ~40 px tall) the arms
  take back the last full grip's pose relative to the shoulders (the spine still bends for the aim), the gun rides in
  the right hand as that grip held it and the fingers keep their last close; every 4th coarse evaluation works the
  grip out in full (stance and pitch). Nearer than 15 m nothing changed (no pops close up).
  **Creatures** (`creatureAnimator.ts`) now step their clips and bones by the same distances, and not at all out of
  view. `?perfoff=animlod2` gives round 1's steps.
- **Cheaper clip stops and disposals** (`game/animPatches.ts`): a group's stop disposes its animations without the
  per-joint lookup (the group's own sweep removes them, as before); a node nothing ever animated skips the scene's
  stop walk when it is disposed. Not switchable.

### Measured

Round 1's scenario and probe (a scratchpad script: `?offline=market_town&gamemode=core.tdm&bots=44&test=1&god=1`,
graphics high, render scale auto, 640 × 360, SwiftShader; the player pinned at (4, 0, -34) looking north, 43 bots on
fixed points 5-60 m ahead, two in three running small circles; 10 / 14 / 20 characters at < 15 / 15-35 / 35-70 m).
One build, run back to back with everything on and with `?perfoff=shadowcache,levelmerge,meshsel,animlod2`, twice
each (on, off, on, off), on a 4-core box shared with two other agents (load 12-17). SwiftShader frames take seconds,
so the frame spans (5 frames a run) are noise; the counts are exact, and the CPU costs come from in-page
micro-benchmarks on the live scene (the render loop paused, each part run in batches, the fastest batch kept).
The clip-stop and disposal patches are in both columns (not switchable).

| Per frame, 43 characters in view | off (round 1) | on (round 2) |
|---|---|---|
| all draws | 692, 697 | 441, 513 (-31 %) |
| render-target draws (shadow, water depth, reflection, the rest) | 411, 410 | 197, 220 (-49 %) |
| shadow casters drawn | 278, 279 | 126, 150 (-51 %) |
| level draws in the main pass / in the reflection | 58 / 38 | 39 / 17 |
| water depth-map draws | 49, 47 | 36, 35 |
| characters animated (clips evaluated) | 22.6, 22.6 | 17.8, 20.2 (-16 %) |
| mesh candidates Babylon walks (twice) | 3,283, 3,303 | 826, 810 |
| active-mesh evaluation, micro, ms | 11.4, 9.5 | 3.4, 1.9 (-75 %) |
| main camera's draws, micro, ms (draws) | 10.0, 10.1 (174, 183) | 9.3, 5.2 (147, 147) (-27 %) |
| shadow map pass, micro, ms (draws) | 6.0, 8.0 (278, 285) | 7.5, 7.7 (128, 106) |
| shadow + depth maps, frame span, ms | 35.5, 28.7 | 26.7, 20.7 (-26 %) |

The shadow pass's micro time did not fall here although its draws halved: on SwiftShader the per-layer depth copy is
done on the CPU too (three 2048 × 2048 layers); on the M1 it is a GPU blit (about 50 MB of bandwidth a frame, well
under a millisecond of GPU time) and the CPU cost follows the draws. In the measuring window (camera still) no
cascade redrew its static casters; in the micro-benchmarks 45-53 of ~400 layer renders did (the every-30-frames
refresh). A CPU profile of round 1's build in this scenario put clip stops (AnimationGroup.stop's lookups) at a third
of the frame's JS; they no longer show.

**Look**: CI's visual baselines pass unchanged (arena 1.0 %, canyon 0.4 % of pixels differ; allowed 8 / 10 %);
the zfight audit is untouched (the merge changes no faces).

### Projected on the M1 Pro

From the owner's 20.3 ms trace frame, scaling each part by what it measured here:

| Part | round 1 (M1) | round 2 (projected) |
|---|---|---|
| mesh evaluation | 3.0 | ~0.8-1.0 |
| shadow + depth maps | 3.8 | ~2.0-2.3 |
| issuing the main pass (~5 ms of the rest of render) | ~5 | ~3.7-4.0 |
| characters (clips + aim) | 4.6 | ~3.4-3.8 |
| characters (update), net in (clip stops) | 1.8 | ~1.5 |
| ragdolls, effects, hud, post | 2.0 | ~1.9 |
| **frame** | **20.3** | **~14-15.5** |

So the average frame should sit at the 60 fps cap on the M1, with big fights around 19-23 ms (from 26-32). Not
measured there: see below.

### For the owner to re-record on the M1 Pro

The same as last time: Market Town, TDM, 44 players, high, render scale auto, 60 fps cap, a 25 s recording through
a big fight and a 10 s trace. Expect mesh evaluation about a third of before, shadow + depth maps a little over half,
draws about a third fewer (~450-500), shadow casters about half (~120-150), `animated` a few lower. If a part didn't
fall, the same match with `?perfoff=<that part>` (shadowcache, levelmerge, meshsel, animlod2) in the address gives
the comparison on the same build.

### Next

- Doors re-set by their logic every frame were recomputed (and so not cached) in the measurement: they are now judged
  by their matrix (`shadowCache.ts`, after the measurement; ~27 shadow draws on Market Town).
- Roads, paths and the border's ground use the styler's materials but are not merged (their own meshes).
- Effects still dispose Godot VFX emitters when done (a mesh removal each); pooling them is next for "effects".

## Performance round 3: big open maps (6 Nov 2026, `wip/perf-3`)

**Owner's recording** (M1 Pro, Chrome, WebGL2, high, 49 players; Shingle Point, build 76a4b03 after round 2):
22.2 ms frames on average (20.5 in the trace), 60 fps only in quiet views (390 draws, 185 meshes). In the main views
700-980 draws and 850-1,130 active meshes; per frame the main pass 8.8 ms (11.5 in the busiest second), mesh
evaluation 3.1, shadow and depth maps 4.2, characters 4.3 (clips and aim 2.8). One hitch at 55 s built 8 shader
programs (75-83 ms frames), and the HUD cost 0.7 ms (0.1 on Market Town). Market Town's recording (round 2 build): a
mass death at 27 s (31 ragdolls, 50-55 skinned bodies) took the characters' span to 26 ms.

### What it was

1. **Every placed prop was a mesh Babylon looked at every frame.** Round 2 made a prop's copies GPU instances of its
   model merged per material (one draw per model and material), but each copy was still an instance in the active
   list: frustum test, level of detail, its matrix copied into the instance buffer. Shingle Point's 446 props were
   631 of the 1,308 active meshes at the owner's hitch spot (SwiftShader probe, 44 characters in view).
2. **The fog drew the whole view a second time** for its depth (the scene depth renderer): ~300-400 of a frame's
   ~1,000 draws on Shingle Point, on top of the shadow cascades. High graphics' ambient occlusion already writes
   the view's depth in the main pass (Babylon's pre-pass).
3. **Decorations of many small meshes**: a ladder is two rails and a rung every 30 cm; Shingle Point's six ladders
   were 86 meshes and 86 draws.
4. **Outdoors the shadow cache moved with the view, not with you**: Babylon centres a stabilised cascade on its view
   slice's centroid, which swings round the camera as you turn (the far slice's by tens of metres for a few degrees),
   so every turn moved the far cascades past their margin and drew their static casters again; on top of that the
   safety refresh redrew each cascade every 30 frames.
5. **Crowds' held guns and team markers**: a held gun was an instance per part of its model (2-5 parts), a marker an
   instance each: at the hitch spot 145 and 44 of the active meshes.
6. **Market Town gained nothing from batching**: its 54 props are 36 models, five copies at most of any one, and
   batches split a model's copies by square and level of detail (twice the prop draws there, no fewer meshes).
7. **Shaders first used mid-match**: the loading gate built each look's and effect's shaders out of sight, but a
   variant a gun or a body only needs in a pass that draws it in play (the shadow cascades, a depth map, instances),
   your own first-person gun's (drawn over the world, catching no shadows), a shot's tracer and water's splash drops
   were each built the first time they were seen.
8. **The minimap drew the whole map's plan every frame** (Shingle Point: 1,210 x 1,470 pixels, turned and scaled
   under a round clip) to show a 260-pixel window of it.
9. **Mass casualties**: a 31-kill blast started its bodies 4 ms of work a frame at most, so on a slow frame rate the
   last started seconds later, after their push had expired (PUSH_KEEP_MS, 1.2 s from the blast): they dropped where
   they stood. Settled bodies were simulated until their full time ran out.

### What changed

- **Prop batches** (`game/propBatches.ts`): a map's static props (not breakable, not carried by movers) of a model
  with at least 8 copies on the map (`PROP_BATCH_MIN`) are thin instances of one mesh per model, material and 128 m
  square: one mesh to look at and one draw per model, material and square (Shingle Point: 13 models, 376 of its 446
  props; Market Town: none). Tints ride in the instance colour; each copy picks its level of detail by its distance
  (hysteresis), and a batch's buffer is rebuilt only when a copy changes level; batches without levels merge into the shadow
  proxies as the instances did, and small clutter casts only near the camera through a shadow-only batch. The map's
  flush and hung lifts (`propFlushLifts`, `hungPropLift`) are in the matrices drawn (unit test). Collision never used
  these meshes. Breakable props and props on movers stay instances. `?perfoff=propbatch`.
- **Still decorations merged** (`scenarioVisuals.ts`, `mergeStill`): ladders, jump pads, bomb sites, rescue zones and
  ziplines without anything to animate, per material and 64 m square.
- **The fog reads the pre-pass depth** (`skyEffects.ts`) where high graphics' ambient occlusion writes it; without
  the pre-pass (WebGPU, lower graphics) it draws its own depth as before. `?perfoff=fogprepass`.
- **Shadow cascades centred on the camera** (`shadowCache.ts`, `centredSlice`): each cascade's square is centred on
  you with the radius that holds its whole view slice (about a tenth bigger than the centroid's square), so turning
  never moves it; it moves (and its static casters are drawn again) only after you walk past its margin (25 / 15 /
  12 % of its radius: about 3.3, 6.2 and 28 m), when the sun turns or the static set changes. The safety refresh is
  now every 240 frames (was 30).
- **Crowds: one mesh per held gun, markers as thin instances** (`view.ts`, `pickupVisuals.ts`, `models.ts`): a
  crowd's held guns and the pickups' models are each one instance of the model merged into one mesh with a part per
  material (`ModelLibrary.instantiateWhole`; the weapons are 3-5 parts of a material each): the same draws, one mesh
  per copy for the scene to look at. Every team marker of a colour is a thin instance of one disc, placed each frame
  where its own disc went (hidden with its body, and while its player is see-through, as before).
- **Blood splats as thin instances** (`bloodVisuals.ts`).
- **Warm-up in view** (`GameView.prewarm`): while the loading screen is up, a character of each look and every gun
  the match can hold (as a crowd's merged instance and as a copy of its own) stand in front of the camera, so every
  pass that draws them in play builds its variant then, with a tracer line, a parachute and a glider (kept for the
  first ones in play); each gun's first-person copy (under the view root: drawn over the world, no shadows) is drawn
  out of sight meanwhile. A warm-up that runs past the gate (a slow machine, a first visit still downloading) draws
  them all far below the map instead, out of sight but drawn (three frames, 2 s at most: longer stalled a slow page's
  first seconds of play). Water's splash rings and drops (made on the first splash) draw a copy out of sight too
  (`WaterFx.warm`).
- **Minimap** (`minimap.ts`): drawn from an image bitmap of the plan, only the window round you, and not at all
  when nothing moved by a pixel.
- **Mass casualties** (`ragdollBudget.ts`, `ragdoll.ts`, `view.ts`): at most 6 bodies start a frame (nearest and
  biggest on screen first; the rest hold their pose a frame or two); a body in view is a full ragdoll while it stands
  at least 3.3 % of the view's height (about 34 m off, further through a scope), cheap below; a body that has landed
  and lain still 0.35 s is frozen at once (was: its full 4 s, or 2.5 s cheap). **Every body still flies with the
  blast**: a body's push now counts from when the view saw it die (and a few frames' grace on a slow page), so the
  last of a big blast's staggered starts no longer drops where it stood.

### Measured

Round 2's probe (a scratchpad script; production build, graphics high, render scale auto, 640 x 360, SwiftShader,
`?test=1&god=1`): **Shingle Point** TDM with 48 bots, the player pinned at the owner's hitch spot (-39, 0, -76) looking
north, 40 bots held on fixed points 5-60 m ahead (two in three running small circles): 44-45 characters in view (8-10 /
14 / 18-19 / 4 at < 15 / 15-35 / 35-70 / > 70 m). **Market Town** TDM with 44 bots, round 2's scenario at (4, 0, -34).
Round 2 is the build from before round 3 (main at 5 Nov 22:38), round 3 the final build of `wip/perf-3`. The box was
shared with two other agents (load 15-35): SwiftShader frame times are noise here, the counts per frame are exact.

| Per frame | Shingle Point, round 2 | round 3 | Market Town, round 2 | round 3 |
|---|---|---|---|---|
| all draws | 1,034 | **489 (-53 %)** | 444 | 435 (-2 %) |
| render-target draws (shadow cascades, depth, reflection) | 535 | 142 | 193 | 194 |
| main pass draws | 499 | 347 | 251 | 241 |
| active meshes | 1,308 | **468 (-64 %)** | 513 | **297 (-42 %)** |
| of them props | 630 | 154 | 70 | 70 (not batched) |
| of them characters (bodies, held guns, markers) | 233 | 92 | 248 | 92 |
| of them ladders / blood splats | 86 / 57 | merged / 1 | 0 / 50 | 0 / 1 |
| shadow casters | 116 | 117 | 120 | 123 |
| main pass triangles | 2.86 M | 1.57 M | 2.28 M | 2.00 M |

On Shingle Point the fog's own depth pass was 402 of round 2's draws; the main pass's prop draws went from 64 to 96
(batches are per square and level of detail) for 476 fewer prop meshes.

**Shadow cache** (Shingle Point, in-page: turning a full circle in 15-degree steps, one frame each, then walking a
straight line a metre a frame; layer renders that drew their static casters again, of all layer renders):

| | before (round 3 without this change) | now |
|---|---|---|
| turning a full circle (24 frames) | 30 of 72 (far cascades every other frame) | 3 of 72 (one change to the cached set) |
| walking 30 m (30 frames) | 21 of 93 | 16 of 90 |
| cascade half-sizes, near to far | 14.8 / 41.5 / 227 m | 16.6 / 47.7 / 258 m |

Walking a 20 m circle at 4 m/s while the view swings 40 degrees either side: 12 of 270 layer renders over 90 frames,
6 of them because a vehicle stood still a second and moved again.

**Shader warm-up** (Shingle Point; a tour after the loading gate's warm-up has finished: eight spawn points looking all
round, every gun the bots held given, fired and aimed, a blast killing four in view, third person, your own death;
every shader program built from then on counted, with the mesh that asked for it):

| Tour (each with the fixes above it) | programs built mid-match | which |
|---|---|---|
| round 3 at the start of this pass, 2 guns given | 1 | water's splash drops (the first splash, on the beach) |
| water warmed; 9 guns | 2 | the rifle's and the launcher's first-person copies |
| the warm-up's copies drawn out of sight after the start; 10 guns | 1 | the shotgun's first-person copy |
| its frames out of sight not capped at 2 s; 8 guns | 2 | the first tracer line in view; the rocket launcher's first-person copy |
| a first-person copy of each gun and a tracer in the warm-up; 11 guns | **0** | none |
| the frames out of sight capped at 2 s again (see below); 10 guns | 1 | the first canopy's rigging lines (a parachute or glider in view) |
| a parachute and a glider in the warm-up (the final build); 8 guns | **0** | none |

Your own gun is drawn over the world and catches no shadows: a program of its own, which the warm-up's copies in the
world never built (the first gun of a kind in your hands built it); a tracer is a line, with a shader of its own, and
a canopy's rigging lines another (coloured).
Under SwiftShader the warm-up takes 2-6 minutes and runs on long past the gate (which waits 8 s for it): its copies
were parked out of sight undrawn, then drawn there in frames capped at 2 s, too few here. Waiting for the frames
instead (the fourth and fifth tours) made the first seconds of play on a slow page heavy enough that CI's hosted-match
flow dropped a friend's page (silent for 20 s), so the cap stayed. On a desktop GPU those frames take milliseconds;
the warm-up can still run past the gate on a first visit while the character files download, and then builds the
rest out of sight in the first seconds of play.

**HUD**: the minimap's frame (in-page micro-benchmark, SwiftShader's canvas): Shingle Point (plan 1,210 x 1,470)
1.02-1.16 ms moving, 0.29 ms still, before; 0.32 ms moving and 0.003-0.007 ms still now. Market Town (650 x 830)
0.56-0.62 and 0.27-0.29 before, 0.31 and 0.003 now. The rest of the HUD's frame is under 0.01 ms.

**Mass casualty** (Market Town, 31 bots held still on rings 2-6 m round a point 12 m ahead, one blast of 7 m kills
them all; every body's hips followed until it lies still):

| | round 2 | round 3 |
|---|---|---|
| bodies thrown up (hips rose 0.3 m or more) | 5 of 30 | **31 of 31** (0.7-27 m, median 2.4) |
| carried out at least 1 m | 7 of 30 | 28 of 31 (median 7.4 m; three bounced back off walls) |
| dropped where they stood (neither) | 23 of 30 | 0 |
| starts a frame (first 20 frames) | 0-3 | 0-3 |
| ragdoll work, worst frame / all frames (SwiftShader) | 776 / 6,178 ms | 843 / 5,885 ms |

On this box the bodies started 1-3 a frame either way (4 ms of starts a frame), over 15-20 frames of a second or more
each: in round 2 every body that started more than 1.2 s after the blast had lost its push. On an M1 Pro the starts
most likely took a few frames, so it looked right there before too; it now holds at any frame rate. Screenshots before, during
and after: scratchpad `p3a/blast/before` and `p3a/blast/after` (`0-before.png`, `f01`-`f45`, `z-end.png`). The
physicsfx e2e flow checks it now, with `physicsfx-blast-before.png` and `physicsfx-blast-after.png` among its
artifacts: every body the blast kills in view is thrown out at least 1 m and up at least 0.3 m (locally: 8 of 8,
out 5.7-8.0 m, up 2.7-3.1 m).

### Projected on the M1 Pro

From the owner's recordings (per-second averages of the round 2 build), scaling each part by what its count did here
(mesh evaluation by the active meshes, the shadow and depth maps by their draws, issuing the main pass by its draws;
characters, effects and the rest as they were):

| Part (ms) | Shingle Point, average | Shingle Point, busiest second | Market Town, average |
|---|---|---|---|
| frame (recorded) | 22.2 | 26.5 (980 draws, 1,130 meshes, 39 characters) | 20.9 |
| main pass (renderScene) | 8.8 → ~6.1 | 11.5 → ~8.1 | 7.1 → ~6.8 |
| mesh evaluation (renderCull) | 3.1 → ~1.3 | 3.8 → ~1.5 | 2.4 → ~1.4 |
| shadow and depth maps (renderShadow) | 4.2 → ~1.5 | 5.0 → ~1.8 | 3.9 → ~3.7 (fewer redraws turning) |
| HUD | 0.65 → ~0.2 | 0.5 → ~0.15 | 0.1 |
| characters, effects, ragdolls, the rest | 5.4 | 5.6 | 7.4 → ~7.1 (bodies rest sooner) |
| **frame (projected)** | **~15** | **~17** | **~19** |

So Shingle Point should hold the 60 fps cap in most views and stay near 55-60 fps in its busiest (draws there ~460,
meshes ~400, from 980 and 1,130); Market Town gains about 2 ms (round 2 merged its level and its props were instances
already; its cost is the characters). A mass death's frame is still the characters' clips and aim (15-16 ms with 40-46 bodies in
view in the owner's Market Town recording): the starts are spread over frames and bodies stop simulating sooner, but
that part is not measured here. Not measured on the M1.

### For the owner to re-record on the M1 Pro

The same as last time, on both maps: TDM, 49 players, high, render scale auto, 60 fps cap, a 25-70 s recording with a
10 s trace; on Shingle Point the same route (the beach at (-39, -76) where the 55 s hitch was), on Market Town a big
fight with a rocket into a crowd. Expect on Shingle Point main views at 350-470 draws and 300-410 meshes (from
700-980 and 850-1,130), renderShadow about 1.5-2 ms, renderCull about 1.5, HUD about 0.15-0.2 and `shadersNew` 0 after
the start; on Market Town meshes about 300 (from 470) and every body of a mass death thrown. If a part didn't fall,
the same match with `?perfoff=propbatch` or `?perfoff=fogprepass` gives the comparison on the same build.

### Next

- Held weapons are 3-5 materials each: a crowd's guns are now one mesh per copy, but still a draw per material per
  weapon model, and each casts per material near the camera. Single-material weapon models (an atlas in the content
  pipeline) would cut both.
- Pickups' shapes and models as thin instances (35-55 meshes on these maps), breakable props batched while intact
  (about 40 on Shingle Point).
- The cascades' squares are about a tenth bigger than before (centred on the camera): shadows a tenth coarser. Not
  seen in CI's visual baselines; worth a look on the M1.
