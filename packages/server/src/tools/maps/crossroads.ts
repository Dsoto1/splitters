/**
 * Crossroads: a downtown block on a sunny afternoon, built from the Buildings
 * tiles. An avenue runs north–south and a street east–west, crossing in the
 * middle; each corner block holds its own buildings.
 *
 * - South (Embers): the end of the avenue, a corner shop (west) and a
 *   sandbagged bunker and a house (east). The rescue point is here.
 * - North-west: the gas station (bomb site A, open under its canopy) and a
 *   two-storey house behind it, hostages upstairs.
 * - North-east: the warehouse (bomb site B on the floor), a mezzanine with
 *   hostages, and a fire escape up the back to its upper door.
 * - North (Tide): the far end of the avenue.
 * Cars parked along the kerbs, bus-stop benches, bins and barriers give cover
 * on the open streets.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y9  .   H   H   .   |   .   .   .   .   .     Tide
 *   y8  .   H   H   .   |   .   .   F   .   .     H house, F fire escape
 *   y7  .   G   G   .   |   .   W   W   W   .     G gas station (A)
 *   y6  .   G   G   .   |   .   W   W   W   .     W warehouse (B)
 *   y5  .   .   .   .   |   .   .   .   .   .
 *   y4  =   =   =   =   +   =   =   =   =   =     cross street
 *   y3  .   .   .   .   |   .   .   .   h   h     h house
 *   y2  .   .   .   .   |   .   .   .   h   h
 *   y1  .   S   S   .   |   .   B   B   .   .     S shop, B bunker
 *   y0  .   .   .   .   |   .   .   .   .   .     Embers
 *       0   1   2   3   4   5   6   7   8   9
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('crossroads', 'Crossroads');
m.theme('city');
m.backdrop('clear', 'city', 'gravel', 0.4);
m.teams([8, 8]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

// ---------------------------------------------------------------- buildings
m.tile('shop', 1, 1);
m.tile('bunker', 6, 1);
m.tile('house', 8, 2);
m.tile('gas_station', 1, 6);
m.tile('house', 1, 8);
m.tile('warehouse', 6, 6);
m.tile('stairs_open', 7, 8, 0, 1); // from (7,9) up south to the warehouse's upper door
const built = new Set(['1,1', '2,1', '6,1', '7,1', '8,2', '9,2', '8,3', '9,3', '1,6', '2,6', '1,7', '2,7', '1,8', '2,8', '1,9', '2,9', '6,6', '7,6', '8,6', '6,7', '7,7', '8,7', '7,8']);

// ---------------------------------------------------------------- streets and lots
for (let x = 0; x <= 9; x++) for (let y = 0; y <= 9; y++) {
  if (built.has(`${x},${y}`)) continue;
  if (x === 4 && y === 4) m.tile('intersection', x, y);
  else if (x === 4) m.tile('street', x, y, 0, 0);
  else if (y === 4) m.tile('street', x, y, 0, 1);
  else m.tile('yard', x, y);
}

// No wall round the edge: the streets run on into the city beyond.
for (let i = 0; i <= 9; i++) {
  if (!built.has(`0,${i}`)) m.edge(0, i, 0, 'W', 'open');
  if (!built.has(`9,${i}`)) m.edge(9, i, 0, 'E', 'open');
  if (!built.has(`${i},0`)) m.edge(i, 0, 0, 'S', 'open');
  if (!built.has(`${i},9`)) m.edge(i, 9, 0, 'N', 'open');
}

// ---------------------------------------------------------------- cars (free blocks)
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const GLASS = { material: 'paint_gloss', tint: '#2c3640' };
/** A parked car: `ns` lies north–south. */
function car(cx: number, cz: number, ns: boolean, tint: string): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', GLASS);
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
// Along the avenue (road x 29.4..34.6), leaving a lane each way.
car(30.5, 9, true, '#9c2a24');
car(33.5, 20, true, '#2a4a7a');
car(30.5, 44, true, '#d8d2c4');
car(33.5, 58, true, '#3e6b3a');
car(30.6, 66, true, '#c9a227');
// Along the cross street (road z 29.4..34.6).
car(9, 30.5, false, '#2a2a2e');
car(20, 33.5, false, '#7a2a6a');
car(44, 30.5, false, '#d8d2c4');
car(60, 33.5, false, '#9c2a24');
car(70, 30.6, false, '#2a4a7a');
// A box truck backed up to the warehouse.
m.block([72, 1, 46], [2.5, 2.8, 7], 'solid', { material: 'pbr_white_panel' });
m.block([72, 0, 40.6], [2.5, 2.8, 2.6], 'solid', { material: 'paint_gloss', tint: '#2a4a7a' });
for (const dz of [-2.5, 2.5]) m.block([72, 0, 46 + dz], [2.3, 1, 1.2], 'solid', TYRES);

// ---------------------------------------------------------------- spawns
for (const [x, z] of [[24, -2], [27, 1], [32, -2], [37, 1], [40, -2], [44, 2], [20, 2], [32, 3]] as const) m.spawn([x, 0, z], 0, embers);
for (const [x, z] of [[24, 72], [27, 69], [32, 74], [37, 70], [40, 74], [44, 72], [23, 70], [48, 74]] as const) m.spawn([x, 0, z], Math.PI, tide);
m.spawn(at(0, 2), P, null).spawn(at(9, 0), -P, null).spawn(at(0, 6), P, null).spawn(at(9, 8), -P, null).spawn(at(5, 5), 0, null).spawn(at(3, 3), Math.PI, null);

// ---------------------------------------------------------------- objectives
m.add({ kind: 'bombsite', position: [12, 0, 52], label: 'A', radius: 6 });
m.add({ kind: 'bombsite', position: [52, 0, 50], label: 'B', radius: 6 });
// Hostage Rescue: two upstairs in the north-west house, two on the warehouse mezzanine; Embers bring them to the south end.
m.hostage([8, 4, 63], Math.PI).hostage([15, 4, 63], Math.PI).hostage([52, 4, 57], Math.PI).hostage([62, 4, 57], Math.PI);
m.rescue([32, 0, 0], 5);

// ---------------------------------------------------------------- pickups
m.pickup('weapon_smg', at(0, 0)).pickup('weapon_shotgun', at(9, 1));
m.pickup('weapon_rifle', at(3, 5)).pickup('weapon_burst_rifle', at(5, 3));
m.pickup('weapon_sniper', at(8, 7, 1, 0, 2)); // on the warehouse mezzanine
m.pickup('weapon_rockets', at(4, 4, 0, 0, 0), 45); // in the middle of the crossroads
m.pickup('armor_large', at(1, 8, 1, 4, -2)).pickup('armor_small', at(6, 2)).pickup('armor_small', at(3, 7));
m.pickup('health_large', at(7, 5)).pickup('health_small', at(1, 2, 0, 0, 2)).pickup('health_small', at(0, 9)).pickup('health_small', at(9, 9));
m.pickup('ammo', at(2, 0)).pickup('ammo', at(7, 0)).pickup('ammo_rifle', at(0, 5)).pickup('ammo_rifle', at(8, 5));
m.pickup('ammo_shells', at(5, 7)).pickup('ammo_sniper', at(7, 9)).pickup('grenades', at(3, 2)).pickup('grenades', at(5, 9));

// ---------------------------------------------------------------- props
// Street furniture: bus stops, bins, planters, barriers by the crossing.
m.prop('bench', [37.5, 0.15, 13], -P).prop('bench', [26.5, 0.15, 52], P).prop('trashcan', [37.4, 0.15, 17]).prop('trashcan', [26.6, 0.15, 47]);
m.prop('trashcan', [13, 0.15, 37.4]).prop('trashcan', [51, 0.15, 26.6]).prop('potted_plant', [37.5, 0.15, 37.5]).prop('potted_plant', [26.5, 0.15, 26.5]);
m.prop('barrier', [38, 0, 24], P).prop('barrier', [26, 0, 40], P).prop('cone', [31, 0, 25], 0, 1, false).prop('cone', [33, 0, 39], 0, 1, false);
m.prop('signpost', [37.6, 0.15, 26.4], Math.PI).prop('awning', [16, 0, 4.6], 0).prop('shopping_cart', [5, 0, 2], 0.4);
// The lots: a skip and pallets behind the shop, crates round the bunker, a tree line on the west edge.
m.prop('skip', [10, 0, 22], 0).prop('cardboard_box', [14, 0, 21]).prop('factory_box', [18, 0, 18], 0.2);
m.prop('crate_large', [44, 0, 14], 0.2).prop('cargo_crate', [62, 0, 2], -0.3).prop('barrel', [42, 0, 4]).prop('barrel', [43, 0, 4.8]);
m.prop('crate_large', [40, 0, 54]).prop('cargo_crate', [44, 0, 42], 0.3).prop('barrel_open', [76, 0, 60]).prop('skip', [66, 0, 70], P);
m.prop('cargo_crate', [20, 0, 42], 0.1).prop('barrier_high', [6, 0, 42], 0).prop('dungeon_barrel', [18, 0, 46]);
for (const z of [12, 22, 44, 58]) m.prop('tree_round', [-2.5, 0, z], 0);
for (const [x, z] of [[-2.5, 30], [76.5, 22], [76.5, 54], [8, 76.5], [56, 76.5]] as const) m.prop('lightpost', [x, 0, z], 0);
m.breakable('gas', [6, 0, 58]);
m.breakable('glass', [14, 0, 10.2]);

m.bounds('invisible');
m.lightRooms();
m.meta({
  description:
    'A downtown block where an avenue crosses a street. Embers come up from the south past a corner shop and a sandbagged bunker; Tide hold the north. Bomb site A is the gas station under its canopy, B the warehouse floor; in Hostage Rescue the hostages wait upstairs in the house and on the warehouse mezzanine. Parked cars, bus stops and barriers are the cover on the open streets, and a fire escape climbs to the warehouse’s upper door.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [8, 16],
});
await m.save();
