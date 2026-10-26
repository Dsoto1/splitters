/**
 * Starhaven: a starship interior at warp (our own ship, map and name), built
 * from Style Pack 04 Orbital Station, for 8–20 players in Team Deathmatch,
 * Capture the Flag, King of the Hill, Bomb and Deathmatch.
 *
 * The saucer holds two decks round a ring of curved corridors lined with lit
 * deck panels; the engineering hull runs aft from it to the warp core and
 * the shuttle bay. Windows and viewports look out onto the stars streaking
 * past.
 *
 * - Bridge (deck A, bow): the captain's chair in the middle, helm and ops
 *   consoles before it, stations round the walls and the main viewscreen
 *   on the forward bulkhead. Turbolifts either side (lifts with auto doors)
 *   drop to Ten-Forward. The chair's armrest console sounds red alert: every
 *   corridor light turns red (press again to stand down).
 * - Ten-Forward (deck B, under the bridge): the lounge, its windows wrapped
 *   round the bow onto space.
 * - The ring (both decks): curved corners, junctions to the crew quarters
 *   (deck A, west), sickbay and the science lab (deck A, east), the
 *   arboretum under a skylight (deck A, middle) and the cargo bay (deck B,
 *   middle). Stairwells at the aft corners, and the transporter room (east):
 *   step on the pad on deck B to be beamed up onto the deck A landing.
 * - Jefferies tube (deck B, west): a crawl duct from the ring down to
 *   engineering stores; crouch under the hatches.
 * - Engineering (aft): the warp core glows through both decks in a
 *   low-gravity well, catwalks round it, the master console beside it. Its
 *   breach console (or shooting the plasma conduit) sets off a core breach
 *   drill: alarm beacons blink red in every corridor and force fields seal
 *   the neck, the bridge and Ten-Forward for 15 seconds.
 * - Shuttle bay (aft): a skyfighter and a shuttle (dropship) on the pad,
 *   the bay doors a force field open to space; the bay console opens it
 *   for 20 seconds.
 *
 * Teams: the Boarders (first team) come aboard from the shuttle bay and hold
 * engineering; the Crew hold the bridge and the saucer. CTF: bridge against
 * engineering. KOTH: bridge, warp core, Ten-Forward. Bomb: the warp core (A)
 * and the bridge (B).
 *
 * Grid x east (starboard), y north (bow); one cell = 8 m; deck B z0 (y 0),
 * deck A z1 (y 4).
 *
 *   y 6..8   [lift][ BRIDGE (A) / TEN-FORWARD (B) ][lift]
 *   y 5      (curve)  ring  [X]  ring  (curve)
 *   y 2..4   quarters/tube [X][ ARBORETUM (A) / CARGO BAY (B) ][X] transporter, sickbay, lab
 *   y 1      [T] ring [X] ring [T]
 *   y 0      [stair]    [neck]     [stair]
 *   y -2..-1 [stores][ WARP CORE 2 × 2 ][eng. control]
 *   y -3     [ aft passage ]
 *   y -6..-4 [ SHUTTLE BAY 3 × 3 ]  bay doors (force field) to space
 *            x -3  -2  -1   0   1   2   3
 */
import { type EdgeStyle, type LogicAction, type LogicCondition, type LogicRule, type RoomOptions, type Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('starhaven', 'Starhaven');
m.theme('orbital');
m.backdrop('space', 'none', 'none', 0);
m.teams([10, 10]);
const [BOARD, CREW] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);

const ROOM: RoomOptions = { layout: 'empty', ceiling: 'roof', facade: 'hull' };
const UNDER: RoomOptions = { layout: 'empty', facade: 'hull' };
const PANEL = { material: 'orbital_panel', tint: '#d8e0e8' };
/** A ceiling slab over a cell that has nothing built on top of it. */
const cap = (x: number, y: number, top: number) => m.block([x * 8, top, y * 8], [8, 0.3, 8], 'solid', PANEL);

// ---------------------------------------------------------------- tiles

/** The saucer ring on one deck: curved bow corners, junctions at the middles, T-junctions over the stairwells. */
function ring(z: number): void {
  m.tile('corridor_curve', -2, 5, z, 3);
  m.tile('corridor_curve', 2, 5, z, 0);
  for (const x of [-1, 1]) {
    m.tile('corridor', x, 5, z, 1);
    m.tile('corridor', x, 1, z, 1);
  }
  m.tile('junction_x', 0, 5, z);
  m.tile('junction_x', 0, 1, z);
  for (const x of [-2, 2]) {
    m.tile('corridor', x, 4, z, 0);
    m.tile('corridor', x, 2, z, 0);
    m.tile('junction_x', x, 3, z);
  }
  m.tile('junction_t', -2, 1, z, 1);
  m.tile('junction_t', 2, 1, z, 3);
  // The neck aft to engineering.
  m.tile('corridor', 0, 0, z, 0);
}
ring(0);
ring(1);
const RING: [number, number][] = [[-2, 5], [-1, 5], [0, 5], [1, 5], [2, 5], [-2, 4], [2, 4], [-2, 3], [2, 3], [-2, 2], [2, 2], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [0, 0]];
// Deck A has nothing above it: cap the ring.
for (const [x, y] of RING) cap(x, y, 8);

// Bow: the bridge over Ten-Forward, a turbolift shaft either side.
m.tile('hall', -1, 6, 0, 0, UNDER);
m.tile('hall', -1, 6, 1, 0, ROOM);
for (const x of [-2, 2]) {
  m.tile('room_tall', x, 7);
  cap(x, 7, 8);
}
// Middle of the saucer: the cargo bay (B) under the arboretum (A, skylight).
m.tile('hall', -1, 2);
m.tile('hall', -1, 2, 1, 0, { layout: 'empty', ceiling: 'skylight', facade: 'hull' });
// West: crew quarters on deck A, the Jefferies tube under them (and on aft to engineering).
for (const y of [2, 3, 4]) m.tile('room', -3, y, 1, 0, ROOM);
for (let y = -2; y <= 4; y++) m.tile('corridor', -3, y, 0, 0);
// East: the transporter room (both decks), sickbay and the science lab on deck A.
m.tile('room_tall', 3, 3);
cap(3, 3, 8);
m.tile('room', 3, 4, 1, 0, ROOM);
m.tile('room', 3, 2, 1, 0, ROOM);
// Stairwells at the aft corners of the ring (doors north on both decks).
for (const x of [-2, 2]) {
  m.tile('stairwell', x, 0, 0, 1);
  cap(x, 0, 8);
}
// Engineering: the warp core hall, the master control room (and the chief's office over it), stores.
m.tile('orbital.reactor_hall', -1, -2, 0);
m.tile('room_long', 1, -2, 0, 0, UNDER);
m.tile('room_long', 1, -2, 1, 0, ROOM);
m.tile('room_long', -2, -2, 0, 0, ROOM);
// The aft passage and the shuttle bay.
for (const x of [-1, 0, 1]) m.tile('room', x, -3, 0, 0, ROOM);
m.tile('orbital.hangar', -1, -6, 0);

// ---------------------------------------------------------------- walls and openings

// The aft passage is one long room; the middle door into the bay is wide.
edge(-1, -3, 0, 'E', 'open').edge(0, -3, 0, 'E', 'open');
edge(0, -4, 0, 'N', 'wide');
// The bay doors: open to space on both storeys (sealed by a force field).
for (const x of [-1, 0, 1]) {
  edge(x, -6, 0, 'S', 'open');
  edge(x, -6, 1, 'S', 'open');
}
// Jefferies tube hatches (crouch under the shutter): off the ring at (-2, 3) and into engineering stores.
edge(-3, 3, 0, 'E', 'shutter');
edge(-3, -2, 0, 'E', 'shutter');
// Ring rooms on deck A: quarters off the west junction (and each other), sickbay and the lab off the east ring.
edge(3, 3, 1, 'N', 'wall').edge(3, 3, 1, 'S', 'wall');
edge(2, 4, 1, 'E', 'door');
edge(2, 2, 1, 'E', 'door');
// Windows onto space: round the bow of Ten-Forward and the bridge (its middle bulkhead carries the viewscreen).
for (const z of [0, 1]) {
  for (const x of [-1, 1]) edge(x, 8, z, 'N', 'windows');
  for (const y of [6, 8]) {
    edge(-1, y, z, 'W', 'windows');
    edge(1, y, z, 'E', 'windows');
  }
}
edge(0, 8, 0, 'N', 'windows');
for (const y of [2, 3, 4]) edge(-3, y, 1, 'W', 'windows');
edge(-3, 4, 1, 'N', 'window');
edge(-3, 2, 1, 'S', 'window');
for (const y of [2, 4]) edge(3, y, 1, 'E', 'windows');
edge(3, 4, 1, 'N', 'window');
edge(3, 2, 1, 'S', 'window');
for (const z of [0, 1]) {
  edge(-2, 5, z, 'N', 'windows');
  edge(2, 5, z, 'N', 'windows');
  edge(-2, 5, z, 'W', 'window');
  edge(2, 5, z, 'E', 'window');
}
for (const y of [-2, -1]) edge(1, y, 1, 'E', 'windows');
edge(1, -2, 0, 'E', 'window');
for (const y of [-5, -4]) {
  edge(-1, y, 0, 'W', 'windows');
  edge(1, y, 0, 'E', 'windows');
}

// ---------------------------------------------------------------- the bridge (deck A, y 44..68)

const BY = 4;
m.prop('space_chair', [0, BY, 53], S, 1.5); // the captain's chair, facing the viewscreen
m.prop('space_chair', [-2.4, BY, 54], S).prop('space_chair', [2.4, BY, 54], S);
m.prop('space_table', [-3.2, BY, 59.5], 0).prop('space_table', [3.2, BY, 59.5], 0); // helm and ops
m.prop('space_chair', [-3.2, BY, 58.2], S).prop('space_chair', [3.2, BY, 58.2], S);
m.prop('os_console_corner', [-10, BY, 66], -P).prop('os_console_corner', [10, BY, 66], S);
m.prop('computer_bank', [-10.6, BY, 50], P).prop('computer_bank', [10.6, BY, 50], -P);
m.prop('os_terminal', [-6, BY, 45.2], 0).prop('os_terminal', [6, BY, 45.2], 0).prop('sf_computer', [-10.8, BY, 61], P).prop('sf_computer', [10.8, BY, 61], -P);
m.prop('holo_table', [0, BY, 47.5], 0);
// The viewscreen: stars streaking past at warp.
m.light([0, BY + 2.6, 67.55], { fixture: 'billboard', id: 'lamp_viewscreen', text: '*  .  +  .  *  .  +', color: '#a8d8ff', yaw: S, intensity: 1.6, range: 14, size: [11, 4.5] });
m.prop('os_viewport', [-7, BY + 2.2, 67.62], S, 1.1, false).prop('os_viewport', [7, BY + 2.2, 67.62], S, 1.1, false);
m.add({ kind: 'button', id: 'btn_red_alert', name: 'Red alert (captain\'s chair)', position: [1.1, BY + 1, 52.4], yaw: S, label: 'Red alert', once: false, cooldownSeconds: 3, startEnabled: true });

// ---------------------------------------------------------------- Ten-Forward (deck B, under the bridge)

m.prop('os_holo_globe', [0, 0, 63], 0);
m.light([0, 2.6, 63], { fixture: 'none', color: '#8fd0ff', intensity: 1, range: 8 });

// ---------------------------------------------------------------- turbolifts

/** A turbolift: a cab against the shaft's doorway wall riding deck B to deck A and back, auto doors on both decks. */
function turbolift(id: string, x: number, y: number, side: 'E' | 'W'): void {
  const s = side === 'E' ? 1 : -1;
  const cab: V3 = [r2(x * 8 + s * 2.3), -0.3, y * 8];
  m.block(cab, [3, 0.3, 3], 'solid', { id: `${id}_cab`, material: 'grate', tint: '#9aa6b2' });
  m.mover(id, cab, [`${id}_cab`], [[0, 0, 0], [0, 4, 0]], { speed: 2, wait: 3, name: 'Turbolift' });
  for (const z of [0, 1]) m.add({ kind: 'door', name: 'Turbolift door', position: at(x, y, z, s * 4, 0), yaw: P, startOpen: false, locked: false, auto: true });
  m.light(at(x, y, 0, s * 2.3, 0, 7.6), { fixture: 'ceiling', color: '#ffd9a0', intensity: 0.9, range: 9 });
  m.light(at(x, y, 0, -s * 3.6, 0, 1.6), { fixture: 'sign', text: 'TURBOLIFT', color: '#ffb347', yaw: side === 'E' ? -P : P, intensity: 1, range: 4, size: [2.4, 0.6] });
}
turbolift('mover_lift_port', -2, 7, 'E');
turbolift('mover_lift_stbd', 2, 7, 'W');

// ---------------------------------------------------------------- transporter room (east, both decks)

// The landing on deck A along the west wall (over the doorway), the pad on deck B (north of the shaft's
// central column) beaming you up onto it.
m.block([21.1, 3.7, 24], [1.8, 0.3, 7.4], 'solid', { material: 'grate', tint: '#b8c2cc' });
m.prop('sf_round_platform', [26.4, 0, 26.2], 0, 0.5, false);
m.padTo([26.4, 0, 26.2], [21.1, 4, 26.2], 15);
m.light([26.4, 0.4, 26.2], { fixture: 'none', id: 'lamp_transporter', color: '#bfe8ff', intensity: 1.4, range: 6, blink: 0.6 });
m.light([26, 7.4, 24], { fixture: 'ceiling', color: '#dff2ff', intensity: 1, range: 9 });
m.prop('os_console_corner', [26.4, 0, 18.6], P).prop('os_terminal', [26, 0, 29.2], S).prop('sf_light_wide', [26, 7.2, 24], 0, 1, false);

// ---------------------------------------------------------------- Jefferies tube (deck B, x -24, y -2..4)

for (let y = -2; y <= 4; y++) {
  // A crawlspace: the ceiling 1.35 m up, all the way to the deck above.
  m.block([-24, 1.35, y * 8], [7.6, 2.65, 8], 'solid', { material: 'pbr_space_metal', tint: '#8a929a' });
  m.light([-24, 1.15, y * 8], { fixture: 'strip', color: '#ffb347', intensity: 0.6, range: 5 });
}

// ---------------------------------------------------------------- engineering: the warp core

const CORE: V3 = [-4, 0, -12];
m.prop('os_reactor_core', CORE, 0);
m.gravityZone([-4, 0, -12], [15.2, 8, 15.2], 0.4, 'Warp core low gravity');
for (const [x, z] of [[-11, -19], [3, -19], [-11, -5], [3, -5]] as const) m.light([x, 2.5, z], { fixture: 'none', color: '#5aa8ff', intensity: 1.6, range: 9 });
m.light([-4, 7.6, -12], { fixture: 'none', color: '#7fc0ff', intensity: 2, range: 14 });
m.light([-4, 3.9, -12], { fixture: 'none', id: 'lamp_core', color: '#4f9cff', intensity: 2.2, range: 10 });
for (const [x, z, yaw] of [[-4, -19, 0], [-4, -5, 0], [-11, -12, P], [3, -12, P]] as const) m.light([x, 3.3, z], { fixture: 'strip', color: '#e8f4ff', intensity: 0.9, range: 9, yaw });
// Stepping stones round the core, reached floating up in the low gravity.
for (const [x, z, y] of [[-8, -12, 5.6], [0, -12, 5.6], [-4, -16, 6.2], [-4, -8, 6.2]] as const) m.block([x, y, z], [1.6, 0.3, 1.6], 'solid', { material: 'orbital_panel', tint: '#d8e4ee' });
m.prop('os_floor_cables', [-8, 0, -15], 0.4).prop('os_floor_cables', [0, 0, -9], 2.2).prop('os_coolant_pipe', [-10.7, 0, -15.5], 0);
// The plasma conduit: shoot it and the core breach drill goes off.
m.add({ kind: 'destructible', id: 'conduit_core', model: 'generator', position: [1.5, 0, -18.4], yaw: 0, health: 250, explosiveOnly: false });
// Master engineering (x 8, z -20..-4): the situation table, consoles, the breach console.
m.prop('holo_table', [8, 0, -12], 0).prop('computer_bank', [10.6, 0, -16], -P).prop('os_power_unit', [10.8, 0, -7], -P).prop('os_terminal', [8, 0, -19.2], 0);
m.add({ kind: 'button', id: 'btn_breach', name: 'Core breach drill console', position: [11.3, 1.2, -10.5], yaw: -P, label: 'Core breach drill', once: false, cooldownSeconds: 40, startEnabled: true });
// Chief engineer's office over it.
m.prop('os_pipe_junction', [10.6, 4, -18], -P);
// Engineering stores (x -16): canisters and spares.
m.prop('os_canister_rack', [-18.8, 0, -18], P).prop('os_cargo_crate', [-18.8, 0, -6.5], 0.2);

// ---------------------------------------------------------------- the shuttle bay (z -52..-28)

m.field([0, 0, -52.1], 24, 8, { id: 'field_bay', tint: '#5ad8ff' });
m.prop('os_field_emitter', [-12.2, 0, -51.6], 0).prop('os_field_emitter', [12.2, 0, -51.6], 0);
m.prop('os_cargo_crate', [-2, 0.2, -38], 0.1).prop('os_cargo_crate', [-0.4, 0.2, -37.6], -0.2);
m.prop('os_generator', [9, 0, -40], 0).prop('os_canister_rack', [9.6, 0, -46], -P).prop('os_truss', [-6.5, 0, -33.6], 0).prop('os_truss', [6.5, 0, -33.6], 0);
m.prop('sf_crate_large', [-2.5, 0, -29.8], 0);
for (const x of [-10, 10]) m.light([x, 6.5, -49], { fixture: 'wall', color: '#ff3020', intensity: 1.2, range: 12, yaw: S, id: x < 0 ? 'lamp_bay_w' : 'lamp_bay_e', off: true, blink: 3 });
for (const z of [-40, -48]) for (const x of [-8, 0, 8]) m.light([x, 7.6, z], { fixture: 'strip', color: '#e8f4ff', intensity: 1, range: 12 });
m.add({ kind: 'button', id: 'btn_bay', name: 'Shuttle bay doors', position: [-11.4, 1.2, -44], yaw: P, label: 'Open the bay doors', once: false, cooldownSeconds: 30, startEnabled: true });
// The shuttles.
m.add({ kind: 'mount', model: 'skyfighter', position: [-5, 0.2, -42], yaw: S, faction: null, respawnSeconds: 60 });
m.add({ kind: 'mount', model: 'dropship', position: [5, 0.2, -42], yaw: S, faction: null, respawnSeconds: 90 });

// ---------------------------------------------------------------- corridors: lights, deck panels, alarm beacons

// Every ring corridor has a light logic can turn red (red alert), an LCARS-style deck panel and an alarm beacon.
const LAMPS: string[] = [];
const BEACONS: string[] = [];
const PANEL_COLORS = ['#ffb347', '#9f9fff', '#ff9a6a', '#c8a0ff'];
let n = 0;
for (const z of [0, 1]) {
  for (const [x, y] of RING) {
    const id = `lamp_ring_${z}_${n++}`;
    LAMPS.push(id);
    m.light(at(x, y, z, 0, 0, 3.4), { id, fixture: 'strip', color: '#d8ecff', intensity: 0.9, range: 9, yaw: y === 1 || y === 5 ? 0 : P });
  }
}
// Deck panels on the inner walls of the straight runs (lit words, like a deck directory).
const PANELS: [number, number, Side, string][] = [
  [-1, 5, 'S', 'DECK %d  FWD'], [1, 5, 'S', 'DECK %d  BRIDGE'], [-1, 1, 'N', 'DECK %d  AFT'], [1, 1, 'N', 'DECK %d  ENGRG'],
  [-2, 4, 'E', 'DECK %d  PORT'], [2, 4, 'W', 'DECK %d  STBD'], [-2, 2, 'E', 'DECK %d  02-114'], [2, 2, 'W', 'DECK %d  02-131'],
];
let k = 0;
for (const z of [0, 1]) {
  for (const [x, y, side, text] of PANELS) {
    const off: Record<Side, [number, number, number]> = { N: [0, 3.35, S], S: [0, -3.35, 0], E: [3.35, 0, -P], W: [-3.35, 0, P] };
    const [dx, dy, yaw] = off[side];
    m.light(at(x, y, z, dx, dy, 1.6), { fixture: 'sign', text: text.replace('%d', z === 1 ? 'A' : 'B'), color: PANEL_COLORS[k++ % PANEL_COLORS.length]!, yaw, intensity: 0.9, range: 4, size: [2.2, 0.55] });
  }
}
// Alarm beacons, dark until a core breach.
for (const z of [0, 1]) {
  for (const [x, y] of [[-2, 4], [2, 4], [-2, 2], [2, 2], [0, 5], [0, 1], [0, 0]] as const) {
    const id = `beacon_${z}_${x + 2}${y}`;
    BEACONS.push(id);
    m.light(at(x, y, z, 0, 0, 2.9), { id, fixture: 'bulb', color: '#ff2a1a', intensity: 1.4, range: 8, off: true, blink: 2.5 });
  }
}
for (const [x, z] of [[-4, -24], [4, -24], [-4, -12.5]] as const) {
  const id = `beacon_eng_${BEACONS.length}`;
  BEACONS.push(id);
  m.light([x, z === -12.5 ? 7 : 3.2, z], { id, fixture: 'bulb', color: '#ff2a1a', intensity: 1.6, range: 10, off: true, blink: 2.5 });
}
// The force fields that seal the sections in a breach (raised by logic).
const FIELDS = ['field_neck_b', 'field_neck_a', 'field_tenforward', 'field_bridge'];
m.field(at(0, 0, 0, 0, -4), 3, 3, { id: 'field_neck_b', tint: '#ff5a5a', hidden: true });
m.field(at(0, 0, 1, 0, -4), 3, 3, { id: 'field_neck_a', tint: '#ff5a5a', hidden: true });
m.field(at(0, 6, 0, 0, -4), 3, 3, { id: 'field_tenforward', tint: '#ff5a5a', hidden: true });
m.field(at(0, 6, 1, 0, -4), 3, 3, { id: 'field_bridge', tint: '#ff5a5a', hidden: true });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const is = (v: number): LogicCondition => ({ type: 'variable', target: 'var_red_alert', op: '==', value: v, state: '' });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], cond: LogicCondition[] = []): LogicRule => ({ id, name, enabled: true, once: false, when, if: cond, do: does });
const chunks = <T,>(a: T[], size: number): T[][] => Array.from({ length: Math.ceil(a.length / size) }, (_, i) => a.slice(i * size, (i + 1) * size));
const pressed = (id: string): LogicRule['when'] => ({ event: 'button_pressed', target: id });

// Red alert toggles: 0 normal, 1 red; 2 is a stand-down step so one press never runs both ways.
const redOff = chunks(LAMPS, 28).map((ids, i, all) => rule(`rule_ra_off_${i}`, 'Stand down from red alert', pressed('btn_red_alert'), [...ids.map((id) => act('light_color', id)), ...(i === all.length - 1 ? [act('set_var', 'var_red_alert', { value: 2 }), say('Red alert cancelled.', 2)] : [])], [is(1)]));
const redOn = chunks(LAMPS, 28).map((ids, i, all) => rule(`rule_ra_on_${i}`, 'Red alert', pressed('btn_red_alert'), [...ids.map((id) => act('light_color', id, { text: '#ff2418' })), ...(i === all.length - 1 ? [act('set_var', 'var_red_alert', { value: 1 }), act('sound', null, { state: 'alarm' }), say('Red alert! All hands to battle stations.', 3)] : [])], [is(0)]));
const breach = (suffix: string, when: LogicRule['when']): LogicRule[] => [
  rule(`rule_breach_fields${suffix}`, 'Core breach: seal the sections', when, [
    act('sound', null, { state: 'alarm' }),
    say('Warp core breach! Force fields sealing the bridge, Ten-Forward and the neck for 15 seconds.', 4),
    act('light_blink', 'lamp_core', { value: 4, state: 'on' }),
    act('light_color', 'lamp_core', { text: '#ff3a1a' }),
    ...FIELDS.map((id) => act('block_restore', id)),
    act('wait', null, { value: 15 }),
    ...FIELDS.map((id) => act('block_drop', id)),
    act('light_blink', 'lamp_core', { state: 'off' }),
    act('light_color', 'lamp_core'),
    act('sound', null, { state: 'chime' }),
    say('Core stabilised. Fields down.', 2),
  ]),
  ...chunks(BEACONS, 15).map((ids, i) => rule(`rule_breach_beacons${suffix}_${i}`, 'Core breach: beacons', when, [...ids.map((id) => act('light_on', id)), act('wait', null, { value: 15 }), ...ids.map((id) => act('light_off', id))])),
];
m.logic({
  variables: [{ id: 'var_red_alert', name: 'Red alert', initial: 0 }],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome aboard', { event: 'match_start', target: null }, [say('Starhaven, holding at warp. Turbolifts fore, transporter starboard, the warp core aft.', 4)]),
    ...redOff,
    ...redOn,
    rule('rule_ra_reset', 'Red alert stood down', pressed('btn_red_alert'), [act('set_var', 'var_red_alert', { value: 0 })], [is(2)]),
    ...breach('', pressed('btn_breach')),
    ...breach('_conduit', { event: 'destroyed', target: 'conduit_core' }),
    rule('rule_bay', 'Open the bay doors', pressed('btn_bay'), [
      act('sound', null, { state: 'alarm' }),
      act('light_on', 'lamp_bay_w'),
      act('light_on', 'lamp_bay_e'),
      say('Shuttle bay doors open for 20 seconds: mind the edge!', 3),
      act('block_drop', 'field_bay'),
      act('wait', null, { value: 20 }),
      act('block_restore', 'field_bay'),
      act('light_off', 'lamp_bay_w'),
      act('light_off', 'lamp_bay_e'),
      act('sound', null, { state: 'chime' }),
    ]),
  ],
});

// ---------------------------------------------------------------- objectives

// King of the Hill: the bridge, the warp core, Ten-Forward.
m.hill([0, BY, 50], 5);
m.hill([-4, 0, -17.5], 3);
m.hill([0, 0, 52], 5);
// Bomb: the warp core (A) and the bridge (B).
m.add({ kind: 'bombsite', position: [-9, 0, -12], label: 'A', radius: 3 });
m.add({ kind: 'bombsite', position: [0, BY, 62], label: 'B', radius: 4 });
// Capture the Flag: the bridge against engineering.
m.flag(CREW, [0, BY, 64.5], S);
m.flag(BOARD, [6, 0, -16.5], 0);

// ---------------------------------------------------------------- spawns

// Boarders: the shuttle bay, its gantry, the aft passage and engineering.
for (const [p, yaw] of [
  [[-9, 0, -30.5], 0], [[0, 0, -30.6], 0], [[9, 0, -30.5], 0], [[-9, 0, -43], 0], [[9, 0, -45], 0], [[-10.2, 4, -30], P],
  [at(-1, -3, 0), 0], [at(1, -3, 0), 0], [at(-2, -2, 0, 1, 1), P], [at(1, -1, 0, -1, 1), 0],
] as [V3, number][]) m.spawn(p, yaw, BOARD);
// Crew: the bridge, Ten-Forward, the quarters, sickbay and the arboretum.
for (const [p, yaw] of [
  [[-7, BY, 63], S], [[7, BY, 63], S], [[-6, BY, 47], 0], [[-8, 0, 62], S], [[8, 0, 62], S], [[-8, 0, 48], 0],
  [at(-3, 2, 1, 1, 0), P], [at(-3, 4, 1, 1, 0), P], [at(3, 4, 1, -1, 0), -P], [at(0, 3, 1, -6, 6), S],
] as [V3, number][]) m.spawn(p, yaw, CREW);
// Everyone else: round the ring, the cargo bay and the arboretum.
for (const [p, yaw] of [
  [at(-2, 4, 0), S], [at(2, 2, 0), 0], [at(-2, 2, 1), 0], [at(2, 4, 1), S], [at(0, 1, 0), 0], [at(0, 5, 1), S],
  [at(0, 3, 0, -7, -7), 0], [at(0, 3, 0, 7, 7), S], [at(-1, 1, 1), P], [at(1, 5, 0), -P], [at(0, 3, 1, 6, -6), 0], [at(3, 2, 1, -1, 1), -P],
] as [V3, number][]) m.spawn(p, yaw, null);

// ---------------------------------------------------------------- pickups

m.pickup('weapon_railgun', [-4, 4, -5.2]).pickup('ammo_cells', [-10.8, 4, -12]);
m.pickup('weapon_rockets', [-10.2, 4, -36]).pickup('ammo_explosive', at(1, -3, 0, 2, 0));
m.pickup('weapon_sniper', [9, BY, 58]).pickup('ammo_sniper', at(-3, 3, 1));
m.pickup('weapon_plasma', at(3, 2, 1, 1, 1)).pickup('armor_large', at(3, 4, 1, 1.5, -1.5));
m.pickup('weapon_smg', at(-2, 3, 0)).pickup('weapon_smg', at(2, 3, 1)).pickup('weapon_shotgun', at(2, 3, 0)).pickup('weapon_shotgun', at(-2, 3, 1));
m.pickup('weapon_burst_rifle', [0, 0, 18]).pickup('weapon_rifle', [-6, 0, -42]).pickup('weapon_launcher', [0, 4, 30]).pickup('weapon_lmg', [0, 0, 60]);
m.pickup('ammo', at(-1, 5, 0)).pickup('ammo', at(1, 1, 1)).pickup('ammo_rifle', [6, 0, -40]).pickup('ammo_shells', at(1, 5, 1)).pickup('ammo_light', at(-1, 1, 0));
m.pickup('grenades', [-4, 0, -21.5]).pickup('grenades', at(0, 0, 1)).pickup('grenades', [9, 0, 30]);
m.pickup('armor_small', at(0, 0, 0)).pickup('armor_small', [-9, BY, 50]).pickup('armor_small', [-18.5, 0, -11]);
m.pickup('health_large', [-4, 0, -2.6]).pickup('health_large', at(3, 4, 1, -1.5, 2)).pickup('health_large', [0, 0.2, -46]);
for (const p of [at(-2, 5, 0), at(2, 5, 1), at(-2, 1, 0), at(2, 1, 1), at(-1, -3, 0, -2, 0), [8, 4, -12] as V3, [-6, 0, 30] as V3, [6, 4, 18] as V3, [-9, 0, 54] as V3]) m.pickup('health_small', p);

// ---------------------------------------------------------------- dressing

m.dress({ x0: -1, y0: 6, x1: 1, y1: 8, z: 0 }, 'bar', { density: 'normal' });
m.dress({ x0: -1, y0: 2, x1: 1, y1: 4, z: 0 }, 'warehouse', { density: 'normal' });
m.dress([-3, 2, 1], 'bedroom');
m.dress([-3, 3, 1], 'living');
m.dress([-3, 4, 1], 'bedroom');
m.dress([3, 4, 1], 'lab', { density: 'sparse' });
m.dress([3, 2, 1], 'lab', { density: 'sparse' });
m.dress({ x0: 1, y0: -2, x1: 1, y1: -1, z: 1 }, 'office', { density: 'sparse' });
m.dress({ x0: -2, y0: -2, x1: -2, y1: -1, z: 0 }, 'storage', { density: 'sparse' });
// The arboretum: palms and planters round the walls, the globe in the middle.
for (const [x, z] of [[-10, 14], [10, 14], [-10, 34], [10, 34], [-10, 24.5], [10, 23.5]] as const) m.prop('hm_potted_palm', [x, 4, z], 0);
for (const [x, z] of [[-4, 14], [4, 34]] as const) m.prop('potted_plant', [x, 4, z], 0);
// Sickbay biobeds.
m.prop('os_cryo_pod', at(3, 4, 1, 2.8, 2.6), -P).prop('os_cryo_pod', at(3, 2, 1, 2.8, -2.6), -P);

// ---------------------------------------------------------------- light

m.lightRooms({ color: '#eaf6ff', intensity: 1, range: 9, skip: (x, y) => RING.some(([a, b]) => a === x && b === y) });
// Halls: the bridge and Ten-Forward, the arboretum, the cargo bay.
for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]] as const) {
  m.light([dx, BY + 3.5, 56 + dz], { color: '#eaf6ff', range: 11 });
  m.light([dx, 3.45, 56 + dz], { fixture: 'none', color: '#ffd9b0', intensity: 0.9, range: 10 });
  m.light([dx, BY + 3.3, 24 + dz], { fixture: 'none', color: '#d9ffe4', intensity: 0.8, range: 11 });
  m.light([dx, 3.45, 24 + dz], { color: '#eaf6ff', range: 11 });
}
// Deck A rooms with nothing above them.
for (const [x, y] of [[-3, 2], [-3, 3], [-3, 4], [3, 4], [3, 2], [1, -2], [1, -1]] as const) m.light(at(x, y, 1, 0, 0, 3.45), { color: '#eaf6ff', range: 9 });
for (const [x, y] of [[-2, -2], [-2, -1], [-1, -3], [0, -3], [1, -3]] as const) m.light(at(x, y, 0, 0, 0, 3.45), { color: '#eaf6ff', range: 9 });

m.bounds('invisible', 4);
m.meta({
  description:
    'A starship holding at warp, built from the Orbital Station style pack. The bridge (captain\'s chair, helm and ops, the viewscreen full of streaking stars) sits over Ten-Forward at the bow, joined by turbolifts; curved ring corridors with lit deck panels run round the crew quarters, sickbay, the arboretum and the cargo bay, with a transporter pad that beams you up a deck and a Jefferies tube to crawl through. Aft, the warp core glows through both decks in a low-gravity well beside master engineering, and the shuttle bay holds a skyfighter and a shuttle behind a force field. Red alert from the captain\'s chair turns every corridor light red; a core breach drill blinks the alarms and seals the sections behind force fields.',
  modes: ['core.tdm', 'core.ctf', 'core.koth', 'core.bomb', 'core.deathmatch'],
  players: [8, 20],
});
await m.save();
