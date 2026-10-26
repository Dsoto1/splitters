/**
 * Iron Compound: the demo map for Style Pack 01 Military Compound. A walled
 * compound (barracks, a command bunker, an armoury pillbox, a vehicle shed,
 * a helipad, two guard towers with mounted guns and a catwalk gantry onto the
 * barracks roof) faces a line of trenches across the no-man's land to the
 * south. The main gate is a blast door worked from a button inside, with
 * alarm lights that blink while it stands open; the east gate is open; the
 * north gate's blast door opens for anyone who walks up to it. Concrete
 * barriers and gabion walls break under fire.
 *
 * Grid x east, y north (one cell = 8 m):
 *
 *   y 8   ┌──────────── G ────────────┐   compound wall, north gate
 *   y 7   │ bk bk  .   bunker  .  T2  │   barracks, command bunker, tower
 *   y 6   │ (barracks) . (bunker)  .  │
 *   y 5   │  .  gantry  .  hut  .  .  │
 *   y 4   │  .  gantry  helipad   .  G   east gate (open)
 *   y 3   │  .  .  .   helipad    .  │
 *   y 2   │  .  pillbox .  .  .  .  . │
 *   y 1   │ T1  .  gatehouse  shed    │
 *   y 0   └──────────── G ────────────┘   main gate (blast door)
 *   y-1      sandbags     mouth   nest
 *   y-2    ═══ trench line (T junction under the gate) ═══
 *   y-3..-4   no-man's land, the attackers' spawns
 *          x 0  1  2  3  4  5  6  7  8  9
 */
import type { ScenarioLogic } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('iron_compound', 'Iron Compound');
m.theme('military');
m.backdrop('clear', 'hills', 'dirt', 0.45);
m.teams([8, 8]);
const [garrison, raiders] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const C = 8; // cell size

// ---------------------------------------------------------------- the compound wall

for (let x = 1; x <= 7; x++) {
  if (x !== 4) m.tile('military.wall', x, 0, 0, 2);
  if (x !== 4) m.tile('military.wall', x, 8, 0, 0);
}
for (let y = 1; y <= 7; y++) {
  m.tile('military.wall', 0, y, 0, 3);
  if (y !== 4) m.tile('military.wall', 8, y, 0, 1);
}
m.tile('military.wall_corner', 8, 8, 0, 0);
m.tile('military.wall_corner', 8, 0, 0, 1);
m.tile('military.wall_corner', 0, 0, 0, 2);
m.tile('military.wall_corner', 0, 8, 0, 3);
m.tile('military.gate', 4, 0, 0, 2); // main gate, south
m.tile('military.gate', 4, 8, 0, 0); // north gate
m.tile('military.gate', 8, 4, 0, 1); // east gate

// ---------------------------------------------------------------- inside

m.tile('military.barracks', 1, 6, 0, 0); // cells (1,6), (2,6); door south
m.tile('core.bunker', 5, 6, 0, 0); // command bunker: cells (5,6), (6,6)
m.tile('military.guard_tower', 1, 1, 0, 0);
m.tile('military.guard_tower', 7, 7, 0, 2);
m.tile('military.pillbox', 2, 2, 0, 0); // the armoury, door south
m.tile('military.vehicle_shed', 6, 1, 0, 2); // cells (6,1), (5,1); open to the north
m.tile('military.helipad', 4, 3, 0, 0); // cells (4..5, 3..4)
m.tile('military.gantry', 2, 4, 0, 0); // cells (2,4), (2,5): up onto the barracks roof
// The gatehouse and the comms hut: rooms dressed in the pack's facades.
m.tile('core.room', 3, 1, 0, 0, { facade: 'concrete', ceiling: 'roof', layout: 'empty' });
m.tile('core.room', 6, 5, 0, 0, { facade: 'corrugated', ceiling: 'roof', layout: 'empty' });
m.edge(3, 1, 0, 'E', 'door');
m.edge(3, 1, 0, 'N', 'windows');
m.edge(3, 1, 0, 'W', 'window');
m.edge(6, 5, 0, 'S', 'door');
m.edge(6, 5, 0, 'W', 'window');
m.edge(6, 5, 0, 'N', 'door');
// Command bunker doors: west and south.
m.edge(5, 6, 0, 'S', 'door');
m.edge(5, 6, 0, 'W', 'door');
m.edge(6, 6, 0, 'E', 'door');
m.edge(2, 2, 0, 'S', 'door');
m.edge(1, 6, 0, 'S', 'door');
m.edge(2, 6, 0, 'E', 'door');

// Open ground everywhere else inside, and round the outside.
const used = new Set<string>();
const mark = (x0: number, y0: number, x1: number, y1: number) => {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) used.add(`${x},${y}`);
};
for (const t of m.doc.classicStructure.tiles) used.add(`${t.x},${t.y}`);
mark(1, 6, 2, 6);
mark(5, 6, 6, 6);
mark(5, 1, 6, 1);
mark(4, 3, 5, 4);
mark(2, 4, 2, 5);

// ---------------------------------------------------------------- outside: the trench line

// West mouth, straights, a fire step, the junction under the gate, the dugout, east mouth.
m.tile('military.trench_end', 0, -2, 0, 3);
m.tile('military.trench', 1, -2, 0, 1);
m.tile('military.trench_steps', 2, -2, 0, 1);
m.tile('military.trench', 3, -2, 0, 1);
m.tile('military.trench_t', 4, -2, 0, 2);
m.tile('military.trench_end', 4, -1, 0, 0); // a mouth up toward the gate
m.tile('military.trench', 5, -2, 0, 1);
m.tile('military.trench_dugout', 6, -2, 0, 1);
m.tile('military.trench_steps', 7, -2, 0, 3);
m.tile('military.trench_end', 8, -2, 0, 1);
mark(0, -2, 8, -2);
mark(4, -1, 4, -1);

for (let x = -1; x <= 9; x++) for (let y = -4; y <= 9; y++) if (!used.has(`${x},${y}`)) m.tile('core.yard', x, y);

// ---------------------------------------------------------------- gameplay pieces

// Main gate: a blast door worked from the gatehouse; alarm lights blink while it stands open.
m.add({ kind: 'door', id: 'gate_main', name: 'Main gate', position: [4 * C, 0, -3.4], yaw: 0, startOpen: false, locked: false, auto: false, style: 'blast' });
m.add({ kind: 'button', id: 'btn_gate', name: 'Gate control', position: [3 * C + 3, 0, 1 * C - 3.2], yaw: 0, label: 'Open / close the main gate', once: false, cooldownSeconds: 3, startEnabled: true });
m.add({ kind: 'button', id: 'btn_gate_out', name: 'Gate intercom', position: [4 * C - 3.2, 0, -3.95], yaw: Math.PI, label: 'Open / close the main gate', once: false, cooldownSeconds: 3, startEnabled: true });
m.light([4 * C - 2.6, 5.4, -3.4], { id: 'alarm_w', fixture: 'bulb', color: '#ff3020', intensity: 1.6, range: 12, off: true, blink: 2.5 });
m.light([4 * C + 2.6, 5.4, -3.4], { id: 'alarm_e', fixture: 'bulb', color: '#ff3020', intensity: 1.6, range: 12, off: true, blink: 2.5 });
// North gate: a blast door that opens for anyone who walks up. The armoury: one that opens for the garrison only.
m.add({ kind: 'door', id: 'gate_north', name: 'North gate', position: [4 * C, 0, 8 * C + 3.4], yaw: 0, startOpen: false, locked: false, auto: true, style: 'blast' });
m.add({ kind: 'door', id: 'door_armoury', name: 'Armoury door', position: [2 * C, 0, 2 * C - 4], yaw: 0, startOpen: false, locked: false, auto: true, style: 'blast', team: garrison });

type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = []) => ({ id, name, enabled: true, once: false, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const gateRules = (btn: string) => [
  rule(`rule_${btn}_open`, `${btn}: open the gate`, 'button_pressed', btn, [act('door_open', 'gate_main'), act('light_on', 'alarm_w'), act('light_on', 'alarm_e'), act('sound', null, { state: 'alarm' }), act('message', null, { value: 3, text: 'The main gate is opening!' })], [cond('door', 'gate_main', '==', 0, 'closed')]),
  rule(`rule_${btn}_shut`, `${btn}: close the gate`, 'button_pressed', btn, [act('door_close', 'gate_main'), act('light_off', 'alarm_w'), act('light_off', 'alarm_e'), act('sound', null, { state: 'buzzer' })], [cond('door', 'gate_main', '==', 0, 'open')]),
];
m.logic({ variables: [], timers: [], objectives: [], rules: [...gateRules('btn_gate'), ...gateRules('btn_gate_out')] });

// Mounted guns: one on each tower lookout, one in a sandbag nest covering the gate approach.
m.mount('turret_mg', [1 * C + 1.4, 3, 1 * C + 2.2], Math.PI, garrison);
m.mount('turret_mg', [7 * C - 1.4, 3, 7 * C - 2.2], 0, garrison);
m.prop('sandbag_nest', [6 * C, 0, -1 * C + 0.8], Math.PI);
m.mount('turret_mg', [6 * C, 0, -1 * C + 1.6], Math.PI, garrison);
m.mount('gun_jeep', [5.5 * C, 0, 1 * C + 1], 0, garrison);
m.mount('armored_rover', [-0.5 * C, 0, -3.5 * C], P, raiders);

// Destructible barriers: concrete blocks and gabions in front of the gate, jersey barriers inside it.
for (const x of [3 * C, 5 * C]) m.block([x, 0, -1 * C - 2], [3, 1.1, 0.8], 'breakable', { material: 'pbr_bunker_panels', health: 400, respawn: 30 });
m.prop('hesco_wall', [2 * C, 0, -1 * C], 0).prop('hesco_wall', [7 * C, 0, -1 * C + 2], 0);
m.prop('jersey_barrier', [4 * C - 3, 0, 1 * C + 1], 0).prop('jersey_barrier_striped', [4 * C + 3, 0, 1 * C + 1], 0);
m.prop('jersey_barrier', [8 * C + 2, 0, 4 * C - 4], P).prop('jersey_barrier_broken', [9 * C, 0, 4 * C + 4], P);

// ---------------------------------------------------------------- dressing

// Sandbags and wire out front, hedgehogs and tank traps in no-man's land.
m.prop('sandbag_wall', [1.5 * C, 0, -1 * C + 1], 0).prop('sandbag_corner', [0.5 * C, 0, -1 * C + 1], 0).prop('sandbag_wall_low', [5 * C + 2, 0, -1 * C - 1], 0);
for (const [x, z] of [[1, -3.2], [3, -3.6], [5.5, -3.3], [7.5, -3.7]] as const) m.prop('hedgehog', [x * C, 0, z * C], x);
for (const [x, z] of [[2.2, -3], [6.4, -3], [-0.4, -2.6], [9.2, -2.6]] as const) m.prop('dragon_tooth', [x * C, 0, z * C], 0);
for (const x of [1.2, 3, 6.4]) m.prop('razor_wire', [x * C, 0, -2.6 * C], 0);
// Inside: containers, fuel, ammo, a camouflage net over the shed's apron, lights.
m.prop('shipping_container_red', [7 * C, 0, 3 * C], P).prop('shipping_container_green', [7 * C, 0, 3 * C - 3.2], P).prop('shipping_container_blue', [7 * C - 0.3, 2.6, 3 * C - 1.6], P);
m.prop('fuel_tank', [3 * C + 1, 0, 5 * C + 2], 0).prop('fuel_drum', [4 * C - 3, 0, 5 * C + 3]).prop('fuel_drum', [4 * C - 3.6, 0, 5 * C + 2.3]);
m.prop('ammo_stack', [2 * C - 2, 0, 2 * C + 1], 0).prop('ammo_crate', [2 * C + 2, 0, 2 * C + 2], 0.3);
m.prop('ammo_crate', [6 * C + 2, 0, 5 * C - 5], 1).prop('pallet', [5 * C - 2, 0, 5.5 * C], 0.2).prop('supply_truck', [7 * C, 0, 5 * C + 1], 0);
m.prop('camo_net', [3 * C + 1, 0, 3 * C], 0.2);
m.prop('floodlight', [1 * C - 3, 0, 4 * C], P).prop('floodlight', [7 * C + 3, 0, 1 * C + 3], -P).prop('floodlight', [4 * C + 5, 0, 7 * C + 2], Math.PI);
m.prop('road_barrier', [8 * C + 6, 0, 4 * C], P).prop('storage_tank', [-0.5 * C, 0, 6 * C], 0).prop('steel_water_tower', [9 * C + 1, 0, 8 * C + 1], 0);
m.prop('sv_tent', [-0.5 * C, 0, -3.5 * C + 6], 0).prop('ammo_crate', [1 * C, 0, -3.5 * C], 0).prop('flatbed_truck', [9 * C, 0, -3 * C], 0.4);

// ---------------------------------------------------------------- spawns, pickups, objectives

for (const [x, z] of [[1.2, 5.2], [2.6, 5.2], [3.4, 6.4], [5.4, 5.4], [6.2, 3.6], [3.2, 2.6], [5.8, 2.2], [1.4, 3.2]] as const) m.spawn([x * C, 0, z * C], Math.PI, garrison);
for (const [x, z] of [[0.2, -3.6], [1.6, -4.2], [3, -3.6], [4.6, -4.2], [6, -3.6], [7.4, -4.2], [8.6, -3.4], [9.4, -1]] as const) m.spawn([x * C, 0, z * C], 0, raiders);
for (const [x, z] of [[-0.6, 2], [9.4, 6], [4.6, 2.4], [-0.6, 8.6], [9.4, 1.8], [2.4, 7.6], [6.6, -0.6], [2.4, -0.6]] as const) m.spawn([x * C, 0, z * C], 0, null);
m.pickup('weapon_rockets', [2 * C, 0, 2 * C], 40).pickup('armor_large', [2 * C + 1.5, 0, 2 * C - 1.5], 40);
m.pickup('weapon_sniper', [7 * C - 3, 3, 7 * C - 1.2], 30).pickup('weapon_sniper', [1 * C + 3, 3, 1 * C + 1.2], 30);
m.pickup('weapon_rifle', [4 * C, 0, 5.6 * C]).pickup('weapon_lmg', [2 * C, 4.25, 6 * C], 30).pickup('sandbags', [6 * C, 0, -2 * C]);
m.pickup('grenades', [4 * C, 0, -2 * C]).pickup('mines', [1 * C, 0, -2 * C]).pickup('health_large', [4.75 * C, 0, 1.25 * C]).pickup('health_small', [7 * C, 0, -2 * C]);
m.pickup('ammo', [6 * C + 1, 0, 6 * C - 4]).pickup('ammo', [3 * C, 0, -3 * C]).pickup('airstrike', [6 * C, 0, 6 * C], 60).pickup('armor_small', [-0.5 * C, 0, 4 * C]);
m.hill([4.5 * C, 0.15, 3.5 * C], 6);
m.flag(garrison, [6.5 * C, 0, 7.5 * C], Math.PI).flag(raiders, [4.5 * C, 0, -3.75 * C], 0);
m.lightRooms({ color: '#e8f0ff', intensity: 1 });
m.bounds('invisible');
m.border('fence');
m.meta({
  description:
    'A walled military compound facing a trench line (Style Pack 01: Military Compound). The garrison holds the barracks, command bunker, armoury and two guard towers with mounted guns; the raiders come over the top from the trenches. The main gate is a blast door worked from a button, with alarm lights; the north gate opens for anyone; concrete barriers and gabions break under fire.',
  modes: ['core.tdm', 'core.deathmatch', 'core.koth', 'core.ctf'],
  players: [6, 16],
});
await m.save();
