# Urban & Civilian plan (Phase 1)

Written 2026-11-13. It follows from `ASSET_AUDIT.md` and `COMPATIBILITY_MATRIX.md` in this folder.
**Nothing here is built.** The guide says no geometry, catalogue, format, material, tile, prop or map change before the plan is approved. This is the plan to approve, change or reject.

Effort: **S** about a day or less, **M** a few days, **L** a week or more. Rough, and none includes the owner's review time.

## The idea in four lines

1. Tileset 11 is mostly here already: 87 of the 112 things checked exist.
2. So step one is a **list**, not models: one urban pack that points at existing pieces.
3. Then fill the real gaps, smallest first: 6 materials, 2 wall styles, 6 small props, 6 set pieces, 2 tiles.
4. Build new things the way that keeps shape and material apart: data, kit families with looks, set pieces with role packs. Avoid self-painted tiles where a re-paintable piece will do.

## 1. Prioritised list

"Unlocks" uses the sheet's six settings: **Res**idential, **Com**mercial / Downtown, **Park**ing & Transit, **Ware**houses & Workshops, **Con**struction & Demolition, **Pub**lic Spaces.

### Step A. Catalogue only (guide Phase 2). No new shapes.

| # | Item | Type | Unlocks | Effort | How it is built here |
|---|---|---|---|---|---|
| A1 | An urban list of existing pieces: about 30 tiles (suburban 8, city 5, neon shop and block, industrial 7, core house, shop, gas station, street, intersection, warehouse, plaza, stairs, ramp, platforms), about 60 props and kit families (street lights, traffic lights, signs, benches, bins, dumpsters, barriers, cones, fences, hydrant, vending, AC units, cars, metro and gas station props), about 20 materials, 7 facades (brick, storefront, plaster, clapboard, suburban brick, glass, corrugated) | Reuse | All six | S | One entry in `STYLE_PACKS` (`packages/shared/src/editor/stylePacks.ts`). Ids only; no file is copied. See decision 1 for "new pack or extend". |
| A2 | An `urban` role pack so the 66 set pieces look right in city maps. Today `core.city`, `core.factory` and `core.lab` have none. | Material variant | All six | S | One entry in `content/setpieces/roles.json` (roles: stone, trim, floor, paving, roof, wood, metal, facade, door, glass), then `node tools/content/setpieces.mjs`. |
| A3 | Tick the set pieces that suit it (crossroads plaza, loading dock, skybridges, stair towers, atrium, catwalks and others) | Reuse | Com, Ware, Pub | S | Add `urban` to each piece's `packs` in `content/setpieces/<family>.json`. Each is checked by `setpieces-check.ts`. |

After step A a builder can pick "Urban & Civilian" and build five of the six settings from what exists. Construction stays thin.

### Step B. Materials and looks (guide Phase 3). Same shapes.

| # | Item | Type | Unlocks | Effort | How it is built here |
|---|---|---|---|---|---|
| B1 | Parking bay markings (white lines on asphalt) | Material variant | Park, Com | S | A material in `content/materials.json`: either a pattern (`PATTERN_IDS` in `map/materials.ts`, drawn in `packages/client/src/materials/patterns.ts`) or the existing asphalt texture with painted lines. Then `pnpm content:materials`. |
| B2 | Tactile paving (yellow studs) | Material variant | Park, Pub | S | Same. |
| B3 | Graffiti on brick | Material variant | Com, Con | S | Same. Our own painted pattern; no downloaded artwork. |
| B4 | Damaged plaster with brick showing | Material variant | Con, Res | S | Same; or an ambientCG CC0 set through `content/textures.json`. |
| B5 | Painted door looks (red, blue, white, glazed shop door) | Material variant | Res, Com | S to M | New looks on the kit door generator: a family beside `kit.door.oak` in `content/kitprops/door.json`. A door that opens by itself is the Door entity; a new `DOOR_STYLES` value would be a schema change (decision 4). |
| B6 | Striped shop awning looks | Material variant | Com | S | A small kit family with looks (a canopy generator in `tools/content/kit/shop.mjs`), since `prop.awning` is a fixed CC0 model that only takes a tint. |
| B7 | Give library materials their real surface type (glass, wood, metal, brick) | Data fix | All six | S | The optional `surface` field in `content/materials.json`. Today 0 of 150 set it, so impact effects are guessed from the id. **This changes impact effects and sounds on existing maps**, so it is a gameplay-feel change: decision 8. Not needed for urban; listed because the guide asks for correct penetration data. |

### Step C. Small new shapes as data and as generated props (guide Phase 4, cheapest part)

| # | Item | Type | Unlocks | Effort | How it is built here |
|---|---|---|---|---|---|
| C1 | Shopfront wall style: a low riser and one wide pane that takes glass | New geometry (data) | Com, Res | S | One entry in `content/tiles/edges.json` (segments, trim, `openings`, `"glass": true`), then `node tools/content/tiles.mjs`. Works on every tile of every theme at once. Decision 4. |
| C2 | Arched window wall style | New geometry (data) | Com, Pub, Res | S | Same file, using the existing `arch` trim builder. Decision 4. |
| C3 | Street bollard (looks: yellow, steel, concrete, striped) | New geometry (kit family) | Park, Com, Pub | S | `kit.barrier.bollard` in `content/kitprops/barrier.json`; the generator is `tools/content/kit/yard.mjs` or a new small one. Three levels of detail and a triangle budget in `content/kitprops.json`. |
| C4 | Bike rack | New geometry (kit family) | Pub, Com, Park | S | Same route. Collides as thin bars so shots pass, like `kit.fence.rail`. |
| C5 | Street mailbox and newspaper box (two families, several colours) | New geometry (kit family) | Com, Res | S | Same route; box collision; surface `sheet_metal`. |
| C6 | Cable spool (looks: wood, weathered, empty) | New geometry (kit family) | Con, Ware | S | Same route; the drum generator (`tools/content/kit/drum.mjs`) is close. |
| C7 | Chain-link fence family: panel, gate, and a site panel on feet (looks: galvanised, green, rusty) | New geometry (kit family) | Con, Park, Ware, Res | M | A new `style` in the fence generator (`tools/content/kit/fence.mjs`). If it takes the exact size of `prop.so_chainlink_fence` (3.087 x 2.36 x 0.599 m), that prop could later play as it through an alias; not proposed now. |
| C8 | Curb drop wedge | Adapter | Res, Park | S | A tilted block saved as a tiny set piece, or a kit family. Check first whether vehicles need it at all: the sidewalk is 0.15 m and players step 0.3 m. Vehicle behaviour on the kerb is **not established**. |

### Step D. Adapters as set pieces (made in MapMaker from existing pieces)

| # | Item | Type | Unlocks | Effort | How it is built here |
|---|---|---|---|---|---|
| D1 | Porch: steps, a railed deck, posts, a lean-to roof | Adapter | Res | S to M | Built in MapMaker, "Save selection as set piece", then stored in `content/setpieces/porch.json` with roles instead of fixed materials, so it follows the role pack. |
| D2 | Bus shelter: canopy, glass back, bench, sign | Adapter | Park, Pub | S | Same. |
| D3 | Parking deck bay and deck ramp: open deck on columns, half-wall parapet, ramp, bay markings (B1), bollards (C3) | Adapter | Park | M | Same, from `core.platform`, `core.ramp`, wall style `half`. First check that vehicles climb the ramp (not established). |
| D4 | Bare concrete frame, 1 and 2 storeys | Adapter | Con | S to M | Same, from `core.platform`, the column rows layout and open sides. |
| D5 | Bandstand or gazebo | Adapter | Pub | S to M | Same, from `core.round_arcade_s` and roof blocks. |
| D6 | Shop unit: a Room with the shopfront style (C1), awning (B6), sign, counter | Adapter | Com | S | Same. Depends on C1. |

Each new set piece family also gets a label in `SET_PIECE_FAMILIES` (`packages/client/src/editor/paletteCatalog.ts`).

### Step E. New tiles (only where nothing else will do)

| # | Item | Type | Unlocks | Effort | How it is built here |
|---|---|---|---|---|---|
| E1 | Fire escape: a narrow landing on a building face with a switchback stair, 1 cell, stackable by level | New geometry (tile) | Com, Res | M | Prefer a **data tile** in `content/tiles/core.json` (parts `flight`, `rail`, `box`), id `core.fire_escape`, so it follows the theme and can be repainted. A self-painted code tile only if the data builders cannot do it. |
| E2 | Scaffold bay: two decks on tube frames with a ladder side, 1 cell, 2 levels | New geometry (tile) | Con | M | Same preference: a data tile first. |
| E3 | Gable as a room ceiling choice, with end walls | New geometry (room option) | Res | M to L | A new value in `CEILINGS` (`map/tileOptions.ts`) and its builder in `map/geometry.ts`, reusing `gableRoof` from `packTilesMedieval.ts`. A schema value: decision 5. The "Pitched Roof" block covers most needs today. |

### Step F. Prove it (guide Phase 5)

| # | Item | Effort | How |
|---|---|---|---|
| F1 | Every new piece placed in the coverage map | S each | In MapMaker: open `maps/test_coverage.json`, place, save, export over the file. `coverageMap.test.ts` fails until done. Needs a browser. |
| F2 | Palette pictures | S | `pnpm content:rebuild` (the atlas tool drives a browser). |
| F3 | Fixtures refreshed and read | S | `tiles-resolved.json`, `materials-resolved.json`: the diff must show only the new entries. |
| F4 | A demo map built in MapMaker (decision 6) | M to L | `maps/<id>.json`, made with MapMaker's tools only (CLAUDE.md, "Maps"). |
| F5 | Performance before and after | S | Baseline run on the maps named in the audit (4.3), then again. Decision 7. |
| F6 | Seam check by eye | S | Urban pieces beside Suburban, City, Neon, Industrial and Harbor pieces: the guide's small visual matrix. |

### The smallest useful set

If only a little is wanted: **A1, A2, A3, B1, C1, C3**. That is one list, one role pack, one material, one wall style and one small prop. It needs no map format change and makes Residential, Commercial, Warehouses and Public Spaces first-class, and Parking usable.

## 2. Decisions for the owner

Each has a recommendation. Reply with the numbers and letters.

**1. Where does the urban list live?**
- (a) A new style pack, 14 "Urban & Civilian", listing existing pieces by reference. Suburban, Neon and Industrial stay as they are.
- (b) Extend 08 Suburban Chaos and 07 Neon Megacity with each other's pieces and the new ones. No new pack.
- (c) Rename and widen 08 Suburban Chaos into the urban pack.
- **Recommended: (a).** It is the guide's "a tileset is a curated theme of references". It touches no existing pack. (c) would change a pack whose id tiles carry (`suburban.*`); ids must stay.

**2. May existing pieces be listed under more packs?**
- (a) Yes, freely. (b) Only in the new urban pack. (c) No.
- **Recommended: (a).** It already happens: 29 tiles and 99 props and kit families are in more than one pack. It copies nothing.

**3. How should an urban piece carry "same shape, other material"?**
- (a) Use what main has now: paint per surface, facades, kit looks, role packs. No format change.
- (b) Wait for the tunnel kit's `family` field (map format v37, on `origin/wip/tunnels`) and use it for urban tiles too.
- (c) Add a separate urban field.
- **Recommended: (a) now, (b) later if it lands and a real need shows.** Nothing in steps A to D needs a tile family. (c) would be a second way to do one thing.

**4. New wall styles (shopfront, arched window) and possibly a door style. NEEDS EXPLICIT APPROVAL.**
A map that uses a new style cannot be read by an older build of the game. It is additive (no existing map changes), but one-way.
- (a) Approve, with no format version bump, as was done for the sash windows and the Room doorway on 2026-11-12 (commit `12d3f0d`).
- (b) Approve, with a version bump and a "nothing to do" migration, as v16 and v27 did.
- (c) Not now: build shop windows from the Wide doorway and a Glass Panel instead.
- **Recommended: (a) or (b) as the owner's rule is; I lean (b)** when it lands in the same release as the tunnel kit's v37, so one bump covers both. Coordinate with that lane. Which of the two the project prefers is **not established**: both have precedent.

**5. Gable roof as a room ceiling choice (E3)?**
- (a) Now. (b) Later, after a demo map shows the Pitched Roof block is not enough. (c) Never.
- **Recommended: (b).** It is the largest single item and the block already makes gables.

**6. Demo map.** The style pack test requires every pack to name a demo map file. The Suburban demo (`cedar_lane`) is retired, and no playable map places a `suburban.*` tile.
- (a) A new small urban map, built in MapMaker, after steps A to C.
- (b) Point the pack at an existing playable city map (`riot_junction` places the city tiles) and add urban pieces to it in MapMaker.
- (c) Refresh `cedar_lane` in MapMaker and bring it back.
- **Recommended: (b) first, (a) when the pieces are approved.** (b) gets real use on a live map at once.

**7. A browser performance baseline before any building?** The audit could not take draw calls, frame rate, memory or load time.
- (a) Yes: run the existing perf scripts on `riot_junction`, `neon_spire`, `ironworks`, `frost_basin` and record them in this folder.
- (b) No: rely on the CI perf budget alone.
- **Recommended: (a).** The guide asks for a baseline before edits, and it is a short job for a session that may use a browser.

**8. Fix material surface types (B7)?** It would make shots on glass, wood and metal surfaces look and sound right, on every map.
- (a) Yes, as its own change with the gunplay documents read first. (b) Not part of this work.
- **Recommended: (b) for now**, raised with the weapon lane. CLAUDE.md requires reading the gunplay spec before changing ballistics, and it is not an urban gap.

**9. Tidy-ups the audit found. No deletion is proposed in any case.**
- Five packs list 18 retired plant props in total. Two pairs of props share one model file (`prop.dc_well` and `prop.mv_well`; `prop.ww_general_sign_b` and `_c`). Four dumpsters do one job.
- (a) Leave everything. (b) Remove the retired props from the pack lists only (a list edit; no id changes). (c) Also merge duplicates through aliases.
- **Recommended: (b).** (c) gains almost nothing and would touch maps: `market_town`, `qasr_medina`, `sandgate` and `test_coverage` place the wells.

**10. Hero models (a tower crane, a detailed bus)?**
- (a) None; use what exists (`prop.cargo_gantry_crane`). (b) A short list for Meshy, approved one by one.
- **Recommended: (a).** The guide says to build only what unlocks layouts.

## 3. What in the guide would be a breaking change here

None of these is proposed. They are listed so nobody does them by accident.

| Guide text | Why it would break this repo | What to do instead |
|---|---|---|
| The sheet's 1 m grid, 3 m walls, 2.1 m doors (sections 1, 14 call it "not authority") | Every tile assumes 8 m and 4 m (`TILE_DIMENSIONS`, `SET_PIECE_GRID`); all 89 maps use them | Keep 8 m and 4 m. New openings are wall styles inside an 8 m side. |
| Section 5's example schema (`geometryRef`, `materialVariant`, `snapProfile`, `collisionRef` on every asset) | It would rewrite the registries and every generated table | The same split already exists as tiles plus surfaces, kit families plus looks, set pieces plus role packs. The guide itself says "not a required rewrite". |
| Section 6, corner and junction pieces | Walls are cell sides and corners build themselves; placeable corners would double up | Leave unchanged. |
| Section 5, "snap sockets" | Props have none; tiles have ports | Keep ports and grid snap. |
| Section 4, "deduplication" | Removing or renaming an id breaks saved maps | Aliases only, and only with the affected maps listed (the inventory has them). |
| Section 10, a prop in several categories | A prop has one `category`; changing it moves it in the palette | Use style packs for cross-listing. A category change is safe for maps (maps do not store it) but should be deliberate. |
| Any change to a kit family's size or collision | It changes cover and movement on every map that places it | The pipeline already demands an `assetVersion` bump and a note. New looks are free. |
| New values in schema lists (wall styles, door styles, ceilings, facades) | Older builds reject a map that uses them | Decision 4 and 5. |
| A new field on placed tiles (`family`) | Map format bump | Owned by the tunnel lane (v37). Not ours to add. |
| Self-painted code tiles for urban buildings | Not breaking, but they can never be repainted and each pack file adds to the menu's first download (budget 800 kB gzipped; about 6 to 12 kB per pack so far) | Prefer data tiles and set pieces (steps C to E). |

## 4. Order of work and what each step needs

| Step | Needs approval of | Needs a browser? | Touches maps? |
|---|---|---|---|
| A | Decisions 1, 2, 6 | Only for the demo map and palette pictures | The demo map only |
| B | Decision 3; B7 needs decision 8 | Palette pictures; coverage map | Coverage map |
| C | Decision 4 for C1 and C2 | Palette pictures; coverage map | Coverage map |
| D | Step A's role pack | Yes: set pieces are made in MapMaker | Coverage map |
| E | Decision 5 for E3 | Palette pictures; coverage map | Coverage map |
| F | Decision 7 | Yes | Coverage and demo maps |

Every step ends with: `pnpm content:check`, `pnpm typecheck`, `pnpm test:changed`, `pnpm e2e:changed`, then a `check/<name>` branch, as CLAUDE.md sets out.

## 5. Not established, to settle before building

- Whether existing pieces look civilian enough. Nothing was viewed in a browser.
- Draw calls, frame rate, memory, load time and the real menu bundle size (audit, 4.3).
- Whether vehicles climb `core.ramp` and cross a 0.15 m kerb (matters for parking decks and curb drops).
- Whether the project wants a version bump for new wall styles (decision 4).
- Whether the tunnel kit's `family` field will land as it is on its branch. The plan does not depend on it.
- Whether the 10 facades no map names are applied through role packs when set pieces load.
