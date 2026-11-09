# Whiteout Station: decisions and deviations

## How it was made
- With MapMaker's own operations, driven from a throwaway helper in the agent's scratchpad (not in the repo, per
  CLAUDE.md "Maps"): tiles through `placeTileCommand`; the roll-up door, button, thin ice and ice blocks through
  `newScenarioEntities`; spawns, flags, hills, pickups, props, water and mounts through `addEntities`; the door rule
  through `setLogic`; settings through `setTheme`, `setMetadata`, `setBounds`, `setTeamSetup`, `setBackdrop`. Every
  edit went through `applyCommand` wrapped in `withTerrainUnderFloors` and was saved with `serializeMap`.
- Everything the map needed went into MapMaker as Style Pack 12 pieces (tiles, props, Roll-up Door, Ice Block,
  Thin Ice); no one-off code for this map.

## Choices
- **No terrain**: the outpost is all tiles; the ridge is Frozen Cliff tiles with Snow Drifts, so bots get it on the
  navmesh without sculpting.
- **Roofs by outside stairs**, not ladders, so bots climb them too.
- **Hangar door rolled up at the start**: the hangar is the Embers' front door; a defender can roll it down from the
  button inside (the side doors stay open, so it never seals the base).
- **Thin ice over the holes** (crumbles, back in 12 s) with steps out of the water, so nobody is trapped.
- **Snowmobiles** are the existing `snow_sled` mount; `so_snowmobile` is a parked stand-in prop.
- **Stand-in hero props**: `so_snowmobile`, `so_satellite_dish`, `so_generator` (and the radar dome and comms mast
  tiles) are candidates for Meshy or community versions once the owner approves; the ids stay.
- **Materials are procedural** (ambientCG is blocked by the build container's proxy).
- **Not in the game yet**: falling snow (the snowy sky has no precipitation) and slippery ice (movement has no
  low-friction surfaces). For the owner: is either wanted?

# Rebuild 2026-11 (MAP 03 Frostbite Station; branch `wip/mapmaker-whiteout`)

The owner moved Whiteout Station's rebuild into the MapMaker lane (2026-11-08) from the approved brief
`docs/map-briefs/MAP_03_Frostbite_Station.md` and its reference `frostbite_station_reference.jpg`. Everything above this
heading is the old build (2026-10-31), kept for the record.

## How it is made
- In MapMaker only (CLAUDE.md, "Maps"). A scratch Playwright driver (not in the repo) works the real MapMaker of a
  `vite preview` build as a person does: Import of the shipped map (to keep its id, name and settings), the plan view
  (K) and a drag box with Delete on every level to clear it, the Logic tab's delete button for the old door rule,
  Environment → Terrain → Create terrain, the brushes held and dragged over the ground in the plan view (Flatten with
  its typed height, Raise, Smooth), the palette's cards and a click where the ghost is green, R to turn, PgUp/PgDn for
  the level, the inspector, Map properties, and Export to `maps/whiteout_station.json`. No map file was written or
  edited by hand or by a script.

## Layout (cells of 8 m, x east, y north; cell (x, y) is centred on world (8x, 8y); levels of 4 m)
- **Central yard** (offset east of centre): cells x −1..2, y −1..1, Courtyard tiles (crates, low walls) over the
  ground dipped to −1.5 m, so the **tunnel** runs under it on level −1: Stairs huts at (−1, 0) (up west) and (2, 0)
  (up east), two Corridors between. The yard is the mid-range space; the huts break its sightlines.
- **Main lab** (north, two storeys): Reactor Room (3 × 2) at x −1..1, y 2..3, its south door onto the yard, its east
  door into the Server Vault (2 × 2, turned half round) at x 2..3, y 2..3; doors north onto the north lane.
- **Lab wing** (west, two storeys): Power Core Hall (3 × 3) at x −5..−3, y −1..1; its east door faces the west tunnel
  hut across an 8 m gap; its gallery doors open onto railed platforms with open stairs down (east over the gap, west
  over the west flank).
- **Communications annex** (north-west): a Corridor from the hall's north door to a Barracks (x −5..−4, y 3) and the
  Comms Tower (−3, 3), the station's mast.
- **Snow vehicle garage** (south): Vehicle Hangar (2 × 2) at x 0..1, y −3..−2 (the big door onto the south road, doors
  north onto the yard, its mezzanine doors onto railed platforms over the yard's south edge) and a Loading Dock
  (3 × 2) beside it, x 2..4.
- **Fuel tanks** (east): Fuel Depot tiles and tank props by a Barracks used as the pump house (x 4, y 0..1, turned),
  which the east tunnel hut faces.
- **Radar shelter** (north-east): the ground flattened to 3.85 m (a ridge 4 m up, rock faces) over x ≥ 28 m, z ≥ 20 m;
  the Radar Dome on level 1 at (5, 4) with the satellite dish; up by a Snow Drift at (4, 2), a Metal Stair at (6, 2)
  and a Snow Drift from the north lane. From the ridge, a long diagonal sightline over the yard to the south-west.
- **Ice cave** (south-east): a Large Room (2 × 2, roofed, ice-painted) at x 5..6, y −4..−3 buried in a raised rock
  mound, doorways north (fuel side) and west (south road).
- **Service trench** (south-west): sunken Trench set pieces from the lab wing's south door to the hangar's west door.
- **Three outdoor flanks**: the west flank (x −6), the south road (y −4) and the east flank (x 6); the north lane
  (y 4) behind the lab joins the annex to the ridge. Snowbanks raised round the outside of the boundary.

## Choices (the conservative option where it was the owner's call; questions in the report)
- **Scale**: standard arena for 8-16 (the brief), a 120 × 98 m boundary: smaller than the old map's 104 × 136 m.
  Teams 8 v 8.
- **Modes**: Deathmatch (main) and Team Deathmatch, Elimination with it. Capture the Flag and King of the Hill (the
  old map's) are dropped: the brief recommends DM, TDM and Elimination and says not to invent objectives.
- **Spawns** (the brief leaves them open): Tide in the north-west (the annex and the north lane), Embers in the
  south-east (the south road and the cave's side), eight shared ones round the edge for Deathmatch, one of them on the
  ridge. Diagonal, so each side has a mid-length walk to the yard and the ridge sits between them.
- **Pickups**: shotgun and SMG inside the labs (short range), the assault rifle in the yard, the marksman rifle in the
  comms annex, the sniper on the ridge by the dish, the rockets in the tunnel, the LMG on the hangar's mezzanine,
  grenades by the trench, armour in the ice cave and the west flank, health in the annex, the garage, the vault and
  the pump house's side. Military weapon set.
- **No vehicles**: the brief says exact vehicle placements are not specified. The garage has two parked snowmobile
  props on its apron, not the drivable `snow_sled` mounts.
- **The tunnel's ends are huts in the yard** (Stairs tiles standing up out of the yard), not inside the buildings:
  the set pieces' walls have no doors there, and the huts break the yard's sightlines.
- **The ice cave is a roofed room under four Frozen Cliff tiles**, not a hollow in the terrain: terrain is a height
  grid, so ground over a doorway closes it. The ground is raised against its south and east walls into the bank.
- **The radar ridge is terrain** (flattened to 3.85 m so level-1 tiles sit on it), climbed by two Snow Drifts and a
  Metal Stair; its faces are steep rock (Paint steep slopes as stone).
- **The hangar's mezzanine has no door north** (its model), so no balconies over the yard from it; the lab wing's
  gallery doors open onto railed platforms with open stairs down instead.
- **Foliage**: our Pine forest scatter (env pines and spruces) in a few stands inside the boundary's corners. No Kenney
  plants. Nothing outside the boundary (validate-map warns about anything there).
- **Snowbanks** outside the boundary, raised and roughened with the brushes; the backdrop's border is none (the old
  map's concrete wall would stand in front of them).
- **Lights**: only the set pieces' own (no blinking, no new bright effects: Reduce flashing is untouched).

## Deviations from the brief and the reference
- The reference's lab is a big two-storey block with a dome on its roof; here the Reactor Room (two storeys, a
  control room over the airlock) and the Server Vault stand in for it, and the domed building is the radar shelter.
- The comms annex is at ground level, not up on a rocky outcrop with stairs.
- The fuel tanks are three Fuel Depot tiles and two tank props by the pump house, fewer than the reference's tank farm.
- No snowmobile garage doors that roll: the hangar's doorway is open (the old map's Roll-up Door and its button are
  gone).
