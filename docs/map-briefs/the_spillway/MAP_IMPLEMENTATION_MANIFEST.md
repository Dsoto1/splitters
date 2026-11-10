# The Spillway: implementation manifest

| | |
|---|---|
| Map | `maps/the_spillway.json` (id `the_spillway`, "The Spillway") |
| Source | `docs/map-briefs/MAP_02_The_Spillway.md` and `spillway_reference.jpg` (the owner's concept, 2026-11-05; the build approved 2026-11-08) |
| Author / date | Tile Trigger (MapMaker lane), 2026-11-09 |
| Status | Built in MapMaker, validated (0 issues incl. navigation); on `wip/mapmaker-spillway`, waits for the owner's review (not landed) |
| Players | 16-64 recommended, `teamSetup` 24 v 24; 64 spawn points (32 a side) for 32 v 32 |
| Modes | Team Deathmatch (main); Capture the Flag and King of the Hill from its flag bases and hills (Elimination, Fort Wars, Roulette and Zombies follow as on every map) |
| Theme / weapons | Military Compound; weapon set Military |

## Progress
- [x] Plan (DECISIONS_AND_DEVIATIONS.md)
- [x] Footprint and terrain
- [x] Structures (greybox)
- [x] Routes, collision and navigation (validate-map 0 issues; every spawn, flag, hill and pickup reachable)
- [x] Modes, spawns, pickups
- [x] Visual pass
- [ ] Proof (QA_REPORT.md)

## World
- Terrain 320 × 240 m (x −160..160, z −120..120), 2 m grid (161 × 121), grass with gravel yards, dirt banks and stone
  on the steep faces. Boundary: invisible walls x −156..156, z −116..107 (312 × 223 m).
- Cells of 8 m: cell (x, y) is centred on world (8x, 8y); levels of 4 m (level L's floor at 4L m). North (+Z) is
  upstream.
- Vertical layers (terrain 0.15 m under a level's floor):
  - reservoir bed 2 m, water to 13 m (z 92..120);
  - dam crest (blocks, top 16 m), west upper terrace and switchyard 16 m (level 4);
  - west maintenance yard 8 m (level 2); the east rock spur over the tunnel 13 m (not a play surface);
  - powerhouse floor, toe terrace and the east toe and service yards 4 m (level 1);
  - downstream basin 0 m (level 0); the tailrace river's bed −3 m, water to −0.8 m.
- Backdrop: clear sky, peaks, stone beyond, cliffs round the gorge (none on the reservoir side), haze 0.35, mist 0.2.

## Combat zones (approximate, world metres)
| Zone | Extent | Range | Cover |
|---|---|---|---|
| Dam crest | x −100..100, z 76..92, 16 m up | long (200 m along the road) | intake towers, gantry crane, barriers, parapets, the stair towers' tops |
| Powerhouse | x −52..36, z 44..68, floor 4 m, roof 12 m | close inside the halls and the vault; medium on the roof | turbine drums, galleries, the dock's cargo, racks |
| Toe deck and strip | x −76..96, z 28..76, 4 m | medium | pipework, barriers, generator, stair towers |
| Downstream basin | x −100..100, z −116..28, 0 m | medium-long across the river | bunker cluster, bridge, weir, rocks, pines |
| West maintenance yard | x −156..−84, z −32..60, 8 m (upper terrace 16 m) | medium on the terraces | barracks, vehicle shed, guard tower, containers, tanks |
| Switchyard | x 96..156, z 60..107, 16 m | medium | transformers, control house, guard tower, poles |
| East service tunnel and yards | x 100..156, z −60..60 | close in the tunnel, medium in the yards | the tunnel, the spur |

## Traversal graph
| Route | From → to | Access | Height change | Width | Alternative |
|---|---|---|---|---|---|
| Crest road | west upper terrace ↔ switchyard | walk | 0 (16 m) | 16 m | the toe deck, the basin |
| West dam-face tower | toe (−64, 4, 64) ↔ crest | Stair Tower (switchback) | 12 m | 2.4 m flights | east tower, roof stair |
| East dam-face tower | toe (56, 4, 64) ↔ crest | Stair Tower | 12 m | 2.4 m | west tower, roof stair |
| Roof stair | powerhouse roof (0, 12, 64) ↔ crest | Open Stairs | 4 m | 4 m | the towers |
| Grand Flight | basin (−68, 0, 16) ↔ toe | stair two cells wide | 4 m | 15 m | Long Ramp, ramp junction + yard |
| Long Ramp | basin (40, 0, 8) ↔ toe | ramp | 4 m | 7 m | Grand Flight, tunnel |
| Yard stairs | toe (−74, 4, 32) ↔ west yard | Open Stairs | 4 m | 4 m | ramp junction, crest via upper terrace |
| Ramp junction | basin (−56, 0, −12) ↔ west yard edge (−84, 8, −8) | two ramps (set piece) | 8 m | 3 m | the yard's south ramp |
| Yard south ramp | basin (−150, 0, −72) ↔ yard (−150, 8, −32) | terrain ramp | 8 m | 18 m | ramp junction |
| Yard north ramp | yard (−150, 8, 40) ↔ upper terrace (−150, 16, 80) | terrain ramp | 8 m | 18 m | yard Stair Tower |
| Yard Stair Tower | yard (−104, 8, 48) ↔ upper terrace (−104, 16, 64) | Stair Tower | 8 m | 2.4 m | north ramp |
| East service tunnel | east service yard (128, 4, −30) ↔ east toe yard (128, 4, 38) | Vaulted Tunnel, 64 m | 0 | 3.6 m | the basin and the toe |
| East Stair Tower | east toe yard (120, 4, 46) ↔ switchyard (120, 16, 64) | Stair Tower | 12 m | 2.4 m | east ramp road, crest |
| East ramp road | east toe yard (152, 4, 40) ↔ switchyard (152, 16, 96) | terrain ramp | 12 m | 16 m | East Stair Tower |
| East service ramp | east service yard ↔ basin (x 80..102, z −60..−28) | terrain ramp | 4 m | 32 m | the tunnel to the toe |
| Catwalk Bridge | basin west bank ↔ east bank (z −16) | steel stairs and catwalk 4 m up | 4 m | 2 m | the weir, the powerhouse |
| Weir walk | basin across the river's bend (x −24, z −62..−50) | concrete weir | 0 | 3 m | the bridge |

## Structures (set pieces and tiles: cell of the lowest corner, level, quarter turns)
- Set pieces: `setpiece.loading_dock` (−6, 7) L1 r0; `setpiece.power_core_hall` (−3, 6) L1 r0 and (0, 6) L1 r0;
  `setpiece.server_vault` anchor (4, 8) L1 r2 (cells 3..4, 7..8); `setpiece.stair_tower_4` (−9, 9) L1, (6, 9) L1,
  (−14, 7) L2, (14, 7) L1; `setpiece.catwalk_bridge_3` (1, −2) L0 r1; `setpiece.ramp_junction` (−9, −2) L0;
  `setpiece.bunker_cluster` anchor (9, −9) L0 r2.
- Tiles: `core.stairs_open` (0, 9) L3 r3 (roof → crest) and (−10, 4) L1 r2 (toe → yard); `core.stairs_grand` (−9, 3)
  L0; `core.ramp` (5, 2) L0 r3; `core.tunnel_vault` (16, −3..4) L1; `military.barracks` (−18, 3) L2, (−18, 0) L2,
  (16, 10) L4; `military.vehicle_shed` (−14, −3) L2; `military.guard_tower` (−12, 4) L2, (13, 9) L4.
- Free blocks (PBR concrete unless noted): the dam, four 50 × 14 × 16 m blocks from 2 m at x −75, −25, 25, 75,
  z 84; intake towers 10 × 20 × 10 m at (−56 / −8 / 48, 2, 97); parapets (upstream 1.4 m at z 91.7, downstream
  1.1 m at z 76.3 with gaps at x −64, 0, 56); shore parapets at x ±99; the weir 3 × 3.2 × 14 m at (−24, −3, −56);
  the tunnel's rock roof 12 × 5.45 × 64 m at (128, 7.55, 4) in PBR rock.
- Water: the reservoir 320 × 11 × 28 m at (0, 2, 106); the tailrace 12 × 2.2 × 72 at (16, −3, −10), 76 × 2.2 × 12 at
  (−16, −3, −56), 12 × 2.2 × 70 at (−48, −3, −86).

## Spawns (team, position; Embers face east, Tide face west)
- Embers (32): the west yard, x −124..−100 × z −12..20 (20), x −124..−108 × z 28..44 (8); the upper west terrace
  (−132..−108, 16, 76) (4).
- Tide (32): the switchyard (116..140, 16, 66 and 88), (108, 16, 84), (116, 16, 76 and 84) (11); the east toe yard
  (138..154, 4, 40 and 48) (6); the east service yard (112..152, 4, −52 / −40 / −32) (15).
- All on the navmesh (validate-map); every flag, hill and pickup is reachable from both teams' spawns.

## Objectives
- CTF: Embers' flag base (−136, 8, 40) in the west yard; Tide's (128, 16, 70) in the switchyard.
- King of the Hill: the crest's middle (−20, 16, 82); the east generator hall (8, 4, 56); the basin by the catwalk
  bridge (−4, 0, −28). Radius 5 each.

## Pickups (registry ids, default respawn)
`core.weapon_sniper` (40, 16, 80) crest; `core.weapon_marksman` (−120, 16, 92) upper west terrace, (104, 16, 92)
switchyard; `core.weapon_shotgun` (−16, 4, 52) west generator hall; `core.weapon_smg` (14, 4, 60) east generator hall;
`core.weapon_lmg` (64, 0, −80) bunker cluster; `core.weapon_rockets` (44, 4, 36) toe deck; `core.weapon_rifle`
(−36, 0, −24), (60, 0, −8) basin; `core.grenades` (−40, 4, 50) the dock's apron, (128, 4, 16) in the tunnel;
`core.health_large` (32, 4, 64) the vault's lobby; `core.armor_large` (−20, 0, −80) basin; `core.health_small`
(−64, 4, 72), (72, 4, 72), (−96, 0, −40), (96, 0, −80); `core.armor_small` (−60, 4, 36), (80, 4, 36). With the
Military set, weapon pickups roll within the set's own guns of the same category.

## Vehicles
None (the brief leaves vehicles unspecified). The yards' ramps (18 m), the east road (16 m) and the crest (16 m) are
wide enough for jeeps later.

## Screenshot viewpoints
See QA_REPORT.md.
