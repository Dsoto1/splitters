# Compatibility matrix (Phase 1)

Written 2026-11-13. It shows where the existing themes already fit together and where they do not.
It keeps to what the code and data show. Nothing here was checked by eye in a browser, so **seam quality is not established** anywhere in this document. The guide's "small manual visual matrix" (section 11) is still to do.

The guide's ladder, used as the key in every table:

| Key | Meaning |
|---|---|
| **1 Snap** | The pieces already fit on the grid with no extra work. |
| **2 Material** | The same shape fits; only paint, a look or a role pack is needed. |
| **3 Adapter** | A small set piece or trim piece is needed to hide or bridge the join. |
| **4 Portal** | The shapes really differ; a dedicated junction piece is needed. |
| **5 New** | No existing shape does it. |

## 1. Why most things already fit

Every theme uses one grid and one set of rules. That is why the answer is "1 Snap" far more often than the guide expects.

- One grid for all tiles: 8 m cells, 4 m levels (`schema.ts`, `ClassicStructure`).
- One rule for joins: where two tiles' ports meet there is a doorway; where two open tiles meet there is no wall (`geometry.ts`, `resolveEdge`).
- One set of 26 wall styles for every tile of every theme (`content/tiles/edges.json`).
- One material library for every surface (`content/materials.json`).
- Props, kit families and plants have no theme in the data at all. A theme is only a palette filter (`stylePacks.ts`: "everything in a pack can be mixed with anything else").

## 2. The two kinds of tile, and why it matters

The inventory shows two very different kinds of tile. This is the main compatibility fact.

| | Theme-following tiles | Self-painted tiles |
|---|---|---|
| Which | Most `core.*` tiles: 67 of 80 paint nothing themselves | Every pack's own tiles: 191 of the 193 with a pack prefix other than `city` and `neon`, and 13 `core.*` tiles |
| How they get their look | From the map's theme, or from the placement's own surfaces | Each box names its own material in code (`paint(box, ...)`) |
| Can a builder repaint one in MapMaker? | **Yes**, per slot (floor, walls, solids, underside, trim, roof) | **No.** A box's own material wins over the theme and over the placement's paint (`packages/client/src/mapMeshes.ts`: `own?.material ? own : resolveSurface(...)`) |
| Default sides | 48 of 80 default to a solid wall | Almost all default to open (they are free-standing buildings and yard pieces) |
| Cross-theme answer | **2 Material**, already possible | **1 Snap** as they are; a different look needs a twin tile (the tunnel kit's "family" idea) or **5 New** |

The eleven model tiles (`city.*`, `neon.*`) are a third case: a model drawn over box collision. Nine of them have no ports at all, so they are solid blocks you walk around, not into.

**Consequence for the urban set:** an urban building made as a self-painted code tile will look urban forever and cannot be re-skinned. An urban building made from `core.room`, wall styles, a facade and a role pack can be any look. The plan prefers the second.

## 3. Style packs against each other

### 3.1 What the packs already share

The number in each cell is **tiles shared / props shared** between the two packs' lists (from `STYLE_PACKS`). `core.yard` is in 12 packs and `core.stairwell` in 9, so 1 or 2 shared tiles is only the common core.

| | Mil | Fro | Imp | Orb | Got | Jun | Neo | Sub | Des | Med | Har | Sno | Ind |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Military** | – | 1/0 | 1/0 | 1/1 | 1/0 | 2/2 | 2/1 | 1/2 | 1/2 | 1/1 | 1/4 | **6/22** | **5/13** |
| **Frontier** | 1/0 | – | 1/0 | 0/0 | 1/2 | 1/4 | 1/0 | 1/0 | 1/11 | 1/10 | 1/7 | 1/0 | 1/4 |
| **Imperial** | 1/0 | 1/0 | – | 4/0 | 3/0 | 1/6 | 2/0 | 2/0 | **7/8** | 3/0 | 3/0 | 2/0 | 1/0 |
| **Orbital** | 1/1 | 0/0 | 4/0 | – | 6/0 | 1/0 | 3/0 | 3/0 | 4/0 | 3/0 | 3/0 | 3/1 | 2/0 |
| **Gothic** | 1/0 | 1/2 | 3/0 | 6/0 | – | 1/1 | 5/0 | 4/3 | 3/2 | 4/2 | 4/2 | 3/0 | 1/1 |
| **Jungle** | 2/2 | 1/4 | 1/6 | 1/0 | 1/1 | – | 4/0 | 1/0 | 1/11 | 1/4 | 1/5 | 1/1 | 3/3 |
| **Neon** | 2/1 | 1/0 | 2/0 | 3/0 | 5/0 | 4/0 | – | 3/0 | 2/0 | 3/0 | 3/0 | 3/0 | 3/0 |
| **Suburban** | 1/2 | 1/0 | 2/0 | 3/0 | 4/3 | 1/0 | 3/0 | – | 2/0 | 4/0 | 4/0 | 3/1 | 1/6 |
| **Desert** | 1/2 | 1/11 | 7/8 | 4/0 | 3/2 | 1/11 | 2/0 | 2/0 | – | 2/12 | 2/10 | 2/2 | 1/4 |
| **Medieval** | 1/1 | 1/10 | 3/0 | 3/0 | 4/2 | 1/4 | 3/0 | 4/0 | 2/12 | – | **7/14** | 3/1 | 1/4 |
| **Harbor** | 1/4 | 1/7 | 3/0 | 3/0 | 4/2 | 1/5 | 3/0 | 4/0 | 2/10 | 7/14 | – | 3/6 | 1/12 |
| **Snow** | 6/22 | 1/0 | 2/0 | 3/1 | 3/0 | 1/1 | 3/0 | 3/1 | 2/2 | 3/1 | 3/6 | – | **5/15** |
| **Industrial** | 5/13 | 1/4 | 1/0 | 2/0 | 1/1 | 3/3 | 3/0 | 1/6 | 1/4 | 1/4 | 1/12 | 5/15 | – |

What it shows:
- Cross-listing is already normal. Four packs list another pack's own tiles: Neon lists `city.street` and `city.crossroads`; Desert lists 11 `egypt.*` and 2 `imperial.*`; Harbor lists 2 `medieval.*`; Snow lists 4 `military.*`; Industrial lists `military.gantry` and 3 `snow.*`.
- The most shared props are plain work items: `kit.drum.steel`, `kit.crate.wood` and `kit.crate.wood_long` are each in 6 packs.
- **Suburban and Neon, the two closest to "urban", share almost nothing with each other** (3 tiles, 0 props) and little with Industrial (1 tile, 6 props; 3 tiles, 0 props). An urban pack would be the first list to bring them together.
- Themes are shared too: `core.city` is in Harbor and Suburban, `core.garden` in Medieval and Suburban, `core.castle` in Gothic and Medieval, `core.military` in Military and Snow, `core.desert` in Desert, Frontier and Imperial.

### 3.2 Where two themes' own tiles meet

All pack tiles sit on the same grid, so the horizontal join is always **1 Snap**. The risk is in three places the data shows: floor height, opening shape and roof line.

| Theme family | Floor at grid level? | Opening shape | Roof line | Joining it to a plain urban street or building |
|---|---|---|---|---|
| Core kit | Yes (8 tiles go below: pits, sunken trenches) | Standard wall styles | Flat, 4 m per level | **1 Snap** |
| City (model buildings) | Yes; kerbs "a few centimetres" (`core.json` note) | None: 3 of 5 have no ports | Model's own | **1 Snap** beside a street; you cannot walk in |
| Neon | Yes | None: all 6 have no ports | Model's own, up to 13 levels | **1 Snap** beside a street; you cannot walk in |
| Suburban | Yes (1 tile goes below) | Own doors in the tile's boxes | Pitched slate gables | **1 Snap** on plan; **2 Material** for street paving to match `core.street` |
| Industrial | Yes | Own, with a roll-up door | not checked | **1 Snap** |
| Military | Yes (sunken trenches are core tiles) | Own | not checked | **1 Snap** |
| Frontier | Yes | Own | not checked | **1 Snap**; boardwalk to pavement height is **not established** |
| Medieval | Yes (2 tiles go below) | Own, 2.2 m doors (`packTilesMedieval.ts`, `door()`) | Eaves at 8.25 m (`MEDIEVAL_EAVES`), steep gables | **1 Snap** on plan; roof lines differ on purpose |
| Gothic | Yes | Own | not checked | **1 Snap** |
| Desert | Yes | Own | Roofs at 8 m (`DESERT_ROOF`) | **1 Snap**; 8 m is exactly two levels |
| Imperial and Egypt | Yes (2 Egypt tiles go below) | Own | not checked | **1 Snap** |
| Jungle | 9 of 32 go below grid level | Own | not checked | **3 Adapter** where a sunken court meets a street |
| Harbor | **13 of 20 go below**: the sea is at -1.5 m and the bed at -4 m (`HARBOR_SEA`, `HARBOR_BED`) | Own | not checked | **3 Adapter**: a quay edge or sea-wall set piece (the `seawall` family exists) |
| Snow | Yes (1 goes below) | Own | not checked; tiles up to 7 levels | **1 Snap** |
| Orbital | Yes (1 goes below) | Own | not checked | **1 Snap** on plan |
| Terrain (hills) | Free height | n/a | n/a | **3 Adapter**: floors pull terrain to them (`settle.ts`); the tunnel branch adds real portals |

"Goes below" was counted from each tile's boxes: any box that starts more than 0.5 m under the tile's base floor. "Not checked" means I did not read that pack's roof code.

### 3.3 Set pieces across looks

Set pieces are the part of the game already built the way the guide wants: one shape, many looks.

| Role pack | Goes with style pack | Themes it claims | Set pieces that suit it |
|---|---|---|---|
| military | Military | military, bunker | 40 |
| harbor | Harbor | coastal, harbour | 36 |
| desert | Desert | desert city, egypt, desert | 32 |
| snow | Snow | snow outpost, arctic | 30 |
| imperial | Imperial | imperial, temple | 29 |
| gothic | Gothic | gothic estate, manor | 24 |
| medieval | Medieval | medieval | 24 |
| collegiate | (none) | castle | 15 |
| neon | Neon | neon megacity, neon | 15 |
| suburban | Suburban | suburban, garden | 13 |
| industrial | Industrial | industrial | 13 |
| frontier | Frontier | frontier, saloon, adobe | 12 |
| orbital | Orbital | orbital, station | 12 |
| jungle | Jungle | jungle temple, ancient temple, ruins | 8 |

- 64 of 66 set pieces suit more than one look.
- **`core.city`, `core.factory` and `core.lab` have no role pack.** These are three of the most used themes (7, 8 and 5 maps). A set piece placed in a city-themed map falls back to the theme's plain paint (`setPieces.ts`, `placementPack`). An "urban" role pack would fix that for city maps. This is **2 Material** work: one entry in `content/setpieces/roles.json`.
- The 13 pieces that suit the suburban look today: atrium tower, three catwalk bridges, crossroads plaza, loading dock, ramp junction, server vault, three skybridges, sunken arena, twin stair overlook.

## 4. Themes against the construction families (guide, section 6)

Each cell says what it takes to use that family **in an urban map**, drawing on any theme.

| Family | Core kit | Suburban | City / Neon | Industrial | Military | Medieval / Gothic / Frontier | Desert / Imperial | Harbor | Tunnels (other branch) |
|---|---|---|---|---|---|---|---|---|---|
| **Ground and floors** | 1 Snap, 2 Material | 1 Snap | 1 Snap | 1 Snap | 1 Snap | 1 Snap, look differs | 1 Snap, look differs | 3 Adapter (sea level) | 4 Portal (its own) |
| **Walls** | 2 Material (any of 150 materials) | fixed look | no walls to edit | fixed look | fixed look | fixed look | fixed look | fixed look | family switch |
| **Corners and joins** | automatic | in the tile | in the model | in the tile | in the tile | in the tile | in the tile | in the tile | its own profiles |
| **Ceilings and roofs** | 2 Material: roof, skylight, beams, vault. Gable: **5 New** | gables in the tile; "Pitched Roof" block | model | in the tile | in the tile | gables in the tile | in the tile | in the tile | lining |
| **Vertical movement** | 1 Snap: 8 vertical tiles, ladders, lifts | in the house tile | none inside | 1 Snap: silo stair, catwalks | 1 Snap: tower | 1 Snap: outside stairs | 1 Snap | 1 Snap | slopes planned |
| **Structural** | 2 Material: layouts, corner columns, blocks | – | – | 1 Snap: pipe rack, gantry | – | – | 1 Snap: columns as props | – | – |
| **Openings** | 2 Material: 26 wall styles. Shopfront, arched window: **5 New** (data) | own | none | roll-up door | gate | own | own | own | gates planned |
| **Edges and trim** | baseboard, cornice, frames built in. Gutter, fascia: not present, not proposed | – | – | – | – | – | – | – | – |
| **Transitions** | **3 Adapter**: set pieces. No transitions category | – | – | loading dock set piece | – | – | – | sea wall set pieces | portals and collars planned |
| **Gameplay** | 1 Snap everywhere: cover, doors, glass, destructibles, movers are theme-free entities | | | | | | | | |

How to read the fixed-look cells: the piece **fits** (1 Snap) but **cannot be repainted** (section 2). If an urban map wants a medieval house in brick, that is 5 New, or a twin tile in the tunnel kit's way. The guide's section 7 says not to do that anyway ("do not force medieval arches onto military walls").

## 5. Props and kit families against themes

| Kind | Fit across themes | Why |
|---|---|---|
| Kit prop families (109) | **1 Snap** everywhere; **2 Material** through looks | Made in code with 2 to 7 looks each. One size and one collision per family. |
| Environment species (23) | **1 Snap** everywhere; **2 Material** through season variants | Same reason. |
| Pack props (1,377) | **1 Snap** everywhere; a tint is the only variation | One model each. 255 are ours and could gain looks; the CC0 ones are fixed models. |
| Vehicles, turrets, gameplay pieces | **1 Snap** everywhere | No theme in the data. |

One limit: a prop has **one** palette category, so it shows in one prop group. `prop.nc_streetlight` is a plain street light but sits under "Neon Megacity" in the Sci-Fi group. Style packs can list it anywhere (that works today); the prop group cannot. Search finds it.

## 6. Where shapes fundamentally differ (4 Portal)

Only these, as far as the data shows:

| Join | Why it is a real mismatch | What exists |
|---|---|---|
| Vaulted passage to a square corridor | A vaulted passage is narrower and round-headed. The seating tier's passage is 3.2 m wide and 3 m high, "the size of a Round arch" (its note in `core.json`); a standard doorway is 3 m or 5 m square. The Vaulted Tunnel's own size was not checked. | The `arch_round` wall style (3.2 m by 3 m) is made to meet it |
| Any tunnel to open terrain | Terrain is one height per point with no holes | The tunnel branch's Tunnel Portal (not on main) |
| Sea-level harbor pieces to dry ground | 1.5 m drop to the sea, 4 m to the bed | `seawall` set pieces; harbor quay tiles |
| Sunken trench or pit to street level | 1.5 m drop | `core.trench_sunk_end`, trench step tiles |
| Model buildings to rooms | No ports: nothing connects inside | None. By design they are backdrop you can stand on or beside. |

None of these is an urban-only problem, and none needs new work for Tileset 11.

## 7. What this means for Urban & Civilian

1. **Build urban buildings from theme-following pieces**: `core.room` and its relatives, wall styles, a facade, a role pack. They are the only pieces that can change material later.
2. **List, do not copy.** Suburban, City, Neon and Industrial pieces all snap together already. An urban pack is a list.
3. **Add an `urban` role pack** so the 66 set pieces look right in city maps.
4. **Make the few missing shapes as data or as kit families**, which carry looks, not as self-painted tiles.
5. **No transition kit is needed for urban.** The only real transitions (sea, tunnels, terrain) belong to other themes and already have owners.
