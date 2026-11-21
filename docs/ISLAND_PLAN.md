# Island plan: one large open map (planning only, 2026-11-15)

The owner (2026-11-15): "I want to have the small map working great, which could evolve to one large map that
encompasses all of these features and mechanics/tiles/themes (like a Far Cry island)." Scaling study question 7:
400 m stays the cap for now; plan for bigger "eventually". **This is a plan only: no work starts from it without the
owner.** It sits at the back of the queue (docs/QUEUE.md). Background: `docs/SCALING_STUDY_2026-11-15.md`,
`docs/MAP_BUDGETS.md`, `docs/PERF_96.md`, `docs/MULTIPLAYER_DIRECTION.md`. Numbers below are estimates, not measured.

## The target

- **About 1 km × 1 km** (about 6× today's 400 m cap), **32 v 32 on a browser host, 64 v 64 on a dedicated host.**
- Every mode, mechanic, tile set and theme somewhere on it: a town, a coast and harbour, forest and hills, a canyon,
  an industrial yard, ruins, an airfield or helipad, interiors to clear, roads and trails for every vehicle.
- Dense points of interest with travel between them; sight lines that end in drawn-only scenery past the border (the
  backdrop already does this); vehicles make the distance fun. Far Cry's feel, not its size.
- Out of reach for us: Far Cry scale (8-10 km). A 2 km map is possible later but only with real streaming and a
  dedicated host (table below).

| Size | Area | Verdict |
|---|---|---|
| 400 m (today) | 1× | works |
| **~1 km** | ~6× | **the target**: feasible with the steps below |
| ~2 km | ~25× | possible later: real streaming, texture streaming, a region graph, dedicated host for full matches |
| 8-10 km | 400-600× | not realistic in a browser tab with player hosting |

## Budgets to set (today → island, first guesses)

| | Today (MAP_BUDGETS.md) | Island |
|---|---|---|
| Footprint | 400 m, terrain to 320 m | 1,000 m, terrain to 1,000 m |
| Entities | 4,096 | about 16,000-24,000, counted per region |
| Props / blocks | 1,500 / 3,000 | per 250 m region: about the same as today's whole map |
| Map file | 100-400 KB | a few MB (split per region, see MapMaker) |
| Browser memory | the tab died near 1.3 GB (docs/PERF_MAPMAKER_TRACE_2026-11-15.md) | keep play under about 1 GB: only near regions fully built |
| Bandwidth | 25-55 KB/s a player | the same, by sending each player only what is near them |
| Host CPU | 64 v 64 on a dedicated host | the same player count over a bigger area: navigation and physics by region |

## What it needs, in order (each its own landing; the first ones help today's maps too)

1. **From the scaling study, already queued:** the navmesh kept between matches; interiors hidden when no opening is
   in view; interior models on approach; the path search budget by time; spawn-first build order.
2. **Tiled navmesh** (L): build and rebuild by tile, so a 1 km map's navmesh doesn't take minutes and MapMaker's check
   stays quick. Also lets breakable walls open routes.
3. **Region graph for bots** (M): plan long trips between regions first, then walk the navmesh inside one.
4. **Interest management** (M-L): snapshots carry only what each player can matter to (distance, sight, vehicles
   further), so bandwidth stays flat as the map grows.
5. **Far stand-ins** (M): impostors for far trees and buildings, merged far terrain; far squares drawn cheaply.
6. **Real streaming** (L+): build near regions, unload far ones, with hysteresis so turning around doesn't hitch;
   textures low-mip first. Needed for 1 km at High on weaker machines; required for 2 km.
7. **MapMaker for big maps** (L, lane B): edit one region at a time (load the region and its neighbours), a world
   overview map, region budgets shown live, the map saved per region so an edit doesn't rewrite everything.
8. **The island itself** (L, many landings): built in MapMaker like every map (no build scripts), a region per landing,
   each playable on its own as a test map first.
9. **Raise the caps** in MAP_BUDGETS.md once 1-7 are measured, then the perf tour on the island.

## Risks

- **Memory in a browser tab**: the hard limit. Streaming and stand-ins are the answer; measure on the owner's machine.
- **Host CPU** with 64 bots spread over 1 km: bots far from any player could run at a lower rate (a later choice).
- **Content to fill it**: the biggest cost is making the island, not the engine work.
- **Snipers and long sight lines** need far geometry to still block bullets and sight: streaming unloads only drawing,
  never the simulation's collision.

## Questions for the owner (when this comes up)

1. Size: **a) about 1 km ★ recommended**, b) 2 km (needs real streaming and a dedicated host), c) decide after a
   1 km test region.
2. Players: **a) 32 v 32 in a browser, 64 v 64 on a dedicated host ★ recommended**, b) smaller (16 v 16) for a denser feel.
3. Modes: **a) a few big ones (Conquest-style capture points, vehicles, co-op missions across regions) ★ recommended**,
   b) every mode, each using part of the island.
