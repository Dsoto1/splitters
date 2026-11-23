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
| dorm block from above, far | 585 → DBFAR | 150 → DBFARP | 657 → DBFARA | |

The props left in a view after: the merged meshes (one per atlas kind and 128 m square: `kit_wood`, `kit_stone`, the
household pack's one, the Kenney kits' colour maps by surface), the batches of models too heavy to merge with as many
copies (the 124 sinks, 5 draws; the desk with hutch, 3; tall bookcases, 2), the gravestones that can break (their
batches) and the three cars (glass: see-through parts are never merged). Shadow draws don't change: the shadow proxies
already merged every still prop's shadow, and they still do.

MED

MAPLE

### Memory and size

MEM


## The look

PICTURES

## What's left

LEFT
