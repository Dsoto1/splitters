# Scenery: backdrops and vegetation

What surrounds a map and what grows on it. All of it is drawn only: nothing
here blocks players, bots or shots, except a border (see Borders) and trees
and rocks placed as props (their trunks are solid, like any prop).

## Backdrop

Every map has a backdrop, set in MapMaker under **Map
properties → Backdrop** (click empty space with the Select tool), or in a map
script with `m.backdrop(sky, scenery, ground, haze, mist)`:

| Part | Choices |
|---|---|
| **Sky** | Clear day, Partly cloudy, Overcast, Misty morning, Sunrise, Sunset, Dusk, Night, Stormy, Snowy (photographs), Starfield, Plain colour (the theme's) |
| **Scenery** | None, Rolling hills, Mountains, Snowy peaks, Mesas, Dunes, Forest, City skyline, Open sea |
| **Ground beyond** | Any terrain ground (grass, dirt, stone, sand, gravel, snow, moss, dark earth), Water, or None (floating in the sky or space) |
| **Haze** | 0 (crystal clear) to 100% (thick): fades the distance into the horizon colour |
| **Ground mist** | 0 (none, the default) to 100%: fog that pools in low ground (valleys, ditches, the canyon floor) and thins with height, so hilltops stand clear. Medium and high graphics |

A map that hasn't chosen one uses its **theme's backdrop** (`THEME_BACKDROPS`
in `packages/shared/src/map/backdrop.ts`): Desert Town gets a clear sky over
mesas, Arctic Base snowy peaks, Neon City a night skyline, Space Station a
starfield, and so on. With terrain, the ground beyond follows the terrain's
commonest edge material, so the land carries on seamlessly past the border.
**Use the theme's backdrop** in the panel goes back to the default.

Ground mist and light shafts (`packages/client/src/game/skyEffects.ts`): the
mist is a screen pass over the camera-space depth that integrates a density
falling off exponentially with height along each view ray (base: the lowest
fifth of the terrain, or the ground floor), in the horizon colour. On high
graphics, sunny skies (clear, cloudy, sunrise, sunset, dusk, misty, snowy) cast
shafts of light past whatever stands between you and the sun (volumetric light
scattering from a sun disc kept far out along the sun's direction). Mist is set
on Coldwater Gulch, Backwoods, Step Temple, Gallows Yard, Dead Reel, Ridge Camp,
Jade Sanctum and Elm Grove.

How it's drawn (`packages/client/src/backdrop.ts`):

- The sky is an equirectangular photo on a sky box (or a drawn starfield). Its
  lighting (sun colour, height and strength) comes with it, so a sunset map is
  lit warm and low, a night map dim and blue.
- The ground starts at the map's edge (following the terrain's edge heights,
  or just under the lowest floor) and runs 2.4 km out, easing to a plain.
- Scenery is built from code (no models): rings of land with layered-noise
  crests (hills, mountains with snow lines, flat-topped mesas, dunes,
  islands), 2,600 instanced pines for forests, and ~500 towers with lit
  windows at night for the city.
- Haze is exponential fog in the horizon colour: barely there near the action,
  thick at the horizon.

Map format 9 adds `backdrop` (null = the theme's). Older maps load unchanged.

## Borders

A border is what stands just outside the boundary, so the map's edge reads as
a place instead of an invisible wall in front of distant scenery. Set it in
MapMaker under **Map properties → Backdrop → Border** (with **Per side** to mix
styles), or in a map script with `m.border(style, { north, east, south, west })`
(north is the +Z edge, east the +X edge). It lines the boundary rectangle (the
Boundary tool's), or the terrain's edge on a map without one.

| Style | What you see | Gameplay |
|---|---|---|
| **Cliffs & mountains** | Rock walls that leap up within a few metres of the line to ragged crests 22–80 m high, with spires, buttresses, ledges and banded strata (red sandstone in desert country, grey with snow caps in the cold, moss on top elsewhere) | Solid |
| **City blocks** | Three rows of blocks, taller further out; the front row dressed in the city kit's facades (brick, shopfront, plaster) on its lower storeys, every block's other faces in a window texture that lights up at night | Solid |
| **Electric fence** | A park-style fence just inside the line: dark posts every 4 m with insulators, five glowing wires that flicker, yellow high-voltage signs; it hums when you are near | Solid, and touching it zaps (12 damage, at most twice a second) and throws you back into the map |
| **Forest wall** | Undergrowth along the line, a row of the nature kit's trees (snowy on snow, palms on sand), then dense low-poly conifers in front of a dark canopy band | Solid |
| **Shoreline & sea** | A beach running down from the line into a sea to the horizon (at the level of the map's own water where that reaches the edge) | The boundary's own barrier |

Unlike the rest of the backdrop a border is **solid**: `borderBoxes`
(`packages/shared/src/map/border.ts`) adds a barrier band 3 m deep just outside
the line, 12–24 m high depending on the style, so players, shots and bots
(through the navmesh) all meet it, on top of the boundary's own barrier. The
fence's shocks run in the scenario (`Scenario.stepBorderFence`): an `arc` event
draws the spark and plays the zap.

The **Electric Fence** is also a placeable piece (Scenario palette, a `trap` of
kind `shock`): a straight run of `length` metres (2–96, default 12) between
posts, solid along its whole length, that zaps and throws back whoever touches
it while it is on (always on by default; it can cycle or be switched by logic
like any trap, and its wires go dark when off).

How it's drawn (`packages/client/src/borderVisuals.ts`): every style is a
handful of draw calls however long the boundary. Cliffs are one merged mesh,
the beach and sea one each; city blocks one merged mesh plus GPU thin instances
of the facade pieces (one draw per piece and material); the forest thin
instances of each tree and bush model for the front row and one instanced
~40-triangle conifer for the far rows (their stand-in LOD); the fence instanced
posts and signs with one mesh of wire. On the largest map (Apex Ring, 1.58 km
of boundary, skyline and forest) the whole border is 43 meshes, ≈4,700
instances and ≈0.58 M triangles in view looking straight at it; the backdrop's
belt of props steps aside where a border stands, and its ground drops under the
sea along a shoreline.

Borders are set on Rockfall Canyon and Frost Basin (cliffs), Coldwater Gulch
(cliffs), Downtown and Diamond Park (city blocks, lit at night), Backwoods
(forest), Shingle Point (sea to the south, cliffs east and west, woods to the
north) and Apex Ring (city to the north and east, woods to the south and west).

Map format: `backdrop.border` and `backdrop.borderSides` are optional fields
(absent: no border), and the fence trap's `length` is optional, so maps without
them load unchanged and the format stays at version 19.

## Plants on terrain

Terrain grows grass, flowers and bushes by itself: grass cells get grass,
moss gets a little, bare ground (dirt, stone, gravel, sand, snow) stays bare.

To choose, use the **Plants** row in the Terrain tab and paint with it like
ground paint:

| Level | Grows |
|---|---|
| Bare | nothing |
| Sparse | a few tufts |
| Grassy | grass, a few taller tufts, the odd flower |
| Lush | thick grass, flowers, low shrubs |
| Overgrown | long grass, flowers, shrubs and bushes |

Sand grows scrub and stone gets pebbles instead of grass. Steep slopes stay
bare, and nothing grows through floors or walls built on the terrain. The first
plants stroke turns the automatic cover into a painted layer; **Plants follow
the ground** clears it again.

Plants are kept low (ankle to shin height) so they never hide a player. They
are placed the same way on every machine (seeded by the map ID) and drawn as
instances in 32 m chunks, only near the camera: grass within about 60 m,
bushes within 130 m.

Map format 9 adds `terrain.foliage` (empty = from each cell's material).

## Scatter brush (Props tab)

Plants a patch of props in one click, spaced apart, with random turns and
sizes, standing on the terrain:

| Set | Props |
|---|---|
| Pine forest | tall, round and small pines |
| Leafy woods | oaks and round, leafy, bushy and thin trees |
| Autumn woods | autumn oaks and round trees |
| Jungle | palms, flat-top trees, ferns, big bushes |
| Bushes | five kinds of bush |
| Flowers & grass | red, yellow and purple flowers, tall grass, mushrooms |
| Desert scrub | cacti, low plants, stones |
| Rocks | boulders, rocks, stones |

**Brush size** (or `[` `]`) sets the patch radius. **Alt-click** clears that
set's props inside the brush. Each click is one undo step and adds at most 60
props. Plants keep clear of spawns, pickups and vehicles. Trees and rocks are
solid (bots path round them); bushes, flowers and grass can be walked through.

## Sources

- **Skies:** Poly Haven pure-sky photographs (CC0) by Greg Zaal, Jarod Guest
  and Sergej Majboroda, listed in `content/skies.json`. `node
  tools/content/prepare-skies.mjs` downloads and scales them to 2048 × 1024
  JPEGs (25–125 KB each) and records them in `content/skies.lock.json`.
- **Plants and trees:** Kenney Nature Kit 2.1 (CC0), 55 models added to
  `content/props.json` under Trees, Plants & Flowers, and Rocks & Wood.
- Scenery shapes, the starfield and the window texture are generated in code.
- Borders: cliffs, blocks, sea, wires and the far-row conifers are generated in
  code; the forest's front row is the Quaternius Ultimate Nature pack (CC0,
  `nt_*` props), the city facades the Quaternius Downtown City kit (CC0), the
  cliff strata the ambientCG Travertine009 texture (CC0). The fence hum and zap
  are synthesised (`hum` and `arc` recipes).
