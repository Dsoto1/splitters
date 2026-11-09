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
- [ ] Footprint and terrain
- [ ] Structures (greybox)
- [ ] Routes, collision and navigation
- [ ] Modes, spawns, pickups
- [ ] Visual pass
- [ ] Proof (QA_REPORT.md)

## World
- Terrain 256 × 192 m (x −128..128, z −96..96), 2 m grid (129 × 97), grass. Cells of 8 m: cell (x, y) is centred on
  world (8x, 8y); levels of 4 m (level L's floor at 4L m). North is +Z.
- Vertical layers (terrain 0.15 m under a level's floor): the bunker level −1 (floor −4 m, under the yard, the ground
  dipped to −1.5 m there); the jungle floor 0 m (level 0) with mounds 1-3 m, rock outcrops 4-7 m and dry gullies at
  −1.65 m; the command plateau 3.85 m (level 1); the watchpost knoll 7.85 m (level 2); a rim raised 6-13 m outside the
  boundary.
