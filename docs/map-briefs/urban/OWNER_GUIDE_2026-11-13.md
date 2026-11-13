<!-- The owner's guide as given on 2026-11-13, unchanged except the picture link below. -->
# Trigger FPS — Universal Modular Tileset & Asset Compatibility Guide

**Purpose:** Agent handoff / architectural guidance for all current and future Map Maker environment assets.  
**Priority:** Preserve existing content and behavior; minimize modeling, maintenance, download size, and runtime cost.  
**Status:** Advisory specification. Existing code, data, assets, and production measurements are authoritative until inspected.

## 1. Executive direction

Treat a *tileset* as a curated theme containing references to reusable geometry, materials, variants, and theme-specific accessories—not as a completely separate inventory of duplicated models. Build new assets only where an existing asset or inexpensive material/trim variant cannot meet the need. Do not retrofit every legacy asset just to make the catalog aesthetically uniform.

The companion image `URBAN_CIVILIAN_REFERENCE.png` illustrates the desired variety of architectural parts and settings. It is **concept art, not dimensional, topology, texture, or poly-count authority**. Its labels and example dimensions may not match the current project.

## 2. Scope: existing and future themes

Audit and support all themes present in the repository. The concept history includes Imperial Stone Fortress, Desert City, Medieval Village/Town, Industrial Factory, Modern Military Base, Coastal Harbor, Jungle Ruins, Snow Outpost, Sci-Fi Research Facility, Underground/Bunker and expanded Tunnel Systems (concrete/utility, cobbled sewers, caves, mines, road tunnels), plus proposed Urban & Civilian Infrastructure. These names are examples: **the repository inventory is the source of truth**. Do not assume all pictured themes have been imported or implemented.

## 3. Non-negotiable compatibility rules

1. **Preserve saved maps.** Do not rename/remove existing asset IDs, modify serialized placement semantics, or silently change transform origins. Add migration aliases only if genuinely required, and test them.
2. **Respect existing grid and snap standards.** Inspect tile dimensions, vertical increments, pivots, rotations, coordinate system, wall thickness, doorway clearances, stairs, and placement rules before authoring new geometry.
3. **Keep existing working meshes.** Avoid remaking meshes solely to conform to a new convention. Use adapters, trim, and transitions when reasonable.
4. **Reuse by reference, not by copying files.** One underlying asset may appear in multiple Map Maker categories. Theme metadata can control discoverability.
5. **Do not confuse materials with geometry.** Share a mesh when dimensions and silhouette are the same; create separate geometry when shape, collision, or gameplay readability differs.
6. **Collision is authoritative for gameplay.** Windows, doorways, cover, stairs, and destructible structures must retain correct movement, bullet, and line-of-sight behavior.
7. **No external user asset uploads.** Follow the project's in-house-only asset policy and existing asset pipeline.
8. **No blanket rewrites.** Favor additive, reversible changes and small verified migrations.

## 4. Mandatory discovery / asset audit

Before implementing, the agent must inspect the real repository and produce:

- Current Map Maker tile catalog and asset registries, source paths, loaders, import tooling, build output and storage conventions.
- Actual dimensions, pivot/origin, snapping, rotation, collision, UV/material conventions and relevant gameplay tags.
- Inventory of asset IDs, source model, material references, categories, themes, usage counts if obtainable, and duplicate candidates.
- Current batching, instancing, LOD, culling, collision and map serialization behavior.
- List of **Reuse As-Is**, **Reuse with Material**, **Reuse with Small Adapter**, **New Geometry Required**, **Leave Unchanged**, with evidence and rough effort.
- Current map compatibility test cases and baseline performance metrics before edits.

**Deliverable:** `ASSET_AUDIT.md` and a machine-readable inventory in the project's preferred format. Do not make destructive deduplication decisions without reviewing affected map references.

## 5. Suggested shared asset model (adapt to existing implementation)

Conceptually separate:

- **Geometry:** stable mesh identity, dimensions, pivot, snap sockets, collision profile.
- **Surface/material variant:** concrete, brick, plaster, timber, metal, etc., referencing shared textures/material definitions when possible.
- **Optional overlays:** trim, weathering, signage, graffiti, pipes, shutters, vegetation; only where justified by visual and draw-call cost.
- **Gameplay metadata:** walkable, bullet-blocking, climbable, penetrable, destructible, sight-blocking, cover-height, navigation flags.
- **Theme/catalog metadata:** searchable tags, categories, thumbnail, recommended context, and compatible transitions.

Example (illustrative schema, **not** a required rewrite):

```json
{
  "id": "existing_wall_asset_id",
  "geometryRef": "existing_wall_mesh",
  "materialVariant": "brick_red",
  "themes": ["urban", "industrial"],
  "snapProfile": "existing_wall_profile",
  "collisionRef": "existing_wall_collision"
}
```

A single asset can be listed under several themes while retaining one stable underlying model. Preserve existing IDs and representations where feasible.

## 6. Universal construction families

Evaluate coverage for each family; **do not assume every theme needs every item**:

| Family | Core shape coverage | Notes |
|---|---|---|
| Ground & floors | 1-cell, multi-cell, edge, slope, grate, broken | Existing grid defines size; roads and terrain may use specialized systems |
| Walls | solid, half/low, window, doorway, damaged, end-cap | Preserve gameplay openings and thickness |
| Corners & joins | inside/outside, T, cross, end, angled/curved where needed | Prioritize clean seams and snap points |
| Ceilings & roofs | flat, sloped, ridge, valley, corner, overhang | Separate roof silhouette from wall material |
| Vertical movement | stairs, landings, ramps, ladders, lift shafts | Validate navigation and player movement |
| Structural | columns, beams, lintels, braces, foundations | Reuse across styles with surface changes |
| Openings | doors, gates, windows, shutters, garage bays | Standardize openings only where current system allows |
| Edges & trim | skirting, coping, fascia, gutters, rails, parapets | Trim can hide mixed-material seams |
| Transitions | wall-to-wall, floor-to-floor, tunnel portal, terrain-to-building | Make transition kits where mixed sets visibly fail |
| Gameplay | cover, destructible panels, sight blockers, interactables | Gameplay behavior should not depend on visual theme |

## 7. Theme interoperability rules

**Shared fit, distinct architecture.** Themes may share construction footprints and connection interfaces without looking alike. Do not force medieval arches onto military walls or sci-fi panels onto suburban homes. Prefer the appropriate silhouettes, rooflines, openings and detailing.

Use a hierarchy for cross-theme connections:

1. Direct snap when both pieces already match.
2. Material/trim variant when the same geometry fits.
3. Small seam-covering adapter or transition strip.
4. Dedicated portal/junction when shapes fundamentally differ (e.g., round sewer to rectangular service corridor; irregular cave to concrete tunnel).
5. New base geometry only when necessary.

For irregular caves, rock walls and terrain, use modular shells, transition collars, edge masks, and overlap-tolerant boundaries rather than pretending organic surfaces are perfect cubes. Validate visual seams and collision independently.

## 8. Urban & Civilian Infrastructure: additive gap-filling plan

Use existing industrial, military, medieval, harbor, desert and tunnel geometry wherever appropriate. Likely *candidate* gaps (verify against audit):

- Modern storefront glazing and frames, shutters, signs and awnings.
- Residential siding, porch connections, domestic doors/windows, roof shingles, gutters.
- Garage openings, roll-up bays and driveway transitions.
- Road curbs, sidewalks, crossings, intersections, parking deck transitions.
- Balconies, fire escapes, stairwells and building facade connectors.
- Civilian street furniture and lightweight scene dressing.

These are not automatic production requirements. Prioritize pieces that unlock several distinct map layouts or solve a real connection problem.

## 9. Low-poly and browser-performance guidance

This is a browser-first TypeScript/Babylon.js project. Profile real target devices and existing scene composition before setting budgets.

- Reuse meshes via instances/thin instances where compatible with per-object gameplay and materials.
- Favor coherent shared materials/texture atlases when it genuinely reduces state changes without causing excessive texture memory.
- Avoid modeling tiny surface detail that normal maps or texture variation can convey.
- Preserve strong silhouettes, readable cover edges, and meaningful openings; do not over-optimize geometry that affects gameplay.
- Use simplified collision meshes when accurate enough, but retain separate precise hit shapes for trunks, branches, openings, or destructibles when gameplay requires them.
- Consider LOD/culling, occlusion, mesh merging, lightmap strategy, and scene partitioning only after measuring actual bottlenecks.
- Record draw calls, triangles, memory, load time, FPS, and collision/nav cost in representative small and large maps.
- Never merge independently destructible/interactable objects in a way that breaks gameplay.

## 10. Map Maker UX / asset catalog

- Offer **theme filters**, **shape/function filters**, and **search** over the same canonical asset inventory.
- Let assets appear in multiple relevant categories without copying model files.
- Preview footprint, orientation, snap points, material variants and collision/cover behavior where useful.
- Provide a clear **Transitions / Connectors** category and show compatible neighbors.
- Support mixed-theme scenes without requiring creators to switch build modes or remap their work.
- Avoid overwhelming the palette with trivial color variants; use a variant selector when supported by the current UI.

## 11. Migration, validation and acceptance tests

Before and after each change, verify:

1. Existing maps load identically, with stable IDs, transforms, materials, collision and gameplay.
2. Existing editor placements, rotation, undo/redo, save/reload, thumbnails and search still work.
3. Mixed-theme wall, floor, roof, stairs and doorway connections do not introduce gaps, overlaps or unexpected snap behavior.
4. Player and bot movement, bullets/projectiles, cover and line of sight remain correct.
5. Repeated assets do not regress memory, draw calls, load time or FPS relative to baseline without an explained tradeoff.
6. New assets do not duplicate existing geometry needlessly.
7. The final build works with the project's current pipeline and browser runtime.

Create automated checks where the current test infrastructure supports them; use a small manual visual matrix for seam quality and theme combinations.

## 12. Suggested implementation phases

**Phase 0 — Inspect:** Inventory the real system; capture baseline; identify existing maps and high-reuse assets. No production geometry changes.

**Phase 1 — Plan:** Produce compatibility matrix and prioritized missing-piece list. Flag breaking changes for explicit approval.

**Phase 2 — Minimal catalog integration:** Reuse existing asset IDs and models; add non-breaking theme tags and cross-listing if supported.

**Phase 3 — Targeted variants:** Add only high-value material/trim variants and transition pieces that resolve demonstrated gaps.

**Phase 4 — New geometry:** Create the smallest set of new architectural shapes required for missing gameplay and building functions.

**Phase 5 — Validate:** Run regression tests, mixed-theme placement tests, and performance comparisons; document findings and rollback plan.

## 13. Agent handoff instruction

> You are extending Trigger FPS's existing Map Maker and asset pipeline, not replacing them. First inspect the repository and identify its actual grid, snapping, asset registry, serialization, materials, collision, Babylon.js rendering, and import conventions. Produce an inventory and compatibility audit. Reuse current models and IDs whenever possible; cross-list existing assets under multiple themes by reference. Propose only missing geometry, material variants, and transition adapters. Do not remodel legacy sets, invent new grid dimensions, or migrate maps without explicit approval. Preserve gameplay collisions and existing map compatibility. Deliver a prioritized change plan, measurable performance baseline, and tests before implementing substantive changes. The supplied Urban reference image is visual inspiration only, not an exact engineering specification.

## 14. Companion reference

(The concept sheet, "Tileset 11: Urban & Civilian Infrastructure", is a reference picture and is not committed; the owner shared it with the MapMaker lane's main session on 2026-11-13.)

**Reference interpretation:** The six visual families and sample parts illustrate breadth and style. The agent must not treat labels, pictured shapes, or numerical annotations in generated concept art as verified technical requirements.
