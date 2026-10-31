# Building kit, materials and props

Everything here is data in `packages/shared` and works in MapMaker, offline
matches and the dedicated server alike.

## Pieces (`map/catalog.ts`)

37 tiles in six palette groups. Multi-cell pieces build no walls inside
themselves; partial floors (balconies, decks, ledges) are painted like floors.

| Group | Pieces |
|---|---|
| Rooms | Room, Pillar, Columns, Low Cover, Dais, Raised Ledge (1.5 m), Split-Level (1 m), Sunken Room (1.5 m pit), Tall Room (two storeys) |
| Large | Long Room (1×2), Large Room (2×2), Great Hall (3×3), Atrium (2×2, two storeys, balcony all round), Plaza (2×2 open) |
| Corridors | Corridor, Clear, Windowed, Long (1×2), Corner, T, Crossroads, Dead End, Bridge, Catwalk Corner |
| Vertical | Stairs, Stairwell (switchback, doors on both floors), Long Ramp (2 cells), Open Stairs, Watchtower |
| Open | Courtyard (+ crates, low wall, ruins), Platform, Platform with railings, Terrace |
| Special | Pit (to the level below, or a fatal fall), Drop Shaft |

Every climbable piece is tested for bot paths in all four rotations
(`test/kit.test.ts`). Stairs use 0.25 m steps with at least 0.45 m runs
(narrower runs fall foul of the navmesh's ledge filter), and flights need
clear space at both ends.

## Walls and openings (edge styles)

Any side of any cell can be built as: Auto, Solid wall, Doorway, Wide doorway,
Archway, Window, Twin windows, Firing slit, Half wall, Railing, High wall,
Towering wall, Tall fence, Broken wall (a ragged hole with rubble), Bars
(floor-to-ceiling, see and shoot through), Shutter (a wide opening with its
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
- **Ceiling**: Open (as before), Roof, Roof with skylight or Beamed roof. A
  roof is a walkable slab at the top of the walls, left off wherever
  something is built on top.
- **Corners**: Square, Posts, Columns, Chamfered or Rounded, wherever two
  solid walls meet (not beside an archway, railing or half wall).

Every layout and floor is tested for bot paths across the room in every
rotation (`test/roomOptions.test.ts`); cover keeps 2 m off the walls, since
narrower gaps drop out of the bots' navmesh.

Trim (baseboards, cornices, door and window frames, railing posts) is drawn
with the map but never collides, and has its own paintable slot.

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

## Style Packs (`editor/stylePacks.ts`, `map/packTiles.ts`, `map/packTiles2.ts`, `map/packTilesAncient.ts`, `map/packTilesMedieval.ts`)

Sprint 7, Set 1 "Foundation": 01 Military Compound, 02 Frontier Dust, 03
Imperial Arena, 04 Orbital Station, 05 Gothic Estate, 06 Jungle Ruins, 07 Neon
Megacity, 08 Suburban Chaos and 09 Sands of Egypt (the Egypt theme asked for
alongside the set), then 10 Medieval Village (the owner's tileset sheets), one registry (`STYLE_PACKS`, in pack-number order). A Style
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
| Gameplay | **Blast Door** (a door variant: thick, chevroned, in a heavy frame, slower; E or logic opens it), **Alarm Light** (a red bulb that starts off and blinks when a rule switches it on), **Destructible Barrier** (a breakable concrete block, 400 HP, back after 30 s); concrete barriers, gabions, razor wire and ammo crates break, fuel drums and tanks explode; mounted guns are the turret mounts (MG, rockets, sentry); jeep, rover, tank; breakable walls, gas cylinders, laser fences and mines |

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
| Transit | A race track with *Ambient cars* laid on an elevated deck: hover cabs lap it all match, run down anyone in the way and can be shot up or taken (Neon Spire's skytrain, as in Undergate Transit). |

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
| 05 Gothic Estate (Victorian horror) | **Gothic Estate** (`core.gothic_estate`: old floorboards, Damask Wallpaper, walnut, dark panels, brass); Gothic Manor, Castle Keep | **Gothic stone** (buttresses, string course, hood moulds, battlements and pinnacles), **Victorian brick** (stone plinth, quoins, sills and lintels, bracketed cornice) | 8 | 19 (category *Gothic Estate*) | Ravenscroft Hall |
| 06 Jungle Ruins (lost civilisation) | **Jungle Temple** (`core.jungle_temple`: mossy cobbles, mossy castle stone, layered rock); Jungle Ruins, Forest Camp | **Temple stone** (stepped base, glyph frieze, stepped merlons), **Overgrown rock** (moss at foot and top, vines hanging down, never across openings) | 12 | 17 (category *Jungle Ruins*) | Verdant Ziggurat |
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

**Demo maps.** *Sandfall Colosseum* (`maps/sandfall_colosseum.json`, script
`maps/sandfall_colosseum.json`): a 40 × 24 m arena of
sand ringed by seating with the emperor's box on the north, three gladiator
gates (the main one a portcullis worked from a winch in its passage or a chain
on the sand, the side ones rising as anyone comes), two lift cages rising from
the hypogeum through hatches, a beast lift the emperor sends up through a
logic trapdoor, spike traps and fire jets on the sand, outer arcades all round
with four stairs up to the seating, a forum with a temple, colonnade and
triumphal arch to the east, an aqueduct to the west, and a portal from the
hypogeum's west tunnel to the forum that the emperor can seal for 15 s.
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
`mv_tarp_tent`): community downloads can replace them later through `content/props.json` without touching
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


## Materials and themes (`map/materials.ts`)

28 procedural materials plus 49 scanned sets from ambientCG (CC0), prepared by
`node tools/content/prepare-textures.mjs` into `public/textures` (512 px colour,
normal and emission maps; `--only <ids>` fetches just new sets). 22 themes
assign a material to each slot (floor, walls, pillars/cover/steps, underside,
trim).

## Props (`content/props.json`)

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

A map can have one terrain: a height grid (up to 161 × 161 vertices, 2 m apart
by default, so up to 320 m across) with a ground material per cell. Grounds are
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
  out. MapMaker shows it as an orange outline, and spawns outside it are an
  error.

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

## Every map is made in MapMaker

Official maps are their files in `maps/<id>.json`, made and edited in
MapMaker like anyone's map. They used to be generated by one build script
each (`packages/server/src/tools/maps/`, through `mapkit.ts`, which drove
MapMaker's own edit commands); those scripts were retired on 2026-10-28 so
that an edit made in MapMaker is never overwritten (git history has them).
A new piece a map needs goes into MapMaker's palette or inspector, not into
a script. Every map in `maps/` shows up in the Arcade and as a MapMaker
template automatically.

## Backdrops and plants

Skies, distant scenery, ground past the border, terrain plants and the scatter brush are covered in [SCENERY.md](SCENERY.md).

Free blocks (sky platforms, crumbling floors, trapdoors, pitched ramps and roofs, movers), liquids (and their colours) and the jetpack are in [SET_PIECES.md](SET_PIECES.md); size limits in [MAP_BUDGETS.md](MAP_BUDGETS.md).

Map format v20 adds: the `mover` entity; light `off`/`blink`; block
`pitch`/`roll`/`startHidden`; liquid `tint`; `team` on buttons, doors and
zones; and the logic events, conditions and actions for lights, blocks and
movers. All of it is optional, so v19 maps load unchanged (the v19 → v20
migration is the identity).
