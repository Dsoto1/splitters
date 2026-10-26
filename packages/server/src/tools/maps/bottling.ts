/**
 * Bottling Plant: a sealed works of tiled washrooms, long service corridors,
 * a two-storey server lab and the great tank hall, crossed by walkways at the
 * level of the tank tops (an homage in spirit to GoldenEye's Facility).
 * Drop out of the ceiling vent into the stalls, or fight over the railgun on
 * the walkway junction above the tanks.
 *
 *   ground (z0), x → 0..8                     upper (z1)
 *   y6                  ┌───c───T───c───┐
 *   y5                  c       S       c       (S climbs south onto the walkway)
 *   y4      ┌───c───c───T   H   H   H   c                       B
 *   y3  Wsh─X  [ATRIUM]═X───H   H   H───R       v───v  [ATR]─w──B━━━P━━━B──U
 *   y2  Stl c  [ATRIUM] c   H   H   H   c       D      [ATR]
 *   y1      └───c───c───T───c───T───c───┘
 *       x0  1   2   3   4   5   6   7   8
 *
 *   Stl/Wsh  washroom block (white tiles); D  vent drop above the stalls, v vent
 *   ATRIUM   two-storey server lab with a balcony all round
 *   H        tank hall, 3 × 3, two storeys; walkways B/P above it (P = junction)
 *   w        windowed upper corridor lab ↔ walkways; U control room over R
 */
import type { Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('bottling', 'Bottling Plant');
m.theme('factory');
// The original sat in a mountain dam: grey peaks under an overcast sky.
m.backdrop('overcast', 'mountains', 'gravel', 0.55);
const P = Math.PI / 2;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces }] });
}

// ---------------------------------------------------------------- ground floor

// Washroom block: stalls (south) and the washroom with the sinks (north).
m.tile('room', 0, 2).tile('room', 0, 3);
// West corridor and the loop round the lab.
m.tile('corner', 1, 1, 0, 0).tile('corridor', 1, 2).tile('junction_x', 1, 3).tile('corner', 1, 4, 0, 1);
m.tile('corridor', 2, 1, 0, 1).tile('corridor', 3, 1, 0, 1).tile('corridor', 2, 4, 0, 1).tile('corridor', 3, 4, 0, 1);
m.tile('junction_t', 4, 1, 0, 0).tile('corridor', 4, 2).tile('junction_x', 4, 3).tile('junction_t', 4, 4, 0, 3);
// Server lab: a two-storey atrium.
m.tile('atrium', 2, 2);
// South service corridor to the hall's south door and round to the east.
m.tile('corridor', 5, 1, 0, 1).tile('junction_t', 6, 1, 0, 0).tile('corridor_long', 7, 1, 0, 1);
m.tile('corridor', 8, 2).tile('room', 8, 3).tile('corridor', 8, 4).tile('corridor', 8, 5);
m.tile('corner', 8, 6, 0, 2).tile('corridor', 7, 6, 0, 1).tile('junction_t', 6, 6, 0, 2).tile('corridor', 5, 6, 0, 1).tile('corner', 4, 6, 0, 1).tile('corridor', 4, 5);
// Tank hall: nine open cells, two storeys high.
m.fill('room', 5, 2, 7, 4);
// Stairs from the north corridor up onto the north walkway.
m.tile('stairs', 6, 5, 0, 1);

// ---------------------------------------------------------------- upper floor

// Ceiling vent from the lab balcony to a drop above the stalls.
m.tile('corridor_clear', 1, 3, 1, 1).tile('corner', 0, 3, 1, 1).tile('drop', 0, 2, 1);
// Windowed corridor from the lab balcony to the walkways.
m.tile('corridor_windows', 4, 3, 1, 1);
// Walkways over the tanks: west, east and north arms round a railed junction.
m.tile('bridge', 5, 3, 1, 1).tile('platform_rail', 6, 3, 1).tile('bridge', 7, 3, 1, 1).tile('bridge', 6, 4, 1);
// Control room above the east room.
m.tile('room', 8, 3, 1);

// ---------------------------------------------------------------- walls

const HALL = { x0: 5, x1: 7, y0: 2, y1: 4 };
// No walls inside the hall.
for (let x = HALL.x0; x <= HALL.x1; x++) for (let y = HALL.y0; y <= HALL.y1; y++) {
  if (x < HALL.x1) m.edge(x, y, 0, 'E', 'open');
  if (y < HALL.y1) m.edge(x, y, 0, 'N', 'open');
}
// Two-storey outer walls, except at the doorways (W, S, E) and under the stairs' top door (N).
const doors = new Set(['5,3:W', '6,2:S', '7,3:E', '6,4:N']);
for (let x = HALL.x0; x <= HALL.x1; x++) for (let y = HALL.y0; y <= HALL.y1; y++) {
  const sides: Side[] = [];
  if (x === HALL.x0) sides.push('W');
  if (x === HALL.x1) sides.push('E');
  if (y === HALL.y0) sides.push('S');
  if (y === HALL.y1) sides.push('N');
  for (const s of sides) if (!doors.has(`${x},${y}:${s}`)) m.edge(x, y, 0, s, 'high');
}
// Lab glass onto the corridors, a wide way in from the east crossing.
m.edge(2, 2, 0, 'S', 'windows').edge(3, 2, 0, 'S', 'window').edge(3, 4, 0, 'S', 'windows').edge(3, 2, 0, 'E', 'window');
m.edge(3, 3, 0, 'E', 'wide');
// Control rooms: a window into the hall from the ground floor, windows out from upstairs.
m.edge(8, 3, 1, 'E', 'windows').edge(8, 3, 1, 'N', 'window').edge(8, 3, 1, 'S', 'window');
m.edge(8, 4, 0, 'W', 'slit');

// Tiled washrooms, white-panelled lab.
const tiles: TileSurfaces = { floor: { material: 'core.white_tiles', tint: null }, walls: { material: 'core.white_tiles', tint: '#d8d8d8' } };
paint(0, 2, 0, tiles);
paint(0, 3, 0, tiles);
paint(2, 2, 0, { floor: { material: 'core.pbr_terrazzo', tint: null }, walls: { material: 'core.pbr_white_panel', tint: null }, underside: { material: 'core.light_strip', tint: null } });
paint(4, 3, 1, { walls: { material: 'core.pbr_white_panel', tint: null } });

// ---------------------------------------------------------------- props

// Stalls: three toilets behind metal partitions along the west wall.
for (const dz of [-2.6, 0, 2.6]) m.prop('toilet', at(0, 2, 0, -3, dz), P);
for (const dz of [-1.3, 1.3]) m.prop('metal_panel', at(0, 2, 0, -2.6, dz), 0, 0.8);
m.prop('trashcan', at(0, 2, 0, 3, -3));
// Washroom: a row of basins (cabinets) and a bath in the corner.
m.prop('kitchen_cabinet', at(0, 3, 0, -3.1, -1.5), P).prop('kitchen_cabinet', at(0, 3, 0, -3.1, 0.5), P);
m.prop('bathtub', at(0, 3, 0, 1.8, 3));
m.prop('bucket', at(0, 3, 0, 3, -3), 0, 1, false);
// Vent: a fan housing and a crate in the duct.
m.prop('pipe_valve', at(0, 3, 1, -2.5, 2.5));
// Lab: server racks round the floor, consoles on the balcony.
m.prop('computer_bank', at(2, 3, 0, -1, 2), 0).prop('computer_bank', at(3, 3, 0, 1.5, 2), 0);
m.prop('holo_table', at(2, 2, 0, 4, 6)).prop('computer_wide', at(2, 2, 0, -1.5, 6.5), Math.PI);
m.prop('desk', at(3, 2, 0, 2, -2.5)).prop('office_chair', at(3, 2, 0, 2, -1.3), Math.PI);
m.prop('screen_panel', at(2, 3, 1, -1, 2.9)).prop('computer', at(3, 3, 1, 3, 1));
breakableGlass();
// Tank hall: four big tanks between the walkways, bottle crates and a conveyor.
for (const [x, y] of [[5, 2], [7, 2], [5, 4], [7, 4]] as const) m.prop('hopper_tall', at(x, y), 0, 1.35);
m.prop('conveyor', at(6, 3, 0, 0, -2.2)).prop('crate_bottles', at(6, 3, 0, 3, 2)).prop('crate_bottles', at(6, 3, 0, 3, 3));
m.prop('crate_bottles', at(5, 3, 0, -1.5, 2.5)).prop('crate_bottles', at(7, 3, 0, 2, -2.6));
m.prop('bottle', at(6, 3, 0, 3, 2.5), 0, 1, false);
m.prop('pipe_glass', at(6, 2, 0, -3, 0)).prop('pipe_glass', at(6, 4, 0, 3, -1));
m.prop('factory_box', at(7, 3, 0, 1, 2.5), 0.2).prop('barrel', at(5, 2, 0, 3.2, -3.2));
m.breakable('gas', at(7, 4, 0, -3.3, -3.3)).breakable('gas', at(5, 3, 0, -3.2, -2.6));
// Corridors: crates and drums along the walls.
m.prop('crate_large', at(2, 1, 0, -2, -2.6)).prop('crate_small', at(3, 1, 0, 2, -3));
m.prop('barrel', at(5, 1, 0, 0, 3)).prop('dungeon_barrel', at(5, 1, 0, 1.2, 3));
m.prop('cardboard_box', at(7, 1, 0, -2, 3.2)).prop('cardboard_open', at(7, 1, 0, -2.5, 2.6), 0, 1, false);
m.prop('factory_box_long', at(8, 5, 0, 2.6, 0), P).prop('warning_sign', at(4, 5, 0, -2.8, 0));
m.prop('cargo_crate', at(5, 6, 0, 0, 2.6), P).prop('container', at(7, 6, 0, -2, -3));
m.breakable('barrel', at(8, 2, 0, -2.8, 2)).breakable('crate', at(1, 2, 0, 2.6, 0));
// Control room: levers and screens; upstairs the overseer's desk.
m.prop('lever', at(8, 3, 0, 3, 3)).prop('screen_panel', at(8, 3, 0, 3, -2.5), -P);
m.prop('computer_wide', at(8, 3, 1, 2.5, 0), -P).prop('office_chair', at(8, 3, 1, 1, 0), P);

function breakableGlass(): void {
  // Panes in the lab's south windows.
  m.breakable('glass', [14.25, 0, 12]).breakable('glass', [17.75, 0, 12]).breakable('glass', [24, 0, 12]);
}

// ---------------------------------------------------------------- spawns and pickups

for (const [x, y, z, dx, dy, yaw] of [
  [0, 2, 0, 1.5, -1.5, P], [0, 3, 0, 1, 1, P], [1, 3, 1, 1, 0, -P], [2, 3, 0, -2, 1, P],
  [3, 2, 1, 2.5, 2, -P], [2, 1, 0, 0, -1, P], [3, 4, 0, 0, 0, -P], [4, 6, 0, 0, 0, P],
  [8, 5, 0, 0, 2, Math.PI], [8, 1, 0, 0, 0, 0], [5, 3, 0, 2, -2.5, P], [8, 3, 1, 1.5, -2.5, -P], [6, 1, 0, 0, -1.5, 0],
] as const) m.spawn(at(x, y, z, dx, dy), yaw);

// Power: the railgun on the walkway junction over the tanks; the gilded pistol in the stalls under the vent.
m.pickup('weapon_railgun', at(6, 3, 1)).pickup('weapon_gilded_pistol', at(0, 2, 0, 0.5, -1));
m.pickup('weapon_auto_shotgun', at(6, 3, 0, -1, 1)).pickup('weapon_laser_rifle', at(2, 2, 0, 4, 3));
m.pickup('weapon_burst_rifle', at(3, 1, 0, 0, -1)).pickup('weapon_smg', at(2, 4, 0, 0, -1)).pickup('weapon_shotgun', at(0, 3, 0, 0, -1));
m.pickup('weapon_marksman', at(8, 3, 1, 0, 2)).pickup('weapon_hand_cannon', at(8, 4, 0, 0, 0)).pickup('grenades', at(8, 3, 0, -1, 0));
m.pickup('armor_large', [26.7, 4, 20]).pickup('armor_small', at(7, 2, 0, -3, 3));
m.pickup('health_large', at(5, 6, 0, -1, -1)).pickup('health_small', at(0, 3, 1, 0, 0)).pickup('health_small', at(8, 1, 0, -1, 0)).pickup('health_small', at(1, 1, 0));
m.pickup('ammo_rifle', at(4, 1, 0)).pickup('ammo_shells', at(7, 1, 0, 3, 0)).pickup('ammo_sniper', at(6, 4, 1, 0, 1)).pickup('ammo_cells', at(3, 2, 0, -2, 2));
m.pickup('ammo_light', at(1, 2, 0)).pickup('mines', at(7, 4, 0, -1, -2.5)).pickup('ammo', at(4, 4, 0));

// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(5);
m.lightRooms();
// Fittings: a plant in the lab, a bin in the north corridor, propane by the tanks.
m.prop('hm_houseplant_tall', at(2, 2, 0, -3.2, -3.2), 0, 1, false);
m.prop('sv_trashcan_metal', at(4, 5, 0, 2.8, 2.5), -P);
m.prop('sv_propane', at(5, 4, 0, -3.2, 3.2), 0.4).prop('sv_propane', at(7, 2, 0, 3.2, -3.2), 1.1);
m.prop('sv_gas_can', at(5, 2, 0, 2.3, -3.4), 0.3);
m.meta({
  description:
    'A sealed bottling works: tiled washrooms with a ceiling vent you can drop through, long service corridors, a two-storey server lab, and the great tank hall where walkways cross between the tank tops. The railgun waits on the walkway junction; the gilded pistol hides in the stalls below the vent.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 10],
});
await m.save();
