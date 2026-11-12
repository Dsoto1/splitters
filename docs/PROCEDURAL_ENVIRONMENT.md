# Tile Trigger — Procedural Environment Replacement

**Status:** Implementation handoff / design specification  
**Priority:** Replace existing toy-like natural assets; preserve gameplay and map compatibility  
**Target:** Browser FPS, Babylon.js WebGPU with WebGL2 fallback, TypeScript pnpm monorepo

## 1. Objective

Replace the current Kenney-style and limited imported **natural environment** content (trees, bushes, grass, plants, rocks, boulders, cliffs, natural surface materials) with a cohesive, in-house procedural environment pipeline. This is a **replacement and migration**, not a second parallel foliage system. Aim for grounded stylized realism, organic silhouettes, convincing materials, and strong browser performance. Preserve useful non-natural props and existing terrain/map infrastructure.

Do not assume every natural asset must be generated at runtime. Prefer deterministic authoring/build-time generation into reusable optimized GLB/mesh assets, with lightweight runtime placement and rendering. Do not introduce paid services or mandatory external asset dependencies.

## 2. Existing architecture (do not violate)

- `shared`: engine-independent TypeScript simulation, map schema and validation (zod), Rapier authoritative collision, Recast navigation, weapons/projectiles/bots. No Babylon imports.
- `client`: Babylon.js rendering, effects, UI, MapMaker, WebGPU preferred / WebGL2 fallback, prediction.
- `host`: headless authoritative match simulation, potentially ~98 bots, no graphics or GPU requirement.
- `server`: lightweight AWS hub, accounts/listings/map publishing; does not simulate matches.
- `tools/content/`: Node content processing using gltf-transform and meshoptimizer.

Keep server/host free of textures and visual mesh dependencies. Gameplay collision and line-of-sight must be consistent across all clients and the authoritative host.

## 3. Scope

### In scope
- Procedural tree species, trunks, major branches, roots, leaf-card canopies; bushes, ferns, grasses, vines, ground cover.
- Procedural rocks, stones, boulders, modular cliff faces, ledges and rock-to-terrain transition pieces.
- Reusable material library: bark, leaf atlas, rock, soil, moss, roughness/normal maps; coherent environment families.
- Deterministic placement, MapMaker painting and manual placement, presets and asset registry integration.
- Optimized rendering: thin instances/chunking, quality tiers, distance-based LOD/impostors, wind, shadows, culling, instrumentation.
- Bullet/projectile collision with trunks, major branches, boulders and cliff walls; Recast integration where obstacles affect pathing.
- Migration of existing natural-asset references, preservation of existing maps, tests and rollback.

### Out of scope for initial delivery
- Replacing buildings, weapons, vehicles or all Kenney assets.
- Rewriting terrain editor, physics engine, or map format from scratch.
- Destructible trees, dynamic terrain deformation, or per-leaf physics.
- Server-side procedural visual mesh generation.

## 4. First step: repository audit

Before implementation, inspect and document actual code paths and data shapes; do not invent file paths or APIs. Identify:
1. Asset registries and current foliage/rock/cliff asset IDs and references.
2. Existing MapMaker placement/painting tools and map serialization, versioning and validation.
3. Rapier collision registration, projectile/hitscan query logic, material hit events and lag-compensation interactions.
4. Recast navmesh generation, obstacle baking and runtime behavior.
5. Babylon material/LOD/instancing/shadow/fog pipelines and WebGPU/WebGL2 differences.
6. Content build pipeline, bundling, cache/versioning, and asset-loading constraints.
7. Existing test scenes and performance instrumentation.

Produce a brief audit report and proposed migration mapping before deleting anything.

## 5. Proposed design boundaries

**Shared data:** stable `environmentAssetId`, `assetVersion`, category, deterministic seed or explicit transform, collision profile, nav/visibility properties, and placement constraints. Validate with zod. Keep gameplay definitions separate from renderer-only settings.

**Content generator:** build reproducible source geometry/materials/atlases and LODs; export optimized assets and manifests. Procedural trees use tapered, irregular branching geometry with nonrepeating crowns. Rocks use fractured/noise-displaced meshes and useful silhouette variants. Cliff modules need seam-compatible edges and terrain transition support. Verify licenses for any third-party tooling.

**Client:** render foliage in spatial chunks, batch by species/material/LOD, use Babylon thin instances for dense repeated objects. Thin instances are culled by batch: never use a single map-wide batch. Use alpha test for leaf cards, carefully manage double-sided cards and overdraw. Wind is shader-only and should not shift gameplay colliders. LOD must be handled at chunk/instance-group level; do not assume Babylon mesh LOD automatically manages thin-instance LOD. Preserve gameplay-significant silhouettes at low quality.

**Host/shared:** load only lightweight collider/visibility metadata. Create static Rapier colliders for trunks, major roots/branches, boulders and cliff geometry; use simplified primitives or static trimeshes as appropriate. Keep collision placement identical to map placement. Small plants and leaves generally have no projectile collision. Navmesh obstacles should match movement-blocking geometry. No dependency on client LOD.

**Server:** accept validated versioned map data and metadata; no mesh rendering or simulation.

## 6. Gameplay collision policy

| Element | Bullet/projectile interaction | Movement/navigation |
|---|---|---|
| Main tree trunk | Solid; wood impact FX | Solid collider, nav obstacle |
| Major branch/root | Solid where visually substantial | Collider only when movement-relevant |
| Small twig/leaf | Pass-through by default | None |
| Bush/grass/fern | Pass-through by default | None |
| Small decorative stone | Usually no collider | None |
| Boulder | Solid; stone impact FX | Solid obstacle |
| Cliff/rock wall | Solid, close visual/collision match | Solid static geometry/nav boundary |
| Fallen log (`env.deadwood.log`) | Solid (its hull); bark impact FX | Solid obstacle |

**A log breaks only when the map maker says so** (the owner, 2026-11-12). A placed log is solid cover, also on a map
where everything breaks. Given its own **Health** in the inspector it becomes a breakable (`isBreakableProp`; the only
species that can: `envCanBreak`, content/environment.ts): it leaves the static shapes (`environmentShapes(map)`; ask
for it with `environmentShapes(map, true)`), the scenario owns its hull (`ScenarioBodies`, switched off when it breaks,
back at the next round), navigation takes its bounds with the other breakable solids (`propBoxes(map, true)`), and the
client draws it as an ordinary prop node, not in the environment renderer's batches, so it can be hidden. Rocks,
boulders, cliffs, trees and plants never break.

Both hitscan and projectile paths must use authoritative queries. Support impact surface tags (`wood`, `stone`, etc.) so clients render appropriate splinters, dust, decals and audio. Optional penetration can be added later as a shared weapon/material rule, not hardcoded per render mesh. Define consistent bot visibility/occlusion semantics for bushes; graphics quality cannot change authoritative cover or gameplay visibility.

## 7. Asset authoring requirements

- Species presets must change **structure and silhouette**, not merely color or scale.
- Favor realistic proportions, asymmetric branching, natural density and varied crown shapes.
- Leaf clusters use authored/generated cutout cards and compact shared atlases; optimize alpha coverage and avoid excessive transparent empty space.
- Rock and cliff families should vary stratification, fractures, edge wear and surface orientation; avoid uniform inflated-noise blobs.
- Support configurable moss, weathering, soil and material variation; avoid plastic-looking uniform roughness.
- Generate explicit LODs and a collision representation independently from visual mesh detail.
- Deterministic seed + generator version should reproduce output; version/canonicalize generated artifacts for multiplayer consistency.
- Prefer offline/build-time generation and caching. Avoid expensive procedural mesh generation during matches.

## 8. MapMaker UX

Provide a dedicated **Environment** category with Trees, Plants, Ground Cover, Rocks, Boulders and Cliffs. Support:
- Single-object placement, rotation, scaling, snapping and undo/redo.
- Paint/erase brush with density, radius, seed, size/rotation variation and per-species weighting.
- Biome/environment presets (temperate, jungle, alpine, arid), but allow mixing assets from different families.
- Slope, altitude, ground material and exclusion filters; avoid blocking spawns, routes and objectives unintentionally.
- Preview of expected collision and nav impact; explicit confirmation for gameplay-blocking placement.
- Stable serialization and round-trip import/export.

For gameplay-relevant obstacles, store authoritative transforms/collision profiles or reproducible deterministic placements. Purely decorative scatter may be client-side only **only if** it cannot alter visibility, cover, movement, or competitive fairness.

## 9. Performance and quality

Target low CPU overhead and controlled GPU frame time on both WebGPU and WebGL2. Do not promise specific FPS without benchmarking. Profile draw calls, triangle count, overdraw, alpha-tested pixels, shadow cost, GPU/CPU frame times, memory and asset download size.

Starting **asset budgets for benchmarking**, not strict limits:
- Grass clump: ~12–40 triangles.
- Fern: ~40–150.
- Bush: ~150–500.
- Medium tree: ~1,000–3,000.
- Large tree: ~2,000–5,000.
- Distant tree: ~2–300 or impostor.

Implement quality tiers that adjust density of non-gameplay decoration, shadow distance, wind complexity, LOD thresholds and material detail **without removing solid cover or gameplay-significant occlusion**. Use spatial chunking and frustum/distance culling; test camera movement, chunk transitions and LOD popping. Avoid excessive dynamic shadows on grass.

## 10. Migration / replacement rules

1. Inventory old natural-asset IDs, their maps, colliders and material dependencies.
2. Build an explicit old-to-new mapping; preserve transforms and intentional gameplay cover.
3. Add a versioned map migration with tests and backup/rollback support.
4. Preserve compatibility with published/community maps; define a policy for unknown/unsupported IDs (safe fallback plus warning, never silently delete gameplay obstacles).
5. Test visual replacements and authoritative collision before switching default registry entries.
6. Remove/deprecate old natural assets and legacy foliage renderer only after successful migration and validation. Avoid permanently shipping two competing systems.
7. Keep unrelated non-natural assets and existing functional terrain systems intact.

## 11. Implementation phases and gates

**Phase 0 — Audit and plan:** code inventory, baseline metrics, map migration design, proof-of-concept proposal.

**Phase 1 — Vertical slice:** one broadleaf tree, one conifer, one bush, one grass clump, one boulder and one cliff section; generated materials, collision and impact effects; FPS-eye-level showcase scene. Test browser renderer fallbacks and headless host.

**Phase 2 — Core systems:** content generator, manifest/versioning, chunked thin instancing, LOD, wind, collision integration, diagnostics and automated tests.

**Phase 3 — MapMaker:** environment category, paint/erase, filtering, presets, deterministic serialization, undo/redo, collision previews.

**Phase 4 — Replace and migrate:** expand species/rock/cliff variants, migrate existing maps, retire legacy natural assets, run regression/performance tests.

**Phase 5 — Polish:** terrain material transitions, seasonal/biome variations if appropriate, LOD/shadow tuning, visual consistency pass.

**Phase 6 — Kit-prop generators (owner-approved 2026-11-05; after Environment Phase 2):** the same deterministic
generator approach applied to simple man-made props. Families, each with endless variants under a stable family id:
- crates and barrels;
- fences and walls;
- containers;
- pipes and scaffolding;
- sandbags and rubble;
- signs;
- simple furniture;
- market stalls.

Each family includes collision, surface types, LODs, budgets and tests, like the species.
- **Migration:** maps move with MapMaker's "Replace all" plus the load-time alias table (old prop id → family and
  variant), so players' saved maps upgrade.
- **Retirement:** the old pack props are retired from the palette as each family covers them. Their files are dropped
  from the build only when no map or alias needs them.
- **Order:**
  1. crates and barrels;
  2. fences and walls;
  3. containers;
  4. the rest by how often maps use them (count the placements first).
- **Stays authored** (Meshy models, owned or community CC0, or purchased): characters, first-person weapons, vehicles, and hero props and
  landmarks (the airliner, excavator, cranes, statues, detailed machinery).
- **Target:** roughly 60–75% of today's ~1,366 props generated, for one consistent, grounded art style.
- **Later option:** generate at load instead of at build time, for smaller downloads, measured against load time.

**Phase 6 status (2026-11-10):**
- **Part 1, crates and barrels: built** (`wip/kit-props`; docs/CONTENT_PIPELINE.md, "Kit props"). Seven families,
  each with variants: `kit.crate.wood`, `kit.crate.wood_long`, `kit.crate.bin`, `kit.crate.framed`, `kit.box.carton`,
  `kit.drum.steel` and `kit.drum.steel_open` (`tools/content/kitprops.mjs`, `tools/content/kit/`).
  - **Gameplay:** each family is a catalogue prop; its collision is its box (§6: a crate is solid cover), every variant
    fills it, and variants change only what is drawn.
  - **Detail and budgets:** three levels of detail each; from the first lighter level on, no heavier than the Kenney
    prop it replaces.
  - **Aliases:** seven Kenney props are retired from the palette (`prop.crate_small`, `crate_large`, `cargo_crate`,
    `metal_crate`, `cardboard_box`, `barrel`, `barrel_open`). Their aliases play them as the families, at the same size
    and ballistic class, so no map's collision changes. The maps still name them until MapMaker's Replace all moves
    them, so their files stay in the build.
- **Left authored for now** (owner's call): the Meshy street barrels, and the themed or explosive pieces: ammo,
  dynamite and powder-keg crates, the fuel drum, sci-fi crates and barrels, the dungeon and Wild West barrels, and the
  fish and tarp crates.
- **Next:** part 2, fences and walls; then part 3, containers.
- **Part 4, furniture and shop pieces: built, not landed** (`wip/mapmaker-kit-props-4`, 2026-11-11): tables, desks, side tables, chairs, benches, bookcases (`tools/content/kit/furniture.mjs`), shop shelving, market stalls and counters, waste bins (`shop.mjs`). Chairs, benches, shelving and stalls collide as finer boxes, as the pieces they replace did. Still to do in part 4: pipes and scaffolding, signs, rubble.
- **Part 5, soft seats, cabinets and appliances: built, not landed** (`wip/mapmaker-kit-props-5`, 2026-11-11): the cushioned chair (the `seat` generator, a padded seat and back), armchairs and sofas (`tools/content/kit/sofa.mjs`), kitchen and media cabinets and the fridge, stove and washing machine (`cabinet.mjs`). All but the chair collide as their box, as the pieces they replace did. By the owner's rule of 2026-11-11 the sofa and the cabinets play as wood and the appliances as thin metal (the sofa, fridge, stove and washer were concrete by the guess, the cabinets thin metal by their name; the armchair and the chair were wood already). The maps still name the retired props until MapMaker's Replace all moves them.
- **Part 6, furniture with finer collision: built, not landed** (`wip/mapmaker-kit-props-6`, 2026-11-11): the office chair (`officechair` in `tools/content/kit/furniture.mjs`: a five-star base on castors, a gas column, a padded seat and back, arm rests), the pedestal table (`roundtable`, same file: a six-sided top like the Kenney one's, or oval), the double bed and the bunk bed (`tools/content/kit/bed.mjs`) and the corner sofa (`cornersofa` in `sofa.mjs`: a sofa whose first place runs forward as a chaise). Each collides as finer boxes, as the piece it replaces did, the same boxes to within a few centimetres: you still shoot under the table's top, under the lower bunk and between the bunks, and the corner sofa's empty corner stays empty. The bunk bed's ladder has no collision of its own (the retired prop had no ladder). By the owner's rule of 2026-11-11 the beds and the corner sofa play as wood (they were concrete by the guess); the office chair and the round table were wood already. The maps still name the retired props until MapMaker's Replace all moves them; the coverage map needs another Kenney Furniture prop placed (its only one was the casemate set piece's bunk bed, now the family as played).
- **Part 8, factory and shop pieces: built, not landed** (`wip/mapmaker-kit-props-8`, 2026-11-11): the shipping crate under a lifting saddle (`yokecrate` in `tools/content/kit/factory.mjs`: the board crate of `crate.mjs` with a timber or steel saddle over its middle), the long shipping crate (the `crate` generator, on skids), the warning sign (`sign`, same file: a hazard-striped board on a post and a weighted base, a folding A-frame floor sign, a banded post marker; paint only, nothing glows or blinks), the belt conveyor (`conveyor`, same file: side frames on legs over a panelled base, a belt round its end drums, guide rails, sometimes cartons) and the bank of upright shop freezers (`freezer` in `cabinet.mjs`: glass doors over shelves of goods under a header). The shipping crate collides as two boxes, its body and the saddle, the same two the Kenney box had; the others as their box. By the owner's rule of 2026-11-11 the sign and the freezers play as thin metal (they were concrete by the guess); the two crates were wood already and stay wood, and the conveyor stays concrete (solid cover as it was; making it metal is the owner's call). Dress room's warehouse, shop and workshop recipes, the Military Style Pack and the factory theme's scenery belt name the families. The coverage map needs another Kenney Factory Kit prop placed (its only one was the warning sign, now the family as played).
- **Part 9, shop fittings, a console and a pipe valve: built, not landed** (`wip/mapmaker-kit-props-9`, 2026-11-12): eight Kenney props that all collided as finer boxes. In `tools/content/kit/market.mjs`: the wire shopping cart (`cart`, `kit.shop.cart`: a tapered wire basket you see through, a child seat's flap, a tray between four castors, a handle with a grip), the bakery stand (`bakery`, `kit.shop.bakery_stand`: a base under an open rack of loaf baskets, baskets on its top, a roll bin and baguette baskets in front, a back board with a header between two end pillars), the checkout (`checkout`, `kit.shop.checkout`: a belt counter with a scanner and a bagging plate beside a till cabinet under a ledge, a till and a screen), the chest freezer (`chestfreezer`, `kit.appliance.freezer_chest`: a tub with a bumper rail on a recessed plinth, lids' frames over packs of goods), the bottle-return machine (`bottlereturn`, `kit.shop.bottle_return`: a crate slot, a round intake, a small screen, a receipt slot, a kick plate, a housing and a sign box on top) and the produce stand (`produce`, `kit.shop.produce_stand`: a slatted plinth under a tray of fruit, crates and long trays round it, price boards and tags). In `plant.mjs`: the control console (`console`, `kit.console.panel`: a bank of screens on two cabinets and skids, a button shelf, a sloped keyboard desk; the operator at −z, as at the Kenney one) and the pipe valve (`valve`, `kit.pipe.valve`: a large pipe along x, open through both ends, a bolted flange on a foot each end, a valve body with a hand wheel at −z and a blind boss at +z; its axis is the Kenney one's, so it still meets the pipe pieces at its ends). Screens and lamps are paint: nothing glows or blinks. Each collides as its own finer boxes, written in the generator, closing and leaving open what the retired prop's did: the cart 7 boxes for 8 (one lay inside the others), the bakery stand 10 for 13 (the hand-wide slot between its two heaps of bread is closed, and the heaps are one height), the checkout the same 5, the freezer the same 2, the bottle return 8 for 8 (the crate slot open; its sides squared off by a few centimetres), the produce stand 6 for 8, the console the same 9, the valve 16 for 25 (its bore open from end to end, as it was; the wheel's side closed along the whole pipe, as it was). The valve keeps its blast: a kit family's `breakable` can carry one now. By the owner's rule of 2026-11-11 the bakery stand, the produce stand and the checkout play as wood, and the chest freezer and the bottle return as thin metal (all five were concrete by the guess); the console plays as thin metal (it was glass, by the word "screen"); the cart was thin metal and the valve metal already. Dress room's lab, shop and workshop recipes and the Suburban Style Pack name the families. Every prop of the Kenney Mini-Market pack is retired now, so the coverage map's test counts a pack as present by a family that replaced one of its props (the map's shopping cart).
- **Part 10, the factory machines, the big pipes, the workbench and the traffic cones: built, not landed** (`wip/mapmaker-kit-props-10`, 2026-11-12): thirteen Kenney props, the last of the factory kit. In `tools/content/kit/machines.mjs`: the heavy machine (`machine`, `kit.machine.heavy`: a press, a rear housing with a motor boss and a control box, a front housing on a bed, a bridge and a top plate under a ridge, a guard hanging each side of the open working gap), the window machine (`windowmachine`, `kit.machine.window`: a chamber on four posts, a block and a framed port at each end, a roof with a cap, a guard each side over the open chamber), the round hopper (`hopper`, `kit.hopper.round`: a plinth, a cone, a hooped drum), the tall hopper (`tallhopper`, `kit.hopper.tall`: a panelled column, a funnel, a square bin with a ring beam and ribs), the piston (`piston`, `kit.machine.piston`: a flanged cylinder, a bright rod, a head), the scanner gate (`scanner`, `kit.machine.scanner`: two cabinet feet, two posts, a lintel, a scanner head each side of the way through), the lever panel (`lever`, `kit.machine.lever`: a floor plate, a pedestal, two levers in their quadrant housings) and the giant cog (`cog`, `kit.machine.cog`: eight broad teeth round a rim, a sunk web, a hub round an open bore). In `yard.mjs`: the glass pipe (`glasspipe`, `kit.pipe.glass`: glass along x between two bolted flanges, tie rods and hoops, open through both ends, its axis the Kenney one's), the big pipe (`pipestub`, `kit.pipe.riser`: a wide pipe standing out of the ground under a collar), the workbench (`workbench`, `kit.table.workbench`: a cabinet under a thick top, a vice, things left on the top) and the traffic cone (`cone`, `kit.sign.cone` and `kit.sign.cone_slim`, the sizes of the factory kit's and the roads kit's cones). Lenses, ports and glass are paint: nothing glows or blinks. Each collides as a few boxes written in the generator for the retired prop's many, leaving open what that left open: the heavy machine 13 for 22 (the working gap open from side to side), the window machine 14 for 22 (the chamber open under the guards), the round hopper 7 for 41, the tall hopper 6 for 37 (you still pass under its bin), the piston 5 for 13, the scanner gate the same 7 (the way through open), the lever panel 4 for 5, the cog 12 for 37 (flat on top, the bore open), the glass pipe 16 for 24 (the bore open from end to end), the big pipe 6 for 22, the workbench 3 for 4. Closed on purpose: the hoppers' bins and the big pipe's bore were pits a player could drop into and not climb out of; ours are loaded, lidded or capped to the rim and solid. The cones have no collision, as the Kenney cones had none: a family says `collide: "none"` (the generator writes `collision: null`). The machines and the round hopper keep their blasts. Classes: the heavy machine and the big pipe metal and the glass pipe glass, as they were; the window machine metal (it was glass, by the word "window"); the workbench wood and the lever panel thin metal (both concrete by the guess); the cones plastic (concrete by the guess; nothing collides with them); the hoppers, the piston, the scanner gate and the cog stay concrete, solid cover as they were, like the conveyor (metal would be truer: a question for the owner). Dress room's warehouse, lab and workshop recipes, the Military, Neon Megacity and Suburban Style Packs and the factory scenery belt name the families.
- **Part 11, the anvil and the station's two pipes: built, not landed** (`wip/mapmaker-kit-props-11`, 2026-11-12): three Kenney props. In `tools/content/kit/yard.mjs`: the anvil (`anvil`, `kit.tool.anvil`, a new type, `content/kitprops/tool.json`: an anvil stapled to a timber block on two sleepers, a horn at +x and a heel at −x, iron straps, a hammer or tongs left on the block; the Kenney piece was an anvil on a low bench). In `pipes.mjs`: the coolant pipe (`coolantpipe`, `kit.pipe.coolant`: a large pipe along z, open through both ends, a six-sided or round flange at each end, hoops, a thin coolant line clamped along each side, a service panel on top) and the pipe junction (`pipejunction`, `kit.pipe.junction`: a narrower pipe along z, off the ground, through a deep collar that stands on the floor, a blanked branch port, a gauge or a screwed cap on a block each side of the collar). The pipes' axes are the Kenney ones' (0.7 m and 0.85 m up; the two never lined up, and still do not). Gauges and panels are paint: nothing glows or blinks. Each collides as its own finer boxes, written in the generator: the anvil the same 4 (two sleepers, the block, the anvil: open between the sleepers under the block, as it was under the bench, and beside the anvil), the coolant pipe the same 10 and the junction the same 16 (eight walls round a bore open from end to end; under the junction's pipe each side of its collar open, as it was). Classes: the pipes metal, as they were; the anvil metal (it was concrete by the guess and rang as stone; still hard cover). The first lighter level of each is no heavier than the Kenney model (80 triangles for the coolant pipe, 144 for the junction). The Orbital Station and Medieval Style Packs name the families.
- **The Desert City dome kit: built, not landed** (`wip/mapmaker-dome-kit`, 2026-11-12): new pieces from the owner's reference sheet, not replacements (no aliases). `tools/content/kit/dome.mjs`, `content/kitprops/dome.json`: 29 families `kit.dome.*` in six generator kinds (`domecap`, `domepanel`, `domedrum`, `dometrim`, `domearch`, `dome`): the cap, panels for domes of 4, 6, 8 and 12 segments (plain, with a window, broken off), the drum in quarters (arched doorways, windows, blind arches), three ring trims, arch transitions one cell square and one level high (4-way, 3-way, 2-way: a flat solid top with the drum's seat marked in it) and whole domes on their drums (one cell and a 15 m hall, 8 and 12 segments, and three ruins). Looks: stone, sandstone, plaster, copper, blue tile, green tile (the ruins: four); paint only, nothing glows or blinks. Every part's origin is the dome's axis at the drum's foot and a part is drawn where it stands on the drum (the panels spring 2.6 m up), so parts dropped on one point and turned in steps of 90° (the drum) or 360° / segments (the panels; MapMaker turns props in 15° steps) make the dome: docs/CONTENT_PIPELINE.md, "The dome kit", has the steps. For that a family may say `bounds: "within"` (it stays inside its size and need not fill it; it collides as its own boxes or not at all). Collision: rings of small boxes round a hollow middle, doorways (1 m clear), windows and breaks open; the trims do not collide. All stone (a family has one surface: the copper look too). A whole dome is about 1500 triangles (the Capitol Dome prop is 5.9k), 500 from 45 m with every opening still open, 56 from 160 m. The Desert City Style Pack lists the families. Not from the sheet: its second row (walls, corners, railing, pillar, archway, stairs, floor), which the pack's tiles and props already give. Palette pictures are not made yet (they need the browser). **Closed domes** (`wip/mapmaker-dome-closed`, 2026-11-12): `kit.dome.closed_8` and `closed_12` (31 families now), the one-cell whole dome as a solid roof dome: every arch of the drum blind, no inside faces, collision 28 boxes solid all through (five crossed boxes within 0.2 m of the wall's face for the drum, the dome stepped in six layers, the cap's foot); same size, origin and six looks as `whole_*`; 1260 / 1290 triangles; their palette pictures are not made yet either.

Do not scale to dozens of generated species before the first vertical slice looks good at eye level and passes performance/collision checks.

## 12. Required automated and manual acceptance tests

- Identical authoritative tree/boulder/cliff collider positions in browser-hosted and dedicated-hosted matches.
- Hitscan and projectile strikes against trunk and major branch, with proper wood effects; bullets pass through leaves; stone impacts on boulders/cliffs.
- Bots route around solid trunks/boulders/cliffs and do not incorrectly treat foliage render geometry as nav blockers.
- Visual wind does not alter physics or cause visible major collider mismatch.
- Map save/load/undo/redo and migration preserve gameplay obstacles and deterministic placements.
- WebGPU and WebGL2 render without missing materials, unsupported shaders, broken alpha masks or LOD failures.
- Low settings do not remove gameplay-significant occlusion or solid cover.
- Dense forest stress scene, large outdoor map, and high-bot headless-host scenario; compare before/after performance and asset size.
- No regressions to existing maps, non-natural props, networking, hit registration or lag compensation.

## 13. Deliverables to return

1. Audit findings and implementation plan with actual repository file references.
2. Working vertical-slice scene and before/after FPS-eye-level screenshots.
3. Generator source, generated assets/manifests, and repeatable build commands.
4. MapMaker environment controls and documented schema/migration.
5. Collision and nav integration tests, plus browser renderer compatibility tests.
6. Performance report (baseline vs replacement) with hardware/browser, scene density and measured frame times.
7. Removal/deprecation report for old natural assets and a rollback procedure.
8. Brief maintenance documentation describing how to add new environment families without modifying simulation code.

## 14. Instructions to implementing agent

Favor clear, maintainable TypeScript and reuse existing code. Confirm actual engine APIs, library versions, and repository conventions before coding. Keep visual assets out of the shared simulation and dedicated host. Do not add paid dependencies or external generation services. Avoid unrelated refactors. Surface tradeoffs and failures rather than silently reducing fidelity or breaking old maps. Implement incrementally with tests at every phase. **The goal is a replacement natural-environment system that looks materially better, performs well in a browser, and keeps the authoritative multiplayer simulation correct.**
