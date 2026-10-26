/**
 * Runway Nine: an original airport at dusk for 8–20 players (the roadmap's
 * "airliner on the tarmac" set piece). A wide-body jet stands at gate 9 with
 * the jet bridge on its forward door. In Hostage Rescue and Bomb the
 * Hijackers start on board with the hostages and the Response team in the
 * terminal and the maintenance hangar.
 *
 * - The jet (free blocks, nose north): cockpit (bomb site A), forward galley
 *   with a hatch and ladder down to the hold, first class, the mid doors, two
 *   aisles of economy either side of the over-wing exits, the aft galley,
 *   economy behind it with a stair down to the hold, the rear lavatories.
 *   Under the cabin the cargo hold runs nose to tail (bomb site B forward),
 *   with two cargo doors and belt loaders on the right. Walk out onto either
 *   wing through the over-wing exits; maintenance stands with ladders put you
 *   on the wings from the apron. Airstairs on the left doors, a catering
 *   high-loader (ladder) on the forward right door.
 * - The doors: every cabin door is shut and locked for the first 12 s
 *   (boarding), then the left doors and the catering door open; the cockpit's
 *   emergency release opens the right doors for 20 s.
 * - The terminal (two storeys): baggage make-up opening onto the apron, the
 *   reclaim hall and the check-in hall below; the gate lounge (glass you can
 *   shoot out over the apron), shops and security above, with the jet bridge
 *   off gate 9. The curb road behind it.
 * - Around: fuel trucks (gas and drums: they blow up), baggage carts and
 *   tugs, the control tower (a sniper's cab 16 m up), the maintenance hangar
 *   with a business jet and a mezzanine, floodlight masts, the taxiway and
 *   runway lit in blue and white, and an airliner on approach overhead.
 *
 * World (x east, z north; metres). Terminal cells gx -5..3, gy 5..7 (z 36..60),
 * curb gy 8; tower cells (-8, 0..1); the jet's centreline is x 0, nose at z 27.
 *
 *   z  64   ==================== curb road ====================
 *   z  36   [ terminal: make-up / reclaim / check-in; lounge / shops / security ]
 *   z  15   tower     jet bridge ==\ L1 [cockpit]  catering truck
 *   z   0   [T]        airstair  =| L2  ( cabin )        belt loader
 *   z -20         <==== left wing ====( over-wing )==== right wing ====>   [ HANGAR ]
 *   z -28              airstair  =| L3  ( cabin )        belt loader      [ bizjet ]
 *   z -56                               tail
 *   z -90   ===================== runway 09/27 =====================
 */
import { TERRAIN_MATERIALS, newTerrain, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Rotation, type Side, type TerrainData, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('runway_nine', 'Runway Nine');
m.theme('city');
m.factions([
  { id: 'response', name: 'Response', color: '#3d7fe0', relations: {} },
  { id: 'hijackers', name: 'Hijackers', color: '#e0602a', relations: {} },
]);
m.teams([10, 10]);
const [RESPONSE, HIJACK] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
/** A solid block from corner to corner. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, look: Look) =>
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(Math.abs(x1 - x0)), r2(y1 - y0), r2(Math.abs(z1 - z0))], 'solid', look);
/** A block along the line from (xa, za) to (xb, zb), `width` across it. */
const beam = (xa: number, za: number, xb: number, zb: number, width: number, y0: number, y1: number, look: Look) => {
  const dx = xb - xa;
  const dz = zb - za;
  m.block([r2((xa + xb) / 2), r2(y0), r2((za + zb) / 2)], [r2(Math.hypot(dx, dz)), r2(y1 - y0), r2(width)], 'solid', { ...look, yaw: r2(Math.atan2(-dz, dx)) });
};
/** [a, b] with the gaps cut out. */
const spans = (a: number, b: number, gaps: [number, number][]): [number, number][] => {
  const out: [number, number][] = [];
  let from = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > from) out.push([from, Math.min(g0, b)]);
    from = Math.max(from, g1);
  }
  if (from < b) out.push([from, b]);
  return out.filter(([p, q]) => q - p >= 0.2);
};

// ---------------------------------------------------------------- looks

const WHITE: Look = { material: 'paint_gloss', tint: '#eef1f4' };
const NAVY: Look = { material: 'paint_gloss', tint: '#1d3a6b' };
const ORANGE: Look = { material: 'paint_gloss', tint: '#e0602a' };
const BELLY: Look = { material: 'paint_gloss', tint: '#b4bac4' };
const WING: Look = { material: 'pbr_steel', tint: '#c8ccd2' };
const DARK: Look = { material: 'pbr_steel', tint: '#24262a' };
const CARPET: Look = { material: 'pbr_carpet', tint: '#2a3a6a' };
const HOLD: Look = { material: 'pbr_tread_plate' };
const SEAT: Look = { material: 'pbr_canvas', tint: '#34508a' };
const SEAT_F: Look = { material: 'pbr_canvas', tint: '#7a2a3a' };
const BIN: Look = { material: 'paint_matte', tint: '#e4e2dc' };
const GALLEY: Look = { material: 'pbr_steel', tint: '#b8bcc0' };
const ULD: Look = { material: 'pbr_corrugated', tint: '#a8b0b8' };
const CONCRETE: Look = { material: 'pbr_concrete', tint: '#a8a6a0' };
const ASPHALT: Look = { material: 'pbr_asphalt' };
const PAINT_W: Look = { material: 'paint_matte', tint: '#f0f0e8' };
const PAINT_Y: Look = { material: 'paint_matte', tint: '#f0c830' };
const CORRUGATED: Look = { material: 'pbr_corrugated', tint: '#8a949e' };
const STEEL: Look = { material: 'pbr_steel', tint: '#5a6068' };

// ---------------------------------------------------------------- ground: grass, the apron, taxiway and runway

let terrain: TerrainData = { ...newTerrain(240, 2, [8, -18], 'grass'), baseY: -0.15 };
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const c = i % (terrain.cols - 1);
    const r = Math.floor(i / (terrain.cols - 1));
    const x = terrain.origin[0] + (c + 0.5) * terrain.spacing;
    const z = terrain.origin[1] + (r + 0.5) * terrain.spacing;
    return Math.abs(z + 78) < 2 && x > -96 && x < 112 ? TERRAIN_MATERIALS.indexOf('gravel') : v;
  }),
};
m.terrain(terrain);
// Concrete apron and taxiway (top at 0), the runway further south.
for (const [x0, x1] of [[-76, -12], [-12, 52], [52, 100]] as const) for (const [z0, z1] of [[-76, -12], [-12, 36]] as const) m.block([(x0 + x1) / 2, -0.15, (z0 + z1) / 2], [x1 - x0, 0.15, z1 - z0], 'solid', CONCRETE);
for (const [x0, x1] of [[-96, -44], [-44, 8], [8, 60], [60, 112]] as const) m.block([(x0 + x1) / 2, -0.15, -92], [x1 - x0, 0.15, 24], 'solid', ASPHALT);
m.block([12, -0.15, -78], [56, 0.15, 4], 'solid', ASPHALT); // the link from the taxiway onto the runway
// Markings: runway centreline and threshold bars, taxiway yellow line, the jet's stand line.
for (let x = -84; x <= 100; x += 12) m.block([x, -0.1, -92], [6, 0.11, 0.6], 'solid', PAINT_W);
for (const x of [-92, 108]) for (let k = -4; k <= 4; k++) if (k) m.block([x, -0.1, -92 + k * 2.4], [6, 0.11, 1.2], 'solid', PAINT_W);
for (let x = -72; x <= 96; x += 8) m.block([x, -0.1, -68], [5, 0.11, 0.3], 'solid', PAINT_Y);
m.block([0, -0.1, -10], [0.3, 0.11, 44], 'solid', PAINT_Y);
m.block([0, -0.1, 28], [6, 0.11, 0.3], 'solid', PAINT_Y);

// ---------------------------------------------------------------- the terminal (tiles)

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const BAGGAGE: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_concrete', '#b4b2ac'), solids: mat('pbr_steel'), trim: mat('hazard') };
const HALL: TileSurfaces = { floor: mat('pbr_terrazzo', '#d8d4cc'), walls: mat('pbr_plaster_white', '#e8e6e0'), solids: mat('pbr_steel', '#9aa0a8'), trim: mat('pbr_steel', '#6a7078') };
const LOUNGE: TileSurfaces = { floor: mat('pbr_carpet', '#3a4a6a'), walls: mat('pbr_plaster_white', '#e4e8ee'), solids: mat('pbr_steel', '#9aa0a8'), trim: mat('pbr_steel', '#6a7078') };
const SHOP: TileSurfaces = { floor: mat('pbr_floorboards'), walls: mat('pbr_plaster_white', '#f0e8d8'), trim: mat('brass') };
const TOWER: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_concrete', '#c8c4bc'), trim: mat('pbr_steel') };
const CURB: TileSurfaces = { floor: mat('pbr_asphalt'), walls: mat('pbr_concrete', '#a8a6a0') };

const cells = new Map<string, { kind: string; group: number }>();
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
  const fp: [number, number, number][] = kind === 'stairwell' ? [[0, 0, 0], [0, 0, 1]] : [[0, 0, 0]];
  for (const [dx, dy, dz] of fp) {
    const k = key(x + dx, y + dy, z + dz);
    if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
    cells.set(k, { kind, group: g });
  }
  if (o.surf) paint(x, y, z, o.surf);
}
const ROOF: RoomOptions = { ceiling: 'roof', layout: 'empty' };
const room = (x: number, y: number, z: number, surf: TileSurfaces, opts: RoomOptions = { layout: 'empty' }) => place('room', x, y, z, { surf, opts });

const SHOPS1 = new Set(['-4,6', '-3,6', '1,6', '2,6']); // duty free (2), café, newsstand
for (let x = -5; x <= 3; x++) {
  const stairs = (x === -5 || x === 3);
  room(x, 5, 0, BAGGAGE); // baggage make-up
  room(x, 6, 0, BAGGAGE); // reclaim
  if (!stairs) room(x, 7, 0, HALL); // check-in
  room(x, 5, 1, LOUNGE, ROOF); // gate lounge
  room(x, 6, 1, SHOPS1.has(`${x},6`) ? SHOP : LOUNGE, ROOF);
  if (!stairs) room(x, 7, 1, HALL, ROOF); // security
}
place('stairwell', -5, 7, 0, { rot: 2, surf: HALL }); // doors east, both floors
place('stairwell', 3, 7, 0, { rot: 0, surf: HALL }); // doors west
for (let x = -6; x <= 4; x++) place('yard', x, 8, 0, { surf: CURB });
// The control tower: two stairwells turn and turn about up to the cab at 16 m.
room(-8, 0, 0, TOWER, { layout: 'empty' });
place('stairwell', -8, 1, 0, { rot: 3, surf: TOWER });
place('stairwell', -8, 0, 1, { rot: 1, surf: TOWER });
place('stairwell', -8, 1, 2, { rot: 3, surf: TOWER });
place('stairwell', -8, 0, 3, { rot: 1, surf: TOWER });
room(-8, 1, 4, TOWER, { ceiling: 'roof', layout: 'empty' });

const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const GLASS: [number, number, number, Side][] = [];
for (let x = -5; x <= 3; x++) {
  // Ground floor: make-up hall open along, wide doors onto the apron; doors through to reclaim and check-in.
  if (x < 3) link(x, 5, 0, 'E', 'open');
  if (x < 3) link(x, 6, 0, 'E', 'open');
  if (x < 2 && x > -5) link(x, 7, 0, 'E', 'open');
  link(x, 5, 0, 'S', x === -4 || x === -1 || x === 2 ? 'wide' : 'wall');
  link(x, 5, 0, 'N', x === -3 || x === 0 || x === 2 ? 'door' : 'wall');
  if (x > -5 && x < 3) link(x, 6, 0, 'N', x === -3 || x === -1 || x === 1 ? 'arch' : 'wall');
  if (x > -5 && x < 3) link(x, 7, 0, 'N', x === -2 || x === 0 ? 'door' : 'window');
  // Upper floor: lounge and concourse open, glass over the apron, gate 9's door onto the jet bridge.
  if (x < 3) link(x, 5, 1, 'E', 'open');
  if (x < 3 && !SHOPS1.has(`${x},6`) && !SHOPS1.has(`${x + 1},6`)) link(x, 6, 1, 'E', 'open');
  if (x < 2 && x > -5) link(x, 7, 1, 'E', 'open');
  link(x, 5, 1, 'N', SHOPS1.has(`${x},6`) ? 'wide' : 'open');
  if (x === -2) link(x, 5, 1, 'S', 'door');
  else {
    link(x, 5, 1, 'S', 'window');
    GLASS.push([x, 5, 1, 'S']);
  }
  if (x > -5 && x < 3) link(x, 7, 1, 'S', x >= -2 && x <= 0 ? 'wide' : 'wall');
  if (x > -5 && x < 3) link(x, 7, 1, 'N', 'window');
}
link(-5, 5, 0, 'W', 'door');
link(3, 5, 0, 'E', 'door');
link(-5, 6, 1, 'W', 'window');
link(3, 6, 1, 'E', 'window');
link(-5, 5, 1, 'W', 'window');
link(3, 5, 1, 'E', 'window');
// Tower.
link(-8, 1, 0, 'S', 'door');
link(-8, 1, 1, 'S', 'door');
link(-8, 1, 2, 'S', 'door');
link(-8, 1, 3, 'S', 'door');
link(-8, 1, 4, 'S', 'door');
link(-8, 0, 0, 'E', 'door');
link(-8, 0, 0, 'S', 'door');
for (const side of ['N', 'E', 'W'] as const) link(-8, 1, 4, side, 'windows');
for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
const SEAL = new Set(['room']);
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
// The lounge glass: every pane over the apron breaks.
GLASS.forEach(([x, y, z], i) => m.add({ kind: 'destructible', id: `pane_${String(i + 1).padStart(2, '0')}`, name: 'Lounge window', model: 'glass', position: at(x, y, z, 0, -4), yaw: 0, health: null, explosiveOnly: false }));

// ---------------------------------------------------------------- the jet

const DECK = 4; // cabin floor
const HOLD_Y = 1.5; // hold floor
const CEIL = 7.2;
const Z_TAIL = -46; // aft pressure bulkhead
const Z_CKPT = 18.3; // cockpit bulkhead
const Z_NOSE = 23.5;
// Cabin doors (centres) and the over-wing exits.
const DOOR_Z = [15, -1, -28];
const WING_EXIT_Z = -11;
const cabinGaps: [number, number][] = [...DOOR_Z.map((z) => [z - 1.5, z + 1.5] as [number, number]), [WING_EXIT_Z - 1, WING_EXIT_Z + 1]];

// Floors: the cabin deck (with the forward hatch and the aft stair cut out), the hold floor, the keel.
box(-4.3, 4.3, 3.7, DECK, 18.2, Z_NOSE, CARPET);
box(-4.3, 2.0, 3.7, DECK, 16.4, 18.2, CARPET);
box(3.8, 4.3, 3.7, DECK, 16.4, 18.2, CARPET);
box(-4.3, 4.3, 3.7, DECK, -34.5, 16.4, CARPET);
box(-4.3, 1.6, 3.7, DECK, -40, -34.5, CARPET);
box(-4.3, 4.3, 3.7, DECK, Z_TAIL, -40, CARPET);
box(-4.3, 4.3, 1.2, HOLD_Y, -44, Z_CKPT, HOLD);
box(-3.2, 3.2, 0.6, 1.2, -42, 16, BELLY);
// Hold walls: cargo doors on the right (x > 0) at z 6 and -30.
const holdGapsR: [number, number][] = [[4.5, 7.5], [-31.5, -28.5]];
for (const [a, b] of spans(-44, Z_CKPT, [])) box(-4.3, -4.0, HOLD_Y, 3.7, a, b, BELLY);
for (const [a, b] of spans(-44, Z_CKPT, holdGapsR)) box(4.0, 4.3, HOLD_Y, 3.7, a, b, BELLY);
box(-4.0, 4.0, HOLD_Y, 3.7, Z_CKPT, 18.6, BELLY);
box(-4.0, 4.0, HOLD_Y, 3.7, -44.3, -44, BELLY);
box(-4.3, 4.3, 0.9, 3.7, 18.6, Z_NOSE, BELLY); // under the cockpit
box(-4.3, 4.3, 1.2, 3.7, Z_TAIL, -44.3, BELLY);
// Cabin walls: a lower panel, the window band (posts: shoot through the windows), the upper panel.
for (const s of [-1, 1]) {
  const [x0, x1] = s < 0 ? [-4.3, -4.0] : [4.0, 4.3];
  for (const [a, b] of spans(Z_TAIL, Z_NOSE, cabinGaps)) {
    box(x0, x1, DECK, 5.0, a, b, WHITE);
    box(x0, x1, 5.7, CEIL, a, b, WHITE);
  }
  for (const z of DOOR_Z) box(x0, x1, 7.0, CEIL, z - 1.5, z + 1.5, WHITE);
  box(x0, x1, 6.2, CEIL, WING_EXIT_Z - 1, WING_EXIT_Z + 1, WHITE);
  for (let z = Z_TAIL + 0.6; z < Z_NOSE - 0.3; z += 1) {
    if (cabinGaps.some(([g0, g1]) => z + 0.25 > g0 - 0.05 && z - 0.25 < g1 + 0.05)) continue;
    box(x0, x1, 5.0, 5.7, r2(z - 0.25), r2(z + 0.25), NAVY);
  }
  // The cheatline under the windows, outside.
  for (const [a, b] of spans(Z_TAIL, Z_NOSE, cabinGaps)) box(s * 4.3, s * 4.5, 4.75, 4.95, a, b, ORANGE);
}
// Nose: the flight deck front with its windscreen, then the cone.
box(-4.0, 4.0, DECK, 5.2, Z_NOSE, Z_NOSE + 0.3, WHITE);
box(-4.0, 4.0, 6.2, CEIL, Z_NOSE, Z_NOSE + 0.3, WHITE);
for (const x of [-4, -1.3, 1.3, 4]) box(x - 0.2, x + 0.2, 5.2, 6.2, Z_NOSE, Z_NOSE + 0.3, DARK);
box(-3.6, 3.6, 1.6, 6.8, Z_NOSE + 0.3, 25.2, WHITE);
box(-2.6, 2.6, 2.4, 6.0, 25.2, 26.4, WHITE);
box(-1.4, 1.4, 3.2, 5.2, 26.4, 27.2, WHITE);
// Bulkheads: the cockpit (a door in the middle) and the rear pressure bulkhead.
box(-4.0, -1.5, DECK, CEIL, Z_CKPT, Z_CKPT + 0.3, WHITE);
box(1.5, 4.0, DECK, CEIL, Z_CKPT, Z_CKPT + 0.3, WHITE);
box(-1.5, 1.5, 7.0, CEIL, Z_CKPT, Z_CKPT + 0.3, WHITE);
box(-4.0, 4.0, DECK, CEIL, Z_TAIL - 0.3, Z_TAIL, WHITE);
// Ceiling and crown.
for (const [a, b] of [[Z_TAIL - 0.3, -12], [-12, Z_NOSE + 0.3]] as const) {
  box(-4.3, 4.3, CEIL, 7.5, a, b, WHITE);
  box(-3.5, 3.5, 7.5, 7.9, a, b, WHITE);
  box(-2.4, 2.4, 7.9, 8.2, a, b, WHITE);
}
// Tail cone, fin and tailplanes.
box(-3.6, 3.6, 2.2, 7.6, -50, Z_TAIL - 0.3, WHITE);
box(-2.4, 2.4, 3.4, 7.8, -54, -50, WHITE);
box(-1.2, 1.2, 4.6, 7.9, -57, -54, WHITE);
for (let i = 0; i < 6; i++) box(-0.35, 0.35, r2(7.6 + 2 * i), r2(9.6 + 2 * i), r2(-56 - 0.5 * i), r2(-43 - 2.1 * i), i === 3 ? ORANGE : NAVY);
for (const s of [-1, 1]) beam(s * 1.5, -50.5, s * 13, -55, 4.5, 7.0, 7.3, WING);
// Wings: three swept panels a side, top 3.75 (a step down from the over-wing exits).
const le = (ax: number) => -4 - (ax - 4.3) * (22 / 29.7);
const te = (ax: number) => -20 - (ax - 4.3) * (11 / 29.7);
const mid = (ax: number) => (le(ax) + te(ax)) / 2;
for (const s of [-1, 1]) {
  for (const [a, b] of [[4.3, 14.5], [14, 24.5], [24, 34]] as const) {
    const chord = (le((a + b) / 2) - te((a + b) / 2)) * 0.97;
    beam(s * a, mid(a), s * b, mid(b), r2(chord), 3.4, 3.75, WING);
  }
  box(s * 33.8, s * 34.3, 3.75, 6.2, le(34) - 3.4, le(34) - 1.2, NAVY); // winglet
  for (const ax of [13, 24]) {
    const z = le(ax) - 1.6;
    box(s * ax - 1.2, s * ax + 1.2, 1.1, 3.4, z - 3, z + 2.4, WHITE); // engine nacelle
    box(s * ax - 0.9, s * ax + 0.9, 1.4, 3.1, z + 2.4, z + 2.6, DARK); // intake
  }
}
// Landing gear.
box(-0.25, 0.25, 0, 0.9, 20.75, 21.25, DARK);
box(-0.6, 0.6, 0, 0.7, 20.5, 21.5, DARK);
for (const s of [-1, 1]) box(s * 2.0, s * 3.2, 0, 0.6, -18, -13, DARK);

// Cabin furniture: seats in three blocks either side of two aisles, overhead bins, galleys, lavatories.
const COLS: [number, number][] = [[-3.9, -2.8], [-0.55, 0.55], [2.8, 3.9]];
const seatRow = (zr: number, depth: number, look: Look, skipRight = false) => {
  for (const [c0, c1] of COLS) {
    if (skipRight && c0 > 0) continue;
    box(c0, c1, DECK, 4.5, zr, r2(zr + depth), look);
    box(c0, c1, DECK, 5.15, r2(zr - 0.22), zr, look);
  }
};
for (const zr of [10, 7.4, 4.8, 2.2]) seatRow(zr, 1.0, SEAT_F); // first class
for (const zr of [-6, -7, -8, -9]) seatRow(zr, 0.55, SEAT); // economy, ahead of the wing exits
for (let zr = -13; zr >= -24; zr--) seatRow(zr, 0.55, SEAT); // economy over the wing
for (let zr = -32.5; zr >= -41.5; zr--) seatRow(zr, 0.55, SEAT, zr > -34 || (zr <= -34.5 && zr >= -40.5)); // economy aft (the stair down on the right)
for (const [a, b] of [[1.9, 11.2], [-9.4, -5.3], [-24.4, -12.3], [-41.9, -32.2]] as const) {
  box(-4.0, -2.8, 6.4, CEIL, a, b, BIN);
  box(2.8, 4.0, 6.4, CEIL, a, b, BIN);
  box(-0.6, 0.6, 6.4, CEIL, a, b, BIN);
}
box(-0.55, 0.55, DECK, 5.1, 12.0, 13.0, GALLEY); // forward galley
box(-0.55, 0.55, DECK, 5.1, -31.4, -30.4, GALLEY); // aft galley
box(-4.0, -3.4, DECK, 5.1, -26.0, -24.8, GALLEY);
box(3.4, 4.0, DECK, 5.1, -26.0, -24.8, GALLEY);
// Lavatories: forward left, rear left and right (a 1 m door gap toward the aisle).
const lav = (x0: number, x1: number, z0: number, z1: number, doorAt: 'n' | 's') => {
  const [fz0, fz1] = doorAt === 's' ? [z0, z0 + 0.2] : [z1 - 0.2, z1];
  const inner = x0 < 0 ? x1 : x0;
  const sx = x0 < 0 ? -1 : 1;
  box(Math.min(inner, inner - sx * 0.2), Math.max(inner, inner - sx * 0.2), DECK, CEIL, z0, z1, BIN);
  for (const [a, b] of spans(Math.min(x0, x1), Math.max(x0, x1), [[Math.min(x0, x1) + 0.4, Math.min(x0, x1) + 1.4]])) box(a, b, DECK, CEIL, fz0, fz1, BIN);
  box(Math.min(x0, x1) + 0.4, Math.min(x0, x1) + 1.4, 6.2, CEIL, fz0, fz1, BIN);
  m.prop('hm_toilet', [r2((x0 + x1) / 2 - 0.2 * sx), DECK, r2(doorAt === 's' ? z1 - 0.5 : z0 + 0.5)], doorAt === 's' ? S : 0);
};
lav(-4.0, -2.2, 16.4, Z_CKPT, 's');
lav(-4.0, -2.2, Z_TAIL, -44.2, 'n');
lav(2.2, 4.0, Z_TAIL, -44.2, 'n');
// Rails round the aft stair and the forward hatch.
box(1.4, 1.6, DECK, 5.0, -40, -34.5, STEEL);
box(1.4, 4.0, DECK, 5.0, -40.2, -40, STEEL);
box(1.8, 2.0, DECK, 5.0, 16.4, 18.2, STEEL);
// The aft stair down into the hold (heading aft), and the forward ladder.
for (let i = 1; i <= 9; i++) box(1.6, 4.0, HOLD_Y, r2(DECK - 0.25 * i), r2(-34.5 - 0.5 * i), r2(-34.5 - 0.5 * (i - 1)), HOLD);
m.add({ kind: 'ladder', position: [2.9, HOLD_Y, 16.4], yaw: 0, height: 2.5, width: 0.9 });
// Cockpit: glareshield and panel, two seats, the overhead panel.
box(-3.4, 3.4, DECK, 5.2, 22.4, Z_NOSE, DARK);
for (const x of [-1.3, 1.3]) {
  box(x - 0.5, x + 0.5, DECK, 4.6, 20.0, 21.0, SEAT_F);
  box(x - 0.5, x + 0.5, DECK, 5.4, 19.8, 20.0, SEAT_F);
}
box(-1.2, 1.2, 6.8, CEIL, 19.5, 22.4, DARK);
m.prop('computer_wide', [0, DECK, 21.8], S, 0.8);
// The hold: containers (ULDs) along the left, bags and crates.
for (const [a, b] of [[12, 17.6], [-3, 3], [-14, -8], [-26, -19], [-43.6, -41]] as const) box(-3.9, -2.3, HOLD_Y, 3.1, a, b, ULD);
for (const [a, b] of [[-14, -10], [-22, -18]] as const) box(2.4, 3.9, HOLD_Y, 3.1, a, b, ULD);
m.prop('cargo_crate', [2.6, HOLD_Y, 12], 0.1).prop('crate_large', [2.8, HOLD_Y, -3], 0).prop('cardboard_box', [-1.4, HOLD_Y, 14]).prop('sv_backpack', [-1.6, HOLD_Y, -6]);
m.prop('cargo_crate', [-2.8, HOLD_Y, -32]).prop('crate_small', [2.9, HOLD_Y, -42.6]).prop('cardboard_open', [-1.2, HOLD_Y, -24]);

// Doors: six cabin doors and the cockpit door.
const door = (id: string, name: string, pos: V3, yaw: number, o: { locked?: boolean; auto?: boolean } = {}) =>
  m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked: o.locked ?? false, auto: o.auto ?? true });
const LEFT_DOORS: string[] = [];
const RIGHT_DOORS: string[] = [];
DOOR_Z.forEach((z, i) => {
  door(`door_l${i + 1}`, `Door L${i + 1}`, [-4.15, DECK, z], P, { locked: true });
  door(`door_r${i + 1}`, `Door R${i + 1}`, [4.15, DECK, z], P, { locked: true });
  LEFT_DOORS.push(`door_l${i + 1}`);
  RIGHT_DOORS.push(`door_r${i + 1}`);
});
door('door_cockpit', 'Cockpit door', [0, DECK, Z_CKPT + 0.15], 0);

// ---------------------------------------------------------------- around the jet: bridge, stairs, loaders, stands

// The jet bridge: from gate 9 (x -16, z 36) south, then east onto door L1.
const BRIDGE: Look = { material: 'pbr_corrugated', tint: '#c4c8cc' };
const BRIDGE_IN: Look = { material: 'pbr_carpet', tint: '#4a4e58' };
box(-17.9, -14.1, 3.7, DECK, 13.3, 36, BRIDGE_IN);
box(-14.1, -4.3, 3.7, DECK, 13.3, 16.7, BRIDGE_IN);
const bridgeWall = (x0: number, x1: number, z0: number, z1: number, along: 'x' | 'z') => {
  box(x0, x1, DECK, 5.0, z0, z1, BRIDGE);
  box(x0, x1, 6.0, 6.8, z0, z1, BRIDGE);
  const [a, b] = along === 'z' ? [z0, z1] : [x0, x1];
  for (let u = a + 1; u < b - 0.5; u += 2) along === 'z' ? box(x0, x1, 5.0, 6.0, u - 0.2, u + 0.2, STEEL) : box(u - 0.2, u + 0.2, 5.0, 6.0, z0, z1, STEEL);
};
bridgeWall(-18.1, -17.9, 13.1, 36, 'z');
bridgeWall(-14.1, -13.9, 16.9, 36, 'z');
bridgeWall(-17.9, -4.3, 13.1, 13.3, 'x');
bridgeWall(-13.9, -4.3, 16.7, 16.9, 'x');
box(-18.1, -13.9, 6.8, 7.0, 13.1, 36, BRIDGE);
box(-13.9, -4.3, 6.8, 7.0, 13.1, 16.9, BRIDGE);
box(-16.6, -15.4, 0, 3.7, 23.4, 24.6, STEEL); // the drive column
box(-17.2, -14.8, 0, 0.8, 23, 25, DARK);
box(-16.6, -15.4, 0, 3.7, 14.4, 15.6, STEEL); // the rotunda leg
// Airstairs on doors L2 and L3: sixteen steps from the apron to the sill.
for (const z of [DOOR_Z[1]!, DOOR_Z[2]!]) {
  for (let k = 1; k <= 16; k++) box(r2(-4.3 - 0.5 * (17 - k)), r2(-4.3 - 0.5 * (16 - k)), 0, r2(0.25 * k), z - 1.5, z + 1.5, k % 4 ? WHITE : NAVY);
  box(-13.5, -12.3, 0, 1.6, z - 1.2, z + 1.2, NAVY); // the truck's cab at the foot
}
// The catering high-loader on door R1: its box up at sill height, a ladder up the back.
box(4.3, 8.3, 3.2, DECK, 13.5, 16.5, STEEL);
box(8.3, 11.3, 1.2, 7.2, 13.2, 16.8, { material: 'paint_gloss', tint: '#f4f4f0' });
box(4.6, 8.0, 0, 3.2, 14.4, 15.6, DARK); // scissor
box(8.3, 11.3, 0, 1.2, 13.4, 16.6, DARK);
m.add({ kind: 'ladder', position: [6.3, 0, 13.5], yaw: S, height: 4, width: 1 });
// Belt loaders on the cargo doors: six steps from the apron to the hold sill.
for (const z of [6, -30]) {
  for (let j = 1; j <= 6; j++) box(r2(4.3 + 0.5 * (6 - j)), r2(4.3 + 0.5 * (7 - j)), 0, r2(0.25 * j), z - 1.4, z + 1.4, DARK);
  box(7.4, 9.4, 0, 1.4, z - 1.0, z + 1.0, PAINT_Y); // the loader's cab
}
// Maintenance stands at each wing's trailing edge, a ladder up the back.
for (const s of [-1, 1]) {
  const ax = 18;
  const zt = te(ax);
  box(s * ax - 1.2, s * ax + 1.2, 0, 3.75, r2(zt - 2.0), r2(zt + 1.0), PAINT_Y);
  m.add({ kind: 'ladder', position: [s * ax, 0, r2(zt - 2.0)], yaw: S, height: 3.75, width: 1 });
}
// Chocks and cones round the jet.
for (const [x, z] of [[0, 23.5], [-6, 28], [6, 28], [-36, -20], [36, -20], [0, -60]] as const) m.prop('cone', [x, 0, z], 0, 1, false);

// ---------------------------------------------------------------- the apron: fuel trucks, carts and tugs, floodlights

/** A fuel bowser along z: cab, chassis, tank; gas cylinders on the back and drums beside it (it goes up in a chain). */
const fuelTruck = (x: number, z: number, dir: 1 | -1) => {
  box(x - 1.3, x + 1.3, 0.3, 1.0, z - 5, z + 5, DARK);
  box(x - 1.2, x + 1.2, 0, 2.8, z + dir * 3.2, z + dir * 5.2, { material: 'paint_gloss', tint: '#d8d0c0' });
  box(x - 1.3, x + 1.3, 1.0, 3.0, z - 4.6, z + 2.8, { material: 'pbr_steel', tint: '#d8dce0' });
  box(x - 1.0, x + 1.0, 3.0, 3.3, z - 4.4, z + 2.6, { material: 'pbr_steel', tint: '#d8dce0' });
  box(x - 1.32, x + 1.32, 1.8, 2.1, z - 4.6, z + 2.8, { material: 'paint_gloss', tint: '#d82a2a' });
  m.breakable('gas', [x - 0.6, 0, r2(z - dir * 5.6)], 0).breakable('gas', [x + 0.6, 0, r2(z - dir * 5.6)], 0);
  m.breakable('barrel', [x + 2.2, 0, z - 1], 0).breakable('barrel', [x + 2.2, 0, z + 0.2], 0);
};
fuelTruck(-26, 2, 1);
fuelTruck(28, -40, -1);
// Baggage carts (trains of three) by the make-up hall, and a tug for each.
const cart = (x: number, z: number) => {
  box(x - 0.8, x + 0.8, 0.3, 0.45, z - 1.3, z + 1.3, STEEL);
  for (const [dx, dz] of [[-0.6, -1], [0.6, -1], [-0.6, 1], [0.6, 1]] as const) box(x + dx - 0.12, x + dx + 0.12, 0, 0.3, z + dz - 0.2, z + dz + 0.2, DARK);
  box(x - 0.8, x + 0.8, 0.45, 2.0, z - 1.4, z - 1.2, STEEL);
  m.prop('cardboard_box', [x - 0.3, 0.45, z - 0.4], 0.3).prop('sv_backpack', [x + 0.3, 0.45, z + 0.6], 1.2, 1, false);
};
for (const [x, z] of [[-30, 26], [-30, 23], [-30, 20], [14, 26], [14, 23], [14, 20], [10, -8], [10, -11]] as const) cart(x, z);
m.mount('buggy', [-30, 0, 30.5], S).mount('buggy', [14, 0, 30.5], S).mount('gun_jeep', [-40, 0, -30], 0).mount('ice_cream_truck', [20, 0, 22], S);
// Floodlight masts on the apron.
for (const [x, z] of [[-48, 24], [40, 24], [-48, -48], [40, -56]] as const) {
  box(x - 0.3, x + 0.3, 0, 14, z - 0.3, z + 0.3, STEEL);
  box(x - 1.4, x + 1.4, 14, 14.6, z - 0.5, z + 0.5, DARK);
  m.light([x, 13.8, z], { fixture: 'none', color: '#ffd8a0', intensity: 2.2, range: 30 });
}
m.prop('barrier', [-44, 0, 8]).prop('barrier', [-44, 0, 4]).prop('barrier_high', [44, 0, 30]).prop('barrier', [30, 0, -8]).prop('barrier', [-20, 0, -40]).prop('barrier_high', [-34, 0, -44]);
m.prop('container_tall', [-52, 0, -12]).prop('cargo_crate', [-55, 0, -10], 0.4).prop('cargo_crate', [36, 0, 0], 0.2).prop('container', [38, 0, -3]);
m.prop('warning_sign', [-14, 0, 30]).prop('warning_sign', [6, 0, 30]);

// ---------------------------------------------------------------- the hangar (x 52..92, z -44..-4) and its bizjet

const HX0 = 52;
const HX1 = 92;
const HZ0 = -44;
const HZ1 = -4;
const HH = 12;
box(HX0, HX1, -0.15, 0.05, HZ0, HZ1, { material: 'pbr_concrete', tint: '#b8b6b0' });
box(HX0, HX1, HH, HH + 0.4, HZ0 - 0.4, HZ1 + 0.4, { material: 'pbr_roof', tint: '#5a5e64' });
// Walls: the doors open the whole west front (bar the posts at each end); a side door south.
box(HX0 - 0.4, HX0, 0, HH, HZ0, HZ0 + 4, CORRUGATED);
box(HX0 - 0.4, HX0, 0, HH, HZ1 - 4, HZ1, CORRUGATED);
box(HX0 - 0.4, HX0, 10, HH, HZ0 + 4, HZ1 - 4, CORRUGATED);
box(HX1, HX1 + 0.4, 0, HH, HZ0, HZ1, CORRUGATED);
box(HX0, HX1, 0, HH, HZ1, HZ1 + 0.4, CORRUGATED);
for (const [a, b] of spans(HX0, HX1, [[78.5, 81.5]])) box(a, b, 0, HH, HZ0 - 0.4, HZ0, CORRUGATED);
box(78.5, 81.5, 3, HH, HZ0 - 0.4, HZ0, CORRUGATED);
door('door_hangar', 'Hangar side door', [80, 0, HZ0 - 0.2], 0);
for (let z = HZ0 + 8; z < HZ1; z += 8) box(HX0 - 0.3, HX0 + 0.3, 9.4, 10, z - 4, z + 4, STEEL); // door track
// Mezzanine along the east wall, stairs up from the north.
box(84, HX1, 3.7, 4, HZ0, HZ1, { material: 'grate' });
box(83.8, 84, 4, 5, HZ0, HZ1 - 6, STEEL);
for (const z of [-40, -28, -16]) box(83.6, 84, 0, 3.7, z - 0.2, z + 0.2, STEEL);
for (let k = 1; k <= 15; k++) box(r2(76 + 0.5 * (k - 1)), r2(76 + 0.5 * k), 0, r2(0.25 * k), HZ1 - 6, HZ1 - 4, STEEL);
box(83.5, 84, 0, 3.75, HZ1 - 6, HZ1 - 4, STEEL);
// The business jet: fuselage along x, wings across, T-tail.
const BIZ: Look = { material: 'paint_gloss', tint: '#f2f2f0' };
box(60, 76, 1.0, 3.2, -25.2, -22.8, BIZ);
box(76, 78, 1.4, 2.9, -24.8, -23.2, BIZ);
box(57.6, 60, 1.6, 3.1, -24.8, -23.2, BIZ);
for (let x = 62.5; x < 72; x += 1.2) box(x - 0.3, x + 0.3, 2.3, 2.7, -25.25, -22.75, NAVY);
box(65, 69, 1.4, 1.7, -32, -16, WING);
box(58.6, 60.4, 3.1, 6.4, -24.2, -23.8, NAVY);
box(58, 61, 6.2, 6.4, -28, -20, WING);
for (const z of [-26.6, -21.4]) box(61, 64, 2.4, 3.6, z - 0.7, z + 0.7, BIZ); // engines
for (const [x, z] of [[74, -24], [67, -26.4], [67, -21.6]] as const) box(x - 0.3, x + 0.3, 0, 1.0, z - 0.3, z + 0.3, DARK);
m.prop('workbench', [90.5, 0, -30], -P).prop('workbench', [90.5, 0, -34], -P).prop('machine', [88.5, 0, -40], -P).prop('metal_crate', [70, 0, -42]).prop('metal_crate', [71.2, 0, -42], 0.3);
m.prop('shelf_boxes', [90.6, 4, -20], -P).prop('desk', [89, 4, -12], -P).prop('computer', [89, 4.8, -12], -P, 1, false).prop('office_chair', [87.8, 4, -12], P);
m.prop('barrel', [56, 0, -42]).prop('sv_propane', [57.2, 0, -42]).prop('cargo_crate', [60, 0, -8], 0.2).prop('container', [64, 0, -7]);
m.mount('buggy', [72, 0, -12], -P);
for (const [x, z] of [[62, -34], [62, -14], [78, -34], [78, -14]] as const) m.light([x, 11.4, z], { fixture: 'bulb', color: '#f4f0e0', intensity: 1.8, range: 20 });
m.light([88, 7.2, -24], { fixture: 'strip', color: '#f4f0e0', intensity: 1, range: 10 });

// ---------------------------------------------------------------- logic: boarding doors, the emergency release, the gate

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const wait = (s: number) => act('wait', null, { value: s });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
const pressed = (target: string) => ({ event: 'button_pressed' as const, target });
const button = (id: string, name: string, pos: V3, yaw: number, label: string, cooldown = 1) => {
  m.add({ kind: 'button', id, name, position: pos, yaw, label, once: false, cooldownSeconds: cooldown, startEnabled: true });
  m.light([r2(pos[0] + Math.sin(yaw) * 0.1), pos[1] + 2.2, r2(pos[2] + Math.cos(yaw) * 0.1)], { fixture: 'wall', color: '#ff3a2a', intensity: 0.8, range: 4, yaw });
};
button('btn_slides', 'Emergency door release', [-3.95, DECK, 20.4], P, 'Release the right-hand doors');
button('btn_gate', 'Gate 9 door', at(-2, 5, 1, 2.4, -3.2), 0, 'Lock the jet bridge door', 2);
door('door_gate', 'Gate 9', at(-2, 5, 1, 0, -3.75), 0);
const BOARDING = 12;
m.logic({
  variables: [],
  timers: [{ id: 'timer_boarding', name: 'Boarding', seconds: BOARDING, loop: false, visible: true }],
  objectives: [],
  rules: [
    rule('rule_start', 'Flight 9 at the gate', { event: 'match_start', target: null }, [say(`Runway Nine. Flight 9's doors are armed: they open in ${BOARDING} s.`, 4), act('timer_start', 'timer_boarding')]),
    rule('rule_board', 'Doors open', { event: 'timer_done', target: 'timer_boarding' }, [
      act('sound', null, { state: 'chime' }),
      say('Cabin doors open: L1, L2, L3 and the catering door.', 3),
      ...[...LEFT_DOORS, 'door_r1'].flatMap((d) => [act('door_unlock', d), act('door_open', d)]),
    ]),
    rule('rule_slides', 'Emergency release', pressed('btn_slides'), [
      act('disable', 'btn_slides'),
      act('sound', null, { state: 'alarm' }),
      say('Emergency release: the right-hand doors are open!', 3),
      ...RIGHT_DOORS.flatMap((d) => [act('door_unlock', d), act('door_open', d)]),
      wait(20),
      ...['door_r2', 'door_r3'].flatMap((d) => [act('door_close', d), act('door_lock', d)]),
      say('The right-hand doors are locked again.', 2),
      wait(15),
      act('enable', 'btn_slides'),
    ]),
    rule('rule_gate', 'Gate 9 lockout', pressed('btn_gate'), [
      act('disable', 'btn_gate'),
      act('sound', null, { state: 'buzzer' }),
      act('door_close', 'door_gate'),
      act('door_lock', 'door_gate'),
      say('Gate 9: the jet bridge door is locked for 15 s.', 2),
      wait(15),
      act('door_unlock', 'door_gate'),
      wait(15),
      act('enable', 'btn_gate'),
    ]),
  ],
});

// ---------------------------------------------------------------- objectives, spawns, pickups

// Hostage Rescue: four passengers held aboard; bring them out to the gate lounge or the hangar.
m.hostage([1.6, DECK, 6], S).hostage([-1.6, DECK, -19], S).hostage([0, HOLD_Y, 10], S).hostage([0, DECK, -43.4], 0);
m.rescue(at(-1, 6, 1, 0, 0), 5).rescue([70, 0, -12], 6);
// Bomb: the cockpit (A) and the forward hold (B).
m.add({ kind: 'bombsite', position: [0, DECK, 20.6], label: 'A', radius: 3 });
m.add({ kind: 'bombsite', position: [0, HOLD_Y, 6], label: 'B', radius: 4 });
// Capture the Flag: the reclaim hall against first class... the cross aisle by the mid doors.
m.flag(RESPONSE, at(-1, 6, 0, 0, 0), S);
m.flag(HIJACK, [0, DECK, -2.8], 0);
// King of the Hill: the left wing, the apron by the fuel truck, the tower cab, the hangar.
m.hill([-21, 3.75, r2(mid(21))], 4).hill([-34, 0, 12], 6).hill(at(-8, 1, 4, 0, 0), 3.5).hill([70, 0, -36], 6);

// Hijackers: aboard (aisles, galleys, the hold).
for (const [x, y, z, yaw] of [
  [-1.6, DECK, 9, S], [1.6, DECK, 4, S], [-1.6, DECK, 0.5, 0], [1.6, DECK, -11, S], [-1.6, DECK, -17, 0],
  [1.6, DECK, -22, 0], [-2.4, DECK, -28, P], [-1.6, DECK, -38, 0], [-1, HOLD_Y, 2, S], [1, HOLD_Y, -24, 0],
] as const) m.spawn([x, y, z], yaw, HIJACK);
// Response: the make-up hall, the lounge, the hangar.
for (const [p, yaw] of [
  [at(-4, 5, 0, 0, 0), S], [at(-2, 5, 0, 0, 0), S], [at(0, 5, 0, 0, 0), S], [at(2, 5, 0, -2, 0), S],
  [at(-4, 5, 1, 0, 0), S], [at(1, 5, 1, 0, 0), S],
  [[86, 0, -40], -P], [[86, 0, -30], -P], [[60, 0, -40], -P], [[58, 0, -10], -P],
] as [V3, number][]) m.spawn(p, yaw, RESPONSE);
// Everyone's.
for (const [p, yaw] of [
  [at(-1, 7, 0, 0, 0), S], [at(1, 7, 1, 0, 0), S], [at(-3, 6, 1, 0, 0), S], [at(-8, 0, 0, 0, 0), P], [at(-8, 1, 4, 0, -1), S],
  [[-44, 0, -20], P], [[44, 0, 10], -P], [[-20, 0, -60], 0], [[24, 0, -70], 0], [[0, 0, -96], 0], [[-60, 0, -90], P],
  [[88, 4, -8], -P], [[-60, 0, 30], P], [[20, 0, 40], S], [at(1, 8, 0, 0, 0), S],
] as [V3, number][]) m.spawn(p, yaw);

// Pickups.
m.pickup('weapon_smg', [1.6, DECK, 12]).pickup('weapon_shotgun', [-1.6, DECK, -26]).pickup('ammo_shells', [2.4, DECK, -28]).pickup('health_small', [-1.6, DECK, -44.5 + 2]);
m.pickup('weapon_hand_cannon', [0, DECK, 19.5]).pickup('armor_small', [1.6, DECK, -6]).pickup('grenades', [-1.6, DECK, -11]).pickup('health_small', [1.6, DECK, -30]);
m.pickup('weapon_auto_shotgun', [0, HOLD_Y, -12]).pickup('health_large', [0, HOLD_Y, -38]).pickup('ammo', [1, HOLD_Y, 14]).pickup('ammo_light', [-1, HOLD_Y, -30]);
m.pickup('weapon_marksman', [-30, 3.75, r2(mid(30))]).pickup('ammo_sniper', [30, 3.75, r2(mid(30))]).pickup('armor_large', [10, 3.75, r2(mid(10))]);
m.pickup('weapon_sniper', at(-8, 1, 4, 0, 1)).pickup('ammo_sniper', at(-8, 0, 0, 0, 0));
m.pickup('weapon_rifle', at(-3, 5, 0, 0, 0)).pickup('weapon_burst_rifle', at(1, 5, 0, 0, 0)).pickup('ammo_rifle', at(-1, 6, 0, 2, -2)).pickup('health_small', at(2, 6, 0, 0, 0));
m.pickup('weapon_smg', at(-1, 7, 1, 0, 0)).pickup('health_large', at(-4, 6, 1, 0, 0)).pickup('ammo', at(2, 6, 1, 0, 0)).pickup('grenades', at(0, 5, 1, 0, 0));
m.pickup('weapon_rifle', [80, 0, -24]).pickup('weapon_launcher', [88, 4, -24]).pickup('ammo_explosive', [88, 4, -36]).pickup('health_small', [60, 0, -32]);
m.pickup('weapon_lmg', [-44, 0, -60]).pickup('weapon_rockets', [40, 0, -66]).pickup('ammo_explosive', [-40, 0, -66]).pickup('powerup_damage', [8, 0, -92], 90);
m.pickup('health_small', [-24, 0, 14]).pickup('health_small', [26, 0, -28]).pickup('armor_small', [-36, 0, 30]).pickup('ammo_rifle', [44, 0, 18]);
m.pickup('health_large', [-60, 0, -20]).pickup('ammo', [-6, 0, -30]).pickup('weapon_burst_rifle', [-4, 0, 50 + 18]);

// ---------------------------------------------------------------- dressing and lights

m.dress({ x0: -4, y0: 7, x1: 2, y1: 7, z: 0 }, 'lobby', { density: 'sparse', max: 18 }); // check-in
m.dress([-4, 6, 1], 'shop', { density: 'sparse', max: 10 }).dress([-3, 6, 1], 'shop', { density: 'sparse', max: 10 });
m.dress([1, 6, 1], 'bar', { density: 'sparse', max: 10 }).dress([2, 6, 1], 'shop', { density: 'sparse', max: 10 });
m.dress([-8, 0, 0], 'office', { density: 'sparse', max: 6 });
m.dress([-8, 1, 4], 'server', { density: 'sparse', max: 6 });
// Gate lounge seating (rows of linked seats), the gate desk, security scanners, baggage conveyors and carousels.
for (const x of [-36, -28, -4, 4, 12, 20]) for (const dz of [-1.5, 1.5]) {
  box(x - 2.4, x + 2.4, 4, 4.45, 40 + dz - 0.3, 40 + dz + 0.3, SEAT);
  box(x - 2.4, x + 2.4, 4, 5.0, 40 + dz - 0.05, 40 + dz + 0.15, SEAT);
}
box(-13, -9, 4, 5.1, 39.4, 40.4, { material: 'pbr_walnut' });
m.prop('scanner', at(-1, 7, 1, 0, 0), 0).prop('scanner', at(0, 7, 1, 0, 0), 0).prop('barrier', at(-2, 7, 1, 2, 0)).prop('barrier', at(1, 7, 1, -2, 0));
for (const x of [-32, -8, 12]) m.prop('conveyor', [x, 0, 42], 0).prop('conveyor', [x + 5, 0, 42], 0);
for (const x of [-28, -4, 16]) {
  box(x - 3, x + 3, 0, 0.7, 50.2, 51.8, STEEL);
  box(x - 2.2, x + 2.2, 0.7, 0.8, 50.4, 51.6, DARK);
}
for (const x of [-36, -20, -4, 12]) m.prop('cardboard_box', [x, 0, 46]).prop('sv_backpack', [x + 1, 0, 46.5], 0.5, 1, false);
m.lightRooms({ color: '#f4f0e6', intensity: 0.9 });
// The cabin: aisle strips, galley and cockpit lights, bulbs in the hold, a warm glow in the bridge.
for (let z = -42; z <= 12; z += 6) for (const x of [-1.6, 1.6]) m.light([x, 7.0, z], { fixture: 'strip', color: '#e8f0ff', intensity: 0.7, range: 6 });
m.light([0, 7.0, 15], { fixture: 'ceiling', color: '#fff4e0', intensity: 0.9, range: 7 }).light([0, 7.0, -28], { fixture: 'ceiling', color: '#fff4e0', intensity: 0.9, range: 7 });
m.light([0, 6.7, 21], { fixture: 'none', color: '#6ab0ff', intensity: 0.8, range: 6 });
for (let z = -40; z <= 16; z += 8) m.light([0, 3.5, z], { fixture: 'bulb', color: '#ffc880', intensity: 0.6, range: 7 });
for (const z of [20, 30]) m.light([-16, 6.6, z], { fixture: 'ceiling', color: '#ffe8c0', intensity: 0.7, range: 6 });
m.light([-10, 6.6, 15], { fixture: 'ceiling', color: '#ffe8c0', intensity: 0.7, range: 6 });
// Navigation lights: red left wingtip, green right, white tail, red beacons top and bottom.
m.light([-34.2, 4.2, r2(le(34) - 2.3)], { fixture: 'bulb', color: '#ff2a2a', intensity: 1.6, range: 6 });
m.light([34.2, 4.2, r2(le(34) - 2.3)], { fixture: 'bulb', color: '#2aff6a', intensity: 1.6, range: 6 });
m.light([0, 20, -56], { fixture: 'bulb', color: '#ffffff', intensity: 1.4, range: 6 });
m.light([0, 8.5, -10], { fixture: 'bulb', color: '#ff2a2a', intensity: 1.4, range: 6 });
m.light(at(-8, 1, 4, 0, 0, 4.6), { fixture: 'bulb', color: '#ff2a2a', intensity: 2, range: 8 }); // tower beacon
// Runway edge lights (white), thresholds (green and red), taxiway edges (blue).
for (let x = -92; x <= 108; x += 16) for (const z of [-80.5, -103.5]) m.light([x, 0.3, z], { fixture: 'bulb', color: '#fff4dc', intensity: 1.2, range: 6 });
for (const k of [-3, -1, 1, 3]) {
  m.light([-95, 0.3, -92 + k * 3], { fixture: 'bulb', color: '#3aff6a', intensity: 1.2, range: 5 });
  m.light([111, 0.3, -92 + k * 3], { fixture: 'bulb', color: '#ff3a3a', intensity: 1.2, range: 5 });
}
for (let x = -72; x <= 96; x += 12) m.light([x, 0.3, -75.5], { fixture: 'bulb', color: '#3a6aff', intensity: 1, range: 5 });
for (let z = -72; z <= -48; z += 8) for (const x of [-16, 40]) m.light([x, 0.3, z], { fixture: 'bulb', color: '#3a6aff', intensity: 1, range: 5 });
// The curb road: lamps.
for (let x = -44; x <= 28; x += 18) m.prop('lightpost', [x, 0, 66.5], S);
for (let x = -44; x <= 28; x += 18) m.light([x, 3.2, 66], { fixture: 'none', color: '#ffb060', intensity: 1, range: 12 });

// An airliner on approach: it circles the field at 80 m (nobody starts aboard; it just flies over).
m.add({ kind: 'airplane', position: [8, 0, -18], route: [[-150, -74], [150, -74], [150, 78], [-150, 78]], altitude: 80, loopSeconds: 22, closed: true, airdrop: 'off' });

m.bounds('invisible', 0, { min: [-100, -108], max: [116, 76] }, 40);
m.backdrop('dusk', 'city', 'grass', 0.4);
m.meta({
  description:
    'An airport at dusk. Flight 9, a wide-body jet, stands at gate 9 on the jet bridge: walk its cockpit, galleys, first class, two aisles of economy and the lavatories, drop through the hatches into the cargo hold, and climb out of the over-wing exits onto the wings. The cabin doors open twelve seconds in; the cockpit\'s emergency release opens the right-hand side. Around it: the two-storey terminal (baggage make-up, reclaim, check-in, the glass-fronted gate lounge, shops and security), fuel trucks that blow up, baggage carts and tugs, the control tower with a sniper\'s cab, the maintenance hangar with a business jet, the taxiway and the lit runway. Hostage Rescue: the Hijackers hold four passengers aboard and the Response team brings them out to the lounge or the hangar. Bomb: the cockpit and the forward hold. Capture the Flag: the reclaim hall against the cabin.',
  modes: ['core.hostage', 'core.bomb', 'core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth', 'core.elim'],
  players: [8, 20],
});
await m.save();
