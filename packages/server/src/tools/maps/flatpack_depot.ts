/**
 * Flatpack Depot: an original flat-pack furniture superstore, for 8–20
 * players (the roadmap's "IKEA-style store", under our own name and colours).
 *
 * - The car park (south): rows of parked cars, trolley corrals and stray
 *   trolleys, lamp posts, a buggy; the entrance canopy.
 * - The way round, as the store means you to go: in at the entrance, up the
 *   stairs to the showroom, a one-way path winding through 35 furnished room
 *   sets (living rooms, kitchens, bedrooms, home offices, dining rooms,
 *   bathrooms, kids' bunk rooms, studies, meeting rooms), with shortcut doors
 *   and low partitions between the rows; windows look down into the
 *   warehouse. At the end the restaurant (the meatball counter, the dining
 *   hall), then stairs down to the market hall: shelving, bargain bins and
 *   stacks of goods. Then the self-serve warehouse and out through the checkouts.
 * - The self-serve warehouse (56 × 64 m, 16 m high): four pallet racks in two
 *   sections each, with decks at 3, 6 and 9 m; rolling stairs up to the first
 *   deck, ladders up the rack ends to the others. Forklift aisles with
 *   go-karts standing in for the forklifts, parked forklifts as cover, the
 *   loading dock on the east side and the collection door onto the car park.
 *
 * Grid x east, y north (one cell = 8 m); z0 ground floor, z1 showroom and restaurant.
 *
 *  y8   a  a  a  a  a  a  a  a  a  a  a  a  a  a  a     a service road
 *  y7   a  ^  M  M  M  M  M  W  W  W  W  W  W  W  a     z1 over M: restaurant (y6..7) and the showroom (y0..5)
 *  y6   a  M  M  M  M  M  v  W  W  W  W  W  W  W  a     ^ stairwell (both floors), v stairs down from the restaurant
 *  y5   a  M  M  M  M  M  M  W  W  W  W  W  W  W  d     M market hall, W warehouse, d loading dock
 *  y4   a  M  M  M  M  M  M  W  W  W  W  W  W  W  d
 *  y3   a  M  M  M  M  M  M  W  W  W  W  W  W  W  d
 *  y2   a  M  M  M  M  M  M  W  W  W  W  W  W  W  a
 *  y1   a  M  M  M  M  M  M  W  W  W  W  W  W  W  a
 *  y0   a  E  /  C  C  C  C  W  W  W  W  W  W  W  a     E entrance, / stairs up, C checkouts
 *  y-1  p  p  p  p  p  p  p  p  p  p  p  p  p  p  p     p car park
 *  ...
 *  y-4  p  p  p  p  p  p  p  p  p  p  p  p  p  p  p
 *      -7 -6 -5 -4 -3 -2 -1  0  1  2  3  4  5  6  7
 */
import type { EdgeStyle, RoomOptions, RoomType, Rotation, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('flatpack_depot', 'Flatpack Depot');
m.theme('factory');
m.factions([
  { id: 'showroom', name: 'Showroom', color: '#2f5fd0', relations: {} },
  { id: 'warehouse', name: 'Warehouse', color: '#f0c020', relations: {} },
]);
m.teams([10, 10]);
const [SHOW, WARE] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Mat = { material: string; tint?: string };
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];

// ---------------------------------------------------------------- surfaces

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const BLUE_WALL = mat('pbr_corrugated', '#2a4fa8');
const YELLOW_TRIM = mat('paint_gloss', '#f2c418');
const ENTRANCE: TileSurfaces = { floor: mat('pbr_terrazzo', '#d8d4cc'), walls: mat('pbr_plaster_white', '#f0eee8'), trim: YELLOW_TRIM };
const CHECKOUT: TileSurfaces = { floor: mat('pbr_concrete', '#b8b4ac'), walls: mat('pbr_plaster_white', '#f0eee8'), trim: YELLOW_TRIM };
const MARKET: TileSurfaces = { floor: mat('pbr_concrete', '#c4bfb4'), walls: mat('pbr_plaster_white', '#ecebe4'), solids: mat('paint_gloss', '#f2c418'), trim: mat('paint_gloss', '#2a4fa8') };
const WAREHOUSE: TileSurfaces = { floor: mat('pbr_concrete_dark', '#a8a49c'), walls: mat('pbr_corrugated', '#c8ccd0'), solids: mat('pbr_steel'), trim: mat('hazard') };
const RESTAURANT: TileSurfaces = { floor: mat('pbr_floorboards', '#c8a070'), walls: mat('pbr_plaster_white', '#f4f0e4'), trim: mat('pbr_walnut') };
const STAIR: TileSurfaces = { floor: mat('pbr_terrazzo', '#c8c4bc'), walls: mat('pbr_plaster_white', '#f0eee8'), solids: mat('pbr_steel', '#b8bcc0'), trim: YELLOW_TRIM };
const LOT: TileSurfaces = { floor: mat('pbr_asphalt'), walls: BLUE_WALL };
const ROAD: TileSurfaces = { floor: mat('pbr_asphalt', '#8a8a8a'), walls: mat('pbr_concrete', '#9a9890') };
/** Room-set floors and walls, taken in turn round the showroom. */
const SET_FLOORS = [
  mat('pbr_floorboards'), mat('pbr_carpet', '#8a8a7a'), mat('white_tiles', '#e4e4dc'), mat('pbr_walnut', '#8a6a4a'), mat('pbr_checker', '#d8d0c0'),
  mat('pbr_carpet', '#4a6a8a'), mat('pbr_terrazzo', '#e0d8cc'), mat('pbr_floorboards', '#d8b890'), mat('pbr_delft', '#d8dce8'), mat('pbr_carpet', '#8a4a4a'),
];
const SET_WALLS = ['#f4f2ec', '#e8f0e8', '#f4e8d8', '#e0e8f4', '#f8f4e0', '#ece0f0', '#dcece8', '#f4f4f4'];

// ---------------------------------------------------------------- tiles

const cells = new Map<string, { kind: string; group: string }>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
let solo = 0;
function place(kind: string, x: number, y: number, z: number, o: { rot?: Rotation; opts?: RoomOptions; surf?: TileSurfaces; group?: string } = {}): void {
  m.tile(kind, x, y, z, o.rot ?? 0, o.opts);
  const group = o.group ?? `solo${++solo}`;
  const foot: [number, number, number][] = kind === 'stairwell' || kind === 'stairs' ? [[0, 0, 0], [0, 0, 1]] : [[0, 0, 0]];
  for (const [dx, dy, dz] of foot) {
    const k = key(x + dx, y + dy, z + dz);
    if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
    cells.set(k, { kind, group });
  }
  if (o.surf) paint(x, y, z, o.surf);
}
const OPEN: RoomOptions = { layout: 'empty' };
const ROOF: RoomOptions = { layout: 'empty', ceiling: 'roof' };
const room = (x: number, y: number, z: number, surf: TileSurfaces, group?: string, opts: RoomOptions = OPEN) => place('room', x, y, z, { surf, group, opts });

// Ground floor: entrance, the stairs up, checkouts, the market hall, the warehouse.
room(-6, 0, 0, ENTRANCE);
place('stairs', -5, 0, 0, { rot: 0, surf: STAIR }); // up east to the first room set
for (let x = -4; x <= -1; x++) room(x, 0, 0, CHECKOUT, 'checkout');
place('stairwell', -6, 7, 0, { rot: 2, surf: STAIR }); // doors east: market hall and restaurant
place('stairs', -1, 6, 0, { rot: 3, surf: STAIR }); // from the restaurant (north, z1) down south into the market hall
for (let x = -6; x <= -1; x++) for (let y = 1; y <= 7; y++) if (!cells.has(key(x, y, 0))) room(x, y, 0, MARKET, 'market', { layout: 'empty', corners: 'posts' });
for (let x = 0; x <= 6; x++) for (let y = 0; y <= 7; y++) room(x, y, 0, WAREHOUSE, 'warehouse');

// Upstairs: the showroom path (rows y0..y5, snaking), the restaurant (y6..y7).
const PATH: [number, number][] = [];
for (let x = -4; x <= -1; x++) PATH.push([x, 0]);
for (let y = 1; y <= 5; y++) for (let i = 0; i < 6; i++) PATH.push([y % 2 ? -1 - i : -6 + i, y]);
const SETS: [number, number][] = [...PATH, [-6, 0]];
SETS.forEach(([x, y], i) => room(x, y, 1, { floor: SET_FLOORS[i % SET_FLOORS.length]!, walls: mat('pbr_plaster_white', SET_WALLS[i % SET_WALLS.length]!), trim: mat('pbr_walnut', '#b08a62') }, undefined, ROOF));
for (const [x, y] of [[-6, 6], [-5, 6], [-4, 6], [-3, 6], [-2, 6], [-5, 7], [-4, 7], [-3, 7], [-2, 7], [-1, 7]] as const) room(x, y, 1, RESTAURANT, 'restaurant', ROOF);

// Outside: the car park south, the service road round the other three sides.
for (let x = -7; x <= 7; x++) for (let y = -4; y <= 8; y++) if (!cells.has(key(x, y, 0))) place('yard', x, y, 0, { surf: y < 0 ? LOT : ROAD, group: 'out' });

// ---------------------------------------------------------------- walls and openings

const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const fills: [number, number, Side][] = []; // openings in the warehouse's towering walls, filled above 4 m

// Entrance and stairs.
link(-6, 0, 0, 'S', 'door');
link(-6, 0, 0, 'W', 'window');
link(-6, 0, 0, 'E', 'wide'); // the foot of the stairs
link(-5, 0, 1, 'E', 'wide'); // the top, into the first room set
link(-6, 0, 0, 'N', 'door'); // a shortcut into the market hall
// Checkouts: open to the market hall, out through the doors to the car park.
for (let x = -4; x <= -1; x++) {
  link(x, 0, 0, 'N', x === -4 ? 'wall' : 'wide');
  link(x, 0, 0, 'S', x === -3 || x === -2 ? 'door' : 'window');
}
link(-4, 0, 0, 'W', 'wall');
// Stairwell and the stairs down from the restaurant.
link(-6, 7, 0, 'E', 'door');
link(-6, 7, 1, 'E', 'door');
link(-1, 6, 0, 'S', 'wide');
link(-1, 6, 1, 'N', 'wide');
// Market hall into the warehouse; the checkouts from it.
for (let y = 1; y <= 7; y++) link(-1, y, 0, 'E', y === 2 || y === 4 ? 'wide' : 'wall');
link(-1, 0, 0, 'E', 'wide');
link(-6, 3, 0, 'W', 'door'); // staff door onto the service road
// Showroom: the path open along each row (wide doorways and open sides in turn), turns at the ends,
// low partitions and shortcut doors between the rows, windows over the warehouse and the road.
for (let i = 0; i + 1 < PATH.length; i++) {
  const [ax, ay] = PATH[i]!;
  const [bx, by] = PATH[i + 1]!;
  const side: Side = bx > ax ? 'E' : bx < ax ? 'W' : 'N';
  link(ax, ay, 1, side, side === 'N' ? 'wide' : i % 3 === 0 ? 'wide' : 'open');
}
link(-6, 5, 1, 'N', 'wide'); // the end of the path, into the restaurant
for (const [x, y] of [[-6, 0], [-2, 1], [-5, 2], [-3, 3], [-4, 4]] as const) link(x, y, 1, 'N', 'door');
for (const [x, y] of [[-4, 1], [-3, 1], [-2, 2], [-3, 2], [-5, 3], [-2, 4], [-3, 4]] as const) link(x, y, 1, 'N', 'half');
for (const y of [1, 3, 5]) link(-1, y, 1, 'E', 'window');
for (const y of [2, 4]) link(-6, y, 1, 'W', 'window');
for (let x = -4; x <= -1; x++) link(x, 0, 1, 'S', 'window');
link(-6, 0, 1, 'E', 'wall');
// Restaurant: windows north over the service road and east into the warehouse.
for (let x = -5; x <= -1; x++) link(x, 7, 1, 'N', 'windows');
link(-1, 7, 1, 'E', 'window');
link(-6, 6, 1, 'W', 'window');
// Warehouse: towering walls; the collection door onto the car park, a loading door, the dock (east).
for (let x = 0; x <= 6; x++) {
  const southOpen = x === 2 || x === 5;
  link(x, 0, 0, 'S', southOpen ? 'wide' : 'tower');
  if (southOpen) fills.push([x, 0, 'S']);
  link(x, 7, 0, 'N', x === 3 ? 'door' : 'tower');
  if (x === 3) fills.push([x, 7, 'N']);
}
for (let y = 0; y <= 7; y++) {
  const dock = y === 3 || y === 4;
  link(6, y, 0, 'E', dock ? 'wide' : 'tower');
  if (dock) fills.push([6, y, 'E']);
}
// The service road and car park: walls round the lot.
for (let x = -7; x <= 7; x++) {
  link(x, -4, 0, 'S', 'fence');
  link(x, 8, 0, 'N', 'high');
}
for (let y = -4; y <= 8; y++) {
  link(-7, y, 0, 'W', y < 0 ? 'fence' : 'high');
  link(7, y, 0, 'E', y < 0 ? 'fence' : 'high');
}

for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
const done = new Set<string>(links.keys());
for (const [k, here] of cells) {
  if (here.kind !== 'room') continue;
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  for (const side of ['N', 'E', 'S', 'W'] as const) {
    const [dx, dy] = DIRS[side];
    const there = cells.get(key(x + dx, y + dy, z));
    const id = sideId(x, y, z, side);
    if (!there || done.has(id)) continue;
    done.add(id);
    if (there.kind === 'yard') continue; // outside walls (auto)
    m.edge(x, y, z, side, there.group === here.group ? 'open' : 'wall');
  }
}

// ---------------------------------------------------------------- free blocks

let nBlocks = 0;
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mt: Mat, o: { yaw?: number } = {}): void {
  nBlocks++;
  if (x1 - x0 < 0.2) [x0, x1] = [(x0 + x1) / 2 - 0.1, (x0 + x1) / 2 + 0.1];
  if (z1 - z0 < 0.2) [z0, z1] = [(z0 + z1) / 2 - 0.1, (z0 + z1) / 2 + 0.1];
  if (y1 - y0 < 0.1) y0 = y1 - 0.1;
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(x1 - x0), r2(y1 - y0), r2(z1 - z0)], 'solid', { material: mt.material, tint: mt.tint, yaw: o.yaw });
}
const STEEL: Mat = { material: 'pbr_steel', tint: '#3a5a9a' };
const BEAM: Mat = { material: 'paint_gloss', tint: '#e86a1a' };
const DECK: Mat = { material: 'pbr_walkway', tint: '#8a8e92' };
const PANEL: Mat = { material: 'pbr_steel', tint: '#5a6a8a' };
const YELLOW: Mat = { material: 'paint_gloss', tint: '#f2c418' };
const BLUEP: Mat = { material: 'paint_gloss', tint: '#2a4fa8' };
const GLOW: Mat = { material: 'light_strip', tint: '#fff4dc' };

// The warehouse: towering walls are filled above every opening; the inside wall over the showroom; the roof.
for (const [x, y, side] of fills) {
  const [cx, , cz] = at(x, y);
  if (side === 'S' || side === 'N') {
    const z = cz + (side === 'S' ? -4 : 4);
    box(cx - 4, 4, z - 0.15, cx + 4, 16, z + 0.15, { material: 'pbr_corrugated', tint: '#c8ccd0' });
  } else box(cx + 3.85, 4, cz - 4, cx + 4.15, 16, cz + 4, { material: 'pbr_corrugated', tint: '#c8ccd0' });
}
box(-4.15, 8, -4, -3.85, 16, 60, { material: 'pbr_corrugated', tint: '#c8ccd0' });
box(-4, 15.6, -4, 52, 16, 60, { material: 'pbr_corrugated', tint: '#7a8088' });
// Four pallet racks (x 4, 16, 28, 40), two sections each (z 6..26, 30..50), decks at 3, 6 and 9 m.
const RACKS = [4, 16, 28, 40];
const SECTIONS: [number, number][] = [[6, 26], [30, 50]];
const LEVELS = [3, 6, 9];
const rackTop = (i: number, sec: number): V3 => [RACKS[i]!, 9, (SECTIONS[sec]![0] + SECTIONS[sec]![1]) / 2];
RACKS.forEach((cx, ri) => {
  SECTIONS.forEach(([z0, z1], si) => {
    for (const h of LEVELS) {
      box(cx - 1.5, h - 0.2, z0, cx + 1.5, h, z1, DECK);
      for (const s of [-1, 1]) box(cx + s * 1.5 - 0.06, h - 0.35, z0, cx + s * 1.5 + 0.06, h - 0.2, z1, BEAM); // orange beams
    }
    // Uprights just outside the decks (mid-span) and the end frames: the outer end full height with a
    // ladder to the top deck, the end on the cross-aisle 6 m high with a ladder to the middle deck.
    for (const s of [-1, 1]) box(cx + s * 1.6 - 0.1, 0, (z0 + z1) / 2 - 0.1, cx + s * 1.6 + 0.1, 9.4, (z0 + z1) / 2 + 0.1, STEEL);
    const outer = si === 0 ? z0 : z1;
    const inner = si === 0 ? z1 : z0;
    const out = si === 0 ? -1 : 1;
    box(cx - 1.5, 0, outer - 0.1, cx + 1.5, 9, outer + 0.1, PANEL);
    box(cx - 1.5, 0, inner - 0.1, cx + 1.5, 6, inner + 0.1, PANEL);
    for (const s of [-1, 1]) box(cx + s * 1.5 - 0.1, 6, inner - 0.1, cx + s * 1.5 + 0.1, 9.4, inner + 0.1, STEEL);
    m.add({ kind: 'ladder', position: [cx, 0, r2(outer + out * 0.15)], yaw: out < 0 ? S : 0, height: 9, width: 0.9 });
    m.add({ kind: 'ladder', position: [cx, 0, r2(inner - out * 0.15)], yaw: out < 0 ? 0 : S, height: 6, width: 0.9 });
    // Rolling stairs up to the first deck alongside every section (east and west sides in turn):
    // twelve steps and a landing beside the deck.
    {
      const east = (ri + si) % 2 === 0;
      const [sx0, sx1] = east ? [cx + 1.5, cx + 4] : [cx - 4, cx - 1.5];
      const zs = si === 0 ? z0 + 0.5 : z1 - 9;
      for (let j = 0; j < 12; j++) box(sx0, 0, zs + 0.5 * j, sx1, r2(0.25 * (j + 1)), zs + 0.5 * (j + 1), YELLOW);
      box(sx0, 0, zs + 6, sx1, 3, zs + 8.5, YELLOW);
      const rail = east ? sx1 - 0.1 : sx0;
      box(rail, 3, zs + 6, rail + 0.1, 4, zs + 8.5, STEEL); // the landing's rail
    }
  });
});
// Parked forklifts (cover): body, overhead guard, mast and forks.
for (const [x, z, yaw] of [[10, 2, 0], [34, 28, P], [46, 54, S]] as const) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const off = (d: number): [number, number] => [x + s * d, z + c * d];
  const [bx, bz] = off(0);
  m.block([r2(bx), 0, r2(bz)], [1.3, 1.4, 2.2], 'solid', { material: 'paint_gloss', tint: '#f2c418', yaw });
  m.block([r2(bx), 2.1, r2(bz)], [1.3, 0.1, 1.4], 'solid', { material: 'pbr_steel', tint: '#2a2a2a', yaw });
  const [mx, mz] = off(1.25);
  m.block([r2(mx), 0, r2(mz)], [1.2, 2.6, 0.25], 'solid', { material: 'pbr_steel', tint: '#2a2a2a', yaw });
  const [fx, fz] = off(1.9);
  m.block([r2(fx), 0.1, r2(fz)], [1, 0.1, 1.1], 'solid', { material: 'pbr_steel', tint: '#3a3a3a', yaw });
  nBlocks += 4;
}
// Pallets of flat-packs on the warehouse floor, in front of the collection door.
for (const [x, z] of [[18, -1], [26, -1], [44, 8], [-1, 40]] as const) {
  box(x - 1.2, 0, z - 1, x + 1.2, 0.15, z + 1, { material: 'crate_wood' });
  box(x - 1.1, 0.15, z - 0.9, x + 1.1, 1.3, z + 0.9, { material: 'pbr_corrugated', tint: '#b89a6a' });
}

// The market hall: bargain bins (waist-high), the shelving gondolas, the yellow price columns.
for (const [x, z] of [[-44, 12], [-32, 12], [-20, 12], [-44, 36], [-20, 36]] as const) {
  box(x - 1.5, 0, z - 1, x + 1.5, 0.9, z + 1, BLUEP);
  box(x - 1.4, 0.9, z - 0.9, x + 1.4, 1.05, z + 0.9, { material: 'pbr_canvas', tint: '#d8c8a8' });
}
for (const z of [20, 28]) for (const [x0, x1] of [[-46, -36], [-30, -18]] as const) box(x0, 0, z - 0.6, x1, 1.6, z + 0.6, { material: 'pbr_white_panel', tint: '#e8e8e0' });
for (const [x, z] of [[-40, 4], [-24, 4], [-40, 44], [-24, 44]] as const) box(x - 0.3, 0, z - 0.3, x + 0.3, 4, z + 0.3, YELLOW);
// The checkout lanes: belts and the tills between them.
for (const x of [-26, -18, -10]) box(x - 0.5, 0, -2.6, x + 0.5, 0.95, 1.6, { material: 'pbr_steel', tint: '#d8dce0' });

// The restaurant (z1): the meatball counter along the north wall, menu boards glowing over it, the tray rail.
box(-44, 4, 57.6, -20, 5.1, 58.8, { material: 'pbr_steel', tint: '#d0d4d8' });
box(-44, 5.1, 57.6, -20, 5.2, 58.8, { material: 'pbr_white_panel' });
box(-44, 4, 56.4, -20, 4.95, 56.7, { material: 'pbr_steel', tint: '#8a8e92' });
box(-42, 6, 59.6, -22, 7.2, 59.8, GLOW);
for (const x of [-38, -32, -26]) box(x - 1.6, 6.1, 59.55, x + 1.6, 7.1, 59.6, { material: 'light_strip', tint: x === -32 ? '#f2c418' : '#5a8ae8' });

// Outside: the blue box with its yellow band and the sign, the entrance canopy, cars, trolley corrals.
box(-52.4, 6.6, -4.5, -4, 7.6, -4.3, YELLOW);
box(-4, 14.6, -4.5, 52.4, 15.6, -4.3, YELLOW);
box(8, 9, -4.6, 44, 13, -4.4, BLUEP);
box(10, 10, -4.7, 42, 12, -4.6, { material: 'light_strip', tint: '#f2c418' });
box(-52, 3.6, -10, -40, 4, -4.3, BLUEP);
box(-52.2, 3.4, -10.2, -39.8, 3.6, -9.8, { material: 'light_strip', tint: '#f2c418' });
for (const x of [-51.5, -40.5]) box(x - 0.15, 0, -9.85, x + 0.15, 3.6, -9.55, STEEL);
const CAR_COLOURS = ['#c83a3a', '#e8e0d0', '#2a4a8a', '#1a1a1a', '#d8b84a', '#4a8a5a', '#8a8a92', '#5a2a6a'];
let carN = 0;
const car = (x: number, z: number) => {
  const col = CAR_COLOURS[carN++ % CAR_COLOURS.length]!;
  m.block([x, 0.3, z], [1.9, 0.75, 4.4], 'solid', { material: 'paint_gloss', tint: col });
  m.block([x, 1.05, z], [1.7, 0.6, 2.2], 'solid', { material: 'paint_gloss', tint: '#2a3038' });
  m.block([x, 0, z], [1.7, 0.3, 3.6], 'solid', { material: 'pbr_steel', tint: '#1a1a1a' });
  nBlocks += 3;
};
for (const x of [-52, -46, -34, -22, -16, 10, 22, 34, 46]) car(x, -18);
for (const x of [-46, -40, -28, -10, 4, 16, 28, 40]) car(x, -27);
// Trolley corrals: low rails with trolleys nested in them, and strays across the lot.
for (const [x, z] of [[-4, -22], [52, -22], [-56, -22]] as const) {
  for (const dx of [-1.1, 1.1]) box(x + dx - 0.05, 0, z - 3, x + dx + 0.05, 1, z + 3, STEEL);
  box(x - 1.15, 0.9, z - 3, x + 1.15, 1, z - 2.9, STEEL);
}

// ---------------------------------------------------------------- doors

const door = (id: string, name: string, pos: V3, yaw: number) => m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked: false, auto: true });
door('door_entrance', 'Entrance', at(-6, 0, 0, 0, -4), 0);
door('door_exit_1', 'Exit', at(-3, 0, 0, 0, -4), 0);
door('door_exit_2', 'Exit', at(-2, 0, 0, 0, -4), 0);
door('door_staff', 'Staff door', at(-6, 3, 0, -4, 0), P);
door('door_yard', 'Yard door', at(3, 7, 0, 0, 4), 0);

// ---------------------------------------------------------------- objectives, spawns, pickups

// Capture the Flag: the Showroom's flag in the restaurant, the Warehouse's at the back of the racks.
m.flag(SHOW, at(-4, 7, 1, 0, -1), S);
m.flag(WARE, [48, 0, 56], S);
// King of the Hill: the restaurant, the rack tops, the market hall.
m.hill(at(-4, 6, 1, 0, 2), 6).hill(rackTop(1, 0), 3).hill(rackTop(2, 1), 3).hill(at(-3, 4, 0, -4, 0), 6);

// The Showroom team: room sets along the path.
for (const [x, y, yaw] of [[-4, 0, P], [-2, 0, P], [-1, 1, -P], [-4, 1, -P], [-6, 2, P], [-3, 2, P], [-2, 3, -P], [-5, 3, -P], [-5, 4, P], [-2, 5, -P]] as const) m.spawn(at(x, y, 1, 0, 1.5), yaw, SHOW);
// The Warehouse team: the forklift aisles.
for (const [x, z] of [[-1, 12], [-1, 24], [10, 16], [10, 40], [22, 16], [22, 40], [34, 12], [34, 46], [46, 16], [46, 40]] as const) m.spawn([x, 0, z], -P, WARE);
// Everyone's.
for (const [p, yaw] of [
  [at(-6, 0, 0), 0], [at(-4, 1, 0), 0], [at(-6, 5, 0), P], [at(-2, 6, 0, 0, 2), S], [at(-3, 2, 0), 0], [at(-5, 3, 0, 0, 3), P],
  [at(-3, 0, 1, 0, -1.5), P], [at(-6, 1, 1, 1.5, 0), 0], [at(-1, 2, 1, -1.5, 0), S], [at(-6, 3, 1, 1.5, 0), 0], [at(-1, 4, 1, -1.5, 0), S], [at(-5, 5, 1), 0],
  [at(-2, 7, 1), S], [at(-5, 6, 1), P], [[28, 0, 58], S], [[48, 0, 4], -P], [[16, 0, -2], 0], [[40, 0, 28], -P],
  [[-20, 0, -14], 0], [[20, 0, -32], 0], [[-56, 0, 40], P], [[0, 0, 66], S], [[58, 0, 30], -P], [[40, 0, -10], 0],
] as [V3, number][]) m.spawn(p, yaw);

// Pickups. Rack tops: the sniper and the rail; the market hall and showroom: close-quarters guns.
m.pickup('weapon_sniper', rackTop(3, 1)).pickup('ammo_sniper', rackTop(0, 0));
m.pickup('weapon_rockets', [28, 0, 28]).pickup('ammo_explosive', rackTop(2, 0));
m.pickup('weapon_lmg', rackTop(1, 1)).pickup('armor_large', [22, 0, 28]);
m.pickup('weapon_auto_shotgun', at(-3, 3, 1)).pickup('ammo_shells', at(-4, 2, 1));
m.pickup('weapon_shotgun', at(-5, 6, 0)).pickup('weapon_smg', at(-2, 2, 0)).pickup('weapon_smg', at(-5, 1, 1));
m.pickup('weapon_rifle', [10, 0, 28]).pickup('weapon_rifle', at(-2, 0, 1)).pickup('ammo_rifle', [46, 0, 28]).pickup('ammo_rifle', at(-6, 4, 1));
m.pickup('weapon_burst_rifle', at(-1, 5, 1)).pickup('weapon_marksman', at(-1, 7, 1, 0, -1));
m.pickup('weapon_hand_cannon', at(-2, 0, 0, 0, 1)).pickup('ammo_light', at(-6, 0, 0, 0, 1));
m.pickup('weapon_flamethrower', at(-3, 6, 1)).pickup('ammo_fuel', at(-4, 5, 0));
m.pickup('weapon_nailgun', [34, 0, 56]).pickup('ammo_cells', [10, 0, 56]).pickup('weapon_machine_pistol', [-28, 0, -24]);
m.pickup('grenades', [16, 0, 28]).pickup('grenades', at(-6, 1, 0)).pickup('grenades', at(-3, 4, 1)).pickup('grenades', [56, 0, 60]);
m.pickup('health_large', at(-3, 7, 1)).pickup('health_large', [40, 0, 4]).pickup('health_large', at(-4, 3, 0));
m.pickup('health_small', at(-4, 0, 1, 0, 1)).pickup('health_small', at(-5, 2, 1)).pickup('health_small', at(-2, 4, 1)).pickup('health_small', at(-6, 5, 1));
m.pickup('health_small', [4, 0, 56]).pickup('health_small', [52, 0, 28]).pickup('health_small', [-40, 0, -14]).pickup('health_small', [0, 0, -30]);
m.pickup('armor_small', at(-1, 3, 1)).pickup('armor_small', at(-2, 5, 0)).pickup('armor_small', [-6, 0, 4]).pickup('armor_small', rackTop(0, 1));
m.pickup('ammo', at(-6, 2, 0)).pickup('ammo', at(-1, 3, 0)).pickup('ammo', [52, 0, 52]).pickup('ammo', at(-4, 4, 1));
m.pickup('powerup_damage', rackTop(2, 1), 90);
// Forklifts: go-karts in the aisles; a buggy in the car park.
m.mount('kart', [22, 0, 4], 0).mount('kart', [34, 0, 52], S).mount('buggy', [-34, 0, -10], P);
// Gas bottles for the forklifts.
m.breakable('gas', [51, 0, 36]).breakable('gas', [51, 0, 37]).breakable('barrel', [-2, 0, 58]);

// ---------------------------------------------------------------- dressing

// The room sets, each furnished as what it sells.
const SET_TYPES: RoomType[] = ['living', 'kitchen', 'bedroom', 'office', 'dining', 'bathroom', 'barracks', 'library', 'living', 'bedroom', 'conference', 'kitchen', 'living', 'office', 'bedroom', 'dining', 'barracks', 'bathroom'];
SETS.forEach(([x, y], i) => {
  const type = x === -6 && y === 0 ? 'barracks' : SET_TYPES[i % SET_TYPES.length]!;
  m.dress([x, y, 1], type, { density: i % 3 === 0 ? 'full' : 'normal', seed: `set-${i}-${type}`, max: 11 });
});
m.dress({ x0: -5, y0: 7, x1: -2, y1: 7, z: 1 }, 'bar', { density: 'normal', max: 12 });
m.dress({ x0: -6, y0: 6, x1: -2, y1: 6, z: 1 }, 'dining', { density: 'full', max: 30 });
// The market hall's departments.
m.dress({ x0: -6, y0: 1, x1: -4, y1: 3, z: 0 }, 'kitchen', { density: 'normal', max: 16, seed: 'cookshop' });
m.dress({ x0: -3, y0: 1, x1: -1, y1: 3, z: 0 }, 'shop', { density: 'full', max: 24, seed: 'textiles' });
m.dress({ x0: -6, y0: 4, x1: -4, y1: 6, z: 0 }, 'storage', { density: 'normal', max: 16, seed: 'storage' });
m.dress({ x0: -3, y0: 4, x1: -2, y1: 6, z: 0 }, 'shop', { density: 'normal', max: 14, seed: 'lighting' });
m.dress([-6, 0, 0], 'lobby', { density: 'sparse', max: 6 });
// The warehouse: flat-pack boxes under the bottom racks, the dock's crates.
let boxN = 0;
for (const cx of RACKS) for (const [z0, z1] of SECTIONS) for (let z = z0 + 2; z < z1 - 1; z += 3.2) {
  const model = ['factory_box_long', 'cardboard_box', 'factory_box'][boxN++ % 3]!;
  m.prop(model, [cx, 0, r2(z)], (boxN % 2) * P, 1.2);
}
for (const [x, z] of [[49, 20], [49, 24], [49, 38]] as const) m.prop('crate_large', [x, 0, z], 0);
m.prop('container', [56, 0, 52], 0).prop('skip', [0, 0, 66], P);
// The car park: trolleys in the corrals and loose.
for (const [x, z] of [[-4, -22], [52, -22], [-56, -22]] as const) for (const dz of [-2, -0.8, 0.4, 1.6]) m.prop('shopping_cart', [x, 0, z + dz], 0, 1, false);
for (const [x, z, yaw] of [[-40, -12, 0.6], [-14, -22, 2.1], [8, -12, -1], [30, -22, 2.8], [-50, -30, 1.4], [44, -31, -0.4], [-24, -7, 0.3]] as const) m.prop('shopping_cart', [x, 0, z], yaw);
for (const x of [-44, -16, 16, 44]) m.prop('lightpost_double', [x, 0, -22.5], 0);
for (const x of [-26, -18, -10]) m.prop('checkout', [x + 2.2, 0, -0.5], S);
m.prop('shopping_cart', [-50, 0, -2], 0.3).prop('shopping_cart', [-49, 0, -2.5], 0.4);

// ---------------------------------------------------------------- lights

m.lightRooms({ color: '#fff6e8', intensity: 0.9 });
for (const [x, y] of [...SETS, [-6, 6], [-5, 6], [-4, 6], [-3, 6], [-2, 6], [-5, 7], [-4, 7], [-3, 7], [-2, 7], [-1, 7]] as [number, number][]) m.light(at(x, y, 1, 0, 0, 3.45), { color: '#fff1d6', intensity: 1, range: 9 });
for (let x = 0; x <= 6; x++) for (let y = 0; y <= 7; y += 2) m.light(at(x, y, 0, 0, 4, 14.6), { fixture: 'bulb', color: '#f4f8ff', intensity: 1.3, range: 22 });
for (const x of RACKS) for (const [z0, z1] of SECTIONS) m.light([x, 9.5, (z0 + z1) / 2], { fixture: 'none', color: '#e8f0ff', intensity: 0.8, range: 10 });
m.light([-32, 6.5, 57], { fixture: 'strip', color: '#ffe8b0', intensity: 1.3, range: 12 });
for (const x of [-44, -16, 16, 44]) m.light([x, 6, -22.5], { fixture: 'none', color: '#ffb060', intensity: 1.3, range: 18 });
m.light([26, 11, -6], { fixture: 'none', color: '#f2c418', intensity: 1.5, range: 16 });
m.light([-46, 3.2, -7], { fixture: 'none', color: '#fff4dc', intensity: 1.2, range: 10 });
for (const [x, z] of [[-60, 30], [60, 12], [60, 52], [20, 68], [-30, 68]] as const) m.light([x, 4, z], { fixture: 'none', color: '#ffb060', intensity: 1, range: 14 });

m.bounds('invisible', 4, undefined, 24);
m.backdrop('dusk', 'city', 'grass', 0.5);
m.meta({
  description:
    'A huge flat-pack furniture superstore. The Showroom team starts upstairs on the one-way path winding through 35 furnished room sets (living rooms, kitchens, bedrooms, home offices, kids\' bunk rooms, bathrooms, dining rooms) with shortcut doors and low partitions between the rows and windows over the warehouse; it ends at the restaurant and its meatball counter, then the stairs down to the market hall of shelves, bargain bins and stacks of goods. The Warehouse team holds the self-serve warehouse: four tall pallet racks with decks at 3, 6 and 9 m (rolling stairs and end ladders), forklift aisles with go-karts, the loading dock. Out through the checkouts to the car park, with trolleys, cars and a buggy. King of the Hill: the restaurant, the rack tops, the market hall.',
  modes: ['core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch', 'core.zombies'],
  players: [8, 20],
});
await m.save();
console.log(`flatpack_depot: ${nBlocks} blocks`);
