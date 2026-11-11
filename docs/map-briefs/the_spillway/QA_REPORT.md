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

## Objective modes (bot runs after landing, 48 bots, 150 s, seed 1)
- **King of the Hill: lopsided.** Embers 59, Tide 1; the hill held 61 s, never contested. Embers' base (the west bench, z −36..12) is much nearer the crest and the toe terrace than Tide's (the south-east bench, z −80..−92). No route 0, spawn deaths 0.
- **Capture the Flag: no flag taken.** 257 kills, nobody reached a flag (0 takes); the teams meet on the river's floor and the flag run is about 260 m. No route 0, spawn deaths 1.
- Team Deathmatch (above) is fine. For the owner: where the bases stand (a question in HANDOFF).

Not checked: a perf bench with the vegetation; the flicker check (no new effect).
