/**
 * Sandfall Colosseum: the demo map for Style Pack 03 Imperial Arena. A Roman
 * arena of sand ringed by tiered seating with the emperor's box on the north
 * side, three gladiator gates (the main one a portcullis worked from a winch,
 * the side ones rising as you come), two lift cages rising from the hypogeum
 * through hatches in the sand and a beast lift the emperor sends up through a
 * trapdoor, spike traps and fire jets on the sand, outer arcades all round
 * (stairs up to the seating's top walkway), a forum with a temple, a
 * triumphal arch and an aqueduct along the west. A portal pair links the
 * hypogeum's west tunnel to the forum; the emperor can seal it for a while.
 *
 * Grid x east, y north (one cell = 8 m); levels: 0 the sand and the streets,
 * 1 the seating and upper arcades, -1 the hypogeum:
 *
 *   y 5  . . . . . . . . . . . . . . .
 *   y 4  A A A A A A A A A . . . . . .       A outer arcade (stairs at the ends)
 *   y 3  A c s s E s s c A . col col . .     s seating, c corner, E emperor's box
 *   y 2  A s . . . . . s A . FORUM temple   . sand
 *   y 1  A G . h B h . G A S FORUM temple   G gate, h lift hatch, B beast hatch, S stair down
 *   y 0  A s . . . . . s A . (forum)
 *   y-1  A c s s G s s c A
 *   y-2  A A A A A A A A A . arch
 *        x-2-1 0 1 2 3 4 5 6 7 8 9 10 11
 */
import type { MapEntity, Rotation, ScenarioLogic } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('sandfall_colosseum', 'Sandfall Colosseum');
m.theme('imperial');
m.backdrop('clear', 'hills', 'dirt', 0.4);
m.teams([8, 8]);
const [reds, blues] = m.teamIds(2) as [string, string];
const C = 8;
const P = Math.PI / 2;
/** A tile-local point (metres from the cell centre, local x and z) in world X, Z for a tile at cell (x, y) turned `r` quarter turns. */
const at = (x: number, y: number, lx: number, lz: number, r: Rotation): [number, number] => {
  let [a, b] = [lx, lz];
  for (let i = 0; i < r; i++) [a, b] = [b, -a];
  return [x * C + a, y * C + b];
};

// ---------------------------------------------------------------- the arena and its seating

const used = new Set<string>();
const mark = (x: number, y: number) => used.add(`${x},${y}`);
const tile = (kind: string, x: number, y: number, r: Rotation = 0, z = 0) => {
  m.tile(kind, x, y, z, r);
  if (z === 0) mark(x, y);
};
// The sand: five by three cells, three of them with hatches over the hypogeum.
for (let x = 0; x <= 4; x++) for (let y = 0; y <= 2; y++) tile(y === 1 && x >= 1 && x <= 3 ? 'imperial.arena_hatch' : 'yard', x, y);
// Seating all round (the sand on each section's local south), gates on three sides, the emperor's box on the north.
for (const x of [0, 1, 3, 4]) tile('imperial.seating', x, 3, 0);
tile('imperial.emperor_box', 2, 3, 0);
for (const x of [0, 1, 3, 4]) tile('imperial.seating', x, -1, 2);
tile('imperial.gate', 2, -1, 2);
for (const y of [0, 2]) tile('imperial.seating', -1, y, 3);
tile('imperial.gate', -1, 1, 3);
for (const y of [0, 2]) tile('imperial.seating', 5, y, 1);
tile('imperial.gate', 5, 1, 1);
tile('imperial.seating_corner', 5, 3, 0);
tile('imperial.seating_corner', -1, 3, 3);
tile('imperial.seating_corner', 5, -1, 1);
tile('imperial.seating_corner', -1, -1, 2);
// The outer arcades (their arches on the outside), with stairs up to the walkway in four bays.
for (let x = -2; x <= 6; x++) {
  if (x === 0) tile('imperial.arcade_stair', x, 4, 0);
  else tile('imperial.arcade', x, 4, 0);
  if (x === 4) tile('imperial.arcade_stair', x, -2, 2);
  else tile('imperial.arcade', x, -2, 2);
}
for (let y = -1; y <= 3; y++) {
  if (y === 0) tile('imperial.arcade_stair', -2, y, 3);
  else tile('imperial.arcade', -2, y, 3);
  if (y === 2) tile('imperial.arcade_stair', 6, y, 1);
  else tile('imperial.arcade', 6, y, 1);
}

// ---------------------------------------------------------------- the hypogeum (level -1)

tile('imperial.hypogeum', 0, 1, 0, -1);
tile('imperial.hypogeum_lift', 1, 1, 0, -1);
tile('imperial.hypogeum_lift', 2, 1, 0, -1);
tile('imperial.hypogeum_lift', 3, 1, 0, -1);
tile('imperial.hypogeum', 4, 1, 0, -1);
tile('imperial.tunnel', -1, 1, 1, -1);
tile('imperial.tunnel', 5, 1, 1, -1);
tile('imperial.tunnel', 6, 1, 1, -1);
// Stairs from the east tunnel up to the arcade (doorways west on both floors).
m.tile('stairwell', 7, 1, -1, 0);
mark(7, 1);

// ---------------------------------------------------------------- the forum, the temple, the arch, the aqueduct

m.tile('imperial.forum', 8, 0, 0, 0);
for (const [x, y] of [[8, 0], [9, 0], [8, 1], [9, 1]] as const) mark(x, y);
for (const x of [8, 9]) tile('imperial.colonnade', x, 2, 2);
m.tile('imperial.temple', 10, 0, 0, 1);
mark(10, 0);
mark(11, 0);
tile('imperial.triumphal_arch', 8, -2, 0);
for (let y = -4; y <= 6; y++) tile('imperial.aqueduct', -4, y, 0);
for (let x = -5; x <= 12; x++) for (let y = -4; y <= 6; y++) if (!used.has(`${x},${y}`)) m.tile('yard', x, y);

// ---------------------------------------------------------------- gates, cages and the beast lift

const door = (id: string, name: string, x: number, z: number, yaw: number, auto: boolean): MapEntity => ({ kind: 'door', id, name, position: [x, 0, z], yaw, style: 'portcullis', startOpen: false, locked: false, auto } as MapEntity);
// The main gate (south): a portcullis wound up from inside its passage or from the sand. The side gates rise as anyone comes.
m.add(door('gate_main', 'Main gate', 16, -4.25, 0, false));
m.add(door('gate_west', 'West gate', -4.25, 8, P, true));
m.add(door('gate_east', 'East gate', 36.25, 8, P, true));
m.add({ kind: 'button', id: 'btn_gate_in', name: 'Gate winch', position: [14.65, 0, -7], yaw: P, label: 'Raise / lower the portcullis', once: false, cooldownSeconds: 2, startEnabled: true });
m.add({ kind: 'button', id: 'btn_gate_sand', name: 'Gate chain', position: [19.2, 0, -3.6], yaw: 0, label: 'Raise / lower the portcullis', once: false, cooldownSeconds: 2, startEnabled: true });

/** A lift cage at (x, z) on the hypogeum floor: a timber floor, iron bars on three sides, a sand hatch for a roof flush with the arena while it is down. */
const cage = (id: string, x: number, z: number) => {
  const ids = [`${id}_floor`, `${id}_bars_w`, `${id}_bars_e`, `${id}_bars_s`, `${id}_hatch`];
  m.block([x, -4.3, z], [3, 0.3, 3], 'solid', { id: ids[0], material: 'pbr_weathered_planks' });
  m.block([x - 1.4, -4.0, z], [0.2, 3.4, 3], 'solid', { id: ids[1], material: 'grate', tint: '#4a4440' });
  m.block([x + 1.4, -4.0, z], [0.2, 3.4, 3], 'solid', { id: ids[2], material: 'grate', tint: '#4a4440' });
  m.block([x, -4.0, z - 1.4], [3, 3.4, 0.2], 'solid', { id: ids[3], material: 'grate', tint: '#4a4440' });
  m.block([x, -0.3, z], [3, 0.3, 3], 'solid', { id: ids[4], material: 'pbr_sand' });
  m.mover(id, [x, -4, z], ids, [[0, 0, 0], [0, 4, 0]], { speed: 1.5, wait: 4, name: 'Lift cage' });
};
cage('cage_west', 8, 8);
cage('cage_east', 24, 8);
// The beast lift: a platform carrying a beast cage, under a trapdoor in the sand, sent up by the emperor.
m.block([16, -4.3, 8], [3, 0.3, 3], 'solid', { id: 'beast_floor', material: 'pbr_weathered_planks' });
m.add({ kind: 'prop', id: 'beast_cage', model: 'prop.im_lift_cage', position: [16, -4.0, 8], yaw: 0, scale: 1, solid: false, tint: null });
m.mover('beast_lift', [16, -4, 8], ['beast_floor'], [[0, 0, 0], [0, 4, 0]], { mode: 'trigger', speed: 1.2, wait: 0, name: 'Beast lift', props: ['beast_cage'] });
m.block([16, -0.3, 8], [3.2, 0.3, 3.2], 'trapdoor', { id: 'beast_trapdoor', material: 'pbr_sand', trigger: 'logic', respawn: null });

// The emperor's box: his throne, and two levers.
m.prop('im_throne', [16, 3.0, 23.6], Math.PI);
m.add({ kind: 'button', id: 'btn_beasts', name: 'Release the beasts', position: [13.6, 3.0, 23.9], yaw: Math.PI, label: 'Release the beasts', once: false, cooldownSeconds: 5, startEnabled: true });
m.add({ kind: 'button', id: 'btn_seal', name: 'Seal the hypogeum', position: [18.4, 3.0, 23.9], yaw: Math.PI, label: 'Seal the hypogeum portal', once: false, cooldownSeconds: 5, startEnabled: true });

// ---------------------------------------------------------------- the portal pair

m.add({ kind: 'portal', id: 'portal_hypogeum', name: 'Hypogeum portal', position: [-11.55, -4, 8], yaw: P, size: [2.4, 3.0], pair: 'forum', startEnabled: true, color: '#3aa8ff' });
m.add({ kind: 'portal', id: 'portal_forum', name: 'Forum portal', position: [60.45, 0, 8], yaw: P, size: [2.4, 3.2], pair: 'forum', startEnabled: true, color: '#ff8a2a' });

// ---------------------------------------------------------------- traps on the sand

for (const [i, [x, z]] of ([[4, 2], [28, 2], [4, 14], [28, 14], [16, 1], [16, 15]] as const).entries()) {
  m.add({ kind: 'trap', id: `spikes_${i + 1}`, trap: 'spikes', position: [x, 0, z], yaw: 0, activation: 'cycle', onSeconds: 2, offSeconds: 4, offsetSeconds: i * 0.75, startEnabled: true, damage: null });
}
m.add({ kind: 'trap', id: 'fire_sw', trap: 'flames', position: [1, 0, -3.7], yaw: 0, activation: 'cycle', onSeconds: 1.5, offSeconds: 5, offsetSeconds: 0, startEnabled: true, damage: null });
m.add({ kind: 'trap', id: 'fire_se', trap: 'flames', position: [31, 0, -3.7], yaw: 0, activation: 'cycle', onSeconds: 1.5, offSeconds: 5, offsetSeconds: 2.5, startEnabled: true, damage: null });

// ---------------------------------------------------------------- logic

type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = []) => ({ id, name, enabled: true, once: false, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    ...['btn_gate_in', 'btn_gate_sand'].map((b) => rule(`rule_${b}`, `${b}: the main gate`, 'button_pressed', b, [act('door_toggle', 'gate_main'), act('sound', null, { state: 'buzzer' })])),
    rule('rule_beasts', 'The emperor releases the beasts', 'button_pressed', 'btn_beasts', [act('message', null, { value: 3, text: 'The emperor releases the beasts!' }), act('sound', null, { state: 'alarm' }), act('block_drop', 'beast_trapdoor'), act('wait', null, { value: 1 }), act('mover_to', 'beast_lift', { value: 2 }), act('wait', null, { value: 12 }), act('mover_to', 'beast_lift', { value: 1 }), act('wait', null, { value: 4 }), act('block_restore', 'beast_trapdoor')], [cond('mover_at', 'beast_lift', '==', 1)]),
    rule('rule_seal', 'The emperor seals the hypogeum portal', 'button_pressed', 'btn_seal', [act('message', null, { value: 3, text: 'The hypogeum portal is sealed!' }), act('disable', 'portal_hypogeum'), act('disable', 'portal_forum'), act('wait', null, { value: 15 }), act('enable', 'portal_hypogeum'), act('enable', 'portal_forum'), act('message', null, { value: 2, text: 'The hypogeum portal opens again' })], [cond('enabled', 'portal_forum', '==', 0, 'enabled')]),
  ],
});

// ---------------------------------------------------------------- dressing and light

// Braziers on the podium walkway and in the box; lights to match.
for (const [x, y, z] of [[-1.5, 2, -1.5], [33.5, 2, -1.5], [-1.5, 2, 17.5], [33.5, 2, 17.5], [13.5, 3, 21], [18.5, 3, 21]] as const) {
  m.prop('im_brazier', [x, y, z]);
  m.light([x, y + 2, z], { fixture: 'none', color: '#ff9a3c', intensity: 1.2, range: 12, blink: 0.4 });
}
// Gates: eagles and banners either side, racks in the passages.
m.prop('im_aquila', [12.6, 0, -11.5], 0).prop('im_aquila', [19.4, 0, -11.5], 0);
m.prop('im_vexillum', [-11.5, 0, 4.6], -P).prop('im_vexillum', [43.5, 0, 11.4], P);
m.prop('im_weapon_rack', [17.1, 0, -9], -P).prop('im_weapon_rack', [-6, 0, 9.3], Math.PI);
// The sand: a chariot, stake barricades and training posts for cover.
m.prop('im_chariot', [5, 0, 12], 0.6).prop('im_stakes', [24, 0, 3.5], 0.2).prop('im_stakes', [9, 0, 13], -0.3);
m.prop('im_training_post', [28, 0, 9], 0).prop('im_training_post', [3, 0, 6], 0);
// The hypogeum: pens' beasts' things, amphorae, a cart, torches.
m.prop('im_amphorae', [-2.5, -4, 5.5], 0).prop('im_amphorae', [34.5, -4, 10.5], 1).prop('im_lift_cage', [32 + 2.6, -4, 8 - 2.6], 0.3);
m.prop('rn_cart', [34.6, -4, 5.4], P);
for (const x of [-9, 0, 8, 16, 24, 32, 41, 49]) m.light([x, -1.2, 8], { fixture: 'bulb', color: '#ffb066', intensity: 1, range: 9 });
m.light([56, -1.0, 8], { fixture: 'ceiling', color: '#ffd0a0', range: 8 });
// The forum: statues on the plinths, a fountain, an altar before the temple, benches; columns and ruins round the edge.
m.prop('im_statue_emperor', [62, 1.3, -2], Math.PI / 4).prop('im_statue_emperor', [74, 1.3, -2], -Math.PI / 4);
m.prop('im_bust', [62, 1.3, 10], (3 * Math.PI) / 4).prop('im_bust', [74, 1.3, 10], (-3 * Math.PI) / 4);
m.prop('im_fountain', [64, 0, 1]).prop('im_altar', [77.5, 0, 0], -P).prop('im_bench', [70, 0, -2.6], 0).prop('im_bench', [66, 0, 10.6], Math.PI);
m.prop('im_column_ionic', [57, 0, -12]).prop('im_column_ionic', [63, 0, -12]).prop('rn_column_broken', [52, 0, 28], 0.4).prop('rn_column_round', [84, 0, 20]);
m.prop('rn_wall_broken', [86, 0, -20], 0.3).prop('rn_arch_round', [84, 0, 36], P).prop('rn_urn', [58, 0, 30]).prop('rn_urn_broken', [60, 0, 31], 1);
m.prop('im_velarium', [68, 0, 34], 0).prop('im_bench', [66, 0, 33], 0).prop('im_bench', [70, 0, 33], 0);
m.prop('im_amphorae', [-12, 0, 40], 0.5).prop('im_chariot', [86, 0, 2], P).prop('im_aquila', [60, 0, -18], 0).prop('im_aquila', [68, 0, -18], 0);
// Water along the aqueduct's channel.
m.water([-32, 9.6, 8], [1.6, 0.5, 88]);
for (const [x, z] of [[24, -24], [-24, 44], [44, 44], [92, -28]] as const) m.light([x, 6, z], { fixture: 'none', color: '#fff4e0', intensity: 0.6, range: 20 });

// ---------------------------------------------------------------- spawns, pickups, objectives

for (const [x, z] of [[-16, -16], [-16, 0], [-16, 16], [-16, 32], [-4, 32], [-4, -16], [-24, 8], [-28, -20]] as const) m.spawn([x, 0, z], P, reds);
for (const [x, z] of [[48, -16], [48, 0], [48, 32], [36, 32], [36, -16], [72, 9], [80, 12], [84, -16]] as const) m.spawn([x, 0, z], -P, blues);
for (const [x, y, z] of [[8, 0, 3], [24, 0, 13], [16, 0, 4], [0, -4, 8], [-2.6, -4, 8], [16, 4, 31], [-14, 4, 12], [44, 4, 8], [27, 0, 10]] as const) m.spawn([x, y, z], 0, null);
m.pickup('weapon_spear', [16, 0, 12], 20).pickup('weapon_arena_disc', [4, 0, 9], 30).pickup('weapon_shotgun', [0, -4, 8]).pickup('weapon_flamethrower', [32, -4, 8], 40);
m.pickup('weapon_marksman', [16, 4, 33], 30).pickup('weapon_hand_cannon', [68, 1.5, 6], 30).pickup('weapon_gilded_pistol', [-12, 0, 12]);
m.pickup('armor_large', [16, 3.0, 24.35], 45).pickup('armor_small', [44, 4, 20]).pickup('health_large', [-9, -4, 8], 30).pickup('health_small', [28, 0, 3]).pickup('health_small', [72, 0, 8]);
m.pickup('grenades', [-12, 4, -12]).pickup('grenades', [44, 4, -12]).pickup('ammo', [-12, 0, -4]).pickup('ammo', [48, 0, 20]).pickup('ammo', [16, 0, -10]);
m.hill([16, 0, 8], 7).hill([68, 0, 2], 6).hill([16, 4, 30], 5);
m.flag(reds, [-24, 0, -8], P).flag(blues, [84, 0, 8], -P);
m.bounds('invisible');
m.border('cliffs');
m.meta({
  description:
    "A Roman arena (Style Pack 03: Imperial Arena). Fight on the sand between spike traps and fire jets, ride the lift cages up from the hypogeum through hatches in the floor, and watch for the beast lift the emperor sends up through a trapdoor from his box. The main gate is a portcullis worked from a winch; the side gates rise as you come. Outer arcades with stairs up to the seating ring the arena; east lies a forum with a temple and a triumphal arch, west an aqueduct. A portal links the hypogeum's west tunnel to the forum, until the emperor seals it.",
  modes: ['core.deathmatch', 'core.tdm', 'core.koth', 'core.ctf'],
  players: [4, 16],
});
await m.save();
