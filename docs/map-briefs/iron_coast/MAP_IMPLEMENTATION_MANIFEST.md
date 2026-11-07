# Iron Coast (MAP 21): implementation manifest

| | |
|---|---|
| Map | `maps/iron_coast.json` (id `iron_coast`, "Iron Coast") |
| Source | The owner's reference `docs/map-briefs/shingle_point_reference.jpg`, marked up as `MAP_21_reference_annotated.jpg`; the approved layout `docs/map-briefs/MAP_21_Iron_Coast.md` (owner, 2026-11-07: "Yes follow the image, call it Iron Coast") |
| Author / date | Tile Trigger, built in MapMaker 2026-11-07 |
| Status | Part 1: the playable greybox with Breakthrough (this file's tables); part 2: the visual pass |
| Players | 24 v 24 (Map's pick, `teamSetup [24, 24]`), 16-64 (`recommendedPlayers`); plays to 32 v 32 and 48 v 48 on dedicated hosts |
| Modes | Breakthrough (the map's mode), Team Deathmatch (also offered); Elimination with TDM; Zombies anywhere |
| Weapon set | Military |

## World
- Terrain 380 × 320 m, vertices 2.5 m apart (153 × 129), x −190..190 (east), z −160..160 (north). The sea is south,
  the village north: the attack pushes north. Standard grid: 8 m cells (cell (x, y) is centred on world (8x, 8y)),
  4 m levels.
- Heights (world y): sea bed −4, water surface −0.4, the beach 0 to 1.2 at the cliff foot; the cliff 8 m at the
  grand stair (the lowest), 12 m west and centre, 16 m on the east headland; the promontory west 8 m; the crest
  terraces 12 m to z ≈ 24, B3's knoll 16 m; the fields and village plateau 16 m from z ≈ 36.
- The cliff (map metres, by x): its top edge from z −36 (west) to −22 (the gate) and −37 (the headland), its foot
  from −56 (the promontory) to −34 (the gate); see `DECISIONS_AND_DEVIATIONS.md` for how the pieces meet it.
- Boundary: the terrain's invisible walls.

## Structures (set pieces; anchor cell, level, turn)
| Piece | Where | Cell, level | Notes |
|---|---|---|---|
| Gun Casemate (B1) | West promontory | (−21, −4), 2 (8 m) | the lowest gun; route 1 reaches it |
| Gun Casemate (B2) | Centre-left, at the cliff edge | (−8, −3), 3 (12 m) | over the stone stair (route 3) |
| Gun Casemate (B3) | Centre-right, set back on its knoll | (6, −2), 4 (16 m) | over the wooden stair (route 5) |
| Gun Casemate (B4) | East headland | (20, −3), 4 (16 m) | the biggest and highest; route 7 reaches it |
| Grand Cliff Stair (Gatehouse) | Centre | (−1, −6), 0 | route 4: two flights, the gatehouse, the plaza at 8 m |
| Cliff Stair Tower | Under B2 | (−6, −5), 0 | route 3: 12 m, out at its top onto the crest beside B2 |
| Cliff Casemate | The big cave (A2) | (12, −6), 0 | route 6: the cave mouth on the beach, its rooms in a cove |
| Cliff Stair Tower | Behind the cave | (12, −3), 0 | route 6: the tunnel's climb; its top storey is the crest bunker |
| Command Bunker | The village's head | (−2, 11), 4 | C: the round fort, its command room the final hold |
| Beached Landing Craft ×4 | On the sand | (−17, −11), (−4, −12), (6, −12), (15, −11), 0 | cover on the beach |
