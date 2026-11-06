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

The brainstorm list, plus the pieces MAP 21 and the colosseum need (casemate, trench run, cliff stair, arena arcade
bay, vomitorium, tunnel junction, cage block, insula), follow in later phases.
