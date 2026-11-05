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
