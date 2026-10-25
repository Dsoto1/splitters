/**
 * Downtown: a city crossroads built from the Downtown City MegaKit tiles.
 * Two streets cross in the middle; an office block, a brownstone and a midrise
 * stand on three corners (solid: their roofs are sniper perches for anyone
 * with a jetpack or a way up), and the fourth corner is a block of shops you
 * can go into, dressed with shopfront, brick and plaster facades. Embers come
 * in from the west, Tide from the east.
 *
 * Grid x east, y north (one cell = 8 m):
 *
 *   y 7   .  .  .  .  |  .  S  .  .  .  .  .
 *   y 4..6  brownstone|  S  S   office block
 *   y 0..3  street ===  CROSSROADS  === street
 *   y-1..-2  midrise  |  S  S   shops
 *   y-4..-3  .  .  .  |  .  S   shops
 *          -4 ... -1     0..3     4 ... 7
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('downtown', 'Downtown');
m.theme('city');
m.backdrop('clear', 'city', 'gravel', 0.4);
m.teams([8, 8]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;

// The crossroads and its four streets (a street tile is 1 cell along the road, 2 across).
m.tile('city.crossroads', 0, 0);
for (const x of [-4, -3, -2, -1, 4, 5, 6, 7]) m.tile('city.street', x, 1);
for (const y of [-4, -3, -2, -1, 4, 5, 6, 7]) m.tile('city.street', 1, y, 0, 1);

// Corner buildings, street faces toward the crossroads.
m.tile('city.highrise', 6, 6, 0, 2); // cells x 4..6, y 4..6, front south
m.tile('city.brownstone', -2, 5, 0, 2); // x -3..-2, y 4..5
m.tile('city.midrise', -3, -2); // x -3..-2, y -2..-1, front north

// The shops (south-east): a two-cell shopfront, brick and plaster units, all with doors onto the pavement.
m.tile('core.room_large', 4, -2, 0, 0, { layout: 'low_cover', facade: 'storefront' });
m.tile('core.room', 6, -1, 0, 0, { facade: 'brick', ceiling: 'roof' });
m.tile('core.room', 6, -2, 0, 0, { facade: 'brick', ceiling: 'roof' });
m.tile('core.room', 4, -4, 0, 0, { facade: 'plaster', ceiling: 'roof' });
m.tile('core.room', 6, -4, 0, 0, { facade: 'plaster', layout: 'pillar', ceiling: 'roof' });
// A corner shop by the brownstone.
m.tile('core.room', -1, 6, 0, 0, { facade: 'storefront', ceiling: 'roof' });

// Pavement everywhere else inside the block.
const used = new Set<string>();
for (const t of m.doc.classicStructure.tiles) used.add(`${t.x},${t.y}`);
const taken = (x: number, y: number) => {
  // Multi-cell tiles: mark every footprint cell.
  for (const t of m.doc.classicStructure.tiles) {
    if (t.tile === 'city.crossroads' && x >= t.x && x < t.x + 4 && y >= t.y && y < t.y + 4) return true;
    if (t.tile === 'city.street' && (t.rotation === 0 ? x === t.x && (y === t.y || y === t.y + 1) : y === t.y && (x === t.x || x === t.x + 1))) return true;
    if (t.tile === 'city.highrise' && x >= 4 && x <= 6 && y >= 4 && y <= 6) return true;
    if (t.tile === 'city.brownstone' && x >= -3 && x <= -2 && y >= 4 && y <= 5) return true;
    if (t.tile === 'city.midrise' && x >= -3 && x <= -2 && y >= -2 && y <= -1) return true;
    if (t.tile === 'core.room_large' && x >= 4 && x <= 5 && y >= -2 && y <= -1) return true;
  }
  return used.has(`${x},${y}`);
};
for (let x = -4; x <= 7; x++) for (let y = -4; y <= 7; y++) if (!taken(x, y)) m.tile('core.yard', x, y);
m.edge(-1, 6, 0, 'E', 'windows');

// Street dressing.
for (const [x, z] of [[-12, 4], [-12, 20], [44, 4], [44, 20]] as const) m.prop('hm_floor_lamp', [x, 0, z], 0, 2, false);
m.prop('sv_trashcan_metal', [30, 0, -4]).prop('dg_crate', [-6, 0, 30], 0.3).prop('dg_barrel', [-5, 0, 32]);
m.prop('nt_common_tree', [44, 0, 52], 0).prop('nt_common_tree', [-28, 0, -28], 1).prop('nt_birch', [52, 0, -28], 2);

// Spawns: Embers west, Tide east, everyone round the edges for deathmatch.
for (const [x, z] of [[-30, 8], [-30, 16], [-26, 4], [-26, 20], [-30, 36], [-30, -12], [-22, 52], [-22, -28]] as const) m.spawn([x, 0, z], P, embers);
for (const [x, z] of [[58, 8], [58, 16], [54, 4], [54, 20], [58, -12], [58, -28], [36, 58], [52, -20]] as const) m.spawn([x, 0, z], -P, tide);
for (const [x, z] of [[12, 12], [0, 40], [24, -24], [40, -12], [-8, -24], [-32, 36], [44, 58], [8, -32]] as const) m.spawn([x, 0, z], 0, null);
m.pickup('weapon_rifle', [12, 0, 12]).pickup('weapon_shotgun', [36, 0, -12]).pickup('weapon_smg', [-8, 0, 48]).pickup('weapon_sniper', [52, 0, -32]);
m.pickup('armor_large', [12, 0, 28]).pickup('health_large', [40, 0, -24]).pickup('ammo', [-8, 0, 28]).pickup('ammo', [28, 0, 0]).pickup('grenades', [0, 0, 0]);
m.hill([12, 0, 12], 6);
m.lightRooms({ color: '#fff1d8', intensity: 1 });
m.bounds('invisible');
m.meta({
  description:
    'A city crossroads: two streets meet in the middle under an office block, a brownstone and a midrise; the south-east corner is a row of shops you can run through. Embers hold the west end, Tide the east.',
  modes: ['core.tdm', 'core.deathmatch', 'core.koth', 'core.zombies'],
  players: [6, 16],
});
await m.save();
