# The Spillway: implementation manifest

| | |
|---|---|
| Map | `maps/the_spillway.json` (id `the_spillway`, "The Spillway") |
| Source | `docs/map-briefs/MAP_02_The_Spillway.md` and `spillway_reference.jpg` (the owner's concept, 2026-11-05; the build approved 2026-11-08) |
| Author / date | Tile Trigger (MapMaker lane), 2026-11-09 |
| Status | In progress on `wip/mapmaker-spillway`: waits for the owner's review, not landed |

## Progress
- [x] Plan (DECISIONS_AND_DEVIATIONS.md)
- [x] Footprint and terrain (320 × 240 m at 2 m; Flatten at typed heights)
- [ ] Structures (greybox)
- [ ] Routes
- [ ] Collision and navigation (validate-map)
- [ ] Modes, spawns, pickups
- [ ] Visual pass
- [ ] Proof (card shot, screenshots, bot-report, bench, budgets, CI)

## World
- Terrain 320 × 240 m (x −160..160, z −120..120), 2 m grid (161 × 121), grass; north (+Z) is upstream.
- Cells of 8 m: cell (x, y) is centred on world (8x, 8y); levels of 4 m (level L's floor at 4L m).
- Vertical layers (terrain flattened 0.15 m under the level's floor):
  - reservoir bed 2 m (water to 13 m), outside the play area;
  - dam crest and the abutment terraces (west upper terrace, switchyard) 16 m, level 4;
  - west maintenance yard 8 m, level 2; east rock spur over the service tunnel 13 m;
  - toe terrace (the powerhouse's floor, the toe deck) and the east toe and service yards 4 m, level 1;
  - downstream basin 0 m, level 0; the tailrace river's bed −3 m, water to −0.8 m.
