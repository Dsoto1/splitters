# Vinefall Sanctum: implementation manifest

| | |
|---|---|
| Map | `maps/vinefall_sanctum.json` (id `vinefall_sanctum`, "Vinefall Sanctum") |
| Source | The owner's concept sheets "Tileset 04 – Jungle Ruins" (weathered mossy stone; overgrown temple courtyards, waterfalls, rope bridges over chasms, torch-lit stairs, red banners) and "Tileset 07 – Ancient Temple" (sandstone with teal-and-gold inlay, banners, braziers, chain rails, spikes, portcullis, multi-level terraces with waterfalls), folded into one pack by the owner. No separate map brief: it is the refreshed Style Pack 06 Jungle Ruins' demo map. |
| Author / date | Tile Trigger, built 2026-10-31 |
| Status | Built, validated (0 issues incl. navigation), opened in MapMaker; not yet merged (branch `wip/jungle-ruins-pack`) |
| Players | 8–24 (`recommendedPlayers`), `teamSetup` 12 v 12 |
| Modes | Deathmatch, Team Deathmatch, Capture the Flag, King of the Hill (`supportedModes`); Elimination comes with TDM |

## World
- Classic grid, 8 m cells, 4 m levels; no terrain (every cell is a tile). Tile (x, y) is world (8x, 8y); north = +Z.
- Tiles cover x −6..6, y −7..7 (104 × 120 m). Playable boundary (invisible walls 16 m high): x −52..52, z −60..60.
- Point-symmetric: the south half (Embers) is the north half (Tide) turned half round about (0, 0).
- Levels: the gorge bed (−4 m), ground, 4 m (terraces, temple roofs, colonnade roofs, the high bridges),
  7 m (watch tower lookouts), 8 m (summit shrines on the ziggurats; the waterfall walls' tops).
- Theme `core.ancient_temple`; backdrop misty sky, forest, moss ground, forest border, haze 0.55.

## Combat zones (approximate extents, world metres)
| Zone | Extent | Range | Cover |
|---|---|---|---|
| Gorge (river) | x −40..40, z −2.5..2.5, 4 m down | close–medium along the bed | the banks, the bridges overhead |
| Bridges | x −32, 0, 32 at ground; x ±16 at 4 m | medium across the gorge | netting, balustrades |
| Sanctum courts (each side) | x −48..48, z ±8..±24 | close–medium | low, window, relief and column walls, overgrown ruins, colonnades |
| Ziggurat and shrine (each side) | x −8..8, z ±16..±36 | long from the shrine down the middle | terraces, stair cheeks, the shrine |
| Carved temples (each side) | (−32..−24, 24) and (24..32, 24) (mirrored south) | close inside, medium from the roofs | walls, columns, parapets |
| Waterfalls and base (each side) | z ±40..±56 | medium | waterfall walls, ruined courts, the cliffs at the map edge |
| Watch towers | (±48, ±40) | long from the 7 m lookouts | plank parapets |
Long sightline: shrine to shrine down the middle, (0, 8, −32) to (0, 8, 32), ~64 m, broken by the ziggurat
terraces, the stairs and the centre bridge.

## Traversal (routes south ↔ north)
- **Centre**: the Chasm Rope Bridge at x 0 (ground) between the two ziggurats' feet.
- **Flanks**: Chasm Rope Bridges at x ±32 (ground); the Gorge Steps at x ±40 down into the gorge.
- **High route**: terraces and colonnade roofs 4 m up → the Rope Bridge Span at x −16 or the Stone Bridge Span
  at x 16, both at 4 m (King of the Hill zones with a rocket launcher on each).
- **Under**: wade the river in the gorge (heavy armour in the middle, dynamite at x ±24); climb out by the vine
  ladders at x ±24 or the Gorge Steps at x ±40.
- **Up**: Terrace Stair (0, ±2) to the first terrace, a second Terrace Stair stacked at (0, ±3) level 1 to the
  summit shrine (8 m); the Carved Temples' inside stairs to their roof walks (4 m); the watch towers' switchback
  stairs to the lookouts (7 m); through the passages behind the falls in the waterfall walls.

## Structures (real tile ids; tile (x, y), level 0 and rotation 0 unless given)
North half (the south half is the same turned half round: (x, y) → (−x, −y), rotation + 2):
`jungle.terrace` (−1,4), (0,4), (1,4), (−1,3), (1,3), and (−1,4, L1), (1,4, L1); `jungle.terrace_stair` (0,2),
(0,3, L1), (−2,2, r2), (2,2, r2); `jungle.shrine` (0,4, L2); `jungle.temple` (−4,3), (3,3); `jungle.beamed_hall`
(−2,3), (2,3); `jungle.waterfall_wall` (−2,6), (2,6); `jungle.watch_tower` (−6,5), (6,5); `jungle.wall_column`
(−4,5), (4,5); `jungle.wall_window` (−5,2, r1), (5,2, r3); `jungle.wall_relief` (−1,2, r3), (1,2, r1);
`jungle.wall_low` (−3,1, r2), (3,1, r2); `jungle.overgrown_ruin` (−4,6, r1), (4,6, r3), (−2,4), (2,4, r1),
(−5,1, r2), (5,1, r2); `jungle.ruined_court` (−5,6), (0,6), (5,6), (−5,4), (5,4), (−3,2), (4,2), (−1,1), (1,1);
`jungle.cliff` along y 7 (x −6..6).
Gorge (y 0): `jungle.chasm_steps` (−5,0), (5,0, r2); `jungle.chasm_bridge` (−4,0), (0,0), (4,0); `jungle.chasm`
(−3..−1,0), (1..3,0); `jungle.rope_bridge` (−2,0, L1); `jungle.stone_bridge` (2,0, L1).
`core.yard` elsewhere (70).

## Spawns
- Embers (12, facing north): (40,−42) (24,−40) (22,−47) (8,−42) (−8,−42) (−22,−47) (−24,−40) (−40,−42) (46,−50) (−46,−50) (8,−50) (−8,−50).
- Tide (12, facing south): the same turned half round.
- Free (12): (−48,16) (−24,8) (−40,24) (0,8) (−48,32) (−33,13) and the same turned half round. All on the navmesh (validate-map).

## Objectives
- CTF: flags `tide` (0, 0, 40), `embers` (0, 0, −40).
- KotH: the centre bridge (0, 0, 0) r 4; the high bridges (−16, 4, 0) and (16, 4, 0) r 3.5.

## Pickups (registry ids, default respawn; north half, mirrored south)
`core.weapon_sniper` (0, 8, 31) at the shrine's altar; `core.weapon_marksman` (−48, 7, 37.5) on the watch tower
lookout; `core.weapon_launcher` (−16, 4, 0) on the rope bridge span (and (16, 4, 0) on the stone span);
`core.weapon_grapple` (−40, 0, 48); `core.weapon_shotgun` (−27, 0, 22) by the temple gate; `core.weapon_smg`
(−40, 0, 8); `core.weapon_rifle` (−24, 0, 32); `core.grenades` (−8, 0, 8); `core.armor_small` (−8, 4, 21.5) on
the terrace; `core.health_large` (−48, 0, 8); `core.health_small` (−24, 0, 48) and (−32, −4, 0) in the gorge.
In the gorge: `core.dynamite` (±24, −4, 0), `core.armor_large` (0, −4, 0).

## Vehicles
None (stairs, bridges and a gorge).

## Water and hazards
The river: Water 88 × 5 m along the gorge (0, −4, 0). Two pools before each pair of waterfall walls
(±16, −1, ±45.9). Falls into the gorge (4 m) from the banks; no traps placed.

## Scenario pieces
Four Portcullis doors (style `portcullis`, start open) in the Carved Temples' gates; twelve warm flickering
lights (torch light) by the terrace stairs and the temple fronts; four vine ladders out of the gorge.

## Props (130)
Jungle Ruins refresh props (`jt_*`): plant clusters (20), fire bowls (12), teal and red banners, obelisks,
altars, small and large temple guardians, pottery, planters, rope and chain rails, tree trunks, a root arch,
hanging braziers, spires, sarcophagi, rubble, collapsed and broken columns, a spike row, wooden platforms,
overgrown beams, zipline posts and a crane on each side. Earlier jungle props: giant ferns, vine curtains,
banana plants, waterfalls (under the waterfall walls' spouts); tall palms.

## Screenshot viewpoints
`screenshots/`: MapMaker overview with the Jungle Ruins pack picked (`mapmaker-overview.jpg`); the pack palette
(`mapmaker-pack-palette.jpg`); in play: the gorge and its bridges (`view-gorge-bridges.jpg`), a temple gate
(`view-temple-gate.jpg`), a waterfall wall (`view-waterfall.jpg`), the ziggurat (`view-ziggurat.jpg`). Map card:
`packages/client/public/maps/shots/vinefall_sanctum.jpg`.
