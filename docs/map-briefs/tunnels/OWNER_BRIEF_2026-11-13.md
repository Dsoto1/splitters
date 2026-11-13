# Tileset 04, Tunnel Systems: the owner's brief (2026-11-13)

The owner's words and reference sheet, written down so every session works from the same thing. The sheet itself
(an image, "TILESET 04 – TUNNEL SYSTEMS") is not in the repo; what it shows is listed below.

## The problem to solve first

> the maps like woodside that try to implement tunnels with terrain over it are not working well and look odd,
> we need the terrain to work seamlessly with the tunnel builder (with different styles).

Today the ground is one height per point, with no holes. A tunnel under a hill means pulling the ground down under
the tunnel's floor all along it (HANDOFF, "Terrain over a tunnel must be pulled under its floor"), which leaves a
trench with a roofed corridor in it instead of a hill with a tunnel through it. The tunnel builder must fix this:
placing tunnel modules under ground leaves the ground on top as it was, opens the ground only at the mouths, and
the mouth meets the slope cleanly (a portal collar or headwall, no gap, no ground poking through the bore).

## One structural kit, five material families

> build this as a shared structural kit with five interchangeable material families, rather than five separate
> collections of tunnel geometry.

1. **Concrete & Utility Tunnels**: maintenance corridors, drainage culverts, stormwater channels, service rooms,
   reinforced underground passages.
2. **Cobblestone & Brick Sewers**: arched brick tunnels, water channels, vaulted chambers, iron grates, old masonry
   junctions.
3. **Natural Caves**: rock passages, cavern chambers, stalactites, uneven floors, collapsed openings. "For caves,
   I'd use modular rock shells and transition collars rather than forcing natural rock into perfectly square shapes."
4. **Mines & Excavations**: timber-supported shafts, rail tracks, ore tunnels, elevators, industrial mining
   infrastructure.
5. **Road & Vehicle Tunnels**: two-lane roads, highway tunnels, underpasses, ventilation shafts, pedestrian
   walkways, service bays.

- Every style shares **the same grid, connection profiles and elevation increments**.
- **Transition pieces** are the important addition: a concrete tunnel opening into a natural cave, a brick sewer
  joining a modern drain, a mine shaft meeting an underground road.
- Modules in every style they apply to: **straight, curved, T-junction, four-way, sloped, vertical, dead end,
  chamber**, so a map maker builds whole underground networks, not single corridors.

## What the reference sheet shows

- **Scenes:** a concrete utility/bunker tunnel (strip lights, pipes along the walls, hazard stripes, a yellow centre
  line), a brick sewer (round arch, green water channel with walkways, a round barred outfall, lanterns), a mine
  (timber sets, rail track, an ore cart, lanterns), a cave passage (blue light from an opening, stalagmites).
- **Palette:** concrete, stone block, cobble, mossy cobble, sewer brick, dirt, rock, hazard stripe, red metal,
  timber, steel plate, wet rock.
- **Floors (1x1):** concrete, concrete grate, cobble stone, sewer brick, metal plate, mine timber, dirt, rock,
  asphalt (road).
- **Walls (one level high):** concrete, reinforced (hazard base), sewer brick, stone, rock, mine wall (wood
  support), utility wall (pipes), tunnel road wall (barrier), retaining wall.
- **Corners and connectors:** outer corner, inner corner, T-junction, cross junction, columns (concrete, stone,
  timber), arch support, beam support, pipe brace, thin piece.
- **Ceilings and arches:** flat ceiling, beam ceiling, arches (concrete, stone, brick, rock), mine support, road
  tunnel lining.
- **Doors and gates:** security door, blast door, service door, roll-up door, grate gate, bar gate, round sewer
  gate, timber mine gate.
- **Stairs and ramps:** stairs (concrete, stone, metal), ramps (concrete, road, dirt/rock).
- **Rails and barriers:** metal rail, pipe rail, concrete barrier, jersey barrier, road guardrail, mine rail.
- **Utility pieces:** large pipe, elbow, T-pipe, valve, pipe bundle, vent duct, fan unit, utility box, electrical
  panel, wall light, hanging lantern, caged tripod light, mine cart, rail end bumper, track (straight, curve,
  switch), road panel with markings, drain grate, manhole, ladder.

## Rules that already apply

- Maps are declarative data made in MapMaker; no per-map code. The kit is MapMaker pieces (tiles, edges, kit props,
  set pieces) the owner and players can place.
- Content rules: our own generated geometry and library materials, or CC0 / approved packs with provenance.
- Reduce flashing: lights in tunnels are steady; no flicker effects without the flicker check.
