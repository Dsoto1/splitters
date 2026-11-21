# Sandfall Colosseum: implementation manifest

| | |
|---|---|
| Map | `maps/sandfall_colosseum.json` (id `sandfall_colosseum`, "Sandfall Colosseum": id, name and description kept) |
| Source | The owner's brief `BRIEF.md` (2026-11-05) and `reference/` (the Flavius Rule board, its seating chart, Pollice Verso for mood) |
| Author / date | Tile Trigger, rebuilt in MapMaker 2026-11-08 (branch `wip/mapmaker-sandfall`) |
| Status | Part 1: the playable build (structures, routes, modes, spawns, pickups). See "Progress" and "Left" |
| Players | 12 v 12 (Map's pick), 8-24 recommended |
| Modes | Team Deathmatch, Capture the Flag (gates 3/4 against gates 1/2), King of the Hill (the five medallions), Deathmatch (offered again 2026-11-09) |
| Octagon | 2026-11-15: the corners rebuilt as Arena Corners (Gate) in MapMaker (OCTAGON_PLAN.md, "Phase 4: as built"); the rows below marked (octagon) changed |
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
| Sand (the board's 13 × 13 at 4 m; octagon: its corner squares under the new podiums) | cells −3..3 less the corner cells (±3, ±3), level 0 | 29 Courtyard tiles, the four hatch halls' Corner Hatch tiles (16) |
| Pillars (12) | (0, ±24), (±24, 0), (±16, ±16), (±8, ±8) m | Ionic Column ×1.6 (2.1 m thick, 9.6 m tall) |
| Hatches (4) | the cell corners (±12, ±12) m | Hatch Riser (Corner): a 2 × 2 hall under each, a ladder up |
| Medallions (5) | (0, 0), (0, ±12), (±12, 0) m | the King of the Hill hills (radius as placed) |
| Beast pit (red zone) | the centre | spike floors (−6, 2), (6, −2); fire jets (−2, 6), (2, −6) |
| Stands (octagon: three lines a side, x or y = −1..1) | four sides × 3 radial lines, depth 4-10 | per line: Arena Bay (Podium) d4 L0; Grand Arcade d6-d9 L0, d8-d9 L2; Upper Tier d6 L2; Upper Tier / Vomitorium (even lines) d8 L4; Grand Arcade facade d10 L0, L2, L4; Arena Attic d10 L6 |
| Corners and gates 1-4 (octagon) | an Arena Corner (Gate) anchored on each sand corner cell (±2, ±2): 1 SE, 2 SW, 3 NW, 4 NE | the 45° stands, their galleries, the gate passage from the sand out through the facade and the gatehouse tower (lookout 32 m), stair wells to the hypogeum, podium stairs either side of the gate; the portcullis is the map's Gate N door |
| Emperor's box | north stand, centre line (0, 4) | the podium bay exploded, its seating swapped for the Emperor's Box tile |
| Outer courts (4; octagon) | the triangles outside the diagonal facades | open ground round each gatehouse tower |
| Hypogeum (level −1) | ring under the podiums (cells ±4), the centre crossing, the four halls, connectors at cells ±3 | Hypogeum Tunnel / Junction / Crossing; Cage Blocks north (0, 6..7), south (0, −6..−7), east (5..6, 0): the beasts; west (−6..−7, 0): the gladiators' cells |
| Ways out of the hypogeum | north (0, 11), south (0, −11) into the main square's approach, east (11, 0), west (−11, 0); (octagon) the two stair wells off each gate passage, into the ring's corners (±4, ±4), now Vaulted Tunnel Crossings | Open Stairs in cuts; the corners' wells |
| Village | 16 insulae in rows round the ring street (cells 13-14 out), the main square south (x −4..4, y −13..−18) | Insula, Insula (Tall), Insula (Corner); Triumphal Arch (0, −13), Forum (−1, −16), Temple (0, −18), Colonnades along both sides |

## Spawns
- (Octagon, 2026-11-15) Embers (north): four on each of the gate 3/4 passages, (±37.48, 0, 37.48), (±43.84, 0, 43.84),
  (±49.5, 0, 49.5), (±53.2, 0, 53.2), facing the sand; two in each north outer court, (±52.5, 0, 78) and (±78, 0, 52.5).
  12. Tide (south): mirrored, 12.
- Shared: the main square (0, 0, −110), the east and west streets (±100, 0, ±24), the north street (0, 0, 104), the ring
  tunnel (±32, −4, ±8).

## Progress
- 2026-11-08: map cleared in MapMaker (Import, drag-box Delete on levels −1..2, the old rules deleted), terrain created,
  the sand's ground flattened; the four stands (the north one placed line by line, then selected, duplicated, turned and
  moved for the other three), the E/W end lines back to podium bays, the four stair towers, the emperor's box; the
  hypogeum, the sand and its pillars built in a scratch map and brought in as saved set pieces (MapMaker's Save
  selection as set piece), placed and exploded; the stairs out and their cuts; the village the same way; the boundary
  and backdrop; the spawns; the flags, hills, traps and pickups.
- 2026-11-09: the sand found a level high (a saved piece's frame starts at its lowest entity: the hall lights) and
  lowered a level (Shift+PgDn) with its pillars; the stairs out turned to climb out (Open Stairs climb east as placed);
  the ground over the whole hypogeum flattened to −1.5 m and paving over the ring's corners (the nav audit had the
  ring cut off); 16 legion standards on the podium walls; the ring street in gravel, the square paved, grass and the
  foliage layer past the village; Map properties: TDM (CTF, KotH offered), 12 v 12, 8-24 players.

## QA (2026-11-09)
- `pnpm validate-map maps/sandfall_colosseum.json`: OK (0 issues). Nav audit: 0 traps, 0 errors (islands: the void
  under the stands and the insulae's flat roofs, nobody gets in). Z-fight audit (zfight.test.ts): passes.
- bot-report, 24 bots, 240 s (load 9 on 4 cores): TDM seed 1 embers 65 · tide 61 (131 kills, stuck recoveries 311,
  spawn deaths 0.8%); seed 2 40 · 45 (157 stuck; where: the hatch halls under the ladders (12, −4, 8), (−16, −4, −12),
  the gate passage (−24, 0, −60)); CTF seed 1 tide 3 caps (743 stuck, frozen 8.1%, ladder idles 4%); KotH seed 1 tide
  75 · embers 10 (537 stuck).
- Bench (server tick, 24 bots, TDM, load 13): avg 3.9 ms, p95 10.3 ms of 16.7.
- perf96 (24 bots, medium, SwiftShader under load, so frame times mean nothing here): draws 170 (spread) / 408
  (clump: in the stands), triangles 0.7 M / 2.6 M, shadow casters 5 / 158 (the hypogeum's pieces), lights 3 shown.
- Card shot: `packages/client/public/maps/shots/sandfall_colosseum.jpg` (capture-map-shots, 33 KB, the aerial from the
  west the tool chose).

## Left
- The tunnels' sides: the Vaulted Tunnel pieces have no side walls, so where the ground is pulled down under a tunnel
  its earth banks show along the sides (a cut, not masonry). A side wall option for the tunnel tiles would fix it.
- Bots linger at the hatch ladders (the stuck spots above).
- Lights are at 253 of 256 (the stands' bay lights): braziers on the sand need lights freed first.
- The owner's questions (the report).

## Follow-ups (2026-11-09)
- **Stands:** the arcades under the tiers gone on all four sides (gate lines kept) and the east and west facades;
  "Stand fill" Sky Blocks (limestone): N/S under the low tiers (0, 0, ±52) 40 × 8 × 16 m, under the high tiers
  (0, 0, ±68) 40 × 16 × 16; E/W under the low tiers (±52, 0, 0) 16 × 8 × 56, under the high tiers (±68, 0, 0)
  16 × 16 × 56, outer walls (±80, 0, 0) 8 × 24 × 56.
- **Gates 1-4:** Portcullis doors "Gate 1" (24, 0, −29), "Gate 2" (−24, 0, −29), "Gate 3" (−24, 0, 29), "Gate 4"
  (24, 0, 29), starting raised; buttons "Gate N winch" (in the passage, 2.5 m back) and "Gate N chain" (on the sand);
  eight rules "Button pressed: Gate N winch/chain" → Toggle door, Play sound (buzzer).
- **Tunnels:** Vaulted Tunnel (Side Walls) at (0, ±10) and (±10, 0), level −1.
- **Hatch ladders** turned to face the other way (tops onto the sand).
- **QA (2026-11-09, load 15-20 on 4 cores):** validate-map OK (0 issues); nav audit 0 traps, 0 errors (islands as
  before); zfight.test.ts and stylePacksAncient.test.ts pass. Collision boxes 22,240. bot-report, 24 bots, 240 s:
  TDM seed 1 embers 80 · tide 55 (136 kills, stuck 160, spawn deaths 0), seeds 2/3 (before the ladder fix) 38 · 36 and
  28 · 33; CTF seed 1 embers 7 · tide 0 (7 captures, stuck 223); King of the Hill seed 1 embers 70 · tide 0 (hill
  held 70 s, stuck 98); Deathmatch seed 1 275 kills, spawn deaths 11%. Stuck spots left: the court stairs down into the
  hypogeum ((±36, −2, ±36), (−28, −2, −40)). Bench (24 bots, TDM, 60 s): CPU 3.85 ms a tick (p95 9.45) of 16.7.
  Card shot redone (capture-map-shots: the aerial from the west).

## Octagon (2026-11-15, phase 4; OCTAGON_PLAN.md "Phase 4: as built")
- In MapMaker: the stands' end lines, the corner courts' Stair Towers, platforms and court stairs and the sand's corner
  cells deleted; an Arena Corner (Gate) placed at each diagonal (its own portcullis unticked); Gates 1-4, their winches
  and chains moved to the diagonals (rules unchanged); the ring's corners made Crossings; the fill blocks shortened to
  24 m; spawns and six pickups moved; description and card camera set.
- **QA:** validate-map 0 issues; nav audit 0 traps, 0 errors (islands: as before, plus the middle gallery ring, which
  has no way in); stylePacksAncient and zfight pass. Collision boxes 22,240 → 17,900; lights 253 → 245. Bots and bench:
  see the plan's "Phase 4: as built".
