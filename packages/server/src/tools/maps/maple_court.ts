/**
 * Maple Court: a sunny late afternoon on a suburban cul-de-sac (our own map).
 * Five two-storey homes sit round a short dead-end road that runs south onto
 * a main street; across the main street are a corner liquor store, a
 * basketball court and a burger stand with a parking lot full of lowriders.
 * Alleys run behind the back yards, fenced off with gaps and gates.
 *
 * - The homes (each its own layout and paint): mustard (H1) and sky blue (H2)
 *   on the west side, salmon (H3, three cells wide with a straight stair) at
 *   the head of the court, mint (H4) and cream (H5) on the east side. Living
 *   rooms, kitchens and dining rooms below, bedrooms and bathrooms above,
 *   garages and a workshop; every pane of glass breaks.
 * - Back yards: an above-ground pool behind H2, a treehouse in the vacant lot
 *   north-west, a big back yard behind H4.
 * - The main street (south): the liquor store (ladder to its roof at the
 *   back), the fenced basketball court, the burger stand and its lot.
 * - Crews: the court crew spawns at the cul-de-sac end (north alley and back
 *   yards), the street crew along the service alley behind the shops.
 *
 * Grid x east, y north (one cell = 8 m; levels z0 and z1).
 *
 *   y16  a  a  a  a  a  a  a  a  a  a  a  a  a     a north alley
 *   y15  a  v  v  v  v  b  b  b  y  y  y  y  a     v vacant lot (treehouse), b H3's back yard
 *   y14  a  v  v  v  v  3  3  3  y  y  y  y  a     y H4's big yard
 *   y13  a  v  v  v  v  3  3  3  y  y  y  y  a
 *   y12  a  v  v  v  v  (  (  (  y  y  y  y  a     ( ) the turning circle
 *   y11  a  v  v  v  v  (  (  (  y  y  y  y  a
 *   y10  a  P  P  2  2  l  r  l  4  4  y  y  a     P pool, l lawns, r road
 *   y9   a  P  P  2  2  l  r  l  4  4  y  y  a
 *   y8   a  .  .  s  s  l  r  l  g  .  .  .  a     s side yard, g garage
 *   y7   a  .  .  1  1  l  r  l  5  5  .  .  a
 *   y6   a  .  .  1  1  l  r  l  5  5  .  .  a
 *   y5   a  .  .  .  g  d  r  d  g  .  .  .  a     d driveways
 *   y3-4 =  =  =  =  =  =  =  =  =  =  =  =  =     the main street
 *   y2   S  L  L  .  c  c  c  c  .  B  t  p  p     S stock room, L liquor store, c court, B burger stand, t tables
 *   y1   S  L  L  .  c  c  c  c  .  .  p  p  p     p parking lot
 *   y0   .  .  .  .  c  c  c  c  .  .  p  p  p     service alley (street crew)
 *        1  2  3  4  5  6  7  8  9 10 11 12 13
 */
import type { EdgeStyle, RoomOptions, RoomType, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('maple_court', 'Maple Court');
m.theme('garden');
m.backdrop('sunset', 'hills', 'grass', 0.3);
m.teams([8, 8]);
const [court, street] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const PI = Math.PI;
type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];
const r2 = (n: number) => +n.toFixed(2);
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const SIDE_D: Record<Side, [number, number]> = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
let panes = 0;
/** A wall style on one side; windows get a pane of glass that shoots out. */
function edge(x: number, y: number, z: number, side: Side, style: EdgeStyle): void {
  m.edge(x, y, z, side, style);
  if (style !== 'window') return;
  const [dx, dy] = SIDE_D[side];
  m.add({ kind: 'destructible', id: `pane_${String(++panes).padStart(3, '0')}`, name: 'Window pane', model: 'glass', position: at(x, y, z, dx * 4, dy * 4), yaw: side === 'N' || side === 'S' ? 0 : P, health: null, explosiveOnly: false });
}
let doors = 0;
function frontDoor(x: number, y: number, side: Side): void {
  const [dx, dy] = SIDE_D[side];
  m.add({ kind: 'door', id: `door_${++doors}`, name: 'Front door', position: at(x, y, 0, dx * 4, dy * 4), yaw: side === 'N' || side === 'S' ? 0 : P, startOpen: false, locked: false, auto: true });
}

// ---------------------------------------------------------------- the homes

type Kind = 'living' | 'kitchen' | 'dining' | 'bed' | 'bath' | 'den' | 'garage' | 'laundry' | 'well' | 'stairs';
interface House {
  tint: string;
  /** "x,y,z" -> what the cell is ('well'/'stairs' cells are the stair tile, given on z0 and z1). */
  cells: Record<string, Kind>;
  /** The stair tile: [x, y, rotation, kind]. */
  stair: [number, number, 0 | 1 | 2 | 3, 'stairwell' | 'stairs'];
  /** Edge overrides, "x,y,z,Side" -> style (exterior defaults to a window, internal to a door). */
  edges: Record<string, EdgeStyle>;
  front: [number, number, Side];
}
const FLOORS: Record<Kind, string> = { living: 'pbr_floorboards', den: 'pbr_carpet', dining: 'pbr_floorboards', kitchen: 'pbr_checker', bed: 'pbr_carpet', bath: 'white_tiles', laundry: 'white_tiles', garage: 'pbr_concrete', well: 'pbr_floorboards', stairs: 'pbr_floorboards' };
const DRESS: Partial<Record<Kind, RoomType>> = { living: 'living', den: 'living', dining: 'dining', kitchen: 'kitchen', bed: 'bedroom', bath: 'bathroom', laundry: 'bathroom', garage: 'workshop' };
const HOUSES: House[] = [];
const OPEN_PAIRS = new Set(['living:dining', 'dining:living', 'living:den', 'den:living']);
function house(h: House): void {
  HOUSES.push(h);
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const [sx, sy, sr, skind] = h.stair;
  m.tile(skind, sx, sy, 0, sr);
  paint(sx, sy, 0, { floor: mat('pbr_floorboards'), walls: mat('pbr_plaster_white', h.tint), underside: mat('pbr_plaster_white', '#f4efe4'), trim: mat('pbr_plaster_white', '#fbf8f0'), solids: mat('pbr_walnut') });
  for (const [k, kind] of Object.entries(h.cells)) {
    if (kind === 'well' || kind === 'stairs') continue;
    const [x, y, z] = k.split(',').map(Number) as V3;
    const roofed = !h.cells[key(x, y, z + 1)];
    const opts: RoomOptions = roofed ? { ceiling: 'roof' } : {};
    m.tile('room', x, y, z, 0, opts);
    const surf: TileSurfaces = {
      floor: mat(FLOORS[kind], kind === 'bed' ? '#8a7a9a' : kind === 'den' ? '#6a8a7a' : null),
      walls: mat('pbr_plaster_white', kind === 'garage' ? '#c8c2b4' : h.tint),
      underside: mat('pbr_plaster_white', '#f4efe4'),
      trim: mat('pbr_plaster_white', '#fbf8f0'),
      solids: mat('pbr_walnut'),
    };
    paint(x, y, z, surf);
  }
  for (const [k, kind] of Object.entries(h.cells)) {
    if (kind === 'well' || kind === 'stairs') continue;
    const [x, y, z] = k.split(',').map(Number) as V3;
    for (const side of ['N', 'E', 'S', 'W'] as Side[]) {
      const [dx, dy] = SIDE_D[side];
      const other = h.cells[key(x + dx, y + dy, z)];
      const override = h.edges[`${k},${side}`];
      if (other === 'well' || other === 'stairs') continue; // the stair tile's own walls and openings
      if (other) {
        if (side === 'S' || side === 'W') continue; // each shared wall once
        edge(x, y, z, side, override ?? (OPEN_PAIRS.has(`${kind}:${other}`) ? 'arch' : 'door'));
      } else edge(x, y, z, side, override ?? (kind === 'garage' ? 'wall' : 'window'));
    }
  }
  frontDoor(...h.front);
}
const cells = (z0: Record<string, Kind>, z1: Record<string, Kind>): Record<string, Kind> => {
  const out: Record<string, Kind> = {};
  for (const [k, v] of Object.entries(z0)) out[`${k},0`] = v;
  for (const [k, v] of Object.entries(z1)) out[`${k},1`] = v;
  return out;
};

// H1, mustard (west, front door east): a stairwell at the back, garage on the driveway.
house({
  tint: '#e6c26a',
  cells: cells({ '5,7': 'living', '4,7': 'kitchen', '5,6': 'dining', '4,6': 'well', '5,5': 'garage' }, { '5,7': 'bed', '4,7': 'bath', '5,6': 'den', '4,6': 'well' }),
  stair: [4, 6, 2, 'stairwell'],
  edges: { '5,7,0,E': 'door', '4,7,0,W': 'door', '5,5,0,E': 'wide' },
  front: [5, 7, 'E'],
});
// H2, sky blue (west, front door east): the workshop garage opens on the side yard; the pool out back.
house({
  tint: '#8cc4e0',
  cells: cells({ '5,10': 'living', '4,10': 'kitchen', '4,9': 'garage', '5,9': 'well' }, { '5,10': 'den', '4,10': 'bed', '4,9': 'bath', '5,9': 'well' }),
  stair: [5, 9, 1, 'stairwell'],
  edges: { '5,10,0,E': 'door', '4,10,0,W': 'door', '4,9,0,S': 'wide', '4,9,0,W': 'door', '4,9,1,S': 'window' },
  front: [5, 10, 'E'],
});
// H3, salmon (the head of the court, front door south): three cells wide, a straight stair up from the living room.
house({
  tint: '#eea48e',
  cells: cells(
    { '6,13': 'living', '6,14': 'dining', '7,14': 'kitchen', '8,14': 'laundry', '8,13': 'garage', '7,13': 'stairs' },
    { '6,13': 'bed', '6,14': 'bed', '7,14': 'bath', '8,13': 'den', '8,14': 'bed', '7,13': 'stairs' },
  ),
  stair: [7, 13, 0, 'stairs'],
  edges: { '6,13,0,S': 'door', '7,14,0,N': 'door', '8,13,0,S': 'wide', '8,13,0,E': 'door', '8,14,0,E': 'window' },
  front: [6, 13, 'S'],
});
// H4, mint (east, front door west): stairwell in the back corner, a garage on the side.
house({
  tint: '#a6d4a0',
  cells: cells({ '9,10': 'living', '9,9': 'kitchen', '10,9': 'dining', '10,10': 'well', '9,8': 'garage' }, { '9,10': 'bed', '9,9': 'bath', '10,9': 'bed', '10,10': 'well' }),
  stair: [10, 10, 3, 'stairwell'],
  edges: { '9,10,0,W': 'door', '10,9,0,E': 'door', '9,8,0,W': 'wide', '9,8,0,N': 'door' },
  front: [9, 10, 'W'],
});
// H5, cream (east, front door west): stairwell beside the kitchen, garage on the driveway.
house({
  tint: '#efe2c4',
  cells: cells({ '9,7': 'living', '10,7': 'kitchen', '9,6': 'dining', '10,6': 'well', '9,5': 'garage' }, { '9,7': 'bed', '10,7': 'bed', '9,6': 'bath', '10,6': 'well' }),
  stair: [10, 6, 0, 'stairwell'],
  edges: { '9,7,0,W': 'door', '9,7,0,N': 'wall', '10,7,0,E': 'door', '9,5,0,W': 'wide' },
  front: [9, 7, 'W'],
});
// Roof caps: a dark overhanging lid on each house (covers the stairwells too), and on the garages.
const ROOFING = { material: 'pbr_roof', tint: '#5a4c44' };
const lid = (x0: number, y0: number, x1: number, y1: number, top: number) => m.block([r2((x0 + x1) * 4), top, r2((y0 + y1) * 4)], [(x1 - x0 + 1) * 8 + 1.2, 0.22, (y1 - y0 + 1) * 8 + 1.2], 'solid', ROOFING);
lid(4, 6, 5, 7, 8);
lid(4, 9, 5, 10, 8);
lid(6, 13, 8, 14, 8);
lid(9, 9, 10, 10, 8);
lid(9, 6, 10, 7, 8);
// Chimneys.
for (const [x, z] of [[33, 58], [33, 82], [47, 114], [81, 82], [81, 58]] as const) m.block([x, 8.2, z], [1.2, 1.6, 1.2], 'solid', { material: 'pbr_brick_red' });

// ---------------------------------------------------------------- the shops across the main street

// The liquor store: a big shopfront room on the corner, the stock room behind.
m.tile('room_large', 2, 1, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'storefront' });
m.tile('room', 1, 1, 0, 0, { ceiling: 'roof', facade: 'brick' });
m.tile('room', 1, 2, 0, 0, { ceiling: 'roof', facade: 'brick' });
const STORE: TileSurfaces = { floor: mat('white_tiles'), walls: mat('pbr_plaster_white', '#d8d0c0'), underside: mat('pbr_white_panel'), solids: mat('pbr_walnut') };
const STOCK: TileSurfaces = { floor: mat('pbr_concrete'), walls: mat('pbr_brick_old'), underside: mat('pbr_concrete') };
paint(2, 1, 0, STORE);
paint(1, 1, 0, STOCK);
paint(1, 2, 0, STOCK);
edge(2, 2, 0, 'N', 'door');
edge(3, 2, 0, 'N', 'window');
edge(3, 2, 0, 'E', 'window');
edge(3, 1, 0, 'E', 'window');
edge(2, 1, 0, 'S', 'door');
edge(3, 1, 0, 'S', 'wall');
edge(2, 2, 0, 'W', 'door');
edge(2, 1, 0, 'W', 'wall');
edge(1, 2, 0, 'N', 'window');
edge(1, 1, 0, 'S', 'door');
edge(1, 1, 0, 'W', 'wall');
edge(1, 2, 0, 'W', 'window');
edge(1, 1, 0, 'N', 'open');
m.add({ kind: 'door', id: 'door_store', name: 'Liquor store door', position: at(2, 2, 0, 0, 4), yaw: 0, startOpen: false, locked: false, auto: true });
// Up the back of the stock room to the roof.
m.add({ kind: 'ladder', position: [5.6, 0, 3.35], yaw: PI, height: 4.1, width: 0.9 });

// The burger stand: a kiosk with counter hatches onto the street and the tables.
m.tile('room', 10, 2, 0, 0, { ceiling: 'roof' });
paint(10, 2, 0, { floor: mat('pbr_checker'), walls: mat('pbr_plaster_white', '#e05a3a'), underside: mat('pbr_white_panel'), solids: mat('pbr_steel', '#d8d8d8') });
edge(10, 2, 0, 'N', 'half');
edge(10, 2, 0, 'E', 'half');
edge(10, 2, 0, 'S', 'door');
edge(10, 2, 0, 'W', 'window');
// Its sign on the roof.
m.block([80, 4, 16], [6, 1.4, 0.3], 'solid', { material: 'paint_gloss', tint: '#f2c230' });
m.block([80, 5.4, 16], [6.4, 0.25, 0.4], 'solid', { material: 'paint_gloss', tint: '#c8322a' });

// ---------------------------------------------------------------- streets, yards and lots

m.fill('city.street', 1, 3, 13, 3);
const built = new Set<string>();
for (const t of m.doc.classicStructure.tiles) if (t.z === 0) built.add(`${t.x},${t.y}`);
for (const [x, y] of [[2, 2], [3, 1], [3, 2], [4, 7], [5, 6], [5, 7], [4, 10], [5, 10], [4, 9], [5, 9], [6, 13], [6, 14], [7, 14], [8, 13], [8, 14], [9, 10], [10, 9], [10, 10], [9, 9], [9, 6], [9, 7], [10, 6], [10, 7], [4, 6]] as const) built.add(`${x},${y}`);
for (let x = 1; x <= 13; x++) built.add(`${x},3`).add(`${x},4`);
const ASPHALT = mat('pbr_asphalt', '#7a7a80');
const ALLEY = mat('pbr_concrete', '#a8a49c');
const DRIVE = mat('pbr_concrete', '#d0ccc0');
const LAWN = mat('pbr_grass');
const COURT = mat('paint_matte', '#3a7a6a');
const LOTFLOOR = mat('pbr_asphalt', '#5c5c62');
const FENCEWALL = mat('pbr_brick_old', '#b0a090');
function ground(x: number, y: number): ReturnType<typeof mat> {
  if (x === 1 || x === 13 || y === 16) return ALLEY;
  if (y <= 2) {
    if (x >= 5 && x <= 8) return COURT;
    if ((x >= 10 && y <= 1) || (x >= 12 && y === 2)) return LOTFLOOR;
    if (x === 11 && y === 2) return DRIVE;
    return ALLEY;
  }
  if (x === 7 && y <= 12) return ASPHALT;
  if (x >= 6 && x <= 8 && y >= 11 && y <= 12) return ASPHALT;
  if (y === 5 && (x === 6 || x === 8)) return DRIVE;
  if ((y === 8 && (x === 3 || x === 4 || x === 5)) || (x === 8 && y === 8)) return DRIVE;
  return LAWN;
}
for (let x = 1; x <= 13; x++) for (let y = 0; y <= 16; y++) {
  if (built.has(`${x},${y}`)) continue;
  m.tile('yard', x, y);
  paint(x, y, 0, { floor: ground(x, y), walls: FENCEWALL });
}
// The block walls round the outside: high brick behind the alleys, chain-link round the court.
for (let y = 5; y <= 16; y++) m.edge(1, y, 0, 'W', 'high').edge(13, y, 0, 'E', 'high');
for (let y = 0; y <= 2; y++) {
  if (!built.has(`1,${y}`)) m.edge(1, y, 0, 'W', 'high');
  m.edge(13, y, 0, 'E', 'high');
}
for (let x = 1; x <= 13; x++) m.edge(x, 16, 0, 'N', 'high');
for (let x = 1; x <= 13; x++) if (x < 5 || x > 8) m.edge(x, 0, 0, 'S', 'high');
for (let x = 5; x <= 8; x++) m.edge(x, 0, 0, 'S', 'fence');
for (const y of [0, 2]) m.edge(5, y, 0, 'W', 'fence').edge(8, y, 0, 'E', 'fence');
for (const x of [5, 8]) m.edge(x, 2, 0, 'N', 'fence');

// ---------------------------------------------------------------- fences (free blocks)

const WOOD = { material: 'pbr_planks', tint: '#9a7650' };
const PICKET = { material: 'pbr_planks', tint: '#f2eee2' };
/** A fence from (x0, z0) to (x1, z1) (straight along x or z), `h` high, leaving `gaps` (centre, width) open. */
function fence(x0: number, z0: number, x1: number, z1: number, h: number, look: Look, gaps: [number, number][] = []): void {
  const alongX = z0 === z1;
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
  const a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  let from = a0;
  const cuts = [...gaps.map(([c, w]) => [c - w / 2, c + w / 2] as const), [a1, a1] as const].sort((p, q) => p[0] - q[0]);
  for (const [g0, g1] of cuts) {
    if (g0 > from + 0.2) {
      const mid = r2((from + g0) / 2);
      m.block(alongX ? [mid, 0, z0] : [x0, 0, mid], alongX ? [r2(g0 - from), h, 0.2] : [0.2, h, r2(g0 - from)], 'solid', look);
    }
    from = Math.max(from, g1);
  }
}
// Back fences along the alleys (a gate into each yard), and between the lots.
fence(12, 36, 12, 124, 1.9, WOOD, [[48, 3], [76, 3], [96, 4], [112, 3]]);
fence(100, 36, 100, 124, 1.9, WOOD, [[48, 3], [72, 3], [96, 4], [112, 3]]);
fence(12, 124, 100, 124, 1.9, WOOD, [[24, 4], [56, 3], [84, 4]]);
fence(12, 60, 28, 60, 1.9, WOOD, [[20, 3]]);
fence(12, 84, 28, 84, 1.9, WOOD, [[16, 3]]);
fence(84, 60, 100, 60, 1.9, WOOD, [[92, 3]]);
fence(84, 84, 100, 84, 1.9, WOOD, [[88, 3]]);
fence(44, 116, 44, 124, 1.9, WOOD, [[120, 2.5]]);
fence(68, 116, 68, 124, 1.9, WOOD);
fence(12, 36.2, 28, 36.2, 1.9, WOOD, [[16, 3]]);
fence(84, 36.2, 100, 36.2, 1.9, WOOD, [[96, 3]]);
// Picket fences along the front lawns (hop them, or use the gaps at the paths).
fence(51.8, 44, 51.8, 84, 0.9, PICKET, [[56, 3], [64, 6], [80, 3]]);
fence(60.2, 44, 60.2, 84, 0.9, PICKET, [[56, 3], [64, 6], [80, 3]]);

// ---------------------------------------------------------------- the pool behind H2 (above ground) and the treehouse

const POOL = { x0: 15, x1: 25, z0: 68, z1: 74 };
const TILE = { material: 'white_tiles', tint: '#e8f0f2' };
const WALLH = 1.25;
m.block([20, 0, POOL.z0], [POOL.x1 - POOL.x0, WALLH, 0.35], 'solid', TILE);
m.block([20, 0, POOL.z1], [POOL.x1 - POOL.x0, WALLH, 0.35], 'solid', TILE);
m.block([POOL.x0, 0, 71], [0.35, WALLH, POOL.z1 - POOL.z0 + 0.35], 'solid', TILE);
m.block([POOL.x1, 0, 71], [0.35, WALLH, POOL.z1 - POOL.z0 + 0.35], 'solid', TILE);
m.water([20, 0, 71], [POOL.x1 - POOL.x0 - 0.35, 1.1, POOL.z1 - POOL.z0 - 0.35]);
// Steps up the outside of the east end and down inside it.
for (let i = 0; i < 3; i++) m.block([POOL.x1 + 0.45 + (2 - i) * 0.5, 0, 71], [0.5, 0.4 * (i + 1), 2.4], 'solid', TILE);
for (let i = 0; i < 3; i++) m.block([POOL.x1 - 0.45 - (2 - i) * 0.5, 0, 71], [0.5, 0.4 * (i + 1), 2.4], 'solid', TILE);
// The treehouse in the vacant lot: an oak, a deck on four posts round it, rails, a roof, and a ladder.
const TH = { x: 24, z: 104, y: 3.6 };
const BOARD = { material: 'pbr_planks', tint: '#8a6440' };
for (const [dx, dz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]] as const) m.block([TH.x + dx, 0, TH.z + dz], [0.3, TH.y, 0.3], 'solid', BOARD);
m.block([TH.x, TH.y - 0.25, TH.z], [5, 0.25, 5], 'solid', BOARD);
m.block([TH.x, TH.y, TH.z - 2.4], [5, 1, 0.2], 'solid', BOARD);
m.block([TH.x, TH.y, TH.z + 2.4], [5, 1, 0.2], 'solid', BOARD);
m.block([TH.x - 2.4, TH.y, TH.z], [0.2, 1, 4.6], 'solid', BOARD);
m.block([TH.x + 2.4, TH.y, TH.z - 1.6], [0.2, 1, 1.4], 'solid', BOARD);
m.block([TH.x + 2.4, TH.y, TH.z + 1.6], [0.2, 1, 1.4], 'solid', BOARD);
for (const [dx, dz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]] as const) m.block([TH.x + dx, TH.y + 1, TH.z + dz], [0.2, 1.4, 0.2], 'solid', BOARD);
m.block([TH.x, TH.y + 2.4, TH.z], [5.6, 0.2, 5.6], 'solid', { material: 'pbr_roof', tint: '#6a3a2a' });
m.add({ kind: 'ladder', position: [TH.x + 2.75, 0, TH.z], yaw: P, height: TH.y, width: 0.9 });
m.prop('nt_common_tree', [TH.x - 5.5, 0, TH.z + 4], 0.6, 1.6);

// ---------------------------------------------------------------- the basketball court

const HOOP = { material: 'pbr_steel', tint: '#d8d8d8' };
for (const [x, dir] of [[38.5, 1], [65.5, -1]] as const) {
  m.block([x, 0, 8], [0.3, 3.2, 0.3], 'solid', HOOP);
  m.block([x + dir * 0.4, 2.8, 8], [0.2, 1.1, 1.8], 'solid', { material: 'paint_gloss', tint: '#f4f4f0' });
  m.block([x + dir * 0.85, 3.0, 8], [0.7, 0.1, 0.7], 'solid', { material: 'paint_gloss', tint: '#e0602a' });
}
// The lines: thin painted slabs (a 10 cm step at most).
for (const [x, z, w, d] of [[52, 8, 0.2, 14], [52, 1.2, 26, 0.2], [52, 14.8, 26, 0.2], [39, 8, 0.2, 14], [65, 8, 0.2, 14]] as const) m.block([x, 0, z], [w, 0.1, d], 'solid', { material: 'paint_matte', tint: '#f2f0e8' });
m.prop('bench', [52, 0, 18.4], PI).prop('bench', [44, 0, 18.4], PI).prop('trashcan', [60, 0, 18.6]);

// ---------------------------------------------------------------- lowriders and cars (free blocks)

const PAINT = (tint: string) => ({ material: 'paint_gloss', tint });
const TYRE = { material: 'pbr_steel', tint: '#202020' };
const WHITEWALL = { material: 'paint_matte', tint: '#ece8e0' };
const CHROME = { material: 'pbr_steel', tint: '#e4e8ec' };
const GLASS = { material: 'paint_gloss', tint: '#2a3440' };
const turn = (x: number, z: number, yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
function part(cx: number, cz: number, yaw: number, lx: number, lz: number, y: number, size: V3, look: Look): void {
  const [ox, oz] = turn(lx, lz, yaw);
  m.block([r2(cx + ox), r2(y), r2(cz + oz)], size, 'solid', { ...look, yaw: r2(yaw) });
}
/** A long, low lowrider (along local x): whitewall tyres, chrome bumpers, a long bonnet and boot. */
function lowrider(cx: number, cz: number, yaw: number, tint: string, roof = tint): void {
  for (const lx of [-1.8, 1.8]) for (const lz of [-0.9, 0.9]) {
    part(cx, cz, yaw, lx, lz, 0, [0.7, 0.55, 0.28], TYRE);
    part(cx, cz, yaw, lx, lz * 1.12, 0.12, [0.42, 0.32, 0.2], WHITEWALL);
  }
  part(cx, cz, yaw, 0, 0, 0.18, [5.6, 0.6, 2.05], PAINT(tint));
  part(cx, cz, yaw, 2.9, 0, 0.25, [0.2, 0.25, 2.1], CHROME);
  part(cx, cz, yaw, -2.9, 0, 0.25, [0.2, 0.25, 2.1], CHROME);
  part(cx, cz, yaw, -0.4, 0, 0.78, [2.3, 0.45, 1.85], GLASS);
  part(cx, cz, yaw, -0.4, 0, 1.23, [2.4, 0.1, 1.9], PAINT(roof));
}
// Along the main street (the road runs z 22..34), and in the driveways and the burger lot.
lowrider(14, 23.4, 0, '#7a1f4a', '#f0e8e0');
lowrider(34, 32.6, PI, '#2a6ab0');
lowrider(70, 23.4, 0.04, '#d8a22a', '#f4efe4');
lowrider(96, 32.6, PI, '#3a8a5a');
// Everyday cars in the driveways and the lot: Designersoup's low-poly cars (CC0; props face +Z, the lowriders run along x).
m.prop('car_offroader', [50, 0, 40.5], 0); // H1's driveway
m.prop('car_beetle', [64, 0, 40.5], PI); // H5's driveway
m.prop('car_pickup', [84, 0, 2.5], 0); // the burger lot
lowrider(96, 6, P + 0.1, '#b02a3a', '#f0e8e0');
lowrider(104, 2.5, P, '#2a8ab0');
lowrider(64, 97, 0.3, '#e2d2a0'); // the turning circle
// A pickup on bricks in H4's big yard.
part(84, 106, 0.3, 0, 0, 0, [4.6, 0.45, 1.8], { material: 'pbr_brick_red' });
part(84, 106, 0.3, 0, 0, 0.45, [5.2, 0.7, 2], PAINT('#6a7a5a'));
part(84, 106, 0.3, 1.1, 0, 1.15, [1.6, 0.6, 1.8], GLASS);

// ---------------------------------------------------------------- spawns

// The court crew: the north alley and the back yards at the head of the court.
for (const [x, z] of [[20, 128], [36, 128], [52, 128], [72, 128], [90, 128], [50, 120], [32, 114], [80, 118]] as const) m.spawn([x, 0, z], PI, court);
// The street crew: the service alley behind the shops and the burger lot.
for (const [x, z] of [[7, -1], [14, -2], [28, -2], [34, 6], [72, -2], [76, 6], [100, 16], [106, 18]] as const) m.spawn([x, 0, z], 0, street);
// Everyone, for deathmatch.
for (const [x, z, yaw] of [[8, 60, P], [104, 56, -P], [8, 100, P], [104, 100, -P], [56, 48, 0], [94, 74, -P], [20, 50, 0], [36, 98, P], [76, 98, -P], [52, 2, 0], [20, 12, 0], [88, 46, PI]] as const) m.spawn([x, 0, z], yaw, null);

// ---------------------------------------------------------------- objectives

m.flag(court, [56, 0, 121], PI);
m.flag(street, [90, 0, 2], 0);
m.hill([56, 0, 92], 6); // the turning circle
m.hill([52, 0, 8], 6); // the basketball court
m.hill([56, 0, 28], 6); // the mouth of the court, on the main street

// ---------------------------------------------------------------- pickups

m.pickup('weapon_sniper', [24.6, TH.y, 103.4]); // up in the treehouse
m.pickup('weapon_shotgun', at(5, 6, 0, 0, 0)).pickup('weapon_smg', at(9, 6, 0)).pickup('weapon_rifle', at(7, 8, 0, 0, 0));
m.pickup('weapon_auto_shotgun', at(7, 14, 0)).pickup('weapon_burst_rifle', at(1, 11, 0)).pickup('weapon_lmg', at(13, 9, 0));
m.pickup('weapon_marksman', at(4, 10, 1)).pickup('weapon_machine_pistol', at(2, 2, 0, 2, -2)).pickup('weapon_sawed_off', at(10, 2, 0, 1.5, 1.5));
m.pickup('weapon_rockets', [52, 0, 8], 60);
m.pickup('armor_large', at(8, 14, 1)).pickup('armor_small', at(3, 6, 0)).pickup('armor_small', at(11, 7, 0)).pickup('armor_small', at(11, 1, 0));
m.pickup('health_large', at(10, 9, 1)).pickup('health_small', at(5, 7, 1)).pickup('health_small', at(1, 1, 0)).pickup('health_small', at(13, 13, 0));
m.pickup('health_small', at(9, 2, 0)).pickup('health_small', at(2, 13, 0)).pickup('health_small', at(11, 12, 0));
m.pickup('ammo', at(4, 2, 0)).pickup('ammo', at(7, 16, 0)).pickup('ammo_rifle', at(1, 7, 0)).pickup('ammo_rifle', at(13, 6, 0));
m.pickup('ammo_shells', at(6, 9, 0)).pickup('ammo_sniper', at(3, 12, 0)).pickup('grenades', at(8, 11, 0)).pickup('grenades', at(4, 1, 0));

// ---------------------------------------------------------------- street furniture and planting

for (const [x, z, yaw] of [[6, 37, 0], [30, 37, 0], [62, 37, 0], [90, 37, 0], [18, 19, PI], [46, 19, PI], [74, 19, PI], [102, 19, PI]] as const) m.prop('lightpost', [x, 0, z], yaw);
for (const [x, z] of [[46, 46], [46, 70], [66, 52], [66, 76], [40, 98], [72, 98], [10, 38.5], [102, 38.5], [32, 18]] as const) m.prop(x % 4 === 0 ? 'nt_palm_tall' : 'nt_palm_curved', [x, 0, z], (x * 0.37) % 6.28, 0.9);
for (const [x, z] of [[46, 62], [66, 62], [46, 82], [66, 82], [36, 88], [76, 88], [20, 56], [92, 56], [40, 112], [72, 108]] as const) m.prop('nt_bush_leafy', [x, 0, z], (x + z) % 6, 1.1, false);
m.prop('nt_common_tree_2', [88, 0, 116], 0.4, 1.3).prop('nt_common_tree', [92, 0, 92], 1.2, 1.1);
// The burger stand's tables, under parasols.
for (const [x, z] of [[86, 14], [90.5, 18], [89, 12]] as const) m.prop('table_round', [x, 0, z], 0).prop('parasol', [x, 0, z], 0.4, 1, false);
// Bins along the alleys, a skip behind the store, a couple of barbecues, the road block at the street ends.
m.prop('hm_bin_large', [5.5, 0, 44], P).prop('hm_bin_large', [106.5, 0, 66], -P).prop('hm_bin_large', [28, 0, 130], 0).prop('sv_trashcan_metal', [84, 0, 130]);
m.prop('skip', [20, 0, -1.5], P).prop('cardboard_box', [33, 0, 1]).prop('crate_bottles', [5, 0, 1.5]);
for (const z of [24, 28, 32]) m.prop('barrier', [5.5, 0, z], 0).prop('barrier', [106.5, 0, z], 0);
m.prop('cone', [8, 0, 22.5], 0, 1, false).prop('cone', [104, 0, 33.5], 0, 1, false);
m.prop('sv_propane', [90, 0, 70], 0).prop('sv_propane', [22, 0, 52], 0);
m.prop('hm_chair_wood', [26, 0, 64], 0.5).prop('hm_chair_wood', [14, 0, 78], 2.4).prop('parasol', [26, 0, 62], 0, 1, false);
m.breakable('gas', [99, 0, 108]);
m.breakable('barrel', [104, 0, 92]);

// ---------------------------------------------------------------- dressing (after spawns and pickups, which it keeps clear)

for (const h of HOUSES) {
  for (const [k, kind] of Object.entries(h.cells)) {
    const type = DRESS[kind];
    if (!type) continue;
    const [x, y, z] = k.split(',').map(Number) as V3;
    m.dress([x, y, z], type, { density: kind === 'garage' ? 'normal' : 'full' });
  }
}
m.dress({ x0: 2, y0: 1, x1: 3, y1: 2 }, 'shop', { density: 'full' });
m.dress({ x0: 1, y0: 1, x1: 1, y1: 2 }, 'storage', { density: 'full' });
m.dress([10, 2, 0], 'kitchen', { density: 'full' });

// ---------------------------------------------------------------- lights: warm inside, sodium lamps outside

for (const t of m.doc.classicStructure.tiles) {
  if (t.tile !== 'core.room' && t.tile !== 'core.room_large') continue;
  if (t.tile === 'core.room_large') for (const [dx, dy] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) m.light(at(t.x, t.y, 0, dx, dy, 3.45), { color: '#fff4e0', intensity: 1.1, range: 9 });
  else m.light(at(t.x, t.y, t.z, 0, 0, 3.45), { color: '#ffe2b8', intensity: 0.9, range: 9 });
}
for (const [x, z] of [[6, 37], [30, 37], [62, 37], [90, 37], [18, 19], [46, 19], [74, 19], [102, 19]] as const) m.light([x, 3.1, z], { color: '#ffcf8a', intensity: 1, range: 14, fixture: 'none' });
m.light([24, 5.4, 104], { color: '#ffd9a0', intensity: 0.8, range: 6, fixture: 'bulb' });

m.bounds('invisible');
m.meta({
  description:
    'A suburban cul-de-sac on a sunny late afternoon: five two-storey homes round a turning circle, each with its own layout and paint, front lawns and picket fences, back yards fenced off from the alleys with gaps and gates, a pool behind the blue house and a treehouse in the vacant lot. The court runs out onto a main street with a corner liquor store, a fenced basketball court and a burger stand with lowriders in its lot. The court crew holds the cul-de-sac end, the street crew the main street; every pane of glass breaks.',
  modes: ['core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [8, 16],
});
await m.save();
