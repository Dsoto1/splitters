# Sunken Kingdom: QA report

Map `maps/sunken_kingdom.json` on `wip/sunken-kingdom`, 2026-10-30. Machine: the shared 4-core container (other agents'
builds and browsers ran alongside; load average 5–31 during these runs), Chromium with SwiftShader (CPU rendering), so frame
rates are not meaningful; draw calls, meshes, triangles and server tick times are.

## Load

Navigation: 0.2 m recast navmesh built at match load (`NavWorld.build`). Map: 124 tiles, 357 entities (175 props in 32 models,
47 blocks, 10 water bodies, 11 lights, 1 ladder, 56 spawns, 51 pickups, 2 flags, 4 hills), terrain 121 × 121. Within every
budget in MAP_BUDGETS.md. Match and navmesh build: 2.2–9 s headless (load dependent); in the browser the map loads in ~9 s
under SwiftShader (8.9 s vs 9.4–9.7 s for the comparison maps).

## Acceptance tests (contract)

| Test | Result | Evidence |
|---|---|---|
| Saved in the real format and loaded again with no warnings or lost objects | **PASS** | Exported by MapMaker's Export; `validateMap`: no errors, warnings or suggestions; e2e `maps` "opens in MapMaker with no errors and nothing lost" (Import) and "match starts and you spawn on solid ground" |
| Named landmarks exist and show in an overhead picture | **PASS** | `screenshots/top_down_mapmaker.jpg`: palace and round courtyard, market arcade, western colonnade, eastern gatehouse (pylon), cistern road over the buried cistern, lagoon, north pool and falls, SE channel, temple, fountain court, sphinx avenue |
| Surface routes traversable; underground route has real entrances and exits | **PASS** (navmesh) | `navcheck`: 34 named points all reachable from the palace ring; three cistern stair courts (west, east, south). Route lengths in the manifest. Walked by bots, not by a person (see below) |
| No unavoidable one-route choke | **PASS** | Flag to flag: palace (four gate halls), palace ring both ways, northern terraces, southern water courts, cistern |
| Bots reach major zones, pickups and objectives from valid spawns | **PASS** (path queries) / **PARTIAL** (visited in play) | Every spawn, pickup, flag and hill has a path to every zone. In a 32-bot TDM 180 s every major zone was visited except the palace east roof, the market's east walkway, the north pylon's terrace, the NE hypostyle and the gatehouse's gate passage (optional spots) |
| Collision on structures, stairs, ramps, terrain transitions | **PASS** (bots) | Tile pieces are catalog pieces; stairs measured step by step (0.25 m steps, ≤ 0.3 m from the ground onto each flight); stuck events 4 in 32-bot TDM (below) |
| No spawn inside geometry, hazards or enemy fire; at target count | **PASS** (geometry, reachability) / **NOT TESTED** (line of fire at 32 humans) | All 56 spawns on the navmesh; team spawns inside their own base, 160 m apart |
| CTF flags accessible to both teams | **PASS** | Both flags on the navmesh, reachable from every spawn; bots took and returned flags (earlier 8 v 8 run) |
| Pickup ids resolve; not floating or buried | **PASS** | All ids from `CORE_ITEMS` (validator `pickup` checks clean); every pickup on the navmesh |
| Vehicles | **N/A** | No vehicles (foot map) |
| Topology matches the reference | **PASS** (judged by eye) | See DECISIONS_AND_DEVIATIONS.md for the differences (no dome, one-level tiers) |
| Target-bot match run and measured | **PASS** | Below |
| Distinct from other maps | **PASS** (by eye) | No other suite map is a flooded oasis city round a palace; Pharaoh's Reach (Egypt pack demo, retired) is a river and temple map |
| Logs, screenshots, unresolved issues included | **PASS** | This file, `screenshots/`, DECISIONS_AND_DEVIATIONS.md |
| Played by a person | **NOT TESTED** | No human walk-through; only bots and scripted cameras |
| 96 players | **NOT TESTED** | Target is 16–32 |

## Bot matches (headless, the shared simulation, `Match` + bots, scratch script `bots.mts`)

| Mode | Bots | Length | Kills | Stuck events | Server tick avg / p95 / max | Notes |
|---|---|---|---|---|---|---|
| TDM (final map) | 32 (16 v 16) | 180 s | 76 | 4 (palace west shore wall ×2, market arcade stair top, palace south wing) | 2.5 / 4.3 / 54 ms | quiet machine |
| TDM | 32 | 180 s | 83 | 5 | 9.8 / 28 / 958 ms | load ~25; before the last palace-room fix |
| CTF | 16 (8 v 8) | 420 s | 123 | 0 | 5.8 / 15 / 858 ms | **no capture**; an earlier 8 v 8 run had 2 takes, 2 drops, 2 returns |
| Deathmatch | 24 | 180 s | 125 | 0 | 9.1 / 26 / 952 ms | load ~25 |
| King of the Hill | 32 | 180 s | 106 | 0 | 6.7 / 17 / 635 ms | 47 hill events |

A "stuck event" is a bot that moved under 0.5 m for 8 s while not holding, covering or fighting. The 60 Hz budget is 16.7 ms a
tick; the averages are within it at 32 bots (the highs are the loaded machine).

## Performance (client, `tools/perf/client-perf.mjs`, 32 players, graphics medium, 10 s, SwiftShader)

| Map | Draw calls | Active / all meshes | Triangles drawn | Shadow casters | Materials | Load |
|---|---|---|---|---|---|---|
| **Sunken Kingdom** | 500 | 594 / 2,817 | 0.73 M | 411 | 475 | 8.9 s |
| Serpent Gorge (jungle canyon, 8–20) | 446 | 709 / 4,901 | 1.29 M | 543 | 574 | 9.7 s |
| Sunstone Crag (desert, 300 m, 12–24) | 325 | 367 / 2,540 | 0.53 M | 334 | 426 | 9.4 s |

Within CI's `perf:budget` limits (900 draw calls, 600 shadow casters). The tool's "Players" column read 0 on all three maps
(the tool's own count; the match ran).

## Checks and commands

| Check | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | PASS |
| Unit tests | `pnpm test:changed` | PASS: 119 files, 1015 tests (1 file, 2 tests skipped) |
| Content | `pnpm content:check` | PASS: content OK, 78 map pictures (sunken_kingdom.jpg 28 KB, 640 × 360) |
| Build | `pnpm build` | PASS |
| e2e, this map | `E2E_MAPS=sunken_kingdom E2E_ONLY=maps node e2e/run.mjs` (own ports) | PASS: spawns on solid ground; opens in MapMaker with nothing lost |
| e2e, its tour part | `E2E_ONLY=maps3 node e2e/run.mjs` | FAIL for other maps only: under load 31 eight maps' matches didn't start within 60 s; rerun on a quieter machine, `cinder_foundry`, `neon_spire`, `riot_junction`, `verdant_ziggurat` and `sunken_kingdom` passed, `diamond_park`, `iron_tide`, `primeval_park` still "no match" (files unchanged by this work; every map passed "opens in MapMaker"). CI's `maps3` shard on a check branch is the real verdict |
| Validator | `validateMap` | no issues |
| Navigation | scratch `navcheck.mts` | 0 unreachable among 34 zones, 56 spawns, 51 pickups, 2 flags, 4 hills |
| Map picture | `node tools/content/capture-map-shots.mjs <preview> sunken_kingdom` | written; looks over the lagoon to the palace |

Playwright's bundled Chromium revision isn't on this machine: the e2e, picture and perf tools ran from temporary copies with
`executablePath: '/opt/pw-browsers/chromium'` (deleted, not committed).

## How to load it

- Play: Play → pick **Sunken Kingdom** in the map list (or `/?offline=sunken_kingdom`).
- Edit: MapMaker → Open… → templates, or Import `maps/sunken_kingdom.json`.

## Unresolved

- Bot-only CTF doesn't capture in 7 minutes (DECISIONS_AND_DEVIATIONS.md, question 3).
- A few bots stuck briefly against the palace's west wall on the lagoon shore and at the top of a market Arcade Stair.
- Not judged by a person: sightlines from the colonnade cliff, the pace of wading crossings, the falls' look at full frame rate.
