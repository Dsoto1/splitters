/**
 * No Man's Field: a battlefield split by force-field lanes that open and
 * close on a clock, and you can always shoot through them. Our own map and
 * name (MAP_IDEAS no. 8): Orbital Station field gates on a Military Compound
 * layout, for 8–16 players in Capture the Flag and Team Deathmatch.
 *
 * - Two walled compounds face each other across a band of five lanes, each
 *   a corridor (clear and windowed in turn) sealed halfway by a humming
 *   force field. Fields stop people, not shots, grenades or sight: you can
 *   see the enemy the whole time.
 * - The lane clock: every 8 s the next step of a fixed rotation. The west
 *   pair opens, then the centre lane, then the east pair, then every lane
 *   is sealed and the maintenance tunnel under the band opens instead. The
 *   red lamp over a lane blinks for the 2 s before it opens.
 * - Over the band, a railed catwalk from compound to compound is always open
 *   and seen from everywhere.
 * - Under the band, the maintenance tunnel runs from the east of the south
 *   compound to the west of the north one, sealed by a field of its own
 *   that is open only while every lane is shut.
 * - Each flag sits in a pillbox at the back of its compound; each team
 *   spawns in a barracks whose doors open only for that team (team doors:
 *   the kit has no team-only field).
 *
 * Grid (one cell = 8 m; x east, y north). The north compound is the south
 * one turned 180°.
 *
 *   y  6   [B ][  ][  ][  ][PB][  ][  ][  ][  ]     PB pillbox (flag), B barracks
 *   y  2   [  ][T ][  ][  ][s ][  ][  ][T ][  ]     T guard tower, s catwalk stairs
 *   y  1           |1 ||2 ||3 ||4 ||5 |             lanes 1–5
 *   y  0           |~~||~~||~~||~~||~~|  ← fields   (catwalk over lane 3)
 *   y -1           |  ||  ||  ||  ||  |
 *   y -2   [  ][T ][  ][  ][  ][  ][  ][T ][t ]     t tunnel stairs
 *   y -6   [B ][  ][  ][  ][PB][  ][  ][  ][  ]
 *          x -4  -3  -2  -1   0   1   2   3   4
 */
import { type EdgeStyle, type LogicAction, type LogicRule, type Rotation, type Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('no_mans_field', "No Man's Field");
m.theme('military');
m.backdrop('cloudy', 'hills', 'gravel', 0.35);
m.teams([8, 8]);
const [SOUTH, NORTH] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const C = 8;
const P = Math.PI / 2;
const r2 = (n: number) => Math.round(n * 100) / 100;
const SIDES: Side[] = ['N', 'E', 'S', 'W'];
const turn = (s: Side, k: number): Side => SIDES[(SIDES.indexOf(s) + k) % 4]!;

// ---------------------------------------------------------------- the band: five lanes, the catwalk, the tunnel

const LANES = [-2, -1, 0, 1, 2];
for (const x of LANES) for (const y of [-1, 0, 1]) m.tile(x % 2 === 0 ? 'corridor_clear' : 'corridor_windows', x, y, 0, 0);
for (const y of [-1, 0, 1]) {
  // See and shoot from lane to lane; the band's outer walls are solid.
  for (const x of [-2, -1, 0, 1]) m.edge(x, y, 0, 'E', 'windows');
  m.edge(-2, y, 0, 'W', 'wall').edge(2, y, 0, 'E', 'wall');
}
// The catwalk: a railed bridge over the centre lane from compound to compound, open stairs at both ends.
for (const y of [-2, -1, 0, 1, 2]) m.tile('bridge', 0, y, 1, 0);
m.tile('stairs_open', 0, -3, 0, 3); // up from the south (0, -4) to the bridge
m.tile('stairs_open', 0, 3, 0, 1); // up from the north (0, 4) to the bridge
// The maintenance tunnel, a level down: from the south compound's east corner, west under the band, up into the north compound's west corner.
m.tile('stairs', 4, -2, -1, 1); // down from (4, -3), the tunnel runs north
m.tile('corridor_clear', 4, -1, -1, 0);
m.tile('corner', 4, 0, -1, 2); // south and west
for (let x = 3; x >= -3; x--) m.tile('corridor_clear', x, 0, -1, 1);
m.tile('corner', -4, 0, -1, 0); // east and north
m.tile('corridor_clear', -4, 1, -1, 0);
m.tile('stairs', -4, 2, -1, 3); // up into (-4, 3)

// ---------------------------------------------------------------- the compounds

/** The south compound; the north one is the same turned 180° (cell (x, y) -> (-x, -y), turns + 2). */
type Placer = { tile: (kind: string, x: number, y: number, rot: Rotation) => void; edge: (x: number, y: number, side: Side, style: EdgeStyle) => void; at: (x: number, z: number, y?: number) => V3; face: number; team: string; s: 1 | -1 };
const placers: Placer[] = [SOUTH, NORTH].map((team, i) => {
  const s = (i === 0 ? 1 : -1) as 1 | -1;
  return {
    team,
    s,
    face: s > 0 ? 0 : Math.PI,
    tile: (kind, x, y, rot) => m.tile(kind, s * x, s * y, 0, ((rot + (s > 0 ? 0 : 2)) % 4) as Rotation),
    edge: (x, y, side, style) => m.edge(s * x, s * y, 0, s > 0 ? side : turn(side, 2), style),
    at: (x, z, y = 0) => [r2(s * x), y, r2(s * z)],
  };
});
for (const c of placers) {
  const used = new Set(['0,-3', '4,-2', '0,-6', '-4,-5', '-4,-4', '-2,-4', '2,-4']);
  c.tile('military.pillbox', 0, -6, 1); // door west
  c.tile('military.barracks', -4, -5, 3); // cells (-4, -5) and (-4, -4): doors east and north
  c.tile('military.guard_tower', -2, -4, 2);
  c.tile('military.guard_tower', 2, -4, 2);
  for (let x = -4; x <= 4; x++) for (let y = -6; y <= -2; y++) if (!used.has(`${x},${y}`)) c.tile('yard', x, y, 0);
  // High walls round the compound (open to the lanes and the catwalk stairs).
  for (let y = -6; y <= -2; y++) {
    if (`-4,${y}` !== '-4,-5' && `-4,${y}` !== '-4,-4') c.edge(-4, y, 'W', 'high');
    if (y !== -2) c.edge(4, y, 'E', 'high');
  }
  for (let x = -4; x <= 4; x++) if (x !== 0) c.edge(x, -6, 'S', 'high');
  for (const x of [-4, -3, 3]) c.edge(x, -2, 'N', 'high');
  // The barracks' west door would open onto nothing: a wall there.
  c.edge(-4, -4, 'W', 'wall');
  // The spawn barracks: its doors open only for the home team.
  m.add({ kind: 'door', name: `${c.s > 0 ? 'South' : 'North'} barracks east door`, position: c.at(-3.5 * C, -5 * C), yaw: P, startOpen: false, locked: false, auto: true, style: 'blast', team: c.team });
  m.add({ kind: 'door', name: `${c.s > 0 ? 'South' : 'North'} barracks north door`, position: c.at(-4 * C, -3.5 * C), yaw: 0, startOpen: false, locked: false, auto: true, style: 'blast', team: c.team });
  // Spawns: four in the barracks aisle, four across the yard behind the lanes.
  for (const z of [-42, -38.5, -33, -29.5]) m.spawn(c.at(-4 * C, z), c.face, c.team);
  for (const x of [-20, -8, 8, 20]) m.spawn(c.at(x, -38), c.face, c.team);
  // The flag in the pillbox.
  m.flag(c.team, c.at(0, -6 * C + 1), c.face);
  m.light(c.at(0, -6 * C, 3.4), { fixture: 'bulb', color: '#ffd9a0', intensity: 0.9, range: 7 });

  // Cover in the yard: containers, sandbags, barriers, crates (clear of the lane mouths and the doors).
  for (const [model, x, z, yaw] of [
    ['shipping_container_red', -22, -26, 0], ['shipping_container_blue', 22, -27, 0], ['shipping_container_green', 30, -44, P],
    ['sandbag_nest', -8, -21, 0], ['sandbag_nest', 8, -21, 0], ['hesco_wall', -24, -36, P], ['hesco_wall', 25, -36, P],
    ['jersey_barrier', -14, -30, 0.3], ['jersey_barrier', 14, -30, -0.3], ['concrete_block', -6, -30, 0], ['concrete_block', 6, -30, 0],
    ['metal_crate', -12, -46, 0.2], ['ammo_crate', 12, -45, 0], ['fuel_drum', 18, -46, 0], ['fuel_drum', 19, -45, 0],
    ['supply_truck', 30, -30, 0], ['floodlight', -30, -20, 0.6], ['floodlight', 30, -20, -0.6],
  ] as [string, number, number, number][]) m.prop(model, c.at(x, z), c.face + yaw);
  // Field emitters and gate frames mark each lane mouth from the yard.
  for (const x of LANES) m.prop('os_laser_gate', c.at(x * C, -12.6), c.face, 1.4, false);
  // Floodlights over the yard.
  for (const [x, z] of [[-30, -20], [30, -20]] as const) m.light(c.at(x, z, 6.5), { fixture: 'none', color: '#fff1d6', intensity: 1.2, range: 22 });
  for (const [x, z] of [[-12, -40], [12, -40]] as const) m.light(c.at(x, z, 5), { fixture: 'none', color: '#fff1d6', intensity: 0.9, range: 16 });

  // Pickups: rifles and SMGs at home, the launcher on the catwalk end, armour by the tower, grenades at the lane mouths.
  m.pickup('weapon_rifle', c.at(-14, -40)).pickup('weapon_smg', c.at(14, -40)).pickup('weapon_shotgun', c.at(-28, -24));
  m.pickup('weapon_burst_rifle', c.at(28, -24)).pickup('grenades', c.at(-8, -16)).pickup('grenades', c.at(8, -16));
  m.pickup('armor_small', c.at(-17.3, -34.7, 3)).pickup('health_small', c.at(-30, -46)).pickup('health_small', c.at(4, -48)).pickup('health_large', c.at(28, -34));
  m.pickup('ammo', c.at(-4, -36)).pickup('ammo_rifle', c.at(24, -46));
}

// ---------------------------------------------------------------- fields, lamps and props in the band

const FIELD_W = 7.5;
const fieldId = (lane: number) => `field_lane_${lane}`;
const lampId = (lane: number) => `lamp_lane_${lane}`;
LANES.forEach((x, i) => {
  const lane = i + 1;
  // Hidden until the clock raises it: the bots' map sees the lanes open, so they walk them and wait at a shut field.
  m.field([x * C, 0, 0], FIELD_W, 4, { id: fieldId(lane), tint: '#5ad8ff', hidden: true });
  m.prop('os_field_emitter', [x * C - 3.6, 0, 0], 0, 1.2, true).prop('os_field_emitter', [x * C + 3.6, 0, 0], 0, 1.2, true);
  m.light([x * C, 3.6, 0], { fixture: 'bulb', color: '#ff3020', intensity: 1.4, range: 9, id: lampId(lane), off: true });
  for (const z of [-8, 8]) m.light([x * C, 3.5, z], { fixture: 'strip', color: '#cfe8ff', intensity: 0.7, range: 8 });
});
// Low cover inside the lanes, either side of the field.
for (const [x, z] of [[-16, -5], [-8, 6], [0, -6], [8, 5], [16, -6], [-16, 6], [16, 5]] as const) m.prop('sandbag_wall_low', [x + (z > 0 ? 1.5 : -1.5), 0, z], 0);
// The tunnel field at the halfway line, its lamp, and work lights down the tunnel.
m.field([0, -4, 0], FIELD_W, 4, { id: 'field_tunnel', yaw: P, tint: '#ffb347', hidden: true });
m.prop('os_field_emitter', [0, -4, -3.6], 0, 1.2, true).prop('os_field_emitter', [0, -4, 3.6], 0, 1.2, true);
m.light([0, -0.4, 0], { fixture: 'bulb', color: '#ffb347', intensity: 1.4, range: 9, id: 'lamp_tunnel', off: true });
for (const [x, z] of [[32, -8], [24, 0], [-24, 0], [-32, 8]] as const) m.light([x, -0.6, z], { fixture: 'strip', color: '#ffe9c0', intensity: 0.7, range: 9, yaw: z === 0 ? 0 : P });
m.prop('os_floor_cables', [12, -4, 0], P).prop('os_pipe_junction', [-12, -4, 2.4], 0).prop('os_coolant_pipe', [20, -4, -2.6], 0);
// The halfway line on the catwalk.
m.light([0, 5.6, 0], { fixture: 'none', color: '#bfe8ff', intensity: 1, range: 12 });
m.pickup('weapon_launcher', [0, 4, 0]).pickup('weapon_lmg', [16, -4, 0]).pickup('weapon_lmg', [-16, -4, 0]);

// ---------------------------------------------------------------- logic: the lane clock

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], cond: LogicRule['if'] = []): LogicRule => ({ id, name, enabled: true, once: false, when, if: cond, do: does });
const phaseIs = (n: number): LogicRule['if'] => [{ type: 'variable', target: 'var_phase', op: '==', value: n, state: '' }];
/** What each phase opens: 1 the west pair, 2 the centre, 3 the east pair, 0 the tunnel (every lane shut). */
const OPEN: Record<number, string[]> = { 1: [fieldId(1), fieldId(2)], 2: [fieldId(3)], 3: [fieldId(4), fieldId(5)], 0: ['field_tunnel'] };
const LAMP: Record<number, string[]> = { 1: [lampId(1), lampId(2)], 2: [lampId(3)], 3: [lampId(4), lampId(5)], 0: ['lamp_tunnel'] };
const NAME: Record<number, string> = { 1: 'West lanes', 2: 'Centre lane', 3: 'East lanes', 0: 'Tunnel' };
const ALL = [...Object.values(OPEN).flat()];
const STEP = 8;
const TELL = 2;
const rules: LogicRule[] = [
  rule('rule_start', 'Start the lane clock', { event: 'match_start', target: null }, [
    act('message', null, { value: 4, text: "No Man's Field: the lanes open in turn every 8 seconds. Watch the red lamps." }),
    act('timer_start', 'timer_lanes'),
    act('set_var', 'var_phase', { value: 1 }),
  ]),
  rule('rule_tick', 'The clock ticks', { event: 'timer_done', target: 'timer_lanes' }, [act('add_var', 'var_phase', { value: 1 })]),
  rule('rule_wrap', 'After the east pair, the tunnel', { event: 'variable_changed', target: 'var_phase' }, [act('set_var', 'var_phase', { value: 0 })], phaseIs(4)),
];
for (const k of [1, 2, 3, 0]) {
  const next = k === 3 ? 0 : k === 0 ? 1 : k + 1;
  rules.push(
    rule(`rule_phase_${k}`, `${NAME[k]} open`, { event: 'variable_changed', target: 'var_phase' }, [
      // Raise every other field, drop this phase's, put its lamps out; then 2 s before the next step, blink the next lamps.
      ...ALL.filter((id) => !OPEN[k]!.includes(id)).map((id) => act('block_restore', id)),
      ...OPEN[k]!.map((id) => act('block_drop', id)),
      ...LAMP[k]!.flatMap((id) => [act('light_blink', id, { state: 'off' }), act('light_off', id)]),
      act('sound', null, { state: 'chime' }),
      act('wait', null, { value: STEP - TELL }),
      ...LAMP[next]!.flatMap((id) => [act('light_on', id), act('light_blink', id, { value: 4, state: 'on' })]),
      act('sound', null, { state: 'buzzer' }),
    ], phaseIs(k)),
  );
}
m.logic({
  variables: [{ id: 'var_phase', name: 'Lane phase', initial: 0 }],
  timers: [{ id: 'timer_lanes', name: 'Lane clock', seconds: STEP, loop: true, visible: true }],
  objectives: [],
  rules,
});

m.bounds('invisible', 2);
m.border('fence');
m.meta({
  description:
    "Two walled compounds face each other across a band of five lanes, each sealed halfway by a force field that stops people but not bullets. Every 8 seconds the clock opens the next lanes in a fixed rotation (west pair, centre, east pair, then the maintenance tunnel underneath while every lane is shut), and a red lamp blinks over a lane for the 2 seconds before it opens. The railed catwalk over the band is always open, and always in sight. Flags sit in pillboxes; each team spawns in a barracks only it can open.",
  modes: ['core.ctf', 'core.tdm'],
  players: [8, 16],
});
await m.save();
