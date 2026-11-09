# Verdant Protocol: decisions and deviations

From the approved brief `docs/map-briefs/MAP_04_Verdant_Protocol.md` and its reference `verdant_protocol_reference.jpg`
(the owner moved map builds into the MapMaker lane on 2026-11-08 and approved this brief). Branch
`wip/mapmaker-verdant`.

## How it is made
- In MapMaker only (CLAUDE.md, "Maps"). A scratch Playwright driver (in the agent's scratchpad, not the repo) works
  the real MapMaker of a `vite preview` build as a person does: New map (Sky map, then Environment → Terrain → Create
  terrain), Map properties, the Terrain tab's brushes held and dragged in the plan view, the palette's cards and a
  click where the ghost is green (R to turn, PgUp/PgDn for the level), the Entities tab's blocks sized in the
  inspector, the Walls tool, spawns, flags, hills and pickups with their tools, props, the Environment brush, Sky's
  backdrop, the card-shot camera, Export to `maps/verdant_protocol.json`. No map file is written or edited by hand or
  by a script.

## The plan (cells of 8 m: cell (x, y) is centred on world (8x, 8y); levels of 4 m; north is +Z)
Read from the reference: a loose ring of red-earth paths round a small walled concrete square in the middle; the
greenhouse lab top left, the command building with its masts top centre, the old watchpost tower top right on a
ruined wall, the crashed craft right of centre, low bunker doors in the hillsides round the edge; rock outcrops and
jungle between the paths.

- **Footprint:** terrain 256 × 192 m (x −128..128, z −96..96), 2 m grid; playable inside an invisible boundary of
  about 236 × 172 m. Large arena for 16-32 (the brief): 16 v 16.
- **Command building** (north centre): on a plateau one level up (3.85 m), a Server Vault as the operations room and
  Barracks beside it, masts and a dish on the plateau, a water tower; a plaza below it (level 0, medium range) with
  open stairs and a ramp up.
- **Greenhouse lab** (north-west): rooms with the glass facade, skylights and glazed windows, planters inside; its
  court to the south (medium range).
- **Old watchpost** (north-east): the map's one overlook: a rocky knoll two levels up (7.85 m), a Guard Tower and
  old walls on top. Up by a ramp from the command plateau, a ramp from the crash site, and climbing vines.
- **Crashed supply craft** (east): a broken fuselage you can walk through, a torn-off wing and the tail, made of
  tilted free blocks, in a gouge in the ground with its cargo spilled.
- **Underground quarantine bunker** (centre-south): rooms one level down (level −1) under a walled concrete yard
  (the reference's square in the middle), reached by short stairways in two low entrance huts on the yard's west and
  east sides; the **subterranean connector** is the passage under the yard between them (the yard above is open and
  exposed, the passage is the covered way across).
- **Edges:** a security post (Bunker Cluster) south-east, a lone Bunker west, the broken perimeter road round the
  outside, twisting dirt footpaths between the landmarks, foliage shortcuts through the undergrowth, rock outcrops and
  shallow dry gullies in the jungle (short range).

## Choices (the conservative option where it is the owner's call; questions in the report)
- **Scale and teams:** 16-32 players, 16 v 16, 32 team spawns (16 a side).
- **Modes:** Team Deathmatch (main), Capture the Flag and King of the Hill. Co-op is not offered (it needs NPC
  encounters and logic the brief doesn't specify).
- **Spawns, flags, hills, pickups:** the brief leaves them open and says not to draw them on the concept; the map
  can't play without them, so they are placed in the build and listed in the manifest.
- **Weapon set:** Military (a security compound), for the owner to confirm.
- **No vehicles** (the brief: no mandatory vehicles; none specified).
- **Theme:** Military Compound.
- **Foliage:** our species only, with the Environment brush (Jungle preset); no Kenney plants.
