/**
 * Diamond Park: an original evening ballpark for 12–24 players. The diamond
 * lies in the north-east quadrant: home plate at the origin, the first-base
 * line running east along z = 0 and the third-base line north along x = 0, so
 * the whole park is mirrored across the x = z diagonal. The Visitors own the
 * first-base (south) side, the Home team the third-base (west) side.
 *
 *   - The field: mown grass outfield and foul ground, a dirt infield with
 *     bases, a raised pitcher's mound and home-plate circle, chalked foul
 *     lines, a padded outfield wall (bullpen gates and service gates), yellow
 *     foul poles, a batter's eye and, in centre field, a big scoreboard with
 *     three catwalk decks behind its face (peek slots in the board) reached
 *     by stairs and ladders.
 *   - The stands: an L of seating (the horseshoe from first to third) behind
 *     a padded rail and, behind home, a backstop net. 16 lower rows climb to a
 *     cross-aisle at 4 m; the upper deck's 16 rows climb to 8 m over the
 *     concourse. Three player tunnels on each side cut through the lower bowl
 *     at field level: one from each dugout (sunk 1.2 m beside the baseline) to
 *     the team's clubhouse, two vomitories into the concourse.
 *   - Under the upper deck: the concourse (corridor, concessions, restrooms,
 *     the clubhouses with lounge, tunnel room and lockers, the batting cage)
 *     round a pillared hub behind home plate. Behind it the four-storey club
 *     building: lobby, team store and offices, a club level, luxury boxes
 *     opening onto the top row, and the press box on top (the sniper's seat).
 *   - Outside: the plaza with ticket gates, food stalls and light towers you
 *     can climb (a sniper platform on each), the parking lot, a loading dock
 *     on the first-base side, the groundskeeper's shed and cart on the third,
 *     and the bullpens behind the outfield wall.
 *
 * Grid x east, y north (one cell = 8 m); concourse cells sit on level 0 with
 * the upper deck on their roofs, the club building rises to level 3.
 *
 *  gy 7   . W W                            W  west (home) concourse: inner gx -4, outer gx -5
 *  ...    . W W   field (x, z > 0)
 *  gy -3  C W W   lower bowl
 *  gy -4  C H H S S S S S S S S S S S S    H hub (2x2)  S south (visitors) concourse:
 *  gy -5  C H H S S S S S S S S S S S S      inner gy -4, outer gy -5
 *  gy -6  C C C C                          C club building (press box on top)
 *        -6-5-4-3-2-1 0 1 2 3 4 5 6 7
 */
import { TERRAIN_MATERIALS, buildOccupancy, type EdgeStyle, type RoomOptions, type Rotation, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('diamond_park', 'Diamond Park');
m.theme('city');
m.factions([
  { id: 'home', name: 'Home', color: '#2f62d6', relations: {} },
  { id: 'away', name: 'Visitors', color: '#d0402f', relations: {} },
]);
m.teams([12, 12]);
const [HOME, AWAY] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Mat = { material: string; tint?: string };
type Arm = 'S' | 'W';
const P = Math.PI / 2;
const PI = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
const ARMS: Arm[] = ['S', 'W'];

// ---------------------------------------------------------------- materials

const PAD: Mat = { material: 'paint_matte', tint: '#1d4d36' }; // the padded wall and rail
const CAP: Mat = { material: 'paint_matte', tint: '#e8c534' }; // yellow home-run line
const TREAD: Mat = { material: 'pbr_concrete', tint: '#aaa69c' };
const SEAT_LO: Mat = { material: 'paint_gloss', tint: '#2b5fa8' };
const SEAT_HI: Mat = { material: 'paint_gloss', tint: '#1f7a55' };
const CONCRETE: Mat = { material: 'pbr_concrete', tint: '#9c988e' };
const STEEL: Mat = { material: 'pbr_steel', tint: '#3c4148' };
const NET: Mat = { material: 'pbr_steel', tint: '#24272b' };
const CHALK: Mat = { material: 'paint_matte', tint: '#f2f2ee' };
const CLAY: Mat = { material: 'paint_matte', tint: '#9a5a36' };
const POLE: Mat = { material: 'paint_gloss', tint: '#f2cf1d' };
const GLOW: Mat = { material: 'light_strip', tint: '#fff6dc' };
const BOARD: Mat = { material: 'paint_gloss', tint: '#1a1f26' };
const AMBER: Mat = { material: 'light_strip', tint: '#ffb347' };
const SCREEN: Mat = { material: 'light_strip', tint: '#3d7bff' };
const EYE: Mat = { material: 'paint_matte', tint: '#13301f' };
const ROOF: Mat = { material: 'pbr_roof', tint: '#4a5058' };
const ASPHALT: Mat = { material: 'pbr_asphalt' };
const WHITE_PANEL: Mat = { material: 'pbr_white_panel', tint: '#e8e4da' };

const tile = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const CONC: TileSurfaces = { floor: tile('pbr_terrazzo', '#b4b0a6'), walls: tile('pbr_concrete', '#c9c5b9'), trim: tile('pbr_steel', '#3a4250') };
const VOM: TileSurfaces = { floor: tile('pbr_concrete', '#9a968c'), walls: tile('pbr_concrete', '#b8b4a8'), trim: tile('hazard') };
const KITCHEN: TileSurfaces = { floor: tile('pbr_delft', '#c8ccc4'), walls: tile('white_tiles', '#e0e0d8'), trim: tile('pbr_steel') };
const WC: TileSurfaces = { floor: tile('white_tiles', '#d8dcd8'), walls: tile('white_tiles', '#c8d4dc'), trim: tile('pbr_steel') };
const CAGE: TileSurfaces = { floor: tile('pbr_grass', '#5a8a4a'), walls: tile('pbr_concrete', '#8a8e86'), trim: tile('pbr_steel') };
const CLUB: Record<Arm, TileSurfaces> = {
  S: { floor: tile('pbr_carpet', '#6e2c2c'), walls: tile('pbr_walnut'), trim: tile('brass') },
  W: { floor: tile('pbr_carpet', '#2c3f6e'), walls: tile('pbr_walnut'), trim: tile('brass') },
};
const LOBBY: TileSurfaces = { floor: tile('pbr_terrazzo', '#d0c8b4'), walls: tile('pbr_plaster_white', '#e4ddcc'), trim: tile('brass') };
const STORE: TileSurfaces = { floor: tile('pbr_floorboards'), walls: tile('pbr_plaster_white', '#e8e2d2'), trim: tile('pbr_walnut') };
const OFFICE: TileSurfaces = { floor: tile('pbr_carpet', '#4a4e58'), walls: tile('pbr_plaster', '#c9c2ae'), trim: tile('pbr_walnut') };
const SUITE: TileSurfaces = { floor: tile('pbr_carpet', '#3e3450'), walls: tile('pbr_walnut'), trim: tile('brass') };
const PRESS: TileSurfaces = { floor: tile('pbr_carpet', '#2a3440'), walls: tile('pbr_white_panel'), trim: tile('pbr_steel') };
const STAIR: TileSurfaces = { floor: tile('pbr_concrete', '#9a968c'), walls: tile('pbr_concrete', '#b8b4a8'), solids: tile('pbr_concrete', '#8a867c'), trim: tile('hazard') };
const SHED: TileSurfaces = { floor: tile('pbr_concrete_dark'), walls: tile('pbr_corrugated', '#6a7a5a'), trim: tile('pbr_steel') };

// ---------------------------------------------------------------- free blocks

/** A solid box from min to max corner (split into pieces no bigger than blocks allow). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: Mat): void {
  if (x1 - x0 < 0.04 || z1 - z0 < 0.04 || y1 - y0 < 0.02) return;
  if (y1 - y0 < 0.101) y0 = y1 - 0.101;
  if (x1 - x0 < 0.201) [x0, x1] = [(x0 + x1) / 2 - 0.101, (x0 + x1) / 2 + 0.101];
  if (z1 - z0 < 0.201) [z0, z1] = [(z0 + z1) / 2 - 0.101, (z0 + z1) / 2 + 0.101];
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  if (w > 64 || d > 64 || h > 32) {
    const nx = Math.ceil(w / 64);
    const nz = Math.ceil(d / 64);
    const ny = Math.ceil(h / 32);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        for (let k = 0; k < ny; k++) box(x0 + (w * i) / nx, y0 + (h * k) / ny, z0 + (d * j) / nz, x0 + (w * (i + 1)) / nx, y0 + (h * (k + 1)) / ny, z0 + (d * (j + 1)) / nz, mat);
    return;
  }
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(w), r2(h), r2(d)], 'solid', mat);
}

/** A local frame turned about the vertical: local +z points along `yaw` (as entity yaws do). */
interface Frame {
  x: number;
  z: number;
  yaw: number;
}
const fw = (f: Frame, lx: number, lz: number): [number, number] => [f.x + lx * Math.cos(f.yaw) + lz * Math.sin(f.yaw), f.z - lx * Math.sin(f.yaw) + lz * Math.cos(f.yaw)];
/** A box in a turned frame, from local min to max corner. */
function lbox(f: Frame, lx0: number, lz0: number, lx1: number, lz1: number, y0: number, y1: number, mat: Mat): void {
  const w = Math.max(0.2, lx1 - lx0);
  const d = Math.max(0.2, lz1 - lz0);
  const h = Math.max(0.1, y1 - y0);
  const [x, z] = fw(f, (lx0 + lx1) / 2, (lz0 + lz1) / 2);
  m.block([r2(x), r2(y1 - h), r2(z)], [r2(w), r2(h), r2(d)], 'solid', { ...mat, yaw: +f.yaw.toFixed(4) });
}
const yawOf = (dx: number, dz: number) => +Math.atan2(dx, dz).toFixed(4);

// ---------------------------------------------------------------- the two arms, mirrored across x = z

/** Arm frame: s runs along the baseline, t across it (positive toward the field). */
const AW = (arm: Arm, s: number, t: number): [number, number] => (arm === 'S' ? [s, t] : [t, s]);
const apt = (arm: Arm, s: number, y: number, t: number): V3 => {
  const [x, z] = AW(arm, s, t);
  return [r2(x), r2(y), r2(z)];
};
/** Mirror a yaw for the west arm (facing +t is yaw 0 in the arm frame). */
const ayaw = (arm: Arm, yaw: number) => +(arm === 'S' ? yaw : P - yaw).toFixed(4);
function abox(arm: Arm, s0: number, t0: number, s1: number, t1: number, y0: number, y1: number, mat: Mat): void {
  const [ax, az] = AW(arm, s0, t0);
  const [bx, bz] = AW(arm, s1, t1);
  box(Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz), mat);
}
const AC = (arm: Arm, cs: number, ct: number): [number, number] => (arm === 'S' ? [cs, ct] : [ct, cs]);
const ASIDE: Record<Side, Side> = { N: 'E', E: 'N', S: 'W', W: 'S' };
const AS = (arm: Arm, side: Side): Side => (arm === 'S' ? side : ASIDE[side]);
/** Segments of [s0, s1] outside the holes. */
function segs(s0: number, s1: number, holes: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let s = s0;
  for (const [a, b] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (b <= s || a >= s1) continue;
    if (a > s) out.push([s, a]);
    s = Math.max(s, b);
  }
  if (s < s1) out.push([s, s1]);
  return out;
}

function put(model: string, p: V3, yaw = 0, scale = 1, solid = true): void {
  m.prop(model, [r2(p[0]), r2(p[1]), r2(p[2])], +yaw.toFixed(4), scale, solid);
}
const aput = (arm: Arm, model: string, s: number, y: number, t: number, yaw = 0, scale = 1, solid = true) => put(model, apt(arm, s, y, t), ayaw(arm, yaw), scale, solid);

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
  const fp: [number, number, number][] = kind === 'room_large' ? [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]] : kind === 'stairwell' ? [[0, 0, 0], [0, 0, 1]] : [[0, 0, 0]];
  for (const [dx, dy, dz] of fp) {
    const k = key(x + dx, y + dy, z + dz);
    if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
    cells.set(k, { kind, group: g });
  }
  if (o.surf) paint(x, y, z, o.surf);
}
const ROOFED: RoomOptions = { ceiling: 'roof' };
const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const alink = (arm: Arm, cs: number, ct: number, z: number, side: Side, style: EdgeStyle) => {
  const [x, y] = AC(arm, cs, ct);
  link(x, y, z, AS(arm, side), style);
};
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };

/** What each inner concourse cell (row -4) is, along the arm. */
const INNER: Record<number, 'grill' | 'pizza' | 'vom' | 'wc' | 'lounge' | 'tunnel' | 'lockers' | 'cage' | 'bar'> = {
  [-3]: 'grill',
  [-2]: 'pizza',
  [-1]: 'vom',
  0: 'wc',
  1: 'lounge',
  2: 'tunnel',
  3: 'lockers',
  4: 'cage',
  5: 'vom',
  6: 'bar',
  7: 'wc',
};
const INNER_SURF = (arm: Arm, k: (typeof INNER)[number]): TileSurfaces =>
  k === 'grill' || k === 'pizza' || k === 'bar' ? KITCHEN : k === 'wc' ? WC : k === 'vom' ? VOM : k === 'cage' ? CAGE : CLUB[arm];

for (const arm of ARMS) {
  for (let cs = -3; cs <= 7; cs++) {
    const [ox, oy] = AC(arm, cs, -5);
    place('room', ox, oy, 0, { surf: CONC, opts: { ceiling: 'roof', facade: 'brick' } });
    const [ix, iy] = AC(arm, cs, -4);
    place('room', ix, iy, 0, { surf: INNER_SURF(arm, INNER[cs]!), opts: ROOFED });
  }
  // The concourse corridor runs the length of the outer row, into the hub.
  for (let cs = -3; cs <= 6; cs++) alink(arm, cs, -5, 0, 'E', 'open');
  alink(arm, -3, -5, 0, 'W', 'wide');
  for (let cs = -2; cs <= 7; cs++) alink(arm, cs, -5, 0, 'S', cs === -1 || cs === 3 || cs === 6 ? 'door' : 'windows');
  alink(arm, 7, -5, 0, 'E', 'wide'); // the loading dock / groundskeeper's yard
  alink(arm, 7, -4, 0, 'E', 'door');
  for (let cs = -3; cs <= 7; cs++) {
    const k = INNER[cs]!;
    if (k === 'vom') {
      alink(arm, cs, -4, 0, 'N', 'door');
      alink(arm, cs, -4, 0, 'S', 'wide');
    } else if (k === 'tunnel') alink(arm, cs, -4, 0, 'N', 'door');
    else if (k !== 'lockers') alink(arm, cs, -4, 0, 'S', 'door');
  }
  // The clubhouse: lounge -> tunnel room -> lockers -> batting cage.
  alink(arm, 1, -4, 0, 'E', 'door');
  alink(arm, 2, -4, 0, 'E', 'door');
  alink(arm, 3, -4, 0, 'E', 'door');
}
// The hub behind home plate, under the corner of the upper deck.
place('room_large', -5, -5, 0, { surf: { ...CONC, floor: tile('pbr_terrazzo', '#c4b89a') }, opts: { ceiling: 'roof', layout: 'empty' } });

// The club building: lobby, store and offices; club level; suites; the press box.
const club = (x: number, y: number, z: number, surf: TileSurfaces) => place('room', x, y, z, { surf, opts: { ceiling: 'roof', facade: 'plaster' } });
club(-6, -6, 0, LOBBY);
club(-5, -6, 0, STORE);
club(-4, -6, 0, OFFICE);
place('stairwell', -3, -6, 0, { rot: 0, surf: STAIR }); // levels 0-1, doors west
club(-6, -5, 0, STORE);
club(-6, -4, 0, OFFICE);
club(-6, -3, 0, LOBBY);
for (const [x, y] of [[-6, -6], [-5, -6], [-4, -6], [-6, -5], [-6, -4]] as const) club(x, y, 1, LOBBY);
place('stairwell', -6, -3, 1, { rot: 3, surf: STAIR }); // levels 1-2, doors south
place('stairwell', -6, -6, 2, { rot: 2, surf: STAIR }); // levels 2-3, doors east
for (const [x, y] of [[-5, -6], [-4, -6], [-3, -6], [-6, -5], [-6, -4]] as const) club(x, y, 2, SUITE);
club(-5, -6, 3, PRESS);
club(-4, -6, 3, PRESS);

// Level 0.
link(-6, -6, 0, 'S', 'wide');
link(-6, -6, 0, 'W', 'wide');
link(-6, -6, 0, 'E', 'door');
link(-6, -6, 0, 'N', 'door');
link(-5, -6, 0, 'N', 'wide');
link(-5, -6, 0, 'S', 'windows');
link(-4, -6, 0, 'N', 'door');
link(-4, -6, 0, 'E', 'door');
link(-4, -6, 0, 'S', 'window');
link(-6, -5, 0, 'E', 'wide');
link(-6, -5, 0, 'W', 'windows');
link(-6, -4, 0, 'E', 'door');
link(-6, -4, 0, 'W', 'window');
link(-6, -4, 0, 'N', 'door');
link(-6, -3, 0, 'E', 'door');
link(-6, -3, 0, 'W', 'door');
// Level 1: the club level, ringed with windows.
link(-6, -6, 1, 'E', 'door');
link(-6, -6, 1, 'N', 'door');
link(-5, -6, 1, 'E', 'door');
link(-4, -6, 1, 'E', 'door');
link(-6, -5, 1, 'N', 'door');
link(-6, -4, 1, 'N', 'door');
for (const x of [-6, -5, -4]) link(x, -6, 1, 'S', 'windows');
for (const y of [-6, -5, -4]) link(-6, y, 1, 'W', 'windows');
// Level 2: suites, windows over the park, doors onto the top row.
link(-6, -6, 2, 'E', 'door');
link(-5, -6, 2, 'E', 'door');
link(-4, -6, 2, 'E', 'door');
link(-5, -6, 2, 'N', 'windows');
link(-4, -6, 2, 'N', 'windows');
link(-3, -6, 2, 'N', 'door');
link(-3, -6, 2, 'E', 'window');
for (const x of [-5, -4, -3]) link(x, -6, 2, 'S', 'windows');
link(-6, -5, 2, 'N', 'door');
link(-6, -4, 2, 'N', 'door');
link(-6, -5, 2, 'E', 'windows');
link(-6, -4, 2, 'E', 'door');
for (const y of [-5, -4]) link(-6, y, 2, 'W', 'windows');
// Level 3: the press box.
link(-6, -6, 3, 'E', 'door');
link(-5, -6, 3, 'E', 'open');
link(-5, -6, 3, 'N', 'windows');
link(-4, -6, 3, 'N', 'windows');
link(-4, -6, 3, 'E', 'windows');
link(-5, -6, 3, 'S', 'windows');
link(-4, -6, 3, 'S', 'windows');

// The groundskeeper's shed, out past the third-base end.
place('room', -6, 9, 0, { surf: SHED, opts: { ceiling: 'roof' } });
link(-6, 9, 0, 'E', 'wide');
link(-6, 9, 0, 'S', 'window');

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

// ---------------------------------------------------------------- the seating bowl

const FRONT = -12; // the bowl's front rail, 12 m off each baseline
const SEND = 60; // where each stand ends along its line
const TRENCH = [-8, 16, 40]; // player tunnels through the lower bowl (16: the dugout tunnel)
interface Row {
  d0: number;
  d1: number;
  top: number;
  base: number;
  lower: boolean;
}
const ROWS: Row[] = [];
for (let i = 0; i < 16; i++) ROWS.push({ d0: i, d1: i + 1, top: 0.25 * (i + 1), base: 0, lower: true });
for (let j = 0; j < 16; j++) ROWS.push({ d0: 18 + 0.875 * j, d1: 18 + 0.875 * (j + 1), top: 4.25 + 0.25 * j, base: 4, lower: false });
/** Top of the row at depth d (m behind the front rail), for spawns and pickups: on the tread, clear of the seat strip. */
const rowAt = (d: number) => ROWS.find((r) => d >= r.d0 && d < r.d1)!;

for (const arm of ARMS) {
  for (const row of ROWS) {
    const t0 = FRONT - row.d1;
    const t1 = FRONT - row.d0;
    // The south arm owns the corner square, so each row turns the corner as one L.
    const sStart = arm === 'S' ? FRONT - row.d1 : FRONT - row.d0;
    const holes: [number, number][] = row.lower ? TRENCH.map((tx) => [tx - 2, tx + 2]) : [];
    const seat = row.lower ? SEAT_LO : SEAT_HI;
    const strip = row.lower ? 0.45 : 0.4;
    const piece = (a: number, b: number, base: number) => {
      abox(arm, a, t0, b, t1, base, row.top, TREAD);
      abox(arm, a, t0, b, t0 + strip, row.top, row.top + 0.2, seat);
    };
    for (const [a, b] of segs(sStart, SEND, holes)) piece(a, b, row.base);
    if (row.lower) {
      for (const tx of TRENCH) {
        // The back five rows bridge the tunnel (2.6 m of headroom); in front of them, rails along its edges.
        if (row.top >= 3) piece(tx - 2, tx + 2, 2.6);
        else {
          abox(arm, tx - 2.2, t0, tx - 2, t1, row.top, row.top + 1, STEEL);
          abox(arm, tx + 2, t0, tx + 2.2, t1, row.top, row.top + 1, STEEL);
        }
      }
    }
    // The stand's end wall, stepped with the rows.
    abox(arm, SEND, t0, SEND + 0.4, t1, row.base, row.top + 1.1, CONCRETE);
  }
  abox(arm, SEND, FRONT - 18, SEND + 0.4, FRONT - 16, 4, 5.1, CONCRETE);
  // The cross-aisle's rail in front of the upper deck, with gaps for the aisles.
  for (const [a, b] of segs(FRONT - 18, SEND, [-16, 0, 20, 36, 52].map((c) => [c - 1, c + 1] as [number, number]))) abox(arm, a, FRONT - 18, b, FRONT - 17.8, 4, 5, PAD);
  // The rail along the back of the top row (the club building closes the corner).
  abox(arm, -20, -44, SEND + 0.4, -43.8, 8, 9.1, CONCRETE);
  // The padded front rail: openings at the tunnels, the dugout and two aisles.
  const front: [number, number][] = [[-10, -6], [8, 24], [38, 42], [29, 31], [49, 51]];
  for (const [a, b] of segs(FRONT, SEND, front)) abox(arm, a, FRONT, b, FRONT + 0.3, 0, 1, PAD);
  // The backstop net behind home plate: posts too close to pass, a rail along the top.
  for (const [a, b] of segs(FRONT, 4, [[-10, -6]])) {
    for (let s = a + 0.1; s <= b - 0.1; s += 0.45) abox(arm, s - 0.1, FRONT + 0.05, s + 0.1, FRONT + 0.25, 1, 7, NET);
    abox(arm, a, FRONT, b, FRONT + 0.3, 7, 7.2, NET);
  }
}

// ---------------------------------------------------------------- dugouts (sunk 1.2 m), and their tunnel steps

const DUG = -1.2;
for (const arm of ARMS) {
  // Covers over the sloping cut in the ground: a lip along the front, the ends level with the field.
  abox(arm, 6, -8, 26, -6, DUG - 0.2, 0, CONCRETE);
  abox(arm, 6, -12, 8, -8, DUG - 0.2, 0, CONCRETE);
  abox(arm, 24, -12, 26, -8, DUG - 0.2, 0, CONCRETE);
  // The back wall (also the stand's front rail here), open to the tunnel.
  for (const [a, b] of segs(8, 24, [[14, 18]])) abox(arm, a, -12.3, b, -11.9, DUG - 0.2, 1, PAD);
  // Steps down at both ends (4 steps), the rail along the front over the deep part.
  for (let k = 0; k < 4; k++) {
    abox(arm, 8 + 0.5 * k, -12, 8.5 + 0.5 * k, -8, DUG - 0.2, r2(-0.24 * (k + 1)), CONCRETE);
    abox(arm, 23.5 - 0.5 * k, -12, 24 - 0.5 * k, -8, DUG - 0.2, r2(-0.24 * (k + 1)), CONCRETE);
  }
  abox(arm, 10, -8, 22, -7.8, 0, 1, STEEL);
  // The roof, on the back wall and two posts.
  abox(arm, 8, -12, 24, -9.2, 1.6, 1.9, ROOF);
  for (const s of [10.2, 21.8]) abox(arm, s - 0.15, -9.6, s + 0.15, -9.3, DUG, 1.6, STEEL);
  // The tunnel climbs out of the back: five steps up to field level, then the tunnel floor.
  for (let k = 0; k < 5; k++) abox(arm, 14, -12 - 0.5 * (k + 1), 18, -12 - 0.5 * k, DUG - 0.2, r2(DUG + 0.24 * (k + 1)), CONCRETE);
  abox(arm, 14, -16.5, 18, -14.5, DUG - 0.2, 0, CONCRETE);
  abox(arm, 13.6, -16.5, 14, -12, DUG - 0.2, 0, CONCRETE);
  abox(arm, 18, -16.5, 18.4, -12, DUG - 0.2, 0, CONCRETE);
  // Benches, the bat rack and the water cooler.
  for (const s of [11.5, 20.5]) aput(arm, 'bench', s, DUG, -11.4, 0, 2.5, false);
  aput(arm, 'bookcase', 12.8, DUG, -11.5, 0);
  aput(arm, 'barrel', 19, DUG, -11.4, 0);
  aput(arm, 'bucket', 13.4, DUG, -9, 0, 1, false);
  m.light(apt(arm, 16, 1.5, -10.5), { fixture: 'strip', color: '#fff1d6', intensity: 1, range: 9 });
}

// ---------------------------------------------------------------- the field: walls, poles, bases, lines

const WALL_H = 3.2;
const rWall = (th: number) => 72 + 13 * Math.sin(2 * th);
const WALL_N = 30;
const GATES = new Set([3, 26]); // the bullpen gates
for (let i = 0; i < WALL_N; i++) {
  if (GATES.has(i)) continue;
  const a0 = (i / WALL_N) * P;
  const a1 = ((i + 1) / WALL_N) * P;
  const p0 = [rWall(a0) * Math.cos(a0), rWall(a0) * Math.sin(a0)] as const;
  const p1 = [rWall(a1) * Math.cos(a1), rWall(a1) * Math.sin(a1)] as const;
  const dx = p1[0] - p0[0];
  const dz = p1[1] - p0[1];
  const len = Math.hypot(dx, dz) + 0.12;
  // Local z across the wall (pointing out of the park), local x along it.
  const f: Frame = { x: (p0[0] + p1[0]) / 2, z: (p0[1] + p1[1]) / 2, yaw: Math.atan2(dz, -dx) };
  lbox(f, -len / 2, 0, len / 2, 0.6, 0, WALL_H, PAD);
  lbox(f, -len / 2, -0.05, len / 2, 0.65, WALL_H, WALL_H + 0.15, CAP);
}
for (const arm of ARMS) {
  // From the foul pole back to the stand: a service gate in the side wall.
  for (const [a, b] of segs(-12, 0, [[-10, -6]])) abox(arm, 72, a, 72.6, b, 0, WALL_H, PAD);
  abox(arm, SEND + 0.4, -12.6, 72.6, -12, 0, WALL_H, PAD);
  // The foul pole and its screen.
  abox(arm, 72.05, -0.25, 72.55, 0.25, 0, 22, POLE);
  abox(arm, 71.9, 0.25, 72.1, 1.6, 4, 20, POLE);
  // The chalked foul line out to the pole.
  abox(arm, 0, -0.1, 72, 0.1, -0.07, 0.03, CHALK);
}
// Bases, home plate, the rubber, the batter's boxes.
box(-0.3, -0.06, -0.3, 0.3, 0.04, 0.3, CHALK);
for (const [x, z] of [[21, 0], [21, 21], [0, 21]] as const) box(x - 0.25, 0, z - 0.25, x + 0.25, 0.1, z + 0.25, CHALK);
box(9.7, 0.36, 9.9, 10.3, 0.46, 10.1, CHALK);
for (const s of [-1, 1]) {
  const f: Frame = { x: s * 0.9 * Math.SQRT1_2, z: -s * 0.9 * Math.SQRT1_2, yaw: PI / 4 };
  lbox(f, -0.6, -0.9, 0.6, -0.75, -0.07, 0.03, CHALK);
  lbox(f, -0.6, 0.75, 0.6, 0.9, -0.07, 0.03, CHALK);
}
// Cover on the field: tarp rolls in foul ground, an L-screen in front of the mound, equipment carts.
for (const arm of ARMS) {
  abox(arm, 32, -4.6, 50, -3.6, 0, 1, { material: 'pbr_canvas', tint: '#3a5a8a' });
  aput(arm, 'cart', 56, 0, -5, P);
  aput(arm, 'cone', 30, 0, -3, 0, 1, false);
}
lbox({ x: 7.2, z: 7.2, yaw: PI / 4 }, -1.1, -0.1, 1.1, 0.1, 0, 2, NET);
// Batting-practice screens left out in the outfield: the only cover in the open.
for (const [x, z] of [[42, 18], [18, 42], [54, 44], [44, 54]] as const) lbox({ x, z, yaw: yawOf(-x, -z) }, -1.6, -0.1, 1.6, 0.1, 0, 2.2, NET);
put('bucket', [8.4, 0, 7.6], 0, 1, false);

// The batter's eye: a dark screen straight out past centre field.
const EYE_F: Frame = { x: 63.64, z: 63.64, yaw: (-3 * PI) / 4 };
lbox(EYE_F, -10, -0.6, 10, 0.6, 0, 7, EYE);

// ---------------------------------------------------------------- bullpens behind the outfield wall

for (const arm of ARMS) {
  const [s0, s1, t0, t1] = [78, 94, 6, 22];
  // A low padded wall with fence posts, gates on both sides of the path through.
  for (const [a, b] of segs(t0, t1, [[12, 16]])) {
    abox(arm, s0, a, s0 + 0.3, b, 0, 1.1, PAD);
    abox(arm, s1 - 0.3, a, s1, b, 0, 1.1, PAD);
  }
  abox(arm, s0, t0, s1, t0 + 0.3, 0, 1.1, PAD);
  abox(arm, s0, t1 - 0.3, s1, t1, 0, 1.1, PAD);
  for (let s = s0; s <= s1; s += 4) for (const t of [t0, t1]) abox(arm, s, t, s + 0.3, t + 0.3, 1.1, 2.6, STEEL);
  // Two mounds and their plates, the shelter with the bench.
  for (const t of [8.5, 19.5]) {
    abox(arm, 81, t - 1.5, 84, t + 1.5, 0, 0.25, CLAY);
    abox(arm, 82.3, t - 0.3, 82.5, t + 0.3, 0.25, 0.32, CHALK);
    abox(arm, 91.2, t - 0.25, 91.7, t + 0.25, -0.06, 0.04, CHALK);
  }
  abox(arm, 86, 16.5, 93.5, 18.5, 2.6, 2.8, ROOF);
  for (const s of [86.2, 93.1]) abox(arm, s, 16.6, s + 0.2, 16.8, 0, 2.6, STEEL);
  aput(arm, 'bench', 88, 0, 18, PI, 2.5, false);
  aput(arm, 'bench', 91, 0, 18, PI, 2.5, false);
  aput(arm, 'bucket', 85, 0, 14, 0, 1, false);
  m.light(apt(arm, 86, 4, 14), { fixture: 'bulb', color: '#f4f6ff', intensity: 1.4, range: 16 });
}

// ---------------------------------------------------------------- the scoreboard: three catwalk decks behind the board

const SB: Frame = { x: 73.5, z: 73.5, yaw: (-3 * PI) / 4 };
const SB_DECK = (y: number) => lbox(SB, -15, -4, 15, 2, y - 0.4, y, { material: 'pbr_tread_plate' });
for (const y of [4, 8, 12]) SB_DECK(y);
// Legs under the first deck.
for (const lx of [-14.4, -7.2, 0, 7.2, 14.4]) for (const lz of [-3.4, 1.4]) lbox(SB, lx - 0.3, lz - 0.3, lx + 0.3, lz + 0.3, 0, 3.6, STEEL);
// The board itself, with peek slots at eye height on both catwalks.
const SLOTS: [number, number][] = [[-12, -9], [-6, -3], [3, 6], [9, 12]];
const face = (y0: number, y1: number) => lbox(SB, -15, 2, 15, 2.4, y0, y1, BOARD);
face(3.6, 5.2);
face(6, 9.2);
face(10, 13.1);
for (const [y0, y1] of [[5.2, 6], [9.2, 10]] as const) for (const [a, b] of segs(-15, 15, SLOTS)) lbox(SB, a, 2, b, 2.4, y0, y1, BOARD);
// Its lights: the line score in amber, the video screen in blue, a white trim band.
lbox(SB, -11, 2.4, 11, 2.6, 10.4, 12.7, SCREEN);
for (let i = 0; i < 9; i++) lbox(SB, -10.5 + i * 2.4, 2.4, -9.3 + i * 2.4, 2.6, 6.8, 8.4, AMBER);
lbox(SB, -15, 2.4, 15, 2.6, 4, 4.3, GLOW);
// Rails: deck backs (gaps onto the landings), the ends (gaps at the ladders), the roof parapet.
const rail = (lx0: number, lz0: number, lx1: number, lz1: number, y: number, h = 1) => lbox(SB, lx0, lz0, lx1, lz1, y, y + h, STEEL);
for (const [a, b] of segs(-15, 15, [[-4, -1.4], [12, 15]])) rail(a, -4, b, -3.8, 4);
for (const [a, b] of segs(-15, 15, [[-4, -1.4], [1.4, 4]])) rail(a, -4, b, -3.8, 8);
for (const [a, b] of segs(-15, 15, [[-15, -12]])) rail(a, -4, b, -3.8, 12, 1.1);
for (const y of [4, 8]) {
  for (const [a, b] of segs(-3.8, 2, y === 4 ? [[-1.6, -0.4]] : [])) {
    rail(14.8, a, 15, b, y);
    rail(-15, a, -14.8, b, y);
  }
}
rail(14.8, -3.8, 15, 2, 12, 1.1);
rail(-15, -3.8, -14.8, 2, 12, 1.1);
// Stairs up the back: ground to the first deck, on to the second, on to the roof.
const STEP = { material: 'pbr_tread_plate', tint: '#7a7e84' };
for (let k = 0; k < 16; k++) {
  lbox(SB, -12 + 0.5 * k, -6.6, -11.5 + 0.5 * k, -4, 0, 0.25 * (k + 1), STEP);
  lbox(SB, 11.5 - 0.5 * k, -6.6, 12 - 0.5 * k, -4, 4 + 0.25 * (k + 1) - 0.5, 4 + 0.25 * (k + 1), STEP);
  lbox(SB, -4.5 - 0.5 * k, -6.6, -4 - 0.5 * k, -4, 8 + 0.25 * (k + 1) - 0.5, 8 + 0.25 * (k + 1), STEP);
}
for (const [a, b, y] of [[-4, -1.4, 4], [12, 15, 4], [1.4, 4, 8], [-4, -1.4, 8], [-15, -12, 12]] as const) lbox(SB, a, -6.6, b, -4, y - 0.4, y, { material: 'pbr_tread_plate' });
// Outer rails on the flights and landings.
lbox(SB, -12, -6.8, -1.4, -6.6, 0, 5, STEEL);
lbox(SB, 4, -6.8, 15, -6.6, 4, 9, STEEL);
lbox(SB, -15, -6.8, -1.4, -6.6, 8, 13, STEEL);
// Ladders from the ground to the first deck at both ends.
for (const s of [1, -1]) {
  const [x, z] = fw(SB, s * 15, -1);
  const dir = fw({ x: 0, z: 0, yaw: SB.yaw }, s, 0);
  m.add({ kind: 'ladder', position: [r2(x), 0, r2(z)], yaw: yawOf(dir[0], dir[1]), height: 4, width: 1 });
}
for (const y of [4, 8]) for (const lx of [-8, 0, 8]) {
  const [x, z] = fw(SB, lx, -1);
  m.light([r2(x), y + 3.4, r2(z)], { fixture: 'strip', color: '#ffe6b8', intensity: 1, range: 9 });
}
{
  const [x, z] = fw(SB, 0, 6);
  m.light([r2(x), 11.5, r2(z)], { fixture: 'none', color: '#9ab8ff', intensity: 1.5, range: 18 });
}
const sb = (lx: number, y: number, lz: number): V3 => {
  const [x, z] = fw(SB, lx, lz);
  return [r2(x), y, r2(z)];
};
put('speaker', sb(-10, 12, 1.4), SB.yaw);
put('speaker', sb(10, 12, 1.4), SB.yaw);
put('crate_large', sb(4, 12, -2.8), SB.yaw + P);
put('screen_panel', sb(-9, 4, -2.8), SB.yaw + PI);
put('metal_crate', sb(9, 8, -2.8), SB.yaw);

// ---------------------------------------------------------------- light towers (a sniper platform halfway up)

const FIELD_C: [number, number] = [30, 30];
/** A lattice tower at (x, z): ladder on the `ladder` side (away from the field), platform at 16 m, a mast to the lamps at 22–25 m. */
const TOWER_H = 16;
const TW = 3.2; // half-width of the platform
function tower(x: number, z: number, ladder: Side): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(x + sx * 1.05 - 0.15, 0, z + sz * 1.05 - 0.15, x + sx * 1.05 + 0.15, TOWER_H - 0.3, z + sz * 1.05 + 0.15, STEEL);
  for (const y of [5, 10]) {
    box(x - 1.2, y, z - 1.2, x + 1.2, y + 0.2, z - 0.9, STEEL);
    box(x - 1.2, y, z + 0.9, x + 1.2, y + 0.2, z + 1.2, STEEL);
    box(x - 1.2, y, z - 0.9, x - 0.9, y + 0.2, z + 0.9, STEEL);
    box(x + 0.9, y, z - 0.9, x + 1.2, y + 0.2, z + 0.9, STEEL);
  }
  const H = TOWER_H;
  box(x - TW, H - 0.3, z - TW, x + TW, H, z + TW, { material: 'grate' });
  // Railings, open over the ladder.
  const along = (side: Side, a: number, b: number) => {
    if (side === 'N') box(x + a, H, z + TW - 0.2, x + b, H + 1.1, z + TW, STEEL);
    if (side === 'S') box(x + a, H, z - TW, x + b, H + 1.1, z - TW + 0.2, STEEL);
    if (side === 'E') box(x + TW - 0.2, H, z + a, x + TW, H + 1.1, z + b, STEEL);
    if (side === 'W') box(x - TW, H, z + a, x - TW + 0.2, H + 1.1, z + b, STEEL);
  };
  for (const side of ['N', 'E', 'S', 'W'] as const) for (const [a, b] of segs(-TW, TW, side === ladder ? [[-1, 1]] : [])) along(side, a, b);
  // The ladder up its spine.
  const [fx, fz] = DIRS[ladder];
  const sx0 = fx ? x + fx * (TW - 0.3) : x - 0.6;
  const sx1 = fx ? x + fx * TW : x + 0.6;
  const sz0 = fz ? z + fz * (TW - 0.3) : z - 0.6;
  const sz1 = fz ? z + fz * TW : z + 0.6;
  box(Math.min(sx0, sx1), 0, Math.min(sz0, sz1), Math.max(sx0, sx1), H - 0.3, Math.max(sz0, sz1), STEEL);
  m.add({ kind: 'ladder', position: [r2(x + fx * TW), 0, r2(z + fz * TW)], yaw: yawOf(fx, fz), height: H, width: 0.9 });
  // The mast and the lamp bank, turned to the field.
  box(x - 0.3, H, z - 0.3, x + 0.3, 22, z + 0.3, STEEL);
  const yaw = Math.atan2(FIELD_C[0] - x, FIELD_C[1] - z);
  const f: Frame = { x, z, yaw };
  lbox(f, -3.2, -0.5, 3.2, 0.3, 22, 25.4, STEEL);
  lbox(f, -3, 0.3, 3, 0.5, 22.2, 25.2, GLOW);
  for (const lx of [-2, 0, 2]) {
    const [lx_, lz_] = fw(f, lx, 2);
    m.light([r2(lx_), 23.6, r2(lz_)], { fixture: 'none', color: '#f4f6ff', intensity: 4, range: 30 });
  }
  m.light([r2(x), H + 2.6, r2(z)], { fixture: 'bulb', color: '#ffe6b8', intensity: 0.8, range: 6 });
}
/** Where a tower's pickup sits: on the platform, between the mast and the field. */
const towerSpot = (x: number, z: number): V3 => {
  const d = Math.hypot(FIELD_C[0] - x, FIELD_C[1] - z);
  return [r2(x + ((FIELD_C[0] - x) / d) * 1.8), TOWER_H, r2(z + ((FIELD_C[1] - z) / d) * 1.8)];
};
const TOWERS: [number, number, Side][] = [
  [12, -50, 'S'],
  [44, -50, 'S'],
  [-50, 12, 'W'],
  [-50, 44, 'W'],
  [92, 40, 'E'],
  [40, 92, 'N'],
];
for (const [x, z, side] of TOWERS) tower(x, z, side);
// Floodlight wash over the field.
for (const x of [8, 32, 56]) for (const z of [8, 32, 56]) if (Math.hypot(x, z) < rWall(Math.atan2(z, x)) - 4) m.light([x, 15, z], { fixture: 'none', color: '#eef2ff', intensity: 2.2, range: 30 });

// ---------------------------------------------------------------- outside: plaza, gates, stalls, parking, dock, shed

for (const arm of ARMS) {
  // Ticket gates: booths with turnstile posts between them, across the plaza in front of the concourse gates.
  for (const s of [-8, 24, 48]) {
    abox(arm, s - 1.2, -58.2, s + 1.2, -55.8, 0, 2.6, WHITE_PANEL);
    abox(arm, s - 1.6, -58.6, s + 1.6, -55.4, 2.6, 2.9, ROOF);
    for (const d of [-4, -3, 3, 4]) abox(arm, s + d - 0.15, -57.15, s + d + 0.15, -56.85, 0, 1, STEEL);
    m.light(apt(arm, s, 3.4, -55), { fixture: 'bulb', color: '#ffe6b8', intensity: 1, range: 9 });
  }
  // Food stalls and tables along the plaza.
  for (const [s, model] of [[4, 'stall'], [34, 'stall_green'], [56, 'stall']] as const) aput(arm, model, s, 0, -62, 0);
  for (const s of [10, 40]) {
    aput(arm, 'table_round', s, 0, -63);
    aput(arm, 'parasol', s, 0, -63, 0, 1, false);
  }
  for (const s of [0, 20, 36, 56]) aput(arm, 'lightpost_double', s, 0, -52.5, 0);
  for (const s of [-40, -24, 28, 52]) aput(arm, 'nt_common_tree', s, 0, -64.5, 0, 0.8);
  for (const s of [-40, -24, 28, 52]) m.light(apt(arm, s, 3, -52.5), { fixture: 'none', color: '#ffe0b0', intensity: 1, range: 12 });
  aput(arm, 'sv_trashcan_metal', 14, 0, -52.6);
  aput(arm, 'sv_trashcan_metal', 44, 0, -52.6);
  aput(arm, 'barrier', -2, 0, -50, P);
  aput(arm, 'barrier', 30, 0, -50, P);
}
// The parking lot: asphalt, bay lines, parked cars.
box(-88, -0.05, -88, 56, 0.05, -68, ASPHALT);
box(-88, -0.05, -68, -68, 0.05, 56, ASPHALT);
for (let s = -60; s <= 52; s += 4) {
  box(s - 0.1, 0.05, -86, s + 0.1, 0.06, -81, CHALK);
  box(s - 0.1, 0.05, -75, s + 0.1, 0.06, -70, CHALK);
}
for (let s = -60; s <= 52; s += 4) {
  box(-86, 0.05, s - 0.1, -81, 0.06, s + 0.1, CHALK);
  box(-75, 0.05, s - 0.1, -70, 0.06, s + 0.1, CHALK);
}
const CAR_TINTS = ['#b8312f', '#2c5aa0', '#e8e6e0', '#2a2c30', '#3f7f4a', '#c9a227', '#8a8f96'];
let carN = 0;
/** A parked car (body, cabin, wheels) at (x, z) facing `yaw`. */
function car(x: number, z: number, yaw: number): void {
  const f: Frame = { x, z, yaw };
  const paint = { material: 'paint_gloss', tint: CAR_TINTS[carN++ % CAR_TINTS.length]! };
  lbox(f, -0.95, -2.2, 0.95, 2.2, 0.4, 1.1, paint);
  lbox(f, -0.85, -1.2, 0.85, 0.9, 1.1, 1.7, { material: 'pbr_glass_facade', tint: '#5a6a7a' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lbox(f, sx * 0.95 - 0.13, sz * 1.4 - 0.35, sx * 0.95 + 0.13, sz * 1.4 + 0.35, 0.05, 0.65, { material: 'paint_matte', tint: '#1a1a1a' });
}
for (const [s, row] of [[-58, 0], [-46, 1], [-30, 0], [-18, 1], [-6, 0], [6, 1], [26, 0], [38, 1], [50, 0]] as const) {
  car(s, row ? -72.5 : -83.5, row ? 0 : PI);
  car(row ? -72.5 : -83.5, s, row ? P : -P);
}
m.mount('buggy', [-40, 0.05, -78], P);
m.mount('kart', [-78, 0.05, 30], 0);
for (const [x, z] of [[-64, -64], [-80, -66], [-66, -80], [16, -66], [-66, 16]] as const) put('nt_common_tree', [x, 0, z], 0, 0.9);

// The loading dock (first-base end): a semi-trailer backed up to the concourse, pallets and crates.
const TRAILER = { material: 'pbr_corrugated', tint: '#c9ccd0' };
box(64, 1.2, -42.5, 76, 4.2, -39.5, TRAILER);
for (const x of [66, 74]) box(x - 0.7, 0, -42.3, x + 0.7, 1.2, -39.7, { material: 'paint_matte', tint: '#1e1e1e' });
box(76.2, 0, -42.4, 79.6, 3.2, -39.6, { material: 'paint_gloss', tint: '#a8322a' });
box(79.6, 0, -42.2, 81, 1.6, -39.8, { material: 'paint_gloss', tint: '#a8322a' });
put('cargo_crate', [65, 0, -24], 0.2);
put('cargo_crate', [66, 0, -29], 1.3);
put('crate_large', [68, 0, -48], 0);
put('container', [71, 0, -47.5], 0.4);
put('barrel', [62.5, 0, -48]);
put('barrel', [63.4, 0, -48.6]);
m.mount('hauler', [86, 0, -30], 0);
m.light([66, 4.5, -36], { fixture: 'none', color: '#f4f6ff', intensity: 1.4, range: 16 });

// The groundskeeper's shed (third-base end): tools, fuel, the cart outside.
put('workbench', [-48, 0, 75.2], PI);
put('barrel', [-51.2, 0, 75.2]);
put('barrel', [-51.2, 0, 74.2]);
put('sv_gas_can', [-50.2, 0, 75.4], 0);
put('sv_shovel', [-46.2, 0, 75.5], 0, 1, false);
put('shelf_boxes', [-50.9, 0, 70.5], P);
put('cart', [-36, 0, 74], 0);
m.mount('buggy', [-38, 0, 66], P);
put('crate_large', [-40, 0, 80], 0.3);
put('cardboard_box', [-41.5, 0, 81.5], 0.6);
m.light([-40, 4.5, 70], { fixture: 'none', color: '#f4f6ff', intensity: 1.2, range: 14 });

// The outfield lawn: picnic tables and trees behind the wall.
for (const [x, z] of [[84, 52], [52, 84], [66, 92], [92, 66]] as const) {
  put('table', [x, 0, z], yawOf(-x, -z));
  put('parasol', [x, 0, z], 0, 1, false);
}
for (const [x, z] of [[96, 24], [24, 96], [97, 80], [80, 97], [86, -4], [-4, 86]] as const) put('nt_common_tree', [x, 0, z], 0, 0.9);
for (const [x, z] of [[80, 60], [60, 80], [96, 8], [8, 96]] as const) put('nt_bush_leafy', [x, 0, z], 0, 1.2, false);

// ---------------------------------------------------------------- inside: furnishing

const IN = 3.75; // a room's inside half-width
for (const arm of ARMS) {
  const c = (cs: number) => cs * 8;
  const T = -32; // inner row centre
  // Concessions: cooking line along the back, serving counter by the door.
  for (const cs of [-3, -2, 6]) {
    aput(arm, 'stove', c(cs) - 2.6, 0, T + IN - 0.55, PI);
    aput(arm, 'hm_kitchen_counter_long', c(cs) - 1.4, 0, T + IN - 0.4, PI);
    aput(arm, 'hm_kitchen_counter_long', c(cs) - 0.8, 0, T + IN - 0.4, PI);
    aput(arm, 'fridge', c(cs) + 2.8, 0, T + IN - 0.5, PI);
    aput(arm, 'freezer', c(cs) - IN + 0.95, 0, T - 1, P);
    aput(arm, 'checkout', c(cs) + 2.4, 0, T - 1.8, 0);
    aput(arm, 'crate_bottles', c(cs) + IN - 0.5, 0, T + 0.6, 0);
  }
  // Restrooms.
  for (const cs of [0, 7]) {
    for (const ds of [-3, -2, -1, 1, 2, 3]) aput(arm, 'hm_toilet', c(cs) + ds, 0, T + IN - 0.4, PI);
    for (const dt of [-1.6, 0]) aput(arm, 'hm_bathroom_sink', c(cs) - IN + 0.3, 0, T + dt, P);
  }
  // Vomitories: bins either side of the walk-through.
  for (const cs of [-1, 5]) {
    aput(arm, 'sv_trashcan_metal', c(cs) - 3, 0, T - 3, 0);
    aput(arm, 'potted_plant', c(cs) + 3.2, 0, T + 3.2, 0);
  }
  // Clubhouse lounge (trainer's table, sofa, TV), tunnel room (trophy cases), lockers.
  aput(arm, 'sofa', c(1) - IN + 0.45, 0, T + 0.5, P);
  aput(arm, 'tv_cabinet', c(1) - 0.5, 0, T + IN - 0.3, PI);
  aput(arm, 'tv', c(1) - 0.5, 0.6, T + IN - 0.3, PI);
  aput(arm, 'hm_fridge', c(1) - IN + 0.45, 0, T + IN - 0.45, P);
  for (const ds of [-2.8, 2.8]) aput(arm, 'bookcase', c(2) + ds, 0, T - IN + 0.3, 0);
  for (const ds of [-3, 3]) aput(arm, 'bookcase', c(2) + ds, 0, T + IN - 0.35, PI);
  for (const ds of [-3, -1.4, 1.4, 3]) {
    aput(arm, 'shelf_end', c(3) + ds, 0, T + IN - 0.4, PI);
    aput(arm, 'shelf_end', c(3) + ds, 0, T - IN + 0.4, 0);
  }
  // The batting cage: pitching machine, ball buckets, the net's frame.
  aput(arm, 'machine', c(4) + 2.2, 0, T + 2.2, -P);
  for (const ds of [-3, -2.4]) aput(arm, 'bucket', c(4) + ds, 0, T + 3.2, 0, 1, false);
  for (const ds of [-2.2, 2.2]) abox(arm, c(4) - IN, T + ds - 0.1, c(4) + IN - 3.4, T + ds + 0.1, 2.9, 3.05, NET);
  // The concourse: bins and planters against the walls.
  for (let cs = -3; cs <= 7; cs += 2) {
    aput(arm, 'trashcan', c(cs) + 3.2, 0, -40 + IN - 0.3, 0);
    aput(arm, 'potted_plant', c(cs) - 3.2, 0, -40 - IN + 0.35, 0);
  }
}
// The hub: a round of counters and benches.
put('display_table', [-40, 0, -40], PI / 4);
put('potted_plant', [-43, 0, -43]);
put('potted_plant', [-30, 0, -43]);
put('potted_plant', [-43, 0, -30]);
// The club building.
put('desk', [-50, 0, -50], P);
put('office_chair', [-51.2, 0, -50], P);
put('potted_plant', [-44.6, 0, -51.4]);
for (const [x, z] of [[-42.6, -50.9], [-37.4, -50.9], [-50.9, -42.6], [-50.9, -37.4]] as const) put('shelf_boxes', [x, 0, z], x > -50 ? 0 : P);
put('checkout', [-37, 0, -48.5], 0);
put('checkout', [-48.5, 0, -37], P);
for (const [x, z, yaw] of [[-34.8, -50.6, 0], [-29.2, -50.6, 0], [-50.6, -34.8, P], [-50.6, -29.2, P]] as const) {
  put('desk', [x, 0, z], yaw);
  put('office_chair', [x + (yaw ? 0.9 : 0), 0, z + (yaw ? 0 : 0.9)], yaw + PI);
}
put('bookcase', [-51.4, 0, -21.5], P);
// Club level: dining tables.
for (const [x, z] of [[-48, -48], [-40, -48.5], [-32, -48.5], [-48.5, -40], [-48.5, -32]] as const) {
  put('table_round', [x, 4, z]);
  for (const [dx, dz] of [[1.3, 0], [-1.3, 0]] as const) put('chair', [x + dx, 4, z + dz], dx > 0 ? -P : P);
}
// Suites: sofas facing the windows, a bar along the back.
for (const [x, z, yaw] of [[-40, -46.2, 0], [-32, -46.2, 0], [-24, -46.2, 0], [-46.2, -40, P], [-46.2, -32, P]] as const) {
  put('sofa', [x - (yaw ? 0 : 1.6), 8, z - (yaw ? 1.6 : 0)], yaw);
  put('armchair', [x + (yaw ? 0 : 1.8), 8, z + (yaw ? 1.8 : 0)], yaw);
}
for (const [x, z, yaw] of [[-40, -51.3, 0], [-24, -51.3, 0], [-51.3, -40, P]] as const) put('hm_fridge', [x + (yaw ? 0 : 2.6), 8, z + (yaw ? 2.6 : 0)], yaw);
for (const x of [-25.4, -24.6, -23.8]) put('bar_stool', [x, 8, -50.4], 0, 1, false);
// The press box: desks along the windows, screens, the PA.
for (const x of [-42.6, -39.4, -34.6, -31.4]) {
  put('desk', [x, 12, -44.9], PI);
  put('office_chair', [x, 12, -46.1], 0);
}
put('computer', [-28.8, 12, -49], -P);
put('screen_panel', [-36, 12, -51.1], 0);
put('speaker', [-43.4, 12, -51.4]);
put('speaker', [-28.6, 12, -51.4]);

// ---------------------------------------------------------------- lights

for (const [k, c] of cells) {
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  if (c.kind === 'stairwell') {
    m.light([x * 8, z * 4 + 3.4, y * 8], { fixture: 'bulb', color: '#fff1d6', intensity: 0.7, range: 8 });
    continue;
  }
  const kitchen = z === 0 && ((x >= -3 && y === -4) || (y >= -3 && x === -4));
  m.light([x * 8, z * 4 + 3.45, y * 8], { fixture: 'ceiling', color: kitchen ? '#fff6e8' : '#fff1d6', intensity: 0.9, range: 9 });
}

// ---------------------------------------------------------------- spawns, weapons and objectives

const SPAWNS: { arm: Arm; team: string }[] = [
  { arm: 'S', team: AWAY },
  { arm: 'W', team: HOME },
];
for (const { arm, team } of SPAWNS) {
  // Dugout, tunnel, clubhouse, batting cage, the concourse by the clubhouse door.
  for (const s of [11, 16, 21]) m.spawn(apt(arm, s, DUG, -10), ayaw(arm, 0), team);
  m.spawn(apt(arm, 16, 0, -21), ayaw(arm, 0), team);
  for (const cs of [1, 2, 3]) {
    m.spawn(apt(arm, cs * 8 - 1.8, 0, -33.6), ayaw(arm, 0), team);
    m.spawn(apt(arm, cs * 8 + 1.8, 0, -30.6), ayaw(arm, 0), team);
  }
  m.spawn(apt(arm, 30, 0, -32), ayaw(arm, -P), team);
  m.spawn(apt(arm, 12, 0, -40), ayaw(arm, 0), team);
}
// Free-for-all: the field, both bowls, the concourse, the hub, the plaza, the lot, the outfield lawn, the suites.
for (const [x, z] of [[50, 20], [20, 50], [45, 45], [32, 8], [8, 32], [60, 38], [38, 60]] as const) m.spawn([x, 0, z], yawOf(-x, -z));
for (const arm of ARMS) {
  for (const [s, d] of [[4, 6.4], [28, 10.4], [52, 3.4]] as const) m.spawn(apt(arm, s, rowAt(d).top, FRONT - d), ayaw(arm, 0));
  for (const [s, d] of [[8, 25.1], [48, 21.6]] as const) m.spawn(apt(arm, s, rowAt(d).top, FRONT - d), ayaw(arm, 0));
  m.spawn(apt(arm, 0, 0, -40), ayaw(arm, P));
  m.spawn(apt(arm, 48, 0, -40), ayaw(arm, -P));
  m.spawn(apt(arm, 20, 0, -60), ayaw(arm, 0));
  m.spawn(apt(arm, -20, 0.05, -77), ayaw(arm, 0));
}
m.spawn([-36, 0, -36], PI / 4);
m.spawn([80, 0, 50], yawOf(-80, -50));
m.spawn([50, 0, 80], yawOf(-50, -80));
m.spawn([-32, 8, -49], 0);
m.spawn([-49, 8, -40], P);

// Weapons: snipers up high, shotguns below, rockets on the scoreboard, armour in the clubhouses.
m.pickup('weapon_sniper', [-36, 12, -47]).pickup('ammo_sniper', [-41, 12, -50]);
m.pickup('weapon_sniper', towerSpot(44, -50)).pickup('weapon_sniper', towerSpot(-50, 44));
m.pickup('weapon_marksman', towerSpot(92, 40)).pickup('weapon_marksman', towerSpot(40, 92));
m.pickup('ammo_sniper', towerSpot(12, -50)).pickup('ammo_sniper', towerSpot(-50, 12));
m.pickup('weapon_rockets', sb(4, 12, 0)).pickup('ammo_explosive', sb(-6, 12, 0));
m.pickup('armor_small', sb(-8, 4, -1)).pickup('health_small', sb(8, 8, -1));
m.pickup('weapon_auto_shotgun', [-38, 0, -34]);
m.pickup('weapon_lmg', [-48, 8, -33]);
m.pickup('weapon_burst_rifle', [-38.1, rowAt(26.1).top, -38.1]);
m.pickup('powerup_damage', [10, 0.3, 11.2], 90);
m.pickup('grenades', [21, 0.1, 23]);
for (const arm of ARMS) {
  m.pickup('weapon_shotgun', apt(arm, 20, 0, -40));
  m.pickup('weapon_sawed_off', apt(arm, 40, 0, -18));
  m.pickup('weapon_sawed_off', apt(arm, -8, 0, -18));
  m.pickup('weapon_smg', apt(arm, 13.5, DUG, -10.6));
  m.pickup('armor_large', apt(arm, 9.6, 0, -33.6));
  m.pickup('armor_small', apt(arm, 17.4, DUG, -10.6));
  m.pickup('weapon_rifle', apt(arm, 86, 0, 14));
  m.pickup('health_small', apt(arm, 90, 0, 9));
  m.pickup('health_large', apt(arm, 0, 0, -30));
  m.pickup('health_large', apt(arm, 56, 0, -30.5));
  m.pickup('health_small', apt(arm, -22.5, 0, -33));
  m.pickup('health_small', apt(arm, 46, 0, -33));
  m.pickup('ammo', apt(arm, 32, 0, -40));
  m.pickup('ammo', apt(arm, -16, 0, -40));
  m.pickup('ammo_shells', apt(arm, 4, 0, -40));
  m.pickup('ammo_rifle', apt(arm, 36, rowAt(8.4).top, FRONT - 8.4));
  m.pickup('ammo_rifle', apt(arm, 24, rowAt(27.1).top, FRONT - 27.1));
  m.pickup('grenades', apt(arm, 66, 0, -6));
  m.pickup('health_small', apt(arm, 0, 0, -63));
  m.pickup('armor_small', apt(arm, 60, 0, 30));
}

// Capture the Flag: each team's flag in its own clubhouse locker room.
m.flag(AWAY, apt('S', 24, 0, -32), ayaw('S', 0));
m.flag(HOME, apt('W', 24, 0, -32), ayaw('W', 0));
// King of the Hill: the mound, the press box, the scoreboard roof.
m.hill([10, 0.45, 10], 5).hill([-36, 12, -48], 4).hill(sb(0, 12, -1), 5);
// Bomb: the press box and the scoreboard.
m.add({ kind: 'bombsite', position: [-36, 12, -48], label: 'A', radius: 4 });
m.add({ kind: 'bombsite', position: sb(0, 12, -1.5), label: 'B', radius: 4 });

m.bounds('invisible', 0, { min: [-88, -88], max: [100, 100] }, 40);

// ---------------------------------------------------------------- the ground

const sm = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Rectangles (world, inclusive of their edge vertices) cut down to the dugout floor. */
const CUTS: [number, number, number, number][] = [];
for (const arm of ARMS) {
  const add = (s0: number, t0: number, s1: number, t1: number) => {
    const [ax, az] = AW(arm, s0, t0);
    const [bx, bz] = AW(arm, s1, t1);
    CUTS.push([Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)]);
  };
  add(8, -12, 24, -8);
  add(14, -14, 18, -12);
}
const inside = (x: number, z: number) => x >= -88 && x <= 100 && z >= -88 && z <= 100;
const outside = (x: number, z: number) => Math.hypot(Math.max(-88 - x, 0, x - 100), Math.max(-88 - z, 0, z - 100));
/** Inside the field enclosure (fair and foul ground, up to the stands and the wall). */
const inField = (x: number, z: number) => x > -12 && z > -12 && (x < 0 || z < 0 ? x < 72 && z < 72 : Math.hypot(x, z) < rWall(Math.atan2(z, x)));

const T0 = -120;
const COLS = 121;
const low = new Map<string, number>();
for (const k of buildOccupancy(m.doc).cells.keys()) {
  const [gx, gy, gz] = k.split(',').map(Number) as [number, number, number];
  const col = `${gx},${gy}`;
  low.set(col, Math.min(low.get(col) ?? Infinity, gz));
}
const heights: number[] = [];
for (let r = 0; r < COLS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x = T0 + c * 2;
    const z = T0 + r * 2;
    // Under the buildings: sunk out of the way of their floors.
    let under = Infinity;
    let edge = false;
    for (const gx of new Set([Math.floor((x + 4) / 8), Math.ceil((x - 4) / 8)]))
      for (const gy of new Set([Math.floor((z + 4) / 8), Math.ceil((z - 4) / 8)])) {
        const lz = low.get(`${gx},${gy}`);
        if (lz !== undefined && lz <= 0) under = Math.min(under, lz * 4 - 3.6);
        else edge = true;
      }
    if (edge && under === -3.6) under = 0;
    let h = under < Infinity ? under : 0;
    if (under === Infinity) {
      if (CUTS.some(([ax, az, bx, bz]) => x >= ax && x <= bx && z >= az && z <= bz)) h = DUG;
      // The pitcher's mound.
      const dm = Math.hypot(x - 10, z - 10);
      if (dm < 3.2) h = 0.45 * sm(3.2, 0.6, dm);
      // Berms beyond the boundary, round the city.
      if (!inside(x, z)) h = sm(0, 24, outside(x, z)) * 7;
    }
    heights.push(Math.round(h * 100));
  }
}
const ground: TerrainData = { origin: [T0, T0], spacing: 2, cols: COLS, rows: COLS, baseY: 0, heights, materials: [], boundary: true, foliage: [] };
const materials: number[] = [];
const foliage: number[] = [];
for (let r = 0; r < COLS - 1; r++) {
  for (let c = 0; c < COLS - 1; c++) {
    const x = T0 + c * 2 + 1;
    const z = T0 + r * 2 + 1;
    let g: TerrainMaterial = 'grass';
    let f = 0;
    const dm = Math.hypot(x - 10, z - 10);
    if (inField(x, z)) {
      const th = Math.atan2(z, x);
      const rr = Math.hypot(x, z);
      if (x > 0 && z > 0 && rr > rWall(th) - 4.5) g = 'dirt'; // warning track
      else if (dm < 21.5 && x > -2 && z > -2 && !(x > 3 && z > 3 && x < 18 && z < 18 && dm > 2.8)) g = 'dirt';
      else if (Math.hypot(x, z) < 4.5) g = 'dirt';
    } else if (!inside(x, z)) {
      g = 'grass';
      f = 3;
    } else {
      const bull = ARMS.some((arm) => {
        const [s, t] = arm === 'S' ? [x, z] : [z, x];
        return s > 78 && s < 94 && t > 6 && t < 22;
      });
      const plaza = (z < -44 && z > -66 && x > -66) || (x < -44 && x > -66 && z > -66);
      const lot = z < -66 || x < -66;
      const yard = (x > 60 && z < -12) || (z > 60 && x < -12);
      if (bull) g = 'dirt';
      else if (plaza) g = 'stone';
      else if (lot) g = 'gravel';
      else if (yard) g = 'gravel';
      else f = Math.hypot(x, z) > 90 ? 2 : 1;
    }
    materials.push(TERRAIN_MATERIALS.indexOf(g));
    foliage.push(f);
  }
}
m.terrain({ ...ground, materials, foliage });

m.backdrop('night', 'city', 'grass', 0.35);
// A downtown ballpark: city blocks round it, windows lit for the night game.
m.border('skyline');
m.meta({
  description:
    "An evening ballgame under the light towers. Fight across the diamond and its raised mound, down into the sunken dugouts and through the player tunnels to the clubhouses; up the tiers of the lower bowl and the upper deck; along the concourse past the concession stands, restrooms and batting cage to the hub behind home plate; and up the club building to the suites and the press box, the sniper's seat. Out past the padded wall are the bullpens, the batter's eye and the scoreboard, three catwalk decks with peek slots in the board and rockets on its roof. Outside: the plaza and ticket gates, climbable light towers with sniper platforms, the parking lot, the loading dock and the groundskeeper's shed. Home hold the third-base side, the Visitors the first; each flag waits in its team's locker room.",
  modes: ['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth', 'core.elim', 'core.bomb'],
  players: [12, 24],
});
await m.save();
