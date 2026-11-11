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

Not checked: a perf bench with the vegetation; CTF and King of the Hill bot runs; the flicker check (no new effect).
