# Market Town: QA report (2026-10-31)

| Check | Result | How |
|---|---|---|
| Saved in the real format, loads with no warnings or lost objects | **PASS** | `loadMap` issues `[]` (test `stylePacksMedieval.test.ts` "Market Town"); e2e `maps` with `E2E_MAPS=market_town` (the match starts, you spawn on solid ground; opens in MapMaker through Import with nothing lost) |
| Validation incl. navigation | **PASS** | `pnpm validate-map maps/market_town.json`: OK (0 issues): every spawn and pickup reachable on foot |
| Landmarks identifiable | **PASS** | overhead MapMaker shot `screenshots/mapmaker-overview.jpg` (wall and gate, stream and bridges, square and fountain, hall, bell tower, watchtowers) |
| Collision on every structure, stair, bridge | **PASS** (tiles) | `stylePacksMedieval.test.ts`: bots walk every tile's stairs and floors in all four rotations; `kit.test.ts` (every tile in every rotation stays in its cells, somewhere to stand) |
| Bell Tower belfry reachable by bots | **FAIL (known)** | players climb it (0.25 m steps); the navmesh drops the stacked switchback inside walls, so bots stay below. No pickup or objective is up there. |
| NW watchtower lookout reachable by bots | **FAIL (known)** | the same tile at (5, −5) is reachable; the copy at (−5, 6) loses its west flight on the navmesh (voxel alignment). Its pickup moved to the wall-walk. Players climb it. |
| Spawns not in geometry / hazards | **PASS** | validate-map (spawns on the navmesh); placed in yards clear of tiles |
| Spawn line of fire, spawn kills at target count | **NOT TESTED** | |
| CTF flags reachable by both teams | **PASS** | navigation check (flags on the navmesh from every spawn) |
| Pickup ids resolve | **PASS** | test checks every pickup against `getItem` |
| Bot match | **PASS (8 bots, 180 s)** | headless audit (botAudit, TDM): 22 kills, 565 shots, 10 % hits, 132 cells visited, 80 % armed; 2 stuck events, both in the stream bed at x ±44 near the map's edge (bots heading for the south quay, 2 m sheer: the way out is the north bank) |
| 16–24 players, 96-bot stress | **NOT TESTED** | |
| Performance | **Measured, idle** | `tools/perf/client-perf.mjs` (SwiftShader, medium): 836 draw calls (perf budget 900), 595 active meshes, 1.87 M triangles in view, 596 shadow casters, 501 materials; Pharaoh's Reach on the same run: 554 draws, 0.91 M triangles. Most triangles are the shared forest border (≈440 k, instanced) and characters, not the town. Bots did not join that run (0 players). FPS on CPU rendering is not meaningful. |
| In-game look | **Looked at** | screenshots in play (square, roofs, gate, high street) and the automatic map card |
| Manual walk-through of every route on a real GPU | **NOT TESTED** | routes checked on the navmesh and by bots only |
