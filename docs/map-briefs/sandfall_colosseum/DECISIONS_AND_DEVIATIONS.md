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

## Choices
- (filled in as the build goes)
