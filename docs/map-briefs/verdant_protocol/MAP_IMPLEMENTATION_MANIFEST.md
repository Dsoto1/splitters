# Verdant Protocol: implementation manifest

| | |
|---|---|
| Map | `maps/verdant_protocol.json` (id `verdant_protocol`, "Verdant Protocol") |
| Source | `docs/map-briefs/MAP_04_Verdant_Protocol.md` and `verdant_protocol_reference.jpg` (the owner's concept, 2026-11-05; the build approved 2026-11-08) |
| Author / date | Tile Trigger (MapMaker lane), 2026-11-09 |
| Status | In progress on `wip/mapmaker-verdant` (waits for the owner's review, not landed) |
| Players | 16-32, `teamSetup` 16 v 16; 32 team spawns |
| Modes | Team Deathmatch (main); Capture the Flag and King of the Hill |
| Theme / weapons | Military Compound; weapon set Military (owner to confirm) |

## Progress
- [x] Plan (DECISIONS_AND_DEVIATIONS.md)
- [x] Footprint and terrain
- [x] Structures (greybox)
- [x] Routes, collision and navigation
- [x] Modes, spawns, pickups
- [x] Visual pass
- [x] Proof (QA_REPORT.md)

## World
- Terrain 256 × 192 m (x −128..128, z −96..96), 2 m grid (129 × 97), grass. Cells of 8 m: cell (x, y) is centred on
  world (8x, 8y); levels of 4 m (level L's floor at 4L m). North is +Z.
- Vertical layers (terrain 0.15 m under a level's floor): the bunker level −1 (floor −4 m, under the yard, the ground
  dipped to −1.5 m there); the jungle floor 0 m (level 0) with mounds 1-3 m, rock outcrops 4-7 m and dry gullies at
  −1.65 m; the command plateau 3.85 m (level 1); the watchpost knoll 7.85 m (level 2); a rim raised 6-13 m outside the
  boundary.

## QA (2026-11-10)
- `pnpm validate-map maps/verdant_protocol.json`: OK (0 issues; navigation included). Nav picture: 0 traps, 0 failed
  searches.
- Z-fight audit (`zfight.test.ts`, map and props): passes. `verdantProtocol.test.ts` (landmarks, the bunker under its
  yard, our foliage only, navigation both ways): passes.
- Budgets: 48 tiles on the ground plan (61 tile records over five levels), 4 set pieces, 21 blocks, 7 doors, 32
  spawns, 2 flags, 4 hills, 18 pickups, 72 props of 40 models (of 80), 1,972 plants of our species (the Environment
  brush, their own budget), 17 steady lights (of 256); entities 2,102 of 4,096; **944 collision boxes** (the shipped
  maps' 2,700-3,900).
- bot-report, 32 bots, 150 s, seed 1 (load 7-11 on 4 cores):
  - TDM: embers 51 · tide 80, 131 kills, stuck recoveries 36, no route 0 %, spawn deaths 0; three ways each side.
  - CTF: tide 1 capture (first take 39 s, capture 80 s), 128 kills, stuck 39 (2 loops), no route 0 %, spawn deaths
    2.3 %.
  - KotH: tide 39 · embers 0 (hill held 40 s, empty 110 s, 2 moves), 112 kills, stuck 26, no route 0 %. One seed: the
    lopsided hill score wants more seeds and a look at the hills' order before landing.
  - Stuck spots (TDM): the yard's south-west outside corner (−28..−32, −28..−36), its south-east corner (28, −28..−36),
    the west stair hut's foot (−24, −16), the ward (12, −4, −24); idle posts at the south-west road (−32, −73).
- Bench (server tick, 32 bots, TDM, 60 s, load 11): avg 4.8 ms, p50 2.9, p95 9.4 ms of 16.7; spawn deaths 1 of 35.
- Card shot: the card-shot camera at eye level (6, 1.55, 12) on the plaza looking north to the command post and the
  watchpost; `packages/client/public/maps/shots/verdant_protocol.jpg` from it (capture-map-shots).
- Screenshots: `screenshots/` (the plan export and 15 eye-level views of the landmarks and routes).
