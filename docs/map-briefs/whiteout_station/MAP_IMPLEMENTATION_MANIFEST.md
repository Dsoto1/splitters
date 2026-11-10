# Whiteout Station: implementation manifest

| | |
|---|---|
| Map | `maps/whiteout_station.json` (id `whiteout_station`, "Whiteout Station") |
| Source | The owner's concept sheet "TILESET 05 – Snow Outpost" (prefab huts and barracks with snow roofs, radar dome, antenna masts, hangar with roll-up doors, watchtower, bunkers, fuel tanks and pipes, catwalks, frozen lake, ice walls and frozen cliffs). No separate brief: it is Style Pack 12's demo map. |
| Author / date | Tile Trigger, built 2026-10-31 |
| Status | Built, validated (0 issues incl. navigation), opened in MapMaker and played offline; not merged (branch `wip/snow-pack`) |
| Players | 8–24 (`recommendedPlayers`), `teamSetup` 12 v 12 |
| Modes | Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill (`supportedModes`) |

## World
- Classic grid, 8 m cells, 4 m levels; no terrain (every cell is a tile). Tile (x, y) is world (8x, 8y); north = +Z.
- Tiles cover x −6..6, y −8..8 (104 × 136 m). Boundary: invisible walls 20 m high, x −52..52, z −68..68.
- Levels used: ice-hole water (−2 m), ground, 3.2–3.5 m (hut, comms and bunker roofs, barracks decks), 3.5–4.8 m
  (barracks roofs), 4 m (catwalk, hangar mezzanine, ridge top), 7 m (watchtower lookouts).
- Theme `core.snow_outpost`; backdrop snowy sky, snowy peaks, snow ground, haze 0.6, mist 0.25, concrete wall border.
- Distinct from Frost Basin (a wide terrain basin with hilltop halls, many vehicles and a transport plane) and
  Glacier Line (Bomb across a blizzard snowfield against an ice base, walkers): a compact all-tile outpost round a
  frozen lake, three lanes, roofs to climb, no aircraft.

## Combat zones (approximate, world metres)
| Zone | Extent | Range | Cover |
|---|---|---|---|
| Embers base (hangar, barracks, huts) | z −68..−36 | close in buildings, medium in yards | hangar, barracks, huts, generator, crates |
| Frozen lake | x −20..20, z −28..28 | long (open ice) | three pressure ridges, four ice blocks, thin ice over two holes |
| West ridge | x −44..−28, z −20..20, 4 m up | medium–long over the lake | sandbag nests, snow pile, pines; ice wall on the west edge |
| West gully and shore | x −52..−44 and −28..−20 | close–medium | ice wall, boulders, rocks |
| East lane (catwalk, bunkers, road) | x 20..52, z −36..36 | close in bunkers, medium on the catwalk, long down the road | bunkers, pipes, drums, fuel depots |
| Tide base (radar dome, comms, barracks, huts) | z 36..68 | close–medium | dome, comms hut, barracks, huts |

## Traversal
- **Centre**: across the lake (cover only from the ridges and ice blocks; thin ice gives way over the holes at (−8, −8) and (8, 8)).
- **West**: snow drifts at (−40, −24) and (−40, 24) up onto the 4 m ridge; or along the shore (x −24) or the gully (x −48).
- **East**: metal stairs at (24, −24) and (24, 24) onto the catwalk (x 24, 4 m); bunkers at (32, ±8) with drifts onto their roofs; the snow road (x 40) end to end.
- **Up**: hut and comms roofs by outside stairs; barracks decks, then roofs; watchtowers; the hangar mezzanine.

## Structures (tile, cells' lowest corner, rotation)
South: `snow.hangar` (−1,−7) r2; `snow.barracks` (−4,−7), (2,−7); `snow.hut` (−5,−5), (1,−5); `snow.fuel_depot` (2,−6);
`snow.watchtower` (4,−5), (−6,−8). North: `snow.radar_dome` (0,7); `snow.comms_hut` (−1,7) r2; `snow.barracks` (−4,7) r2,
(2,7) r2; `snow.hut` (1,5) r2, (−5,5) r2; `snow.fuel_depot` (−2,6) r1; `snow.watchtower` (4,5), (6,8). Lake x −2..2,
y −3..3: `snow.frozen_lake`, `snow.ice_ridge` (−1,2), (1,−2), (0,0) r1, `snow.ice_hole` (−1,−1), (1,1). Ridge:
`snow.ice_cliff` x −5..−4, y −2..2; `snow.drift_ramp` (−5..−4, −3) r0 and (−5..−4, 3) r2; `snow.ice_wall` x −6 r1 and
x 6 r3 for y −3..3. East: `snow.metal_stair` (3,−3) r0, (3,3) r2; `snow.catwalk` (3, −2..2); `snow.bunker` (4,1) r0,
(4,−1) r2; `snow.road` (5, −5..5); `snow.fuel_depot` (6,±4) r1. `core.yard` elsewhere.

## Spawns
- Embers (12, yaw 0): (−36,−66) (−28,−62) (−20,−66) (−12,−66) (12,−66) (20,−62) (28,−66) (44,−66) (36,−54) (−44,−50) (−20,−50) (20,−48).
- Tide (12, yaw π): (−36,66) (−28,62) (−12,66) (−4,66) (12,66) (20,62) (28,66) (36,66) (44,56) (−44,46) (−24,48) (20,50).
- Free (12): (±24,±32), (−24,0), (−46,±16), (40,±8), (40,±20), (8,−32). All on the navmesh (validate-map).

## Objectives
- CTF: `flag_embers` (−4, 0, −66), `flag_tide` (4, 0, 66).
- KotH: `hill_lake` (0, 0, 0) r 6; `hill_ridge` (−36, 4, 0) r 5; `hill_catwalk` (32, 0, 0) r 6 (between the bunkers).

## Pickups (registry ids, default respawn)
`core.weapon_sniper` (−36, 4, 4) ridge; `core.weapon_rockets` (24, 4, 0) catwalk; `core.weapon_lmg` (32, 0, −8) and
`core.weapon_flamethrower` (32, 0, 8) in the bunkers; `core.weapon_marksman` (32, 7, −42.6), (32, 7, 37.4) watchtower
lookouts; `core.armor_large` (0, 0, ±12) on the ice; `core.weapon_shotgun` (−28, 0, −57), (28, 0, 57); `core.weapon_smg`
(20, 0, −57), (−20, 0, 57); `core.weapon_rifle` (−4, 0, −52), (4, 0, 52); `core.grenades` (−24, 0, −20), (24, 0, 20);
`core.mines` (40, 0, 0); `core.health_large` (−24, 0, 20), (24, 0, −20); `core.health_small` (−12, 0, −28), (12, 0, 28),
(−48, 0, −28), (48, 0, 28); `core.armor_small` (−48, 0, 28), (48, 0, −28).

## Vehicles
Four `snow_sled` mounts (two per team, faction-locked) at the ends of the snow road: (36/44, 0, −46) Embers,
(36/44, 0, 46) Tide. The road, the lake and the yards are flat and wide; bots took sleds in the audit.

## Scenario pieces and logic
Roll-up door on the hangar's north doorway (`hangar_door` / `hangar_door_panel`, rolled up at the start); button
`hangar_button` inside; rule `rule_hangar_door` (button → buzzer + `mover_go`). Thin Ice over both ice holes with Water
under it (3.6 × 1.6 × 3.6 m). Four Ice Blocks on the lake. Three lights (radar beacon, hangar lamp, road lamp).

## Screenshot viewpoints
`screenshots/`: play-overview (−70, 60, −100), play-lake, play-ridge, play-hangar, play-catwalk, play-tide-base,
mapmaker-overview, mapmaker-pack-palette. Map card: `packages/client/public/maps/shots/whiteout_station.jpg` (automatic).

# Rebuild 2026-11 (MAP 03 Frostbite Station; branch `wip/mapmaker-whiteout`)

Everything above is the old build (2026-10-31). This part is the rebuild, made in MapMaker (DECISIONS_AND_DEVIATIONS.md,
"Rebuild 2026-11").

| | |
|---|---|
| Map | `maps/whiteout_station.json` (id `whiteout_station`, "Whiteout Station": id and name kept) |
| Source | `docs/map-briefs/MAP_03_Frostbite_Station.md` and `frostbite_station_reference.jpg` (approved; MapMaker lane, 2026-11-08) |
| Status | Greybox (2026-11-09): footprint, terrain, structures, routes, spawns, pickups; validate-map 0 issues |
| Players | 8-16 (`recommendedPlayers`), `teamSetup` 8 v 8 |
| Modes | Deathmatch (main), Team Deathmatch (Elimination with it); no flags or hills (the brief names no objectives) |
| Weapon set | Military |

## World
- Terrain 176 × 160 m of snow, vertices 2 m apart (89 × 81), x −88..88, z −80..80, ground at −0.15 m. Standard grid:
  8 m cells, cell (x, y) centred on world (8x, 8y), 4 m levels. North = +z.
- Boundary: invisible walls x −60..60, z −46..52 (120 × 98 m); snowbanks raised 6-10 m in a ring just outside it
  (rough, steep faces painted stone); backdrop snowy sky, peaks, snow ground, no border.
- Under the central yard the ground is dipped to −1.5 m (x −10..18, z −10..10) so the yard's tiles and the tunnel's
  floors pull it under them. The radar ridge: the ground flattened to 3.85 m over x ≥ 30, z ≥ 22 (to the bank), its
  edges steep (stone), the tops of its three ways up brought to 3.85 m.

## Structures (cells, rotation in quarter turns clockwise; set pieces by their anchor)
| What | Where | Pieces |
|---|---|---|
| Tunnel (level −1) | y 0, x −1..2 | Stairs (−1, 0) r2 (up west), Corridor (0, 0) r1, (1, 0) r1, Stairs (2, 0) r0 (up east); Doorways at the huts' tops |
| Central yard | x −1..2, y −1..1 (less the huts) | Courtyard, Courtyard (Crates), Courtyard (Low Wall) |
| Main lab | x −1..3, y 2..3 | Reactor Room anchor (−1, 2) r0; Server Vault anchor (3, 3) r2 |
| Lab wing | x −5..−3, y −1..1 | Power Core Hall anchor (−5, −1) r0; Platform (Railing) on level 1 at (−2, 0) and (−6, 0), Open Stairs (−2, 1) r1 and (−6, −1) r3 |
| Comms annex | x −5..−3, y 2..3 | Corridor (−4, 2), Barracks (−5, 3), Comms Tower (−3, 3) |
| Garage | x 0..4, y −3..−2 | Vehicle Hangar (0, −3); Loading Dock anchor (2, −3) |
| Fuel tanks, pump house | x 4..5, y −1..1 | Barracks (4, 1) r1; Fuel Depot (5, −1), (5, 0), (5, 1) |
| Radar shelter | ridge, level 1 | Radar Dome (5, 4); Snow Drift (4, 2) r0, (3, 5) r1; Metal Stair (6, 2) |
| Ice cave | x 6..7, y −4..−3 | Large Room (roof, rubble, glacier-ice walls, lake-ice floor; wide doorways west and north); Frozen Cliff on level 1 over all four cells; the ground raised against its south and east walls |
| Service trench | y −2, x −3..−1 | Trench End (Sandbags) r2, Trench (Sandbags), Trench End (Sandbags) r0 |
| South-west | | Fuel Depot (−5, −3), Prefab Hut (−4, −3), Ice Hole (−2, −1) |

## Spawns (24; world metres, facing in degrees, 0 = north)
- Tide (8, north-west): (−50, 36) 135, (−40, 38) 135, (−30, 38) 180, (−20, 34) 180, (−12, 38) 135, (−52, 24) 90,
  (−52, 14) 90, (−36, 31) 180.
- Embers (8, south-east): (30, −40) 0, (20, −40) 0, (10, −42) 0, (−4, −40) 0, (40, −26) 0, (48, −14) 0, (55, −12) 315,
  (36, −34) 315.
- Shared (8, Deathmatch): (−20, −38) 0, (24, 10) 225, (20, 38) 180, (50, 4, 26) 225 on the ridge, (−40, −40) 45,
  (56, 2) 270, (−16, 2) 90, (−48, −26) 45.
- All on the navmesh and in the main area (validate-map); spawn deaths 0 % (TDM) and 4 % (DM) in the bot runs.

## Pickups (registry ids, default respawn)
`core.weapon_sniper` (52, 4, 36) ridge; `core.weapon_shotgun` (−8, 0, 16) reactor hall; `core.weapon_smg` (−40, 0, −8)
lab wing; `core.weapon_lmg` (4, 4, −13.5) hangar mezzanine; `core.weapon_rockets` (4, −4, 0) tunnel;
`core.weapon_marksman` (−24, 0, 24) comms hut; `core.weapon_rifle` (16, 0, 8) yard; `core.grenades` (−16, 0, −16) by
the trench; `core.armor_large` (52, 0, −28) ice cave; `core.armor_small` (−52, 0, 2) west flank, (24, 0, −18) loading
dock; `core.health_large` (32, 0, 2) pump house; `core.health_small` (−32, 0, 16) annex, (8, 0, −24) hangar,
(24, 0, 28) server vault, (48, 0, 10) east flank.

## Combat zones
| Zone | Extent (world m) | Range | Cover |
|---|---|---|---|
| Central yard | x −12..20, z −12..12 | mid (8-30 m) | the two tunnel huts, crate stacks, low walls, tarps, drums |
| Main lab and vault | x −12..28, z 12..28 | short, two storeys | the reactor's catwalk, the control room's glass, racks |
| Lab wing | x −44..−20, z −12..12 | short, two storeys | eight columns round the core, the gallery |
| Garage | x −4..36, z −28..−12 | short inside, mid on the apron | workbench, crates, the dock's truck and cargo |
| Fuel tanks / east flank | x 28..60, z −20..20 | mid | the depots' bund walls and tanks, the pump house |
| Radar ridge | x 28..60, z 20..52, 4 m up | long (to about 90 m over the yard to the south-west) | the dome, sandbags, the dish |
| Ice cave | x 44..60, z −36..−20 | short | ice rubble |
| West flank, south road, north lane | the ring inside the boundary | mid | snow piles, trench, barriers, fences, pines |

## Traversal
- **Tunnel**: the west hut (−8, 0) down to level −1, two corridors east, up the east hut (16, 0); doorways at both tops.
- **Ridge**: Snow Drift (32, 16) from the pump house's north door, Metal Stair (48, 16) from the east flank, Snow Drift
  (24, 40) from the north lane.
- **Lab wing gallery**: block stairs inside; its doors east and west onto railed platforms with open stairs down.
- **Indoors**: reactor ↔ server vault (the airlock and the fire exit), the lab wing ↔ the annex corridor ↔ barracks.

## QA (2026-11-09)
- `pnpm validate-map maps/whiteout_station.json`: OK (0 issues; navigation included, official rules). Nav audit:
  0 traps; islands only inside the server vault (two small rooms behind its auto doors) and on the bank outside the
  boundary.
- Z-fight audit (`zfight.test.ts`, map and props): passes. `stylePacksSnow.test.ts` (rebuilt map's landmarks, tunnel,
  modes, navigation, the tunnel and ridge both ways): passes.
- Budgets: 38 tiles, 7 set pieces, 24 spawns, 16 pickups, 45 props and plants, about 1,500 collision boxes (the
  shipped maps' 2,700-3,900), 33 of 80 prop models; lights only the set pieces' own (well under 256).
- bot-report, 16 bots, 180 s (load 15-20 on 4 cores): TDM seed 1 embers 41 · tide 32, 73 kills, stuck recoveries 26,
  no route 0 %, spawn deaths 0; TDM seed 2 embers 44 · tide 29, 74 kills, stuck 23; DM 176 kills, stuck 24, spawn
  deaths 4 %; Elimination 2 rounds, 68 s each. Stuck spots: the gap between the lab wing and the west hut (−12..−24,
  0..8), the yard's south-west corner (−8, −8), the east hut's exit (24, 12).
- Bench (server tick, 16 bots, TDM, 60 s, load 15): avg 4.4 ms, p95 11.4 ms of 16.7.
- e2e `maps` (E2E_MAPS=whiteout_station, CI timings): match starts, you spawn on solid ground; opens in MapMaker with
  nothing lost.
- Card shot: `packages/client/public/maps/shots/whiteout_station.jpg` from the map's card camera (eye level in the
  yard's south-west corner looking north-east), capture-map-shots.

## Follow-ups (2026-11-09)
- Modes: Deathmatch, Team Deathmatch (Elimination), **King of the Hill** on hills "Yard" (4, 0, 0) r 6, "Radar ridge"
  (48, 3.85, 40) r 5, "Ice cave" (52, 0, −28) r 5.
- Vehicles: three `snow_sled` mounts on the south road, (0, 0, −34), (6, 0, −34) facing south, (−28, 0, −34) facing east
  (the two snowmobile props they replace are gone).
- Tide spawns moved 8 m toward the yard (DECISIONS, "Follow-ups").
- **QA (load 15-20, 4 cores):** validate-map OK (0 issues); nav audit 0 traps; stylePacksSnow.test.ts passes (hills,
  sleds, modes, navigation). bot-report, 16 bots, 180 s, TDM seeds 1-4: embers 29 · tide 33, 34 · 34, 33 · 37, 37 · 39
  (before the move, seeds 1-2: 41 · 32, 44 · 29); sleds wedged 0 times in every run, ridden in all, stalled (stopped
  aboard) 2-23 times a match, mostly against the garage's north side ((4, 0, −12), (12, 0, −20)): bots try to drive
  through the hangar to the yard. King of the Hill seeds 1-2: embers 70 · tide 37, 91 · 0 (the cave hill is on
  Embers' side). Deathmatch seed 1: 181 kills, no idle spells of 10 s+. Bench (16 bots, TDM, 60 s): CPU 3.5 ms a tick
  (p95 9.6) of 16.7. A person driving a sled: not tested here (no GPU).
- **Second pass:** hills "Yard" (−8, 0, 8), "Radar ridge" (34, 3.85, 46), "Ice cave" unchanged; sleds at (−28, 0, −34),
  (−40, 0, −34), (−44, 0, −40) facing north. bot-report, 16 bots, 180 s: King of the Hill seeds 1-8 embers 44 · tide 60,
  44 · 37, 58 · 45, 66 · 16, 44 · 41, 21 · 43, 50 · 65, 51 · 68 (378 · 375); TDM seeds 1-8 45 · 45, 40 · 24, 36 · 33,
  52 · 33, 40 · 35, 38 · 38, 43 · 40, 36 · 33 (330 · 281); sleds wedged 0, stalled in 2 of 16 matches (west flank,
  east flank), never in the hangar. validate-map OK.
