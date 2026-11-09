# The Spillway: QA report (2026-11-09)

| Check | Result | How |
|---|---|---|
| Saved in the real format, loads with no warnings or lost objects | **PASS** | MapMaker's Export, imported again for every later step; `loadMap` in the all-maps check (`ALL_MAPS=the_spillway vitest run packages/shared/test/allMaps`): loads, validates, builds, 90 ticks with 8 bots, nobody falls out, every spawn on walkable ground |
| Validation incl. navigation | **PASS** | `pnpm validate-map maps/the_spillway.json`: OK (0 issues): every spawn, flag base, hill and pickup reachable on foot from both teams' spawns |
| Navigation audit | **PASS** | `pnpm nav-audit the_spillway`: 0 traps; the one-way patches left are the river channel (you swim out at the banks), the reservoir and the rock spur's top (no way up, by design) |
| Z-fighting audit | **PASS (0)** | `vitest run packages/shared/test/zfight.test.ts -t the_spillway` |
| Landmarks identifiable | **PASS** | the plan export and the card picture: dam crest, powerhouse (generator halls), switchyard, intake towers, west maintenance yard, east service tunnel |
| Collision and bot access on every structure | **PASS** | the stair towers, the roof stair, the grand flight, the ramp, the ramp junction, the tunnel, the catwalk bridge and the yards' ramps probed both ways on the navmesh as the match builds it; bots used all of them in the bot runs (0 failed route searches) |
| Spawns not in geometry or hazards | **PASS** | validate-map (spawns on the navmesh), all in open yards and on terraces; spawn deaths 0 in every bot run |
| Spawn line of fire at target count | **Partly** | 0 spawn deaths of 34 kills (TDM 24 v 24, 150 s); the crest sees into the upper west terrace's four spawns from ~200 m (a question for the owner) |
| CTF flags reachable by both teams | **PASS** | validate-map; bots took the flag twice in 150 s (no capture yet: the flag run is ~265 m) |
| Pickup ids resolve | **PASS** | validate-map (`getItem`); placed with the palette's pickup tools |
| Bot matches | **PASS** | bot-report, seed 1, 150 s each (below) |
| Performance (server) | **PASS** | `pnpm bench 48 60` and `pnpm bench 64 60` (below), on a shared 4-core box at load ~20 |
| Budgets | **PASS** | collision boxes 3,334 (the shipped maps' 2,700-3,900); lights 36 (the set pieces' own) of 256; prop models 37 of 80; 64 spawns; file ~0.2 MB of 2 MB |
| Reduce flashing | **PASS** | no new effect: only the set pieces' steady lights and glow trim; nothing blinks |
| Foliage | **PASS** | our Pine forest scatter only (env pines and spruces); no Kenney plants |
| Vehicles | n/a | none (the brief leaves them unspecified) |
| 32 v 32 in a browser, 64 v 64 dedicated | **NOT TESTED** | bench at 64 bots only (server) |
| Manual walk-through on a real GPU | **NOT TESTED** | routes checked on the navmesh, by bots and in eye-level screenshots (Play from here) |

## Bot runs (`pnpm bot-report the_spillway --mode=… --seeds=1 --seconds=150`)
- **TDM, 48 bots (24 v 24)**: 34 kills (13.6/min), route searches 3,689, no route 0; stuck recoveries 40 (loops 1);
  idle 9.4 %; spawn deaths 0; coverage 27.6 % a minute. Idle spells of 10 s+: 11 (9 posts: campers at the powerhouse
  roof (−3, 12, 73), the switchyard's edge (102, 16, 75), the east toe yard; 2 single-file queues at the bunker cluster
  (−15, 0, −79) and the tunnel's south mouth (127, 4, −32)).
- **CTF, 24 bots**: takes 2, drops 2, returns 1, captures 0 in 150 s (first take at 103 s); no route 0; stuck 19.
- **KotH, 24 bots**: hill held 79 s, moved twice; no route 0; stuck recoveries 45 (loops 8); 26 kills.
- Nav picture: `the_spillway.png` from `--pictures` (0 traps, 0 failed searches).

## Bench (`pnpm bench N 60 maps/the_spillway.json --mode=core.tdm`)
- 48 bots: tick avg 3.35 ms (p95 9.1), process CPU 1.88 ms a tick; 0 failed path queries.
- 64 bots: tick avg 8.74 ms (p95 24.7, the box at load 20), process CPU 3.81 ms a tick; stuck recoveries 3.

## Screenshots (deviceScaleFactor 2; kept in the agent's scratchpad, not the repo)
- The plan view's Export PNG (ground level, spawns, flags, hills, pickups).
- The card picture (`packages/client/public/maps/shots/the_spillway.jpg`), rendered by capture-map-shots from the map's
  card camera, at eye level in the basin looking north at the dam and the powerhouse.
- Eye level in MapMaker's 3D view (the top level being edited, so nothing is see-through): the dam crest, inside the
  west generator hall, the downstream basin, and along the routes (the service tunnel, the west yard's terraces, the
  toe deck, the catwalk bridge, the switchyard, the dam-face stair tower).
- In the game (Play from here): the crest at eye level. A second Play from here in the same session carried on in the
  first test match instead of starting at the new camera, and each one took ~12 min to load on the shared machine, so
  the other views are MapMaker's.
