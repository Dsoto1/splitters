/**
 * Silo Complex: one great two-storey silo floor full of pillars, ringed a
 * storey up by a catwalk, inside a loop of concrete rooms and corridors that
 * open into it from all four sides (an homage in spirit to GoldenEye's
 * Complex). Two open staircases climb from the floor to landings on the
 * catwalk; stairwells behind the landings lead down to the outer loop.
 *
 *   ground (z0)                              upper (z1)
 *     x:  0  1  2  3  4  5                     x: 1  2  3  4
 *   y6             W                        y6        W
 *   y5    r──c──T──T──c──r                  y5     u  u
 *   y4    c  #  #  #  #  c                  y4  ┌──━━━L──┐
 *   y3    l  #  ░  ↑  #  ┤                  y3  ┃  .  /  ┃
 *   y2    ├  #  ↓  ░  #  s                  y2  ┃  /  .  ┃
 *   y1    c  #  #  #  #  c                  y1  └──L━━━──┘
 *   y0    r──c──T──T──c──r                  y0     u  u
 *   y-1         W
 *
 *   #  silo floor (4 × 4, two storeys, pillars under the catwalk); ░ pillar rooms
 *   ↑↓ open stairs up to the landings L; ┌━┐ catwalk ring of bridges and corner platforms
 *   doorways into the silo: west at y2, east at y3, south at x3, north at x2
 *   W  stairwells up to the control rooms u over the loop, which open onto the landings
 *   r/l/s  rooms (l with a ledge, s the laser lab); c corridors; T/├/┤ junctions
 */
import type { Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('silo_complex', 'Silo Complex');
m.theme('bunker');
const P = Math.PI / 2;
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): [number, number, number] => [x * 8 + dx, z * 4 + up, y * 8 + dy];

// ---------------------------------------------------------------- silo floor

const S = { x0: 1, x1: 4, y0: 1, y1: 4 };
// Outer ring: columned corners, a pillar under each catwalk span, low cover under the landings.
for (const [x, y] of [[1, 1], [4, 1], [4, 4], [1, 4]] as const) m.tile('room_columns', x, y);
for (const [x, y] of [[3, 1], [4, 2], [4, 3], [2, 4], [1, 2], [1, 3]] as const) m.tile('room_pillar', x, y);
m.tile('room_cover', 2, 1).tile('room_cover', 3, 4, 0, 2);
// Middle: two big pillar rooms and two open staircases, turned about each other.
m.tile('room_pillar', 2, 3).tile('room_pillar', 3, 2);
m.tile('stairs_open', 2, 2, 0, 1).tile('stairs_open', 3, 3, 0, 3);

// Catwalk ring a storey up: railed corner platforms, bridges and two landings at the stair tops.
// (Railed platforms at the corners: the narrow Catwalk Corner piece leaves no room for bots to path round it.)
for (const [x, y] of [[1, 1], [4, 1], [4, 4], [1, 4]] as const) m.tile('platform_rail', x, y, 1);
m.tile('platform_rail', 2, 1, 1).tile('bridge', 3, 1, 1, 1);
m.tile('bridge', 4, 2, 1).tile('bridge', 4, 3, 1);
m.tile('platform_rail', 3, 4, 1).tile('bridge', 2, 4, 1, 1);
m.tile('bridge', 1, 3, 1).tile('bridge', 1, 2, 1);

// ---------------------------------------------------------------- the loop

m.tile('room_cover', 0, 0).tile('corridor', 1, 0, 0, 1).tile('junction_t', 2, 0, 0, 2).tile('junction_t', 3, 0, 0, 0).tile('corridor', 4, 0, 0, 1).tile('room', 5, 0);
m.tile('corridor', 5, 1).tile('room', 5, 2).tile('junction_t', 5, 3, 0, 3).tile('corridor', 5, 4).tile('room_columns', 5, 5);
m.tile('corridor', 4, 5, 0, 1).tile('junction_t', 3, 5, 0, 0).tile('junction_t', 2, 5, 0, 2).tile('corridor', 1, 5, 0, 1).tile('room', 0, 5);
m.tile('corridor', 0, 4).tile('room_ledge', 0, 3, 0, 1).tile('junction_t', 0, 2, 0, 1).tile('corridor', 0, 1);
// Stairwells off the loop up to the control rooms, which open onto the landings.
m.tile('stairwell', 2, -1, 0, 1).tile('stairwell', 3, 6, 0, 3);
m.tile('room', 2, 0, 1).tile('room', 3, 0, 1).tile('room', 3, 5, 1).tile('room', 2, 5, 1);

// ---------------------------------------------------------------- walls

// One open floor inside the silo.
for (let x = S.x0; x <= S.x1; x++) for (let y = S.y0; y <= S.y1; y++) {
  if (x < S.x1) m.edge(x, y, 0, 'E', 'open');
  if (y < S.y1) m.edge(x, y, 0, 'N', 'open');
}
// Two-storey walls round it, except the four doorways and the one-storey walls under the landings' doors.
const keep: Record<string, 'auto' | 'wall'> = { '1,2:W': 'auto', '4,3:E': 'auto', '3,1:S': 'auto', '2,4:N': 'auto', '2,1:S': 'wall', '3,4:N': 'wall' };
for (let x = S.x0; x <= S.x1; x++) for (let y = S.y0; y <= S.y1; y++) {
  const sides: Side[] = [];
  if (x === S.x0) sides.push('W');
  if (x === S.x1) sides.push('E');
  if (y === S.y0) sides.push('S');
  if (y === S.y1) sides.push('N');
  for (const s of sides) {
    const k = keep[`${x},${y}:${s}`];
    if (k !== 'auto') m.edge(x, y, 0, s, k ?? 'high');
  }
}
m.edge(1, 2, 0, 'W', 'wide').edge(4, 3, 0, 'E', 'wide');
// Control rooms: open to each other, windows over the silo and out over the loop.
m.edge(2, 0, 1, 'E', 'open').edge(3, 0, 1, 'N', 'windows').edge(3, 0, 1, 'E', 'window').edge(2, 0, 1, 'W', 'window');
m.edge(3, 5, 1, 'W', 'open').edge(2, 5, 1, 'S', 'windows').edge(2, 5, 1, 'W', 'window').edge(3, 5, 1, 'E', 'window');
// Glimpses into the silo from the loop.
m.edge(0, 3, 0, 'E', 'slit').edge(5, 2, 0, 'W', 'slit');

// ---------------------------------------------------------------- props

// Silo floor: tall tanks and barriers in the corners, crates by the pillars, a machine bay.
m.prop('container_tall', at(1, 1, 0, -2.6, -2.6)).prop('container_tall', at(4, 4, 0, 2.6, 2.6));
m.prop('barrier_high', at(4, 1, 0, 2.4, -2.4)).prop('barrier_high', at(1, 4, 0, -2.4, 2.4));
m.prop('factory_box', at(3, 1, 0, 2.5, 1.5), 0.3).prop('factory_box', at(2, 4, 0, -2.5, -1.5), 0.3);
m.prop('machine', at(4, 2, 0, 2.5, -1), P).prop('machine_window', at(1, 3, 0, -2.6, 1), -P);
m.prop('piston', at(1, 2, 0, 2, -2.5)).prop('piston', at(4, 3, 0, -2, 2.5));
m.prop('cargo_crate', at(2, 3, 0, -2.6, 2), 0).prop('cargo_crate', at(3, 2, 0, 2.6, -2), 0);
m.breakable('gas', at(2, 1, 0, 3.2, -3.2)).breakable('gas', at(3, 4, 0, -3.2, 3.2)).breakable('barrel', at(1, 1, 0, 1, -3)).breakable('barrel', at(4, 4, 0, -1, 3));
// Loop: crates, drums and the odd terminal.
m.prop('crate_large', at(0, 0, 0, -2.6, -2.6)).prop('crate_small', at(0, 0, 0, -2.6, -1)).prop('computer', at(5, 0, 0, 3, -3), Math.PI);
m.prop('desk', at(5, 0, 0, 2.6, 1), -P).prop('office_chair', at(5, 0, 0, 1.4, 1), P);
m.prop('barrel', at(1, 0, 0, 1, 3)).prop('barrel_open', at(1, 0, 0, 2, 3.1)).prop('cardboard_box', at(4, 0, 0, -2, 3.2));
m.prop('bunk_bed', at(5, 5, 0, 1.2, 3), 0).prop('kitchen_cabinet', at(0, 5, 0, -3.2, 2), P).prop('kitchen_cabinet', at(0, 5, 0, -3.2, 0.5), P);
m.prop('skip', at(0, 1, 0, 2.6, 0)).prop('container', at(5, 4, 0, -2.8, 0)).prop('warning_sign', at(4, 5, 0, 0, -3.2));
m.prop('computer_bank', at(5, 2, 0, 2.2, 2.6), Math.PI).prop('screen_panel', at(5, 2, 0, 2.8, -2.6), -P);
m.breakable('crate', at(1, 5, 0, -2, -3)).breakable('gas', at(5, 1, 0, 3.2, 2));
// Control rooms.
m.prop('computer_bank', at(3, 0, 1, 1, -2.2)).prop('computer_wide', at(3, 5, 1, -1, 2.4), Math.PI);
m.prop('holo_table', at(2, 0, 1, -2, -2)).prop('screen_panel', at(2, 5, 1, -2.4, 2.4), Math.PI);

// ---------------------------------------------------------------- spawns and pickups

for (const [x, y, z, dx, dy, yaw] of [
  [0, 0, 0, 1, 1, P / 2], [5, 0, 0, -1, -1, -P / 2], [5, 5, 0, -1, -1, -P * 1.5], [0, 5, 0, 1, -1, P * 1.5],
  [1, 0, 0, 0, -1.5, P], [5, 2, 0, -2, 0, -P], [4, 5, 0, 0, 1.5, -P], [0, 3, 0, -1.5, 0, 0],
  [3, 0, 1, 0, 1, 0], [2, 5, 1, 0, -1, Math.PI], [1, 1, 0, 1.5, 1.5, P / 2], [4, 4, 0, -1.5, -1.5, -P * 1.5],
] as const) m.spawn(at(x, y, z, dx, dy), yaw);

// Power: the railgun on the north landing, heavy armour on the south one, the auto shotgun in the middle of the floor.
m.pickup('weapon_railgun', at(3, 4, 1)).pickup('armor_large', at(2, 1, 1)).pickup('weapon_auto_shotgun', [20, 0, 20]);
m.pickup('weapon_laser_rifle', at(5, 2, 0, 2, 0)).pickup('weapon_burst_rifle', at(0, 0, 0, 1.5, -1)).pickup('weapon_smg', at(5, 0, 0, 0, -1.5));
m.pickup('weapon_sawed_off', at(0, 5, 0, 1, 1)).pickup('weapon_marksman', at(3, 0, 1, 2, 1)).pickup('weapon_hand_cannon', at(2, 5, 1, 1, -1));
m.pickup('armor_small', at(0, 3, 0, 2.4, 2.5, 1.5)).pickup('health_large', at(4, 0, 0, 0, -1)).pickup('health_small', at(5, 5, 0, -1.5, 1));
m.pickup('health_small', at(1, 4, 0, 1, -1)).pickup('health_small', at(4, 1, 0, -1, 1)).pickup('ammo_sniper', at(3, 5, 1, 1, 1));
m.pickup('ammo_rifle', at(3, 0, 0)).pickup('ammo_shells', at(2, 5, 0)).pickup('ammo_cells', at(5, 3, 0)).pickup('ammo_light', at(0, 2, 0));
m.pickup('grenades', at(1, 5, 0)).pickup('mines', at(5, 1, 0)).pickup('ammo', at(0, 4, 0));

// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(6);
m.lightRooms();
m.meta({
  description:
    'A buried silo complex in the spirit of GoldenEye\'s Complex: one vast two-storey floor of pillars and crates, a catwalk ring a storey up, and a loop of concrete rooms and corridors with doorways in from all four sides. Open stairs climb to the catwalk landings; the railgun sits on the north landing, heavy armour on the south, and the auto shotgun in the dead centre of the floor.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 12],
});
await m.save();
