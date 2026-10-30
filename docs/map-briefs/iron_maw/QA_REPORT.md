# Iron Maw: QA report

Map `maps/iron_maw.json` on `wip/iron-maw` (2026-10-30). Container: 4 cores shared with other agents
(load 0–28 during the runs; noted per run). Rendering is SwiftShader (CPU), so frame times say nothing
about a real GPU; draw calls, triangles, shadow casters and the simulation's CPU per tick do.

## Acceptance tests (contract)

| Test | Result | Evidence |
|---|---|---|
| Saved in the real format and loaded again without warnings or lost objects | **PASS** | `loadMap` + `validateMap`: 0 issues; `pnpm validate-map maps/iron_maw.json`: "OK (0 issues)" (navigation checks included); MapMaker Import (built client, `?mode=editor`): 976 entities, 19 tiles, 0 issues; e2e `maps` (E2E_MAPS=iron_maw): "opens in MapMaker with no errors and nothing lost" |
| Named landmarks exist and read in an overhead screenshot | **PASS** | `screenshots/mapmaker_topdown.jpg`, `mapmaker_oblique_sw.jpg`: pit floor and excavator, benches, crusher (north lip), conveyor gantries and overland conveyor, workers' barracks (NE), haul roads (rim ring, spiral, switchbacks) |
| Surface routes traversable; underground routes have entrances and exits | **PASS** (navmesh, not walked by hand) | Terrain walkability flood (triangle slope ≤ 50°): one connected area; floor → rim shortest walk 580–780 m (faces not climbable). Navmesh: all 161 spawns, pickups and objectives reachable from the Embers flag in one query; all 12 ladders and 3 lifts linked; T1, T2, T3 open at both ends (navmesh and `fp_04` screenshot). A player walk-through of every route by hand: **NOT TESTED** |
| No unavoidable one-route choke | **PASS** | Pit: spiral + switchbacks + 3 lifts + 9 bench ladders; rim: north via the plant, south via T1 or over the spur; between camps: plant interiors, gantries, rim road both ways, through the pit |
| Bot pathing reaches major zones, pickups and objectives from spawns | **PASS** | navmesh check above; 96-bot server matches below (path failures 0.04–1.3 % spread out) |
| Collision on structures, stairs, ramps, terrain transitions | **PASS** (automated) | e2e: you spawn and stay on solid ground; navmesh on every ramp, deck and gantry; ramps sunk into the ground at their foot; terrain kept under block tops. Hand-checking every block for gaps: **NOT TESTED** |
| No spawn inside geometry, hazards or enemy line of fire; at target count | **PARTIAL** | Every spawn checked clear of every box and on ground under 22° (build helper), on the navmesh (`validate-map`). Spawn deaths in 96-bot matches: 0 of 36 (TDM), 0 of 63 (CTF), 0 of 7 (KOTH). Line of fire per spawn and a 96-*player* test: **NOT TESTED** |
| CTF flags / objectives reachable by both teams | **PASS** | flags, 5 hills, 2 bomb sites on the navmesh and reachable; KOTH bench: the hill was held and moved |
| Pickup IDs resolve; not floating or buried | **PASS** | items from `sim/items.ts` (`core.weapon_*`, `core.ammo_*`, `core.health_*`, `core.armor_*`, `core.grenades`), validated by `loadMap`; positions on the ground (+5 cm) or on decks, checked clear of boxes |
| Vehicle roads and AI traversal | **PARTIAL** | Roads 8–13 m wide, ramps 13–38 % (8–21°), well under the 50° climb; 21 vehicles placed and start alive (`vehicles` e2e flow passes). Bots driving the spiral and switchbacks: **NOT TESTED** (the bench reports no per-vehicle route data) |
| Screenshot matches the reference's topology | **PASS** (by eye) | nested asymmetric horseshoe terraces, spiral road, crusher on the north lip, conveyors east, barracks NE, rock all round (`mapmaker_oblique_sw.jpg` next to `../iron_maw_reference.jpg`) |
| Target-bot match measured for errors, stuck bots and performance | **PASS** for 96 bots (server); 96 *players* **NOT TESTED** | below |
| Distinct from other maps | **PASS** | the only open-pit/terraced map; no water, no bridge hub (Sunken Kingdom, Spillway) |
| Logs, screenshots and open issues included | **PASS** | this file, `screenshots/`, DECISIONS_AND_DEVIATIONS.md |

## Commands run and results

| Check | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | pass |
| Unit tests on changed files | `pnpm test:changed` | no tests depend on the changed files ("No test files found") |
| Tests that read every map | `pnpm exec vitest run packages/shared/test/{unifiedPaths,pads,playlist,terrainFloors,rotation,botSet}.test.ts tools/ci/test/select.test.mjs` | 7 files, 95 tests pass |
| Content | `pnpm content:check` | content OK (78 map pictures incl. `iron_maw.jpg`, 1224 props) |
| Build | `pnpm build` | pass |
| e2e, this map | `E2E_MAPS=iron_maw E2E_ONLY=maps node e2e/run.mjs` (temp copy with Chromium path, own ports 4873/7881) | 2 / 2 pass (spawn on solid ground, opens in MapMaker), 41 s |
| e2e, its tour part | `E2E_ONLY=maps3` | 24 / 24 pass, 494 s |
| e2e, vehicles | `E2E_ONLY=vehicles` | 17 / 17 pass, 52 s |
| Map validation | `pnpm validate-map maps/iron_maw.json` | OK (0 issues) |
| Map picture | `tools/content/capture-map-shots.mjs` (temp copy, own preview port) | `packages/client/public/maps/shots/iron_maw.jpg`, 26 KB |

## Bot matches (96 bots, server simulation, `pnpm --filter @tiletrigger/server bench`)

| Mode, layout | Seconds | Box load | Wall ms/tick avg / p95 | CPU ms/tick | Path queries (failed) | Kills | Stuck recoveries | Idle samples | Spawn deaths |
|---|---|---|---|---|---|---|---|---|---|
| TDM spread | 60 | 20 | 18.1 / 64.9 (loaded box) | 8.2 | 4,197 (55) | 36 | 81 | 4.0 % | 0 |
| CTF spread | 60 | 26 | 21.6 / 75.8 (loaded box) | 8.6 | 8,506 (44) | 63 | 260 | 23.2 % | 0 |
| KOTH spread | 90 | 2.8 | 3.7 / 7.4 | 4.9 | 15,877 (6) | 7 | 93 | 1.4 % | 0 |
| TDM spread (10 s warm-up) | 30 | 2.5 | 4.1 / 7.1 | 6.6 | 1,511 (7) | 8 | 20 | 2.3 % | 0 |
| TDM clumped (40 m, everyone in the middle) | 30 | 2.2 | 7.0 / 11.3 | 8.0 | 3,726 (1,166) | 162 | 27 | 47.6 % | 66 |

Read: on a quiet box a 48 v 48 tick costs 4–7 ms of the 16.7 ms budget, clumped included, in line with
Frost Basin and Norman Shores (MAP_BUDGETS.md). The clumped run's failed paths and idle bots come from the
bench putting all 96 on one patch in the pit (bots on narrow benches crowd); spread out, failures are
0.04–1.3 %. CTF: no capture in 60 s (flags 300 m apart; bots spend the minute crossing), and stuck
recoveries are higher than TDM. KOTH: the first hill is the pit floor, ~2 min from the camps, so the first
minute and a half is the march down; the hold and the move to the next hill happened.

## Client performance at 96 (`tools/perf/perf96.mjs iron_maw`, Medium, worker sim)

| Scenario | Draw calls | Active meshes | Triangles | Shadow casters | Characters in view | Worker tick p50 / p95 |
|---|---|---|---|---|---|---|
| spread | 1,024 | 1,866 | 2.31 M | 120 | 94 | 3.0 / 6.2 ms |
| clumped | 758 | 700 | 1.81 M | 277 | 20 | 2.8 / 7.5 ms |

Budgets (PERF_96.md): draws ≤ 2,000 on a big map at Medium (Norman Shores 1,835), casters ≤ 600, effects
in the shadow pass 0 (measured 0), effect starts ≤ 40 ms (measured ≤ 1.2 ms). All within. Frame times
(SwiftShader, 0.2 fps) are not meaningful. Low graphics and a real GPU (`PERF_GPU=1`): **NOT TESTED**.
Map load: navmesh 8–18 s on this box (load 0–25); match ready in the browser in ~29 s.

## Known issues and limits
- 96 human players, and a player walking every route by hand: **NOT TESTED** (no way to do it here).
- Bot drivers on the spiral, switchbacks and hairpins: not measured; the SC leg (38 %, 21°) and the R6 floor
  ramp (38 %) are steep for the buggy's gearing (they climb, slowly).
- Bench faces at 3 m terrain spacing read as a zig-zag from above (the grid); up close they read as rough
  rock.
- The `stone` terrain material (`core.pbr_rock`) is mossy green-grey; the image's faces are orange-brown.
  There is no orange rock terrain material yet (an owner choice whether to add one).
- `recommendedPlayers` max 32 (schema cap) though the map is for 64–96.
