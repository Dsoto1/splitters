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
