# Qasr Medina: implementation manifest

| | |
|---|---|
| Map | `maps/qasr_medina.json` (id `qasr_medina`, "Qasr Medina") |
| Source | The owner's concept sheet "Tileset 02 – Desert City" (Middle Eastern / arid / stone + plaster; scenes: market streets under red canopies, courtyards and arcades, rooftop terraces with railings, blue domes, a minaret). No separate map brief: it is Style Pack 09 Desert City's demo map. |
| Author / date | Tile Trigger, built 2026-10-31 |
| Status | Built, validated (0 issues incl. navigation), opened in MapMaker and played offline; not yet merged (branch `wip/desert-city-pack`) |
| Players | 8–24 (`recommendedPlayers`), `teamSetup` 12 v 12 |
| Modes | Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill (`supportedModes`); Elimination comes with TDM |

## World
- Classic grid, 8 m cells, 4 m levels; no terrain (every cell is a tile). Tile (x, y) is world (8x, 8y); north = +Z.
- Tiles cover x −6..6, y −8..8 (104 × 136 m). Playable boundary (invisible walls 16 m high): x −52..52, z −68..68.
- Levels used: ground, 4 m (upper floors, galleries, courtyard and bazaar terraces, wall-walks, arcaded
  terraces), 8 m (roof terraces, rope bridges, outside stairs' decks, watch tower lookouts); the domed hall
  (~11 m) and minaret (~22 m) are landmarks, not climbed.
- Theme `core.desert_city`; backdrop clear sky, mesas, sand; the cells outside the walls painted Desert Sand.

## Combat zones (approximate extents, world metres)
| Zone | Extent | Range | Cover |
|---|---|---|---|
| Embers camp (outside the south wall) | z −68..−52 | medium–long across the sand | tents, crates, sandbags, a cart |
| Gate and wall | z −52..−44 | close in the passage; long along the wall-walks | merlons, the gate's corner towers |
| South quarter (two roof rows, outside stairs, west watch tower) | z −44..−20 | close in the houses and alleys, medium on the roofs | houses, parapets, crane, cloth lines |
| High street and well court | x −4..4, z −44..20 | medium–long down the street | stalls, the gallery's legs, the well |
| Courtyard (west) | x −36..−20, z −4..12 | close in the arcades, medium across the court | columns, fountain, terrace parapet |
| Bazaar and east houses | x 12..40, z −4..12 | close in the lane | counters, alcoves, terrace domes |
| North quarter (roof row, east tower, dome, minaret) | z 20..52 | close–medium | houses, dome, minaret base |
| Tide edge (north) | z 52..68 | medium–long | palms, the well, columns |
Long sightline: the high street from the gate (0, 0, −48) to the domed hall (0, 0, 44), ~90 m, broken by the
rope bridges, the gallery and the stalls.

## Traversal (routes south ↔ north)
- **High street**: gate passage (4 m wide, portcullis raised to start) → under the rope bridge and the gallery
  → market stalls → well court → market streets → ornate arch → under the north bridge and gallery → dome.
- **West flank**: wall gap at x −48 (a lattice screen to shoot through) → west watch tower → houses → the
  courtyard (gateways on every side) → north houses.
- **East flank**: wall gap at x 48 → east houses → bazaar lane or its terrace → east watch tower → minaret.
- **Upper level**: wall stairs and the gate's stairs → wall-walks over the gate; every house's own stairs →
  upper floor (doors east/west into galleries) → roof; outside stairs (−40, −32), (−16, −32), (16, −32),
  (40, −32), (8, −8) (turned: its 4 m landing reaches the arcaded terrace by the bazaar), (−32, 32), (−8, 32)
  → 8 m decks → roof rows; rope bridges along the south row (x −44..44 at z −40 is one rooftop), between the
  west and east pairs of the second row (z −24) and along the north row (z 24); the courtyard stair → the
  courtyard terrace → gaps to the yards round it; the bazaar terrace from the east house's upper door and the
  arcaded terrace.

## Structures (real tile ids; tile (x, y, rotation 0 unless given))
Wall: `desert.wall_stair` (−5,−6), (3,−6); `desert.city_wall` (−3,−6), (−2,−6), (2,−6), (5,−6);
`desert.city_gate` (−1,−6). Houses (2 × 1): `desert.house` (1,−5), (−5,−3), (1,−3), (3,0), (−5,3), (1,3),
(1,5); `desert.house_ashlar` (−5,−5), (−2,−3), (4,−3), (−2,3), (−6,5); `desert.house_shop` (−2,−5), (4,−5),
(3,1), (4,3), (−2,5). `desert.rope_bridge` (−3,−5), (0,−5), (3,−5), (−3,−3), (3,−3), (−3,3), (0,3);
`desert.gallery` (0,−3), (0,5); `desert.outside_stair` (−5,−4), (−2,−4), (2,−4), (5,−4), (1,−1, rot 2),
(−4,4), (−1,4); `desert.courtyard` (−4,0); `desert.bazaar` (2,0); `desert.terrace` (−4,−2), (1,0);
`desert.market_street` (0,−2), (0,0), (0,1); `desert.well_court` (4,−2), (0,−1), (−3,7); `desert.street`
(0,−4), (0,2), (0,4); `desert.tower` (−6,−4), (6,1), (4,4, rot 2); `desert.dome` (0,6); `desert.minaret` (3,6);
`core.yard` elsewhere (41 of them painted `core.pbr_sand`).

## Spawns
- Embers (12, yaw 0): (−36,−66) (−28,−60) (−20,−66) (−12,−60) (−4,−66) (4,−60) (12,−66) (20,−60) (28,−66) (36,−60) (−44,−64) (44,−64).
- Tide (12, yaw π): (−36,66) (−28,62) (−20,66) (−12,62) (12,62) (20,66) (28,62) (36,66) (−44,60) (44,60) (−6,58) (6,66).
- Free (12): (−40,−12) (40,−12) (−12,−16) (12,−14) (−44,8) (24,−6) (−12,16) (24,16) (−28,40) (12,46) (44,40) (−20,52). All on the navmesh (validate-map).

## Objectives
- CTF: flags `embers` (−12, 0, −63), `tide` (12, 0, 61).
- KotH: the courtyard (−28, 0, 8) r 5; the bazaar lane (16, 0, 4) r 4; the arcaded terrace by the bazaar (8, 4, 0) r 4.

## Pickups (registry ids, default respawn)
`core.weapon_sniper` (−50.5, 8, −34.5) west watch tower and (45.4, 8, 5.3) east watch tower lookouts;
`core.weapon_marksman` (8, 8, −38) and (−12, 8, 26) roofs; `core.weapon_shotgun` (−6, 4, −24) upstairs;
`core.weapon_sawed_off` (30, 4, 8) upstairs; `core.weapon_rifle` (−30, 0, −58), (30, 0, 58);
`core.weapon_smg` (30, 0, −58), (−30, 0, 58); `core.weapon_burst_rifle` (40, 0, −8);
`core.weapon_gilded_pistol` (−28, 0, −2.5) courtyard arcade; `core.weapon_spear` (−40, 0, 0);
`core.weapon_flamethrower` (1.6, 0, 49.6) in the domed hall; `core.incendiaries` (0, 4, −24) on the gallery;
`core.grenades` (−21.5, 4, −2) courtyard terrace, (24, 0, −12); `core.armor_large` (16, 0, 8) bazaar;
`core.armor_small` (±44, 0, −16); `core.health_large` (0, 0, −14), (0, 0, 22); `core.health_small`
(−24, 0, 16), (24, 0, 16), (48, 0, 20), (−48, 0, −20).

## Vehicles
None (a city of alleys, stairs and roofs).

## Water and hazards
None. Falls from the 8 m roofs (parapets on every edge except the 2.4 m joining gaps).

## Scenario pieces
Portcullis (door style `portcullis`, start open) in the gate passage; two Lattice Screens (breakable) in the
wall gaps; seven wall lanterns (lights).

## Props
Embers camp: tents, canopies, sandbags, crates, jars, a cart, palms. Gate: two Desert Banners. High street:
market stall, rug, spice baskets, vase, jars, rug rack, ornate arch. Courtyard: palm planters, floor cushions.
Bazaar: canopy, stall. Alleys: cloth lines, timber crane, scaffold, crates, barrels, sandbags. North: water
well, palms, sandstone columns, vases. Roofs: cushions, jars, a rug.

## Screenshot viewpoints
`screenshots/`: MapMaker overview from (0, 70, −112) with the Desert City pack picked; the pack palette; in
play: gate (0, 0, −58), high street (2, 0, −40), roofs (−12, 8, −38), courtyard terrace (−22, 4, −2), bazaar
(16, 0, −2), gallery and dome (1, 0, 30). Map card: `packages/client/public/maps/shots/qasr_medina.jpg`
(automatic, tools/content/capture-map-shots.mjs).
