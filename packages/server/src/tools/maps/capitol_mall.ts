/**
 * Capitol Mall: a scaled-down look-alike of the National Mall in Washington,
 * for 16–32 players. The real Mall runs about 3 km from the Capitol to the
 * Lincoln Memorial; here it is 300 m, with the landmarks kept in their order
 * and roughly their proportions: the Washington Monument about a third of
 * the way from the memorial, the Reflecting Pool nearly joining the two, the
 * natural-history museum on the north side and the air-and-space museum on
 * the south side between the monument and the Capitol (layout from the
 * National Park Service's Mall map and descriptions; no images used).
 *
 *   - The Capitol (east end): a domed block of white marble. The rotunda
 *     (a colonnaded hall under a drum, a peristyle and a stepped dome) is
 *     ringed on the upper floor by galleries whose windows look down into it;
 *     the Senate chamber north and the House chamber south (rows of desks
 *     facing the front), corridors, offices, a columned portico and pediment
 *     on the west front facing the Mall, and stairs to the roof.
 *   - The Monument: a 44 m obelisk (stone shell tapering in three steps,
 *     pyramidion on top) with switchback stairs inside, nine storeys up to an
 *     observation deck with windows on all four sides (the sniper's nest),
 *     on a round stone plaza ringed with flags.
 *   - The Reflecting Pool: a long shallow pool (wade it) lined with cherry
 *     trees in blossom.
 *   - The Memorial (west end): a temple on a stepped plinth ringed by 36
 *     columns under an attic, three chambers inside, the big seated marble
 *     statue in the middle one.
 *   - The natural-history museum (north): a domed rotunda with a mammoth
 *     skeleton on a plinth, a mammal hall and a fossil hall (a big theropod)
 *     lined with display cases, the gem gallery, and galleries upstairs with
 *     balconies over the rotunda.
 *   - The air-and-space museum (south): a 40 × 32 m hall, 8 m high, with a
 *     glass front open onto the Mall, a mezzanine, rockets stacked up in the
 *     corners and flyers parked as exhibits (take them out: they fly), the
 *     museum shop and food court in the wings, and a tall rocket outside.
 *   - The lawn: gravel walks under four rows of elms, the avenues along the
 *     sides, street lamps, benches and food trucks.
 *
 * Teams: the Capitol team holds the east end, the Memorial team the west.
 * CTF flags in the Capitol's west lobby and before the statue. KOTH moves
 * between the obelisk deck, the museum rotunda, the air-and-space hall and the
 * Capitol rotunda. No race track: a start grid holds at most 16 cars, fewer
 * than this map's 32 players.
 *
 * Grid x east (toward the Capitol), y north (one cell = 8 m, world z = y × 8).
 */
import { TERRAIN_MATERIALS, type EdgeStyle, type RoomOptions, type RoomType, type Rotation, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('capitol_mall', 'Capitol Mall');
m.theme('temple');
m.backdrop('clear', 'city', 'grass', 0.35);
m.border('skyline');
m.teams([16, 16]);
const [CAPITOL, MEMORIAL] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Mat = { material: string; tint?: string };
const P = Math.PI / 2;
const PI = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];

// ---------------------------------------------------------------- looks

const MARBLE: Mat = { material: 'marble', tint: '#f1eee6' };
const MARBLE_W: Mat = { material: 'marble', tint: '#fbfaf6' };
const STONE: Mat = { material: 'pbr_travertine', tint: '#e8e2d4' };
const PINK: Mat = { material: 'pbr_travertine', tint: '#e2cbbd' }; // the air-and-space museum's pink marble
const GRANITE: Mat = { material: 'pbr_concrete', tint: '#b8b4ac' };
const DOME: Mat = { material: 'paint_matte', tint: '#f4f2ec' };
const COPPER: Mat = { material: 'paint_matte', tint: '#8fae9e' };
const BRASS: Mat = { material: 'brass' };
const BONE: Mat = { material: 'paint_matte', tint: '#e6dcc2' };
const FOSSIL: Mat = { material: 'paint_matte', tint: '#8a7258' };
const GLASS: Mat = { material: 'pbr_glass_facade', tint: '#9ab8c8' };
const ASPHALT: Mat = { material: 'pbr_asphalt' };
const LINE: Mat = { material: 'paint_matte', tint: '#f0f0e8' };
const WATER_RIM: Mat = { material: 'pbr_travertine', tint: '#d4cfc4' };
const ROCKET_W: Mat = { material: 'paint_gloss', tint: '#f2f2f0' };
const ROCKET_K: Mat = { material: 'paint_gloss', tint: '#1e1f22' };

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const HALL: TileSurfaces = { floor: mat('pbr_checker', '#e8e2d6'), walls: mat('marble', '#f1eee6'), solids: mat('marble', '#e4dfd2'), underside: mat('pbr_plaster_white', '#f4f0e6'), trim: mat('brass') };
const SENATE: TileSurfaces = { ...HALL, floor: mat('pbr_carpet', '#2c3f78'), walls: mat('pbr_walnut', '#a07850') };
const HOUSE: TileSurfaces = { ...HALL, floor: mat('pbr_carpet', '#3a5a3a'), walls: mat('pbr_walnut', '#a07850') };
const OFFICE: TileSurfaces = { ...HALL, floor: mat('pbr_carpet', '#6a2a2a'), walls: mat('pbr_plaster_white', '#efe6d4') };
const MUSEUM: TileSurfaces = { floor: mat('pbr_terrazzo', '#d8d0c0'), walls: mat('pbr_travertine', '#e8e2d4'), solids: mat('marble', '#e4dfd2'), underside: mat('pbr_plaster_white'), trim: mat('stone_trim') };
const GALLERY: TileSurfaces = { ...MUSEUM, floor: mat('pbr_floorboards', '#b08a60') };
const GEMS: TileSurfaces = { ...MUSEUM, floor: mat('pbr_carpet', '#20243a'), walls: mat('pbr_marble_black') };
const AIR: TileSurfaces = { floor: mat('pbr_terrazzo', '#cfd2d4'), walls: mat('pbr_travertine', '#e2cbbd'), solids: mat('pbr_steel'), underside: mat('pbr_white_panel'), trim: mat('pbr_steel') };
const STAIR: TileSurfaces = { floor: mat('pbr_terrazzo', '#d8d0c0'), walls: mat('marble', '#f1eee6'), solids: mat('marble', '#e4dfd2'), trim: mat('brass') };
const MEZZ: TileSurfaces = { floor: mat('pbr_walkway'), trim: mat('pbr_steel', '#3a3e44') };

// ---------------------------------------------------------------- free blocks

let nBlocks = 0;
/** A solid box from min to max corner (split into pieces no bigger than blocks allow). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mt: Mat, yaw = 0): void {
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
        for (let k = 0; k < ny; k++) box(x0 + (w * i) / nx, y0 + (h * k) / ny, z0 + (d * j) / nz, x0 + (w * (i + 1)) / nx, y0 + (h * (k + 1)) / ny, z0 + (d * (j + 1)) / nz, mt, yaw);
    return;
  }
  nBlocks++;
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(w), r2(h), r2(d)], 'solid', { ...mt, yaw: r2(yaw) });
}
/** A block centred at (cx, cz), `w` along its yaw and `d` across. */
function turned(cx: number, cz: number, w: number, d: number, y0: number, y1: number, mt: Mat, yaw: number): void {
  nBlocks++;
  m.block([r2(cx), r2(y0), r2(cz)], [r2(w), r2(y1 - y0), r2(d)], 'solid', { ...mt, yaw: r2(yaw) });
}
/** A ring of `n` turned blocks round (cx, cz): radius `r` to the middle of the wall, `thick` deep. */
function ring(cx: number, cz: number, r: number, y0: number, y1: number, thick: number, n: number, mt: Mat): void {
  const w = ((2 * PI * (r + thick / 2)) / n) * 1.04;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) * 2 * PI) / n;
    turned(cx + r * Math.cos(a), cz + r * Math.sin(a), w, thick, y0, y1, mt, Math.atan2(-Math.cos(a), -Math.sin(a)));
  }
}
/** A round slab (a 12-sided prism from three turned squares). */
function disc(cx: number, cz: number, r: number, y0: number, y1: number, mt: Mat): void {
  const s = r * 2 * 0.966;
  for (const a of [0, PI / 6, PI / 3]) turned(cx, cz, s, s, y0, y1, mt, a);
}
/** A stepped dome: `steps` discs from radius r at y up to the crown at y + h. */
function dome(cx: number, cz: number, r: number, y: number, h: number, steps: number, mt: Mat): void {
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const rr = r * Math.cos(Math.asin(Math.min(0.97, t0)));
    disc(cx, cz, Math.max(0.6, rr), y + t0 * h, y + ((i + 1) / steps) * h, mt);
  }
}
/** A run of columns (props) from (x0, z0) to (x1, z1), `n` of them, standing on y. */
function columns(x0: number, z0: number, x1: number, z1: number, n: number, y: number, scale: number, model = 'rn_column_round'): void {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    m.prop(model, [r2(x0 + (x1 - x0) * t), r2(y), r2(z0 + (z1 - z0) * t)], 0, scale);
  }
}
/** A triangular pediment of stepped courses over [a0, a1] along x (alongX) or z, `depth` deep from c0 to c1. */
function pediment(a0: number, a1: number, c0: number, c1: number, alongX: boolean, y: number, h: number, steps: number, mt: Mat): void {
  for (let i = 0; i < steps; i++) {
    const inset = ((a1 - a0) / 2) * (i / steps);
    const y0 = y + (i * h) / steps;
    const y1 = y + ((i + 1) * h) / steps;
    if (alongX) box(a0 + inset, y0, c0, a1 - inset, y1, c1, mt);
    else box(c0, y0, a0 + inset, c1, y1, a1 - inset, mt);
  }
}
/** A rocket standing at (cx, cz): white body in banded stages, a nose cone, fins. */
function rocket(cx: number, cz: number, r: number, y: number, h: number): void {
  const body = h * 0.78;
  const stages = 3;
  for (let s = 0; s < stages; s++) {
    const y0 = y + (s * body) / stages;
    const y1 = y + ((s + 1) * body) / stages;
    const rr = r * (1 - s * 0.12);
    disc(cx, cz, rr, y0, y1 - 0.3, ROCKET_W);
    disc(cx, cz, rr * 1.02, y1 - 0.3, y1, ROCKET_K);
  }
  const top = y + body;
  for (let i = 0; i < 4; i++) disc(cx, cz, r * 0.76 * (1 - i / 4.4), top + (i * (h - body)) / 4, top + ((i + 1) * (h - body)) / 4, i === 3 ? ROCKET_K : ROCKET_W);
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2;
    turned(cx + Math.cos(a) * r * 1.2, cz + Math.sin(a) * r * 1.2, r * 1.1, 0.2, y, y + h * 0.16, ROCKET_K, -a);
  }
}

// ---------------------------------------------------------------- tiles

interface CellInfo {
  kind: string;
  group: string;
  tile: string;
}
const cells = new Map<string, CellInfo>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
const FOOT: Record<string, [number, number, number]> = { room_large: [2, 2, 1], hall: [3, 3, 1], stairwell: [1, 1, 2] };
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
function place(kind: string, x: number, y: number, z: number, group: string, surf: TileSurfaces, o: { rot?: Rotation; opts?: RoomOptions } = {}): void {
  m.tile(kind, x, y, z, o.rot ?? 0, o.opts);
  const [w, d, h] = FOOT[kind] ?? [1, 1, 1];
  for (let dz = 0; dz < h; dz++)
    for (let dy = 0; dy < d; dy++)
      for (let dx = 0; dx < w; dx++) {
        const k = key(x + dx, y + dy, z + dz);
        if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
        cells.set(k, { kind, group, tile: key(x, y, z) });
      }
  paint(x, y, z, surf);
}
const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const MIRROR: Record<Side, Side> = { N: 'S', S: 'N', E: 'E', W: 'W' };
/** Every remaining side between tiles: open inside a group, walls between groups (stairwells keep their own). */
function autoEdges(): void {
  for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
  const done = new Set<string>(links.keys());
  for (const [k, here] of cells) {
    if (here.kind === 'stairwell') continue;
    const [x, y, z] = k.split(',').map(Number) as [number, number, number];
    for (const side of ['N', 'E', 'S', 'W'] as const) {
      const [dx, dy] = DIRS[side];
      const there = cells.get(key(x + dx, y + dy, z));
      const id = sideId(x, y, z, side);
      if (!there || done.has(id) || there.kind === 'stairwell') continue;
      done.add(id);
      if (there.tile === here.tile) continue;
      m.edge(x, y, z, side, there.group === here.group ? 'open' : 'wall');
    }
  }
}
const ROOF: RoomOptions = { ceiling: 'roof', layout: 'empty' };
const EMPTY: RoomOptions = { layout: 'empty' };

// ================================================================ THE CAPITOL (cells x 14..18, y -4..4)

for (const s of [1, -1]) {
  const ch = s > 0 ? 3 : -4; // chamber anchor row
  const surf = s > 0 ? SENATE : HOUSE;
  const name = s > 0 ? 'senate' : 'house';
  place('room_large', 14, ch, 0, name, surf, { opts: EMPTY });
  place('room_large', 16, ch, 0, name, surf, { opts: EMPTY });
  for (let x = 14; x <= 17; x++) place('room', x, 2 * s, 0, `c${s}`, HALL, { opts: EMPTY });
  place('room', 18, 4 * s, 0, `o2${s}`, OFFICE, { opts: EMPTY });
  place('stairwell', 18, 3 * s, 0, `st${s}`, STAIR);
  place('room', 18, 2 * s, 0, `o1${s}`, OFFICE, { opts: EMPTY });
  // Upstairs: the visitors' galleries over the chamber, a corridor, offices, stairs to the roof.
  place('room_large', 14, ch, 1, `gal${s}`, surf, { opts: ROOF });
  place('room_large', 16, ch, 1, `gal${s}`, surf, { opts: ROOF });
  for (let x = 14; x <= 17; x++) place('room', x, 2 * s, 1, `c1${s}`, HALL, { opts: ROOF });
  place('stairwell', 18, 4 * s, 1, `rs${s}`, STAIR);
  place('room', 18, 2 * s, 1, `o3${s}`, OFFICE, { opts: ROOF });
}
for (let y = -1; y <= 1; y++) {
  place('room', 14, y, 0, 'west', HALL, { opts: EMPTY });
  place('room', 18, y, 0, 'east', HALL, { opts: EMPTY });
  place('room', 14, y, 1, 'west1', OFFICE, { opts: ROOF });
  place('room', 18, y, 1, 'east1', OFFICE, { opts: ROOF });
}
place('hall', 15, -1, 0, 'rotunda', HALL);

// The rotunda: wide doors west and east, doors to the corridors north and south.
link(15, 0, 0, 'W', 'wide');
link(17, 0, 0, 'E', 'wide');
link(16, 1, 0, 'N', 'door');
link(16, -1, 0, 'S', 'door');
// The west lobby: the main door onto the Mall, windows either side.
link(14, 0, 0, 'W', 'wide');
link(14, 1, 0, 'W', 'window');
link(14, -1, 0, 'W', 'window');
link(18, 0, 0, 'E', 'wide');
link(18, 1, 0, 'E', 'window');
link(18, -1, 0, 'E', 'window');
for (const s of [1, -1]) {
  const S: Side = s > 0 ? 'N' : 'S';
  const B: Side = MIRROR[S];
  const ch = s > 0 ? 3 : -3; // chamber row next to the corridor
  const far = 4 * s;
  link(14, s, 0, S, 'door'); // lobby to corridor
  link(14, 2 * s, 0, 'W', 'door'); // corridor to outside
  link(15, 2 * s, 0, S, 'door'); // corridor to chamber
  link(17, 2 * s, 0, S, 'door');
  link(17, 2 * s, 0, 'E', 'door'); // corridor to office
  link(18, 2 * s, 0, B, 'door'); // office to east lobby
  link(14, ch, 0, 'W', 'door');
  link(14, far, 0, 'W', 'window');
  for (let x = 14; x <= 17; x++) link(x, far, 0, S, x === 15 ? 'door' : 'window');
  link(17, ch, 0, 'E', 'door'); // chamber to stairwell
  link(17, far, 0, 'E', 'door'); // chamber to office
  link(18, far, 0, 'E', 'window');
  link(18, far, 0, S, 'window');
  link(18, 2 * s, 0, 'E', 'window');
  // Upstairs.
  link(17, ch, 1, 'E', 'door'); // gallery to stairwell top
  link(17, far, 1, 'E', 'door'); // gallery to roof stairs
  link(18, far, 2, 'W', 'door'); // roof stairs out onto the roof
  for (let x = 14; x <= 17; x++) link(x, far, 1, S, 'window');
  link(14, ch, 1, 'W', 'window');
  link(14, far, 1, 'W', 'window');
  link(15, ch, 1, B, 'door'); // gallery to corridor
  link(17, ch, 1, B, 'door');
  for (let x = 15; x <= 17; x++) link(x, 2 * s, 1, B, 'window'); // balconies over the rotunda
  link(14, 2 * s, 1, 'W', 'window');
  link(14, 2 * s, 1, B, 'door'); // corridor to the west range
  link(17, 2 * s, 1, 'E', 'door'); // corridor to office
  link(18, 2 * s, 1, B, 'door'); // office to the east range
  link(18, 2 * s, 1, 'E', 'window');
}
for (let y = -1; y <= 1; y++) {
  link(14, y, 1, 'W', 'window');
  link(14, y, 1, 'E', 'window'); // over the rotunda
  link(18, y, 1, 'W', 'window');
  link(18, y, 1, 'E', 'window');
}

// The dome: a slab over the rotunda's corners, the drum, a peristyle of columns, the stepped dome and its lantern.
const CAP: [number, number] = [128, 0];
ring(CAP[0], CAP[1], 14.6, 8, 8.4, 6.4, 32, MARBLE);
ring(CAP[0], CAP[1], 11.8, 8.4, 15, 0.8, 32, DOME);
for (let i = 0; i < 20; i++) {
  const a = ((i + 0.5) * 2 * PI) / 20;
  m.prop('rn_column_round', [r2(CAP[0] + 13.6 * Math.cos(a)), 8.4, r2(CAP[1] + 13.6 * Math.sin(a))], 0, 1.3);
}
ring(CAP[0], CAP[1], 13.4, 14.9, 15.6, 2, 32, DOME);
dome(CAP[0], CAP[1], 12.6, 15.6, 11, 8, DOME);
disc(CAP[0], CAP[1], 2.2, 26.6, 29.2, DOME);
disc(CAP[0], CAP[1], 2.6, 29.2, 29.6, DOME);
disc(CAP[0], CAP[1], 1, 29.6, 31, BRASS);
// The west portico: columns, entablature and pediment over the main door; a cornice round the roof.
columns(105.4, -10.2, 105.4, 10.2, 7, 0, 1.6);
box(104.2, 8, -11.6, 108, 9.2, 11.6, MARBLE);
pediment(-11.6, 11.6, 104.2, 108, false, 9.2, 3.4, 5, MARBLE);
box(107.6, 8, -36.4, 108.4, 8.8, 36.4, MARBLE); // cornice, west
box(147.6, 8, -36.4, 148.4, 8.8, 36.4, MARBLE); // east
columns(150.4, -6.8, 150.4, 6.8, 5, 0, 1.6); // east portico
box(148, 8, -8, 151.6, 9.2, 8, MARBLE);
pediment(-8, 8, 148, 151.6, false, 9.2, 2.6, 4, MARBLE);
// The terrace steps up to the west front and the Capitol's flags.
for (const z of [-20, 20]) m.prop('flag', [101, 0, z], -P, 1.6);

// ================================================================ THE MONUMENT (an obelisk at -36, 0)

const OB = { x: -36, z: 0 };
const T = 0.6;
const H = 4;
const STOREYS = 9;
const OUT = 7.2; // half-width of the shaft
const inner = { x0: OB.x - OUT + T, x1: OB.x + OUT - T, z0: OB.z - OUT + T, z1: OB.z + OUT - T };
const STEPS = 16;
const RISE = H / STEPS;
const TREAD = 0.5;
const STAIR_W = 2.6;
const stairX = OB.x - 2.6;
const stairZ = OB.z - 4;
/** A straight flight of 16 steps from height y, 2.6 m wide, starting at (x, z) and climbing north (+1) or south (-1). */
function flight(x: number, z: number, y: number, dir: 1 | -1, mt: Mat): { x0: number; x1: number; z0: number; z1: number } {
  for (let i = 0; i < STEPS; i++) {
    const z0 = dir > 0 ? z + i * TREAD : z - (i + 1) * TREAD;
    box(x, y, z0, x + STAIR_W, y + (i + 1) * RISE, z0 + TREAD, mt);
  }
  const len = STEPS * TREAD;
  return dir > 0 ? { x0: x, x1: x + STAIR_W, z0: z, z1: z + len } : { x0: x, x1: x + STAIR_W, z0: z - len, z1: z };
}
const floorY = (s: number) => (s ? s * H + 0.3 : 0.1);
box(inner.x0, -0.4, inner.z0, inner.x1, 0.1, inner.z1, GRANITE);
const holes: ({ x0: number; x1: number; z0: number; z1: number } | null)[] = Array(STOREYS + 1).fill(null);
for (let s = 0; s < STOREYS - 1; s++) {
  const even = s % 2 === 0;
  const run = even ? flight(stairX, stairZ, floorY(s), 1, GRANITE) : flight(stairX + STAIR_W, stairZ + STEPS * TREAD, floorY(s), -1, GRANITE);
  holes[s + 1] = { x0: even ? run.x0 : run.x0 - 0.5, x1: even ? run.x1 + 0.5 : run.x1, z0: run.z0, z1: run.z1 };
}
for (let s = 1; s <= STOREYS; s++) {
  const hole = s < STOREYS ? holes[s] : null;
  const r = inner;
  if (!hole) box(r.x0, s * H, r.z0, r.x1, s * H + 0.3, r.z1, GRANITE);
  else {
    box(r.x0, s * H, r.z0, r.x1, s * H + 0.3, hole.z0, GRANITE);
    box(r.x0, s * H, hole.z1, r.x1, s * H + 0.3, r.z1, GRANITE);
    box(r.x0, s * H, hole.z0, hole.x0, s * H + 0.3, hole.z1, GRANITE);
    box(hole.x1, s * H, hole.z0, r.x1, s * H + 0.3, hole.z1, GRANITE);
  }
}
/** One face of the shaft (N, S, E or W) between y0 and y1, with openings [centre along, width, bottom, top] (relative to y0). */
function face(side: Side, y0: number, y1: number, open: [number, number, number, number][], mt: Mat, out = 0, thick = T): void {
  const alongX = side === 'N' || side === 'S';
  const half = OUT + out;
  const a0 = (alongX ? OB.x : OB.z) - half;
  const a1 = (alongX ? OB.x : OB.z) + half;
  const c = side === 'N' ? OB.z + half - thick : side === 'S' ? OB.z - half : side === 'E' ? OB.x + half - thick : OB.x - half;
  const seg = (s0: number, s1: number, b: number, t: number) => {
    if (alongX) box(s0, y0 + b, c, s1, y0 + t, c + thick, mt);
    else box(c, y0 + b, s0, c + thick, y0 + t, s1, mt);
  };
  let s = a0;
  for (const [mid, w, b, t] of [...open].sort((p, q) => p[0] - q[0])) {
    const o0 = (alongX ? OB.x : OB.z) + mid - w / 2;
    const o1 = o0 + w;
    seg(s, o0, 0, y1 - y0);
    seg(o0, o1, 0, b);
    seg(o0, o1, t, y1 - y0);
    s = o1;
  }
  seg(s, a1, 0, y1 - y0);
}
const DOOR: [number, number, number, number] = [0, 2.8, 0, 3.1];
for (const side of ['N', 'S', 'E', 'W'] as const) {
  face(side, 0, H, side === 'E' || side === 'W' ? [DOOR] : [], MARBLE_W);
  face(side, H, (STOREYS - 1) * H, [], MARBLE_W);
  face(side, (STOREYS - 1) * H, STOREYS * H, [[-4, 1.6, 1.3, 3.1], [0, 1.6, 1.3, 3.1], [4, 1.6, 1.3, 3.1]], MARBLE_W);
  // The taper: three shells, each shorter than the one inside it.
  for (const [k, top] of [[1, 36], [2, 24], [3, 12]] as const) face(side, 0, top, side === 'E' || side === 'W' ? [DOOR] : [], MARBLE_W, 0.3 * k, 0.3);
}
// The pyramidion and its aluminium tip.
for (let i = 0; i < 7; i++) {
  const h = OUT + 0.3 - i * 1.05;
  box(OB.x - h, 36 + i * 1.2, OB.z - h, OB.x + h, 36 + (i + 1) * 1.2, OB.z + h, MARBLE_W);
}
box(OB.x - 0.4, 44.4, OB.z - 0.4, OB.x + 0.4, 45, OB.z + 0.4, { material: 'pbr_steel', tint: '#d8dce0' });
for (let s = 0; s < STOREYS; s++) m.light([OB.x + 3, s * H + 3.4, OB.z], { color: '#fff1d6', intensity: 0.8, range: 9 });
// The flags round the plaza.
for (let i = 0; i < 24; i++) {
  const a = (i * 2 * PI) / 24;
  m.prop('flag', [r2(OB.x + 21 * Math.cos(a)), 0, r2(OB.z + 21 * Math.sin(a))], r2(-a), 1.5);
}

// ================================================================ THE REFLECTING POOL (x -112..-62, z -6..6)

const POOL = { x0: -112, x1: -62, z0: -6, z1: 6 };
m.water([(POOL.x0 + POOL.x1) / 2, -0.75, 0], [POOL.x1 - POOL.x0, 0.65, POOL.z1 - POOL.z0]);
box(POOL.x0 - 0.8, -0.3, POOL.z1 - 1.6, POOL.x1 + 0.8, 0.25, POOL.z1 + 0.8, WATER_RIM);
box(POOL.x0 - 0.8, -0.3, POOL.z0 - 0.8, POOL.x1 + 0.8, 0.25, POOL.z0 + 1.6, WATER_RIM);
box(POOL.x0 - 0.8, -0.3, POOL.z0 + 1.6, POOL.x0 + 1.6, 0.25, POOL.z1 - 1.6, WATER_RIM);
box(POOL.x1 - 1.6, -0.3, POOL.z0 + 1.6, POOL.x1 + 0.8, 0.25, POOL.z1 - 1.6, WATER_RIM);

// ================================================================ THE MEMORIAL (centre -138, 0)

const MX = -138;
const PL = { x0: -152, x1: -124, z0: -20, z1: 20 };
const PH = 1.5;
box(PL.x0, -0.3, PL.z0, PL.x1, PH, PL.z1, STONE);
// Steps: across the east front, and up the middle of the north and south sides.
const NSTEP = 7;
const stepTop = (i: number) => r2(-0.15 + ((PH + 0.15) * (i + 1)) / NSTEP);
for (let i = 0; i < NSTEP; i++) {
  box(PL.x1 + (NSTEP - 1 - i) * 0.5, -0.3, -12, PL.x1 + (NSTEP - i) * 0.5, stepTop(i), 12, STONE);
  for (const s of [1, -1]) {
    const z0 = s > 0 ? PL.z1 + (NSTEP - 1 - i) * 0.5 : PL.z0 - (NSTEP - i) * 0.5;
    box(MX - 4, -0.3, z0, MX + 4, stepTop(i), z0 + 0.5, STONE);
  }
}
// The 36 columns round the cella, the entablature, roof and attic.
columns(-150, -18, -126, -18, 11, PH, 1.6);
columns(-150, 18, -126, 18, 11, PH, 1.6);
columns(-150, -14.4, -150, 14.4, 9, PH, 1.6);
columns(-126, -14.4, -126, 14.4, 9, PH, 1.6);
const ENT = PH + 8;
box(-151, ENT, -19, -149, ENT + 1.5, 19, MARBLE);
box(-127, ENT, -19, -125, ENT + 1.5, 19, MARBLE);
box(-149, ENT, -19, -127, ENT + 1.5, -17, MARBLE);
box(-149, ENT, 17, -127, ENT + 1.5, 19, MARBLE);
box(-151.4, ENT + 1.5, -19.4, -124.6, ENT + 2, 19.4, MARBLE);
box(-148, ENT + 2, -16, -128, ENT + 4.2, 16, MARBLE_W);
// The cella: walls round three chambers, a wide opening east onto the steps, doors north and south.
const CE = { x0: -146, x1: -130, z0: -14, z1: 14 };
const cw = (x0: number, z0: number, x1: number, z1: number) => box(x0, PH, z0, x1, ENT + 1.5, z1, MARBLE);
cw(CE.x0, CE.z0, CE.x0 + 0.8, CE.z1); // west
cw(CE.x1 - 0.8, CE.z0, CE.x1, -4.5);
cw(CE.x1 - 0.8, 4.5, CE.x1, CE.z1);
box(CE.x1 - 0.8, PH + 7, -4.5, CE.x1, ENT + 1.5, 4.5, MARBLE);
for (const s of [1, -1]) {
  const z0 = s > 0 ? CE.z1 - 0.8 : CE.z0;
  cw(CE.x0, z0, MX - 1.6, z0 + 0.8);
  cw(MX + 1.6, z0, CE.x1, z0 + 0.8);
  box(MX - 1.6, PH + 3.4, z0, MX + 1.6, ENT + 1.5, z0 + 0.8, MARBLE);
  // Screens of columns between the chambers.
  const zs = s * 5;
  columns(CE.x0 + 3.2, zs, CE.x1 - 3.2, zs, 4, PH, 1.2);
}
box(CE.x0, ENT + 1.5 - 0.01, CE.z0, CE.x1, ENT + 1.6, CE.z1, MARBLE);
// The seated statue on its pedestal, facing east down the Mall.
const SX = -144;
box(SX - 2.2, PH, -2.6, SX + 2.8, PH + 2, 2.6, STONE); // pedestal
box(SX - 1.6, PH + 2, -2.1, SX + 1.4, PH + 3.4, 2.1, MARBLE_W); // chair seat
box(SX - 2.1, PH + 2, -2.3, SX - 1.4, PH + 7.6, 2.3, MARBLE_W); // chair back
for (const s of [1, -1]) box(SX - 1.6, PH + 3.4, s > 0 ? 1.8 : -2.3, SX + 1.6, PH + 4.3, s > 0 ? 2.3 : -1.8, MARBLE_W); // arms of the chair
box(SX - 1.4, PH + 3.4, -1.4, SX + 2, PH + 4.3, 1.4, MARBLE_W); // lap
for (const s of [1, -1]) box(SX + 1.2, PH + 2, s > 0 ? 0.3 : -1.3, SX + 2.2, PH + 4.3, s > 0 ? 1.3 : -0.3, MARBLE_W); // shins
box(SX - 1.4, PH + 4.3, -1.3, SX + 0.4, PH + 6.9, 1.3, MARBLE_W); // body
box(SX - 1.2, PH + 6.9, -0.55, SX + 0.1, PH + 8.2, 0.55, MARBLE_W); // head
for (const s of [1, -1]) box(SX - 0.9, PH + 4.3, s > 0 ? 1.3 : -1.9, SX + 1.5, PH + 6.6, s > 0 ? 1.9 : -1.3, MARBLE_W); // arms on the chair
m.light([MX - 3, PH + 7, 0], { color: '#ffe9c4', intensity: 1.2, range: 14, fixture: 'none' });
for (const s of [1, -1]) m.light([MX, PH + 7, s * 9.5], { color: '#ffe9c4', intensity: 0.8, range: 10, fixture: 'none' });

// ================================================================ THE NATURAL-HISTORY MUSEUM (cells x 4..10, y 5..8)

for (const s of [-1, 1]) {
  const sx = s < 0 ? 4 : 10; // stairwell column (outer)
  const ix = s < 0 ? 5 : 9; // inner column
  const g = s < 0 ? 'hallA' : 'hallB';
  place('stairwell', sx, 5, 0, `nst${s}`, STAIR, { rot: s < 0 ? 2 : 0 });
  place('room', ix, 5, 0, g, MUSEUM, { opts: EMPTY });
  place('room_large', s < 0 ? 4 : 9, 6, 0, g, MUSEUM, { opts: EMPTY });
  place('room', 4 + (s < 0 ? 0 : 5), 8, 0, g, MUSEUM, { opts: EMPTY });
  place('room', 5 + (s < 0 ? 0 : 5), 8, 0, g, MUSEUM, { opts: EMPTY });
  place('room', ix, 5, 1, `gal${g}`, GALLERY, { opts: ROOF });
  place('room_large', s < 0 ? 4 : 9, 6, 1, `gal${g}`, GALLERY, { opts: ROOF });
  place('room', 4 + (s < 0 ? 0 : 5), 8, 1, `gal${g}`, GALLERY, { opts: ROOF });
  place('room', 5 + (s < 0 ? 0 : 5), 8, 1, `gal${g}`, GALLERY, { opts: ROOF });
}
place('hall', 6, 5, 0, 'nrot', MUSEUM, { opts: { layout: 'empty' } });
for (let x = 6; x <= 8; x++) {
  place('room', x, 8, 0, 'gems', GEMS, { opts: EMPTY });
  place('room', x, 8, 1, 'gems1', GALLERY, { opts: ROOF });
}
link(7, 5, 0, 'S', 'wide');
link(6, 5, 0, 'S', 'window');
link(8, 5, 0, 'S', 'window');
link(6, 6, 0, 'W', 'wide');
link(8, 6, 0, 'E', 'wide');
link(7, 7, 0, 'N', 'wide');
link(6, 8, 0, 'W', 'door');
link(8, 8, 0, 'E', 'door');
for (let x = 6; x <= 8; x++) link(x, 8, 0, 'N', 'window');
for (const s of [-1, 1]) {
  const sx = s < 0 ? 4 : 10;
  const ix = s < 0 ? 5 : 9;
  const out: Side = s < 0 ? 'W' : 'E';
  const inw: Side = s < 0 ? 'E' : 'W';
  link(sx, 5, 0, inw, 'door');
  link(sx, 5, 1, inw, 'door');
  link(ix, 5, 0, 'S', 'door');
  link(sx, 7, 0, out, 'door');
  link(sx, 6, 0, out, 'window');
  link(sx, 8, 0, out, 'window');
  for (const x of [4, 5, 9, 10]) if ((s < 0) === x < 7) link(x, 8, 0, 'N', 'window');
  // Upstairs: windows out, balconies over the rotunda, doors through to the gem gallery.
  link(ix, 5, 1, 'S', 'window');
  for (let y = 5; y <= 7; y++) link(ix, y, 1, inw, 'window');
  link(sx, 6, 1, out, 'window');
  link(sx, 7, 1, out, 'window');
  link(sx, 8, 1, out, 'window');
  link(ix, 8, 1, inw, 'door');
}
for (let x = 6; x <= 8; x++) {
  link(x, 8, 1, 'S', 'window');
  link(x, 8, 1, 'N', 'window');
}
// Above the rotunda's front, the dome and the portico.
box(44, 4, 36, 68, 8, 36.6, STONE);
const NM: [number, number] = [56, 48];
ring(NM[0], NM[1], 14.6, 8, 8.4, 6.4, 32, STONE);
ring(NM[0], NM[1], 11.8, 8.4, 12, 0.8, 32, STONE);
dome(NM[0], NM[1], 12.6, 12, 8, 7, COPPER);
disc(NM[0], NM[1], 1.8, 20, 22, STONE);
columns(45, 33.4, 67, 33.4, 8, 0, 1.6);
box(43.6, 8, 32.4, 68.4, 9.2, 36.6, STONE);
pediment(43.6, 68.4, 32.4, 36.6, true, 9.2, 3, 5, STONE);
box(28, 8, 35.6, 84, 8.8, 36.4, STONE);
// The mammoth in the rotunda.
{
  const [cx, cz] = NM;
  box(cx - 4.4, 0, cz - 2.2, cx + 4.4, 0.6, cz + 2.2, GRANITE);
  for (const dx of [-2.6, 2.2]) for (const dz of [-0.9, 0.9]) box(cx + dx - 0.25, 0.6, cz + dz - 0.25, cx + dx + 0.25, 3.6, cz + dz + 0.25, BONE);
  box(cx - 3.2, 3.6, cz - 0.3, cx + 3, 4.2, cz + 0.3, BONE); // spine
  for (let i = 0; i < 6; i++) for (const s of [1, -1]) box(cx - 1.6 + i * 0.6, 2.2, cz + s * 1.1 - 0.1, cx - 1.4 + i * 0.6, 4, cz + s * 1.1 + 0.1, BONE); // ribs
  box(cx - 2.8, 3.4, cz - 0.9, cx - 1.6, 4.1, cz + 0.9, BONE); // pelvis
  box(cx + 2.8, 3.2, cz - 0.8, cx + 4.4, 5, cz + 0.8, BONE); // skull
  box(cx + 4.2, 1.4, cz - 0.2, cx + 4.6, 3.4, cz + 0.2, BONE); // trunk
  for (const s of [1, -1]) {
    box(cx + 4.2, 2.6, cz + s * 0.85 - 0.15, cx + 6, 3, cz + s * 0.85 + 0.15, BONE); // tusks
    box(cx + 5.8, 3, cz + s * 0.85 - 0.15, cx + 6.2, 3.9, cz + s * 0.85 + 0.15, BONE);
  }
}
// The theropod in the fossil hall (hall B, the large room at 9..10, 6..7).
{
  const cx = 76;
  const cz = 56;
  box(cx - 5, 0, cz - 1.6, cx + 5, 0.5, cz + 1.6, GRANITE);
  for (const dz of [-0.6, 0.6]) box(cx - 0.6, 0.5, cz + dz - 0.2, cx - 0.2, 3, cz + dz + 0.2, FOSSIL); // legs
  box(cx - 1.2, 2.8, cz - 0.5, cx + 0.4, 3.6, cz + 0.5, FOSSIL); // hips
  box(cx + 0.4, 3.2, cz - 0.2, cx + 3, 3.7, cz + 0.2, FOSSIL); // back
  for (let i = 0; i < 4; i++) for (const s of [1, -1]) box(cx + 0.7 + i * 0.6, 2.2, cz + s * 0.5 - 0.08, cx + 0.85 + i * 0.6, 3.4, cz + s * 0.5 + 0.08, FOSSIL);
  box(cx + 3, 3.4, cz - 0.15, cx + 3.6, 4.6, cz + 0.15, FOSSIL); // neck
  box(cx + 3.2, 4.2, cz - 0.4, cx + 5, 5.2, cz + 0.4, FOSSIL); // skull
  box(cx - 4.6, 2.8, cz - 0.15, cx - 1.2, 3.3, cz + 0.15, FOSSIL); // tail
  box(cx + 2.6, 2.6, cz - 0.4, cx + 3, 3.1, cz + 0.4, FOSSIL); // little arms
}

// ================================================================ THE AIR-AND-SPACE MUSEUM (cells x 4..10, y -8..-5)

for (let x = 5; x <= 9; x++) for (let y = -8; y <= -5; y++) place('room', x, y, 0, 'big', AIR, { opts: EMPTY });
for (let x = 5; x <= 9; x++) place('platform_rail', x, -8, 1, 'mezz', MEZZ);
for (const s of [-1, 1]) {
  const wx = s < 0 ? 4 : 10;
  place('stairwell', wx, -8, 0, `ast${s}`, STAIR, { rot: s < 0 ? 2 : 0 });
  for (let y = -7; y <= -5; y++) place('room', wx, y, 0, `wing${s}`, AIR, { opts: ROOF });
  const inw: Side = s < 0 ? 'E' : 'W';
  const out: Side = s < 0 ? 'W' : 'E';
  link(wx, -8, 0, inw, 'door');
  link(wx, -8, 1, inw, 'door');
  link(wx, -6, 0, inw, 'door');
  link(wx, -7, 0, inw, 'high');
  link(wx, -5, 0, inw, 'high');
  link(wx, -5, 0, 'N', 'door');
  link(wx, -6, 0, out, 'door');
  link(wx, -5, 0, out, 'window');
  link(wx, -7, 0, out, 'window');
  // Over the doorway into the hall, the hall's own wall carries on up.
  const ex = s < 0 ? 36 : 76;
  box(ex - 0.2, 4, -52, ex + 0.2, 8, -44, PINK);
}
for (let x = 5; x <= 9; x++) {
  link(x, -8, 0, 'S', 'high');
  link(x, -5, 0, 'N', 'open');
}
// The roof, its skylight bands, and the glass front with its mullions (the doors are 7.6 × 5.6 m).
box(36, 8, -68, 76, 8.4, -36, { material: 'pbr_white_panel', tint: '#e8e8ea' });
for (const x of [46, 56, 66]) box(x - 1, 8.4, -66, x + 1, 8.6, -38, { material: 'light_strip', tint: '#dff2ff' });
box(36, 5.6, -36.2, 76, 8.4, -35.8, GLASS);
for (const x of [44, 52, 60, 68]) box(x - 0.2, 0, -36.2, x + 0.2, 5.6, -35.8, { material: 'pbr_steel', tint: '#c8ccd2' });
box(36, 8.4, -68.4, 76.4, 9.2, -35.6, PINK);
// Rockets in the corners by the glass front, and a tall one outside on the plaza.
rocket(39.5, -39.5, 1.3, 0, 7.6);
rocket(72.5, -39.5, 1.1, 0, 7.6);
rocket(90, -40, 2, 0, 24);
for (const x of [5, 6, 7, 8, 9]) m.light(at(x, -6, 0, 0, 0, 7.4), { color: '#f2f6ff', intensity: 1.1, range: 16, fixture: 'strip' });

autoEdges();

// ================================================================ THE GROUND

const COLS = 161;
const ROWS = 81;
const ORIGIN: [number, number] = [-160, -80];
const inPool = (x: number, z: number) => x > POOL.x0 && x < POOL.x1 && z > POOL.z0 && z < POOL.z1;
const heights: number[] = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) heights.push(inPool(ORIGIN[0] + c * 2, ORIGIN[1] + r * 2) ? -60 : 0);
const materials: number[] = [];
const foliage: number[] = [];
const ground = (x: number, z: number): [TerrainMaterial, number] => {
  const az = Math.abs(z);
  if (Math.hypot(x - OB.x, z - OB.z) < 26) return ['stone', 0]; // the monument's plaza
  if (x > 90 && x < 108 && az < 30) return ['stone', 0]; // the Capitol's west terrace
  if (x > 108 && az > 36) return [az > 40 && az < 44 ? 'gravel' : 'grass', 3];
  if (x > -124 && x < -112 && az < 20) return ['stone', 0]; // the memorial's forecourt
  if (x > POOL.x0 - 4 && x < POOL.x1 + 4 && az < 10) return ['stone', 0]; // the pool's walk
  if (az > 28 && az < 38 && x > 26 && x < 92) return ['stone', 0]; // the museums' fronts
  if (az > 10 && az < 14 && x > -60 && x < 92) return ['gravel', 0]; // the walks down the Mall
  if (Math.abs(x - 20) < 2 && az < 22) return ['gravel', 0]; // a cross walk
  if (az > 10 && az < 14 && x > -124 && x < -60) return ['gravel', 0];
  return ['grass', az < 8 ? 2 : 3];
};
for (let r = 0; r < ROWS - 1; r++)
  for (let c = 0; c < COLS - 1; c++) {
    const [g, f] = ground(ORIGIN[0] + c * 2 + 1, ORIGIN[1] + r * 2 + 1);
    materials.push(TERRAIN_MATERIALS.indexOf(g));
    foliage.push(f);
  }
const terrain: TerrainData = { origin: ORIGIN, spacing: 2, cols: COLS, rows: ROWS, baseY: -0.15, heights, materials, boundary: true, foliage };
m.terrain(terrain);
// The avenues either side of the Mall, with their centre lines.
for (const s of [1, -1]) {
  for (const [x0, x1] of [[-60, 0], [0, 50], [50, 100]] as const) box(x0, -0.15, s * 22, x1, 0, s * 28, ASPHALT);
  for (let x = -56; x < 100; x += 8) box(x, -0.12, s * 25 - 0.1, x + 4, 0.01, s * 25 + 0.1, LINE);
}
// Food trucks along the avenues.
const truck = (x: number, z: number, tint: string) => {
  box(x - 3, 0.3, z - 1.2, x + 3, 2.9, z + 1.2, { material: 'paint_gloss', tint });
  box(x - 2.4, 0, z - 1.1, x + 2.4, 0.3, z + 1.1, { material: 'pbr_steel', tint: '#2a2a2a' });
  box(x - 1.5, 1.4, z - 1.3, x + 1.5, 2.2, z - 1.2, { material: 'paint_gloss', tint: '#1c2228' });
};
truck(-10, 18.6, '#c84a3a');
truck(36, -18.6, '#3a7ac8');
truck(86, 18.6, '#e8c040');

// ================================================================ PLANTING AND STREET FURNITURE

const ELMS = ['nt_common_tree', 'tree_detailed'];
let t = 0;
for (let x = -8; x <= 92; x += 12)
  for (const z of [-16, -7, 7, 16]) {
    if (Math.abs(x - 20) < 4) continue;
    m.prop(ELMS[t++ % 2]!, [x, 0, z], (t * 1.3) % 6.28, 0.95 + (t % 3) * 0.08);
  }
for (let x = -120; x <= -64; x += 12) for (const z of [-17, 17]) m.prop(ELMS[t++ % 2]!, [x, 0, z], (t * 1.3) % 6.28, 1);
// Cherry trees in blossom along the pool and round the monument.
const blossom = (x: number, z: number, i: number) => m.add({ kind: 'prop', model: 'prop.nt_common_tree_2', position: [r2(x), 0, r2(z)], yaw: r2((i * 1.7) % 6.28), scale: r2(0.8 + (i % 3) * 0.1), solid: true, tint: i % 2 ? '#f2b6c8' : '#f6cad6' });
let b = 0;
for (let x = -108; x <= -66; x += 7) for (const z of [-10.5, 10.5]) blossom(x, z, b++);
for (const a of [0.4, 1.2, 2.0, 2.8, 3.5, 4.3, 5.1, 5.8]) blossom(OB.x + 30 * Math.cos(a), OB.z + 30 * Math.sin(a), b++);
for (const z of [-30, -38, 30, 38]) for (const x of [-148, -136, -126]) blossom(x, z, b++);
for (const [x, z] of [[118, 44], [134, 46], [146, 58], [118, -44], [134, -46], [146, -58], [112, 64], [112, -64]] as const) blossom(x, z, b++);
// Lamps, benches and bins along the walks.
for (let x = -112; x <= 92; x += 16) for (const z of [-10.2, 10.2]) m.prop('lantern_post', [x, 0, z], z > 0 ? PI : 0);
for (let x = -56; x <= 84; x += 16) for (const z of [-13.8, 13.8]) m.prop('graveyard_bench', [x, 0, z], z > 0 ? 0 : PI);
for (let x = -96; x <= 84; x += 32) m.prop('trashcan', [x + 2, 0, 9.6]);
// Hedges and bushes on the Capitol grounds and round the museums.
for (const s of [1, -1]) {
  for (let x = 112; x <= 146; x += 6) m.prop('hedge', [x, 0, s * 40], 0);
  for (const x of [-150, -128]) m.prop('nt_bush_berries', [x, 0, s * 24], 0);
}

// ================================================================ VEHICLES

m.mount('buggy', [120, 0, 52], PI, CAPITOL);
m.mount('gun_jeep', [134, 0, -52], 0, CAPITOL);
m.mount('hover_bike', [96, 0, 34], -P, CAPITOL);
m.mount('buggy', [-120, 0, 30], P, MEMORIAL);
m.mount('gun_jeep', [-120, 0, -30], P, MEMORIAL);
m.mount('hover_bike', [-112, 0, -16], P, MEMORIAL);
m.mount('ice_cream_truck', [-20, 0, -25], 0);
// The flyers on show in the air-and-space hall: take one out through the glass front.
m.mount('skyfighter', [48, 0, -46], 0);
m.mount('skyfighter', [64, 0, -46], 0);
m.mount('gunship', [56, 0, -52], 0);
m.mount('hover_bike', [42, 0, -62], P);

// ================================================================ SPAWNS, FLAGS, HILLS, PICKUPS

// The Capitol team: the west lobby, the terrace, the east lobby, the corridors and the grounds.
for (const [x, z, yaw] of [
  [110, -3, -P], [110, 3, -P], [100, -16, -P], [100, 16, -P], [96, -6, -P], [96, 6, -P], [146, 0, -P], [144, -6, -P],
  [144, 6, -P], [120, 16, -P], [120, -16, -P], [130, 44, -P], [130, -44, -P], [116, 60, -P], [116, -60, -P], [146, 68, PI],
] as const) m.spawn([x, 0, z], yaw, CAPITOL);
// The Memorial team: the chambers on the plinth, the forecourt and the grounds round it.
for (const [x, y, z, yaw] of [
  [-134, PH, 9.5, P], [-134, PH, -9.5, P], [-128, PH, 4, P], [-128, PH, -4, P], [-118, 0, -14, P], [-118, 0, 14, P], [-116, 0, 0, P], [-140, 0, 30, P],
  [-140, 0, -30, P], [-150, 0, 44, P], [-150, 0, -44, P], [-130, 0, 50, P], [-130, 0, -50, P], [-110, 0, 40, P], [-110, 0, -40, P], [-154, 0, 24, 0],
] as const) m.spawn([x, y, z], yaw, MEMORIAL);
// Free-for-all extras across the Mall and in the museums.
for (const [x, y, z, yaw] of [
  [-36, 0, 14, 0], [-36, 0, -14, PI], [-24, 0, 0, P], [-48, 0, 0, -P], [0, 0, 0, P], [20, 0, 0, -P], [44, 0, 0, P], [70, 0, 0, -P],
  [56, 0, 40, PI], [36, 0, 48, P], [76, 0, 64, -P], [50, 0, -40, 0], [32, 0, -56, P], [80, 0, -52, -P], [-80, 0, 30, 0], [-80, 0, -30, PI],
  [-90, 0, 12, P], [10, 0, 60, P], [10, 0, -60, P], [100, 0, 60, -P], [100, 0, -60, -P], [-40, 32.3, -4, PI], [36, 4, 56, P], [-60, 0, 60, 0],
] as const) m.spawn([x, y, z], yaw);

m.flag(CAPITOL, at(14, 0, 0, 1, 0), -P);
m.flag(MEMORIAL, [-136, PH, 0], P);
// King of the Hill: the obelisk's deck, the museum rotunda, the air-and-space hall, the Capitol rotunda.
m.hill([OB.x - 4, 32.3, OB.z + 2], 4);
m.hill([NM[0], 0, NM[1] - 5], 7);
m.hill([56, 0, -46], 8);
m.hill([CAP[0] - 6, 0, CAP[1]], 7);

// Weapons: the sniper rifle up the obelisk, rockets with the rockets, the railgun on the Capitol roof.
m.pickup('weapon_sniper', [OB.x + 4, 32.3, OB.z - 4]).pickup('ammo_sniper', [OB.x + 4, 32.3, OB.z + 4]);
m.pickup('health_small', [OB.x - 5, 16.3, OB.z - 5]).pickup('armor_small', [OB.x + 5, 20.3, OB.z + 5]);
m.pickup('weapon_rockets', [56, 0, -40]).pickup('ammo_explosive', [42, 4, -64]);
m.pickup('weapon_railgun', [136, 8, 30]).pickup('ammo_cells', [136, 8, -30]);
m.pickup('weapon_marksman', at(14, 3, 1, 4, 4)).pickup('weapon_marksman', at(14, -4, 1, 4, 0));
m.pickup('powerup_damage', [NM[0] - 6, 0, NM[1] + 6], 90);
m.pickup('armor_large', [-138, PH, -9.5]).pickup('armor_large', at(18, 0, 0, -2, 0));
m.pickup('weapon_shotgun', at(16, 3, 0)).pickup('weapon_shotgun', at(16, -3, 0));
m.pickup('weapon_auto_shotgun', at(7, 8, 0, 0, -2.5)).pickup('weapon_lmg', [40, 0, 55]).pickup('weapon_burst_rifle', at(9, 6, 0, 4, -4));
m.pickup('weapon_smg', at(10, -6, 0)).pickup('weapon_machine_pistol', at(4, -6, 0));
m.pickup('weapon_rifle', [-36, 0, 24]).pickup('weapon_rifle', [20, 0, -24]).pickup('weapon_rifle', [-86, 0, 16]);
m.pickup('weapon_launcher', [-86, 0, -16]).pickup('weapon_burst_rifle', [96, 0, -36]);
m.pickup('health_large', [-36, 0, -24]).pickup('health_large', at(7, 8, 1)).pickup('health_large', at(7, -5, 0, 0, 2));
m.pickup('health_small', [-100, 0, 12]).pickup('health_small', [-70, 0, -12]).pickup('health_small', [8, 0, 12]).pickup('health_small', [60, 0, -12]);
m.pickup('health_small', [104, 0, -30]).pickup('health_small', [-155, 0, 0]).pickup('health_small', at(16, 2, 1));
m.pickup('ammo_rifle', [-60, 0, 20]).pickup('ammo_rifle', [40, 0, 20]).pickup('ammo_rifle', [80, 0, -20]).pickup('ammo_shells', at(16, -2, 1));
m.pickup('ammo', [-120, 0, 0]).pickup('ammo', [104, 0, 0]).pickup('grenades', [0, 0, 18]).pickup('grenades', [0, 0, -18]).pickup('grenades', [-130, 0, 40]);

// ================================================================ INTERIORS (after spawns and pickups, which they keep clear of)

/** A row of display cases (tables) with cabinets along a wall, between two points. */
function cases(x0: number, z0: number, x1: number, z1: number, n: number, y: number, yaw: number, model = 'display_table'): void {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    m.prop(model, [r2(x0 + (x1 - x0) * t), y, r2(z0 + (z1 - z0) * t)], yaw);
  }
}
// The mammal hall (A): taxidermy on plinths, cases down the middle, cabinets on the walls.
cases(36, 60, 36, 50, 3, 0, 0);
cases(28.9, 64, 28.9, 46, 3, 0, P, 'display_wall');
for (const [x, z, model] of [[40, 64, 'rn_statue_stag'], [32, 64, 'rn_statue_fox'], [40, 46, 'dg_statue_horse'], [32, 46, 'rn_statue_stag']] as const) {
  m.prop('dg_pedestal', [x, 0, z], 0, 1);
  m.prop(model, [x, 1.1, z], P, 0.8);
}
cases(36.5, 71, 44.5, 71, 2, 0, PI, 'display_wall');
// The fossil hall (B): the theropod, cabinets of bones and the minerals.
cases(83.1, 64, 83.1, 46, 3, 0, -P, 'display_wall');
for (const [x, z] of [[70, 47], [82, 66], [70, 66]] as const) {
  m.prop('dg_pedestal', [x, 0, z], 0, 1);
  m.prop('dg_skull', [x, 1.1, z], P, 2);
}
cases(72, 71, 80, 71, 2, 0, PI, 'display_wall');
m.prop('nt_boulder_tall', [80, 0, 46], 0.3, 1).prop('nt_rock_moss', [72, 0, 41], 1.2, 1);
// The gem gallery: cases in the dark.
cases(52, 64, 60, 64, 3, 0, 0);
cases(49, 66.9, 63, 66.9, 3, 0, PI, 'display_wall');
for (const x of [52, 56, 60]) m.light([x, 3.4, 64], { color: '#b8d0ff', intensity: 0.9, range: 7, fixture: 'strip' });
// Upstairs in the museum: the research library over hall A, a lab over hall B.
m.dress({ x0: 4, y0: 6, x1: 5, y1: 7, z: 1 }, 'library', { density: 'normal' });
m.dress({ x0: 9, y0: 6, x1: 10, y1: 7, z: 1 }, 'lab', { density: 'normal' });
m.dress({ x0: 6, y0: 8, x1: 8, y1: 8, z: 1 }, 'lobby', { density: 'sparse' });
// The air-and-space wings: the museum shop and the food court.
m.dress({ x0: 4, y0: -7, x1: 4, y1: -5, z: 0 }, 'shop', { density: 'normal' });
m.dress({ x0: 10, y0: -7, x1: 10, y1: -5, z: 0 }, 'dining', { density: 'normal' });
// The Capitol: chambers with rows of desks, lobbies, offices and committee rooms upstairs.
const capRooms: [{ x0: number; y0: number; x1: number; y1: number; z: number }, RoomType][] = [
  [{ x0: 14, y0: 3, x1: 17, y1: 4, z: 0 }, 'classroom'],
  [{ x0: 14, y0: -4, x1: 17, y1: -3, z: 0 }, 'classroom'],
  [{ x0: 14, y0: -1, x1: 14, y1: 1, z: 0 }, 'lobby'],
  [{ x0: 18, y0: -1, x1: 18, y1: 1, z: 0 }, 'lobby'],
  [{ x0: 18, y0: 4, x1: 18, y1: 4, z: 0 }, 'office'],
  [{ x0: 18, y0: -4, x1: 18, y1: -4, z: 0 }, 'office'],
  [{ x0: 18, y0: 2, x1: 18, y1: 2, z: 0 }, 'office'],
  [{ x0: 18, y0: -2, x1: 18, y1: -2, z: 0 }, 'office'],
  [{ x0: 14, y0: 3, x1: 17, y1: 4, z: 1 }, 'conference'],
  [{ x0: 14, y0: -4, x1: 17, y1: -3, z: 1 }, 'library'],
  [{ x0: 14, y0: -1, x1: 14, y1: 1, z: 1 }, 'office'],
  [{ x0: 18, y0: -1, x1: 18, y1: 1, z: 1 }, 'office'],
  [{ x0: 18, y0: 2, x1: 18, y1: 2, z: 1 }, 'office'],
  [{ x0: 18, y0: -2, x1: 18, y1: -2, z: 1 }, 'office'],
];
for (const [room, type] of capRooms) m.dress(room, type, { density: 'normal' });
// Statues along the Capitol corridors (statuary hall).
for (const s of [1, -1]) for (const x of [112, 128]) m.prop('rn_statue_stag', [x, 0, s * 18.6], s > 0 ? PI : 0, 0.9);

m.lightRooms({ color: '#ffe9c4', intensity: 0.9 });
for (const [x, z] of [[128, 0], [56, 48]] as const) m.light([x, 9, z], { color: '#fff4e0', intensity: 1.2, range: 18, fixture: 'none' });

m.bounds('invisible', 0, { min: [-158, -78], max: [158, 78] });
m.meta({
  description:
    'A scaled-down look-alike of the National Mall: 300 m of lawn, gravel walks and elm rows from a domed capitol at the east end to a columned memorial with its great seated statue at the west, past a 44 m obelisk you can climb inside to a sniper deck, and a reflecting pool lined with cherry blossom. Fight through the capitol\'s rotunda and chambers, the natural-history museum (a mammoth in the rotunda, a theropod in the fossil hall) and the air-and-space museum, where the flyers on show can be taken out through the glass front. The Capitol team holds the east end, the Memorial team the west.',
  modes: ['core.ctf', 'core.tdm', 'core.koth', 'core.deathmatch', 'core.elim'],
  players: [16, 32],
});
console.log(`capitol_mall: ${nBlocks} blocks`);
await m.save();
