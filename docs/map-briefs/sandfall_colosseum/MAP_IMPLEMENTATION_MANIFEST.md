# Sandfall Colosseum: implementation manifest

| | |
|---|---|
| Map | `maps/sandfall_colosseum.json` (id `sandfall_colosseum`, "Sandfall Colosseum": id, name and description kept) |
| Source | The owner's brief `BRIEF.md` (2026-11-05) and `reference/` (the Flavius Rule board, its seating chart, Pollice Verso for mood) |
| Author / date | Tile Trigger, rebuilt in MapMaker 2026-11-08 (branch `wip/mapmaker-sandfall`) |
| Status | Part 1: the playable build (structures, routes, modes, spawns, pickups). See "Progress" and "Left" |
| Players | 12 v 12 (Map's pick), 8-24 recommended |
| Modes | Team Deathmatch, Capture the Flag (gates 3/4 against gates 1/2), King of the Hill (the five medallions), Deathmatch |
| Weapon set | Medieval |

## World
- Terrain 320 × 320 m, vertices 2 m apart (161 × 161), x −160..160 (east), z −160..160 (north); dirt at −0.15 m.
  Standard grid: 8 m cells (cell (x, y) centred on world (8x, 8y)), 4 m levels; the arena's centre is the origin.
- Under the sand (±26 m) the ground is flattened to −1.5 m, within 3 m of the hypogeum's floors (−4 m), so MapMaker
  and the game pull it down under them (settle.ts `terrainUnderFloors`) and the four hatches open through to the halls.
  The eight stairs out of the hypogeum stand in cuts flattened to −4.4 m.
- Boundary: invisible walls, x −148..148, z −158..148. Backdrop: clear sky, "Hills and a volcano" (new scenery, the
  volcano far to the north behind the emperor's box), dirt beyond, no border.

## Layout (cells; levels of 4 m)
| What | Where | Pieces |
|---|---|---|
| Sand (the board's 13 × 13 at 4 m) | cells −3..3, level 0 | 33 Courtyard tiles, the four hatch halls' Corner Hatch tiles (16) |
| Pillars (12) | (0, ±24), (±24, 0), (±16, ±16), (±8, ±8) m | Ionic Column ×1.6 (2.1 m thick, 9.6 m tall) |
| Hatches (4) | the cell corners (±12, ±12) m | Hatch Riser (Corner): a 2 × 2 hall under each, a ladder up |
| Medallions (5) | (0, 0), (0, ±12), (±12, 0) m | the King of the Hill hills (radius as placed) |
| Beast pit (red zone) | the centre | spike floors (−6, 2), (6, −2); fire jets (−2, 6), (2, −6) |
| Stands | four sides × 7 radial lines, depth 4-10 | per line: Arena Bay (Podium) d4 L0; Grand Arcade d6-d9 L0, d8-d9 L2; Upper Tier d6 L2; Upper Tier / Vomitorium (even lines) d8 L4; Grand Arcade facade d10 L0, L2, L4; Arena Attic d10 L6 |
| Gates 1-4 | the end lines of the south (1 east, 2 west) and north (3 west, 4 east) stands, x = ±3 | Gladiator Gate tile at d4 and a Grand Arcade at d5: a passage from the sand out under the stands to the facade |
| Emperor's box | north stand, centre line (0, 4) | the podium bay exploded, its seating swapped for the Emperor's Box tile |
| Corner towers (4) | x = ±4, y = ±8..±10 | Stair Tower (8 levels): stairs to every level of the stands, a lookout 32 m up |
| Corner courts (4) | x, y = ±4..±10 (less the towers) | open ground between the stands; a stair down to the hypogeum in each |
| Hypogeum (level −1) | ring under the podiums (cells ±4), the centre crossing, the four halls, connectors at cells ±3 | Hypogeum Tunnel / Junction / Crossing; Cage Blocks north (0, 6..7), south (0, −6..−7), east (5..6, 0): the beasts; west (−6..−7, 0): the gladiators' cells |
| Ways out of the hypogeum | north (0, 11), south (0, −11) into the main square's approach, east (11, 0), west (−11, 0); the four courts (±4, ±5) | Open Stairs in cuts |
| Village | 16 insulae in rows round the ring street (cells 13-14 out), the main square south (x −4..4, y −13..−18) | Insula, Insula (Tall), Insula (Corner); Triumphal Arch (0, −13), Forum (−1, −16), Temple (0, −18), Colonnades along both sides |

## Spawns
- Embers (north): gate 3/4 passages (±24, 0, 44..68), the north courts (±56, 0, 64), (±68, 0, 48): 11, facing south.
- Tide (south): mirrored, 12, facing north.
- Shared: the main square (0, 0, −110), the east and west streets (±100, 0, ±24), the north street (0, 0, 104), the ring
  tunnel (±32, −4, ±8).

## Progress
- 2026-11-08: map cleared in MapMaker (Import, drag-box Delete on levels −1..2, the old rules deleted), terrain created,
  the sand's ground flattened; the four stands (the north one placed line by line, then selected, duplicated, turned and
  moved for the other three), the E/W end lines back to podium bays, the four stair towers, the emperor's box; the
  hypogeum, the sand and its pillars built in a scratch map and brought in as saved set pieces (MapMaker's Save
  selection as set piece), placed and exploded; the stairs out and their cuts; the village the same way; the boundary
  and backdrop; the spawns; the flags, hills, traps and pickups.
