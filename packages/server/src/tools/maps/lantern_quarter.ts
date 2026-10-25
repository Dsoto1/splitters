/**
 * Lantern Quarter: a two-storey restaurant on a neon-lit night street (homage
 * in spirit to the restaurant-and-street map of the classic time-travelling
 * shooter). The dining hall is a double-height atrium with a gallery all
 * round and a staircase up; the kitchen behind it has a serving hatch, a back
 * door and the back stairs. Upstairs: the gallery, two private dining rooms
 * with a balcony over the street, and the office (rocket launcher). Outside,
 * the street runs past three shopfronts, and an alley loops round the back of
 * the restaurant from one end of the street to the other.
 *
 * Grid x east, y north (one cell = 8 m); [brackets] = upstairs (z1).
 *
 *   y3    a   a   a   a   a          a  back alley (loops round: west, north and east)
 *   y2    a   K   K   T   a          K  kitchen [office]   T  back stairwell (both floors)
 *   y1    a   D   D   R   a          D  dining atrium (two storeys, gallery all round)
 *   y0    a   D   D   R   a          R  tea rooms [private dining rooms]
 *   y-1   s   s   s   s   s   s   s  s  street, [balconies] over it at x0 and x2
 *   y-2   S   S   .   S   S   .   S  S  shops
 *        -2  -1   0   1   2   3   4
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('lantern_quarter', 'Lantern Quarter');
m.theme('neon');
const P = Math.PI / 2;

// ---------------------------------------------------------------- street and shops
m.fill('yard', -2, -1, 4, -1);
m.tile('room', -2, -2).tile('room', -1, -2).tile('room', 1, -2).tile('room', 2, -2).tile('room', 4, -2);
m.edge(-2, -2, 0, 'N', 'windows').edge(-1, -2, 0, 'N', 'wide').edge(1, -2, 0, 'N', 'wide').edge(2, -2, 0, 'N', 'windows').edge(4, -2, 0, 'N', 'door');
m.edge(-2, -2, 0, 'E', 'arch').edge(1, -2, 0, 'E', 'arch');
for (const x of [0, 3]) m.edge(x, -1, 0, 'S', 'high');
m.edge(-2, -1, 0, 'W', 'high').edge(-2, -1, 0, 'N', 'high').edge(4, -1, 0, 'E', 'high').edge(4, -1, 0, 'N', 'high');

// ---------------------------------------------------------------- the restaurant
m.tile('atrium', 0, 0);
m.fill('room', 0, 2, 1, 2); // kitchen
m.tile('stairwell', 2, 2, 0, 0); // back stairs, doors west on both floors
m.fill('room', 2, 0, 2, 1); // tea rooms
m.fill('room', 0, 2, 1, 2, 1); // office and store room above the kitchen
m.fill('room', 2, 0, 2, 1, 1); // private dining rooms
m.tile('balcony', 0, -1, 1, 2).tile('balcony_round', 2, -1, 1, 2);
// Front: a wide entrance, display windows, the tea-room door; windows upstairs.
m.edge(0, 0, 0, 'S', 'wide').edge(1, 0, 0, 'S', 'windows').edge(1, 0, 1, 'S', 'windows');
// West side onto the alley: a side door and windows on both floors.
m.edge(0, 0, 0, 'W', 'windows').edge(0, 0, 1, 'W', 'window').edge(0, 1, 1, 'W', 'window');
// Kitchen: serving hatch into the dining hall, a back door, a window; the two halves open.
m.edge(1, 1, 0, 'N', 'window').edge(0, 2, 0, 'N', 'window').edge(0, 2, 0, 'E', 'open');
m.edge(0, 2, 1, 'W', 'window').edge(1, 2, 1, 'N', 'window');
// Tea rooms: arches from the dining hall, one room on both floors, windows and a side door east.
m.edge(1, 0, 0, 'E', 'arch').edge(1, 1, 0, 'E', 'arch').edge(2, 0, 0, 'N', 'open').edge(2, 0, 1, 'N', 'open');
m.edge(2, 0, 0, 'E', 'window').edge(2, 0, 1, 'E', 'windows').edge(2, 1, 1, 'E', 'windows');

// ---------------------------------------------------------------- the alley loop
m.fill('yard', -1, 0, -1, 3).fill('yard', 0, 3, 3, 3).fill('yard', 3, 0, 3, 2);
for (let y = 0; y <= 3; y++) m.edge(-1, y, 0, 'W', 'high').edge(3, y, 0, 'E', 'high');
for (let x = -1; x <= 3; x++) m.edge(x, 3, 0, 'N', 'high');

// ---------------------------------------------------------------- spawns
m.spawn([-16, 0, -8], P).spawn([32, 0, -8], -P).spawn([-16, 0, -17], 0).spawn([12, 0, -17], 0).spawn([32, 0, -17], 0);
m.spawn([-8, 0, 14], Math.PI).spawn([16, 0, 24], -P).spawn([24, 0, 4], 0);
m.spawn([6, 0, 17], -P).spawn([17, 0, 9], Math.PI).spawn([2, 4, 18], Math.PI).spawn([18, 4, 3], Math.PI).spawn([-2, 4, 10.8], P);

// ---------------------------------------------------------------- pickups
// Power: rockets in the upstairs office, the spin gun in the end shop.
m.pickup('weapon_rockets', [6, 4, 16]).pickup('ammo_explosive', [-2, 4, 16]);
m.pickup('weapon_lmg', [32, 0, -19]).pickup('ammo_rifle', [-12, 0, -19]);
// Dining hall: health on the floor, heavy armour on the gallery.
m.pickup('health_large', [8, 0, 6]).pickup('armor_large', [4, 4, 10.8]);
// Kitchen: shotgun and the flamethrower; tea rooms: SMG; private rooms: marksman rifle.
m.pickup('weapon_shotgun', [0, 0, 18]).pickup('weapon_flamethrower', [8, 0, 13]).pickup('ammo_fuel', [10, 0, 19]);
m.pickup('weapon_smg', [16, 0, 0]).pickup('weapon_marksman', [16, 4, 8]).pickup('armor_small', [16, 4, -5.5]);
// Street and alleys.
m.pickup('weapon_rifle', [-4, 0, -8]).pickup('weapon_launcher', [24, 0, -8]).pickup('ammo_shells', [8, 0, -10]);
m.pickup('health_small', [-8, 0, 24]).pickup('health_small', [24, 0, 24]).pickup('health_small', [-8, 0, -16]).pickup('health_small', [16, 0, -16]);
m.pickup('grenades', [-8, 0, 0]).pickup('ammo_light', [24, 0, 12]).pickup('armor_small', [8, 0, 24]);

// ---------------------------------------------------------------- props
// Dining hall: round tables with chairs, a long table by the window, lanterns.
for (const [x, z] of [[-1, 8], [6, 8], [-1, 3]] as const) {
  m.prop('table_round', [x, 0, z]).prop('chair_cushion', [x - 1.3, 0, z], P).prop('chair_cushion', [x + 1.3, 0, z], -P);
  m.prop('lantern', [x, 0.8, z], 0, 0.8, false);
}
m.prop('table_cloth', [9.5, 0, -2.6]).prop('chair', [8.5, 0, -1.6], Math.PI).prop('chair', [10.5, 0, -1.6], Math.PI);
m.prop('potted_plant', [-3.2, 0, -3.2]).prop('potted_plant', [11.2, 0, 11.2]).prop('rug', [4, 0.01, 5], 0, 1.4, false);
// Gallery: a table and plants.
m.prop('table', [10.8, 4, 4], P).prop('potted_plant', [-3, 4, 11]).prop('floor_lamp', [11, 4, 11], 0, 1, false);
// Kitchen: stoves and cabinets along the back wall, a prep bench, fridge, sacks and barrels.
for (const x of [-2.5, -1.5, 3, 4]) m.prop(x < 0 ? 'stove' : 'kitchen_cabinet', [x, 0, 19.4], Math.PI);
m.prop('stove', [9.5, 0, 19.4], Math.PI).prop('kitchen_cabinet', [10.5, 0, 19.4], Math.PI).prop('fridge', [11, 0, 13.2], -P);
m.prop('workbench', [4, 0, 15]).prop('workbench', [5.2, 0, 15]).prop('barrel', [-3, 0, 13]).prop('crate_bottles', [-2, 0, 13]);
// Tea rooms: low tables, cushions, a screen of shelves.
m.prop('table', [16, 0, -1.5]).prop('bench', [16, 0, -3], 0, 2).prop('table', [16, 0, 10], P).prop('sofa', [19, 0, 10], -P);
m.prop('bookcase_wide', [13, 0, 4], P).prop('potted_plant', [19, 0, -3]);
// Upstairs: private dining, office desk and shelves, store room boxes.
m.prop('table_cloth', [16, 4, 1], P).prop('chair_cushion', [14.8, 4, 1], P).prop('chair_cushion', [17.2, 4, 1], -P);
m.prop('sofa_long', [18.8, 4, 9], -P).prop('tv_cabinet', [13.4, 4, 9], P);
m.prop('desk', [8, 4, 19.2], Math.PI).prop('office_chair', [8, 4, 18]).prop('bookcase', [11.4, 4, 15], -P).prop('coat_rack', [4.5, 4, 19]);
m.prop('cardboard_box', [-3, 4, 19]).prop('cardboard_open', [-2.2, 4, 19.2]).prop('crate_small', [-3.2, 4, 13]);
// Street: market stalls under parasols, crates, lamp posts, a skip.
m.prop('lightpost_double', [-8, 0, -4.6], P).prop('lightpost_double', [16, 0, -4.6], P).prop('lightpost', [32, 0, -4.6], P);
m.prop('parasol', [-12, 0, -9], 0, 1, false).prop('display_table', [-12, 0, -9]).prop('parasol', [20, 0, -8], 0, 1, false).prop('display_table', [20, 0, -8]);
m.prop('crate_large', [3, 0, -10.5], P).prop('crate_small', [4.2, 0, -10.5]).prop('barrel', [28, 0, -11]).prop('barrel_open', [28.8, 0, -10.6]);
m.prop('skip', [-16, 0, -4.8], P).prop('trashcan', [11, 0, -4.8]).prop('cone', [34, 0, -4.8]);
// Shops: counters and stock.
m.prop('desk_corner', [-18, 0, -18.5]).prop('bookcase_wide', [-8, 0, -19.4]).prop('crate_bottles', [-11, 0, -14]);
m.prop('display_table', [8, 0, -17]).prop('cardboard_box', [10, 0, -19]).prop('cardboard_box', [10.4, 0, -18.5]).prop('bookcase_wide', [16, 0, -19.4]);
m.prop('kitchen_cabinet', [34, 0, -19], 0).prop('crate_open', [30, 0, -13]);
// Alleys: bins, crates, barrels, the odd lantern.
m.prop('container', [-10, 0, 1]).prop('dungeon_barrel', [-6, 0, 6]).prop('crate_large', [-10.5, 0, 18]).prop('trashcan', [-6, 0, 27]);
m.prop('cardboard_open', [2, 0, 27]).prop('crate_large', [12, 0, 25.5], P).prop('barrel', [20, 0, 26]).prop('container_wide', [27, 0, 26]);
m.prop('crate_small', [26.5, 0, 15]).prop('barrel', [21.5, 0, 6]).prop('lantern', [-11, 2.5, 8], 0, 1, false).prop('lantern', [27, 2.5, 12], 0, 1, false);

m.bounds('invisible');
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(6);
m.lightRooms();
m.meta({
  description:
    'A two-storey restaurant on a neon-lit night street: a double-height dining hall with a gallery all round, a kitchen with a serving hatch and back stairs, private dining rooms with balconies over the street and the office upstairs (rockets). Outside, shopfronts line the street and an alley loops round the back from one end to the other. An homage in spirit to the classic restaurant-and-street map.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 12],
});
await m.save();
