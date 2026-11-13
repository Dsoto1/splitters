# The Spillway: QA report (the rebuild, 2026-11-11)

| Check | Result | How |
|---|---|---|
| Saved in the real format | **PASS** | MapMaker's Export after every step (format v35) |
| Validation incl. navigation | **PASS** | `pnpm validate-map maps/the_spillway.json`: OK, 1 note (48 spawn points for up to 64 players) |
| Routes between levels | **PASS** | the game's navigation walks terrace ↔ crest by both towers, terrace ↔ both benches, crest ↔ both abutments |
| Spawns not in geometry | **PASS** | validate-map; one spawn that stood in rock was placed again |
| Objectives and pickups reachable | **PASS** | validate-map, from both teams' spawns |
| Bots play it | **PASS** | `pnpm bot-report the_spillway --mode=core.tdm --seeds=1 --seconds=150`: 48 bots, 123 kills (49/min), no route 0, spawn deaths 1, idle 10.2 %, stuck recoveries 31 (loops 0), coverage 23 % a minute |
| Quality gates | **Reports** | spawn points for its players (48 for up to 64): reported, since the map is Experimental |
| Seen in a browser | **Partly** | MapMaker views of every step; not yet walked in a match by a person |

## The bases moved (owner: "one team in valley other up on dam"), bot runs of 48 bots, 150 s, seed 1
With both bases low (as first landed) King of the Hill ran Embers 59, Tide 1 and nobody took a flag. With Embers on the crest and Tide in the valley:
- **Team Deathmatch**: Embers 32, Tide 62; 95 kills; spawn deaths 0; idle 12.5 %; stuck recoveries 48 (loops 0); no route 0.
- **King of the Hill**: Embers 25, Tide 38; the hill held 65 s, moved; 131 kills; spawn deaths 1; no route 0.
- **Capture the Flag**: still no flag taken in 150 s (178 kills; the run is the valley's length plus a stair tower). Bots spend 49 % of goal time going for it; a longer run or a person may get there. No route 0.
- validate-map: OK (1 note, the spawn count).
Tide leads both scored modes in one seed each: not a balance verdict. The stair towers are the only way up the face and the recoveries rose (31 to 48 in Team Deathmatch).

## The long stair (2026-11-12), bot runs of 48 bots, seed 1
A third way up the dam's face, six open flights. validate-map OK (1 note).
- 150 s: Team Deathmatch Embers 44, Tide 91 (136 kills; 95 before the stair); King of the Hill Embers 28, Tide 5 (227 kills; it was 25 to 38); Capture the Flag still no flag taken (212 kills). The scores swing between single runs; no route 0 in all three.
- **Capture the Flag over a full match (600 s): 20 takes, 2 captures** (both Tide's), 18 drops, 5 returns; the first take at 156 s, the first capture at 357 s; 751 kills. The 150 s runs above were too short to show a take: the mode works on this layout.

## Crest returns, slab rails, wing wall, hillside stair legs (2026-11-13)
21 solid concrete blocks placed in MapMaker. `validate-map`: OK, 0 issues. `nav-audit`: 0 traps, 49 islands
(15,904 m²), 8 drop links, the same as before the blocks (3,641 to 3,644 polygons). MapMaker's own list: the one
warning it had before (5 coplanar faces, the long stair's slab against its top flight).

## Perf bench (2026-11-13; SwiftShader on a 4-core box, so compare, don't read as absolutes)
Ten fixed eye-level cameras, bots parked out of view, the same build with the map as on main and as on the branch.
The blocks change nothing measurable: draw calls and active meshes are identical at every camera.

| Camera | Medium: draws / meshes / triangles / shadow casters | Low: draws / meshes / triangles |
|---|---|---|
| Crest middle, looking east | 488 / 234 / 0.49 M / 542 | 226 / 223 / 0.24 M |
| Crest middle, looking west | 334 / 252 / 0.45 M / 367 | 226 / 227 / 0.21 M |
| Crest middle, over the south parapet | 600 / 510 / 0.51 M / 382 | 462 / 470 / 0.27 M |
| Crest west end, looking east | 613 / 488 / 0.58 M / 147 | 476 / 483 / 0.30 M |
| Toe terrace, looking up the dam | 398 / 286 / 0.43 M / 402 | 262 / 264 / 0.18 M |
| Valley (z -60), looking north | 685 / 504 / 0.61 M / 466 | 464 / 469 / 0.27 M |
| River, looking south | 424 / 281 / 0.63 M / 441 | 273 / 274 / 0.31 M |
| Tide's bench, looking north | 695 / 551 / 0.63 M / 197 | 512 / 521 / 0.29 M |
| East bench, looking west | 700 / 576 / 0.54 M / 149 | 527 / 538 / 0.28 M |
| Hillside stair's foot | 317 / 198 / 0.50 M / 431 | 182 / 181 / 0.21 M |

The worst camera is 700 draw calls and 542 shadow casters on medium (the perf budget on Frost Basin is 900 and 600).
`tools/perf/client-perf.mjs` with 48 players, 10 s, one pass each: 429 to 587 draws, 410 to 688 casters, 0.64 to
0.79 M triangles on medium, 0.2 to 0.5 fps against Frost Basin's 1.0 on the same box; low 293 to 341 draws, 0.4 fps.
Those passes sample two to five frames with bots moving, so they swing; one of them read 688 casters, over the 600
budget. The environment draws all of its 397 to 406 batches (2,239 plants) wherever the player looks. Not measured on
a real GPU.

## Bots with the new blocks (2026-11-13), 48 bots, Team Deathmatch, 150 s, seeds 1 to 16
No route 0 on every seed with the blocks (main's map: 3 on one seed). Stuck recoveries a match: main's map 70 on
average (48 to 102), with the blocks 88 (50 to 139); about two standard errors apart, so probably a small real rise.
On both maps most of them are on the long stair's landings (cells x 20 to 32, z 20 to 36, at 8, 12 and 16 m), and a
few at its head by the crest (24, 28, 52), where the new returns and rails are cover bots now use. Taking the long
stair's ten legs out of main's map changes nothing (58 over seeds 1 to 8), so the legs are not what catches them: the
long stair's joints are, and that is open.

Not checked: the flicker check (no new effect).
