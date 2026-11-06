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
