# Building kit, materials and props

Everything here is data in `packages/shared` and works in MapMaker, offline
matches and the dedicated server alike.

## MapMaker's modes, panels and outliner (MapMaker overhaul Phase 2)

- **Mode tabs** (top bar; `client/src/editor/editorModes.ts`): **Build** (Tiles, Set pieces, Walls), **Props** (Props,
  Lights), **Gameplay** (Gameplay, NPCs, Vehicles, Objects: the old Entities tab), **Logic** (the rules panel),
  **Environment** (Paint, Nature, Terrain, Sky), **Paths** (roads, streets, trails and walkways, the track for NPC traffic,
  AI routes and the drop routes; they were in the Terrain pane and the Vehicles tab) and **Test** (Play test, Play from
  here, the bot test, the plan view, the problems list; picking Test no longer plays at once). Every palette pane is in
  one mode; a card picked from search, favourites or by its key moves the tabs to its mode. With nothing selected the
  inspector starts with the mode's own section (Paths: the map's paths; Test: ready or not, its first problem, spawns and
  pickups; Gameplay: counts of spawns, objectives, pickups, NPC squads and vehicles), then Map properties.
- **Folding panels:** the side panel's Outliner, Inspector and Validation fold from their headings; the palette's groups
  fold from theirs; Backslash and Shift+Backslash fold the whole palette and side panel. All of it stays as each person
  left it (this browser's storage).
- **Outliner** (side panel; `client/src/editor/outlinerPanel.ts`, the list's rules shared `editor/outliner.ts`): every
  tile, set piece and entity, grouped by kind and, inside a kind on several levels, by level. Search matches names, kinds
  and ids (every word). A click selects and frames (Shift adds), moving to its level. The eye hides a thing from
  MapMaker's view (not picked either); the padlock keeps it from being picked or selected. Hide and lock are kept per map
  in this browser and never go in the map file: a test match and the game play everything. The list draws only the rows
  in view, so a map with 4,096 things stays quick.
- **Favourites and recent:** the quick row over the palette puts the current mode's favourites (or recent pieces) first
  and the rest after; **This mode only** shows just the mode's.

## MapMaker's first-time tour (MapMaker overhaul Phase 6)

- The first time someone opens MapMaker a small card over the view walks them through a tiny map with the real tools:
  **place a room** (Build, the Room card), **add a spawn** (Gameplay, Player Spawn), **add a pickup** (Health (Small)),
  then **try it out** (▶ Here or ▶ PLAY TEST). The button or card to use has a steady yellow ring; until you're in the
  right mode, the mode tab has it. Each step moves on when you do it (the edit going into the history, or the test
  starting); an undo never counts. A new map already has a room and a spawn, so the tour asks for one more of each.
- **Skip tour** or **Esc** ends it at any step; it never blocks editing. Done or skipped, this browser remembers it
  (`localStorage` `tiletrigger.editor.tour`). **Take the tour** in the `?` key list starts it again.
- Steps and wording: shared `editor/tour.ts` (`TOUR_STEPS`); the card: `client/src/editor/tour.ts`. Browser tests
  (`?test=1`) never see it unless they add `&tour=1` (e2e `editorux` → `editorTourChecks`).

## Pieces (`content/tiles/core.json`, built by `map/catalog.ts`)

The core kit's tiles and the edge styles below are data in `content/tiles/` (how to add one:
docs/CONTENT_PIPELINE.md, "Tiles and edge styles"); the Style Pack tiles further down are drawn in code.

50 tiles in six palette groups (and the city and Style Pack pieces). Multi-cell pieces build no walls inside
themselves; partial floors (balconies, decks, ledges) are painted like floors.

| Group | Pieces |
|---|---|
| Rooms | Room, Pillar, Columns, Low Cover, Dais, Raised Ledge (1.5 m), Split-Level (1 m), Sunken Room (1.5 m pit), Tall Room (two storeys) |
| Large | Long Room (1×2), Large Room (2×2), Great Hall (3×3), Atrium (2×2, two storeys, balcony all round), Plaza (2×2 open), Grand Gallery (two storeys of grand arches) |
| Corridors | Corridor, Clear, Windowed, Long (1×2), Corner, T, Crossroads, Dead End, Bridge, Catwalk Corner, Vaulted Tunnel (+ Bend, Junction, Crossing) |
| Vertical | Stairs, Stairwell (switchback, doors on both floors), Long Ramp (2 cells), Open Stairs, Watchtower, Grand Flight (2 cells wide), Seating Tier (+ Vomitorium) |
| Open | Courtyard (+ crates, low wall, ruins), Platform, Platform with railings, Terrace, Sunken Trench (+ Bend, Junction, End), Corner Hatch |
| Special | Pit (to the level below, or a fatal fall), Drop Shaft |

Every climbable piece is tested for bot paths in all four rotations
(`test/kit.test.ts`). Stairs use 0.25 m steps with at least 0.45 m runs
(narrower runs fall foul of the navmesh's ledge filter), and flights need
clear space at both ends.

## Walls and openings (edge styles, `content/tiles/edges.json`)

Any side of any cell can be built as: Auto, Solid wall, Doorway, Wide doorway,
Archway, Segmental arch (a shallow stone arch 5 m wide, springing at 2.7 m and
rising to 3.3 m, voussoirs and a keystone dressing it on both faces: a
carriageway's ends), Round arch (a Roman arch 3.2 m wide, a semicircle springing
at 1.4 m to 3 m, under a vaulted ceiling's springing), Grand arch (two storeys:
a 4.4 m arch springing at 4.6 m, piers 0.8 m thick, half columns and an
entablature outside: the colosseum's arcades), Window, Twin windows, Firing slit,
Embrasure (a casemate's gun port: a slot 3.5 m by 1.1 m through a 1 m concrete
wall, a visor and stepped cheeks outside), Half wall, Railing, High wall,
Towering wall, Tall fence, Broken wall (a ragged hole with rubble), Bars
(floor-to-ceiling, see and shoot through), Barred gate (bars either side of a 3 m
gateway: hang a Portcullis door in it), Shutter (a wide opening with its
shutter stuck 1.35 m up: crouch under; bots don't path through it) or No wall.
Use the **Walls & Openings** tool (O cycles styles; right-click resets) or the
tile inspector. Choices are stored on the tile in its own frame (they turn with
it) and apply to both halves of a shared wall.

### Glass (glass panes)

Windows can hold real glass. Window, Twin windows and Firing slit sides take a
**Glass** setting (the select under the wall styles in **Walls & Openings**:
*Glass: none / breakable / reinforced*; stored per side in the tile's `glass`,
`MapBuilder.glass(x, y, z, side, kind)` in map scripts). Free blocks take the
same choice as their material (**Glass** in the block inspector, or the
**Glass Panel** and **Bulletproof Glass** pieces in the scenario palette; a
glass block can be as thin as 5 cm).

| | Players | Sight (players and bots) | Shots and grenades | When hit |
| --- | --- | --- | --- | --- |
| Breakable | stopped | through | through, breaking it | shatters (shards, glass sound); back next round, or after the map's **Broken glass returns** time (Map settings, `glass.respawnSeconds`) |
| Reinforced | stopped | through | stopped | cracks and frosts over (crack sound); never breaks |

- **Simulation** (`sim/glass.ts`): panes are scenario breakables. Window panes
  follow the map's entities (pane *k* is scenario index
  `entities.length + k`, see `windowPaneIndex`), glass blocks keep their
  entity index, so the broken and cracked state travels in the ordinary entity
  states and `broken` / `crack` events, and logic can destroy or rebuild a
  glass block like any block. Colliders use their own physics groups:
  movement queries hit every pane, shot queries (`raycastHit`, `raycastNormal`)
  hit only reinforced glass, and sight (`raycastWorld`, `lineOfSight`) hits
  none. Hitscan shots, pellets, piercing rounds and projectiles break the
  breakable panes they pass (`Scenario.shootGlass`); blasts break them too.
- **Bots** see through all glass, path round intact panes (they are blockers
  until broken) and through the window once a pane is gone.
- **Rendering** (`client/src/game/glassVisuals.ts`): every pane in play
  (window glass, glass blocks and the older *Window pane* destructibles, with
  its cross frame) is a thin instance of one box in one shared material per
  tint: a slight sea-green tint, clear face on and more opaque towards grazing
  angles (Fresnel opacity), a little darker and greener at each pane's rim (a
  64 px edge texture made in code, like the thickness of float glass seen at
  its edge), a Fresnel reflection of the map's sky picture (about 6 % face on,
  a mirror at grazing angles; it shares the backdrop's texture, at the sky's
  own brightness, so night glass stays dark) and a sharp specular glint. No
  render targets, on any graphics setting. Panes are grouped in 32 m squares
  (one mesh per square and tint), so the transparent pass sorts glass against
  water and effects square by square and squares out of view are culled. A
  round that stops on a pane (bulletproof glass, or a Window pane about to
  break) leaves a star crack with a punched hole where it struck (one
  thin-instanced decal mesh, up to 192, cleared when the pane is whole again
  or gone) and a few glints; bulletproof glass also frosts as it cracks (whiter,
  more opaque, per-instance colour). A pane that breaks drops out (zero scale)
  and throws 6–16 flat, see-through shards spread over its whole face, falling
  mostly straight down (effects physics, like debris). Glass blocks a mover
  carries are drawn one by one in the same material; MapMaker draws window
  glass instanced and entities on their own.
- **Validation**: glass on a side with no window (`glass.edge`) and glass on a
  block that isn't plain solid (`glass.block`) are warnings.

Converted maps: *Glasswork Office* and *Riot Junction* (window edge glass),
*Fallout Lane* (glass blocks, which its nuclear-test logic still blows in) and
the *Training Range* (its glass penetration panel and the water tank's walls are
breakable glass blocks, back 4 s after they are shot out, and a bulletproof
panel stands after the tank). The older *Window pane* destructible still works
for maps that place panes by hand, and is drawn with the same glass.

### The showpiece kit (set pieces part 3)

Pieces made for MAP 21 and the Sandfall Colosseum (docs/SET_PIECES_PLAN.md, "As built: part 3"); any map can use them.

- **Sunken Trench, Bend, Junction, End:** a trench 1.5 m deep that carves the terrain (its floors pull the ground
  under them down: place it on level 0 over ground at level 0). A 4 m channel, revetted walls (the walls slot: timber
  or the Sandbags material from a set piece, the theme's walls on their own), duckboards, a fire step 0.75 m up under a
  0.6 m sandbag parapet (it stops 0.8 m short of the cell's ends), a low parados behind; the Bend has its step and
  parapet round the outside, the End timber steps up and out. Standing in the channel your head is under the parapet;
  on the fire step your eyes clear it; crouched you are hidden. Needs terrain: on a flat map use the raised Military
  Compound trenches.
- **Grand Flight:** a stair two cells (15.2 m) wide climbing one level, stepped parapets along both sides, nosings on
  the steps (the trim slot).
- **Seating Tier** and **Seating Tier (Vomitorium):** eight rows of seats 0.5 m high and 1 m deep rising one level, an
  aisle stair 2.4 m wide up the middle (rows are ledges to the bots' navmesh: they climb by the aisles); the vomitorium
  cuts a 3.2 m passage under its top rows from the gallery behind out to the walkway in front, broad stairs either
  side. Seats in the solids slot, a lip on each row in the trim slot.
- **Grand Gallery:** two storeys of vaulted gallery, a Grand arch in each long side, its ends and upper storey open,
  so a row of them is an arcade; stack them for the colosseum's facade. Set the Grand arch on a side two galleries
  share (ports meeting build a doorway otherwise).
- **Vaulted Tunnel, Bend, Junction, Crossing:** a 3.6 m passage between masonry under a barrel vault (2.2 m to 3.28 m),
  groin-vaulted where two cross, a drain down the middle. No walls of their own at their sides: what is built beside
  them builds its own.
- **Side walls** (the tile inspector's Options, on any vaulted tunnel, one or several selected): the tunnel's masonry
  rises to a kerb 0.25 m under the level above, and the ground on its closed sides stays up at that kerb instead of
  banking down to the passage (where a tunnel runs under open ground, or out into a cut, you see masonry, not a slope
  of earth). It is the tile "Vaulted Tunnel (Side Walls)" (and Bend, Junction, Crossing): the palette shows only the
  plain ones, and the checkbox swaps between them in one undo step, keeping paint and walls. The ground over the
  passage itself must still be within 3 m of its floor (Flatten it), as for the plain tunnel.
- **Corner Hatch:** open floor with a quarter of a 3.2 m hatch at its north-east corner: four round a corner open a
  hatch on it (a 4 m board square on a cell corner).
- **Sandbags** (material): our own procedural paint, bags 0.6 m by 0.3 m in stretcher bond.

## Set pieces: the Set pieces tab (format v27)

A set piece is a structure of several cells placed as one: a carriageway through a hall, a skybridge, a casemate, a
stand of the arena, a trench run (docs/SET_PIECES_PLAN.md). In play it is ordinary tiles, blocks, props, doors and
lights; in MapMaker it stays one thing you place, select, turn and theme until you explode it.

- **The tab** (Build → Set pieces): every shipped piece, grouped by family (Carriageways, Skybridges, Casemates,
  Trench runs, Cliff stairs, Stair towers, Arena stands, Hypogeum, Insulae, Landing craft, Forts, and part 5's Power
  core halls, Reactor rooms, Server vaults, Loading docks, Atrium towers, Catwalk bridges, Overlooks, Ramp junctions,
  Courtyard gates, Bunker clusters, Sunken arenas, Plazas and Sea walls), pictured from the palette
  atlas (`thumbs/setpieces.*.webp`), then **My set pieces** (your own, and the map's own that came with it). Search
  finds pieces by name; the **Style Pack** picker narrows the tab to the pieces made for that pack's look.
- **Placing:** pick a piece, then click the map. A see-through **ghost of the whole piece** follows the pointer in its
  real materials, its footprint and ports outlined **green** where it fits and **red** where it doesn't; the hover
  card and the status line say **why** (it overlaps a tile or another set piece, it's past the build limit…). **R**
  turns it (quarter turns), **M** mirrors it (east and west swapped over the same cells); a piece that can't be
  mirrored greys out M and says why (a tile in it isn't its own mirror image: turn it instead). PgUp/PgDn pick the
  level (a skybridge goes on level 1 or 2). The panel over the tab shows the piece, its size and levels, and its
  **Look**: the map theme's (Castle Keep gives Collegiate Gothic), a look made for it, or any other; picking a Style
  Pack picks that pack's look. A placed piece keeps its look.
- **Selecting:** a click on any part of a placed piece selects the whole placement (its footprint outlined). It
  moves (drag, arrows, Shift+PgUp/PgDn), turns (R), mirrors (M), duplicates (Ctrl+D) and deletes (Del) as one, each one
  undo step. The **inspector** shows the piece and its family, its **Look**, **Mirror**, X / Y / Level and turn, its
  **ports**, and the **overrides**: a role's material (Stone, Trim, Floor, Paving, Roof, Wood, Metal; the facade, the
  doors' style, the glass) for this placement only, and its **parts**, each with a tick: untick one to leave it out.
- **Ports** (where a piece meets what's round it: its doors and openings) are drawn on the ghost's and the selected
  piece's outline: a door frame and an arrow out, blue for a door, green for an opening, **red and crossed where a wall
  stands in it** (a tile's wall or window, a block: MapMaker looks just outside the port, at waist to chest height),
  grey where the piece's own wall shuts it (a side left automatic, with nothing built against it). A port in a wall is
  a warning in the inspector and the issues list: open the wall (the Walls tool, or cut the block), or move the piece.
- **The ground and the overlaps check:** placing or moving a piece lowers the terrain under its floors at once (a
  sunk trench carves its slot), the same as the map does when it loads; moving or deleting it gives the ground back
  (MapMaker keeps the ground you sculpted and works out the ground under floors from it, after every edit). MapMaker's **Overlaps** warning leaves a
  piece's own parts out: it points only at your blocks flush with a piece in another look.
- **Ground and floors (MapMaker fixes 2, 2026-11-09).** The worked-out ground (settle.ts `terrainUnderFloors`, never
  stored) does two things:
  - **Under a floor** it lowers the ground within 3 m of the floor's top (`FLOOR_REACH`). Deeper ground is kept: a hill
    a floor is buried in stays. That is on purpose: shipped maps hold floors the hill is meant to cover deeper than
    3 m (Sandfall's hypogeum rooms; the top of every flight cut into a terrace on Sunken Kingdom, Iron Coast and
    Whiteout Station, where the ground the flight arrives on is 4 m over its floor; Eagle Spires' stepped blocks), and
    a height grid can't tell those from a tunnel's cut. Measured: lowering deeper in general would have changed those
    six maps, opening pits up to 27 m deep. For a tunnel's cut or a sunken yard, select its floors and use **Cut
    ground to floors** (the selection menu): it lowers the map's own ground under them, however deep, one undo step
    (then roof the cut with a free block if it is a tunnel).
  - **At a step's foot** (a flight's first step, a kerb: a solid no taller than a player steps up) it brings ground a
    little under the step (up to 0.6 m) up to 2 cm under the step's base. New terrain sits 0.15 m under a level and a
    flight's first step is 0.25 m up: before, that 0.4 m lip stopped bots and players at every flight rising from the
    ground, and its foot had to be flattened by hand. No need now.
- **Explode to tiles** (inspector button, or the right-click menu): the placement becomes its parts, ordinary tiles,
  blocks, props, doors and lights you can edit one by one (they keep their ids, `sp_<placement>_<n>`, and are
  selected); one undo puts the set piece back.
- **Save as set piece:** select what it is made of (drag a box on empty ground with Select: everything whose middle is
  in the box on the level you're editing; Shift adds), then **Save as set piece…** (inspector, the tab, or the
  right-click menu). Name it; the dialog says what it holds (tiles, blocks, props, doors, ladders and lights; set
  pieces count as their parts; spawns and the like are left out), its size, ports, whether it mirrors, and whether its
  materials matched a look (then they become roles and the piece re-themes). It goes into **My set pieces**, kept in
  this browser next to your maps (`cs.setpieces`, at most 64). Placed in a map, the map carries its definition
  (`setPieceDefs`), so the map plays anywhere.
- **Your library:** pick one of your pieces to **Export…** it (a `.setpiece.json` file) or **Delete** it; **Import…**
  (under My set pieces) adds pieces from a file, checked first (a piece naming a tile, prop or material the game
  hasn't got is refused). A piece that came with a map can be saved to your library from the panel. Nothing is
  uploaded.
- **The owner** also sees **Export for content/setpieces/**: the piece as a family file (its id `setpiece.<name>`) to
  add to `content/setpieces/` and ship, the way official maps are files (docs/CONTENT_PIPELINE.md, "Set pieces").
- **Replace all with a set piece…** (every tile's inspector; set pieces part 6): pick a piece, and every placement of
  that tile in the map becomes it at the same cell, level and turn, selected, one undo step. A piece bigger than the
  tile must fit where it lands (MapMaker says what's in the way).
- **Retired tiles and Replace all** (set pieces part 5): an old big tile a set piece replaces leaves the Tiles tab
  (`content/setpieces/aliases.json`; so far the **Catwalk Gantry**, replaced by **Catwalk Bridge (Up)**). A map that
  places one still opens with it; its inspector says what replaced it and offers **Replace all N with …**: every
  placement of it becomes the set piece at the same cell, level and turn, selected, one undo step. Export then names
  the piece. In play the old tile already plays as the piece (the map loads it so), so nothing changes when you do.
- **Part 5's pieces** (docs/SET_PIECES_PLAN.md, "As built: part 5"): the **Sunken Arena** sinks 2 m into the ground
  (its floors carve the terrain, like the trenches: flatten bumpy ground first); the **Sea Wall** pieces are free blocks
  only, so put them on level ground (a beach's flat top) and line the bays up east to west, the sea to their south;
  stairs, ramps and the atrium's stairwell climb inside each piece, so turn it (most can't be mirrored).

## Room options (format v16)

Room, the Room variants (Pillar, Columns, Low Cover, Dais), Long Room, Large
Room, Great Hall, Plaza and Courtyard take **room options** in the tile
inspector (also `MapBuilder.tile(..., options)` in map scripts). They are
sized to the whole footprint and turn with the tile:

- **Layout**: As built, Empty, Central pillar, Four pillars, Column rows, Low
  cover, High cover, Dais, Central platform (1.5 m, one flight up) or Rubble
  (heaped in the corners, seeded by the tile so everyone sees the same). A
  layout replaces the furniture the room came with.
- **Floor**: Standard, Raised centre (0.5 m, a step all round) or Sunken
  centre (a 0.5 m pit with a step down; only where nothing is built below
  and, at ground level, no terrain). Layout pieces in the centre stand on it.
- **Ceiling**: Open (as before), Roof, Roof with skylight, Beamed roof or
  Vaulted ceiling (a shallow stone barrel vault along the room's long way,
  springing just over the doorways' heads, with two rib arches a cell; a beam
  carries it where a side has no wall). A roof is a walkable slab at the top
  of the walls, left off wherever something is built on top.
- **Corners**: Square, Posts, Columns, Chamfered or Rounded, wherever two
  solid walls meet (not beside an archway, railing or half wall).

Every layout and floor is tested for bot paths across the room in every
rotation (`test/roomOptions.test.ts`); cover keeps 2 m off the walls, since
narrower gaps drop out of the bots' navmesh.

Trim (baseboards, cornices, door and window frames, railing posts) is drawn
with the map but never collides, and has its own paintable slot.

## Where you can build: grid, playable boundary, build limit

MapMaker draws the build area on the level being edited
(`client/src/editor/buildAreaVisuals.ts`, rules in `shared/src/editor/buildArea.ts`):

- **The grid** (top bar **Grid**) is local: it covers the cells round where the
  camera looks at the level being edited, fades out with distance, and draws
  every 4th line stronger. It grows as the camera rises (12 to 40 cells) and is
  rebuilt only when its centre moves 4 cells, so it stays cheap.
  **Full grid** (next to it) draws every cell of the whole build area instead,
  on demand. Grid off hides either; the outlines stay.
- **The playable boundary** (orange, at the level and 6 m up with corner posts):
  the map's **Boundary** (Map properties), or, when it has none, its terrain's
  edge. A faint copy shows through hills and buildings.
- **The build limit** (white, dashed, with corner posts that span the levels):
  where placement stops. Tiles stand within **256 cells** (2,048 m with 8 m
  cells) of the centre and **16 levels up or down** (`MAX_TILE_CELL`,
  `MAX_TILE_LEVEL` in the map schema). A placement past it is refused with
  "past the build limit…", and the level strip says when a level is the last.
- **The scenery zone** between them (a hatched orange band just outside the
  boundary, labelled) is meant to be built in: scenery there blends the play
  space into the world round it cheaply (owner, 2026-11-05). Nothing warns about
  it; the status bar names the zone when the pointer is there.

The camera may fly out to the build limit (and 600 m up). Photo mode (Set
thumbnail) hides all of it.

**The ghost says why** (`shared/src/editor/ghostWhy.ts`): beside the pointer, a
refused tile or set piece says why in a few words ("Overlaps the Corridor on
Ground", "Past the build limit (16 levels up or down)"), and the status bar has
the whole reason. Spawns, pickups, props, vehicles and NPCs over nothing ("No
floor under it": no ground within 1.5 m, no floor, block, wall or prop top
within 1 m, no water) are refused: the ghost goes red with the reason beside it
and on the status bar, and the click places nothing. Spawns, pickups, vehicles
and NPCs outside the playable boundary (or past the build limit) are refused the
same way. Props outside the boundary are scenery: the card notes the scenery
zone, as for tiles. Only placing is refused: moving, pasting or editing what is
already on the map still works (the validator warns as before).

**The budget bar** (in the bottom status bar; `shared/src/editor/budgetCounters.ts`)
shows the budget nearest its limit: green OK, amber Near (80 %), red Over, each
with its word. Click the name to select what it counts; the arrow lists every
budget above it (docs/MAP_BUDGETS.md).

**Keys:** `?` (or the tool bar's Keys button) lists every key MapMaker binds,
from the same table its keys are bound with (`shared/src/editor/keymap.ts`).

## Floors over tall pieces (format v26)

A grid cell holds one piece. A piece that stands more than one level tall
(Tall Room, Atrium, Triumphal Arch, Hypostyle Hall, Temple Pylon, Arena
Seating, City Wall…) holds its cells on its upper levels
too, so nothing else can be placed there, even where it builds little or
nothing. To put a floor in up there (the ceiling of the storey below, a floor
to build on), the floor becomes part of that piece:

- **Place a Platform on the cell** (go up to that level first, Page Up or the
  level strip): instead of a second piece in the cell, the tall piece gets a
  floor of its own there. The ghost shows green where that works.
- **Or select the piece** and tick **Floor on Level N** under *Upper floors* in
  the inspector: a floor over its whole footprint at that level. Untick it to
  take it out (one undo step either way).

The floor is a full 0.5 m slab at that level's floor height, like a floor the
piece came with (theme floor on top, underside below; paint it as usual), and
it collides. Columns, arches and piers that rise through it still stand. Only
storeys a piece leaves without a full floor take one: not its bottom storey,
not stairs, ramps, towers or lifts (their upper storey is the way up) and not
buildings drawn from a model. Stored per cell in the piece's own frame
(`TilePlacement.upperFloors`, `"dx,dy,dz"`), so it moves and turns with it;
`geometry.ts` `canAddFloor` / `cellSlab`, `editor/operations.ts`
`placeTileCommand` / `setUpperFloorsCommand`. Tested for every such piece with
every floor in, turned and not, by the flicker audit's rule (no two faces in
one plane: `test/upperFloors.test.ts`).

When a placement is refused, MapMaker says what is in the way (the piece and
the level) and what to do instead: pick a free cell or another level, move or
delete the piece, or, on a tall piece's empty upper storey, the floor above.

## City kit (Quaternius Downtown City MegaKit, 4/3 scale)

The kit is scaled by 4/3 so its 3 m storeys are our 4 m levels and three of
its 2 m bays fit an 8 m cell side (`tools/content/prepare-city.mjs` builds
`packages/client/public/city/` from the download; the kit itself stays out
of the repo).

- **Buildings** (*Buildings* palette): Brownstone (2 × 2 cells), Midrise
  (2 × 2) and Office Block (3 × 3). Each is a solid block the height of the
  model (stand on the roof); its street face is local north. Nothing builds a
  wall against one.
- **Streets** (*Open* palette): City Street (1 cell along the road, 2 across)
  and City Crossroads (4 × 4). Open ground with open edges: streets join each
  other, courtyards and plazas without walls. The kerbs are flattened to a
  few centimetres, so the whole tile is walked at floor height.
- **Facades** (room option *Facade*: city brick, shopfront and brick, or
  painted plaster; the Style Pack facades are below): the outside of a room's walls is dressed bay by bay,
  windows and plain wall in turn on upper floors (a shopfront or brick base
  on the ground floor), bands over doorways and under windows, a cornice
  where nothing is built above and columns on the outer corners. The facade
  stands 0.32 m proud of the wall (past a neighbouring courtyard's own wall)
  with frames round the openings; it is only visual, so doorways and windows
  are exactly our own. Stack rooms with the same facade for taller buildings.
  Downtown (`maps/downtown.json`) shows all of it.

## Style Packs (`editor/stylePacks.ts`, `map/packTiles.ts`, `map/packTiles2.ts`, `map/packTilesAncient.ts`, `map/packTilesMedieval.ts`, `map/packTilesHarbor.ts`, `map/packTilesSnow.ts`, `map/packTilesDesert.ts`, `map/packTilesJungle.ts`)

Sprint 7, Set 1 "Foundation": 01 Military Compound, 02 Frontier Dust, 03
Imperial Arena, 04 Orbital Station, 05 Gothic Estate, 06 Jungle Ruins, 07 Neon
Megacity, 08 Suburban Chaos and 09 Sands of Egypt (the Egypt theme asked for
alongside the set), then from the owner's tileset sheets 10 Medieval Village,
11 Coastal Harbor and 12 Snow Outpost; 09 is now **Desert City**, which
replaced Sands of Egypt (owner, 2026-10-31) and still carries all its pieces,
and 06 Jungle Ruins was refreshed from the Jungle Ruins sheet with the Ancient
Temple sheet folded in. One registry (`STYLE_PACKS`, in pack-number order). A Style
Pack is a themed selection of the kit: the **Style Pack** picker under the
MapMaker palette's search box narrows the tiles, props, gameplay pieces
(Entities → Scenario), vehicles and pickups to one pack (headings left empty
hide), shows its blurb, facades and demo map, gives its gameplay pieces
tooltips saying what they are for in that pack, and **Use theme** sets the
pack's theme. Packs only group content: everything in a pack mixes with
anything else, and *All pieces* shows the lot. Box-built pack tiles are
geometry like the core buildings (walls take the theme's wall paint,
furniture its solid paint); the parts that must look the part in any theme
(sandbags, earth berms, corrugated roofs, rails, rock) carry a library
material of their own (`LocalBox.surface`). Every climbable pack piece is
tested for bot paths in all four rotations (`test/stylePacks.test.ts`).

### 01 Military Compound (modern industrial)

Theme **Military Compound** (`core.military`: dark concrete floor, bunker
concrete walls, olive corrugated pillars and steps, steel trim); also
Bunker and Canyon Outpost. Materials: Bunker Concrete, Olive Corrugated, Grey
Corrugated, Burlap (ambientCG).

| Kind | Pieces |
|---|---|
| Tiles (16 new) | Barracks (2 × 1: bunks, lockers, corrugated roof), Guard Tower (stairs to a sandbagged 3 m lookout under a roof: sees over the 4 m wall), Pillbox (slits all round), Vehicle Shed (2 × 1, open front), Compound Wall, Compound Wall Corner, Compound Gate (a 3 m gateway for a blast door), Catwalk Gantry (1 × 2: stairs to a railed deck 4 m up meeting the level above), Helipad (2 × 2); plus core Bunker, Warehouse, Catwalk |
| Trenches (modular) | Trench, Trench Corner, Trench Junction, Trench Crossing, Trench Mouth (opens out; steps down the berm ends), Trench Fire Step (plank steps up through the berm), Trench Dugout (roofed): 3 m channels between 1.25 m earth berms (a step short of a jump) with a 0.3 m sandbag lip, so a standing player just sees over; open tiles, so they join into networks |
| Facades | Bunker concrete (plinth and cap), Corrugated sheet (flashing) |
| Props (39: 30 new) | Sandbag Wall, Low Sandbags, Sandbag Corner, Sandbag Nest, Blast Wall (gabions), Steel Hedgehog, Concrete Tank Trap, Razor Wire, Camouflage Net, Ammo Crate(s), Fuel Drum, Concrete / Striped / Broken Barrier, Road Barrier, Concrete Block, Brick Rubble, Floodlight Mast, Yard Lamp, Pallet, Supply Truck, Flatbed Truck, Dumpster, Shipping Containers (red, blue, green), Fuel Tank, Storage Tank, Steel Water Tower; plus supply containers, metal crate, tents, radio, gas can, warning sign, cone, bunk bed |
| Gameplay | **Blast Door** (a door variant: thick, chevroned, in a heavy frame, slower; E or logic opens it), **Alarm Light** (a red bulb that starts off and blinks when a rule switches it on), **Destructible Barrier** (a breakable concrete block, 400 HP, back after 30 s); concrete barriers, gabions, razor wire and ammo crates break, fuel drums and tanks explode; mounted guns are the turret mounts (MG, rockets, sentry, arc turret); jeep, rover, tank; breakable walls, gas cylinders, laser fences and mines |

### 02 Frontier Dust (Wild West)

Theme **Frontier Dust** (`core.frontier`: weathered planks and siding) and
**Frontier Adobe** (`core.adobe`); also Frontier Saloon and Desert Town.
Materials: Weathered Planks, Weathered Siding, Adobe, Dusty Road (ambientCG).

| Kind | Pieces |
|---|---|
| Tiles (15 new) | Saloon (2 × 2, two storeys: porch and false front, a double-height bar room, stairs to a gallery and rooms over the street), Bank (barred teller counter, a thick-walled vault with a 3 m doorway for a vault door), Jail (office, three barred cells off a corridor), General Store, Chapel (1 × 2: pews, dais, bell tower), Livery Stable (2 × 2: stalls, hay loft up the stairs), Rail Station (ticket office, covered platform), Water Tower (three storeys tall), Mine Entrance and Mine Tunnel (timbered, with cart rails), Main Street, Boardwalk Street, Rail Line, Rail Crossing, Corral (2 × 2) |
| Facades | Frontier false front (siding; a plank front over the street door, stepped up in the middle, with an awning and boardwalk), Adobe (vigas under a rounded parapet) |
| Props (48: 23 new) | Mine Cart, Ore Cart, Dynamite Crate, Dynamite Bundle, Mine Timber Frame, Mine Rails, Buffer Stop, Steam Locomotive (Red), Passenger Car, Ore / Hopper / Timber Wagons, Wooden Flatbed, Railroad, Broken Railroad, Hitching Post, Water Trough, Wagon Wheel, Wanted Board, Outhouse, Tumbleweed, Covered Wagon, Wind Pump; plus barrels, crates, powder keg, hay, cart, woodpile, signpost, cacti, coffin, gravestones, saloon furniture, gold |
| Gameplay | **Saloon Doors** and **Vault Door** (door variants: louvred half-doors swinging on both posts; a round steel door swinging on one hinge, locked), **Steam Train** (a locomotive and two flatbeds riding chassis blocks on a mover; ride the flatbed, and get out of its way: movers set to 4 m/s or more run over whoever they sweep into), **Mine Cart** (a cart on a block you can stand on, rolling along its rails and back), **Breakable Planks** (a breakable block in weathered planks), **Dynamite** (a throwable: 3 s fuse, 6 m blast; pick it up as an item), dynamite crates, bundles and powder kegs that go up when shot; board barricades, crates |

Props can ride movers (`MoverEntity.props`, map format v20, optional): they
are drawn following the mover and never collide (the validator makes them
non-solid; the mover's blocks are what you stand on and bump into). The
Steam Train and Mine Cart palette entries place the blocks, the models and
the mover in one step; the mover inspector lists nearby props under *Props
riding along*. Doors take a *Look* (`DoorEntity.style`: sliding, blast,
saloon or vault); the look never changes how a door opens, locks or blocks.
Breakable props are rule targets for *Object destroyed* (a dynamite crate by
the vault door can blow it open).

**Demo maps.** *Iron Compound* (`maps/iron_compound.json`,
`maps/iron_compound.json`): a walled compound (barracks, command bunker,
armoury pillbox behind a garrison-only blast door, vehicle shed, helipad,
two guard towers with mounted guns, a gantry onto the barracks roof) facing
a trench line; the main gate's blast door is worked from buttons inside and
out, with alarm lights blinking while it stands open. *Dustwater*
(`maps/dustwater.json`, `maps/dustwater.json`): a town on one main
street (saloon with swinging doors, bank and vault, jail, store, barber,
hotel, adobe cantina and houses, chapel and graveyard, livery and corral,
water tower), a train through the station all match, and a mine tunnel up
the hill with a cart running in and out; blow the dynamite crate by the
vault (or work the combination) to open it.

### 04 Orbital Station and 07 Neon Megacity

| Pack | Theme | Room options | Own tiles | Own props | Demo map |
|---|---|---|---|---|---|
| 04 Orbital Station (clean sci-fi) | `core.orbital`: grated floors, white Station Panels, white panel cover, Glow Trim | Facade **Station hull (viewports)**, roof | Hangar Bay, Reactor Hall | 25 (category *Orbital Station*) | Halcyon Station |
| 07 Neon Megacity (futuristic city) | `core.neon_megacity`: Wet Asphalt, dark concrete, glass, Neon Tube trim | Facades **Glass tower** and **Neon block**, roof | Glass Tower, Spire Tower, Stepped Tower, Twin-Block Tower, Corner Shop Block, Apartment Block | 23 (category *Neon Megacity*) | Neon Spire |

Orbital Station also lists the Modular SciFi MegaKit and Space Station Kit
props already in the game (consoles, glass floors, round platforms, crates,
beds), and the core corridors, atrium, stairwell and catwalks; Neon Megacity
lists the city streets and crossroads, courtyards, platforms, bridges and
terraces.

**Orbital Station pieces.** *Hangar Bay* (3 × 3 cells, two storeys): a
landing pad under a gantry along the back wall, stairs up the west side;
open its front (edge style *No wall* on both storeys) and seal it with a
force field. *Reactor Hall* (2 × 2, two storeys): a catwalk all round with
glowing edge trim, stairs up, coolant pylons, room in the middle for the
**Reactor Core** prop; pair it with a low-gravity zone. Props: airlock frame,
sealed bulkheads, laser gate frame, field emitter, space viewport (a round
window onto stars for any wall), reactor core, cryo pod, holo globe, cargo
crate, generators, transmitter, satellite and comms dishes, trusses, frame
module, coolant pipes, consoles and terminals, canister rack, floor cables,
station columns and wall sections. The **Station hull** facade dresses a
room's outside in white panels with round viewports, a glowing trim line,
cornices and lit corner columns.

**Neon Megacity pieces.** Towers from Kenney's City Kit (Commercial) fitted
to whole cells (solid, their street face local north, roofs walkable at the
height measured from the model: 31, 49, 39, 47, 9.5 and 13 m). Props: street
lights, traffic lights, an overhead sign gantry, street signs, dumpsters,
barriers, cones, neon barriers, elevated pillars, power poles, skytrain
track, pylon and cars (cab, car, tail), vending machine, holo kiosk, noodle
stall, rooftop AC units, water tanks and antennas. The **Glass tower** facade
is a dark curtain wall with every other bay lit and a neon cornice; **Neon
block** is dark concrete with lit windows and AC units, sign blades, magenta
neon bands and shopfronts with half-raised shutters.

**Gameplay pieces** (Entities → Scenario; the picker narrows the list to each pack's):

| Piece | What it is |
|---|---|
| Force Field | A solid block marked *Force field*: a glowing sheet of scrolling bands between two emitter posts, humming while it stands. Stops players and vehicles; shots, grenades and sight pass straight through (its collider is in its own physics group, so only movement queries see it). Logic switches it like any block: *Drop / crumble block* or Disable turns it off (it crackles out), *Rebuild block* or Enable back on; *Starts hidden* for a field that logic raises. Snaps to doorways. Navigation sees it in its idle state. |
| Low-Gravity Zone | A zone with *Gravity* (× the map's, 0.1–3; the palette entry uses 0.35). Inside, movement falls at that fraction (higher jumps, slow floating falls, longer jump-pad flights, softer landings for fall damage), on the server and in client prediction alike; bots are given pad landings traced through it. Always on, whatever logic does to the zone. Drawn in play as a faint column of rising motes (sinking, orange, when heavier than normal). |
| Door (auto) | Sliding doors open as anyone comes close (or only one team, with *Team only*); airlocks are two of them either side of a short room. |
| Tower Elevator | A 3 m cab riding three storeys up and back (a mover); set the second point's height to reach any roof. Bots ride lifts. |
| Sky Tram | A tram car (floor, roof on posts) on a mover running 24 m along its facing and back: ride it roof to roof. |
| Neon Sign, Holo Billboard | Light fixtures `sign` and `billboard` with *Words* and a size: lit letters on a dark box with a neon tube border, or a glowing, see-through screen with scanlines. They are lights, so logic switches, recolours, flashes and blinks them (a blackout console). |
| Transit | A track (Paths → Track, NPC traffic) with *NPC cars* laid on an elevated deck: hover cabs lap it all match, run down anyone in the way and can be shot up or taken (Neon Spire's skytrain, as in Undergate Transit). |

**Demo maps.** *Halcyon Station* (`maps/halcyon_station.json`, script
`maps/halcyon_station.json`): a station ring round a
low-gravity reactor hall, a hangar sealed by a force field (the control room
vents it), labs that seal behind a field, an airlock onto a floaty exterior
gantry, windows onto space all round. *Neon Spire* (`maps/neon_spire.json`):
streets and a crossroads under neon signs and billboards, a glass elevator up
the 31 m Spire to the sniper roost, two three-storey blocks joined roof to
roof by the sky tram, a skytrain loop 12 m up with hover cabs, and a roof
console that blacks the neon out for 12 s.

Content: `tools/content/prepare-packs.mjs` models our own props and facade
pieces in code (`tools/content/pieces.mjs`) and fits the Kenney towers;
`prepare-props.mjs --downloads` builds the Kenney kit props (see
CONTENT_PIPELINE.md and ASSET_SOURCES.md).

### 05 Gothic Estate, 06 Jungle Ruins and 08 Suburban Chaos

| Pack | Themes | Facades (box-built) | Own tiles | Own props | Demo map |
|---|---|---|---|---|---|
| 05 Gothic Estate (Victorian horror) | **Gothic Estate** (`core.gothic_estate`: old floorboards, Damask Wallpaper, walnut, dark panels, brass); Gothic Manor, Castle Keep | **Gothic stone** (buttresses, string course, hood moulds, battlements and pinnacles), **Victorian brick** (stone plinth, quoins, sills and lintels, bracketed cornice); also **Collegiate stone** (Gothic stone's dressing in grey lannonstone and dressed limestone: the set pieces' Collegiate Gothic for St. John's) | 8 | 19 (category *Gothic Estate*) | Ravenscroft Hall |
| 06 Jungle Ruins (lost civilisation) | **Jungle Temple** (`core.jungle_temple`: mossy cobbles, mossy castle stone, layered rock), **Ancient Temple** (`core.ancient_temple`, from the refresh); Jungle Ruins, Forest Camp | **Temple stone** (stepped base, glyph frieze, stepped merlons), **Overgrown rock** (moss at foot and top, vines hanging down, never across openings) | 12 + 20 (refresh) | 17 + 26 (refresh; category *Jungle Ruins*) | Vinefall Sanctum (was Verdant Ziggurat; see *06 Jungle Ruins refresh* below) |
| 08 Suburban Chaos (everyday modern) | **Suburban** (`core.suburban`: oak boards, white plaster, painted clapboard, white trim); Walled Garden, Downtown | **Clapboard siding** (corner boards, brick plinth, shutters, sills and lintels, fascia), **Suburban brick** (the same trim on brick) | 8 | 20 (category *Suburban Chaos*) | Cedar Lane |

New materials: Damask Wallpaper (procedural stripes), Slate Shingles,
Mossy Cobbles, Layered Rock, Pool Tiles and Painted Clapboard (ambientCG
RoofingTiles002, PavingStones138, Rock051, Tiles132A, WoodSiding009). Tile
boxes can now be tilted like pitched blocks (`LocalBox.pitch` / `roll`,
turned with the tile), which is how the house, garage and mausoleum get
real gable roofs (`gable()` in `packTiles2.ts`).

**Gothic Estate tiles.** *Manor Library* (2 × 2, two storeys: walls of
bookcases, reading tables, stairs up the east wall to a railed gallery round
three sides), *Crypt* (a vaulted stone chamber north to south: coffin niches,
a tomb; put it a level down), *Mausoleum* (columned porch, slate gable, a
tomb chamber), *Cemetery Plot* (crossing gravel paths between kerbed graves),
*Hedge Maze* and *Formal Garden* (2.4 m hedges with gaps on every side; low
beds round a fountain), *Iron Railings* and *Railings Gateway* (bars you see
and shoot through on a stone plinth; a 3 m gateway between piers). Props:
tall bookcase, candle chandelier, floor candelabra, grandfather clock,
wingback chair, grand piano, portrait, suit of armour, four-poster bed,
writing desk, sarcophagus, weeping angel, tall headstone, wrought-iron
railing and gates, box hedge, hedge arch, topiary, gas lamp; the pack also
lists the graveyard, house, ruins and dungeon props already in the game.

**Jungle Ruins tiles.** *Stepped Temple* (3 × 3: terraces 2, 4 and 6 m up
round a stair of 24 steps to the shrine on top), *Temple Gateway*, *Ruined
Temple Wall*, *Cliff*, *Cliff Corner* (8 m of rock; their tops are a walk
two levels up), *Rock Stair* (one level up against a rock wall), *Cave
Passage* and *Cave Mouth*, *Waterfall Basin* (a rock face with a hidden
recess behind the falls, a ledge, a 4 m basin sunk 1.5 m with steps),
*River Channel* (a 4 m bed sunk 1 m, steps down either bank; add Water),
*Giant Tree* (plank flights climbing twice round the trunk to a lookout 7.5 m
up), *Overgrown Court*. Props: colossal head, serpent head, carved pillar,
altar stone, stele, vine curtain, liana, rope-bridge anchor, waterfall
(see-through sheets and foam), giant root, banana plant, giant fern,
monstera, bamboo, fire brazier, fallen blocks, golden idol.

**Suburban Chaos tiles.** *Family House* (2 × 1, two storeys under a slate
gable: living room, kitchen, stairs to a landing, two bedrooms), *Garage*
(a 3.6 × 2.8 m opening for the Garage Door, a back door), *Swimming Pool*
(1 × 2: a 3.6 × 12 m pool 1.8 m deep, steps at the shallow end, a diving
board; add Pool Water), *Playground* (climbing tower, slide, sandpit),
*Corner Store* (glass front, aisles, counter, glowing fridges), *Gas Station*
(2 × 2: canopy, pump islands, kiosk), *Suburban Street*, *Back Yard*. Props:
microwave, fridge freezer, gas barbecue, large propane tank, washing machine,
flat-screen TV, mailbox, wheelie bin, lawnmower, garden gnome, picket fence,
swing set, slide, trampoline, basketball hoop, petrol pump, family car, patio
set, sun lounger, hydrant. Appliances are breakable props: the microwave,
barbecue, propane tank, lawnmower, petrol pump and car explode (they are rule
targets for *Object destroyed* like any breakable prop); fridges, washers,
TVs, bins, gnomes and fences just break.

**Gameplay pieces** (built on the v20 kit: movers, logic lights and blocks, pitched blocks, ladders, traps):

| Piece | What it is |
|---|---|
| Secret Bookcase | A walnut block filling a doorway carrying a walk-through Tall Bookcase on a `trigger` mover: *Send mover* slides it 3.2 m aside, sending it again closes it (wire a button, a candle sconce, a zone) |
| Moving Bookshelf | The same bookcase on a `pingpong` mover running 4 m back and forth along a wall: cover that moves |
| Rotten Floorboards | A crumble block in old floorboards (3 × 3 m): gives way 0.5 s after you step on it, back after 15 s (lay it over a Pit for a drop into the cellar) |
| Candelabra, Chandelier | Light fixtures `candle` and `chandelier`: candles that flicker by themselves; set blinking (or logic *Blink light*) they gutter and flare at random instead of flashing, *Light off* snuffs them |
| Rope Bridge | Eight plank blocks over 12 m along the facing, pitched to sag 0.6 m in the middle (every step walkable), the middle two crumbling; anchor props at both ends |
| Crumbling Planks | A rotten plank (crumble block) to patch bridges and ledges with |
| Climbing Vines | A ladder (`LadderEntity.style: 'vines'`, 6 m) drawn as twisting vines thick with leaves; climbs like any ladder (bots too) |
| Falling Rocks | A crusher trap drawn as boulders lodged overhead (`TrapEntity.style: 'rockfall'`, no frame) that shudder, drop and are back once it rearms; *proximity* by default, or *logic* fired from a trigger zone |
| Garage Door | An up-and-over door: a 3.6 × 2.8 m panel on a `trigger` mover hinged at the top of the opening, swinging up level into the garage (`angles` [0, -90°]) when logic sends it |
| Breakable Fence | A white picket breakable block (4 m, 40 HP, back after 25 s) |
| Pitched Roof | Two slate pitched blocks (34°) meeting at a ridge over one cell |
| Pool Water | Water (tinted pool blue) sized for the Swimming Pool tile |

Room dressing gains four room types for these packs: *Victorian parlour*,
*Crypt*, *Conservatory* and *Temple shrine* (Gothic Estate and Suburban
themes guess like homes, Jungle Temple like the ruins).

**Demo maps.** *Ravenscroft Hall* (`maps/ravenscroft_hall.json`, script
`maps/ravenscroft_hall.json`): a manor on a stormy
night: the galleried library (its chandeliers gutter when you walk in), a
parlour whose candle sconce slides a bookcase aside into the secret study,
the study's rotten floor dropping you into the wine cellar and the crypt
(its candles flare as you come down), a picture gallery with a bookshelf
that will not stay put, formal gardens and a hedge maze behind iron
railings, a cemetery and mausoleum where the crypt stairs come out.
*Verdant Ziggurat* (`maps/verdant_ziggurat.json`): the stepped temple and
its golden idol, a court and gateway, caves where the roof comes down behind
you (a zone fires the falling rocks) and more rocks hang further in, a ridge
with vines up to a sniper walk over the waterfall and its hidden recess,
rotten planks over the pool, a river with a sagging rope bridge between two
stone lookouts, and a giant tree. *Cedar Lane* (`maps/cedar_lane.json`): a
street of clapboard houses and garages (up-and-over doors on buttons and
drive keypads), a corner store and gas station, back yards with barbecues,
a pool, a playground and a carport under a pitched roof, picket fences that
splinter and appliances, pumps and cars that go off; a trampoline throws you
onto the store roof.

Content: `tools/content/build-style-props.mjs` models the 56 props in code
(licence Owned); the facades are boxes drawn with the level.

### 03 Imperial Arena (Roman) and 09 Sands of Egypt

*Sands of Egypt is no longer a pack of its own: 09 Desert City replaced it (see "09 Desert City" below).
Its 11 tiles, 15 props, theme (`core.egypt`), facade (`egyptian`) and materials are all still defined, so
maps that use them (Pharaoh's Reach, Sunken Kingdom, After Hours) load unchanged, and they are listed at the
end of the Desert City pack (and under All pieces, and the props' "Sands of Egypt" heading).*

| Pack | Theme | Facade | Own tiles (`map/packTilesAncient.ts`) | Own props | Demo map |
|---|---|---|---|---|---|
| 03 Imperial Arena | `core.imperial`: sand floor, Dressed Limestone walls, travertine, Roman Rubblework, White Marble trim (ambientCG Tiles139, Marble012, Bricks075A); also Marble Temple and Desert Town | **Roman limestone** (plinth, marble pilasters, cornice) | 15 | 17 (category *Imperial Arena*) plus the Quaternius ruins already in the game (columns, arches, walls, urns, cart) | Sandfall Colosseum |
| 09 Sands of Egypt | `core.egypt`: sand, Sandstone Blocks walls, Rough Sandstone, lapis ceilings, Gold Leaf trim (ambientCG Tiles142, Bricks083); also Desert Tomb | **Egyptian temple** (a painted hieroglyph band under a gilded cavetto cornice) | 11 | 15 (category *Sands of Egypt*) | Pharaoh's Reach |

Procedural materials of our own (`client/materials/patterns.ts`, painted at
256 px): **Carved Hieroglyphs** and **Painted Hieroglyphs** (columns of signs
between register lines, every sign a little shape of ours picked by hash: sun
disc, eye, ankh, bird, water, reed, loaf, seated figure, cartouche, viper; no
real text copied), **Roman Mosaic** (tesserae, a meander border and a
lozenge), **Gold Leaf** and **Lapis Paint**.

**Imperial Arena tiles.** *Arena Seating* (two storeys: a 2 m marble podium
wall over the sand, too high to jump up, a walkway on it with a 0.75 m
parapet, eight rows of 0.25 m seats, the top walkway 4 m up level with the
floor above), *Arena Seating Corner* (the rows mitred round an outer corner),
*Gladiator Gate* (seating cut by a 3.2 m passage onto the sand, roofed at the
top walkway; hang a Portcullis in its arena end), *Emperor's Box* (a raised
marble box under a canopy on four columns, steps up to the top walkway),
*Arena Hatch* (sand with a 3.2 m hole over the hypogeum), *Outer Arcade* and
*Arcade Stair* (two storeys of arches, a covered walk and an upper walkway
meeting the seating's top walkway; stairs up in the stair bay), *Colonnade*
(a portico of marble columns with a back wall), *Triumphal Arch*, *Aqueduct*
(two tiers of arches, a water channel 9.6 m up), *Forum* (2 × 2: paving, a
mosaic, a rostrum with steps, four statue plinths), *Temple* (1 × 2: steps up
a 2 m podium, a portico, the cella), and under the sand *Hypogeum Tunnel*,
*Hypogeum Pens* (barred beast pens round a crossing) and *Hypogeum Lift Shaft*
(a room under an Arena Hatch for a Lift Cage). Props: Ionic column, bronze
brazier, emperor statue, amphorae (breakable), gladius rack, training post,
eagle standard, legion banner, racing chariot, beast cage, stake barricade
(breakable), marble altar, bench and bust, forum fountain, velarium awning,
imperial throne.

**Sands of Egypt tiles.** *Temple Pylon* (3 × 1: two towers either side of a
3.2 m gate, painted reliefs and glyph bands on the front, stairs at the back
of each tower to a terrace 4 m up behind the battlements), *Hypostyle Hall*
(four painted papyrus columns under an 8 m stone roof with a starry lapis
ceiling: join them into a hall), *Sanctuary* (painted walls, a naos on a
stepped dais), *Step Pyramid* (4 × 4: five 2 m tiers, a stair cut into the
north face up to the 10 m platform and its gilded capstone), *Tomb Entrance*
(placed on the level below the ground: a mastaba over stairs down),
*Tomb Corridor* (a 3.2 m passage through the rock, painted walls, a starry
ceiling: lay traps along it), *Burial Chamber* (a dais at the back for the
sarcophagus, painted pilasters and walls), *Nile Quay* (an embankment with
steps down to the river bed 2.5 m below), *River Bed* (flood a row of them
with a Water body), *Sphinx Avenue* (a paved way between two plinths) and
*Mud-Brick House* (a village house, stairs up to its roof terrace). Props:
obelisk, sphinx, seated pharaoh (colossus), Anubis shrine, sarcophagus,
canopic jars (breakable), papyrus column, felucca, reed boat, date palm,
papyrus reeds, fire stand, gilded chest, stele, Bastet statue.

**Gameplay pieces** (Entities → Scenario):

| Piece | What it is |
|---|---|
| Portcullis | A door look (`style: 'portcullis'`): an iron grille between two stone piers that winds up into the lintel. Opens with E or logic (or by itself with *Auto*); blocks like any door. |
| Portcullis Gate | A grille block (Floor Grate in dark iron) on a trigger mover rising 3.4 m: a rule raises and lowers it (*Send mover*, *Move mover to point*), for gates wider than a doorway. |
| Lift Cage | A mover carrying a timber floor, iron bars on three sides and a sand hatch for a roof, riding one storey up and back: put it on the floor of a Hypogeum Lift Shaft under an Arena Hatch, and while it is down its roof closes the hole flush with the sand. Bots ride it (it is a lift). For a cage that comes up only on cue, use a trigger mover under a logic **Trapdoor** in the hatch: drop the trapdoor, send the mover, bring both back (Sandfall Colosseum's beast lift). |
| Brazier | A warm flickering light preset; put a Bronze Brazier or Fire Stand prop under it. |
| Portal Pair | See *Portals* below. |
| Spike floors, fire jets, crushers, crumbling floors, trapdoors, sliding stone doors | The existing traps, blocks and movers, suggested by the pickers with notes for each pack (spike pits in the sand and the tomb corridors, the pharaoh's curse). |

**Demo maps.** *Sandfall Colosseum* (`maps/sandfall_colosseum.json`; rebuilt 2026-11-08 from the owner's Flavius Rule
board, docs/map-briefs/sandfall_colosseum/): 52 m of sand (the 13 × 13 board at 4 m a square) with the board's twelve
pillars, five medallions and four corner hatches down to the hypogeum, a beast pit of spike traps and fire jets in the
middle; seven-storey stands of the Arena stands set pieces on all four sides, the emperor's box at the centre of the
north side, gates 1-4 at the corners, a stair tower in each corner court; the hypogeum (Hypogeum set pieces) round
under the podium with cages, the gladiators' cells and stairs out to the courts and the village; sixteen insulae and a
main square (triumphal arch, forum, temple, colonnades); the "Hills and a volcano" backdrop.
*Pharaoh's Reach* (`maps/pharaohs_reach.json`): from the Nile quay a sphinx
avenue leads between obelisks and seated colossi to the pylon (terrace up its
back stairs), a hypostyle hall and the sanctuary; a step pyramid with a
sniper's perch; a mastaba over the stairs down to a painted tomb of spike
pits, a fire jet and a crushing ceiling, its burial chamber linked to the top
of the pyramid by a portal that the pharaoh's curse (a zone at the
sarcophagus: fire jets, a red light, the portal sealed for 10 s) shuts; a
ferry carrying a felucca across the river to the village, and a reed boat
drifting up and down.

Content: `tools/content/prepare-ancient.mjs` models the 32 props in code
(`tools/content/pieces.mjs`, licence Owned, `assets-src/tiletrigger-ancient/`);
the five new texture sets come from ambientCG (CC0) through
`prepare-textures.mjs --only`.

### 10 Medieval Village (medieval town)

From the owner's concept sheet "Tileset 01 – Medieval Village / Town". Theme `core.medieval` (cobblestone
floor, half-timbered walls, oak solids, floorboard undersides, oak trim; also Castle Keep and Walled Garden);
facades **Half-timbered** (a stone ground storey under the timbering, jetty beams, shutters, an oak eaves
board) and **Village whitewash** (whitewash with oak corner posts, shutters and sills). Demo map: Market Town.

**Tiles** (`map/packTilesMedieval.ts`, 16). Houses are 2 × 1 cells, two storeys, with walkable red tile
roofs (35°; the eaves on the north and south cell edges with their top surface at 8.25 m, so a row of houses
makes one roofline and an Outside Stair's deck steps straight onto it):
*Timber House* (stone below, half-timbering above; doors on every side, a stair along the north wall,
upper doors east and west at 4 m, centred, for walkways and the next house in the row), *Shop House* (a wide
shop front and counter under a red awning), *Plaster House* (whitewash, the upper storey set back behind a
railed balcony over the street). *Outside Stair* (timber switchback round an open well: a landing at 4 m
along the south side, a deck at 8.25 m along the south edge: put it north of a house to reach the roof),
*Timber Walkway* (a railed deck 4 m up on posts; turn it east–west between two houses' upper doors),
*Market Square* (2 × 2, diagonal market tiles, a stepped plinth for a fountain or market cross, bollards),
*Market Hall* (1 × 2: an open arcade of oak posts, a stair to a timber-framed hall 4 m up),
*Town Wall* (a curtain wall on the south edge, a 3.4 m wall-walk behind merlons 4 m up), *Wall Stair*
(2 × 1: steps up the town face and a landing the length of the second cell), *Town Gate* (3 × 1: a gate
tower over a 4 m arched passage, the wall either side, a guard room opening onto both walks, a battlemented
roof through a hatch: hang a Ladder in it), *Bell Tower* (a door south, a switchback stair to a belfry
gallery 10 m up behind arched openings, a tiled spire), *Watchtower* (oak posts, a switchback stair to a
lookout 7 m up, a tiled roof), *Stream* (a bed 2 m down running east–west, a quay on the south bank, a grass
slope and ledge up the north bank; fill it with Water), *Stone Bridge* (humped, 1 m up at its crown, the
stream passing under its arch), *Cobbled Road*, *Blacksmith Forge* (an open smithy, a glowing hearth and
chimney, quench trough).

Every stair is built for the bots' navmesh as well as for players: treads 0.42 m or longer, 2 m or wider,
at least ~2 m of floor before the foot and after the head, turns on full-width landings (a 2 × 2 corner step
gets marked as a ledge), floor holes grown 0.3 m past the steps (a floor's edge bleeds a voxel). The tests
walk bots up every piece in all four rotations (`test/stylePacksMedieval.test.ts`) except the Bell Tower's
belfry: its stacked switchback inside walls drops out of the navmesh, so bots stay below (players climb it).

**Props** (20, category *Medieval Village*, `tools/content/prepare-medieval.mjs`, built in code, licence
Owned): Stone Well, Market Awning, Market Pavilion, Hanging Shop Sign, Hay Cart, Blacksmith Forge,
Workbench, Flower Planter, Tarpaulined Crates, Tarp Tent, Chimney Stack, Wattle Fence, Spiked Fence, Church
Bell, Market Cross, The Stocks, Oak Post, Grain Sacks, Bay Window, Shuttered Window. The Forge, Hay Cart,
Well and Tarp Tent are simple stand-ins under stable ids (`mv_forge`, `mv_hay_cart`, `mv_well`,
`mv_tarp_tent`): community downloads can replace them later through `content/props/<pack>.json` without touching
a map. The pack also lists the castle, siege, market, cart, barrel, banner, lantern, fence and tree props
already in the game.

**Materials** (procedural, `client/materials/patterns.ts`; ambientCG was not reachable from the build
container, so no new scans): Cobblestones (rounded stones in mortar), Granite Setts (running bond), Market
Tiles (diagonal terracotta and cream), Red Roof Tiles (pantiles), Timber and Plaster (half-timbering, one
storey a repeat, so beams line up at 0, 4, 8 m), Wattle, Packed Dirt, Whitewash, Oak Beam.

**Gameplay pieces**: *Oak Door* (door style `oak`: an iron-bound plank door on one side's hinges, opens as
you come close) and *Wattle Hurdle* (a breakable woven fence, back after 25 s), with the portcullis,
portcullis gate, drawbridge, breakable and crumbling planks, boards, ladders, braziers, lanterns, candles,
water and trigger zones.

### 11 Coastal Harbor (working fishing harbour)

From the owner's concept sheet "Tileset 03 – Coastal Harbor". Theme `core.coastal` (harbour setts floor, quay
granite walls, decking solids and undersides, harbour-blue trim; also Harbour and Downtown); facades **Harbour
render** (granite plinth, blue window frames and sills, a slate drip course) and **Tarred timber** (tarred lap
boards with white frames). Demo map: Saltmarsh Harbor.

**Levels.** Quay and decks at 0; the water's surface at −1.5 m (`HARBOR_SEA`: too high to climb out of without
steps, the slipway, the beach or a Ladder); the harbour bed at −4 m (`HARBOR_BED`). Water tiles carry the bed
as an extra floor; fill them with **Harbour Water** (gameplay piece `water:harbour`: put it on the bed and its
surface lands at −1.5 m).

**Tiles** (`map/packTilesHarbor.ts`, 20; the box helpers are shared with `packTilesMedieval.ts`):
*Timber Pier* (5 m deck on piles, 1.25 m of air over the water: swim under it), *Pier Head* (full-cell deck,
north rail with a gap; join Breakwaters east and west), *Boardwalk* and *Boardwalk Corner* (2.4 m, a rope rail
that only looks like it holds you), *Quay Wall* (ground on the south half, a 4 m sheer face, bollards, coping,
two fenders framing a bay for a Ladder), *Quay Corner* / *Quay Inside Corner*, *Sea Wall Steps* (2 × 1: steps cut
along the face down to the bed), *Slipway* and *Shingle Beach* (27° down to the bed; you walk on 32 low steps
under the drawn slope, which keeps them on the navmesh in every rotation), *Harbour Basin* (open water),
*Breakwater* (a concrete walk level with the quay, a wave wall on its west side, rocks to climb out on),
*Harbour Warehouse*, *Net Shed* and *Harbourmaster's Office* (2 × 1, two storeys, a straight stair along the
north wall, upper doors east and west at 4 m; roofs with eaves at 8.25 m like the Medieval houses, so an Outside
Stair north of one reaches its roof; the warehouse has a loading door and a loft door with a hoist, the net shed
an open ground storey in two bays, the office a balcony over the quay), *Fish Market* (2 × 1, open hall,
counters as cover), *Lighthouse* (a skeleton tower of four banded legs, a switchback stair inside to a gallery
10.5 m up, the lantern house; a granite plinth to the bed so it also stands in water), *Harbour Crane* (portal
legs, a platform 6 m up with a hatch for a Ladder, cab and raised jib), *Harbour Arch*, *Quayside* (setts and
crane rails).

**Props** (`tools/content/prepare-harbor.mjs`, licence Owned, category and palette group Coastal Harbor):
bollard, capstan, lobster pots, mooring and channel-marker buoys, net rack, fish stall, fish boxes, fishing
boat (a stand-in under a stable id), anchor, rope coils, harbour lamp post, life ring, heap of nets, herring
gull, tide board, mooring dolphin, tyre fenders. The pack also lists the rowing boat, felucca, mast, cargo
containers and crates, barrels, lamps and rocks already in the game.

**Gameplay.** Harbour Water, Ladders (out of the water up a quay, up the crane), drawbridge/lift/slider movers,
doors, breakable and rotten planks; boats are vehicles placed with *Rides on water* (hover bike, speeder).

**Navmesh notes.** A switchback stair inside four walls falls off Recast's navmesh (its watershed regions lose
the stacked laps); open sides keep it (the lighthouse is a skeleton tower for that reason, like the Medieval
watchtower). The 2 × 1 buildings use the Medieval houses' straight stair.
### 09 Desert City (Middle Eastern city; replaces 09 Sands of Egypt)

From the owner's concept sheet "Tileset 02 – Desert City" (Middle Eastern / arid / stone + plaster). Pack id
`desert` (tiles `desert.*`), number 09 in Sands of Egypt's place (the sheet calls it 02; 02 stays Frontier
Dust). Theme `core.desert_city` (worn paving floor, sandstone ashlar walls, weathered plaster solids, cedar
undersides, sandstone tile trim; also Sands of Egypt, Desert Town and Desert Tomb); facades **Desert ashlar**
(a sandstone plinth, a zellige band under the cornice, lattice screens and cedar lintels at the windows, a
stepped parapet) and **Desert plaster** (stone quoins, cedar beam ends under the parapet). Demo map: Qasr Medina.

**Tiles** (`map/packTilesDesert.ts`, 18). Every roof is flat and walkable at 8 m behind a 1 m parapet with
2.4 m gaps on the cell centres of every side, so a row of houses is one rooftop and bridges, galleries and
outside stairs join it there. Houses are 2 × 1 cells, two storeys: *Plaster House* (sun-faded plaster, cedar
beam ends, lattice windows), *Ashlar House* (sandstone, a zellige band, an arched door), *Shop House* (the
ground storey 2 m back behind a porch with a serving counter and a red canopy). Inside each: a stair along the
north wall to the upper floor (doors east and west at 4 m, centred, for galleries and the next house) and a
second along the south wall up to the roof, a rug and cushions, a shaded rooftop corner. *Outside Stair*
(stone switchback round an open well: a landing at 4 m along the south side, a deck at 8 m on the south
edge: put it north of a house and step through the roof's parapet gap), *Rope Bridge* (2.2 m wide at 8 m,
east–west, between two roofs' gaps), *Cedar Gallery* (a covered walk with lattice sides at 4 m between upper
doors), *Courtyard* (2 × 2: round arcades on columns round a zellige court and fountain, gateways on every
cell centre, a terrace on the arcades' roofs at 4 m reached by a stair in the court), *Covered Bazaar* (1 × 2:
a lane between shop alcoves with counters, cloths under the roof, a terrace on top round two little domes),
*Market Street* (stalls under red canopies both sides of a 4.8 m lane), *Domed Hall* (an arch on every side, a
fountain, a blue dome on an octagonal drum up to ~11 m), *Watch Tower* (switchback stair inside to a lookout
at 8 m behind merlons, a blue cap on posts), *Minaret* (a 22 m landmark; not climbed), *City Wall*, *Wall
Stair* (2 × 1), *City Gate* (3 × 1: a 4 m arched passage, two domed corner towers, stairs up both wall cells,
the walk crossing over the gate), *Arcaded Terrace* (a terrace at 4 m on piers and columns, gaps on every
side), *Well Court*, *Paved Street*.

Every stair keeps the Medieval pack's navmesh rules (treads 0.45 m, flights 2.2 m wide, ~2 m of floor at
both ends, full-width landings, roof holes off the steps). The tests walk bots onto every floor, roof,
bridge, gallery, terrace, lookout and wall-walk in all four rotations (`test/stylePacksDesert.test.ts`) and
keep every box inside its tile's cells. Not climbed: the Minaret and the Domed Hall's roof (landmarks).

**Props** (20, category *Desert City*, `tools/content/prepare-desert.mjs`, built in code, licence Owned):
Market Stall, Market Canopy, Desert Banner, Hanging Lantern, Palm Planter, Water Well, Tall Vase and Water
Jars (both break), Market Rug, Timber Crane, Cloth Line, Scaffold, Awning Window, Lattice Window, Shuttered
Window, Spice Baskets, Floor Cushions, Rug Rack, Sandstone Column, Ornate Arch (collides as a frame: walk
through it). The Market Stall, Water Well and Timber Crane are simple in-house versions under stable ids
(`dc_market_stall`, `dc_well`, `dc_crane`): a hero model can take the same id later in `content/props/<pack>.json`
without touching a map. The pack also lists the crates, barrels, sandbags, palms, lanterns, pots, carts,
ladders and troughs already in the game, then every Sands of Egypt prop.

**Materials** (procedural, `client/materials/patterns.ts`; ambientCG is not reachable from the build
container): Sandstone Ashlar (coursed blocks, tooled faces), Weathered Plaster (flaked to the stone in
patches), Blue Dome Tiles (glazed fish scales), Zellige Mosaic (eight-point stars and crosses), Worn Paving
(uneven flagstones), Sandstone Tiles, Market Rug, Mashrabiya Lattice, Red Canopy, Cedar Beam.

**Gameplay pieces**: *Lattice Screen* (`block:lattice`: a breakable cedar mashrabiya, 2.2 × 2.4 m, back after
30 s), with the oak door, portcullis and portcullis gate, ladders, planks, boards, crates, barrels, wall
lanterns, and the Sands of Egypt traps, portals and water.

### Portals (`sim/portals.ts`)

A **portal** entity (`kind: 'portal'`) is one of a linked pair: `position`
(the centre of its bottom edge), `yaw` (it faces the way you go in by),
`size` [width, height] (2.4 × 3.2 m by default), `pair` (the two portals
sharing it lead into each other), `startEnabled`, `color`. Walk, fall, fly or
shoot into a portal's front, inside its opening, and you come out of the
other portal's front, moving the same way relative to it: positions, push
velocities and the view all turn by the difference in the two facings (plus a
half turn), so speed is kept and you face out. Portals are one-sided (their
backs do nothing) and can stand against a wall or in the open. Players are
carried on the server and in client prediction alike (the view turns only in
live prediction, never on a replay); bots, NPCs and projectiles (rockets,
grenades, discs, spears) go through too.

- **MapMaker:** palette *Portal Pair* places two linked portals (the second
  8 m along the first's facing, turned to face back) with a fresh pair ID and
  a pair of colours; the inspector sets facing, width, height, pair, colour
  and *Starts on*, and says where it leads. Drawn as a stone frame round a
  swirling disc of light in its colour (a stylised effect, no view through).
- **Logic:** portals are toggleable (*Enable* / *Disable*, the *Is enabled*
  condition); a pair works only while both are on, and the swirl drains away
  while it is off. Replicated in the scenario snapshot.
- **Bots:** every pair is a navmesh link each way (like lifts and pads), so
  bots path through portals and walk into the surface; a pair that logic has
  switched off shuts its link.
- **Validator:** a portal without its other end (warning), a pair of more
  than two (error), two ends on top of each other, a portal that starts off
  with no rule to enable it, and ground in front of either end that nobody
  can stand on (navigation).


### 12 Snow Outpost (arctic military outpost)

From the owner's concept sheet "Tileset 05 – Snow Outpost". Theme `core.snow_outpost` (packed snow floors,
red prefab walls, snowy concrete), backdrop: snowy sky, snowy peaks, snow, light mist. Demo map
`maps/whiteout_station.json` (rebuilt in MapMaker from MAP 03 Frostbite Station, 2026-11: terrain, the pack's hangar,
comms tower, radar dome, fuel depots, drifts and frozen cliffs with the Reactor Room, Server Vault, Power Core Hall
and Loading Dock set pieces; docs/map-briefs/whiteout_station/). Tiles in `map/packTilesSnow.ts` (box helpers shared with packTilesMedieval.ts):

| Tile | Cells | What it is |
|---|---|---|
| `snow.hut` Prefab Hut | 1 × 1 | red panel hut, doors S and N; flat snow roof 3.5 m up by an outside steel stair from the north edge up the east strip |
| `snow.barracks` Barracks | 2 × 1 | bunk rows, doors on every side, 25° snow roof (walkable); stair from the NW to a deck at the eaves (3.5 m) along the north |
| `snow.comms_hut` Comms Tower | 1 × 1 (7 levels) | white Prefab Hut under a 24 m lattice mast with a red beacon |
| `snow.hangar` Vehicle Hangar | 2 × 2 | 7 m corrugated shed, 6 × 4.6 m doorway S (hang a Roll-up Door), doors W/E/N, grating mezzanine 4 m up along N |
| `snow.bunker` Snow Bunker | 1 × 1 | concrete room, firing slits S and W, door N; snow drift up the east side onto the roof (3.2 m), sandbags |
| `snow.watchtower` Steel Watchtower | 1 × 1 | switchback grating stair to a lookout 7 m up, snow roof, floodlight |
| `snow.radar_dome` Radar Dome | 1 × 1 | eight-sided drum (door S, consoles) under a 7.5 m radome |
| `snow.fuel_depot` Fuel Depot | 1 × 1 | two tanks on cradles, pipe, valve rack, bund wall |
| `snow.catwalk` / `snow.metal_stair` | 1 × 1 | grating catwalk 4 m up N–S; a stair from the ground (S) up to it (N edge) |
| `snow.ice_wall` Ice Wall | 1 × 1 | jagged ice 4–6 m high along the S edge (turn it to line a map edge) |
| `snow.ice_cliff` / `snow.drift_ramp` | 1 × 1 | frozen rock with a snow top 4 m high; a 27° snow drift from the ground (S) to 4 m (N) |
| `snow.frozen_lake` / `snow.ice_ridge` / `snow.ice_hole` | 1 × 1 | lake ice; with a pressure ridge (cover); broken open 3.6 m over water 2 m down, steps out on the N side |
| `snow.road` Snow Road | 1 × 1 | ploughed road N–S with tyre tracks and snow banks |

Navmesh note (on top of Medieval's): a landing must start exactly where a sloped slab's top surface ends; a
landing lapping over the slope leaves a sliver the navmesh can't stand on and bots stop a metre short
(`zTop` in `bunker()` / `rampUp()`). `test/stylePacksSnow.test.ts` walks bots onto every roof, deck, lookout,
mezzanine, catwalk and cliff top in all four rotations.

**Props** (16, category *Snow Outpost*, `tools/content/prepare-snow.mjs`, built in code, licence Owned):
Satellite Dish, Antenna Mast, Diesel Heater, Diesel Generator, Snowmobile, Crates under a Tarp, Arctic Lamp
Post, Flagpole, Chain-link Fence, Snow Fence, Insulated Pipe Run, Oil Drums, Radio Console, Ski Rack, Supply
Sled, Snow Pile. Snowmobile, Satellite Dish and Generator are stand-ins under stable ids (`so_snowmobile`,
`so_satellite_dish`, `so_generator`) for Meshy or community hero versions later. The pack also lists the
snowy trees and rocks, sandbags, barriers, containers, crates, barrels, tanks and lights already in the game;
the drivable snowmobile is the `snow_sled` mount.

**Materials** (procedural, `client/materials/patterns.ts`): Packed Snow and Snow Drift (wind ripples,
glints), Lake Ice and Glacier Ice (cracks, bubbles), Red and White Prefab Panels (seams, ribs, rivets; one
storey a repeat), Snowy Concrete, Frozen Rock (strata rimed with frost), Steel Grating, Red Beacon (glows).

**Facades**: *Prefab panels* (`prefab`: white corner posts, steel plinth, snow on the hoods and the top) and
*Snowy concrete* (`snow_bunker`: a snow berm, snow-capped hoods and top).

**Gameplay pieces**: *Roll-up Door* (`mover:rollup_door`: a 6 × 4.6 m shutter a rule rolls up 4.4 m and
down), *Ice Block* (breakable cover, back after 30 s), *Thin Ice* (4 × 4 m, gives way 0.7 s after you step
on it, back after 12 s), with blast doors, ladders, alarm lights, water, mines and the generator.
Not in the game yet: falling snow (the `snowy` sky has no precipitation) and slippery ice.

### 06 Jungle Ruins refresh (Ancient Temple folded in)

From the owner's concept sheets "Tileset 04 – Jungle Ruins" (weathered mossy stone, overgrown temple
courtyards, waterfalls, rope bridges over chasms, torch-lit stairs, red banners) and "Tileset 07 – Ancient
Temple" (sandstone with teal-and-gold inlay, teal/gold banners, wall torches, hanging braziers, chain rails,
spikes, a portcullis, multi-level terraces with waterfalls). The owner folded Ancient Temple into the Jungle
Ruins refresh (2026-10-31: the two sounded alike), so it is one pack, 06 Jungle Ruins; 03 Imperial Arena stays
Roman. The pack's first twelve tiles (`packTiles2.ts`) and 17 `jg_*` props are unchanged, so Verdant Ziggurat,
Erosion, Sunken Kingdom, Fernwood Moon, After Hours and Jungle Steps load as before. New theme
`core.ancient_temple` (mossy stone slab floors, carved temple stone walls, temple sandstone solids, jungle rock
undersides, gold trim; backdrop clear sky, forest, moss). Demo map: `maps/vinefall_sanctum.json` (Vinefall
Sanctum; Verdant Ziggurat was the demo before).

**Tiles** (`map/packTilesJungle.ts`, 20; one level is 4 m):

| Tile | Cells | What it is |
|---|---|---|
| `jungle.terrace` Temple Terrace | 1 × 1 | carved stone one level high under a mossy cornice; its top is the next level's ground |
| `jungle.terrace_stair` Terrace Stair | 1 × 2 | a 3.2 m wide stair (16 steps) north to a landing 4 m up; stack another on the landing a level up for a ziggurat (reached head-on and from the terraces either side) |
| `jungle.temple` Carved Temple | 2 × 1 | carved and relief walls, a 3.2 m gate in the west cell's south edge (the Portcullis hangs in it), doors W and N, barred windows E, columns, beamed ceiling, altar; a stair inside the north wall to a flat roof walk 4 m up, parapet gaps E and W |
| `jungle.shrine` Summit Shrine | 1 × 1 | small sanctuary on an inlaid apron, door S, stepped roof and gilded finial: a ziggurat's crown |
| `jungle.wall_carved` / `wall_relief` / `wall_window` / `wall_arch` / `wall_column` / `wall_low` | 1 × 1 | 4 m temple walls along the north edge: step-fret frieze; relief panels; two windows (one barred: shoot through); a 3.2 m arch; four columns over a knee wall (see and vault through); waist-high cover |
| `jungle.beamed_hall` Beamed Colonnade | 1 × 1 | four columns under a beamed timber ceiling 4 m up, open on every side; its roof is the next level's ground |
| `jungle.arch_hall` Arched Vault | 1 × 1 | a 5.2 m passage N–S under a carved vault (3.5 m crown), roots breaking through; its top is the next level's ground |
| `jungle.watch_tower` Jungle Watch Tower | 1 × 1 | the Medieval Watchtower's frame in lashed timber: switchback stair to a lookout 7 m up, palm thatch, a crossbar for a Zipline Post |
| `jungle.chasm` / `chasm_steps` / `chasm_bridge` | 1 × 1 | a 5 m gorge 4 m deep E–W (add Water for a river); Gorge Steps out of its west end; a Chasm with a 3 m rope bridge across N–S at ground level |
| `jungle.rope_bridge` / `stone_bridge` | 1 × 1 | bridge decks N–S with nothing underneath (rope with netting sides, 3 m; carved stone with balustrades, 3.4 m): lay them a level up between terraces, roofs and towers |
| `jungle.waterfall_wall` Waterfall Wall | 1 × 1 | an 8 m carved wall on the north edge with a serpent spout (stand the Waterfall prop under it), a pool sunk 1 m (add Water), a passage through behind the falls; its top is a walk two levels up |
| `jungle.overgrown_ruin` Overgrown Ruins | 1 × 1 | broken carved walls N and W, a broken column, a fallen drum, an overgrown beam, roots: scattered cover |

Every stair keeps the Medieval pack's navmesh rules (treads 0.42 m or longer, flights 2 m wide or wider, about
2 m of floor at both ends, turns on full-width landings, floor holes 0.3 m past the steps).
`test/stylePacksJungle.test.ts` walks bots up the terrace stairs (stacked too), onto the temple roof and the
colonnade roof beside it, the shrine, the tower lookout, across both bridge spans and the chasm rope bridge, out
by the gorge steps and through the arch wall, the vaults and the passage behind the falls, in all four
rotations; it validates every tile on its own and loads every map that uses jungle pieces.

**Props** (26, category *Jungle Ruins*, `jt_*`, `tools/content/prepare-jungle.mjs`, built in code, licence
Owned): Zipline Post, Crane and Pulley, Wooden Platform, Temple Guardian (Large and Small), Stone Obelisk,
Temple Spire, Fire Bowl, Hanging Brazier, Wall Torch, Teal and Red Temple Banners, Tree Root Arch, Mossy Tree
Trunk, Jungle Plant Cluster, Stone Planter, Temple Pottery, Rubble Pile, Collapsed Column, Broken Column, Stone
Sarcophagus, Spike Row, Chain Rail, Rope Rail, Temple Altar, Overgrown Beam. Temple Guardian (Large), Crane and
Pulley and Zipline Post are simple stand-ins under stable ids (`jt_statue_large`, `jt_crane`,
`jt_zipline_post`): a hero model (Meshy, with the owner's approval) can take the same id later. The pack also
lists the 17 earlier `jg_*` props, the ruins, rocks, jungle plants, expedition camp, crates and barrels already
in the game.

**Materials** (procedural, `client/materials/patterns.ts`; ambientCG is not reachable from the build
container): Mossy Stone Slab (`slabs`), Carved Temple Stone (`fret`: step-fret courses), Relief Carving
(`relief`: faces, sun discs, serpents), Temple Inlay Tiles (`inlay`: teal and gold), Root Cover (`roots`),
Mossy Planks, Temple Sandstone, Palm Thatch (`thatch`).

**Gameplay pieces**: the Portcullis door and Portcullis gate mover (in the Carved Temple's gate), braziers and
wall torches (lights), ladders (rope ladders and vines), with the pack's rope bridges, crumbling planks,
falling rocks, spikes, flames, water and swamp. **Zipline:** the pack lists the real *Zipline* (see
[Ziplines](#ziplines-simziplinets-format-v25)); the Zipline Post prop stays as scenery, and the Grapple Hook
still crosses between high points no line joins. Vinefall Sanctum has two gorge ziplines.

## Materials and themes (`content/materials.json`)

The tables are data (how to add one: docs/CONTENT_PIPELINE.md, "Materials and themes"); `map/materials.ts`
keeps the types, the pattern and category lists and the lookups. Counts below are from when the library began.

28 procedural materials (Sandbags added since) plus 49 scanned sets from ambientCG (CC0), prepared by
`node tools/content/prepare-textures.mjs` into `public/textures` (512 px colour,
normal and emission maps; `--only <ids>` fetches just new sets). 22 themes
assign a material to each slot (floor, walls, pillars/cover/steps, underside,
trim).

## Props (`content/props/<pack>.json`)

145 props from eight Kenney kits (CC0), prepared by
`node tools/content/prepare-props.mjs`: centred, stood on the floor, scaled to
real size, texture embedded. The script also writes
`packages/shared/src/content/props.generated.ts` with each prop's size,
collision (box, trunk or none) and, for 84 of them, health and an optional
explosion. Solid props collide for players, shots and bots; breakable ones are
scenario colliders that disappear when destroyed (and fire the `destroyed`
logic event). Props can be turned freely, scaled 0.25–4×, tinted and made
walk-through in the inspector.

## Terrain (`map/terrain.ts`, format v7)

A map can have one terrain: a height grid (up to 321 × 321 vertices since map
format v32, 161 before; a new terrain is 2 m apart, or 2.5-4 m past 320 m, so
at most 161 a side) with a ground material per cell. Grounds are
grass, dirt, stone, sand, gravel, snow, moss and mud, each drawn with an
ambientCG texture. Heights are stored in whole centimetres, so maps stay
small and exact.

- **Game.** The terrain is one triangle mesh in physics (players, shots and
  grenades) and in the navmesh (bots path over hills). Optional invisible walls
  round the edge keep everyone in. The kill height drops below the lowest
  ground. The minimap and map cards draw it top-down, lighter on high ground.
- **MapMaker, Terrain tab.** Create a 96–320 m terrain in any ground, then hold
  the left button to sculpt: Raise (Shift lowers), Lower, Smooth, Flatten (to
  the height where the stroke started), Roughen, or Paint a ground. `[` and `]`
  change the brush size; `T` cycles brushes. Each stroke is one undo step.
  "Paint steep slopes as stone" turns every face over 35° into rock.
  **Smooth all** (Light 1.5 m, Medium 2.5 m, Strong 4 m: the Gaussian's
  reach) smooths the whole ground in one undo step (`smoothTerrain`);
  with "Keep the ground under blocks" (on by default) the vertices under
  every block standing on the ground, and 1.5 m round it, stay put
  (`terrainHoldMask`), and spawns, pickups, flags, hills, vehicles and props
  standing on the ground move with it. Spawns,
  pickups and props placed over terrain stand on it. New terrain sits 15 cm
  under level 0, so tiles placed on flat ground do not flicker against it.
- **MapMaker, Terrain → Change grid…** (format v32; `editor/changeGrid.ts`).
  Resamples the terrain to vertices 1, 1.25, 1.5, 2, 2.5, 3 or 4 m apart (a
  380 m map can go to 1.25 m: 305 × 257), in one undo step. The dialog shows
  the grid, vertices and triangles now and after, and the map file against its
  2 MB budget, and says when the size changes (a width that isn't a whole
  number of the new cells grows or shrinks by under half a cell). Heights where
  old and new vertices meet stay exactly; between them **Smooth** (default)
  draws a cubic through the old heights, kept inside each old cell's corners,
  and keeps the old surface wherever the ground round it is steeper than
  30-45°, so cliffs keep their sharp foot and lip; **Exact** keeps the old
  surface everywhere. Ground paint and plants come across per cell (finer: the
  old cell each new one lies in; coarser: the commonest under it). Spawns,
  pickups, props, vehicles, flags and hills on the ground move with it. Cells
  finer than 2 m grow plants in proportion to their area (as many to the
  square metre as a 2.5 m grid: owner, 2026-11-09). In the file the terrain's grids are written a
  grid row to a line, so a 321 × 321 terrain is about 1 MB.
- **MapMaker, Terrain → Real places (owner only, like Publish).** For a map of
  a real place. **Heights from a height grid file** reads an ESRI ASCII grid
  (`.asc`: `ncols`, `nrows`, `xllcorner`/`yllcorner` or `xllcenter`/`yllcenter`,
  `cellsize`, `NODATA_value`, then the heights, north row first) whose x is the
  map's x (east) and y the map's z (north), in metres. It becomes the terrain
  in one undo step: its cell size as the grid (coarser when the file has more
  than 161 heights along a side: 401 × 301 heights at 1 m become 161 × 121 at
  2.5 m, each height the average of the file round it, not a point sample,
  which would alias lidar's small bumps into a jagged surface), the height
  typed into "Ground level" (or the file's height at the centre point) at
  y 0, ground paint and plants kept where the old terrain reached, missing
  data filled from its neighbours (`editor/heightGrid.ts`). **Smoothing**
  (Off, Light 1 m, Medium 2 m (default), Strong 3.5 m) runs a Gaussian over
  the file first: bumps go, slopes keep their gradient and banks and knolls
  wider than a few metres their shape.
  **Trace image** lays a picture (a plan, a map render; north up) over the
  ground at the edges typed in, see-through, drawn over everything, to build
  on. Neither file is kept in the map, and players never bring files in
  (CLAUDE.md, content rules). St. John's was made this way
  (docs/references/ST_JOHNS.md).
- **Rockfall Canyon** (`maps/canyon.json`, built by
  `pnpm --filter @tiletrigger/server build-canyon`) is the worked example: a
  240 m canyon between rock walls, two hills, a ledge along the west wall, a
  winding dirt trail, boulder fields from scaled rock props, and a bunker
  base at each end with stairs to a railed roof. Open it from the MapMaker
  templates to remix it.

## Curves, balconies, tall walls and the boundary (format v8)

Boxes can be turned about the vertical axis (`WorldBox.yaw`), in physics, the
navmesh, rendering (texture runs along the turned face), MapMaker picking and
the top-down plans. Curves are runs of short turned boxes that overlap by a
few centimetres, with baseboard and cornice trim on both faces, so they sit
in the same themes and paint slots as straight walls.

- **Round Corner (S / M / L)**: a quarter-circle wall over 1, 2 × 2 or
  3 × 3 cells, centred on the piece's south-west corner. Its ends meet the
  straight walls of neighbouring rooms exactly. From inside it is a room with
  a rounded corner; from outside, a building's rounded corner. Join rooms on
  its south and west sides; its north and east sides are left open.
- **Round Arcade (S / M / L)**: the same curve as a colonnade of arches
  (cloister inside, portico outside). **Round Low Wall** is the waist-high
  version.
- **Round Tower**: a round room in a 2 × 2 patch of open ground, doorway
  south, windows round it. **Curved Corridor** sweeps from a south doorway
  round to a west one.
- **Balcony** and **Round Balcony**: railed ledges off an upper doorway on
  their south side; place them a level up beside a room's upper floor.
- **Wall styles** (Walls & Openings tool): High wall (2 storeys), Towering
  wall (4 storeys) and Tall fence (3 m bars you can see and shoot through),
  next to the earlier doors, windows, arches and railings.
- **Boundary** (Map properties): None, Invisible walls, Solid walls or Tall
  fence round a rectangle. Choosing a style fits it round everything built,
  4 m out; "Fit to map" refits; the edges and height can be typed in. An
  invisible barrier always reaches 60 m up, so nothing is thrown or jumped
  out. MapMaker shows it as an orange outline (see "Where you can build"), and
  spawns outside it are an error.

## Drop routes: transport plane and dropship (`sim/airplane.ts`)

The **Paths, Roads & Routes** group (Terrain pane) has **Plane Drop Route** and
**Dropship Drop Route**; both place an `airplane` entity (the Transport Plane is
also in Game Modes & Objectives). Its inspector picks the **Aircraft** (`craft`:
transport plane, 24 benches, or the Dropship's model, 12), altitude, lap time,
loop or one way, and **Air drop** (off / round start / every spawn). **Draw route
on the map** edits the points with the Paths tool's hands (click adds, drag
moves, Shift-click inserts, right-click or Del removes). Draw it in and out of
the map's boundary freely (a run-in from off the map): the route is drawn green
over the play area and grey outside it.

Riders (players and bots) can only jump out (Space or E) while the craft's tail
ramp and the spot they'd land on are over the **play area** (the boundary, or
without one what's built and the terrain, 3 m in from the edge) and over ground:
not the void of a sky map, lava or acid. A jump elsewhere is refused with "Not
over the drop zone". Anyone still aboard when the craft leaves that stretch (or
an open route ends over it) is dropped at its last good point. Bots choose a
jump point near their objective whose landing is on their navmesh. A route that
never crosses the play area is flagged (`airplane.nodrop`).

## Jump pads

A **Jump Pad** (Entities → Scenario) throws whoever steps on it
up (`power`, m/s) and along its arrows (`push`, m/s). The inspector shows
roughly how high and how far that is. Launches are predicted on the client
like any other movement. Each pad's flight is traced to where it lands and
added to the navmesh as a one-way link, so bots ride pads too, and ledges
reachable only by pad count as reachable for map validation.

## Ziplines (`sim/zipline.ts`, format v25)

A **Zipline** (palette *Zipline*, Objects & Logic → Platforms & Climbing; `kind: 'zipline'`) is a cable
between two timber posts. `position` is the foot of the start post and `end` the foot of the far post as an
offset from it (moving the zipline moves both); the cable runs between the posts' tops, `height` m above each
foot (2.5–8, default 3.6). Options: `speed` (m/s, 3–30, default 12), `twoWay` (else only start → end),
`team` (only that team rides it) and `sag` (how far the drawn cable droops, a share of its length; riders hang
from it as drawn).

- **Placing:** the palette puts the start post where you click, the far post 16 m along the facing, level
  with it. *Place ends on the map* (inspector) arms the Route tool's hands for its two ends: a click on the
  ground or a platform puts the far end there (click the start first to move that one), and either end drags;
  the cable is drawn while you drag. The inspector also has the far end's X, height and Z, post height,
  speed, *Both ways*, *Team only*, droop, and the line's length, slope and ride time.
- **Riding:** E within reach of the cable (up to 1.5 m to the side, 0.9–4.2 m overhead: under either post or
  anywhere along it) grabs it. You hang below it (feet a body length and a hand under the cable) and ride
  toward the far end: a one-way line always toward its end; a two-way line toward the other end when you
  grab near one, otherwise the way you face. The trolley holds the set speed, uphill too; downhill gravity
  speeds you up to 1.6× it. Jump or E lets go and keeps the ride's momentum (a jump adds a hop); at the far
  end you're dropped off 1 m before the post onto whatever is under it. A hit of 30 or more knocks you off.
  One hand holds the trolley: sidearms and blades fire while riding (with the air spread), two-handed guns
  don't until you let go. Shared deterministic sim, host-authoritative and predicted on the client like any
  movement; the snapshot carries `zl` (docs/MULTIPLAYER_PROTOCOL.md).
- **Looks and sound:** posts with a footing, an arm and a pulley block; a steel cable (a tube along the droop);
  a trolley with a T-bar over each rider's head (riders use the air pose); the trolley's whirr (the synth
  `hum`, pitched by speed); in first person the view banks with the ride.
- **Bots:** each line is a one-way navmesh link from where it's grabbed to where it drops you (both ways on a
  two-way line), so bots ride it when it shortens the route (Recast costs it by its length) and press E at
  the grab spot; a team line is shut to the other teams.
- **Validator:** too short (< 6 m) or long (> 160 m), too steep (> 35°): errors. With the level (MapMaker's
  navigation check, `validate-map`, the server): the cable or a hanging rider's body blocked anywhere along it
  (the same body check the ride makes every tick) is an error; ground too far below the grab point
  (`zipline.out_of_reach`), nothing to land on at the end (`zipline.no_landing`) and grab or drop points off
  the navmesh (`nav.zipline_end`) are warnings.

## Airliner (shell and cabin kit)

MapMaker category **Airliner Cabin**. The **Airliner (Widebody Shell)** (`prop.airliner_shell`) is a Meshy
Community widebody (CC0) (white livery, 68.4 m long, 59.9 m span, 21.6 m to the fin tip: a real widebody grown about a sixth so
a two-aisle cabin fits). Its doors are cut open (L1/R1, L2/R2, the over-wing exits, the rear doors), and it collides
as boxes: wings, engines, the fin and stabilisers, the gear, and the body as hollow bands round the cabin with gaps at
the doors, so the cabin kit goes inside it. Alone it is an empty hull you can walk into; with the kit it is a plane.

The **cabin kit** is built in code from the shell's own measured cross-section (tools/content/prepare-cabin.mjs) and
sits a few centimetres inside it: sidewall panels with windows (glass you see the world through: the shell's inner
faces are not drawn), carpet with a runner down each aisle, a flat ceiling at 2.55 m with light strips, the openings
lined and signed. Sections snap end to end on 0.9 m window bays:

| Piece | Length | What it is |
|---|---|---|
| Cabin: Nose & Flight Deck | 9.75 m | windscreen, instrument panel, pedestal, overhead panel; bulkhead with a 1.6 m doorway; the forward cabin and the L1/R1 doors |
| Cabin: Door Section | 3.6 m | a door each side, centred (the shell's L2/R2) |
| Cabin: Straight Section / Short Section | 3.6 m / 1.8 m | windows every 0.9 m |
| Cabin: Over-Wing Exits | 3.6 m | an exit each side, centred, up a 0.25 m sill onto the wing root |
| Cabin: Tail & Rear Doors | 11.45 m | the taper, the rear doors, two lavatories, the aft galley, the pressure bulkhead |

Fittings: Economy Seats (Triple, Pair) for a 2-3-2 layout with 1.2 m aisles, Business Seat (a pod; 1-1-1 suites),
Pilot Seat, Overhead Bins (3.6 m and 1.8 m: both sides and the centre; set at 1.95 m above the floor), Galley,
Lavatory, Cabin Divider and Boarding Stairs (a stair truck up to the cabin floor, 27 steps of 0.25 m, 2 m wide; its
platform end goes against the door).

**Bots in the cabin.** The navmesh keeps about 0.8 m off every obstacle, so a lane needs 2 m between collision boxes.
Seat rows collide to their backrests' tops but 0.4 m short of each aisle (players brush into the aisle seats), the
business pods 0.2 m short of each side, and every opening's collision gap is at least 2 m wide (the shell's cut holes
stay on its painted doors; players brush the jambs). Keep a fitting in the middle of the cabin (the galley, a
divider) at least 2 m clear of the rows round it, and never two in line, or the aisles between them close off.

**Assembling** (shell at (sx, sy, sz), facing 0; positions are what the inspector shows; z along the shell): cabin
floor at sy + 6.79. Nose at (sx, sy + 4.011, sz + 28.525); every other section at height sy + 4.107 and centre z:
straight sz + 21.85, 18.25, 14.65; door sz + 11.05; straight sz + 7.45; short sz + 4.75; over-wing sz + 2.05;
straight sz − 1.55, −5.15, −8.75, −12.35; tail sz − 19.875 (assets-src/tiletrigger-cabin/assembly.json). Bins at
sy + 8.74 over the straight and short sections (not over the door and exit sections). The shell's doors: L1/R1 at
z 24.2–25.62, L2/R2 10.3–11.8, the exits 1.28–2.82, the rear doors −23.2 to −21.7 (shell frame); the hull at the
floor stands 2.97 m out at L1 and 2.28 m at the rear doors. Runway Nine has it all assembled at gate 9: copy from
there.

## Interior dressing (`map/dressing.ts`)

Furnishes a room so it reads as what it is, from a recipe per room type:
kitchen, dining, living, bedroom, bathroom, office, classroom, library,
storage, warehouse, barracks, lab, bar / restaurant, shop, garage /
workshop, chapel, prison cell, armoury, server room, lobby / reception,
conference, Victorian parlour, crypt, conservatory and temple shrine. A recipe is data (`DRESS_RECIPES`): items of props, each a slot,
how many per cell of floor (49 m²), a minimum and a maximum.

| Slot | What goes there | Examples |
|---|---|---|
| wall | Backs to a wall, facing in; far from the doors, near them, centred on the front wall (opposite the main door) or anywhere | Bed between nightstands, a run of kitchen units, bookcases, lockers, computer banks, the altar |
| centre | Groups that share one turn and one lattice, nearest the middle (or in rows facing the front) | Table and chairs, sofa and armchairs round a coffee table on a rug, rows of desks or pews, back-to-back shelving |
| corner | Inside corners, turned to face into the room | Plants, lamps, bins, urns, drums |
| decor | On the wall above what stands in front of it | Shelves, banners, sword mounts |

Placement is seeded (same seed, same room) on a 0.2 m occupancy grid of the
room's floor:
- **Doorways** keep 1.5 m clear in front; **windows**, firing slits, half walls,
  railings and bars 0.9 m; spawns, pickups and set pieces 1.2 m; hills, bomb
  sites and zones 2.5 m round their middle; the foot of a flight of stairs and
  the edges of an upper floor's stair hole or mezzanine stay clear too.
- Pieces never overlap each other or what the room already has (its own
  pillars, cover and furniture, props, free blocks).
- After every solid piece, every doorway that had a **2 m walking lane** to
  the others still has one, and most of the room's open floor stays reachable
  (sparse 60 %, normal 45 %, full 35 %). 2 m, not 1 m: bots' navmesh keeps
  0.8 m off obstacles, so this is the lane the validator's reachability check
  and the bots can follow.
- Recipes mix in waist-high solid pieces (counters, desks, tables, crates):
  every room type leaves cover to fight round.
- **Density** (sparse, normal, full) scales the counts (×0.55, ×1, ×1.5).
  **Budgets**: at most 48 props a room (`max`), and with `models` it only
  picks models the map already uses once it is at its budget of different
  models (80, see MAP_BUDGETS.md).

`dressSpace(map, cells)` reads a room from a map: the floor inside its walls
(upper storeys use their partial floors), the walls to back onto, the
doorways and windows from the resolved edges, and what already stands
there. `dressRoom(space, type, options)` returns prop entities without IDs;
`dressMapRoom(map, cell, type)` does both for the room tile covering a cell;
`guessRoomType(space, theme)` picks a plausible type from the room's size and
the theme. In MapMaker, the tile inspector of a room, hall or building has
**Dress room**: a room type (guessed to start with), a density, a storey for
buildings, and Dress / Re-roll / Clear. The pieces are ordinary props (IDs
`dr_<room>_<n>`), added in one undoable step, so creators dress, then move or
delete what they like; dressing again or re-rolling replaces them. The map
panel's **Dress all bare rooms** dresses every room with no props in it as a
type guessed from its size and the theme.

**Hills and a volcano** (Environment → Sky → Scenery, any map): dry hills round the map and a lone volcano far to the
north (`client/src/backdrop.ts` `volcano`): a cone scored with gullies, a steady ember glow on its crater floor (an
unlit colour, no light) and a still plume of see-through smoke puffs leaning east. Nothing moves or flickers, so it is
the same under Reduce flashing. The belt past the border is rocks only.

**A saved piece's definition goes with its last placement:** a map carries the definitions of its own set pieces
(`setPieceDefs`) only while something places them; exploding or deleting the last placement drops it (one undo step
brings both back; the piece stays in your library). A saved piece's frame starts at the least cell and level of what
was selected, entities included: a light or ladder a level below the tiles puts the tiles a level up in the piece, so
place it a level lower (or leave such entities out of the selection).

## Every map is made in MapMaker

Official maps are their files in `maps/<id>.json`, made and edited in
MapMaker like anyone's map. They used to be generated by one build script
each (`packages/server/src/tools/maps/`, through `mapkit.ts`, which drove
MapMaker's own edit commands); those scripts were retired on 2026-10-28 so
that an edit made in MapMaker is never overwritten (git history has them).
A new piece a map needs goes into MapMaker's palette or inspector, not into
a script. Every map in `maps/` shows up in the Arcade and as a MapMaker
template automatically.

## Measuring and placing props (MapMaker)

- **Measure (U).** Click two points: the distance, the height difference and the slope (degrees and percent), and
  whether a player could make it, from the ground and surfaces along the line (sampled every 25 cm): the steepest
  step (walk up to 0.3 m, jump up to 1.22 m; a slope you can walk up, under 50°, is no step) and the widest gap (a pit
  you couldn't climb out of; jumpable when a sprinting jump to the far edge's height carries that far). A ditch you can
  climb out of is a drop and a step, not a gap. A third click chains a path and shows its total. Points snap to the grid (the
  Snap setting), to surfaces and to the middle of an object's top; Ctrl or Alt for no snap. Right-click takes a point
  back; Esc clears it. Nothing measured goes in the map.
- **Props drop onto what's under the pointer**: a tabletop, a roof, a ledge, the ground. The see-through preview shows
  where. Against a wall, the prop stands at its foot. Ctrl (or Shift) places it off the grid.
- **Randomise** (Props tab, above the pieces; off by default): each prop you place gets a random turn, size and
  variant within the ranges you pick, the preview showing the next one.
- **Turning by mouse.** With Select, drag the yellow ring round the selection's gizmo: it turns by the selected
  thing's own step (the same as R; Shift: the finer step), the angle by the pointer; Esc cancels. Tiles, set pieces,
  zones and water turn in quarter turns. The inspector's **Face** buttons (0°, 90°, 180°, 270°) set a facing in one
  click; 0° faces north (+Z), 90° east (+X).

## Testing, the plan and the card shot (MapMaker)

- **Play from here (Shift+F5, ▶ Here).** Fly to where you want to stand and look the way you want to face: the test
  match starts you on the floor, roof or ground below the camera (the nearest spot with room to stand, up to 4 m
  round). It says why when it can't (nothing below, no room, too steep, outside the boundary). In the plan view it
  starts you on the level shown, under the middle of the view. Esc (twice in a browser with the mouse captured) or
  the pause menu's Back to MapMaker brings you back where you were, undo and all.
- **The plan view (K, Plan).** The level being edited from straight above, cut 0.6 of a level above its floor, so
  roofs and the levels above are out of the way. Tiles are outlined in white (the level below dashed); icons show the
  spawns (team colours, pointing the way they face), flags, hills (with their zones), objectives (bomb sites,
  Breakthrough objectives, hostages and rescue zones, with their letters) and pickups. PgUp / PgDn change the level;
  select, move and place as in 3D; the wheel zooms about the pointer, a right or middle drag (or WASD) pans, Home
  fits the map, F centres the selection. **Export PNG** downloads the plan with a scale bar, a north arrow and a key.
- **The card shot (Map properties → Card shot).** Set card shot… shows the menu card's frame (16:9) with the card
  picture's own lens; Eye level (on by default) keeps the camera 1.7 m over what's under it as you fly. Enter saves
  the camera in the map (`metadata.cardCamera`), Esc cancels; Preview shows the saved shot in the frame; Clear goes
  back to the automatic camera. The card picture (`maps/shots/<id>.jpg`, 640×360) is rendered from it by
  `tools/content/capture-map-shots.mjs`; MapMaker stores no picture for it (Set thumbnail is the maker's own picture).
- **Bot test (the top bar).** Opens the Test panel, beside the view; keep building while it's open.
  - **Run bots:** a bot match on the map as it is now, played in the background (its own worker): the mode (those the
    map plays), Bots a team (team modes) or Bots (free-for-all, up to 32), and the length (30 s to 5 min). The bar shows
    how far it got; Cancel ends it at once. Then a summary (kills, stuck recoveries, failed route searches, the
    objective's first moments; King of the Hill's hill time) and four heatmaps, each on its own box: **where bots
    went** (blue few, red many), **where they got stuck** (magenta), **where they died** (red) and **where routes
    failed** (orange), lying on the floors they happened on. They show from above in the plan view too (levels above
    the one shown are cut away). Read them as: red blobs of "went" are the busy lanes, blue or empty rooms nobody
    uses; stuck and failed spots are places to open up (a step too high, a gap, a door with no way round).
  - **Check spawns:** each spawn labelled with the share of the map that sees it (places anyone can walk to, looking
    from eye height at a player's chest, out to 120 m) and how far off the furthest is; its three longest lines of
    sight drawn (red when it's exposed), with the map's long sightlines (yellow, 50 m and more). Spawns half the map
    or more can see are warned about in the list of problems until the map is edited; check again after fixing them
    (a wall, a crate, a corner).
  - Nothing here goes in the map. Clear removes what's drawn.

## Groups, copy and paste, templates, mirror and notes (MapMaker)

- **Groups (Ctrl+G).** Select things (box-select, Shift+click) and group them: a click on any of them then picks the
  lot (Alt-click picks one), so it moves, turns, flips (M), duplicates (a group again) and deletes as one. Name it in
  the inspector; Ctrl+Shift+G (or Ungroup) takes the group away and leaves the things. Groups stay in their map: to
  reuse a build in other maps, save it as a set piece.
- **Copy and paste (Ctrl+C, Ctrl+V).** The copy is kept in this browser; paste puts it where the pointer is (its
  middle cell on the cell under the pointer) on the level you are editing, with new ids, in this map or another. The
  map it goes into must have the same grid and theme; MapMaker says why when it doesn't, or when it wouldn't fit there.
- **Templates (New map → start from a layout).** Arena, Symmetric CTF, Assault (Breakthrough, two sectors and a final
  hold) or Open terrain. The new map is your own; the layouts live in `maps/templates/` and never show in map lists.
- **Mirror… (Shift+M).** For team maps: build one side, mirror it. Pick the selection or half the map, the line
  (east ↔ west, north ↔ south) or a point (a half turn) and where it is (it snaps to a cell's middle or edge). Keep
  the original adds a mirrored copy, whose team things swap to the other team (spawns, flag bases, team zones, doors,
  buttons, team vehicles); untick it to flip the selection itself. Half the map copies one half onto the other, which
  must be empty; things on the line stay. The dialog says what it will do before you press Mirror. Tiles that have no
  mirror image among their turns (most model buildings) can only go through a point. Terrain and paths are left as
  they are.
- **Note pins (J).** Notes for the map's makers ("too long a sightline from B"): click the map to pin one, click a pin
  to read or edit it (Ctrl+Enter saves), drag it to move it. Map properties → Notes lists them. They are saved in the
  map and never shown in play.

## Bot hints (MapMaker, format v33)

Bots work out good spots themselves (sniper and camp spots, parkour jumps). Bot hints add what they miss: the Entities
tab → **Bot hints** (or **Y**, the last kind you used).
- **Chokepoint, Sniper spot, Camp spot, Staging spot:** click the ground, a floor or a roof. It faces the way you look
  (in 45° steps); R turns the selected one (Shift+R a finer step).
- **Jump link:** click where the jump starts, then where it lands (Esc drops a half-placed one). The inspector says
  whether a player can make it, and the issues list warns when one can't.
- Each shows as an icon pin with its radius and facing (a jump: its arc) in the 3D view and the plan view (K), in
  MapMaker only. Click a pin to edit it in the inspector: kind, facing, radius, which team it is for (or every side),
  where it is (and a jump's landing), Go to, Delete. With the tool in hand, drag a pin to move it. Each edit is one undo
  step.
- **What bots know** (the tick box in the group) draws the bots' own computed spots in grey, read-only: sniper and camp
  spots and parkour links. Add hints only where they're missing. (Bots work out no chokepoints or staging spots.)
- Warnings: a hint outside the boundary or off the navmesh (no bot can stand there), a jump no one could make, two of a
  kind on one spot. The format is in docs/BOTS.md, "Bot hints (map data)".

## Backdrops and plants

Skies, distant scenery, ground past the border, terrain plants and the Nature tab's Environment group and brush (our trees, plants, rocks and cliffs: placing, painting, presets, filters, keep-clear and the collision preview) are covered in [SCENERY.md](SCENERY.md).

### Time of day and weather (map format v34)

Map properties (nothing selected) → **Time of day & weather**:
- **Time of day:** tick it and drag the slider (quarter hours), or click Dawn, Morning, Noon, Afternoon, Dusk or Night.
  The view shows the time as you drag; letting go sets it (one undo step). The map's sky (Environment → Sky) is its
  look by day; the time moves the sun (east at dawn, high in the south at noon, west at dusk, the moon at night) and
  blends the light and the sky towards sunrise, sunset, dusk and night. Untick it for the sky's own look. A starfield
  has no sun: the time changes nothing under it. It is fixed for the match.
- **Weather:** None, Rain or Snow, then **How hard**, **Wind** and **Fog banks** (each 0-100, previewed as you drag,
  one undo step each). Fog is the weather's one effect on play: everyone sees less far (fog banks at 50: about 360 m;
  at 100: about 180 m). Rain and wind have their sounds; rain fades under a roof. Low graphics draw no rain or snow,
  only the fog. The host may play another weather (Match setup, the Host tab).

Free blocks (sky platforms, crumbling floors, trapdoors, pitched ramps and roofs, movers), liquids (and their colours) and the jetpack are in [SET_PIECES.md](SET_PIECES.md); size limits in [MAP_BUDGETS.md](MAP_BUDGETS.md).

Map format v20 adds: the `mover` entity; light `off`/`blink`; block
`pitch`/`roll`/`startHidden`; liquid `tint`; `team` on buttons, doors and
zones; and the logic events, conditions and actions for lights, blocks and
movers. All of it is optional, so v19 maps load unchanged (the v19 → v20
migration is the identity).
