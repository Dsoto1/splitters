# Discovery report (shared by every map brief)

What the contract's step 1 asks for: where MapMaker, the map format and the systems a map depends on live,
with their real file and API names. Written while building Sunken Kingdom (2026-10-30); paths are from the
repo root. Check a name against the code before relying on it: the code wins.

## Rules that frame every build
- `CLAUDE.md` "Maps": every map is its own file `maps/<id>.json`, made and edited with MapMaker's own tools;
  no map build scripts in the repo, no one-off code for one map. A piece a map needs goes into MapMaker
  generically (palette, inspector, logic).
- Content rules (CLAUDE.md): in-house, CC0, credit-only human-made, approved Quaternius packs, or Meshy models
  made on the owner's subscription (recorded as Meshy, owned). No raw pack files in the repo.
- `docs/map-briefs/README.md`: adaptations of the contract (docs in `docs/map-briefs/<id>/`).

## MapMaker (the editor)
| What | Where |
|---|---|
| Editor app (tools, inspector, palette, save/export) | `packages/client/src/editor/editorApp.ts` (`EditorApp`; exposed in the page as `window.__editor`) |
| 3D view, camera, picking | `packages/client/src/editor/editorView.ts` (`EditorView`: `camera`, `yaw`/`pitch`, `applyCamera()`, `focus()`, `project()`, `photoMode()`) |
| Edit commands (the undoable data every tool emits) | `packages/shared/src/editor/commands.ts`: `EditCommand` kinds `addTiles`, `removeTiles`, `updateTiles`, `addEntities`, `removeEntities`, `updateEntities`, `setMetadata`, `setTheme`, `setLogic`, `setFactions`, `setTerrain`, `setBounds`, `setTeamSetup`, `setMapBots`, `setBackdrop`, `setBlood`, `setPhysics`, `setGlass`, `setPaths`, `batch`; `applyCommand(doc, cmd)`, `newId(prefix)` |
| Running a command as a tool does | `EditorApp.run(label, cmd)` (private in TS, callable from the page): wraps it in `withTerrainUnderFloors` and pushes it on `EditHistory` |
| Shared editor operations | `packages/shared/src/editor/operations.ts`: `newMapDocument`, `placeTileCommand`, `checkPlacement`, `deleteCommand`, `moveCommand`, `rotateCommand`, `duplicateCommand`, `addSpawnCommand`, `updateTileCommand`, `moveEntitiesCommand`, `settlePropsCommand`, `paintCommand`, `setThemeCommand`, `setEdgeCommand`, `setEdgeGlassCommand`, the scenario palette's entity factory (`scenarioEntity`-style switch on palette keys such as `door:portcullis`, `water:water`, `block:rope_bridge`, `ladder:vines`), `withTerrainUnderFloors` |
| Scatter brush sets | `packages/shared/src/editor/scatter.ts` (`SCATTER_SETS`: forest, woods, autumn, mixed, jungle, undergrowth, bushes, meadow, desert, water, rocks; `scatterProps`) |
| Style Packs | `packages/shared/src/editor/stylePacks.ts` (`STYLE_PACKS`, `getStylePack`); docs `docs/BUILDING_KIT.md` "Style Packs" |
| Paths tool | `packages/client/src/editor/pathTool.ts`; data `MapPath` in schema.ts; `packages/shared/src/map/paths.ts` |
| AI routes tool | `packages/client/src/editor/routeTool.ts` |
| Save / Export / Import | `packages/client/src/editor/storage.ts`: `saveToLibrary` (browser storage), `exportMap` (stamps the map and downloads `<name>.cmap.json` via `serializeMap`), `importMapFile` (`loadMap(..., { forEditing: true })`). Buttons `#ed-save`, `#ed-export`, `#ed-import` / `#ed-import-file`, `#ed-new` (sizes 96/160/240/320 m or sky) |
| Map thumbnail | MapMaker → Set thumbnail (`editor/makerThumb.ts`, `metadata.thumbnail`/`thumbnailCamera`) |
| Open in a browser | `/?mode=editor` (`&test=1` seeded ids for tests) |

## Map format
| What | Where |
|---|---|
| Schema (zod) | `packages/shared/src/map/schema.ts`: `MapDocument` (`format: 'tiletrigger.map'`, `MAP_FORMAT_VERSION` 24), `MapMetadata`, `ClassicStructure` (`cellSize` 8 m, `levelHeight` 4 m, `theme`, `tiles: TilePlacement[]`), `MapEntity` union (spawn, pickup, door, button, destructible, zone, trap, encounter, prop, mount, pad, block, water, flag, hill, ladder, bombsite, hostage, rescue, light, airplane, mover, portal), `Terrain`, `MapBounds`, `MapPath`, `BackdropSchema`, `TeamSetup`, `MapBotSet` |
| Load / validate / serialize | `packages/shared/src/map/validate.ts`: `loadMap(json, catalog?, { forEditing })` (migrates older formats, `migrate.ts`), `validateMap(map)`, `serializeMap(map)` |
| Tile grid | Tile `(x, y, z)` centre is world `(x·8, z·4, y·8)`; cell is ±4 m; `y` grid = world +Z (north); sides `N/E/S/W` in the tile's own frame; per-side edge styles in `edges["dx,dy,dz:S"]` |
| Tile catalog | `packages/shared/src/map/catalog.ts` (`coreCatalog.byId`, `TileDefinition`: `cells`, `floors`, `ports`, `open`, `edgeDefault`, `configurable`), pack tiles in `map/packTiles.ts`, `map/packTiles2.ts`, `map/packTilesAncient.ts`; room options `ROOM_LAYOUTS`, `FLOOR_INSERTS`, `CEILINGS`, `CORNERS`, `FACADES`; edge styles `EDGE_STYLES` |
| Materials / themes | `packages/shared/src/map/materials.ts`, `map/surfaces.ts` |
| World geometry (collision boxes) | `packages/shared/src/map/geometry.ts` `buildMapGeometry(map)` → `WorldBox[]` |
| Settling | `packages/shared/src/map/settle.ts`: `terrainUnderFloors` (terrain lowered under floors on every load and edit), `settledPropY` |
| Budgets | `packages/shared/src/map/budgets.ts`, `docs/MAP_BUDGETS.md` (400 m, 1,500 tiles, 1,500 props, 80 prop models, 3,000 blocks, 32 liquids, 256 lights) |
| Retired maps (not offered anywhere) | `packages/shared/src/map/retired.ts` |

## Terrain
`packages/shared/src/map/terrain.ts`: `TerrainData` (origin, spacing 0.5–8 m, cols/rows ≤ 161, heights in cm
above `baseY`, a material per cell from `TERRAIN_MATERIALS` = grass, dirt, stone, sand, gravel, snow, moss,
mud (hex paving), `foliage` 0–4 per cell), `newTerrain`, `terrainHeightAt`, brushes `TERRAIN_BRUSHES` =
raise, lower, smooth, flatten, roughen, paint, foliage applied by `applyBrush(t, BrushStroke)`, `paintSlopes`.
MapMaker's Terrain tool (T) issues `setTerrain` per stroke. Terrain collides as a triangle mesh and is part of
the navmesh; `boundary: true` puts invisible walls round its edge.

## Liquids
`WaterEntity` (`kind: 'water'`, axis-aligned box: `position` = centre of its floor, `size`, `liquid` water / lava
/ acid / swamp, optional `tint`). `packages/shared/src/sim/liquids.ts`: `LIQUID_SPECS` (water: swim 0.7×,
wade 0.85×), `SWIM_DEPTH` 1.0 m (deeper than chest height: swimming), `BREATH_SECONDS` 15. Rendering
`packages/client/src/game/waterVisuals.ts`. Waterfall look: prop `prop.jg_waterfall` (Jungle Ruins).

## Runtime loader
`packages/client/src/mapIndex.ts` (`import.meta.glob('../../../maps/*.json')`, `MAP_INDEX`,
`loadBuiltInMap`) built by `packages/client/mapIndexPlugin.ts`: a new `maps/<id>.json` is picked up
automatically (menus, host map picker, MapMaker templates) unless listed in `retired.ts`. Play one offline:
`/?offline=<id>` (`&test=1&god=1&bots=N` for tests). Playlists `maps/playlists/`, rotations `maps/rotations/`.

## Collision, movement, navigation
- Physics: `packages/shared/src/sim/physics.ts` (`initPhysics`, `PhysicsWorld`, Rapier). Player constants
  `packages/shared/src/sim/constants.ts` `PLAYER` (`maxSlopeDegrees` 50, `maxStepHeight`, `height`, `radius`).
  Movement `sim/movement.ts`.
- Bot navigation: `packages/shared/src/nav/index.ts` (`initNavigation`, `NavWorld.build(boxes, terrainTris,
  links)` with recast at 0.2 m cells, slope = `PLAYER.maxSlopeDegrees`, `validateNavigation(map, nav)`:
  spawns on islands). The navmesh is built when a match loads; nothing is stored in the map. Docs
  `docs/BOTS.md`, `docs/PERF_96.md`.

## Modes and objectives
`packages/shared/src/sim/rules.ts`: `GameMode` ids `core.deathmatch`, `core.tdm`, `core.ctf`, `core.koth`,
`core.elim`, `core.bomb`, `core.hostage`, `core.forts`, `core.coop`, `core.zombies`, `core.discs`, `core.race`;
`playableModes(map)` (CTF and Fort Wars need a `flag` entity per team; KotH needs `hill` entities; Elimination
comes with TDM; Zombies anywhere), `rulesForMode`. Mode code `packages/shared/src/sim/modes/` (ctf, koth, elim,
bomb, hostage, forts). Teams: spawns and flags carry a faction id (`embers`, `tide` are the two default teams);
`teamSetup.sizes` recommends team sizes. Spawn choice `sim/spawns.ts`. Docs `docs/GAME_MODES.md`, `docs/TEAMS.md`.

## Pickups and weapons
`packages/shared/src/sim/items.ts` `CORE_ITEMS` (ids `core.health_small`, `core.health_large`,
`core.armor_small`, `core.armor_large`, `core.ammo`, `core.ammo_<type>`, `core.weapon_<name>`, `core.grenades`,
…); weapons `sim/weapons.ts`; pickup entity `PickupEntity` (`item`, `respawnSeconds` null = the item's own,
optional `random` category). Docs `docs/ARSENAL.md`.

## Props and assets
`packages/shared/src/content/props.generated.ts` (`CORE_PROPS`: id, file, size, collision, category; generated
from `content/props.json` by `tools/content/prepare-props.mjs`). Licences `docs/ASSET_SOURCES.md`. Asset check
`pnpm content:check` (`tools/content/build.mjs --check`) includes the map pictures
(`packages/client/public/maps/shots/<id>.jpg`, 640×360 JPEG ≤ 60 KB, for every non-retired map; made by
`tools/content/capture-map-shots.mjs` against a served build) and the MapMaker palette atlas.

## Tests and tools
- `pnpm typecheck`, `pnpm test:changed`, `pnpm content:check`, `pnpm build`.
- e2e: `e2e/run.mjs`, flows in `e2e/flowMap.mjs`; a changed `maps/<id>.json` runs the map tour part it falls in
  (`mapPartOf`: `maps`, `maps2` … `maps7`): the match starts and you spawn on solid ground, and the map opens in
  MapMaker through Import with no errors and nothing lost. One flow: `E2E_ONLY=maps3 node e2e/run.mjs`; one map:
  `E2E_MAPS=<id> E2E_ONLY=maps node e2e/run.mjs`. Ports: `E2E_CLIENT_PORT`, `E2E_SERVER_PORT`.
- Headless bot match: `AUDIT_MAPS=<id> AUDIT_SECONDS=180 pnpm exec vitest run packages/shared/test/botAudit.test.ts --silent=false`.
- Performance: `tools/perf/perf96.mjs <map>` (env `PERF_*`, see package.json `perf:budget`),
  `tools/perf/client-perf.mjs <map>`; docs `docs/PERF_96.md`, `docs/MAP_BUDGETS.md`.
- Shipped-map tests that read every map: `packages/shared/test/terrainFloors.test.ts`, `playlist.test.ts`.
