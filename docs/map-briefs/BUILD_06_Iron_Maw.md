# AGENT BUILD BRIEF — MAP 06 — IRON MAW
**Status:** Not implemented. This is a construction specification to apply using the **real Trigger MapMaker**. Read `AGENT_BUILD_CONTRACT.md` first.
**Source:** `MAP_06_Iron_Maw.md` in the design bible. Approved visual reference must be supplied/identified by the user. Do not treat image-generated geometry as engine coordinates.

## Design targets
- **Topology:** Asymmetric nested horseshoe terraces around excavation.
- **Terrain and elevation:** Six distinct bench elevations, switchback ramps, tunnels through rock.
- **Required landmarks:** Ore crusher, haul road, giant excavator, conveyor yard, workers’ barracks, pit floor.
- **Traversal:** Continuous wide spiral haul roads plus vertical mine shafts and side tunnels.
- **Combat:** Vehicle engagements on roads, infantry fights inside processing works, long shots across terraces.
- **Movement:** Ground vehicles, ramps, ladders, optional jump shortcuts. Use only where the geography and Trigger's supported mechanics justify them.
- **Signature identity:** Large-scale vertical battlefield defined by a descending excavation.

## Concrete MapMaker build tasks
1. Locate and document the existing map schema and editor terrain/structure workflows. Duplicate a known-good sample map as a new unique ID, without overwriting existing work.
2. Using the approved overhead image, sketch and implement the **complete playable boundary** and the named landmark footprints. Record the map's origin, rotation, dimensions and world-unit scale.
3. Sculpt landforms and elevation first. Ensure slope/ramp/stair access between intended playable levels and avoid inaccessible decorative islands.
4. Build **Ore crusher, haul road, giant excavator, conveyor yard, workers’ barracks, pit floor.** with actual modular tiles/assets. Give every structure purposeful entry/exit geometry; where interiors are intended, use accessible rooms and clear door openings rather than sealed façades.
5. Construct **Continuous wide spiral haul roads plus vertical mine shafts and side tunnels.**. Write a traversal graph listing each route's endpoints, vertical change, expected travel time, chokepoints and alternate paths. Verify walking in-engine.
6. Define cover, sightlines and engagement spaces consistent with: **Vehicle engagements on roads, infantry fights inside processing works, long shots across terraces.**. Avoid vast empty killing fields unless intentional for this specific map.
7. Configure the supported game modes, real spawn entities, team assignment, objectives and pickups **after** geometry is stable. Select exact weapon IDs from Trigger's real registries. No invented placements from visual art.
8. Generate/update bot navigation and test bot reachability through all major zones; scale spawn density to the map's documented player-count target.
9. Apply materials, lighting and minimal themed dressing without obscuring gameplay. Re-check collision and sightlines.
10. Save, reload, launch a bot match, capture an overhead screenshot and key first-person route screenshots, then complete QA checklist.

## Mandatory map-specific constraints
No central bridge hub, no waterways, no tiny isolated platforms. Do not reuse the overhead silhouette, mirrored placement, water distribution, or radial bridge network of Sunken Kingdom or The Spillway. No filler architecture.

## Do not guess
- The reference image does not establish exact game-unit distances, exact interiors, exact spawn/pickup coordinates, or objective locations.
- MapMaker APIs and asset identifiers must be discovered in the project; never fabricate them.
- Ask before materially changing the approved geometry or adding features not supported by the current editor.

## Required handoff
- Native Trigger map data (must load in current MapMaker and game)
- `MAP_IMPLEMENTATION_MANIFEST.md` (all world coordinates and real IDs)
- `QA_REPORT.md` (checks, test commands, bot counts, failures, performance)
- `DECISIONS_AND_DEVIATIONS.md` (differences from approved image/brief)
- Top-down MapMaker screenshot and 3–6 in-game first-person screenshots

## Original concept reference
The following brief is design input, not a verified map implementation.

# MAP 06 — IRON MAW

**Status:** Proposed visual concept; not approved geometry.
**Map scale:** Massive battlefield. **Target combatants:** 64–96. **Recommended modes:** TDM, CTF, KOTH, Fort Wars.

## Environment and setting
Gigantic open-pit industrial mine. The setting must be readable through its buildings, landforms, materials, and believable site organization rather than decorative labels.

## Authoritative layout identity
**Topology:** Asymmetric nested horseshoe terraces around excavation.

**Terrain and elevation:** Six distinct bench elevations, switchback ramps, tunnels through rock.

**Required landmarks:** Ore crusher, haul road, giant excavator, conveyor yard, workers’ barracks, pit floor.

**Traversable routes:** Continuous wide spiral haul roads plus vertical mine shafts and side tunnels.

**Combat-space variety:** Vehicle engagements on roads, infantry fights inside processing works, long shots across terraces.

**Movement opportunities:** Ground vehicles, ramps, ladders, optional jump shortcuts. Use only where the geography and Trigger's supported mechanics justify them.

**Signature identity:** Large-scale vertical battlefield defined by a descending excavation.

## Explicit anti-repetition constraints
No central bridge hub, no waterways, no tiny isolated platforms. Do not reuse the overhead silhouette, mirrored placement, water distribution, or radial bridge network of Sunken Kingdom or The Spillway. No filler architecture.

## Gameplay plausibility / developer review
Vehicle turn radius, cover at every bench, and safe ways to leave the pit floor. Routes must be physically connected and sized for the intended player count. Spawns, weapon pickups, objectives and exact vehicle placements are **not yet specified**; do not invent or depict their markers.

## Exact image-generation brief — copy this section into an image request
Create ONE premium high-detail stylized 3D overhead map reference for Trigger, titled conceptually “Iron Maw” but with **no title text rendered**. The scene is gigantic open-pit industrial mine. Use this unique composition: asymmetric nested horseshoe terraces around excavation; terrain: six distinct bench elevations, switchback ramps, tunnels through rock. Visibly incorporate ore crusher, haul road, giant excavator, conveyor yard, workers’ barracks, pit floor. Make navigation legible through continuous wide spiral haul roads plus vertical mine shafts and side tunnels. The design's gameplay identity is large-scale vertical battlefield defined by a descending excavation. Almost top-down aerial; enormous terraced open mine, spiral switchbacks, heavy machinery, exposed rock; show full excavation rim. Show the COMPLETE playable map footprint and its borders in a single coherent frame. Convey realistic first-person-shooter traversability, distinct combat zones, modular buildable architecture integrated with sculptable terrain, cover, stairs and accessible routes. Absolutely NO text, letters, numbers, icons, legends, HUD, arrows, infographic panels, characters, or weapon pickups. Avoid water and bridges except where explicitly required. Specific prohibition: No central bridge hub, no waterways, no tiny isolated platforms. Do not make a variant of any previously generated map.

## Approval checklist
- [ ] Entire map visible from near-overhead view.
- [ ] Footprint/topology visually distinct from approved maps.
- [ ] All named landmarks identifiable without labels.
- [ ] Routes physically plausible, with more than one viable engagement approach.
- [ ] Water, bridges and symmetry limited to the brief.
- [ ] No generated labels, icons, or fictional item placements.
- [ ] User approves image before any detailed placement work.

