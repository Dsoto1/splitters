# Qasr Medina: QA report (2026-10-31)

| Check | Result | How |
|---|---|---|
| Saved in the real format, loads with no warnings or lost objects | **PASS** | `loadMap` issues `[]` (test `stylePacksDesert.test.ts` "Qasr Medina"); e2e `maps` with `E2E_MAPS=qasr_medina,…` (the match starts, you spawn on solid ground; opens in MapMaker through Import with nothing lost) |
| Validation incl. navigation | **PASS** | `pnpm validate-map maps/qasr_medina.json`: OK (0 issues): every spawn, pickup and objective reachable on foot |
| Landmarks identifiable | **PASS** | overhead MapMaker shot `screenshots/mapmaker-overview.jpg` (wall and gate, roof rows and bridges, high street, courtyard, bazaar, towers, dome, minaret) |
| Collision on every structure, stair, bridge | **PASS** (tiles) | `stylePacksDesert.test.ts`: bots walk every house's two stairs to the roof, outside stairs, rope bridges, galleries, the courtyard and bazaar terraces, the gate's wall-walk and the watch tower lookout in all four rotations; every box stays inside its tile's cells; `kit.test.ts` |
| Watch tower lookouts reachable by bots | **PASS** | bot audit: both snipers (on the two lookouts) were picked up |
| Minaret / dome roof | **Not climbable (by design)** | landmarks; no pickup or objective up there |
| Spawns not in geometry / hazards | **PASS** | validate-map (spawns on the navmesh); placed in yards clear of tiles |
| Spawn line of fire, spawn kills at target count | **NOT TESTED** | |
| CTF flags reachable by both teams | **PASS** | navigation check (flags on the navmesh from every spawn) |
| Pickup ids resolve | **PASS** | test checks every pickup against `getItem` |
| Bot match | **PASS (8 bots, 180 s)** | headless audit (`botAudit.test.ts`, TDM): 27 kills, 781 shots, 14 % hits, 132 cells visited, 0 stuck events, 71 % armed; picks included both snipers, the flamethrower in the domed hall and the roof marksman rifles. Market Town on the same run: 22 kills, 2 stuck. |
| Maps that use Sands of Egypt pieces | **PASS** | `stylePacksDesert.test.ts` loads pharaohs_reach, sunken_kingdom and after_hours (nothing unknown, nothing lost); validate-map on each (no new issues: After Hours keeps its own logic-cycle warning); e2e `maps` on them |
| 16–24 players, 96-bot stress | **NOT TESTED** | |
| Performance | **NOT MEASURED** | tile count (196) and house count (15) are close to Market Town's |
| In-game look | **Looked at** | screenshots in play (gate, high street, roofs, courtyard terrace, bazaar, gallery and dome) and the automatic map card |
| Manual walk-through of every route on a real GPU | **NOT TESTED** | routes checked on the navmesh and by bots only |
