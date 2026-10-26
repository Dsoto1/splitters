/**
 * Halcyon Station: the demo map of Style Pack 04 Orbital Station (our own map
 * and name), for 4–12 players in Deathmatch, Team Deathmatch and King of the
 * Hill. A research station hanging in space: a ring of white-panelled
 * corridors round a two-storey reactor hall, with the hangar bay to the south,
 * the control room north, the labs east and an airlock out onto an exterior
 * gantry west. Windows and viewports look out onto the stars everywhere.
 *
 * - Reactor hall (centre): the reactor core glows in the middle of a
 *   low-gravity zone (a third of normal gravity): jump from the floor to the
 *   catwalk ring round the walls, or from there to the inner ring round the
 *   core, where the railgun waits. Stairs on the east side for the earthbound.
 * - Hangar bay (south): a landing pad under a gantry, its mouth open to space
 *   behind a force field: shots go through it, people don't. The control
 *   room's "Vent the hangar" console drops the field for 6 s, with the alarm
 *   lights going: whoever is out on the pad edge had better step back.
 * - Labs (east): cryo pods and the hologram globe. The console inside seals
 *   the lab door with a force field for 12 s: the defenders can shoot out,
 *   nobody can get in.
 * - Airlock (west): auto doors either side of a short chamber, out onto the
 *   exterior gantry in a low-gravity zone (a quarter gravity): the satellite
 *   dish, the transmitter and a long, floaty fall if you jump the rail.
 * - Control room (north): the consoles, windows all round onto space.
 *
 * Grid x east, y north (one cell = 8 m); levels z0 (y 0) and z1 (4).
 *
 *   y  3          [ control ][ control ]
 *   y  2   [ring ][ ring    ][ ring    ][ring ]
 *   y  1 [G][ring ][ REACTOR  HALL      ][ring ][lab ]
 *   y  0 [G][air ][ring ][ (2 × 2, two storeys)][ring ][lab ]   G exterior gantry
 *   y -1   [ring ][ ring    ][ ring    ][ring ]
 *   y -2   [ HANGAR BAY (3 × 3, two storeys)   ]
 *   y -4   [   ... mouth open to space, force field ... ]
 *          x -3   -2   -1    0    1    2    3
 */
import { type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('halcyon_station', 'Halcyon Station');
m.theme('orbital');
m.backdrop('space', 'none', 'none', 0);
m.teams([6, 6]);
const [SOUTH, NORTH] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];

// ---------------------------------------------------------------- tiles

const ROOM: RoomOptions = { layout: 'empty', ceiling: 'roof', facade: 'hull' };
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);

// The reactor hall in the middle and the ring round it.
m.tile('orbital.reactor_hall', 0, 0, 0);
const RING: [number, number][] = [];
for (let x = -1; x <= 2; x++) RING.push([x, -1], [x, 2]);
for (let y = 0; y <= 1; y++) RING.push([-1, y], [2, y]);
for (const [x, y] of RING) m.tile('room', x, y, 0, 0, ROOM);
// Hangar bay south, control room north, labs east, airlock and exterior gantry west.
m.tile('orbital.hangar', -1, -4, 0);
for (const x of [0, 1]) m.tile('room', x, 3, 0, 0, ROOM);
for (const y of [0, 1]) m.tile('room', 3, y, 0, 0, ROOM);
m.tile('room', -2, 0, 0, 0, ROOM);
for (const y of [-1, 0, 1]) m.tile('platform_rail', -3, y, 0);

// One way into the reactor hall per side (the other side of each pair is a window onto the core).
edge(0, 1, 0, 'N', 'windows');
edge(1, 0, 0, 'S', 'windows');
edge(0, 0, 0, 'W', 'windows');
edge(1, 1, 0, 'E', 'windows');
// The hangar's middle door is wide; its side doors are walls with windows onto the pad.
edge(0, -2, 0, 'N', 'wide');
edge(-1, -2, 0, 'N', 'window');
edge(1, -2, 0, 'N', 'window');
// The mouth of the hangar is open to space (sealed by the force field) on both storeys.
for (const x of [-1, 0, 1]) {
  edge(x, -4, 0, 'S', 'open');
  edge(x, -4, 1, 'S', 'open');
}
// Windows onto space round the outside of the ring and the hangar.
for (const [x, y, side] of [
  [-1, 2, 'N'], [2, 2, 'N'], [-1, 2, 'W'], [2, 2, 'E'], [-1, 1, 'W'], [2, -1, 'E'], [-1, -1, 'W'], [2, -1, 'S'],
  [0, 3, 'N'], [1, 3, 'N'], [0, 3, 'W'], [1, 3, 'E'],
  [3, 0, 'E'], [3, 1, 'E'], [3, 1, 'N'], [3, 0, 'S'],
  [-2, 0, 'N'], [-2, 0, 'S'],
  [-1, -4, 'W'], [1, -4, 'E'], [-1, -3, 'W'], [1, -3, 'E'],
] as const) edge(x, y, 0, side, 'windows');
// The labs open off the ring through one door (the other is glass).
edge(3, 1, 0, 'W', 'window');

// ---------------------------------------------------------------- the reactor

const CORE: V3 = [4, 0, 4];
m.prop('os_reactor_core', CORE, 0);
m.gravityZone([4, 0, 4], [15.2, 8, 15.2], 0.35, 'Reactor low gravity');
for (const [x, z] of [[1, 1], [7, 1], [1, 7], [7, 7]] as const) m.light([x, 2.5, z], { fixture: 'none', color: '#7fe6ff', intensity: 1.6, range: 9 });
m.light([4, 7.6, 4], { fixture: 'none', color: '#9ff4ff', intensity: 2, range: 14 });
// Strip lights under the catwalks.
for (const [x, z, yaw] of [[4, -3, 0], [4, 11, 0], [-3, 4, P], [11, 4, P]] as const) m.light([x, 3.3, z], { fixture: 'strip', color: '#e8f4ff', intensity: 0.9, range: 9, yaw });
// Stepping stones round the core, only reachable floating up in the low gravity (cover and a view over the hall).
for (const [x, z, y] of [[0, 4, 5.6], [8, 4, 5.6], [4, 0, 6.2], [4, 8, 6.2]] as const) m.block([x, y, z], [1.6, 0.3, 1.6], 'solid', { material: 'orbital_panel', tint: '#d8e4ee' });
m.prop('os_floor_cables', [0, 0, 1], 0.4).prop('os_floor_cables', [8, 0, 7], 2.2).prop('os_power_unit', [-2, 0, 8.5], P).prop('os_coolant_pipe', [-2.7, 0, 0.5], 0);

// ---------------------------------------------------------------- the hangar bay

// The field across the mouth (24 m by 8 m), its emitters at both ends.
m.field([0, 0, -36.1], 24, 8, { id: 'field_hangar', tint: '#5ad8ff' });
m.prop('os_field_emitter', [-12.2, 0, -35.6], 0).prop('os_field_emitter', [12.2, 0, -35.6], 0);
// On the pad: a dropship's cargo; generators, racks and trusses round the walls (clear of the stairs up the west side).
m.prop('os_cargo_crate', [-2, 0.2, -22], 0.1).prop('os_cargo_crate', [-0.4, 0.2, -21.6], -0.2).prop('os_cargo_crate', [3, 0.2, -26], P);
m.prop('os_generator', [9, 0, -24], 0).prop('os_canister_rack', [9.6, 0, -30], -P).prop('os_truss', [-6.5, 0, -17.6], 0).prop('os_truss', [6.5, 0, -17.6], 0);
m.prop('sf_crate_large', [-2.5, 0, -13.8], 0).prop('sf_crate_large', [3, 0, -31.5], 0.3);
m.prop('os_satellite_dish', [8, 4, -13.8], S);
// Alarm beacons, off until the hangar is vented.
for (const x of [-10, 10]) m.light([x, 6.5, -33], { fixture: 'wall', color: '#ff3020', intensity: 1.2, range: 12, yaw: S, id: x < 0 ? 'lamp_vent_w' : 'lamp_vent_e', off: true });
for (const x of [-8, 0, 8]) m.light([x, 7.6, -24], { fixture: 'strip', color: '#e8f4ff', intensity: 1, range: 12, yaw: 0 });
for (const x of [-8, 0, 8]) m.light([x, 7.6, -32], { fixture: 'strip', color: '#e8f4ff', intensity: 1, range: 12, yaw: 0 });

// ---------------------------------------------------------------- control room, labs and the airlock

// Control room (north): consoles under the windows, the vent console by the west window.
m.prop('os_console_corner', at(0, 3, 0, -2.6, 2.6), S).prop('os_console_corner', at(1, 3, 0, 2.6, 2.6), -P);
m.prop('computer_bank', at(0, 3, 0, 1.5, 3.1), S).prop('computer_bank', at(1, 3, 0, -1.5, 3.1), S).prop('os_terminal', at(1, 3, 0, 0, 0.5), 0).prop('holo_table', at(0, 3, 0, 1, -0.5), 0);
m.add({ kind: 'button', id: 'btn_vent', name: 'Hangar vent console', position: at(0, 3, 0, -3.5, 0, 1.2), yaw: P, label: 'Vent the hangar', once: false, cooldownSeconds: 30, startEnabled: true });
// Labs (east): cryo pods along the far wall, the globe, consoles.
m.prop('os_cryo_pod', at(3, 0, 0, 3, -2.5), -P).prop('os_cryo_pod', at(3, 0, 0, 3, 0), -P).prop('os_cryo_pod', at(3, 1, 0, 3, 2.5), -P);
m.prop('os_holo_globe', at(3, 1, 0, 0, -1), 0).prop('sf_computer', at(3, 0, 0, -1, -3.2), 0).prop('os_terminal', at(3, 1, 0, -2, 3), S);
m.field(at(2, 0, 0, 4, 0), 3, 3, { id: 'field_lab', yaw: P, tint: '#ff7ad8', hidden: true });
m.add({ kind: 'button', id: 'btn_lab', name: 'Lab seal console', position: at(3, 0, 0, -1.5, -3.6, 1.2), yaw: 0, label: 'Seal the lab', once: false, cooldownSeconds: 20, startEnabled: true });
// Airlock (west): an auto door either side of the chamber.
m.add({ kind: 'door', id: 'door_air_in', name: 'Airlock inner door', position: at(-1, 0, 0, -4, 0), yaw: P, startOpen: false, locked: false, auto: true });
m.add({ kind: 'door', id: 'door_air_out', name: 'Airlock outer door', position: at(-2, 0, 0, -4, 0), yaw: P, startOpen: false, locked: false, auto: true });
m.prop('os_airlock_frame', at(-2, 0, 0, -3.1, 0), P).prop('os_airlock_frame', at(-2, 0, 0, 3.1, 0), P);
m.light(at(-2, 0, 0, 0, 3.4, 3), { fixture: 'wall', color: '#ffb347', intensity: 0.8, range: 6, yaw: S, blink: 0.5 });
// The exterior gantry: a quarter gravity out in space.
m.gravityZone(at(-3, 0, 0), [8, 10, 24], 0.25, 'Exterior low gravity');
m.prop('os_satellite_dish', at(-3, 1, 0, -1.5, 2), P).prop('os_transmitter', at(-3, -1, 0, -1.5, -1.5), P).prop('os_comms_dish', at(-3, -1, 0, 1.5, -2.5), S);

// Viewports high on the hangar's side walls (the upper storey is solid), crates and pipes round the ring.
for (const z of [-30, -22]) m.prop('os_viewport', [-11.62, 4.8, z], P, 1.2, false).prop('os_viewport', [11.62, 4.8, z], -P, 1.2, false);
m.prop('os_cargo_crate', at(-1, 2, 0, -1.5, 1.5), 0.3).prop('os_cargo_crate', at(2, -1, 0, 1.5, -1.5), -0.2).prop('sf_crate_large', at(2, 2, 0, 1, 2), 0);
m.prop('os_frame_module', at(-1, -1, 0, -1.5, -1.8), 0).prop('os_pipe_junction', at(2, 1, 0, 2.4, 0), 0).prop('sf_fan', at(-1, 1, 0, 0, 2.5), 0);

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Halcyon Station. Mind the reactor hall: gravity there is a third of normal.', 4)]),
    rule('rule_vent', 'Vent the hangar', { event: 'button_pressed', target: 'btn_vent' }, [
      act('sound', null, { state: 'alarm' }),
      act('light_on', 'lamp_vent_w'),
      act('light_on', 'lamp_vent_e'),
      act('light_blink', 'lamp_vent_w', { value: 3, state: 'on' }),
      act('light_blink', 'lamp_vent_e', { value: 3, state: 'on' }),
      say('Hangar field down for 6 seconds: keep away from the edge!', 3),
      act('block_drop', 'field_hangar'),
      act('wait', null, { value: 6 }),
      act('block_restore', 'field_hangar'),
      act('light_off', 'lamp_vent_w'),
      act('light_off', 'lamp_vent_e'),
      act('sound', null, { state: 'chime' }),
    ]),
    rule('rule_lab', 'Seal the lab', { event: 'button_pressed', target: 'btn_lab' }, [
      act('sound', null, { state: 'buzzer' }),
      say('Lab sealed for 12 seconds.', 2),
      act('block_restore', 'field_lab'),
      act('wait', null, { value: 12 }),
      act('block_drop', 'field_lab'),
    ]),
  ],
});

// ---------------------------------------------------------------- objectives, spawns and pickups

// King of the Hill: the reactor floor, the hangar pad, the control room, the labs.
m.hill([4, 0, -1.5], 3);
m.hill([0, 0.2, -24], 5);
m.hill(at(0, 3, 0, 4, 0), 4);
m.hill(at(3, 0, 0, 0, 4), 4);

// South team: the hangar.
for (const [p, yaw] of [
  [[-9, 0, -14.5], 0], [[0, 0, -14.6], 0], [[9, 0, -14.5], 0], [[-9, 0, -27], 0], [[9, 0, -27], 0], [[-10.2, 4, -14], P],
] as [V3, number][]) m.spawn(p, yaw, SOUTH);
// North team: the control room and the labs.
for (const [p, yaw] of [
  [at(0, 3, 0, -1, 1), S], [at(1, 3, 0, 1, 1), S], [at(3, 1, 0, 1, 1), -P], [at(3, 0, 0, 1, -1), -P], [at(2, 2, 0, 1, 1), S], [at(-1, 2, 0, -1, 1), S],
] as [V3, number][]) m.spawn(p, yaw, NORTH);
// Everyone else: round the ring and the airlock.
for (const [p, yaw] of [
  [at(-1, -1, 0, -1, -1), 0], [at(2, -1, 0, 1, -1), 0], [at(-1, 1, 0, -1, 0), 0], [at(2, 0, 0, 1, 0), 0], [at(-2, 0, 0), P], [at(0, -1, 0), S], [at(1, 2, 0), 0], [at(-3, 1, 0, 2, -2), -P],
] as [V3, number][]) m.spawn(p, yaw, null);

// The railgun on the inner ring round the core; rockets out on the gantry; armour in the labs.
m.pickup('weapon_railgun', [4, 4, 10.8]).pickup('ammo_cells', [-2.8, 4, 4]);
m.pickup('weapon_rockets', at(-3, 0, 0, -1, 0)).pickup('ammo_explosive', at(-3, 1, 0, 1, 0));
m.pickup('armor_large', at(3, 1, 0, 1.5, -1)).pickup('weapon_plasma', at(3, 0, 0, 1, 1));
m.pickup('weapon_sniper', at(1, 3, 0, -1, -1)).pickup('ammo_sniper', at(0, 3, 0, 2, -1));
m.pickup('weapon_smg', at(-1, -1, 0)).pickup('weapon_smg', at(2, 2, 0)).pickup('weapon_shotgun', at(2, -1, 0)).pickup('weapon_shotgun', at(-1, 2, 0));
m.pickup('weapon_rifle', [-6, 0, -22]).pickup('weapon_burst_rifle', [6, 0, -22]).pickup('weapon_launcher', [0, 4, -13.8]);
m.pickup('ammo', at(0, -1, 0, 1, 0)).pickup('ammo', at(1, 2, 0, -1, 0)).pickup('ammo_rifle', [12, 0, -14]).pickup('ammo_shells', at(-1, 0, 0, 0, -2)).pickup('ammo_light', at(2, 1, 0, 0, 2));
m.pickup('grenades', [4, 0, -2.5]).pickup('grenades', at(-2, 0, 0, 0, 2));
m.pickup('armor_small', [-10.2, 4, -18]).pickup('armor_small', at(2, 0, 0, 0, -2));
m.pickup('health_large', [4, 0, 10.5]).pickup('health_large', [0, 0.2, -30]);
for (const p of [at(-1, 0, 0, 0, 2), at(2, 2, 0, -2, 0), at(0, 2, 0), at(1, -1, 0), [-7, 0, -30.5] as V3, [7, 0, -30.5] as V3, at(3, 1, 0, -2, -2)]) m.pickup('health_small', p);

// ---------------------------------------------------------------- light

m.lightRooms({ color: '#eaf6ff', intensity: 1, range: 9 });
// Strip lights along the ring and the gantry.
for (const [x, y] of RING) m.light(at(x, y, 0, 0, 0, 3.3), { fixture: 'strip', color: '#bfe8ff', intensity: 0.6, range: 7 });
for (const y of [-1, 0, 1]) m.light(at(-3, y, 0, 0, 0, 2.5), { fixture: 'none', color: '#9fd8ff', intensity: 0.8, range: 10 });

m.bounds('invisible', 4);
m.meta({
  description:
    'A research station hanging in space, built from the Orbital Station style pack: a ring of white-panelled corridors round a two-storey reactor hall in low gravity (jump up to the railgun round the glowing core), the hangar bay behind a force field that lets shots through but not people (the control room can vent it), labs that seal behind a field of their own, and an airlock out onto a floaty exterior gantry. Windows and viewports onto the stars all round.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [4, 12],
});
await m.save();
