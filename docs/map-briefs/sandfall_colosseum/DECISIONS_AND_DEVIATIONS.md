# Sandfall Colosseum: decisions and deviations

## How it is made
- In MapMaker only (CLAUDE.md, "Maps"): a scratch Playwright driver (not in the repo) works the real MapMaker of a
  `vite preview` build the way a person does: Import (to keep the map's id, name and settings), a drag-box and Delete
  on every level to clear the old map, the Logic tab's delete buttons for its rules, Terrain → Create terrain, the
  Terrain tab's brushes held over the ground, the palette's cards clicked where they are and the pointer clicked on the
  map where the ghost is green, R to turn, PgUp/PgDn for the level, the inspector's fields, Map properties, and Export
  to `maps/sandfall_colosseum.json`. No map file was written or edited by hand or by a script.
- What MapMaker lacked was added to it for every map, small and tested (below).

## Scale (the brief's "agree the cell size")
- **4 m per board square** (owner, 2026-11-05), on MapMaker's standard grid (8 m cells, 4 m levels): a board square is
  half a cell (docs/SET_PIECES_PLAN.md, "The 4 m question"). The 13 × 13 board is 52 m across, laid centred on the cell
  at the map's origin inside a sand floor of 7 × 7 cells (56 m; a 2 m margin to the podium wall all round).
- Why it reads as an arena at FPS height: a player's eye is 1.6 m up, so 52 m of sand is about 30 body lengths, a
  Roman arena's proportions at about two-thirds the Colosseum's 83 × 48 m; the 2 m podium wall is over head height (you
  can drop from it, not climb it), and the stands rise 7 levels (28 m) behind it.

## Layout (cells of 8 m, x east, y north; levels of 4 m)
- **Sand**: cells x, y = -3..3 at level 0 (Courtyard tiles: the floor is a tile so the hatches can open through it).
  The board's pillars, medallions, hatches and zones on the 4 m lattice (see the manifest).
- **Stands**: four sides of seven radial lines each (N and S: x = -3..3; E and W: y = -3..3), each line from the sand
  outwards (depth 4 to 10): Arena Bay (Podium) at depth 4; Grand Arcades at depths 6-9 under the tiers (two storeys
  each), the Upper Tier at depth 6 on level 2, the second Upper Tier (a Vomitorium on every other line) at depth 8 on
  level 4, the facade's Grand Arcades at depth 10 on levels 0, 2 and 4, and the Attic on level 6: seven storeys, 28 m
  to the attic walk. Stand lines are 13 placements each.
- **Gates 1-4** at the board's corners: the end lines of the north and south stands (x = ±3) have the Gladiator Gate
  tile instead of the podium bay and a Grand Arcade behind it, a passage straight out under the stands.
- **Emperor's box** (owner: it must come back): the north stand's centre line, the podium bay exploded and its seating
  swapped for the Emperor's Box tile, facing the main entrance across the sand.

- **Corner courts and towers** (the seating chart's dark corner squares): the stands are straight, so the corners
  between them (7 × 7 cells each) are open courts at ground level, each with a Stair Tower (8 levels) against the end
  of the north or south stand (its hall's arches open into the stand at every level and into the court), a stair down
  into the hypogeum, and paving over the ring's corner. Filling them with arcades would have doubled the collision
  boxes (see "Budgets").
- **Gates** are passages straight out from the sand under the stands (the Gladiator Gate tile, then Grand Arcades to
  the facade), at the board's corner squares' columns (x ±24 m). The main entrance from the village is the south
  facade's arcade behind the triumphal arch, with the south tunnel's stairs beside it.

## Choices
- **Built in pieces, through MapMaker's own tools.** On this machine (4 shared cores, load 7-13, SwiftShader) the
  driven MapMaker takes 60-80 s a placement on the full map. So: the north stand was placed line by line (93 pieces),
  then selected (a drag box per level), duplicated (Ctrl+D), turned (R) and moved (the arrow keys) for the south, east
  and west stands; the hypogeum and the sand, and the village, were built in a blank MapMaker map, saved as set pieces
  (Save selection as set piece), placed in the colosseum and exploded to ordinary tiles. Everything stays editable as
  ordinary tiles, set pieces and entities.
- **The ground under the hypogeum.** Terrain is a height grid: a tunnel under it is roofed by the ground unless the
  ground is pulled down under the tunnel's floor (within 3 m, settle.ts). Where pulled-down ground met ground left at
  −0.15 m, the terrain sloped through the tunnel and closed it (the nav audit found the ring cut off). So the ground over
  the whole hypogeum (the sand, the ring, the four branches out to the facade) is flattened to −1.5 m: it all goes
  under the tunnels, and it is hidden under the sand and the stands' floors. The ring's corners lie under the open
  courts, so each has a Platform tile over it (paving at ground level).
- **Stairs out**: Open Stairs (one level) in cuts flattened to −4.4 m, at the four ends of the branches (beyond the
  facade, in the ring street) and in the four courts.
- **Pillars**: the Ionic Column at 1.6× (2.1 m thick, 9.6 m tall), so it is cover to fight round, not a post.
- **Modes and teams**: TDM first, CTF and King of the Hill offered (the owner's answers); Deathmatch is no longer
  listed. 12 v 12, 8-24 players: the map is far bigger than the old one (a 168 m colosseum, the village to ±120 m).
- **Volcano**: a backdrop scenery (Hills and a volcano), not terrain: a terrain is at most 400 m across, so a volcano
  in it could not be "in the distance". It stands far north, behind the emperor's box, seen from the village square
  over the colosseum.
- **What the old map had and this one doesn't** (the owner may want some back): the lift cages and the beast lift
  through a logic trapdoor, the portcullis main gate worked from a winch, the hypogeum portal to the forum, the
  aqueduct. See the report's questions.
- **Foliage** (owner, 2026-11-08): the foliage layer only (Grassy on the grass past the village); no prop plants.

## Budgets
- 432 tiles, 367 set pieces (as placed), ~31,800 collision boxes (shipped maps: 2,700-3,900; the stands are most of
  it: 772 a radial line), lights 253 of 256 (the stands' bays and the hypogeum's torches: no room for braziers).
- Server tick (bench, 24 bots, TDM, load 13): avg 3.9 ms, p95 10.3 ms (budget 16.7). Navmesh build 8-15 s.
