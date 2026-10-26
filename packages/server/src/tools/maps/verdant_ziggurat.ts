/**
 * Verdant Ziggurat: the demo map of Style Pack 06 Jungle Ruins (our own map
 * and name), for 4–14 players in Deathmatch, Team Deathmatch and King of the
 * Hill. A lost temple in a jungle clearing: the stepped temple and its shrine
 * in the middle, an overgrown court and a temple gateway before it, caves to
 * the west, a rock ridge with a waterfall to the north, a river to the east
 * with a rope bridge over it, and a giant tree beyond.
 *
 * - The temple: three terraces up a long stair to the shrine and its golden
 *   idol (the hill in King of the Hill); vines up the east face of the lowest
 *   terrace for a quicker way up.
 * - The caves: walk in from the south and the roof comes down behind you
 *   (falling rocks set off by a trigger zone); more rocks hang further in,
 *   dropping on whoever stands under them.
 * - The ridge: vines up the cliff to a sniper's walk along its top, over the
 *   waterfall; under the falls a hidden recess, and rotten planks across the
 *   pool below.
 * - The river: a rope bridge of sagging planks, the middle two rotten (into
 *   the water you go). The giant tree's stairs climb twice round the trunk to
 *   a lookout.
 *
 * Grid x east, y north (one cell = 8 m):
 *
 *   y4   cliff cliff cliff FALLS cliff cliff river(spring)
 *   y3   court [ STEPPED  TEMPLE  ]  yard  river  yard
 *   y2   cave  [  (3 × 3, shrine  ]  yard  river  TREE
 *   y1   cave  [   on top)        ]  yard ~bridge~ yard
 *   y0   cave  court court court     yard  river  yard
 *   y-1  mouth court GATE  court     yard  river  yard
 *   y-2  yard  yard  yard  yard      yard  river  yard   (the expedition camp)
 *        x -1   0     1     2         3     4      5
 */
import type { LogicAction, LogicRule } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('verdant_ziggurat', 'Verdant Ziggurat');
m.theme('jungle_temple');
m.backdrop('misty', 'forest', 'moss', 0.6, 0.25);
m.teams([7, 7]);
const [SOUTH, NORTH] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];

// ---------------------------------------------------------------- tiles

m.tile('jungle.ziggurat', 0, 1, 0);
for (const x of [0, 2]) m.tile('jungle.ruined_court', x, -1, 0);
m.tile('jungle.temple_gate', 1, -1, 0);
for (const x of [0, 1, 2]) m.tile('jungle.ruined_court', x, 0, 0);
m.tile('jungle.ruined_court', -1, 3, 0);
// The caves, west.
m.tile('jungle.cave_mouth', -1, -1, 0);
for (const y of [0, 1, 2]) m.tile('jungle.cave', -1, y, 0);
// The ridge, north, with the waterfall.
m.tile('jungle.cliff_corner', -1, 4, 0, 3);
for (const x of [0, 2, 3]) m.tile('jungle.cliff', x, 4, 0);
m.tile('jungle.waterfall_basin', 1, 4, 0);
// The river, east, and the jungle beyond.
for (let y = -2; y <= 4; y++) m.tile('jungle.river', 4, y, 0);
for (let y = -1; y <= 3; y++) m.tile('yard', 3, y, 0);
for (const y of [-1, 0, 1, 3]) m.tile('yard', 5, y, 0);
m.tile('jungle.giant_tree', 5, 2, 0);
// The expedition camp, south.
for (let x = -1; x <= 5; x++) if (x !== 4) m.tile('yard', x, -2, 0);
m.tile('yard', 5, 4, 0);

// ---------------------------------------------------------------- water

m.water(at(4, 1, 0, 0, 0, -1), [4, 0.75, 56], 'water', '#3a7a6a');
m.water(at(1, 4, 0, 0, -1.25, -1.5), [4, 1.2, 2.5], 'water', '#3a8a8a');
m.prop('jg_waterfall', at(1, 4, 0, 0, 1.6, 0), 0, 0.9, false);
m.prop('jg_vine_curtain', at(1, 4, 0, 0, 2.15, 0), S, 1, false);

// ---------------------------------------------------------------- gameplay pieces

// The rope bridge over the river at y 1: eight planks over 12 m between two stone lookouts 1.5 m up, sagging; the middle two rotten.
const BX0 = 4 * 8 - 6;
const BZ = 1 * 8;
const UP = 1.5;
for (const [x0, dir] of [[BX0, -1], [BX0 + 12, 1]] as const) {
  // A lookout (2.4 × 3 m) at the bridge end, steps (0.25 m, 0.5 m deep) down its south side.
  m.block([r2(x0 + dir * 1.2), 0, BZ], [2.4, UP, 3], 'solid', { material: 'pbr_castle_stone', tint: '#c0c0a0' });
  for (let k = 0; k < 5; k++) m.block([r2(x0 + dir * 1.2), 0, r2(BZ - 1.75 - k * 0.5)], [2.4, r2(UP - 0.25 * (k + 1)), 0.5], 'solid', { material: 'pbr_castle_stone', tint: '#b0b098' });
}
for (let i = 0; i < 8; i++) {
  const d = (i + 0.5) * 1.5;
  const sag = UP - 4 * 0.6 * (d / 12) * (1 - d / 12);
  const pitch = r2(Math.atan((-4 * 0.6 * (1 - (2 * d) / 12)) / 12));
  const rotten = i === 3 || i === 4;
  m.block([r2(BX0 + d), r2(sag - 0.15), BZ], [2.4, 0.15, 1.54], rotten ? 'crumble' : 'solid', { material: 'pbr_weathered_planks', ...(rotten ? { tint: '#8a7a68' } : {}), yaw: P, ...(pitch ? { pitch } : {}), delay: 0.6, respawn: 10, id: `bridge_plank_${i}` });
}
m.prop('jg_bridge_post', [BX0 + 0.2, UP, BZ], P, 1, false).prop('jg_bridge_post', [BX0 + 11.8, UP, BZ], -P, 1, false);
// Rotten planks across the waterfall pool (two give way).
for (let i = 0; i < 4; i++) m.block(at(1, 4, 0, -1.5 + i * 1.0, -1.25, -0.15), [2.4, 0.15, 1.02], i === 1 || i === 2 ? 'crumble' : 'solid', { material: 'pbr_weathered_planks', ...(i === 1 || i === 2 ? { tint: '#8a7a68' } : {}), yaw: P, delay: 0.4, respawn: 12, id: `pool_plank_${i}` });
// Climbing vines: up the ridge (8 m) in two places, and up the temple's lowest terrace on the east.
m.add({ kind: 'ladder', id: 'vines_ridge_w', position: at(0, 4, 0, 0.6, 0.3), yaw: S, height: 8, width: 1.2, style: 'vines' });
m.add({ kind: 'ladder', id: 'vines_ridge_e', position: at(3, 4, 0, -1.5, 0.3), yaw: S, height: 8, width: 1.2, style: 'vines' });
m.add({ kind: 'ladder', id: 'vines_temple', position: at(2, 2, 0, 3.15, 0), yaw: P, height: 2, width: 1.2, style: 'vines' });
// Falling rocks in the caves: one set off from the cave mouth by a trigger zone, one that drops on whoever stands under it.
m.add({ kind: 'trap', id: 'rockfall_zone', trap: 'crusher', position: at(-1, 1, 0), yaw: 0, activation: 'logic', onSeconds: 1.2, offSeconds: 8, offsetSeconds: 0, startEnabled: true, damage: null, style: 'rockfall' });
m.add({ kind: 'trap', id: 'rockfall_step', trap: 'crusher', position: at(-1, 2, 0, 0, 1), yaw: 0, activation: 'proximity', onSeconds: 1.2, offSeconds: 10, offsetSeconds: 0, startEnabled: true, damage: null, style: 'rockfall' });
m.add({ kind: 'zone', id: 'zone_cave', name: 'Cave mouth', position: at(-1, 0, 0, 0, -1), size: [3.6, 3, 4], who: 'any', count: 1, startEnabled: true });
// Fire-spitting serpent heads either side of the temple stair, on a slow cycle.
m.prop('jg_serpent_statue', at(0, 0, 0, 3.5, 3.4), 0).prop('jg_serpent_statue', at(2, 0, 0, -3.5, 3.4), 0);

// ---------------------------------------------------------------- dressing

// The shrine: the golden idol, braziers at the door.
m.prop('jg_gold_idol', at(1, 2, 0, 0, 4.8, 6), S).prop('jg_brazier', at(0, 2, 0, 4.6, -1.6, 6), 0).prop('jg_brazier', at(2, 2, 0, -4.6, -1.6, 6), 0);
// The court and the gateway.
m.prop('jg_stone_idol', at(3, -1, 0, -1, 1), -0.6).prop('jg_stele', at(2, -1, 0, 1, -1), -0.3).prop('jg_carved_pillar', at(0, 0, 0, -2.5, 1.5), 0).prop('jg_carved_pillar', at(2, 0, 0, 2.5, 1.5), 0);
m.prop('jg_rubble_blocks', at(1, 0, 0, -2.5, -1), 0.6).prop('jg_altar_stone', at(-1, 3, 0, -0.5, -1.5), 0);
// The jungle: plants (walk-through), bamboo, roots and lianas.
for (const [x, y, dx, dy, model, yaw] of [
  [3, 3, 2, 2, 'jg_banana_plant', 0.3], [3, 0, -2, 2, 'jg_giant_fern', 1], [5, 3, 1, -1, 'jg_monstera', 2], [5, 0, 2, 2, 'jg_banana_plant', 1.2], [5, -1, -2, -2, 'jg_giant_fern', 0.4],
  [3, -1, 2, -2, 'jg_monstera', 0.8], [-1, 3, -2.5, -2.5, 'jg_giant_fern', 0], [0, -2, 2, 2, 'jg_monstera', 0.5], [2, -2, -2, 2, 'jg_banana_plant', 2], [5, 4, 0, 0, 'jg_banana_plant', 0.2],
] as const) m.prop(model, at(x, y, 0, dx, dy), yaw, 1, false);
m.prop('jg_bamboo', at(3, 2, 0, 2.5, 2.5), 0).prop('jg_bamboo', at(5, 1, 0, 2.6, -2.6), 0.4).prop('jg_bamboo', at(-1, -2, 0, -2.6, -2.6), 1);
m.prop('jg_giant_root', at(5, 3, 0, 1, 2.6), 2.2);
for (const p of [at(3, 2, 0, -1, 0), at(5, 1, 0, 0, 2), at(3, -1, 0, 0, 1)]) m.prop('jg_liana', [p[0], 1.5, p[2]], p[0], 1, false);
m.prop('nt_boulder_moss', at(3, 3, 0, -2.5, -2), 0.5).prop('nt_log_moss', at(5, -1, 0, 1, 1.5), 1.4).prop('hanging_moss', at(0, 4, 0, -2, 0.4, 3), 0, 1, false);
// The expedition camp.
m.prop('sv_tent', at(0, -2, 0, -2, -2), 0.3).prop('sv_tent', at(2, -2, 0, 2, -2), -0.3).prop('campfire', at(1, -2, 0, 0, -1.5), 0).prop('sv_radio', at(1, -2, 0, 2.2, -2.6), S).prop('sv_backpack', at(0, -2, 0, 1, -0.5), 1).prop('crate_large', at(3, -2, 0, 1.5, -2), 0.2).prop('crate_small', at(3, -2, 0, 2.6, -1.5), 0.8);
m.prop('jg_brazier', at(-1, -2, 0, 2, 2), 0);

// ---------------------------------------------------------------- light

for (const p of [at(0, 2, 0, 4.6, -1.6, 7.9), at(2, 2, 0, -4.6, -1.6, 7.9), at(1, -2, 0, 0, -1.5, 1.2), at(-1, -2, 0, 2, 2, 2.0)]) m.light(p, { fixture: 'none', color: '#ff9a40', intensity: 1.3, range: 10 });
m.light(at(1, 3, 0, 0, 0, 8.5), { fixture: 'none', color: '#ffd890', intensity: 1, range: 8 });
for (const y of [0, 1, 2]) m.light(at(-1, y, 0, 0, 0, 3.3), { fixture: 'bulb', color: '#ffb060', intensity: 0.7, range: 7 });
m.light(at(1, 4, 0, 0, 2.4, 2.5), { fixture: 'none', color: '#8ad8ff', intensity: 0.8, range: 7 });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Verdant Ziggurat. Watch your step on the bridge.', 4)]),
    rule('rule_cave', 'The cave roof comes down', { event: 'zone_enter', target: 'zone_cave' }, [act('wait', null, { value: 1.5 }), act('trap_fire', 'rockfall_zone'), act('sound', null, { state: 'boom' })]),
  ],
});

// ---------------------------------------------------------------- spawns, pickups, objectives

for (const [p, yaw] of [
  [at(-1, -2, 0, 0, 0), 0], [at(0, -2, 0, -1, 0), 0], [at(1, -2, 0, 2, 1), 0], [at(2, -2, 0, 0, 1), 0], [at(3, -2, 0, 0, 1), 0], [at(5, -2, 0, 0, 0), 0], [at(5, -1, 0, 1, 0), 0],
] as [V3, number][]) m.spawn(p, yaw, SOUTH);
for (const [p, yaw] of [
  [at(-1, 3, 0, -2, 2.5), S], [at(3, 3, 0, 0, 2), S], [at(5, 3, 0, -2, 0), S], [at(5, 4, 0, 1, 1), S], [at(3, 2, 0, 0, 0), S], [at(-1, 3, 0, 2.5, 2.5), S], [at(3, 3, 0, 2.5, -2), S],
] as [V3, number][]) m.spawn(p, yaw, NORTH);
for (const [p, yaw] of [
  [at(1, 0, 0, 0, 0), 0], [at(0, 0, 0, 0, -2), 0], [at(2, 0, 0, 0, -2), 0], [at(3, 0, 0, 0, 0), -P], [at(5, 0, 0, 0, 0), -P], [at(-1, -1, 0, 0, 2), 0], [at(2, 0, 0, 1.5, -2.5), 0], [at(5, 1, 0, 2.5, 2.5), S],
] as [V3, number][]) m.spawn(p, yaw, null);

m.pickup('weapon_launcher', at(1, 2, 0, 0, 3.2, 6), 40).pickup('weapon_marksman', at(0, 4, 0, 0, 2.2, 8), 30).pickup('weapon_rifle', at(5, 2, 0, 2.6, 2.6, 7.5));
m.pickup('weapon_smg', at(-1, 1, 0, 0, 2.8)).pickup('weapon_shotgun', at(1, 4, 0, -2.6, 1.2, 0)).pickup('dynamite', at(1, -2, 0, -2, 1), 30).pickup('dynamite', at(3, 1, 0, 0, -2), 30);
m.pickup('grenades', at(-1, 3, 0, 0, -2)).pickup('armor_large', at(1, 2, 0, 0, -2, 6), 40).pickup('armor_small', at(5, 1, 0, 2.5, -1.5)).pickup('health_large', at(-1, 2, 0, 0, -2.5)).pickup('health_small', at(1, 0, 0, 2.5, 2.5));
m.pickup('health_small', at(3, 3, 0, 0, -2)).pickup('ammo', at(0, -1, 0, 2, 2)).pickup('ammo', at(5, 0, 0, -2, -2));
m.hill(at(1, 2, 0, 0, -1.5, 6), 3);
m.hill(at(1, -1, 0, 0, -2.5), 4);
m.hill(at(5, 0, 0, 0, 0), 4);
m.mount('buggy', at(4, -2, 0, -6, -1), 0);

m.bounds('invisible', 4);
m.border('forest');
m.meta({
  description:
    'A lost temple in a jungle clearing, built from the Jungle Ruins style pack: a stepped temple with its shrine and golden idol on top, an overgrown court and a temple gateway before it, caves to the west where the roof comes down behind you, a rock ridge with vines up to a sniper walk over the waterfall and its hidden recess, a river with a sagging rope bridge (two of its planks are rotten) and a giant tree with stairs spiralling up to a lookout.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [4, 14],
});
await m.save();
