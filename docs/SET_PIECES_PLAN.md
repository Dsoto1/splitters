# Set pieces: plan (owner-approved queue item, 2026-11-05)

Set pieces are multi-cell structures placed as one: a carriageway through a college hall, an enclosed skybridge, a
bunker cluster, a loading dock. They are data, made from MapMaker's own pieces, and they re-theme with the style
packs. Several maps queued after this one depend on them: MAP 21 Omaha beach assault, the Sandfall Colosseum
rebuild and the Whiteout Station rebuild (see HANDOFF.md, "Owner's map notes for later").

The owner's decisions, from HANDOFF's agreed queue:
- **Data:** set pieces are data, with a footprint, levels, parts, props, FX and door markers. They rotate, mirror
  and re-theme by style pack.
- **MapMaker:** a "Save selection as set piece" action and a "Set pieces" palette tab.
- **Placement:** a set piece is placed **as one piece**, **and** offers **"Explode to tiles"**. The owner confirmed
  both.
- **First family:** the **carriageway / pend**. The owner's photo shows Collegiate Gothic stone, a shallow segmental
  arch underpass, doors into both buildings from the passage, and the second floor crossing over the arch. Also an
  enclosed **skybridge**. Place one of each in St. John's.
- **Then the brainstorm list:** power core hall, catwalk bridge, twin-stair overlook, atrium tower, loading dock,
  sunken arena, reactor room, bunker cluster, courtyard gate, server vault, crossroads plaza, multi-level ramp
  junction.
- **Old big pieces are retired.** Where a set piece replaces an old monolithic multi-cell tile, retire the tile from
  the palette but keep it loadable.

## Rules that frame the design
- CLAUDE.md "Maps": every map is a `maps/<id>.json`, made with MapMaker's tools. There is no one-off code per map:
  a piece a map needs goes into MapMaker.
- **Maps are declarative data** (docs/MULTIPLAYER_DIRECTION.md). A set piece is data too: no scripts, only
  in-house asset IDs.
- **The tile, geometry and collision pipeline stays the single source of truth.** A set piece expands into ordinary
  tiles, blocks, props, doors and lights. Collision, navigation, the flicker clipping (`visibleFaces`), level
  merging, the shadow cache, validate-map and the server all see the expanded parts and need no special cases.
- **Tiles as data** (`content/tiles/*.json`) and style packs are the vocabulary. A set piece references tiles,
  edges, materials and props by ID.

## Proposed design

### Definitions: `content/setpieces/<family>.json`
Each file holds a family, e.g. `carriageway.json` with a 2-, 3- and 4-cell-wide variant. A definition has:
- **Identity:** `id` (`setpiece.carriageway_3`), `displayName`, `family`, `category`, and `packs`, the style packs it
  suits.
- **`footprint`:** its cells (dx, dy) and its levels (dz min..max). This is what it claims on the grid.
- **`parts`:**
  - ordinary tile placements: `tile`, `dx`, `dy`, `dz`, `rotation`, `edges`, `glass`, `surfaces`, `options` and
    `upperFloors`, all in the set piece's own frame;
  - free blocks (box size and position, material role);
  - props (`prop.*` or `env.*`, transform, variant);
  - doors, ladders and lights;
  - optional logic markers, e.g. door pairs.
- **Material roles instead of fixed materials,** where re-theming should change them: `stone`, `trim`, `floor`,
  `roof`, `glass`.
  - A style pack maps roles to its own materials and facades (e.g. Collegiate Gothic = limestone, slate, oak).
  - Placement may override the pack.
- **`mirror`:** `free`, or `none` when a piece can't be mirrored, e.g. an asymmetric tile without a mirrored twin.
- **`ports`:** where it connects, i.e. the doors and openings on its outside. MapMaker can show them and check
  connections, as tiles' ports do today.

### Placements in the map: `setPieces` (map format v27)
- Each entry: `id`, `piece`, `x`, `y`, `z`, `rotation`, `mirror`, `pack?`, `overrides?`.
- Overrides are small per-placement tweaks: a role's material, or hiding a part by index.
- **Expansion:** at load, every placement expands deterministically into tiles, blocks, props and so on, with stable
  derived IDs (`sp_<placementId>_<partIndex>`), before geometry, collision and nav are built.
- **Doc size:** the doc stores only the placement, so it stays small, and the 4,096-entity cap counts placements,
  not expanded parts.
- **Older maps** load unchanged (migration from v26 adds nothing).
- **Validation:**
  - the footprint can't overlap tiles or other set pieces (`checkPlacement` learns about set pieces);
  - expanded parts are validated like hand-placed ones;
  - budgets count the expanded parts.

### MapMaker
- **"Set pieces" palette tab:** thumbnails from the palette atlas pipeline, filtered by the current style pack.
- **Place:**
  - a ghost of the whole piece, green or red with a reason;
  - turn it with R and mirror it with M, the same as tiles;
  - the pack picker re-themes the ghost.
- **Select:** a placement selects as one, with a gizmo, delete and undo. The inspector shows the piece, pack, mirror
  and overrides.
- **"Explode to tiles":** replaces the placement with its expanded parts as ordinary, editable entities. One undo
  step undoes it.
- **"Save selection as set piece":**
  - Select tiles, blocks and props in a box. It writes a set-piece definition: footprint and parts relative to the
    selection's anchor, with materials turned into roles where a pack mapping matches.
  - A **player** saves it to their local set-piece library, in the same browser storage as their maps, with export
    and import.
  - The **owner** exports the JSON for `content/setpieces/` to ship it officially, the same way official maps are
    files.
- **Ports:** the outline shows the ports, and a warning appears when a port faces a wall.

### Runtime
Expanded parts are ordinary map pieces, so nothing else changes:
- the server sees the same expanded geometry, built from the same shared code;
- bots navigate through it;
- the flicker clipping and level merging apply to it.

## As built: part 1 (data, expansion, first content; 2026-11-06)
Part 1 is the shared code, the data and the first pieces; part 2 wires them into MapMaker. How to add a piece:
docs/CONTENT_PIPELINE.md, "Set pieces". What the design settled while it was built:
- **Role packs are data:** `content/setpieces/roles.json`, 13 packs keyed by id, each with the themes it is the default
  for (a theme has one pack at most). Roles: `stone`, `trim`, `floor`, `paving`, `roof`, `wood`, `metal` (a library
  material and tint), `facade`, `door` (a door style) and `glass` (`breakable`, `reinforced` or `none`). A placement
  takes a role from its overrides, else its pack (its own, else the map theme's), else the piece's own `roles`, else
  the theme paints it. **Collegiate Gothic** (`collegiate`, the default for Castle Keep, St. John's theme) is in the
  materials St. John's halls are built of: grey lannonstone walls (Grey Stone Blocks #d9d5cb), dressed limestone trim
  (#d8d3c6), granite setts under the arches, oak floors, doors and beams, slate roofs, the Gothic stone facade
  (battlements). A pack facade has its own cladding (Gothic stone: Mossy Castle Stone #9a9aa4), so a facaded room's
  outside wears that, not the stone role.
- **Ids:** a placement's id is at most 48 characters, so its parts' ids (`sp_<id>_<index>`, at most 1024 parts) stay
  StableIds (64). The shipped pieces are `setpiece.<name>`; a map's own (`setPieceDefs`, saved from a selection) are
  `local.<name>`, so it plays anywhere.
- **Mirror:** in place over the footprint (east and west swapped: dx → W − dx), then the turn. A tile mirrors only onto
  itself (`tileMirrorAxis`: its cells, ports, default edges and parts are their own mirror image), so a piece with one
  that isn't (stairs) says `mirror: "none"`; no mirrored twins were needed for Phase 1.
- **Budgets:** the file's caps count what it stores (a placement is one `setPieces` entry, at most 1024). The map as
  played (hand-placed pieces and parts together) holds at most 4096 tiles, 4096 entities and 2 MB of JSON, the
  schema's own caps: it is what a joining player's welcome carries and every client loads it again. Validation and
  the budgets see the expanded map; issues on a part name its placement.
- **New kit pieces** (usable by any map, not only set pieces): the edge style **`arch_segmental`** (a 5 m shallow
  segmental arch, springing 2.7 m, crown 3.3 m; collision stepped over the curve, never below it; voussoirs and a
  keystone on the inner face, and on the outer face where nothing is built beyond; a soffit) and the room ceiling
  **`vault`** (a segmental barrel vault along the room, springing at 3.02 m just over the doorways' heads and rising to
  3.29 m under a 4 m level's floor, its strips
  colliding; a beam where a side can't carry it; two dressed-stone ribs a cell, trim only).
- **First content:** `setpiece.carriageway_1` (one cell wide) and `setpiece.carriageway_2` (two, on a central column),
  each a vaulted passage with a segmental arch at both ends, a door into the building on each side, and a room over
  the arch with windows both ways; `setpiece.skybridge_2`, `_3` and `_4` (2-4 cells, an enclosed bridge with twin
  windows down both sides, a roof, a door at each end, nothing below; place it on level 1 or 2, its ports at its own
  level).
- **Shared API for part 2** (`@tiletrigger/shared`): `expandSetPieces`, `setPieceParts`, `setPieceFootprint`,
  `setPiecePorts`, `placementPack`, `builtInSetPieces`, `checkSetPieceDefinition`, `parseSetPiece`; editor commands
  `checkSetPiecePlacement`, `placeSetPieceCommand`, `updateSetPieceCommand`, `moveSetPieceCommand`,
  `rotateSetPieceCommand`, `mirrorSetPieceCommand`, `deleteSetPieceCommand`, `explodeSetPieceCommand`,
  `addSetPieceDefCommand`, `setPieceFromSelection`; `Selection.setPieces` in the generic move, turn, duplicate and
  delete; `checkPlacement` and `checkLayout` know footprints. `setPieceFromSelection` takes any selection of tiles,
  blocks, props, doors, ladders and lights (and placed pieces, as their parts) and the expansion gives back ordinary
  parts: the MapMaker overhaul's groups can reuse both.

### Retired by Phase 1: none
No Phase-1 piece truly replaces an old monolithic tile, so none leaves the palette. Checked: **Town Gate**
(`medieval.town_gate`, 3 × 1 × 3) and **City Gate** (`desert.city_gate`, 3 × 1 × 2) are gatehouses with town wall,
wall-walks, wall stairs and towers, not a passage under a building; **Catwalk Gantry** (`military.gantry`) is open
stairs up to a catwalk, not an enclosed bridge; **Timber Walkway** (`medieval.walkway`) is an open walkway on posts;
**Harbour Arch**, **Triumphal Arch** and **Temple Pylon** are monuments. For later phases:
- a **gatehouse / courtyard gate** family (gate tower over a passage, wall sections either side with their stairs, a
  guard room, towers per pack) would cover `medieval.town_gate`, `desert.city_gate` and `egypt.pylon`;
- the brainstorm's **catwalk bridge** (stairs and a railed catwalk) would cover `military.gantry`;
- the **loading dock** and **bunker cluster** may cover `core.warehouse`, `core.bunker` and `snow.hangar`, if the
  owner wants buildings as set pieces at all (they work as tiles).
Each is retired (out of the palette, still loadable, like `RETIRED_PROPS`) only once its piece is in.

### St. John's (part 2)
St. John's is block-built (2,480 blocks, 736 props, no tiles; halls turned 0.5-2.4°). **Recommendation: place pieces on
the grid and fit the blocks round them in MapMaker** (move, resize or delete the neighbouring blocks), not a fine
offset and yaw:
- set pieces are tiles first (rooms, the arch edge, the vault): their collision, ports, edge resolution, facades and
  room options all live on the 8 m grid and its quarter turns. A free offset or yaw would need a second geometry path
  for tiles, or the arch and vault rebuilt from blocks, against "one source of truth, no special cases";
- the site fits: the **Argonne Gate** (docs/references/ST_JOHNS.md: 1940, castellated lannonstone, Tudor arch, a 5 m
  passage between Knight Hall and Welles Hall on Exeter St, at about (9, −78)) takes `setpiece.carriageway_1` at cell
  **(1, −10)** (x 4 to 12, z −84 to −76), unturned: its passage runs north from Exeter St to the drill field, its arch
  is 5 m wide, and its west side meets Knight's east wall at x ≈ 4 (Knight is turned 2.4°: under 0.34 m of wedge over
  8 m). Its south arch stands on the line of the gate built now (the Gothic arch prop and gatehouse blocks at z ≈ −84),
  which goes (cell (1, −11) instead would bring the south arch to the street front, 2 m proud of the halls' faces at
  z ≈ −90); the 6.5 m from its east side to Welles's west wall (x ≈ 18.5) becomes the gate's east tower in blocks;
  doors into Knight and Welles need doorways cut in their block walls;
- a skybridge needs two halls whose upper floors face each other 16-32 m apart along a grid axis, with doorways cut in
  their block walls at its ports;
- pieces made only of free parts with a fine offset and yaw are what the MapMaker overhaul's **groups** are for (same
  selection and expansion code, no grid): the tool for yawed, block-only compositions.

## As built: part 3 (the showpiece maps' pieces; 2026-11-06)
Part 3 is the pieces MAP 21 (Omaha beach assault) and the Sandfall Colosseum rebuild are built from, and the kit they
needed. It is all data (`content/setpieces/`, `content/tiles/`) on the standard grid, with no change to the map format;
part 2 (MapMaker) places these pieces like part 1's. How to add a piece: docs/CONTENT_PIPELINE.md, "Set pieces".

### The 4 m question: decided (the mix, no format change)
The owner set 4 m per board square for the colosseum, but every tile is built for 8 m cells (`TILE_DIMENSIONS`, the
edge styles, room options, facades and collision all assume it) and set pieces refuse any other grid
(`setpiece.grid`). A second, 4 m geometry path would break "one source of truth, no special cases". So:
- **The colosseum is built on the standard 8 m / 4 m grid.** A board square is half a cell: two squares to a cell,
  every square's centre on the 4 m lattice (a cell centre, the middle of a cell side, or a cell corner).
- **Tiles where an 8 m module fits:** the stands (arena bays, Grand Arcades, stair towers), the hypogeum's tunnels and
  cages, the insulae, the arena floor (open ground).
- **Free parts where it must be 4 m:** the board's pillars (Ionic Column props), the medallions and the zone markings
  (blocks and props) go straight onto the 4 m lattice; free parts already sit anywhere in a piece's frame or the map.
- **Pieces that must centre on a board square come in two variants:** centred on a cell (Hatch Riser, Lift-Cage Riser:
  the Arena Hatch tile) and centred on a cell corner (Hatch Riser (Corner): four Corner Hatch tiles, each a quarter of
  the 3.2 m hole, turned round the corner they share). With the board centred on a cell, its four hatches (two squares
  diagonally out from the inner red zone's corners, at ±12 m) all fall on cell corners.
- **The floor:** 13 squares are 52 m, 6.5 cells. Build the sand 7 cells (56 m) across and lay the 52 m board in it
  centred on a cell, a 2 m margin of sand to the podium wall all round ("about 52 m"). Its centre square, the four
  quadrant corners and the gates' corner squares (±24 m) land on cell centres; the hatches on corners.
- **No format change was needed.** If the map builds want a piece placed half a cell off its grid (a free-part piece
  at a 4 m offset), the smallest change is an optional placement offset for pieces with no tiles; not needed for any
  piece here.

### The trench and the terrain: decided (sunk; the trench carves its own slot)
Trenches are **sunk** 1.5 m, not raised: on load and on every MapMaker edit the terrain under a floor is lowered to
just under it (settle.ts `terrainUnderFloors`, within 3 m), so the Sunken Trench tiles carve their slot with no
brushwork. Each is its own ground: earth slabs at the level's floor from the channel to the cell edge, a buried carve
floor 0.3 m inside the cell edge under all of it (so the terrain under the whole trench goes below the channel, while at
the cell edge it stays just under the earth slabs and the ground outside meets them without a step or a gully). Place
them on level 0 over ground at level 0 and flatten bumpy ground there first. They need terrain: on a map without terrain
the ground is drawn at the lowest floor (under the trench); flat maps keep the Military Compound's raised trenches
(berms on the ground). Cover: standing in the channel your head is under the 0.6 m sandbag parapet; on the fire step
(0.75 m up) your eyes clear it by 0.25 m; crouched in the channel you are hidden from all round, crouched on the step
from the front. Fire steps stop 0.8 m short of a cell's ends so every join has the whole 4 m channel clear (a bay
turned round, the far side of a bend): bots' paths run on through every join.

### Pieces (34, eight families)
| Family (file) | Pieces | Notes |
|---|---|---|
| Casemate (`casemate.json`) | Gun Casemate (2 × 3), Cliff Casemate (1 × 3) | Embrasure south between flanking walls under a canopy; the gun room, ammunition room (slit, side door), hall (rear door) and crew room make a loop: two ways in, no dead ends. The cliff one looks out through a rock cave mouth (Mines & Caves Cave Entrance, CC0) and has a sally port; bury it in the cliff with the terrain tools. A field gun of blocks behind each embrasure. |
| Trench run (`trench.json`) | Trench, Bend, Junction, End, Jog (round a traverse), each timber or `_sandbag` | Sunken Trench tiles: fire steps, revetment (the walls slot: the wood role, or Sandbags), duckboards, sandbag parapet and parados. |
| Cliff stairs (`cliffstair.json`) | Grand Cliff Stair (2 × 4, two levels), Cliff Stair Tower (2 × 1, three levels) | The grand one: two 15.2 m flights, a landing and a terrace with sandbag and barrier cover, stackable at its terrace. The narrow one: a concrete tower of switchback stairwells with firing slits. |
| Arena stands (`arena.json`) | Arena Bay (Podium), Arena Bay (Upper Tier), Arena Bay (Vomitorium), Grand Arcade, Arena Attic | One cell wide, the arena to the local south. See "The stands" below. |
| Hypogeum (`hypogeum.json`) | Hypogeum Tunnel, Bend, Junction, Crossing; Hatch Riser; Hatch Riser (Corner); Cage Block; Lift-Cage Riser | Barrel-vaulted tunnels with groin vaults at junctions; ladders up through the hatches (nav links for bots); pens with Barred gate fronts and Portcullis doors. For a cage that rises, hide the cage prop and add a Lift Cage (Scenario palette). |
| Insulae (`insula.json`) | Insula, Insula (Corner), Insula (Tall) | 3 × 2 cells: shops on the street either side of the entrance passage, a stair hall with a landing on every floor, flats over; tiled roofs (two) or a flat roof (the tall one, four storeys). |
| Stair towers (`stairtower.json`) | Stair Tower (4, 6 and 8 levels) | 3 × 1: stairwells either side of a hall with a landing on every level and round arches out north and south on each. |
| Landing craft (`landing.json`) | Beached Landing Craft (2 × 2) | The owner's Drive landing craft (prop Landing Craft (Beached), `prop.lcvp_beached`: Meshy community, CC0 per owner; collides as voxels) run up on the sand with its ramp down (local north), beach obstacles, crates and a baulk round it. Static (owner, 2026-11-06): cover to fight from, up the ramp into the well and over the gunwales. The prop is in the Military Compound and Coastal Harbor style packs. |

**The stands.** A bay is one cell wide along the arena's side. Stack a radial line like this (cells from the arena's
edge, levels from the sand): Podium bay at (0, 0) rising to 8 m; a Grand Arcade under each cell of the next tier
(two storeys each); an Upper Tier (or a Vomitorium bay) two cells back and two levels up (8 to 16 m), and the next
two further on (16 to 24 m); the facade's Grand Arcades up the outermost cell, the Attic on top. Six storeys: podium,
two tiers, six arcades under them, three up the facade and the attic (13 placements a line); repeat the line along the
sides (MapMaker's duplicate). Grand Arcades set their arches on the part: two of them side by side would otherwise
meet with doorways (ports meeting make a doorway; a tile's default edge only shows on a side nothing meets).

### New kit (any map; MapMaker offers it now)
- **Edge styles:** Round arch (`arch_round`: 3.2 m, a semicircle springing at 1.4 m to 3 m, just under a vaulted
  ceiling's springing), Grand arch (`arch_grand`: two storeys, 4.4 m, springing 4.6 m, crown 6.8 m, piers 0.8 m,
  half columns and an entablature outside), Embrasure (`embrasure`: a 3.5 × 1.1 m gun port in a 1 m wall, a visor and
  stepped cheeks outside), Barred gate (`bars_gate`: bars either side of a 3 m gateway for a Portcullis door).
- **Material:** Sandbags (`core.sandbags`, our own procedural paint: bags 0.6 × 0.3 m in stretcher bond).
- **Tiles:** Sunken Trench, Bend, Junction, End; Grand Flight (2 cells wide, one level); Seating Tier and Seating Tier
  (Vomitorium); Vaulted Tunnel, Bend, Junction, Crossing; Grand Gallery (two storeys); Corner Hatch.
- **Kit code:** a kit part's own surface now dresses every box its builder makes (timber steps), not only plain boxes.

### Budgets (one piece as expanded; theme of its first pack)
Tiles, blocks and lights count against MAP_BUDGETS (1,500 tiles, 3,000 blocks, 256 lights, 300 active pieces); the
boxes are merged into the level's meshes by material (draws stay a few per material), so what they cost is triangles,
physics shapes and the navmesh build. Shipped maps run 2,700-3,900 collision boxes (St. John's 3,915, Sandfall
Colosseum 3,087).

| Piece | Pack | Tiles | Blocks | Props | Lights | Doors | Ladders | Collision boxes | Trim boxes | Materials |
|---|---|---|---|---|---|---|---|---|---|---|
| Arena Bay (Podium) (`arena_bay_podium`) | imperial | 3 | 0 | 0 | 1 | 0 | 0 | 79 | 82 | 7 |
| Arena Bay (Upper Tier) (`arena_bay_tier`) | imperial | 3 | 0 | 0 | 1 | 0 | 0 | 99 | 98 | 4 |
| Arena Bay (Vomitorium) (`arena_vomitorium`) | imperial | 3 | 0 | 0 | 1 | 0 | 0 | 119 | 108 | 4 |
| Grand Arcade (`arena_arcade`) | imperial | 1 | 0 | 0 | 0 | 0 | 0 | 51 | 102 | 3 |
| Arena Attic (`arena_attic`) | imperial | 1 | 0 | 0 | 1 | 0 | 0 | 6 | 18 | 6 |
| Gun Casemate (`casemate`) | military | 4 | 12 | 6 | 4 | 2 | 0 | 56 | 75 | 6 |
| Cliff Casemate (`casemate_cave`) | military | 2 | 7 | 7 | 2 | 3 | 0 | 40 | 47 | 6 |
| Grand Cliff Stair (`cliff_stair_grand`) | military | 6 | 3 | 6 | 0 | 0 | 0 | 129 | 40 | 6 |
| Cliff Stair Tower (`cliff_stair_side`) | military | 5 | 0 | 0 | 2 | 2 | 0 | 133 | 152 | 6 |
| Hypogeum Tunnel (`tunnel_straight`) | imperial | 1 | 0 | 0 | 1 | 0 | 0 | 13 | 1 | 3 |
| Hypogeum Tunnel Bend (`tunnel_bend`) | imperial | 1 | 0 | 0 | 1 | 0 | 0 | 24 | 2 | 3 |
| Hypogeum Tunnel Junction (`tunnel_junction`) | imperial | 1 | 0 | 0 | 1 | 0 | 0 | 24 | 2 | 3 |
| Hypogeum Tunnel Crossing (`tunnel_cross`) | imperial | 1 | 0 | 0 | 1 | 0 | 0 | 25 | 3 | 3 |
| Hatch Riser (`tunnel_hatch`) | imperial | 2 | 0 | 0 | 1 | 0 | 1 | 14 | 16 | 4 |
| Hatch Riser (Corner) (`tunnel_hatch_corner`) | imperial | 5 | 0 | 0 | 1 | 0 | 1 | 24 | 24 | 5 |
| Cage Block (`cage_block`) | imperial | 4 | 0 | 4 | 2 | 2 | 0 | 132 | 60 | 3 |
| Lift-Cage Riser (`cage_lift`) | imperial | 2 | 0 | 1 | 1 | 0 | 1 | 15 | 16 | 5 |
| Insula (`insula`) | imperial | 16 | 11 | 4 | 3 | 1 | 0 | 258 | 557 | 8 |
| Insula (Corner) (`insula_corner`) | imperial | 16 | 12 | 4 | 3 | 1 | 0 | 267 | 588 | 8 |
| Insula (Tall) (`insula_tall`) | imperial | 21 | 3 | 4 | 3 | 1 | 0 | 344 | 750 | 8 |
| Beached Landing Craft (`landing_craft_beached`) | military | 0 | 0 | 6 | 0 | 0 | 0 | 141 | 0 | 1 |
| Stair Tower (4 levels) (`stair_tower_4`) | imperial | 11 | 1 | 0 | 3 | 0 | 0 | 444 | 780 | 8 |
| Stair Tower (6 levels) (`stair_tower_6`) | imperial | 15 | 1 | 0 | 4 | 0 | 0 | 614 | 1048 | 8 |
| Stair Tower (8 levels) (`stair_tower_8`) | imperial | 19 | 1 | 0 | 5 | 0 | 0 | 784 | 1316 | 8 |
| Trench (`trench_straight`) | military | 1 | 0 | 1 | 0 | 0 | 0 | 11 | 9 | 5 |
| Trench (Sandbags) (`trench_straight_sandbag`) | military | 1 | 0 | 1 | 0 | 0 | 0 | 11 | 9 | 5 |
| Trench Bend (`trench_bend`) | military | 1 | 0 | 0 | 0 | 0 | 0 | 18 | 9 | 5 |
| Trench Bend (Sandbags) (`trench_bend_sandbag`) | military | 1 | 0 | 0 | 0 | 0 | 0 | 18 | 9 | 5 |
| Trench Junction (`trench_junction`) | military | 1 | 0 | 0 | 0 | 0 | 0 | 15 | 10 | 5 |
| Trench Junction (Sandbags) (`trench_junction_sandbag`) | military | 1 | 0 | 0 | 0 | 0 | 0 | 15 | 10 | 5 |
| Trench End (`trench_end`) | military | 1 | 0 | 0 | 0 | 0 | 0 | 17 | 5 | 5 |
| Trench End (Sandbags) (`trench_end_sandbag`) | military | 1 | 0 | 0 | 0 | 0 | 0 | 17 | 5 | 5 |
| Trench Jog (`trench_jog`) | military | 3 | 0 | 0 | 0 | 0 | 0 | 47 | 27 | 5 |
| Trench Jog (Sandbags) (`trench_jog_sandbag`) | military | 3 | 0 | 0 | 0 | 0 | 0 | 47 | 27 | 5 |

A full colosseum of these pieces (24 bay lines of six storeys, four 8-level corner towers, the hypogeum, 15 insulae):
about 800 tiles, 200 blocks and 190 lights (inside the budgets; lights are the tightest: leave the arcades unlit, as
they are), and about 25,000 collision and 30,000 trim boxes, several times any shipped map. The map build should
measure load time and frame time early (PERF_96) and drop what it can: the attic or a storey of arcades round the far
sides, the Roman facade on the stair towers (`overrides.roles.facade: "none"`).

### Notes for part 2 (MapMaker)
- Pieces with `mirror: "none"` (bends, ends, jogs, stairs, towers, insulae, hatch and lift risers): turn them instead.
- Footprints claim every level from their least to their greatest for every cell (the trench pieces claim level -1
  too); the stands stack because each piece's levels stop where the next begins.
- `maps/test_coverage.json` should get one of each new piece through the palette, and `coverageMap.test.ts` require
  them (as noted for part 1's pieces).
- `setPiecePlay.test.ts`'s every-port test now covers every piece whose ports are walled doorways or arches and
  names the open-sided ones; `setPieces3.test.ts` proves those (trenches, the grand stair, the stands, tunnels, hatches,
  cages).

### Left for later, and for the owner
- **Sea wall section (and its breach) and the command bunker** (MAP 21 landmarks): not built in part 3. The sea wall
  is a short family (a concrete wall with a walkway and a curved wave lip, a breached variant with a rubble ramp); the
  command bunker a multi-room casemate (the Gun Casemate's rooms and doors are the pattern).
- **The landing craft:** the owner's Drive model (Meshy community, CC0 per owner) is the prop Landing Craft (Beached)
  (`prop.lcvp_beached`, 16k triangles, a 4k LOD from 40 m). It is a possible swap for Shingle Point's kit Landing
  Craft: the owner compares the two in the maps; nothing is swapped. Its community page URL is still to come from
  the owner (content provenance says "pending").

## Phase 1 (this task)
1. **Schema and expansion** (shared): definitions, the format v27 `setPieces` field, the expansion, overlap checks
   and validation.
   - Unit tests for each rotation × mirror × pack.
   - Determinism: the same IDs every load.
   - Collision and nav built from the expansion equal those built from the exploded map.
   - The zfight audit stays at 0 over maps with set pieces.
2. **MapMaker:** the palette tab, placing, selecting, the inspector, Explode, and Save selection, with the local
   library plus export and import. Add e2e checks in editorux.
3. **First content:**
   - **Carriageway family:** a passage width of one cell and of two cells.
     - A shallow segmental stone arch at each end.
     - A vaulted or beamed passage ceiling.
     - A door from the passage into the building on each side.
     - Floors above crossing the arch.
     - New kit pieces where tiles-as-data lacks them: a segmental arch edge style, a passage vault, Gothic
       stone/trim roles for the Collegiate Gothic look.
   - **Enclosed skybridge:** spans 2–4 cells at level 1 or 2, with windows and doors at both ends meeting the
     buildings' upper floors.
4. **St. John's:** place one carriageway and one skybridge where the real campus suits them, through MapMaker. The
   St. John's references are in docs/references/ST_JOHNS.md.
5. **Retire old big pieces** that a set piece now covers. List each one; keep it loadable; take it out of the palette.

The pieces MAP 21 and the colosseum need (casemate, trench run, cliff stair, arena arcade bay, vomitorium, tunnel
junction, cage block, insula, stair tower) are done: "As built: part 3" above. The brainstorm list, MAP 21's sea wall
and command bunker follow in later phases.
