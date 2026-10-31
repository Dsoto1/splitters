# Saltmarsh Harbor: QA report (2026-10-31)

| Check | Result | How |
|---|---|---|
| Saved in the real format, loads with no warnings | **PASS** | `loadMap` issues `[]` (`stylePacksHarbor.test.ts`), opened in MapMaker through Import (screenshots) |
| Validation incl. navigation | **PASS** | `pnpm validate-map maps/saltmarsh_harbor.json`: OK (0 issues): every spawn, pickup, flag and hill reachable on foot |
| Landmarks identifiable | **PASS** | `screenshots/mapmaker-overview.jpg` (quay, pier, boardwalk, lighthouse, breakwater, mole, crane, warehouses) |
| Tiles' stairs, ramps and decks walkable by bots | **PASS** | `stylePacksHarbor.test.ts`: 15 routes in all four rotations (lighthouse gallery, net shed loft, warehouse roof, office balcony, slipway/beach/steps out of the water, under the pier) |
| Bots reach main areas | **PASS (navmesh)** | paths from the Embers spawn to the lighthouse gallery, crane platform (ladder), pier head, breakwater, warehouse lofts and roofs, office balcony, harbour bed; Tide warehouse roof: no route (no stair) |
| Bot swimming / jet-ski crossing in a live match | **NOT TESTED** | |
| Bot match (16–24 bots) | **NOT TESTED** | |
| Spawn line of fire at target count | **NOT TESTED** | |
| Performance at 24 players | **NOT TESTED** | |
| In-game look | **Looked at** | screenshots in play, map card |
| Manual walk-through on a real GPU | **NOT TESTED** | |
