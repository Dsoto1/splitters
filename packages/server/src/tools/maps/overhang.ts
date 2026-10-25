/**
 * Overhang: a two-storey techbase hall with a ledge over a lava pit (homage in
 * spirit to Quake II's The Edge). A small deathmatch arena for 2–8 players.
 *
 * - The atrium: open to the roof, with a dais in the middle (double damage)
 *   and arches out to the corridor loop on all four sides.
 * - The corridor loop (ground floor) round the atrium, two stairs up.
 * - The balcony (upper floor) round the atrium, railed, looking down on it.
 * - The edge: a ledge outside the balcony's north side with no railing, over
 *   the lava; the railgun waits at its far end.
 *
 * Grid x east, y north (one cell = 8 m); floors 4 m.
 *
 *   y6          e   e   e               the edge (upper floor, over the lava)
 *   y5      c   c   c   S   c           S stairs: east low, west high
 *   y4      c   A   A   A   c           A atrium (open to the roof), dais at the centre
 *   y3      c   A   A   A   c
 *   y2      c   A   A   A   c
 *   y1      c   S   c   c   c           S stairs: west low, east high
 *       0   1   2   3   4   5
 *   c corridor loop on the ground floor, balcony over it
 */
import type { TileSurfaces } from '@chronosplit/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('overhang', 'Overhang');
m.theme('factory');
m.backdrop('dusk', 'mesas', 'stone', 0.5);
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

const inner = (x: number, y: number) => x >= 2 && x <= 4 && y >= 2 && y <= 4;
const RING: [number, number][] = [];
for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) if (!inner(x, y)) RING.push([x, y]);
const STAIRS = new Set(['2,1', '4,5']);

// ---------------------------------------------------------------- the hall
for (const [x, y] of RING) {
  if (STAIRS.has(`${x},${y}`)) continue;
  m.tile('room', x, y, 0).tile('platform_rail', x, y, 1);
}
for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) m.tile('room', x, y, 0);
m.tile('stairs', 2, 1, 0, 0); // from (1,1) below up east to (3,1) on the balcony
m.tile('stairs', 4, 5, 0, 2); // from (5,5) below up west to (3,5) on the balcony
for (let x = 2; x <= 4; x++) m.tile('platform', x, 6, 1); // the edge

// The corridor loop runs open all the way round; the atrium opens onto it through an arch each side.
for (const [x, y] of RING) {
  for (const [side, nx, ny] of [['E', x + 1, y], ['N', x, y + 1]] as const) {
    if (!RING.some(([a, b]) => a === nx && b === ny)) continue;
    if (STAIRS.has(`${x},${y}`) || STAIRS.has(`${nx},${ny}`)) continue;
    m.edge(x, y, 0, side, 'open');
    m.edge(x, y, 1, side, 'open');
  }
}
for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) {
  if (x < 4) m.edge(x, y, 0, 'E', 'open');
  if (y < 4) m.edge(x, y, 0, 'N', 'open');
}
m.edge(3, 1, 0, 'N', 'arch').edge(3, 5, 0, 'S', 'arch').edge(1, 3, 0, 'E', 'arch').edge(5, 3, 0, 'W', 'arch');
for (const [x, y, side] of [[2, 1, 'N'], [4, 1, 'N'], [2, 5, 'S'], [1, 2, 'E'], [1, 4, 'E'], [5, 2, 'W'], [5, 4, 'W']] as const) m.edge(x, y, 0, side, 'wall');
// The stairs open at the foot and the head onto the loop.
m.edge(1, 1, 0, 'E', 'open').edge(3, 1, 1, 'W', 'open').edge(5, 5, 0, 'W', 'open').edge(3, 5, 1, 'E', 'open');
// The balcony's outer walls, with windows on the mesas; doors north onto the edge.
for (const [x, y] of RING) {
  if (STAIRS.has(`${x},${y}`)) continue;
  const out: ('N' | 'S' | 'E' | 'W')[] = [...(y === 1 ? ['S' as const] : []), ...(y === 5 ? ['N' as const] : []), ...(x === 1 ? ['W' as const] : []), ...(x === 5 ? ['E' as const] : [])];
  for (const side of out) m.edge(x, y, 1, side, side === 'N' && x >= 2 && x <= 4 ? 'wide' : 'windows');
}
// The edge itself: no railing, just the drop.
m.edge(2, 6, 1, 'W', 'open').edge(4, 6, 1, 'E', 'open');
for (let x = 2; x <= 4; x++) m.edge(x, 6, 1, 'N', 'open');

// Surfaces: tread plate below, grated balcony, rust and brick walls.
for (const [x, y] of RING) if (!STAIRS.has(`${x},${y}`)) paint(x, y, 1, { floor: mat('pbr_walkway'), underside: mat('pbr_rusted_plate') });
for (let x = 2; x <= 4; x++) paint(x, 6, 1, { floor: mat('pbr_rusted_plate'), underside: mat('pbr_rusted_plate') });

// ---------------------------------------------------------------- the atrium dais, the lava pit
m.block([24, 0, 24], [6, 0.6, 6], 'solid', { material: 'pbr_tread_plate' });
// Steps of 0.3 m (0.4 is too tall to walk up).
m.block([24, 0, 20.5], [3, 0.3, 1], 'solid', { material: 'pbr_tread_plate' }).block([24, 0, 27.5], [3, 0.3, 1], 'solid', { material: 'pbr_tread_plate' });
for (const [x, z] of [[18.5, 18.5], [29.5, 18.5], [18.5, 29.5], [29.5, 29.5]] as const) m.block([x, 0, z], [1.2, 8, 1.2], 'solid', { material: 'pbr_steel' });
m.block([24, -9, 52], [30, 1, 14], 'solid', { material: 'pbr_rock' });
m.water([24, -8, 52], [30, 2, 14], 'lava');
m.prop('machine', [10, 0, 10], P).prop('big_pipe', [40, 0, 26]).prop('metal_crate', [38, 0, 38], 0.3).prop('factory_box', [10, 0, 38]);
m.prop('barrel', [38.5, 0, 9]).breakable('barrel', [9, 0, 25]).breakable('gas', [39, 0, 22]);

// ---------------------------------------------------------------- spawns, items
for (const [x, y, z, yaw] of [[1, 2, 0, 0], [5, 2, 0, 0], [1, 5, 0, Math.PI], [3, 1, 0, 0], [5, 1, 1, -P], [1, 4, 1, P], [5, 4, 1, -P], [2, 1, 1, 0], [3, 3, 0, 0], [3, 5, 1, Math.PI]] as const) {
  if (STAIRS.has(`${x},${y}`)) continue;
  m.spawn(at(x, y, z, x === 3 && y === 3 ? 0 : 0, x === 3 && y === 3 ? -6 : 0), yaw, null);
}
m.pickup('weapon_railgun', at(4, 6, 1, 2, 0)).pickup('ammo_cells', at(2, 6, 1, -2, 0));
m.pickup('powerup_damage', [24, 0.6, 24], 90).pickup('weapon_rockets', at(1, 3, 0)).pickup('ammo_explosive', at(5, 3, 0));
m.pickup('weapon_shotgun', at(3, 1, 0)).pickup('weapon_auto_shotgun', at(3, 5, 0)).pickup('weapon_lmg', at(5, 1, 1)).pickup('weapon_plasma', at(1, 5, 1));
m.pickup('armor_large', at(3, 1, 1)).pickup('armor_small', at(1, 2, 1)).pickup('armor_small', at(5, 4, 1));
m.pickup('health_large', at(2, 2)).pickup('health_small', at(1, 1)).pickup('health_small', at(5, 5)).pickup('health_small', at(4, 4));
m.pickup('ammo_shells', at(1, 4)).pickup('ammo', at(5, 2)).pickup('ammo', at(2, 5, 1)).pickup('grenades', at(4, 2));
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(4);
m.bounds('invisible');
m.lightRooms();
m.meta({
  description:
    'A two-storey techbase hall: an atrium open to the roof with double damage on its dais, a corridor loop round it, a railed balcony above, and the edge — a ledge with no railing outside the balcony, over a lava pit, where the railgun waits. A small arena for 2–8 players.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 8],
});
await m.save();
