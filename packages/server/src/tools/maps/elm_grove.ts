/**
 * Elm Grove: a cul-de-sac of five homes off a main street (homage in spirit
 * to the Grove Street of San Andreas). Embers hold the turnaround at the end
 * of the grove; Tide come off the main street, past the corner shop and the
 * gas station. Two-storey houses with gardens either side of the road, side
 * yards to slip between them, and the street itself for the brave.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y9  .   .   .   E   E   .   .   .   .   .     E the end house
 *   y8  .   .   .   E   E   .   .   .   .   .     (Embers in the back gardens)
 *   y7  .   .   .   o   o   o   .   .   .   .     o the turnaround
 *   y6  .   .   .   .   |   D   D   .   .   .
 *   y5  .   .   B   B   |   D   D   .   .   .     houses B, D
 *   y4  .   .   B   B   |   .   .   .   .   .
 *   y3  .   .   .   .   |   C   C   .   .   .     house C
 *   y2  s   s   A   A   |   C   C   G   G   .     s corner shop, A house, G gas station
 *   y1  .   .   A   A   |   .   .   G   G   .
 *   y0  =   =   =   =   +   =   =   =   =   =     the main street (Tide)
 *       0   1   2   3   4   5   6   7   8   9
 */
import type { TileSurfaces } from '@chronosplit/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('elm_grove', 'Elm Grove');
m.theme('garden');
m.backdrop('sunset', 'hills', 'grass', 0.45);
m.teams([8, 8]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === 0);
  if (!t) throw new Error(`no tile at ${x},${y}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}

// ---------------------------------------------------------------- houses, shop, gas station
const HOUSES: [number, number, string][] = [[2, 1, '#e8b4a0'], [2, 4, '#a8c8e0'], [5, 2, '#e6d690'], [5, 5, '#b8d8a8'], [3, 8, '#d8b8d8']];
const built = new Set<string>();
for (const [x, y] of HOUSES) {
  m.tile('house', x, y);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) built.add(`${x + dx},${y + dy}`);
}
m.tile('shop', 0, 2).tile('gas_station', 7, 1);
for (const c of ['0,2', '1,2', '7,1', '8,1', '7,2', '8,2']) built.add(c);
for (let x = 0; x <= 9; x++) for (let y = 0; y <= 9; y++) {
  if (built.has(`${x},${y}`)) continue;
  if (x === 4 && y === 0) m.tile('intersection', x, y);
  else if (y === 0) m.tile('street', x, y, 0, 1);
  else if (x === 4 && y <= 6) m.tile('street', x, y, 0, 0);
  else m.tile('yard', x, y);
}
for (const [x, y, tint] of HOUSES) paint(x, y, { walls: mat('pbr_plaster_white', tint), floor: mat('pbr_floorboards'), solids: mat('pbr_walnut'), trim: mat('pbr_plaster_white') });
paint(0, 2, { walls: mat('pbr_brick_red'), floor: mat('pbr_terrazzo') });
// The streets' and gardens' side of the house walls: cream render, not the theme's brick.
for (let x = 0; x <= 9; x++) for (let y = 1; y <= 9; y++) if (!built.has(`${x},${y}`)) paint(x, y, { walls: mat('pbr_plaster_white', '#e8e0cc') });
for (let x = 0; x <= 9; x++) if (x !== 4) paint(x, 0, { floor: mat('pbr_asphalt') });
for (let y = 1; y <= 6; y++) paint(4, y, { floor: mat('pbr_asphalt') });
for (const x of [3, 4, 5]) paint(x, 7, { floor: mat('pbr_asphalt') });
paint(7, 1, { floor: mat('pbr_concrete') });
// Fences round the back gardens; the main street runs on out of the map.
for (let i = 0; i <= 9; i++) {
  if (!built.has(`0,${i}`) && i > 0) m.edge(0, i, 0, 'W', 'fence');
  if (!built.has(`9,${i}`) && i > 0) m.edge(9, i, 0, 'E', 'fence');
  if (!built.has(`${i},9`)) m.edge(i, 9, 0, 'N', 'fence');
  m.edge(i, 0, 0, 'S', 'high');
}
m.edge(0, 0, 0, 'W', 'open').edge(9, 0, 0, 'E', 'open');
// The grove's houses look onto the road: windows along it, a front door into each east house.
for (let y = 1; y <= 6; y++) {
  if (built.has(`3,${y}`) && y !== 1 && y !== 4) m.edge(4, y, 0, 'W', 'window');
  if (built.has(`5,${y}`)) m.edge(4, y, 0, 'E', y === 2 || y === 5 ? 'door' : 'window');
}
// Garden fences between some neighbours, so the side yards are lanes, not a field.
m.edge(1, 4, 0, 'N', 'fence').edge(0, 4, 0, 'N', 'fence').edge(7, 4, 0, 'N', 'fence').edge(8, 4, 0, 'N', 'fence');
m.edge(7, 7, 0, 'E', 'fence').edge(1, 7, 0, 'E', 'fence');

// ---------------------------------------------------------------- cars, gardens, street furniture
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const DARK = { material: 'paint_gloss', tint: '#1c2228' };
function car(cx: number, cz: number, ns: boolean, tint: string): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', DARK);
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
car(30.5, 14, true, '#5a2a7a'); // lowrider purple
car(33.5, 26, true, '#2a7a3a'); // grove green
car(30.5, 40, true, '#c8c8c8');
car(27, 57, false, '#9c2a24');
car(14, 1.5, false, '#2a4a7a');
car(52, -1.5, false, '#d8d2c4');
car(66, 13, true, '#c9a227'); // at the pumps
for (const [x, z] of [[10, 30], [56, 44], [70, 30], [14, 66], [60, 64], [-1, 52], [76, 58], [44, 14]] as const) m.prop('tree_round', [x, 0, z]);
for (const [x, z] of [[8, 46], [52, 70], [70, 46]] as const) m.prop('table', [x, 0, z], 0).prop('bench', [x, 0, z - 1.4], 0);
m.prop('stove', [10, 0, 44], 0).prop('parasol', [52, 0, 70], 0, 1, false).prop('bush_large', [42, 0, 30]).prop('bush_large', [20, 0, 30]);
m.prop('trashcan', [27, 0, 3.6]).prop('trashcan', [37, 0, 12]).prop('bench', [20, 0, 3.5], Math.PI).prop('shopping_cart', [6, 0, 8], 0.5);
m.prop('skip', [74, 0, 6], P).prop('barrier', [36.5, 0, 50], P).prop('cone', [27.5, 0, 50], 0, 1, false).prop('signpost', [36.6, 0, 4.6], Math.PI);
m.prop('crate_large', [44, 0, 42], 0.3).prop('barrel', [76, 0, 38]).prop('dungeon_barrel', [-2, 0, 40]).prop('cardboard_box', [2, 0, 26]);
m.breakable('gas', [62, 0, 10]).breakable('gas', [70, 0, 14]).breakable('glass', [4, 0, 12.2]);
m.furnish('home');

// ---------------------------------------------------------------- spawns, flags, hills
for (const [x, z] of [[4, 64], [10, 70], [16, 74], [44, 66], [52, 74], [60, 70], [68, 74], [24, 58]] as const) m.spawn([x, 0, z], Math.PI, embers);
for (const [x, z] of [[4, 0], [12, 0], [20, 0], [28, 1], [40, 0], [48, 0], [60, 0], [72, 0]] as const) m.spawn([x, 0, z], 0, tide);
for (const [x, z, yaw] of [[0, 24, P], [72, 24, -P], [40, 34, 0], [8, 56, 0], [72, 62, Math.PI], [56, 30, 0]] as const) m.spawn([x, 0, z], yaw, null);
m.flag(embers, [32, 0, 58], Math.PI).flag(tide, [32, 0, -1], 0);
m.hill([32, 0, 30], 6).hill([8, 0, 30], 5).hill([60, 0, 32], 5);

// ---------------------------------------------------------------- pickups
m.pickup('weapon_smg', [8, 0, 20]).pickup('weapon_smg', [60, 0, 54]).pickup('weapon_shotgun', [44, 0, 34]).pickup('weapon_shotgun', [20, 0, 26]);
m.pickup('weapon_rifle', [72, 0, 40]).pickup('weapon_rifle', [0, 0, 44]).pickup('weapon_sniper', [20, 4, 40]).pickup('weapon_rockets', [32, 0, 46], 60);
m.pickup('armor_large', [56, 0, 20]).pickup('armor_small', [24, 0, 70]).pickup('armor_small', [48, 0, 4]).pickup('health_large', [12, 0, 50]);
m.pickup('health_small', [68, 0, 54]).pickup('health_small', [0, 0, 8]).pickup('ammo', [40, 0, 58]).pickup('ammo', [24, 0, 4]);
m.pickup('ammo_rifle', [72, 0, 20]).pickup('ammo_shells', [8, 0, 38]).pickup('ammo_sniper', [48, 4, 48]).pickup('grenades', [36, 0, 22]).pickup('grenades', [56, 0, 62]);

m.bounds('invisible');
m.lightRooms();
m.meta({
  description:
    'A cul-de-sac of five homes off a main street at sunset. Embers hold the turnaround at the end of the grove, Tide come off the main street past the corner shop and the gas station. Two-storey houses with gardens either side of the road, side yards to slip between them, and the road itself for the brave.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [6, 16],
});
await m.save();
