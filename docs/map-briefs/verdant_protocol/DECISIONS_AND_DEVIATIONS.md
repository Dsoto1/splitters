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

## Layout as built (cells of 8 m; levels of 4 m)
- **Command building** (north centre, level 1 on the plateau at 3.85 m): Server Vault anchor (−1, 8), lobby door south;
  Barracks (1, 8) and (−3, 9); antenna masts, a dish, a water tower, floodlights, sandbags on the gravel plateau. Up from
  the plaza (level 0, x −24..24, z 24..44) by two Open Stairs (−3, 6) and (2, 6), and from the west by a graded ramp
  (x −60..−44, z 60..74); east by a graded ramp to the watchpost knoll (x 44..84, z 66..80).
- **Greenhouse lab** (north-west): eight Rooms (x −12..−9, y 5..6) open to one another inside, twin windows with
  breakable glass outside, skylights, doors west, north, east and a wide opening south onto the court; low planter
  cover in alternate rooms.
- **Old watchpost** (north-east): the knoll flattened to 7.85 m (x 84..118, z 60..86); a Guard Tower (12, 9) with its
  lookout 3 m up, two Courtyard (Ruins) tiles, broken walls, sandbags. Reached by the ramp from the plateau and a ramp
  from the crash site (x 100..114, z 34..62). The map's only high vantage.
- **Crashed supply craft** (east, x 64..104, z 12..38): eleven free blocks: a hollow cabin 16 m long you walk through
  (floor, sides with a torn gap, roof), the tail broken off and tilted with its fin, the nose crumpled into a rock
  outcrop, a wing propped up, the other half buried, an engine pod; cargo and fuel spilled along a dark-earth gouge.
- **Underground quarantine bunker** (centre-south): a walled Courtyard yard on level 0 (x −3..3, y −4..−1, half walls
  round its edge with three ways in, a Bunker set piece as the gatehouse on its north side, low walls across it for
  cover); under it on level −1 a Large Room (the ward: beds, drips, counters), two Rooms and three Corridors; Stairs
  huts at (−3, −2) (up west) and (3, −3) (up east), doorways at their tops. The ground under the yard is dipped to
  −1.5 m so the level −1 floors take it under them. Steady ceiling lights.
- **Edges:** a Bunker (−12, 0..1) west, a Bunker Cluster facing north at the south edge (cells −1..1, −9..−7), the
  gravel perimeter road in broken stretches along the west, south and east edges, red-earth (dirt) footpaths between
  everything, eight rock outcrops (4-7 m, stone), four low mounds, two dry gullies (−1.65 m), a rim raised outside the
  boundary.

## Deviations from the brief and the reference
- **Red earth:** MapMaker's ground has no red earth; the paths are its Dirt (a dusty ochre) and the gullies and the
  gouge its Dark earth. A red-earth ground would be a new terrain material (question 3).
- **The subterranean connector** is the covered way under the bunker's yard (about 48 m, west hut to east hut), not a
  long tunnel between distant parts of the map. A long tunnel under open jungle needs a floor over its whole length
  (terrain over a level −1 passage is cut into it by the slope where the ground is pulled under its floors), so it
  would be a paved strip three cells wide through the jungle (question 4).
- **The crashed craft** is built from free blocks (there is no aircraft wreck model): it reads as a broken fuselage
  and wings, boxy close up (question 5).
- **No climbing vines:** the knoll's and the outcrops' sides are slopes, not walls, and the one overlook already has
  two ramps; vines would add a second way onto the knoll the brief doesn't need.
- **The jungle** is our species with the Environment brush's Jungle preset (palms, acacia, laurel and broadleaf
  shrubs, ferns, grass clumps, mossy boulders), painted off the paths (dirt), the gullies and the open places, and
  kept clear of spawns and objectives by the brush. The backdrop's Forest wall border is pines and oaks, so the edge
  is a raised rim with no border (question 6).

## Questions for the owner (the conservative choice is built; numbered, multiple choice)
1. **Weapon set:** (a) Military, as built (a security compound); (b) Standard; (c) Mixed bag.
2. **Co-op:** the brief recommends it, but co-op needs NPC encounters and logic: (a) leave it off, as built; (b) add a
   co-op mission later (NPC squads in the bunker and the compound).
3. **Red earth:** (a) keep MapMaker's Dirt for the paths, as built; (b) add a Red earth ground to MapMaker's terrain
   paint (a new terrain material) and repaint the paths with it.
4. **The subterranean connector:** (a) keep the covered way under the bunker's yard, as built; (b) a longer tunnel to
   the west bunker under a paved service road three cells wide; (c) a rock tunnel at ground level through an outcrop
   ridge (Cave Passage tiles), as The Spillway's service tunnel.
5. **The crashed craft:** (a) keep the free-block wreck; (b) a crashed-craft model (generated on the owner's Meshy
   subscription) placed in its gouge.
6. **The map's edge:** (a) the raised rim with no border, as built; (b) a jungle Forest wall (the border choosing
   palms on grass in a jungle map: a small MapMaker change).
