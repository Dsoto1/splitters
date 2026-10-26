/**
 * Dune Harbor: a desert spaceport town (our own map and name; a layout and
 * atmosphere homage built only from our kit), for 12–24 players in Hostage
 * Rescue, Bomb, Team Deathmatch, Capture the Flag, King of the Hill and
 * Deathmatch. Built on Style Pack 02 Frontier Dust (the adobe theme and
 * facade), sun-bleached plaster, under a hot, hazy sky over the dunes.
 *
 * - The town: domed adobe huts (stepped domes of blocks on their roofs)
 *   along a dusty main street, with narrow winding alleys between them, a
 *   market square of stalls and awnings, and moisture vaporators (built from
 *   blocks) on the roofs and out in the sand. Two hover speeders patrol the
 *   main street on movers (slow enough to shove you, not run you over: ride
 *   on top), and real speeders and hover bikes are parked about town.
 * - The cantina (north of the main street): a domed hall with the bar along
 *   one wall, booths, tables and a band stage under coloured lights; the back
 *   room behind it (where the hostages are held) and a stairwell down to the
 *   smugglers' cellar under it.
 * - Docking bays: three sunken circular pits with a ramp down into each.
 *   Bay 3 (west) and Bay 7 (east) hold dropships and haulers; the north bay
 *   holds a light freighter built from blocks: a disc of a hull you can walk
 *   into up its ramp, a cockpit tube off the starboard side, mandibles in
 *   front and a gun turret on the roof (a ladder up the port side).
 * - The desert edge: dunes north and south, and a crashed escape pod half
 *   buried in the southern sand.
 *
 * Teams: the first team (the raiders) start in Bay 3, the second (the
 * port militia) in Bay 7. Hostage Rescue: four hostages in the cantina's
 * back room and cellar, brought out to the top of the Bay 3 ramp. Bomb: Bay 7
 * (A) and the freighter (B). CTF: Bay 3 against Bay 7. KOTH: the cantina, the
 * market, the freighter.
 *
 * Grid x east, y north (one cell = 8 m):
 *
 *   y 6..10                   [ north bay: freighter ]
 *   y 3..5        alleys, back alley, cantina back room (cellar under it)
 *   y 1..2   huts [ CANTINA 2 × 2 ] huts  alley  huts
 *   y 0   (Bay 3) ═══════════════ main street ═══════════════ (Bay 7)
 *   y -1..-3 huts  alley  huts [ MARKET 3 × 2 ] huts alley huts
 *            x -7 ............. 0 ............... 7
 */
import { TERRAIN_MATERIALS, newTerrain, paintSlopes, terrainHeightAt, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Side, type TerrainData, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('dune_harbor', 'Dune Harbor');
m.theme('adobe');
m.backdrop('clear', 'dunes', 'sand', 0.72);
m.teams([12, 12]);
const [RAID, MILITIA] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const Q = Math.PI / 4;
const C = 8;
const r2 = (n: number) => Math.round(n * 100) / 100;
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * C + dx), r2(z * 4 + up), r2(y * C + dy)];
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- the land

const BASE = -0.15;
const PIT = -4;
/** The docking bays: centre, the way the ramp runs out (unit x/z), floor radius. */
const BAYS = {
  west: { c: [-84, 0] as [number, number], dir: [1, 0] as [number, number], r: 15 },
  east: { c: [84, 0] as [number, number], dir: [-1, 0] as [number, number], r: 15 },
  north: { c: [24, 80] as [number, number], dir: [0, -1] as [number, number], r: 15 },
};
/** Ground height of a bay at (x, z): its floor, a steep wall up to the rim, and the ramp out. */
function bayHeight(b: (typeof BAYS)[keyof typeof BAYS], x: number, z: number): number {
  const dx = x - b.c[0];
  const dz = z - b.c[1];
  const r = Math.hypot(dx, dz);
  const floor = PIT - BASE; // terrain heights sit on BASE: the floor comes out at PIT
  let h = r <= b.r ? floor : r < b.r + 2 ? floor + (-floor * (r - b.r)) / 2 : 0;
  const along = dx * b.dir[0] + dz * b.dir[1];
  const lat = Math.abs(dx * b.dir[1] - dz * b.dir[0]);
  if (along > 0 && lat < 4.2) h = Math.min(h, floor * (1 - smooth(b.r - 2, b.r + 9, along) ** 0.8) * (lat < 3.4 ? 1 : 1 - (lat - 3.4) / 0.8));
  return h;
}
/** Dunes north and south of town, kept off the bays. */
function dunes(x: number, z: number): number {
  const away = Math.min(...Object.values(BAYS).map((b) => Math.hypot(x - b.c[0], z - b.c[1])));
  const keep = smooth(22, 36, away);
  const north = smooth(58, 80, z);
  const south = smooth(-38, -60, z);
  const wave = 2.6 + 1.6 * Math.sin(x * 0.055 + z * 0.021) + 1.1 * Math.sin(x * 0.13 - z * 0.08 + 1.3) + 0.8 * Math.cos(z * 0.09 + x * 0.03);
  return Math.max(0, (north + south) * wave * keep);
}
/** The cantina cellar (and the stairwell down to it) is dug out under the town. */
const CELLAR = { x0: -20, x1: 4, z0: 20, z1: 28 };
function ground(x: number, z: number): number {
  if (x >= CELLAR.x0 && x <= CELLAR.x1 && z >= CELLAR.z0 && z <= CELLAR.z1) return -4.6;
  let h = dunes(x, z);
  for (const b of Object.values(BAYS)) h = Math.min(h, bayHeight(b, x, z));
  return h;
}
let terrain: TerrainData = { ...newTerrain(224, 2, [0, 0], 'sand'), baseY: BASE };
terrain = { ...terrain, heights: terrain.heights.map((_, i) => Math.round(ground(terrain.origin[0] + (i % terrain.cols) * 2, terrain.origin[1] + Math.floor(i / terrain.cols) * 2) * 100)) };
const GRAVEL = TERRAIN_MATERIALS.indexOf('gravel');
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const x = terrain.origin[0] + ((i % (terrain.cols - 1)) + 0.5) * 2;
    const z = terrain.origin[1] + (Math.floor(i / (terrain.cols - 1)) + 0.5) * 2;
    return ground(x, z) < -1 ? GRAVEL : v;
  }),
};
m.terrain(paintSlopes(terrain, 34, 'stone'));
const gnd = (x: number, z: number) => r2(terrainHeightAt(m.doc.terrain!, x, z) ?? BASE);

// ---------------------------------------------------------------- the town plan

type Kind = 'street' | 'hut' | 'big';
const cells = new Map<string, Kind>();
const key = (x: number, y: number) => `${x},${y}`;
const street = (...xy: [number, number][]) => xy.forEach(([x, y]) => cells.set(key(x, y), 'street'));
const huts = (...xy: [number, number][]) => xy.forEach(([x, y]) => cells.set(key(x, y), 'hut'));
const big = (...xy: [number, number][]) => xy.forEach(([x, y]) => cells.set(key(x, y), 'big'));

// The main street, the market square and the winding alleys off it.
for (let x = -7; x <= 7; x++) street([x, 0]);
street([1, -1], [2, -1], [3, -1], [1, -2], [2, -2], [3, -2]);
street([2, 1], [2, 2], [2, 3], [3, 3], [3, 4], [3, 5], [3, 6]); // north alley to the freighter's bay
street([-3, 1], [-3, 2], [-4, 2], [-4, 3], [-4, 4]); // north-west alley
for (let x = -3; x <= 2; x++) street([x, 4]); // the back alley behind the cantina
street([-2, -1], [-2, -2], [-3, -2], [-3, -3]); // south-west alley into the dunes
street([5, -1], [5, -2], [6, -2], [6, -3]); // south-east alley
// Buildings: the cantina and its back room, the long store and workshop, the harbour office, and huts.
big([-1, 1], [0, 1], [-1, 2], [0, 2], [-1, 3], [0, 3], [-2, 3], [-2, 1], [-2, 2], [1, 1], [1, 2], [4, 1], [5, 1], [4, 2], [5, 2]);
huts([-6, 1], [-5, 1], [-4, 1], [-6, 2], [-5, 2], [-3, 3], [1, 3], [4, 3], [6, 1], [6, 2]);
huts([-6, -1], [-5, -1], [-4, -1], [-3, -1], [-1, -1], [0, -1], [4, -1], [6, -1], [-5, -2], [-4, -2], [-1, -2], [0, -2], [4, -2]);

for (const [k, kind] of cells) {
  const [x, y] = k.split(',').map(Number) as [number, number];
  if (kind === 'street') m.tile('frontier.main_street', x, y);
}
const HUT: RoomOptions = { layout: 'empty', ceiling: 'roof', facade: 'adobe' };
for (const [k, kind] of cells) {
  const [x, y] = k.split(',').map(Number) as [number, number];
  if (kind === 'hut') m.tile('room', x, y, 0, 0, HUT);
}
m.tile('room_large', -1, 1, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'adobe' }); // the cantina
for (const x of [-1, 0]) m.tile('room', x, 3, 0, 0, HUT); // the back room
m.tile('stairwell', -2, 3, -1, 2); // down to the cellar (doorways east on both floors)
for (const x of [-1, 0]) m.tile('room', x, 3, -1, 0, { layout: 'empty' }); // the cellar
m.tile('room_long', -2, 1, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'adobe' }); // the general store
m.tile('room_long', 1, 1, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'adobe' }); // the droid workshop
m.tile('room_large', 4, 1, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'adobe' }); // the harbour office

// Sun-bleached plaster walls on every building.
const BLEACHED: TileSurfaces = { walls: { material: 'core.pbr_plaster', tint: '#efdcb8' } };
for (const t of [...m.doc.classicStructure.tiles]) {
  if (t.tile === 'frontier.main_street') continue;
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...BLEACHED } }] });
}

// ---------------------------------------------------------------- walls and openings

const SIDES: [Side, number, number][] = [['N', 0, 1], ['E', 1, 0], ['S', 0, -1], ['W', -1, 0]];
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);
// Huts: a door onto the first street they face, windows onto the others and onto the sand, walls between buildings.
for (const [k, kind] of cells) {
  if (kind !== 'hut') continue;
  const [x, y] = k.split(',').map(Number) as [number, number];
  // Huts with no street to face open their door onto the sand instead.
  const onStreet = SIDES.some(([, dx, dy]) => cells.get(key(x + dx, y + dy)) === 'street');
  let door = false;
  for (const [side, dx, dy] of SIDES) {
    const n = cells.get(key(x + dx, y + dy));
    const front = n === 'street' || (!onStreet && !n);
    const style: EdgeStyle = front ? (door ? 'window' : 'door') : n ? 'wall' : 'window';
    if (front) door = true;
    edge(x, y, 0, side, style);
  }
}
// The cantina: its door on the main street, a side door onto the north alley, the back room's door.
edge(-1, 1, 0, 'S', 'door').edge(0, 1, 0, 'S', 'window');
edge(-1, 1, 0, 'W', 'wall').edge(-1, 2, 0, 'W', 'wall');
edge(0, 1, 0, 'E', 'wall').edge(0, 2, 0, 'E', 'wall');
edge(-1, 2, 0, 'N', 'door').edge(0, 2, 0, 'N', 'wall');
// The back room: a door between its two halves, out onto the back alley and down the stairwell (west).
edge(-1, 3, 0, 'N', 'wall').edge(0, 3, 0, 'N', 'door').edge(0, 3, 0, 'E', 'wall');
// The general store (-2, 1..2) and the workshop (1, 1..2).
edge(-2, 1, 0, 'S', 'door').edge(-2, 1, 0, 'W', 'window').edge(-2, 2, 0, 'W', 'door').edge(-2, 2, 0, 'N', 'wall');
edge(1, 1, 0, 'S', 'wide').edge(1, 1, 0, 'E', 'window').edge(1, 2, 0, 'E', 'door').edge(1, 2, 0, 'N', 'wall');
// The harbour office (4..5, 1..2).
edge(4, 1, 0, 'S', 'door').edge(5, 1, 0, 'S', 'window').edge(4, 1, 0, 'W', 'window').edge(4, 2, 0, 'W', 'wall');
edge(4, 2, 0, 'N', 'wall').edge(5, 2, 0, 'N', 'wall').edge(5, 1, 0, 'E', 'wall').edge(5, 2, 0, 'E', 'wall');

// ---------------------------------------------------------------- domes, awnings and vaporators

const DOME = { material: 'pbr_plaster', tint: '#f4e6c8' };
/** A stepped dome on a roof: four tiers, each a square and the same square turned 45° (an octagon). */
function dome(cx: number, cz: number, base = 4, scale = 1): void {
  const tiers: [number, number][] = [[5.2, 0.7], [4.2, 0.7], [3, 0.6], [1.6, 0.5]];
  let y = base;
  for (const [w, h] of tiers) {
    for (const yaw of [0, Q]) m.block([r2(cx), r2(y), r2(cz)], [r2(w * scale), r2(h * scale), r2(w * scale)], 'solid', { ...DOME, yaw });
    y += h * scale;
  }
}
for (const [k, kind] of cells) {
  if (kind !== 'hut') continue;
  const [x, y] = k.split(',').map(Number) as [number, number];
  if ((x + y) % 3 !== 0) dome(x * C, y * C);
}
dome(-4, 12, 4, 2.2); // the cantina's great dome
for (const y of [1, 2]) dome(-16, y * C);
dome(8, 12, 4, 1.4);
dome(36, 12, 4, 2);
dome(-4, 24, 4, 1.2);

/** A moisture vaporator: a footing, a tall stem with collar rings, a cap and fins. */
const STEEL = { material: 'pbr_steel', tint: '#d8d0c0' };
function vaporator(x: number, y: number, z: number, h = 6): void {
  for (const yaw of [0, Q]) m.block([x, y, z], [1.4, 0.5, 1.4], 'solid', { ...STEEL, yaw });
  m.block([x, y + 0.5, z], [0.45, h, 0.45], 'solid', STEEL);
  for (const f of [0.35, 0.7]) for (const yaw of [0, Q]) m.block([x, r2(y + 0.5 + h * f), z], [0.9, 0.3, 0.9], 'solid', { ...STEEL, yaw });
  m.block([x, r2(y + 0.5 + h), z], [0.8, 0.6, 0.8], 'solid', STEEL);
  for (const yaw of [0, P]) m.block([x, r2(y + 0.5 + h - 1.2), z], [1.8, 0.12, 0.25], 'solid', { material: 'pbr_white_panel', yaw });
}
for (const [x, z] of [[-44, 60], [-28, 70], [-58, 52], [56, 60], [44, -54], [-20, -50], [8, -64], [-62, -48]] as const) vaporator(x, gnd(x, z) - 0.2, z, 6 + ((x + z) % 3));
// On the roofs.
for (const [x, z] of [[-51, 11], [51, -5], [-43, -13], [35, 27]] as const) vaporator(x, 4, z, 3.5);

// Market awnings: canvas on posts over the stalls.
const CANVAS = { material: 'pbr_canvas', tint: '#d8b888' };
for (const [x, z, w] of [[10, -6, 6], [22, -6, 6], [10, -18, 6], [22, -18, 6]] as const) {
  m.block([x, 2.6, z], [w, 0.12, 3.2], 'solid', { ...CANVAS, pitch: -0.18 });
  for (const sx of [-1, 1]) m.block([r2(x + (sx * (w - 0.3)) / 2), 0, r2(z - 1.4)], [0.2, 2.5, 0.2], 'solid', { material: 'pbr_weathered_planks' });
}

// ---------------------------------------------------------------- the cantina (x -12..4, z 4..20)

m.add({ kind: 'door', id: 'door_cantina', name: 'Cantina door', position: at(-1, 1, 0, 0, -4), yaw: 0, startOpen: false, locked: false, auto: true });
m.light(at(-1, 1, 0, 0, -4.4, 3.3), { fixture: 'sign', text: 'CANTINA', color: '#ff9a4a', yaw: S, intensity: 1, range: 6, size: [3, 0.7] });
// The band stage in the south-east corner, under coloured lights.
m.block([0.6, 0, 6.2], [5.6, 0.45, 3.6], 'solid', { material: 'pbr_walnut' });
m.prop('speaker', [-1.6, 0.45, 5], 0).prop('speaker', [2.8, 0.45, 5], 0).prop('bar_stool', [-0.2, 0.45, 6.6], 0).prop('bar_stool', [1.4, 0.45, 6.6], 0).prop('barrel', [0.6, 0.45, 7.3], 0);
m.light([-1, 3.2, 6], { fixture: 'none', color: '#8a5aff', intensity: 1.4, range: 7, id: 'lamp_stage_a', blink: 0.7 });
m.light([2.4, 3.2, 6], { fixture: 'none', color: '#ff5ab0', intensity: 1.4, range: 7, id: 'lamp_stage_b' });
// Booths along the west wall: a sofa and a table behind low partitions.
for (const z of [9, 14.5]) {
  m.prop('sofa', [-11.1, 0, z], P).prop('table_round', [-9.4, 0, z], 0);
  m.block([-10.4, 0, r2(z - 1.9)], [3, 1.3, 0.2], 'solid', { material: 'pbr_walnut' });
}
m.block([-10.4, 0, 16.9], [3, 1.3, 0.2], 'solid', { material: 'pbr_walnut' });
for (const [x, z] of [[-8, 8], [0, 8], [-8, 16], [0, 16]] as const) m.light([x, 3.4, z], { fixture: 'ceiling', color: '#ffc890', intensity: 0.8, range: 8 });

// The back room (x -12..4, z 20..28): crates and the smugglers' table. Hostages wait here.
m.prop('crate_large', [-11, 0, 26.5], 0.2).prop('crate_small', [-11.2, 0, 21.6], 0.5).prop('dungeon_table', [2, 0, 23], 0).prop('dungeon_chair', [2, 0, 21.8], 0);
m.light(at(-1, 3, 0, 0, 0, 3.3), { fixture: 'bulb', color: '#ffb070', intensity: 0.9, range: 7 });
m.light(at(0, 3, 0, 0, 0, 3.3), { fixture: 'bulb', color: '#ffb070', intensity: 0.9, range: 7 });
// The cellar: smugglers' stash.
m.prop('cargo_crate', [-10.6, -4, 26.4], 0.1).prop('cargo_crate', [2.4, -4, 26.4], -0.2).prop('barrel', [2.8, -4, 21.4], 0).prop('dynamite_crate', [-1.5, -4, 27], 0);
m.light(at(-1, 3, -1, 0, 0, 3.2), { fixture: 'bulb', color: '#ffa860', intensity: 0.8, range: 7 });
m.light(at(0, 3, -1, 0, 0, 3.2), { fixture: 'bulb', color: '#ffa860', intensity: 0.8, range: 7, blink: 0.4 });
m.light(at(-2, 3, -1, 0, 0, 7.2), { fixture: 'bulb', color: '#ffc890', intensity: 0.8, range: 8 });

// ---------------------------------------------------------------- the market (x 4..28, z -20..-4)

m.prop('stall', [10, 0, -7.5], S).prop('stall_green', [22, 0, -7.5], S).prop('nc_food_stall', [10, 0, -16.5], 0).prop('stall_bench', [22, 0, -16.5], 0);
m.prop('cart', [13, 0, -10.5], 0.6).prop('barrel', [5.5, 0, -19], 0).prop('crate_small', [26.5, 0, -19], 0.4).prop('parasol', [26, 0, -5.5], 0).prop('hay_bale', [5.8, 0, -5.4], 0.3);
for (const [x, z] of [[4.6, -12], [27.4, -12]] as const) m.prop('lantern_post', [x, 0, z], 0);
m.light([16, 3, -12], { fixture: 'none', color: '#ffd8a0', intensity: 0.9, range: 12 });

// ---------------------------------------------------------------- the town's dressing

m.prop('water_trough', [-36, 0, 3.2], 0).prop('hitching_post', [-28, 0, -3.3], 0).prop('wanted_board', [-12, 0, -3.4], 0).prop('signpost', [-58, 0, 3.6], 0.4).prop('signpost', [58, 0, -3.6], 2.6);
m.prop('barrel', [-17.6, 0, 3.4], 0).prop('barrel_open', [-18.6, 0, 3.2], 0).prop('crate_large', [44, 0, -3.3], 0.3).prop('crate_small', [45.2, 0, -3.5], 0.7).prop('tumbleweed', [-44, 0, -2], 0.5).prop('tumbleweed', [30, 0, 2.6], 2);
m.prop('sf_crate', [8, 0, 21], 0.3).prop('sf_barrel', [-34.6, 0, 27], 0).prop('sv_gas_can', [20, 0, 34.5], 0).prop('debris', [12, 0, 33], 1.1);
// The workshop's droid parts and the harbour office.
m.prop('workbench', [8, 0, 13.5], -P).prop('machine', [12.6, 0, 16.5], -P).prop('sf_item_holder', [11.8, 0, 6.8], S);
m.prop('desk', [38, 0, 14], 0).prop('office_chair', [38, 0, 12.8], 0).prop('computer_bank', [43.2, 0, 18], -P).prop('holo_table', [33, 0, 11], 0);
m.light([36, 3.4, 12], { fixture: 'ceiling', color: '#ffe8c8', intensity: 0.9, range: 10 });
m.light([8, 3.4, 12], { fixture: 'ceiling', color: '#ffe8c8', intensity: 0.8, range: 9 });
m.light([-16, 3.4, 12], { fixture: 'ceiling', color: '#ffe8c8', intensity: 0.8, range: 9 });

// ---------------------------------------------------------------- the hover speeder patrol on the main street

/** A hover speeder built from blocks (hull, nose, two engine pods) riding a mover along the street and back. */
function patrol(id: string, z: number, from: number, to: number, tint: string, delay: number): void {
  const y = 0.7;
  const hull = `${id}_hull`;
  const nose = `${id}_nose`;
  const podL = `${id}_pod_l`;
  const podR = `${id}_pod_r`;
  m.block([from, y, z], [1.8, 0.6, 3.6], 'solid', { material: 'pbr_rusted_plate', tint, yaw: P, id: hull });
  m.block([r2(from + 2.4), y + 0.05, z], [1.2, 0.45, 1.4], 'solid', { material: 'pbr_rusted_plate', tint, yaw: P, pitch: -0.25, id: nose });
  m.block([r2(from - 1.4), y + 0.15, r2(z - 1.1)], [0.6, 0.6, 1.6], 'solid', { material: 'pbr_steel', yaw: P, id: podL });
  m.block([r2(from - 1.4), y + 0.15, r2(z + 1.1)], [0.6, 0.6, 1.6], 'solid', { material: 'pbr_steel', yaw: P, id: podR });
  m.mover(id, [from, y, z], [hull, nose, podL, podR], [[0, 0, 0], [r2(to - from), 0, 0]], { mode: 'pingpong', speed: 3.5, wait: delay, yaw: P, name: 'Speeder patrol' });
}
patrol('mv_patrol_a', -2.4, -54, 50, '#a85a3a', 5);
patrol('mv_patrol_b', 2.4, 54, -50, '#5a7aa8', 7);

// ---------------------------------------------------------------- docking bays

/** A low parapet round a bay's rim (turned blocks), leaving the ramp open. */
function rim(b: (typeof BAYS)[keyof typeof BAYS]): void {
  const n = 24;
  const R = b.r + 2.6;
  const ramp = Math.atan2(b.dir[0], b.dir[1]);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let d = Math.abs(a - ramp) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < 0.32) continue;
    const x = b.c[0] + Math.sin(a) * R;
    const z = b.c[1] + Math.cos(a) * R;
    m.block([r2(x), r2(gnd(x, z) - 0.3), r2(z)], [r2(2 * R * Math.tan(Math.PI / n) + 0.15), 1.3, 0.7], 'solid', { material: 'pbr_adobe', tint: '#e6d2b0', yaw: r2(a + P) });
  }
  // Floodlights over the floor.
  m.light([b.c[0], 6, b.c[1]], { fixture: 'none', color: '#ffe8c0', intensity: 1.2, range: 22 });
}
for (const b of Object.values(BAYS)) rim(b);
for (const [x, z, n] of [[-60, 6, '3'], [60, -6, '7']] as const) m.light([x, 2.6, z], { fixture: 'sign', text: `BAY ${n}`, color: '#ffd060', yaw: x < 0 ? -P : P, intensity: 0.9, range: 5, size: [2.4, 0.7] });

// Bay 3 (west): the raiders' dropship and a hauler. Bay 7 (east): a dropship and a hauler.
m.add({ kind: 'mount', model: 'dropship', position: [-88, PIT, -5], yaw: P, faction: null, respawnSeconds: 90, skin: 'desert' });
m.add({ kind: 'mount', model: 'hauler', position: [-86, PIT, 7], yaw: P, faction: null, respawnSeconds: 75, skin: 'desert' });
m.add({ kind: 'mount', model: 'dropship', position: [88, PIT, 5], yaw: -P, faction: null, respawnSeconds: 90, skin: 'desert' });
m.add({ kind: 'mount', model: 'hauler', position: [86, PIT, -8], yaw: -P, faction: null, respawnSeconds: 75, skin: 'desert' });
for (const [x, z] of [[-94, -8], [-94, 8], [94, -8], [94, 8]] as const) m.prop('fuel_drum', [x, PIT, z], x);
m.prop('ammo_crate', [-78, PIT, -10], 0.3).prop('sf_crate_large', [-96, PIT, 1], 0).prop('sf_crate_large', [96, PIT, -1], 0).prop('os_cargo_crate', [78, PIT, 10], 0.4).prop('fuel_tank', [90, PIT, 11], 0.2);

// ---------------------------------------------------------------- the freighter (north bay)

const [FX, FZ] = BAYS.north.c;
const DECK = PIT + 1.2; // underside of the deck; its top is 0.4 higher
const TOP = DECK + 0.4;
const HULL = { material: 'pbr_white_panel', tint: '#c8c4bc' };
const SCORCH = { material: 'pbr_steel', tint: '#7a746c' };
/** A disc of strips (stepped like a coin) of radius `R` at height `y`. */
function disc(y: number, R: number, t: number, look: { material: string; tint?: string }): void {
  const n = 8;
  const step = (2 * R) / n;
  for (let i = 0; i < n; i++) {
    const zc = -R + step * (i + 0.5);
    const w = 2 * Math.sqrt(R * R - zc * zc);
    m.block([FX, r2(y), r2(FZ + zc)], [r2(w), t, r2(step + 0.02)], 'solid', look);
  }
}
disc(DECK, 7.3, 0.4, HULL);
disc(TOP + 2.6, 7.6, 0.4, HULL);
// The hull wall: 12 panels round the deck, open at the stern (the ramp) and starboard (the cockpit tube).
for (let i = 0; i < 12; i++) {
  if (i === 6 || i === 3) continue;
  const a = (i / 12) * Math.PI * 2;
  m.block([r2(FX + Math.sin(a) * 6.8), TOP, r2(FZ + Math.cos(a) * 6.8)], [3.75, 2.6, 0.4], 'solid', { ...(i % 2 ? SCORCH : HULL), yaw: r2(a + P) });
}
// Landing struts.
for (const [dx, dz] of [[-4, 3], [4, 3], [0, -4.5]] as const) m.block([FX + dx, PIT, FZ + dz], [0.8, 1.2, 0.8], 'solid', SCORCH);
// The boarding ramp down from the stern.
m.block([FX, r2(PIT + 0.8 - 0.32), FZ - 9], [3, 0.3, r2(Math.hypot(1.6, 4))], 'solid', { ...SCORCH, pitch: r2(Math.atan2(1.6, 4)) });
// Mandibles out in front.
for (const sx of [-1, 1]) m.block([FX + sx * 2.6, DECK, FZ + 10], [2.4, 1.1, 6.4], 'solid', HULL);
// The cockpit tube off the starboard bow: floor, walls, roof, the console under the window.
m.block([FX + 7.7, DECK, FZ + 2.1], [2.8, 0.4, 7.9], 'solid', HULL);
m.block([FX + 6.25, TOP, FZ + 4], [0.3, 2.2, 4.1], 'solid', HULL);
m.block([FX + 9.25, TOP, FZ + 2.1], [0.3, 2.2, 7.9], 'solid', HULL);
m.block([FX + 7.7, TOP, FZ - 1.95], [3.1, 2.2, 0.3], 'solid', HULL);
m.block([FX + 7.7, TOP, FZ + 6], [2.8, 1, 0.3], 'solid', SCORCH);
m.block([FX + 7.7, TOP + 2.2, FZ + 2.1], [3.3, 0.3, 8.3], 'solid', HULL);
m.prop('space_chair', [FX + 7.1, TOP, FZ + 4.6], 0).prop('space_chair', [FX + 8.4, TOP, FZ + 4.6], 0);
// Inside: the game table, bunks and cargo.
m.prop('holo_table', [FX - 2.4, TOP, FZ + 2.4], 0).prop('space_bed', [FX - 5, TOP, FZ - 2], P).prop('sf_crate', [FX + 3.8, TOP, FZ - 3.6], 0.3).prop('os_canister_rack', [FX - 4.8, TOP, FZ + 3.2], P);
m.light([FX, TOP + 2.3, FZ], { fixture: 'ceiling', color: '#d8f0ff', intensity: 1, range: 9 });
m.light([FX + 7.7, TOP + 2, FZ + 4], { fixture: 'none', color: '#7fd0ff', intensity: 0.8, range: 5 });
// The dorsal gun, and a ladder up the port side to it.
m.mount('turret_mg', [FX, TOP + 3, FZ + 1.5], 0, null);
m.block([FX - 7.7, PIT, FZ], [0.5, TOP + 3 - PIT, 1.4], 'solid', SCORCH);
m.add({ kind: 'ladder', position: [FX - 7.95, PIT, FZ], yaw: -P, height: r2(TOP + 3 - PIT), width: 0.9 });

// ---------------------------------------------------------------- the crashed escape pod (southern dunes)

const POD: [number, number] = [36, -82];
const pg = gnd(POD[0], POD[1]);
for (const roll of [0, Q]) m.block([POD[0], r2(pg - 0.9), POD[1]], [2.6, 2.6, 4.4], 'solid', { material: 'pbr_white_panel', tint: '#b8b0a4', yaw: 0.6, pitch: 0.32, roll });
m.block([r2(POD[0] + 1.6), r2(pg + 0.4), r2(POD[1] + 2.3)], [1.6, 1.6, 1.2], 'solid', { material: 'pbr_charred_wood', yaw: 0.6, pitch: 0.32 });
m.prop('debris', [POD[0] - 3, gnd(POD[0] - 3, POD[1] - 4), POD[1] - 4], 0.4).prop('metal_panel', [POD[0] + 4, gnd(POD[0] + 4, POD[1] - 2), POD[1] - 2], 1.2);
m.prop('nt_saguaro', [-30, gnd(-30, -70), -70], 0.4).prop('cactus_tall', [70, gnd(70, -64), -64], 1).prop('nt_cactus_round', [-70, gnd(-70, 70), 70], 0).prop('tumbleweed', [12, gnd(12, -50), -50], 0.3);

// ---------------------------------------------------------------- vehicles about town

m.add({ kind: 'mount', model: 'speeder', position: at(-3, -3, 0, 0, 0), yaw: 0, faction: null, respawnSeconds: 45, skin: 'desert' });
m.add({ kind: 'mount', model: 'speeder', position: at(6, -3, 0, 0, 0), yaw: 0, faction: null, respawnSeconds: 45 });
m.add({ kind: 'mount', model: 'hover_bike', position: [-62, 0, 9], yaw: P, faction: null, respawnSeconds: 40 });
m.add({ kind: 'mount', model: 'hover_bike', position: [62, 0, -9], yaw: -P, faction: null, respawnSeconds: 40 });
m.add({ kind: 'mount', model: 'hover_bike', position: at(3, 6, 0, -2, 0), yaw: S, faction: null, respawnSeconds: 40, skin: 'desert' });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
m.add({ kind: 'button', id: 'btn_band', name: 'Band request', position: [3.6, 1.2, 8.4], yaw: -P, label: 'Request a song', once: false, cooldownSeconds: 15, startEnabled: true });
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [act('message', null, { value: 4, text: 'Dune Harbor. Watch your back in the cantina, and mind the speeders on the main street.' })]),
    rule('rule_band', 'The band strikes up', { event: 'button_pressed', target: 'btn_band' }, [
      act('sound', null, { state: 'chime' }),
      act('light_blink', 'lamp_stage_b', { value: 2, state: 'on' }),
      act('light_color', 'lamp_stage_a', { text: '#5ad8ff' }),
      act('wait', null, { value: 10 }),
      act('light_blink', 'lamp_stage_b', { state: 'off' }),
      act('light_color', 'lamp_stage_a'),
    ]),
  ],
});

// ---------------------------------------------------------------- objectives

// Hostage Rescue: the cantina's back room and the cellar; brought out to the top of the Bay 3 ramp.
m.hostage([-9.5, 0, 24.5], P).hostage([-5, 0, 26.5], S).hostage([1.5, 0, 26], S).hostage([-6, -4, 24], P);
m.rescue([-60, 0, 0], 5);
// Bomb: Bay 7 (A) and the freighter (B).
m.add({ kind: 'bombsite', position: [80, PIT, 0], label: 'A', radius: 5 });
m.add({ kind: 'bombsite', position: [FX - 1.5, TOP, FZ - 1.5], label: 'B', radius: 3.5 });
// CTF: Bay 3 against Bay 7.
m.flag(RAID, [-96, PIT, -4], P);
m.flag(MILITIA, [96, PIT, 4], -P);
// KOTH: the cantina, the market, the freighter.
m.hill([-6, 0, 12], 5);
m.hill([16, 0, -12], 6);
m.hill([FX - 1.5, TOP, FZ - 1.5], 4.5);

// ---------------------------------------------------------------- spawns and pickups

for (const [p, yaw] of [
  [[-92, PIT, -10], P], [[-92, PIT, 12], P], [[-80, PIT, -12], P], [[-78, PIT, 12], P], [[-96, PIT, 8], P], [[-74, PIT, -4], P],
  [at(-7, 0, 0, -2, -2), P], [at(-7, 0, 0, 2, 2), P], [at(-6, 1, 0), S], [at(-6, -1, 0), 0], [at(-5, 2, 0), S], [at(-5, -2, 0), 0],
] as [V3, number][]) m.spawn(p, yaw, RAID);
for (const [p, yaw] of [
  [[92, PIT, 10], -P], [[92, PIT, -12], -P], [[80, PIT, 12], -P], [[78, PIT, -12], -P], [[96, PIT, -8], -P], [[74, PIT, 4], -P],
  [at(7, 0, 0, 2, 2), -P], [at(7, 0, 0, -2, -2), -P], [at(6, 1, 0), S], [at(6, -1, 0), 0], [at(6, 2, 0), S], [at(4, -2, 0), 0],
] as [V3, number][]) m.spawn(p, yaw, MILITIA);
for (const [p, yaw] of [
  [at(0, -1, 0), 0], [at(-1, -2, 0), 0], [at(-4, -1, 0), 0], [at(4, -1, 0), 0], [at(1, 3, 0), S], [at(-3, 3, 0), S],
  [at(2, 4, 0), P], [at(-4, 4, 0), -P], [[16, 0, -20], 0], [at(-3, -2, 0), S], [at(6, -2, 0), S], [[FX + 10, PIT, FZ - 8], -P],
] as [V3, number][]) m.spawn(p, yaw, null);

m.pickup('weapon_sniper', [FX + 7.7, TOP, FZ + 3], 30).pickup('ammo_sniper', at(4, 3, 0));
m.pickup('weapon_rockets', [0, PIT, 27], 35).pickup('ammo_explosive', at(-3, 3, 0));
m.pickup('weapon_hand_cannon', [-4, 0, 17.5]).pickup('weapon_sawed_off', [16, 0, -15]).pickup('weapon_marksman', [36, 0, 16]);
m.pickup('weapon_shotgun', at(-4, -1, 0, 1, 1)).pickup('weapon_shotgun', at(4, -1, 0, -1, 1)).pickup('weapon_smg', at(-6, 2, 0)).pickup('weapon_smg', at(6, 2, 0));
m.pickup('weapon_rifle', [-66, 0, -10]).pickup('weapon_rifle', [66, 0, 10]).pickup('weapon_burst_rifle', at(3, 5, 0)).pickup('weapon_plasma', [FX - 2, TOP, FZ - 4]);
m.pickup('weapon_launcher', [-12, 0, -24]).pickup('weapon_lmg', at(-1, -1, 0, 1, 1));
m.pickup('ammo', at(-2, -2, 0)).pickup('ammo', at(5, -2, 0)).pickup('ammo_rifle', at(-4, 3, 0)).pickup('ammo_shells', at(2, 2, 0)).pickup('ammo_light', at(0, 4, 0)).pickup('ammo', [-84, PIT, 0]).pickup('ammo', [84, PIT, 0]);
m.pickup('grenades', at(-2, 1, 0, 0, 2)).pickup('grenades', at(1, 2, 0)).pickup('dynamite', [-8, -4, 21.5], 30);
m.pickup('armor_large', [-1.5, -4, 21.6], 40).pickup('armor_small', at(-6, -1, 0)).pickup('armor_small', at(6, -1, 0)).pickup('armor_small', at(0, -2, 0));
m.pickup('health_large', [8, 0, 18]).pickup('health_large', [-94, PIT, -9]).pickup('health_large', [94, PIT, 9]);
for (const p of [at(-5, -1, 0), at(5, 1, 0, -3, 3), at(-6, 1, 0, 1, 1), at(-1, 3, 0, 2, -2), at(3, -2, 0, 2, -2), at(0, 0, 0, 0, 3), [FX + 4, TOP, FZ + 2] as V3, at(-3, 2, 0)]) m.pickup('health_small', p);

// ---------------------------------------------------------------- dressing

m.dress({ x0: -1, y0: 1, x1: 0, y1: 2, z: 0 }, 'bar', { density: 'normal', max: 28 });
m.dress({ x0: -2, y0: 1, x1: -2, y1: 2, z: 0 }, 'shop', { density: 'sparse' });
for (const [x, y, type] of [[-6, 1, 'living'], [-5, -1, 'kitchen'], [-4, -2, 'bedroom'], [0, -1, 'storage'], [6, 1, 'kitchen'], [4, -2, 'bedroom'], [-1, -2, 'living'], [6, -1, 'storage']] as const) m.dress([x, y, 0], type, { density: 'sparse' });

m.bounds('invisible', 4, { min: [-108, -108], max: [108, 108] });
m.meta({
  description:
    'A sun-bleached desert spaceport under a hot, hazy sky. Domed adobe huts line a dusty main street patrolled by hover speeders, narrow alleys wind between them past a market of stalls and awnings and moisture vaporators on the roofs. The cantina has a bar, booths and a band stage, a back room where the hostages are held and a smugglers\' cellar below. Three sunken circular docking bays: dropships and haulers in Bay 3 and Bay 7, and a light freighter you can walk into up its ramp, with a cockpit tube and a gun turret on its roof. Speeders and hover bikes to take, dunes beyond the town and a crashed escape pod half buried in the sand.',
  modes: ['core.hostage', 'core.bomb', 'core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [12, 24],
});
await m.save();
