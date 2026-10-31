# Market Town: implementation manifest

| | |
|---|---|
| Map | `maps/market_town.json` (id `market_town`, "Market Town") |
| Source | The owner's concept sheet "Tileset 01 – Medieval Village / Town" (scenes: half-timbered houses with red tile roofs round a cobbled market square with a fountain, a stone arch bridge over a stream, a castle gate, banners, wooden balconies and walkways). No separate map brief: it is Style Pack 10's demo map. |
| Author / date | Tile Trigger, built 2026-10-31 |
| Status | Built, validated (0 issues incl. navigation), loaded in MapMaker and played offline; not yet merged (branch `wip/medieval-pack`) |
| Players | 8–24 (`recommendedPlayers`), `teamSetup` 12 v 12 |
| Modes | Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill (`supportedModes`); Elimination comes with TDM |

## World
- Classic grid, 8 m cells, 4 m levels; no terrain (every cell is a tile). Tile (x, y) is world (8x, 8y); north = +Z.
- Tiles cover x −6..6, y −9..7 (104 × 136 m). Playable boundary (invisible walls 16 m high): x −52..52, z −78..62.
- Levels used: the stream bed (−2 m), ground, 4 m (upper floors, walkways, wall-walks, market hall), 7 m
  (watchtower lookouts), 8 m (gate roof), 8.25–11 m (house roofs), 10 m (belfry).
- Theme `core.medieval`; backdrop cloudy sky, hills, grass, forest border.

## Combat zones (approximate extents, world metres)
| Zone | Extent | Range | Cover |
|---|---|---|---|
| Embers camp (outside the south wall) | z −78..−52 | medium–long across the open ground | tents, carts, spiked fences |
| Gate and wall | z −52..−44 | close in the passage and guard room; long along the wall-walks | merlons, gate tower |
| South quarter (forge, shop houses, SE watchtower) | z −44..−28 | close–medium | houses, hay cart, forge |
| Stream and bridges | z −28..−20 | medium along the stream, close under the arches | bridges, quay |
| Market square and hall | x −12..12, z −4..12 | medium | stalls, fountain plinth, hall posts, upper hall windows |
| North rows and walkway | z 12..40 | close inside houses, medium on roofs | houses, outside stairs, walkway |
| Churchyard (Tide) | z 40..62 | medium–long | bell tower, NW watchtower, trees, market cross |
Long sightline: the high street from the bell tower belfry (0, 10, 48) to the gate (0, 0, −48), ~96 m.

## Traversal (routes south ↔ north)
- **High street**: gate passage (4 m wide, portcullis raised to start) → road → main bridge (x 0) → square → road → under the walkway → churchyard.
- **West flank**: wall gap at x −48 → forge yard → west bridge (x −32) → west houses → churchyard.
- **East flank**: wall gap at x 48 → SE watchtower → east bridge (x 32) → hall's east side → north rows.
- **Upper level**: wall stairs → wall-walks → gate guard room (doors both sides) → ladder → gate roof;
  houses' stairs → upper floors → doors east and west into the next house / onto the walkway over the
  high street; outside stairs (−24, 0, −32), (24, 0, −32), (−24, 0, 24), (8, 0, 24) → decks at 8.25 m →
  roofs.
- **Stream bed**: walk east–west along the bed under the three bridges; out up the north bank's grass slope.

## Structures (real tile ids; tile (x, y, rotation))
Town wall: `medieval.wall_stair` (−5,−6), (4,−6); `medieval.town_wall` (−3,−6), (−2,−6), (2,−6), (3,−6);
`medieval.town_gate` (−1,−6). Houses (2 × 1): `medieval.house` (2,−5), (−6,−2), (5,−2), (−6,0), (5,1),
(1,2), (−6,2), (4,3), (−2,4), (1,4); `medieval.house_shop` (−3,−5), (2,−2), (−4,0), (−3,2);
`medieval.house_balcony` (−3,−2), (3,0), (−6,4). `medieval.outside_stair` (−3,−4), (3,−4), (−3,3), (1,3);
`medieval.walkway` (0,4, rot 1); `medieval.market_square` (−1,0); `medieval.market_hall` (1,0);
`medieval.forge` (−5,−5); `medieval.watchtower` (5,−5), (−5,6); `medieval.bell_tower` (0,6);
`medieval.stream` row y −3 with `medieval.bridge` at x −4, 0, 4; `medieval.road` along x 0; `core.yard`
elsewhere.

## Spawns
- Embers (12, yaw 0): (−36,−66) (−28,−70) (−20,−64) (−12,−72) (−4,−66) (4,−70) (12,−64) (20,−72) (28,−66) (36,−70) (−44,−60) (44,−60).
- Tide (12, yaw π): (−30,52) (−28,58) (−20,50) (−12,58) (12,58) (20,50) (28,58) (36,52) (−48,40) (44,44) (−12,44) (12,44).
- Free (12): round the town (deathmatch). All on the navmesh (validate-map).

## Objectives
- CTF: `flag_embers` (−12, 0, −68), `flag_tide` (12, 0, 56).
- KotH: `hill_square` (−4, 0, 9) r 5; `hill_bridge` (0, 1, −24) r 4 on the main bridge's crown; `hill_hall` (6, 4, 8) r 4 upstairs in the market hall.

## Pickups (registry ids, default respawn)
`core.weapon_marksman` (40, 7, −42.6) SE watchtower lookout and (−24, 4, −49.5) west wall-walk;
`core.weapon_sniper` (−2, 8, −49) gate roof (ladder); `core.weapon_battle_axe` (−40, 0, −42.5) forge;
`core.weapon_shotgun` (−14, 4, 16) upstairs; `core.weapon_sawed_off` (−18, 0, −17); `core.weapon_hand_cannon`
(30, 0, −1); `core.weapon_spear` (−10, 0, 10); `core.weapon_rifle` (−30, 0, −60), (30, 0, 50);
`core.weapon_smg` (30, 0, −60), (−30, 0, 50); `core.incendiaries` (0, 4, 32) walkway; `core.grenades`
(−36, 0, 4), (36, 0, −12); `core.sheep` (0, 0, 38); `core.armor_large` (6, 4, 8); `core.armor_small`
(±44, 0, −24); `core.health_large` (−4, 0, −34), (4, 0, 26); `core.health_small` (−24, 0, 6), (24, 0, 30),
(−12, 0, −12), (16, 0, −12).

## Vehicles
None (a town of alleys and stairs).

## Water and hazards
`water_stream`: water, floor at −2 m, 0.8 m deep (wade), x −52..52 along z −26.5..−21.8.

## Scenario pieces
Portcullis (door style `portcullis`, start open) in the gate passage; ladder in the gate's roof hatch;
two Wattle Hurdles in the wall gaps; five braziers (lights).

## Screenshot viewpoints
`screenshots/`: MapMaker overview from (0, 75, −105), the pack palette, in play: square, roofs (an outside
stair's deck), gate, high street. Map card: `packages/client/public/maps/shots/market_town.jpg` (automatic).
