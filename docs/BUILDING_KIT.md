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
Archway, Window, Twin windows, Firing slit, Half wall, Railing or No wall.
Use the **Walls & Openings** tool (O cycles styles; right-click resets) or the
tile inspector. Choices are stored on the tile in its own frame (they turn with
it) and apply to both halves of a shared wall.

Trim (baseboards, cornices, door and window frames, railing posts) is drawn
with the map but never collides, and has its own paintable slot.

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
  `pnpm --filter @chronosplit/server build-canyon`) is the worked example: a
  240 m canyon between rock walls, two hills, a ledge along the west wall, a
  winding dirt trail, boulder fields from scaled rock props, and a bunker
  base at each end with stairs to a railed roof. Open it from the MapMaker
  templates to remix it.
