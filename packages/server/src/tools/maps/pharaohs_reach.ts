/**
 * Pharaoh's Reach: the demo map for Style Pack 09 Sands of Egypt. A temple
 * complex on the Nile: from the south quay a sphinx avenue leads between two
 * obelisks and seated colossi to a painted pylon (stairs at its back to the
 * roof walk), a hypostyle hall of painted columns and the sanctuary behind
 * it. East stands a step pyramid; west, a mastaba over the stairs down to a
 * painted tomb whose corridors are full of traps and whose burial chamber
 * holds the pharaoh's curse (step up to the sarcophagus and the fire jets go
 * off and the way out seals). A portal in the burial chamber leads to the top
 * of the pyramid and back. A ferry crosses the river to the village on the
 * north bank; a reed boat drifts up and down.
 *
 * Grid x east, y north (one cell = 8 m):
 *
 *   y 10   . h . . . . h . . . h . .      village (h houses)
 *   y 8    Q Q Q Q Q Q Q Q Q Q Q Q Q      north quay
 *   y 6-7  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~      the Nile (ferry at x 2, reed boat along it)
 *   y 5    Q Q Q Q Q Q Q Q Q Q Q Q Q      south quay
 *   y 2-4  . . . . a . . . . . . . .      a sphinx avenue
 *   y 1    . . . P P P . . . . . . .      P pylon
 *   y-1-0  . . . H H H . . . . . . .      H hypostyle hall
 *   y-2    T . . . S . . p p p p . .      S sanctuary, p pyramid (x 7-10, y -5..-2)
 *   y-3    M . . . . . . p p p p . .      M mastaba (tomb entrance); T the tomb below (x 0, y -2..0)
 *          x 0 1 2 3 4 5 6 7 8 9 10 11
 */
import type { MapEntity, ScenarioLogic } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('pharaohs_reach', "Pharaoh's Reach");
m.theme('egypt');
m.backdrop('clear', 'dunes', 'sand', 0.55);
m.teams([8, 8]);
const [south, north] = m.teamIds(2) as [string, string];
const C = 8;
const P = Math.PI / 2;

const used = new Set<string>();
const mark = (x: number, y: number) => used.add(`${x},${y}`);

// ---------------------------------------------------------------- the Nile

for (let x = -3; x <= 12; x++) {
  m.tile('egypt.quay', x, 5, 0, 0);
  m.tile('egypt.river', x, 6, 0, 0);
  m.tile('egypt.river', x, 7, 0, 0);
  m.tile('egypt.quay', x, 8, 0, 2);
  for (const y of [5, 6, 7, 8]) mark(x, y);
}
m.water([36, -2.5, 52], [128, 2.0, 24], 'water', '#3a7a8a');

// ---------------------------------------------------------------- the temple

for (const y of [2, 3, 4]) {
  m.tile('egypt.avenue', 4, y, 0, 0);
  mark(4, y);
}
m.tile('egypt.pylon', 5, 1, 0, 2); // cells (3..5, 1); front to the north
for (const x of [3, 4, 5]) mark(x, 1);
for (const x of [3, 4, 5]) for (const y of [-1, 0]) {
  m.tile('egypt.hypostyle', x, y, 0, 0);
  mark(x, y);
}
m.tile('egypt.sanctuary', 4, -2, 0, 2); // its door on the north, into the hall
mark(4, -2);

// ---------------------------------------------------------------- the pyramid

m.tile('egypt.pyramid', 7, -5, 0, 0); // cells (7..10, -5..-2); its stair up the north face
for (let x = 7; x <= 10; x++) for (let y = -5; y <= -2; y++) mark(x, y);

// ---------------------------------------------------------------- the tomb (level -1) under its mastaba

m.tile('egypt.tomb_entrance', 0, -3, -1, 0); // doorway south at ground level, stairs down north
mark(0, -3);
m.tile('egypt.tomb_corridor', 0, -2, -1, 0);
m.tile('egypt.tomb_corridor', 0, -1, -1, 0);
m.tile('egypt.tomb_chamber', 0, 0, -1, 0);

// ---------------------------------------------------------------- the village on the north bank

for (const [x, y] of [[0, 9], [2, 10], [6, 9], [8, 10], [10, 9]] as const) {
  m.tile('egypt.house', x, y, 0, 0);
  mark(x, y);
}
for (let x = -3; x <= 12; x++) for (let y = -6; y <= 11; y++) if (!used.has(`${x},${y}`)) m.tile('yard', x, y);

// ---------------------------------------------------------------- boats

// The ferry: a deck at the water line carrying a felucca, crossing between the quays' lowest steps.
m.block([16, -0.9, 44.2], [2.4, 0.4, 5.6], 'solid', { id: 'ferry_deck', material: 'pbr_weathered_planks' });
m.add({ kind: 'prop', id: 'ferry_boat', model: 'prop.eg_felucca', position: [16, -1.1, 44.2], yaw: 0, scale: 1, solid: false, tint: null });
m.mover('ferry', [16, -0.9, 44.2], ['ferry_deck'], [[0, 0, 0], [0, 0, 15.6]], { speed: 2, wait: 5, name: 'Ferry', props: ['ferry_boat'] });
// A reed boat drifting up and down the river.
m.block([-12, -0.85, 51], [1.0, 0.3, 4.2], 'solid', { id: 'reed_deck', material: 'pbr_weathered_planks', tint: '#a89a50' });
m.add({ kind: 'prop', id: 'reed_boat', model: 'prop.eg_reed_boat', position: [-12, -0.95, 51], yaw: 0, scale: 1, solid: false, tint: null });
m.mover('reed_drift', [-12, -0.85, 51], ['reed_deck'], [[0, 0, 0], [0, 0, 0], [96, 0, 0], [96, 0, 0]], { speed: 1.2, wait: 3, name: 'Reed boat', props: ['reed_boat'], mode: 'pingpong' });
// Moored boats along the north bank.
m.prop('eg_felucca', [60, -1.1, 57.5], P, 1, false).prop('eg_reed_boat', [-8, -0.95, 58], 0.2);

// ---------------------------------------------------------------- the portal pair and the curse

m.add({ kind: 'portal', id: 'portal_tomb', name: 'Tomb portal', position: [-3.45, -4, -0.2], yaw: P, size: [2.4, 3.0], pair: 'pyramid', startEnabled: true, color: '#4dff9a' });
m.add({ kind: 'portal', id: 'portal_pyramid', name: 'Pyramid portal', position: [64, 10, -24], yaw: 0, size: [2.4, 3.2], pair: 'pyramid', startEnabled: true, color: '#c06bff' });
m.add({ kind: 'zone', id: 'zone_curse', name: 'The sarcophagus', position: [0, -3.5, 2.0], size: [2.5, 2, 3.0], who: 'any', count: 1, startEnabled: true });
m.add({ kind: 'trap', id: 'curse_flames_w', trap: 'flames', position: [-3.1, -4, -2.6], yaw: P, activation: 'logic', onSeconds: 3, offSeconds: 4, offsetSeconds: 0, startEnabled: true, damage: null });
m.add({ kind: 'trap', id: 'curse_flames_e', trap: 'flames', position: [3.1, -4, -0.2], yaw: -P, activation: 'logic', onSeconds: 3, offSeconds: 4, offsetSeconds: 0, startEnabled: true, damage: null });
m.light([0, -1.3, 0], { id: 'curse_light', fixture: 'none', color: '#4dff9a', intensity: 1.2, range: 10 });

// ---------------------------------------------------------------- tomb traps

m.add({ kind: 'trap', id: 'tomb_spikes_1', trap: 'spikes', position: [0, -4, -18], yaw: 0, activation: 'cycle', onSeconds: 1.5, offSeconds: 3, offsetSeconds: 0, startEnabled: true, damage: null });
m.add({ kind: 'trap', id: 'tomb_spikes_2', trap: 'spikes', position: [0, -4, -14.5], yaw: 0, activation: 'cycle', onSeconds: 1.5, offSeconds: 3, offsetSeconds: 1.5, startEnabled: true, damage: null });
m.add({ kind: 'trap', id: 'tomb_fire', trap: 'flames', position: [-1.5, -4, -9], yaw: P, activation: 'cycle', onSeconds: 1.5, offSeconds: 4, offsetSeconds: 0.5, startEnabled: true, damage: null });
m.add({ kind: 'trap', id: 'tomb_crusher', trap: 'crusher', position: [0, -4, -5.5], yaw: 0, activation: 'cycle', onSeconds: 1, offSeconds: 4, offsetSeconds: 2, startEnabled: true, damage: null });

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
    rule(
      'rule_curse',
      "The pharaoh's curse",
      'zone_enter',
      'zone_curse',
      [
        act('message', null, { value: 3, text: "The pharaoh's curse! The tomb portal seals." }),
        act('sound', null, { state: 'boom' }),
        act('light_color', 'curse_light', { text: '#ff3020' }),
        act('trap_fire', 'curse_flames_w'),
        act('trap_fire', 'curse_flames_e'),
        act('disable', 'portal_tomb'),
        act('disable', 'portal_pyramid'),
        act('wait', null, { value: 10 }),
        act('enable', 'portal_tomb'),
        act('enable', 'portal_pyramid'),
        act('light_color', 'curse_light', { text: '' }),
      ],
      [cond('enabled', 'portal_tomb', '==', 0, 'enabled')],
    ),
  ],
});

// ---------------------------------------------------------------- dressing

// The approach: obelisks and seated colossi before the pylon, sphinxes on the avenue's plinths.
m.prop('eg_obelisk', [25, 0, 15.5]).prop('eg_obelisk', [39, 0, 15.5]);
m.prop('eg_statue_pharaoh', [28.6, 0, 14.4], 0).prop('eg_statue_pharaoh', [35.4, 0, 14.4], 0);
for (const y of [2, 3, 4]) {
  m.prop('eg_sphinx', [28.7, 0.6, y * C], 0, 0.7);
  m.prop('eg_sphinx', [35.3, 0.6, y * C], 0, 0.7);
}
// The hall and the sanctuary: fire stands, an altar, Bastet, Anubis.
for (const [x, z] of [[26, -6], [38, -6], [26, 2.5], [38, 2.5]] as const) {
  m.prop('eg_torch', [x, 0, z]);
  m.light([x, 2.6, z], { fixture: 'none', color: '#ffa040', intensity: 1.2, range: 11, blink: 0.4 });
}
m.prop('eg_cat_statue', [29.5, 0, -18], P).prop('eg_anubis', [34.5, 0, -18.6], -P).prop('im_altar', [32, 0, -7], Math.PI);
m.light([32, 3.2, -16], { fixture: 'none', color: '#ffd890', intensity: 1.1, range: 9 });
// The tomb: the sarcophagus on its dais, canopic jars, the treasure, torches.
m.prop('eg_sarcophagus', [0, -3.5, 2.1], 0).prop('eg_canopic_jars', [-2.9, -4, -2.9], 0).prop('dg_coin_pile', [2.6, -4, 2.8], 0).prop('dg_coin_bag', [-2.6, -4, 2.9], 0.5);
m.prop('rn_urn', [3.05, -4, -3.05]).prop('eg_chest', [29.6, 0, -13.2], 0.2);
for (const z of [-20, -12, -4]) m.light([0, -1.0, z], { fixture: 'none', color: '#ff9a40', intensity: 0.9, range: 8, blink: 0.4 });
// The pyramid's foot and the mastaba: stelae, broken columns, cacti.
m.prop('eg_stele', [3.5, 0, -30], 0).prop('eg_stele', [-3.5, 0, -30], 0).prop('eg_obelisk', [60, 0, -8]).prop('eg_obelisk', [76, 0, -8]);
m.prop('rn_column_broken', [48, 0, -20], 0.4).prop('rn_column_broken', [90, 0, -36], 1.2).prop('cactus', [-20, 0, -40], 0).prop('nt_cactus_round', [95, 0, 2], 0);
// The banks: palms, papyrus, a fire stand at each landing, amphorae on the quay.
for (const x of [-20, -4, 8, 44, 52, 72, 88]) m.prop('eg_palm', [x, 0, 33], x / 10);
for (const x of [-12, 12, 36, 60, 84]) m.prop('eg_palm', [x, 0, 70], -x / 10);
for (const x of [-16, 0, 24, 56, 80]) m.prop('eg_papyrus', [x + 3, -2.5, 45.5], x).prop('eg_papyrus', [x - 2, -2.5, 58.4], -x);
m.prop('eg_torch', [12.5, 0, 38]).prop('eg_torch', [19.5, 0, 66]).prop('im_amphorae', [22, 0, 38], 0.4).prop('im_amphorae', [10, 0, 66.5], 2);
m.prop('eg_chest', [50, 0, 74], 0.3).prop('eg_stele', [40, 0, 80], Math.PI);
m.light([16, 3, 38], { fixture: 'none', color: '#ffa040', intensity: 1, range: 10, blink: 0.4 });
m.light([16, 3, 66], { fixture: 'none', color: '#ffa040', intensity: 1, range: 10, blink: 0.4 });

// ---------------------------------------------------------------- spawns, pickups, objectives

for (const [x, z] of [[-16, -32], [-8, -44], [8, -44], [24, -32], [40, -44], [88, -44], [96, -20], [-20, -12]] as const) m.spawn([x, 0, z], 0, south);
for (const [x, z] of [[-16, 84], [4, 88], [24, 72], [40, 88], [56, 88], [76, 72], [96, 84], [32, 76]] as const) m.spawn([x, 0, z], Math.PI, north);
for (const [x, y, z] of [[32, 0, 20], [56, 0, 20], [8, 0, 20], [32, 0, -4], [62, 10, -32], [0, -4, -8], [80, 0, 28], [-16, 0, 20]] as const) m.spawn([x, y, z], 0, null);
m.pickup('weapon_sniper', [72, 10, -34], 30).pickup('weapon_launcher', [32, 0, -8], 40).pickup('weapon_gilded_pistol', [2.5, -4, 1.2], 30).pickup('weapon_singularity', [0, -3.75, 0.3], 60);
m.pickup('weapon_burst_rifle', [48, 0, 76]).pickup('weapon_flamethrower', [22, 4.0, 8], 40).pickup('weapon_spear', [16, 0, 30], 20).pickup('weapon_gilded_pistol', [80, 0, -4]);
m.pickup('armor_large', [32, 0, -15], 45).pickup('armor_small', [-1.5, 3.0, 72]).pickup('health_large', [0, -4, -20], 30).pickup('health_small', [48, 0, 4]).pickup('health_small', [24, 0, 80]);
m.pickup('grenades', [-12, 0, 0]).pickup('grenades', [72, 0, 64]).pickup('ammo', [40, 0, 28]).pickup('ammo', [8, 0, -36]).pickup('ammo', [64, 0, 73]);
m.hill([64, 10, -30], 4).hill([32, 0, -4], 6).hill([40, 0, 72], 6);
m.flag(south, [16, 0, -44], 0).flag(north, [40, 0, 84], Math.PI);
m.bounds('invisible');
m.border('cliffs');
m.meta({
  description:
    "A temple complex on the Nile (Style Pack 09: Sands of Egypt). A sphinx avenue leads from the quay between obelisks and seated colossi to a painted pylon (climb its back stairs to the roof walk), a hypostyle hall of painted columns and the sanctuary. East stands a step pyramid with a sniper's perch on top; west, stairs under a mastaba lead down to a painted tomb full of spike pits, fire jets and a crushing ceiling. Touch the sarcophagus and the pharaoh's curse goes off and seals the portal that links the burial chamber to the top of the pyramid. A ferry crosses to the village on the north bank.",
  modes: ['core.deathmatch', 'core.tdm', 'core.koth', 'core.ctf'],
  players: [4, 16],
});
await m.save();
