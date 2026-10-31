# Saltmarsh Harbor: implementation manifest

| | |
|---|---|
| Map | `maps/saltmarsh_harbor.json` (id `saltmarsh_harbor`, "Saltmarsh Harbor") |
| Source | The owner's concept sheet "Tileset 03 – Coastal Harbor" (timber piers on piles, stone quays with bollards and mooring rings, slipways, a lighthouse, a harbour crane, warehouses and net sheds, the harbourmaster's office, fish market stalls, moored boats, buoys, lobster pots, nets on racks, lamp posts, ladders, breakwater rocks, sea wall steps, a stone arch, gulls and weather). No separate brief: Style Pack 11's demo map. |
| Author / date | Tile Trigger, built 2026-10-31 |
| Status | Built, validated (0 issues incl. navigation), opened in MapMaker and played offline; not merged (branch `wip/harbor-pack`) |
| Players | 12–24 (`recommendedPlayers`), `teamSetup` 12 v 12 |
| Modes | Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill (`supportedModes`) |

## World
- Classic grid, 8 m cells, 4 m levels; no terrain (every cell is a tile). Tile (x, y) is world (8x, 8y); north = +Z (the sea).
- Tiles cover x −6..6, y −6..6 (104 × 104 m). Boundary (invisible, 22 m high): x −52..52, z −52..52.
- Levels: harbour bed −4 m, water surface −1.5 m, quay/decks 0, upper floors 4 m, crane platform 6 m, warehouse
  roofs 8.25–11 m, lighthouse gallery 10.5 m.
- Theme `core.coastal`; backdrop overcast sky, open sea, water ground, haze 0.5, mist 0.2, water border.

## Combat zones (approximate, world metres)
| Zone | Extent | Range | Cover |
|---|---|---|---|
| Embers yards and net sheds (SW) | x −52..−12, z −52..−20 | close–medium | net sheds, warehouse, racks |
| Town and high street | x −12..28, z −52..−12 | close–medium | warehouse, arch, outside stair, crates |
| Quay and fish market | x −52..36, z −20..0 | medium along the quay | fish market counters, net shed bays, office |
| Harbour basin (water) | x −52..32, z 0..36 | medium–long | moored boats, dolphins, buoys, the pier |
| Pier, boardwalk, breakwater, lighthouse | x −28..36, z 4..44 | long along the breakwater | wave wall, pier head rail, lighthouse parapet |
| Tide mole (NE) | x 32..52, z −4..52 | medium | crane, warehouse, office, containers |

## Traversal
- **Quay**: the whole south shore from the beach and slipway (west) to the mole (east).
- **Town**: the high street (x 0) through the Harbour Arch; yards between the buildings.
- **Pier**: from the quayside at (0, 0) north 32 m to the pier head in the breakwater.
- **Boardwalk**: from the quayside at (−24, 0) north to the lighthouse.
- **Breakwater**: lighthouse → pier head → mole (x −20..36 along z ≈ 39.5).
- **Water**: swim or ride a jet ski (hover bike placed *Rides on water*) across the basin; out by the Sea Wall
  Steps (x 8..16), the slipway (x −32), the shingle beach (x −44..−36), the ladders on the quay (x −16, −8, 24)
  and the mole face (z 8, 16, 24), or the breakwater rocks.
- **Up**: warehouse and net shed stairs (4 m), outside stairs to the Embers and middle warehouse roofs, the
  lighthouse stair (10.5 m), the crane ladder (6 m).

## Structures (tile (x, y, rotation))
`harbor.slipway` (−4,0); `harbor.quay` (−2,0) (−1,0) (3,0), (4,1..4,6 except 5, rot 3); `harbor.quay_steps` (1,0);
`harbor.quay_inner` (4,0, rot 3); `harbor.pier` (0,1..4); `harbor.pier_head` (0,5); `harbor.boardwalk` (−3,1..4);
`harbor.lighthouse` (−3,5); `harbor.breakwater` (−2,5) (−1,5) (1..4,5) rot 1; `harbor.beach` (−5,1..3, rot 1);
`harbor.crane` (5,3); `harbor.office` (5,1); `harbor.warehouse` (5,4) (−4,−5) (2,−4); `harbor.net_shed` (2,−1, rot 2)
(−6,−3) (−6,−5); `harbor.fish_market` (−3,−1); `harbor.arch` (0,−3); `medieval.outside_stair` (−4,−4) (2,−3);
`harbor.basin` for the water; `harbor.quayside` / `core.yard` elsewhere.

## Spawns
Embers 12 in the SW yards (yaw π/4), Tide 12 on the mole (yaw −3π/4), 12 free round the town and the west
shore. All on the navmesh (validate-map). Coordinates in the map file (`spawn_*`).

## Objectives
- CTF: `flag_embers` (−36, 0, −48), `flag_tide` (42, 0, 46).
- KotH: `hill_pier` (0, 0, 40) r 5 (pier head), `hill_market` (−20, 0, −8) r 5 (fish market), `hill_mole` (46, 0, 8) r 4.

## Pickups (registry ids, default respawn)
`core.weapon_sniper` (42.5, 6, 21.5) crane platform; `core.weapon_marksman` (−24, 10.5, 37.7) lighthouse gallery;
`core.weapon_rockets` (0, 0, 42) pier head; `core.weapon_lmg` (24, 4, −33.5) middle warehouse loft;
`core.weapon_shotgun` (−20, 0, −8) fish market; `core.weapon_flare_gun` (46, 4, 5.5) office balcony;
`core.weapon_hand_cannon` (−40, 4, −25.5) west net shed loft; `core.weapon_rifle` (−44, 0, −47), (44, 0, 38);
`core.weapon_smg` (−28, 0, −26), (50, 0, 10); `core.grenades` ×3; `core.armor_large` (0, 0, 20) mid-pier;
`core.armor_small` ×2; `core.health_large` ×2; `core.health_small` ×4.

## Vehicles
Four `hover_bike` mounts with `onWater` (jet skis): Embers (−32, −1.8, 10), (−30, −1.8, 22); Tide (26, −1.8, 12),
(26, −1.8, 26).

## Water and hazards
`water_harbour`: water, bottom −4, 2.5 m deep (surface −1.5), x −52..32, z 0..52; `water_steps` over the Sea Wall
Steps' cut. Breath 15 s under water.

## Screenshot viewpoints
`screenshots/`: MapMaker overview from (0, 80, −95), the pack palette, the mole; in play: quay, pier, lighthouse
gallery, swimming under the pier, warehouse loft, crane platform. Map card: `packages/client/public/maps/shots/saltmarsh_harbor.jpg`.
