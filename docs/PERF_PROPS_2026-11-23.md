# Fewer prop draws: per-pack material atlases and merged still props, 2026-11-23

QUEUE Features (owner, 2026-11-23: "make the game run better"), lane B, branch `wip/propatlas-1123`. St. John's issued
about 600 draws a frame, most of them props, and the owner's M1 is bound by the page's main thread
(`RenderingGroup._RenderSorted` 29 % of it: docs/PERF_DRAWS_2026-11-23.md). The owner asked for (1) per-pack material
atlases, so a prop of many materials (the household cupboard sink: 15 draws on St. John's) is one draw, and (2) "include
the mirror with that sink to reduce even further": still props that stand together and share a material drawn as one.
Each saving has its own switch (`game/perfSwitches.ts`): `?perfoff=propatlas`, `?perfoff=propmerge`.

## What changed

1. **Per-pack material atlases, at build time** (`tools/content/prop-atlas.mjs`, run by `prepare-props.mjs`; docs/
   CONTENT_PIPELINE.md, "Prop material atlases"). Every flat-colour material's colour moves into the vertices it paints
   (`COLOR_0`, 8 or 16 bits: the near-blacks keep their shade) and the material keeps white; every material gets its
   pack's atlas key, `extras.atlas = "<pack>/<kind>"`, the kind being everything it draws with but that colour
   (roughness, metalness, alpha, emission, both sides, the surface's detail map, a texture's pixels). The materials stay
   separate in the file, so `?perfoff=propatlas` draws exactly as before.
   - **Textured materials are keyed, not repacked**: a texture's coordinates may repeat (planks, bricks), which an atlas
     cell would break, and packing pictures of different sizes into one would blur the small ones' mips. Their key is
     their picture's pixels, so the Kenney kits' shared colour map is one material for every prop of a pack that uses it
     with the same surface; a textured prop with two pictures stays two draws.
   - **Left alone**: nature props (the environment's own batches) and a fire prop's flame materials (hidden by name).
2. **One material per atlas kind in the game** (`propatlas`; `content/models.ts` `atlasMaterial`): a model's parts are
   merged per kind instead of per material, and the kind's material is shared by every model of the pack (and its levels
   of detail). The generated kit families (`kit/`), already one material per surface with their colours in their
   vertices, share theirs by what they are (name, surface, factors): every `kit_wood` on the map is one material.
3. **Still props merged per square and material** (`propmerge`; `game/propBatches.ts`, `game/propMerge.ts`). Every still
   prop that can't break, of a model whose parts are opaque and whose vertices times its copies on the map stay under
   120,000, is no longer a thin instance of its own model: the copies in each 128 m square (the batches' squares) are one
   mesh per material, whatever their models, placed and with their tints in their vertex colours. A mesh holds each copy
   at every level of detail its model has, and its index list draws each copy at the level it is at now (by its own
   distance and size, as before); a level change rebuilds that square's index lists only. Merged meshes cast no shadow
   themselves: each model's copies that cast do so through static shadow-only thin instances at full detail, merged into
   the shadow proxies (as models with levels of detail already did since `smallcasters`), so the shadow pass is
   unchanged. Breakable props keep their batches (they leave them when broken); props that ride movers, see-through ones
   (glass) and heavy models with many copies keep their batches or GPU instances.
   - **The sink and the mirror.** St. John's has no mirror over its sinks (the dorm rooms' sink stands by a desk, a
     closet and the door; nowhere on the map is there a mirror prop), and its 124 sinks stay a thin-instance batch: merged
     they would copy 3,544 vertices 124 times (440,000 vertices for one model) to save one draw per 128 m square. With
     the atlas that batch is one draw per square instead of three. Wherever a map maker puts the Wall Mirror
     (`hh_mirror`, placed on no map yet) by a sink or any other household prop, the pack's one atlas material merges it
     with them (the unit test `propMerge.test.ts` and `propAtlas.test.mjs` check that the built sink and mirror share
     it). The mirror is a flat dark-blue panel, not a reflective surface, so nothing of it is kept apart.

## Before and after

Measured with `tools/perf/client-perf.mjs` (`PERF_STILL=1 PERF_BREAKDOWN=1`, 1280 × 720, nobody else in the map; the
standard four views and extra ones at the props), the same build each time, before = `?perfoff=propatlas,propmerge`.
SwiftShader on a shared four-core box (load 10-14 from other sessions): the counts compare, the milliseconds don't.

### St. John's, High

| View | Draws before → after | Of them props (main pass) | Active meshes | Shadow-map draws |
|---|---|---|---|---|
| overview SW | 569 → **450** | 201 → **86** | 869 → 560 | 32 → 28 |
| overview NE | 574 → **461** | 195 → **82** | 776 → 478 | 28 → 28 |
| eye, middle spawn | 608 → **519** | 146 → **57** | 625 → 417 | 50 → 50 |
| eye, far spawn | 649 → **525** | 210 → **84** | 788 → 481 | 87 → 87 |
| **mean of the four** | **600 → 489 (−19 %)** | **188 → 77 (−59 %)** | 765 → 484 (−37 %) | |
| dorm room, at the sink | 486 → **449** | 65 → **33** | 382 → 335 | 35 → 32 |
| dorm room, from the door | 316 → **296** | 39 → **23** | 314 → 281 | 33 → 30 |
| bathroom (toilets, showers) | 465 → **373** | 146 → **59** | 499 → 338 | 32 → 29 |
| mess kitchen | 380 → **357** | 27 → **19** | 246 → 232 | 58 → 55 |
| dorm block from above, far | 585 → **497** | | 657 → 440 | |
| campus overview (from the south-west, high) | 575 → **454** | | 891 → 574 | |

The props left in a view after: the merged meshes (one per atlas kind and 128 m square: `kit_wood`, `kit_stone`, the
household pack's one, the Kenney kits' colour maps by surface), the batches of models too heavy to merge with as many
copies (the 124 sinks, 5 draws; the desk with hutch, 3; tall bookcases, 2), the gravestones that can break (their
batches) and the three cars (glass: see-through parts are never merged). Shadow draws don't change: the shadow proxies
already merged every still prop's shadow, and they still do.

### St. John's, Medium

| View | Draws before → after | Active meshes |
|---|---|---|
| dorm room, at the sink | 246 → **215** | 350 → 304 |
| mess kitchen | 166 → **158** | 234 → 221 |
| campus overview | 468 → **345** (−26 %) | 879 → 562 |

### Maple Court (390 props of 80 models: houses with kitchens, bathrooms, sitting rooms)

| View | High: draws before → after (props in the main pass) | Medium: draws before → after |
|---|---|---|
| house kitchen (table and chairs, fridge, cooker) | 379 → **333** (69 → 31) | 243 → **203** |
| house bathroom (bath, basin, washing machine) | 366 → **330** (56 → 27) | 230 → **198** |
| hall stair, close | 299 → **247** (57 → 15) | 163 → **120** |
| the town from above, far | 509 → **406** (143 → 48) | 368 → **270** (−27 %) |

Shadow-map draws on Maple Court: 159-172 → 150-163 (the static shadow batches merge into the proxies a little better
than the per-copy instances did). Triangles drawn go up a little (Maple Court far 0.69 → 0.73 M, the house kitchen
0.81 → 0.90 M; St. John's 2.36 → 2.45 M at the middle spawn): a merged mesh is culled by its 128 m square, not copy by
copy. The frame is bound by the main thread, not by the graphics card's triangles (docs/PERF_DRAWS_2026-11-23.md).

### Memory and size

Measured in the page after loading (High; `stats()` of the prop batches and the scene's geometry):

| | St. John's off → on | Maple Court off → on |
|---|---|---|
| Scene meshes | 2,297 → **1,931** | 1,197 → **812** |
| Copies merged / merged meshes | 0 → 1,101 / 60 | 0 → 280 / 19 |
| Batch meshes left (thin instances) | 209 → 32 | 31 → 9 |
| Vertices on the graphics card (all geometry) | 2.10 → 3.19 M | 0.61 → 0.88 M |
| Vertex memory (estimated, 4 bytes a component) | 102 → **152 MB** (+50) | 30 → **40 MB** (+10) |
| Script heap | 462 → 435 MB (no copy of the merged vertices kept) | 304 → 286 MB |
| Loading to play | 10.9 → 10.2 s | 3.5 → 3.5 s |

The cost of merging is the graphics card's vertex memory: thin instances share one copy of a model, a merged mesh holds
each copy (at every level of detail its model has). `MERGE_MODEL_VERTICES` (120,000 a model over the map) keeps the
heavy, often repeated models (the 124 sinks, the desks with hutches, tall bookcases) as thin instances. The merged
vertices are not kept in the page (as the shadow proxies do): only the index lists are, which a level change rebuilds.

- **Prop files**: `public/props` 74.7 → 80.3 MB (+5.6 MB, +7.5 %: the vertex colours; a map loads only its own props).
  St. John's 30 prop files 1.83 → 1.94 MB (its kit props are untouched), Maple Court's 56 files 2.35 → 2.67 MB;
  every file still under its budget (400 KB; the metro car, the largest, 334 → 365 KB).
- **Menu bundle**: 2,779 kB of 2,800 (after merging main; this change adds about 3 kB of script).
- **Palette pictures**: 1,760 KB in 77 atlases (index 107 KB), within their budgets.


## The look

Pictures of each view, before and after, at 1280 × 720: the scratchpad's `propatlas/shots/<map>-<graphics>-<set>-before|after/`
and side by side (before | after | difference × 4) in `propatlas/side/`. St. John's, High: the dorm room at the sink, the
bathroom, the mess kitchen, the dorm block from above and the campus overview: mean difference 0.16-0.52 / 255, at most
0.8 % of pixels over 24, all of it trees and grass moving in the wind and a spinning pickup; the props, their colours,
their shadows and the light on them are the same. Medium: 0.00-0.15 / 255. Maple Court, High and Medium (the house
kitchen and bathroom, the hall stair, the town from above): 0.00-0.54 / 255, the trees outside a window and in the town.

**Against main's own files** (flat colours still in the materials; the build of `wip/draws-1123`, which shares main's
props): St. John's dorm room and bathroom, Maple Court's house kitchen and bathroom: mean 0.19-0.53 / 255, at most 13
steps on any pixel off the moving trees: the colours moved into the vertices draw the same (16 bits where 8 would
shift a near-black). Close up, the sink's white cabinet, black top and grey tap read the same.

Watched for: texture bleeding at atlas seams and mip blur (none possible: textures aren't repacked, a flat colour is a
vertex colour), wrong tiling (no coordinates change), lost normal or roughness maps (none: a material keeps all its
maps and factors; only its flat base colour moves).

MapMaker's palette pictures of the 1,362 changed props and set pieces were made again (`build-palette-atlas.mjs`); the
household pack's sheet side by side with the old one shows the same colours (framed a little larger by today's
thumbnail renderer).

## What's left

- **Textured props with several pictures** stay a draw per picture (a car: paint and glass; the cannon). Repacking
  pictures into one would break repeating coordinates and mix mip sizes; few of them stand on St. John's.
- **The heavy repeated models** (the sinks, 5 draws; desks with hutches, 3) stay thin-instance batches. Levels of detail
  for the household pack (generated at build time, as the nature props have) would let them merge cheaply.
- **Culling**: a merged mesh is drawn whole when any of its 128 m square is in view (more triangles, fewer draws). A
  smaller square would cull better and draw more; indoors, props behind walls are still drawn
  (SCALING_STUDY_2026-11-15, item 3).
- **The draws left on St. John's** are now mostly the trees and grass (110-120 a view), the level and paths (50-65), the
  water's mirror pass (36) and the sun shafts' pass at eye level (100-118).
