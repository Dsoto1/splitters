# Market Town: decisions and deviations

## How it was made
- With MapMaker's own operations, driven from a throwaway helper in the agent's scratchpad (not in the repo,
  per CLAUDE.md "Maps"): tiles through `placeTileCommand`, scenario pieces through `newScenarioEntities`
  (portcullis, wattle hurdles, braziers), spawns, flags, hills, pickups, props, water and the ladder through
  `addEntities`, settings through `setTheme`, `setMetadata`, `setBounds`, `setTeamSetup`, `setBackdrop`;
  every edit applied with `applyCommand` wrapped in `withTerrainUnderFloors` (as `EditorApp.run` does) and
  saved with `serializeMap`. It opens in MapMaker through Import with nothing lost (e2e `maps`).
- Everything the map needed went into MapMaker as Style Pack 10 pieces (tiles, props, Oak Door, Wattle
  Hurdle); there is no one-off code for this map.

## Choices
- **No terrain**: the town is all tiles (cobbles, yards, the stream bed), so the stream needs no sculpting.
- **2 × 1 houses**: a straight stair with open floor at both ends needs ~7 m plus room at the foot and head
  for the bots' navmesh; a one-cell house could not hold one. Upper doors are centred on the east and west
  ends so houses in a row (and walkways between them) connect.
- **Roof access** by Outside Stairs (decks at the eaves' height) rather than attic hatches; the roofs are
  35° and walkable, ridge east–west, so a row of houses is one roofline.
- **Gate roof** by a ladder through a hatch (a stair in the guard room would not fit the navmesh's rules).
- **Belfry 10 m, watchtower lookouts 7 m**, arriving on full-width landings; the belfry is a gallery on the
  south side (the well stays open). Bots don't reach the belfry or the NW lookout (QA report).
- **Portcullis starts raised**: the gate is the high street; the wall gaps at both ends keep it from being
  the only way in.
- **Stand-in hero props**: `mv_forge`, `mv_hay_cart`, `mv_well`, `mv_tarp_tent` are simple in-house models
  under stable ids; the owner is looking for community downloads to replace them in `content/props.json`,
  and the map won't need touching.
- **Materials are procedural**: ambientCG was refused by the build container's network proxy, so the new
  surfaces (cobbles, setts, market tiles, pantiles, half-timbering, wattle, whitewash, oak) are our own
  pattern code, not CC0 scans.
- `recommendedPlayers` 8–24, `teamSetup` 12 v 12 (the brief's 16–24).
