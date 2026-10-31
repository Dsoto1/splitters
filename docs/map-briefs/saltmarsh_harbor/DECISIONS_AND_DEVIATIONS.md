# Saltmarsh Harbor: decisions and deviations

## How it was made
- With MapMaker's own operations from a throwaway helper in the agent's scratchpad (not in the repo, CLAUDE.md
  "Maps"): tiles through `placeTileCommand`, Harbour Water and lights through `newScenarioEntities`, spawns,
  flags, hills, pickups, props, ladders and boats through `addEntities`, settings through `setTheme`,
  `setMetadata`, `setBounds`, `setTeamSetup`, `setBackdrop`; every edit applied with `applyCommand` wrapped in
  `withTerrainUnderFloors`, saved with `serializeMap`. Everything the map needed went into MapMaker as Style
  Pack 11 pieces; no one-off code.

## Choices
- **No terrain**: the harbour bed is part of the water tiles, so no sculpting; the land is tiles.
- **Water 1.5 m under the quay** so you can't hop out: the ways out (steps, slipway, beach, ladders, rocks) are
  routes of their own, and swimmers fit under the piers.
- **Skeleton lighthouse** instead of a walled tower: a switchback inside walls drops off the bots' navmesh.
- **Boats** are hover bikes placed *Rides on water*: the game has no boat vehicle yet (a motor launch would be a
  new mount model; candidate for later, see HANDOFF).
- **Tide warehouse roof** has no stair: an Outside Stair against the east boundary lost its outer flight on the
  navmesh. Players reach that roof from nowhere; the other two warehouse roofs have stairs.
- **Distinct from** Dockside Depot (one warehouse lot), Dune Harbor (desert spaceport street), Iron Tide (a ship)
  and Norman Shores (lake houses): an open basin crossed by pier, boardwalk and breakwater, fights over water.
- **Stand-in**: `hb_fishing_boat` is a simple in-house model under a stable id (Meshy/community candidate).
- Materials are procedural (CC0 texture hosts are blocked by the build container's proxy).
