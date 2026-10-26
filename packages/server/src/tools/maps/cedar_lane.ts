/**
 * Cedar Lane: the demo map of Style Pack 08 Suburban Chaos (our own map and
 * name), for 4–14 players in Deathmatch, Team Deathmatch and King of the
 * Hill. A sunny afternoon on a suburban street: three family houses and two
 * garages, a corner store and a gas station across the road, back yards with
 * barbecues and board fences, a swimming pool, a playground and a carport.
 *
 * - Garage doors: up-and-over doors on both garages, worked from a button in
 *   the garage and one by the drive (or from the house next door).
 * - Fences: white picket fences along the front yards break when shot and
 *   come back after a while.
 * - Appliances: microwaves, barbecues, propane tanks, petrol pumps and the
 *   family cars all go off when shot; fridges and washing machines break.
 * - The pool: dive in from the board; a trampoline (a jump pad) behind the
 *   store throws you up onto its flat roof (the rocket launcher is up there).
 *
 * Grid x east, y north (one cell = 8 m):
 *
 *   y2   yard  yard  yard  yard  yard  POOL  playground
 *   y1   HOUSE A     GAR   HOUSE B     POOL  carport
 *   y0   ===== Cedar Lane (street) ========================
 *   y-1  STORE       GAS STATION HOUSE C     GAR
 *   y-2  yard  yard  (2 × 2)     yard  yard  yard
 *        x -3  -2    -1    0     1     2     3
 */
import type { LogicAction, LogicRule } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('cedar_lane', 'Cedar Lane');
m.theme('suburban');
m.backdrop('clear', 'hills', 'grass', 0.35);
m.teams([7, 7]);
const [WEST, EAST] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];

// ---------------------------------------------------------------- tiles

for (let x = -3; x <= 3; x++) m.tile('suburban.street', x, 0, 0);
// North side: two houses and a garage facing the street, back yards behind, the pool and a playground.
m.tile('suburban.house', -3, 1, 0);
m.tile('suburban.garage', -1, 1, 0);
m.tile('suburban.house', 0, 1, 0);
m.tile('suburban.pool', 2, 1, 0);
m.tile('yard', 3, 1, 0);
for (let x = -3; x <= 1; x++) m.tile('suburban.backyard', x, 2, 0);
m.tile('suburban.playground', 3, 2, 0);
// South side, facing north: the store, the gas station, a house and its garage, yards behind.
m.tile('suburban.store', -2, -1, 0, 2);
m.tile('suburban.gas_station', 0, -1, 0, 2);
m.tile('suburban.house', 2, -1, 0, 2);
m.tile('suburban.garage', 3, -1, 0, 2);
for (const x of [-3, -2]) m.tile('yard', x, -2, 0);
for (const x of [1, 2]) m.tile('suburban.backyard', x, -2, 0, 2);
m.tile('yard', 3, -2, 0);

// ---------------------------------------------------------------- garage doors

/** An up-and-over door in a garage's 3.6 m opening: hinged at its top, it swings up level into the garage when sent. */
function garageDoor(id: string, x: number, y: number, facingNorth: boolean): void {
  // The opening's face is 3.8 m from the cell centre; the door hangs just outside it.
  const z = facingNorth ? y * 8 + 3.95 : y * 8 - 3.95;
  const yaw = facingNorth ? 0 : S; // the mover's -Z (where the door swings) points into the garage
  m.block([x * 8, 0, r2(z)], [3.6, 2.8, 0.2], 'solid', { material: 'pbr_white_panel', tint: '#f0eee8', yaw, id: `${id}_panel` });
  m.mover(id, [x * 8, 2.8, r2(z)], [`${id}_panel`], [[0, 0, 0], [0, 0, 0]], { mode: 'trigger', angles: [0, -P], turnSpeed: 60, wait: 0, yaw, name: 'Garage door' });
}
garageDoor('garage_door_n', -1, 1, false);
garageDoor('garage_door_s', 3, -1, true);
m.add({ kind: 'button', id: 'btn_garage_n_in', name: 'Garage button', position: at(-1, 1, 0, 3.5, -1.0, 1.2), yaw: -P, label: 'Garage door', once: false, cooldownSeconds: 3, startEnabled: true });
m.add({ kind: 'button', id: 'btn_garage_n_out', name: 'Drive keypad', position: at(-1, 0, 0, 2.6, 3.0, 1.2), yaw: 0, label: 'Garage door', once: false, cooldownSeconds: 3, startEnabled: true });
m.add({ kind: 'button', id: 'btn_garage_s_in', name: 'Garage button', position: at(3, -1, 0, -3.5, 1.0, 1.2), yaw: P, label: 'Garage door', once: false, cooldownSeconds: 3, startEnabled: true });
m.add({ kind: 'button', id: 'btn_garage_s_out', name: 'Drive keypad', position: at(3, 0, 0, -2.6, -3.0, 1.2), yaw: S, label: 'Garage door', once: false, cooldownSeconds: 3, startEnabled: true });

// ---------------------------------------------------------------- breakable fences, a carport roof, the pool

for (const x of [-3, -2, 0, 1]) m.block(at(x, 1, 0, x === -3 || x === 0 ? -1.8 : 1.8, -4.4), [3.6, 1.1, 0.2], 'breakable', { material: 'paint_matte', tint: '#f2f0ea', health: 40, respawn: 25 });
for (const x of [1, 2]) m.block(at(x, -1, 0, x === 1 ? 1.8 : -1.8, 4.4), [3.6, 1.1, 0.2], 'breakable', { material: 'paint_matte', tint: '#f2f0ea', health: 40, respawn: 25 });
// The carport: four posts and a slate gable on pitched blocks.
for (const [dx, dy] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]] as const) m.block(at(3, 1, 0, dx, dy), [0.25, 2.6, 0.25], 'solid', { material: 'paint_matte', tint: '#f2f0ea' });
for (const sgn of [-1, 1]) m.block(at(3, 1, 0, 0, sgn * 1.65, 2.95), [6.2, 0.2, 3.9], 'solid', { material: 'pbr_slate_roof', pitch: -sgn * 0.5 });
m.water(at(2, 1, 0, 0, 4, -1.8), [3.6, 1.6, 12], 'water', '#3fc8e8');

// ---------------------------------------------------------------- appliances, cars and the rest

// Kitchens (east half of each north house; west half of the south house): microwave, fridge, washer.
for (const [x, y, dx, dz, yaw] of [[-2, 1, 3.1, -2.2, -P], [1, 1, 3.1, -2.2, -P]] as const) {
  m.prop('sb_microwave', at(x, y, 0, dx + 0.1, dz, 0.95), yaw).prop('sb_fridge', at(x, y, 0, 3.1, 0.9), -P).prop('sb_washing_machine', at(x, y, 0, -2.2, -3.0), 0);
}
m.prop('sb_microwave', at(1, -1, 0, -3.1, 2.2, 0.95), P).prop('sb_fridge', at(1, -1, 0, -3.1, -0.9), P);
// Living rooms: TVs.
m.prop('sb_tv_flat', at(-3, 1, 0, -1.2, -3.2), 0).prop('sb_tv_flat', at(0, 1, 0, -1.2, -3.2), 0).prop('sb_tv_flat', at(2, -1, 0, 1.2, 3.2), S);
// Back yards: barbecues, propane, patio sets, a lawnmower, gnomes, a trampoline.
m.prop('sb_bbq_grill', at(-3, 2, 0, -1.5, 1.0), 0).prop('sb_propane_tank', at(-3, 2, 0, -3.2, 2.6), 0).prop('sb_patio_set', at(-2, 2, 0, 0, 0), 0);
m.prop('sb_bbq_grill', at(0, 2, 0, 1.5, 1.2), 0.2).prop('sb_lawnmower', at(1, 2, 0, -2, -1.5), 0.6).prop('sb_garden_gnome', at(1, 2, 0, 2.5, 2.4), S).prop('sb_garden_gnome', at(-2, 2, 0, -3, 2.5), S);
m.prop('sb_trampoline', at(-2, -2, 0, -4, -1), 0, 1, false);
m.padTo(at(-2, -2, 0, -4, -1, 0), at(-2, -1, 0, -4, -0.5, 4.5), 14);
m.prop('sb_bbq_grill', at(2, -2, 0, -1.5, -1.2), S).prop('sb_propane_tank', at(1, -2, 0, -3, -2.8), 0).prop('sb_patio_set', at(1, -2, 0, 1, 0), 0).prop('sb_swing_set', at(3, -2, 0, 0, -1), 0, 1, false);
// The pool deck and playground.
m.prop('sb_sun_lounger', at(2, 2, 0, -2.4, 3.2), P).prop('sb_sun_lounger', at(2, 2, 0, 2.4, 3.2), -P).prop('sb_slide', at(3, 2, 0, 2.5, 2.4), S, 1, false).prop('sb_basketball_hoop', at(3, 1, 0, 3.3, -3.4), -P);
// Driveways and the street: family cars, mailboxes, bins, a hydrant, the ice-cream truck.
m.prop('sb_sedan', at(2, 0, 0, 0, -1.6), P).prop('sb_sedan', at(-2, 0, 0, 1, 1.6), -P);
for (const [x, y, dx, dy] of [[-3, 1, 2.6, -4.9], [0, 1, 2.6, -4.9], [2, -1, -2.6, 4.9]] as const) m.prop('sb_mailbox', at(x, y, 0, dx, dy), y > 0 ? S : 0);
m.prop('sb_wheelie_bin', at(-2, 1, 0, 3.4, -4.9), 0).prop('sb_wheelie_bin', at(1, 1, 0, 3.4, -4.9), 0.3).prop('sb_fire_hydrant', at(1, 0, 0, 0, 3.3), 0).prop('sb_fire_hydrant', at(-2, 0, 0, 0, -3.3), 0);
// The gas station: pumps on the islands, propane racks, the kiosk counter.
for (const [dx, dz] of [[-1.5, -1.5], [-1.5, -3.5], [-6.5, -1.5], [-6.5, -3.5]] as const) m.prop('sb_gas_pump', [dx, 0.15, -8 + dz], P);
m.prop('sb_propane_tank', [-10.5, 0, -18.5], 0).prop('sb_propane_tank', [-11.2, 0, -18.2], 0.4).prop('dumpster', at(-3, -2, 0, -2, -2.5), 0.2);
m.mount('ice_cream_truck', at(-1, 0, 0, 0, 1.4), P);

// ---------------------------------------------------------------- light

for (const x of [-3, -1, 1, 3]) m.light(at(x, 0, 0, 0, 3.4, 4.5), { fixture: 'none', color: '#fff0d0', intensity: 0.9, range: 12 });
for (const [x, y, up] of [[-3, 1, 3.6], [-2, 1, 3.6], [0, 1, 3.6], [1, 1, 3.6], [1, -1, 3.6], [2, -1, 3.6], [-3, 1, 7.6], [0, 1, 7.6], [2, -1, 7.6], [-1, 1, 3.3], [3, -1, 3.3]] as const) m.light(at(x, y, 0, 0, 0, up), { fixture: 'ceiling', color: '#fff4e0', intensity: 0.9, range: 9 });
for (const x of [-3, -2]) m.light(at(x, -1, 0, 0, 0, 4.0), { fixture: 'ceiling', color: '#eef6ff', intensity: 1, range: 10 });
m.light(at(-1, -2, 0, 4, 4, 4.8), { fixture: 'ceiling', color: '#eef6ff', intensity: 1.1, range: 14 });
for (const [x, y, dx, dy, yaw] of [[-3, 1, 1, -4.0, S], [0, 1, 1, -4.0, S], [2, -1, -1, 4.0, 0]] as const) m.light(at(x, y, 0, dx, dy, 2.8), { fixture: 'wall', color: '#ffd8a0', intensity: 0.8, range: 7, yaw });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Cedar Lane. Everything with a plug or a gas bottle goes bang.', 4)]),
    ...(['btn_garage_n_in', 'btn_garage_n_out'] as const).map((b) => rule(`rule_${b}`, 'North garage door', { event: 'button_pressed', target: b }, [act('sound', null, { state: 'buzzer' }), act('mover_go', 'garage_door_n')])),
    ...(['btn_garage_s_in', 'btn_garage_s_out'] as const).map((b) => rule(`rule_${b}`, 'South garage door', { event: 'button_pressed', target: b }, [act('sound', null, { state: 'buzzer' }), act('mover_go', 'garage_door_s')])),
  ],
});

// ---------------------------------------------------------------- spawns, pickups, objectives

for (const [p, yaw] of [
  [at(-3, 2, 0, -1, -1), P], [at(-2, 2, 0, 1, -1), P], [at(-3, -2, 0, 0, 1), P], [at(-2, -2, 0, -2, 2), P], [at(-3, 0, 0, -2, 0), P], [at(-3, 1, 0, -1.5, 0), P], [at(-3, -1, 0, -2, 0), P],
] as [V3, number][]) m.spawn(p, yaw, WEST);
for (const [p, yaw] of [
  [at(3, 2, 0, 1, -1.5), -P], [at(3, -2, 0, 0, 0), -P], [at(2, -2, 0, 0, -2.5), -P], [at(3, 0, 0, 2, 0), -P], [at(1, 2, 0, 2, -1), -P], [at(3, 1, 0, 0, -2.8), -P], [at(1, -1, 0, 1, -1), -P],
] as [V3, number][]) m.spawn(p, yaw, EAST);
for (const [p, yaw] of [
  [at(0, 0, 0, 0, 0), 0], [at(-1, 0, 0, -2, -2), 0], [at(2, 0, 0, 0, 2), S], [at(-1, 2, 0, 2.5, 2), S], [at(0, 2, 0, -2, -1), S], [at(-1, -1, 0, -4, 4), 0], [at(2, 2, 0, -3.3, -1), S], [at(0, 1, 0, 1, 0, 4), S],
] as [V3, number][]) m.spawn(p, yaw, null);

m.pickup('weapon_launcher', at(-2, -1, 0, -4, 0.5, 4.5), 40).pickup('weapon_shotgun', at(-3, 1, 0, 1.5, 0, 4)).pickup('weapon_smg', at(-2, -1, 0, 0, -1)).pickup('weapon_burst_rifle', at(0, -1, 0, -2, 3));
m.pickup('weapon_rifle', at(3, 2, 0, -2, -1)).pickup('weapon_shotgun', at(2, -1, 0, 1, 0, 4)).pickup('grenades', at(-1, 1, 0, 0, 0)).pickup('grenades', at(3, -1, 0, 0, 0));
m.pickup('armor_large', at(2, 1, 0, 0, 4, -1.8), 40).pickup('armor_small', at(-3, 2, 0, 2, 1)).pickup('health_large', at(0, 1, 0, -2, 2, 4)).pickup('health_small', at(-1, -2, 0, 2, 3.4));
m.pickup('health_small', at(1, 2, 0, 0, 1)).pickup('health_small', at(3, -2, 0, 2, 2)).pickup('ammo', at(-3, 0, 0, 0, -2)).pickup('ammo', at(3, 0, 0, 0, 2));
m.hill(at(0, 0, 0, 0, 0), 5);
m.hill(at(2, 1, 0, 0, -2.4), 3);
m.hill(at(-1, -1, 0, -4, 4), 4);

m.bounds('invisible', 4);
m.border('forest');
m.meta({
  description:
    'A sunny afternoon on a suburban street, built from the Suburban Chaos style pack: clapboard family houses under slate gables, garages with up-and-over doors (buttons inside and keypads by the drive), a corner store and a gas station across the road, back yards with barbecues, a swimming pool, a playground and a carport. Picket fences splinter, and microwaves, barbecues, propane tanks, petrol pumps and the family cars all go off when shot.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [4, 14],
});
await m.save();
