/**
 * Training Range (docs/GUNPLAY_SPEC.md §44): a long, open firing range for
 * learning (and tuning) bullet travel, drop, lead, recoil and penetration.
 *
 *   x →  0 m firing line · 10 · 25 · 50 · 100 · 200 m
 *
 *   north lane (z +12): moving targets carried side to side at 25, 50 and 100 m (lead)
 *   middle lane (z 0):  static boards at 10, 25, 50, 100 and 200 m, each with a marker sign (drop)
 *   south lane (z -12): penetration panels at 15 m (glass, drywall, planks, sheet metal, brick,
 *                       concrete), each with a board behind it, and a concrete recoil wall at 20 m
 *
 * Boards are breakable blocks with lots of health that come back a few
 * seconds after they break. Every gun of the gunplay benchmark lies at the
 * firing line. Bots make live targets in deathmatch.
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('training_range', 'Training Range');
m.theme('prototype');
// The deck: 8 m cells from the firing line (x 0) out past 200 m, 56 m wide.
m.fill('platform', -1, -3, 26, 3);
m.bounds('fence', 2);

const P = Math.PI / 2;
const board = (id: string, at: [number, number, number], o: { material?: string; width?: number; height?: number } = {}) =>
  m.block(at, [0.2, o.height ?? 1.9, o.width ?? 1.2], 'breakable', { id, material: o.material ?? 'crate_wood', health: 600, respawn: 4 });

// Middle lane: static boards at marked distances, with a sign over each (drop and travel time).
for (const d of [10, 25, 50, 100, 200]) {
  board(`static_${d}`, [d, 0, 0]);
  m.light([d, 3.2, 0], { fixture: 'sign', text: `${d} m`, size: [2.4, 0.8], yaw: -P, color: '#ffd36b', range: 10 });
}

// North lane: boards on movers, sliding side to side at running pace (lead).
for (const d of [25, 50, 100]) {
  board(`mover_${d}_board`, [d, 0, 8]);
  m.mover(`mover_${d}`, [d, 0, 8], [`mover_${d}_board`], [[0, 0, 0], [0, 0, 8]], { mode: 'pingpong', speed: 5, wait: 0.4, name: `Runner ${d} m` });
  m.light([d, 3.2, 12], { fixture: 'sign', text: `${d} m moving`, size: [3.6, 0.8], yaw: -P, color: '#7ad6ff', range: 10 });
}

// South lane: penetration panels (spec §8), each with a board behind it to show what gets through.
const panels: [string, string, number][] = [
  ['glass', 'pbr_glass_facade', 0.2],
  ['drywall', 'pbr_plaster_white', 0.2],
  ['planks', 'oak_planks', 0.2],
  ['sheet metal', 'pbr_corrugated', 0.2],
  ['brick', 'red_brick', 0.25],
  ['concrete', 'concrete', 0.4],
];
panels.forEach(([label, material, thick], i) => {
  const z = -6 - i * 2.4;
  m.block([15, 0, z], [thick, 2.2, 2], 'solid', { material, id: `panel_${i}` });
  board(`behind_${i}`, [17.5, 0, z], { width: 1.4 });
  m.light([15, 2.9, z], { fixture: 'sign', text: label, size: [2, 0.6], yaw: -P, color: '#fff1d6', range: 6 });
});
// Recoil wall: a big concrete slab where every spray leaves its pattern in bullet holes.
m.block([22, 0, -21], [0.4, 5, 8], 'solid', { material: 'concrete', id: 'recoil_wall' });
m.light([22, 5.6, -21], { fixture: 'sign', text: 'recoil wall', size: [3.6, 0.8], yaw: -P, color: '#ff8a3d', range: 10 });

// Firing line: the benchmark guns and plenty of ammunition.
const guns = ['weapon_revolver', 'weapon_smg', 'weapon_rifle', 'weapon_sniper', 'weapon_marksman', 'weapon_burst_rifle', 'weapon_shotgun', 'weapon_lmg'];
guns.forEach((g, i) => m.pickup(g, [-2, 0, -14 + i * 4], 5));
for (const z of [-16, -8, 0, 8, 16]) m.pickup('ammo', [-5, 0, z], 5);
m.pickup('armor_large', [-6, 0, 20], 10);
m.pickup('health_large', [-6, 0, -20], 10).pickup('health_small', [100, 0, -4]).pickup('health_small', [100, 0, 4]);

// Spawns along the firing line, facing downrange; two at the far end so bots spread out.
for (const z of [-18, -10, -2, 6, 14, 20]) m.spawn([-6, 0, z], P);
m.spawn([190, 0, -16], -P).spawn([190, 0, 16], -P);

m.light([-4, 6, 0], { fixture: 'none', intensity: 1.2, range: 30 });
m.meta({
  description: 'A long open firing range: static boards at 10, 25, 50, 100 and 200 m to learn drop and travel, boards sliding side to side to learn lead, penetration panels from glass to concrete, and a recoil wall that keeps your spray pattern. Every benchmark gun waits at the firing line.',
  modes: ['core.deathmatch'],
  players: [1, 8],
});
await m.save();
