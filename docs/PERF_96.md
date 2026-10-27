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

Left for later: the map side (Norman Shores' own 400–1,100 draws: scenario
pieces such as the 106 destructibles at 3–6 meshes each, foliage chunks,
prop instances evaluated one by one), a character's remaining 3–5 materials
(outfit, skin, hair, eyes, gear: an atlas would make it one), and animation
LOD that steps far, visible characters' clips (Babylon evaluates every
playing clip every frame; only the state machine runs less often).

## Not covered

- Snapshot handling on the page (`msg`) is now the largest sim-related cost
  there; structured-cloned objects from the worker could become transferable
  buffers if it shows up on real hardware.
- Friends' snapshots are still encoded in the host's worker and relayed by
  the page (data channels live on the page).
