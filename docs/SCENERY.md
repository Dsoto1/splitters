# Scenery: backdrops and vegetation

What surrounds a map and what grows on it. All of it is drawn only: nothing
here blocks players, bots or shots, except trees and rocks placed as props
(their trunks are solid, like any prop).

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
