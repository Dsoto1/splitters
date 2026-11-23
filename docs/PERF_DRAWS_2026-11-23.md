# Fewer draws in big matches, 2026-11-23

QUEUE Features (owner, 2026-11-23: "make the game run better", step 2: fewer draw calls), lane B, branch
`wip/draws-1123`. The goal: less CPU spent drawing a frame in big matches. Each saving has its own `?perfoff=` switch
(game/perfSwitches.ts): `doorinst`, `lightready`, `casterlist`, `casterbounds`.

## Owner's M1 profile, 2026-11-23

St. John's, Team Deathmatch, 63 players, High, build ffab1e8, M1 Pro, Chrome (a game recording, the in-game trace and a
44 s Chrome DevTools profile).

- **35 fps, 28.5 ms a frame** (p95 39). Render: the main pass 12.0 ms (of it mesh evaluation 3.6), shadows and depth
  maps 4.6, post 0.2. Characters 4.9 (clips and aim 3.6). 655 draws, 640 meshes and 86 shadow casters a frame.
- **The main thread is about 100 % busy**, the GPU process about 50 %, the match worker about 17 %: the frame is bound by
  the page's own thread, not the GPU. Fewer pixels would not help; less work per draw and fewer draws do.
- Where the main thread went (43.4 s of profile, self and children):

| Function | s | share | What it is |
|---|---|---|---|
| `RenderingGroup._RenderSorted` | 12.5 | 29 % | the main pass issuing its opaque draws (Babylon's `Mesh.render` for each) |
| of it `bindForSubMesh` (PBR, standard) | 4.8 | 11 % | binding materials, `_bindLight` 1.5 s of it |
| of it `isReadyForSubMesh` | 2.3 | 5 % | per-draw readiness checks; **1.4 s of it the clustered lights' `_isReady`** (below) |
| of it `_processRendering` | 2.0 | 5 % | instance buffers (0.8), thin instances (0.4), the draw calls |
| shadow and depth targets `_renderToTarget` | 5.3 | 12 % | the shadow cascades, the sun shafts, the light tiles |
| `computeWorldMatrix` | 5.1 | 12 % | **mostly the characters' grip and aim** (`gripPlaced`, `placeWeapon`: about 3.5 s); the active-mesh walk 0.6 s |
| character `pose` | 4.2 | 10 % | of it `gripPlaced` 2.7 s (handled separately, not here) |
| `_evaluateActiveMeshes` + `getLOD` + candidates | 1.7 | 4 % | the mesh evaluation |
| the shadow list (`getCustomRenderList`, ours) | 1.0 | 2 % | every caster on the map tested by distance, every frame (below) |
| the cascades' casters' box (`_computeShadowCastersBoundingInfo`) | 0.65 | 1.5 % | every caster's bounds, every frame (below) |

The world matrices are not static meshes left unfrozen: the level, props and batches are frozen already; what
recomputes is the characters' bones and held guns (the grip work), which is the owner's other item.

## How it was measured here

SwiftShader on a shared 4-core box (load 4-8 from other work), so the **counts** are what compares; milliseconds only
between runs of one build on this box. The same build each time, before = `?perfoff=doorinst,lightready,casterlist,casterbounds`.

- **Still cameras** (`tools/perf/client-perf.mjs`, `PERF_STILL=1 PERF_GRAPHICS=high PERF_SPLIT=1 PERF_BREAKDOWN=1`): the
  four standard views of each map, nobody else in it.
- **A crowd** (`tools/perf/perf96.mjs`, which gains `PERF_QUERY`, `PERF_SIZE`, `PERF_MIN_FRAMES` and `PERF_BREAKDOWN`:
  each scenario's draws by pass, by kind and by mesh): Flavius Rule, 64 bots, 56 held in rows 5-65 m in front of you
  (`rows`) and everyone in one 40 m square (`clump`), Medium, 480 × 270.

### Where the draws came from (before)

- **Flavius Rule, crowd (rows / clump, Medium):** 321 / 342 draws a frame: main 270 / 291, shadow 50 / 48. In the main
  pass: characters 57 (one draw each for 56-61 in view; skinned, so not instanced), effects 39-60 (glows, particles,
  hits: one mesh and material each), **doors 45** (28 gates: oak doors 4 draws each, portcullises 2), **buttons 24**
  (8 × post, plate, cap), props 38-51 (batches per model, material and 128 m square), the level 19-26, pickups 8.
  Held guns: 1-4 draws for the whole crowd.
- **St. John's, empty (Medium):** 375-513 draws, nearly all in the main pass; a long tail of prop models per square (the
  cupboard sink 15, gravestones, desks, doors of the kit), paths (18: each rank its own depth offset), glass panes 13,
  flowers and grass per sector, trees per species and square.
- **Held weapons are one material already.** 72 of the 73 gun models in `public/models/guns/` have one material (the
  Molotov three): the Meshy re-make of the guns did what PERF_96's "Held weapons in one material" asked. A crowd's guns
  are GPU instances (one draw a model for everyone); in a small match a held gun is its 1-2 meshes. Nothing left to
  atlas there.

## What changed

1. **Doors and buttons as GPU instances** (`doorinst`; `scenarioVisuals.ts` `instanceRigidParts`). Doors were already
   merged per moving part and material (`mergeRigidParts`); every door of a style is the same few parts, so each shape and
   material is now one source mesh (parked out of sight) and every door's part an instance of it under the same hinge or
   leaf node: one draw a shape and material for all the doors in view. Buttons' post and plate likewise. A door's lamp and a
   button's cap (their own materials, they change colour) stay meshes. The static shadow cache kept standing doors'
   parts in its cached depth; an instance source now says where its copies are (`instancesVersion`, a hash of their
   matrices and visibility, `shadowCache.ts`), so the cache keeps it while none of them moves, as before (without that,
   the first try drew the doors into the shadow pass every frame: 17 more shadow draws a frame on Flavius Rule).
2. **The clustered lights' readiness once a render** (`lightready`; `clusteredLights.ts` `readyOncePerRender`). Babylon's
   lit materials ask the light container, for every mesh they draw, whether it is ready, and it answers by checking its
   proxy mesh in full (its material and every shadow generator). Once it has said yes, the answer is kept for the rest of
   that render id; the first ask of each render still checks in full.
3. **The shadow list's still casters sorted once** (`casterlist`; `atmosphere.ts`). Every frame the shadow map's list
   (every caster on the map) was walked to keep those within reach of the camera. Casters with a frozen world matrix (not
   thin-instanced, not small clutter) are now sorted out once (again when the list changes, and every 60 frames) and
   tested again only when the camera has moved a metre (with a metre more reach: the per-cascade square test still cuts
   them); the moving ones are tested every frame as before.
4. **The cascades' casters' box** (`casterbounds`; `shadowBounds.ts`). High's cascades fit their depth range to a box round
   every caster, which Babylon worked out from every caster every frame. The still casters' part is kept (worked out again
   when the list changes and every 60 frames) and the moving casters are added each frame: the same box.

## Before and after

RESULTS

## The look

Pictures of every still view, before and after, High: the scratchpad's `draws/shots/before/`, `after/` and `side/`
(before | after | difference × 4). RESULTS_LOOK

## What's left (would save more)

- **The main pass's per-draw cost** is most of the frame. The draws left in a crowd are characters (one skinned draw each:
  only baked vertex animation would instance them, a big change), effects (each playing effect its own mesh and material;
  one batch per effect kind and shader would cut 30-50 draws in a fight) and props (per model, material and 128 m square).
- **Props' materials per kit**: a per-kit palette atlas exists for the generated kit; packs like the household props
  (`hh_*`) are still a draw per material per square (the cupboard sink alone 15 on St. John's). Atlasing those packs in the
  content pipeline would make them one draw per model per square.
- **Indoor props drawn only when relevant** (SCALING_STUDY_2026-11-15, item 3): most of St. John's prop batches are
  furniture behind walls.
- **`_bindLight`** (1.5 s of the owner's 43): every lit draw binds the sun, the ambient light and the light container.
  Keeping the container off meshes no lamp reaches would cut a light per draw, but changes the shaders; measure first.
- **The characters' grip and aim** (`gripPlaced`, about 6 % of the frame with its world matrices): the owner's other item.
