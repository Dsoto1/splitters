/**
 * Training Range: the permanent gunplay test arena (docs/GUNPLAY_DIRECTION.md
 * "Gunplay test arena", GUNPLAY_SPEC.md §44; layout in docs/GUNPLAY_AUDIT.md).
 * A long open firing range for tuning (and learning) bullet travel, drop,
 * lead, recoil, penetration and the seven benchmark weapons side by side.
 *
 *   x →  0 m firing line · 5 · 10 · 25 · 50 · 100 · 200 m
 *
 *   z +38  elevated boards on concrete towers at 25, 50, 100 and 150 m (shooting up)
 *   z +31  approaching / receding boards: 15 ↔ 75 m at running pace, 100 ↔ 180 m sprinting
 *   z +22  lateral boards at sprinting pace (7.8 m/s) at 25, 50, 100 and 200 m
 *   z +12  lateral boards at walking pace (3.9 m/s, aiming) at 25, 50 and 100 m
 *   z   0  long ballistic lane: static boards at 5, 10, 25, 50, 100 and 200 m, a sign over each
 *   z  -8…-31  penetration walls at 15 m (glass, drywall, planks, heavy wood, sheet metal,
 *              steel plate, brick, concrete, dirt, water tank), a board behind each
 *   z -38  recoil wall (concrete, 8 m) at 20 m, destructibles row at 28-44 m
 *   z -48…-64  medium combat lane, 0-70 m: walled, cover every 15 m, harmless range
 *              troopers patrolling it (moving bots that strafe and take cover)
 *   x -36…-20  close duel room behind the firing line (Large Room, four columns, low cover)
 *
 * Boards are breakable blocks with lots of health that come back a few
 * seconds after they break. Every benchmark gun lies at the firing line. In
 * deathmatch, lobby bots make live targets too. Only kit tiles, library
 * materials, existing props, destructibles, movers and encounters are used.
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('training_range', 'Training Range');
m.theme('prototype');
// The deck: 8 m cells from behind the firing line (x -44) out past 200 m (x 212), z -68 to +44.
m.fill('platform', -5, -8, -5, 5);
m.fill('platform', -2, -8, 26, 5);
m.fill('platform', -4, -8, -3, -2);
m.fill('platform', -4, 1, -3, 5);
// Close duel room: a 16 × 16 m Large Room (four columns) with a wide door onto the firing line and one at the back.
m.tile('room_large', -4, -1);
m.edge(-3, -1, 0, 'E', 'wide').edge(-3, 0, 0, 'E', 'door').edge(-4, 0, 0, 'W', 'door');
m.bounds('fence', 2);

const P = Math.PI / 2;
const sign = (at: [number, number, number], text: string, color = '#ffd36b', w = 2.4) => m.light(at, { fixture: 'sign', text, size: [w, 0.8], yaw: -P, color, range: 10 });
const board = (id: string, at: [number, number, number], o: { material?: string; width?: number; height?: number } = {}) =>
  m.block(at, [0.2, o.height ?? 1.9, o.width ?? 1.2], 'breakable', { id, material: o.material ?? 'crate_wood', health: 600, respawn: 4 });

// ---------------------------------------------------------------- long ballistic lane (z 0): static boards and distance markers
for (const d of [5, 10, 25, 50, 100, 200]) {
  board(`static_${d}`, [d, 0, 0]);
  sign([d, 3.2, 0], `${d} m`);
  // Floor markers across the whole range, so every lane reads its distance.
  for (const [z, half] of [[-21, 's'], [21, 'n']] as const) m.block([d, 0, z], [0.3, 0.1, 42], 'solid', { material: 'hazard', id: `mark_${d}_${half}` });
}

// ---------------------------------------------------------------- lateral movers: walking (z +12) and sprinting (z +22)
const lateral = (id: string, d: number, z: number, speed: number, label: string, color: string) => {
  board(`${id}_board`, [d, 0, z - 4]);
  m.mover(id, [d, 0, z - 4], [`${id}_board`], [[0, 0, 0], [0, 0, 8]], { mode: 'pingpong', speed, wait: 0.4, name: `${label} ${d} m` });
  sign([d, 3.2, z], `${d} m ${label}`, color, 3.6);
};
for (const d of [25, 50, 100]) lateral(`walk_${d}`, d, 12, 3.9, 'walking', '#7ad6ff');
for (const d of [25, 50, 100, 200]) lateral(`sprint_${d}`, d, 22, 7.8, 'sprinting', '#ff9a5a');

// ---------------------------------------------------------------- approaching / receding (z +31)
board('approach_near_board', [15, 0, 31], { width: 1.4 });
m.mover('approach_near', [15, 0, 31], ['approach_near_board'], [[0, 0, 0], [60, 0, 0]], { mode: 'pingpong', speed: 5.2, wait: 1, name: 'Approach 15-75 m' });
board('approach_far_board', [100, 0, 31], { width: 1.4 });
m.mover('approach_far', [100, 0, 31], ['approach_far_board'], [[0, 0, 0], [80, 0, 0]], { mode: 'pingpong', speed: 7.8, wait: 1, name: 'Approach 100-180 m' });
sign([8, 3.2, 31], 'approach / recede', '#b9f27a', 4);

// ---------------------------------------------------------------- elevated boards on towers (z +38)
for (const [d, h] of [[25, 3], [50, 6], [100, 10], [150, 14]] as const) {
  m.block([d, 0, 38], [2, h, 2], 'solid', { material: 'pbr_concrete', id: `tower_${d}` });
  board(`high_${d}`, [d, h, 38]);
  sign([d, h + 3.2, 38], `${d} m, ${h} m up`, '#d8b4ff', 3.6);
}

// ---------------------------------------------------------------- penetration walls (spec §8) at 15 m, a board behind each
const panels: [string, string, number][] = [
  ['glass', 'pbr_glass_facade', 0.2],
  ['drywall', 'pbr_plaster_white', 0.2],
  ['planks', 'oak_planks', 0.2],
  ['heavy wood', 'dark_wood', 0.4],
  ['sheet metal', 'pbr_corrugated', 0.2],
  ['steel plate', 'steel_plate', 0.2],
  ['brick', 'red_brick', 0.25],
  ['concrete', 'concrete', 0.4],
  ['dirt', 'pbr_sand', 0.6],
];
const panelZ = (i: number) => -8 - i * 2.6;
panels.forEach(([label, material, thick], i) => {
  const z = panelZ(i);
  m.block([15, 0, z], [thick, 2.2, 2], 'solid', { material, id: `panel_${i}` });
  board(`behind_${i}`, [17.5, 0, z], { width: 1.4 });
  sign([15, 2.9, z], label, '#fff1d6', 2);
});
// Water: a metre-deep tank between two glass panes (a pistol round dies in it; a rifle round comes out weaker).
{
  const z = panelZ(panels.length);
  m.block([14.4, 0, z], [0.2, 2.2, 2], 'solid', { material: 'pbr_glass_facade', id: 'tank_front' });
  m.water([15.1, 0, z], [1, 2.1, 2], 'water');
  m.block([15.8, 0, z], [0.2, 2.2, 2], 'solid', { material: 'pbr_glass_facade', id: 'tank_back' });
  board(`behind_${panels.length}`, [17.5, 0, z], { width: 1.4 });
  sign([15, 2.9, z], 'water', '#7ad6ff', 2);
}

// ---------------------------------------------------------------- recoil wall and destructibles (z -38)
// A big concrete slab where every spray leaves its pattern in bullet holes.
m.block([20, 0, -38], [0.4, 5, 8], 'solid', { material: 'concrete', id: 'recoil_wall' });
sign([20, 5.6, -38], 'recoil wall', '#ff8a3d', 3.6);
(['crate', 'barrel', 'glass', 'boards', 'wall', 'gas', 'generator'] as const).forEach((kind, i) => m.breakable(kind, [28 + i * 2.6, 0, -38], -P));
sign([35, 3.2, -38], 'destructibles', '#ff8a3d', 3.6);

// ---------------------------------------------------------------- medium combat lane (z -48 to -64, 0-70 m)
// Walls along both sides (open at the firing-line end) and across the far end.
for (const [z, side] of [[-46, 'n'], [-65, 's']] as const) {
  m.block([17.5, 0, z], [35, 3, 0.4], 'solid', { material: 'pbr_bunker_panels', id: `lane_wall_${side}1` });
  m.block([52.5, 0, z], [35, 3, 0.4], 'solid', { material: 'pbr_bunker_panels', id: `lane_wall_${side}2` });
}
m.block([70, 0, -55.5], [0.4, 3, 19], 'solid', { material: 'pbr_bunker_panels', id: 'lane_wall_e' });
// Cover every 15 m, alternating sides: sandbags, a concrete block, crates, barriers.
m.prop('sandbag_wall', [15, 0, -51], 0).prop('sandbag_wall', [15, 0, -60], 0);
m.block([30, 0, -55.5], [1, 1.2, 3], 'solid', { material: 'concrete', id: 'lane_cover_30' });
m.prop('crate_large', [45, 0, -51]).prop('cargo_crate', [45, 0, -60], P);
m.prop('jersey_barrier', [60, 0, -53], P).prop('jersey_barrier', [60, 0, -59], P);
for (const d of [15, 30, 45, 60]) sign([d, 3.6, -48], `${d} m`, '#ffd36b', 1.6);
// Moving bots: range troopers patrol the lane between 42 m and 14 m, strafing and using the cover (they wake when someone
// is within 70 m: anywhere near the south end of the firing line). Their rounds do no damage.
m.factions([{ id: 'range_bots', name: 'Range Bots', color: '#ffb000', relations: {} }]);
m.light([14, 0.2, -56], { fixture: 'none', id: 'lane_patrol_point', intensity: 0.2, range: 4 });
m.add({
  kind: 'encounter',
  id: 'enc_lane',
  name: 'Range troopers',
  position: [42, 0, -56],
  yaw: -P,
  faction: 'range_bots',
  roster: { trooper: 2, gunner: 1, heavy: 0 },
  activeCap: 3,
  reinforcements: 500,
  perPlayer: 0,
  respawnSeconds: 4,
  radius: 3,
  order: 'patrol',
  orderTarget: 'lane_patrol_point',
  startActive: true,
  difficulty: 'easy',
  damage: 0,
});

// ---------------------------------------------------------------- close duel room (x -36 to -20)
m.prop('sandbag_wall_low', [-28, 0, -4], P).prop('barrier', [-24, 0, 1]).prop('barrier', [-32, 0, -8]);
sign([-19.5, 3.4, -6], 'duel room', '#ff6a6a', 2.4);
m.pickup('weapon_shotgun', [-28, 0, -10], 10).pickup('weapon_revolver', [-28, 0, 2], 10).pickup('health_small', [-34, 0, -4]);

// ---------------------------------------------------------------- firing line: the benchmark guns and plenty of ammunition
const guns = ['weapon_revolver', 'weapon_smg', 'weapon_rifle', 'weapon_shotgun', 'weapon_sniper', 'weapon_rockets', 'weapon_marksman', 'weapon_burst_rifle', 'weapon_lmg'];
guns.forEach((g, i) => m.pickup(g, [-2, 0, -16 + i * 4], 5));
for (const z of [-16, -8, 0, 8, 16]) m.pickup('ammo', [-5, 0, z], 5);
m.pickup('ammo_explosive', [-5, 0, 24], 5).pickup('ammo_sniper', [-5, 0, -24], 5).pickup('ammo', [-4, 0, -52], 5);
m.pickup('armor_large', [-6, 0, 28], 10);
m.pickup('health_large', [-6, 0, -28], 10).pickup('health_small', [100, 0, -4]).pickup('health_small', [100, 0, 4]);

// Spawns along the firing line, facing downrange; two at the far end so bots spread out.
for (const z of [-18, -10, -2, 6, 14, 20]) m.spawn([-8, 0, z], P);
m.spawn([190, 0, -16], -P).spawn([190, 0, 8], -P);

m.light([-4, 6, 0], { fixture: 'none', intensity: 1.2, range: 30 });
m.light([-28, 3.5, -4], { fixture: 'none', intensity: 1, range: 14 });
m.meta({
  description:
    'The gunplay test arena: static boards and distance markers at 5 to 200 m, walking and sprinting boards to learn lead, approaching and elevated targets, penetration walls from glass to concrete, dirt and water, a recoil wall, destructibles, a medium combat lane with patrolling range troopers, and a close duel room. Every benchmark gun waits at the firing line.',
  modes: ['core.deathmatch'],
  players: [1, 8],
});
await m.save();
