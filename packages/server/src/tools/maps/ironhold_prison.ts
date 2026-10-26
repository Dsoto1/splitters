/**
 * Ironhold Prison: an original maximum-security prison on a rocky island, at
 * night, for 8–20 players. The roadmap's "prison" set piece: in Breakout
 * (Hostage Rescue, Bomb, TDM) the Inmates start locked in their cells and the
 * Guards in the barracks; the cells open eight seconds into each round.
 *
 * - Main cell block: 24 barred cells on three tiers round a three-storey
 *   atrium, galleries on both sides joined by stairwells at both ends, a
 *   bridge on each upper tier and, hanging in the middle of the atrium, the
 *   guard control booth. Its lever locks the whole block down (every cell
 *   door slams and locks for 8 s, alarm and a red lamp; 30 s cooldown).
 * - North wing: laundry, workshop, mess hall, kitchen; the kitchen opens onto
 *   the loading dock (a truck, a buggy and the gate into the yard, which a
 *   button on either side opens for 10 s).
 * - South wing: warden's office and vault (a lever behind the desk opens it),
 *   visitation with glass partitions, the infirmary (armour), solitary (dark),
 *   the guard barracks, the guard station and the armoury (the LMG; a button
 *   in the barracks opens it for 12 s) and the locker room.
 * - Exercise yard (east): razor-wire fences, a basketball court, bleachers and
 *   a weights pen. Under it the sewer tunnels run from the cell block's
 *   janitor closet to the loading dock and the locker room, past a pump room.
 * - A patrol road inside the 8 m perimeter wall, a guard tower at each corner
 *   (MG turrets west, Guard sentries east) with searchlights; the chapel and
 *   the west yard behind the cell block.
 *
 * Grid x east, y north (one cell = 8 m); levels z-1 tunnels, z0 ground, z1/z2 cell-block tiers.
 *
 *  y13  r   r   r   r   r   r   r   r   r   r   r   r   r   r     r patrol road (perimeter wall outside it, towers T at corners)
 *  y12  r   .   .   .   .   .   .   .   D   D   D   D   D   r     D loading dock (fenced; gate to the yard at 8,10)
 *  y11  r   L   L   w   M   M   K   K   D   D   D   D   D   r     L laundry  w workshop  M mess hall  K kitchen
 *  y10  r   L   L   w   M   M   K   K   D   D   s   D   D   r     s stairs down to the tunnels
 *  y9   r   .   .   h   S   n   c   j   s   .   .   .   .   r     h showers  S/S' stairwells  n north passage  c commissary  j janitor
 *  y8   r   .   .   C   a   ~   a   C   .   Y   Y   Y   Y   r     C cells (3 tiers)  a atrium + galleries  ~ void, bridges
 *  y7   r   P   P   C   a   ~   a   C   .   Y   Y   Y   Y   r     P chapel
 *  y6   r   P   P   C   a   B   a   C   .   Y   Y   Y   Y   r     B control booth (z1)
 *  y5   r   .   .   C   a   ~   a   C   .   Y   Y   Y   Y   r     Y exercise yard (court, bleachers, weights)
 *  y4   r   .   .   i   p   g   S'  o   .   Y   Y   Y   Y   r     i intake  p sally port  g guard desk  o property
 *  y3   r   .   .   .   .   .   .   .   .   Y   Y   Y   Y   r
 *  y2   r   .   .   .   .   .   .   .   .   .   .   .   s   r     forecourt
 *  y1   r   O   R   =   =   =   =   =   =   G   G   t   l   r     O warden's outer office  R records  = admin corridor  t guard station
 *  y0   r   V   W   v   v'  I   I   X   X   G   G   A   l   r     V vault  W warden  v/v' visitation  I infirmary  X solitary  G barracks  A armoury  l lockers
 *  y-1  r   r   r   r   r   r   r   r   r   r   r   r   r   r
 *      -1   0   1   2   3   4   5   6   7   8   9  10  11  12
 *
 *  tunnels (z-1): janitor stairs (7,9) east along y9 to (10,9), south down x10 to (10,3), east to the
 *  locker-room stairs (11,2); the pump room (8..9, 5..6) off x10; stairs up to the dock at (10,10).
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Rotation, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('ironhold_prison', 'Ironhold Prison');
m.theme('bunker');
m.factions([
  { id: 'inmates', name: 'Inmates', color: '#e8862a', relations: {} },
  { id: 'guards', name: 'Guards', color: '#3d6fd0', relations: {} },
]);
m.teams([10, 10]);
const [INMATES, GUARDS] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];
const r2 = (n: number) => +n.toFixed(2);

// ---------------------------------------------------------------- surfaces

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const CELLS: TileSurfaces = { floor: mat('pbr_concrete_dark'), walls: mat('pbr_concrete', '#b8b4a8'), trim: mat('pbr_steel', '#4a4e52') };
const ATRIUM: TileSurfaces = { floor: mat('pbr_terrazzo', '#a8a49a'), walls: mat('pbr_concrete', '#c4c0b2'), trim: mat('hazard') };
const GALLERY: TileSurfaces = { floor: mat('grate'), walls: mat('pbr_concrete', '#c4c0b2'), trim: mat('pbr_steel', '#3a3e42') };
const BOOTH: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_steel', '#5a6068'), trim: mat('hazard') };
const ADMIN: TileSurfaces = { floor: mat('pbr_terrazzo'), walls: mat('pbr_plaster', '#c9c2ae'), trim: mat('pbr_walnut') };
const WARDEN: TileSurfaces = { floor: mat('pbr_carpet', '#4a2e2a'), walls: mat('pbr_walnut'), trim: mat('brass') };
const VAULT: TileSurfaces = { floor: mat('pbr_steel'), walls: mat('pbr_steel', '#6a6e72'), trim: mat('brass') };
const TILED: TileSurfaces = { floor: mat('white_tiles'), walls: mat('white_tiles', '#d8dcd8') };
const KITCHEN: TileSurfaces = { floor: mat('pbr_delft', '#c8ccc4'), walls: mat('white_tiles', '#e0e0d8') };
const MESS: TileSurfaces = { floor: mat('pbr_terrazzo', '#9a968c'), walls: mat('pbr_plaster', '#9aa69a') };
const WORK: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_brick_old', '#9a8a7a') };
const CHAPEL: TileSurfaces = { floor: mat('pbr_floorboards'), walls: mat('pbr_plaster_white', '#d8d2c0'), trim: mat('pbr_walnut') };
const SOLITARY: TileSurfaces = { floor: mat('pbr_concrete_dark', '#55524c'), walls: mat('pbr_concrete_dark', '#5a5650') };
const GUARD: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_concrete', '#8a96a4'), trim: mat('hazard') };
const ARMOURY: TileSurfaces = { floor: mat('pbr_steel'), walls: mat('pbr_rusted_plate', '#7a7e86'), trim: mat('hazard') };
const TUNNEL: TileSurfaces = { floor: mat('pbr_brick_old', '#5a5048'), walls: mat('pbr_brick_old', '#6a5a4a'), solids: mat('pbr_rusted_plate'), trim: mat('pbr_rusted_plate') };
const ROAD: TileSurfaces = { floor: mat('pbr_asphalt'), walls: mat('pbr_concrete', '#9a968a') };
const YARD: TileSurfaces = { floor: mat('pbr_concrete', '#8a877e'), walls: mat('pbr_concrete', '#9a968a') };
const DOCK: TileSurfaces = { floor: mat('pbr_asphalt', '#6a6a6a'), walls: mat('pbr_corrugated', '#8a949a') };

// ---------------------------------------------------------------- tiles

type CellInfo = { kind: string; group: number };
const cells = new Map<string, CellInfo>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
let groups = 0;
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
function place(kind: string, x: number, y: number, z: number, o: { rot?: Rotation; opts?: RoomOptions; surf?: TileSurfaces } = {}): void {
  m.tile(kind, x, y, z, o.rot ?? 0, o.opts);
  const g = ++groups;
  const fp: [number, number, number][] = kind === 'room_large' ? [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]] : kind === 'stairs' || kind === 'stairwell' ? [[0, 0, 0], [0, 0, 1]] : [[0, 0, 0]];
  for (const [dx, dy, dz] of fp) {
    const k = key(x + dx, y + dy, z + dz);
    if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
    cells.set(k, { kind, group: g });
  }
  if (o.surf) paint(x, y, z, o.surf);
}
const ROOF: RoomOptions = { ceiling: 'roof' };
const room = (x: number, y: number, surf: TileSurfaces, opts: RoomOptions = ROOF, z = 0) => place('room', x, y, z, { surf, opts });
const hall = (x: number, y: number, surf: TileSurfaces, opts: RoomOptions = { ...ROOF, layout: 'empty' }) => place('room_large', x, y, 0, { surf, opts });

// Patrol road just inside the perimeter wall.
for (let x = -1; x <= 12; x++) for (let y = -1; y <= 13; y++) if (x === -1 || x === 12 || y === -1 || y === 13) place('yard', x, y, 0, { surf: ROAD });

// South wing (y0..1).
room(0, 0, VAULT);
room(1, 0, WARDEN);
room(0, 1, WARDEN);
room(1, 1, ADMIN);
room(2, 0, ADMIN); // visitation: visitors' side
room(3, 0, ADMIN); // visitation: inmates' side
room(4, 0, TILED); // infirmary
room(5, 0, TILED);
room(6, 0, SOLITARY);
room(7, 0, SOLITARY);
for (let x = 2; x <= 7; x++) room(x, 1, ADMIN); // admin corridor
hall(8, 0, GUARD); // guard barracks
room(10, 0, ARMOURY);
room(10, 1, GUARD); // guard station
room(11, 0, GUARD); // locker room
room(11, 1, GUARD);

// Main cell block (x2..6, y4..9).
room(2, 4, ADMIN); // intake
room(3, 4, ATRIUM); // sally port (two stairwell flights above it)
room(4, 4, ATRIUM); // guard desk
place('stairwell', 5, 4, 0, { rot: 1, surf: CELLS }); // z0 <-> z1, opening north
room(6, 4, ADMIN); // property room
for (let y = 5; y <= 8; y++) {
  for (let z = 0; z <= 2; z++) {
    room(2, y, CELLS, z === 2 ? ROOF : {}, z);
    room(6, y, CELLS, z === 2 ? ROOF : {}, z);
  }
  for (const x of [3, 4, 5]) room(x, y, ATRIUM, {});
  for (const z of [1, 2]) {
    place('platform_rail', 3, y, z, { surf: GALLERY });
    place('platform_rail', 5, y, z, { surf: GALLERY });
  }
}
place('stairwell', 3, 4, 1, { rot: 1, surf: CELLS }); // z1 <-> z2 at the south end
place('stairwell', 3, 9, 0, { rot: 3, surf: CELLS }); // z0 <-> z1 at the north end
place('stairwell', 5, 9, 1, { rot: 3, surf: CELLS }); // z1 <-> z2 at the north end
room(4, 6, BOOTH, ROOF, 1); // the control booth, hanging over the atrium
place('bridge', 4, 8, 1, { rot: 1, surf: GALLERY });
place('bridge', 4, 5, 2, { rot: 1, surf: GALLERY });
room(2, 9, TILED); // showers
room(4, 9, ATRIUM); // north passage
room(5, 9, ADMIN); // commissary (under the north stairwell)
room(6, 9, WORK); // janitor's closet

// North wing (y10..11).
hall(0, 10, TILED); // laundry
room(2, 10, WORK); // workshop
room(2, 11, WORK);
hall(3, 10, MESS); // mess hall
hall(5, 10, KITCHEN); // kitchen
hall(0, 6, CHAPEL, { ceiling: 'beams', layout: 'empty' }); // chapel (west yard)

// Tunnels (z-1) and their stairs.
place('stairs', 7, 9, -1, { rot: 2, surf: TUNNEL }); // up west into the janitor's closet
place('stairs', 10, 10, -1, { rot: 3, surf: TUNNEL }); // up north onto the loading dock
place('stairs', 11, 2, -1, { rot: 1, surf: TUNNEL }); // up south into the locker room
const TUNNELS: [number, number][] = [[8, 9], [9, 9], [10, 9], [10, 8], [10, 7], [10, 6], [10, 5], [10, 4], [10, 3], [11, 3]];
for (const [x, y] of TUNNELS) room(x, y, TUNNEL, {}, -1);
place('room_large', 8, 5, -1, { surf: TUNNEL, opts: { layout: 'empty' } }); // pump room

// Open ground everywhere else inside the road.
const DOCK_CELLS = (x: number, y: number) => x >= 7 && y >= 10 && y <= 12;
const EX_YARD = (x: number, y: number) => x >= 8 && x <= 11 && y >= 3 && y <= 8;
for (let x = 0; x <= 11; x++) {
  for (let y = 0; y <= 12; y++) {
    if (cells.has(key(x, y, 0))) continue;
    place('yard', x, y, 0, { surf: DOCK_CELLS(x, y) ? DOCK : EX_YARD(x, y) ? { ...YARD, floor: mat('pbr_asphalt', '#7a6e62') } : YARD });
  }
}

// ---------------------------------------------------------------- walls and openings

const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };

// South wing.
link(0, 0, 0, 'N', 'door'); // the vault door
link(0, 0, 0, 'E', 'wall');
link(1, 0, 0, 'N', 'door');
link(1, 0, 0, 'S', 'windows');
link(0, 1, 0, 'E', 'door');
link(0, 1, 0, 'N', 'door');
link(0, 1, 0, 'W', 'window');
link(1, 1, 0, 'E', 'door');
link(2, 0, 0, 'N', 'door');
link(2, 0, 0, 'E', 'window'); // the glass partition
link(3, 0, 0, 'N', 'window'); // a second pane onto the corridor
link(3, 0, 0, 'E', 'door'); // through to the infirmary
link(4, 0, 0, 'E', 'open');
link(4, 0, 0, 'N', 'door');
link(5, 0, 0, 'N', 'windows');
link(4, 0, 0, 'S', 'window');
link(5, 0, 0, 'S', 'window');
link(6, 0, 0, 'N', 'door');
link(7, 0, 0, 'N', 'door');
link(6, 0, 0, 'E', 'bars');
for (let x = 2; x <= 6; x++) link(x, 1, 0, 'E', 'open');
link(2, 1, 0, 'N', 'door');
link(5, 1, 0, 'N', 'wide');
link(7, 1, 0, 'E', 'door'); // into the barracks
link(9, 1, 0, 'E', 'door'); // barracks to the guard station
link(8, 1, 0, 'N', 'door');
link(8, 0, 0, 'S', 'windows');
link(9, 0, 0, 'S', 'windows');
link(10, 1, 0, 'S', 'door'); // the armoury door
link(10, 1, 0, 'E', 'door');
link(10, 1, 0, 'N', 'door');
link(10, 0, 0, 'E', 'bars'); // the armoury cage, seen from the lockers
link(11, 0, 0, 'N', 'open');
link(11, 1, 0, 'N', 'door'); // stairs down to the tunnels
link(11, 0, 0, 'E', 'door'); // out to the patrol road

// Cell block, ground floor.
link(2, 4, 0, 'W', 'door');
link(2, 4, 0, 'E', 'door');
link(2, 4, 0, 'S', 'window');
link(3, 4, 0, 'S', 'door'); // the main entrance
link(3, 4, 0, 'E', 'open');
link(3, 4, 0, 'N', 'wide');
link(4, 4, 0, 'N', 'bars'); // the guard desk looks into the atrium through bars
link(4, 4, 0, 'S', 'window');
link(6, 4, 0, 'E', 'door');
link(6, 4, 0, 'S', 'window');
for (let y = 5; y <= 8; y++) {
  for (const x of [3, 4]) link(x, y, 0, 'E', 'open');
  if (y < 8) for (const x of [3, 4, 5]) link(x, y, 0, 'N', 'open');
  for (let z = 0; z <= 2; z++) {
    link(2, y, z, 'E', 'open'); // cell fronts: barred with free blocks below
    link(6, y, z, 'W', 'open');
    link(2, y, z, 'W', z === 0 && (y === 6 || y === 7) ? 'wall' : 'slit');
    link(6, y, z, 'E', 'slit');
  }
}
link(4, 4, 0, 'E', 'wall');
link(5, 5, 0, 'S', 'door'); // foot of the south-east stairwell
link(3, 8, 0, 'N', 'door'); // foot of the north-west stairwell
link(4, 8, 0, 'N', 'wide');
link(5, 8, 0, 'N', 'door');
link(5, 5, 2, 'S', 'wall');
link(3, 8, 2, 'N', 'wall');
// The booth: doors onto both galleries, windows over the atrium; its roof joins the top galleries.
link(4, 6, 1, 'W', 'door');
link(4, 6, 1, 'E', 'door');
link(4, 6, 1, 'N', 'windows');
link(4, 6, 1, 'S', 'windows');
link(3, 6, 2, 'E', 'open');
link(5, 6, 2, 'W', 'open');
// North row.
link(2, 9, 0, 'N', 'door');
link(2, 9, 0, 'W', 'window');
link(4, 9, 0, 'N', 'door');
link(4, 9, 0, 'E', 'door');
link(5, 9, 0, 'N', 'door');
link(5, 9, 0, 'E', 'door');
link(6, 9, 0, 'E', 'door'); // top of the tunnel stairs

// North wing.
link(1, 10, 0, 'S', 'door');
link(0, 11, 0, 'N', 'door');
link(0, 10, 0, 'W', 'window');
link(0, 11, 0, 'W', 'window');
link(1, 10, 0, 'E', 'door');
link(2, 10, 0, 'N', 'open');
link(2, 11, 0, 'E', 'door');
link(3, 11, 0, 'N', 'door');
link(4, 10, 0, 'E', 'window'); // the serving hatch
link(4, 11, 0, 'E', 'door');
link(6, 10, 0, 'E', 'wide'); // the kitchen's loading door onto the dock
link(6, 11, 0, 'E', 'door');
link(5, 11, 0, 'N', 'door');
// Chapel.
link(0, 6, 0, 'S', 'door');
link(1, 7, 0, 'N', 'door');
link(0, 6, 0, 'W', 'window');
link(0, 7, 0, 'W', 'window');

// Tunnels.
link(8, 9, -1, 'W', 'door');
link(8, 9, -1, 'E', 'open');
link(9, 9, -1, 'E', 'open');
for (let y = 3; y <= 8; y++) link(10, y, -1, 'N', 'open');
link(10, 3, -1, 'E', 'open');
link(11, 3, -1, 'S', 'door');
link(10, 9, -1, 'N', 'door');
link(9, 5, -1, 'E', 'arch');
link(9, 6, -1, 'E', 'arch');

// The dock: fenced off from the yard and the road, a gatehouse at (8,10).
for (let x = 7; x <= 11; x++) {
  if (x !== 10) link(x, 10, 0, 'S', x === 8 ? 'door' : 'fence');
  link(x, 12, 0, 'N', 'fence');
}
for (let y = 10; y <= 12; y++) link(11, y, 0, 'E', 'fence');
link(7, 12, 0, 'W', 'fence');
// The exercise yard: razor-wire fences with gaps.
for (let y = 3; y <= 8; y++) {
  link(8, y, 0, 'W', y === 4 || y === 7 ? 'open' : 'fence');
  link(11, y, 0, 'E', 'fence');
}
for (let x = 8; x <= 11; x++) {
  link(x, 8, 0, 'N', x === 10 ? 'open' : 'fence');
  if (x !== 11) link(x, 3, 0, 'S', x === 9 ? 'open' : 'fence');
}
// The perimeter wall.
for (let x = -1; x <= 12; x++) {
  link(x, -1, 0, 'S', 'high');
  link(x, 13, 0, 'N', 'high');
}
for (let y = -1; y <= 13; y++) {
  link(-1, y, 0, 'W', 'high');
  link(12, y, 0, 'E', 'high');
}

for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
// Every other side of a room against another tile is a plain wall (rooms would otherwise get a doorway).
const SEAL = new Set(['room', 'room_large']);
const sealed = new Set<string>();
for (const [k, here] of cells) {
  if (!SEAL.has(here.kind)) continue;
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  for (const side of ['N', 'E', 'S', 'W'] as const) {
    const [dx, dy] = DIRS[side];
    const there = cells.get(key(x + dx, y + dy, z));
    const id = sideId(x, y, z, side);
    if (!there || there.group === here.group || links.has(id) || sealed.has(id)) continue;
    sealed.add(id);
    m.edge(x, y, z, side, 'wall');
  }
}

// ---------------------------------------------------------------- free blocks: cell bars, roofs, walls

const STEEL = { material: 'pbr_steel', tint: '#3c4046' };
const CONCRETE = { material: 'pbr_concrete', tint: '#a8a49a' };
/** A cell front at x = `fx` (between cell and gallery), cell row y, tier z: barred either side of a 3 m door. */
function cellFront(fx: number, y: number, z: number): void {
  const base = z * 4;
  const cz = y * 8;
  for (const s of [-1, 1]) {
    // 0.2 m posts with 0.3 m gaps: see and shoot through, nobody squeezes through.
    for (let u = 1.8; u <= 3.81; u += 0.5) m.block([fx, base, r2(cz + s * u)], [0.2, 4, 0.2], 'solid', STEEL);
    m.block([fx, base, r2(cz + s * 2.8)], [0.2, 0.12, 2.2], 'solid', STEEL);
    m.block([fx, base + 3.82, r2(cz + s * 2.8)], [0.2, 0.18, 2.2], 'solid', STEEL);
  }
  m.block([fx, base + 3, cz], [0.22, 1, 3.4], 'solid', STEEL); // header over the door
}
for (let y = 5; y <= 8; y++) for (let z = 0; z <= 2; z++) {
  cellFront(20, y, z);
  cellFront(44, y, z);
}
// The atrium's end walls above the ground floor, and the cell-block roof.
for (const z of [36, 68]) m.block([32, 4, z], [8, 8.4, 0.5], 'solid', CONCRETE);
m.block([32, 12, 52], [40, 0.4, 32], 'solid', { material: 'pbr_roof', tint: '#5a5e62' });
for (const x of [26, 38]) m.block([x, 11.2, 52], [0.4, 0.8, 32], 'solid', STEEL); // roof girders over the galleries

// Guard towers at the four corners: a concrete column, a railed deck at the wall top, a ladder up the inside.
const TOWER_H = 8.4;
const TOWERS: { c: [number, number]; ladder: Side; gun: 'turret_mg' | 'sentry' }[] = [
  { c: [-8, -8], ladder: 'N', gun: 'turret_mg' },
  { c: [-8, 104], ladder: 'S', gun: 'turret_mg' },
  { c: [96, -8], ladder: 'N', gun: 'sentry' },
  { c: [96, 104], ladder: 'S', gun: 'sentry' },
];
for (const { c: [cx, cz], ladder, gun } of TOWERS) {
  m.block([cx, 0, cz], [5, TOWER_H, 5], 'solid', { material: 'pbr_concrete', tint: '#8e8a80' });
  const top = TOWER_H;
  // Rails round the deck; a gap over the ladder.
  m.block([cx - 2.4, top, cz], [0.2, 1.1, 5], 'solid', STEEL);
  m.block([cx + 2.4, top, cz], [0.2, 1.1, 5], 'solid', STEEL);
  const far = ladder === 'N' ? -2.4 : 2.4;
  const near = -far;
  m.block([cx, top, cz + far], [5, 1.1, 0.2], 'solid', STEEL);
  for (const s of [-1, 1]) m.block([cx + s * 1.6, top, cz + near], [1.8, 1.1, 0.2], 'solid', STEEL);
  m.block([cx, top + 2.6, cz], [5.4, 0.25, 5.4], 'solid', { material: 'pbr_roof', tint: '#3a3e42' }); // canopy
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) m.block([cx + sx * 2.4, top + 1.1, cz + sz * 2.4], [0.2, 1.5, 0.2], 'solid', STEEL);
  const face = ladder === 'N' ? cz + 2.5 : cz - 2.5;
  m.add({ kind: 'ladder', position: [cx, 0, face], yaw: ladder === 'N' ? 0 : S, height: TOWER_H, width: 1 });
  const yaw = r2(Math.atan2(44 - cx, 48 - cz));
  m.add({ kind: 'mount', model: gun, position: [cx, top, cz], yaw, faction: gun === 'sentry' ? GUARDS : null, respawnSeconds: gun === 'sentry' ? 90 : null });
  m.light([cx, top + 2.3, cz], { fixture: 'bulb', color: '#f2f6ff', intensity: 2.2, range: 26 }); // searchlight
}

// The loading dock: a semi-trailer along the north fence, its cab toward the kitchen.
const TRAILER = { material: 'pbr_corrugated', tint: '#c9ccd0' };
const CAB = { material: 'paint_gloss', tint: '#2a3a5a' };
const DARK = { material: 'pbr_steel', tint: '#2e2e2e' };
m.block([78, 1.2, 95], [12, 3, 2.6], 'solid', TRAILER);
for (const dx of [-4, 4.5]) m.block([78 + dx, 0, 95], [1.4, 1.2, 2.4], 'solid', DARK);
m.block([70.1, 0, 95], [3.2, 3.1, 2.6], 'solid', CAB);
m.block([67.9, 0, 95], [1.2, 1.6, 2.4], 'solid', CAB);
m.block([62.2, 0, 92], [3.6, 1.1, 14], 'solid', { material: 'pbr_concrete', tint: '#8a8680' }); // loading platform by the kitchen
for (let i = 0; i < 4; i++) m.block([r2(65 + i * 0.5), 0, 92], [0.5, r2((i + 1) * 0.25), 6], 'solid', { material: 'pbr_concrete', tint: '#8a8680' }); // its steps

// The exercise yard: court, hoops, bleachers, weights.
m.block([76, 0, 40], [15, 0.1, 28], 'solid', { material: 'paint_matte', tint: '#3a5a7a' });
m.block([76, 0.1, 40], [13, 0.1, 0.2], 'solid', { material: 'paint_matte', tint: '#e8e8e8' });
for (const s of [-1, 1]) {
  const z = 40 + s * 13.2;
  m.block([76, 0, r2(z + s * 0.6)], [0.22, 3.05, 0.22], 'solid', STEEL);
  m.block([76, 2.9, r2(z)], [1.8, 1.1, 0.2], 'solid', { material: 'paint_gloss', tint: '#e8e8e8' });
  m.block([76, 3.05, r2(z - s * 0.35)], [0.46, 0.1, 0.46], 'solid', { material: 'paint_gloss', tint: '#d0602a' });
}
for (let i = 0; i < 3; i++) m.block([r2(62.5 + i * 0.9), 0, 40], [r2(3.6 - i * 0.9), r2(0.45 * (i + 1)), 18], 'solid', { material: 'pbr_planks', tint: '#7a6a5a' });
for (const [x, z] of [[86, 56], [89, 56], [86, 60]] as const) {
  m.block([x, 0, z], [0.4, 0.45, 1.3], 'solid', { material: 'paint_matte', tint: '#2a2a2a' });
  m.block([x, 1.1, z - 0.4], [1.8, 0.1, 0.2], 'solid', STEEL);
  for (const s of [-1, 1]) m.block([x + s * 0.8, 0.9, z - 0.4], [0.2, 0.45, 0.45], 'solid', DARK);
}

// Sewer channels down the middle of the tunnels.
m.water([69.5, -4, 72], [19, 0.35, 2], 'water');
m.water([80, -4, 46.5], [2, 0.35, 51], 'water');

// ---------------------------------------------------------------- doors and buttons

const door = (id: string, name: string, pos: V3, yaw: number, o: { locked?: boolean; auto?: boolean } = {}) =>
  m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked: o.locked ?? false, auto: o.auto ?? true });
const CELL_DOORS: string[] = [];
for (let z = 0; z <= 2; z++) for (let y = 5; y <= 8; y++) for (const [fx, w] of [[20, 'w'], [44, 'e']] as const) {
  const id = `door_cell_${w}${z}_${y}`;
  CELL_DOORS.push(id);
  door(id, `Cell ${w.toUpperCase()}${z + 1}-${y - 4}`, [fx, z * 4, y * 8], P, { locked: true });
}
door('door_armoury', 'Armoury door', [80, 0, 4], 0, { locked: true, auto: false });
door('door_vault', 'Vault door', [0, 0, 4], 0, { locked: true, auto: false });
door('door_dock_gate', 'Dock gate', [64, 0, 76], 0, { locked: true, auto: false });
door('door_sally', 'Cell block entrance', [24, 0, 28], 0);
door('door_solitary_w', 'Solitary (west)', [48, 0, 4], 0);
door('door_solitary_e', 'Solitary (east)', [56, 0, 4], 0);

const button = (id: string, name: string, pos: V3, yaw: number, label: string, o: { cooldown?: number; enabled?: boolean } = {}) => {
  m.add({ kind: 'button', id, name, position: pos, yaw, label, once: false, cooldownSeconds: o.cooldown ?? 1, startEnabled: o.enabled ?? true });
  // The tell: a red lamp over every lever.
  m.light([r2(pos[0] - Math.sin(yaw) * 0.25), pos[1] + 2.3, r2(pos[2] - Math.cos(yaw) * 0.25)], { fixture: 'wall', color: '#ff3a2a', intensity: 0.9, range: 4.5, yaw });
};
button('btn_lockdown', 'Lockdown lever', [32, 4, 51.25], S, 'Lock down the cell block', { enabled: false });
button('btn_armoury', 'Armoury release', [75.25, 0, 10.6], -P, 'Open the armoury');
button('btn_vault', 'Vault lever', [4.75, 0, -2], P, 'Open the vault', { cooldown: 9 });
button('btn_gate_dock', 'Dock gate (dock side)', [66.6, 0, 76.6], 0, 'Open the dock gate', { cooldown: 9 });
button('btn_gate_yard', 'Dock gate (yard side)', [61.4, 0, 75.4], S, 'Open the dock gate', { cooldown: 9 });

// Visitation glass and the infirmary's breakable panes.
m.add({ kind: 'destructible', id: 'glass_visit_1', name: 'Visitation glass', model: 'glass', position: [20, 0, 0], yaw: P, health: null, explosiveOnly: false });
m.add({ kind: 'destructible', id: 'glass_visit_2', name: 'Visitation glass', model: 'glass', position: [24, 0, 4], yaw: 0, health: null, explosiveOnly: false });
m.breakable('barrel', at(9, 11, 0, 2.5, 2.5));
m.breakable('gas', at(5, 11, 0, 2.8, 2.6));
m.breakable('generator', at(9, 6, -1, -1, 2.4), 0);
m.breakable('crate', at(11, 7, 0, 1.5, 2));

// Escape alarm: whoever comes into the pump room sets it off (once every 20 s).
m.add({ kind: 'zone', id: 'zone_pump', name: 'Pump room', position: at(8, 5, -1, 4, 4), size: [14, 3, 14], who: 'any', count: 1, startEnabled: true });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const wait = (s: number) => act('wait', null, { value: s });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], o: { once?: boolean; if?: LogicRule['if'] } = {}): LogicRule => ({ id, name, enabled: true, once: o.once ?? false, when, if: o.if ?? [], do: does });
const pressed = (target: string) => ({ event: 'button_pressed' as const, target });
const chunks = <T>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const RELEASE = 8;
const LOCKDOWN = 8;

m.logic({
  variables: [{ id: 'var_alarm', name: 'Escape alarm sounding', initial: 0 }],
  timers: [{ id: 'timer_cells', name: 'Cells unlock', seconds: RELEASE, loop: false, visible: true }],
  objectives: [],
  rules: [
    rule('rule_start', 'Lights on: cells locked', { event: 'match_start', target: null }, [say(`Ironhold Prison. Lights on: the cell doors release in ${RELEASE} s.`, 4), act('timer_start', 'timer_cells')]),
    rule('rule_release', 'Breakout', { event: 'timer_done', target: 'timer_cells' }, [act('sound', null, { state: 'alarm' }), say('The cell doors are open. Breakout!', 4), wait(4), act('enable', 'btn_lockdown')]),
    ...chunks(CELL_DOORS, 12).map((ds, i) => rule(`rule_release_${i + 1}`, `Release the cells (${i + 1})`, { event: 'timer_done', target: 'timer_cells' }, ds.flatMap((d) => [act('door_unlock', d), act('door_open', d)]))),
    rule('rule_lockdown', 'Lockdown', pressed('btn_lockdown'), [
      act('disable', 'btn_lockdown'),
      act('sound', null, { state: 'buzzer' }),
      say('LOCKDOWN! Every cell door is closing...', 3),
      wait(1.5),
      act('sound', null, { state: 'alarm' }),
      wait(LOCKDOWN + 22),
      act('enable', 'btn_lockdown'),
      say('The control booth lever is reset.', 2),
    ]),
    ...chunks(CELL_DOORS, 6).map((ds, i) =>
      rule(`rule_lockdown_${i + 1}`, `Lockdown: cells (${i + 1})`, pressed('btn_lockdown'), [wait(1.5), ...ds.flatMap((d) => [act('door_close', d), act('door_lock', d)]), wait(LOCKDOWN), ...ds.flatMap((d) => [act('door_unlock', d), act('door_open', d)])]),
    ),
    rule('rule_armoury', 'Armoury release', pressed('btn_armoury'), [
      act('disable', 'btn_armoury'),
      act('sound', null, { state: 'chime' }),
      say('The armoury is open.', 2),
      act('door_unlock', 'door_armoury'),
      act('door_open', 'door_armoury'),
      wait(12),
      act('door_close', 'door_armoury'),
      act('door_lock', 'door_armoury'),
      wait(13),
      act('enable', 'btn_armoury'),
    ]),
    rule('rule_vault', 'The warden\'s vault', pressed('btn_vault'), [act('door_unlock', 'door_vault'), act('door_open', 'door_vault'), act('sound', null, { state: 'chime' }), wait(8), act('door_close', 'door_vault'), act('door_lock', 'door_vault')]),
    ...(['btn_gate_dock', 'btn_gate_yard'] as const).map((b) =>
      rule(`rule_${b.slice(4)}`, 'Dock gate', pressed(b), [act('sound', null, { state: 'buzzer' }), say('The dock gate is opening.', 2), act('door_unlock', 'door_dock_gate'), act('door_open', 'door_dock_gate'), wait(10), act('door_close', 'door_dock_gate'), act('door_lock', 'door_dock_gate')]),
    ),
    rule('rule_tunnel_alarm', 'Escape alarm', { event: 'zone_enter', target: 'zone_pump' }, [act('set_var', 'var_alarm', { value: 1 }), act('sound', null, { state: 'alarm' }), say('Movement in the sewer tunnels!', 3), wait(20), act('set_var', 'var_alarm', { value: 0 })], {
      if: [{ type: 'variable', target: 'var_alarm', op: '==', value: 0, state: '' }],
    }),
    rule('rule_lmg', 'LMG taken', { event: 'pickup_taken', target: 'pickup_lmg' }, [say('Someone has the LMG from the armoury.', 3)]),
    rule('rule_glass', 'Visitation glass broken', { event: 'destroyed', target: 'glass_visit_1' }, [act('sound', null, { state: 'buzzer' }), say('The visitation glass is broken.', 2)]),
  ],
});

// ---------------------------------------------------------------- spawns

// Inmates: one to a cell on the two lower tiers, facing the bars.
for (const y of [5, 6, 7, 8]) {
  m.spawn(at(2, y, 0, -1, -1.5), P, INMATES);
  m.spawn(at(6, y, 0, 1, -1.5), -P, INMATES);
}
for (const y of [6, 7]) {
  m.spawn(at(2, y, 1, -1, -1.5), P, INMATES);
  m.spawn(at(6, y, 1, 1, -1.5), -P, INMATES);
}
// Guards: the barracks, the guard station, the locker room, the admin corridor.
for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 6], [2, 6], [6, 2], [10, 6]] as const) m.spawn(at(8, 0, 0, dx, dy), 0, GUARDS);
m.spawn(at(10, 1, 0, 0, 1), 0, GUARDS).spawn(at(11, 1, 0, -1.5, -1), -P, GUARDS).spawn(at(11, 0, 0, -1.5, 0), 0, GUARDS).spawn(at(7, 1, 0, 0, 0), P, GUARDS);
// Everyone else's (free-for-all).
for (const [p, yaw] of [
  [at(3, 5, 0, 0, 1), 0], [at(5, 7, 0, 0, 0), S], [at(4, 8, 0, -2, 1), S], [at(3, 7, 1, 0, 0), P], [at(5, 6, 2, 1, -2), -P],
  [at(3, 11, 0, -2, -2), S], [at(4, 10, 0, 2, 2), S], [at(0, 11, 0, 0, 2), S], [at(2, 10, 0, 0, 0), 0], [at(0, 7, 0, 3, 0), 0],
  [at(9, 4, 0, 0, 0), 0], [at(11, 7, 0, 0, 0), -P], [at(8, 8, 0, 0, 0), S], [at(9, 12, 0, 0, 0), S], [at(11, 11, 0, -1, -1), -P],
  [at(9, 9, -1, 0, 2.5), P], [at(10, 4, -1, -2.5, 0), 0], [at(1, 2, 0, 0, 0), 0], [at(6, 3, 0, 0, 0), 0], [at(0, 4, 0, 0, 0), 0],
  [at(3, 1, 0, 0, 0), P], [at(5, 0, 0, 2, 0), 0], [at(-1, 9, 0, 0, 0), 0], [at(12, 2, 0, 0, 0), 0],
] as [V3, number][]) m.spawn(p, yaw);

// ---------------------------------------------------------------- pickups

// Improvised weapons for the inmates round the cell block.
m.pickup('weapon_spear', at(4, 7, 0, 0, 0)).pickup('weapon_spear', at(3, 5, 2, 0, 0));
m.pickup('weapon_machine_pistol', at(5, 8, 1, 0, 0)).pickup('weapon_pulse_pistol', at(3, 6, 1, 0, -1));
m.pickup('ammo_light', at(4, 5, 0, 0, -1)).pickup('health_small', at(5, 5, 2, 0, 0)).pickup('health_small', at(3, 8, 0, 0, 0));
m.pickup('weapon_hand_cannon', at(4, 6, 1, 0, -2)); // in the booth
m.pickup('armor_small', at(4, 6, 2, 0, 0)); // on the booth roof
m.pickup('ammo_light', at(2, 4, 0, 2, 0)).pickup('grenades', at(6, 4, 0, 0, 0));
// Stashes: laundry, kitchen, workshop, showers, mess hall.
m.pickup('weapon_shotgun', at(0, 10, 0, 4, 4)).pickup('ammo_shells', at(0, 10, 0, 6, 9));
m.pickup('weapon_sawed_off', at(5, 10, 0, 4, 2)).pickup('weapon_flamethrower', at(5, 10, 0, 7, 9)).pickup('ammo_fuel', at(5, 10, 0, 1, 9));
m.pickup('weapon_nailgun', at(2, 11, 0, 0, 0)).pickup('ammo', at(2, 10, 0, 0, -1));
m.pickup('ammo_shells', at(2, 9, 0, 0, 0)).pickup('health_small', at(5, 9, 0, 0, 0));
m.pickup('weapon_smg', at(3, 10, 0, 4, 1)).pickup('health_large', at(3, 10, 0, 4, 8));
// The chapel and the west yard.
m.pickup('health_small', at(0, 6, 0, 4, 6)).pickup('ammo', at(0, 6, 0, 4, -1)).pickup('weapon_burst_rifle', at(0, 4, 0, 0, 2));
// South wing: armour in the infirmary, the warden's gilded pistol, double damage in the vault, armour in solitary.
m.pickup('armor_large', at(4, 0, 0, 4, 0)).pickup('health_large', at(5, 0, 0, 2, 0)).pickup('health_small', at(4, 0, 0, -2, 0));
m.pickup('weapon_gilded_pistol', at(1, 0, 0, 0, 1.5));
m.pickup('powerup_damage', at(0, 0, 0, 0, 0), 90);
m.pickup('armor_small', at(6, 0, 0, 0, 0)).pickup('ammo_light', at(2, 0, 0, 0, 0)).pickup('health_small', at(6, 1, 0, 0, 0));
// Guards: rifles in the barracks and the station, the LMG behind the armoury door.
m.pickup('weapon_rifle', at(8, 0, 0, 4, 0)).pickup('weapon_rifle', at(8, 0, 0, 4, 8)).pickup('ammo_rifle', at(8, 0, 0, 0, 4));
m.pickup('weapon_burst_rifle', at(10, 1, 0, 2, 2)).pickup('ammo_rifle', at(11, 1, 0, 1, 1)).pickup('armor_small', at(11, 0, 0, 1, 0));
m.add({ kind: 'pickup', id: 'pickup_lmg', item: 'core.weapon_lmg', position: at(10, 0, 0, 0, -1), respawnSeconds: 60 });
m.pickup('grenades', at(10, 0, 0, -2, 1)).pickup('ammo_rifle', at(10, 0, 0, 2, 1));
// The yard, the dock, the road.
m.pickup('weapon_marksman', at(11, 4, 0, 1, 0)).pickup('ammo_sniper', at(11, 6, 0, 2, 0));
m.pickup('health_small', at(8, 3, 0, 0, 0)).pickup('ammo', at(9, 8, 0, 0, 0)).pickup('health_small', at(8, 2, 0, 0, 0));
m.pickup('weapon_launcher', at(9, 12, 0, -2, 1)).pickup('ammo_explosive', at(11, 12, 0, 0, 0)).pickup('health_small', at(7, 11, 0, 0, 0));
m.pickup('health_small', at(-1, 4, 0, 0, 0)).pickup('ammo', at(12, 9, 0, 0, 0)).pickup('armor_small', at(5, 13, 0, 0, 0)).pickup('health_small', at(6, -1, 0, 0, 0));
// The tunnels.
m.pickup('weapon_auto_shotgun', at(8, 5, -1, 4, 4)).pickup('ammo_shells', at(10, 7, -1, -2.5, 0));
m.pickup('health_small', at(9, 9, -1, 0, -2.5)).pickup('grenades', at(10, 3, -1, -2.5, 0)).pickup('health_large', at(8, 5, -1, 0, 8));

// ---------------------------------------------------------------- objectives

// Hostage Rescue (Breakout): Inmates spring four of their own from solitary, the infirmary and the
// warden's office, out through the dock or the sewer pump room.
m.hostage(at(6, 0, 0, 0, -1.5), 0).hostage(at(7, 0, 0, 0, -1.5), 0).hostage(at(1, 0, 0, 2, -1), 0).hostage(at(5, 0, 0, -2, -2), 0);
m.rescue(at(9, 11, 0, 0, 0), 5).rescue(at(8, 5, -1, 4, 4), 5);
// Bomb: the guards' locker room (A) and the loading dock (B).
m.add({ kind: 'bombsite', position: at(11, 0, 0, 0, 4), label: 'A', radius: 4 });
m.add({ kind: 'bombsite', position: at(10, 11, 0, 0, 2), label: 'B', radius: 5 });
// Capture the Flag: the laundry (Inmates) against the barracks (Guards).
m.flag(INMATES, at(0, 10, 0, 4, 6), S);
m.flag(GUARDS, at(8, 0, 0, 0, 0), 0);
// King of the Hill: the control booth, the basketball court, the mess hall.
m.hill(at(4, 6, 1, 0, 0), 3.5).hill([76, 0, 40], 7).hill(at(3, 10, 0, 4, 4), 6);

// ---------------------------------------------------------------- furnishing

function put(model: string, p: V3, yaw = 0, scale = 1, solid = true): { put: typeof put } {
  m.prop(model, [r2(p[0]), r2(p[1]), r2(p[2])], r2(yaw), scale, solid);
  return { put };
}
const W = 3.75;
// Cells: a bunk against the back wall, a toilet and a sink in the corner.
for (let y = 5; y <= 8; y++) for (let z = 0; z <= 2; z++) {
  put('hm_bunk_bed', at(2, y, z, -W + 0.7, 2.2), 0).put('hm_toilet', at(2, y, z, -W + 0.45, -3.2), P).put('hm_bathroom_sink', at(2, y, z, -1.5, -W + 0.35), 0);
  put('hm_bunk_bed', at(6, y, z, W - 0.7, 2.2), 0).put('hm_toilet', at(6, y, z, W - 0.45, -3.2), -P).put('hm_bathroom_sink', at(6, y, z, 1.5, -W + 0.35), 0);
}
// Atrium: day-room tables bolted down, the guard desk.
for (const [y, dy] of [[5, 2], [8, -2]] as const) for (const x of [3, 5]) put('table', at(x, y, 0, 0, dy)).put('bench', at(x, y, 0, 0, dy - 1), 0, 2.5, false).put('bench', at(x, y, 0, 0, dy + 1), 0, 2.5, false);
put('desk', at(4, 4, 0, 0, 1.5), S).put('computer', at(4, 4, 0, 0, 1.5, 0.75), S, 1, false).put('office_chair', at(4, 4, 0, 0, 0.4), 0);
put('screen_panel', at(4, 4, 0, -W + 0.2, 2), P).put('metal_crate', at(3, 4, 0, -2.6, -2.6));
put('shelf_boxes', at(6, 4, 0, 2.6, 2.8), S).put('shelf_boxes', at(6, 4, 0, -2, 2.8), S).put('cardboard_box', at(6, 4, 0, 2.8, -2));
put('desk', at(2, 4, 0, -2, 2.5), S).put('bookcase', at(2, 4, 0, -W + 0.3, -1), P);
// The booth: consoles under the windows.
put('computer_bank', at(4, 6, 1, -2.4, 2.9), S).put('computer_bank', at(4, 6, 1, 2.4, -2.9), 0).put('office_chair', at(4, 6, 1, -2.4, 1.8));
// Showers, commissary, janitor.
for (const dz of [-2.4, -0.8, 0.8]) put('hm_shower', at(2, 9, 0, -W + 0.65, dz), P);
put('hm_bathroom_sink', at(2, 9, 0, 1, -W + 0.35), 0).put('hm_bathroom_sink', at(2, 9, 0, 2.4, -W + 0.35), 0);
put('shelf_boxes', at(5, 9, 0, -2.4, 2.8), S).put('checkout', at(5, 9, 0, 1, -1.5), 0);
put('sv_gas_can', at(6, 9, 0, -2.8, 2.8)).put('barrel', at(6, 9, 0, -2.8, -2.8)).put('workbench', at(6, 9, 0, 0, 3.1), S).put('trashcan', at(6, 9, 0, -1.4, 3.1));
// Laundry: washers along the walls, trolleys of linen.
for (const dx of [1, 2.4, 3.8, 5.2, 9.2, 10.6, 12, 13.4]) put('washer', at(0, 10, 0, dx - 3.5, 11.25), S);
for (const dz of [2, 4]) put('hm_washer', at(0, 10, 0, -3.25, dz), P);
put('table', at(0, 10, 0, 6.5, 3)).put('table', at(0, 10, 0, 9, 3)).put('cardboard_open', at(0, 10, 0, 11, 1), 0.4).put('shelf_bags', at(0, 10, 0, 11.4, 6), -P);
// Workshop: benches and stock.
put('workbench', at(2, 10, 0, 2.6, -2), -P).put('workbench', at(2, 11, 0, -2.6, 2), P).put('planks_stack', at(2, 11, 0, 2.4, 2.6)).put('metal_crate', at(2, 10, 0, -2.8, -2.8));
// Mess hall: rows of tables.
for (const dx of [0.5, 7.5]) for (const dz of [0.5, 3.5, 11.5]) {
  put('table', at(3, 10, 0, dx, dz)).put('bench', at(3, 10, 0, dx, dz - 0.9), 0, 2.5, false).put('bench', at(3, 10, 0, dx, dz + 0.9), 0, 2.5, false);
}
put('trashcan', at(3, 10, 0, -3, 11.4)).put('trashcan', at(4, 11, 0, 3.2, 3.2));
// Kitchen: ranges, counters, cold store.
for (let i = 0; i < 5; i++) put(i % 2 ? 'stove' : 'kitchen_cabinet', at(5, 10, 0, -2.4 + i * 1.1, 11.3), S);
put('hm_kitchen_counter_long', at(5, 10, 0, 4, 4), 0).put('hm_kitchen_counter_long', at(5, 10, 0, 4, 5.1), S);
put('freezer', at(5, 10, 0, 11.2, 10.4), -P).put('freezers_upright', at(5, 10, 0, 11.3, 8), -P).put('fridge', at(5, 10, 0, -3.1, 6), P);
put('crate_bottles', at(5, 10, 0, -3, -3)).put('sv_cook_pot', at(5, 10, 0, 4, 4, 0.95), 0, 1, false);
// Chapel: pews, the altar, candles.
for (const dz of [-1, 1.5, 4, 6.5, 9]) for (const dx of [1.2, 6.8]) put('stall_bench', at(0, 6, 0, dx, dz), P);
put('altar', at(0, 6, 0, 4, 10.7), S).put('candles', at(0, 6, 0, 2.6, 10.9), 0, 1, false).put('candles', at(0, 6, 0, 5.4, 10.9), 0, 1, false);
put('cross_column', at(0, 6, 0, 4, 11.4), S).put('banner', at(0, 6, 0, -W + 0.1, 8, 1.4), P, 1, false).put('banner', at(1, 6, 0, W - 0.1, 8, 1.4), -P, 1, false);
// South wing: the warden's office, vault, visitation, infirmary, solitary.
put('desk', at(1, 0, 0, 0, -1.5), 0).put('office_chair', at(1, 0, 0, 0, -2.6), 0).put('bookcase_wide', at(1, 0, 0, W - 0.3, 1), -P).put('hm_armchair', at(1, 0, 0, -2.4, 2.4), S);
put('rug', at(1, 0, 0, 0, 1), 0, 1, false).put('potted_plant', at(1, 0, 0, 2.8, -2.8));
put('metal_crate', at(0, 0, 0, -2.6, -2.6)).put('dungeon_chest', at(0, 0, 0, 2.6, -2.6)).put('shelf_end', at(0, 0, 0, -2.8, 1), P);
put('desk', at(0, 1, 0, -1.5, 2.6), S).put('bookcase', at(0, 1, 0, -W + 0.3, -1.5), P).put('sofa', at(1, 1, 0, 2.4, -W + 0.6), 0).put('bookcase', at(1, 1, 0, 2.8, 2.8), S);
for (const dz of [-2.4, 0, 2.4]) {
  put('table', at(2, 0, 0, W - 1.0, dz)).put('chair', at(2, 0, 0, W - 2, dz), P, 1, false);
  put('table', at(3, 0, 0, -W + 1.0, dz)).put('chair', at(3, 0, 0, -W + 2, dz), -P, 1, false);
}
put('hm_bed_single', at(4, 0, 0, -2.4, -2.2), 0).put('hm_bed_single', at(4, 0, 0, 0.4, -2.2), 0).put('hm_bed_single', at(5, 0, 0, 2.6, -2.2), 0);
put('sv_medkit_case', at(5, 0, 0, -2.6, 2.8)).put('side_table', at(4, 0, 0, -1, -3.2)).put('screen_panel', at(5, 0, 0, W - 0.2, 1), -P);
for (const x of [6, 7]) put('hm_toilet', at(x, 0, 0, 2.8, -3.2), 0).put('bed', at(x, 0, 0, -2.4, -1.5), 0);
// Admin corridor: benches and a water cooler's worth of clutter.
put('bench', at(4, 1, 0, 0, 3.2), S, 2.5, false).put('potted_plant', at(2, 1, 0, -2.8, 2.8)).put('trashcan', at(7, 1, 0, 2.8, -3));
// Barracks, guard station, armoury, lockers.
for (const [dx, dz] of [[-2.6, 4.5], [-2.6, 8.5], [10.6, -2.4], [10.6, 1.6]] as const) put('bunk_bed', at(8, 0, 0, dx, dz), 0);
put('table', at(8, 0, 0, 4, 4)).put('chair', at(8, 0, 0, 4, 3), 0, 1, false).put('tv', at(8, 0, 0, 4, 11.2), S).put('metal_crate', at(8, 0, 0, 10.8, 11));
put('desk', at(10, 1, 0, -2, 2.8), S).put('computer', at(10, 1, 0, -2, 2.8, 0.75), S, 1, false).put('sv_radio', at(10, 1, 0, -2.8, -2.8));
put('shelf_boxes', at(10, 0, 0, -2.8, -2.6), P).put('metal_crate', at(10, 0, 0, 2.6, -2.6)).put('metal_crate', at(10, 0, 0, 2.6, -2.6, 0.9), 0.3);
for (const dz of [-2.6, 2.6]) put('shelf_end', at(11, 1, 0, W - 0.3, dz), -P);
put('bench', at(11, 0, 0, 0.5, 0), P, 2.5, false);
// The yard: lightposts, benches, barriers.
for (const [x, z] of [[61, 26], [91, 26], [61, 62], [91, 62]] as const) put('lightpost_double', [x, 0, z], 0);
put('barrier', [70, 0, 20]).put('barrier', [82, 0, 20]).put('cone', [88, 0, 64], 0, 1, false).put('warning_sign', [60, 0, 66]);
// The forecourt and the road: barriers, a skip, the cell block's signage.
put('barrier_high', at(1, 3, 0, 0, 0), P).put('barrier_high', at(5, 2, 0, 0, 0), 0).put('skip', at(0, 9, 0, -1, 0), P).put('cardboard_box', at(0, 9, 0, 2, -2));
for (const [x, z] of [[4, 18], [44, 18], [-8, 44], [100 - 4, 44], [36, 100], [4, 100]] as const) put('lightpost', [x, 0, z], 0);
// The dock: crates and pallets on the platform, cones.
put('cargo_crate', at(7, 11, 0, -1.8, 2), 0.1).put('crate_large', at(7, 11, 0, -1.8, 4.2)).put('factory_box', at(9, 10, 0, -2, -1));
put('cone', at(9, 11, 0, 2, 2), 0, 1, false).put('cone', at(10, 11, 0, -2, 2), 0, 1, false).put('cargo_crate', at(11, 10, 0, 1.5, -1), 0.3);
// Tunnels: pipes and valves, the pump.
put('big_pipe', at(8, 5, -1, -2.8, 4), 0).put('machine', at(8, 5, -1, 8, 10.5), S).put('pipe_valve', at(9, 6, -1, 2.8, 2.8)).put('hopper', at(8, 5, -1, -2.6, -2.6));
for (const [x, y] of [[10, 8], [10, 4], [9, 9]] as const) put('pipe_valve', at(x, y, -1, 2.8, x === 9 ? 2.9 : 0), -P);

// The buggy waits by the truck.
m.mount('buggy', at(9, 11, 0, -2.5, 3), P, null);

// ---------------------------------------------------------------- lights: harsh white, dim red in solitary, amber in the tunnels

const WHITE = '#eef4ff';
const lightCell = (x: number, y: number, z: number, o: { color?: string; intensity?: number; range?: number; fixture?: 'ceiling' | 'bulb' | 'strip' | 'none' } = {}) =>
  m.light(at(x, y, z, 0, 0, 3.45), { fixture: o.fixture ?? 'ceiling', color: o.color ?? WHITE, intensity: o.intensity ?? 0.9, range: o.range ?? 9 });
for (const [k, c] of cells) {
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  if (c.kind !== 'room' && c.kind !== 'room_large') continue;
  if (z === -1) lightCell(x, y, z, { color: '#ffb066', intensity: 0.55, range: 8, fixture: 'bulb' });
  else if ((x === 6 || x === 7) && y === 0) lightCell(x, y, z, { color: '#ff3a2a', intensity: 0.3, range: 5, fixture: 'bulb' }); // solitary
  else if (x === 2 || x === 6) lightCell(x, y, z, { intensity: y >= 5 && y <= 8 ? 0.6 : 0.9, range: 8, fixture: y >= 5 && y <= 8 ? 'bulb' : 'ceiling' });
  else if (x >= 3 && x <= 5 && y >= 5 && y <= 8 && z === 0) continue; // atrium: lit from above
  else lightCell(x, y, z);
}
// The atrium: strips under the galleries and long lamps under the roof.
for (let y = 5; y <= 8; y++) {
  for (const x of [3, 5]) for (const z of [0, 1]) m.light(at(x, y, z, 0, 0, 3.6), { fixture: 'strip', color: WHITE, intensity: 0.8, range: 9 });
  m.light(at(4, y, 2, 0, 0, 3.3), { fixture: 'bulb', color: WHITE, intensity: 1.4, range: 16 });
}
m.light(at(4, 6, 1, 0, 0, 3.4), { fixture: 'ceiling', color: '#ffe0c0', intensity: 0.8, range: 7 });
for (const [x, y, z] of [[5, 4, 0], [3, 4, 1], [3, 9, 0], [5, 9, 1]] as const) m.light(at(x, y, z, 0, 0, 7), { fixture: 'bulb', color: WHITE, intensity: 0.7, range: 9 });
for (const [x, y] of [[7, 9], [10, 10], [11, 2]] as const) m.light(at(x, y, -1, 0, 0, 3.4), { fixture: 'bulb', color: '#ffb066', intensity: 0.6, range: 8 });
// Floodlights over the yard, the dock, the forecourt and the road.
for (const [x, z] of [[61, 26], [91, 26], [61, 62], [91, 62]] as const) m.light([x, 6, z], { fixture: 'none', color: WHITE, intensity: 1.6, range: 22 });
for (const [x, z] of [[4, 18], [44, 18], [-8, 44], [96, 44], [36, 100], [4, 100]] as const) m.light([x, 5.5, z], { fixture: 'none', color: WHITE, intensity: 1.2, range: 16 });
for (const [x, z] of [[68, 100], [84, 84]] as const) m.light([x, 6, z], { fixture: 'bulb', color: WHITE, intensity: 1.5, range: 18 });
for (const [x, z] of [[24, 27.6], [64, 76.6]] as const) m.light([x, 3.6, z], { fixture: 'wall', color: WHITE, intensity: 1, range: 8, yaw: S });

// ---------------------------------------------------------------- the island

m.bounds('invisible', 0, { min: [-14, -14], max: [102, 110] }, 40);
const sm = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Terrain sunk under everything built, level round it, then rocks falling away to the sea (see dockside_depot). */
function sculpt(margin: number, flat: number, shape: (x: number, z: number, d: number) => number, cover: (x: number, z: number, d: number, h: number) => [TerrainMaterial, number]): TerrainData {
  const b = m.doc.bounds!;
  const x0 = Math.floor((b.min[0] - margin) / 4) * 4;
  const z0 = Math.floor((b.min[1] - margin) / 4) * 4;
  const cols = Math.min(161, Math.ceil((b.max[0] + margin - x0) / 2) + 1);
  const rows = Math.min(161, Math.ceil((b.max[1] + margin - z0) / 2) + 1);
  const low = new Map<string, number>();
  const rects: [number, number, number, number][] = [];
  for (const k of buildOccupancy(m.doc).cells.keys()) {
    const [gx, gy, gz] = k.split(',').map(Number) as [number, number, number];
    const col = `${gx},${gy}`;
    if (!low.has(col)) rects.push([gx * 8 - 4, gy * 8 - 4, gx * 8 + 4, gy * 8 + 4]);
    low.set(col, Math.min(low.get(col) ?? Infinity, gz));
  }
  const dist = (x: number, z: number) => {
    let d = Infinity;
    for (const [ax, az, bx, bz] of rects) d = Math.min(d, Math.hypot(Math.max(ax - x, 0, x - bx), Math.max(az - z, 0, z - bz)));
    return d;
  };
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * 2;
      const z = z0 + r * 2;
      let under = Infinity;
      let edge = false;
      for (const gx of new Set([Math.floor((x + 4) / 8), Math.ceil((x - 4) / 8)])) for (const gy of new Set([Math.floor((z + 4) / 8), Math.ceil((z - 4) / 8)])) {
        const lz = low.get(`${gx},${gy}`);
        if (lz !== undefined && lz <= 0) under = Math.min(under, lz * 4 - 3.6);
        else edge = true;
      }
      if (edge && under === -3.6) under = 0;
      const d = dist(x, z);
      const h = under < Infinity ? under : d <= flat ? 0 : shape(x, z, d);
      heights.push(Math.round(h * 100));
    }
  }
  const t: TerrainData = { origin: [x0, z0], spacing: 2, cols, rows, baseY: 0, heights, materials: [], boundary: true, foliage: [] };
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const x = x0 + c * 2 + 1;
      const z = z0 + r * 2 + 1;
      const d = dist(x, z);
      const [g, f] = cover(x, z, d, terrainHeightAt(t, x, z) ?? 0);
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      foliage.push(d < 2 ? 0 : f);
    }
  }
  const out = paintSlopes({ ...t, materials, foliage }, 32, 'stone');
  m.terrain(out);
  return out;
}
sculpt(
  56,
  3,
  (x, z, d) => sm(3, 12, d) * (1.4 + 1.2 * Math.sin(x / 5 + 1) * Math.cos(z / 6) + 0.8 * Math.sin((x - z) / 4)) - sm(10, 40, d) * 12,
  (x, z, d, h) => (d < 5 ? ['gravel', 0] : h < -1.5 ? ['sand', 0] : [Math.sin(x / 7) * Math.cos(z / 5) > 0.2 ? 'stone' : 'gravel', 1]),
);
m.backdrop('night', 'ocean', 'water', 0.55, 0.6);
m.meta({
  description:
    'A maximum-security prison on a rocky island at night. In Breakout the Inmates start locked in a three-tier cell block and the doors release eight seconds in; the Guards start in their barracks beside the armoury. Galleries and bridges ring the atrium round a hanging control booth whose lever locks the whole block down. Around it: the laundry, workshop, mess hall and kitchen, a loading dock with a truck, a buggy and a gate, the warden\'s office and vault, glass-walled visitation, the infirmary, dark solitary, a chapel, a razor-wired exercise yard with a court and bleachers, and sewer tunnels under the yard. Guard towers with turrets and sentries watch from the wall. Hostage Rescue: spring the four held in solitary, the infirmary and the warden\'s office to the dock or the pump room.',
  modes: ['core.hostage', 'core.tdm', 'core.deathmatch', 'core.bomb', 'core.ctf', 'core.koth', 'core.zombies'],
  players: [8, 20],
});
await m.save();
