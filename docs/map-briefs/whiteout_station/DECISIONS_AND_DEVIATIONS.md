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
