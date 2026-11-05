# Procedural environment: Phase 0 audit and plan

Phase 0 of [`PROCEDURAL_ENVIRONMENT.md`](PROCEDURAL_ENVIRONMENT.md) (the owner's spec, kept verbatim). This
report covers spec §4 items 1–7, baseline metrics, the old-to-new mapping, the proposed design, the Phase 1
vertical slice, and questions for the owner. It is read-only work: no game code, content or map changed.

Audited at `origin/main` 5a002f8 (2026-11-04). Line numbers refer to that commit.

## 0. Summary

- **Scope of "natural" today:** 143 prop ids in 15 packs: 121 in the three nature categories (`Trees`,
  `Rocks & Wood`, `Plants & Flowers`) and 22 natural pieces filed under themed categories (cacti, jungle plants,
  cave rocks, a ruins dead tree). 111 of them are placed in maps: **6,246 natural prop instances in 53 of the
  88 maps**. Two Kenney-sourced code paths also draw natural models without map entities: the terrain foliage
  layer (`packages/client/src/foliage.ts`) and the backdrop and border belts. Their GLBs come to 6.2 MB.
- **All natural pieces are ordinary props.** They use the same `PropEntity` (`kind: 'prop'`, `model: 'prop.<id>'`),
  the same collision (`propBoxes`), the same rendering (one GPU `InstancedMesh` per placed entity, merged
  per material) and the same MapMaker tools. No natural-specific map data exists apart from
  `terrain.foliage` (a 0–4 level per terrain cell).
- **Collision is boxes only.** A tree is a **0.5 m square post as tall as the whole tree** (crown included).
  A rock is its bounds box, or two stacked tiers when it is taller than a step. Bushes, grass and ferns have
  no collider. There are no capsules, hulls or trimeshes, except the terrain trimesh.
- **The ballistic class and the impact effect are both wrong for nature today.** They come from regexes on the
  model id. Every tree trunk is **`concrete`** on the server (`prop.oak` matches no rule), `tree_plateau` is
  **`metal`** (from "plate"), and every bush is **`thin_metal`** (from "bus" inside "bush"). On the client, trunk
  hits show **stone** dust and bush ids would show **metal sparks**. Bushes have no collider, so only the trunk
  and boulder cases are seen in play.
- **Navigation** is a single solo Recast navmesh built once per match from all static boxes plus the terrain
  triangles. Natural props reach it as their boxes, with no special handling and no tile cache.
- **No wind, no thin-instance chunking for placed trees, and LODs only on the 8 Meshy `mn_*` models**
  (Babylon `addLODLevel` on instanced sources). Terrain foliage is already chunked thin instances: 32 m chunks,
  64 m sectors, distance thinning by quality tier. That code is the pattern to reuse.
- **WebGL2 is the default renderer.** WebGPU is opt-in (`?renderer=webgpu`, `packages/client/src/engine.ts:37-46`)
  because of known material bugs. The spec assumes "WebGPU preferred". See Q1.
- **Unknown prop ids stop a map from loading.** `validate.ts:207` raises an `error` and `loadMap` returns
  `ok: false` (`validate.ts:73`). The host throws (`host/src/host.ts:143`). The migration's unknown-id policy has
  to change this. See Q5.

## 1. Asset registries and the natural asset inventory (spec §4.1)

### 1.1 Registries and data flow

| What | Where | Shape |
|---|---|---|
| Prop sources, one file per pack | `content/props/<pack>.json` (`tools/content/props-manifest.mjs` reads them) | `{ pack: {title, creator, url, license, licenseFile, retrieved, download?, nature?}, order, props: [{ id, src, name, category, height, collide: 'box'\|'trunk'\|'none'\|'shell'\|'boxes'\|'model'\|'stairs'\|'frame', conceals?, breakable?, flame?, nature?: { lods: [[tris, dist]…], impostor, remesh, shell, doubleSided, cut } }] }` |
| Shared budgets | `content/props.json` | `maxTriangles 6000`, `maxBytes 400000`, `hero` tier 20k / 1.6 MB |
| Build | `tools/content/prepare-props.mjs` (`pnpm content:rebuild`); dense Meshy nature through `tools/content/nature.mjs` | normalises (centred, on y = 0, scaled to `height`), writes `packages/client/public/props/<id>.glb` |
| Lock (measured) | `content/props.lock.json` | `{ file, source, src, triangles, bytes, sha256 }` per GLB |
| Gameplay table (shared, host and client) | `packages/shared/src/content/props.generated.ts` → `PropDefinition` (`packages/shared/src/content/props.ts:9-34`) | `{ id, file, displayName, category, size:[w,h,d], collision:[x,h,z]\|null, boxes?, breakable?, conceals?, flame? }` |
| Collision rule | `prepare-props.mjs:844` | `trunk` → `[min(0.5,w), h, min(0.5,d)]`, `none` → null, else the bounds (or `shellBoxes` at `:298-365`, a 0.4 m footprint grid) |
| Map reference | `PropEntity` (`packages/shared/src/map/schema.ts:386-399`) | `{ id, kind:'prop', position, model: ContentId, yaw, scale 0.25–4, solid=true, tint }` |
| Palette curation | `STYLE_PACKS[].props` (`packages/shared/src/editor/stylePacks.ts:47`); scatter sets (`editor/scatter.ts:20`); foliage `KINDS` (`client/src/foliage.ts:14`); backdrop belts (`client/src/backdrop.ts:671-690`); border forest kits (`client/src/borderVisuals.ts:875`) | lists of `prop.*` ids or short names |
| Provenance | `content/provenance.json`, `docs/ASSET_SOURCES.md` | per built file |

No registry marks a prop as "natural". `TILTED_PROP_CATEGORIES` (`map/settle.ts:16`) and `isRock`
(`map/geometry.ts:407`) infer it from the category name and from regexes on the id.

### 1.2 Inventory

Columns: **LOD0 tris** from `content/props.lock.json`. **Collision** from `props.generated.ts`. **Instances / Maps**
count `kind: 'prop'` entities across all 88 `maps/*.json` files (in parentheses: maps not in `RETIRED_MAPS`).
**Style packs** is how many `STYLE_PACKS` palettes list the id. **Code refs** are the code paths that name it
(foliage = terrain plants, scatter = scatter brush, backdrop = backdrop belt, borderVisuals = forest border,
dressing = style-pack dressing). **Ballistic / FX** is today's server `materialClass(model)`
(`sim/gunplay.ts:610`) and the client `surfaceOfName(model)` (`client/src/game/fxMap.ts:43`). These only matter
where a collider exists.

Packs: Kenney Nature Kit 2.1 (55 ids), Kenney Survival (12), Kenney Graveyard (3), Kenney Pirate (2), Quaternius
Ultimate Nature (39), Quaternius Modular Ruins (2), Meshy community nature through `nature.mjs` (8), Meshy community
(1), Meshy owned rock pile (1), loafbrr Mines & Caves (5), LowPolyAssets Wild West (5), and code-built in-house
pieces (`tiletrigger-*`, 10).

Instances by pack: Quaternius Ultimate Nature 3,002 · Kenney Nature 1,956 · Kenney Survival 497 · Meshy nature
259 · Kenney Graveyard 122 · in-house 202 · the rest 208.

| Old id (`prop.`) | Pack | Category | LOD0 tris | Collision | Conceals | Instances | Maps (live) | Style packs | Code refs | Ballistic class / FX surface today |
|---|---|---|---|---|---|---|---|---|---|---|
| nt_bush_leafy | Quaternius Ultimate Nature | Plants & Flowers | 364 | none | yes | 543 | 28 (25) |  | borderVisuals | thin_metal / metal |
| bush_large | Kenney Nature Kit | Plants & Flowers | 60 | none | yes | 318 | 18 (16) |  | scatter, backdrop | thin_metal / metal |
| nt_common_tree | Quaternius Ultimate Nature | Trees | 2,888 | trunk 0.5 m post, full height |  | 316 | 18 (18) | 1 | borderVisuals | concrete / stone |
| grass_tall | Kenney Nature Kit | Plants & Flowers | 224 | none |  | 242 | 4 (4) |  | foliage, scatter | soil / dirt |
| rock_large | Kenney Survival Kit | Rocks & Wood | 104 | box 1.979 × 1.4 × 2.216 |  | 229 | 17 (14) | 1 | backdrop | stone / stone |
| nt_fern_wide | Quaternius Ultimate Nature | Plants & Flowers | 296 | none | yes | 199 | 11 (11) |  | borderVisuals | concrete / stone |
| nt_pine_tall | Quaternius Ultimate Nature | Trees | 1,920 | trunk 0.5 m post, full height |  | 193 | 6 (5) |  | borderVisuals | concrete / stone |
| nt_bush_berries | Quaternius Ultimate Nature | Plants & Flowers | 892 | none | yes | 188 | 16 (15) |  |  | thin_metal / metal |
| pine_tall | Kenney Nature Kit | Trees | 134 | trunk 0.5 m post, full height |  | 174 | 4 (4) |  | scatter, backdrop | concrete / stone |
| nt_palm_tall | Quaternius Ultimate Nature | Trees | 1,496 | trunk 0.5 m post, full height |  | 161 | 10 (10) | 1 | borderVisuals | concrete / stone |
| nt_common_tree_2 | Quaternius Ultimate Nature | Trees | 2,952 | trunk 0.5 m post, full height |  | 122 | 12 (12) | 1 |  | concrete / stone |
| oak | Kenney Nature Kit | Trees | 196 | trunk 0.5 m post, full height |  | 119 | 5 (5) |  | scatter, backdrop | concrete / stone |
| nt_palm_curved | Quaternius Ultimate Nature | Trees | 1,772 | trunk 0.5 m post, full height |  | 117 | 10 (10) | 2 | borderVisuals | concrete / stone |
| nt_boulder | Quaternius Ultimate Nature | Rocks & Wood | 72 | box 1.529 × 1.4 × 1.662 |  | 116 | 5 (5) |  |  | concrete / stone |
| nt_wildflowers | Quaternius Ultimate Nature | Plants & Flowers | 408 | none |  | 115 | 3 (3) |  |  | concrete / stone |
| boulder_jagged | Kenney Nature Kit | Rocks & Wood | 80 | box 4.89 × 2.6 × 4.714 |  | 114 | 8 (7) | 1 | scatter | concrete / stone |
| tree_round | Kenney Nature Kit | Trees | 114 | trunk 0.5 m post, full height |  | 109 | 9 (8) | 1 | scatter, backdrop | concrete / stone |
| fern | Kenney Nature Kit | Plants & Flowers | 32 | none | yes | 106 | 4 (4) | 1 | foliage, scatter | concrete / stone |
| nt_saguaro | Quaternius Ultimate Nature | Plants & Flowers | 434 | trunk 0.5 m post, full height |  | 99 | 5 (5) | 1 | borderVisuals | concrete / stone |
| nt_boulder_moss | Quaternius Ultimate Nature | Rocks & Wood | 70 | box 1.022 × 2 × 0.983 |  | 97 | 9 (9) | 1 |  | concrete / stone |
| nt_birch | Quaternius Ultimate Nature | Trees | 1,704 | trunk 0.5 m post, full height |  | 94 | 7 (7) |  | borderVisuals | concrete / stone |
| mn_oak | Meshy community (nature.mjs) | Trees | 4,966 | trunk 0.5 m post, full height |  | 89 | 2 (2) |  | scatter | concrete / stone |
| rock_small | Kenney Survival Kit | Rocks & Wood | 120 | box 1.076 × 0.7 × 0.777 |  | 84 | 5 (4) |  |  | stone / stone |
| cactus_tall | Kenney Nature Kit | Plants & Flowers | 122 | trunk 0.5 m post, full height |  | 80 | 5 (4) | 1 | scatter, backdrop | concrete / stone |
| nt_pine_small | Quaternius Ultimate Nature | Trees | 2,392 | trunk 0.5 m post, full height |  | 79 | 4 (3) |  |  | concrete / stone |
| bush | Kenney Nature Kit | Plants & Flowers | 32 | none | yes | 77 | 9 (8) | 1 | foliage, scatter, backdrop | thin_metal / metal |
| oak_dark | Kenney Nature Kit | Trees | 196 | trunk 0.5 m post, full height |  | 77 | 4 (4) |  | backdrop | concrete / stone |
| nt_bush_snow | Quaternius Ultimate Nature | Plants & Flowers | 460 | none | yes | 75 | 3 (2) | 1 | borderVisuals | thin_metal / metal |
| nt_dead_tree | Quaternius Ultimate Nature | Trees | 2,360 | trunk 0.5 m post, full height |  | 74 | 11 (11) | 1 |  | concrete / stone |
| plant_low | Kenney Nature Kit | Plants & Flowers | 44 | none |  | 70 | 2 (2) |  | foliage, scatter | concrete / stone |
| palm_tall | Kenney Nature Kit | Trees | 336 | trunk 0.5 m post, full height |  | 66 | 4 (4) | 1 | scatter, backdrop | concrete / stone |
| pine | Kenney Graveyard Kit | Trees | 336 | trunk 0.5 m post, full height |  | 63 | 4 (4) |  | scatter | concrete / stone |
| nt_rock_moss | Quaternius Ultimate Nature | Rocks & Wood | 128 | box 1.139 × 1.2 × 1.915 |  | 63 | 6 (6) | 1 |  | stone / stone |
| wheat | Kenney Nature Kit | Plants & Flowers | 360 | none |  | 60 | 1 (1) |  |  | concrete / stone |
| mn_birch | Meshy community (nature.mjs) | Trees | 4,482 | trunk 0.5 m post, full height |  | 59 | 2 (2) |  | scatter | concrete / stone |
| jg_giant_fern | in-house (code-built) | Jungle Ruins | 184 | none |  | 59 | 4 (4) | 1 | dressing | concrete / stone |
| pine_round | Kenney Nature Kit | Trees | 206 | trunk 0.5 m post, full height |  | 56 | 3 (3) |  | scatter, backdrop | concrete / stone |
| stump | Kenney Survival Kit | Rocks & Wood | 52 | box 0.46 × 0.6 × 0.46 |  | 54 | 4 (4) |  |  | concrete / stone |
| palm | Kenney Pirate Kit | Trees | 338 | trunk 0.5 m post, full height |  | 53 | 3 (3) | 2 |  | concrete / stone |
| tree_fat | Kenney Nature Kit | Trees | 50 | trunk 0.5 m post, full height |  | 51 | 2 (2) |  | scatter, backdrop | concrete / stone |
| nt_pine_snow_tall | Quaternius Ultimate Nature | Trees | 1,920 | trunk 0.5 m post, full height |  | 50 | 4 (4) | 1 | borderVisuals | concrete / dirt |
| rock_medium | Kenney Survival Kit | Rocks & Wood | 156 | box 1.994 × 1 × 1.731 |  | 48 | 5 (5) | 1 | scatter, backdrop | stone / stone |
| mn_fir | Meshy community (nature.mjs) | Trees | 3,992 | trunk 0.5 m post, full height |  | 45 | 1 (1) |  | scatter | concrete / stone |
| eg_papyrus | in-house (code-built) | Sands of Egypt | 392 | none |  | 45 | 2 (2) | 1 |  | concrete / stone |
| nt_cactus_round | Quaternius Ultimate Nature | Plants & Flowers | 416 | box 0.291 × 1.2 × 0.853 |  | 41 | 5 (5) | 2 | borderVisuals | concrete / stone |
| boulder_flat | Kenney Nature Kit | Rocks & Wood | 73 | box 3.202 × 1.4 × 2.628 |  | 40 | 2 (2) | 1 | scatter | concrete / stone |
| rock_pile | Meshy, owned | Rocks & Wood | 5,220 | box 1.916 × 1.3 × 1.793 |  | 40 | 2 (2) | 1 |  | stone / stone |
| tree_plateau | Kenney Nature Kit | Trees | 215 | trunk 0.5 m post, full height |  | 36 | 1 (1) |  | scatter | **metal** / stone |
| stones | Kenney Nature Kit | Rocks & Wood | 16 | none |  | 36 | 1 (1) |  | foliage, scatter | stone / stone |
| mc_cave_rocks_d | loafbrr Mines & Caves | Mines & Caves | 134 | box 2.261 × 1.532 × 1.818 |  | 36 | 2 (2) | 1 |  | stone / stone |
| nt_boulder_snow | Quaternius Ultimate Nature | Rocks & Wood | 102 | box 0.987 × 2 × 0.949 |  | 35 | 2 (2) | 1 |  | concrete / dirt |
| rocks_tall | Kenney Graveyard Kit | Rocks & Wood | 364 | box 4.22 × 2.4 × 4.167 |  | 34 | 8 (7) |  | backdrop | stone / stone |
| nt_rock_snow | Quaternius Ultimate Nature | Rocks & Wood | 96 | box 1.53 × 1.2 × 1.663 |  | 33 | 3 (3) | 1 | borderVisuals | stone / dirt |
| log | Kenney Survival Kit | Rocks & Wood | 88 | box 0.54 × 0.6 × 2.165 |  | 30 | 6 (6) |  |  | concrete / wood |
| nt_willow | Quaternius Ultimate Nature | Trees | 1,946 | trunk 0.5 m post, full height |  | 30 | 3 (3) |  |  | concrete / stone |
| jt_plant_cluster | in-house (code-built) | Jungle Ruins | 492 | none |  | 30 | 3 (3) | 1 |  | concrete / stone |
| cactus | Kenney Nature Kit | Plants & Flowers | 116 | trunk 0.5 m post, full height |  | 27 | 2 (2) | 2 | scatter, backdrop | concrete / stone |
| nt_cactus_flowers | Quaternius Ultimate Nature | Plants & Flowers | 1,488 | box 0.395 × 1 × 0.662 |  | 27 | 2 (2) |  |  | concrete / stone |
| mn_fern | Meshy community (nature.mjs) | Plants & Flowers | 1,440 | none |  | 25 | 2 (2) |  | foliage, scatter | concrete / stone |
| pine_crooked | Kenney Graveyard Kit | Trees | 336 | trunk 0.5 m post, full height |  | 25 | 2 (2) |  | backdrop | concrete / stone |
| rn_dead_tree | Quaternius Modular Ruins | Ruins | 444 | trunk 0.5 m post, full height |  | 25 | 5 (5) | 1 |  | concrete / stone |
| nt_log_large | Quaternius Ultimate Nature | Rocks & Wood | 464 | box 0.592 × 0.7 × 2.498 |  | 24 | 1 (1) |  |  | concrete / wood |
| eg_palm | in-house (code-built) | Sands of Egypt | 500 | trunk 0.5 m post, full height |  | 23 | 2 (2) | 1 |  | concrete / stone |
| nt_rock_flat | Quaternius Ultimate Nature | Rocks & Wood | 90 | box 0.813 × 0.8 × 1.121 |  | 23 | 1 (1) |  | borderVisuals | stone / stone |
| mn_shrub | Meshy community (nature.mjs) | Plants & Flowers | 1,180 | none |  | 20 | 1 (1) |  | foliage, scatter | concrete / stone |
| nt_log_moss | Quaternius Ultimate Nature | Rocks & Wood | 614 | box 0.912 × 0.7 × 2.716 |  | 21 | 2 (2) | 1 |  | concrete / wood |
| nt_stump_moss | Quaternius Ultimate Nature | Rocks & Wood | 232 | box 1.75 × 0.8 × 1.327 |  | 21 | 2 (2) | 1 |  | concrete / stone |
| log_big | Kenney Nature Kit | Rocks & Wood | 96 | box 2.4 × 1 × 1.318 |  | 19 | 4 (4) |  | backdrop | concrete / wood |
| mn_rock_spires | Meshy community (nature.mjs) | Rocks & Wood | 2,992 | shell |  | 19 | 3 (3) |  |  | stone / stone |
| jg_vine_curtain | in-house (code-built) | Jungle Ruins | 1,356 | none |  | 19 | 3 (3) | 1 |  | concrete / stone |
| palm_bent | Kenney Pirate Kit | Trees | 338 | trunk 0.5 m post, full height |  | 14 | 2 (2) | 1 | backdrop | concrete / stone |
| bush_leafy | Kenney Nature Kit | Plants & Flowers | 104 | none | yes | 14 | 2 (2) | 1 | foliage, scatter | thin_metal / metal |
| nt_log_snow | Quaternius Ultimate Nature | Rocks & Wood | 280 | box 0.805 × 0.75 × 3.203 |  | 14 | 1 (1) | 1 |  | concrete / wood |
| rock_mossy_spire | Meshy community | Rocks & Wood | 5,000 | box 2.333 × 2.4 × 1.936 |  | 14 | 1 (1) |  |  | stone / stone |
| tree_tall | Kenney Survival Kit | Trees | 254 | trunk 0.5 m post, full height |  | 13 | 2 (2) |  |  | concrete / stone |
| woodpile | Kenney Survival Kit | Rocks & Wood | 64 | box 2.627 × 0.8 × 1.116 |  | 13 | 6 (6) | 3 |  | wood / wood |
| nt_willow_dead | Quaternius Ultimate Nature | Trees | 1,128 | trunk 0.5 m post, full height |  | 13 | 2 (2) |  |  | concrete / stone |
| boulder_round | Kenney Nature Kit | Rocks & Wood | 80 | box 6.647 × 2.2 × 8.6 |  | 11 | 4 (4) |  | scatter | concrete / stone |
| rock_spire_tall | Kenney Nature Kit | Rocks & Wood | 172 | box 3.461 × 4 × 3.485 |  | 11 | 2 (2) |  | backdrop | stone / stone |
| grass_tuft | Kenney Survival Kit | Plants & Flowers | 144 | none |  | 8 | 1 (1) |  |  | soil / dirt |
| jg_banana_plant | in-house (code-built) | Jungle Ruins | 164 | none |  | 8 | 2 (2) | 1 | dressing | concrete / stone |
| jt_tree_trunk | in-house (code-built) | Jungle Ruins | 760 | trunk 0.5 m post, full height |  | 8 | 2 (2) | 1 |  | concrete / stone |
| campfire_stones | Kenney Nature Kit | Rocks & Wood | 264 | none |  | 7 | 2 (2) |  |  | stone / stone |
| flower_purple | Kenney Nature Kit | Plants & Flowers | 76 | none |  | 7 | 2 (2) |  | foliage, scatter | concrete / stone |
| flower_yellow | Kenney Nature Kit | Plants & Flowers | 76 | none |  | 7 | 2 (2) |  | foliage, scatter | concrete / stone |
| tree | Kenney Survival Kit | Trees | 226 | trunk 0.5 m post, full height |  | 7 | 1 (1) |  |  | concrete / stone |
| tree_detailed | Kenney Nature Kit | Trees | 402 | trunk 0.5 m post, full height |  | 7 | 1 (1) |  | scatter, backdrop | concrete / stone |
| ww_tumbleweed | LowPolyAssets Wild West | Wild West | 1,816 | none |  | 7 | 1 (1) |  |  | concrete / wood |
| stone_pillar | Kenney Nature Kit | Rocks & Wood | 136 | box 3.455 × 3.5 × 2.401 |  | 6 | 1 (1) |  |  | stone / stone |
| planks_stack | Kenney Survival Kit | Rocks & Wood | 72 | box 1.992 × 0.5 × 3.344 |  | 6 | 5 (4) | 2 |  | thin_wood / wood |
| ww_cactus_a | LowPolyAssets Wild West | Wild West | 900 | box 0.448 × 2.045 × 1.406 |  | 6 | 1 (1) |  |  | concrete / wood |
| nt_birch_autumn | Quaternius Ultimate Nature | Trees | 1,704 | trunk 0.5 m post, full height |  | 5 | 1 (1) |  |  | concrete / stone |
| nt_birch_snow | Quaternius Ultimate Nature | Trees | 1,804 | trunk 0.5 m post, full height |  | 5 | 1 (1) | 1 | borderVisuals | concrete / dirt |
| rock_flat | Kenney Survival Kit | Rocks & Wood | 274 | box 3.664 × 0.4 × 2.97 |  | 5 | 1 (1) | 1 | backdrop | stone / stone |
| ww_cactus_b | LowPolyAssets Wild West | Wild West | 1,224 | box 0.772 × 2.045 × 0.886 |  | 5 | 1 (1) |  |  | concrete / wood |
| hanging_moss | Kenney Nature Kit | Plants & Flowers | 52 | none |  | 4 | 1 (1) | 1 | backdrop | concrete / stone |
| jg_bamboo | in-house (code-built) | Jungle Ruins | 1,004 | trunk 0.5 m post, full height |  | 4 | 1 (1) | 1 |  | concrete / stone |
| nt_common_tree_autumn | Quaternius Ultimate Nature | Trees | 2,888 | trunk 0.5 m post, full height |  | 4 | 1 (1) |  |  | concrete / stone |
| nt_common_tree_snow | Quaternius Ultimate Nature | Trees | 2,966 | trunk 0.5 m post, full height |  | 4 | 1 (1) | 1 | borderVisuals | concrete / dirt |
| jt_tree_root_arch | in-house (code-built) | Jungle Ruins | 1,032 | none |  | 3 | 2 (2) | 1 |  | concrete / stone |
| rn_wall_arch_ivy | Quaternius Modular Ruins | Ruins | 2,602 | shell |  | 3 | 2 (2) | 1 |  | concrete / stone |
| tumbleweed | in-house (code-built) | Frontier | 840 | none |  | 3 | 1 (1) | 1 |  | concrete / stone |
| log_stack | Kenney Nature Kit | Rocks & Wood | 310 | box 2.562 × 1.4 × 2.869 |  | 2 | 1 (1) | 1 |  | concrete / wood |
| mn_banana | Meshy community (nature.mjs) | Trees | 1,992 | trunk 0.5 m post, full height |  | 2 | 1 (1) |  | scatter | concrete / stone |
| ww_cactus_c | LowPolyAssets Wild West | Wild West | 400 | box 0.245 × 1.58 × 1.33 |  | 2 | 1 (1) |  |  | concrete / wood |
| ww_cactus_d | LowPolyAssets Wild West | Wild West | 1,512 | box 0.816 × 2.047 × 0.903 |  | 2 | 1 (1) |  |  | concrete / wood |
| flower_red | Kenney Nature Kit | Plants & Flowers | 76 | none |  | 1 | 1 (1) |  | foliage, scatter | concrete / stone |
| mc_cave_rocks_b | loafbrr Mines & Caves | Mines & Caves | 162 | box 2.048 × 2.385 × 1.309 |  | 1 | 1 (1) | 1 |  | stone / stone |
| nt_boulder_tall | Quaternius Ultimate Nature | Rocks & Wood | 70 | box 1.216 × 2.2 × 1.17 |  | 1 | 1 (1) |  |  | concrete / stone |
| pine_small | Kenney Nature Kit | Trees | 164 | trunk 0.5 m post, full height |  | 1 | 1 (1) |  | scatter, backdrop | concrete / stone |
| tree_thin | Kenney Nature Kit | Trees | 228 | trunk 0.5 m post, full height |  | 1 | 1 (1) |  | scatter | concrete / stone |
| bush_cone | Kenney Nature Kit | Plants & Flowers | 30 | none | yes | 0 | 0 (0) |  | scatter | thin_metal / metal |
| bush_small | Kenney Nature Kit | Plants & Flowers | 16 | none | yes | 0 | 0 (0) |  | foliage, scatter | thin_metal / metal |
| cliff | Kenney Nature Kit | Rocks & Wood | 12 | box 4 × 4 × 4 |  | 0 | 0 (0) | 2 | backdrop | concrete / stone |
| cliff_corner | Kenney Nature Kit | Rocks & Wood | 12 | box 0.674 × 4 × 0.674 |  | 0 | 0 (0) | 1 | backdrop | concrete / stone |
| cliff_steps | Kenney Nature Kit | Rocks & Wood | 219 | box 4 × 4 × 4.2 |  | 0 | 0 (0) | 2 |  | concrete / stone |
| corn | Kenney Nature Kit | Plants & Flowers | 186 | none |  | 0 | 0 (0) |  |  | concrete / stone |
| grass_leafy | Kenney Nature Kit | Plants & Flowers | 144 | none |  | 0 | 0 (0) |  | foliage, scatter | soil / dirt |
| grass_patch | Kenney Nature Kit | Plants & Flowers | 132 | none |  | 0 | 0 (0) |  | foliage | soil / dirt |
| lily | Kenney Nature Kit | Plants & Flowers | 86 | none |  | 0 | 0 (0) | 1 |  | concrete / stone |
| mc_cave_rock_wall | loafbrr Mines & Caves | Mines & Caves | 124 | box 2.293 × 5.023 × 1.007 |  | 0 | 0 (0) | 1 |  | stone / stone |
| mc_cave_rocks_a | loafbrr Mines & Caves | Mines & Caves | 98 | box 1.681 × 2.478 × 1.299 |  | 0 | 0 (0) | 1 |  | stone / stone |
| mc_cave_rocks_c | loafbrr Mines & Caves | Mines & Caves | 144 | box 1.941 × 1.418 × 1.521 |  | 0 | 0 (0) | 1 |  | stone / stone |
| mn_eelgrass | Meshy community (nature.mjs) | Plants & Flowers | 751 | none |  | 0 | 0 (0) |  | foliage, scatter | soil / dirt |
| mushroom_tall | Kenney Nature Kit | Plants & Flowers | 48 | none |  | 0 | 0 (0) |  |  | concrete / stone |
| mushrooms | Kenney Nature Kit | Plants & Flowers | 144 | none |  | 0 | 0 (0) | 1 | scatter | concrete / stone |
| nt_corn | Quaternius Ultimate Nature | Plants & Flowers | 566 | none | yes | 0 | 0 (0) |  |  | concrete / stone |
| nt_pine_autumn | Quaternius Ultimate Nature | Trees | 1,920 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  |  | concrete / stone |
| nt_stump_large | Quaternius Ultimate Nature | Rocks & Wood | 232 | box 1.75 × 0.8 × 1.327 |  | 0 | 0 (0) |  |  | concrete / stone |
| nt_wheat | Quaternius Ultimate Nature | Plants & Flowers | 408 | none | yes | 0 | 0 (0) |  |  | concrete / stone |
| nt_willow_autumn | Quaternius Ultimate Nature | Trees | 1,946 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  |  | concrete / stone |
| oak_autumn | Kenney Nature Kit | Trees | 196 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  | scatter | concrete / stone |
| palm_short | Kenney Nature Kit | Trees | 336 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  | scatter, backdrop | concrete / stone |
| pine_ground | Kenney Nature Kit | Trees | 82 | none |  | 0 | 0 (0) |  |  | concrete / dirt |
| pine_tall_b | Kenney Nature Kit | Trees | 154 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  | scatter, backdrop | concrete / stone |
| stump_cut | Kenney Nature Kit | Rocks & Wood | 96 | box 1.036 × 0.6 × 1.078 |  | 0 | 0 (0) |  |  | concrete / stone |
| stump_old | Kenney Nature Kit | Rocks & Wood | 120 | box 0.535 × 1 × 0.557 |  | 0 | 0 (0) |  |  | concrete / stone |
| tree_autumn | Kenney Survival Kit | Trees | 198 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  | scatter | concrete / stone |
| tree_blocks | Kenney Nature Kit | Trees | 132 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  |  | concrete / stone |
| tree_cone | Kenney Nature Kit | Trees | 132 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  | backdrop | concrete / stone |
| tree_round_autumn | Kenney Nature Kit | Trees | 228 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  | scatter | concrete / stone |
| tree_round_dark | Kenney Nature Kit | Trees | 114 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  |  | concrete / stone |
| tree_small | Kenney Nature Kit | Trees | 62 | trunk 0.5 m post, full height |  | 0 | 0 (0) |  |  | concrete / stone |

Not counted as natural, and left alone: hedges and hedge arches (garden architecture), potted plants and
houseplants (furniture), drystone walls, gravestones and sandstone columns (masonry), the date-palm planter
(`dc_palm_planter`, built), and fences.

**Other natural content that is not a placeable prop:**

- **Terrain foliage layer.** `terrain.foliage` holds one level, 0–4, per cell (`map/terrain.ts:55-69`;
  schema at `map/schema.ts:722-725`). When it is empty, the level is derived from each cell's material
  (`MATERIAL_FOLIAGE`). The client grows plants from it (§5). It uses `grass_patch`, `grass_leafy`, `grass_tall`,
  the three flowers, `bush_small`, `fern`, `plant_low`, `mn_fern`, `bush`, `bush_leafy`, `mn_shrub`, `stones`
  and `mn_eelgrass`. 42 maps have terrain and 29 paint the layer.
- **Backdrop belts** (`client/src/backdrop.ts:671-690`): rings of Kenney trees and rocks outside the map,
  draw only. **Backdrop forest:** 2,600 thin-instanced code-built cones (`backdrop.ts:379-412`).
- **Forest border** (`client/src/borderVisuals.ts:311`, kits at `:875`): a front row of Quaternius `nt_*` trees
  and bushes as thin instances, then far rows of code-built ~70-triangle conifers. Its gameplay barrier is a box
  band (`map/border.ts`). **Cliff border:** one merged code-built mesh with ambientCG Travertine009.
- **Kenney `cliff` / `cliff_corner` / `cliff_steps`** have 12–219 triangles and are placed in no map. They
  appear only in 2 style-pack palettes and in the backdrop belts. No real cliff assets exist. Cliffs in maps
  are terrain slopes, the border, or rock spire props.

## 2. MapMaker placement, painting and serialisation (spec §4.2)

- **Single placement:** the `prop` tool (`client/src/editor/editorApp.ts:302`, tool union) uses the
  `PROP_CATEGORIES` palette (`editorApp.ts:3436`). Yaw snaps to 15° (`schema.ts:389`) and scale runs 0.25–4.
  On terrain, `settledPropY` beds the base at the lowest ground under the footprint (`map/settle.ts:22-56`);
  trees use their trunk box. `orientProp` leans `Rocks & Wood` and `Plants & Flowers` with the slope, up to 25°,
  when drawn only (`client/src/game/propVisuals.ts:86`, `settle.ts:16`).
- **Scatter brush** (`shared/src/editor/scatter.ts:20-112`): 11 sets (pine forest, leafy woods, autumn, fir &
  birch, jungle, undergrowth, bushes, meadow, desert, water plants, rocks). Each set has weighted ids, a minimum
  spacing and a scale range. The PRNG is mulberry32, seeded by the dab. Each dab adds at most 60 props, kept
  clear of spawns, pickups (2 m) and mounts (4 m). **The output is ordinary `PropEntity`s with `solid: true`,
  written into `entities`**: scattered trees are authoritative, explicit placements. Alt or right-click removes
  that set's props within the brush.
- **Foliage brush:** terrain brush `'foliage'` (`map/terrain.ts:225, 273-285`; UI at `editorApp.ts:2815-2828`).
  It paints a level per cell, and the first stroke turns the automatic cover into a painted layer.
  "Plants follow the ground" clears the layer. Paths clear the foliage under them (`map/paths.ts:49,111`).
- **Undo/redo:** `EditHistory` (`shared/src/editor/commands.ts:212`) stores whole immutable documents. One
  brush stroke or one scatter dab is one step.
- **Serialisation and versioning:** `MAP_FORMAT_VERSION = 25` (`map/mapKeys.ts:11`). `MIGRATIONS`
  (`map/migrate.ts:10-60`) holds one step per version. All of them are identity steps except v22→v23 (paths).
  `migrateMapDocument` never mutates its input (`migrate.ts:108-130`). `loadMap` migrates, runs the zod
  `MapDocument` parse, then `validateMap`, and rejects the map on any `error` (`validate.ts:44-73`).
- **No retired-id or alias mechanism exists for props.** `map/retired.ts` retires whole maps, not ids. An unknown
  `model` is the error `prop.unknown` (`validate.ts:207`). The map does not load in the game, in MapMaker
  publish (`ownerPublish.ts:86`), on the hub (`server/src/publish.ts:134-139`) or on the host (`host/src/host.ts:143`).
- **Rollback material that already exists:** the hub keeps every published version in `history/<id>/<ms>.json`
  (`server/src/publish.ts:24-26`). Official maps are in git. `mapContentHash` (`map/identity.ts:49`) hashes the
  canonical document, so a migration that rewrites ids changes the hash. Official maps would show
  "changed since it was exported" (`validate.ts`, `release.changed`) until they are re-exported.
- **Budgets:** 1,500 props and 80 different prop models per map (`docs/MAP_BUDGETS.md:18-19`), checked by
  `resourceBudgetIssues`.
- **No mover or logic references a natural prop** in any shipped map (checked across `maps/*.json`), so remapping
  ids breaks no references.

## 3. Collision, shots, impact surfaces and lag compensation (spec §4.3)

- **Static world:** `buildMapGeometry` (`map/geometry.ts:389`) adds `propBoxes(map)` (`:409-446`, called at `:602`).
  Per prop: `def.boxes`, or the `collision` box scaled and yawed. **Rocks** (`isRock`: category `Rocks & Wood`
  and the id matches `rock|boulder|stone|cliff`, `:407`) that are taller than a step become two tiers: a low
  one at 85 % footprint up to ≤ 0.7 m, and an upper one at 55 % to 92 % of the height. Rocks under step
  height get no collider. Trunks are the 0.5 m post from `prepare-props.mjs:844`, **as tall as the whole
  model**. Breakable props are excluded (scenario-owned).
- **Rapier:** `PhysicsWorld` (`sim/physics.ts:125-146`) makes every static `WorldBox` a `cuboid`, after
  `mergeBoxes` (`:54`) joins abutting unturned boxes. The terrain is one `trimesh`. `staticBoxes` maps a
  collider handle to its `WorldBox`, read back by `boxAt` (`:350`). The same code builds the world on the
  server, the host and the client (prediction).
- **Shots:** ballistic hitscan goes through `fireBullets` (`sim/match.ts:2799`) to `bulletSegment` (`:3381-3470`),
  which runs `physics.raycastNormal` (`SHOT_QUERY`: world, terrain and armour glass, `physics.ts:41`). It then
  applies `materialAt(handle)` (`:3488-3503`): props through `entityMaterial` and `materialClass(model)`,
  terrain as `concrete`. Penetration uses energy against `resist × thickness`, where `exitPoint` probes 1.2 m
  back. Ricochet applies on hard classes. The `arcade` ballistics rule turns penetration off. Non-ballistic
  hitscan uses `raycastHit` (`:2812`) with no material. Projectiles are stepped in `stepBullets` (`:3318`) through
  the same `bulletSegment`.
- **Ballistic classes** (`sim/gunplay.ts:571-640`): 14 classes. `materialClass` regexes the id, and with no
  category it falls back to `concrete`. Results for natural props are in the inventory's last column. Trunk
  posts are 0.5 m. If trunks were reclassified as `wood` (resist 1000), rifles (energy 1,200–3,000,
  `content/weapons/families.json`) would penetrate them and pistols (350–450) would not. As `concrete`
  (resist 7000) nothing penetrates. **Reclassifying trees is a cover change, not a cosmetic fix** (Q3).
- **Impact effects:** the client derives these itself. Events carry no surface: the `shot` and `impact` events
  (`match.ts:3308, 3341`) carry only points and victims. `view.landRound` (`client/src/game/view.ts:883-924`)
  re-raycasts locally (`impactVisuals.ts:230 surfaceHit`), then `surfaceOfBox` (`fxMap.ts:59`) resolves a free
  block's material, else `surfaceIndex` (`fxMap.ts:50`, model id words from `content/vfx.json map.surfaces`).
  There are 6 surfaces: stone, metal, wood, dirt, flesh, water. Unmatched ids are stone and terrain is dirt.
  **The server class and the client effect come from two different word lists**, so they disagree (for example
  `log`: concrete on the server, wood effects on the client). Sounds: one `impact.world` for every surface
  (`sessionAudio.ts:263,283`).
- **Bushes and visibility:** bushes have no collider, so shots and bot sight lines pass through them.
  `conceals` props become `hides` cylinders (`match.ts:641-648`). `concealed()` (`:1789`) hides a player whose
  eye is under the bush top, unless they fired in the last 2 s. Bots then spot them only up close. Bot
  line of sight is `physics.lineOfSight` against static world colliders only (`physics.ts:401`). **Crowns
  never block sight or shots**, except the post through their middle. Terrain foliage is drawn only and never
  conceals. None of this depends on graphics settings.
- **Lag compensation** rewinds only players (`MAX_REWIND_TICKS = 18`, `match.ts:93`; history ring `:573`).
  Static world colliders are not rewound and do not need to be: environment colliders must just stay static.

## 4. Recast navigation (spec §4.4)

- `NavWorld.build` (`shared/src/nav/index.ts:49-92`) calls `generateSoloNavMesh` with: cell 0.2 m, height 0.05 m,
  slope from `PLAYER.maxSlopeDegrees`, climb from `maxStepHeight`, radius = capsule radius + 0.2 m. The input is
  `boxesToTriangles(boxes)` plus `extra` triangles (terrain only today) plus off-mesh jump links.
- Match setup: `NavWorld.build([...geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), links)`
  (`match.ts:629`, rebuilt at `:1012`). Every solid natural prop box is an obstacle. Non-colliding plants are
  absent. There is **no tile cache and no runtime obstacle**: the navmesh is static for the match.
- The terrain trimesh is the walkable base. Steep terrain faces work as cliffs through the slope limit.
- Host baseline (§7.2): natural props add 289–482 static boxes on the three test maps. The navmesh build time did
  not change measurably (it is dominated by terrain size).

## 5. Rendering: instancing, LOD, shadows, wind, quality, WebGPU/WebGL2 (spec §4.5)

- **Placed props** (`client/src/game/propVisuals.ts:19-50`): one `TransformNode` per entity. Untinted props in
  the game use `ModelLibrary.instantiateStatic` (`client/src/content/models.ts:70`), which merges the model's
  meshes per material (`mergeModel`, `:90`) and gives each entity an `InstancedMesh` per material. That is one
  draw call per material per model, but **one active mesh per entity per material** for Babylon's per-frame
  evaluation. Tinted props are full clones. World matrices are frozen.
- **LOD:** only models carrying `extras.lod` nodes (the 8 `mn_*` built by `nature.mjs`) get Babylon LOD
  levels on the instance source (`models.ts:150-157`, `takeLods :227`). They switch per instance by distance
  (30 m and 90 m, then an impostor card with `BILLBOARDMODE_Y`). Kenney and Quaternius trees have no LOD.
- **Terrain foliage** (`client/src/foliage.ts`): this is the reusable pattern.
  - `place()` (`:314`) is deterministic (FNV-seeded from the map id) and returns `kind:chunkX:chunkZ` →
    model → matrices. It skips covered ground and slopes (dy > 0.7 per 0.5 m).
  - Thin instances per model per 64 m sector (`SECTOR = 2` × `CHUNK = 32`, `:77,104`). Each sector clones its base
    mesh and gets its own buffer and bounding info (culled per sector).
  - `update()` (`:192`) runs only after the camera moves 1 m. Per chunk it picks shown/hidden and a thinning
    share, in eighths, for decorative kinds. Ranges are grass 60, tall 70, flower 70, shrub 90, pebbles 50,
    bush 130, reed 80 m (`:53`).
  - Quality `DETAIL` (`:71`): low 0.5 range, 0.35 density; medium 0.8, 0.75; high 1, 1. Shrubs and bushes are
    never thinned.
  - Materials are swapped to `StandardMaterial` lambert with no specular and at most 2 lights. Cut-outs use
    alpha test. `mn_*` plants draw their lightest LOD.
- **Border and backdrop:** thin instances, split into 120 m squares by `splitThin` (`borderVisuals.ts:896`) so
  they cull, with far rows of ~70-triangle cones as the LOD.
- **Shadows** (`client/src/game/atmosphere.ts`): low has none. Medium has one 2048 map in a box that follows
  the camera. High has a 3-cascade CSM, 2048, 120 m (`:55-60`). Casters are filtered per frame by distance; small
  clutter (`isSmallProp`, `propVisuals.ts:54`) casts only within 15 m (`SMALL_CASTER_REACH`, `:34`). **Instanced
  and thin-instanced meshes always draw in the shadow pass** (`customAllowRendering`). Terrain foliage never casts
  (`:227`).
- **Wind:** none. There is no vertex animation of any plant.
- **Quality tiers** (`client/src/game/graphicsSettings.ts`): `low | medium | high`. Phones start on low,
  desktops on medium. They change shadows, post-processing, foliage range and density, border far sectors
  (`SECTOR_FAR`) and backdrop density. **No tier removes a placed prop.** Cover is never quality-dependent today.
- **Fog/haze/mist:** exponential fog in the horizon colour (`backdrop.ts`), plus ground mist as a screen pass on
  medium and high (`game/skyEffects.ts`).
- **WebGPU/WebGL2:** WebGL2 by default, WebGPU only through `?renderer=webgpu` (`engine.ts:37-63`), in a separate
  chunk with a fallback when the device is lost. The comment records "some of our materials draw flat white and
  effects land in the wrong place" on WebGPU. Atmosphere checks `isWebGPU` (`atmosphere.ts:53`). The `webgpu`
  e2e flow uses `e2e/webgpuShim.js`. Any custom shader (wind, impostors) needs GLSL and WGSL paths, for example a
  Babylon `MaterialPluginBase` with both.

## 6. Content build, bundling, caching and loading (spec §4.6)

- Node tools under `tools/content/` use `@gltf-transform/*` 4.5.1, `meshoptimizer` ^1.3.0 and `sharp`.
  `nature.mjs` already does: FBX in, a weld by position, meshoptimizer simplification per LOD, voxel
  `remesh` (`Shell` for leaves), per-face colour painting, an impostor rendered by `raster.mjs`, and LOD and
  impostor nodes marked with glTF `extras { lod, distance, billboard }`. This is the integration point for
  generated LODs: the client already understands these extras.
- Pipeline conventions to follow: source JSON in `content/` → generator `.mjs` → `*.generated.ts` in
  `packages/shared/src/content/` (gameplay data only) + a `content/*.lock.json` (one line per file: sha, bytes,
  triangles) + built assets in `packages/client/public/<dir>/`. `pnpm content:rebuild` must be deterministic
  (a second run changes nothing), and `content:check` runs in CI (strict schemas; unknown fields are errors).
  See HANDOFF, content scalability steps 3–6.
- **Caching:** every asset URL gets `?v=<git commit>` (`client/src/assetUrl.ts`), so files are not content-hashed:
  a new build re-downloads every model. Models load lazily per map through `ModelLibrary.load`
  (`models.ts:31-48`), one `AssetContainer` per file. Textures are embedded in the GLB.
- **Host and server** import only `@tiletrigger/shared`. Sizes and colliders come from `props.generated.ts`, so no
  GLB or texture ever reaches them. The replacement must keep it so.

## 7. Test scenes, instrumentation and baseline (spec §4.7)

### 7.1 Existing tests and tools

- Unit tests: `packages/client/test/foliage.test.ts`, `shared/test/conceal.test.ts`, `border.test.ts`, `backdrop.test.ts`,
  `dressing.test.ts`, `stylePacks*.test.ts`, `physicsfx.test.ts`, `mechanics.test.ts`. Fixture-equality
  ("proof of no change") tests exist for materials and pickups.
- E2E (`e2e/run.mjs`): `scenery` (foliage instances, painting plants, the scatter forest: `:1576-1638`), `editor`
  (scatter rocks bedded: `:849-860`), `webgpu`, `visual` (baselines `e2e/baselines/{menu,mapmaker,arena,canyon}.png`),
  `dedicatedhost`, `hostgame`, and per-map flows.
- Perf: `tools/perf/client-perf.mjs` (draws, active meshes, triangles, casters, terrain plants in view, the
  biggest mesh groups), `perf96.mjs` (96-bot frame split), `host96.mjs`, the in-game F3 overlay, recordings,
  `compare.mjs` and traces (`docs/PERF_TOOLS.md`).

### 7.2 Baseline: what was measured and how

**Maps:** Backwoods, Norman Shores, Eagle Spires. They rank 3rd, 4th and 1st by natural prop count, and between
them have both forest borders, the most painted foliage, and Meshy, Quaternius and Kenney trees.

Static content (from the map files and the props lock):

| Map | Props / natural | Natural models | LOD0 tris of placed natural props | Natural colliders (trunks) | Conceal bushes | Terrain (cells, spacing) | Painted foliage (level 3–4 cells) | Border / scenery |
|---|---|---|---|---|---|---|---|---|
| backwoods | 782 / 482 | 28 (1.69 MB GLB) | 667 k | 276 (216) | 95 | 80×96, 2 m | 5,632 | forest / forest |
| norman_shores | 956 / 468 | 17 (0.67 MB) | 343 k | 343 (339) | 120 | 160×160, 2 m | 13,123 | forest / forest |
| eagle_spires | 624 / 596 | 12 (0.51 MB) | 407 k | 402 (226) | 194 | 150×150, 2 m | 9,666 | none / peaks |

Host side (`node --experimental-transform-types`, shared code only: `buildMapGeometry`, `PhysicsWorld`,
`NavWorld.build`, with and without the natural props):

| Map | Static boxes with / without natural | Of which natural | Rapier colliders after merge | Rapier build ms (with / without) |
|---|---|---|---|---|
| backwoods | 1,274 / 985 | 289 | 904 / 615 | 158 / 32 |
| norman_shores | 3,237 / 2,894 | 343 | 2,444 / 2,101 | 197 / 86 |
| eagle_spires | 865 / 383 | 482 | 854 / 372 | 53 / 31 |

Navmesh build was 1.0–3.3 s, with no consistent difference (noise on a loaded machine).

Client render (`tools/perf/client-perf.mjs`, after `pnpm build`). Setup: headless Chromium with SwiftShader (CPU
rendering), 960×540, render scale `sharp`, offline match, `PERF_BOTS=2`, 4 s settle, then 8–10 s turning a
quarter turn per second at the spawn. On the two larger maps Chromium needed `--disk-cache-size=1
--disable-gpu-shader-disk-cache --js-flags=--max-old-space-size=6144` (a temporary copy of the script; the
container had 200 MB of disk free and other agents' browsers running at load 9–15). Counts are averages over the
sampled frames.

| Map | Graphics | Draw calls | Active / all meshes | Triangles drawn | Shadow casters | Materials | Terrain plants in view (draws / instances / tris) |
|---|---|---|---|---|---|---|---|
| backwoods | medium | 451 | 394 / 1,946 | 1.88 M | 970 | 474 | 75 / 4,011 / 0.52 M |
| norman_shores | medium | 472 | 751 / 3,004 | 1.75 M | 522 | 515 | 53 / 3,076 / 0.39 M |
| eagle_spires | medium | 203 | 647 / 3,255 | 0.37 M | 48 | 380 | 21 / 1,118 / 0.14 M |
| eagle_spires | low | 229 | 895 / 3,255 | 0.32 M | 0 | 380 | 30 / 336 / 0.04 M |
| backwoods | low | (invalid: the renderer stalled; 2 draws counted) | 478 / 1,885 | — | 0 | 454 | 67 / 2,006 / 0.27 M (end snapshot) |
| norman_shores | low | (renderer crashed twice) | | | | | |

Largest triangle groups in view (end-of-run snapshot, medium):

- Backwoods: terrain grass `grass_tall` 151 k, `grass_leafy` 126 k, `grass_patch` 120 k; border far cones 98 k;
  backdrop cones 94 k; border `nt_pine_tall` 86 k; `mn_fir` ×19 76 k; `mn_fern` 50 k; `mn_oak` ×9 45 k;
  `mn_birch` ×9 40 k.
- Norman Shores: grass 119 k + 111 k + 105 k; border far 108 k; backdrop 94 k; border `nt_pine_tall` 50 k,
  `nt_common_tree` 40 k.
- Eagle Spires: grass 44 k + 38 k + 37 k; `nt_pine_tall` ×32 33 k; `nt_pine_small` ×21 26 k; backdrop belt
  props ×141/×98 (`tree_*`, `oak_dark`).

**Frame times were not measured meaningfully.** SwiftShader on a shared, loaded CPU gave 0.1–1.4 fps, which
says nothing about a player's GPU. The before/after frame-time comparison the spec asks for (§9, §13.6) needs
the in-game recording (`Esc → Settings → Record performance`, `node tools/perf/compare.mjs`) on the owner's
machine, or `PERF_GPU=1` on a GPU runner. See Q9.

What the baseline says:

1. **Terrain grass is the largest single triangle cost** (0.4–0.5 M in view on medium). It comes from Kenney
   grass meshes at 132–224 triangles per clump, about 5× the spec's 12–40.
2. **Placed natural props cost active meshes more than triangles.** Each is one `InstancedMesh` per material
   (a Quaternius tree is 2–3 materials). On Eagle Spires 596 natural props are most of the 3,255 meshes the
   scene evaluates.
3. **Trees cast many shadows:** 970 casters on Backwoods medium, because instances always draw in the shadow pass.
4. Meshy `mn_*` trees at 4–5 k LOD0 triangles are the heaviest per instance, but they have LODs and impostors.
5. Downloads are small (0.5–1.7 MB of natural GLBs per map).

## 8. Proposed migration mapping

Rules:

- **Species names** are `env.<family>.<species>` (they already satisfy `ContentId`, `schema.ts:35`). A
  species changes structure and silhouette. Colour or season (summer, autumn, snow, dark, moss) is a
  **material variant** of the same species, as the spec's §7 asks.
- **Transforms are kept.** `position` and `yaw` are copied. `scale` becomes
  `old.scale × oldHeight / species.nominalHeight[variant]` (clamped to 0.25–4), so drawn height matches. `solid`
  and `tint` are kept. A `variant` index is added, chosen from the table, then by the best match to the old
  collision box's aspect.
- **Intended cover is kept:** the new collider must give the same or more cover at chest height (1.0–1.6 m)
  than the old one. Trunks get a capsule at least as wide as the old 0.5 m post up to crown base. The full-height
  post through the crown goes away; crowns let shots through, as the spec's §6 asks (Q4). Rocks keep a
  footprint within ±15 % of the old box and the same height ±10 %, checked by a migration test per id.
- `conceals` is kept for every bush, fern and crop that has it today. Ferns (`fern`, `nt_fern_wide`) and crops
  keep it as well.
- **Keep as prop** (not natural, or a set piece): `woodpile`, `planks_stack`, `log_stack`, `campfire_stones`,
  `jt_tree_root_arch`, `rn_wall_arch_ivy`.

| Old id (`prop.`) | New species | Variant | Collider (new) | Notes |
|---|---|---|---|---|
| campfire_stones | **keep as prop** |  | unchanged | campfire: man-made |
| jt_tree_root_arch | **keep as prop** |  | unchanged | set piece (walk-through arch); revisit in Phase 5 |
| log_stack | **keep as prop** |  | unchanged | cut timber: man-made |
| planks_stack | **keep as prop** |  | unchanged | lumber: man-made |
| rn_wall_arch_ivy | **keep as prop** |  | unchanged | ruin wall (masonry), ivy is decoration |
| woodpile | **keep as prop** |  | unchanged | cut firewood: man-made |
| cactus | `env.arid.cactus_round` |  | hull box |  |
| nt_cactus_flowers | `env.arid.cactus_round` | flowering | hull box |  |
| nt_cactus_round | `env.arid.cactus_round` |  | hull box |  |
| ww_cactus_c | `env.arid.cactus_round` | paddle | hull box |  |
| cactus_tall | `env.arid.saguaro` | small | trunk capsule(s), crown none |  |
| nt_saguaro | `env.arid.saguaro` |  | trunk capsule(s), crown none |  |
| ww_cactus_a | `env.arid.saguaro` |  | trunk capsule(s), crown none |  |
| ww_cactus_b | `env.arid.saguaro` |  | trunk capsule(s), crown none |  |
| ww_cactus_d | `env.arid.saguaro` |  | trunk capsule(s), crown none |  |
| tumbleweed | `env.arid.tumbleweed` |  | none |  |
| ww_tumbleweed | `env.arid.tumbleweed` |  | none |  |
| mn_birch | `env.broadleaf.birch` | summer | trunk capsule(s), crown none |  |
| nt_birch | `env.broadleaf.birch` | summer | trunk capsule(s), crown none |  |
| nt_birch_autumn | `env.broadleaf.birch` | autumn | trunk capsule(s), crown none |  |
| nt_birch_snow | `env.broadleaf.birch` | snow | trunk capsule(s), crown none |  |
| tree_thin | `env.broadleaf.birch` | summer | trunk capsule(s), crown none |  |
| mn_oak | `env.broadleaf.oak` | summer | trunk capsule(s), crown none |  |
| oak | `env.broadleaf.oak` | summer | trunk capsule(s), crown none |  |
| oak_autumn | `env.broadleaf.oak` | autumn | trunk capsule(s), crown none |  |
| oak_dark | `env.broadleaf.oak` | summer-dark | trunk capsule(s), crown none |  |
| tree_detailed | `env.broadleaf.oak` | summer | trunk capsule(s), crown none |  |
| nt_common_tree | `env.broadleaf.round` | summer | trunk capsule(s), crown none |  |
| nt_common_tree_2 | `env.broadleaf.round` | summer | trunk capsule(s), crown none | second crown preset |
| nt_common_tree_autumn | `env.broadleaf.round` | autumn | trunk capsule(s), crown none |  |
| nt_common_tree_snow | `env.broadleaf.round` | snow | trunk capsule(s), crown none |  |
| tree | `env.broadleaf.round` | summer | trunk capsule(s), crown none |  |
| tree_autumn | `env.broadleaf.round` | autumn | trunk capsule(s), crown none |  |
| tree_blocks | `env.broadleaf.round` | summer | trunk capsule(s), crown none | stylised cube crown: no direct equivalent |
| tree_fat | `env.broadleaf.round` | summer | trunk capsule(s), crown none | low wide crown preset |
| tree_round | `env.broadleaf.round` | summer | trunk capsule(s), crown none |  |
| tree_round_autumn | `env.broadleaf.round` | autumn | trunk capsule(s), crown none |  |
| tree_round_dark | `env.broadleaf.round` | summer-dark | trunk capsule(s), crown none |  |
| tree_tall | `env.broadleaf.round` | tall | trunk capsule(s), crown none |  |
| tree_small | `env.broadleaf.sapling` | summer | trunk capsule(s), crown none |  |
| nt_willow | `env.broadleaf.willow` | summer | trunk capsule(s), crown none |  |
| nt_willow_autumn | `env.broadleaf.willow` | autumn | trunk capsule(s), crown none |  |
| cliff_corner | `env.cliff.corner` | 4m | stone hull/trimesh |  |
| cliff | `env.cliff.face` | 4m | stone hull/trimesh |  |
| mc_cave_rock_wall | `env.cliff.face` | cave | stone hull/trimesh |  |
| cliff_steps | `env.cliff.ledge_steps` | 4m | stone hull/trimesh |  |
| nt_pine_autumn | `env.conifer.larch` | autumn | trunk capsule(s), crown none | larch turns gold |
| nt_pine_snow_tall | `env.conifer.pine_tall` | snow | trunk capsule(s), crown none |  |
| nt_pine_tall | `env.conifer.pine_tall` | summer | trunk capsule(s), crown none |  |
| pine | `env.conifer.pine_tall` | crooked:0 | trunk capsule(s), crown none |  |
| pine_crooked | `env.conifer.pine_tall` | crooked:1 | trunk capsule(s), crown none |  |
| pine_tall | `env.conifer.pine_tall` | summer | trunk capsule(s), crown none |  |
| pine_tall_b | `env.conifer.pine_tall` | summer | trunk capsule(s), crown none |  |
| nt_pine_small | `env.conifer.pine_young` | summer | trunk capsule(s), crown none |  |
| pine_small | `env.conifer.pine_young` | summer | trunk capsule(s), crown none |  |
| mn_fir | `env.conifer.spruce` | summer | trunk capsule(s), crown none |  |
| pine_round | `env.conifer.spruce` | summer | trunk capsule(s), crown none |  |
| tree_cone | `env.conifer.spruce` | summer | trunk capsule(s), crown none |  |
| corn | `env.crop.corn` |  | none |  |
| nt_corn | `env.crop.corn` |  | none (conceal volume) | conceals |
| nt_wheat | `env.crop.wheat` |  | none (conceal volume) | conceals |
| wheat | `env.crop.wheat` |  | none |  |
| nt_dead_tree | `env.dead.snag` |  | trunk capsule(s), crown none |  |
| rn_dead_tree | `env.dead.snag` | gnarled | trunk capsule(s), crown none |  |
| nt_willow_dead | `env.dead.willow` |  | trunk capsule(s), crown none |  |
| log | `env.deadwood.log` | small | wood box |  |
| log_big | `env.deadwood.log` | large | wood box |  |
| nt_log_large | `env.deadwood.log` | large | wood box |  |
| nt_log_moss | `env.deadwood.log` | moss | wood box |  |
| nt_log_snow | `env.deadwood.log` | snow | wood box |  |
| nt_stump_large | `env.deadwood.stump` | large | wood box |  |
| nt_stump_moss | `env.deadwood.stump` | moss | wood box |  |
| stump | `env.deadwood.stump` | cut | wood box |  |
| stump_cut | `env.deadwood.stump` | cut | wood box |  |
| stump_old | `env.deadwood.stump` | old | wood box |  |
| fern | `env.fern.fern` (done early, Phase 1c: `env.fern.bracken`, height kept) | summer | none (conceal volume) | conceals |
| mn_fern | `env.fern.fern` | forest | none |  |
| nt_fern_wide | `env.fern.fern` | wide | none (conceal volume) | conceals |
| jg_giant_fern | `env.fern.giant` |  | none |  |
| jt_plant_cluster | `env.fern.giant` | cluster | none |  |
| grass_leafy | `env.grass.clump` | leafy | none |  |
| grass_patch | `env.grass.clump` | summer | none |  |
| grass_tuft | `env.grass.clump` (done early, Phase 1c: summer) | dry | none |  |
| grass_tall | `env.grass.clump_tall` (Phase 1c: `env.grass.clump`, height kept) | summer | none |  |
| flower_purple | `env.grass.wildflowers` (Phase 1c: `env.flower.meadow`) | purple | none |  |
| flower_red | `env.grass.wildflowers` (Phase 1c: `env.flower.meadow`, white: no red variant yet) | red | none |  |
| flower_yellow | `env.grass.wildflowers` (Phase 1c: `env.flower.meadow`) | yellow | none |  |
| nt_wildflowers | `env.grass.wildflowers` | mixed | none |  |
| hanging_moss | `env.groundcover.hanging_moss` |  | none |  |
| mushroom_tall | `env.groundcover.mushrooms` | tall | none |  |
| mushrooms | `env.groundcover.mushrooms` | cluster | none |  |
| plant_low | `env.groundcover.scrub` (Phase 1c: `env.fern.bracken`, which conceals) | dry | none |  |
| jg_vine_curtain | `env.groundcover.vine_curtain` |  | none |  |
| boulder_jagged | `env.rock.boulder_angular` |  | stone hull boxes |  |
| mc_cave_rocks_a | `env.rock.boulder_angular` | cave | stone hull boxes |  |
| mc_cave_rocks_b | `env.rock.boulder_angular` | cave | stone hull boxes |  |
| nt_boulder_tall | `env.rock.boulder_angular` | tall | stone hull boxes |  |
| rock_large | `env.rock.boulder_angular` |  | stone hull boxes |  |
| boulder_round | `env.rock.boulder_rounded` |  | stone hull boxes |  |
| mc_cave_rocks_c | `env.rock.boulder_rounded` | cave | stone hull boxes |  |
| mc_cave_rocks_d | `env.rock.boulder_rounded` | cave | stone hull boxes |  |
| nt_boulder | `env.rock.boulder_rounded` |  | stone hull boxes |  |
| nt_boulder_moss | `env.rock.boulder_rounded` | moss | stone hull boxes |  |
| nt_boulder_snow | `env.rock.boulder_rounded` | snow | stone hull boxes |  |
| stones | `env.rock.pebbles` (done, Phase 1c: scale kept; bigger in 1d) | grey / sand | none | no collider (as now) |
| nt_rock_moss | `env.rock.rock` | moss | stone hull boxes |  |
| nt_rock_snow | `env.rock.rock` | snow | stone hull boxes |  |
| rock_medium | `env.rock.rock` | medium | stone hull boxes |  |
| rock_small | `env.rock.rock` | small | stone hull boxes |  |
| rock_pile | `env.rock.scree` |  | stone hull boxes |  |
| boulder_flat | `env.rock.slab` |  | stone hull boxes |  |
| nt_rock_flat | `env.rock.slab` | small | stone hull boxes |  |
| rock_flat | `env.rock.slab` |  | stone hull boxes |  |
| mn_rock_spires | `env.rock.spire` | red-group | stone hull boxes | shell collider kept as boxes |
| rock_mossy_spire | `env.rock.spire` | mossy | stone hull boxes |  |
| rock_spire_tall | `env.rock.spire` | single | stone hull boxes |  |
| rocks_tall | `env.rock.spire` | cluster | stone hull boxes |  |
| stone_pillar | `env.rock.spire` | pillar | stone hull boxes |  |
| nt_bush_berries | `env.shrub.berry` |  | none (conceal volume) | conceals |
| bush | `env.shrub.broadleaf` | summer | none (conceal volume) | conceals |
| bush_large | `env.shrub.broadleaf` | large | none (conceal volume) | conceals |
| bush_leafy | `env.shrub.broadleaf` | leafy | none (conceal volume) | conceals |
| bush_small | `env.shrub.broadleaf` (Phase 1c: retired from the palette; no map placed it) | small | none (conceal volume) | conceals |
| mn_shrub | `env.shrub.broadleaf` | forest | none |  |
| nt_bush_leafy | `env.shrub.broadleaf` | leafy | none (conceal volume) | conceals |
| nt_bush_snow | `env.shrub.broadleaf` | snow | none (conceal volume) | conceals |
| pine_ground | `env.shrub.juniper` | summer | none | no collider (as now) |
| bush_cone | `env.shrub.topiary` | cone | none (conceal volume) | conceals |
| tree_plateau | `env.tropical.acacia` | dry | trunk capsule(s), crown none | flat-top |
| jg_bamboo | `env.tropical.bamboo` |  | trunk capsule(s), crown none |  |
| jg_banana_plant | `env.tropical.banana` | small | none |  |
| mn_banana | `env.tropical.banana` |  | trunk capsule(s), crown none |  |
| jt_tree_trunk | `env.tropical.jungle_trunk` | moss | trunk capsule(s), crown none |  |
| eg_palm | `env.tropical.palm` | date | trunk capsule(s), crown none |  |
| nt_palm_curved | `env.tropical.palm` | bent | trunk capsule(s), crown none |  |
| nt_palm_tall | `env.tropical.palm` | straight | trunk capsule(s), crown none |  |
| palm | `env.tropical.palm` | straight | trunk capsule(s), crown none |  |
| palm_bent | `env.tropical.palm` | bent | trunk capsule(s), crown none |  |
| palm_short | `env.tropical.palm` | short | trunk capsule(s), crown none |  |
| palm_tall | `env.tropical.palm` | straight | trunk capsule(s), crown none |  |
| lily | `env.water.lily` |  | none |  |
| eg_papyrus | `env.water.reeds` | papyrus | none |  |
| mn_eelgrass | `env.water.reeds` (done, Phase 1c, as its own species `env.water.eelgrass`: green / olive) | eelgrass | none |  |

That is 48 species in 14 families (plus 6 kept props) for all 143 ids. The 6 Phase 1 species are
`env.broadleaf.oak`, `env.conifer.pine_tall`, `env.shrub.broadleaf`, `env.grass.clump`, `env.rock.boulder_angular`
and `env.cliff.face`. Together they cover 2,197 of the 6,246 placed instances, plus most of the terrain foliage.

**Non-entity users of the old ids** move with the same table: foliage `KINDS`, scatter sets, style-pack palettes,
backdrop belts and border kits all name `prop.*` ids and switch to species in Phase 4.

### Unknown and unsupported ids (policy)

1. The migration table covers **every natural id that ever shipped**. A test walks `content/props/*.json` and all
   `maps/*.json` and fails when a natural-category id has no mapping row, so a new natural prop cannot be added
   without one.
2. The migration (v25→v26) rewrites only ids in the table. Anything else is left as it is: non-natural props,
   and ids from packs that were never in the core catalogue.
3. After migration, an id the catalogue does not know **no longer stops the map from loading in play**. It
   becomes the placeholder `env.missing`: drawn as a neutral grey rock-like proxy of the old size when known,
   else 1×2×1 m. If the entity is `solid`, it collides as a conservative 1×2×1 m stone box (it stops shots and
   blocks the navmesh). A **warning** `prop.missing` goes into the validation issues, the host log and the
   MapMaker issue list. **Gameplay obstacles are never silently dropped.**
4. MapMaker publish and owner publish still treat `prop.missing` as an error, so nothing new is published with
   a placeholder.
5. Old ids keep resolving through a frozen alias table (`old id → species, variant, scale factor`) for one full
   release after Phase 4, for community maps loaded from files that skipped the migration path. Then the table
   is used only by `migrate.ts`.

## 9. Proposed design

### 9.1 Shared data (zod), gameplay only

`packages/shared/src/content/environment.ts`: types and zod schemas, plus lookups. Its generated table is
`environment.generated.ts`. No Babylon, no textures, no file paths.

```ts
export const ENV_CATEGORIES = ['tree', 'plant', 'groundcover', 'rock', 'boulder', 'cliff'] as const; // MapMaker: Trees, Plants, Ground Cover, Rocks, Boulders, Cliffs
const V3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
/** Who a shape stops: everything (trunks, boulders, cliffs) or only shots and sight (a branch overhead). */
const Blocks = z.enum(['all', 'shots']);
export const EnvShape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('capsule'), a: V3, b: V3, r: z.number().positive(), blocks: Blocks, surface: SurfaceTypeId }),
  z.object({ kind: z.literal('box'), min: V3, max: V3, yaw: z.number().default(0), blocks: Blocks, surface: SurfaceTypeId }),
  z.object({ kind: z.literal('hull'), points: z.array(V3).min(4).max(64), blocks: Blocks, surface: SurfaceTypeId }),
  z.object({ kind: z.literal('mesh'), positions: z.array(z.number()).max(3 * 512), indices: z.array(z.number().int()).max(3 * 512), blocks: Blocks, surface: SurfaceTypeId }),
]);
export const EnvVariant = z.object({
  /** Index stored on placements (`PropEntity.variant`). Never reused. */
  index: z.number().int().min(0).max(255),
  name: z.string(),          // 'summer', 'autumn', 'snow', 'moss' …: material variants share the shapes
  seed: z.number().int(),    // generator seed: a structural variant (another crown) has its own shapes
  size: V3,                  // bounds [w, h, d] at scale 1, metres
  shapes: z.array(EnvShape).max(24),
});
export const EnvironmentSpecies = z.object({
  id: ContentId,                         // env.<family>.<species>
  assetVersion: z.number().int().min(1), // bumped when any shape or size changes (gameplay change; reviewed)
  family: z.string(), category: z.enum(ENV_CATEGORIES), displayName: z.string(),
  nominalHeight: z.number().positive(),
  variants: z.array(EnvVariant).min(1),
  nav: z.enum(['none', 'obstacle', 'boundary']),
  /** Hiding (sim/match.ts `hides`): a cylinder, scaled with the placement; null = none. */
  conceals: z.object({ radius: z.number(), height: z.number() }).nullable(),
  placement: z.object({
    maxSlopeDegrees: z.number(), minSpacing: z.number(), scale: z.tuple([z.number(), z.number()]),
    grounds: z.array(z.enum(TERRAIN_MATERIALS)).optional(), altitude: z.tuple([z.number(), z.number()]).optional(),
    role: z.enum(['decorative', 'cover', 'blocking']), // decorative = may be density-generated client side
  }),
}).strict();
```

The **map** keeps `PropEntity`, so the editor, undo, settle, budgets, dressing and the hub all keep working.
Format v26 adds one optional field: `variant: z.number().int().min(0).max(255).optional()`. `model` may name an
`env.*` species, and `getProp` falls back to a `PropDefinition` view of the species (size, `collision: null`,
`category`). Collision comes from `environmentShapes()`, not from `collision`. **Terrain foliage stays
`terrain.foliage` levels.** The client maps levels to species. Ground cover is `role: 'decorative'` and never
collides, conceals or blocks sight, so it may stay client-generated (spec §8's condition).

### 9.2 Generator in `tools/content`

- `content/environment/<family>.json`: species, variants, seeds, budgets, `assetVersion`, materials, and
  generator parameters (renderer and generator data, separate from the gameplay fields above). Plus
  `content/environment/migration.json`, the §8 table.
- `tools/content/environment.mjs` (`pnpm content:environment`, run by `content:rebuild` and `content:check`)
  drives `tools/content/env/`:
  - `rng.mjs`: one seeded PRNG; `Math.random` is banned by a lint test.
  - `tree.mjs`: skeleton, generalised-cylinder sweep, root flare, leaf-card clusters.
  - `conifer.mjs`: whorled monopodial skeleton and needle-card sprays.
  - `bush.mjs`, `grass.mjs`.
  - `rock.mjs`: plane-fracture convex chunk, fBm, edge wear, strata.
  - `cliff.mjs`: seam-locked panel.
  - `atlas.mjs`: leaf and needle cards and bark/rock tiling maps, drawn procedurally with `sharp` (RGBA, alpha
    coverage measured).
  - `collide.mjs`: shapes from the skeleton or hull, rounded to mm, independent of LODs.
  - Reuse `nature.mjs`'s `buildNatureDocument` for LODs, the impostor and the `extras` contract, and `raster.mjs`
    for impostors.
- Outputs:
  - `packages/client/public/env/<species>.glb`: per variant, LOD0..n + impostor nodes, as the `extras` contract
    already reads.
  - `packages/client/src/content/environment.generated.ts`: client only. Files, LOD distances, wind weights,
    material ids, shadow class.
  - `packages/shared/src/content/environment.generated.ts`: gameplay only. §9.1 data and the migration table.
  - `content/environment.lock.json`: one line per file with sha256, bytes, triangles per LOD,
    `generatorVersion` and `assetVersion`.
- **Determinism:**
  - Only seeded RNG is used. Vertex data is rounded to 1e-4 m before writing. `@gltf-transform` writes with a
    stable node and accessor order.
  - `content:check` rebuilds into a temp dir and compares sha256 with the lock.
  - Shapes in the shared table are rounded to 1 mm.
  - The generator **refuses to change a published species' shapes or size without an `assetVersion` bump**. A bump
    needs an entry in the species' `notes`, and a fixture test pins every species' shapes
    (`environment-resolved.json`, as the materials and pickups steps do).
- **Licences:** only our own code plus `@gltf-transform` (MIT), `meshoptimizer` (MIT) and `sharp` (Apache-2.0),
  all already dependencies. No external service. Generated assets are recorded in provenance as "Tile Trigger,
  generated, owned".

### 9.3 Client: chunked thin-instance rendering

New `packages/client/src/environment/` (an `EnvironmentVisuals`, like `FoliageVisuals`):

- **Input:** every `env.*` placement (from `entities`) plus decorative ground cover grown from `terrain.foliage`
  (`foliage.ts`'s `place()` rule, now naming species). One code path replaces `foliage.ts` and the per-entity
  prop nodes for natural pieces.
- **Batches:** keyed by (species, variant material, LOD level, 64 m sector). Each is a thin-instance mesh with its
  own bounding info, so it is culled per sector; there is never a map-wide batch. Placements are bucketed per
  32 m chunk, as `foliage.ts` does.
- **LOD per chunk:** on camera moves of 1 m or more, each chunk gets a level from its nearest-edge distance with
  hysteresis (±10 %). Its matrices move to that level's sector buffer, using the dirty-sector rebuild that
  `foliage.ts:211-228` already does. The near ring (< 25 m) can split per instance. Babylon mesh LOD is not used
  on thin instances.
- **Impostors:** Y-billboard needs a vertex shader (thin instances ignore `billboardMode`). Use a material plugin
  that turns the card in the vertex stage (GLSL + WGSL), or crossed quads for Phase 1. Both are tested on WebGL2
  and WebGPU.
- **Alpha:** leaf cards use alpha test (`transparencyMode = ALPHATEST`), never blending, with double-sided cards
  where needed. The generator trims card quads to their alpha hull to cut overdraw, and reports coverage.
- **Wind:** a vertex-shader plugin (GLSL + WGSL) driven by per-vertex weights baked into a vertex colour channel
  (trunk 0, branch tips and cards 1) and a per-instance phase from the matrix translation. Colliders never move.
- **Shadows:**
  - Trees and rocks cast, but only sectors within the tier's shadow reach join the render list (today every
    instance draws in the shadow pass).
  - Grass and ground cover never cast. Far LODs cast as their LOD2 or not at all.
- **Quality tiers:**
  - Decorative density and range: today's `DETAIL`.
  - Shadow reach: low none, medium box, high cascades.
  - Wind: low off, medium trunk sway, high full.
  - LOD distances ×0.6 / 0.8 / 1, and material detail: normal maps off on low.
  - **No tier drops a `cover` or `blocking` placement:** these draw at least their LOD2 or impostor out to
    `GAMEPLAY_DRAW = 150 m` on every tier, and a test checks it.
- **Instrumentation:** environment batches are named `env_*`, so `client-perf.mjs` groups them, and F3 gets an
  `environment` line (batches, instances per LOD, triangles).
- **MapMaker** keeps one node per entity for selection, gizmos and picking, as props do today (`instanced`
  only in the game).

### 9.4 Host and shared: collider metadata

- `environmentShapes(map)` in `packages/shared/src/map/environment.ts` turns each `env.*` placement and its
  species variant's shapes, transformed by the placement (position, yaw, scale; drawn tilt is never applied to
  collision), into world shapes with `sourceId`.
- `PhysicsWorld` gains a second static list: capsules (`ColliderDesc.capsule`), hulls (`convexHull`) and meshes
  (`trimesh`), next to the boxes, with `staticShapes: handle → { sourceId, surface }`. `blocks: 'shots'` uses a
  new collision group bit that `SHOT_QUERY` and sight include and the character controller excludes.
- `NavWorld.build` receives the movement-blocking shapes as extra triangles: a capsule becomes an octagonal
  prism, a hull its faces, a mesh itself. `nav: 'none'` shapes are skipped. No runtime obstacles are needed
  (all static).
- Same code on host, server and client, with no GLB. A test compares the host's and a browser-hosted match's
  static collider list hash (§10).
- `hides` (concealment) reads the species' `conceals` instead of `def.size`.

### 9.5 Surface types, shared with the planned material work

One list in shared (`packages/shared/src/sim/surfaceTypes.ts`) used by environment shapes, library materials (an
optional `surface` next to the planned optional `ballistic` override in `content/materials.json`), props and
terrain grounds. Each surface type names its default ballistic class (server) and its effect, decal and sound
set (client). The ballistic class stays the GUNPLAY_SPEC §8 table (`BALLISTIC_MATERIALS`). Surface types add
only what effects and audio need.

| Surface type | Ballistic class (default) | Client effect (`map.impacts`) | Used by |
|---|---|---|---|
| `concrete` | concrete | stone (grey dust, chips) | tiles, blocks |
| `stone` | stone | stone | masonry, flagstone |
| `rock` | stone | rock (stone dust + chips, darker) | boulders, cliffs, rock spires |
| `brick` | brick | stone (red dust) | brick materials |
| `plaster` | drywall | stone (white puff) | plaster, paint, fabric walls |
| `wood` | wood | wood (splinters) | planks, furniture |
| `thin_wood` | thin_wood | wood | crates, fences |
| `bark` | **wood_heavy** (Q3) | wood (bark splinters) | trunks, stumps, logs |
| `foliage` | none (pass-through) | leaves (client-only, on pass-through) | crowns, bushes |
| `metal` | metal | metal (sparks) | steel |
| `sheet_metal` | thin_metal | metal | containers, vehicles |
| `glass` | glass | glass | panes |
| `dirt` | soil | dirt | terrain dirt and mud, sandbags |
| `grass` | soil | dirt (green-brown) | terrain grass and moss |
| `sand` | soil | sand (pale puff) | terrain sand |
| `gravel` | soil | dirt (grey) | terrain gravel |
| `snow` | soil | snow (white puff) | terrain snow |
| `water` | water | water | liquids |
| `flesh` | flesh | flesh | bodies |
| `energy` | energy | none | force fields |

How it ties in:

- The server's `materialAt` reads `surface → ballistic` for environment shapes (and, after the materials job,
  for library materials). `materialClass` regexes stay only as the fallback for legacy props.
- The client derives the effect from the **same shared metadata**: its local ray hits the same collider, and
  `sourceId` leads to species, shape and surface. **No protocol change is needed**, and the server and client can
  no longer disagree (today they use two word lists).
- Terrain hits use the cell material's surface instead of a flat `dirt` and `concrete`.
- Bushes and crowns (`foliage`) have no collider. Their leaf effect, if wanted, is a client-only trace against
  the species' crown volume, purely cosmetic.

### 9.6 Map migration and rollback

- v25→v26 (`migrate.ts`): rewrite `model` and `scale`, add `variant`, from the generated table. The step is pure
  and tested with fixtures: every old id, a v25 map round-trip, idempotence, and non-natural props untouched.
- **Backup:** the input document is never mutated. MapMaker saves a `<id>.v25.json` copy the first time it saves a
  migrated map. The hub keeps its version history. Official maps are in git.
- **Rollback:** a generated reverse table (species + variant → the most-used old id, scale reversed) and a
  `tools/content/env-rollback.mjs` that rewrites v26 maps back to v25 ids, while the old GLBs and catalogue
  entries are still shipped. The old assets are removed only after Phase 4 has passed the §12 tests on every
  map; that is the end of the dual-system window.

## 10. Phase 1 vertical slice (plan)

Six species, one structural variant each plus one material variant (summer, plus snow or moss for the rock),
built by the generator, placed by hand as `env.*` props in MapMaker, and drawn by the new renderer behind a
`?env=1` flag (default off until Phase 4).

| Species | Generator approach | LOD0 / LOD1 / LOD2 / far | Collision (shared) | Surface |
|---|---|---|---|---|
| `env.broadleaf.oak` (~8 m) | Seeded skeleton: trunk with a lean and a 1–2 m clear bole, 3–5 scaffold limbs (phyllotaxis 137.5° ± jitter, gravitropism), 2 orders of branches, space-colonisation toward an irregular crown envelope (2–3 lobes, not a sphere). 6–8-sided generalised cylinders tapering by pipe model, root flare from base displacement. Leaf clusters are 4–8 cut-out cards per tip from a shared 1024² atlas, normals bent toward the crown centre. | 2,800 / 900 / 250 / impostor (2) at 0 / 30 / 70 / 140 m | trunk capsule chain (r ≈ bole radius ≥ 0.25 m) to crown base, `blocks: all`; scaffold limbs > 0.15 m radius as capsules, `blocks: shots` | bark |
| `env.conifer.pine_tall` (~11 m) | Monopodial trunk, whorls every 0.4–0.7 m with 4–6 branches, length decreasing with height (irregular cone), droop by length, 15 % missing branches for asymmetry, lower whorls dead (bare twigs). Needle sprays are bent card strips from the atlas. | 2,400 / 800 / 220 / impostor | trunk capsule (straight or lean), `blocks: all`; no branch shapes | bark |
| `env.shrub.broadleaf` (~1.2 m) | 4–7 short stems from one root, 2 orders, card clusters packed toward a squashed ellipsoid with noise. | 400 / 120 / impostor at 0 / 25 / 60 m | none; `conceals { radius, height }` from the generated bounds (same rule as today: min footprint / 2) | foliage |
| `env.grass.clump` (~0.4 m) | 7–11 blades as tapered 3-segment strips (2 tris per segment, tip 1), bent by a seeded curve, two colour ramps. No LOD: distance thinning as `foliage.ts`. | 24–36 | none | (none) |
| `env.rock.boulder_angular` (~2 m) | Seeded point cloud → convex hull → 4–7 random plane cuts (fracture faces), then low-amplitude fBm on non-cut faces only, edge wear by chamfering hull edges, strata from a tilted band function into the vertex colour. Tri-planar rock texture plus a moss mask (top-facing). | 700 / 220 / 60 at 0 / 30 / 80 m | the hull before displacement, ≤ 32 points, `blocks: all`, nav obstacle; plus the two-tier step rule kept for climbability (test) | rock |
| `env.cliff.face` (8 m wide × 8 m high × 3 m deep) | A displaced grid panel: the left and right edge profiles are a function of height only, from the family seed, so any two panels butt seamlessly (verts identical along the seam); strata ledges by a stepped noise, a base skirt 1 m below grade for terrain transitions, and a top lip. | 2,000 / 600 / 150 | `mesh`, the LOD2-derived ≤ 200 tris, `blocks: all`, nav boundary | rock |

- **Budgets:**
  - Download: ≤ 400 KB per species GLB (the props budget). The shared bark set (512²) and the 1024² leaf atlas are
    one file each.
  - Draws: ≤ 1 draw per species-LOD-sector.
  - Showcase target: a 200×200 m dense forest (2,000 trees, 400 boulders, 30 cliff panels, 40 k grass clumps)
    under the Backwoods medium baseline (451 draws, 1.88 M triangles) at the same camera path.
- **Materials:** generated bark (albedo, normal, roughness), leaf and needle atlas (RGBA, alpha tested, coverage
  reported), rock (tri-planar albedo and normal, roughness varied by moss and wear masks). Lambert-cheap on low,
  PBR on medium and high.
- **Impact effects:**
  - Wire `bark` and `rock` surfaces into `content/vfx.json map.impacts` (bark splinters and rock chips using
    the in-house dust and sparks).
  - Split `impact.world` audio by surface only if sounds exist (none do today; out of the slice unless the owner
    adds sounds).
- **Showcase:**
  - (a) `?envlab`: a dev page in the client in the Character Designer mould. A lineup at FPS eye height
    (1.7 m) with toggles for LOD, wireframe, collider overlay, wind and tier, plus WebGL2/WebGPU, for art review
    and before/after screenshots against the current Kenney/Quaternius pieces.
  - (b) A small map made in MapMaker (`maps/env_showcase.json`, in `RETIRED_MAPS` so it is never offered) for
    the gameplay tests and the perf runs.
- **Tests:**
  - `tools/content/test/environment.test.mjs`: the build is byte-identical twice; budgets per LOD; shapes inside
    the visual bounds; the cliff's seam vertices match across variants; atlas alpha coverage ≥ 55 %; no
    `Math.random`.
  - `packages/shared/test/environmentData.test.ts`: the zod schema; every species has surface, nav and conceal
    data; the `environment-resolved.json` fixture is pinned.
  - `packages/shared/test/environmentCollision.test.ts`:
    - A ballistic and a non-ballistic hitscan and a projectile stop at an oak trunk with `bark`/`wood_heavy`.
    - A shot through the oak crown passes, and a shot at a `blocks: shots` limb stops.
    - The boulder and cliff are `stone`.
    - Bush concealment works as before.
    - A bot path goes round a trunk, a boulder and a cliff, and not round a grass clump.
    - The collider list is identical for the same map built twice and via `loadMap` on both "client" and
      "host" paths.
  - `migrate` test (Phase 4, drafted now): the six ids' mapping rows.
  - E2E: an `environment` flow (envlab renders with no shader or material errors on WebGL2; the `webgpu` flow
    extended to envlab; the eye-height screenshot baseline); `dedicatedhost` on `env_showcase` asserts the host's
    static-collider hash equals the browser-hosted one.
  - Perf: `client-perf.mjs env_showcase backwoods` before/after on the same machine.

**Phase 1 gate:** the owner approves the eye-height screenshots; the tests pass; showcase draws and triangles are
under the baseline; both renderers are clean.

## 11. Risks and open questions for the owner

1. **WebGPU is opt-in today; the spec says "WebGPU preferred".** *Recommended:* build and tune on WebGL2 (the
   default players get) and keep every new shader dual (GLSL and WGSL), tested by the `webgpu` flow. Making
   WebGPU the default is a separate job.
2. **Map storage.** *Recommended:* keep natural objects as `PropEntity` (new `env.*` ids, optional `variant`),
   format v26 with an id-remap migration. The rejected alternative is a new compact `environment` block, which
   would mean new editor selection, undo, settle and budget code. Revisit only if maps hit the 1,500-prop budget.
3. **Tree trunks are `concrete` today: nothing penetrates them.** Making them `wood` lets rifles shoot through a
   0.5 m trunk. *Recommended:* a new ballistic class `wood_heavy` (resist ≈ 6000, no ricochet, wood effects)
   for bark, so trunks stay full cover, with correct splinter effects and a destruction multiplier ready for later.
   Also fix the `bush` → `thin_metal` ("bus") and `tree_plateau` → `metal` ("plate") misreads in the same change.
   That needs the owner's yes because it changes the gameplay of existing props.
4. **The full-height trunk post goes away:** shots through crowns will pass where today the 0.5 m post in the
   crown stops them, and sniping through canopies becomes possible. *Recommended:* yes, per spec §6, with major
   limbs as `blocks: shots` capsules. Playtest Backwoods and Norman Shores before Phase 4.
5. **Unknown ids.** *Recommended:* the §8 policy: a placeholder plus a warning in play, still an error when
   publishing. This changes today's "map doesn't load" behaviour for every unknown prop, not only natural ones.
   *Alternative:* only for `prop.*` ids that were ever natural.
6. **Bushes and sight.** Today bushes conceal (a bots' rule) but do not block sight lines or shots.
   *Recommended:* keep exactly that, so bushes stay decorative to physics and graphics tiers can never change
   cover. Conceal volumes come from species data.
7. **Textures for bark and rock: procedural only, or CC0 scans?** *Recommended:* procedural atlases for leaves and
   needles (the look and alpha coverage we control). Bark and rock procedural first; fall back to the CC0
   ambientCG sets already in `content/textures.json` only if the eye-height review asks for it.
8. **Decorative scatter generated on the client.** *Recommended:* only grass, flowers and ground cover
   (`role: 'decorative'`) from `terrain.foliage`, as now. Every tree, bush, rock and cliff stays an explicit
   placement (the scatter brush keeps writing entities).
9. **Frame-time baseline.** This container renders on the CPU (0.1–1.4 fps under load), so this report has
   counts, not frame times. *Recommended:* the owner records the three maps once
   (`Record performance` on medium, the same walk) before Phase 1 work lands, and again after Phase 1 and Phase 4.
   Alternatively, a GPU CI runner with `PERF_GPU=1`.
10. **Backdrop belts, the forest border's front row and the Kenney cliff pieces** are also old natural assets.
    *Recommended:* they move to species in Phase 4 together with the maps. The border's far-row cones and the
    code-built cliff border stay until Phase 5.
11. **Content hash churn.** The v26 migration changes every official map's `contentHash` (`release.changed`
    warnings). *Recommended:* re-export the official maps in the Phase 4 commit, so they get new version ids
    once, and publish the changed ones from MapMaker as usual.
12. **Season and colour variants** (autumn, snow, dark, moss) become material variants, not species.
    *Recommended:* yes. `nt_pine_autumn` becomes a larch (a real gold conifer), not an orange pine.
13. **Stylised outliers** such as `tree_blocks` (cube crown), `bush_cone` (topiary) and the Wild West cacti have
    no realistic twin. *Recommended:* `tree_blocks` (unused) is retired without a replacement species, migrating
    to `env.broadleaf.round`; topiary stays a small species.

### Owner decisions (2026-11-04)

The owner accepted **all 13 recommendations above**, with one specific choice on 13: the stylised outliers (`tree_blocks` and the other blocky trees) are **retired**, not folded into nearby species. Map migration maps their placements to the nearest real species while keeping position and cover; the old ids stay readable as retired ids.

Order agreed: Phase 1 starts after the shared "surface types" job (per-material ballistic class plus impact surface tags, including the new heavy-wood trunk class from question 3).

## 12. Where the work goes, by phase (files)

- Phase 1:
  - `tools/content/environment.mjs`, `tools/content/env/*.mjs` and `content/environment/*.json`.
  - `packages/shared/src/content/environment.ts` and `environment.generated.ts`, plus
    `packages/shared/src/sim/surfaceTypes.ts`.
  - Additions to `sim/physics.ts` (shapes) and `nav/index.ts` (extra triangles).
  - `packages/client/src/environment/*` and the `?envlab` page.
  - The tests above.
- Phase 2: LOD and impostor plugin, wind plugin, shadow sector lists, the F3 environment line.
- Phase 3: MapMaker "Environment" category (Trees, Plants, Ground Cover, Rocks, Boulders, Cliffs), env scatter
  sets with per-species weights and filters, collision and nav preview, confirmation for blocking placements.
- Phase 4: `migrate.ts` v26, the `prop.missing` placeholder, foliage `KINDS`, scatter, style packs, backdrop and
  border kits switched, official maps re-exported, old GLBs and pack entries removed after the gate.
