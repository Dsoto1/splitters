# St. John's: the skyway, the clock tower and the stair door (step 14, a plan)

Options for the owner before anything is built (lane A, 2026-11-27). Nothing on the map has changed.
The owner's asks (OWNER_NOTES, "The skyway's dead end"): the tower half a tile out (more of it shows), the
skyway's back extended into the hall in front of the bathrooms, redundant doors removed, and the 7c double door
under the stair.

Pictures: plan cuts of the real map's geometry (main as of today), one storey each, the court at the top, with the
options drawn over them. In the lead's scratchpad, `skyway/`: `now_first.png`, `now_ground.png`, `A_first.png`,
`A_ground.png`, `B_first.png`, `C_first.png` (not committed: St. John's briefs keep no pictures in the repo).

## Where things stand

- Cells are 8 m and storeys 4 m. The skyway is the Carriageway's first floor at (1, -10), 4 m up. Its east wall
  (x 12) has been solid since step 10, when the tower moved onto (2, -10).
- The tower's Hall-floors stair lands at 4 and 8 m at its back corner, the one facing Welles's hall (z -84). The
  court door is 2.8 m wide at the east end of its court face.
- The bathroom hall is the 2.6 m strip of the Dorm Bay End at (2, -11) on floors 4 and 8 m. It is open to the
  north and the east and runs on into Welles's hall.
- The court walk passes 7.8 m in front of the tower.

## Can MapMaker place a set piece on a half cell?

**No.** A set piece's placement and every tile take whole cells (`x`, `y` integers in the schema). Only props,
blocks and lights take metres, and the tower is tiles.

- **The generic way, any map:** a "nudge half a cell" on set pieces and tiles. This is a format bump. About 20
  places build a tile's origin from its whole cell, and about 10 files check cells (overlaps, auto walls between
  neighbours, the minimap, the mirror tool), so all of those must handle half cells. MapMaker would get a Nudge
  field and gizmo support, plus tests and a MapMaker e2e. Size L (2-3 lane days), and the auto walls are the main
  risk. It still needs a new half-depth hall piece: a whole-cell room behind the tower would overlap it.
- **The piece way (recommended):** a new set piece **Clock Tower, forward**, two cells deep. The tower stands half
  a cell forward and the half cell behind it is a back hall, with floors at 4 and 8 m, closed at the ground and
  roofed at 12 m. The same stair lands on the back hall. It goes in the palette for any map, with no format change.
  Size S-M (about a day, with a coverage map entry and walks in setPiecesAcademy.test).

## What moving the tower half a tile out does

- **Court door:** it moves 4 m nearer the walk (3.8 m clear instead of 7.8 m). It is still on the court face, and
  the walk is unchanged.
- **Landings at 4 and 8 m:** the stair is unchanged, so they stay at the same heights. They now open onto the
  back hall, which meets the bathroom hall and Welles's hall flat at 4 and 8 m: no steps, so the navmesh stays in
  one piece. The tower's narrow east-side opening (0.6 m) now faces Welles's dorm wall and gets closed in the new
  piece.
- **Ground:** the back half is closed (solid), like (2, -11)'s ground floor. The Carriageway's ground passage stays
  walled on its east side.

## The skyway extension

It meets the bathroom hall at **4 m**, through the back hall, which in effect is the extension. The Carriageway
needs a new choice on its **East side** option: **Open** (the first floor's east wall goes, the ground floor
keeps its wall). The south half of that side then opens into the back hall, and the north half is the tower's own
stone wall. At 8 m the back hall links the tower to Welles's 3rd floor in the same way.

## Redundant doors (whole map checked)

The map has only **one** real door that swings shut, and it is the redundant one:

- **The Carriageway's west door** (`setpiece_khjt0z69qh`, its part 2) at (4, 0, -80), cell (1, -10), west side,
  under the skyway. It stands back to back with the Stair End Bay's propped-open door at (2.83, 0, -80)
  (`setpiece_a3c0dpzi2u`, (0, -9)). Removing it needs no kit change: MapMaker can leave a set piece's part out
  (`overrides.hide`). This also removes one place where bots get stuck at doors.
- No other pair of doors on the map stands within 2.6 m of each other. Every other door is a prop, propped open,
  ajar or shut on purpose (the shut dorm rooms).

## The 7c double door

The door in the owner's screenshot is the first-floor door of the Stair End Bay at (0, -9), into the skyway's
west end, at (3.25, 4, -77.3). Its west end is the only stair-bay skyway end left, because step 10 took Welles's
west stair. The work is the PLAN 4l change: a Stairwell with its upper flight open underneath, and the bay's
door wall widened to 3 m. It is set on (0, -9) first.

## Three layouts

- **A (recommended), back hall:** the tower goes half a tile out (Clock Tower, forward). The skyway runs on
  through its opened east side into the back hall, then into the bathroom hall and Welles. The 7c double door goes
  at the west end and the Carriageway's west door is removed. Pictures: `A_first.png`, `A_ground.png`.
- **B, lane bay:** the tower goes out the same way, and its back hall serves the tower only. The skyway instead
  gets a new half-cell bay hung over the lane at (1, -11), opening into the bathroom hall's west end. That uses
  the Dorm Bay End's existing End: Door option, on the first floor. The lane gets a covered arch, but this needs
  more building and draw calls, two links instead of one, and adds nothing at 8 m. Size M. Picture: `B_first.png`.
- **C, a whole tile:** the tower goes back to (2, -9), as before step 10, and plain MapMaker rooms fill (2, -10).
  The Carriageway's east door comes back upstairs only, which needs a small option split. It needs no new tower
  piece, but it is more than the asked half: the tower's front then sits at the walk's edge, and the 0.6 m
  corner opening at 4 and 8 m faces a drop and needs a rail. Size S. Picture: `C_first.png`.

## Open questions (picks marked)

1. How to place half a tile: **(a) the Clock Tower, forward piece** (pick) / (b) a generic half-cell nudge in
   MapMaker for every map (L, format bump) / (c) a whole tile (layout C).
2. Layout: **(a) A** (pick) / (b) B / (c) C.
3. Under the skyway: **(a) remove the Carriageway's leaf and keep the propped door** (pick) / (b) keep the leaf and
   drop the propped door / (c) keep both.
4. The back hall's ground floor: **(a) closed** (pick) / (b) a store room off the Carriageway passage / (c) a door
   onto the lane.
5. The 7c double door: **(a) on (0, -9) in this step** (pick) / (b) on every Stair End Bay with that door
   (DeKoven south, Welles east) / (c) later.

## Owner's answers (2026-11-27)
1. The new **"Clock Tower, forward"** set piece (two cells deep, the tower half a cell out, a back hall behind), in the palette for any map; no format change.
2. **Layout A**: the skyway runs on through the Carriageway's opened east side into the back hall, then the bathroom hall and Welles, at 4 m and 8 m.
3. **Remove the Carriageway's swinging west door** (`setpiece_khjt0z69qh` part 2, `overrides.hide`); keep the propped one.
4. Back hall's ground floor: not asked (default: closed).
5. The **7c double door at the skyway's west end** (Stair End Bay at (0, -9), first floor), in this step.

## As built (2026-11-27, `wip/stjohns-14`)

- **Clock Tower, forward** (`setpiece.clock_tower_forward`, tile `gothic.clock_tower_forward` in map/packTiles2.ts,
  1 x 2 cells, Towers in the palette): the Clock Tower with Hall floors moved 4 m south over its front cell, its
  landings at 4 and 8 m opening onto a back hall (the back cell's north half: solid to the 4 m floor, a floor at 8 m,
  a roof at 12 m, walled west to 1.2 m short of the north edge, where a Dorm Bay's hall comes in, and east over 8 m;
  its first floor's east side the piece's option: Wall, or Open). The hall opening runs over the stair's top step
  (to x -0.72: through the 0.5 m wall the 2.2 m opening left the navmesh too narrow a way). The tower's 0.6 m west
  slot is closed. Walks: setPiecesAcademy.test.ts, "the clock tower, forward" (alone: the landings and the back hall;
  in Welles's west end: the court door to both landings, the back hall, the bathroom hall and Welles's hall at 4 and
  8 m, the skyway through into all of them and down the tower, the perch, the passage below).
- **The Carriageway's East side: Open**: the ground floor walled, the room over the arch open east.
- **Placed** (steps-14.json, the MapMaker driver: Delete, the Set pieces tab with R and a click, the inspector's
  Options and Parts): the Clock Tower (`setpiece_y05akewn0t`) out; the Clock Tower, forward (`setpiece_cv0hpwxrs1`)
  at (2, -9) turned half round, East Open; the Carriageway East Open and its West door (part 2) unticked. Coverage
  map: the new piece at (4, -49).
- **Checks:** validate-map 0 issues; nav-audit 0 traps, 46 islands; on the map as played bots path from the court to
  both landings, the back hall, the bathroom hall and Welles's hall at 4 and 8 m, the skyway to the back hall, to
  Welles and to the stair bay, the perch, and through the passage below.
- **The 7c double door, built (2026-11-28, `wip/stjohns-7c`).** The tile `core.stairwell_open_under` (Stairwell
  (open under), Vertical): the Stairwell with its upper flight's top five steps on a floor of their own 2.75 m up, the
  three low steps solid. The Stair End Bay (3 floors)'s First-floor door choice **Double door**: that stairwell in place
  of the plain one, the door in the outer wall 3 m wide (bay z 4.55 to 7.55, 2.6 m high), two new kit doors standing
  open into the bay, **Slim Oak Door (open, double, right leaf / left leaf)** (`kit.door.oak_slim_open_pair`,
  `kit.door.oak_slim_open_pair_left`), meeting with no post between them. The door generator's settings are generic:
  `hinge` (`right`, as before; `left`: the door mirrored, its collision too) and `pair` (no post on the latch side). Walks: `packages/shared/test/stairDoubleDoor.test.ts` (bots both ways under each leaf, a
  straight path through, the stair from the skyway up and down; a body through under each leaf both ways; the
  doorway clear and 2.6 m high; nothing west of the wall). Placed through MapMaker
  (`steps-7c-door.json`: the bay `setpiece_a3c0dpzi2u`, First-floor door Double door); coverage map: the tile at
  (19, -5). validate-map 0 issues; nav-audit 0 traps, 46 islands; on the map bots path straight through under both
  leaves both ways (about 5 m for 5 m), the back hall to the top floor and the lobby to the back hall.
