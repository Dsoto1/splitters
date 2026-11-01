# Vinefall Sanctum: decisions and deviations

## How it was made
- In MapMaker, driven in the browser (Playwright on the built app under `vite preview`) by a throwaway helper
  in the agent's scratchpad (not in the repo, per CLAUDE.md "Maps"): **New**, then every tile, spawn, pickup,
  objective, scenario piece and prop placed through the editor's own placement (`EditorApp.placeAtHover` with
  the Tile/Spawn/Pickup/Prop/Scenario tool, level, rotation and pointer cell or point set as the pointer would),
  teams, flag teams, hill radii, door styles and exact positions set with the inspector's edits, theme, map
  settings, bounds, team sizes and backdrop with the settings panels; then **Export** (a download).
- The export's release stamp (`metadata.release`: map id, version, hash) was dropped, as no other map in `maps/`
  carries one.
- Everything the map needed went into MapMaker as Style Pack 06 pieces (tiles, props, materials, the Ancient
  Temple theme); there is no one-off code for this map.

## Choices
- **One pack, not two**: the owner folded the Ancient Temple sheet into the Jungle Ruins refresh (2026-10-31),
  so the map mixes mossy jungle stone with sandstone, teal-and-gold inlay and banners. 03 Imperial Arena stays
  Roman.
- **Point-symmetric halves either side of a gorge**: the river gorge is the middle of the map; three ground
  bridges, two high bridges (rope and stone, 4 m) and the river bed are five ways across, so no single bridge
  decides a match.
- **No terrain**: the sanctum is all tiles; the gorge is Chasm tiles with Water, and the map edges are Cliff tiles.
- **Ziggurats from stacked pieces**: Temple Terraces with a Terrace Stair, a second stair a level up and the
  Summit Shrine on top (8 m), instead of one big ziggurat tile, so the shape is MapMaker's and can be edited.
- **The shrines hold the snipers**: the highest point on each side, reached by one stair line in the open; the
  watch tower lookouts (7 m) carry marksman rifles.
- **Portcullises start open**: the temple gates are routes; no rule closes them (a button and a rule can).
- **Heavy armour and dynamite in the gorge**: a reason to drop into the river and a risk (the banks look down on it).
- **Stand-in hero props**: `jt_statue_large`, `jt_crane`, `jt_zipline_post` are simple in-house models under
  stable ids; no Meshy generation without the owner's approval. A better model can take the same id in
  `content/props.json` and the map won't need touching.
- **Materials are procedural**: ambientCG is refused by the build container's network proxy, so the new
  surfaces (mossy stone slabs, carved temple stone, relief carving, inlay tiles, root cover, mossy planks, temple
  sandstone, palm thatch) are our own pattern code, not CC0 scans.
- `recommendedPlayers` 8–24, `teamSetup` 12 v 12, like Qasr Medina and Market Town.

## Deviations from the sheets
- **Zipline (owner question)**: the game has no zipline ride, only the Grapple Hook. The Zipline Posts stand as
  scenery (one on each side, by the watch towers) and the pack lists the Grapple Hook (one on each side, at
  (±40, 0, ±48)) to cross between high points. A real zipline is a new movement mechanic: the owner's call.
- **Not built from the sheets yet**: a wooden door, a stone gate as its own tile, shutter or carved windows as
  separate pieces, corner/T/cross wall connectors, spikes as a trap look, a decorative ceiling, a chain fixture,
  a "broken ceiling" variant.
