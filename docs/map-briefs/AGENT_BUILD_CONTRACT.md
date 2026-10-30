# TRIGGER — MAPMAKER AGENT IMPLEMENTATION CONTRACT
Version 1.0 | Applies to all 21 maps

## Mission
Build **playable, tested maps inside the existing Trigger MapMaker**, using the individual map briefs and approved reference images. Deliver actual native MapMaker map data, not screenshots, an invented map format, or a replacement editor. **Do not claim any map is built until saved, reloaded, and played in the real game.**

## Authority and unknowns
Priority: (1) user-approved map reference image, (2) map-specific build brief, (3) map design bible, (4) verified Trigger code and editor capabilities. If the approved image contradicts the text, document the conflict and ask before making material topology changes. Concept images are **visual references, not precise CAD drawings**: do not infer inaccessible interiors or unseen tunnel connections as facts.

**Before editing:** inspect the repository and locate the MapMaker implementation, map serialization/schema, editor placement tools, terrain brush APIs, asset catalog, runtime map loader, navigation/bot pathing, collision, game mode/objective handlers, pickup registry, and test commands. Record real filenames and actual API names in `DISCOVERY_REPORT.md`. Do not invent APIs, classes, asset IDs, or console commands. If the editor cannot do a required operation, report a concrete blocker and propose the smallest compatible extension; do not silently substitute decorative geometry.

## Build order (strict)
1. **Repository discovery and baseline:** branch/status, map asset schema, existing sample map, build/test scripts, backups; never overwrite user maps.
2. **Playable footprint:** set actual engine dimensions and bounds based on game movement speeds and target population; document unit conversion. Ensure out-of-bounds and water hazards are handled.
3. **Sculpt terrain:** land masses, elevation layers, cliff transitions, slopes, low ground, water only if brief requires it. Test foot traversal before detailing.
4. **Greybox structures:** modular walls, floors, roofs, doors, columns, stairs, ramps, bridges only where necessary; all structure entrances and routes must connect to reachable surfaces. Use consistent modular snapping.
5. **Combat connectivity:** primary, alternate, flank and escape routes; avoid unintentional dead ends; create close, medium and long sightlines as specified. Check both sides of every elevated access.
6. **Collision and navigation:** test player controller, jump, crouch, slope limits, drop/fall damage, ladder/jump pad/portal behavior if present. Rebuild or update bot nav data using verified project workflow.
7. **Modes and objectives:** configure only modes supported by the real game and suitable for this map; add team flags, hill regions, bomb sites etc. only when specified and verified. Do not assume CTF requires mirrored geometry.
8. **Spawns:** populate enough individual spawn points for target concurrent combatants, with team ownership where relevant; test spawn overlap, line of sight, safe clearance, initial exposure, bot replacement and respawn logic. Define FFA separately.
9. **Weapons/pickups:** choose IDs from actual registry, not image labels; place by engagement type and contestability; check reachable floor and clearance; record exact coordinates and respawn rules from the game. No invented item icons.
10. **Vehicles:** only on maps whose brief warrants them and whose geometry supports turning, approach, clearance, safe spawn, and AI pathing. No mandatory vehicles on every map.
11. **Visual pass:** add thematic materials, lighting, landmark silhouettes, and restrained decoration *after* playable geometry. Do not hide doorways, stairs or lines of travel with foliage.
12. **Test, iterate, save and reload:** automated validation plus actual in-game traversal and bot matches; verify performance at target population.
13. **Deliver:** native map file(s), changed assets/scripts, validation results, screenshots, manifest, limitations, and reproduction instructions.

## Per-map required data
Use the game's **real** serialization format. Keep a human-readable `MAP_IMPLEMENTATION_MANIFEST.md` with:
- Map ID/name, source image, brief revision, author, status and approved decisions.
- World dimensions, origin, orientation, coordinate units, vertical layers and playable bounds.
- Named combat zones with polygons/approximate extents, intended engagement ranges and cover.
- Traversal graph: each route's start, end, access type, elevation change, choke width, alternate path.
- Structure instances: real asset IDs, transforms, collision, entrances, roof access and interiors.
- Spawn records: team/mode, actual world coordinates, facing, safety validation.
- Objective records: mode, type, real identifier, coordinates/area, gameplay validation.
- Pickup records: exact in-game registry ID, world coordinate, support surface, respawn rule.
- Optional vehicle records: real prefab ID, spawn/parking, route and AI viability.
- Terrain/water/hazard parameters and navigation build notes.
- Screenshot viewpoints and QA results.

## Acceptance tests — must be recorded, not assumed
- [ ] Map saved to real project format and loaded again without warnings or lost objects.
- [ ] All named required landmarks exist and are identifiable in an overhead screenshot.
- [ ] All intended surface routes traversable; underground routes have actual entrances/exits.
- [ ] No unavoidable one-route choke unless map concept explicitly requires it.
- [ ] Bot pathing can reach major combat zones, pickups and objectives from valid spawns.
- [ ] Collision on every modular structure, stair, ramp, bridge and terrain transition.
- [ ] No spawn inside geometry, hazards or enemy line of fire; verify at target player count.
- [ ] CTF flags / objectives accessible to both teams if mode enabled.
- [ ] Weapon/pickup IDs resolve in real data; pickups not floating or buried.
- [ ] Vehicle roads and AI traversal tested if vehicles used.
- [ ] Screenshot matches approved reference's *topology*, not merely its colors.
- [ ] Target-bot match run and measured for errors, stuck bots and performance.
- [ ] Distinct from other approved maps in footprint, route graph and combat identity.
- [ ] Actual test logs, screenshots, and unresolved issues included in handoff.

## Recommended test matrix
- Solo manual walk-through (all routes), 4v4 (where supported), target count, and bot stress at target max.
- TDM and CTF/DM only where explicitly supported; test win conditions and objective resets.
- Respawn repeatedly from each spawn cluster; record spawn kill, trapped bot, and unreachable-item events.
- Record FPS/frame time, collision errors, bot path failures, map load time and object counts if instrumentation exists.
- If 96-player testing is infeasible in current environment, mark **NOT TESTED**, never PASS.

## Change management
Work on one map at a time. Preserve approved reference image unchanged. Make staged commits/backup copies. Keep a short `DECISIONS_AND_DEVIATIONS.md`; ask for approval when altering a named landmark, major route, water distribution, map scale or signature mechanic. Never create a cosmetic-only mockup as a substitute for a build.

## Delivery format
`maps/<map-slug>/` with native map file(s), `MAP_IMPLEMENTATION_MANIFEST.md`, `DISCOVERY_REPORT.md` (can be shared), `QA_REPORT.md`, `DECISIONS_AND_DEVIATIONS.md`, `screenshots/`, and optional build automation. Supply exact in-game loading steps and the actual commands used.
