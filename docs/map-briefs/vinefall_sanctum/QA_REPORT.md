# Vinefall Sanctum: QA report (2026-10-31)

| Check | Result | How |
|---|---|---|
| Saved in the real format, loads with no warnings or lost objects | **PASS** | `loadMap` (test `stylePacksJungle.test.ts` "The pack's demo map"); e2e `maps` with `E2E_MAPS=vinefall_sanctum,jungle_steps` (CI=1: the match starts, you spawn on solid ground; opens in MapMaker through Import with nothing lost) |
| Validation incl. navigation | **PASS** | `pnpm validate-map maps/vinefall_sanctum.json`: OK (0 issues): every spawn, pickup and objective reachable on foot |
| Landmarks identifiable | **PASS** | overhead MapMaker shot `screenshots/mapmaker-overview.jpg` (gorge and bridges, ziggurats and shrines, carved temples, waterfall walls, watch towers) |
| Collision on every structure, stair, bridge | **PASS** (tiles) | `stylePacksJungle.test.ts`: bots walk the terrace stairs (stacked too), the temple roof and the colonnade roof beside it, the shrine, the watch tower lookout, both high bridge spans, the chasm rope bridge, the gorge steps, the arch wall, the vaults and the passage behind the falls in all four rotations; every tile validates on its own; `kit.test.ts` |
| Shrine snipers, high bridges, gorge pickups reachable | **PASS** | navigation check (validate-map: every pickup on the navmesh from the spawns) |
| Spawns not in geometry / hazards | **PASS** | validate-map (spawns on the navmesh); placed in yards and courts clear of tiles |
| Spawn line of fire, spawn kills at target count | **NOT TESTED** | |
| CTF flags reachable by both teams | **PASS** | navigation check |
| Pickup ids resolve | **PASS** | validate-map |
| Maps that use the earlier Jungle Ruins pieces | **PASS** | `stylePacksJungle.test.ts` loads and validates every map using jungle pieces (Verdant Ziggurat, Erosion, Jungle Steps, Sunken Kingdom and the rest); validate-map OK (0 issues) on jungle_steps, verdant_ziggurat, erosion; e2e `maps` on jungle_steps |
| Bot match | **NOT RUN** | the bot audit (`botAudit.test.ts`) was not run on this map |
| 16–24 players, 96-bot stress | **NOT TESTED** | |
| Performance | **NOT MEASURED** | 195 tiles, 130 props |
| In-game look | **Looked at** | screenshots in play (`screenshots/view-*.jpg`) and the automatic map card (`tools/content/capture-map-shots.mjs`, an in-match render, recaptured after the merge with main) |
| Manual walk-through of every route on a real GPU | **NOT TESTED** | routes checked on the navmesh only |
