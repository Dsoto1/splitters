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

## As built: part 2 (MapMaker; 2026-11-06)
How to use it: docs/BUILDING_KIT.md, "Set pieces". MapMaker keeps the placements in its document and draws, picks and
checks the map as played (`viewDoc`: `expandSetPieces`, cached per document version); every edit is a shared command
with undo (part 1's API, plus `editor/setPieceEdit.ts`).
- **The Set pieces tab** (`paletteCatalog.ts`, pane `setpieces`): one card per piece with its picture from the palette
  atlas (`public/thumbs/setpieces.<hash>.webp`, rendered by `build-palette-atlas.mjs` in the piece's first pack;
  `palette-items.ts` hashes the definition, the pack, its tiles and its props' models), grouped by family, searchable
  by name, and narrowed by the Style Pack picker to the pieces whose packs suit it. My set pieces (the local
  library) are a group of their own. The set pieces' code is its own chunk (`setPieceLibrary-*.js`), out of the menu.
- **Placing:** the ghost is the whole piece in its real materials (a transform node of its expanded parts, rebuilt
  only when the piece, turn, mirror or pack changes), green or red with `checkSetPiecePlacement`'s reason in the tip.
  R turns, M mirrors; a piece that can't be mirrored says why (`setPieceMirrorRefusal`: `mirror: "none"`, or the
  tile that isn't its own mirror image) and leaves the ghost as it was. PgUp/PgDn the level. The look picker in the
  panel over the tab re-themes the ghost: the map theme's pack, the packs the piece is made for, then every other.
- **Selecting:** a click on any part selects its placement (`partOf`); with Select, a drag from empty ground draws a
  box that selects the tiles, entities and pieces in it (Shift adds). Move, turn, mirror, duplicate (Ctrl+D) and
  delete go through the generic commands, which know `Selection.setPieces`. The inspector: piece, look, mirror, place,
  the ports with their state, a material per role for this piece only, and a tick box per part (untick to leave it
  out: `overrides.hide`).
- **Explode to tiles:** one command (`explodeSetPieceCommand`): one undo puts the placement back.
- **Save selection as set piece:** name it; `setPieceFromSelection` writes the definition (materials of the map's
  look become roles, so it re-themes) and the dialog says what it holds; it goes into **My set pieces**, the local
  library (`cs.setpieces` in localStorage, `editor/storage.ts`, 64 at most, next to the maps), with JSON export and
  import. Placing one puts its definition in the map (`setPieceDefs`), so the map plays anywhere. The owner's export
  writes the file for `content/setpieces/<family>.json` (`setpiece.<name>`, the shipped form).
- **Ports:** the ghost and the selected piece draw each port on their outline (blue a door, green an opening), red
  where something stands in it, grey where the piece's own wall shuts it (an auto side the piece walls itself).
  `setPiecePortStates` probes 0.25 m out from the side, across the opening and at 0.5, 1 and 1.5 m; a port facing a
  wall is a warning in the issues list naming the wall ("Skybridge (2 cells): the door on the south side (Level 1)
  faces a wall (a block (Grey Stone Blocks)): open it, or move the piece"); clicking it selects the piece.
- **Fixes found on the way:** MapMaker's overlaps warning (`coplanarSpots`) takes the expansion's `partOf`, so a set
  piece's parts against each other are one piece (the insula's floors met its stairwells in 138 places on the
  coverage map: nothing an author could move); `withTerrainUnderFloors` sees set pieces' floors (a sunk trench
  carves its slot when placed, in the same undo step, as loading does: before, an exported map changed on load and
  said "changed since it was exported"; since 2026-11-07 MapMaker writes no carve into the map at all and draws the
  ground under floors worked out from the ground as made, as loading does); the Gothic and Collegiate stone facades' plinth runs under the wall and
  stops at doorways (it crossed a skybridge's door ends). The other pack facades still draw their ground band across
  doorways: a change to their look, left for the owner.
- **Coverage map:** one of every set piece (39), placed in MapMaker from the tab: the trenches and the landing craft on
  the ground band at grid rows 8-9 (they carve the terrain), the rest in a gallery past the terrain's south edge (the
  scenery zone). `coverageMap.test.ts` requires each piece and its parts as played.

### St. John's (as built)
Edited in MapMaker, driving the real editor (Playwright; the driver is a scratch script, not committed): the Set pieces
tab and a click on the cell for each piece; Select, the toolbar's Delete, Ctrl+D and the inspector's fields for the
blocks; Settle on ground for the moved tree; Export for the file. Checked on the exported file: validate-map (clean),
the z-fight audit (0), MapMaker's overlaps (69 spots before and after, none new), the navigation as the match builds
it with the audit (no findings; two new islands nobody reaches, the closed rooms over the arch and in the tower),
spawns, objectives and logic (unchanged), and bots walking each way in a match (below).
- **The Argonne Gate:** `setpiece.carriageway_1` at cell (1, −10), level 0, unturned, in St. John's pack (Collegiate
  stone facade on the room over the arch; the shallow vault): x 4 to 12, z −84 to −76, a 5 m passage from Exeter Street
  north to the drill field. The old gate (the Gothic arch prop, the beam over it with its trim and merlons: blocks
  1734-1736 and 1739-1744) and two bushes in the passage's way went. Knight's east wall stood 0.4 m into the cell:
  thinned to 0.6 m on its own west face, a doorway cut where the carriageway's west door is, its old doorway north of
  it (now behind the carriageway's wall) walled up, its string courses cut back to the face. East of the carriageway,
  the 6.5 m to Welles's west wall is the gate's **east tower** in Welles's stone: two storeys, its door from the
  passage's east door, a door north onto the drill field, a floor at 4 m, a window on Exeter Street like the
  carriageway's beside it (1.9 by 1.6 m, its sill at 4.9 m), a roof under the carriageway's parapet and merlons (the
  carriageway's corner pinnacles stand clear of them); no face of it in the plane of the carriageway's.
- **The skybridge:** `setpiece.skybridge_2` at cell (6, −2), level 1, unturned: x 44 to 52, z −20 to −4, over Church
  Street between DeKoven's north end and Smythe's south end, the only pair of halls whose upper floors face each
  other along a grid axis at a span the skybridges take (DeKoven−Smythe 24 m; Scott Johnston−Knight is blocked by
  their corner towers, the others don't face each other). The halls' fronts stand 3.5 m (DeKoven) and 4.4 m (Smythe)
  off the bridge's ends, so a short covered link of blocks joins each end to a doorway cut in each hall's first floor
  (DeKoven at 4.74 m, Smythe at 4.5 m): Welles's stone walls, a slate roof, floors stepping 0.25 m at a time down to
  4.25 m. Inside the bridge a floor at 4.25 m runs its length, level with both links' last steps: King of the Hill
  counts anyone within a hill's radius and up to 3.5 m over its floor, and Church Street's hill (`hill_2938`, 5 m, on
  the street by the bridge's south end) reaches 4.04 m, so on the bridge's own 4.0 m floor a player in its south end
  held the hill from inside (about 10 m² of it). A street tree under it moved 4 m east and was settled on the ground.
- **Bots** (a match, one bot sent each way as an order goal): Exeter Street to the drill field through the passage and
  back (5.5 s each), the passage into Knight by the new door and back, the passage through the east tower to the drill
  field, and DeKoven's first floor to Smythe's over the bridge and back (about 10 and 7 s, at 4.27-4.76 m).
- **Pitfall found on the way (MapMaker), fixed since (2026-11-07, HANDOFF "MapMaker's ground under floors"):** every
  edit lowered the ground under every level floor (`withTerrainUnderFloors`, gone now) and never raised it back, so a
  big floor moved field by field lowered the ground under each place it passed through. A copy of Welles's 56 m ground
  slab, squared up and then moved before it was cut down to the tower's paving, lowered the ground along Knight's
  whole front by 0.7 m (a bush left floating; that run was thrown away). MapMaker now keeps the ground as made and works
  out the ground under floors from it after every edit, as loading does: no workaround needed.

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
meet with doorways (ports meeting make a doorway; a tile's default edge only shows on a side nothing meets). The
board's stands are straight, two sections a side, with dark towers over the gates at the four corners, so the bays
run straight and the corners are Stair Towers (8 levels). The Round Arcade tiles (one storey of 3.2 m arches on a
quarter circle) don't fit that plan; they suit the village (a curved portico round its square).

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
- `maps/test_coverage.json` has part 3's kit (placed in MapMaker: the 13 new tiles in the empty rows at grid y -3
  and -15, the four new wall styles on a Room and the Grand Gallery, the Landing Craft (Beached) prop at (40, 0, 60)),
  so its test passes. It should still get one of each set piece through the new palette, and `coverageMap.test.ts`
  require them (as noted for part 1's pieces).
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

## As built: part 4 (MAP 21's fort and gatehouse; 2026-11-07)
Iron Coast's two missing pieces (docs/map-briefs/MAP_21_Iron_Coast.md: the round fort at the head of the village,
Breakthrough's last line, and the gate on the grand stair), all data on the standard grid with the kit they needed.
The sea wall is still to come.

| Piece | Family (file) | Footprint | Packs | What it is |
|---|---|---|---|---|
| Command Bunker (`setpiece.command_bunker`) | Fort (`fort.json`, new) | 4 × 4 cells, levels 0-1 | military, harbor, snow | A round fort 31.6 m across round a square keep. The ring is four **Fort Ring** quarters: a wall 1.6 m thick and 3.6 m high, its middle 15 m from the fort's centre, firing slits at eye height all round. Gates south-west, south-east and north-west (**Fort Ring Gate** quarters: a gateway 4.4 m wide between two piers, 3 m clear under the lintel, a slit either side), the north-east quarter whole: turn the piece so its gates face the attack. The north-west gate opens where the courtyard is narrowest (2.9 m to the keep's corner), so nobody sees straight in. The keep (2 × 2 cells) is the **command room** on the ground (15 m of floor each way under its ceiling; two doors south, one west; firing slits west, east and north): room for a final hold (6 m round its middle stays inside it and under its ceiling), a map table and chairs, ammunition. Over it the **radio room** (north-west quarter: doors onto the terrace south and east, windows north and west, a desk and the sets in crates) and a **roof terrace** behind parapets that sees over the ring, sandbags at its corners. The **roof stair** (16 steps of 0.25 × 0.5 m, 2 m wide) climbs east along the keep's north wall from the courtyard by the north-west gate to a 3.5 m landing beside the terrace's open corner. Lit: four ceiling lights in the command room, one in the radio room, a bulb in each gateway. Markers: `command_room`, `radio_room`, `gates`, `keep_doors`. |
| Grand Cliff Stair (Gatehouse) (`setpiece.cliff_stair_gate`) | Cliff stairs (`cliffstair.json`) | 2 × 4 cells, levels 0-3 (as the Grand Cliff Stair, one level more for the gate) | military, harbor, imperial, medieval, desert, jungle | The Grand Cliff Stair as it is (the same flights, landing, terrace and bases, one for one, so it swaps in for it) with a gatehouse on its landing between the flights: the landing's head is a twin **Gate arch** (two arches 5 m wide and 5.7 m to the crown on a central pier 3 m wide, in two storeys of wall 1.2 m thick on each side of the line, so the gateway is 2.4 m deep, crenellated at 12 m), the landing's sides **High walls** (8 m) instead of parapets, and a pier 1.4 m wide at each end of the gate rising over the battlements, with a lamp on each. The landing's sandbags stand 1 m further back to clear the gate. A squad still climbs abreast: four to each arch. Mirrors freely, like the stair. |

**New kit (any map; MapMaker offers it):** the tiles **Fort Ring (Quarter)** (`core.fort_ring`) and **Fort Ring Gate (Quarter)**
(`core.fort_ring_gate`): a quarter of a round fort's wall (1.6 m thick, 3.6 m high, four firing slits; the gate's with
a gateway in its middle), round the corner of the cell it leaves free, so four turned round a 2 × 2 keep make a ring
31.6 m across; any keep or courtyard can go in the middle. The edge style **Gate arch** (`gate_arch`, "Gate arch (2 storeys)"): the twin gate as a
wall style any cell side can carry (two storeys high, 1.2 m thick on each side).

**Budgets** (one piece as expanded; collision boxes are the tiles' and blocks' own, measured as the Grand Cliff Stair's
139 today):

| Piece | Pack | Tiles | Blocks | Props | Lights | Doors | Ladders | Collision boxes | Trim boxes |
|---|---|---|---|---|---|---|---|---|---|
| Command Bunker (`command_bunker`) | military | 9 | 18 | 11 | 8 | 3 | 0 | 343 | 239 |
| Grand Cliff Stair (Gatehouse) (`cliff_stair_gate`) | military | 6 | 7 | 6 | 2 | 0 | 0 | 239 | 148 |

**Tests** (`setPieces4.test.ts`): the fort is a ring 31.6 m across in the Military Compound and Coastal Harbor
looks; a standing player fits all the way in through each gate in every turn (headroom checked every 0.2 m), the
whole quarter stops them, and a player walks in through the south-west gate to the keep; bots path in through every
gate to the command room, up the stair to the roof terrace and into the radio room; the command room has 15 m of
floor between its walls each way under its ceiling (a final hold fits); shots go out through the slits at eye height
and stop on the wall above and below, and from the terrace the guns see over the ring. The gatehouse is the Grand
Cliff Stair part for part with its gate; players climb both flights through the arches to the terrace in every turn
and mirror; bots path up through the gate from anywhere along the foot; shots pass both arches and stop on the
central pier and the flanking walls, and nobody leaves the landing sideways; each piece builds what its exploded
parts build (collision, trim, navigation). The generic set piece tests cover both too (every turn, mirror and pack
expands clean, z-fight audit 0); `setPiecePlay.test.ts` lists them as open-sided (their ports are gateways and
stair heads, not doorways) and its z-fight layout spaces pieces 8 cells apart for the 4 × 4 fort.

**In maps:** the Breakthrough Range (`maps/test_breakthrough.json`, an ordinary map since 2026-11-07) has both, placed in MapMaker (the
fort the last sector, its command room the final hold; the gatehouse stair a lookout over the guns), and so does the
coverage map (`maps/test_coverage.json`, whose test requires every shipped set piece).

**For the owner:** Rapier's character controller can stall on a single big flat merged floor box at some spots
(walking a character through every gate in every turn stopped short on the fort's paving at a few positions, with
headroom and rays clear there), so the gate tests check a standing player's room every 0.2 m instead and walk one
real way in. Worth a look if a player ever reports a stuck spot on a big flat floor.

## As built: part 5 (the brainstorm list, retiring old pieces, MAP 21's sea wall; 2026-11-08)
All data on the standard grid (`content/setpieces/<family>.json`), built from kit tiles, blocks, props, doors and
lights; MapMaker's Set pieces tab places them (each family a group). No map format change.

### The twelve pieces (14 placements: the catwalk bridge comes in three lengths)
| Piece | Family (file) | Footprint | Mirror | What it is |
|---|---|---|---|---|
| Power Core Hall (`power_core_hall`) | `powercore.json` | 3 × 3, levels 0-1 | free | Nine Tall Rooms open to each other: a hall 24 m square and 8 m high on eight columns round a glowing core (blocks round the ninth column: plinth, drum, Glow Trim ribs, cap; two terminals). A gallery 4.5 m deep all round at 4 m (blocks, railed), two block flights up to it through gaps in the rail; doors in the middle of each side on the ground and onto the gallery east and west. |
| Catwalk Bridge (Up) / (3 cells) / (4 cells) (`catwalk_bridge_2/_3/_4`) | `catwalk.json` | 1 × 2-4, levels 0-1 | none | Open Stairs climbing north to Bridge decks (3 m, railed) on level 1 over open ground, steel legs and cross-beams under each deck; the longer ones have stairs down at the far end. The 2-cell one is the Catwalk Gantry's footprint, levels and ways in. |
| Twin-Stair Overlook (`twin_stair_overlook`) | `overlook.json` | 3 × 1, levels 0-1 | none (symmetric) | A platform 4 m up between two open stairs: a half wall north to fight over (sandbags behind it), a railing south, an arched passage under it. |
| Atrium Tower (`atrium_tower`) | `atrium.json` | 3 × 2, levels 0-3 | none | Two Atriums stacked (balconies all round, a stair in each), a lobby, offices up the east side, and a Stairwell joining the lower atrium's balcony (level 1) to the upper atrium's floor (level 2): every floor reached. |
| Loading Dock (`loading_dock`) | `loadingdock.json` | 3 × 2, level 0 | free | Three Terraces make the apron and a 1 m dock edge with three sets of steps; an open-fronted shed of three Rooms with a block floor 1 m up, so the dock runs straight in; a truck on the apron, cargo on the dock. |
| Sunken Arena (`sunken_arena`) | `sunkenarena.json` | 3 × 3, levels -1-0 | none (symmetric) | A pit 14 m square 2 m down, three 0.5 m tiers on every side and a stair of 0.25 m steps down the middle of each; low walls, pillars and crates on its floor. New kit tiles (any map): **Arena Pit**, **Arena Tiers**, **Arena Tiers (Corner)**, every box a floor, so on terrain they carve their own hollow (as the sunken trenches do). |
| Reactor Room (`reactor_room`) | `reactor.json` | 3 × 2, levels 0-1 | none | The Reactor Hall tile with the Reactor Core prop, an airlock (a Corridor with a blast door outside and a sliding door in), a pump room, and over them a control room looking down on the hall through armoured glass, its door onto the hall's catwalk. |
| Bunker Cluster (`bunker_cluster`) | `bunkercluster.json` | a cross of 5 cells, level 0 | free | Three roofed bunkers with slits on three sides (the look's facade) and a door each onto a sandbagged yard; a Courtyard (Low Wall) as the way in. |
| Courtyard Gate (`courtyard_gate`) | `courtyardgate.json` | 3 × 1, levels 0-1 | none | A gatehouse: the carriageway's vaulted passage under a segmental arch at each end, a stair tower (Stairwell) west and a guard room east with doors off the passage, the gate room over the arch, a door out east onto a wall-walk on level 1. |
| Server Vault (`server_vault`) | `servervault.json` | 2 × 2, level 0 | free | A lobby with a vault door, a guard post behind armoured glass, a server floor of two open rooms with four rack banks, a fire exit. |
| Crossroads Plaza (`crossroads_plaza`) | `plaza.json` | 3 × 3, levels 0-1 (the lamps) | none | An Intersection and four Streets, a paved square a kerb up on each corner with planter walls along the streets (waist-high cover, a gap at the corner), a bench and a lamp. |
| Ramp Junction (`ramp_junction`) | `rampjunction.json` | 3 × 2, levels 0-2 | none | Two Long Ramps winding up round a railed junction deck on level 1 to a head on level 2; under the deck an arched passage, under the upper ramp a corridor out west. |

**Ports and the tests.** The walled ones (power core hall, atrium tower, reactor room, courtyard gate, server vault)
go through `setPiecePlay.test.ts`'s every-port test (shots and walks through each door and arch, every turn and
mirror); the rest have open sides and `setPieces5.test.ts` walks them: for every piece, in every turn (and mirror
where it may be mirrored), bots path along chains of points through every way in, **up both ends of every climb**
(the hall's gallery stairs, the catwalk and overlook stairs, the atrium's floors and stairwell, the reactor hall's
catwalk and the control room, the gate's stair tower, both ramps, the arena's stairs) and into each room; players
walk up the stairs and ramps. The every-port test now judges whether a piece is walled by its own walls with nothing
built beyond (an open tile's side is no wall at all), not with rooms built against it.

### Budgets (one piece as expanded, in its first look)
| Piece | Look | Tiles | Blocks | Props | Lights | Doors | Ladders | Collision boxes | Trim boxes |
|---|---|---|---|---|---|---|---|---|---|
| Power Core Hall (`power_core_hall`) | orbital | 9 | 49 | 2 | 6 | 6 | 0 | 171 | 152 |
| Catwalk Bridge (Up) (`catwalk_bridge_2`) | military | 3 | 6 | 0 | 0 | 0 | 0 | 28 | 2 |
| Catwalk Bridge (3 cells) (`catwalk_bridge_3`) | military | 4 | 6 | 0 | 0 | 0 | 0 | 46 | 4 |
| Catwalk Bridge (4 cells) (`catwalk_bridge_4`) | military | 6 | 12 | 0 | 0 | 0 | 0 | 56 | 4 |
| Twin-Stair Overlook (`twin_stair_overlook`) | military | 4 | 0 | 2 | 1 | 0 | 0 | 48 | 15 |
| Atrium Tower (`atrium_tower`) | neon | 9 | 0 | 1 | 6 | 4 | 0 | 357 | 436 |
| Loading Dock (`loading_dock`) | military | 6 | 5 | 7 | 3 | 0 | 0 | 44 | 19 |
| Sunken Arena (`sunken_arena`) | imperial | 9 | 6 | 2 | 0 | 0 | 0 | 111 | 0 |
| Reactor Room (`reactor_room`) | orbital | 5 | 0 | 7 | 5 | 5 | 0 | 151 | 123 |
| Bunker Cluster (`bunker_cluster`) | military | 5 | 0 | 8 | 3 | 3 | 0 | 78 | 216 |
| Courtyard Gate (`courtyard_gate`) | medieval | 5 | 4 | 0 | 4 | 3 | 0 | 134 | 301 |
| Server Vault (`server_vault`) | neon | 4 | 0 | 7 | 4 | 4 | 0 | 46 | 68 |
| Crossroads Plaza (`crossroads_plaza`) | suburban | 9 | 12 | 8 | 0 | 0 | 0 | 42 | 34 |
| Ramp Junction (`ramp_junction`) | military | 8 | 0 | 0 | 2 | 0 | 0 | 95 | 126 |
| Sea Wall (`sea_wall`) | military | 0 | 13 | 1 | 0 | 0 | 0 | 15 | 0 |
| Sea Wall (Breached) (`sea_wall_breach`) | military | 0 | 23 | 0 | 0 | 0 | 0 | 23 | 0 |

All well inside MAP_BUDGETS; the z-fight audit over every piece in every turn, mirror and four looks stays at 0.

### Retiring the old big pieces
`content/setpieces/aliases.json` lists a retired tile and the piece that replaces it; the piece must cover exactly the
tile's cells and levels unturned (checked by `tools/content/setpieces.mjs`). A retired tile:
- leaves MapMaker's Tiles tab, but stays in the catalog: every map that places it still loads;
- **plays as its piece** (`map/setPieceAliases.ts` `withTileAliases`, in loadMap as played: the placement becomes the
  piece at the same cell, level and turn, its id the tile's own where it fits in 48 characters), so a saved or
  shipped map upgrades on load; serialized, that map names the piece;
- in MapMaker stays as made (forEditing); its inspector offers **Replace all N with …**
  (`replaceTilesWithSetPieceCommand`, one undo step; Export then writes the piece).
Not a format change: no field is added.

| Old piece | Replacement | Maps that place it | Done |
|---|---|---|---|
| Catwalk Gantry (`military.gantry`, 1 × 2 × 2) | Catwalk Bridge (Up) | iron_compound (1) | **Retired** and aliased: the same cells, levels and ways in (stairs from the south up to a railed deck 4 m up on legs, meeting the level above at its north end, open ground under it). Its stair is 4 m wide (the gantry's 2.4 m) and its deck 3 m (2.4 m); Iron Compound plays it from load. Its file still names the gantry: owner question 1. |
| Town Gate (`medieval.town_gate`, 3 × 1 × 3), City Gate (`desert.city_gate`, 3 × 1 × 2), Temple Pylon (`egypt.pylon`, 3 × 1 × 3) | Courtyard Gate (3 × 1 × 2) | market_town, qasr_medina, pharaohs_reach, sunken_kingdom | **Parked** (owner question 2): the old gates carry wall-walks, wall stairs and towers a level higher; the Courtyard Gate is a gatehouse with rooms. A swap changes their routes and height. |
| Warehouse (`core.warehouse`), Vehicle Hangar (`snow.hangar`) | Loading Dock | blackout, crossroads, iron_maw, shingle_point; whiteout_station | **Parked**: two-storey buildings, not an open dock shed. |
| Bunker (`core.bunker`, 2 × 1) | Bunker Cluster | 12 maps | **Parked**: a single bunker is a basic kit piece, the cluster is five cells. |
| City Crossroads (`city.crossroads`, 4 × 4) | Crossroads Plaza (3 × 3) | neon_spire, riot_junction, underdrain | **Parked**: a different size. |
| Reactor Hall (`orbital.reactor_hall`), Atrium (`core.atrium`) | — | | Kept: the Reactor Room and Atrium Tower are built *from* them. |

### MAP 21: the sea wall and its breach (`seawall.json`; for Iron Coast, not placed there)
- **Sea Wall** (`setpiece.sea_wall`, 1 cell, level 0, mirrors freely; packs military, harbor, snow): an 8 m bay, the sea
  to the local south: a footing, a concrete wall 3.4 m high and 1.6 m thick, a stepped wave lip on the sea face, a
  fire step 2 m up and 2 m deep behind it (eyes at 3.6 m clear the top by about 0.3 m: shots go out to sea over it),
  a stair up to it from the land side at the east end, sandbags. From the beach a player walks into it (up onto the
  footing at most) and chest-high shots stop on it. Bays line up east to west (ports east and west).
- **Sea Wall (Breached)** (`setpiece.sea_wall_breach`): the same bay blown open: the wall, lip and fire step kept
  either side of a gap 4.4 m wide, a rubble mound through the gap in 0.25 m steps (players and bots walk straight
  through from the beach to the land side, no jump), torn reinforcing at the broken ends and a fallen slab; the east
  stub keeps its stair. Ports on all four sides.
- Free blocks only, on the standard grid, so bays line up; flatten the beach's top under them first. The Iron Coast
  session places them (main hands them over).

## As built: part 6 (swapping the old big pieces on the maps; 2026-11-09)
The owner (2026-11-08): "fix em all": every old big piece that has a set-piece version is swapped on every map that uses
one, through MapMaker. Iron Compound stays as it is (its Catwalk Gantry plays as the bridge already).
- **MapMaker:** every tile's inspector has **Replace all with a set piece…**: pick any piece; every placement of the
  tile becomes it at the same cell, level and turn, one undo step (`replaceTilesWithSetPieceCommand`; a retired tile
  offers its replacement first). The old tiles stay in the palette.
- **New piece: Town Wall Gatehouse** (`setpiece.courtyard_gate_wall`, Courtyard gate family): the Town Gate as a set
  piece in its place (3 × 1 cells, levels 0-2, medieval): Town Wall tiles either side, a vaulted passage 5 m wide
  under segmental arches (the Town Gate's 4 m), the guard room over it open by arches onto both wall-walks, a roof behind
  a parapet up a ladder through a hatch in its north-east corner (as the Town Gate's). The plain Courtyard Gate would
  have cut the west walk (its stair tower fills level 1 there).
- **Market Town:** its Town Gate is the gatehouse (Replace all in MapMaker); the map's old roof ladder went (the piece
  has its own) and its portcullis moved 1.5 m onto the south arch. The exported map validates clean, no coplanar
  overlaps; the walks, the passage, the guard room and the roof all reach each other both ways (30 of 30 routes).
  Bot report (CTF, seeds 1-2, 240 s), before → after: stuck 121 → 127 a match, failed searches 0.01 → 0.00 %, two routes
  or more 75 → 75 % of team trips, busiest route 60 → 54 %, captures 2 → 1 (two matches: noise).
- **New piece: Bunker** (`setpiece.bunker`, Bunker cluster family; owner: "a 2 × 1 single-bunker set piece that matches
  the old Bunker tile"): two Rooms open to each other, the Bunker tile's doorways (west, east, south), slits elsewhere,
  roofed in the look's facade, its centre pillar and sandbag cover as blocks.
- **The swaps** (owner's answers of 2026-11-09: Bunker → Bunker, Warehouse → Loading Dock, City Crossroads → Crossroads
  Plaza with the gap filled), all in MapMaker (Replace all, then MapMaker's own commands for the follow-ups):
  - **Iron Maw:** 2 Warehouses → Loading Dock (the four pickups that stood on the warehouse mezzanine and its floor now
    stand on the dock floor, 1 m up), 2 Bunkers → Bunker.
  - **Shingle Point:** 1 Warehouse → Loading Dock (its six lights, 7.1 m up under the warehouse roof, moved to 3.3 m
    under the dock's), 4 Bunkers → Bunker.
  - **Neon Spire, Riot Junction, Underdrain:** City Crossroads (4 × 4) → Crossroads Plaza (3 × 3); the one-cell ring it
    leaves (seven cells) is filled with Platforms (open ground, no walls, as the crossroads was). Riot Junction leaves
    out the plaza's benches and lamps (the inspector's part ticks), so it stays under its prop-model budget; its pickup on
    the plaza's corner moved up onto the kerb (0.15 m). Underdrain's two spawns stand on the fill.
  - Every changed map validates with no issue (beyond "changed since it was exported" in MapMaker before the export) and
    no coplanar overlap, and every route from the first spawn to every spawn, pickup, hill and flag and back is as before
    (Iron Maw 320 of 320, Shingle Point 148 of 148, Riot Junction 218 of 218, Underdrain 178 of 178; Neon Spire 110 of 136
    before and after: its first hill is on a roof).
  - **Bot reports** (seeds 1-2, 240 s; Iron Maw, Riot Junction and Underdrain CTF, Shingle Point and Neon Spire TDM),
    before → after: stuck a match Iron Maw 55 → 62, Shingle Point 93 → 101, Neon Spire 41 → 35, Riot Junction 254 → 199,
    Underdrain 60 → 57; failed searches 0.00 % everywhere; two routes or more 100 % of team trips everywhere. Riot Junction
    over seeds 3-6: captures 2 → 4, stuck 197 → 362 a match, almost all of it at its old hot spot (cells 19, 14, a
    block off the plaza: 155 → 695, most in one seed), the plaza's own cells a handful either way.
- **New piece: City Wall Gatehouse** (`setpiece.city_gate_wall`, Courtyard gate family, desert): the Town Wall
  Gatehouse with City Wall tiles either side, for the City Gate (`desert.city_gate`).
- **New piece: Temple Pylon** (`setpiece.temple_pylon`, Courtyard gate family, desert and imperial): the Temple Pylon
  tile (`egypt.pylon`) in its place, the same cells and levels (3 × 1, levels 0-2): three Platforms for its floor and the
  tile's own towers, gate lintel, stairs, gilding and reliefs as 54 blocks in their own materials (a relief 2 cm proud is
  5 cm here: a block is at least 5 cm deep). Through the 3.2 m gate; up either back stair to the terrace 4 m up and over
  the gate. Explode it to edit the masonry.
- **The Environment Phase 2 maps** (released to this session 2026-11-09, after origin/main was merged), in MapMaker:
  - **Blackout:** Warehouse → Loading Dock (the generator, the Set the charges button and the pickup from the warehouse's
    upper floor onto the dock floor, 1 m up; its six lights to 3.3 m; the dock's own lights left out, the map's stand in
    the same places), Bunker → Bunker (its encounter point off the centre pillar, 2.5 m east and 1 m south).
  - **Crossroads:** Warehouse → Loading Dock with the dock's own crates, barrels and lights left out (the map's shelves,
    containers and boxes on the dock floor, the two hostages and the pickup from the mezzanine onto it, the mezzanine's
    barrels and crates too; one snack shelf that had no room left deleted; a cargo crate 1.6 m west, clear of the
    truck), Bunker → Bunker.
  - **Pharaoh's Reach, Sunken Kingdom:** Temple Pylon → Temple Pylon set piece (1 and 2); the pickups on the terraces
    stay where they were.
  - **Qasr Medina:** City Gate → City Wall Gatehouse; the portcullis onto the south arch (it stood across the passage,
    along it); the yard south of the gate and the rope bridge north of it give the passage's sides to the gatehouse's
    arches (No wall), as Market Town.
  - Every one validates with no issue and no coplanar overlap, and every route from the first spawn to every spawn,
    pickup, hill, flag, hostage, bomb site and button and back is as before (Blackout 36 of 36, Crossroads 96 of 96,
    Pharaoh's Reach 92 of 92, Qasr Medina 132 of 132, Sunken Kingdom 224 of 224).
  - **Bot reports** (seeds 1-2, 240 s; Blackout and Crossroads TDM, the others CTF), before → after: stuck a match
    Blackout 34 → 35, Crossroads 39 → 43, Pharaoh's Reach 103 → 108, Qasr Medina 101 → 92, Sunken Kingdom 121 → 121
    (no bot goes near its pylons); failed searches 0.00 % everywhere (Qasr Medina 0.03 → 0.02 %); two routes or more
    100 % of team trips everywhere; captures Pharaoh's Reach 1 → 1, Qasr Medina 2 → 1 (two matches: noise).
  - **Sunken Kingdom's CTF captures** (botCtf.test, five minutes a match; seeds 1-12, matches with a capture): the
    tile 9 (seeds 2-4, 7-12), the set piece 6 (2, 4, 7, 10-12), and the tile plus one 1 m block buried out of reach in
    a corner 5 (3, 6-8, 12). The bots play the set piece as they played the tile:
    - The set piece's blocks are 'floor' boxes where the tile's masonry was 'solid'. That kind is read only by the
      ground kept under floors (the played terrain comes out the same), the kill height and the bounds' walls (the
      map's lowest floor is unchanged), rendering and dressing. No navmesh, bot, sight or cover code reads it.
    - Around both pylons (2 m grid, ground and terrace, as a match builds them) the navmesh, the routes from the first
      spawn, the bots' places and the sight between 14,173 pairs of eye points are the same with the tile and the set
      piece.
    - The two matches first part at 149 s (seed 3) by a millimetre, for a bot 70 m from either pylon. The buried block
      makes them part at the second tick. Which seed captures is chaotic, so botCtf's Sunken Kingdom check now wants a
      capture in one of seeds 2, 3 and 4 (the tile: all three; the set piece: 2 and 4; the buried block: 3).
    - What does differ: the reliefs, pilasters and gilding were decor on the tile and are blocks here (5-8 cm proud of
      the face, the gilded band under the lintel 20 cm below it). The masonry stops shots as its material does
      (`core.pbr_sandstone_blocks` is soil, 5000) where tile structure counts as concrete (7000): the towers are metres
      thick either way.
- **Not swapped:** Coldwater Gulch places no Bunker tile (Bunker theme only); Whiteout Station's rebuild handles its
  hangar; Iron Compound stays as it is (owner). The seven maps with the Bunker theme (`core.bunker`) place no Bunker
  tile (Bunker Cross, Coldwater Gulch, Concrete Annex, Midnight Keel, Cormorant Isle, Pump Tower, Silo Complex).

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
