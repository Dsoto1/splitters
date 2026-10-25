/**
 * Blackout: a co-op night raid on a city block (1–4 players). Fight up the
 * street through the Syndicate checkpoint, clear the substation (the
 * warehouse) and set the charges, hold it while the Syndicate counter-attack
 * from the north and the west, then fight through to evac at the gas station.
 *
 * - The checkpoint: barriers across the crossroads, with a sandbagged bunker
 *   on the west corner. The shop (west) and the house (east) are side routes
 *   up from the start.
 * - The substation: the warehouse, a hall with a mezzanine; the guards hold
 *   the floor, the charges go by the transformers.
 * - Evac: the gas station on the north-west corner, guarded when you get there.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y8  .   .   |   .   .   .      north wave
 *   y7  G   G   |   .   .   .      G gas station (evac)
 *   y6  G   G   |   W   W   W      W warehouse (the substation)
 *   y5  .   .   |   W   W   W      west wave from (0,5)
 *   y4  B   B   |   .   .   .      B bunker
 *   y3  =   =   +   =   =   =      checkpoint at the crossroads
 *   y2  .   .   |   .   .   .
 *   y1  S   S   |   H   H   .      S shop, H house
 *   y0  .   .   |   H   H   .      start
 *       0   1   2   3   4   5
 */
import type { ScenarioLogic } from '@chronosplit/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('blackout', 'Blackout');
m.theme('city');
m.backdrop('night', 'city', 'gravel', 0.55);
m.factions([{ id: 'syndicate', name: 'Syndicate', color: '#d04a3a', relations: {} }]);
const P = Math.PI / 2;
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

// ---------------------------------------------------------------- the block
m.tile('shop', 0, 1);
m.tile('house', 3, 0);
m.tile('bunker', 0, 4);
m.tile('warehouse', 3, 5);
m.tile('gas_station', 0, 6);
const built = new Set(['0,1', '1,1', '3,0', '4,0', '3,1', '4,1', '0,4', '1,4', '3,5', '4,5', '5,5', '3,6', '4,6', '5,6', '0,6', '1,6', '0,7', '1,7']);
for (let x = 0; x <= 5; x++) for (let y = 0; y <= 8; y++) {
  if (built.has(`${x},${y}`)) continue;
  if (x === 2 && y === 3) m.tile('intersection', x, y);
  else if (x === 2) m.tile('street', x, y, 0, 0);
  else if (y === 3) m.tile('street', x, y, 0, 1);
  else m.tile('yard', x, y);
}

// ---------------------------------------------------------------- the checkpoint: barriers and a burnt-out car
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
function car(cx: number, cz: number, ns: boolean, tint: string): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', { material: 'paint_gloss', tint: '#1c2228' });
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
car(14.5, 9, true, '#3a3a3a');
car(17.6, 46, true, '#7a2a24');
car(28, 22.5, false, '#2a4a7a');
car(9, 25.5, false, '#33302c'); // burnt out
m.prop('barrier', [13, 0, 21], 0).prop('barrier', [19, 0, 21], 0).prop('barrier_high', [16, 0, 28.5], 0).prop('barrier', [22, 0, 27], P);
m.prop('warning_sign', [11, 0, 20]).prop('cone', [15, 0, 19.5], 0, 1, false).prop('cone', [17.5, 0, 19.5], 0, 1, false);
m.prop('lightpost', [-2.5, 0, 14], 0).prop('lightpost', [42.5, 0, 30], 0).prop('lightpost', [42.5, 0, 60], 0).prop('lightpost', [12, 0, 68.5], 0);
// Round the substation: crates, a skip, transformers (generators) inside.
m.prop('skip', [26, 0, 34], 0).prop('cargo_crate', [36, 0, 34], 0.3).prop('crate_large', [42, 0, 36]).prop('barrel', [27, 0, 60]).prop('barrel', [28, 0, 61]);
m.breakable('generator', [36, 0, 45.5], 0).breakable('gas', [40, 0, 62]);
m.prop('trashcan', [-1.5, 0, 18]).prop('cardboard_box', [5, 0, 18]).prop('dungeon_barrel', [41, 0, 18]).prop('shopping_cart', [38, 0, 2], 0.5);
m.prop('bush_large', [-2, 0, 66]).prop('tree_round', [42, 0, 10]).prop('tree_round', [-2, 0, 36]);

// ---------------------------------------------------------------- players and supplies
for (const [x, z] of [[14, -2], [18, -2], [14, 2], [18, 2]] as const) m.spawn([x, 0, z], 0, null);
m.pickup('weapon_smg', at(1, 0)).pickup('ammo', at(5, 0)).pickup('armor_small', at(1, 2)).pickup('grenades', at(4, 2));
m.pickup('weapon_shotgun', at(0, 1, 0, 3.6, 0)).pickup('health_small', at(3, 1, 1, 0, 0)); // in the shop; upstairs in the house
m.pickup('weapon_rifle', at(3, 4)).pickup('health_large', at(5, 4)).pickup('ammo_rifle', at(0, 5)).pickup('armor_large', at(4, 6, 1, 0, 2));
m.pickup('ammo', at(2, 6)).pickup('health_small', at(5, 7)).pickup('weapon_rockets', at(4, 8), 60).pickup('ammo_shells', at(3, 8));

// ---------------------------------------------------------------- the Syndicate
const enc = (id: string, name: string, pos: [number, number, number], roster: { trooper: number; gunner: number; heavy: number }, o: { order: 'hold' | 'attack'; start: boolean; cap?: number; reinforcements?: number; perPlayer?: number }) =>
  m.add({
    kind: 'encounter',
    id,
    name,
    position: pos,
    yaw: Math.PI,
    faction: 'syndicate',
    roster,
    activeCap: o.cap ?? 4,
    reinforcements: o.reinforcements ?? 0,
    perPlayer: o.perPlayer ?? 1,
    respawnSeconds: 5,
    radius: 3,
    order: o.order,
    orderTarget: null,
    startActive: o.start,
    difficulty: 'normal',
  });
enc('enc_checkpoint', 'Checkpoint', [16, 0, 30], { trooper: 3, gunner: 1, heavy: 0 }, { order: 'hold', start: true });
enc('enc_bunker', 'Bunker', [4, 0, 32], { trooper: 2, gunner: 0, heavy: 0 }, { order: 'hold', start: true, perPlayer: 0 });
enc('enc_substation', 'Substation guards', [32, 0, 42], { trooper: 2, gunner: 1, heavy: 1 }, { order: 'hold', start: true });
enc('enc_wave_north', 'North wave', [36, 0, 64], { trooper: 2, gunner: 1, heavy: 0 }, { order: 'attack', start: false, reinforcements: 6, perPlayer: 2 });
enc('enc_wave_west', 'West wave', [0, 0, 40], { trooper: 1, gunner: 0, heavy: 1 }, { order: 'attack', start: false, reinforcements: 4 });
enc('enc_evac', 'Evac guards', [4, 0, 62], { trooper: 2, gunner: 1, heavy: 1 }, { order: 'hold', start: false });

m.add({ kind: 'button', id: 'btn_charges', name: 'Charges', position: [30, 0, 45.5], yaw: Math.PI, label: 'Set the charges', once: true, cooldownSeconds: 1, startEnabled: false });
m.add({ kind: 'zone', id: 'zone_substation', name: 'Substation', position: [32, 0, 44], size: [16, 3, 7], who: 'any', count: 1, startEnabled: true });
m.add({ kind: 'zone', id: 'zone_evac', name: 'Evac point', position: [4, 0, 52], size: [8, 3, 8], who: 'any', count: 1, startEnabled: true });

// ---------------------------------------------------------------- the mission
type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const say = (text: string, seconds = 4) => act('message', null, { value: seconds, text });
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = [], once = true) =>
  ({ id, name, enabled: true, once, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const win = [say('Evac! Mission complete.'), act('wait', null, { value: 2 }), act('end_round', null, { state: 'players win' })];

m.logic({
  variables: [{ id: 'var_lives', name: 'lives', initial: 15 }],
  timers: [{ id: 'timer_charges', name: 'Charges', seconds: 50, loop: false, visible: true }],
  objectives: [
    { id: 'obj_checkpoint', text: 'Break through the checkpoint', startActive: true, marker: 'enc_checkpoint' },
    { id: 'obj_substation', text: 'Clear the substation', startActive: false, marker: 'enc_substation' },
    { id: 'obj_charges', text: 'Set the charges', startActive: false, marker: 'btn_charges' },
    { id: 'obj_hold', text: 'Hold the substation until the charges blow', startActive: false, marker: 'zone_substation' },
    { id: 'obj_evac', text: 'Clear the gas station and reach evac', startActive: false, marker: 'zone_evac' },
  ],
  rules: [
    rule('rule_intro', 'Briefing', 'match_start', null, [say('Lights out on the whole district. Get through the checkpoint to the substation.', 5)]),
    rule('rule_checkpoint', 'Checkpoint broken', 'encounter_cleared', 'enc_checkpoint', [
      act('objective', 'obj_checkpoint', { state: 'complete' }),
      act('objective', 'obj_substation', { state: 'active' }),
      say('Checkpoint down. The substation is the warehouse up the street.'),
    ]),
    rule('rule_substation', 'Substation cleared', 'encounter_cleared', 'enc_substation', [
      act('objective', 'obj_substation', { state: 'complete' }),
      act('enable', 'btn_charges'),
      act('objective', 'obj_charges', { state: 'active' }),
      say('Substation clear. Set the charges by the transformers.'),
    ]),
    rule('rule_charges', 'Charges set: the counter-attack', 'button_pressed', 'btn_charges', [
      act('objective', 'obj_charges', { state: 'complete' }),
      act('objective', 'obj_hold', { state: 'active' }),
      act('sound', null, { state: 'alarm' }),
      say('Charges set! Hold the substation until they blow.'),
      act('timer_start', 'timer_charges'),
      act('wait', null, { value: 3 }),
      act('encounter_start', 'enc_wave_north'),
      act('wait', null, { value: 8 }),
      act('encounter_start', 'enc_wave_west'),
    ]),
    rule('rule_hold_empty', 'Substation unguarded', 'zone_exit', 'zone_substation', [say('Get back to the substation!', 2)], [cond('zone_count', 'zone_substation', '==', 0), cond('objective', 'obj_hold', '==', 0, 'active')], false),
    rule('rule_blown', 'Charges blow: go to evac', 'timer_done', 'timer_charges', [
      act('encounter_stop', 'enc_wave_north'),
      act('encounter_stop', 'enc_wave_west'),
      act('objective', 'obj_hold', { state: 'complete' }),
      act('objective', 'obj_evac', { state: 'active' }),
      act('encounter_start', 'enc_evac'),
      act('sound', null, { state: 'chime' }),
      say('The grid is down! Evac at the gas station, and it is guarded.'),
    ]),
    rule('rule_evac_walk', 'Reach evac when clear', 'zone_enter', 'zone_evac', [act('objective', 'obj_evac', { state: 'complete' }), ...win], [cond('encounter_alive', 'enc_evac', '==', 0), cond('objective', 'obj_evac', '==', 0, 'active')]),
    rule('rule_evac_clear', 'Clear while at evac', 'encounter_cleared', 'enc_evac', [act('objective', 'obj_evac', { state: 'complete' }), ...win], [cond('zone_count', 'zone_evac', '>=', 1)]),
    rule('rule_evac_hot', 'Evac still hot', 'zone_enter', 'zone_evac', [say('Clear the gas station first!', 2)], [cond('encounter_alive', 'enc_evac', '>', 0)], false),
    rule('rule_evac_ready', 'Evac clear', 'encounter_cleared', 'enc_evac', [say('Evac is clear. Get under the canopy!', 3)], [cond('zone_count', 'zone_evac', '==', 0)]),
    rule('rule_life_lost', 'Count lives', 'player_killed', null, [act('add_var', 'var_lives', { value: -1 })], [], false),
    rule('rule_low_lives', 'Low on lives', 'variable_changed', 'var_lives', [say('Only 3 lives left!', 3), act('sound', null, { state: 'buzzer' })], [cond('variable', 'var_lives', '==', 3)]),
    rule('rule_defeat', 'Out of lives', 'variable_changed', 'var_lives', [say('Out of lives. Mission failed.'), act('end_round', null, { state: 'players lose' })], [cond('variable', 'var_lives', '<=', 0)]),
  ],
});

m.bounds('invisible');
m.meta({
  description:
    'A co-op night raid on a blacked-out city block. Fight up the street through the Syndicate checkpoint (or round it through the shop and the house), clear the substation and set the charges, hold it against the counter-attack from the north and the west until they blow, then take the gas station for evac.',
  modes: ['core.coop'],
  players: [1, 4],
});
await m.save();
