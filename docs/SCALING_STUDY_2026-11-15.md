# Scaling study: streaming, foliage, interiors, bot navigation (2026-11-15)

The owner asked (2026-11-15): "are we able to investigate region-based streaming, foliage instancing, modular
interior loading, and hierarchical bot navigation." This is the study: what the code does today, what is missing,
what each would buy (measured where it could be), the design that fits Tile Trigger, risks, size and order. No code
was changed. Written by a helper of lane A's lead.

## In plain words (for the owner)

- **Yes, all four can be done, but they are not equally worth it.** Our maps are capped at 400 m across and 4,096
  entities, and the biggest map file is 1.3 MB (St. John's). At that size the whole map already fits comfortably in
  memory on the host and on every player's machine. What costs time is drawing it and, on the host, building the bots'
  navmesh when a match starts.
- **1. Region streaming (load near, unload far): not now.** In an FPS where a sniper sees across a 400 m map, you
  can't throw away what's far; we already draw far things cheaply (lighter levels of detail, batches by wider squares).
  Real streaming would be a big job (several landings) for little gain at our map size. The cheap, useful part is
  **"what you see first, first"**: build the spawn's surroundings first and the rest just after, so a match starts
  sooner. Revisit real streaming only if you want maps bigger than 400 m.
- **2. Foliage instancing: mostly done already.** Trees, shrubs, grass and flowers are already drawn as instances in
  squares, with levels of detail, a flat stand-in far away, wind in the graphics card, density by graphics setting and
  shadows only in the cascades they reach (the 2026-11-14 work). What's left is polish: better far trees (true
  "impostor" pictures instead of two crossed cards), and grass that fades instead of popping. GPU culling needs WebGPU
  and isn't worth it yet. Small items, not a project.
- **3. Interiors drawn only when they matter: the best win of the four.** Most furniture on our big maps is indoors:
  about three quarters of St. John's props (621 of 844), 59 % of Norman Shores', 69 % of Capitol Mall's. Today all of it
  is drawn whenever it is in front of the camera, even behind solid walls. Hiding a building's insides when no doorway
  or window of it can be seen, and loading its furniture models only when you come near, cuts work on every map with
  buildings, for official and community maps alike, with nothing for the map maker to do (the game works out the
  buildings from the map).
- **4. Smarter long-distance bot routes: not needed for speed today; the navmesh build is the thing to fix.** Bots'
  route searches are already cheap: a typical one takes about a tenth of a millisecond even on the biggest maps, and
  64 v 64 spends about 1-2 % of the host's tick on them. The costly part is building the navmesh when a match starts
  (2-6 seconds of CPU on our busiest maps) and in MapMaker's map check. **Keeping a built navmesh for the next match
  on the same map** is a quick win; **a navmesh in tiles** is the bigger step that later also lets breakable walls
  open new routes, makes MapMaker's check quicker after an edit, and gives the "region graph" for long routes if maps
  ever grow.
- **Recommended order:** navmesh kept between matches (XS-S) → interiors hidden behind walls (M) → interior furniture
  loaded on approach (S) → search budget by time (S) → spawn-first build order (M) → foliage polish (S each) → tiled
  navmesh (L) → real streaming and a region graph only if maps grow past 400 m.

Questions for you are at the end.

## How it was measured

- **Headless, shared code** (a scratch vitest file, not committed): each map loaded, its geometry, physics and navmesh
  built as the match builds them (`sim/mapNav.ts` `buildMapNav`), then 300 route searches between seeded random pairs
  of the navmesh's main-area places (`NavWorld.findPath`, partial routes allowed, a third of them with the cover
  filter `open`). The six slowest searches of each map were repeated three times to tell real cost from noise.
- **Host bench:** `pnpm bench 128 20 maps/st_johns.json maps/norman_shores.json --mode=core.tdm` (64 v 64, 4 viewers).
- **Browser** (a scratch Playwright script against `vite build` output, SwiftShader, High): the resident scene after
  the match starts: meshes, vertices, triangles held, thin-instance copies by kind, textures, JS heap. See
  "Client scene inventory".
- **The machine:** a shared 4-core box at load 21-25 (two other helpers working). Wall-clock times are about twice CPU
  time here; CPU times are given where they matter. An M1 Pro or a desktop core is roughly 2-4 times faster than this
  box per core. Treat every time as an order of magnitude, the counts as exact.

## The maps (sizes)

| Map | File | Extent (m) | Level boxes | Props (env species) | Terrain triangles | Colliding env shapes |
|---|---|---|---|---|---|---|
| St. John's | 1,295 KB | 402 × 306 | 5,604 | 983 (139) | 38,400 | 678 |
| Iron Coast | 998 KB | 386 × 324 | 5,808 | 333 (170) | 155,648 | 167 |
| Apex Ring | 1,011 KB | 402 × 402 | 2,588 | 276 (0) | 51,200 | 0 |
| The Spillway | 830 KB | 322 × 322 | 1,006 | 2,248 (2,239) | 51,200 | 1,946 |
| Norman Shores | 792 KB | 322 × 322 | 3,492 | 956 (267) | 51,200 | 862 |
| Diamond Park | 789 KB | 242 × 242 | 3,274 | 329 (0) | 28,800 | 0 |
| Capitol Mall | 628 KB | 322 × 162 | 3,446 | 661 (12) | 25,600 | 12 |
| Backwoods | 335 KB | 162 × 194 | 1,737 | 782 (177) | 15,360 | 188 |
| Frost Basin | 284 KB | 306 × 306 | 1,043 | 257 (0) | 45,000 | 0 |

Map budgets (docs/MAP_BUDGETS.md): 400 m footprint, terrain up to 320 m, 4,096 entities, 1,500 props, 3,000 blocks,
4,000 env species. Every map is inside them; St. John's sits at the footprint limit.

## 1. Region-based streaming

### What exists today
- **Download:** the menu loads no maps; a map is its own chunk, fetched when played (docs/LOADING.md). Map content
  tables (tiles, props) load with the first map. Prop, env and character models load per model on demand
  (`content/models.ts` `ModelLibrary.load`, one `AssetContainer` per file, cached per scene); a prop shows a stand-in
  until its model is in. Nothing is per region.
- **Build:** `View.buildMap` (client `game/view.ts`) builds the whole map at once: the level (one mesh per style,
  merged into 128 m squares over array textures, `levelMerge.ts` `MERGE_CHUNK`), roads and paths (merged per 128 m),
  border and backdrop, the effects physics world (ragdolls, debris), foliage for the whole terrain (`foliage.ts`
  places every plant up front: Iron Coast 62 k plants in about 300 ms), environment species (`environmentVisuals.ts`),
  every prop node or batch (`propBatches.ts`), the scenario. The loading gate (`prewarm`) waits for the merged level,
  the prop batches and the shaders.
- **Culling:** frustum culling per mesh or per batch square; levels of detail by distance (env species, prop batches,
  characters); grass drawn within 50-130 m by kind; far batches in squares up to 512 m.
- **Simulation:** the match (host: a browser's sim worker or the dedicated server) holds the whole map: geometry,
  Rapier physics, navmesh, scenario. Each client also holds a prediction physics world of the whole level and an
  effects world. Snapshots already send only what a player needs to see in detail (`net/interest.ts`, delta snapshots).

### What it would buy, measured
- **Download:** little. The largest map file is 1.3 MB (raw JSON; gzipped far less). The big downloads are models
  (`public/`: props 76 MB, models 63 MB, characters 230 MB in all, each map using a few dozen), which already load per
  model on demand.
- **Host:** nothing. Bots go everywhere; the host must keep the whole map's physics and navmesh (the shared
  deterministic sim needs the same world everywhere it runs).
- **Client physics:** small. Building the prediction physics of the whole level took 0.07-0.8 s wall here (St. John's
  0.2-0.66 s, Iron Coast 0.8 s); Rapier's broad phase already ignores far colliders.
- **Client drawing and memory:** this is where streaming would act. See "Client scene inventory" for what a whole-map
  build holds. Frustum culling and levels of detail already keep far regions cheap to draw; what remains is memory
  (meshes and textures held for regions you are not in) and the time to build them before play.
- **Time to play:** a whole-map build is on the loading screen's path. Building the spawn's surroundings first would
  let play start sooner on the biggest maps.

### Design that fits
Maps stay declarative and MapMaker-authored; regions should be **worked out, not authored**: a fixed grid (128 m, the
level merge's and prop batches' square) over the map's extent. Nothing new in the map format; community maps get it
for free.

1. **Spawn-first build order (recommended, M):** `buildMap` builds the squares within about 128 m of the local
   player's spawn (level merge chunks, props, foliage sectors, env batches) before the loading gate opens, and the
   rest over the next frames with the existing frame spreader (`game/frameSpread.ts`, a time budget a frame). The far
   squares are far by construction, so a frame or two of them missing is not seen; a spectator or a camera cut waits
   for its square. Sim, physics, prediction: unchanged (whole map).
2. **Real streaming (not recommended now, L+):** unload squares past a distance and rebuild them on approach. At
   400 m that saves memory but costs hitches when you turn and walk, and sight lines across the map need the far
   representation anyway. Worth it only with much bigger maps, and then as a "far representation always resident,
   near detail streamed" scheme (the far level of each square kept: merged level, far tree cards, no furniture).
- **MapMaker:** keeps the whole map (an editor needs it), but can use the same grid to rebuild only the squares an
  edit touches (it already patches faces incrementally, `facesUpdate.ts`).
- **Content pipeline:** per-pack content (docs/CONTENT_SCALABILITY.md) already decides downloads per model; streaming
  needs no pipeline change. Texture streaming (low mip first) would be a separate, model-loader change.

### Risks
Pop-in at square edges on a fast vehicle; a camera cut (spectating, kill cam) into a square not yet built; any code
that assumes a prop node exists for every prop (`View.props` by index: breakables, flames, carried props) must keep
working with deferred squares; doubled cost if a square is built twice.

### Size
Spawn-first build order: M. Real streaming: L (several landings), not recommended at 400 m.

## 2. Foliage instancing

### What exists today (measured or read in code)
- **Environment species** (`environment/environmentVisuals.ts`, on by default): every `env.*` tree, shrub, boulder,
  cliff drawn as **thin instances** batched by (variant, level, material, square). Squares grow with the level of
  detail: 64 m at full detail, 128, 256, 512 m (`sectorSize`, render cost step 1). Each copy picks its level by camera
  distance with ±10 % hysteresis whenever the camera moves a metre; a batch's buffer is rebuilt only when a copy joins
  or leaves; bounds per batch for frustum culling. The farthest level is a **crossed-card stand-in** (`crossed`
  glTF extra), and stand-ins and light levels cast no shadow. Cover and blocking species are never culled by distance
  (gameplay rule); graphics tiers move the level distances (`lodScale` 0.6 / 0.8 / 1).
- **Wind** is already in the vertex shader (`envMaterials.ts`: a material plugin reading per-vertex sway and flutter
  weights; GLSL and WGSL), by tier (`wind` 0 / 0.6 / 1). Colliders never move.
- **Terrain plants** (`foliage.ts`): grass, tufts, flowers, ferns, bushes, pebbles and eelgrass grown from the
  terrain's paint, seeded by the map, as thin instances: thinned per 32 m chunk, drawn per 64 m sector, each kind
  within its range (grass 60 m … bushes 130 m), **density and range by graphics setting** (`DETAIL`: Low 35 % density
  at half range, Medium 75 % at 0.8, High full), faded out over the far 65 % of the range by thinning.
- **Prop batches** (`game/propBatches.ts`): props with 8+ copies as thin instances per model, material and square
  (128 m; lighter levels 256 and 512 m), levels of detail by distance, small clutter casts only near the camera, indoor
  props out of the sun's shadow pass.
- **Shadows:** since render cost step 1 an environment or prop batch draws only into the cascades its bounds reach
  (`game/atmosphere.ts`). The sun shafts draw only occluders that can hide the sun.

### What remains
| Item | Today | Gap | Worth |
|---|---|---|---|
| GPU culling | CPU frustum test per batch | per-instance culling on the GPU | Needs WebGPU compute (we default to WebGL2); batches are already small squares. **Not worth it now.** |
| Far trees | crossed cards at the last level | octahedral impostors (a baked atlas of views per variant) | Looks better at 150 m+, same cost. **Polish (S-M)**: a bake step in `tools/content/environment.mjs`, a shader. |
| Wind | vertex shader, by tier | none | Done. |
| Density by graphics | plants by `DETAIL`, trees by `lodScale` | none for plants; trees never thinned (cover rule) | Done. |
| Per-cascade shadows | batches into the cascades they reach | per-instance (a far copy in a near batch still casts) | Small: near batches are 64 m. |
| Grass pop | thinned by chunk with distance | a dithered fade per instance (alpha by distance in the shader) | Looks only (S). |
| Grass in depth passes | — | check grass and flowers stay out of `DepthRenderer` and the water's depth (Norman Shores keeps about 310 draws there, docs/PERF_STJOHNS_2026-11-14.md) | Possibly a real saving (S, measure first). |

### Measured on St. John's, Backwoods, Norman Shores
Resident counts (browser, High; "Client scene inventory" below): St. John's holds 45,478 plants (1.54 M triangles if
all drawn; 78 of 366 sectors drawn) and 139 trees at 26.7 k triangles; Backwoods 29,392 plants (0.99 M; 131 of 206
drawn) and 177 trees at 30.9 k. Norman Shores did not start in the browser on this box; from HANDOFF its grass was
0.6 M triangles at 60 m before the graphics-level thinning. From the 2026-11-14 work (High, still cameras, all passes): St. John's 1,486 → 545 draws, Norman Shores
2,206 → 1,058, Backwoods 1,690 → 851, with environment batches the largest single source before (526 of St. John's
1,411 draws in its "eye, sun" view). The owner's 11-15 recording then showed renderScene almost unchanged (10.7 →
9.6 ms) for 58 % fewer draws: the main pass is no longer bound by draw count, so more foliage batching would not move
the frame much. Triangles and fill (alpha-tested leaves and grass at 1920×1080@2) are the candidates; the queued
"Main scene drawing on St. John's" item should profile them on the owner's GPU before any foliage work.

### Size
Each remaining item S (impostors M). No foliage project is recommended before the main-scene profile.

## 3. Modular interior loading

### What exists today
- **Indoor props out of the sun's shadow** (landed 2026-11-14): `shared/map/indoors.ts` `indoorProps` decides from
  the level's geometry whether a prop is under a ceiling, roof or the floor above; such props cast no sun shadow
  (`propVisuals.ts`, `propBatches.ts` quiet batches). St. John's middle-spawn casters 506 → 387.
- **Set pieces** (St. John's dorm bays, the airliner cabin...) are placements in the map file (`setPieces`, v27) that
  `loadMap` expands into parts (`sp_<placement>_<part>`) before geometry, physics, nav and drawing. The client then
  draws parts like any tile, block or prop: merged level squares, prop batches by 128 m square.
- **Doors** are scenario entities (`scenarioVisuals.ts`; a door's moving parts merged, render cost step 1); the
  navmesh knows them as opening flags.
- **No occlusion culling of any kind** (no Babylon occlusion queries, no portals, no rooms). An interior is drawn
  whenever its batch's square is in the frustum.

### Measured
| Map | Props (not env) | Indoors | Share | 64 m squares with indoor props | Most in one square |
|---|---|---|---|---|---|
| St. John's | 844 | 621 | 74 % | 13 | 283 (Smythe Hall) |
| Capitol Mall | 649 | 445 | 69 % | 12 | 100 |
| Norman Shores | 689 | 406 | 59 % | 15 | 62 |
| Ironhold Prison | 260 | 212 | 82 % | 9 | 107 |
| Diamond Park | 329 | 206 | 63 % | 5 | 106 |
| Backwoods | 605 | 113 | 19 % | 4 | 52 |
| Iron Coast | 163 | 35 | 21 % | 9 | 7 |

(St. John's also has 13 set-piece placements expanding to 1,149 level boxes and 517 entities; Iron Coast 24 to
1,900 boxes.) Before render cost step 1, St. John's prop batches were 180 of 1,411 draws in a typical eye-level view
and props drawn as instances 67 more; most of those are furniture indoors. Triangles held: St. John's prop batches
and prop nodes 0.70 M, Backwoods 0.93 M ("Client scene inventory").

### Design that fits
1. **Buildings worked out from the map, not authored.** Group indoor props (the same `indoorProps` test) into
   buildings: connected covered ground (the covering boxes' footprints joined), or for set pieces their placement id.
   Each building gets a shell box (its covering geometry's bounds) and its **openings**: doors (scenario entities),
   window panes (`windowPanes`), open tile edges (`edgeShapes`: doorways, arches) on its outline. Computed in shared
   code at load, the same on every machine; MapMaker can show it as an overlay ("what the game counts as indoors").
   Official and community maps get it with no authoring.
2. **Interiors drawn only when relevant.** Indoor props batch per building instead of per 128 m square (a new key in
   `propBatches.ts`; indoor singletons as today). A building's interior is drawn when (a) the camera is inside its
   shell or within a near radius (say 15 m), or (b) one of its openings is in the frustum and faces the camera within
   a draw distance; else hidden. (b) is a few dozen dot products a frame, no GPU queries. Optional later: a Babylon
   occlusion query on each interior batch (WebGL2 has them; one frame late, so used only past the near radius).
3. **Lazy interior models.** An indoor-only model (one no outdoor copy uses) loads when its building first becomes
   relevant (approach or an opening in view), not at map load; the loading gate stops waiting for them. Collision is
   unaffected (it comes from the map's boxes, `propBoxes`, never from models), and the host never loads models.
4. **Indoor lights** (clustered lights, `clusteredLights.ts`) could follow the same relevance later.

What it would buy: on St. John's, most of the prop batches' draws and triangles and three quarters of prop models'
memory and download stop when you are outdoors and can't see in; on any building-heavy map (Capitol Mall, Ironhold,
Diamond Park) the same. It also shortens the loading gate (fewer models to wait for).

### Risks
- Pop-in when a door opens or you round a corner into a window's view: keep the near radius generous and treat open
  doorways and window panes as always-open openings (a door's state changes the rule only from "maybe" to "yes").
- A prop seen through a gap the openings test misses (a broken wall on Breakyard, a hole a destructible makes):
  destruction marks its building "always relevant".
- `indoorProps` is a covered-ness test, not a room test: a covered market stall or a deep porch counts as indoors.
  Those must stay drawn when their open side faces you: open tile edges count as openings, so they do.
- Thermal and night-vision views, the kill cam and spectators use the same camera rule.

### Size
Interiors hidden: M (one landing, real design). Lazy interior models: S on top. MapMaker overlay: S.

## 4. Hierarchical bot navigation

### What exists today (packages/shared/src/nav)
- **One solo navmesh per map** (Recast/Detour via `recast-navigation` 0.43.1, our own `generateSolo` in `solo.ts` to
  mark low headroom): cell 0.2 m, height cell 0.05 m, 0.8 m clearance, 6-vertex polygons, one tile. Built once per
  match on the host (`Match` constructor → `buildMapNav`), with off-mesh links: jump pads, ladders, portals,
  ziplines, lifts (`withLinks` rebuilds only Detour's data, no second voxelisation), ledge drops off cut-off patches
  (`audit.ts` `trapExits`) and parkour links played through the movement code (`parkour.ts`, cached per navmesh
  fingerprint within the process).
- **Queries:** `NavWorld.findPath` (Detour A*, `MAX_NODES` 65,535, `MAX_PATH_POLYS` 8,192, partial routes allowed),
  area costs (parkour ×1.6, low roof ×4 for tall bodies, exposure for cover-loving bots), filters per opening mask.
  Shortcuts that already make it "hierarchical" in practice: **connected parts** and **route components** answer
  "no route" without a search (`partsNow`, `routable`, about 15 ms once a map); failed searches remembered;
  **corridors** (`corridors.ts`: two or three different ways per common trip, worked out at setup and cached per
  navmesh) with `pathAlong` following a corridor's polygons; **`RegionMap`** (`bots/regions.ts`: 24 m regions per
  floor, for where to go, not how); `reachToward` cached per part and goal; **a search budget** of 24 searches a tick
  (`beginTick`/`takeSearch`, `SEARCH_BUDGET` in `sim/match.ts`).
- **Audit** (`audit.ts`): main area, one-way areas, traps, islands; MapMaker runs it in a worker after edits.
- **Not done:** a tiled navmesh (BOTS.md: "a breakable crate or wall that opens a way ... needs the navmesh rebuilt
  there (a tiled navmesh: not done)"); Fort Wars rebuilds the whole mesh and big terrain maps skip it
  (`rebuildNav`, `NAV_REBUILD_MAX_AREA`). The navmesh is not kept between matches.

### Measured: path queries
300 searches between seeded random main-area places a map (a third with the cover filter). Times are wall clock on
the loaded box; "slowest, repeated" is the best of three repeats of the six slowest first searches.

| Map | Polygons (ground) | Places | Searches p50 | p95 | Slowest first time | Slowest, repeated | Long trips (150 m+) p50 |
|---|---|---|---|---|---|---|---|
| Norman Shores | 5,042 | 2,252 | 0.14 ms | 1.1-2.6 ms | 12.8 ms | **0.54 ms** | 0.30 ms |
| St. John's | 3,790 (3,600) | 3,088 | 0.08 ms | 0.37-0.45 ms | 8.0 ms | **0.25 ms** | 0.11 ms |
| The Spillway | 3,791 | 1,451 | 0.07 ms | 0.25 ms | 4.2 ms | — | 0.11 ms |
| Iron Coast | 3,475 | 2,932 | 0.10 ms | 0.29 ms | 4.3 ms | — | 0.14 ms |
| Capitol Mall | 3,033 | 1,149 | 0.07 ms | 0.45 ms | 10.1 ms | — | 0.12 ms |
| Backwoods | 2,602 | 814 | 0.07 ms | 0.17-0.22 ms | 116 ms (once) | **0.23 ms** | 0.17 ms |
| Apex Ring | 2,406 | 2,878 | 0.07 ms | 0.25 ms | 4.2 ms | — | 0.09 ms |
| Frost Basin | 2,236 | 2,693 | 0.12 ms | 0.67-1.2 ms | 24 ms | **0.36 ms** | 0.14 ms |
| Diamond Park | 1,974 | 915 | 0.04 ms | 0.15 ms | 2.1 ms | — | 0.10 ms |

No search failed (main-area places all route to each other) and none ran out of nodes: the biggest navmesh has
5,042 polygons against 65,535 nodes, so Detour's partial routes never start on today's maps. **Every slow first
search was noise** (the loaded box, garbage collection): repeated, the worst real search on any map was 0.54 ms here
(roughly 0.15-0.25 ms on a desktop core). A typical long search across St. John's is 0.1 ms.

### Measured: on the host at 64 v 64
`pnpm bench 128 20` (Team Deathmatch, spread, the first 20 s; load 24):

| Map | Tick CPU avg | Bot thinking | Paths (CPU) | Navmesh searches | nav, ms a tick (wall) |
|---|---|---|---|---|---|
| St. John's | 8.2 ms | 3.54 ms | 0.26 ms | 39 a second | 0.14 |
| Norman Shores | 9.6 ms | 4.02 ms | 0.56 ms | 59 a second | 0.20 (0.09 CPU) |

So route searching is **about 1-2 % of the host's tick at 64 v 64**; character moves (3.7-4.5 ms) and the rest of bot
thinking dominate. The worst case is a spike, not the average: 24 long searches in one tick (a respawn wave, a flag
taken) at the worst real search (0.5 ms here) is about 12 ms on this box, 3-5 ms on a desktop core.

### Measured: the navmesh build (the real cost)
| Map | Build (wall) | Build CPU, with parkour | Build CPU, without parkour |
|---|---|---|---|
| Iron Coast | 12.1 s | 5.6 s | 3.3 s |
| St. John's | 10.2 s | 4.0-5.3 s | 3.6 s* |
| Norman Shores | 9.4-10.0 s | 4.0-4.1 s | 3.5 s* |
| Apex Ring | 7.1 s | 3.8 s | 3.6 s |
| The Spillway | 6.6 s | 4.3 s | 3.3 s |
| Frost Basin | 5.5-9.2 s | 3.6-4.0 s | 2.2 s |
| Backwoods | 3.7-4.8 s | 2.0-2.3 s | 0.7 s |
| Diamond Park | 3.2 s | 2.1 s | 1.2 s |
| Capitol Mall | 2.8 s | 1.8 s | 1.2 s |

(*The first build in a process also pays for warming up; the "without" build ran first.) Recast's voxelisation at
0.2 m over 300-400 m is most of it (HANDOFF: "Recast's voxels, not the triangles, set its cost"; a 400 m square at
321 × 321 terrain was 18 s wall). It runs **at every match start** on the host (the next match on the same map rebuilds
it; only parkour links are cached), and in MapMaker's map check after every edit (in a worker since 2026-11-12).

### Design that fits
1. **Keep the built navmesh (XS-S, recommended first).** Detour's data serialises (`exportNavMesh` /
   `importNavMesh` in `@recast-navigation/core`). Key it by a hash of what the build reads (geometry, terrain, env
   shapes, links, rules that change drops, a build version) and keep it in the host process (a dedicated host plays
   the same maps over and over) and, for browser hosts, in IndexedDB. Saves 2-6 s of CPU per match start on big maps.
   Determinism: the same bytes give the same navmesh; the hash must cover every input or a stale navmesh plays.
2. **A search budget by time, not count (S).** `takeSearch` stops starting searches past a few milliseconds a tick
   (with the count as a floor), so a respawn wave on a slow host can't take a tick over budget. Cheap insurance for
   64 v 64.
3. **A tiled navmesh (L, when breakable routes or MapMaker speed ask for it).** Recast's tiled build (or the tile
   cache) in, say, 32-48 m tiles: tiles build in parallel (workers on the host and in MapMaker), an edit or a
   destroyed wall rebuilds only its tiles (BOTS.md's "breakable wall opens a route", Fort Wars on big maps), and the
   cache keeps tiles. Our code assumes one tile in several places (`graph()`, `partsNow`, the polygon indexing that
   corridors, audit, parkour fingerprints and places use: "One tile (generateSoloNavMesh); anything else: one part for
   everything"), and `solo.ts` is our own pipeline (low headroom marks), so it is a real port, with the nav tests and
   the bot scorecard (`pnpm bot-report`) as the proof.
4. **A coarse region graph (HPA*-style) only if maps grow.** With tiles, each tile is a cluster; portals are the shared
   tile edges; a long route is a few cluster hops, then Detour inside each. At today's 2-5 k polygons Detour's own A*
   is already 0.1 ms, so this buys nothing measurable now. Corridors and `RegionMap` already give the team brain its
   coarse picture. Cached routes: corridors are cached per navmesh; per-bot route sharing was tried and dropped
   (`noRoute` comment: another bot's tail is shortest from where that bot entered, and Fort Wars bots stopped reaching
   the flag), so no general route cache.

### Risks
- A stale cached navmesh (an input missed in the hash) gives bots wrong routes; a version number bumped by any change
  under `nav/` or `mapNav.ts` guards it.
- Tiles change polygon indices and shapes: bots' behaviour shifts (corridors, places, vantage spots are all keyed by
  the navmesh), so the scorecard must be compared before and after, map by map.
- Parallel builds in a browser host compete with the page and the sim worker.

### Size
Navmesh kept between matches: XS-S. Time budget: S. Tiled navmesh: L. Region graph: M after tiles; not recommended now.

## Client scene inventory (what a whole-map build holds)

A scratch Playwright script (not committed) played each map offline (`?offline=<id>&test=1`, High, SwiftShader,
960 × 540), waited 20 s after play began, and counted everything the scene holds, drawn or not. "Triangles held"
counts each thin-instance copy (what drawing every copy at once would cost); textures are estimated as uncompressed
RGBA with mips (an upper bound). Norman Shores did not reach play within the script's limit on this loaded box (St.
John's took 6.5 min and Backwoods 11 min of software rendering and shader building to start, so start-up times from
here mean nothing; on a real GPU they are seconds).

| | St. John's | Backwoods |
|---|---|---|
| Meshes in the scene | 2,285 | 1,870 |
| Vertices held | 2.29 M | 1.28 M |
| Triangles held (every copy) | 3.71 M | 3.05 M |
| Materials / textures | 545 / 228 | 523 / 220 |
| Texture memory (upper bound) | about 395 MB | about 401 MB |
| JS heap | 718 MB | 486 MB |
| **Terrain plants** (`foliage.ts`) | 45,478 copies in 366 sector meshes (78 drawn), 1.54 M triangles held | 29,392 copies, 206 meshes (131 drawn), 0.99 M |
| **Environment species** | 139 trees, 40 batches; 26.7 k triangles at their current levels (6 / 15 / 38 / 80 copies at levels 0-3) | 177 copies, 72 batches; 30.9 k triangles |
| **Prop batches** (`propBatches.ts`) | 328 meshes, 1,496 copies, 0.60 M triangles | 282 meshes, 422 copies, 0.40 M |
| Props as nodes | 380 meshes, 0.10 M | 479 meshes, 0.53 M |
| Shadow proxies | 216 meshes, 0.37 M | 128 meshes, 0.18 M |
| The level (merged) | 28 meshes, 0.16 M | 11 meshes, 0.08 M |

What it says:
- **Plants are the largest store of triangles** (40 % of St. John's, a third of Backwoods'), but only the sectors near
  the camera draw (78 of 366): the distance rules work, and streaming the far ones would save memory (a few MB of
  matrices), not drawing.
- **Furniture is the next largest** (prop batches and prop nodes: 0.70 M triangles held on St. John's, 0.93 M on
  Backwoods), and on St. John's three quarters of it is indoors (section 3). This is what interiors-by-relevance cuts.
- **Trees cost little** at their levels (27-31 k triangles drawn): environment batching is done.
- **Textures, not geometry, are the big memory item** (hundreds of MB held, a good share of it the characters' and
  weapons'), and the JS heap is 0.5-0.7 GB. Neither is per region: they come from the models a map uses. Lazy
  interior models (section 3) and, later, smaller texture mips for far-only models would act on them; region
  streaming of geometry would not.

## Recommended order

1. **Navmesh kept between matches** (XS-S, lane A): host and browser host; quicker match starts on big maps.
2. **Interiors hidden when no opening is in view** (M, lane A): per-building indoor batches, the openings test.
3. **Interior models loaded on approach** (S, lane A, after 2).
4. **Search budget by time** (S, lane A): insurance for 64 v 64 spikes.
5. **Spawn-first build order** (M, lane A): play starts before the far squares are built.
6. **Foliage polish** (S each): grass out of depth passes if the profile shows it; dithered fade; impostors (M) when
   the owner wants nicer far trees. After the "Main scene drawing" profile, which decides whether foliage is worth it.
7. **Tiled navmesh** (L): when breakable walls should open routes, or MapMaker's check is too slow on big maps.
8. **Real streaming, region graph:** only with maps past 400 m (a budget change first).

MapMaker's "what the game counts as indoors" overlay (S, lane B) can come with 2.

## Questions for the owner

**Owner's answers (2026-11-15): all picks** (1b, 2a, 3a, 4b, 5a, 6a, 7a), and for 7: "plan for b eventually. I want to have the small map working great, which could evolve to one large map that encompasses all of these features and mechanics/tiles/themes (like a Far Cry island)." So 400 m stays the cap for now; real streaming, the region graph and big-map budgets get a plan later, once the small maps work great.

1. **Region streaming: what do we do?**
   a. Nothing now; revisit only if maps grow past 400 m.
   b. **Spawn-first build order only (quicker match starts), no unloading. ★ recommended**
   c. Full streaming (load near, unload far): several landings.
2. **Interiors: how aggressive?**
   a. **Hide a building's insides when none of its doors, windows or open sides is in view, and keep a generous near
      radius (no pop when you walk up). ★ recommended**
   b. Also use GPU occlusion queries past the near radius (more hidden, a frame-late pop is possible).
   c. Only lazy-load interior furniture models; keep drawing as today.
3. **Interiors in MapMaker: show the map maker what the game counts as a building and its openings?**
   a. **Yes, as an overlay in the View menu (lane B). ★ recommended**
   b. No, keep it invisible.
4. **Navmesh kept between matches: where?**
   a. In the host's memory only (dedicated host and browser host, same session).
   b. **Memory, plus the browser's storage for browser hosts (survives a page reload). ★ recommended**
   c. Also shipped with official maps, built at release (bigger downloads, nothing to build on first play).
5. **Tiled navmesh (lets breakable walls open new bot routes, faster MapMaker checks on big maps):**
   a. **Later, when you want breakable walls bots route through; it goes on Features as L. ★ recommended**
   b. Now, after the navmesh cache.
   c. Not at all.
6. **Foliage: anything you want now?**
   a. **Nothing until the main-scene profile on your GPU says foliage is a cost. ★ recommended**
   b. Nicer far trees (impostors) now, for looks.
   c. Grass that fades instead of thinning out at its edge.
7. **Bigger maps than 400 m: is that a goal?** (It decides whether real streaming and the region graph are ever
   needed.)
   a. **No, 400 m stays the cap. ★ recommended**
   b. Yes, for vehicle maps on dedicated hosts (then streaming, the region graph and the budgets get a plan).
