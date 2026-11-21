# St. John's: placing the mess hall (step 7d, after 7c lands)

The pieces are built (PLAN 4l, "Step 7d kit as built"; CONTENT_PIPELINE, "The mess hall's kit"). This page says which
piece with which options goes at which of Welles's cells to make the owner's sketch (OWNER_NOTES_2026-11-21, "The
mess hall's layout"). It is done in MapMaker (Import, the Outliner's search and a click on the row, the set piece
inspector's Options, Delete, the Set pieces tab, Export): never by editing the file.

## Where things are

Welles's ground floor is cells x 2 to 9 on rows -11 (south, Exeter Street) and -10 (north, the court): a Stair End Bay
at x 2 and at x 9, six Refectory Bays at x 3 to 8, each placed at (x, -11), unturned, not mirrored. A bay's own frame:
x along the hall (west to east), z across it; its anchor cell is the south one. World x of a bay's middle is 8 × cell;
the hall's south wall is z -92, its north wall z -76. The owner's sketch has the court side at the bottom and the
kitchen at the left: **left is east, right is west, bottom is north**. The clock tower stands at (2, -9), north of the
west Stair End Bay; DeKoven's lobby door is in the north wall at x 40 (cell 5).

## The six bays

Every bay: **Floor Sunk 0.5 m**. The four hall bays also: **Ceiling Timber beams, Side aisle Arcade south, Chandelier
Two with pale bowls, Flags Hung along both sides**. Options not named stay as they are.

| Cell | Today (id) | Becomes | Options to set (besides the above) |
|---|---|---|---|
| (3, -11) | Refectory Bay `setpiece_8zgwaep49q` | the same placement | Furniture **Rows of mess tables**; West end **Fireplace and drink stations** |
| (4, -11) | Refectory Bay `setpiece_on14jx8cor`, Main entrance north until 7c moves it | the same placement | Furniture **Rows with a podium** (the lectern and bell on the north wall, the middle of the hall as drawn); Long walls as 7c leaves them (Arched windows once the entrance has moved) |
| (5, -11) | Refectory Bay `setpiece_7j8uomeg8s`, Doors both sides | the same placement | Furniture **Rows with a cross aisle** (the aisle runs from DeKoven's lobby door to the street door); Long walls: see "The south door" below |
| (6, -11) | Refectory Bay `setpiece_wqaqvgkrko` | the same placement | Furniture **Rows of mess tables** |
| (7, -11) | Refectory Bay `setpiece_swcuia16jz`, Fireplace south | **delete it**; place a **Refectory Serving Bay** at (7, -11), unturned | Floor Sunk 0.5 m; Ceiling Timber beams |
| (8, -11) | Refectory Bay `setpiece_9igcntaxz3` | **delete it**; place a **Refectory Kitchen** at (8, -11), unturned | Floor Sunk 0.5 m; East end **Back door** (onto the east Stair End Bay's mouth) |

What that gives, against the sketch:

- **Kitchen far left (east), the full depth; the line next to it.** The kitchen is cell 8; the serving line stands in
  cell 7, 3 m from the kitchen's wall, its counters from the north wall to 4 m short of the south wall; the kitchen's
  doorway is behind the line. Coming in from DeKoven (x 40) the line is to the left and the kitchen behind it.
- **Main hall: four rows, two tables a row with a gap.** The rows run from x 24 to x 36 (three tables) and from x 44
  to x 52 (two tables), with the cross aisle at x 38 to 42 between them, on the lobby door. Tables are 3.9 m; a row is
  0.76 m wide; the four rows are evenly spaced with three aisles of 2 m between them (what bots need), the middle
  aisle on the fireplace.
- **Second seating area past the rows, behind pillars with small arches.** The arcade runs the length of cells 3 to 6
  at z -88, 4 m from the south wall; small tables turned the other way stand in the aisle, two a bay (none in cell 5
  if it keeps its south door). Bots do not go into the aisle's bays between the small tables (too narrow for them):
  put no pickup there.
- **Drink stations on the far (west) end wall by the clock tower; the fireplace there too** (photos 6 and 7 show the
  fireplace, the portrait and the two tall windows on that wall): the fireplace in the middle of the main hall's end,
  a drink station before the panelling either side of it.
- **Podium against the north wall about the middle of the hall:** in cell 4, by its pier.

## Things to settle when placing

- **The west end and the clock tower.** The fireplace wall closes the hall's west end, so the west Stair End Bay's
  mouth no longer opens into the hall (its stair is still reached from its own lobby door). 7c gives the clock tower
  "a way into the mess hall": if that way is through the west Stair End Bay, the fireplace wall shuts it. Then either
  (a) give cell 3 Long walls **A door north** (a round arch in the court wall at x 24, 8 m from the tower's door; the
  furniture there becomes Rows with a cross aisle), or (b) keep the west end open with West end **Steps up** and put
  the fireplace on a long wall (Long walls Fireplace north or south: the older block fireplace, no portrait). (a) is
  recommended: it keeps the photos' end wall.
- **The south door (cell 5).** With the arcade, a round-arched south door faces the arcade's middle pier 3.5 m inside
  (walked round either side). Long walls **Main entrance south** (the twin arches) lines up with the arcade's two
  arches instead and changes the street front; or the south door goes (Long walls A door north) and Exeter Street is
  reached by the stairs' lobbies. Owner's call; the walk tests pass with any of the three.
- **The two pickups in the hall** stand on the old floor: `pickup_2876` (burst rifle) at (44, 0, -84) would be in a
  table, and half a metre over the sunk floor: move it (the inspector's X / Height / Z) to (40, -0.5, -82.3), the
  cross aisle; `pickup_2877` (health) at (66, 0, -84) to (66, -0.5, -84), the kitchen floor.
- **Fit the ground:** not needed. The Sunk Rooms cut the ground out of their own cells and bring it to the doorways'
  level round them (checked on St. John's 2.5 m grid and its ground 4 cm over the floors).
- **Budgets:** the hall as above adds 17 prop models to the map (13 new ones of this kit, and four the kit had that
  the map does not use yet: Stove, Fridge, Kitchen Cabinet, Shelf End; 74 becomes 91 of 120, before step 8's) and takes
  none away unless the old Long Table, Bench and Chandelier are used nowhere else; 7 lights where there are 6 (one a
  bay as today, and the hearth's). Run `pnpm validate-map maps/st_johns.json`, `pnpm nav-audit st_johns` and the
  routes of PLAN 4j and 4k again; measure the mess hall's views (PLAN 4l has the scratch hall's numbers).
- **Check after placing:** in at every door and down its step; the lanes end to end; DeKoven's lobby door to the 2nd
  floor and back (PLAN 4k's route); the stair from the east lobby through the kitchen's back door.

## Not in this placement

- A raised landing at the DeKoven end (photo 7 is taken from one): the hall is one storey, so there is nothing to
  stand on a storey up; see PLAN 4l, "How tall the hall reads".
