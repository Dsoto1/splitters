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

Not checked: a perf bench with the vegetation; the flicker check (no new effect).
