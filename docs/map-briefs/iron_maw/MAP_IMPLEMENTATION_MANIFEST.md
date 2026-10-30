# Iron Maw: map implementation manifest

| | |
|---|---|
| Map ID / name | `iron_maw` / Iron Maw |
| File | `maps/iron_maw.json` (format `tiletrigger.map` v24, ~840 KB) |
| Source image | `docs/map-briefs/iron_maw_reference.jpg` (owner-approved, unchanged) |
| Brief | `docs/map-briefs/BUILD_06_Iron_Maw.md` (as of 2026-10-30) |
| Contract | `docs/map-briefs/AGENT_BUILD_CONTRACT.md` v1.0, repo adaptations in `docs/map-briefs/README.md` |
| Author | Tile Trigger (built by a Claude agent for the owner, 2026-10-30) |
| Status | Built, saved, reloaded in MapMaker and played offline; on `wip/iron-maw`, not merged |
| Approved decisions | Meshy excavator and haul truck approved by the owner (models by the lead); bases, routes and scale choices in DECISIONS_AND_DEVIATIONS.md |
| Shared discovery | `docs/map-briefs/DISCOVERY_REPORT.md` (on `wip/sunken-kingdom`); Iron Maw-specific findings below |

## World

- **Units**: metres. **Axes**: +X east, +Z north, +Y up (`viewDirection(yaw)`: yaw 0 faces +Z). Facing
  angles below are degrees from +Z toward +X.
- **Origin**: world (0, 0, 0) is near the middle of the north half of the pit; the pit's polar centre used
  for the layout is (−10, −32).
- **Terrain**: origin (−240, −240), spacing 3 m, 161 × 161 vertices (480 × 480 m), baseY −60 (heights
  stored in cm above it), boundary walls on. Materials: sand (rim and benches), gravel (pit floor and
  stockpiles), stone (bench faces > 38° and the rock outside the rim). No foliage (every cell bare).
- **Playable bounds**: invisible walls x, z ∈ [−204, 204] (408 m), 60 m tall. Outside, the terrain climbs to
  +26…+40 m of rock; backdrop sky `sunset`, scenery `mesas`, ground `sand`, haze 0.35, border `cliffs`.
- **Physics**: default (normal gravity, no fall damage). No water, lava or other hazards.
- **Vertical layers** (bench elevations; each face 8 m):

| Layer | y (m) | Where |
|---|---|---|
| Rim (L0) | 0 (rock to +40 outside) | Plant, camps, depot, yard, loadout, rim haul road |
| L1 | −8 | First bench |
| L2 | −16 | |
| L3 | −24 | West Bench Tunnel |
| L4 | −32 | |
| L5 | −40 | Deep Drift |
| Pit floor (L6) | −48 | The Maw: excavator, trucks, power weapons |

- **Bench edges** (where each face is; the pit is nested ellipses with a shared irregular outline, so the
  benches are wide on the north and narrow on the south-west, and the south-east is pushed in for the
  switchbacks):

| Curve | N edge z | S edge z | E edge x | W edge x |
| C1 | 107 | -140 | 140 | -141 |
| C2 | 83 | -127 | 119 | -125 |
| C3 | 57 | -108 | 94 | -106 |
| C4 | 34 | -94 | 72 | -89 |
| C5 | 15 | -84 | 54 | -76 |
| C6 | -5 | -73 | 34 | -61 |

| Ramp | Band | Top angle → bottom | Top (x, y, z) | Bottom (x, y, z) | Length | Grade |
| R1 | 1 | 112° → 80° | (-56, 0, 82) | (12, -8, 93) | 71 m | 15 % (graded part) |
| R2 | 2 | 64° → 28° | (35, -8, 60) | (89, -16, 21) | 66 m | 16 % (graded part) |
| R3 | 3 | 12° → -30° | (81, -16, -13) | (63, -24, -74) | 67 m | 15 % (graded part) |
| R4 | 4 | -44° → -96° | (35, -24, -75) | (-16, -32, -91) | 47 m | 22 % (graded part) |
| R5 | 5 | -110° → -182° | (-29, -32, -83) | (-68, -40, -30) | 79 m | 13 % (graded part) |
| R6 | 6 | 168° → 98° | (-48, -40, -24) | (-13, -48, -13) | 27 m | 38 % (graded part) |
| SA | 1 | 304° → 280° | (50, 0, -121) | (8, -8, -132) | 43 m | 24 % (graded part) |
| SB | 2 | 280° → 304° | (5, -8, -119) | (42, -16, -109) | 38 m | 27 % (graded part) |
| SC | 3 | 304° → 280° | (29, -16, -90) | (1, -24, -96) | 27 m | 38 % (graded part) |

| Tunnel | Arc | Floor y | Clear width | Portals (x, z) |
| T1 South Rim Tunnel | 236°–252° | 0 | 16 m | (-87, -146), (-50, -154) |
| T2 West Bench Tunnel | 195.5°–214.5° | -24 | 9 m | (-95, -56), (-85, -84) |
| T3 Deep Drift | 317.5°–334.5° | -40 | 9 m | (25, -64), (37, -54) |

Bench widths (between faces): L1 12–27 m, L2 12–27 m, L3 12–25 m, L4 10–24 m, L5 10–25 m; the floor about
95 × 68 m with a 15 m shelf ramp round its north-west.

## Combat zones

| Zone | Extent (x, z) | Level | Engagements | Cover |
|---|---|---|---|---|
| NW motor pool (Embers base) | x −196…−96, z 100…192 | rim | close/medium round sheds; long across the plant | 3 vehicle sheds, 2 barracks, bunker HQ, guard tower, hesco, containers, sandbag nest |
| North plant (crusher, screen house, mills) | x −96…96, z 104…192 | rim, 4–13 m decks | close inside the crusher, screen house and mills; medium along the gantries; long into the pit from the crusher roof | buildings, gantries, tanks, containers, barriers |
| NE workers' camp (Tide base) | x 96…196, z 96…192 | rim | close between barracks rows; medium across the camp square | 6 barracks, 2 sheds, bunker HQ, guard tower, conveyor legs |
| West fuel depot | x −196…−150, z −60…100 | rim | medium | storage and fuel tanks, water tower, containers |
| East stockpile yard | x 146…196, z −64…96 | rim, stockpiles to +7 | medium; vertical on the stockpiles and the overland conveyor | stockpiles (terrain), conveyor legs, gantry crane, containers |
| SE loadout | x 92…192, z −192…−124 | rim, deck +8 | medium; long from the deck | rail siding with wagons, loadout bin, tanks, gantry crane |
| South rim and tunnel | z −204…−140 | rim, rock to +12 | close in the tunnel; vehicle fights on the haul road | rock spur, outcrops |
| Benches L1–L5 | rings between the faces | −8…−40 | medium along each bench; long across the pit (100–250 m) | rock windrows along every lip (every 13 m), containers, barriers, carts, crates, parked haul trucks |
| Pit floor (The Maw) | about x −60…35, z −75…−5 | −48 | close/medium round the excavator; exposed to every bench above | excavator, haul truck, spoil mounds, carts, tanks, barriers |

## Traversal graph

Travel times are on foot at about 6 m/s (vehicles about 3× faster on the roads). "Choke" is the narrowest
walkable width.

| Route | From → to | Access | Vertical change | Length / time | Choke | Alternates |
|---|---|---|---|---|---|---|
| Rim haul road | ring round the pit, through T1 | road (13 m), drivable | 0 | ~950 m loop / ~2.6 min | 16 m (T1) | over the T1 spur on foot; across the plant |
| Spiral haul road | crusher apron (rim, θ 128°) → pit floor | road (10 m) over six full-width ramps R1–R6 | −48 m | ~610 m / ~1.7 min | 10 m (R4, R6) | switchbacks, lifts, ladders, benches |
| SE switchbacks | rim (θ 318°) → L1 → L2 → L3 | road (8 m), three legs SA, SB (shelf), SC, hairpins at 280° and 304° | −24 m | ~200 m / 35 s | 8 m (hairpins) | spiral R1–R3 |
| No. 1 Headframe lift | L2 (−16) ↔ rim beside the crusher | lift (4 m/s, 3 s waits) | 16 m | 4 s ride | 3.4 m platform | ladders, spiral |
| No. 2 Shaft lift | L4 (−32) ↔ L2 (−16), θ 7.5° | lift | 16 m | 4 s | 3.4 m | R3, R4 |
| Pit Floor lift | floor (−48) ↔ R5 top landing (−32), θ 244° | lift | 16 m | 4 s | 3.4 m | R5/R6, R6 ladder |
| Bench-end ladders | each ramp's top end face: bench → ramp landing (R1–R6, SA, SB, SC) | ladder 8 m | 8 m | 3 s | 1.1 m | the ramp itself |
| West Bench Tunnel (T2) | L3 through a rock buttress, θ 196–214° | tunnel 9 m wide, 5.5 m clear | 0 | ~35 m | 9 m | over the buttress (flush with L2) |
| Deep Drift (T3) | L5 through a rock buttress, θ 318–334° | tunnel 9 m | 0 | ~20 m | 9 m | over the buttress (flush with L4) |
| South Rim Tunnel (T1) | rim haul road through the rock spur, θ 236–252° | tunnel 16 m, 7 m clear, concrete portals | 0 | ~45 m | 16 m | none on wheels on that side (the north side of the ring is the alternate) |
| Plant gantries | crusher mezzanine (6 m) → screen house (6 m) → Mill A/B upper doors (4 m) | walkways 4.4 m wide, ramps up from the yard | 0…6 m | 40–75 m | 4.4 m | the yard below |
| Overland conveyor | screen house (6 m) → NE camp → east yard (7–9 m) → transfer tower at (172, −48) | walkway with rails, ladders at (100, 176) and (175, 90), ramp at (172, −64) | 6–9 m | ~300 m | 4.4 m | the ground below |
| Crusher roof | ground → roof (13.4 m) | ladder outside the west wall | 13 m | 5 s | 1 m | none (a perch) |
| Loadout deck | ground → deck (+8) | ramp from the north | 8 m | 12 m | 3.4 m | none (a perch) |

Escape routes from the pit floor: R6 → spiral, the Pit Floor lift, the R6 bench-end ladder, and through L5
to R5 and the T3 drift; from every bench: the ramp up or down, the ladder at its end, and the lifts.

## Structures

All structures are MapMaker pieces: Classic Grid tiles (theme `core.factory`), free blocks (scenario palette
`block:solid`), props, ladders and lift movers. Interiors are reachable (navmesh-checked).

| Structure | Pieces | Where (centre) | Collision | Entrances / roof / interior |
|---|---|---|---|---|
| Ore crusher | blocks (`core.pbr_concrete` walls 13 m high, `core.pbr_tread_plate` mezzanine and ramp, roof slab with parapets) + props `prop.hopper_tall` (dump hopper), `prop.machine`, `prop.piston`, `prop.hopper`, `prop.lever` | (−8, 0, 116), 22 × 15 m | solid blocks | 7 m opening to the pit (south), doors west, east and north-west, 6 m mezzanine (ramp up), north opening at 6 m to the gantry, roof by ladder (MG turret, sniper) |
| Screen house | blocks (`core.pbr_grey_corrugated`), deck at 6 m, ramp up the south wall | (−8, 0, 169), 16 × 12 m | solid | ground doors north and east; upper doors south, west, east, north (gantries) |
| Mill A, Mill B | tiles `core.warehouse` `mill_a` (−9, 19, 0), `mill_b` (4, 19, 0) | (−64, 0, 156), (40, 0, 156) | tile walls and floors | wide doors south, doors west and east, mezzanine stairs, upper north door to the gantry |
| Conveyor gantries | blocks (`core.pbr_walkway` decks, `core.pbr_steel` rails, legs, cross-beams) + `prop.conveyor` along them | see traversal graph | solid | walkable decks |
| Headframe and lifts | blocks (`core.pbr_rusted_plate` cage posts and crown, `core.pbr_steel` A-frame and sheave deck), `prop.cog` sheave, `mover` lifts with `core.pbr_tread_plate` platforms and landing decks | θ 107°, 7.5°, 244° | solid; platforms ride | open on the low and high sides |
| Ladder rigs | `core.pbr_rusted_plate` block (2.6 × 8.5 × 7 m) + `ladder` on its face | each ramp's top end | solid | climb |
| Tunnels | trench in the terrain under `core.pbr_rock` lid blocks; portals `core.pbr_concrete` (T1) or `core.pbr_walnut` timber sets (T2, T3); strip lights | see traversal graph | solid | both ends open |
| NW motor pool | tiles `military.vehicle_shed` ×3, `military.barracks` ×2, `core.bunker` (HQ), `military.guard_tower` | cells x −22…−13, y 15…22 | tiles | sheds open-fronted, barracks and bunker doors, tower stairs |
| NE workers' camp | tiles `military.barracks` ×6, `military.vehicle_shed` ×2, `core.bunker`, `military.guard_tower` | cells x 13…22, y 13…22 | tiles | as above |
| Transfer towers | `core.pbr_rusted_plate` blocks | (100, 0, 178), (172, 0, −48) | solid | ladder / ramp |
| SE loadout | blocks (legs, deck at +8, bin, rails), `prop.railroad` siding, wagons | (136, 0, −160) | solid | ramp from the north |
| The Maw (excavator) | `prop.mining_excavator` (Meshy, owned) | (−16, −48, −44), yaw 20° | shell collision (cover) | not climbable |

## Iron Maw-specific discovery notes (beyond the shared report)
- `MAX_TERRAIN_VERTS` is 161 (`packages/shared/src/map/terrain.ts`); spacing may be 0.5–8 m (schema). 3 m
  spacing gives 480 m. Walls must be steeper than `PLAYER.maxSlopeDegrees` (50°) per triangle; with 3 m
  cells a 1.6 m transition per 8 m face keeps them at 60–80°.
- `terrainUnderFloors` (`map/settle.ts`) lowers terrain within 3 m above any block's top (blocks are
  `floor` boxes), so block tops that should meet the ground sit 5–10 cm above it (ladder rigs, tunnel
  lids, lift landings), or the ground under them is dug out.
- Navmesh (`nav/index.ts`): walkable radius 0.6 m (erosion each side) and a minimum region area mean ramps
  and walkways narrower than ~3 m can drop out of the mesh; a tilted ramp block needs its foot sunk into
  the ground (a raised lip over 0.3 m breaks the link). Path queries fail rather than return partial paths.
- Vehicles (`sim/mounts.ts`, `match.ts driveVehicle`, `physics.ts moveVehicle`): the probe uses the
  player controller (50° climb, 0.3 m step); buggy turn rate 1.8 rad/s gives a ~5 m turn radius at 9 m/s,
  so 10–13 m roads and 15 m hairpins are drivable. Lifts are `mover`s that `liftLinks` turn into bot links;
  ladders get links from `ladderLinks` (top end 0.9 m behind the ladder's foot).
- Paths (`map/paths.ts`): all roads here are drawn only (`lay: false`); laying would smooth the ground 4 m
  past each edge and soften the bench faces. Bots driving vehicles follow road paths.
- Map pictures: MapMaker's Import fails on a model the running build doesn't know; rebuild and restart
  `vite preview` (it caches the file list) after merging new props.

## Navigation build notes
The navmesh is built when a match loads (Recast, 0.2 m cells): 8–18 s for Iron Maw on this container
(load 0–25). Every spawn, pickup, flag, hill and bomb site is reachable from the Embers flag in one path
query (161 of 161), all 12 ladders and 3 lifts are linked, and `pnpm validate-map` reports no issues.

## Screenshot viewpoints

| File (`screenshots/`) | Camera | Shows |
|---|---|---|
| `mapmaker_topdown.jpg` | MapMaker camera straight down from (0, 470, 0) | whole map |
| `mapmaker_oblique_sw.jpg` | MapMaker camera at (−110, 230, −330) looking north-east | pit, plant, camps (like the reference) |
| `fp_01_rim_overlook.jpg` | eye at (−92.8, 0, 74.0), facing south-east down into the pit | benches, spiral, excavator |
| `fp_02_pit_floor_excavator.jpg` | (18, −39.7, −66) on the floor's spoil heap, facing the excavator | The Maw, haul truck, Pit Floor lift |
| `fp_03_west_bench_L2.jpg` | (−111.5, −16, 5.0) on L2, facing south along the bench | bench, berms, faces |
| `fp_04_south_rim_tunnel.jpg` | (−96.4, 0, −142.6) at the T1 portal | rim tunnel |
| `fp_05_conveyor_gantry.jpg` | (−8, 6, 128) on the crusher gantry, facing the crusher | gantry deck, crusher upper door |
| `fp_06_workers_camp.jpg` | (140, 0, 100), facing north-east | Tide barracks, overland conveyor |

## Records
### Spawns

| ID | Team | Position (x, y, z) | Facing | Zone / level |
|---|---|---|---|---|
| spawn_embers_001 | embers | (-118.0, 0.1, 108.0) | 130° | NW motor pool, rim |
| spawn_embers_002 | embers | (-119.3, -0.2, 115.3) | 134° | NW motor pool, rim |
| spawn_embers_003 | embers | (-116.7, -0.2, 124.8) | 138° | NW motor pool, rim |
| spawn_embers_004 | embers | (-118.0, 0.1, 132.0) | 141° | NW motor pool, rim |
| spawn_embers_005 | embers | (-130.0, 0.1, 112.0) | 127° | NW motor pool, rim |
| spawn_embers_006 | embers | (-131.3, -0.1, 120.8) | 131° | NW motor pool, rim |
| spawn_embers_007 | embers | (-130.0, 0.1, 128.0) | 134° | NW motor pool, rim |
| spawn_embers_008 | embers | (-130.0, 0.1, 136.0) | 137° | NW motor pool, rim |
| spawn_embers_009 | embers | (-142.0, 0.1, 108.0) | 120° | NW motor pool, rim |
| spawn_embers_010 | embers | (-142.0, 0.1, 116.0) | 124° | NW motor pool, rim |
| spawn_embers_011 | embers | (-142.0, 0.1, 124.0) | 128° | NW motor pool, rim |
| spawn_embers_012 | embers | (-142.0, 0.1, 132.0) | 131° | NW motor pool, rim |
| spawn_embers_013 | embers | (-154.0, 0.1, 112.0) | 119° | NW motor pool, rim |
| spawn_embers_014 | embers | (-153.3, 0.1, 121.3) | 123° | NW motor pool, rim |
| spawn_embers_015 | embers | (-154.0, 0.1, 128.0) | 126° | NW motor pool, rim |
| spawn_embers_016 | embers | (-154.0, 0.1, 136.0) | 129° | NW motor pool, rim |
| spawn_embers_017 | embers | (-166.0, 0.1, 108.0) | 114° | NW motor pool, rim |
| spawn_embers_018 | embers | (-167.3, -0.2, 115.3) | 118° | NW motor pool, rim |
| spawn_embers_019 | embers | (-164.7, -0.2, 124.8) | 121° | NW motor pool, rim |
| spawn_embers_020 | embers | (-167.3, 0.0, 131.3) | 124° | NW motor pool, rim |
| spawn_embers_021 | embers | (-178.0, 0.1, 112.0) | 114° | NW motor pool, rim |
| spawn_embers_022 | embers | (-181.0, 0.0, 120.0) | 117° | NW motor pool, rim |
| spawn_embers_023 | embers | (-178.0, 0.1, 128.0) | 120° | NW motor pool, rim |
| spawn_embers_024 | embers | (-181.0, 0.0, 136.0) | 123° | NW motor pool, rim |
| spawn_embers_025 | embers | (-172.0, 0.1, 60.0) | 115° | west fuel depot, rim |
| spawn_embers_026 | embers | (-184.0, 0.1, 48.0) | 110° | west fuel depot, rim |
| spawn_embers_027 | embers | (-172.0, 0.1, 36.0) | 108° | west fuel depot, rim |
| spawn_embers_028 | embers | (-184.0, 0.1, 24.0) | 103° | west fuel depot, rim |
| spawn_embers_029 | embers | (-172.0, 0.1, 12.0) | 101° | west fuel depot, rim |
| spawn_embers_030 | embers | (-184.0, 0.1, 0.0) | 96° | west fuel depot, rim |
| spawn_embers_031 | embers | (-170.5, 0.1, -9.4) | 93° | west fuel depot, rim |
| spawn_embers_032 | embers | (-184.0, 0.1, -24.0) | 89° | west fuel depot, rim |
| spawn_tide_001 | tide | (118.0, 0.1, 108.0) | -130° | NE workers’ camp, rim |
| spawn_tide_002 | tide | (116.7, -0.2, 115.3) | -134° | NE workers’ camp, rim |
| spawn_tide_003 | tide | (119.3, -0.2, 124.8) | -138° | NE workers’ camp, rim |
| spawn_tide_004 | tide | (118.0, 0.1, 132.0) | -141° | NE workers’ camp, rim |
| spawn_tide_005 | tide | (130.0, 0.1, 112.0) | -127° | NE workers’ camp, rim |
| spawn_tide_006 | tide | (131.3, -0.1, 119.3) | -131° | NE workers’ camp, rim |
| spawn_tide_007 | tide | (130.0, 0.1, 128.0) | -134° | NE workers’ camp, rim |
| spawn_tide_008 | tide | (130.0, 0.1, 136.0) | -137° | NE workers’ camp, rim |
| spawn_tide_009 | tide | (142.0, 0.1, 108.0) | -120° | NE workers’ camp, rim |
| spawn_tide_010 | tide | (142.0, 0.1, 116.0) | -124° | NE workers’ camp, rim |
| spawn_tide_011 | tide | (142.0, 0.1, 124.0) | -128° | NE workers’ camp, rim |
| spawn_tide_012 | tide | (142.0, 0.1, 132.0) | -131° | NE workers’ camp, rim |
| spawn_tide_013 | tide | (154.0, 0.1, 112.0) | -119° | NE workers’ camp, rim |
| spawn_tide_014 | tide | (154.8, 0.0, 121.3) | -123° | NE workers’ camp, rim |
| spawn_tide_015 | tide | (154.0, 0.1, 128.0) | -126° | NE workers’ camp, rim |
| spawn_tide_016 | tide | (154.0, 0.1, 136.0) | -129° | NE workers’ camp, rim |
| spawn_tide_017 | tide | (166.0, 0.1, 108.0) | -114° | NE workers’ camp, rim |
| spawn_tide_018 | tide | (164.7, -0.2, 115.3) | -118° | NE workers’ camp, rim |
| spawn_tide_019 | tide | (167.3, -0.2, 124.8) | -121° | NE workers’ camp, rim |
| spawn_tide_020 | tide | (166.0, 0.1, 132.0) | -124° | NE workers’ camp, rim |
| spawn_tide_021 | tide | (178.0, 0.1, 112.0) | -114° | NE workers’ camp, rim |
| spawn_tide_022 | tide | (178.0, 0.1, 120.0) | -117° | NE workers’ camp, rim |
| spawn_tide_023 | tide | (178.0, 0.1, 128.0) | -120° | NE workers’ camp, rim |
| spawn_tide_024 | tide | (178.0, 0.1, 136.0) | -123° | NE workers’ camp, rim |
| spawn_tide_025 | tide | (174.3, 0.8, 63.9) | -115° | east stockpile yard, rim |
| spawn_tide_026 | tide | (184.0, 0.6, 48.0) | -110° | east stockpile yard, rim |
| spawn_tide_027 | tide | (172.0, 0.1, 36.0) | -108° | east stockpile yard, rim |
| spawn_tide_028 | tide | (184.0, 0.1, 24.0) | -103° | east stockpile yard, rim |
| spawn_tide_029 | tide | (175.0, 5.5, 12.0) | -101° | east stockpile yard, rim +5 |
| spawn_tide_030 | tide | (184.0, 0.1, 0.0) | -96° | east stockpile yard, rim |
| spawn_tide_031 | tide | (172.0, 0.1, -12.0) | -93° | east stockpile yard, rim |
| spawn_tide_032 | tide | (184.0, 0.1, -24.0) | -89° | east stockpile yard, rim |
| spawn_ffa_001 | any (FFA) | (-75.1, -8.0, 68.3) | 147° | pit θ123°, L1 |
| spawn_ffa_002 | any (FFA) | (-127.5, -8.0, -63.5) | 75° | pit θ195°, L1 |
| spawn_ffa_003 | any (FFA) | (-16.0, -8.0, -131.3) | 3° | pit θ267°, L1 |
| spawn_ffa_004 | any (FFA) | (105.6, -8.0, -76.4) | -69° | pit θ339°, L1 |
| spawn_ffa_005 | any (FFA) | (4.2, -15.9, 69.0) | -172° | pit θ82°, L2 |
| spawn_ffa_006 | any (FFA) | (-103.5, -15.9, 13.6) | 116° | pit θ154°, L2 |
| spawn_ffa_007 | any (FFA) | (-81.6, -15.9, -106.1) | 44° | pit θ226°, L2 |
| spawn_ffa_008 | any (FFA) | (-39.6, -23.9, 37.7) | 157° | pit θ113°, L3 |
| spawn_ffa_009 | any (FFA) | (-96.2, -23.9, -39.5) | 85° | pit θ185°, L3 |
| spawn_ffa_010 | any (FFA) | (-26.9, -23.9, -103.8) | 13° | pit θ257°, L3 |
| spawn_ffa_011 | any (FFA) | (61.3, -23.9, -74.9) | -59° | pit θ329°, L3 |
| spawn_ffa_012 | any (FFA) | (53.0, -23.9, 22.8) | -131° | pit θ41°, L3 |
| spawn_ffa_013 | any (FFA) | (-60.4, -31.9, 4.6) | 126° | pit θ144°, L4 |
| spawn_ffa_014 | any (FFA) | (61.9, -31.9, -32.0) | -90° | pit θ0°, L4 |
| spawn_ffa_015 | any (FFA) | (6.9, -31.9, 20.0) | -162° | pit θ72°, L4 |
| spawn_ffa_016 | any (FFA) | (25.3, -38.7, -62.6) | -49° | pit θ319°, L5 |
| spawn_ffa_017 | any (FFA) | (26.1, -40.0, -10.3) | -121° | pit θ31°, L5 |
| spawn_ffa_018 | any (FFA) | (-34.0, -48.0, -60.0) | 41° | pit θ229°, pit floor |
| spawn_ffa_019 | any (FFA) | (-6.0, -48.0, -20.0) | -162° | pit θ72°, pit floor |
| spawn_ffa_020 | any (FFA) | (14.0, -48.0, -50.0) | -53° | pit θ323°, pit floor |
| spawn_ffa_021 | any (FFA) | (-40.0, 0.1, 186.0) | 172° | north plant, rim |
| spawn_ffa_022 | any (FFA) | (24.0, 0.1, 186.0) | -171° | north plant, rim |
| spawn_ffa_023 | any (FFA) | (-90.0, 0.1, 186.0) | 160° | north plant, rim |
| spawn_ffa_024 | any (FFA) | (80.0, 0.1, 188.0) | -158° | north plant, rim |
| spawn_ffa_025 | any (FFA) | (-60.0, 0.1, 120.0) | 162° | north plant, rim |
| spawn_ffa_026 | any (FFA) | (44.0, 0.1, 120.0) | -160° | north plant, rim |
| spawn_ffa_027 | any (FFA) | (-190.0, 0.1, -60.0) | 81° | west fuel depot, rim |
| spawn_ffa_028 | any (FFA) | (190.0, 0.5, -65.5) | -79° | east stockpile yard, rim |
| spawn_ffa_029 | any (FFA) | (100.0, 0.1, -130.0) | -48° | SE loadout, rim |
| spawn_ffa_030 | any (FFA) | (180.0, 0.1, -180.0) | -52° | SE loadout, rim |
| spawn_ffa_031 | any (FFA) | (-61.5, 10.8, -186.0) | 18° | south rim, rim +11 |
| spawn_ffa_032 | any (FFA) | (20.0, 10.9, -190.0) | -11° | south rim, rim +11 |
| spawn_ffa_033 | any (FFA) | (-150.0, 7.9, -175.0) | 44° | west fuel depot, rim +8 |

### Pickups

| ID | Item (registry ID) | Position | Respawn | Zone / level |
|---|---|---|---|---|
| pickup_001 | `core.health_large` | (-150.0, 0.1, 130.0) | item default | NW motor pool, rim |
| pickup_002 | `core.armor_small` | (-138.5, 0.1, 150.0) | item default | NW motor pool, rim |
| pickup_003 | `core.ammo_rifle` | (-160.0, 0.1, 150.0) | item default | NW motor pool, rim |
| pickup_004 | `core.weapon_rifle` | (-130.7, 0.0, 124.8) | item default | NW motor pool, rim |
| pickup_005 | `core.weapon_smg` | (-166.7, -0.2, 124.8) | item default | NW motor pool, rim |
| pickup_006 | `core.grenades` | (-173.0, 0.1, 40.0) | item default | west fuel depot, rim |
| pickup_007 | `core.ammo_explosive` | (-160.0, 0.1, 100.0) | item default | NW motor pool, rim |
| pickup_008 | `core.weapon_launcher` | (-182.0, 0.1, 20.0) | item default | west fuel depot, rim |
| pickup_009 | `core.health_small` | (-178.0, 0.1, -40.0) | item default | west fuel depot, rim |
| pickup_010 | `core.health_large` | (150.0, 0.1, 130.0) | item default | NE workers’ camp, rim |
| pickup_011 | `core.armor_small` | (138.7, 0.1, 150.8) | item default | NE workers’ camp, rim |
| pickup_012 | `core.ammo_rifle` | (160.0, 0.1, 150.0) | item default | NE workers’ camp, rim |
| pickup_013 | `core.weapon_rifle` | (133.5, 0.0, 124.0) | item default | NE workers’ camp, rim |
| pickup_014 | `core.weapon_smg` | (169.3, -0.2, 124.8) | item default | NE workers’ camp, rim |
| pickup_015 | `core.grenades` | (176.0, 0.5, 40.0) | item default | east stockpile yard, rim |
| pickup_016 | `core.ammo_explosive` | (160.0, 0.1, 100.0) | item default | NE workers’ camp, rim |
| pickup_017 | `core.weapon_launcher` | (184.6, 0.4, 21.5) | item default | east stockpile yard, rim |
| pickup_018 | `core.health_small` | (178.0, 0.1, -40.0) | item default | east stockpile yard, rim |
| pickup_019 | `core.weapon_shotgun` | (-10.5, 0.1, 111.8) | item default | north plant, rim |
| pickup_020 | `core.weapon_sniper` | (-3.0, 13.4, 115.8) | 30 | north plant, rim +13 |
| pickup_021 | `core.ammo_sniper` | (-13.0, 13.4, 119.8) | item default | north plant, rim +13 |
| pickup_022 | `core.armor_large` | (-13.0, 6.0, 171.8) | 45 | north plant, rim +6 |
| pickup_023 | `core.weapon_lmg` | (-62.5, 0.1, 158.0) | item default | north plant, rim |
| pickup_024 | `core.weapon_plasma` | (41.5, 0.1, 158.0) | item default | north plant, rim |
| pickup_025 | `core.health_large` | (-60.0, 4.0, 161.0) | item default | north plant, rim +4 |
| pickup_026 | `core.health_large` | (44.0, 4.0, 161.0) | item default | north plant, rim +4 |
| pickup_027 | `core.ammo_cells` | (-10.0, 0.1, 176.0) | item default | north plant, rim |
| pickup_028 | `core.weapon_rifle` | (-125.9, -8.0, 3.4) | item default | pit θ163°, L1 |
| pickup_029 | `core.ammo_rifle` | (-40.3, -8.0, -131.0) | item default | pit θ253°, L1 |
| pickup_030 | `core.health_small` | (109.4, -8.0, -68.5) | item default | pit θ343°, L1 |
| pickup_031 | `core.weapon_smg` | (-20.3, -15.9, 65.7) | item default | pit θ96°, L2 |
| pickup_032 | `core.armor_small` | (-111.5, -15.9, -42.7) | item default | pit θ186°, L2 |
| pickup_033 | `core.weapon_shotgun` | (-46.0, -23.9, 33.0) | item default | pit θ119°, L3 |
| pickup_034 | `core.ammo_explosive` | (-86.6, -24.2, -74.4) | item default | pit θ209°, L3 |
| pickup_035 | `core.weapon_disc_launcher` | (65.1, -23.9, 9.6) | item default | pit θ29°, L3 |
| pickup_036 | `core.health_small` | (-57.1, -31.9, 4.8) | item default | pit θ142°, L4 |
| pickup_037 | `core.weapon_lmg` | (24.0, -31.9, 11.6) | item default | pit θ52°, L4 |
| pickup_038 | `core.weapon_rifle` | (38.7, -40.0, -45.0) | item default | pit θ345°, L5 |
| pickup_039 | `core.ammo_rifle` | (-1.4, -40.0, 0.1) | item default | pit θ75°, L5 |
| pickup_040 | `core.weapon_shotgun` | (-68.3, 0.1, -151.6) | item default | pit θ244°, rim |
| pickup_041 | `core.health_small` | (-62.0, 0.1, -154.6) | item default | pit θ247°, rim |
| pickup_042 | `core.weapon_shotgun` | (-91.5, -23.9, -70.0) | item default | pit θ205°, L3 |
| pickup_043 | `core.health_small` | (-91.6, -23.9, -75.4) | item default | pit θ208°, L3 |
| pickup_044 | `core.weapon_shotgun` | (31.3, -40.0, -59.8) | item default | pit θ326°, L5 |
| pickup_045 | `core.health_small` | (35.0, -40.0, -59.0) | item default | pit θ329°, L5 |
| pickup_046 | `core.weapon_rockets` | (-12.0, -48.0, -32.0) | 60 | pit θ180°, pit floor |
| pickup_047 | `core.weapon_railgun` | (-40.0, -48.0, -56.0) | 60 | pit θ219°, pit floor |
| pickup_048 | `core.armor_large` | (6.0, -48.0, -46.0) | 45 | pit θ319°, pit floor |
| pickup_049 | `core.health_large` | (-26.0, -47.7, -22.0) | item default | pit θ148°, pit floor |
| pickup_050 | `core.ammo_explosive` | (-2.0, -48.0, -61.0) | item default | pit θ285°, pit floor |
| pickup_051 | `core.weapon_sniper` | (133.0, 8.1, -157.0) | 30 | SE loadout, rim +8 |
| pickup_052 | `core.health_large` | (120.0, 0.1, -144.0) | item default | SE loadout, rim |
| pickup_053 | `core.ammo_sniper` | (150.0, 0.1, -144.0) | item default | SE loadout, rim |
| pickup_054 | `core.weapon_launcher` | (-80.0, 11.1, -170.0) | item default | south rim, rim +11 |
| pickup_055 | `core.armor_small` | (-153.0, 13.2, -135.2) | item default | west fuel depot, rim +13 |

### Objectives

| ID | Mode | Type | Position | Size |
|---|---|---|---|---|
| flag_embers | CTF, Fort Wars | flag (embers) — Embers flag (motor pool) | (-150.0, 0.0, 140.0) |  |
| flag_tide | CTF, Fort Wars | flag (tide) — Tide flag (workers camp) | (148.7, -0.2, 139.3) |  |
| hill_maw | KOTH | hill — The Maw (pit floor) | (-14.0, -48.0, -28.0) | r 14 m |
| hill_crusher | KOTH | hill — Crusher apron | (-8.0, 0.0, 136.8) | r 12 m |
| hill_west_bench | KOTH | hill — West Bench Tunnel | (-91.5, -24.0, -70.0) | r 12 m |
| hill_loadout | KOTH | hill — Loadout siding | (136.0, 0.0, -150.0) | r 12 m |
| hill_deep_drift | KOTH | hill — Deep Drift | (30.6, -39.9, -60.4) | r 10 m |
| bomb_a | Bomb | bombsite A — Crusher | (-8.8, 0.1, 115.2) | r 5 m |
| bomb_b | Bomb | bombsite B — Loadout | (136.0, 0.0, -148.0) | r 6 m |

### Vehicles and turrets

| ID | Model | Team | Position | Facing |
|---|---|---|---|---|
| mount_buggy_001 | `buggy` | embers | (-156.0, 0.0, 172.0) | 180° |
| mount_buggy_002 | `buggy` | embers | (-132.0, 0.0, 172.0) | 180° |
| mount_gun_jeep_001 | `gun_jeep` | embers | (-144.0, 0.1, 172.0) | 180° |
| mount_gun_jeep_002 | `gun_jeep` | embers | (-120.0, 0.1, 104.0) | 180° |
| mount_armored_rover_001 | `armored_rover` | embers | (-170.0, 0.1, 104.0) | 180° |
| mount_tank_001 | `tank` | embers | (-186.0, 0.1, 150.0) | 180° |
| mount_hover_bike_001 | `hover_bike` | embers | (-104.0, -0.3, 140.0) | 180° |
| mount_buggy_003 | `buggy` | tide | (156.0, 0.0, 172.0) | 180° |
| mount_buggy_004 | `buggy` | tide | (132.0, 0.0, 172.0) | 180° |
| mount_gun_jeep_003 | `gun_jeep` | tide | (144.0, -0.3, 172.0) | 180° |
| mount_gun_jeep_004 | `gun_jeep` | tide | (120.0, 0.1, 104.0) | 180° |
| mount_armored_rover_002 | `armored_rover` | tide | (170.0, 0.1, 104.0) | 180° |
| mount_tank_002 | `tank` | tide | (186.0, 0.1, 150.0) | 180° |
| mount_hover_bike_002 | `hover_bike` | tide | (104.0, -0.3, 140.0) | 180° |
| mount_buggy_005 | `buggy` | neutral | (-132.2, -8.0, -10.4) | -170° |
| mount_buggy_006 | `buggy` | neutral | (78.1, -23.9, 0.1) | -20° |
| mount_buggy_007 | `buggy` | neutral | (-46.0, -48.0, -28.0) | 69° |
| mount_gun_jeep_005 | `gun_jeep` | neutral | (112.0, 0.1, -142.0) | 90° |
| mount_gun_jeep_006 | `gun_jeep` | neutral | (-100.0, 5.0, -160.0) | -69° |
| turret_crusher | `turret_mg` | neutral | (-8.0, 13.4, 110.8) | 180° |
| turret_loadout | `turret_mg` | neutral | (136.0, 8.0, -163.5) | 180° |

### Ladders and lifts

| ID | Name | Foot / platform | Climb | Facing |
|---|---|---|---|---|
| ladder_001 | Ladder up to R1 | (-59.2, -8.0, 80.2) | 8.1 m | -112° |
| ladder_002 | Ladder up to R2 | (31.7, -16.0, 61.8) | 8.1 m | -64° |
| ladder_003 | Ladder up to R3 | (80.5, -24.0, -9.1) | 8.1 m | -12° |
| ladder_004 | Ladder up to R4 | (37.2, -32.0, -72.6) | 8.1 m | 44° |
| ladder_005 | Ladder up to R5 | (-25.1, -40.0, -84.0) | 8.1 m | 110° |
| ladder_006 | Ladder up to R6 | (-48.9, -48.0, -27.4) | 8.1 m | -168° |
| ladder_007 | Ladder up to SA | (53.0, -8.0, -119.0) | 8.1 m | 56° |
| ladder_008 | Ladder up to SB | (1.9, -16.0, -120.0) | 8.1 m | -100° |
| ladder_009 | Ladder up to SC | (32.2, -24.0, -88.1) | 8.1 m | 56° |
| crusher_roof_ladder | Crusher roof ladder | (-19.1, 0.0, 119.8) | 13.4 m | -90° |
| ladder_010 | Transfer tower ladder | (100.0, 0.0, 175.6) | 7.0 m | 180° |
| ladder_011 | Stockpile ladder | (174.6, 0.0, 90.0) | 7.0 m | 90° |
| shaft_headframe | No. 1 Headframe lift (lift, `mover` pingpong 4 m/s) | (-41.8, -16.2, 71.9) | 16.0 m | — |
| shaft_north | No. 2 Shaft lift (lift, `mover` pingpong 4 m/s) | (69.2, -32.2, -21.6) | 16.0 m | — |
| shaft_pit | Pit Floor lift (lift, `mover` pingpong 4 m/s) | (-31.3, -48.2, -75.6) | 16.0 m | — |

### Tiles (Classic Grid, cell 8 m, level 4 m)

| ID | Tile | Cell (x, y, z) | World origin cell centre | Rotation | Edges set |
|---|---|---|---|---|---|
| mill_a | `core.warehouse` | (-9, 19, 0) | (-72, 0, 152) | 0° | 0,0,0:S=wide, 2,0,0:S=wide, 0,1,0:W=door, 2,0,0:E=door, 1,1,1:N=door |
| mill_b | `core.warehouse` | (4, 19, 0) | (32, 0, 152) | 0° | 0,0,0:S=wide, 2,0,0:S=wide, 0,1,0:W=door, 2,0,0:E=door, 1,1,1:N=door |
| nw_shed_1 | `military.vehicle_shed` | (-22, 21, 0) | (-176, 0, 168) | 180° | — |
| nw_shed_2 | `military.vehicle_shed` | (-19, 21, 0) | (-152, 0, 168) | 180° | — |
| nw_shed_3 | `military.vehicle_shed` | (-16, 21, 0) | (-128, 0, 168) | 180° | — |
| nw_barracks_1 | `military.barracks` | (-22, 17, 0) | (-176, 0, 136) | 0° | 0,0,0:S=door, 1,0,0:N=door, 1,0,0:E=door |
| nw_barracks_2 | `military.barracks` | (-22, 15, 0) | (-176, 0, 120) | 0° | 0,0,0:S=door, 1,0,0:N=door, 1,0,0:E=door |
| nw_hq | `core.bunker` | (-16, 15, 0) | (-128, 0, 120) | 0° | 0,0,0:W=door, 1,0,0:E=door, 0,0,0:S=door |
| nw_tower | `military.guard_tower` | (-13, 18, 0) | (-104, 0, 144) | 0° | — |
| ne_barracks_1 | `military.barracks` | (15, 21, 0) | (120, 0, 168) | 0° | 0,0,0:S=door, 1,0,0:N=door, 1,0,0:E=door |
| ne_barracks_2 | `military.barracks` | (18, 21, 0) | (144, 0, 168) | 0° | 0,0,0:S=door, 1,0,0:N=door, 1,0,0:E=door |
| ne_barracks_3 | `military.barracks` | (21, 21, 0) | (168, 0, 168) | 0° | 0,0,0:S=door, 1,0,0:N=door, 1,0,0:E=door |
| ne_barracks_4 | `military.barracks` | (15, 18, 0) | (120, 0, 144) | 0° | 0,0,0:S=door, 1,0,0:N=door, 1,0,0:E=door |
| ne_barracks_5 | `military.barracks` | (18, 18, 0) | (144, 0, 144) | 0° | 0,0,0:S=door, 1,0,0:N=door, 1,0,0:E=door |
| ne_barracks_6 | `military.barracks` | (21, 18, 0) | (168, 0, 144) | 0° | 0,0,0:S=door, 1,0,0:N=door, 1,0,0:E=door |
| ne_shed_1 | `military.vehicle_shed` | (15, 15, 0) | (120, 0, 120) | 0° | — |
| ne_shed_2 | `military.vehicle_shed` | (20, 15, 0) | (160, 0, 120) | 0° | — |
| ne_hq | `core.bunker` | (22, 13, 0) | (176, 0, 104) | 0° | 0,0,0:W=door, 1,0,0:E=door, 0,0,0:S=door |
| ne_tower | `military.guard_tower` | (13, 18, 0) | (104, 0, 144) | 0° | — |

### Named props (Meshy landmarks)

| ID | Model | Position | Yaw |
|---|---|---|---|
| prop_178 | `prop.hopper_tall` Dump hopper | (-8.0, -1.0, 104.3) | 0° |
| prop_352 | `prop.mining_excavator` The Maw (bucket-wheel excavator) | (-16.0, -48.0, -44.0) | 20° |
| prop_353 | `prop.mining_haul_truck` Haul truck (floor) | (10.0, -48.0, -30.0) | 126° |
| prop_354 | `prop.mining_haul_truck` Haul truck (L2) | (-13.8, -16.0, 78.2) | -182° |
| prop_355 | `prop.mining_haul_truck` Haul truck (L4) | (43.3, -32.0, 12.8) | -130° |

### Prop models used (count)

`prop.conveyor` 49, `prop.rock_pile` 37, `prop.rock_large` 37, `prop.boulder_flat` 35, `prop.mc_cave_rocks_d` 35, `prop.hesco_wall` 13, `prop.jersey_barrier` 11, `prop.railroad` 9, `prop.cargo_ibc_tank` 6, `prop.street_rusty_barrel` 6, `prop.jersey_barrier_striped` 6, `prop.machine` 6, `prop.boulder_jagged` 5, `prop.mc_rail` 5, `prop.cargo_container_rusty_red` 4, `prop.cargo_crate_stack` 4, `prop.mc_cart` 4, `prop.cargo_container_rusty_blue` 4, `prop.mc_mound` 4, `prop.storage_tank` 4, `prop.fuel_tank` 4, `prop.floodlight` 4, `prop.cargo_container_red` 4, `prop.street_post_barrel` 4, `prop.cargo_army_crate` 4, `prop.cargo_container_old_rusty` 3, `prop.shipping_container_red` 3, `prop.shipping_container_blue` 3, `prop.street_dumpster` 3, `prop.ammo_stack` 3, `prop.rocks_tall` 3, `prop.mining_haul_truck` 3, `prop.cog` 2, `prop.cargo_wooden_crate_low` 2, `prop.hopper` 2, `prop.hopper_tall` 2, `prop.concrete_block` 2, `prop.cargo_container` 2, `prop.sandbag_nest` 2, `prop.camo_net` 2, `prop.street_blue_barrel` 2, `prop.street_trash_pile` 2, `prop.yard_lamp` 2, `prop.steel_water_tower` 2, `prop.cargo_gantry_crane` 2, `prop.ore_wagon` 2, `prop.hopper_wagon` 2, `prop.boulder_round` 2, `prop.piston` 1, `prop.lever` 1, `prop.machine_window` 1, `prop.shipping_container_green` 1, `prop.flatbed_truck` 1, `prop.pallet` 1, `prop.metal_crate` 1, `prop.cargo_wooden_crate` 1, `prop.cargo_scifi_crate` 1, `prop.supply_truck` 1, `prop.fuel_drum` 1, `prop.diesel` 1, `prop.mn_rock_spires` 1, `prop.rock_spire_tall` 1, `prop.mining_excavator` 1, `prop.mc_cart_tipper` 1

### Block materials (count)

`core.pbr_rock` 27, `core.pbr_concrete` 29, `core.pbr_walnut` 12, `core.pbr_rusted_plate` 26, `core.pbr_tread_plate` 17, `core.pbr_steel` 230, `core.pbr_concrete_dark` 2, `core.pbr_grey_corrugated` 22, `core.pbr_walkway` 25, `core.pbr_corrugated` 1
