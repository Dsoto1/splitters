# Asset audit for the Urban & Civilian set (Phase 0)

Written 2026-11-13 for the owner, from the guide in `OWNER_GUIDE_2026-11-13.md`.
Nothing in the game was changed. This is a report, plus one read-only tool.

- The numbers come from `asset-inventory.json` in this folder.
  `node tools/content/asset-inventory.mjs` writes it. `--check` says if it is out of date.
- "Not established" means I could not prove it from code or data, and I say why.
- No browser was used. What needs one is listed in section 4.

## The short version

1. The game's grid is **8 m cells and 4 m levels**, not the sheet's 1 m grid and 3 m walls. The sheet's numbers cannot be used as they are.
2. MapMaker already has **2,175 pieces** in the inventory. Most of Tileset 11 is already there under other pack names.
3. I checked **112 things** the sheet and the guide ask for. **87** exist now, **6** need only a new material or look, **6** can be built from existing pieces as set pieces, **11** need new shapes (most of them small), **2** should be left alone.
4. The game already separates shape from material in four ways. The urban set can follow them without a map format change.
5. The existing Suburban pack's own tiles are placed in **no map that players can pick**. Its demo map was retired.

---

## 1. The real system as found

### 1.1 Grid, levels and sizes

| What | Real value | Where to check |
|---|---|---|
| Cell size | 8 m | `packages/shared/src/map/schema.ts`, `ClassicStructure.cellSize` (default 8) |
| Level height | 4 m | same place, `levelHeight` (default 4) |
| Wall thickness | 0.5 m | `packages/shared/src/map/catalog.ts`, `TILE_DIMENSIONS` |
| Floor thickness | 0.5 m | same |
| Standard doorway | 3 m wide, 3 m high | `content/tiles/edges.json`, style `door` |
| Room doorway | 2 m wide, 2.6 m high | `edges.json`, style `door_room` |
| Wide doorway | 5 m wide, 3.5 m high | `edges.json`, style `wide` |
| Window | 2.6 m wide, sill 0.9 m, head 2.5 m | `edges.json`, style `window` |
| Stair step | 0.25 m rise, 0.5 m run | `catalog.ts`, `flight()` |
| Long Ramp tile | 16 steps of 0.25 m over 16 m (1 in 4) | `content/tiles/core.json`, `core.ramp` |
| Tallest step a player walks up | 0.3 m | `packages/shared/src/sim/constants.ts`, `PLAYER.maxStepHeight` |
| Steepest slope a player walks | 50 degrees | same, `PLAYER.maxSlopeDegrees` |
| Player body | 0.4 m radius, 1.8 m tall, eyes at 1.6 m | same, `PLAYER` |
| Build limit | 256 cells each way, 16 levels up or down | `schema.ts`, `MAX_TILE_CELL`, `MAX_TILE_LEVEL` |

All 89 map files use 8 m and 4 m (inventory, `maps`). The tile code assumes it: the comment on `TILE_DIMENSIONS` says "Tiles assume the default 8 m cell / 4 m level", and set pieces fix it in `SET_PIECE_GRID` (`map/setPieces.ts`).

**Where the concept sheet differs**

| Sheet says | The game has | What that means |
|---|---|---|
| Grid unit 1 m | 8 m cells for tiles. Props snap at 0.25 m, other things at 0.5 m. | Tiles are rooms and streets, not 1 m wall panels. |
| Wall height 3 m, storeys in 3 m steps | 4 m levels | A storey is 4 m. |
| Stair rise 0.3 m, run 0.3 to 0.4 m | 0.25 m rise, 0.5 m run | Ours are gentler. 0.3 m is also the walk-up limit, so 0.25 m is the safe choice. |
| Door height 2.1 to 2.4 m | 3 m (2.6 m for the Room doorway) | Ours are taller. |
| Door widths 1 m, 2 m, 3 m | 2 m, 3 m, 5 m (and arches) | No 1 m door. Bots keep 0.8 m off walls (noted in `content/setpieces/academy.json`), so a 1 m door would be tight. |
| Ramp slope 1:6, 1:8, 1:12 | The ramp tile is 1 in 4, stepped. Free blocks can be tilted to any slope. | A 1:8 ramp is a tilted block, not a tile. |
| Walls as 1x1, 1x2, 2x2 modules | A wall is one side of a cell, 8 m long | See 1.3. |
| Snap: grid, pivot, surface | Grid snap and surface snap exist. No snap sockets. | See 1.2. |

### 1.2 Snapping, turning and pivots

- **Tiles** sit on whole cells and whole levels. They turn in quarter turns (`schema.ts`, `Rotation`: 0 to 3, clockwise).
- **Tile pivot**: the centre of the tile's first cell, at its base floor. A bigger tile grows east and north from there before it is turned (`catalog.ts`, `LocalBox` and `footprint()`).
- **Props** are placed freely. Position is the centre of the footprint on the floor. The model faces +Z before its turn (`schema.ts`, `PropEntity`; `content/props.ts`, `PropDefinition`). Scale is 0.25 to 4.
- **Snap steps in MapMaker**: props 0.25 m, other things 0.5 m. The top bar offers fine (0.25 m), normal, coarse (1 m) and off. Holding Ctrl or Shift places freely (`packages/client/src/editor/editorApp.ts`, `snapStep`; `placing.ts`).
- **Turn steps**: props and vehicles 15 degrees (5 with Shift), spawns 45, tiles a quarter turn (`packages/shared/src/editor/operations.ts`, `yawStep`).
- **Surface snap**: a prop lands on whatever is under the pointer, such as a table or a roof (`packages/shared/src/editor/surfaceSnap.ts`, `propDrop`).
- **Set pieces** turn in quarter turns and can be mirrored (`map/setPieces.ts`, `placeCell`, `placeYaw`).
- There are **no snap sockets** on props. Tiles join through "ports": the sides where a doorway may open (`map/tileOptions.ts`, `TilePort`).

### 1.3 How walls, doors and windows work

This is the biggest difference from the sheet.

- A wall is not a piece you place. Each side of each cell has a **wall style** (`content/tiles/edges.json`, 26 styles). The inspector sets it per side.
- Styles include solid wall, doorway, wide doorway, five arches, window, twin windows, two sash windows, firing slit, half wall, railing, fence, bars, barred gate, shutter, broken wall and no wall.
- `auto` is the default rule: a doorway where two tiles' ports meet, otherwise the tile's default side (`map/geometry.ts`, `resolveEdge`).
- **Corners and junctions build themselves.** There are no corner, T or cross pieces to place. A room's corner look is a room option: square, posts, columns, chamfered or rounded (`tileOptions.ts`, `CORNERS`).
- Windows can hold real glass, breakable or bulletproof (`schema.ts`, `GLASS_KINDS`).
- Rooms take options: layout, floor insert, ceiling (open, roof, skylight, beams, vault), corners and a facade (`tileOptions.ts`).
- A **facade** dresses the outside of a room's walls. It is only drawn. It never changes collision (`tileOptions.ts`, `FACADES`: 28 of them).

### 1.4 Stairs, ramps and going up

- Tiles: `core.stairs`, `core.stairs_open`, `core.stairwell`, `core.stairs_grand`, `core.ramp`, `snow.metal_stair` and stairs inside many building tiles.
- Ladders are an entity with two looks (`schema.ts`, `LADDER_STYLES`).
- Lifts and elevators are "movers" (`operations.ts`, `SCENARIO_PALETTE`: Lift, Tower Elevator).
- Free blocks can be tilted (`pitch`, `roll`), so a smooth ramp or a pitched roof is a block (`schema.ts`, `BlockEntity`; the "Pitched Roof" palette entry).

### 1.5 The map format and how maps name pieces

- A map is one JSON file, `maps/<id>.json`. The format is `tiletrigger.map`, version **36** (`map/mapKeys.ts`, `MAP_FORMAT_VERSION`).
- Maps name pieces **by id**: a tile is `core.room`, a prop is `prop.barrel` or `kit.crate.wood`, a plant is `env.broadleaf.oak`, a set piece is `setpiece.bunker`, a material is `core.pbr_concrete`.
- Ids never change. The data files say so (`content/tiles/core.json`, `content/setpieces/roles.json`).
- Old files still load. 35 of the 89 map files are saved at versions 15 to 35. They are upgraded in memory when loaded (`map/migrate.ts`, `MIGRATIONS`). Almost every step is "nothing to do", because new fields are optional.
- **Aliases** keep retired ids working without touching the file:
  - retired props play as a kit family (`content/kitprops.json`, `aliases`; `map/propAliases.ts`),
  - retired tiles play as a set piece (`content/setpieces/aliases.json`; `map/setPieceAliases.ts`),
  - retired vehicles play as their replacement (`map/mountAliases.ts`).
  MapMaker opens the map as it was made and offers "Replace all".
- Not every new option needed a new version. The sash windows, the Room doorway and the Oak door style were added on 2026-11-12 (commit `12d3f0d`) with the version still at 36.
- No map names a piece the game does not have. The inventory's `unknownReferences` list is empty.

### 1.6 Themes, style packs and the palette

There are four layers. Together they already do most of what the guide's section 5 describes.

1. **Library materials** (`content/materials.json`, 150 of them). A material is a pattern or a photographed texture, colours and a shine. Any surface can take any material and a tint.
2. **Themes** (same file, 36 of them). A theme is five default materials: floor, walls, solids, underside, trim, plus a sky colour. A map has one theme. Any tile can override any slot (`schema.ts`, `TileSurfaces`).
3. **Style packs** (`packages/shared/src/editor/stylePacks.ts`, 13 of them). A pack is only a list: tile ids, prop ids, materials, facades, themes, gameplay pieces, vehicles, pickups and a demo map. The file says "Packs only group content that exists anyway". Choosing a pack filters the palette (`stylePackHas`). A piece may be in several packs. Today 29 tiles and 99 props and kit families are in more than one.
4. **Role packs for set pieces** (`content/setpieces/roles.json`, 14 of them). A set piece names roles (stone, trim, floor, paving, roof, wood, metal, facade, door, glass) instead of materials. A role pack says what each role is in one look. So one set piece shape is drawn in the Suburban, Harbor or Military look.

**Palette organisation** (`packages/client/src/editor/paletteCatalog.ts`):
- Ten tabs: Structure, Props, Nature, Terrain, Gameplay, NPCs, Vehicles & Turrets, Objects & Logic, Lights & FX, Paint.
- Tiles are grouped by shape: Rooms, Large, Buildings, Curves, Corridors, Vertical, Open, Special (`TILE_CATEGORIES`).
- Props are grouped by theme: nine groups in the Props tab, with Nature and parked vehicles in their own tabs. A prop has one of 47 categories, and the category decides its group (`PROP_GROUPS`, `propGroup`).
- Search is fuzzy over name, tags and pack name (`paletteSearch.ts`).

### 1.7 How pieces are made (the content pipeline)

| Kind | Source of truth | Tool | Result |
|---|---|---|---|
| Data tiles (93) | `content/tiles/core.json` | `tools/content/tiles.mjs` | `kitTiles.generated.ts`; built by `resolveKitTile` |
| Code tiles (191) | `packages/shared/src/map/packTiles*.ts` (10 files) | none, they are code | boxes with materials |
| Wall styles (26) | `content/tiles/edges.json` | `tools/content/tiles.mjs` | `edgeStyles.generated.ts` |
| Props (1,377) | `content/props/<pack>.json` (58 packs) | `tools/content/prepare-props.mjs` | `.glb` files, `props.generated.ts`, `props.lock.json` |
| Kit prop families (109) | `content/kitprops/<type>.json` | `tools/content/kitprops.mjs` and `tools/content/kit/` | generated models, three levels of detail each |
| Environment species (23) | `content/environment/<family>.json` | `tools/content/environment.mjs` | generated trees, rocks, plants |
| Set pieces (66) | `content/setpieces/<family>.json` | `tools/content/setpieces.mjs` | `setPieces.generated.ts` |
| Materials and themes | `content/materials.json` | `tools/content/materials.mjs` | `materials.generated.ts` |

- Every tile is built from **boxes**. There is no mesh modelling for tiles. Eleven tiles also draw a model on top (the city buildings and neon towers); their collision is still boxes.
- **Kit props** are made in code from seeds. A family has one size and one collision. Its **variants** are looks only (`content/kitProps.ts`: "Gameplay never depends on the variant").
- `pnpm content:rebuild` regenerates everything. `pnpm content:check` fails if generated files are stale.
- **Provenance**: every shipped file is in `content/provenance.json` with its licence. By the pack files: 976 props are CC0, 255 are ours (made in code), 65 are Meshy community CC0, 2 are Meshy owned, and 79 are under a free-use licence (`lowpolyassets-household-items`, `madduck-hospital`).
- Rules that apply (CLAUDE.md): no player uploads, no AI generation in the game, only approved sources, raw pack files never committed, every map made in MapMaker.

### 1.8 How pieces are drawn

- **The level** (tiles, blocks, trim, terrain) is built as one mesh per material and tint. Faces that touch are dropped. Then meshes are merged into shared texture arrays, cut into 128 m squares so far parts are skipped (`packages/client/src/mapMeshes.ts`; `levelMerge.ts`, `MERGE_CHUNK`). WebGL2 only; elsewhere one mesh per material.
- **Props**: a model with 8 or more copies in a map is drawn as thin instances, batched per model, material and 128 m square (`game/propBatches.ts`, `PROP_SECTOR`, `PROP_BATCH_MIN`). Fewer copies are ordinary GPU instances. Tints ride in the instance colour.
- **Levels of detail**: each copy picks its level by distance, with a 10% margin so it does not flicker (`propBatches.ts`; `environment/environmentVisuals.ts`). Kit props have three levels. Many pack props have one.
- **Environment** (trees, rocks): thin instances per species, variant, level and 64 m square.
- **Culling**: by view, per square or batch. I found no occlusion culling for level geometry (a search for "occlusion" in `packages/client/src` finds only sky and graphics settings files). Not established beyond that search.
- **Shadows**: static batches are merged into shadow proxies (`game/shadowProxy.ts`).

### 1.9 How pieces collide

- Collision never uses the drawn meshes. It is built from the map's boxes (`map/geometry.ts`, `buildMapGeometry`, `propBoxes`, `blockBoxes`) as box colliders in the physics engine (`sim/physics.ts`).
- Terrain is a triangle mesh. Environment species use capsules, boxes, hulls or meshes.
- Props collide in one of these ways (set in the pack file as `collide`): `box` 391, `voxel` (several fitted boxes) 527, `trunk` (a 0.5 m post) 97, `none` 251, plus `stairs`, `shell`, `frame`, `openings`, `model` and `boxes` for special cases (111 together).
- **What a bullet does** depends on the surface. Library materials get a ballistic class from their category (`sim/gunplay.ts`, `surfaceMaterial`). No library material sets an explicit `surface` in `content/materials.json` (0 of 150), so impact effects are guessed from the id's words (`sim/surfaceTypes.ts`, `guessSurface`). For props, 104 of 1,377 name a surface; the rest are guessed. Kit families and environment species always name one.

### 1.10 The tunnel kit's "family" idea (another session's work)

Read-only from the branch `origin/wip/tunnels` and its brief `docs/map-briefs/tunnels/`. Nothing of it is used or touched here.

- It builds **one tunnel shape per module and several material families** (concrete and brick so far).
- Each family is a tile id of its own with the same cells, ports and collision (`TileDefinition.familyOf` on that branch). The palette shows the shape once.
- A placed tile gets an optional `family` field. That is **map format v37**, with a "nothing to do" migration.
- Collision never reads the family. `TileCatalog.drawn()` picks which twin to draw.

This is the guide's rule 5 ("do not confuse materials with geometry") done for tiles. It is the cleanest way to give a whole tile a different lining, not only different paint. The urban plan can follow it **once it has landed**. Until then the urban set can use what main already has: per-surface paint, facades, kit variants and role packs. Those need no format change.

---

## 2. Inventory summary

From `asset-inventory.json`. "Placed" means some map file places it, or a set piece a map places contains it.
There are 89 map files: 70 playable, 17 retired, 2 test-only. "Live" below means the 70.

### 2.1 Counts by kind

| Kind | Pieces | Placed in a map | Never placed | Retired |
|---|---|---|---|---|
| Tiles from data | 93 | 93 | 0 | 0 |
| Tiles from code | 191 | 162 | 29 | 1 |
| Props (content packs) | 1,377 | 704 | 673 | 130 |
| Kit prop families | 109 (522 looks) | 76 | 33 | 0 |
| Environment species | 23 | 22 | 1 | 0 |
| Set pieces | 66 | 66 | 0 | 0 |
| Set piece role packs | 14 | 2 named in a map | 12 | 0 |
| Materials | 150 | 102 named in a map | 48 | 0 |
| Themes | 36 | 32 | 4 | 0 |
| Wall styles | 26 | 25 | 1 (`auto`, the default) | 0 |
| Facades | 28 | 18 | 10 | 0 |
| Room options | 22 | 18 | 4 | 0 |
| Vehicles and turrets | 16 | 16 | 0 | 0 |
| Door styles, destructibles, light fixtures, ladder styles | 24 | 24 | 0 | 0 |
| **Total** | **2,175** | | | |

Read these with care:
- The test map `test_coverage` places one of nearly everything. So "placed" does not mean "used in a real map". 51 placed tiles and 39 set pieces are in no live map.
- "Never placed" props: 545 are not retired and simply unused. 30 of the 33 unused kit families are the dome kit's parts.
- Material counts only see materials a map file names. Materials that code tiles paint with are counted in `tilesPaintedWithIt`.

### 2.2 Counts by style pack

| No. | Pack | Tiles listed | Its own tiles | Props listed | Materials | Set pieces that suit it | Demo map |
|---|---|---|---|---|---|---|---|
| 01 | Military Compound | 26 | 16 | 49 | 4 | 40 | iron_compound (retired) |
| 02 | Frontier Dust | 16 | 15 | 75 | 4 | 12 | dustwater |
| 03 | Imperial Arena | 29 | 15 | 32 | 5 | 29 | sandfall_colosseum |
| 04 | Orbital Station | 23 | 10 | 37 | 2 | 12 | halcyon_station |
| 05 | Gothic Estate | 19 | 8 | 48 | 3 | 24 | ravenscroft_hall |
| 06 | Jungle Ruins | 40 | 32 | 79 | 10 | 8 | vinefall_sanctum |
| 07 | Neon Megacity | 16 | 6 | 25 | 2 | 15 | neon_spire |
| 08 | Suburban Chaos | 17 | 8 | 44 | 3 | 13 | cedar_lane (retired) |
| 09 | Desert City | 36 | 18 | 107 | 16 | 32 | qasr_medina |
| 10 | Medieval Village | 21 | 16 | 69 | 9 | 24 | market_town |
| 11 | Coastal Harbor | 27 | 20 | 60 | 12 | 36 | saltmarsh_harbor |
| 12 | Snow Outpost | 25 | 17 | 54 | 10 | 30 | whiteout_station |
| 13 | Industrial Factory | 18 | 7 | 51 | 9 | 13 | ironworks |

- 36 tiles are in no pack (mostly plain core rooms, round pieces and the three city buildings).
- 758 props that are not retired are in no pack. They are still in the palette when no pack is chosen.
- Five packs still list props that are retired from the palette (old Kenney plants): Frontier 2, Gothic 3, Jungle 7, Suburban 3, Desert 3. The comment in `stylePacks.ts` says packs should not. This is a tidy-up, not a fault in play.
- Tiles by id prefix, and how many are in a live map: core 80 (57), jungle 32 (28), harbor 20 (18), desert 18 (17), snow 17 (10), military 16 (6), medieval 16 (15), frontier 15 (14), imperial 15 (10), egypt 11 (4), orbital 10 (2), gothic 8 (8), **suburban 8 (0)**, industrial 7 (7), neon 6 (4), city 5 (4).

### 2.3 Most used

- **Tiles**: `core.yard` 2,642 placements in 42 maps, `core.room` 2,410 in 63, `core.platform` 999 in 21, `core.platform_rail` 336 in 32, `core.stairwell` 227 in 30.
- **Wall styles**: no wall 2,398, solid wall 1,623, doorway 1,483, window 1,205, twin windows 481.
- **Kit families**: desk 275, chair 221, steel drum 174 (44 maps), long wooden crate 162 (49 maps), shop shelf 132.
- **Props**: leafy bush 506, common tree 312, wooden chair 268.
- **Environment**: oak 1,372, tall pine 1,346, grass clump 1,092.
- **Materials named in maps**: steel 3,840 (37 maps), concrete 2,659 (31), matte paint 1,972, white plaster 1,449.
- **Free blocks**: 14,760 across all maps. Three of the five largest maps place no tiles at all (`st_johns`, `env_showcase`, `apex_ring`). Builders already make a lot from plain blocks and materials.

### 2.4 Never placed

- **Code tiles (29)**: `desert.city_gate`, `egypt.pylon`, `frontier.boardwalk_street`, `harbor.boardwalk_turn`, `harbor.quay_corner`, `imperial.aqueduct`, `imperial.hypogeum`, `imperial.seating_corner`, `jungle.arch_hall`, `jungle.cliff_ramp`, `jungle.wall_arch`, `jungle.wall_carved`, `medieval.town_gate`, `military.trench_corner`, `military.trench_cross`, 7 orbital tiles, 7 snow tiles.
- **Facades (10)**: clapboard, collegiate stone, harbour render, overgrown, prefab, snowy concrete, suburban brick, tarred timber, half-timbered, village whitewash. No map file sets them as a room option. Not established whether set pieces apply them through role packs at load.
- **Themes (4)**: adobe, desert, harbour, volcano.
- **Kit families**: the 30 dome parts, and three fences (`kit.fence.board`, `kit.fence.palisade`, `kit.fence.town`).

None of these is proposed for removal. Unused is not the same as unwanted, and ids must stay.

### 2.5 Duplicate candidates

The tool looks for the same shape under several ids. It found very little.

| Candidate | Ids | Maps that place them | Note |
|---|---|---|---|
| Same model file | `prop.dc_well`, `prop.mv_well` | market_town, qasr_medina, sandgate, test_coverage | One well listed in two packs. Deliberate cross-theme reuse by copying. |
| Same model file | `prop.landing_craft_wreck`, `prop.landing_craft_wreck_burning` | iron_coast, shingle_point | Same model, the second adds fire. Not a duplicate in play. |
| Same model file | `prop.ww_general_sign_b`, `prop.ww_general_sign_c` | none | Two store signs with identical files. |
| Same texture | `core.pbr_asphalt`, `core.pbr_wet_asphalt` | 17 maps | Same photo, different shine. Deliberate. |
| Same pattern | `core.paint_gloss`, `core.paint_matte` | 25 maps | Same white, different shine. Deliberate. |

- **No two tiles have the same cells, ports and boxes.** The four "Side walls" tunnel tiles are options of their plain tiles, with different boxes.
- **Same job, different model** (found by name, not by the tool): four dumpsters (`prop.dumpster`, `prop.nc_dumpster`, `prop.street_dumpster`, `prop.gs_dumpster`), about ten bins, six street or yard lamps, two Red Brick materials (`core.red_brick` in 1 map, `core.pbr_brick_red` in 5).
- **No deletion or merging is proposed.** Every one of these is placed in a map or is harmless. If the owner ever wants to merge two, the alias system (1.5) is the safe way, and the affected maps are in the inventory under each piece's `mapIds`.

---

## 3. The guide's five lists

Effort: **S** about a day or less, **M** a few days, **L** a week or more. These are rough.

A caution on "exists": I judged fit from data, names, sizes and code. I did not look at the pieces in a browser. Whether an existing piece *looks* civilian enough is not established.

### 3.1 Urban & Civilian, row by row

**Walls (sheet row 1)**

| Sheet item | List | Evidence | Effort |
|---|---|---|---|
| Concrete, stucco, brick, siding, wood, corrugated metal walls (6) | Reuse as-is | Solid wall style plus `core.pbr_concrete`, `core.stucco`, `core.pbr_brick_red`, `core.pbr_siding`, `core.pbr_clapboard`, `core.pbr_planks`, `core.pbr_corrugated` | none |
| Wall with window | Reuse as-is | Styles `window`, `windows` | none |
| Damaged wall | Reuse as-is | Style `broken` (31 uses) | none |
| Graffiti wall | Reuse with material | No graffiti material in the library | S |

**Corners and junctions (row 2)**

| Sheet item | List | Evidence | Effort |
|---|---|---|---|
| Inside and outside corners, T, cross, end caps | Leave unchanged | Walls are cell sides; corners build themselves (1.3). Adding corner pieces would fight the system. | none |

**Doors and windows (row 3)**

| Sheet item | List | Evidence | Effort |
|---|---|---|---|
| Single door | Reuse as-is | `door_room` (2 m) plus the Door entity | none |
| Coloured house or shop door leaf | Reuse with material | Door styles are sliding, blast, saloon, vault, portcullis, oak. `kit.door.oak` has 4 looks, all oak. | S |
| Double door | Reuse as-is | `door` (3 m), `wide` (5 m) | none |
| Roll-up garage door | Reuse as-is | Palette entries "Garage Door" and "Roll-up Door"; wall style `shutter` | none |
| Four-pane window | Reuse as-is | `window` with glass | none |
| Six-pane and sash windows | Reuse as-is | `window_sash`, `windows_sash` | none |
| Roll shutter | Reuse as-is | `shutter`, "Roll-up Door" | none |
| Arched window | New geometry | The arches are all doorways. No arched window style. | S (data) |
| Shopfront glazing (guide, section 8) | New geometry | The `storefront` facade is drawn only. No wall style with a low sill and one wide pane. | S (data) |

**Roofs and coverings (row 4)**

| Sheet item | List | Evidence | Effort |
|---|---|---|---|
| Flat roof with a rooftop unit | Reuse as-is | Ceiling `roof`; `prop.nc_ac_unit`, `prop.nc_water_tank` | none |
| Flat roof with parapet | Reuse as-is | `half` walls on the level above; `core.house` has one | none |
| Shingle, clay tile and metal pitched roofs (3) | Reuse as-is | "Pitched Roof" palette entry; `core.pbr_slate_roof`, `core.pbr_roof`, `core.roof_tiles_red`, `core.pbr_corrugated` | none |
| Glass skylight | Reuse as-is | Ceiling `skylight` | none |
| Canopy on posts | Reuse as-is | Gas station tiles; blocks and columns | none |
| Shop awning | Reuse with material | `prop.awning` exists (3 uses, medieval look); props take a tint | S |
| Gable as a room's ceiling choice, with end walls | New geometry | Code tiles have gables (`gableRoof` in `packTilesMedieval.ts`), but a plain Room cannot choose one | M to L |
| Gutters and fascia (guide) | Leave unchanged | Tiny detail; the cornice trim already reads as an eave | none |

**Structural elements (row 5)**

| Sheet item | List | Evidence | Effort |
|---|---|---|---|
| Stone or concrete columns, brick pillars (2) | Reuse as-is | Room layouts (pillar, four pillars, column rows), corner columns, blocks | none |
| Portal frames and lintels | Reuse as-is | Blocks; arch styles | none |
| Steel truss | Reuse as-is | Ceiling `beams`; `prop.os_truss`; `industrial.pipe_rack` | none |
| Timber frame | Reuse as-is | Blocks with `core.oak_beam` | none |
| Raised steel platform or stand | Reuse as-is | `core.platform_rail`, `core.arena_tiers` | none |
| Scaffold you can climb | New geometry | `prop.dc_scaffold` is a small timber one (1 use). No steel scaffold bay. | M |
| Gazebo or bandstand | Reuse with small adapter | A set piece from `core.round_arcade_s` and a roof | S to M |
| Bare concrete frame (construction scene) | Reuse with small adapter | A set piece from `core.platform`, column rows and open sides | S to M |

**Stairs, ramps and vertical access (row 6)**

| Sheet item | List | Evidence | Effort |
|---|---|---|---|
| Concrete stairs | Reuse as-is | `core.stairs`, `core.stairs_open`, `core.stairwell` | none |
| Metal stairs with rail | Reuse as-is | `snow.metal_stair`, `industrial.catwalk_cross` (cross-list) | none |
| Ramp, and long ramp with rails (2) | Reuse as-is | `core.ramp`; tilted blocks; `railing` | none |
| Ladder | Reuse as-is | Ladder entity | none |
| Elevator | Reuse as-is | "Lift", "Tower Elevator" | none |
| Fire escape (guide) | New geometry | Neon pack says "Fire escapes up to the roofs" for plain ladders. No landing-and-stair piece on a building face. | M |
| Parking deck ramp and deck join (guide) | Reuse with small adapter | A set piece from `core.platform`, `core.ramp`, half walls. Not established: whether vehicles climb `core.ramp`. | M |

**Floors and ground (row 7)**

| Sheet item | List | Evidence | Effort |
|---|---|---|---|
| Concrete, jointed slab, pavers, cobble, grate, tile, planks (7) | Reuse as-is | `core.pbr_concrete`, `core.pbr_hex_paving`, `core.pbr_flagstone`, `core.cobblestones`, `core.road_setts`, `core.grate`, `core.steel_grating`, `core.white_tiles`, `core.pbr_planks` | none |
| Asphalt with white or yellow lines (2) | Reuse as-is | `core.street`, `suburban.street`, `city.street`; road paths (`PATH_STYLES` has asphalt) | none |
| Sidewalks, curbs, crossings, intersections (guide) | Reuse as-is | `core.street` (0.15 m sidewalks), `core.intersection` (crosswalks), `city.crossroads` | none |
| Tactile or studded paving | Reuse with material | Only `core.hazard` stripes come close | S |
| Parking bay markings | Reuse with material | None in the library | S |
| Curb drop or driveway join (guide) | Reuse with small adapter | No sloped curb piece. A small wedge block or prop. | S |

**Fences and barriers (row 8)**

| Sheet item | List | Evidence | Effort |
|---|---|---|---|
| Chain-link fence | Reuse as-is | `prop.so_chainlink_fence` (Snow pack, 1 use); wall style `fence` | none |
| Steel rail | Reuse as-is | `railing`; `kit.fence.iron` | none |
| Wood fence | Reuse as-is | `kit.fence.board` (never used), `prop.sb_picket_fence`, "Breakable Fence" | none |
| Jersey barrier | Reuse as-is | `kit.barrier.concrete` (4 looks, 53 uses) | none |
| Plastic barriers, orange and white | Reuse as-is | `prop.plastic_road_barrier` with a tint; `prop.nc_road_barrier` | none |
| Chain-link gate | Reuse as-is | `prop.lf_metal_fence_gate`; wall style `bars_gate` | none |
| Street bollard | New geometry | `prop.hb_bollard` is a ship's mooring bollard, a different shape | S |
| Site fence panel on feet (construction) | New geometry | None | S |

**Street and environment props (row 9)**

| Sheet item | List | Evidence |
|---|---|---|
| Street lamp | Reuse as-is | `prop.nc_streetlight` (30 uses), `prop.lightpost`, `prop.yard_lamp` |
| Traffic light | Reuse as-is | `prop.nc_traffic_light` |
| Street sign | Reuse as-is | `prop.nc_street_sign`, `kit.sign.warning` |
| Bench | Reuse as-is | `kit.seat.bench` (5 looks), `prop.mt_bench` |
| Litter bin | Reuse as-is | `kit.bin.waste` (6 looks), `prop.street_trash_can` |
| Planter and planter box (2) | Reuse as-is | `prop.potted_plant`, `prop.dc_palm_planter`; block planters in `setpiece.crossroads_plaza` |
| Fire hydrant | Reuse as-is | `prop.sb_fire_hydrant` |
| Utility box | Reuse as-is | `prop.mp_control_cabinet` (4,657 triangles, heavy for its size) |
| Air conditioner | Reuse as-is | `prop.nc_ac_unit` |
| Dumpster | Reuse as-is | Four exist (2.5) |
| Crate, pallet, barrels (3) | Reuse as-is | `kit.crate.*`, `prop.pallet`, `kit.drum.steel` |
| Sandbags | Reuse as-is | `prop.sandbag_wall` and four more |
| Traffic cone | Reuse as-is | `kit.sign.cone` (5 looks) |
| Road barricade | Reuse as-is | `prop.road_barrier`, `prop.nc_road_barrier` |
| Street mailbox | New geometry (S) | `prop.sb_mailbox` is a house mailbox on a post |
| Bike rack | New geometry (S) | None |
| Newspaper box | New geometry (S) | Only vending machines |
| Cable spool | New geometry (S) | None |

**Material variations (row 10)**

| Sheet item | List | Evidence |
|---|---|---|
| Concrete, stucco, brick, siding, wood, metal, glass, asphalt, paver, cobble, tile, roof shingle, roof tile, corrugated, painted (15) | Reuse as-is | All in `content/materials.json` |
| Weathered | Reuse as-is | `core.pbr_weathered_siding`, `core.pbr_weathered_planks`, `core.pbr_brick_old` |
| Damaged (plaster with brick showing) | Reuse with material (S) | None |

**The guide's section 8 items not covered above**

| Item | List | Evidence | Effort |
|---|---|---|---|
| Shop signs | Reuse as-is | "Neon Sign" (lit words you type), `prop.mv_shop_sign` | none |
| Balconies | Reuse as-is | `core.balcony`, `core.balcony_round`, `railing` | none |
| Building-to-building connectors | Reuse as-is | Skybridge set pieces; 28 facades | none |
| Crane for a building site | Reuse as-is | `prop.cargo_gantry_crane` (cross-list). A tower crane would be a new hero model; not proposed. | none |
| Metro and transit | Reuse as-is | 7 metro props; `prop.subway_car`; map `undergate_transit` | none |
| Porch on a house | Reuse with small adapter | A set piece: steps, `core.platform_rail`, posts, a roof block | S to M |
| Bus shelter | Reuse with small adapter | A set piece: canopy blocks, glass panel, bench, sign | S |

**Tally for Urban & Civilian (112 items checked)**

| List | Count | What they are |
|---|---|---|
| Reuse as-is | 87 | Exists now. Most only need listing under an urban pack. |
| Reuse with material | 6 | Graffiti brick, damaged plaster, parking markings, tactile paving, a painted door look, a striped awning look |
| Reuse with small adapter | 6 | Set pieces: porch, bus shelter, parking deck with ramp, concrete frame, bandstand; and a curb drop |
| New geometry | 11 | 2 wall styles (data), 6 small generated props, 2 tiles (fire escape, scaffold bay), 1 room ceiling option (gable) |
| Leave unchanged | 2 | Corner and junction pieces; gutters and fascia |

**By the sheet's six settings**

| Setting | Buildable today | What is thin |
|---|---|---|
| Residential | Yes: 8 suburban tiles, `core.house`, clapboard and brick facades, pitched roof, picket fence, 20 suburban props | Porch; coloured doors; no live map shows it |
| Commercial / Downtown | Yes: `city.*` (5), `neon.shop_a`, `core.shop`, `suburban.store`, brick and storefront facades, street props | Real shopfront glazing; awning look; street furniture gaps |
| Parking & Transit | Partly: gas station tiles, metro props, streets | Parking deck, bay markings, bollards, bus shelter |
| Warehouses & Workshops | Yes: `core.warehouse`, 7 industrial tiles, crates, drums, containers, roll-up door | Nothing important |
| Construction & Demolition | Thin: broken wall, rubble layout, cones, barriers, gantry crane | Scaffold, bare frame, site fence, cable spool |
| Public Spaces | Yes: `core.plaza`, `setpiece.crossroads_plaza`, fountains, benches, playground | Bandstand; bike rack |

### 3.2 Cross-theme use in general (brief)

- **Reuse as-is across every theme**: all 26 wall styles, all room options, the 80 `core.*` tiles (they take the map's theme), free blocks, all 150 materials, all 109 kit families, all 23 environment species, every gameplay piece. These are theme-free by design.
- **Reuse with material**: any tile through per-surface paint; any set piece through a role pack; any prop through its tint; any kit family through its looks.
- **Reuse with small adapter**: set pieces are the adapter tool. 66 exist, 64 of them suit more than one look.
- **New geometry needed in general**: tiles that paint their own boxes do not follow the theme, and MapMaker's paint cannot change them (a box's own material wins: `packages/client/src/mapMeshes.ts`). 204 of the 284 tiles do this for at least one box: 191 pack tiles and 13 core tiles. The inventory lists each one's `ownMaterials`. Giving one of those a second look means a second tile, which is what the tunnel kit's `family` idea organises (1.10).
- **Leave unchanged**: the eleven model tiles (city and neon buildings), the 1,377 pack props, and every retired id. They work, maps place them, and remaking them only for uniformity is what the guide's rule 3 forbids.

---

## 4. Baseline

### 4.1 Map compatibility tests that exist today

| Test | What it proves | Where |
|---|---|---|
| All-maps headless test | Every map in `maps/` loads, validates, builds geometry, navmesh and physics, and runs 90 ticks with bots; nobody falls out; every spawn stands on ground | `packages/shared/test/allMaps1..8.test.ts`, `allMapsCheck.ts` |
| Coverage map test | `maps/test_coverage.json` holds one of everything; new content fails this until it is placed there in MapMaker | `packages/shared/test/coverageMap.test.ts` |
| Coverage flow (browser) | Plays the coverage map in a real browser | e2e flow `coverage` (`e2e/flowMap.mjs`) |
| Tile fixture | Every tile's resolved boxes match a saved snapshot, so a shape cannot change by accident | `tilesData.test.ts`, `test/fixtures/tiles-resolved.json` |
| Materials fixture | Same for materials and themes | `materialsData.test.ts`, `fixtures/materials-resolved.json` |
| Environment fixture | Same for species shapes | `environmentData.test.ts`, `fixtures/environment-resolved.json` |
| Kit prop tests | Families, variants, aliases, budgets | `kitProps.test.ts`, `tools/content/test/kitprops.test.mjs` |
| Style pack tests | Every pack has 25 or more pieces, 6 or more gameplay pieces, a demo map file, and its tiles work | `stylePacks*.test.ts` (10 files) |
| Set piece tests | Pieces expand, mirror, re-theme and play | `setpieces.test.ts`, `setPieceExpand.test.ts`, `setPiecePlay.test.ts` and four more |
| Old-format fixtures | Maps saved at v1 to v4, v26, v27 still load | `test/fixtures/arena_v1..3.json`, `vault_v4.json`, `iron_compound_v26.json`, `cedar_lane_v27_ice_cream_truck.json` |
| Alias tests | Retired props, tiles and vehicles play as their replacements | `kitProps.test.ts`, `setPieces5.test.ts`, `mountAliases.test.ts` |
| `pnpm validate-map <file>` | Creator-facing check of one map, with the navigation audit | `packages/server/src/tools/validate-map.ts` |
| Browser map tour | Every map in a browser, nightly and on releases | e2e `mapsFlow` |
| Flicker check | Seizure safety for bright effects | e2e flow `flashing` |
| `pnpm content:check` | Generated content is up to date with its sources | `tools/content/build.mjs --check` |

I ran none of the map tests for this audit, because nothing in the game changed. The checks that were run are in section 6.

### 4.2 Numbers taken without a browser (2026-11-13, this branch)

**Pieces and triangles** (from the generated tables and lock files, through the tool)

| Measure | Value |
|---|---|
| Pieces in the inventory | 2,175 |
| Prop models | 1,377 files, 1,224,590 triangles in total, median 280, largest 19,698 (`prop.airliner_shell`) |
| Prop budget | 6,000 triangles and 400 kB each; hero tier 20,000 and 1.6 MB (`content/props.json`) |
| Kit prop files | 522 (109 families), 20.1 MB; nearest level of detail: median 254 triangles, largest 1,668 |
| Tile boxes | 8,591 boxes across 284 tiles; the heaviest are `desert.courtyard` 189, `core.round_tower` 185, `desert.house` 180 |
| Model tiles | `city.highrise` 20,693 triangles, `city.midrise` 17,102, `city.brownstone` 9,141, `neon.block_n` 4,350, others under 1,800 |

**Asset sizes on disk** (`du` on `packages/client/public`)

| Folder | Size |
|---|---|
| Whole `public` folder | 368.2 MB |
| `props` | 73.1 MB |
| `kit` | 19.2 MB |
| `env` | 5.3 MB |
| `textures` | 4.1 MB |
| `city` | 3.8 MB |
| `thumbs` (palette pictures) | 1.3 MB |
| `packs` | 0.7 MB |
| `characters` and `models` (not map pieces) | 191.5 MB and 61.7 MB |

A player downloads only what a map uses, not the whole folder.

**Maps**

| Measure | Value |
|---|---|
| Map files | 89, 26.2 MB of JSON in total |
| Largest | `st_johns` 1.45 MB (the limit is 2 MB: `map/budgets.ts`, `RESOURCE_BUDGETS.mapBytes`) |
| Smallest | `phase0_arena` 6.6 kB |
| Placed in all maps | 7,972 tiles, 46,693 entities (21,290 props, 14,760 blocks), 311 set pieces |
| Saved format versions | 54 files at v36, 35 files at v15 to v35 |

**Bundle**

- The menu's first JavaScript has a budget of 800 kB gzipped and 2,800 kB raw (`tools/ci/bundle-budget.mjs`).
- The actual size needs a client build. **Not taken** (no build was allowed in this task).
- HANDOFF records that each style pack added about 6 to 12 kB gzipped to that first download. A new code tile file would count against it.

### 4.3 Numbers that need a browser and were NOT taken

| Measure | Why not | How to take it later |
|---|---|---|
| Draw calls | Needs the renderer | `pnpm perf:budget` (`tools/perf/perf96.mjs`); the perf overlay |
| Frames per second | Needs a GPU and a browser | same |
| Memory (textures, geometry) | Needs the running page | `tools/perf/client-perf.mjs` |
| Load time | Needs a browser and network | `tools/perf/first-load.mjs` |
| Shadow casters, effects cost | Needs the renderer | `pnpm perf:budget` checks both |
| Actual menu bundle size | Needs `pnpm build` | `node tools/ci/bundle-budget.mjs` |
| Collision and navmesh build time per map | Could be taken headless, but was not; it is not a measure this audit's work can change | `pnpm bench`, `pnpm nav-audit` |

Older measured numbers exist in `docs/PERF_96.md`. I did not re-check them and do not quote them as today's baseline.

**Suggested baseline maps for the browser run** (to be approved): `riot_junction` (city tiles, live), `neon_spire` (neon towers), `ironworks` (industrial), and `frost_basin` (the map the existing budget script already uses).

---

## 5. What the guide's section 10 asks for, and what exists

| Guide asks for | Exists today? | Evidence |
|---|---|---|
| Theme filters | **Yes** | The style pack picker filters tiles, props, gameplay pieces, vehicles and pickups (`stylePackHas`; `paletteBuilder.ts`). Set pieces filter by the looks they suit. |
| Shape or function filters | **Partly** | Tiles are grouped by shape (8 groups). Props are grouped by theme, not by function. There is no "all fences" or "all doors" filter across packs; search does that job. |
| Search over one inventory | **Yes** | Fuzzy search on name, tags and pack (`paletteSearch.ts`). |
| One piece in several categories without copying files | **Yes for packs, no for prop groups** | A piece can be in many style packs. A prop has exactly one `category`, so it sits in one prop group. |
| Preview of footprint and orientation | **Yes** | See-through placement preview; `ghostWhy.ts` explains a blocked placement. Not checked in a browser. |
| Preview of snap points | **No** | There are no snap sockets (1.2). |
| Preview of collision and cover | **Not established** | I did not find a collision overlay in the editor code by search; a browser check would settle it. |
| Material variant selector | **Yes** | Kit families and species: a Variant choice in the prop inspector (`entityInspector.ts`). Tiles: per-surface paint. Set pieces: role pack. "Randomise" picks a random variant. |
| Avoid flooding the palette with colour variants | **Yes** | A kit family is one palette entry with its looks inside. 109 entries stand for 522 models. |
| Transitions / Connectors category | **No** | No such tile category or prop group. The tunnel branch adds a "Tunnels" tile group, not a transitions one. |
| Show compatible neighbours | **No** | Nothing lists which pieces fit next to which. |
| Mixed themes without changing mode | **Yes** | Packs only filter. Everything mixes. "No pack" shows all. |

---

## 6. Checks run for this audit

| Check | Result |
|---|---|
| `node tools/content/asset-inventory.mjs` run twice | The two outputs are byte for byte the same (2,175 pieces, 89 maps) |
| `node tools/content/asset-inventory.mjs --check` | Up to date |
| `pnpm typecheck` | Passes (shared, server, client, host) |
| `node tools/ci/lint-e2e-waits.mjs` | Passes |
| `pnpm ci:plan` | Plans the **full suite**. The four documents and the JSON are docs and plan nothing, but the new tool file is under `tools/content/`, which `e2e/flowMap.mjs` does not map, and an unmapped path runs everything. The tool is not wired into `content:check` or CI. Mapping it as docs-only would be a one-line change to `e2e/flowMap.mjs`, which this task was not allowed to touch. |

Not run: unit tests, e2e flows, the client build, anything in a browser. Nothing they cover was changed.
