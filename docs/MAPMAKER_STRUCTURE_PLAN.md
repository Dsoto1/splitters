# Modular Structure System: where we stand

Gap analysis of [MAPMAKER_MODULAR_STRUCTURE_SYSTEM.md](MAPMAKER_MODULAR_STRUCTURE_SYSTEM.md)
against the MapMaker as of Oct 25. ✅ have it, 🟡 partly, ❌ not yet.

| Spec § | Item | State | What we have / what's missing |
|---|---|---|---|
| 2.6, 30 | Deterministic grid data, classic layer | ✅ | `classicStructure.tiles` (grid x/y/level, quarter-turn rotation); everything else is entities |
| 3 | ~40–50 structural pieces | ✅ | 49 tiles: rooms, large rooms, corridors, vertical, open, special, curves, towers, balconies |
| 3.7 | Negative space | 🟡 | Pit, Drop Shaft, Sunken Room, liquids (water/lava/acid); no chasm, trench or channel pieces |
| 3.8 | Macro structures with connection points | ❌ | Large rooms only; no warehouse/hangar shells |
| 5 | Per-side wall configuration | 🟡 | 17 edge styles per side, now with broken, bars and shutter; shared walls stay in sync. Missing: force field, destructible (Phase G) |
| 6 | Interior layout presets on one room | ✅ | Room options (v16): 9 layouts sized to the footprint on 10 room tiles; old variant tiles still work |
| 7 | Floor inserts | 🟡 | Raised and sunken centre as room options; water/grate/glass inserts still to do (liquids and blocks can be placed by hand) |
| 8 | Ceiling height/type | 🟡 | Roof, skylight and beamed roof as room options; height is still one level (Tall Room for two) |
| 9 | Corner treatments | ✅ | Posts, columns, chamfered, rounded as room options |
| 10 | Detail sockets + density + seed | ❌ | Trim only (baseboards, cornices, frames); map scripts use `furnish()` for corner props |
| 11 | Condition states | ❌ | |
| 12 | Decals (placed) | ❌ | Bullet/blood decals at runtime only |
| 13 | Scatter painting | ✅ | Scatter brush and terrain foliage layer (SCENERY.md) |
| 14 | Macro props | 🟡 | 145 Kenney props + 67 set-piece props, scalable 0.25–4×; few large ones (no crane, silo, billboard) |
| 15 | Terrain transition kit | ❌ | Tiles sit on terrain; no foundations, retaining walls, cave mouths |
| 16 | Theme channels with overrides | 🟡 | 20 themes = material per slot; per-tile surface paint overrides. Detail/props/lighting/audio channels don't exist yet |
| 17 | Eight foundation packs | ❌ | Roadmap Sprint 7 |
| 18 | Connector pieces | 🟡 | Doors/arches/windows as edge styles; no bulkhead, gate, tunnel or cave mouths |
| 19 | Smart presets | ❌ | |
| 20–21 | Seeded randomize, theme auto-dressing | ❌ | |
| 22–23 | Gameplay metadata, nav validation | 🟡 | Navmesh built from geometry; save-time checks for unreachable spawns/pickups/objectives; no nav view in the editor |
| 24 | Capacity analysis | ❌ | Manual audit in the roadmap |
| 25 | Performance meter | 🟡 | Hard limits (MAP_BUDGETS.md); no creator-facing rating |
| 27 | Room/portal metadata | ❌ | |
| 28–29 | Destruction rules, structural logic events | 🟡 | Breakable props/blocks fire `destroyed`; zones fire enter/leave; no destructible walls |
| 31 | Multi-select, rotate, duplicate | 🟡 | Have select, box select, rotate, duplicate, delete; missing copy/paste between maps, mirror, group |
| 32 | Creator prefabs | ❌ | |
| 33 | Asset search/tags/favourites | ❌ | |

## Proposed order (spec §37, minus what we have)

1. ✅ **Room options** (Oct 25): layout, floor insert, ceiling and corners on rooms; broken, bars and shutter walls. Destructible walls move to Phase G.
2. **Detail sockets + theme auto-dressing** with density and seed: the biggest visual jump.
3. **Condition states** (pristine → overgrown) driving materials, debris and decals.
4. **Decals**, placed and theme-dressed.
5. **Terrain transitions**: foundations, retaining walls, cave/tunnel mouths, ramps to terrain.
6. **Theme channels** (materials / details / props / lighting) with overrides, then the eight style packs on top.
7. Copy/paste, mirror, prefabs; nav view; capacity and performance meters.
