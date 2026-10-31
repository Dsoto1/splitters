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
