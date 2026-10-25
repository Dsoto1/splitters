/**
 * Felicity Yard: a walled yard between two brick buildings, a garage and a
 * loading dock, with service tunnels underneath (homage in spirit to Perfect
 * Dark's Felicity). The north block is two storeys of offices whose windows
 * look down on the yard; a railed walkway crosses the yard's east side from
 * its upper floor to the south block's. A vent housing in the middle of the
 * yard drops you into the pump room, where the rockets are; the tunnels loop
 * from the garage under the south block to the loading dock.
 *
 * Level 0 (x east, y north; one character = one 8 m cell):
 *
 *   y  2   [GARAGE ][ offices: room  columns  cover  room ][STAIRS]
 *   y  1   [  2x2  ][ yard     yard   crates  yard*      ][ dock ]
 *   y  0   [ST1 v ][ alley ][ yard   VENT    yard   yard*      ][ dock ]
 *   y -1   [crates][ alley ][ lowwall yard   yard   yard*      ][ST2 v]
 *   y -2   [ south block: six rooms ..................... ][STAIRS]
 *                                                  * walkway overhead (level 1)
 * Level 1: offices over the north block, a railed roof terrace on the garage
 *   (sniper rifle), the walkway (heavy armour), two rooms and a terrace on
 *   the south block.
 * Level -1: ST1 (garage) -> tunnel south -> along under the south block ->
 *   ST2 (up into the dock); a branch north to the pump room under the vent.
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('felicity_yard', 'Felicity Yard');
m.theme('factory');
const P2 = Math.PI / 2;
const S = Math.PI; // facing south (-z)

// ---------------------------------------------------------------- level 0

// Garage (2 × 2) in the north-west corner, with the stairs down beside it.
m.tile('room_large', -3, 1, 0);
// North block, ground floor, and its stairwell at the east end.
m.tile('room', -1, 2, 0).tile('room_columns', 0, 2, 0).tile('room_cover', 1, 2, 0).tile('room', 2, 2, 0);
m.tile('stairwell', 3, 2, 0, 0);
// The yard, the vent housing in its middle, and the west alley.
m.tile('yard', -1, 1, 0).tile('yard', 0, 1, 0).tile('yard_crates', 1, 1, 0).tile('yard', 2, 1, 0);
m.tile('yard_wall', -1, -1, 0).fill('yard', 0, -1, 2, -1).tile('yard', -1, 0, 0).tile('yard', 1, 0, 0).tile('yard', 2, 0, 0);
m.tile('drop', 0, 0, 0);
m.tile('yard', -2, 0, 0).tile('yard', -2, -1, 0).tile('yard_crates', -3, -1, 0);
// Loading dock on the east side.
m.tile('room', 3, 0, 0).tile('room', 3, 1, 0);
// South block and its stairwell.
m.tile('room', -3, -2, 0).tile('room', -2, -2, 0).tile('room_pillar', -1, -2, 0).tile('room', 0, -2, 0).tile('room_cover', 1, -2, 0).tile('room', 2, -2, 0);
m.tile('stairwell', 3, -2, 0, 0);

// ---------------------------------------------------------------- level -1 (and the stairs down)

// ST1: from the garage's south door down to the tunnel; ST2: from the tunnel up into the dock.
m.tile('stairs', -3, 0, -1, 3);
m.tile('stairs', 3, -1, -1, 3);
m.tile('corridor', -3, -1, -1, 0);
m.tile('corner', -3, -2, -1, 0);
m.tile('corridor', -2, -2, -1, 1).tile('corridor_clear', -1, -2, -1, 1).tile('junction_t', 0, -2, -1, 0).tile('corridor_clear', 1, -2, -1, 1).tile('corridor', 2, -2, -1, 1);
m.tile('corner', 3, -2, -1, 3);
// Branch north to the pump room under the vent.
m.tile('corridor_clear', 0, -1, -1, 0).tile('room', 0, 0, -1);

// ---------------------------------------------------------------- level 1

// Offices over the north block; a railed terrace on the garage roof.
m.fill('room', -1, 2, 2, 2, 1);
m.fill('platform_rail', -3, 1, -2, 2, 1);
// The walkway across the yard's east side, office to south block.
m.fill('bridge', 2, -1, 2, 1, 1);
// South block upstairs: two rooms and a railed terrace.
m.tile('room', 1, -2, 1).tile('room', 2, -2, 1);
m.tile('platform_rail', -1, -2, 1).tile('platform_rail', 0, -2, 1);

// ---------------------------------------------------------------- walls and openings

// Offices look down on the yard.
for (const x of [-1, 0, 1]) m.edge(x, 2, 1, 'S', 'windows');
m.edge(2, 2, 1, 'E', 'window');
m.edge(-1, 2, 1, 'N', 'window').edge(1, 2, 1, 'N', 'window');
// Ground floor onto the yard.
m.edge(0, 2, 0, 'S', 'wide').edge(1, 2, 0, 'S', 'window').edge(2, 2, 0, 'S', 'arch');
// The garage door and its side door.
m.edge(-2, 1, 0, 'E', 'wide').edge(-2, 1, 0, 'S', 'wide');
// Loading dock: open to the yard.
m.edge(3, 0, 0, 'W', 'wide').edge(3, 1, 0, 'W', 'arch');
// South block: windows on the yard, arches at the alley.
m.edge(0, -2, 0, 'N', 'window').edge(-2, -2, 0, 'N', 'arch');
m.edge(1, -2, 1, 'N', 'windows').edge(1, -2, 1, 'W', 'door');
m.edge(-3, -2, 0, 'N', 'door');

// ---------------------------------------------------------------- spawns

const sp: [number, number, number, number][] = [
  [-24, 0, 14, P2], [-20, 0, 6.5, P2], // garage
  [-8, 0, 17, S], [16, 0, 18, S], // offices, ground floor
  [0, 4, 18, S], [17, 4, 18, S], // offices, upstairs
  [-16, 0, -18, 0], [6, 0, -13.5, 0], // south block
  [16, 4, -18, 0], // south block upstairs
  [24, 0, 10, -P2], // loading dock
  [-24, -4, -16, P2], // tunnel corner
  [2, -4, -2, 0], // pump room
  [8, 0, -6, 0], // yard
];
for (const [x, y, z, yaw] of sp) m.spawn([x, y, z], yaw);

// ---------------------------------------------------------------- pickups

// Power: rockets in the pump room (drop in through the vent), heavy armour on the walkway, the sniper rifle on the garage roof.
m.pickup('weapon_rockets', [-2, -4, 2]).pickup('ammo_explosive', [16, -4, -16]);
m.pickup('armor_large', [16, 4, 0]);
m.pickup('weapon_sniper', [-24, 4, 18]).pickup('ammo_sniper', [-16, 4, 10]);
// Offices.
m.pickup('weapon_rifle', [0, 0, 16]).pickup('weapon_plasma', [-8, 4, 18]).pickup('health_large', [8, 4, 18]).pickup('ammo_cells', [17, 4, 14]);
// South block.
m.pickup('weapon_smg', [0, 0, -16]).pickup('health_small', [-24, 0, -16]).pickup('weapon_hand_cannon', [8, 4, -16]).pickup('ammo_light', [-8, 0, -18]);
// Dock, yard, alley and tunnels.
m.pickup('weapon_launcher', [24, 0, 0]).pickup('ammo_rifle', [22, 0, 8]);
m.pickup('weapon_burst_rifle', [-8, 0, -8]).pickup('grenades', [8, 0, 8]).pickup('health_small', [8, 0, -8]).pickup('armor_small', [-8, 0, 8]);
m.pickup('mines', [-16, 0, -8]).pickup('ammo_rifle', [-22.5, 2, -6.5]);
m.pickup('weapon_shotgun', [8, -4, -16]).pickup('ammo_shells', [-24, -4, -8]).pickup('health_small', [-2, -4, -10]);

// ---------------------------------------------------------------- props

// Yard: crates, pipes and barrels for cover.
m.prop('cargo_crate', [-9, 0, 2], 0.3).prop('crate_large', [-10.5, 0, -1.5], 0).prop('crate_small', [-9.6, 0, -3], 0.4);
m.prop('factory_box', [5, 0, 5], 0.1).prop('pipe_valve', [13.5, 0, -2]).prop('pipe_glass', [13.5, 0, 2]);
m.prop('container_tall', [-11, 0, 10.5]).prop('crate_large', [4.5, 0, 11], P2);
m.breakable('barrel', [-2, 0, -10]).breakable('barrel', [10, 0, -10.5]).breakable('gas', [13, 0, -6]);
m.prop('cone', [-15, 0, 2]).prop('cone', [-14, 0, -4]).prop('warning_sign', [-17, 0, -3]);
// Garage.
m.prop('machine', [-20, 0, 17.5], P2).prop('workbench', [-14.5, 0, 18.5]).prop('factory_box_long', [-23, 0, 5.5]).prop('crate_large', [-13.5, 0, 14], 0.2);
m.breakable('barrel', [-26.5, 0, 18]).prop('barrel_open', [-26.5, 0, 16.6]);
// Offices.
m.prop('computer_bank', [-11, 0, 19.2]).prop('screen_panel', [-5, 0, 19.2]).prop('cardboard_box', [18, 0, 19]).prop('cardboard_open', [19, 0, 17.6]);
m.prop('desk', [-6, 4, 19], S).prop('office_chair', [-6, 4, 17.6], 0).prop('bookcase', [-11, 4, 19.4], S).prop('computer', [3, 4, 19], S);
m.prop('desk_corner', [10, 4, 19], S).prop('potted_plant', [19, 4, 19.4]).prop('table', [1, 4, 14.5]);
// South block.
m.prop('factory_box', [-20, 0, -14], 0.4).prop('cargo_crate', [-10, 0, -19], 0).prop('container', [-2.5, 0, -19]).prop('crate_bottles', [18.5, 0, -19]);
m.prop('desk', [11, 4, -19], 0).prop('bunk_bed', [19, 4, -14.5], 0).prop('tv_cabinet', [14, 4, -19.3], 0);
m.prop('crate_large', [-6, 4, -14], 0.6).prop('crate_small', [2, 4, -18]);
// Dock.
m.prop('conveyor', [25, 0, 3.5], P2).prop('factory_box', [25.5, 0, 9.5]).prop('cardboard_box', [21.5, 0, 13]).prop('skip', [26, 0, -2.5]);
// Pump room and tunnels.
m.prop('hopper', [2.4, -4, 2.4]).prop('pipe_valve', [-2.6, -4, 2.8]).prop('lever', [2.5, -4, -2.6]);
m.prop('pipe_valve', [-17, -4, -18.6]).prop('pipe_glass', [11.6, -4, -18.6]).prop('crate_small', [-25.5, -4, -10]);

// ---------------------------------------------------------------- map settings

m.bounds('invisible', 2);
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(6);
m.meta({
  description:
    'A walled yard between brick buildings. The north block is two storeys of offices with windows over the yard; a railed walkway crosses to the south block upstairs, carrying the heavy armour. The garage roof holds the sniper rifle, the vent housing in the middle of the yard drops into the pump room and the rockets, and service tunnels loop from the garage under the south block to the loading dock. An homage in spirit to a classic compact deathmatch yard.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 12],
});
await m.save();
