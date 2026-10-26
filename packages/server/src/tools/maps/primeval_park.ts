/**
 * Primeval Park: a dinosaur theme park on a jungle island, on the night a
 * storm cuts it off. Our own map and names. The visitor centre stands at the
 * south gate: a two-storey rotunda round a great skeleton, the gift shop and
 * the restaurant on either side, offices and the control room upstairs. A
 * tour road loops north through the jungle past the paddocks, crossing the
 * jungle river twice; the boat ride runs down a concrete-lined channel from
 * its station in the middle of the park. The helipad is on the rise in the
 * north-east.
 *
 * Paddocks (electric fences: solid, 3.2 m, they zap and throw you back):
 *   - the Rex paddock (north-west): a huge fence with pylons, a goat post
 *     (with a sheep on it, as it happens) by the viewing deck;
 *   - the raptor pen (north-east): a high concrete enclosure with a walk
 *     round the top of its walls;
 *   - the spitter paddock (south-east) and the aviary (south-west).
 * Each paddock has a gate that only logic opens. The control room's "Fence
 * power" button kills the fences and opens every gate for 20 s: whatever is
 * inside is ordered to roam and gets out. Keepers' buttons inside each
 * paddock open its own gate for 6 s.
 *
 * There are no dinosaurs in the kit, so the creatures stand in: the Rex is a
 * scolitex (the 2.5 m alien brute) at 2.2 × size and three times the health;
 * raptors are puglins and imps (fast, clawing packs); the spitters are
 * cyclopes (slowing goo, like a frilled spitter); the aviary's flyers are
 * oculi (floating, spitting plasma).
 *
 * Co-op (1–8): radio for the evac chopper in the control room, hold out
 * through three waves (raptors from the west jungle, spitters from the east,
 * then everything from the north and the Rex breaks out), then get everyone
 * to the helipad. Team modes: the visitor centre against the helipad (flags
 * in the lobby and on the pad; hills at the boat station, the Rex viewing
 * deck and the raptor pen's wall), with the residents as a neutral hazard.
 *
 * Grid x east, y north (one cell = 8 m). Map −116..116 m both ways.
 */
import { TERRAIN_MATERIALS, paintSlopes, terrainHeightAt, type ScenarioLogic, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('primeval_park', 'Primeval Park');
m.theme('forest');
m.backdrop('storm', 'forest', 'moss', 0.6, 0.35);
m.factions([{ id: 'dinos', name: 'The Residents', color: '#5a8a2a', relations: {} }]);
m.teams([10, 10]);
const [south, north] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const P = Math.PI / 2;
const PI = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const SIDE_D: Record<Side, [number, number]> = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
const sm = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];
const flush = () => (m as unknown as { flush(): void }).flush();

function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
let panes = 0;
function edge(x: number, y: number, z: number, side: Side, style: Parameters<MapBuilder['edge']>[4]): void {
  m.edge(x, y, z, side, style);
  if (style !== 'window') return;
  const [dx, dy] = SIDE_D[side];
  m.add({ kind: 'destructible', id: `pane_${String(++panes).padStart(3, '0')}`, name: 'Window pane', model: 'glass', position: at(x, y, z, dx * 4, dy * 4), yaw: side === 'N' || side === 'S' ? 0 : P, health: null, explosiveOnly: false });
}
/** A solid box between two corners (split to the block size limits). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, look: Look, yaw = 0): void {
  const w = x1 - x0;
  const d = z1 - z0;
  const h = y1 - y0;
  const nx = Math.ceil(w / 64);
  const nz = Math.ceil(d / 64);
  const ny = Math.ceil(h / 32);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++)
      for (let k = 0; k < ny; k++) {
        const a0 = x0 + (w * i) / nx;
        const a1 = x0 + (w * (i + 1)) / nx;
        const b0 = z0 + (d * j) / nz;
        const b1 = z0 + (d * (j + 1)) / nz;
        const c0 = y0 + (h * k) / ny;
        const c1 = y0 + (h * (k + 1)) / ny;
        m.block([r2((a0 + a1) / 2), r2(c0), r2((b0 + b1) / 2)], [r2(Math.max(0.2, a1 - a0)), r2(Math.max(0.1, c1 - c0)), r2(Math.max(0.2, b1 - b0))], 'solid', { ...look, yaw });
      }
}

// ---------------------------------------------------------------- ground plan: pads, the river, the tour road

const WATER = -0.8;
const GROUND = -0.15; // level ground under everything built
interface Pad {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  blend: number;
  ground?: TerrainMaterial;
}
const pads: Pad[] = [];
const pad = (x0: number, z0: number, x1: number, z1: number, y: number, blend: number, ground?: TerrainMaterial) =>
  pads.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y, blend, ...(ground ? { ground } : {}) });
const segDist = (x: number, z: number, a: readonly [number, number], b: readonly [number, number]) => {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t);
};
const lineDist = (x: number, z: number, line: readonly (readonly [number, number])[]) => Math.min(...line.slice(1).map((b, i) => segDist(x, z, line[i]!, b)));
const RIVER = [[-124, 10], [-60, 30], [0, 18], [50, 34], [124, 20]] as const;
const riverZ = (x: number) => {
  for (let i = 1; i < RIVER.length; i++) {
    const [ax, az] = RIVER[i - 1]!;
    const [bx, bz] = RIVER[i]!;
    if (x <= bx) return az + ((bz - az) * (x - ax)) / (bx - ax);
  }
  return RIVER[RIVER.length - 1]![1];
};
const ROAD = [[4, -58], [-36, -50], [-44, -12], [-40, 10], [-40, 42], [-20, 58], [-12, 92], [30, 96], [62, 86], [84, 62], [80, 40], [80, 16], [50, -8], [40, -46], [4, -58]] as const;
const GATE_ROAD = [[4, -60], [4, -118]] as const;

// ---------------------------------------------------------------- the visitor centre (x -20..36, z -92..-68)

const PLASTER = (tint: string): TileSurfaces => ({ walls: mat('pbr_plaster', tint), underside: mat('pbr_plaster_white', '#ece6d8'), trim: mat('dark_wood'), solids: mat('pbr_walnut') });
// The rotunda: a two-storey atrium round the skeleton, a balcony all round.
m.tile('atrium', 0, -10, 0, 0);
paint(0, -10, 0, { ...PLASTER('#e4d8bc'), floor: mat('pbr_travertine') });
// The lobby under the park offices, the main doors on the south front.
for (const x of [0, 1]) {
  m.tile('room', x, -11, 0, 0, {});
  paint(x, -11, 0, { ...PLASTER('#e4d8bc'), floor: mat('pbr_travertine') });
  m.tile('room', x, -11, 1, 0, { ceiling: 'roof' });
  paint(x, -11, 1, { ...PLASTER('#d8ccb0'), floor: mat('pbr_carpet', '#5a6a4a') });
  edge(x, -11, 0, 'S', 'wide');
  edge(x, -11, 0, 'N', 'wide');
  edge(x, -11, 1, 'S', 'window');
  edge(x, -11, 1, 'N', 'door');
}
edge(0, -11, 0, 'E', 'open');
edge(0, -11, 1, 'E', 'door');
edge(0, -11, 0, 'W', 'window');
edge(1, -11, 0, 'E', 'window');
edge(0, -11, 1, 'W', 'window');
edge(1, -11, 1, 'E', 'window');
// The gift shop (west wing) with the control room above it.
m.tile('room_large', -2, -10, 0, 0, { layout: 'empty' });
paint(-2, -10, 0, { ...PLASTER('#c8b890'), floor: mat('pbr_terrazzo') });
m.tile('room_large', -2, -10, 1, 0, { layout: 'empty', ceiling: 'roof' });
paint(-2, -10, 1, { walls: mat('pbr_white_panel', '#c8ccd0'), floor: mat('pbr_tread_plate'), underside: mat('pbr_white_panel'), trim: mat('pbr_steel'), solids: mat('pbr_steel') });
edge(-1, -10, 0, 'E', 'wide');
edge(-1, -9, 0, 'E', 'window');
edge(-2, -10, 0, 'W', 'window');
edge(-2, -9, 0, 'W', 'window');
edge(-2, -10, 0, 'S', 'door');
edge(-1, -10, 0, 'S', 'window');
edge(-2, -9, 0, 'N', 'window');
edge(-1, -9, 0, 'N', 'door');
edge(-1, -10, 1, 'E', 'door');
edge(-1, -9, 1, 'E', 'window');
for (const [x, y, s] of [[-2, -10, 'W'], [-2, -9, 'W'], [-2, -10, 'S'], [-1, -10, 'S'], [-2, -9, 'N'], [-1, -9, 'N']] as const) edge(x, y, 1, s, 'window');
// The restaurant (east wing), its kitchen and store room, a roof terrace over it.
m.tile('room_large', 2, -10, 0, 0, { layout: 'empty' });
paint(2, -10, 0, { ...PLASTER('#d8c49a'), floor: mat('pbr_floorboards') });
edge(2, -10, 0, 'W', 'arch');
edge(2, -9, 0, 'W', 'wide');
edge(2, -10, 0, 'S', 'window');
edge(3, -10, 0, 'S', 'door');
edge(2, -9, 0, 'N', 'window');
edge(3, -9, 0, 'N', 'wide');
m.tile('room', 4, -10, 0, 0, { ceiling: 'roof' });
paint(4, -10, 0, { ...PLASTER('#e8e4dc'), floor: mat('white_tiles') });
m.tile('room', 4, -9, 0, 0, { ceiling: 'roof' });
paint(4, -9, 0, { ...PLASTER('#c8c2b4'), floor: mat('pbr_concrete') });
edge(3, -10, 0, 'E', 'door');
edge(3, -9, 0, 'E', 'wall');
edge(4, -10, 0, 'N', 'door');
edge(4, -10, 0, 'S', 'wall');
edge(4, -10, 0, 'E', 'window');
edge(4, -9, 0, 'E', 'door');
edge(4, -9, 0, 'N', 'wall');
for (const [x, y] of [[2, -10], [3, -10], [2, -9], [3, -9]] as const) {
  m.tile('platform_rail', x, y, 1);
  paint(x, y, 1, { floor: mat('pbr_flagstone', '#b8b0a0') });
}
edge(1, -10, 1, 'E', 'door');
edge(1, -9, 1, 'E', 'window');
// The rotunda's other faces: glass on to the park, the doors out north.
edge(0, -9, 0, 'N', 'wide');
edge(1, -9, 0, 'N', 'wide');
edge(0, -9, 1, 'N', 'window');
edge(1, -9, 1, 'N', 'window');
// A domed roof over the rotunda: stepped rings on the wall tops.
for (const [i, s] of [[0, 17], [1, 13.6], [2, 10], [3, 6]] as const) box(4 - s / 2, 8 + i * 0.7, -76 - s / 2, 4 + s / 2, 8.7 + i * 0.7, -76 + s / 2, { material: 'paint_gloss', tint: i % 2 ? '#7a9a6a' : '#6a8a5a' });
box(-20.4, 8, -84.4, -3.6, 8.25, -67.6, { material: 'pbr_roof', tint: '#4a5a3a' });
box(-4.4, 8, -92.4, 12.4, 8.25, -83.6, { material: 'pbr_roof', tint: '#4a5a3a' });
box(27.6, 4, -84.4, 36.4, 4.25, -67.6, { material: 'pbr_roof', tint: '#4a5a3a' });
// The skeleton: a Rex mounted on a plinth in the middle of the rotunda, head to the west.
const BONE: Look = { material: 'paint_matte', tint: '#e6dcc2' };
const SZ = -74.4;
box(0, 0, SZ - 1.5, 8, 0.4, SZ + 1.5, { material: 'pbr_marble_black' });
for (const dz of [-0.55, 0.55]) {
  box(4.7, 0.4, SZ + dz - 0.2, 5.1, 2.4, SZ + dz + 0.2, BONE); // legs
  box(4.3, 0.4, SZ + dz - 0.3, 5.5, 0.6, SZ + dz + 0.3, BONE); // feet
}
box(4.2, 2.3, SZ - 0.5, 5.6, 2.9, SZ + 0.5, BONE); // pelvis
box(2.6, 2.6, SZ - 0.2, 4.4, 2.95, SZ + 0.2, BONE); // back
box(1.4, 2.9, SZ - 0.2, 2.8, 3.25, SZ + 0.2, BONE); // shoulders
box(0.9, 3.2, SZ - 0.2, 1.6, 3.7, SZ + 0.2, BONE); // neck
box(-0.6, 3.5, SZ - 0.45, 1.1, 4.2, SZ + 0.45, BONE); // skull
box(-0.5, 3.1, SZ - 0.35, 0.9, 3.35, SZ + 0.35, BONE); // jaw
for (let i = 0; i < 5; i++) box(1.8 + i * 0.5, 1.6 + i * 0.12, SZ - 0.75, 2.0 + i * 0.5, 2.8, SZ + 0.75, BONE); // ribs
box(1.6, 2.4, SZ - 0.5, 1.8, 2.8, SZ - 0.3, BONE);
box(1.6, 2.4, SZ + 0.3, 1.8, 2.8, SZ + 0.5, BONE); // little arms
box(5.6, 2.4, SZ - 0.18, 7.2, 2.7, SZ + 0.18, BONE); // tail
box(7.2, 2.0, SZ - 0.12, 8.4, 2.3, SZ + 0.12, BONE);
box(8.4, 1.6, SZ - 0.1, 9.2, 1.8, SZ + 0.1, BONE);
for (const x of [0.4, 2.0, 7.6]) box(x - 0.1, 0.4, SZ - 0.1, x + 0.1, x < 1 ? 3.5 : x < 3 ? 2.6 : 2.0, SZ + 0.1, { material: 'pbr_steel' }); // armatures
pad(-24, -96, 40, -60, GROUND, 10, 'stone');

// ---------------------------------------------------------------- the main gate and the car park (south)

for (const x of [-4, 12]) {
  box(x - 1.6, 0, -111.6, x + 1.6, 11, -108.4, { material: 'pbr_planks', tint: '#7a5a3a' });
  m.prop('fire_basket', [x, 11, -110], 0);
}
box(-5.6, 11, -111, 13.6, 13, -109, { material: 'pbr_planks', tint: '#6a4a2a' });
box(-2.4, 11.4, -111.3, 10.4, 12.6, -108.7, { material: 'paint_matte', tint: '#c8a030' });
pad(-12, -116, 40, -96, GROUND, 10, 'gravel');
for (let x = 18; x <= 36; x += 6) box(x - 0.08, GROUND - 0.06, -110, x + 0.12, GROUND + 0.02, -101, { material: 'paint_matte', tint: '#e8e4d8' });

// ---------------------------------------------------------------- the paddocks: electric fences with gates

const FENCES: string[] = [];
const GATES: string[] = [];
let fenceN = 0;
/** An electric fence run from a to b (straight along x or z) at ground height. */
function fence(ax: number, az: number, bx: number, bz: number, name: string): void {
  const len = Math.hypot(bx - ax, bz - az);
  const id = `fence_${String(++fenceN).padStart(2, '0')}`;
  FENCES.push(id);
  m.add({ kind: 'trap', id, name, trap: 'shock', position: [r2((ax + bx) / 2), GROUND, r2((az + bz) / 2)], yaw: ax === bx ? P : 0, activation: 'always', onSeconds: 2, offSeconds: 2, offsetSeconds: 0, startEnabled: true, damage: null, length: r2(len) });
}
function gate(id: string, name: string, x: number, z: number, alongX: boolean): void {
  GATES.push(id);
  m.add({ kind: 'door', id, name, position: [x, GROUND, z], yaw: alongX ? 0 : P, startOpen: false, locked: true, auto: false });
}
/**
 * A rectangular paddock x0..x1, z0..z1 with a 3 m gate in one side
 * (`side` and the gate's centre along it).
 */
function paddock(name: string, gateId: string, x0: number, z0: number, x1: number, z1: number, side: Side, g: number): void {
  const sides: [Side, number, number, number, number][] = [['S', x0, z0, x1, z0], ['N', x0, z1, x1, z1], ['W', x0, z0, x0, z1], ['E', x1, z0, x1, z1]];
  for (const [s, ax, az, bx, bz] of sides) {
    if (s !== side) {
      // Runs of at most 96 m.
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(len / 96);
      for (let i = 0; i < n; i++) fence(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, ax + ((bx - ax) * (i + 1)) / n, az + ((bz - az) * (i + 1)) / n, `${name} fence`);
      continue;
    }
    const alongX = az === bz;
    if (alongX) {
      fence(ax, az, g - 1.5, az, `${name} fence`);
      fence(g + 1.5, az, bx, az, `${name} fence`);
      gate(gateId, `${name} gate`, g, az, true);
    } else {
      fence(ax, az, ax, g - 1.5, `${name} fence`);
      fence(ax, g + 1.5, ax, bz, `${name} fence`);
      gate(gateId, `${name} gate`, ax, g, false);
    }
  }
  pad(x0 - 4, z0 - 4, x1 + 4, z1 + 4, GROUND, 10, 'mud');
}
// The Rex paddock: a huge fence with concrete pylons every 8 m, floodlights on the corners.
const REX = { x0: -100, z0: 40, x1: -44, z1: 84 };
paddock('Rex paddock', 'gate_rex', REX.x0, REX.z0, REX.x1, REX.z1, 'S', -60.5);
const PYLON: Look = { material: 'pbr_concrete', tint: '#9a968c' };
for (let x = REX.x0; x <= REX.x1; x += 8) for (const z of [REX.z0 - 0.7, REX.z1 + 0.7]) if (Math.abs(x + 60.5) > 3) box(x - 0.5, GROUND, z - 0.5, x + 0.5, 9, z + 0.5, PYLON);
for (let z = REX.z0 + 8; z < REX.z1; z += 8) for (const x of [REX.x0 - 0.7, REX.x1 + 0.7]) box(x - 0.5, GROUND, z - 0.5, x + 0.5, 9, z + 0.5, PYLON);
box(-64, 3.6, REX.z0 - 1.2, -57, 9, REX.z0 - 0.2, { material: 'pbr_rusted_plate', tint: '#8a6a4a' }); // the gate's lintel
// The goat post by the viewing deck, the feeder the Rex circles.
m.add({ kind: 'prop', id: 'rex_post', model: 'prop.wood_support', position: [-50, GROUND, 68], yaw: 0, scale: 1.4, solid: true, tint: null });
m.prop('hay_bale', [-52, GROUND, 66], 0.4);
// The raptor pen: concrete walls 8 m high, 2.4 m thick, a walk round their tops, a gate in the south wall.
const PEN = { x0: 36, z0: 44, x1: 60, z1: 68 };
const CONCRETE: Look = { material: 'pbr_concrete_dark', tint: '#8a8a84' };
const T = 2.4;
box(PEN.x0, GROUND, PEN.z0, 46.5, 8, PEN.z0 + T, CONCRETE);
box(49.5, GROUND, PEN.z0, PEN.x1, 8, PEN.z0 + T, CONCRETE);
box(46.5, 3.4, PEN.z0, 49.5, 8, PEN.z0 + T, CONCRETE);
box(PEN.x0, GROUND, PEN.z1 - T, PEN.x1, 8, PEN.z1, CONCRETE);
box(PEN.x0, GROUND, PEN.z0 + T, PEN.x0 + T, 8, PEN.z1 - T, CONCRETE);
box(PEN.x1 - T, GROUND, PEN.z0 + T, PEN.x1, 8, PEN.z1 - T, CONCRETE);
const RAIL: Look = { material: 'pbr_steel', tint: '#d0c040' };
box(PEN.x0 + T - 0.2, 8, PEN.z0 + T - 0.2, PEN.x1 - T + 0.2, 9, PEN.z0 + T, RAIL);
box(PEN.x0 + T - 0.2, 8, PEN.z1 - T, PEN.x1 - T + 0.2, 9, PEN.z1 - T + 0.2, RAIL);
box(PEN.x0 + T - 0.2, 8, PEN.z0 + T, PEN.x0 + T, 9, PEN.z1 - T, RAIL);
box(PEN.x1 - T, 8, PEN.z0 + T, PEN.x1 - T + 0.2, 9, 52.6, RAIL);
box(PEN.x1 - T, 8, 59.4, PEN.x1 - T + 0.2, 9, PEN.z1 - T, RAIL);
gate('gate_raptor', 'Raptor pen gate', 48, PEN.z0 + T / 2, true);
pad(PEN.x0 - 4, PEN.z0 - 4, PEN.x1 + 20, PEN.z1 + 4, GROUND, 10, 'stone');
// Up to the wall walk: open stairs north from the road side, a landing, then west up on to the wall.
m.tile('stairs_open', 9, 6, 0, 3);
m.tile('platform_rail', 9, 7, 1);
m.tile('stairs_open', 8, 7, 1, 2);
paint(9, 7, 1, { floor: mat('pbr_tread_plate') });
m.edge(9, 7, 1, 'W', 'open');
m.edge(9, 7, 1, 'S', 'open');
for (const [x, z] of [[68.3, 52.3], [75.7, 52.3], [68.3, 59.7], [75.7, 59.7], [60.4, 52.3], [60.4, 59.7]] as const) box(x - 0.15, GROUND, z - 0.15, x + 0.15, 4, z + 0.15, { material: 'pbr_steel' });
m.block([72, -0.3, 43.3], [5, 0.4, 1.4], 'solid', { material: 'pbr_concrete', tint: '#b8b4ac' }); // a step up on to the stairs
m.add({ kind: 'prop', id: 'raptor_feeder', model: 'prop.fern', position: [42, GROUND, 62], yaw: 0, scale: 1.2, solid: false, tint: null });
// The spitter paddock (south-east) with its pond; the aviary (south-west) under a steel cage.
const SPIT = { x0: 64, z0: -44, x1: 104, z1: -4 };
paddock('Spitter paddock', 'gate_spitter', SPIT.x0, SPIT.z0, SPIT.x1, SPIT.z1, 'W', -24);
m.add({ kind: 'prop', id: 'spitter_pond', model: 'prop.nt_boulder_moss', position: [92, GROUND, -16], yaw: 0.4, scale: 1.2, solid: true, tint: null });
const AVI = { x0: -104, z0: -64, x1: -64, z1: -24 };
paddock('Aviary', 'gate_aviary', AVI.x0, AVI.z0, AVI.x1, AVI.z1, 'E', -44);
const STEEL: Look = { material: 'pbr_steel', tint: '#5a6066' };
for (const x of [AVI.x0 - 0.8, -84, AVI.x1 + 0.8]) for (const z of [AVI.z0 - 0.8, -44, AVI.z1 + 0.8]) if (!(x === -84 && z === -44) && !(x === AVI.x1 + 0.8 && z === -44)) box(x - 0.4, GROUND, z - 0.4, x + 0.4, 14, z + 0.4, STEEL);
box(-84.4, GROUND, -44.4, -83.6, 14, -43.6, STEEL);
for (const z of [AVI.z0 - 0.8, -44, AVI.z1 + 0.8]) box(AVI.x0 - 1.2, 14, z - 0.3, AVI.x1 + 1.2, 14.6, z + 0.3, STEEL);
for (const x of [AVI.x0 - 0.8, -84, AVI.x1 + 0.8]) box(x - 0.3, 14, AVI.z0 - 1.2, x + 0.3, 14.6, AVI.z1 + 1.2, STEEL);
m.add({ kind: 'prop', id: 'aviary_perch', model: 'prop.nt_dead_tree', position: [-90, GROUND, -36], yaw: 1.2, scale: 1.3, solid: true, tint: null });

// The Rex viewing deck, outside the east fence: open stairs up from the road.
m.tile('platform_rail', -5, 8, 1);
paint(-5, 8, 1, { floor: mat('oak_planks', '#8a6a4a') });
m.tile('stairs_open', -4, 8, 0, 2);
m.edge(-5, 8, 1, 'E', 'open');
for (const [x, z] of [[-43.7, 60.3], [-36.3, 60.3], [-43.7, 67.7], [-36.3, 67.7]] as const) box(x - 0.15, GROUND, z - 0.15, x + 0.15, 4, z + 0.15, { material: 'dark_wood' });
m.block([-27.3, -0.3, 64], [1.4, 0.4, 5], 'solid', { material: 'pbr_concrete', tint: '#b8b4ac' });
pad(-46, 58, -26, 70, GROUND, 8, 'gravel');

// ---------------------------------------------------------------- the river: boat station, bridges

// The boat ride's station on the south bank in the middle of the park, a canopy over the dock.
const RZ0 = riverZ(0);
box(-9, -0.3, RZ0 - 9, 9, 0.15, RZ0 - 5.2, { material: 'pbr_concrete', tint: '#a8a49a' });
for (const x of [-8, 0, 8]) box(x - 0.15, 0.15, RZ0 - 8.8, x + 0.15, 3.6, RZ0 - 8.5, { material: 'dark_wood' });
for (const x of [-8, 0, 8]) box(x - 0.15, 0.15, RZ0 - 5.7, x + 0.15, 3.6, RZ0 - 5.4, { material: 'dark_wood' });
box(-9.4, 3.6, RZ0 - 9.4, 9.4, 3.85, RZ0 - 4.8, { material: 'pbr_roof', tint: '#6a4a2a' });
pad(-14, RZ0 - 24, 14, RZ0 - 9, GROUND, 8, 'gravel');
// Concrete walls line the channel either side of the station (the boat-ride run), with gaps.
for (const [xa, xb] of [[-30, -12], [12, 30]] as const) {
  for (const s of [-1, 1]) {
    const za = riverZ(xa) + s * 6.4;
    const zb = riverZ(xb) + s * 6.4;
    const len = Math.hypot(xb - xa, zb - za);
    const yaw = -Math.atan2(zb - za, xb - xa);
    m.block([r2((xa + xb) / 2), -2.5, r2((za + zb) / 2)], [r2(len), 3.3, 0.6], 'solid', { material: 'pbr_concrete', tint: '#9a968c', yaw: r2(yaw) });
  }
}
/** A bridge across the river at x, deck `y` high, `w` wide (along z, the river running east-west). */
function bridge(x: number, w: number, y: number, look: Look, rails: Look): void {
  const zc = riverZ(x);
  box(x - w / 2, y - 0.5, zc - 11, x + w / 2, y, zc + 11, look);
  box(x - w / 2, y, zc - 11, x - w / 2 + 0.25, y + 1.05, zc + 11, rails);
  box(x + w / 2 - 0.25, y, zc - 11, x + w / 2, y + 1.05, zc + 11, rails);
  for (const dz of [-4, 4]) box(x - w / 2 + 0.4, -3.5, zc + dz - 0.5, x + w / 2 - 0.4, y - 0.5, zc + dz + 0.5, { material: 'pbr_concrete', tint: '#8a867c' });
  pad(x - w / 2 - 1, zc - 18, x + w / 2 + 1, zc - 10.5, y - 0.03, 10, 'dirt');
  pad(x - w / 2 - 1, zc + 10.5, x + w / 2 + 1, zc + 18, y - 0.03, 10, 'dirt');
}
bridge(-40, 9, 1.4, { material: 'pbr_planks', tint: '#7a6048' }, { material: 'dark_wood' });
bridge(80, 9, 1.4, { material: 'pbr_planks', tint: '#7a6048' }, { material: 'dark_wood' });
bridge(18, 3.4, 1.4, { material: 'oak_planks', tint: '#9a7a58' }, { material: 'dark_wood' });

// ---------------------------------------------------------------- the helipad (north-east, on the rise)

const HELI = { x: 84, z: 84 };
box(HELI.x - 11, 2.4, HELI.z - 11, HELI.x + 11, 3, HELI.z + 11, { material: 'pbr_concrete', tint: '#8a8a88' });
box(HELI.x - 8, 2.95, HELI.z - 8, HELI.x + 8, 3.02, HELI.z + 8, { material: 'paint_matte', tint: '#d8d4c8' });
box(HELI.x - 6.5, 2.97, HELI.z - 6.5, HELI.x + 6.5, 3.04, HELI.z + 6.5, { material: 'paint_matte', tint: '#4a4a48' });
for (const dx of [-3, 3]) box(HELI.x + dx - 0.6, 3, HELI.z - 4, HELI.x + dx + 0.6, 3.06, HELI.z + 4, { material: 'paint_matte', tint: '#e8c040' });
box(HELI.x - 3, 3, HELI.z - 0.6, HELI.x + 3, 3.06, HELI.z + 0.6, { material: 'paint_matte', tint: '#e8c040' });
pad(HELI.x - 11, HELI.z - 11, HELI.x + 11, HELI.z + 11, 2.9, 16, 'stone');

// ---------------------------------------------------------------- terrain

const T0 = -120;
const COLS = 121;
const SP = 2;
const noise = (x: number, z: number) => Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.4) + 0.5 * Math.sin((x + z) * 0.19) + 0.3 * Math.cos((x - 2 * z) * 0.13);
const rectDist = (p: Pad, x: number, z: number) => Math.hypot(Math.max(p.x0 - x, 0, x - p.x1), Math.max(p.z0 - z, 0, z - p.z1));
function padAt(x: number, z: number): { p: Pad; w: number } | null {
  let best: { p: Pad; w: number } | null = null;
  for (const p of pads) {
    const w = 1 - sm(0, p.blend, rectDist(p, x, z));
    if (w > 0 && (!best || w > best.w + 1e-9)) best = { p, w };
  }
  return best;
}
const roadDist = (x: number, z: number) => Math.min(lineDist(x, z, ROAD), lineDist(x, z, GATE_ROAD));
const riverDist = (x: number, z: number) => lineDist(x, z, RIVER);
const heights: number[] = [];
for (let r = 0; r < COLS; r++)
  for (let c = 0; c < COLS; c++) {
    const x = T0 + c * SP;
    const z = T0 + r * SP;
    const dr = riverDist(x, z);
    // Rolling jungle floor, rising toward the hills in the north.
    let h = 1.1 + 0.55 * noise(x, z) + 6 * sm(70, 118, z) * (0.6 + 0.4 * noise(x * 0.7, z * 0.5)) + 3 * sm(100, 118, Math.abs(x));
    h -= 0.5 * (1 - sm(3, 8, roadDist(x, z))) * Math.max(0, h - 0.6);
    const pp = padAt(x, z);
    if (pp && dr > 9) h += (pp.p.y - h) * pp.w;
    // The river channel.
    const bed = -3.4 + 3.8 * sm(2, 10, dr);
    if (dr < 10) h = Math.min(h, bed);
    heights.push(Math.round(h * 100));
  }
const t0: TerrainData = { origin: [T0, T0], spacing: SP, cols: COLS, rows: COLS, baseY: 0, heights, materials: [], boundary: true, foliage: [] };
const materials: number[] = [];
const foliage: number[] = [];
for (let r = 0; r < COLS - 1; r++)
  for (let c = 0; c < COLS - 1; c++) {
    const x = T0 + c * SP + 1;
    const z = T0 + r * SP + 1;
    const h = terrainHeightAt(t0, x, z) ?? 0;
    const pp = padAt(x, z);
    let g: TerrainMaterial;
    let f = 0;
    if (h < WATER + 0.1) g = 'mud';
    else if (roadDist(x, z) < 3.6) g = 'dirt';
    else if (pp && pp.w > 0.85 && pp.p.ground) {
      g = pp.p.ground;
      f = g === 'mud' ? 2 : 0;
    } else {
      g = noise(x * 1.6, z * 1.6) > 0.9 ? 'mud' : noise(x * 2.1 + 30, z * 2.3) > 1.1 ? 'grass' : 'moss';
      f = 4;
    }
    materials.push(TERRAIN_MATERIALS.indexOf(g));
    foliage.push(f);
  }
const ground = paintSlopes({ ...t0, materials, foliage }, 36, 'stone');
m.terrain(ground);
m.water([0, -6, 0], [250, 6 + WATER, 250], 'water', '#4a5a36'); // a murky jungle river
const gy = (x: number, z: number) => r2(terrainHeightAt(ground, x, z) ?? 0);
/** Floor height at (x, z): level 0 inside a ground-floor tile, the terrain elsewhere. */
const floorAt = (x: number, z: number) => (m.doc.classicStructure.tiles.some((t) => t.z === 0 && Math.abs(t.x * 8 - x) < 4.01 && Math.abs(t.y * 8 - z) < 4.01) ? 0 : gy(x, z));
const on = (x: number, z: number): V3 => [x, gy(x, z), z];

// ---------------------------------------------------------------- buttons, the zone at the helipad

m.add({ kind: 'button', id: 'btn_power', name: 'Fence power', position: [-16, 4, -83.4], yaw: 0, label: 'Cut the fence power (20 s)', once: false, cooldownSeconds: 45, startEnabled: true });
m.add({ kind: 'button', id: 'btn_radio', name: 'Radio', position: [-8, 4, -83.4], yaw: 0, label: 'Radio for the evac chopper', once: true, cooldownSeconds: 1, startEnabled: true });
m.add({ kind: 'button', id: 'btn_keep_rex', name: "Keeper's release", position: [-56, GROUND, 41], yaw: PI, label: 'Open the gate (6 s)', once: false, cooldownSeconds: 20, startEnabled: true });
m.add({ kind: 'button', id: 'btn_keep_raptor', name: "Keeper's release", position: [52, GROUND, 47], yaw: PI, label: 'Open the gate (6 s)', once: false, cooldownSeconds: 20, startEnabled: true });
m.add({ kind: 'button', id: 'btn_keep_spitter', name: "Keeper's release", position: [65, GROUND, -20], yaw: -P, label: 'Open the gate (6 s)', once: false, cooldownSeconds: 20, startEnabled: true });
m.add({ kind: 'button', id: 'btn_keep_aviary', name: "Keeper's release", position: [-65, GROUND, -40], yaw: P, label: 'Open the gate (6 s)', once: false, cooldownSeconds: 20, startEnabled: true });
m.add({ kind: 'zone', id: 'zone_helipad', name: 'Helipad', position: [HELI.x, 3, HELI.z], size: [20, 4, 20], who: 'all', count: 1, startEnabled: false });

// ---------------------------------------------------------------- the residents and the waves

const roster = { trooper: 0, gunner: 0, heavy: 0 };
const res = { kind: 'encounter', yaw: 0, faction: 'dinos', perPlayer: 0, difficulty: 'normal', startActive: true, order: 'patrol' } as const;
m.add({ ...res, id: 'enc_rex', name: 'The Rex', position: [-74, GROUND, 62], roster: { ...roster, scolitex: 1 }, activeCap: 1, reinforcements: 1, respawnSeconds: 90, radius: 4, orderTarget: 'rex_post', size: 2.2, health: 3, damage: 1.6 });
m.add({ ...res, id: 'enc_raptors', name: 'Raptor pack', position: [48, GROUND, 56], roster: { ...roster, puglin: 3, imp: 1 }, activeCap: 4, reinforcements: 2, respawnSeconds: 45, radius: 4, orderTarget: 'raptor_feeder' });
m.add({ ...res, id: 'enc_spitters', name: 'Spitters', position: [84, GROUND, -28], roster: { ...roster, cyclops: 3 }, activeCap: 3, reinforcements: 2, respawnSeconds: 45, radius: 5, orderTarget: 'spitter_pond' });
m.add({ ...res, id: 'enc_flyers', name: 'Aviary flyers', position: [-84, GROUND, -50], roster: { ...roster, oculus: 3 }, activeCap: 3, reinforcements: 2, respawnSeconds: 45, radius: 5, orderTarget: 'aviary_perch' });
const wave = { kind: 'encounter', yaw: 0, faction: 'dinos', difficulty: 'normal', startActive: false, order: 'attack', orderTarget: null } as const;
m.add({ ...wave, id: 'enc_wave1', name: 'Wave 1: raptors from the west jungle', position: on(-60, -88), roster: { ...roster, puglin: 4, imp: 2 }, activeCap: 6, reinforcements: 8, perPlayer: 2, respawnSeconds: 3, radius: 8, entrance: 'burrow' });
m.add({ ...wave, id: 'enc_wave2', name: 'Wave 2: spitters from the east', position: on(60, -76), roster: { ...roster, cyclops: 2, imp: 3, puglin: 2 }, activeCap: 7, reinforcements: 10, perPlayer: 3, respawnSeconds: 3, radius: 8, entrance: 'burrow' });
m.add({ ...wave, id: 'enc_wave3', name: 'Wave 3: everything from the north', position: on(4, -30), roster: { ...roster, puglin: 4, imp: 3, cyclops: 2, oculus: 2 }, activeCap: 10, reinforcements: 18, perPlayer: 4, respawnSeconds: 2.5, radius: 10, difficulty: 'hard', entrance: 'burrow' });

type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const say = (text: string, seconds = 4) => act('message', null, { value: seconds, text });
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = [], once = true) =>
  ({ id, name, enabled: true, once, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const RESIDENTS = ['enc_rex', 'enc_raptors', 'enc_spitters', 'enc_flyers'];
const WAVES = ['enc_wave1', 'enc_wave2', 'enc_wave3'];
const keeper = (button: string, door: string) =>
  rule(`rule_${button}`, `Keeper's release: ${door}`, 'button_pressed', button, [act('door_unlock', door), act('door_open', door), act('sound', null, { state: 'buzzer' }), act('wait', null, { value: 6 }), act('door_close', door), act('door_lock', door)], [], false);

// Paddock floodlights: the control room's power switch turns them to blinking red.
const FLOODS: string[] = [];
for (const [x, z] of [[REX.x0, REX.z0], [REX.x1, REX.z0], [REX.x0, REX.z1], [REX.x1, REX.z1], [SPIT.x0, SPIT.z1], [AVI.x1, AVI.z1]] as const) {
  const id = `flood_${FLOODS.length + 1}`;
  FLOODS.push(id);
  m.light([x, 9.5, z], { id, fixture: 'none', color: '#d8f0ff', intensity: 1.4, range: 18 });
}
m.logic({
  variables: [{ id: 'var_lives', name: 'lives', initial: 15 }],
  timers: [
    { id: 'timer_power', name: 'Fence power', seconds: 20, loop: false, visible: true },
    { id: 'timer_evac', name: 'Chopper inbound', seconds: 210, loop: false, visible: true },
    { id: 'timer_wave2', name: 'Wave 2', seconds: 60, loop: false, visible: false },
    { id: 'timer_wave3', name: 'Wave 3', seconds: 65, loop: false, visible: false },
  ],
  objectives: [
    { id: 'obj_radio', text: 'Radio for the evac chopper from the control room', startActive: true, marker: 'btn_radio' },
    { id: 'obj_hold', text: 'Hold out until the chopper arrives', startActive: false, marker: null },
    { id: 'obj_escape', text: 'Get everyone to the helipad', startActive: false, marker: 'zone_helipad' },
  ],
  rules: [
    rule('rule_intro', 'The storm', 'match_start', null, [say('The storm has cut Primeval Park off. Radio for the evac chopper from the control room upstairs. The fence power switch is there too: 20 seconds with every paddock gate open.', 7)]),
    // The power switch: the fences go dark and every gate opens for 20 s; the residents head out.
    rule('rule_power_fences', 'Fence power cut', 'button_pressed', 'btn_power', [act('sound', null, { state: 'alarm' }), say('Fence power down! The paddock gates are open!', 5), ...FENCES.map((f) => act('disable', f)), act('timer_start', 'timer_power')], [], false),
    rule('rule_power_gates', 'Gates open, residents roam', 'button_pressed', 'btn_power', [...GATES.flatMap((g) => [act('door_unlock', g), act('door_open', g)]), ...RESIDENTS.map((e) => act('encounter_order', e, { state: 'roam' })), ...FLOODS.flatMap((l) => [act('light_color', l, { text: '#ff2a1a' }), act('light_blink', l, { value: 2, state: 'on' })])], [], false),
    rule('rule_power_back', 'Fence power restored', 'timer_done', 'timer_power', [...FENCES.map((f) => act('enable', f)), act('sound', null, { state: 'chime' }), say('Fence power restored. Whatever got out is still out.', 4)], [], false),
    rule('rule_power_shut', 'Gates shut', 'timer_done', 'timer_power', [...GATES.flatMap((g) => [act('door_close', g), act('door_lock', g)]), ...FLOODS.flatMap((l) => [act('light_blink', l, { value: 2, state: 'off' }), act('light_color', l, { text: '#d8f0ff' })])], [], false),
    keeper('btn_keep_rex', 'gate_rex'),
    keeper('btn_keep_raptor', 'gate_raptor'),
    keeper('btn_keep_spitter', 'gate_spitter'),
    keeper('btn_keep_aviary', 'gate_aviary'),
    rule('rule_radio', 'Mayday', 'button_pressed', 'btn_radio', [
      act('objective', 'obj_radio', { state: 'complete' }),
      act('objective', 'obj_hold', { state: 'active' }),
      act('sound', null, { state: 'alarm' }),
      say('Chopper is three and a half minutes out. Something heard that radio. Raptors in the west jungle!', 5),
      act('timer_start', 'timer_evac'),
      act('timer_start', 'timer_wave2'),
      act('encounter_start', 'enc_wave1'),
    ]),
    rule('rule_wave2', 'Wave 2', 'timer_done', 'timer_wave2', [say('Spitters coming up from the east paddocks!', 4), act('sound', null, { state: 'buzzer' }), act('encounter_start', 'enc_wave2'), act('timer_start', 'timer_wave3')]),
    rule('rule_wave3', 'Wave 3: the Rex breaks out', 'timer_done', 'timer_wave3', [
      act('sound', null, { state: 'boom' }),
      say('The Rex has broken through its gate! Everything in the north jungle is coming!', 5),
      act('door_unlock', 'gate_rex'),
      act('door_open', 'gate_rex'),
      act('encounter_order', 'enc_rex', { state: 'attack' }),
      act('encounter_start', 'enc_wave3'),
    ]),
    rule('rule_evac', 'The chopper lands', 'timer_done', 'timer_evac', [
      act('objective', 'obj_hold', { state: 'complete' }),
      act('objective', 'obj_escape', { state: 'active' }),
      act('enable', 'zone_helipad'),
      act('sound', null, { state: 'chime' }),
      say('The chopper is on the pad! Everyone to the helipad in the north-east!', 6),
    ]),
    rule('rule_escape', 'Lift off', 'zone_enter', 'zone_helipad', [...WAVES.map((w) => act('encounter_stop', w)), act('objective', 'obj_escape', { state: 'complete' }), say('Everyone aboard. Lift off!', 4), act('wait', null, { value: 3 }), act('end_round', null, { state: 'players win' })]),
    rule('rule_life_lost', 'Count the fallen', 'player_killed', null, [act('add_var', 'var_lives', { value: -1 })], [cond('objective', 'obj_radio', '==', 0, 'complete')], false),
    rule('rule_low_lives', 'Few left', 'variable_changed', 'var_lives', [say('Only 5 lives left!', 3), act('sound', null, { state: 'buzzer' })], [cond('variable', 'var_lives', '==', 5)]),
    rule('rule_defeat', 'Nobody leaves the island', 'variable_changed', 'var_lives', [say('Nobody is leaving the island tonight.', 5), act('end_round', null, { state: 'players lose' })], [cond('variable', 'var_lives', '<=', 0)]),
  ],
});

// ---------------------------------------------------------------- vehicles

m.mount('gun_jeep', [24, GROUND, -106], 0, south);
m.mount('buggy', [32, GROUND, -106], 0, south);
m.mount('gun_jeep', on(70, 70), PI, north);
m.mount('buggy', on(64, 76), PI, north);
m.mount('buggy', on(-44, -12), 0); // tour jeeps out on the road
m.mount('buggy', on(-16, 70), 0.3);
m.mount('gunship', [HELI.x, 3, HELI.z], -P * 1.5);
m.mount('hauler', [-4, WATER + 0.15, RZ0], P); // the ride boat
m.mount('hover_bike', [6, WATER + 0.15, RZ0 - 2], P);
m.mount('hover_bike', [6, WATER + 0.15, RZ0 + 2], P);
m.mount('turret_mg', [-40, 4, 66.5], -P);

// ---------------------------------------------------------------- spawns

// The first (where reachability is checked from) at the boat station, in the middle of the park.
m.spawn([-4, 0.15, RZ0 - 7], PI);
// Everyone (co-op, deathmatch): the visitor centre and round it.
for (const [x, y, z, yaw] of [
  [0, 0, -88, 0], [8, 0, -88, 0], [-12, 0, -80, P], [-12, 0, -72, P], [20, 0, -80, -P], [20, 0, -72, -P], [-1, 4, -82.5, 0], [10, 4, -70, PI],
  [-8, 4, -72, P], [32, 0, -80, -P], [0, 4, -88, PI], [8, 4, -88, PI], [20, 4, -74, 0], [4, 0, -62, 0], [-14, 0, -64, 0], [24, 0, -64, 0],
  [4, 0.15, RZ0 - 7, PI], [-36, 0, -54, P], [40, 0, -40, -P], [-10, 0, -100, 0],
] as const) m.spawn([x, y === 0 ? floorAt(x, z) : y, z], yaw);
// The visitor-centre team at the gate and car park; the north team round the helipad.
for (const [x, z] of [[-8, -104], [0, -112], [-14, -112], [16, -112], [24, -100], [32, -112], [-8, -96], [36, -98], [16, -98], [40, -110]] as const) m.spawn([x, GROUND, z], 0, south);
for (const [x, z] of [[76, 76], [92, 76], [76, 92], [92, 92], [84, 100], [66, 94], [100, 84], [58, 76], [104, 68], [70, 104]] as const) {
  const y = Math.abs(x - HELI.x) <= 11 && Math.abs(z - HELI.z) <= 11 ? 3 : gy(x, z);
  m.spawn([x, y, z], facing(x, z), north);
}
function facing(x: number, z: number): number {
  return r2(Math.atan2(4 - x, -20 - z));
}

// ---------------------------------------------------------------- objectives for the team modes

m.flag(south, [4, 0, -88], PI);
m.flag(north, [HELI.x, 3, HELI.z - 6], PI);
m.hill([0, 0.15, RZ0 - 7], 5); // the boat station
m.hill([-40, 4, 64], 4); // the Rex viewing deck
m.hill([48, 8, PEN.z0 + T / 2], 3); // the raptor pen's south wall

// ---------------------------------------------------------------- pickups

const items: [string, V3, number?][] = [
  ['weapon_shotgun', [-12, GROUND, -76]], ['weapon_smg', [24, GROUND, -76]], ['armor_large', [-12, 4, -72], 40], ['health_large', [-16, GROUND, -70]],
  ['ammo', [32, GROUND, -72]], ['ammo_shells', [32, GROUND, -80]], ['health_small', [4, 4, -88]], ['grenades', [12, 4, -78]],
  ['weapon_rifle', [-8, 0.15, RZ0 - 7]], ['ammo_rifle', [8, 0.15, RZ0 - 6]], ['weapon_sniper', [40, 8, PEN.z0 + T / 2], 30], ['ammo_sniper', [56, 8, PEN.z1 - T / 2]],
  ['weapon_launcher', [-40, 4, 61], 30], ['ammo_explosive', [-30, 0, 76]], ['sheep', [-50, GROUND, 70], 45], ['powerup_damage', [-56, GROUND, 76], 90],
  ['weapon_lmg', [HELI.x - 8, 3, HELI.z + 8], 30], ['health_large', [HELI.x + 8, 3, HELI.z - 8]], ['weapon_flamethrower', [56, GROUND, -24], 30], ['ammo_fuel', [56, GROUND, -16]],
  ['grenades', [-58, GROUND, -40]], ['weapon_auto_shotgun', [-52, GROUND, -48]], ['health_small', [-40, 1.4, riverZ(-40) + 4]], ['health_small', [80, 1.4, riverZ(80) - 4]],
  ['weapon_marksman', [18, 1.4, riverZ(18)]], ['armor_small', [-14, GROUND, -40]], ['armor_small', [24, GROUND, -40]], ['ammo', [70, GROUND, 30]],
  ['incendiaries', [-30, GROUND, 30]], ['weapon_rockets', [10, GROUND, 70], 60], ['health_small', [30, GROUND, 90]], ['ammo_rifle', [-60, GROUND, 100]],
];
for (const [item, p, rs] of items) m.pickup(item, p[1] === GROUND ? [p[0], floorAt(p[0], p[2]), p[2]] : p, rs ?? null);

// ---------------------------------------------------------------- props: paddock dressing, warning signs, the boat station, the car park

for (const [x, z, yaw] of [[-62, 38.6, PI], [-46, 38.6, PI], [62.6, -30, -P], [62.6, -18, -P], [-62.6, -50, P], [-62.6, -38, P], [40, 42, PI], [56, 42, PI]] as const) m.prop('warning_sign', on(x, z), yaw);
for (const [x, z] of [[-90, 50], [-80, 74], [-66, 56], [-92, 64], [86, -36], [74, -10], [98, -8], [-96, -56], [-74, -30], [-98, -30]] as const) m.prop(x > 0 || z < 0 ? 'palm_tall' : 'tree_plateau', on(x, z), x * 0.3, 1.2);
for (const [x, z] of [[-70, 48], [-58, 80], [-94, 44], [80, -40], [100, -24], [-80, -60], [-100, -40]] as const) m.prop('rock_large', on(x, z), z * 0.2, 1.1);
for (const [x, z] of [[40, 50], [54, 62], [40, 62], [55, 50]] as const) m.prop('fern', [x, GROUND, z], x, 1.3, false);
m.prop('log_big', [52, GROUND, 58], 0.6, 1).prop('nt_dead_tree', [41, GROUND, 52], 0.4, 1);
m.prop('bench', [-6, 0.15, RZ0 - 8], 0).prop('bench', [6, 0.15, RZ0 - 8], 0).prop('signpost', on(-12, RZ0 - 12), 0.3);
m.prop('lightpost', on(-14, -56), 0).prop('lightpost', on(22, -56), 0).prop('lightpost', [-2, GROUND, -114], 0).prop('lightpost', [10, GROUND, -114], 0);
m.prop('fountain', [4, GROUND, -100], 0, 1.2);
m.prop('banner_green', [-3.4, 4, -74], P, 1, false).prop('banner_green', [11.4, 4, -74], -P, 1, false);
for (const [x, z] of [[-52, -74], [-18, -54], [26, -54], [-28, 6], [34, 6], [-60, 90], [30, 70]] as const) m.prop('lantern_post', on(x, z), 0);

// ---------------------------------------------------------------- the jungle

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const KEEP = new Set(['spawn', 'pickup', 'flag', 'hill', 'mount', 'button', 'door', 'encounter', 'zone']);
const PADDOCKS = [REX, { x0: PEN.x0 - 4, z0: PEN.z0 - 4, x1: PEN.x1 + 18, z1: PEN.z1 + 4 }, SPIT, AVI];
function clear(x: number, z: number, r: number): boolean {
  if (Math.abs(x) > 113 || Math.abs(z) > 113) return false;
  for (const q of PADDOCKS) {
    const inside = x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1;
    const edgeD = Math.min(Math.abs(x - q.x0), Math.abs(x - q.x1), Math.abs(z - q.z0), Math.abs(z - q.z1));
    if ((inside || (x > q.x0 - 3 && x < q.x1 + 3 && z > q.z0 - 3 && z < q.z1 + 3)) && edgeD < r + 3) return false;
  }
  for (const e of m.doc.entities) {
    if (e.kind === 'water' || e.kind === 'light' || e.kind === 'trap') continue;
    if (e.kind === 'block') {
      if (Math.abs(e.position[0] - x) < e.size[0] / 2 + r && Math.abs(e.position[2] - z) < e.size[2] / 2 + r) return false;
      continue;
    }
    const d = Math.hypot(e.position[0] - x, e.position[2] - z);
    if (e.kind === 'prop' || e.kind === 'destructible') {
      if (d < r + 1) return false;
    } else if (KEEP.has(e.kind) && d < r + ('radius' in e && e.kind !== 'encounter' ? (e.radius as number) : e.kind === 'zone' ? 12 : 2) + 1.5) return false;
  }
  for (const t of m.doc.classicStructure.tiles) if (Math.abs(t.x * 8 - x) < 4 + r && Math.abs(t.y * 8 - z) < 4 + r) return false;
  return true;
}
function plant(model: string, x: number, z: number, r: number, scale: number, solid = true): boolean {
  const h = terrainHeightAt(ground, x, z);
  if (h === null || h < WATER + 0.4) return false;
  if (roadDist(x, z) < 5.5 || riverDist(x, z) < 8) return false;
  const pp = padAt(x, z);
  if (pp && pp.w > 0.5 && !PADDOCKS.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1)) return false;
  if (!clear(x, z, r)) return false;
  m.prop(model, [r2(x), r2(h), r2(z)], r2(rnd() * 6.28), r2(scale), solid);
  flush();
  return true;
}
flush();
const TREES = ['palm_tall', 'nt_palm_tall', 'tree_plateau', 'palm', 'nt_palm_curved', 'tree_fat', 'nt_common_tree'];
let trees = 0;
for (let z = -112; z <= 112; z += 9)
  for (let x = -112; x <= 112; x += 9) {
    const jx = x + (rnd() - 0.5) * 6;
    const jz = z + (rnd() - 0.5) * 6;
    if (noise(jx * 0.5, jz * 0.5) < -1) continue;
    if (plant(TREES[Math.floor(rnd() * TREES.length)]!, jx, jz, 1.8, 1 + rnd() * 0.5)) trees++;
  }
let bushes = 0;
const UNDER = ['fern', 'nt_fern_wide', 'bush_large', 'nt_bush_leafy', 'plant_low'];
for (let i = 0; i < 1400 && bushes < 260; i++) {
  const x = (rnd() - 0.5) * 226;
  const z = (rnd() - 0.5) * 226;
  if (plant(UNDER[i % UNDER.length]!, x, z, 0.8, 1.1 + rnd() * 0.6, false)) bushes++;
}
console.log(`primeval_park: ${trees} trees, ${bushes} bushes`);

// ---------------------------------------------------------------- interiors

m.dress([-2, -10, 0], 'shop', { density: 'full', max: 40 });
m.dress([-2, -10, 1], 'server', { density: 'normal', max: 30 });
m.dress([2, -10, 0], 'dining', { density: 'full', max: 40 });
m.dress([4, -10, 0], 'kitchen', { density: 'normal' });
m.dress([4, -9, 0], 'storage', { density: 'normal' });
m.dress({ x0: 0, y0: -11, x1: 1, y1: -11, z: 0 }, 'lobby', { density: 'normal', max: 20 });
m.dress([0, -11, 1], 'office', { density: 'normal' });
m.dress([1, -11, 1], 'office', { density: 'normal' });

// ---------------------------------------------------------------- lights: a stormy night, the park's lamps

for (const [x, z] of [[-16, -80], [-8, -80], [-16, -72], [-8, -72]] as const) {
  m.light([x, 3.4, z], { color: '#fff1d6', intensity: 1, range: 9 });
  m.light([x, 7.4, z], { color: '#c8e0ff', intensity: 1, range: 9 });
}
for (const [x, z] of [[16, -80], [24, -80], [16, -72], [24, -72]] as const) m.light([x, 3.4, z], { color: '#ffd9a0', intensity: 1, range: 9 });
for (const [x, z] of [[0, -88], [8, -88], [32, -80], [32, -72]] as const) {
  m.light([x, 3.4, z], { color: '#fff1d6', intensity: 1, range: 9 });
  if (x < 20) m.light([x, 7.4, z], { color: '#fff1d6', intensity: 0.9, range: 9 });
}
m.light([4, 7.2, -76], { fixture: 'bulb', color: '#ffe0b0', intensity: 1.4, range: 14 });
for (const [x, z] of [[-14, -56], [22, -56], [-2, -114], [10, -114]] as const) m.light([x, gy(x, z) + 4.6, z], { fixture: 'none', color: '#ffcf8a', intensity: 1, range: 13 });
for (const [x, z] of [[-52, -74], [-18, -54], [26, -54], [-28, 6], [34, 6], [-60, 90], [30, 70]] as const) m.light([x, gy(x, z) + 2.6, z], { fixture: 'none', color: '#ffc27a', intensity: 1, range: 11 });
m.light([0, 3.3, RZ0 - 7], { fixture: 'ceiling', color: '#ffe8b0', intensity: 1.1, range: 12 });
// (The paddock floodlights are placed with the logic, which blinks them red while the power is cut.)
for (const [x, z] of [[PEN.x0 + 1.2, PEN.z0 + 1.2], [PEN.x1 - 1.2, PEN.z1 - 1.2]] as const) m.light([x, 10, z], { fixture: 'none', color: '#d8f0ff', intensity: 1.3, range: 16 });
for (const [dx, dz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]] as const) m.light([HELI.x + dx, 3.4, HELI.z + dz], { fixture: 'none', color: '#ff4030', intensity: 1, range: 8 });
m.light([-11, 2.8, -64], { fixture: 'none', color: '#fff1d6', intensity: 0.8, range: 8 });

// ---------------------------------------------------------------- the edges: the park's own fence, cliffs to the north

m.bounds('invisible', 0, { min: [-116, -116], max: [116, 116] }, 40);
m.border('fence', { north: 'cliffs' });
m.meta({
  description:
    "A dinosaur park on a jungle island on a stormy night. The visitor centre's rotunda holds a great skeleton between the gift shop and the restaurant, with the control room upstairs. A tour road loops north past the paddocks: the Rex behind its huge fence and goat post, the raptors in their high concrete pen, the spitters and the aviary, across a jungle river with a boat ride, to the helipad on the rise. The control room can cut the fence power for 20 seconds and open every gate. Co-op: radio for the chopper, survive three waves and the Rex's breakout, then get everyone to the helipad. Team modes: the visitor centre against the helipad, with the residents loose as a hazard. The dinosaurs are played by the creature kit: a giant scolitex, puglins and imps, cyclopes and oculi.",
  modes: ['core.coop', 'core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [8, 20],
});
await m.save();
