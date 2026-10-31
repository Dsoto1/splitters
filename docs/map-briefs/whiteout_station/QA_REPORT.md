# Whiteout Station: QA report (2026-10-31)

| Check | Result | How |
|---|---|---|
| Saved in the real format, loads with no warnings or lost objects | **PASS** | `loadMap` issues `[]` (`stylePacksSnow.test.ts` "Whiteout Station"); opens in MapMaker through Import (`mapmaker-overview.jpg`: 214 tiles, 36 spawns, 25 pickups) |
| Validation incl. navigation | **PASS** | `pnpm validate-map maps/whiteout_station.json`: OK (0 issues): every spawn and pickup reachable on foot |
| Landmarks identifiable | **PASS** | `screenshots/play-overview.jpg` (hangar, barracks, huts, lake and ridges, west ridge, catwalk, bunkers, radar dome, comms mast, watchtowers) |
| Collision and bot access on every structure | **PASS** (tiles) | `stylePacksSnow.test.ts`: bots reach the hut and comms roofs, barracks deck and roof, hangar mezzanine, bunker room and roof, watchtower lookout, radar dome, fuel depot, catwalk by the metal stair, cliff top by the drift, pressure ridge, and climb out of the ice hole, in all four rotations; `kit.test.ts` (every tile in every rotation stays in its cells) |
| Spawns not in geometry or hazards | **PASS** | validate-map (spawns on the navmesh), placed in yards |
| Spawn line of fire, spawn kills at target count | **NOT TESTED** | |
| CTF flags reachable by both teams | **PASS** | navigation check (flags on the navmesh from every spawn) |
| Pickup ids resolve | **PASS** | test checks every pickup against `getItem` |
| Bot match | **PASS (8 bots, 180 s)** | headless audit (botAudit, TDM): 27 kills, 1365 shots, 6 % hits, 141 cells visited, 0 stuck, 6 mounts taken, 73 % armed |
| Snowmobiles | **Partly** | bots mounted sleds in the audit; a person driving a lap NOT TESTED |
| Roll-up door and thin ice in play | **NOT TESTED** by hand | the rule and entities are checked by the test; movers and crumble blocks are existing mechanics |
| 16–24 players, 96-bot stress | **NOT TESTED** | |
| Performance | **NOT TESTED** | no perf run |
| In-game look | **Looked at** | `screenshots/` and the automatic map card |
| Manual walk-through on a real GPU | **NOT TESTED** | routes checked on the navmesh and by bots only |
