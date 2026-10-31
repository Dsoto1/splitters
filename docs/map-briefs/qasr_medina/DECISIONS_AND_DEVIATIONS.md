# Qasr Medina: decisions and deviations

## How it was made
- In MapMaker, driven in the browser (Playwright on the built app under `vite preview`) by a throwaway
  helper in the agent's scratchpad (not in the repo, per CLAUDE.md "Maps"): **New** (a blank map), the
  starter room and spawn deleted, then every tile, yard, spawn, pickup, objective, scenario piece and prop
  placed through the editor's own placement (`EditorApp.placeAtHover` with the Tile/Spawn/Pickup/Prop/
  Scenario tool, level, rotation and pointer cell or point set as the pointer would), the outside yards
  painted Desert Sand (the Paint tool's `updateTiles`), teams, flag teams, hill radii and exact positions
  set with the inspector's `updateEntities`, theme, map settings, bounds, team sizes and backdrop with the
  settings panels' commands; then **Export** (a download). The export's release stamp (map id, version,
  hash) was dropped, as no map in `maps/` carries one. It opens in MapMaker through Import with nothing lost
  (e2e `maps`).
- Everything the map needed went into MapMaker as Style Pack 09 pieces (tiles, props, the Lattice Screen);
  there is no one-off code for this map.

## Choices
- **No terrain**: the city is all tiles; outside the walls the yards are painted sand.
- **Flat roofs at one height (8 m) with parapet gaps on the cell centres**: houses in a row make one rooftop;
  rope bridges (8 m) and cedar galleries (4 m) cross the alleys; outside stairs' decks land in the gaps.
- **2 × 1 houses** with two straight stairs inside (ground to upper floor, upper floor to roof): a stair with
  ~2 m of floor at both ends needs ~11 m, so a one-cell house could not hold one (the Medieval pack's rule).
- **The minaret is a landmark, not a climb**: a stair inside a 3 m shaft breaks the bots' navmesh (the Bell
  Tower lesson); the two **Watch Towers** are the climbable perches (bots reach both lookouts, see the QA report).
- **The domed hall's roof is not reachable** (no stair, on purpose): the dome is the landmark at the end of
  the high street; the hall is a room to fight through.
- **Portcullis starts raised**: the gate is the high street; the wall gaps at both ends (with breakable
  lattice screens) keep it from being the only way in.
- **Backdrop**: clear sky, mesas, sand, no border (the medina stands in open desert).
- **Stand-in hero props**: `dc_market_stall`, `dc_well`, `dc_crane` are simple in-house models under stable
  ids; no Meshy generation without the owner's approval. A better model can take the same id in
  `content/props.json` and the map won't need touching.
- **Materials are procedural**: ambientCG is refused by the build container's network proxy, so the new
  surfaces (ashlar, plaster, dome tiles, zellige, paving, rug, mashrabiya, canopy, cedar) are our own
  pattern code, not CC0 scans.
- `recommendedPlayers` 8–24, `teamSetup` 12 v 12, like Market Town.
