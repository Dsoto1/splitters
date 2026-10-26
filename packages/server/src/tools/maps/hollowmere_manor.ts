/**
 * Hollowmere Manor: an original trap house for 6–14 players (deathmatch, team
 * deathmatch, King of the Hill). A three-storey gothic manor on a hilltop,
 * stormy night, ground mist, with a cellar and crypt underneath. The house is
 * armed: levers and buttons all over it spring traps on whoever is standing
 * in the wrong room, and every trap has a tell (a lever with a red lamp by
 * it, a buzzer or alarm and a message) and a cooldown.
 *
 *   - Study (first floor): the gallery lasers, two rows of laser fences across
 *     the long gallery for 5 s (cooldown 25 s).
 *   - Balcony over the great hall: seal the hall (its five doors lock for
 *     6 s), the red lamps over its trapdoors blink and the spike plates in
 *     its floor fire three times; then the lever springs the hall's three
 *     red-rimmed trapdoors and everyone still in there drops into the crypt.
 *     (They also give way when stood on, and come back after 6 s.)
 *   - Kitchen: cut the chandelier, a crusher over the dining-hall table
 *     (cooldown 15 s).
 *   - Wine cellar: fire the spike plates in the cellar corridor in a ripple
 *     (they also fire when stepped on, with a rumble first).
 *   - Crypt: bar the crypt gates, the iron doors west and east, for 5 s (the
 *     north stairs to the graveyard stay open).
 *   - Library: pull the red book to open the secret door into the hidden
 *     passage for 8 s (a lever inside opens it too). Two bookcase walls (the
 *     library-foyer one and the passage-dining one) can be shot down for good.
 *   - Attic: two patches of rotten floor crumble under you into the gallery.
 *
 * Nothing traps anyone for good: doors always unlock, the crypt has three
 * ways up (stairs to the library, to the parlour and to the graveyard), and
 * the hidden passage has its own lever.
 *
 * Grid x east, y north (one cell = 8 m); levels z-1 cellar, z0 ground, z1 first floor, z2 attic.
 *
 * z0  y5          .   .   g   .   .            g stairs up from the crypt (graveyard house)
 *     y4  K   K   B   B   B   R   R            K kitchen, B back hall, R billiard room
 *     y3  D   D   H   T   H   C   C            D dining hall (crusher), H great hall, T trapdoor (pit)
 *     y2  D   D   T   H   T   C   C            C conservatory (to the east garden)
 *     y1  s   P   S<  F   >S  M   s            S twin stairs, P hidden passage, M music room, s stairs down
 *     y0  L   L   F   F   F   A   A            L library, F foyer (hill), A parlour
 *        -3  -2  -1   0   1   2   3
 * z1  y4  W   W   M   M   M   N   N            W west suite, M master suite, N nursery
 *     y3  T   T   b   b   b   E   .            T trophy room, b balcony over the hall (lever), E east corridor
 *     y2  T   T   .   .   .   E   .
 *     y1  ^   l   s   St  s   l   ^            l landings, St study (laser lever), ^ stairwells to the attic
 *     y0  w   G   G   G   G   G   e            G long gallery (hill, lasers), w/e bedrooms
 * z2  y1      a   a   a   a   a                a attic (armour); x rotten floor
 *     y0      a   x   a   x   a
 * z-1 y4      c   c   c   c   c                c cellar corridor (spike plates)
 *     y3      V   X   X   X   O                X crypt (hill, rockets), V wine cellar (lever), O ossuary
 *     y2  V   V   X   X   X   O   O
 *     y1  s                       s
 */
import { TERRAIN_MATERIALS, newTerrain, paintSlopes, terrainHeightAt, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Rotation, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('hollowmere_manor', 'Hollowmere Manor');
m.theme('manor');
m.backdrop('storm', 'hills', 'grass', 0.6, 0.7);
const P = Math.PI / 2;
type V3 = [number, number, number];
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];

// ---------------------------------------------------------------- surfaces

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const STONE: TileSurfaces = { floor: mat('pbr_flagstone', '#9a9184'), walls: mat('pbr_castle_stone', '#8f877a'), solids: mat('pbr_castle_stone'), trim: mat('pbr_castle_stone', '#6d6a64') };
const CRYPT: TileSurfaces = { floor: mat('pbr_marble_black'), walls: mat('pbr_castle_stone', '#7a7468'), solids: mat('pbr_castle_stone', '#6a645a'), trim: mat('pbr_castle_stone', '#5a564e') };
const ATTIC: TileSurfaces = { floor: mat('pbr_floorboards', '#9a8a74'), walls: mat('pbr_planks', '#7a6a58'), solids: mat('pbr_planks'), trim: mat('pbr_charred_wood') };
const KITCHEN: TileSurfaces = { floor: mat('pbr_delft'), walls: mat('pbr_plaster_white', '#d9d0bd') };
const GLASS: TileSurfaces = { floor: mat('pbr_travertine'), walls: mat('pbr_plaster_white', '#e4e2d8'), trim: mat('brass') };
const FOYER: TileSurfaces = { floor: mat('pbr_checker') };
const HALL: TileSurfaces = { floor: mat('pbr_flagstone', '#b0a690'), solids: mat('pbr_marble_black') };
const GALLERY: TileSurfaces = { floor: mat('pbr_floorboards'), walls: mat('pbr_plaster', '#6e2f33') };
const BED: TileSurfaces = { floor: mat('pbr_carpet', '#5b3a4a'), walls: mat('pbr_plaster', '#8a7f9a') };
const STUDY: TileSurfaces = { floor: mat('pbr_carpet', '#2f4a3a') };

// ---------------------------------------------------------------- tiles

/** What is built where (for sealing walls between neighbouring rooms and lighting them). */
const cells = new Map<string, string>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
function place(kind: string, x: number, y: number, z: number, o: { rot?: Rotation; opts?: RoomOptions; surf?: TileSurfaces } = {}): void {
  m.tile(kind, x, y, z, o.rot ?? 0, o.opts);
  cells.set(key(x, y, z), kind);
  if (kind === 'stairs' || kind === 'stairwell') cells.set(key(x, y, z + 1), kind);
  if (o.surf) paint(x, y, z, o.surf);
}
const BRICK = { facade: 'brick' } as const;
/** A ground or upper room: brick outside, its own ceiling if nothing is built above. */
const roomAt = (x: number, y: number, z: number, surf?: TileSurfaces, opts: RoomOptions = {}) => place('room', x, y, z, { opts: { ...BRICK, ...opts }, surf });

// Cellar and crypt (z-1).
for (let x = -1; x <= 1; x++) for (const y of [2, 3]) place('room', x, y, -1, { surf: CRYPT, opts: { corners: 'columns' } });
for (const [x, y] of [[-2, 2], [-2, 3], [-3, 2], [2, 2], [2, 3], [3, 2]] as const) place('room', x, y, -1, { surf: STONE });
for (let x = -2; x <= 2; x++) place('room', x, 4, -1, { surf: STONE });
place('stairs', -3, 1, -1, { rot: 1, surf: STONE }); // wine cellar up into the library
place('stairs', 3, 1, -1, { rot: 1, surf: STONE }); // ossuary up into the parlour
place('stairs', 0, 5, -1, { rot: 3, surf: STONE }); // cellar corridor up into the graveyard house

// Ground floor (z0).
for (const x of [-3, -2]) roomAt(x, 0, 0); // library
roomAt(-2, 1, 0, STONE); // hidden passage
for (const x of [-1, 0, 1]) roomAt(x, 0, 0, FOYER);
roomAt(0, 1, 0, FOYER);
place('stairs', -1, 1, 0, { rot: 2, surf: FOYER }); // twin stairs, climbing out to the landings
place('stairs', 1, 1, 0, { rot: 0, surf: FOYER });
for (const x of [2, 3]) roomAt(x, 0, 0); // parlour
roomAt(2, 1, 0); // music room
for (const [x, y] of [[0, 2], [-1, 3], [1, 3]] as const) roomAt(x, y, 0, HALL);
for (const [x, y] of [[-1, 2], [1, 2], [0, 3]] as const) place('pit', x, y, 0, { surf: HALL }); // trapdoors over the crypt
for (const x of [-3, -2]) for (const y of [2, 3]) roomAt(x, y, 0); // dining hall
for (const x of [-3, -2]) roomAt(x, 4, 0, KITCHEN);
for (const x of [-1, 0, 1]) roomAt(x, 4, 0, STONE); // back hall
for (const x of [2, 3]) roomAt(x, 4, 0); // billiard room
for (const y of [2, 3]) {
  roomAt(2, y, 0, GLASS); // conservatory (the east corridor above)
  roomAt(3, y, 0, GLASS, { ceiling: 'skylight' });
}

// First floor (z1).
for (let x = -2; x <= 2; x++) roomAt(x, 0, 1, GALLERY);
roomAt(-3, 0, 1, BED, { ceiling: 'roof' });
roomAt(3, 0, 1, BED, { ceiling: 'roof' });
roomAt(-2, 1, 1, GALLERY); // landings
roomAt(2, 1, 1, GALLERY);
roomAt(0, 1, 1, STUDY);
place('stairwell', -3, 1, 1, { rot: 2, surf: ATTIC }); // up to the attic
place('stairwell', 3, 1, 1, { rot: 0, surf: ATTIC });
for (const x of [-3, -2]) for (const y of [2, 3]) roomAt(x, y, 1, undefined, { ceiling: 'roof' }); // trophy room
for (const x of [-3, -2]) roomAt(x, 4, 1, BED, { ceiling: 'roof' });
for (const x of [-1, 0, 1]) roomAt(x, 4, 1, BED, { ceiling: 'roof' });
for (const x of [2, 3]) roomAt(x, 4, 1, BED, { ceiling: 'roof' });
for (const y of [2, 3]) roomAt(2, y, 1, GALLERY, { ceiling: 'roof' });
for (const x of [-1, 0, 1]) place('balcony', x, 3, 1, { rot: 2 });

// Attic (z2): rotten floor at (-1,0) and (1,0).
for (let x = -2; x <= 2; x++) {
  for (const y of [0, 1]) {
    if (y === 0 && Math.abs(x) === 1) place('pit', x, y, 2, { surf: ATTIC });
    else roomAt(x, y, 2, ATTIC, { ceiling: 'beams' });
  }
}

// ---------------------------------------------------------------- walls and openings

/** One shared side, named from its west or south cell. */
const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const ROOMLIKE = new Set(['room', 'pit']);

// Cellar.
for (const y of [2, 3]) for (const x of [-1, 0]) link(x, y, -1, 'E', 'open');
for (let x = -1; x <= 1; x++) link(x, 2, -1, 'N', 'open');
link(-1, 2, -1, 'W', 'door'); // crypt gates
link(1, 2, -1, 'E', 'door');
link(-1, 3, -1, 'W', 'bars');
link(1, 3, -1, 'E', 'bars');
link(0, 3, -1, 'N', 'door');
link(-2, 2, -1, 'N', 'open');
link(-3, 2, -1, 'E', 'arch');
link(2, 2, -1, 'N', 'open');
link(2, 2, -1, 'E', 'arch');
link(-2, 3, -1, 'N', 'door');
link(2, 3, -1, 'N', 'door');
for (let x = -2; x <= 1; x++) link(x, 4, -1, 'E', 'open');

// Ground floor.
link(-3, 0, 0, 'E', 'open');
link(-3, 0, 0, 'W', 'door');
link(-3, 0, 0, 'S', 'windows');
link(-2, 0, 0, 'S', 'windows');
link(-2, 0, 0, 'N', 'door'); // the secret door
link(-2, 0, 0, 'E', 'door'); // the library bookcase wall
link(-2, 1, 0, 'N', 'door'); // the dining bookcase wall
link(-1, 0, 0, 'E', 'open');
link(0, 0, 0, 'E', 'open');
link(0, 0, 0, 'N', 'open');
link(0, 0, 0, 'S', 'wide');
link(-1, 0, 0, 'S', 'windows');
link(1, 0, 0, 'S', 'windows');
link(0, 1, 0, 'W', 'arch');
link(0, 1, 0, 'E', 'arch');
link(0, 1, 0, 'N', 'door');
link(1, 0, 0, 'E', 'door');
link(2, 0, 0, 'E', 'open');
link(2, 0, 0, 'S', 'windows');
link(3, 0, 0, 'S', 'windows');
link(3, 0, 0, 'E', 'door');
link(2, 0, 0, 'N', 'door');
link(2, 1, 0, 'N', 'door');
for (const y of [2, 3]) for (const x of [-1, 0]) link(x, y, 0, 'E', 'open');
for (let x = -1; x <= 1; x++) link(x, 2, 0, 'N', 'open');
link(-1, 3, 0, 'W', 'door');
link(1, 3, 0, 'E', 'door');
link(-1, 3, 0, 'N', 'door');
link(1, 3, 0, 'N', 'door');
link(-3, 2, 0, 'E', 'open');
link(-3, 3, 0, 'E', 'open');
link(-3, 2, 0, 'N', 'open');
link(-2, 2, 0, 'N', 'open');
link(-3, 2, 0, 'W', 'windows');
link(-3, 3, 0, 'W', 'windows');
link(-3, 3, 0, 'N', 'door');
link(-2, 3, 0, 'N', 'window'); // the serving hatch
link(-3, 4, 0, 'E', 'open');
link(-3, 4, 0, 'W', 'door');
link(-3, 4, 0, 'N', 'window');
link(-2, 4, 0, 'N', 'window');
link(-2, 4, 0, 'E', 'door');
link(-1, 4, 0, 'E', 'open');
link(0, 4, 0, 'E', 'open');
link(-1, 4, 0, 'N', 'door');
link(1, 4, 0, 'N', 'door');
link(1, 4, 0, 'E', 'door');
link(2, 4, 0, 'E', 'open');
link(2, 4, 0, 'N', 'window');
link(3, 4, 0, 'N', 'window');
link(3, 4, 0, 'E', 'window');
link(3, 4, 0, 'S', 'door');
link(2, 2, 0, 'E', 'open');
link(2, 3, 0, 'E', 'open');
link(2, 2, 0, 'N', 'open');
link(3, 2, 0, 'N', 'open');
link(3, 2, 0, 'E', 'wide');
link(3, 3, 0, 'E', 'windows');
link(0, 5, 0, 'N', 'door'); // out of the graveyard house

// First floor.
for (let x = -2; x <= 1; x++) link(x, 0, 1, 'E', 'open');
for (let x = -2; x <= 2; x++) link(x, 0, 1, 'S', 'windows');
link(-2, 0, 1, 'W', 'door');
link(2, 0, 1, 'E', 'door');
link(-2, 0, 1, 'N', 'door');
link(2, 0, 1, 'N', 'door');
link(0, 0, 1, 'N', 'door');
link(-3, 0, 1, 'W', 'window');
link(-3, 0, 1, 'S', 'window');
link(3, 0, 1, 'E', 'window');
link(3, 0, 1, 'S', 'window');
link(-2, 1, 1, 'E', 'arch');
link(2, 1, 1, 'W', 'arch');
link(-2, 1, 1, 'N', 'door');
link(2, 1, 1, 'N', 'door');
link(0, 1, 1, 'N', 'window'); // the study looks down into the great hall
link(-3, 2, 1, 'E', 'open');
link(-3, 3, 1, 'E', 'open');
link(-3, 2, 1, 'N', 'open');
link(-2, 2, 1, 'N', 'open');
link(-3, 2, 1, 'W', 'windows');
link(-3, 3, 1, 'W', 'windows');
link(-2, 2, 1, 'E', 'windows');
link(-2, 3, 1, 'E', 'wall');
link(-2, 3, 1, 'N', 'door');
link(-3, 4, 1, 'E', 'open');
link(-3, 4, 1, 'W', 'window');
for (let x = -3; x <= 3; x++) link(x, 4, 1, 'N', 'window');
link(-2, 4, 1, 'E', 'door');
link(-1, 4, 1, 'E', 'open');
link(0, 4, 1, 'E', 'open');
link(1, 4, 1, 'E', 'door');
link(2, 4, 1, 'E', 'open');
link(3, 4, 1, 'E', 'window');
link(2, 4, 1, 'S', 'door');
link(2, 2, 1, 'N', 'open');
link(2, 2, 1, 'W', 'windows');
link(2, 3, 1, 'W', 'wall');
link(2, 2, 1, 'E', 'windows');
link(2, 3, 1, 'E', 'windows');

// Attic.
for (let x = -2; x <= 1; x++) for (const y of [0, 1]) link(x, y, 2, 'E', 'open');
for (let x = -2; x <= 2; x++) link(x, 0, 2, 'N', 'open');
for (const x of [-2, 0, 2]) link(x, 0, 2, 'S', 'slit');
link(0, 1, 2, 'N', 'slit');

for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
// Every other side between two rooms is a plain wall (rooms would otherwise get a doorway).
for (const [k, kind] of cells) {
  if (!ROOMLIKE.has(kind)) continue;
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  for (const side of ['N', 'E'] as const) {
    const [nx, ny] = side === 'N' ? [x, y + 1] : [x + 1, y];
    if (!ROOMLIKE.has(cells.get(key(nx, ny, z)) ?? '') || links.has(sideId(x, y, z, side))) continue;
    m.edge(x, y, z, side, 'wall');
  }
}

// Roofs where no room has one of its own: the great hall, the graveyard house, the stairwells and the attic's rotten patches.
const ROOF = { material: 'pbr_roof', tint: '#4a4550' };
m.block([0, 8, 20], [24, 0.4, 16], 'solid', ROOF);
m.block(at(0, 5, 0, 0, 0, 4), [8.5, 0.4, 8.5], 'solid', ROOF);
for (const s of [-1, 1]) m.block(at(3 * s, 1, 2, 0, 0, 4), [8.5, 0.4, 8.5], 'solid', ROOF);
for (const s of [-1, 1]) m.block(at(s, 0, 2, 0, 0, 4), [8, 0.4, 8], 'solid', ROOF);

// The cellar corridor is narrowed to a 3 m lane by stone piers, so its spike plates can't be walked round.
const PIER = { material: 'pbr_castle_stone', tint: '#8f877a' };
for (const [x0, x1] of [[-12, -1.5], [1.5, 12]] as const) {
  m.block([(x0 + x1) / 2, -4, 34.6], [x1 - x0, 4, 2.3], 'solid', PIER);
  m.block([(x0 + x1) / 2, -4, 29.4], [x1 - x0, 4, 2.3], 'solid', PIER);
}

// ---------------------------------------------------------------- ground: a hilltop, the manor on a stone terrace

const MANOR = { x0: -28, x1: 28, z0: -4, z1: 36 };
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const fromManor = (x: number, z: number) => {
  const d = Math.hypot(Math.max(MANOR.x0 - x, 0, x - MANOR.x1), Math.max(MANOR.z0 - z, 0, z - MANOR.z1));
  const house = Math.hypot(Math.max(-4 - x, 0, x - 4), Math.max(36 - z, 0, z - 44)); // the graveyard house
  return Math.min(d, house);
};
const MAZE = { x0: -54, z0: -42, nx: 7, nz: 6, step: 5 };
const inMaze = (x: number, z: number, pad = 0) => x > MAZE.x0 - pad && x < MAZE.x0 + MAZE.nx * MAZE.step + pad && z > MAZE.z0 - pad && z < MAZE.z0 + MAZE.nz * MAZE.step + pad;
const onPath = (x: number, z: number) => (Math.abs(x) < 3 && (z < -4 || z > 44)) || (Math.abs(Math.abs(x) - 8) < 2 && z > 36 && z < 52) || (Math.abs(z - 16) < 2.5 && Math.abs(x) > 28 && Math.abs(x) < 40);
/** Lowest level built in each grid column. */
const lowest = new Map<string, number>();
for (const k of cells.keys()) {
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  const c = `${x},${y}`;
  lowest.set(c, Math.min(lowest.get(c) ?? 99, z));
}
const ground = ((): TerrainData => {
  const t = newTerrain(200, 2, [0, 16]);
  const heights: number[] = [];
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const x = t.origin[0] + c * 2;
      const z = t.origin[1] + r * 2;
      // The columns this vertex touches: sunk under the cellar, just under the ground floor, level with the doors on the edge.
      let any = false;
      let all = true;
      let cellar = false;
      for (const gx of new Set([Math.floor((x + 4) / 8), Math.ceil((x - 4) / 8)])) {
        for (const gy of new Set([Math.floor((z + 4) / 8), Math.ceil((z - 4) / 8)])) {
          const lz = lowest.get(`${gx},${gy}`);
          if (lz === undefined) all = false;
          else {
            any = true;
            if (lz < 0) cellar = true;
          }
        }
      }
      const d = fromManor(x, z);
      const hill = -smooth(16, 72, d) * 16 + smooth(14, 40, d) * (1.1 * Math.sin(x / 9 + 1) * Math.cos(z / 11) + 0.7 * Math.sin((x - z) / 7));
      const h = cellar ? -8.2 : all ? -3.6 : any ? 0 : hill;
      heights.push(Math.round(h * 100));
    }
  }
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < t.cols - 1; c++) {
      const x = t.origin[0] + c * 2 + 1;
      const z = t.origin[1] + r * 2 + 1;
      const d = fromManor(x, z);
      let g: TerrainMaterial = 'grass';
      let f = 3;
      if (d < 2.5) [g, f] = ['gravel', 0];
      else if (onPath(x, z)) [g, f] = ['gravel', 0];
      else if (inMaze(x, z)) [g, f] = ['grass', 1];
      else if (z > 46) [g, f] = [Math.sin(x / 5) * Math.cos(z / 6) > 0.3 ? 'mud' : 'moss', 2];
      else if (Math.sin(x / 6 + z / 7) > 0.6) [g, f] = ['mud', 1];
      else if (d > 30) f = 4;
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      foliage.push(f);
    }
  }
  return paintSlopes({ ...t, heights, materials, foliage }, 38, 'stone');
})();
m.terrain(ground);
const gy = (x: number, z: number) => +(terrainHeightAt(ground, x, z) ?? 0).toFixed(2);

// The stone terrace round the cellar walls: it hides where the ground drops away under the cellar.
const TERRACE = { material: 'pbr_flagstone', tint: '#8a8478' };
const terrace = (x0: number, z0: number, x1: number, z1: number) => m.block([(x0 + x1) / 2, -8.5, (z0 + z1) / 2], [x1 - x0, 8.55, z1 - z0], 'solid', TERRACE);
terrace(-30.4, 1.6, -28, 22.4); // west, by the wine-cellar stairs
terrace(28, 1.6, 30.4, 22.4); // east
terrace(-22.4, 36, -4, 38.4); // north, over the cellar corridor
terrace(4, 36, 22.4, 38.4);
terrace(-6.4, 36, -4, 46.4); // round the graveyard house
terrace(4, 36, 6.4, 46.4);
terrace(-6.4, 44, 6.4, 46.4);

// ---------------------------------------------------------------- scenario: doors, buttons, traps

const door = (id: string, name: string, pos: V3, yaw: number, locked = false) => m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked, auto: true });
/** The red lamps over the great hall's trapdoors (they blink while the balcony lever has the hall armed). */
const HALL_LAMPS = ['lamp_trapdoor_1', 'lamp_trapdoor_2', 'lamp_trapdoor_3'];
const HALL_DOORS = ['door_hall_s', 'door_hall_w', 'door_hall_e', 'door_hall_nw', 'door_hall_ne'];
door('door_hall_s', 'Great hall (foyer)', [0, 0, 12], 0);
door('door_hall_w', 'Great hall (dining)', [-12, 0, 24], P);
door('door_hall_e', 'Great hall (conservatory)', [12, 0, 24], P);
door('door_hall_nw', 'Great hall (back, west)', [-8, 0, 28], 0);
door('door_hall_ne', 'Great hall (back, east)', [8, 0, 28], 0);
door('door_secret', 'Secret door', [-16, 0, 4], 0, true);
door('door_crypt_w', 'Crypt gate (west)', [-12, -4, 16], P);
door('door_crypt_e', 'Crypt gate (east)', [12, -4, 16], P);

const button = (id: string, name: string, pos: V3, yaw: number, label: string, cooldown = 1) => {
  m.add({ kind: 'button', id, name, position: pos, yaw, label, once: false, cooldownSeconds: cooldown, startEnabled: true });
  // The tell: a red lamp over every lever.
  m.light([pos[0] - Math.sin(yaw) * 0.25, pos[1] + 2.3, pos[2] - Math.cos(yaw) * 0.25], { fixture: 'wall', color: '#ff3a2a', intensity: 0.9, range: 4.5, yaw });
};
button('btn_lasers', 'Gallery lasers', [-3.25, 4, 8], P, 'Arm the gallery lasers');
button('btn_hall', 'Seal the great hall', [-2.6, 4, 27.25], Math.PI, 'Seal the great hall');
button('btn_chandelier', 'Chandelier rope', [-13.5, 0, 28.75], 0, 'Cut the chandelier rope');
button('btn_spikes', 'Cellar spikes', [-19.25, -4, 26], P, 'Spring the corridor spikes');
button('btn_secret_lib', 'Red book', [-13.3, 0, 3.25], Math.PI, 'Pull the red book', 9);
button('btn_secret_pas', 'Passage lever', [-13.3, 0, 4.75], 0, 'Pull the lever', 9);
button('btn_crypt', 'Crypt gates', [3, -4, 27.25], Math.PI, 'Bar the crypt gates');

const trap = (id: string, name: string, kind: 'spikes' | 'crusher' | 'laser', pos: V3, yaw: number, activation: 'logic' | 'proximity', on: number, off = 3) =>
  m.add({ kind: 'trap', id, name, trap: kind, position: pos, yaw, activation, onSeconds: on, offSeconds: off, offsetSeconds: 0, startEnabled: true, damage: null });
const LASERS: string[] = [];
for (const x of [-12, 12]) for (const z of [-2.5, 0, 2.5]) {
  const id = `trap_laser_${LASERS.length + 1}`;
  LASERS.push(id);
  trap(id, 'Gallery laser', 'laser', [x, 4, z], P, 'logic', 5);
}
const HALL_SPIKES: string[] = [];
for (const [x, z] of [[-1.75, 16], [1.75, 16], [-8, 22.25], [-8, 25.75], [8, 22.25], [8, 25.75]] as const) {
  const id = `trap_hall_spikes_${HALL_SPIKES.length + 1}`;
  HALL_SPIKES.push(id);
  trap(id, 'Great hall spikes', 'spikes', [x, 0, z], 0, 'logic', 1.2);
}
trap('trap_chandelier', 'Chandelier', 'crusher', [-20, 0, 20], 0, 'logic', 1.2);
const CORRIDOR_SPIKES: string[] = [];
for (const x of [-10, -6.5, 6.5, 10]) {
  const id = `trap_cellar_spikes_${CORRIDOR_SPIKES.length + 1}`;
  CORRIDOR_SPIKES.push(id);
  trap(id, 'Cellar corridor spikes', 'spikes', [x, -4, 32], 0, 'proximity', 1.2, 3);
}

// Trapdoors in the great hall floor, rotten floor in the attic, and the bookcase walls.
const TRAPDOORS = ['trapdoor_hall_1', 'trapdoor_hall_2', 'trapdoor_hall_3'];
for (const [k, [x, y]] of ([[-1, 2], [1, 2], [0, 3]] as const).entries()) m.block(at(x, y, 0, 0, 0, -0.3), [4, 0.3, 4], 'trapdoor', { material: 'pbr_floorboards', tint: '#6a5038', delay: 0.25, respawn: 6, id: TRAPDOORS[k]! });
for (const x of [-1, 1]) m.block(at(x, 0, 2, 0, 0, -0.3), [4, 0.3, 4], 'crumble', { material: 'pbr_floorboards', tint: '#8a7a64', delay: 0.7, respawn: 8 });
m.add({ kind: 'destructible', id: 'wall_bookcase_lib', name: 'Library bookcase', model: 'wall', position: [-12, 0, 0], yaw: P, health: 200, explosiveOnly: false });
m.add({ kind: 'destructible', id: 'wall_bookcase_din', name: 'Dining bookcase', model: 'wall', position: [-16, 0, 12], yaw: 0, health: 200, explosiveOnly: false });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const wait = (s: number) => act('wait', null, { value: s });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], once = false): LogicRule => ({ id, name, enabled: true, once, when, if: [], do: does });
const pressed = (target: string) => ({ event: 'button_pressed' as const, target });
/** A lever's cooldown: off at once, back (with a chime) after `s` seconds. */
const cooldown = (btn: string, s: number, text: string) => [wait(s), act('enable', btn), say(text, 2)];

m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_intro', 'Welcome', { event: 'match_start', target: null }, [say('Hollowmere Manor is armed. Red lamps mark the levers: study, balcony, kitchen, cellar and crypt.', 6)], true),
    rule('rule_lasers', 'Gallery lasers', pressed('btn_lasers'), [
      act('disable', 'btn_lasers'),
      act('sound', null, { state: 'buzzer' }),
      say('The gallery lasers are arming!', 2),
      wait(1.5),
      ...LASERS.map((t) => act('trap_fire', t)),
      ...cooldown('btn_lasers', 25, 'The gallery lasers can be armed again.'),
    ]),
    rule('rule_hall_doors', 'Great hall: seal the doors', pressed('btn_hall'), [
      act('disable', 'btn_hall'),
      act('sound', null, { state: 'alarm' }),
      say('The great hall is sealed! Find the trapdoors...', 3),
      ...HALL_DOORS.flatMap((d) => [act('door_lock', d), act('door_close', d)]),
      wait(6),
      ...HALL_DOORS.map((d) => act('door_unlock', d)),
      ...cooldown('btn_hall', 24, 'The balcony lever is reset.'),
    ]),
    rule('rule_hall_spikes', 'Great hall: spikes', pressed('btn_hall'), [
      wait(1.5),
      ...HALL_SPIKES.map((t) => act('trap_fire', t)),
      wait(1.8),
      ...HALL_SPIKES.map((t) => act('trap_fire', t)),
      wait(1.8),
      ...HALL_SPIKES.map((t) => act('trap_fire', t)),
    ]),
    rule('rule_hall_floor', 'Great hall: the floor gives way', pressed('btn_hall'), [
      // The tell: the trapdoor lamps blink red while the hall is armed.
      ...HALL_LAMPS.flatMap((l) => [act('light_color', l, { text: '#ff1a10' }), act('light_blink', l, { state: 'on', value: 3 })]),
      wait(5.6),
      // Then the lever springs the trapdoors into the crypt (they come back 6 s later).
      say('The floor gives way!', 2),
      ...TRAPDOORS.map((t) => act('block_drop', t)),
      ...HALL_LAMPS.flatMap((l) => [act('light_blink', l, { state: 'off' }), act('light_color', l)]),
    ]),
    rule('rule_chandelier', 'The chandelier falls', pressed('btn_chandelier'), [
      act('disable', 'btn_chandelier'),
      act('sound', null, { state: 'buzzer' }),
      say('The dining-hall chandelier creaks...', 2),
      wait(1),
      act('trap_fire', 'trap_chandelier'),
      ...cooldown('btn_chandelier', 15, 'The chandelier is hauled back up.'),
    ]),
    rule('rule_cellar_spikes', 'Cellar spikes ripple', pressed('btn_spikes'), [
      act('disable', 'btn_spikes'),
      act('sound', null, { state: 'buzzer' }),
      wait(0.8),
      ...CORRIDOR_SPIKES.flatMap((t) => [act('trap_fire', t), wait(0.4)]),
      ...cooldown('btn_spikes', 15, 'The cellar spikes are reset.'),
    ]),
    ...(['btn_secret_lib', 'btn_secret_pas'] as const).map((b) =>
      rule(`rule_${b.slice(4)}`, 'The secret door', pressed(b), [act('door_unlock', 'door_secret'), act('door_open', 'door_secret'), act('sound', null, { state: 'chime' }), wait(8), act('door_close', 'door_secret'), act('door_lock', 'door_secret')]),
    ),
    rule('rule_crypt', 'Crypt gates', pressed('btn_crypt'), [
      act('disable', 'btn_crypt'),
      act('sound', null, { state: 'alarm' }),
      say('The crypt gates slam shut!', 2),
      ...['door_crypt_w', 'door_crypt_e'].flatMap((d) => [act('door_lock', d), act('door_close', d)]),
      wait(5),
      ...['door_crypt_w', 'door_crypt_e'].map((d) => act('door_unlock', d)),
      ...cooldown('btn_crypt', 20, 'The crypt gates can be barred again.'),
    ]),
    rule('rule_bookcase_lib', 'Library bookcase broken', { event: 'destroyed', target: 'wall_bookcase_lib' }, [act('sound', null, { state: 'boom' }), say('A library bookcase gives way!', 3)]),
    rule('rule_bookcase_din', 'Dining bookcase broken', { event: 'destroyed', target: 'wall_bookcase_din' }, [act('sound', null, { state: 'boom' }), say('A bookcase in the dining hall gives way: there is a passage behind it!', 3)]),
    rule('rule_rockets', 'Rockets taken', { event: 'pickup_taken', target: 'pickup_rockets' }, [say('Someone has taken the rockets from the crypt.', 3)]),
  ],
});

// ---------------------------------------------------------------- spawns, pickups and hills

for (const [p, yaw] of [
  [[-24, 0, -1.5], P], [[-6, 0, -2], 0], [[6, 0, 6], Math.PI], [[26, 0, -0.5], -P], [[16, 0, 8], Math.PI],
  [[-25, 0, 26], P], [[-20, 0, 33], Math.PI], [[0, 0, 33], Math.PI], [[14.5, 0, 29.5], Math.PI], [[26, 0, 22], -P],
  [[8, -4, 26], Math.PI], [[24, -4, 16], -P], [[-24, -4, 16], P],
  [[-19, 4, -1], P], [[19, 4, -1], -P], [[-16, 8, 7], Math.PI], [[16, 8, 7], Math.PI],
  [[-5, 4, 30.5], Math.PI], [[-24, 4, 17], P], [[24, 4, 33], -P], [[-22, 4, -2], 0], [[22, 4, -2], 0],
] as [V3, number][]) m.spawn(p, yaw);
// Out in the grounds.
for (const [x, z, yaw] of [[-36, -26, P], [-20, 60, Math.PI], [20, 60, Math.PI], [44, 14, -P], [-44, 10, P], [16, -16, 0]] as const) m.spawn([x, gy(x, z), z], yaw);

const [west, east] = m.teamIds(2) as [string, string];
for (const [p, yaw] of [
  [[-26, 0, 2.5], P], [[-16, 0, 15.5], 0], [[-23, 0, 31], P], [[-26, 4, 26], P], [[-19, 4, 31], P], [[-21, 4, 2.5], 0], [[-16, -4, 22], 0],
] as [V3, number][]) m.spawn(p, yaw, west);
for (const [p, yaw] of [
  [[21, 0, 1.5], -P], [[18, 0, 18], 0], [[26, 0, 30], -P], [[18, 4, 22], 0], [[18, 4, 34], -P], [[21, 4, 2.5], 0], [[16, -4, 22], 0],
] as [V3, number][]) m.spawn(p, yaw, east);
m.teams([7, 7]);

// The power weapon lies in the crypt, the big armour in the attic.
m.add({ kind: 'pickup', id: 'pickup_rockets', item: 'core.weapon_rockets', position: [-8, -4, 24], respawnSeconds: 60 });
m.pickup('ammo_explosive', [-16, -4, 26]).pickup('ammo_explosive', [22, -4, 13]);
m.pickup('armor_large', [0, 8, 0]);
m.pickup('powerup_damage', [0, 0, 16], 90); // bait on the great hall floor
m.pickup('weapon_marksman', [6, 4, -2]).pickup('ammo_sniper', [-6, 4, 2]).pickup('health_small', [-2, 4, 9]);
m.pickup('ammo', [-6, 0, 3]).pickup('weapon_smg', [-20, 0, -2]).pickup('health_large', [-16, 0, 8]);
m.pickup('weapon_rifle', [-16, 0, 24]).pickup('ammo_rifle', [-26, 0, 15]).pickup('health_small', [-18, 0, 32]);
m.pickup('ammo_rifle', [-6, 0, 32]).pickup('weapon_shotgun', [6, 0, 32]).pickup('ammo_shells', [18, 0, 32]);
m.pickup('weapon_auto_shotgun', [24, 0, 24]).pickup('weapon_burst_rifle', [20, 0, -2]).pickup('grenades', [16, 0, 4]);
m.pickup('weapon_shotgun', [-16, 4, 16]).pickup('health_large', [-4, 4, 34]).pickup('armor_small', [26, 4, 30]);
m.pickup('armor_small', [-26, 4, -2]).pickup('ammo', [26, 4, -2]).pickup('ammo_cells', [16, 4, 26]).pickup('weapon_plasma', [16, 4, 14]);
m.pickup('health_small', [16, -4, 26]).pickup('health_large', [0, -4, 32]).pickup('grenades', [-16, 8, 9]).pickup('health_small', [16, 8, 9]);
// Grounds: the sniper rifle among the graves, grenades at the heart of the maze.
for (const [item, x, z] of [['weapon_sniper', 0, 68], ['ammo_sniper', -12, 56], ['health_small', 12, 56], ['grenades', -36.5, -24.5], ['health_small', -48, -14], ['armor_small', 46, 30], ['health_small', -46, 30], ['ammo', 30, -16]] as const) m.pickup(item, [x, gy(x, z), z]);

// King of the Hill: the foyer, the gallery, the crypt.
m.hill([0, 0, 1], 4).hill([0, 4, 0], 4).hill([0, -4, 17], 4);

// ---------------------------------------------------------------- furnishing

function put(model: string, p: V3, yaw = 0, scale = 1, solid = true): { put: typeof put } {
  m.prop(model, [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)], +yaw.toFixed(4), scale, solid);
  return { put };
}
const W = 3.75; // inside face of a wall from the cell centre
// Library: shelves round the walls, a reading desk, armchairs by the fire.
for (const dy of [-2.6, 2.6]) put('rn_bookcase', at(-3, 0, 0, -W + 0.3, dy), P);
for (const dx of [-2.6, 2.6]) put('hm_bookshelf', at(-3, 0, 0, dx, W - 0.2), Math.PI);
put('hm_bookshelf', at(-2, 0, 0, -2.6, W - 0.2), Math.PI);
for (const dy of [-2.4, 2.4]) put('hm_bookshelf', at(-2, 0, 0, W - 0.2, dy), -P);
put('dg_table_long', at(-2, 0, 0, -1.5, 0.5), P).put('rn_candles', at(-2, 0, 0, -1.5, 0.5, 0.85), 0, 1, false);
put('hm_armchair', at(-3, 0, 0, -1.2, -2.6), 0);
put('hm_armchair', at(-3, 0, 0, 1.2, -2.6), 0);
put('hm_rug_round', at(-3, 0, 0, 0, 0), 0, 0.9, false);
put('hm_floor_lamp', at(-2, 0, 0, 2.8, -3.2), 0);
// Hidden passage: cobwebbed junk and a skull or two.
put('dg_barrel', at(-2, 1, 0, -2.8, 2.6)).put('crate_small', at(-2, 1, 0, -2.9, 1.4)).put('dg_skull', at(-2, 1, 0, 2.6, 2.8), 0.6, 1, false);
put('rn_candles', at(-2, 1, 0, 2.9, -2.6), 0, 1, false);
// Foyer: statues by the front door, a round rug, the grandfather's chest.
for (const s of [-1, 1]) put('rn_statue_stag', at(0, 0, 0, s * 2.8, -2.8), 0);
put('hm_rug_round', at(0, 0, 0, 0, 2), 0, 1, false);
for (const s of [-1, 1]) put('dg_banner', at(s, 0, 0, 0, -W + 0.1, 1.2), 0, 1, false);
put('hm_houseplant_tall', at(-1, 0, 0, -2.8, 2.8)).put('hm_houseplant_tall', at(1, 0, 0, 2.8, 2.8));
put('hm_side_table', at(0, 1, 0, -2.6, 2.6)).put('candles', at(0, 1, 0, -2.6, 2.6, 0.6), 0, 1, false);
// Parlour and music room.
put('hm_couch', at(2, 0, 0, -2.7, W - 0.55), Math.PI).put('hm_armchair', at(3, 0, 0, 2.4, W - 0.6), Math.PI).put('hm_side_table', at(2, 0, 0, 2.2, W - 0.6));
put('hm_fireplace', at(3, 0, 0, W - 0.35, -2.7), -P).put('hm_rug', at(2, 0, 0, 0, 1), P, 1.2, false);
put('hm_chest_drawers', at(2, 0, 0, -1.2, -W + 0.6), 0).put('hm_floor_lamp', at(3, 0, 0, 2.8, -2.8));
put('dg_table_small', at(2, 1, 0, -2.4, 0), 0).put('hm_chair_wood', at(2, 1, 0, -1.3, 0.5), -P).put('hm_wall_shelf', at(2, 1, 0, W - 0.1, 0, 1.5), -P, 1, false);
put('rn_urn', at(2, 1, 0, 2.8, 2.8)).put('rn_urn', at(2, 1, 0, 2.8, -2.8));
// Great hall: a cold fireplace at the dais end, urns, banners.
put('hm_fireplace', at(0, 3, 0, 0, W - 0.35), Math.PI);
for (const x of [-1, 1]) put('dg_banner', at(x, 3, 0, 0, W - 0.1, 1.5), Math.PI, 1, false);
for (const [x, y, dx, dy] of [[-1, 3, -2.9, 2.9], [1, 3, 2.9, 2.9], [0, 2, -3, -3], [0, 2, 3, -3]] as const) put('rn_urn', at(x, y, 0, dx, dy));
// Dining hall: the long tables either side of the chandelier, chairs, a sideboard.
for (const s of [-1, 1]) {
  put('dg_table_long', at(-3, 2, 0, 4 + s * 3.2, 4), 0);
  for (const dz of [-1, 0, 1]) put('hm_chair_wood', at(-3, 2, 0, 4 + s * 3.2 + s * 1.1, 4 + dz), -s * P, 1, false);
  put('rn_candles', at(-3, 2, 0, 4 + s * 3.2, 4, 0.85), 0, 1, false);
}
put('hm_chandelier', [-20, 3, 20], 0, 1.2, false);
put('hm_dresser', at(-3, 2, 0, -1, -W + 0.45), 0).put('hm_fireplace', at(-3, 3, 0, -2.4, W - 0.35), Math.PI);
// Kitchen: the range, counters, a butcher's table.
for (let i = 0; i < 4; i++) put(i === 1 ? 'hm_oven' : i === 2 ? 'hm_kitchen_sink' : 'hm_kitchen_counter_long', at(-3, 4, 0, -2.2 + i * 0.62, W - 0.35), Math.PI);
put('dg_table_small', at(-2, 4, 0, 0.5, 1), P).put('dg_barrel', at(-2, 4, 0, 2.9, 2.9)).put('crate_bottles', at(-3, 4, 0, -2.9, -2.9));
put('hm_wall_shelf', at(-2, 4, 0, -1, W - 0.1, 1.6), Math.PI, 1, false);
// Back hall: coffins waiting for the crypt, a pew.
put('coffin_old', at(0, 4, 0, -2, -2), P).put('altar', at(0, 4, 0, 0, W - 0.75), Math.PI).put('candles', at(0, 4, 0, -0.6, W - 0.75, 1), 0, 1, false);
put('graveyard_bench', at(1, 4, 0, -2.5, 2.9), Math.PI).put('dg_banner', at(-1, 4, 0, -2.5, W - 0.1, 1.2), Math.PI, 1, false);
// Billiard room.
put('hm_table_round', at(2, 4, 0, 4, 0.5), 0).put('hm_bookshelf', at(3, 4, 0, W - 0.2, -2), -P).put('dg_sword_mount', at(2, 4, 0, -W + 0.1, 2.8, 1.4), P, 1, false);
put('hm_armchair', at(3, 4, 0, 2.4, 2.4), Math.PI * 0.75);
// Conservatory: palms and ferns gone wild.
for (const [x, y, dx, dy] of [[2, 2, -2.6, -2.6], [3, 2, 2.6, -2.6], [3, 3, 2.6, 2.6], [2, 3, -2.6, 2.6]] as const) put('hm_potted_palm', at(x, y, 0, dx, dy), 0, 0.9);
for (const [x, y, dx, dy] of [[2, 3, 2, -1], [3, 2, -2, 2]] as const) put('nt_fern_wide', at(x, y, 0, dx, dy), 0.6, 1, false);
put('graveyard_bench', at(3, 3, 0, 2.8, -1), -P).put('rn_statue_fox', at(2, 2, 0, 3.5, 3.5), P / 2);
// Cellar: wine racks of barrels, the ossuary's bones, the crypt's coffins.
for (const dy of [-2.8, -1.4, 0, 1.4]) put('dungeon_barrel', at(-3, 2, -1, -W + 0.6, dy), 0);
for (const dx of [-2.6, 2.3]) put('dungeon_barrel', at(-2, 3, -1, dx, W - 0.6));
for (const dx of [0, 1.2]) put('crate_bottles', at(-2, 2, -1, dx, -W + 0.6));
for (const dx of [-2.4, 2.4]) put('dg_wall_torch', at(-2, 2, -1, dx, -W + 0.12, 1.8), 0, 1, false);
for (const [dx, dy] of [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6]] as const) put('coffin', at(2, 2, -1, dx, dy), P);
put('dg_skull', at(3, 2, -1, 2.8, 0), 1.2, 1, false).put('dg_skull', at(2, 3, -1, -2, 2.8), 0.3, 1, false).put('dg_vase', at(3, 2, -1, 2.9, 2.9));
for (const dy of [-2.4, 2.4]) put('dg_wall_torch', at(3, 2, -1, W - 0.12, dy, 1.8), -P, 1, false);
for (const [x, y, dx, dy] of [[-1, 2, -2.8, -2.6], [1, 2, 2.8, -2.6], [-1, 3, -2.8, 2.8], [1, 3, 2.8, 2.8]] as const) put('coffin_old', at(x, y, -1, dx, dy), P);
put('dg_pedestal', at(-1, 3, -1, 0, 2.5)).put('dg_chest', at(1, 2, -1, -0.5, -W + 0.6), 0).put('dg_coin_pile', at(1, 2, -1, 1, -W + 0.6), 0, 1, false);
for (const x of [-1, 1]) for (const dy of [-7, -2]) put('dg_wall_torch', at(x, 2.5, -1, x * (W - 0.12), dy, 1.8), -x * P, 1, false);
for (const x of [-2, 2]) put('dg_wall_torch', at(x, 4, -1, 0, W - 0.12, 1.8), Math.PI, 1, false);
for (const x of [-4, 4]) put('dg_wall_torch', [x, -2.2, 33.33], Math.PI, 1, false);
// First floor: the gallery's portraits and statues, bedrooms, the study.
for (const x of [-1, 1]) put('rn_column_broken', at(x, 0, 1, 0, W - 0.35));
for (const x of [-2, 0, 2]) for (const s of [-1, 1]) put('rn_column_broken', at(x, 0, 1, s * 2.6, W - 0.35));
put('hm_rug', at(0, 0, 1, 0, 0), P, 1.4, false);
put('dg_table_long', at(0, 1, 1, 1.2, 1.5), 0).put('hm_chair_office', at(0, 1, 1, 0, 1.5), P, 1, false).put('hm_bookshelf', at(0, 1, 1, W - 0.2, 0), -P).put('hm_desk_lamp', at(0, 1, 1, 1.2, 2.5, 0.85), 0, 1, false);
for (const s of [-1, 1]) {
  put('hm_bed_king', at(3 * s, 0, 1, s * 1.6, W - 1.85), Math.PI).put('hm_nightstand', at(3 * s, 0, 1, s * -0.6, W - 0.4));
  put('hm_dresser', at(3 * s, 0, 1, s * (W - 0.45), -1.4), -s * P);
}
// Trophy room: mounted swords, banners, a horse statue, chests of loot.
for (const [x, y] of [[-3, 2], [-3, 3]] as const) put('dg_sword_mount', at(x, y, 1, -W + 0.1, 0, 1.5), P, 1, false);
put('dg_statue_horse', at(-3, 2, 1, 4, 4), 0.6).put('dg_chest', at(-3, 2, 1, -2.6, -2.8), 0).put('dg_banner', at(-3, 3, 1, 0, W - 0.1, 1.4), Math.PI, 1, false);
put('hm_couch', at(-2, 3, 1, -2.6, 2.6), Math.PI).put('hm_rug_round', at(-3, 2, 1, 4, 4), 0, 1, false);
// Bedroom suites, master suite, nursery.
put('hm_bed_king', at(-3, 4, 1, 0, W - 1.85), Math.PI).put('hm_nightstand', at(-3, 4, 1, 2, W - 0.4)).put('hm_bathtub', at(-2, 4, 1, 0, 2.6), P);
put('hm_bed_king', at(0, 4, 1, 0, W - 1.85), Math.PI).put('hm_chest_drawers', at(-1, 4, 1, -1.5, W - 0.6), Math.PI).put('hm_fireplace', at(1, 4, 1, 1.5, W - 0.35), Math.PI);
put('hm_armchair', at(1, 4, 1, -1.5, 0.5), P).put('hm_floor_lamp', at(-1, 4, 1, -2.8, 0));
put('hm_bed_single', at(3, 4, 1, 2.6, 2.2), Math.PI).put('hm_bed_single', at(2, 4, 1, 0, 2.2), Math.PI).put('dg_chest', at(3, 4, 1, -0.5, W - 0.45), Math.PI);
put('rn_urn', at(2, 3, 1, 2.9, 2.9));
// Attic: rafters, trunks, dust sheets (old crates) and pumpkins.
for (const x of [-2, 0, 2]) put('wood_support', at(x, 1, 2, 0, 2.6), 0);
put('dg_chest', at(-2, 0, 2, -2.6, -2.6)).put('crate_small', at(2, 0, 2, 2.6, -2.6)).put('crate_small', at(2, 0, 2, 2.6, -1.8, 0.6), 0.5);
put('pumpkin', at(-2, 1, 2, -2.8, -1), 0.4, 1, false).put('coffin', at(0, 1, 2, 2.4, 2.6), P).put('cardboard_box', at(-1, 1, 2, -1.5, 2.8));

// ---------------------------------------------------------------- lights: candles and torches, dim and warm

const WARM = '#ffb066';
const CELLAR = '#ff8f3a';
const skipLight = new Set(['-1,2,0', '1,2,0', '0,3,0', '-3,1,0', '3,1,0', '0,5,0']);
for (const [k, kind] of cells) {
  if (kind !== 'room' && kind !== 'pit') continue;
  if (skipLight.has(k)) continue;
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  m.light(at(x, y, z, 0, 0, 3), { fixture: 'none', color: z < 0 ? CELLAR : WARM, intensity: z < 0 ? 0.6 : 0.5, range: 9 });
}
// The great hall: candelabra glow low, and a red warning lamp over each trapdoor.
for (const [k, [x, y]] of ([[-1, 2], [1, 2], [0, 3]] as const).entries()) m.light(at(x, y, 0, 0, 0, 3.4), { fixture: 'bulb', color: '#ff4a32', intensity: 0.8, range: 6, id: HALL_LAMPS[k]! });
m.light([0, 6.5, 20], { fixture: 'none', color: WARM, intensity: 0.8, range: 14 });
// The chandelier over the crusher, red-tinged; red strips over the gallery's laser rows; red lamps in the spike corridor.
m.light([-20, 3.1, 20], { fixture: 'none', color: '#ff7a4a', intensity: 1, range: 8 });
for (const x of [-12, 12]) m.light([x, 7.6, 0], { fixture: 'strip', color: '#ff2a2a', intensity: 0.8, range: 6, yaw: P });
for (const x of [-8, 8]) m.light([x, -1, 33.2], { fixture: 'wall', color: '#ff3a2a', intensity: 0.7, range: 5, yaw: Math.PI });
// Stairwells and the graveyard house.
for (const s of [-1, 1]) m.light(at(3 * s, 1, 1, 0, 0, 3.4), { fixture: 'bulb', color: WARM, intensity: 0.6, range: 8 });
m.light(at(0, 5, 0, 0, 0, 3), { fixture: 'bulb', color: CELLAR, intensity: 0.6, range: 8 });
// Lanterns by the doors outside.
for (const [x, z] of [[-3.2, -4.6], [3.2, -4.6], [-28.6, -2.2], [28.6, -2.2], [-28.6, 30], [-11, 36.6], [11, 36.6], [-2.6, 44.6], [30.6, 13]] as const) m.light([x, 2.6, z], { fixture: 'wall', color: '#ffc27a', intensity: 0.7, range: 7, yaw: z < -4 ? Math.PI : x < -28 ? -P : x > 28 ? P : 0 });

// ---------------------------------------------------------------- the grounds

m.bounds('invisible', 4, { min: [-62, -46], max: [62, 82] });
let seed = 0x4011;
const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
/** Room for a garden piece `r` m round (x, z): off the house, the paths and the maze (unless it is the maze), clear of spawns, pickups, hills and other props. */
const marks = () => m.doc.entities.filter((e) => e.kind !== 'prop' && e.kind !== 'light' && e.kind !== 'block').map((e) => e.position);
const planted: [number, number, number][] = [];
function clear(x: number, z: number, r: number, maze = false): boolean {
  if (x < -61 || x > 61 || z < -45 || z > 81) return false;
  if (fromManor(x, z) < 3 + r || onPath(x, z)) return false;
  if (!maze && inMaze(x, z, 2 + r)) return false;
  if (marks().some((p) => p[1] > -1 && Math.hypot(p[0] - x, p[2] - z) < r + 2)) return false;
  return planted.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > r + pr);
}
function plant(model: string, x: number, z: number, o: { r?: number; yaw?: number; scale?: number; solid?: boolean; maze?: boolean } = {}): boolean {
  const r = o.r ?? 1;
  if (!o.maze && !clear(x, z, r)) return false;
  planted.push([x, z, r]);
  put(model, [x, gy(x, z), z], o.yaw ?? rnd() * 6.28, o.scale ?? 0.85 + rnd() * 0.3, o.solid ?? true);
  return true;
}

// The hedge maze (south-west): a seeded perfect maze with a few extra gaps, entrances north and east.
{
  const { x0, z0, nx, nz, step } = MAZE;
  const east = Array.from({ length: nx }, () => new Array(nz).fill(true)); // wall east of (i, j)
  const north = Array.from({ length: nx }, () => new Array(nz).fill(true)); // wall north of (i, j)
  const seen = Array.from({ length: nx }, () => new Array(nz).fill(false));
  const stack: [number, number][] = [[3, 2]];
  seen[3]![2] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1]!;
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([di, dj]) => [i + di, j + dj, di, dj] as const).filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < nz && !seen[a]![b]);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [a, b, di, dj] = next[Math.floor(rnd() * next.length)]!;
    if (di === 1) east[i]![j] = false;
    if (di === -1) east[a]![b] = false;
    if (dj === 1) north[i]![j] = false;
    if (dj === -1) north[a]![b] = false;
    seen[a]![b] = true;
    stack.push([a, b]);
  }
  for (let k = 0; k < 7; k++) {
    const i = Math.floor(rnd() * (nx - 1));
    const j = Math.floor(rnd() * (nz - 1));
    if (rnd() < 0.5) east[i]![j] = false;
    else north[i]![j] = false;
  }
  const hedge = (x: number, z: number, yaw: number) => {
    planted.push([x, z, 0.5]);
    put('hedge_large', [x, gy(x, z), z], yaw, 1.3);
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const cx = x0 + step * (i + 0.5);
      const cz = z0 + step * (j + 0.5);
      const exitN = j === nz - 1 && (i === 1 || i === 5);
      const exitE = i === nx - 1 && j === 2;
      if (east[i]![j] && !exitE) hedge(cx + step / 2, cz, 0);
      if (north[i]![j] && !exitN) hedge(cx, cz + step / 2, P);
      if (i === 0 && j !== 3) hedge(cx - step / 2, cz, 0);
      if (j === 0) hedge(cx, cz - step / 2, P);
    }
  }
  // The centre of the maze: a stag statue among the hedges and candles.
  plant('rn_statue_stag', x0 + step * 3.5 + 1.6, z0 + step * 2.5 + 1.6, { maze: true, yaw: 0.6, scale: 1 });
}

// The graveyard (north): rows of stones, two mausoleums, an iron fence, dead trees.
for (let x = -36; x <= 36; x += 4) {
  for (let z = 54; z <= 76; z += 5) {
    if (Math.abs(x) < 6 || rnd() < 0.35) continue;
    const kinds = ['gravestone_cross', 'gravestone_round', 'gravestone_broken', 'gravestone_round', 'grave'];
    const k = kinds[Math.floor(rnd() * kinds.length)]!;
    plant(k, x + (rnd() - 0.5), z + (rnd() - 0.5), { r: k === 'grave' ? 1.8 : 0.8, yaw: Math.PI + (rnd() - 0.5) * 0.3, scale: 1, solid: k !== 'grave' });
  }
}
for (const s of [-1, 1]) {
  plant('crypt', s * 28, 72, { r: 3.4, yaw: s > 0 ? -P : P, scale: 1.1 });
  plant('cross_column', s * 14, 66, { r: 1, yaw: 0, scale: 1 });
  plant('obelisk', s * 40, 56, { r: 1, yaw: 0, scale: 1 });
}
for (let x = -44; x <= 44; x += 1.9) {
  if (Math.abs(x) < 12) continue;
  plant(Math.abs(x) > 30 && rnd() < 0.3 ? 'iron_fence_damaged' : 'iron_fence', x, 49, { r: 0.3, yaw: 0, scale: 1 });
}
for (const [x, z] of [[-14, 52], [14, 52], [-20, 70], [24, 58], [-40, 76], [44, 74], [6, 78]] as const) plant('candles', x, z, { r: 0.4, scale: 1, solid: false });
// The garden: dead trees and gnarled willows, overgrown thickets, statues, urns, benches, pumpkins.
for (let i = 0; i < 60; i++) {
  const x = -60 + rnd() * 120;
  const z = -44 + rnd() * 124;
  plant(['nt_dead_tree', 'nt_willow_dead', 'rn_dead_tree'][i % 3]!, x, z, { r: 2.2 });
}
for (let i = 0; i < 40; i++) {
  const x = -60 + rnd() * 120;
  const z = -44 + rnd() * 124;
  const kinds = ['nt_bush_leafy', 'nt_bush_berries', 'nt_fern_wide', 'hedge'];
  const k = kinds[i % kinds.length]!;
  for (let n = 0; n < (k === 'hedge' ? 1 : 3); n++) plant(k, x + (rnd() - 0.5) * 3, z + (rnd() - 0.5) * 3, { r: k === 'hedge' ? 2.6 : 0.9, solid: k === 'hedge' });
}
for (const [model, x, z] of [
  ['fountain', 0, -27], ['rn_statue_stag', 40, -6], ['rn_statue_fox', -40, 40], ['rn_urn', 34, 34], ['rn_urn', 34, -2], ['graveyard_bench', 44, 22], ['graveyard_bench', -44, 22],
  ['pumpkin', -34, 6], ['pumpkin', -36, 26], ['pumpkin', 38, 8], ['lantern_post', -6, -10], ['lantern_post', 6, -10], ['lantern_post', -6, 50], ['lantern_post', 6, 50], ['rn_column_broken', 22, -20], ['rn_column_broken', 30, -30],
] as const) plant(model, x, z, { r: model === 'fountain' ? 5 : 0.8, yaw: model === 'fountain' ? 0 : undefined, scale: model === 'fountain' ? 0.8 : 1, solid: model !== 'pumpkin' });
for (const [x, z] of [[-6, -10], [6, -10], [-6, 50], [6, 50]] as const) m.light([x, gy(x, z) + 2.4, z], { fixture: 'none', color: '#ffc27a', intensity: 0.6, range: 8 });

m.meta({
  description:
    'A gothic manor on a storm-lashed hill, and the house is armed. Levers with red lamps spring its traps on whoever stands in the wrong room: laser fences across the long gallery from the study, a balcony lever that seals the great hall and fires its spikes (the way out is through the trapdoors into the crypt), a chandelier crusher over the dining table, spike plates in the cellar corridor, iron gates in the crypt, a secret door behind the library shelves and rotten floor in the attic. Rockets wait in the crypt, heavy armour in the attic; outside, a hedge maze, a graveyard and a dead garden.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [6, 14],
});
await m.save();
