/**
 * Undergate Transit: the transit hub of an underground research facility
 * (our own map and name), for 6–14 players in Deathmatch, Team Deathmatch and
 * King of the Hill. A huge rock cavern under a 22 m ceiling, ringed by an
 * elevated monorail beam 8 m up. Two hover cars (the track's ambient
 * speeders) lap the beam all match: they belong to nobody and run down anyone
 * standing on it, and they can be shot up or hijacked (wrecks come back at the
 * depot siding on the south straight).
 *
 * - Central Station (south): a three-storey station block. The lower platform
 *   (street level) runs beside parked subway cars under the beam; the
 *   concourse, the ticket offices and the waiting room stack up behind it,
 *   joined by two stairwells; the upper monorail platform opens straight onto
 *   the beam. Elevator shafts at both ends of the lower platform (jump pads)
 *   fire you up onto the upper platform.
 * - Security Checkpoint (north): glass-fronted screening hall (shoot the panes
 *   out), security offices above and the north monorail platform on top,
 *   with the maintenance tunnel running the length of the cavern behind it.
 * - Control tower (centre): the screening lobby, offices and, 8 m up, the
 *   traffic control room with windows all round and catwalk bridges north
 *   and south onto the beam. Its console slams the hazard vault's blast
 *   doors (loading docks) shut and locks them for 20 s: trap whoever is
 *   inside, or keep the rockets to yourself.
 * - Loading docks (east): two dock halls of crates and shelving behind wide
 *   loading bays, the hazard vault between them behind blast doors (rockets
 *   and armour).
 * - Toxic waste (west, inside the loop): two acid pools with railed catwalks
 *   across them. Sector C rail yard (west, outside the loop): parked trams and
 *   freight on the old line.
 * - Jump pads round the loop launch you from the cavern floor onto the beam.
 *
 * Grid x east, y north (one cell = 8 m); levels z0 (y 0), z1 (4), z2 (8).
 * The cavern is cells x -9..9, y -6..6 (x -76..76, z -52..52).
 *
 *   y  6   [pump] ========= maintenance tunnel (z0) ========= [pump]
 *   y  5    .  .  .  [S][ checkpoint / offices / N platform ][S]  .  .  .
 *   y  4    .  ( =============== monorail beam (8 m) =============== )  .
 *   y  1..3  rail   |  pool B   .   bridge     .   crates   |  dock B
 *   y  0     yard  ||  catwalk  .  [ TOWER ]   .   crates   || VAULT
 *   y -1..-3        |  pool A   .   bridge     .   crates   |  dock A
 *   y -4    .  ( =============== monorail beam (8 m) =============== )  .
 *   y -5    .  .  [E][ lower platform (z0) / upper platform (z2) ][E]  .
 *   y -6    .  .  [S][ concourse / ticket offices / waiting room  ][S] .
 *          x -9    -7  -5            0             5    7     9
 *
 *   S stairwells, E elevator shafts (pads), || the beam's west and east legs.
 */
import { Track, TrackGeometry, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Rotation, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('undergate_transit', 'Undergate Transit');
m.theme('lab');
m.backdrop('night', 'none', 'none', 0.35, 0.25);
m.teams([7, 7]);
const [SOUTH, NORTH] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Difference between two headings, wrapped to [0, π]. */
const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
/** A solid block from corner to corner (split to the block size limits). */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, look: Look): void {
  const w = x1 - x0;
  const d = z1 - z0;
  const h = y1 - y0;
  if (w > 64 || d > 64 || h > 32) {
    const nx = Math.ceil(w / 64);
    const nz = Math.ceil(d / 64);
    const ny = Math.ceil(h / 32);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (let k = 0; k < ny; k++) box(x0 + (w * i) / nx, x0 + (w * (i + 1)) / nx, y0 + (h * k) / ny, y0 + (h * (k + 1)) / ny, z0 + (d * j) / nz, z0 + (d * (j + 1)) / nz, look);
    return;
  }
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(w), r2(h), r2(d)], 'solid', look);
}
/** A block along the line from (xa, za) to (xb, zb), `width` across it. */
function beam(xa: number, za: number, xb: number, zb: number, width: number, y0: number, y1: number, look: Look, extra = 0): void {
  const dx = xb - xa;
  const dz = zb - za;
  m.block([r2((xa + xb) / 2), r2(y0), r2((za + zb) / 2)], [r2(Math.hypot(dx, dz) + extra), r2(y1 - y0), r2(width)], 'solid', { ...look, yaw: +Math.atan2(-dz, dx).toFixed(4) });
}

// ---------------------------------------------------------------- looks

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const ROCK: Look = { material: 'pbr_rock', tint: '#6e6a64' };
const ROCK_DARK: Look = { material: 'pbr_rock', tint: '#4e4b47' };
const CONCRETE: Look = { material: 'pbr_concrete', tint: '#9a9a94' };
const STEEL: Look = { material: 'pbr_steel', tint: '#6a7078' };
const GIRDER: Look = { material: 'pbr_steel', tint: '#3d4248' };
const HAZARD: Look = { material: 'hazard' };
const YELLOW: Look = { material: 'paint_matte', tint: '#e8c020' };
const GRATE: Look = { material: 'grate' };
const CAVERN: TileSurfaces = { floor: mat('pbr_concrete_dark', '#7a7c7e'), walls: mat('pbr_concrete', '#9a9890'), underside: mat('pbr_concrete_dark') };
const STATION: TileSurfaces = { floor: mat('pbr_terrazzo', '#cfcabe'), walls: mat('pbr_white_panel', '#d8dcd8'), solids: mat('pbr_steel', '#8a9098'), underside: mat('pbr_concrete'), trim: mat('pbr_steel', '#5a6068') };
const PLATFORM: TileSurfaces = { floor: mat('pbr_walkway'), walls: mat('pbr_white_panel', '#c8ccc8'), underside: mat('pbr_steel', '#4a4e54'), trim: mat('hazard') };
const SECURITY: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_white_panel', '#b8c4cc'), underside: mat('pbr_concrete'), trim: mat('light_strip', '#9fd8ff') };
const TUNNEL: TileSurfaces = { floor: mat('grate'), walls: mat('pbr_concrete', '#8c8a80'), underside: mat('pbr_concrete_dark'), trim: mat('hazard') };
const DOCK: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_corrugated', '#8a949e'), underside: mat('pbr_steel'), trim: mat('hazard') };
const CONTROL: TileSurfaces = { floor: mat('pbr_tread_plate', '#8a8c90'), walls: mat('pbr_white_panel', '#e0e4e8'), solids: mat('circuit'), underside: mat('pbr_concrete'), trim: mat('light_strip', '#7fd8ff') };
const RAILBED: TileSurfaces = { floor: mat('pbr_gravel'), walls: mat('pbr_concrete', '#8c8a80') };

// ---------------------------------------------------------------- tiles

const taken = new Set<string>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
function place(kind: string, x: number, y: number, z: number, surf: TileSurfaces, rot: Rotation = 0, opts?: RoomOptions): void {
  m.tile(kind, x, y, z, rot, opts);
  const tall = kind === 'stairwell' || kind === 'stairs' || kind === 'stairs_open';
  for (const dz of tall ? [0, 1] : [0]) {
    const k = key(x, y, z + dz);
    if (taken.has(k)) throw new Error(`cell ${k} placed twice`);
    taken.add(k);
  }
  paint(x, y, z, surf);
}
const EMPTY: RoomOptions = { layout: 'empty' };
const ROOFED: RoomOptions = { layout: 'empty', ceiling: 'roof' };
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);

// Central Station (south): concourse z0, ticket offices z1, waiting room z2 along row -6;
// the lower platform (z0) and the upper monorail platform (z2) along row -5.
for (let x = -3; x <= 3; x++) {
  place('room', x, -6, 0, STATION, 0, EMPTY);
  place('room', x, -6, 1, STATION, 0, EMPTY);
  place('room', x, -6, 2, STATION, 0, ROOFED);
  place('platform', x, -5, 0, PLATFORM);
  place('platform_rail', x, -5, 2, PLATFORM);
}
place('stairwell', -4, -6, 0, STATION, 2); // doors east on z0 and z1
place('room', 4, -6, 0, STATION, 0, EMPTY); // station store, under the east stairwell
place('stairwell', 4, -6, 1, STATION, 0); // doors west on z1 and z2
// Elevator shafts at both ends of the lower platform: open to the cavern roof, a pad inside.
place('room', -4, -5, 0, STATION, 0, EMPTY);
place('room', 4, -5, 0, STATION, 0, EMPTY);

// Security Checkpoint (north): screening hall z0, offices z1, north monorail platform z2 (row 5).
for (let x = -2; x <= 2; x++) {
  place('room', x, 5, 0, SECURITY, 0, EMPTY);
  place('room', x, 5, 1, SECURITY, 0, EMPTY);
  place('platform_rail', x, 5, 2, PLATFORM);
}
place('stairwell', -3, 5, 0, SECURITY, 2); // doors east on z0 and z1
place('room', 3, 5, 0, SECURITY, 0, EMPTY); // armoury, under the east stairwell
place('stairwell', 3, 5, 1, SECURITY, 0); // doors west on z1 and z2
// The maintenance tunnel behind it, the length of the cavern, with pump rooms at its ends.
for (let x = -8; x <= 8; x++) place('corridor', x, 6, 0, TUNNEL, 1);
place('room', -9, 6, 0, TUNNEL, 0, ROOFED);
place('room', 9, 6, 0, TUNNEL, 0, ROOFED);

// The control tower (centre): screening lobby z0, offices z1, traffic control z2.
for (let x = -1; x <= 1; x++)
  for (let y = -1; y <= 1; y++) {
    if (!(x === -1 && y === 0)) place('room', x, y, 0, CONTROL, 0, EMPTY);
    if (!(x === -1 && y === 0) && !(x === 1 && y === 0)) place('room', x, y, 1, CONTROL, 0, EMPTY);
    if (!(x === 1 && y === 0)) place('room', x, y, 2, CONTROL, 0, ROOFED);
  }
place('stairwell', -1, 0, 0, CONTROL, 2); // doors east on z0 and z1
place('stairwell', 1, 0, 1, CONTROL, 0); // doors west on z1 and z2
// Catwalk bridges from the control room onto the beam, north and south.
for (const y of [2, 3, -2, -3]) place('bridge', 0, y, 2, PLATFORM);

// Loading docks (east): dock halls A (south) and B (north), the hazard vault between.
for (let y = -3; y <= 3; y++) place('room', 9, y, 0, DOCK, 0, ROOFED);

// Toxic waste pools (no floor tiles: basins built below).
const POOLS = [
  { x0: -5, x1: -4, y0: -2, y1: -1 },
  { x0: -5, x1: -4, y0: 1, y1: 2 },
];
const inPool = (x: number, y: number) => POOLS.some((p) => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1);

// The cavern floor: open platform tiles everywhere else.
const RAILYARD = (x: number, y: number) => x === -9 && y >= -3 && y <= 3;
for (let x = -9; x <= 9; x++)
  for (let y = -6; y <= 6; y++) {
    if (taken.has(key(x, y, 0)) || inPool(x, y)) continue;
    place('platform', x, y, 0, RAILYARD(x, y) ? RAILBED : CAVERN);
  }

// ---------------------------------------------------------------- walls and openings

// Central Station.
for (let x = -3; x <= 3; x++) {
  if (x < 3) for (const z of [0, 1, 2]) edge(x, -6, z, 'E', 'open');
  edge(x, -6, 0, 'N', x === -2 || x === 0 || x === 2 ? 'door' : 'window'); // concourse onto the lower platform
  edge(x, -6, 1, 'N', 'windows'); // ticket offices look down on the lower platform
  edge(x, -6, 2, 'N', x === -3 || x === 3 ? 'window' : x === 0 ? 'wide' : 'door'); // waiting room onto the upper platform
  edge(x, -5, 2, 'N', 'open'); // the upper platform edge: straight onto the beam
}
edge(-3, -5, 2, 'W', 'open').edge(3, -5, 2, 'E', 'open'); // where the elevator pads land
edge(-4, -5, 0, 'E', 'door').edge(4, -5, 0, 'W', 'door'); // elevator shafts off the lower platform
edge(-4, -5, 0, 'S', 'wall').edge(4, -5, 0, 'S', 'wall');
edge(4, -6, 0, 'W', 'door'); // station store
edge(-3, -5, 0, 'W', 'door').edge(3, -5, 0, 'E', 'door');

// Security Checkpoint: glass along the cavern side, doors through to the tunnel.
for (let x = -2; x <= 2; x++) {
  if (x < 2) for (const z of [0, 1]) edge(x, 5, z, 'E', 'open');
  edge(x, 5, 0, 'S', x === 0 ? 'wide' : 'window');
  edge(x, 5, 0, 'N', x === -1 || x === 1 ? 'door' : 'wall');
  edge(x, 5, 1, 'S', 'windows');
  edge(x, 5, 2, 'S', 'open'); // north platform edge onto the beam
}
edge(2, 5, 0, 'E', 'wall');
edge(3, 5, 0, 'S', 'door').edge(3, 5, 0, 'N', 'door').edge(3, 5, 0, 'W', 'wall');
// The maintenance tunnel: doors out into the cavern and the pump rooms.
for (const x of [-7, -5, 5, 7]) edge(x, 6, 0, 'S', 'door');
edge(-9, 6, 0, 'S', 'door').edge(9, 6, 0, 'S', 'door');

// The control tower.
for (const [x, y, side] of [[0, -1, 'S'], [0, 1, 'N']] as const) edge(x, y, 0, side, 'door');
for (const [x, y, side] of [[-1, -1, 'S'], [1, -1, 'S'], [-1, 1, 'N'], [1, 1, 'N']] as const) edge(x, y, 0, side, 'window');
for (const y of [-1, 1]) {
  edge(-1, y, 0, 'W', 'window').edge(1, y, 0, 'E', 'window');
  edge(-1, y, 0, 'E', 'open').edge(0, y, 0, 'E', 'open');
  edge(-1, y, 1, 'E', 'open').edge(0, y, 1, 'E', 'open');
  edge(-1, y, 2, 'E', 'open').edge(0, y, 2, 'E', 'open');
}
edge(1, 0, 0, 'E', 'door');
// The screening line: glass between the halves of the lobby (the west stairwell keeps its walls).
for (const x of [0, 1]) {
  edge(x, -1, 0, 'N', x === 0 ? 'open' : 'windows');
  edge(x, 0, 0, 'N', x === 0 ? 'open' : 'windows');
}
for (const x of [-1, 0, 1]) {
  if (x === 0) edge(x, -1, 1, 'N', 'open').edge(x, 0, 1, 'N', 'open');
  if (x !== 1) edge(x, -1, 2, 'N', 'open').edge(x, 0, 2, 'N', 'open');
}
edge(0, 0, 1, 'E', 'door').edge(0, 0, 1, 'W', 'door');
for (const z of [1, 2]) {
  for (const x of [-1, 0, 1]) {
    edge(x, -1, z, 'S', z === 2 && x === 0 ? 'door' : 'windows');
    edge(x, 1, z, 'N', z === 2 && x === 0 ? 'door' : 'windows');
  }
  for (const y of [-1, 0, 1]) {
    if (!(z === 1 && y === 0)) edge(-1, y, z, 'W', 'windows');
    if (!(y === 0)) edge(1, y, z, 'E', 'windows');
  }
}
edge(-1, 0, 2, 'E', 'open');

// Loading docks: wide bays onto the apron; the vault between them behind its blast doors.
for (let y = -3; y <= 3; y++) edge(9, y, 0, 'W', y === -3 || y === -1 || y === 1 || y === 3 ? 'wide' : y === 0 ? 'wall' : 'window');
for (const y of [-3, -2, 1, 2]) edge(9, y, 0, 'N', 'open');
edge(9, 0, 0, 'N', 'door').edge(9, 0, 0, 'S', 'door');

// ---------------------------------------------------------------- the cavern: rock walls and roof

const ROOF = 22;
box(-84, -76, -1, ROOF, -60, 60, ROCK);
box(76, 84, -1, ROOF, -60, 60, ROCK);
box(-76, 76, -1, ROOF, -60, -52, ROCK);
box(-76, 76, -1, ROOF, 52, 60, ROCK);
box(-84, 84, ROOF, ROOF + 3, -60, 60, ROCK_DARK);
// Buttresses and rock falls along the walls.
for (const x of [-60, -36, 36, 60]) {
  box(x - 3, x + 3, 12, ROOF, -52, -49, ROCK_DARK);
  box(x - 3, x + 3, 12, ROOF, 49, 52, ROCK_DARK);
}
for (const z of [-28, 28]) {
  box(-76, -73, 12, ROOF, z - 3, z + 3, ROCK_DARK);
  box(73, 76, 12, ROOF, z - 3, z + 3, ROCK_DARK);
}
// Roof ribs (steel trusses under the rock) and hanging stalactites.
for (const x of [-48, -16, 16, 48]) box(x - 0.4, x + 0.4, ROOF - 1.2, ROOF, -52, 52, GIRDER);
for (const [x, z, h] of [[-20, 12, 5], [24, -12, 4], [-52, -40, 6], [56, 40, 5], [8, 44, 4], [-8, -44, 3]] as const) box(x - 1.5, x + 1.5, ROOF - h, ROOF, z - 1.5, z + 1.5, ROCK_DARK);

// ---------------------------------------------------------------- toxic waste pools

const POOL_FLOOR = -1.4;
for (const p of POOLS) {
  const x0 = p.x0 * 8 - 4;
  const x1 = p.x1 * 8 + 4;
  const z0 = p.y0 * 8 - 4;
  const z1 = p.y1 * 8 + 4;
  box(x0, x1, POOL_FLOOR - 0.4, POOL_FLOOR, z0, z1, CONCRETE);
  // Rims inside the cells (the floor tiles round them end at the cell edges), hazard paint on top.
  box(x0, x0 + 0.4, POOL_FLOOR, 0, z0, z1, CONCRETE);
  box(x1 - 0.4, x1, POOL_FLOOR, 0, z0, z1, CONCRETE);
  box(x0 + 0.4, x1 - 0.4, POOL_FLOOR, 0, z0, z0 + 0.4, CONCRETE);
  box(x0 + 0.4, x1 - 0.4, POOL_FLOOR, 0, z1 - 0.4, z1, CONCRETE);
  m.water([(x0 + x1) / 2, POOL_FLOOR, (z0 + z1) / 2], [x1 - x0 - 0.8, 1.05, z1 - z0 - 0.8], 'acid');
  // Climb-out steps in two corners.
  box(x0 + 0.4, x0 + 1.8, POOL_FLOOR, -0.7, z0 + 0.4, z0 + 2.8, HAZARD);
  box(x1 - 1.8, x1 - 0.4, POOL_FLOOR, -0.7, z1 - 2.8, z1 - 0.4, HAZARD);
  // A railed grating catwalk across the middle (north-south), on legs.
  box(-37, -35, -0.25, 0, z0, z1, GRATE);
  box(-37.2, -37, 0, 1.05, z0 + 1.5, z1 - 1.5, STEEL);
  box(-35, -34.8, 0, 1.05, z0 + 1.5, z1 - 1.5, STEEL);
  for (const z of [z0 + 4, (z0 + z1) / 2, z1 - 4]) box(-36.3, -35.7, POOL_FLOOR, -0.25, z - 0.3, z + 0.3, GIRDER);
  // Hazard trim round the rim.
  box(x0, x1, 0, 0.12, z0, z0 + 0.4, YELLOW);
  box(x0, x1, 0, 0.12, z1 - 0.4, z1, YELLOW);
  box(x0, x0 + 0.4, 0, 0.12, z0 + 0.4, z1 - 0.4, YELLOW);
  box(x1 - 0.4, x1, 0, 0.12, z0 + 0.4, z1 - 0.4, YELLOW);
}
// The outflow pipes feeding the pools.
for (const z of [-12, 12]) {
  m.prop('big_pipe', [-46, 0, z], P);
  m.prop('pipe_valve', [-46.5, 0, z + (z > 0 ? 5 : -5)], P);
}
for (const [x, z] of [[-24.5, -18], [-25, -16], [-24.5, 18], [-25.5, 16.5], [-46, -2.5], [-46, 2.5]] as const) m.prop('sf_barrel', [x, 0, z], 0.3);
m.prop('warning_sign', [-26, 0, -6], -P).prop('warning_sign', [-26, 0, 6], -P);

// ---------------------------------------------------------------- the monorail: track, beam, pillars

/** The loop: a rounded rectangle, straights along z ±32 and x ±56, corners of 16 m radius. */
const LOOP: { len: number; at: (t: number) => [number, number] }[] = [];
const line = (ax: number, az: number, bx: number, bz: number) => LOOP.push({ len: Math.hypot(bx - ax, bz - az), at: (t) => [ax + (bx - ax) * t, az + (bz - az) * t] });
const arc = (cx: number, cz: number, a0: number, a1: number) => LOOP.push({ len: Math.abs(a1 - a0) * 16, at: (t) => [cx + 16 * Math.cos(a0 + (a1 - a0) * t), cz + 16 * Math.sin(a0 + (a1 - a0) * t)] });
line(-40, -32, 40, -32);
arc(40, -16, -P, 0);
line(56, -16, 56, 16);
arc(40, 16, 0, P);
line(40, 32, -40, 32);
arc(-40, 16, P, S);
line(-56, 16, -56, -16);
arc(-40, -16, S, S + P);
const LOOP_LEN = LOOP.reduce((s, p) => s + p.len, 0);
const loopAt = (d: number): [number, number] => {
  d = ((d % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
  for (const p of LOOP) {
    if (d <= p.len) return p.at(d / p.len);
    d -= p.len;
  }
  return LOOP[0]!.at(0);
};
const BEAM_Y = 8;
const WIDTH = 8;
const points: V3[] = [];
const n = Math.round(LOOP_LEN / 6);
for (let i = 0; i < n; i++) {
  const [x, z] = loopAt(56 + (i * LOOP_LEN) / n); // from x 16 on the south straight, heading east
  points.push([r2(x), BEAM_Y, r2(z)]);
}
const track = Track.parse({
  points,
  width: WIDTH,
  loop: true,
  laps: 3,
  grid: 14,
  vehicle: 'speeder',
  combat: false,
  surface: 'asphalt',
  curbs: false,
  ambient: 2,
  ambientVehicle: 'speeder',
  pit: [36, BEAM_Y, -32],
});
m.track(track);
const g = new TrackGeometry(track);

// The deck: one block per straight run of the centre line, short turned blocks round the bends.
const BEAM_LOOK: Look = { material: 'pbr_concrete', tint: '#8e9094' };
const smp = g.samples;
{
  let i = 0;
  while (i < smp.length) {
    const a = smp[i]!;
    const head = (k: number) => {
      const p = smp[k % smp.length]!;
      const q = smp[(k + 1) % smp.length]!;
      return Math.atan2(q.z - p.z, q.x - p.x);
    };
    const h0 = head(i);
    let j = i + 1;
    while (j < smp.length && turn(head(j), h0) < 0.004 && Math.hypot(smp[j % smp.length]!.x - a.x, smp[j % smp.length]!.z - a.z) < 56) j++;
    const b = smp[j % smp.length]!;
    const straight = j - i > 1;
    beam(a.x, a.z, b.x, b.z, WIDTH, BEAM_Y - 0.6, BEAM_Y, BEAM_LOOK, straight ? 0.6 : 0.9);
    i = j;
  }
}
// Railings along both edges, left open where platforms and catwalks meet the beam.
const GAPS: { x0: number; x1: number; z0: number; z1: number }[] = [
  { x0: -29, x1: 29, z0: -38, z1: -35 }, // Central Station upper platform
  { x0: -21, x1: 21, z0: 35, z1: 38 }, // north platform
  { x0: -2.5, x1: 2.5, z0: 26, z1: 30 }, // control-room catwalk, north
  { x0: -2.5, x1: 2.5, z0: -30, z1: -26 }, // control-room catwalk, south
];
const inGap = (x: number, z: number) => GAPS.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
for (const side of [-1, 1]) {
  const off = side * (WIDTH / 2 - 0.15);
  const pts = smp.map((p) => [p.x + p.dz * off, p.z - p.dx * off] as [number, number]);
  let i = 0;
  while (i < pts.length) {
    const a = pts[i]!;
    const h0 = Math.atan2(pts[(i + 1) % pts.length]![1] - a[1], pts[(i + 1) % pts.length]![0] - a[0]);
    let j = i + 1;
    while (j < pts.length && turn(Math.atan2(pts[(j + 1) % pts.length]![1] - pts[j]![1], pts[(j + 1) % pts.length]![0] - pts[j]![0]), h0) < 0.004 && Math.hypot(pts[j]![0] - a[0], pts[j]![1] - a[1]) < 6) j++;
    const b = pts[j % pts.length]!;
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!inGap(mid[0], mid[1]) && !inGap(a[0], a[1]) && !inGap(b[0], b[1])) beam(a[0], a[1], b[0], b[1], 0.3, BEAM_Y, BEAM_Y + 1.1, YELLOW, 0.1);
    i = j;
  }
}
// Pillars under the beam every 16 m, with a cross-head under the deck.
for (let s = 8; s < g.length; s += 16) {
  const p = g.at(s);
  const yaw = +Math.atan2(-p.dz, p.dx).toFixed(4);
  m.block([r2(p.x), 0, r2(p.z)], [1.3, BEAM_Y - 0.6, 1.3], 'solid', { ...GIRDER, yaw });
  m.block([r2(p.x), BEAM_Y - 1.4, r2(p.z)], [1.6, 0.8, WIDTH - 1], 'solid', { ...GIRDER, yaw });
  m.light([r2(p.x), BEAM_Y - 1.6, r2(p.z)], { fixture: 'none', color: '#ffd9a0', intensity: 1.1, range: 14 });
}

// ---------------------------------------------------------------- rolling stock and the rail yard

// Subway cars parked beside the lower platform, under the beam (the old line).
for (const x of [-22, -14, 8, 16]) m.prop('subway_car', [x, 0, -34.6], P);
for (const x of [-26, -18, -10, -2, 6, 14, 22]) m.prop('rail_track', [x, 0, -34.6], P);
// Sector C rail yard (west): trams and freight on the old line.
for (const z of [-26, -18, -10, -2, 6, 14, 22]) m.prop('rail_track', [-72, 0, z], 0);
m.prop('tram', [-72, 0, -20], 0).prop('tram', [-72, 0, -15.5], 0).prop('locomotive', [-72, 0, 4], 0).prop('flatbed_car', [-72, 0, 12], 0).prop('tank_car', [-72, 0, 20], 0);
m.prop('container_car_blue', [-72, 0, -6], 0);
m.prop('lever', [-66, 0, -24], P).prop('signpost', [-65, 0, 26], P).prop('barrier', [-66, 0, 0], 0);

// ---------------------------------------------------------------- the docks, the yard and the cavern floor

// Dock apron (east, between the beam and the dock halls): containers and crates.
m.prop('container', [64, 0, -26], 0).prop('container_tall', [64.5, 0, 22], 0).prop('cargo_crate', [62, 0, -10], 0.2).prop('cargo_crate', [63, 0, 12], -0.1);
m.prop('crate_large', [66, 0, -6], 0).prop('crate_large', [66.5, 0, 6.5], 0.3).prop('factory_box_long', [60.5, 0, 0], 0);
// Inner east: a field of crates and shelving (the loading area inside the loop).
for (const [x, z, yaw, model] of [
  [28, -18, 0, 'container'], [40, -6, P, 'container_wide'], [28, 14, 0.2, 'cargo_crate'], [42, 18, 0, 'crate_large'], [34, 4, 0.4, 'factory_box'],
  [24, -4, 0, 'crate_large'], [44, -20, 0.1, 'cargo_crate'], [20, 20, 0, 'metal_crate'], [36, -14, 0, 'crate_small'], [37, -13, 0.3, 'crate_small'],
] as const) m.prop(model, [x, 0, z], yaw);
m.breakable('crate', [30, 0, 0]).breakable('crate', [31.5, 0, 1]).breakable('barrel', [22, 0, 10]).breakable('barrel', [46, 0, 6]);
m.breakable('gas', [41, 0, 24]).breakable('gas', [-30, 0, 24]);
// Around the cavern floor.
m.prop('hopper_tall', [68, 0, -44], 0).prop('hopper_tall', [62, 0, -46], 0).prop('machine', [70, 0, 44], S).prop('conveyor', [-66, 0, 44], P);
m.prop('machine', [-70, 0, -44], 0);
m.prop('container', [-60, 0, -44], P).prop('crate_large', [-50, 0, -46], 0.2).prop('crate_small', [-48, 0, -45], 0.1);
m.prop('container_tall', [-62, 0, 44], P).prop('factory_box', [-48, 0, 46], 0).prop('cargo_crate', [48, 0, 45], 0.2).prop('crate_large', [56, 0, 46], 0);
m.prop('barrier_high', [-14, 0, 22], 0).prop('barrier_high', [14, 0, -22], 0).prop('barrier', [-14, 0, -22], 0).prop('barrier', [14, 0, 22], 0);
m.prop('scanner', [0, 0, 24], 0).prop('computer_bank', [-30, 0, 44], S).prop('computer_bank', [30, 0, 44], S);
m.breakable('generator', [-8, 0, 46], S);

// ---------------------------------------------------------------- doors, the console and the vault

const door = (id: string, name: string, pos: V3, yaw: number, locked = false) => m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked, auto: true });
door('door_vault_s', 'Vault blast door (south)', [72, 0, -4], 0);
door('door_vault_n', 'Vault blast door (north)', [72, 0, 4], 0);
door('door_tower_s', 'Control tower (south door)', [0, 0, -12], 0);
door('door_tower_n', 'Control tower (north door)', [0, 0, 12], 0);
m.add({ kind: 'button', id: 'btn_vault', name: 'Traffic control console', position: at(-1, 1, 2, -1.5, 3.2), yaw: S, label: 'Seal the hazard vault', once: false, cooldownSeconds: 1, startEnabled: true });
m.light(at(-1, 1, 2, -1.5, 3.4, 2.2), { fixture: 'wall', color: '#ff3a2a', intensity: 0.9, range: 4, yaw: S });
for (const z of [-4.3, 4.3]) m.light([70.5, 3.3, z], { fixture: 'wall', color: '#ffb040', intensity: 1, range: 6, yaw: z > 0 ? 0 : S });

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
const VAULT = ['door_vault_s', 'door_vault_n'];
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Undergate Transit. Keep clear of the monorail beam: cars do not stop.', 4)]),
    rule('rule_vault', 'Hazard vault lockdown', { event: 'button_pressed', target: 'btn_vault' }, [
      act('disable', 'btn_vault'),
      act('sound', null, { state: 'alarm' }),
      say('Containment breach: hazard vault blast doors sealed for 20 seconds.', 3),
      ...VAULT.flatMap((d) => [act('door_close', d), act('door_lock', d)]),
      act('wait', null, { value: 20 }),
      act('sound', null, { state: 'chime' }),
      ...VAULT.flatMap((d) => [act('door_unlock', d)]),
      say('Hazard vault blast doors released.', 2),
      act('wait', null, { value: 25 }),
      act('enable', 'btn_vault'),
    ]),
  ],
});

// ---------------------------------------------------------------- glass at the checkpoints

const pane = (x: number, y: number, z: number, side: Side) => {
  const [dx, dy] = side === 'N' ? [0, 4] : side === 'S' ? [0, -4] : side === 'E' ? [4, 0] : [-4, 0];
  m.add({ kind: 'destructible', name: 'Window pane', model: 'glass', position: at(x, y, z, dx, dy), yaw: side === 'N' || side === 'S' ? 0 : P, health: null, explosiveOnly: false });
};
for (const x of [-2, -1, 1, 2]) pane(x, 5, 0, 'S');
for (const [x, y, side] of [[-1, -1, 'S'], [1, -1, 'S'], [-1, 1, 'N'], [1, 1, 'N'], [-1, -1, 'W'], [-1, 1, 'W'], [1, -1, 'E'], [1, 1, 'E']] as const) pane(x, y, 0, side);
for (const x of [-3, -1, 1, 3]) pane(x, -6, 0, 'N');

// ---------------------------------------------------------------- jump pads

// Elevator shafts: from the shaft floor up onto the upper platform.
m.padTo(at(4, -5, 0, 1, 0), at(3, -5, 2, 1.5, 0), 22);
m.padTo(at(-4, -5, 0, -1, 0), at(-3, -5, 2, -1.5, 0), 22);
// Onto the beam from the cavern floor (inside the loop, both straights and both legs).
m.padTo([-24, 0, -22], [-24, BEAM_Y, -32], 22);
m.padTo([24, 0, 22], [24, BEAM_Y, 32], 22);
m.padTo([46, 0, 4], [56, BEAM_Y, 4], 22);
m.padTo([-46, 0, -4], [-56, BEAM_Y, -4], 22);

// ---------------------------------------------------------------- objectives, spawns and pickups

// King of the Hill: traffic control, the acid catwalk, the dock apron, the upper platform.
m.hill(at(0, 0, 2, -3, 0), 4);
m.hill([-36, 0, 0], 5);
m.hill([62, 0, 0], 5);
m.hill(at(0, -5, 2), 5);

// South team: the station concourse and ticket offices.
for (const [p, yaw] of [
  [at(-3, -6, 0, 0, -1), 0], [at(-1, -6, 0, 0, -1), 0], [at(1, -6, 0, 0, -1), 0], [at(3, -6, 0, 0, -1), 0],
  [at(-2, -6, 1, 0, -1), 0], [at(0, -6, 1, 0, -1), 0], [at(2, -6, 1, 0, -1), 0],
] as [V3, number][]) m.spawn(p, yaw, SOUTH);
// North team: the maintenance tunnel and the screening hall.
for (const [p, yaw] of [
  [at(-6, 6, 0), S], [at(-3, 6, 0), S], [at(0, 6, 0), S], [at(3, 6, 0), S], [at(6, 6, 0), S],
  [at(-1, 5, 1, 0, 1.5), S], [at(1, 5, 1, 0, 1.5), S],
] as [V3, number][]) m.spawn(p, yaw, NORTH);
// Everyone else (deathmatch): round the whole cavern.
for (const [p, yaw] of [
  [at(-8, 0, 0), P], [at(-8, -3, 0), P], [at(-8, 3, 0), P], [at(9, -2, 0, 0, 0), -P], [at(9, 2, 0), -P], [at(8, -5, 0), 0],
  [at(-7, -6, 0), 0], [at(7, -6, 0), 0], [at(-7, 5, 0), S], [at(7, 5, 0), S], [at(-9, 6, 0), S], [at(9, 6, 0), S],
  [at(0, -1, 1, 0, -1), 0], [at(-3, 0, 0), P], [at(3, 0, 0), -P], [at(-1, -6, 2, 0, -1), 0], [at(4, -6, 0), P],
] as [V3, number][]) m.spawn(p, yaw, null);

// Weapons: SMGs and shotguns low, rifles at the stations, the sniper in traffic control,
// rockets and heavy armour in the hazard vault, the railgun out on the beam.
m.pickup('weapon_rockets', [72, 0, -1.5]).pickup('armor_large', [72, 0, 1.5]).pickup('ammo_explosive', [74.5, 0, 0]);
m.pickup('weapon_sniper', at(1, 1, 2, 1, 1)).pickup('ammo_sniper', at(-1, -1, 2, -1, -1));
m.pickup('weapon_railgun', [-56, BEAM_Y, 0]).pickup('ammo_cells', [56, BEAM_Y, 0]);
m.pickup('weapon_smg', at(-3, -5, 0)).pickup('weapon_smg', at(0, 5, 0, 0, -1));
m.pickup('weapon_shotgun', at(-8, 6, 0)).pickup('weapon_shotgun', at(8, 6, 0)).pickup('weapon_auto_shotgun', at(9, -3, 0));
m.pickup('weapon_rifle', at(0, -5, 2)).pickup('weapon_burst_rifle', at(0, 5, 2)).pickup('weapon_marksman', at(-9, 0, 0, 2, 0));
m.pickup('weapon_lmg', [36, 0, 10]).pickup('weapon_launcher', [-36, 0, 0]).pickup('weapon_plasma', at(0, 0, 0, 0, -1));
m.pickup('ammo', at(3, -5, 0)).pickup('ammo', at(-2, 5, 1)).pickup('ammo_rifle', at(-2, -6, 2)).pickup('ammo_rifle', at(2, 5, 1));
m.pickup('ammo_shells', at(-6, 6, 0, 2, 0)).pickup('ammo_shells', at(6, 6, 0, -2, 0)).pickup('ammo_light', at(9, -1, 0)).pickup('ammo', at(9, 3, 0));
m.pickup('grenades', [-30, 0, 0]).pickup('grenades', [36, 0, -2]).pickup('grenades', at(0, 1, 1));
m.pickup('armor_small', at(-3, -6, 1)).pickup('armor_small', at(3, 5, 0)).pickup('armor_small', at(-7, -2, 0));
m.pickup('health_large', at(0, -6, 0)).pickup('health_large', at(0, 6, 0, 2, 0)).pickup('health_large', at(1, -1, 1));
for (const p of [at(-9, -5, 0), at(9, -5, 0), at(-9, 5, 0, 0, -2), at(5, 0, 0), at(-2, 0, 0, -3, 0), at(-6, 0, 0), at(6, 3, 0), at(2, -5, 2), at(-2, 5, 2), at(8, 0, 0)]) m.pickup('health_small', p);

// ---------------------------------------------------------------- dressing and light

m.dress([0, -6, 0], 'lobby', { density: 'sparse' });
m.dress({ x0: -3, y0: -6, x1: 3, y1: -6, z: 1 }, 'office', { density: 'normal' });
m.dress({ x0: -3, y0: -6, x1: 3, y1: -6, z: 2 }, 'lobby', { density: 'normal' });
m.dress({ x0: -2, y0: 5, x1: 2, y1: 5, z: 1 }, 'office', { density: 'normal' });
m.dress([3, 5, 0], 'armoury');
m.dress([4, -6, 0], 'storage');
m.dress({ x0: 9, y0: -3, x1: 9, y1: -1, z: 0 }, 'warehouse');
m.dress({ x0: 9, y0: 1, x1: 9, y1: 3, z: 0 }, 'warehouse');
m.dress({ x0: -1, y0: -1, x1: 1, y1: -1, z: 1 }, 'server', { density: 'sparse' });
m.dress({ x0: -1, y0: 1, x1: 1, y1: 1, z: 1 }, 'office', { density: 'sparse' });
m.dress({ x0: -1, y0: -1, x1: 0, y1: 1, z: 2 }, 'lab', { density: 'sparse' });
m.dress([-9, 6, 0], 'workshop');
m.dress([9, 6, 0], 'workshop');
// The traffic board in the control room and the checkpoint scanners.
m.prop('computer_wide', at(0, 1, 2, 0, 2.6), S).prop('holo_table', at(0, -1, 2, 0, 0), 0);
m.prop('scanner', at(-1, 5, 0, 0, -1.5), 0).prop('scanner', at(1, 5, 0, 0, -1.5), 0);

m.lightRooms({ color: '#e8f4ff', intensity: 1, range: 9 });
// Top-floor rooms (no floor above): the waiting room and the control room.
for (let x = -3; x <= 3; x++) m.light(at(x, -6, 2, 0, 0, 3.45), { color: '#e8f4ff', range: 9 });
for (const [x, y] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [-1, 1], [0, 1], [1, 1]] as const) m.light(at(x, y, 2, 0, 0, 3.45), { color: '#bfe8ff', range: 9 });
// Floodlights on the cavern walls, sodium lamps along the tunnel, acid glow, platform strips.
for (const x of [-60, -36, -12, 12, 36, 60]) {
  m.light([x, 14, -51.4], { fixture: 'wall', color: '#ffe2b0', intensity: 1.6, range: 26, yaw: 0 });
  m.light([x, 14, 51.4], { fixture: 'wall', color: '#ffe2b0', intensity: 1.6, range: 26, yaw: S });
}
for (const z of [-36, -12, 12, 36]) {
  m.light([-75.4, 14, z], { fixture: 'wall', color: '#ffe2b0', intensity: 1.6, range: 26, yaw: P });
  m.light([75.4, 14, z], { fixture: 'wall', color: '#ffe2b0', intensity: 1.6, range: 26, yaw: -P });
}
for (let x = -8; x <= 8; x += 2) m.light(at(x, 6, 0, 0, 0, 3.3), { fixture: 'bulb', color: '#ffb35a', intensity: 0.9, range: 9 });
for (const p of POOLS) m.light([(p.x0 + p.x1) * 4, 1.2, (p.y0 + p.y1) * 4], { fixture: 'none', color: '#8cff4a', intensity: 1.8, range: 16 });
for (let x = -3; x <= 3; x++) {
  m.light(at(x, -5, 0, 0, 0, 3.6), { fixture: 'strip', color: '#f4f8ff', intensity: 0.9, range: 9 });
  m.light(at(x, -5, 2, 0, -3, 3.2), { fixture: 'strip', color: '#f4f8ff', intensity: 0.9, range: 9 });
}
for (let x = -2; x <= 2; x++) m.light(at(x, 5, 2, 0, 3, 3.2), { fixture: 'strip', color: '#f4f8ff', intensity: 0.9, range: 9 });
for (const y of [-3, -1, 1, 3]) m.light(at(8, y, 0, 0, 0, 5), { fixture: 'none', color: '#ffd28a', intensity: 1.2, range: 12 });
for (const z of [-20, 0, 20]) m.light([-68, 5, z], { fixture: 'none', color: '#ffd28a', intensity: 1.2, range: 14 });

m.bounds('invisible', 0, { min: [-84, -60], max: [84, 60] }, 25);
m.meta({
  description:
    'The transit hub of an underground research facility: a vast rock cavern ringed by a monorail beam 8 m up, where two hover cars lap all match and run down anyone on the track. Fight across the two-level Central Station, the glass-fronted security checkpoint and the maintenance tunnel behind it, the control tower (its console seals the blast doors of the hazard vault in the loading docks, where the rockets and armour are), the toxic waste pools and the old rail yard. Jump pads and elevator shafts put you up on the beam.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [6, 14],
});
await m.save();
