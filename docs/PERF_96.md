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
- `PERF_MAX_CASTERS=320`: the average shadow casters in a clumped frame (Frost Basin medium was 184–248; low has none);
- `PERF_MAX_FX_MS=40`: starting an explosion, both hits and every muzzle flash on a fresh rig (median of three) mid-fight. Measured 1–3 ms.

Turning off the effect exclusion and the flash materials' blocked dirty mechanism made the run fail with 124–129 effect meshes in the shadow pass and flash starts of 43–73 ms.

**What the flash starts were.** In a 96-player scene (about 5,000 meshes) a new muzzle flash rig took 20–80 ms. Every new `ShaderMaterial`'s `backFaceCulling` / `alphaMode` setters walk every mesh and submesh to mark them dirty (three walks a piece, 15 pieces in a big flash), and `Mesh.clone` deep-copies the source's properties. Flash materials now block their dirty mechanism (they only ever take uniforms), and rig pieces and effect meshes share their source's geometry instead of cloning it.
