/**
 * Snowline Offices: an office block on a snowy night (homage in spirit to
 * Counter-Strike's cs_office). Embers come in from the front lot to rescue
 * the hostages Tide hold at the back: two in the conference room, one in the
 * server room, one in an office off the middle.
 *
 * - The front: a lobby behind glass and a wide door, offices either side.
 * - Inside: two long corridors (front and back) joined by side corridors at
 *   each end and by doors through the middle row of offices; glass walls
 *   along the back corridor.
 * - The back: the conference room, a break room, the server room and the
 *   garage hall, whose wide door opens onto the parking garage.
 * - Outside: snowy alleys down both sides from the front lot to the garage,
 *   with a side door into each end of the building.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y8  .   P   P   P   P   P   P   P   .     P parking garage
 *   y7  .   P   P   P   P   P   P   P   .
 *   y6  a   o   C   C   G   b   s   o   a     C conference, G garage hall, b break room, s server room
 *   y5  a   =   =   =   =   =   =   =   a     back corridor
 *   y4  a   |   o   o   o   o   o   |   a     | side corridors, o offices
 *   y3  a   =   =   =   =   =   =   =   a     front corridor
 *   y2  a   o   o   L   L   o   o   o   a     L lobby
 *   y1  .   .   .   .   .   .   .   .   .     front lot (Embers)
 *   y0  .   .   .   .   .   .   .   .   .
 *       0   1   2   3   4   5   6   7   8     a alleys
 */
import type { Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('snowline_offices', 'Snowline Offices');
m.theme('lab');
m.backdrop('snowy', 'city', 'snow', 0.6);
m.teams([6, 6]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, surfaces: TileSurfaces, z = 0): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
type Style = Parameters<typeof m.edge>[4];

// ---------------------------------------------------------------- the building: every cell a room, walls set below
const inside = (x: number, y: number) => x >= 1 && x <= 7 && y >= 2 && y <= 6;
/** Corridors, the lobby and the garage hall: tiled, and left unfurnished. */
const isHall = (x: number, y: number) => y === 3 || y === 5 || (y === 2 && (x === 3 || x === 4)) || ((x === 1 || x === 7) && y === 4) || (x === 4 && y === 6);
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) m.tile(inside(x, y) ? 'room' : 'yard', x, y);
// A flat roof over the whole block.
m.fill('platform', 1, 2, 7, 6, 1);

// Outside walls: windows, except the doors.
const doors: Record<string, Style> = {
  '3,2,S': 'wide', '4,2,S': 'windows', '5,2,S': 'door', // the front: the lobby's doors, a side office door
  '1,3,W': 'door', '7,5,E': 'door', // side doors from the alleys
  '4,6,N': 'wide', '2,6,N': 'wall', '3,6,N': 'wall', '6,6,N': 'wall', // the garage door; blind walls at the back
};
for (let x = 1; x <= 7; x++) for (let y = 2; y <= 6; y++) {
  const sides: [Side, boolean][] = [['S', y === 2], ['N', y === 6], ['W', x === 1], ['E', x === 7]];
  for (const [side, out] of sides) if (out) m.edge(x, y, 0, side, doors[`${x},${y},${side}`] ?? 'windows');
}
// Inside: corridors run open; offices get doors, glass or walls.
const east: Record<string, Style> = {
  '1,2': 'wall', '2,2': 'door', '3,2': 'open', '4,2': 'door', '5,2': 'wall', '6,2': 'door',
  '1,4': 'door', '2,4': 'wall', '3,4': 'door', '4,4': 'wall', '5,4': 'door', '6,4': 'door',
  '1,6': 'wall', '2,6': 'open', '3,6': 'wall', '4,6': 'door', '5,6': 'wall', '6,6': 'door',
};
for (let x = 1; x <= 6; x++) {
  for (const y of [3, 5]) m.edge(x, y, 0, 'E', 'open');
  for (const y of [2, 4, 6]) m.edge(x, y, 0, 'E', east[`${x},${y}`]!);
}
const north: Record<string, Style> = {
  '1,2': 'door', '2,2': 'door', '3,2': 'arch', '4,2': 'arch', '5,2': 'door', '6,2': 'wall', '7,2': 'door',
  '1,3': 'open', '2,3': 'door', '3,3': 'wall', '4,3': 'door', '5,3': 'wall', '6,3': 'door', '7,3': 'open',
  '1,4': 'open', '2,4': 'windows', '3,4': 'door', '4,4': 'windows', '5,4': 'door', '6,4': 'windows', '7,4': 'open',
  '1,5': 'door', '2,5': 'door', '3,5': 'windows', '4,5': 'wide', '5,5': 'door', '6,5': 'door', '7,5': 'wall',
};
for (let x = 1; x <= 7; x++) for (let y = 2; y <= 5; y++) m.edge(x, y, 0, 'N', north[`${x},${y}`]!);

// Surfaces: carpet in the offices, tiles in the corridors and lobby, snow and asphalt outside.
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
  if (inside(x, y)) {
    paint(x, y, { floor: isHall(x, y) ? mat('pbr_terrazzo') : mat('pbr_carpet', '#5a6478'), walls: mat('pbr_plaster_white', '#e4e0d6') });
  } else paint(x, y, { floor: y >= 7 && x >= 1 && x <= 7 ? mat('pbr_asphalt') : mat('pbr_snow'), walls: mat('pbr_concrete') });
}
// The roof: white ceiling panels underneath, gravel on top.
for (let x = 1; x <= 7; x++) for (let y = 2; y <= 6; y++) paint(x, y, { underside: mat('pbr_plaster_white', '#ecebe6'), solids: mat('pbr_plaster_white', '#ecebe6'), floor: mat('pbr_gravel') }, 1);
// The lot and the garage are walled in.
for (let i = 0; i <= 8; i++) {
  m.edge(0, i, 0, 'W', 'high').edge(8, i, 0, 'E', 'high');
  m.edge(i, 0, 0, 'S', 'fence').edge(i, 8, 0, 'N', 'high');
}

// ---------------------------------------------------------------- outside: cars in the lot and the garage
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const DARK = { material: 'paint_gloss', tint: '#1c2228' };
function car(cx: number, cz: number, ns: boolean, tint: string): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', DARK);
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
car(12, 4, true, '#3a6fb0');
car(52, 3, true, '#c8c8c8');
car(10, 60, true, '#7a2a24');
car(18, 66, true, '#2a2a2e');
car(46, 66, true, '#3e6b3a');
car(54, 60, true, '#c9a227');
m.prop('barrier', [28, 0, -2], 0).prop('barrier', [44, 0, -2], 0).prop('lightpost', [-2, 0, 4]).prop('lightpost', [66, 0, 4]);
m.prop('lightpost', [-2, 0, 40]).prop('lightpost', [66, 0, 40]).prop('trashcan', [3, 0, 12]).prop('skip', [65, 0, 52], 0);
m.prop('crate_large', [-1, 0, 28]).prop('cargo_crate', [65, 0, 24], 0.2).prop('metal_crate', [30, 0, 62]).prop('barrel', [38, 0, 62]);
m.prop('tree_cone', [20, 0, -2]).prop('tree_cone', [36, 0, 2]).prop('bush_cone', [60, 0, 10]);

// ---------------------------------------------------------------- inside: set pieces, then the offices furnished
// The conference table, the server racks, the break room, the lobby desk.
m.prop('table', [22, 0, 48], 0).prop('table', [26, 0, 48], 0).prop('chair', [22, 0, 46.6], 0).prop('chair', [26, 0, 49.4], Math.PI);
m.prop('shelf_boxes', [45.5, 0, 51], Math.PI).prop('shelf_boxes', [50.5, 0, 51], Math.PI).prop('screen_panel', [51.5, 0, 46], -P);
m.prop('fridge', [36.8, 0, 51.2], Math.PI).prop('kitchen_cabinet', [38, 0, 51.4], Math.PI).prop('table_round', [42, 0, 47]).prop('freezers_upright', [43.4, 0, 51.2], Math.PI);
m.prop('desk', [28, 0, 18.5], 0).prop('potted_plant', [24.5, 0, 13]).prop('potted_plant', [35.5, 0, 13]).prop('sofa', [36, 0, 19.5], Math.PI);
m.breakable('glass', [28, 0, 12.1], 0);
m.furnish('office', (x, y) => isHall(x, y));

// ---------------------------------------------------------------- spawns, hostages, pickups
for (const [x, z] of [[20, -2], [26, 0], [32, -2], [38, 0], [44, -2], [32, 3]] as const) m.spawn([x, 0, z], 0, embers);
for (const [x, z, yaw] of [[30.5, 47, Math.PI], [33.5, 47, Math.PI], [32, 50.5, Math.PI], [40, 45, Math.PI], [8, 41, 0], [56, 41, 0]] as const) m.spawn([x, 0, z], yaw, tide);
for (const [x, z, yaw] of [[-2, 20, P], [66, 30, -P], [8, 24, 0], [56, 24, 0], [32, 64, Math.PI], [16, 32, 0]] as const) m.spawn([x, 0, z], yaw, null);
m.hostage([20, 0, 50.5], Math.PI).hostage([24, 0, 50.2], Math.PI).hostage([48, 0, 47], -P).hostage([24, 0, 32], 0);
m.rescue([32, 0, 0], 6);
m.pickup('weapon_smg', [4, 0, 4]).pickup('weapon_shotgun', [60, 0, 4]).pickup('weapon_rifle', [-1, 0, 48]).pickup('weapon_rifle', [65, 0, 36]);
m.pickup('weapon_auto_shotgun', [32, 0, 40]).pickup('armor_large', [48, 0, 24]).pickup('armor_small', [16, 0, 40]).pickup('health_large', [40, 0, 24]);
m.pickup('health_small', [8, 0, 16]).pickup('health_small', [56, 0, 48]).pickup('ammo', [24, 0, 24]).pickup('ammo', [40, 0, 40]);
m.pickup('ammo_shells', [8, 0, 32]).pickup('grenades', [32, 0, 60]).pickup('grenades', [56, 0, 16]);

// Office lighting: a cool white panel in every office and corridor.
m.lightRooms({ color: '#eef3ff', intensity: 1.1 });
m.bounds('invisible');
m.meta({
  description:
    'An office block on a snowy night. Tide hold the hostages at the back (the conference room, the server room and an office off the middle); Embers come in from the front lot through the lobby, by the side doors off the snowy alleys, or round through the parking garage and its wide door. Corridors front and back, glass walls, and a maze of offices between.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [4, 12],
});
await m.save();
