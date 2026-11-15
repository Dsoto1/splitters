# MapMaker painting made clear: the plan

Lane B's splitters22, 2026-11-15. A plan only: no code yet. It answers the QUEUE item at the top of Bugs,
"MapMaker painting made clear", and follows the owner's direction of 2026-11-15 exactly.

| | |
|---|---|
| Status | Written. Waiting on the owner's answers (the questions near the end). |
| Pictures | `map-briefs/painting/mockup-painters.png` (the two painters, the cursor label) and `map-briefs/painting/mockup-theme-warning.png` (the layers, Map settings, the warning). Their HTML sources are beside them. |
| Map format | Two bumps, each the next free number when it lands (main is v39 today; HANDOFF gives v40 to the tunnel kit's later steps). |
| Shipped maps | Look exactly the same after every phase. A test proves it. |

## The owner's direction, in short

1. Two painters, never mixed. **Structure paint** never touches the ground. **Ground paint** never touches a structure. Neither swaps a material silently.
2. Two base settings in Map settings: a **Structure theme** and a **Ground theme**. They are always the lowest layer. Set-piece looks sit above them. Every player edit sits above everything and is never lost when a base theme changes.
3. Set pieces are painted with Structure paint, per placement, without Explode. Players can save their own looks.
4. A warning with counts before any base-theme change, with "Keep current look". This includes the palette's "Use theme" button.
5. The palette and paint lists show the map's themes first. "All" is one click away.
6. The cursor says what it will paint and which layer the look comes from: base theme → set piece look → your paint. Every visible surface is paintable.

## Today

One Paint tool (B, `packages/client/src/editor/paintTools.ts`) paints both tiles and the ground. What it paints
depends on what the hover ray hits first (`hover.ts`, `updateHoverTarget`).

**Cause 1: Marble Checker became Gravel.** The terrain can only draw its eight ground layers
(`TERRAIN_MATERIALS` in `shared/src/map/terrain.ts`: grass, dirt, stone, sand, gravel, snow, moss, dark earth). Each cell
stores one of those eight (`TerrainData.materials`). When Paint is over bare ground, `PaintTools.groundPaint` calls
`terrainMaterialFor` (`shared/src/map/terrainPaint.ts`). For a material that is not a ground layer, it guesses the
nearest by pattern, then by colour. Marble Checker (`core.pbr_checker`) is grey, so it became Gravel. The status line
shows the guess in small type, but nothing stops the stroke.

**Cause 2: walls sometimes don't paint.** `PaintTools.paintTarget` only accepts a face whose box belongs to a grid
tile (`classicStructure.tiles`). `hover.ts` even casts the ray against tile boxes only (`this.paintable.tiles`). So:
- a free block's face is skipped;
- a set-piece part (`sp_<id>_<n>`) is skipped;
- a thin wall can be missed at its edge.

When the ray finds no tile face, `brushAtHover` (`editorInput.ts`) falls through to the ground
(`paintGround && !hoverFace`). The click paints the ground behind the wall instead.

**Cause 3: the theme changes everything at once, with no warning.** The theme can be changed in three places:
- Map settings' Theme select (`mapProperties.ts`, `ed-prop-theme`);
- the top bar's theme select (`topBar.ts`, `ed-theme`);
- the palette's "Use theme" button (`paletteBuilder.ts`, `buildPackPicker`, `ed-pack-theme`).

All three run `setThemeCommand` (`shared/src/editor/operations.ts`) straight away. Every unpainted tile surface
changes. So does every set piece without its own look, because `placementPack` (`shared/src/map/setPieces.ts`) falls
back to the role pack of the map's theme. Painted surfaces are kept and undo works, but nothing says what will change.

**Cause 4: set pieces are themed somewhere else.** A set piece's look is its role pack (`SetPiecePlacement.pack`). Its
per-piece materials are `overrides.roles`. Both are set only in the inspector (`setPieceTools.ts`, `pieceInspector`:
Look, Materials). Paint can't reach a set piece. To change one part you must Explode it. There is no way to save a
look of your own: looks are the 15 shipped role packs in `content/setpieces/roles.json`.

Also: ground painting lives in two places, Paint over bare ground and the Terrain tool's Paint brush
(`terrainTools.ts`, `terrainMaterial`).

## The layers

### The model

| Layer | Structures | Ground |
|---|---|---|
| 1. Base theme | Structure theme (`classicStructure.theme`): a material for each slot (floor, walls, pillars/cover/steps, underside, trim) | Ground theme (new): the base ground every unpainted cell shows, and the ground list the map offers first |
| 2. Set piece look | The placement's look (`pack`), else the theme's matching look | none |
| 3. Your paint | A tile's `surfaces`; a free block's `material`; a set piece's `overrides.roles` and its new per-part paint | A painted terrain cell |

The top layer that has a value wins. A theme change only ever changes layer 1. Layers 2 and 3 are never rewritten by it.
The one exception is **Keep current look**: it copies today's look into layer 3, on purpose, in one undo step.

Most of this already exists for structures:
- `resolveSurface` (`shared/src/map/surfaces.ts`) is already "tile override, else theme".
- `roleValue` (`setPieces.ts`) is already "placement override, else look, else the piece's own, else theme".

What is missing:
- the ground's base layer;
- paint on a single set-piece part;
- saved looks;
- one function that says which layer a surface's look comes from.

### New shared code (no format change)

A new file, `packages/shared/src/map/paintLayers.ts`:
- `surfaceLayer(doc, target)`. For a tile slot, a block, a set-piece part slot or a terrain cell, it returns the look and
  all three layers' values, marking the winner. The cursor label and the counts both use it.
- `themeChangeImpact(doc, { structure?, ground? })` returns:
  - how many surfaces follow the theme and will change;
  - how many set pieces use the theme's look;
  - how many you painted, which stay;
  - the ground area (m²) that follows the Ground theme.
- `keepCurrentLookCommand(doc, change)` is one batch command. It writes today's resolved look into layer 3 for
  everything that would change, then changes the theme.

A "surface" in the counts means one painted slot of one piece: a tile's walls, a block, or a set-piece part's floor.
It is not a triangle. Ground is counted in m².

### Format change A: the ground's base layer (next free version)

`TerrainData` gets two fields:
- `groundTheme`: the Ground theme's id, for example `ground.quarry`.
- `grounds`: the map's own ground list, up to 16 ground materials (`core.pbr_gravel`, `core.packed_snow`…).

`materials[i]` changes meaning:
- `0` means **the base**: the cell follows the Ground theme.
- `k` means **painted** with `grounds[k-1]`.

This removes every silent swap. Painting Packed Snow adds Packed Snow to the map's list. The terrain draws it as itself,
since `mapMeshes.ts` already builds one mesh per material (`terrainStyle`). `terrainMaterialFor` stays, but only for
how a ground **behaves**: plant cover (`cellFoliage`), and what the Environment brush grows on
(`envBrush.ts`). It never decides a ground's **look** again.

Ground themes are new content: `groundThemes` in `content/materials.json`, generated through `pnpm content:rebuild`.
Each one has:
- an id and a name;
- a base ground;
- the ground list it puts first;
- the Structure themes it suits. Each Structure theme names one as its match.

The first set is about ten, made only from the 19 shipped Ground materials: Meadow, Woodland, Rocky, Desert, Quarry,
Snowfield, Moorland, Urban (asphalt), Volcanic and Coastal. The exact list goes to the owner in Phase 4's pictures.

**Migration** (`migrate.ts`, `groundLayersV<next>`), for every map with terrain:
1. `grounds` becomes today's eight layer materials, in today's order (`TERRAIN_SURFACES`), so every index keeps its look.
2. The map's most common layer becomes the base. `groundTheme` is the shipped Ground theme whose base is that material.
   Each of the eight layers is some theme's base, so there is always one.
3. Cells of that layer become `0` (they follow the theme). Every other cell keeps its look as painted (`k`).

On shipped maps the most common layer covers 33–100 % of the ground (median 64 %). So a Ground theme change on an old
map really changes most of its ground, and the rest is kept as painted. This is question 6.

The tints carry over too. Gravel's darkening tint (`terrainStyle`) moves into the drawing of `core.pbr_gravel` as a
ground, so it looks the same.

### Format change B: set-piece paint and saved looks (next free version after A)

- `SetPiecePlacement.overrides.paint`: per part, by part index (as `overrides.hide` already is):
  - a tile part: `{ slot: SurfaceStyle }`;
  - a block part: `{ material, tint }`.

  `setPieceParts` applies it last, so it wins over the role and the look. Explode carries it onto the exploded tiles.
  Mirror and turn keep it.
- `lookDefs` on the map: the player's own looks that the map uses. Each one has a `my_<name>` id, a name, and role values
  (`SetPieceRoleValues`). This works like `setPieceDefs` for your own set pieces. The same looks also live in the
  player's browser library, next to their set pieces (`storage.ts`).

**Migration B** is a no-op. Both fields are new and optional, so old maps mean exactly what they meant.

### How we prove shipped maps look the same

- **Before Phase 4**, a script run on origin/main writes `packages/shared/test/fixtures/paintLooks.json`. For each map in
  `maps/` and `maps/templates/`, it holds one hash of every face's resolved material and tint and every terrain cell's
  material and tint. The fixture is about 100 lines, and the script stays in `tools/`.
- **A new test, `paintLooks.test.ts`**, loads every map with the new code and checks each hash. Any change to
  migration, `resolveSurface`, `setPieceParts` or terrain drawing that alters a shipped map's look fails it, and it
  names the map.
- **`groundLayersV<next>.test.ts`** checks one old fixture map cell by cell: the base cells, the painted cells and the
  tints.
- The all-maps unit test (`allMaps*`), the coverage map's flow and the `visual` baselines must stay unchanged, with no
  baseline regenerated.

## The UI

![The two painters](map-briefs/painting/mockup-painters.png)

### The two painters

| | Structure paint | Ground paint |
|---|---|---|
| Key | B (as Paint today) | Shift+B (free today) |
| Tool bar | Build tab | Environment tab (Paint's place today) |
| Paints | tile slots, free blocks, set-piece parts, thin walls | terrain cells only |
| List | building materials (every category but Ground; floors and roofs may also take ground materials, question 2) | the 19 Ground materials only |
| Over the ground | does nothing; the label says "Structure paint doesn't paint the ground. Use Ground paint (Shift+B)." | paints |
| Over a structure | paints | the stroke passes under it; the building is never painted |
| Alt / I | picks up the look under the cursor | picks up the ground |
| Right-drag | resets to the layer below (look or theme) | resets cells to the base |

- The Terrain tool's Paint brush becomes Ground paint, so the ground is painted in one place. T still cycles the sculpt brushes.
- `terrainMaterialFor` is gone from the paint path.
- A material a painter can't use is not in its list. Search finds it with a note, for example "Marble Checker: Structure paint only".
- **Every visible surface is paintable.** The Structure paint ray is cast against everything drawn except invisible barriers. That includes tiles, blocks and set-piece parts. Thin boxes (under 20 cm) get a few centimetres of pick margin, so a wall's edge is caught.
- A miss never falls through to the ground.
- **Props** have their own models and are not paintable. The label says so ("Prop: its own model, not paintable"). Roads say "Road: its surface is in the path's inspector".
- **Scope** keeps today's list (`PaintScope`): this surface, all of this piece, this level, the whole map. On a set piece, "all of this piece" means the role in this placement (`overrides.roles`): all its Stone, for example. "This surface" means the one part (`overrides.paint`). Question 5 picks the default.

### The cursor label

The label is the status line (`ed-target`) plus a small card by the cursor. It shows:
- what is under the cursor: Wall · Bus Shelter (set piece) · back wall;
- the chain of three layers, with the one shown marked: Structure theme Industrial Factory: Grey Corrugated → Set piece look Urban & Civilian: Old Brick ✓ → Your paint: none;
- what a click will do: "Click paints Marble Checker on this piece's walls."

On the ground with Ground paint, it says: "Ground · Gravel (Ground theme: Quarry) · click paints Packed Snow · radius 6 m".

### Map settings

![The layers, Map settings and the warning](map-briefs/painting/mockup-theme-warning.png)

- Map settings' General group gets two rows:
  - **Structure theme**: today's Theme select, renamed;
  - **Ground theme**: new, with a line under it, "base Gravel · 7 grounds".
- The top bar's theme select (`ed-theme`) goes. In its place there are two small chips: "Structure theme: …" and "Ground theme: …". They open Map settings, so the theme is changed in one place.
- The palette's "Use theme" button stays where it is, but it goes through the same warning.

### The warning

Every base-theme change goes through one dialog: Map settings, "Use theme", and a template's theme. It says:
- "312 surfaces follow the theme and will change."
- "4 set pieces use the theme's look and will change."
- "48 surfaces you painted stay as they are. 2 set pieces with a look of their own stay."
- "The sky and backdrop follow the theme too." (Only when the map has no backdrop of its own.)
- For a Structure theme change, a tick box, off by default: "Also change the Ground theme to Desert (Desert City's match): 9,120 m² of ground follows it." (Question 4.)

It has three buttons:
- **Change** applies the change.
- **Keep current look** changes the theme but writes today's look into your paint (`keepCurrentLookCommand`). The theme then only affects new pieces and the palette.
- **Cancel** puts the select back.

Change and Keep current look are each one undo step. A change where nothing would differ skips the dialog: an empty map, say, or a theme with the same materials.

### The palette follows the map's themes

- The Style Pack picker (`ed-pack`) gets a new first choice, **This map's themes**, which is the default. It puts first:
  - the Style Packs whose `themes` include the map's Structure theme;
  - their tiles, props and set pieces (`stylePackHas`, `setPieceSuitsStylePack`);
  - the matching looks.
- **All** is the second choice, one click away. Picking one pack still narrows to that pack, as today.
- Structure paint's list: the theme's own slot materials first, then the theme's packs' `materials`, then Recent. All is behind a tab.
- Ground paint's list: the Ground theme's list first, then the other Ground materials.
- The palette follows a theme change at once.

### Saved looks

- The set-piece inspector's "Materials" section stays. It shows each role's layer ("from the look", "your paint").
- **Save as my look…** names the current role values. The look goes into your library and into the map's `lookDefs` when used.
- The Look select is grouped: This map's themes, My looks, All looks.
- A saved look is roles only, so it fits any set piece (question 7). A painted part stays with its placement. "Save as set piece…" still saves a whole piece with its paint.
- Shipped looks are not editable. "Save as my look…" makes a copy.

## Phases

Each phase is small and lands green by itself. Phases 1–3 need no format change.

**Phase 1: two painters, no silent swaps.**
- What it does:
  - Structure paint (B) and Ground paint (Shift+B), with their own lists.
  - The Terrain brush's Paint becomes Ground paint.
  - Free blocks and thin walls are paintable.
  - A miss never paints the ground.
  - Ground paint offers only the eight current layers (more come with Phase 4).
  - Plain labels: what will be painted and what a click does.
- Files: `paintTools.ts`, `hover.ts`, `editorInput.ts`, `terrainTools.ts`, `toolBarTools.ts`, `shared/src/editor/keymap.ts`, `paletteBuilder.ts` (`buildPaintPalette`), the tour.
- Unit test: `paintTargets.test.ts` (shared). Which targets each painter takes: tile, block, thin wall, set-piece part (refused until Phase 5, with a message), prop, ground.
- E2E (`editortools`):
  - Structure paint on bare ground changes nothing and shows the message;
  - Marble Checker is not in Ground paint's list;
  - a free block and a thin wall paint;
  - Ground paint under a building leaves its walls.
- E2E (`editorux`): today's "Paint from far out paints the ground" check moves to Ground paint.

**Phase 2: the layers on the cursor, and the warning.**
- What it does:
  - `paintLayers.ts` (`surfaceLayer`, `themeChangeImpact`, `keepCurrentLookCommand`);
  - the cursor's chain;
  - Theme renamed Structure theme;
  - the top bar select replaced by chips;
  - the warning on Map settings and on "Use theme".
- Unit test: `paintLayers.test.ts`.
  - Counts on the coverage map (`maps/test_coverage.json`).
  - Keep current look leaves every resolved face the same (hash) while the theme id changes.
  - A painted surface survives every theme.
- E2E (`editortools`):
  - the dialog's counts match `themeChangeImpact`;
  - Cancel changes nothing;
  - Change and Keep current look are one undo step each;
  - "Use theme" opens the same dialog.
- Flicker: a dialog, not a bright moment, so nothing new for `flashing`.

**Phase 3: the palette follows the themes.**
- What it does: the "This map's themes" default, All one click away, theme-first paint lists.
- Unit test: `palette.test.ts` (client) gains the ordering.
- E2E (`editorux`): the default shows the theme's packs first, and All shows everything. The `mapmaker.png` baseline is regenerated (`pnpm e2e:baselines`).

**Phase 4: the Ground theme (format change A).**
- What it does:
  - `groundThemes` content;
  - `terrain.groundTheme` and `terrain.grounds`;
  - `materials` 0 = base;
  - the migration;
  - `mapMeshes.ts`, `foliage.ts`, `envBrush.ts`, `backdrop.ts` (the ground past the border), `mirror.ts`, `heightGrid.ts` and `frontend/mapPlan.ts` read the new encoding;
  - Map settings' Ground theme row and its warning;
  - Ground paint offers all 19 grounds with no substitution;
  - a new terrain starts as the base.
- Tests:
  - `groundLayersV<next>.test.ts` and `paintLooks.test.ts` (with the fixture written first, on origin/main);
  - the all-maps test unchanged;
  - `editorenv` e2e: Ground theme change with counts, painted cells stay, Packed Snow paints as Packed Snow;
  - `visual` baselines unchanged.
- Pictures of the ten Ground themes go to the owner before this phase lands.

**Phase 5: set pieces with Structure paint, and saved looks (format change B).**
- What it does:
  - `overrides.paint` and its expansion;
  - painting parts with both scopes;
  - the look layer in the chain;
  - Save as my look, `lookDefs`, the grouped Look select.
- Unit test: `setPiecePaint.test.ts`.
  - Paint applies.
  - It wins over the look.
  - It survives a theme change, mirror, turn and copy-paste.
  - Explode keeps it.
  - A saved look round-trips through the map file.
- E2E (`editorpieces`):
  - paint a Bus Shelter wall without Explode;
  - change the theme, and the paint stays;
  - save a look and put it on a second piece.
- The coverage map gets one painted set-piece part and one saved look, placed in MapMaker, so its unit test covers them.

**After each phase:** docs/BUILDING_KIT.md, HANDOFF and CHANGELOG (Unreleased). Run `pnpm typecheck`, `pnpm test:changed`
and `pnpm e2e:changed`, then a check branch.

## Questions for the owner

1. **Two tools or one?**
   a. Two tools, Structure paint (B) and Ground paint (Shift+B), each with its own list. (rec)
   b. One Paint tool with a Structures / Ground switch that filters the list and the target.

2. **Which materials may cross over?**
   a. Floors and roofs may take ground materials (a gravel yard floor, Parking Bays on a deck). Walls and trim never do. The ground takes ground materials only. (rec)
   b. Strict both ways: structures never take ground materials.
   c. As (a), and the ground may also take paving (setts, flagstones, cobbles).

3. **What is a Ground theme?**
   a. A base ground and the list of grounds offered first. (rec)
   b. That, plus automatic rules (rock on steep slopes, sand at the water's edge) as part of the base. This would be a later phase.

4. **Do the two themes move together?**
   a. Separate. A Structure theme change offers its matching Ground theme as a tick box in the warning, off by default. (rec)
   b. Separate, with no offer.
   c. Linked: changing one always changes both.

5. **Painting a set piece: what does a click paint by default?**
   a. The material across this piece: all its Stone, for example. "This surface only" is in the scope list. (rec)
   b. Only the part clicked.

6. **The ground of maps already made: what follows the new Ground theme?**
   a. Each map's most common ground becomes its base and follows the theme. The rest counts as your paint. (rec)
   b. Everything counts as painted, so a Ground theme change does nothing on today's maps until they are repainted.

7. **What does a saved look hold?**
   a. The materials per role (stone, trim, floor…) and the facade, door and glass, so it fits any set piece. It lives in your browser and in each map that uses it. (rec)
   b. As (a), plus the per-part paint of the piece it was saved from, so it only fits that set piece.

8. **What comes first, this or Flavius Rule's octagon phase 4?**
   a. Both at once: phase 4 is map work and touches no editor code, so painting Phase 1 starts as soon as you answer. (rec)
   b. Octagon phase 4 first, then painting.
   c. Painting first, and the octagon waits.

## Risks

- **Part indices.** Per-part paint is keyed by part index, as `overrides.hide` is. If a shipped set piece's parts are reordered, the paint moves to another part.
  - Mitigation: a content test fails when a shipped piece's parts change while a map in `maps/` paints or hides them by index.
  - Stable part keys are the UI spec's Phase 4b, and stay parked.
- **The ground list's limit.** A map can use 16 grounds. At the limit, Ground paint says so and offers to swap one. It never substitutes.
- **Terrain readers.** Several files read `terrain.materials`: drawing, plants, the Environment brush, the backdrop's ground past the border, the plan picture, height-grid import and Mirror. Phase 4 must change all of them together. A grep list goes in its PR, and the all-maps test and `paintLooks.test.ts` catch any it misses.
- **File size.** The ground migration rewrites every terrain array, so map files change when next saved in MapMaker. Base cells become `0`, so the files get a little smaller.
- **Keep current look on a big map** writes many tile overrides, one per surface that follows the theme. That is one undo step, and there is no budget for overrides today. Watch the map file's size on St. John's.
- **Old clients.** A map saved at the new version won't open on an older game build. This is the usual format rule.
- **Lane overlap.** `wip/mapmaker-followups-1115` (Mirror, `facesUpdate`) also touches the editor. Painting Phase 1 rebases onto it.

## Out of scope

- Painting props (their own models), roads (the path inspector), doors' and windows' styles (the Walls tool and roles), and facades (the tile inspector).
- Painting single faces of a block: a block is one material.
- Making new materials, or importing textures. No player uploads, and no AI generation (CLAUDE.md).
- Automatic ground rules (slopes, water's edge), unless the owner picks 3b. Even then, it is a later phase.
- Repainting any shipped map. Shipped maps change only through MapMaker, by the owner's choice.
