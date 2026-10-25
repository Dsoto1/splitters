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
  painted plaster): the outside of a room's walls is dressed bay by bay,
  windows and plain wall in turn on upper floors (a shopfront or brick base
  on the ground floor), bands over doorways and under windows, a cornice
  where nothing is built above and columns on the outer corners. The facade
  stands 0.32 m proud of the wall (past a neighbouring courtyard's own wall)
  with frames round the openings; it is only visual, so doorways and windows
  are exactly our own. Stack rooms with the same facade for taller buildings.
  Downtown (`maps/downtown.json`) shows all of it.

## Materials and themes (`map/materials.ts`)

28 procedural materials plus 41 scanned sets from ambientCG (CC0), prepared by
`node tools/content/prepare-textures.mjs` into `public/textures` (512 px colour,
normal and emission maps). 19 themes assign a material to each slot (floor,
walls, pillars/cover/steps, underside, trim).

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
  "Paint steep slopes as stone" turns every face over 35° into rock. Spawns,
  pickups and props placed over terrain stand on it. New terrain sits 15 cm
  under level 0, so tiles placed on flat ground do not flicker against it.
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

## Jump pads

A **Jump Pad** (Entities → Scenario) throws whoever steps on it
up (`power`, m/s) and along its arrows (`push`, m/s). The inspector shows
roughly how high and how far that is. Launches are predicted on the client
like any other movement. Each pad's flight is traced to where it lands and
added to the navmesh as a one-way link, so bots ride pads too, and ledges
reachable only by pad count as reachable for map validation.

## Scripted maps (`packages/server/src/tools/mapkit.ts`)

`MapBuilder` wraps the MapMaker's edit commands for map build scripts:
- `tile`, `fill` and `edge`;
- `spawn`, `pickup`, `prop`, `breakable`, `mount` and `pad`;
- `theme`, `terrain`, `bounds`, `teams` and `meta`;
- `save`, which validates the map and its navmesh and writes `maps/<id>.json`.

The homage maps are built this way, one script each in
`packages/server/src/tools/maps/`; run one with
`npx tsx src/tools/maps/<id>.ts` in `packages/server`. Every map in `maps/`
shows up in the Arcade and as a MapMaker template automatically.

## Backdrops and plants

Skies, distant scenery, ground past the border, terrain plants and the scatter brush are covered in [SCENERY.md](SCENERY.md).

Free blocks (sky platforms, crumbling floors, trapdoors), liquids and the jetpack are in [SET_PIECES.md](SET_PIECES.md); size limits in [MAP_BUDGETS.md](MAP_BUDGETS.md).
