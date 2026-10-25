/**
 * Atomic Court: a tiny 1950s cul-de-sac in the desert (homage in spirit to
 * Call of Duty's Nuketown). Two two-storey houses face each other across the
 * street, a yellow one north and a teal one south, each with a garage beside
 * it, a lawn out front and a fenced backyard. A school bus and a box truck
 * stand in the middle of the street. The map is point-symmetric about the bus.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y8  .   .   .   .   .   .   .   .   .     north backyard (Embers)
 *   y7  .   .   .   N   N   .   .   .   .     N yellow house
 *   y6  .   g   g   N   N   .   .   .   .     g garage
 *   y5  .   .   .   .   .   .   .   .   .     lawns
 *   y4  =   =   =   =   =   =   =   =   =     the street: bus and truck
 *   y3  .   .   .   .   .   .   .   .   .     lawns
 *   y2  .   .   .   .   S   S   g   g   .     S teal house
 *   y1  .   .   .   .   S   S   .   .   .
 *   y0  .   .   .   .   .   .   .   .   .     south backyard (Tide)
 *       0   1   2   3   4   5   6   7   8
 */
import type { TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('atomic_court', 'Atomic Court');
m.theme('garden');
m.backdrop('clear', 'mesas', 'sand', 0.35);
m.teams([6, 6]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === 0);
  if (!t) throw new Error(`no tile at ${x},${y}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}

// ---------------------------------------------------------------- houses and garages
m.tile('house', 3, 6).tile('shop', 1, 6);
m.tile('house', 4, 1).tile('shop', 6, 2);
const built = new Set(['3,6', '4,6', '3,7', '4,7', '1,6', '2,6', '4,1', '5,1', '4,2', '5,2', '6,2', '7,2']);
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
  if (built.has(`${x},${y}`)) continue;
  m.tile(y === 4 ? 'street' : 'yard', x, y, 0, y === 4 ? 1 : 0);
}
const house = (tint: string): TileSurfaces => ({ walls: mat('pbr_plaster_white', tint), floor: mat('pbr_floorboards'), solids: mat('pbr_walnut'), trim: mat('pbr_plaster_white') });
paint(3, 6, house('#e6cf72'));
paint(4, 1, house('#86c4b4'));
paint(1, 6, { ...house('#e6cf72'), floor: mat('pbr_concrete') });
paint(6, 2, { ...house('#86c4b4'), floor: mat('pbr_concrete') });
for (let x = 0; x <= 8; x++) paint(x, 4, { floor: mat('pbr_asphalt') });
// The lots' sides of the house walls take the house colours too.
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
  if (built.has(`${x},${y}`) || y === 4) continue;
  paint(x, y, { walls: mat('pbr_plaster_white', y > 4 ? '#e6cf72' : '#86c4b4') });
}
// Picket fences round the lots; the street ends in a fence too (it's a cul-de-sac).
for (let i = 0; i <= 8; i++) {
  m.edge(0, i, 0, 'W', 'fence').edge(8, i, 0, 'E', 'fence');
  m.edge(i, 0, 0, 'S', 'fence').edge(i, 8, 0, 'N', 'fence');
}

// ---------------------------------------------------------------- the street: bus, truck and cars
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const DARK = { material: 'paint_gloss', tint: '#1c2228' };
/** The school bus, east–west across the middle of the street. */
m.block([34, 0.6, 32], [10, 2.4, 2.6], 'solid', { material: 'paint_gloss', tint: '#e8b923' });
m.block([34, 1.7, 32], [9.4, 0.8, 2.66], 'solid', DARK);
m.block([39.6, 0.4, 32], [1.4, 1.6, 2.5], 'solid', { material: 'paint_gloss', tint: '#e8b923' });
for (const dx of [-3.2, 3.6]) m.block([34 + dx, 0, 32], [1.2, 0.6, 2.4], 'solid', TYRES);
/** A box truck, the other way. */
m.block([22, 1, 32], [7, 2.8, 2.5], 'solid', { material: 'pbr_white_panel' });
m.block([26.9, 0, 32], [2.6, 2.6, 2.5], 'solid', { material: 'paint_gloss', tint: '#9c2a24' });
for (const dx of [-2.5, 2.5]) m.block([22 + dx, 0, 32], [1.2, 1, 2.3], 'solid', TYRES);
function car(cx: number, cz: number, tint: string): void {
  m.block([cx, 0.25, cz], [2, 0.85, 4.4], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], [1.8, 0.6, 2.2], 'solid', DARK);
  m.block([cx, 0, cz], [1.9, 0.25, 3.6], 'solid', TYRES);
}
car(12, 41, '#c4473a'); // in the north drive
car(52, 23, '#3a6fb0'); // in the south drive

// ---------------------------------------------------------------- yards
// Lawns: a tree, a mailbox post, a sign. Backyards: picnic tables, a shed, a parasol.
m.prop('tree_round', [36, 0, 41]).prop('tree_round', [28, 0, 23]).prop('bush_large', [4, 0, 37]).prop('bush_large', [60, 0, 27]);
m.prop('signpost', [21, 0, 37.5], 0).prop('signpost', [43, 0, 26.5], Math.PI);
m.prop('table', [20, 0, 65], 0).prop('parasol', [20, 0, 65], 0, 1, false).prop('table', [44, 0, -1], 0).prop('parasol', [44, 0, -1], 0, 1, false);
m.prop('bench', [8, 0, 62], P).prop('bench', [56, 0, 2], -P).prop('trashcan', [38, 0, 61]).prop('trashcan', [26, 0, 3]);
m.prop('bush', [62, 0, 52]).prop('bush', [2, 0, 12]).prop('tree_tall', [66, 0, 64]).prop('tree_tall', [-2, 0, 0]);
// Garden sheds: the north one in the east side lot, the south one in the west.
m.block([60, 0, 58], [3, 2.6, 2.4], 'solid', { material: 'pbr_planks', tint: '#a0703a' });
m.block([4, 0, 6], [3, 2.6, 2.4], 'solid', { material: 'pbr_planks', tint: '#a0703a' });
m.prop('crate_large', [52, 0, 50], 0.3).prop('crate_large', [12, 0, 14], 0.3).prop('barrel', [60, 0, 46]).prop('barrel', [4, 0, 18]);
m.breakable('gas', [16, 0, 50]).breakable('gas', [48, 0, 14]);
m.furnish('home');

// ---------------------------------------------------------------- spawns, flags, hills
for (const [x, z] of [[8, 66], [16, 66], [28, 66], [36, 66], [52, 64], [64, 66]] as const) m.spawn([x, 0, z], Math.PI, embers);
for (const [x, z] of [[56, -2], [48, -2], [36, -2], [28, -2], [12, 0], [0, -2]] as const) m.spawn([x, 0, z], 0, tide);
for (const [x, z, yaw] of [[0, 30, P], [64, 34, -P], [44, 44, Math.PI], [20, 20, 0], [64, 52, -P], [0, 12, P]] as const) m.spawn([x, 0, z], yaw, null);
m.flag(embers, [24, 0, 66], Math.PI).flag(tide, [40, 0, -2], 0);
m.hill([32, 0, 27], 5).hill([28, 4, 48], 4).hill([36, 4, 10], 4);

// ---------------------------------------------------------------- pickups
m.pickup('weapon_smg', [8, 0, 52]).pickup('weapon_smg', [56, 0, 12]);
m.pickup('weapon_shotgun', [24, 0, 50]).pickup('weapon_shotgun', [40, 0, 14]);
m.pickup('weapon_rifle', [12, 0, 28]).pickup('weapon_rifle', [52, 0, 36]);
m.pickup('weapon_sniper', [24, 4, 54]).pickup('ammo_sniper', [40, 4, 10]);
m.pickup('armor_large', [32, 0, 36]).pickup('health_large', [32, 0, 28.5]);
m.pickup('ammo', [4, 0, 44]).pickup('ammo', [60, 0, 20]).pickup('grenades', [44, 0, 52]).pickup('grenades', [20, 0, 12]);
m.pickup('health_small', [16, 0, 60]).pickup('health_small', [48, 0, 4]).pickup('armor_small', [64, 0, 40]).pickup('armor_small', [0, 0, 24]);

m.bounds('invisible');
m.lightRooms();
m.meta({
  description:
    'A tiny cul-de-sac in the desert: two two-storey houses face each other across a street blocked by a school bus and a truck, each with a garage, a lawn and a fenced backyard. Fast and close, for 2–12 players; the flags are in the backyards and King of the Hill moves between the bus and the two upstairs landings.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [2, 12],
});
await m.save();
