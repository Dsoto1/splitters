# Iron Maw: decisions and deviations

Map `maps/iron_maw.json`, brief `docs/map-briefs/BUILD_06_Iron_Maw.md`, reference
`docs/map-briefs/iron_maw_reference.jpg` (unchanged). Built 2026-10-30. Nothing here alters a named landmark,
a major route, the map's scale or its signature mechanic as the brief and image set them; where the image
or the engine left a choice open, the choice is recorded below.

## How it was made
- With MapMaker's own operations, driven from a throwaway helper in the agent's scratchpad (not in the repo,
  per CLAUDE.md): the terrain through the Flatten brush (`applyBrush`, one stroke per vertex to the bench
  design height), the Raise brush (stockpiles, spoil heaps), Paint and Paint slopes; tiles through
  `addTiles`; scenario-palette pieces (blocks, ladders, lifts as `mover:lift`-shaped movers, lights, flags,
  hills, bomb sites, spawns, pickups, vehicles, props) through `addEntities`; roads through `setPaths`;
  props bedded with "Settle on ground" (`settlePropsCommand`); everything applied with `applyCommand`
  wrapped in `withTerrainUnderFloors`, exactly as MapMaker's `EditorApp.run` does, and saved with
  `serializeMap`. The file opens in MapMaker through Import with no errors and nothing lost (QA_REPORT.md).
- No new MapMaker feature was needed: every piece is an existing tile, block, prop, ladder, mover, path or
  terrain brush.

## Scale and footprint
- Terrain 161 × 161 vertices at **3 m** spacing (480 × 480 m, the format's vertex limit; MAP_BUDGETS says
  2.5 m is fine for open ground, 3 m was needed for the 400 m+ the brief asks for). Bench faces are made
  steep enough at that spacing (a 1.6 m transition per 8 m face, 60–80°) that players and vehicles can't
  climb them (`PLAYER.maxSlopeDegrees` 50).
- Playable boundary 408 × 408 m (invisible walls at ±204 m, 60 m high); the terrain past it climbs into a
  wall of rock ("rock all round"), with the `cliffs` border beyond. Entities stay inside 400 m, so the
  validator's footprint budget holds.
- `metadata.recommendedPlayers` is 16–32 and `teamSetup` 16 v 16 because the schema caps them there (32
  players, 16 a team); the map is built and spawned for 48 v 48 (32 team spawns a side plus 33 free ones)
  and is meant for the Arcade's 48 v 48 preset. Raising the schema's caps is a format change for the owner.

## Layout choices the image left open
- The pit is the image's nested asymmetric terraces: six elevations below the rim (L1–L5 benches at −8 to
  −40 m, the floor at −48 m), centre offset south-west of the map centre, benches wide on the north
  (crusher side, 21–27 m) and narrow on the south-west (10–16 m). Each bench is a horseshoe: the spiral ramp
  that leaves it cuts it, ending in an 8 m face with a ladder up it.
- Haul road: one continuous clockwise spiral, rim → floor, through six full-width ramps (11–19 % grade,
  level landings at both ends). The image's road crossings of the benches are read as this spiral; the
  "switchback ramps" are a separate three-leg zig-zag on the south-east face (rim → L3), with a shelf ramp
  on L2 so the bench under it stays open.
- Teams: the image doesn't place bases. Embers hold the north-west (vehicle sheds, barracks, bunker HQ,
  guard tower), Tide the north-east (the workers' barracks rows the image shows there). The crusher,
  screen house and mills sit between them on the north rim, so the direct route is through the processing
  works (infantry), the flanks are round the south rim (vehicles, the rim tunnel) or down through the pit.
  Flags 300 m apart; Fort Wars' build-phase barrier falls through the crusher (x = 0).
- Conveyor yard: the image's conveyors run from the plant east and south-east. Built as walkable gantries
  (crusher → screen house → both mills, and a 300 m overland conveyor through the Tide camp to the east
  stockpile yard); the stockpiles are terrain (Raise brush), so they can be climbed.
- Tunnels through rock: the rim haul road through a rock spur on the south-west (16 m wide, vehicles), a
  bench tunnel through a rock buttress on L3 west and a deep drift through a buttress on L5 east (9 m,
  infantry and buggies). They're cut-and-cover: a trench in the terrain under a rock lid of blocks, because
  the terrain is a height field. Portals are concrete (rim) and timber sets (benches).
- Vertical mine shafts: three lifts where a ramp's top landing stands 16 m over the bench inside it (the
  No. 1 headframe by the crusher, L2 → rim; No. 2 shaft, L4 → L2; the pit floor lift, floor → L4), plus
  twelve ladders (nine at the horseshoe ends, the crusher roof, the conveyor transfer tower and stockpile).
- Modes: TDM, CTF, KOTH, Deathmatch, Fort Wars and Bomb listed (Elimination and Zombies come with them).
  Bomb was added because the crusher and the loadout make natural sites; race was not (no circuit fits a
  48-a-side fight).

## Deviations from the image
- The giant excavator in the image is a bucket-wheel machine with a long boom; the owner's Meshy model
  (`prop.mining_excavator`, 29 × 16 × 14 m) stands in the middle of the pit floor at its natural size. No
  block stand-in was kept.
- Haul trucks: three of the owner's Meshy trucks (`prop.mining_haul_truck`) parked on the floor, L2 and L4,
  against the bench walls so the benches stay passable.
- The image shows small buildings dotted on every terrace. Benches carry cover instead (rock windrows along
  every lip, containers, barriers, carts, crates), because a 10–25 m bench crowded with buildings stops
  vehicles and bots.
- Fewer structures on the south rim than the image: the south strip is 45–55 m wide; it carries the rim
  haul road, the tunnel spur and rock.
- No water anywhere, no bridges over the pit, no central hub (brief).

## Content
- All props are existing catalogue models: Kenney (CC0), loafbrr Mines & Caves pack (approved), the owner's
  Meshy models (Meshy, owned: `prop.mining_excavator`, `prop.mining_haul_truck`, the `prop.cargo_*`
  containers, gantry crane, IBC tanks and crates). No new assets were added by this build.

## Open questions for the owner
- Should the recommended player count (schema max 32) be raised so the menu can say 64–96?
- The bucket-wheel excavator could carry the pit-floor hill on its deck if its shell collision gets a
  walkable top; today it's cover only.
