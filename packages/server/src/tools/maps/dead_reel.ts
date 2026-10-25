/**
 * Dead Reel: a co-op creature-survival night in an abandoned theatre (1–4
 * players; homage in spirit to Call of Duty's Kino der Toten). Hold the
 * lobby while the first wave pours in from the courtyards, clear the foyer,
 * fight into the auditorium, throw the power on the stage and survive a
 * minute of everything the theatre has, then escape through the projection
 * booth behind the stage.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y7          B                   B projection booth (evac)
 *   y6      w   S   S   S   e       S stage (power switch), w/e wings
 *   y5      w   A   A   A   e       A auditorium (the great hall, dais in the middle)
 *   y4      w   A   A   A   e
 *   y3      w   A   A   A   e
 *   y2      F   F   F   F   F       F foyer
 *   y1  c   c   L   L   L   c   c   L lobby (start), c courtyards
 *   y0  c   c   L   L   L   c   c
 *       0   1   2   3   4   5   6
 */
import type { ScenarioLogic, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('dead_reel', 'Dead Reel');
m.theme('manor');
m.backdrop('dusk', 'city', 'gravel', 0.55);
m.factions([{ id: 'xeno', name: 'The Things', color: '#8fd14f', relations: {} }]);
const P = Math.PI / 2;
type Style = Parameters<typeof m.edge>[4];

// ---------------------------------------------------------------- the theatre
for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [5, 0], [6, 0], [5, 1], [6, 1]] as const) m.tile('yard', x, y);
for (let x = 2; x <= 4; x++) for (const y of [0, 1]) m.tile('room', x, y);
for (let x = 1; x <= 5; x++) m.tile('room', x, 2);
m.tile('hall', 2, 3);
for (let y = 3; y <= 6; y++) m.tile('room', 1, y).tile('room', 5, y);
for (let x = 2; x <= 4; x++) m.tile('room', x, 6);
m.tile('room', 3, 7);

const e = (x: number, y: number, side: Side, style: Style) => m.edge(x, y, 0, side, style);
// Courtyards: walled in, wide open into the lobby.
for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [5, 0], [6, 0], [5, 1], [6, 1]] as const) {
  if (x === 0) e(x, y, 'W', 'high');
  if (x === 6) e(x, y, 'E', 'high');
  if (y === 0) e(x, y, 'S', 'high');
  if (y === 1) e(x, y, 'N', 'high');
}
for (const y of [0, 1]) e(1, y, 'E', 'wide');
for (const y of [0, 1]) e(5, y, 'W', 'wide');
// Lobby: one room of six cells; the boarded-up front; a locked door north into the foyer.
for (const y of [0, 1]) for (const x of [2, 3]) e(x, y, 'E', 'open');
for (let x = 2; x <= 4; x++) e(x, 0, 'N', 'open').edge(x, 0, 0, 'S', 'wall');
e(2, 1, 'N', 'wall');
e(3, 1, 'N', 'door');
e(4, 1, 'N', 'wall');
// Foyer: a long room; a locked door north into the auditorium; walled off from the wings.
for (let x = 1; x <= 4; x++) e(x, 2, 'E', 'open');
for (const x of [1, 2, 4, 5]) e(x, 2, 'N', 'wall');
e(3, 2, 'N', 'door');
e(1, 2, 'S', 'wall').edge(5, 2, 0, 'S', 'wall').edge(1, 2, 0, 'W', 'wall').edge(5, 2, 0, 'E', 'wall');
// The wings: corridors either side of the auditorium, open to it through arches.
for (let y = 3; y <= 5; y++) e(1, y, 'E', 'arch').edge(5, y, 0, 'W', 'arch');
for (let y = 3; y <= 5; y++) e(1, y, 'N', 'open').edge(5, y, 0, 'N', 'open');
e(1, 6, 'E', 'door').edge(5, 6, 0, 'W', 'door');
// The stage: open to the auditorium; the booth door behind it.
for (let x = 2; x <= 4; x++) e(x, 5, 'N', 'open');
e(2, 6, 'E', 'open').edge(3, 6, 0, 'E', 'open');
e(2, 6, 'N', 'wall').edge(4, 6, 0, 'N', 'wall');
e(3, 6, 'N', 'door');

// A roof over the theatre (not the courtyards), and warm colours inside.
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const theatre: [number, number][] = [];
for (let x = 2; x <= 4; x++) for (const y of [0, 1, 6]) theatre.push([x, y]);
for (let x = 1; x <= 5; x++) theatre.push([x, 2]);
for (let y = 3; y <= 6; y++) theatre.push([1, y], [5, y]);
theatre.push([3, 7]);
const plaster = mat('pbr_plaster', '#e2cfae');
for (const [x, y] of theatre) {
  m.tile('platform', x, y, 1);
  paint(x, y, 1, { underside: mat('pbr_plaster_white', '#d8c8a8'), solids: plaster, floor: mat('pbr_gravel') });
  const carpet = y === 2 || (y <= 1 && x === 3) || y >= 6;
  paint(x, y, 0, { walls: plaster, floor: carpet ? mat('pbr_carpet', '#c0444c') : mat('pbr_floorboards'), trim: mat('brass') });
}
for (let x = 2; x <= 4; x++) for (let y = 3; y <= 5; y++) m.tile('platform', x, y, 1).history;
for (let x = 2; x <= 4; x++) for (let y = 3; y <= 5; y++) paint(x, y, 1, { underside: mat('pbr_plaster_white', '#d8c8a8'), solids: plaster, floor: mat('pbr_gravel') });
paint(2, 3, 0, { walls: plaster, floor: mat('pbr_carpet', '#c0444c'), solids: mat('pbr_travertine'), trim: mat('brass') });

const DOOR = { kind: 'door' as const, startOpen: false, locked: true, auto: true };
m.add({ ...DOOR, id: 'door_lobby', name: 'Lobby doors', position: [24, 0, 12], yaw: 0 });
m.add({ ...DOOR, id: 'door_hall', name: 'Auditorium doors', position: [24, 0, 20], yaw: 0 });
m.add({ ...DOOR, id: 'door_booth', name: 'Booth door', position: [24, 0, 52], yaw: 0 });
m.add({ kind: 'button', id: 'btn_power', name: 'Power', position: [32, 0, 51.3], yaw: Math.PI, label: 'Throw the power', once: true, cooldownSeconds: 1, startEnabled: false });
m.add({ kind: 'zone', id: 'zone_booth', name: 'Projection booth', position: [24, 0, 56], size: [6, 3, 5], who: 'any', count: 1, startEnabled: true });

// ---------------------------------------------------------------- dressing
const CURTAIN = { material: 'pbr_canvas', tint: '#7a1420' };
// The stage curtain, drawn back from the booth door in the middle.
m.block([17.75, 0, 51.6], [7.5, 4, 0.3], 'solid', CURTAIN).block([30.25, 0, 51.6], [7.5, 4, 0.3], 'solid', CURTAIN);
for (const x of [13.5, 34.5]) for (const z of [30, 34, 38]) m.prop('bench', [x, 0, z], 0).prop('bench', [x + 1.2, 0, z], 0);
m.prop('table_cloth', [24, 0, 4], 0).prop('bookcase', [13, 0, -3.3], 0).prop('bookcase', [35, 0, -3.3], 0).prop('rug', [24, 0, 7], 0, 1, false);
m.prop('sofa', [14, 0, 10.6], Math.PI).prop('armchair', [34, 0, 10.6], Math.PI).prop('floor_lamp', [12.6, 0, 10.7]).prop('floor_lamp', [35.4, 0, 10.7]);
m.prop('coat_rack', [9, 0, 19]).prop('potted_plant', [39, 0, 19]).prop('side_table', [20, 0, 19.4], Math.PI).prop('side_table', [28, 0, 19.4], Math.PI);
m.prop('crate_large', [6, 0, 50], 0.2).prop('cardboard_box', [42, 0, 50]).prop('coat_rack', [10, 0, 26]).prop('bookcase', [42.6, 0, 30], -P);
m.prop('speaker', [12.5, 0, 50.5], Math.PI).prop('speaker', [35.5, 0, 50.5], Math.PI).prop('tv', [24, 0, 59], Math.PI);
m.prop('barrel', [-2, 0, -2]).prop('dungeon_barrel', [50, 0, 10]).prop('skip', [-1.5, 0, 9], P).prop('tree_thin', [51, 0, -2]);
m.breakable('boards', [24, 0, -4.2], 0);

// ---------------------------------------------------------------- players and supplies
for (const [x, z] of [[22, 4], [26, 4], [22, 8], [26, 8]] as const) m.spawn([x, 0, z], 0, null);
m.pickup('weapon_smg', [16, 0, 2]).pickup('weapon_shotgun', [32, 0, 2]).pickup('ammo', [24, 0, 10]).pickup('health_small', [16, 0, 9]);
m.pickup('weapon_rifle', [8, 0, 16]).pickup('ammo_shells', [40, 0, 16]).pickup('armor_small', [24, 0, 16]).pickup('grenades', [32, 0, 16]);
m.pickup('weapon_lmg', [24, 0, 26], 90).pickup('health_large', [8, 0, 40]).pickup('ammo_rifle', [40, 0, 40]).pickup('armor_large', [24, 0, 48]);
m.pickup('weapon_rockets', [40, 0, 26], 90).pickup('ammo_explosive', [8, 0, 28]).pickup('health_small', [40, 0, 48]).pickup('ammo', [8, 0, 48]);

// ---------------------------------------------------------------- the things
const roster = { trooper: 0, gunner: 0, heavy: 0, imp: 0, puglin: 0, cyclops: 0, oculus: 0, scolitex: 0 };
const squad = { kind: 'encounter', yaw: 0, faction: 'xeno', perPlayer: 1, respawnSeconds: 3, radius: 3, order: 'attack', orderTarget: null, difficulty: 'normal' } as const;
m.add({ ...squad, id: 'enc_court_w', name: 'West courtyard', position: [0, 0, 4], roster: { ...roster, imp: 3 }, activeCap: 4, reinforcements: 4, startActive: true });
m.add({ ...squad, id: 'enc_court_e', name: 'East courtyard', position: [48, 0, 4], roster: { ...roster, imp: 2, puglin: 1 }, activeCap: 4, reinforcements: 3, startActive: true });
m.add({ ...squad, id: 'enc_foyer', name: 'Foyer', position: [8, 0, 16], roster: { ...roster, imp: 3, puglin: 2 }, activeCap: 6, reinforcements: 6, startActive: false });
m.add({ ...squad, id: 'enc_hall', name: 'Auditorium', position: [24, 0, 40], roster: { ...roster, imp: 2, cyclops: 1, oculus: 1 }, activeCap: 6, reinforcements: 2, startActive: false });
m.add({ ...squad, id: 'enc_wing_w', name: 'West wing', position: [8, 0, 34], roster: { ...roster, imp: 2, puglin: 2, cyclops: 1 }, activeCap: 6, reinforcements: 10, perPlayer: 2, startActive: false });
m.add({ ...squad, id: 'enc_wing_e', name: 'East wing', position: [40, 0, 34], roster: { ...roster, imp: 2, oculus: 2 }, activeCap: 6, reinforcements: 10, perPlayer: 2, startActive: false });
m.add({ ...squad, id: 'enc_brute', name: 'The brute', position: [24, 0, 30], roster: { ...roster, scolitex: 1 }, activeCap: 1, reinforcements: 0, perPlayer: 0, startActive: false });

// ---------------------------------------------------------------- the night
type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const say = (text: string, seconds = 4) => act('message', null, { value: seconds, text });
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = [], once = true) =>
  ({ id, name, enabled: true, once, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const open = (door: string) => [act('door_unlock', door), act('door_open', door)];
const lobbyClear = [
  act('objective', 'obj_lobby', { state: 'complete' }),
  ...open('door_lobby'),
  act('objective', 'obj_foyer', { state: 'active' }),
  act('encounter_start', 'enc_foyer'),
  act('sound', null, { state: 'chime' }),
  say('The lobby doors give way. Something is moving in the foyer.'),
];

m.logic({
  variables: [{ id: 'var_lives', name: 'lives', initial: 12 }],
  timers: [{ id: 'timer_power', name: 'Hold out', seconds: 60, loop: false, visible: true }],
  objectives: [
    { id: 'obj_lobby', text: 'Hold the lobby', startActive: true, marker: null },
    { id: 'obj_foyer', text: 'Clear the foyer', startActive: false, marker: 'enc_foyer' },
    { id: 'obj_hall', text: 'Take the auditorium', startActive: false, marker: 'enc_hall' },
    { id: 'obj_power', text: 'Throw the power on the stage', startActive: false, marker: 'btn_power' },
    { id: 'obj_survive', text: 'Survive until the projector warms up', startActive: false, marker: null },
    { id: 'obj_escape', text: 'Escape through the projection booth', startActive: false, marker: 'zone_booth' },
  ],
  rules: [
    rule('rule_intro', 'Curtain up', 'match_start', null, [say('They are coming over the courtyard walls. Hold the lobby!', 5), act('sound', null, { state: 'alarm' })]),
    // The lobby: both courtyards must be cleared, in either order.
    rule('rule_lobby_w', 'Lobby held (west last)', 'encounter_cleared', 'enc_court_w', lobbyClear, [cond('encounter_alive', 'enc_court_e', '==', 0)]),
    rule('rule_lobby_e', 'Lobby held (east last)', 'encounter_cleared', 'enc_court_e', lobbyClear, [cond('encounter_alive', 'enc_court_w', '==', 0)]),
    rule('rule_foyer', 'Foyer cleared', 'encounter_cleared', 'enc_foyer', [
      act('objective', 'obj_foyer', { state: 'complete' }),
      ...open('door_hall'),
      act('objective', 'obj_hall', { state: 'active' }),
      act('encounter_start', 'enc_hall'),
      say('The auditorium. Get to the stage.'),
    ]),
    rule('rule_hall', 'Auditorium taken', 'encounter_cleared', 'enc_hall', [
      act('objective', 'obj_hall', { state: 'complete' }),
      act('enable', 'btn_power'),
      act('objective', 'obj_power', { state: 'active' }),
      say('The power switch is on the stage, stage right.'),
    ]),
    rule('rule_power', 'Power on: the last stand', 'button_pressed', 'btn_power', [
      act('objective', 'obj_power', { state: 'complete' }),
      act('objective', 'obj_survive', { state: 'active' }),
      act('sound', null, { state: 'alarm' }),
      say('Power is on! The projector needs a minute. Survive!'),
      act('timer_start', 'timer_power'),
      act('encounter_start', 'enc_wing_w'),
      act('wait', null, { value: 6 }),
      act('encounter_start', 'enc_wing_e'),
      act('wait', null, { value: 20 }),
      say('Something big is coming...', 3),
      act('encounter_start', 'enc_brute'),
    ]),
    rule('rule_projector', 'Projector ready', 'timer_done', 'timer_power', [
      act('encounter_stop', 'enc_wing_w'),
      act('encounter_stop', 'enc_wing_e'),
      act('objective', 'obj_survive', { state: 'complete' }),
      ...open('door_booth'),
      act('objective', 'obj_escape', { state: 'active' }),
      act('sound', null, { state: 'chime' }),
      say('The booth is open. Behind the curtain, go!'),
    ]),
    rule('rule_escape', 'Escape', 'zone_enter', 'zone_booth', [act('objective', 'obj_escape', { state: 'complete' }), say('You made it out. The End.'), act('wait', null, { value: 2 }), act('end_round', null, { state: 'players win' })], [cond('objective', 'obj_escape', '==', 0, 'active')]),
    rule('rule_life_lost', 'Count lives', 'player_killed', null, [act('add_var', 'var_lives', { value: -1 })], [], false),
    rule('rule_low_lives', 'Low on lives', 'variable_changed', 'var_lives', [say('Only 3 lives left!', 3), act('sound', null, { state: 'buzzer' })], [cond('variable', 'var_lives', '==', 3)]),
    rule('rule_defeat', 'Out of lives', 'variable_changed', 'var_lives', [say('The things have the theatre. Game over.'), act('end_round', null, { state: 'players lose' })], [cond('variable', 'var_lives', '<=', 0)]),
  ],
});

// Theatre lighting: warm panels in the foyer and wings, chandelier bulbs over the auditorium, footlights on the stage.
m.lightRooms({ color: '#ffd9a0', intensity: 0.9 });
for (const [x, z] of [[18, 28], [30, 28], [18, 38], [30, 38]] as const) m.light([x, 3.2, z], { fixture: 'bulb', color: '#ffcf8a', intensity: 1.2, range: 11 });
m.light([24, 0.4, 45], { fixture: 'strip', color: '#ffe2b0', intensity: 1.3, range: 8 });
m.bounds('invisible');
m.meta({
  description:
    'A co-op creature-survival night in an abandoned theatre. Hold the lobby as the things come over the courtyard walls, clear the foyer, take the auditorium, throw the power on the stage and survive a minute of everything the theatre has — then escape through the projection booth behind the curtain.',
  modes: ['core.coop'],
  players: [1, 4],
});
await m.save();
