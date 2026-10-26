/**
 * Clockwork: a duel inside a giant clock tower where the pendulum is a
 * weapon. Our own map and name (MAP_IDEAS no. 9), in the Gothic Estate
 * style, for Deathmatch from 1v1 to a free-for-all of 6 and Team
 * Deathmatch 2v2.
 *
 * A 16 m shaft three storeys high runs up the middle of a 32 m tower:
 *
 * - Ground floor: the shaft floor, a ring of rooms round it through arches,
 *   stairwells up in two corners.
 * - Middle storey: a ring of galleries open to the shaft, joined across it by
 *   a narrow bridge, and the pendulum: a brass bob the size of a car on a
 *   6 m rod, hinged under the belfry and swinging ±38° across the bridge
 *   every two seconds. Mid-swing it runs over whoever it meets (its hinge
 *   rides a short track, so the run-over strike applies; see the note at
 *   the pendulum). The armour sits in the middle of the bridge.
 * - Top storey: a catwalk round the inside of the shaft (over the swing),
 *   galleries, and the clock room on the west side: the clock's movement
 *   fills it but for a narrow ledge behind its window bay, which looks
 *   across the shaft and the pendulum: the sniper perch, behind the face of
 *   the clock on the outside wall.
 * - The escapement: three gear-platform lifts at offset waits, the fastest
 *   way up: shaft floor to the middle gallery, the gallery ledge to the top
 *   catwalk, and the top gallery to the roof.
 * - Roof and belfry: walled roof terraces round the belfry, a big bell under
 *   a beamed roof between two bell hammers (crushers).
 * - On the hour (every 60 s) the clock strikes: the hammers come down, every
 *   light flashes and the boom sounds four times.
 *
 * Grid (one cell = 8 m; x east, y north), every storey:
 *
 *   y 2   [ Sw ][  r ][ r* ][ St ]    St stairwell (0-1), S stairs (1-2),
 *   y 1   [ S  ][ SHAFT     ][ S  ]    S* stairs (2-3), r rooms,
 *   y 0   [ S  ][ (2 × 2)   ][ r  ]    C clock room (west, storey 2),
 *   y -1  [ St ][ S* ][  r ][  r ]    belfry over the shaft on storey 3
 *         x -1    0     1     2
 */
import { type LogicAction, type LogicRule, type RoomOptions, type Side, type EdgeStyle } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('clockwork', 'Clockwork');
m.theme('gothic_estate');
m.backdrop('dusk', 'city', 'stone', 0.45);

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;

// ---------------------------------------------------------------- tiles

const ROOM: RoomOptions = { layout: 'empty', ceiling: 'roof', facade: 'gothic_stone', corners: 'columns' };
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);

// Storey 0: the shaft floor (open to the sky of the shaft), the ring, stairwells in two corners.
m.tile('room_large', 0, 0, 0, 0, { layout: 'empty', ceiling: 'open' });
m.tile('stairwell', -1, -1, 0, 2); // doors east, both storeys
m.tile('stairwell', 2, 2, 0, 0); // doors west, both storeys
const RING0: [number, number][] = [[0, -1], [1, -1], [2, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 2], [-1, 1], [-1, 0]];
for (const [x, y] of RING0) m.tile('room', x, y, 0, 0, ROOM);
// Storey 1: the galleries; stairs up to storey 2 in the west and east sides.
const RING1: [number, number][] = [[0, -1], [1, -1], [2, -1], [2, 0], [1, 2], [0, 2], [-1, 2], [-1, 1]];
// The galleries either end of the bridge are long rooms (no wall between their two cells for the bridge to meet).
m.tile('room_long', 0, -1, 1, 1, ROOM).tile('room_long', 0, 2, 1, 1, ROOM);
for (const [x, y] of [[2, -1], [2, 0], [-1, 2], [-1, 1]] as const) m.tile('room', x, y, 1, 0, ROOM);
m.tile('stairs', -1, 0, 1, 1); // up from the north (-1, 1) to the south (-1, -1) on storey 2
m.tile('stairs', 2, 1, 1, 3); // up from the south (2, 0) to the north (2, 2) on storey 2
// Storey 2: galleries, the clock room; stairs up to the roof.
const RING2: [number, number][] = [[-1, -1], [1, -1], [2, -1], [2, 2], [0, 2], [-1, 2], [-1, 1]];
for (const [x, y] of RING2) m.tile('room', x, y, 2, 0, ROOM);
m.tile('room', 2, 0, 2, 0, { ...ROOM, ceiling: 'open' }); // open to the sky: the roof lift rides up through it
m.tile('stairs', 0, -1, 2, 0); // up from the west (-1, -1) onto the roof of (1, -1)
m.tile('stairs', 1, 2, 2, 2); // up from the east (2, 2) onto the roof of (0, 2)
// Storey 3: the belfry over the shaft, open on every side to the roof terraces.
m.tile('room_large', 0, 0, 3, 0, { layout: 'empty', ceiling: 'beams', facade: 'gothic_stone', corners: 'columns' });

// Doors round the ring.
for (const [x, y, side] of [[0, -1, 'E'], [1, -1, 'E'], [2, -1, 'N'], [2, 0, 'N'], [1, 2, 'W'], [0, 2, 'W'], [-1, 2, 'S'], [-1, 1, 'S']] as const) edge(x, y, 0, side, 'door');
for (const [x, y, side] of [[1, -1, 'E'], [2, -1, 'N'], [0, 2, 'W'], [-1, 2, 'S']] as const) edge(x, y, 1, side, 'door');
for (const [x, y, side] of [[1, -1, 'E'], [2, -1, 'N'], [0, 2, 'W'], [-1, 2, 'S']] as const) edge(x, y, 2, side, 'door');
// Into the shaft: arches on the ground floor, open galleries above (the bridge and lift landings), the clock room's window bay.
for (const [x, y, side] of [[0, -1, 'N'], [1, -1, 'N'], [2, 0, 'W'], [2, 1, 'W'], [1, 2, 'S'], [0, 2, 'S'], [-1, 1, 'E'], [-1, 0, 'E']] as const) edge(x, y, 0, side, 'arch');
for (const [x, y, side] of [[0, -1, 'N'], [1, -1, 'N'], [2, 0, 'W'], [1, 2, 'S'], [0, 2, 'S'], [-1, 1, 'E']] as const) edge(x, y, 1, side, 'open');
for (const [x, y, side] of [[1, -1, 'N'], [2, 0, 'W'], [0, 2, 'S']] as const) edge(x, y, 2, side, 'open');
edge(-1, 1, 2, 'E', 'windows');
// The belfry: arches all round onto the roof terraces.
for (const [x, y, side] of [[0, 0, 'S'], [1, 0, 'S'], [1, 0, 'E'], [1, 1, 'E'], [1, 1, 'N'], [0, 1, 'N'], [0, 1, 'W'], [0, 0, 'W']] as const) edge(x, y, 3, side, 'arch');
// Windows onto the town round the outside.
for (const [x, y, z, side] of [
  [0, -1, 0, 'S'], [1, -1, 1, 'S'], [2, -1, 2, 'S'], [2, 0, 0, 'E'], [2, 0, 1, 'E'], [2, 1, 0, 'E'],
  [1, 2, 0, 'N'], [0, 2, 1, 'N'], [-1, 2, 2, 'N'], [-1, 1, 0, 'W'], [-1, 2, 1, 'W'], [1, -1, 2, 'S'],
] as const) edge(x, y, z, side, 'windows');

// ---------------------------------------------------------------- free blocks: bridge, catwalk, roof walls

const WOOD = 'pbr_walnut';
// The bridge across the shaft on the middle storey, north to south through the pendulum's swing.
m.block([4, 3.7, 4], [2.4, 0.3, 15.9], 'solid', { material: WOOD });
for (const x of [2.9, 5.1]) m.block([x, 3.7, 4], [0.2, 0.1, 15.9], 'solid', { material: 'brass' });
// The top catwalk round the inside of the shaft walls (over the swing), brass-edged.
m.block([4, 7.7, -3], [15.9, 0.3, 2], 'solid', { material: WOOD });
m.block([4, 7.7, 11], [15.9, 0.3, 2], 'solid', { material: WOOD });
m.block([-3, 7.7, 4], [2, 0.3, 11.9], 'solid', { material: WOOD });
m.block([11, 7.7, 4], [2, 0.3, 11.9], 'solid', { material: WOOD });
// Roof terraces: a parapet round the tower top (the roofs of storey 2).
for (const [x, z, w, d] of [[4, -11.85, 32, 0.3], [4, 19.85, 32, 0.3], [-11.85, 4, 0.3, 31.4], [19.85, 4, 0.3, 31.4]] as const) m.block([x, 12, z], [w, 1.1, d], 'solid', { material: 'pbr_castle_stone', tint: '#9a9488' });
// The ledge on the middle storey's east side where the second lift starts.
m.block([11, 3.7, -0.6], [2, 0.3, 2.6], 'solid', { material: WOOD });

// ---------------------------------------------------------------- the pendulum

// A brass bob on a rod, hinged under the belfry floor, swinging ±38° along x through the middle
// storey: its lowest point sweeps the bridge at head height. A hinge alone does not run anyone over
// (the run-over strike measures how fast a mover's hinge travels, not how fast its blocks turn), so
// the hinge also rides a 2 m track along the swing: mid-swing the pendulum moves fast enough to
// strike, and near the ends of its arc, where it slows, it only nudges.
const PIVOT: V3 = [4, 11.4, 4];
m.block([4, 4.3, 4], [1.6, 1.8, 2.8], 'solid', { material: 'brass', id: 'pend_bob' });
m.block([4, 6.1, 4], [0.3, 5.3, 0.3], 'solid', { material: 'brass', tint: '#7a6630', id: 'pend_rod' });
m.block([4, 11.4, 4], [5, 0.3, 0.6], 'solid', { material: 'pbr_walnut' }); // the hinge track under the belfry
const SWING = 0.66;
m.mover('mover_pendulum', PIVOT, ['pend_rod', 'pend_bob'], [[-1, 0, 0], [1, 0, 0]], { mode: 'pingpong', speed: 4, turnSpeed: 38, wait: 0, yaw: P, angles: [-SWING, SWING], name: 'Pendulum' });

// ---------------------------------------------------------------- the escapement: three gear lifts

const lift = (id: string, at: V3, rise: number, wait: number, gear: string) => {
  m.block(at, [2.6, 0.3, 2.6], 'solid', { material: 'brass', tint: '#c8a050', id: `${id}_deck` });
  // A gear wheel hung under the deck rides with it.
  m.add({ kind: 'prop', id: gear, model: 'prop.cog', position: [at[0], at[1] - 0.6, at[2]], yaw: 0, scale: 0.28, solid: false, tint: null });
  m.mover(id, [at[0], at[1], at[2]], [`${id}_deck`], [[0, 0, 0], [0, rise, 0]], { mode: 'pingpong', speed: 2, wait, props: [gear], name: id.replace('mover_', 'Gear lift ') });
};
// Shaft floor to the west gallery (middle storey).
lift('mover_a', [-2.7, -0.3, 8], 4, 1.5, 'gear_a');
// The east ledge (middle storey) to the top catwalk.
lift('mover_b', [8.7, 3.7, -0.6], 4, 2.5, 'gear_b');
// The east gallery (top storey, open to the sky) to the roof.
lift('mover_c', [18, 7.7, -2.5], 4, 3.5, 'gear_c');

// ---------------------------------------------------------------- the clock face and the belfry

// The clock face on the outside of the west wall: an ivory dial in a brass ring, hour marks and hands.
const DX = -12.5;
m.block([DX, 6.6, 4], [0.2, 6.8, 6.8], 'solid', { material: 'pbr_travertine', tint: '#f2ead8' });
for (const [y, z, h, d] of [[6.4, 4, 0.2, 7.2], [13.4, 4, 0.2, 7.2], [6.4, 0.5, 7.2, 0.2], [6.4, 7.5, 7.2, 0.2]] as const) m.block([DX - 0.05, y, z], [0.3, h, d], 'solid', { material: 'brass' });
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  m.block([DX - 0.12, +(10 + 2.8 * Math.cos(a) - 0.25).toFixed(2), +(4 + 2.8 * Math.sin(a)).toFixed(2)], [0.2, 0.5, 0.35], 'solid', { material: 'dark_wood' });
}
m.block([DX - 0.2, 10, 4], [0.2, 2.6, 0.3], 'solid', { material: 'dark_wood' }); // minute hand: twelve
m.block([DX - 0.25, 9.85, 4.75], [0.2, 0.3, 1.8], 'solid', { material: 'dark_wood', pitch: 0.52 }); // hour hand: two
m.light([-13.6, 10, 4], { fixture: 'none', color: '#ffe6b0', intensity: 1.2, range: 8, id: 'lamp_face' });

// The bell: tiers of brass hanging from the belfry beams, a bell hammer (crusher) either side.
for (const [y, s] of [[14.4, 2.6], [14.8, 2.2], [15.4, 1.6]] as const) m.block([4, y, 4], [s, y === 14.4 ? 0.4 : 0.6, s], 'solid', { material: 'brass' });
for (const x of [0.6, 7.4]) m.add({ kind: 'trap', id: x < 4 ? 'trap_hammer_w' : 'trap_hammer_e', name: x < 4 ? 'West bell hammer' : 'East bell hammer', trap: 'crusher', position: [x, 12, 4], yaw: 0, activation: 'logic', onSeconds: 1.2, offSeconds: 3, offsetSeconds: 0, startEnabled: true, damage: null });

// ---------------------------------------------------------------- dressing

// The clock room: the movement (gears, pistons, pipes) along the west wall leaves a narrow ledge behind the window bay.
m.block([-10.2, 8, 4], [3.6, 2.2, 14.6], 'solid', { material: 'pbr_walnut' });
for (const [y, z, sc] of [[10.2, 0.5, 0.42], [10.2, 6.5, 0.34], [10.9, 3.4, 0.28], [10.9, 9.6, 0.25]] as const) m.prop('cog', [-10.2, y, z], z, sc, false);
m.prop('piston', [-10.2, 10.2, -2], 0, 0.8, false).prop('pipe_valve', [-10.2, 10.2, 11], P, 0.9, false);
// Rooms round the ring: grandfather clocks, bookcases, armour, a piano, portraits.
for (const [model, x, y, z, yaw] of [
  ['ge_grandfather_clock', 3.2, 0, -11, 0], ['ge_bookcase_tall', 15, 0, -11.2, 0], ['ge_suit_of_armour', 19, 0, -2, -P], ['ge_wingback_chair', 18, 0, 10, -P],
  ['ge_grand_piano', 0.5, 0, 17, S], ['ge_bookcase_tall', -11.2, 0, 15, P], ['ge_writing_desk', -11, 0, -1, P], ['ge_candelabra', -6, 0, 18.5, 0],
  ['ge_bookcase_tall', -1, 4, -11.2, 0], ['ge_portrait', 18.9, 5.5, -9, -P], ['ge_suit_of_armour', 12.5, 4, -11, 0], ['ge_wingback_chair', 14, 4, 2, S],
  ['ge_grandfather_clock', 3, 4, 19.2, S], ['ge_bookcase_tall', -11.2, 4, 18, P], ['ge_writing_desk', -10.8, 4, 9, P],
  ['ge_suit_of_armour', -11, 8, -11, P / 2], ['ge_bookcase_tall', 13, 8, -11.2, 0], ['ge_candelabra', 19, 8, 16, 0], ['ge_wingback_chair', -2, 8, 18.5, S],
  ['ge_angel_statue', -10, 12, -10, P / 2], ['ge_angel_statue', 18, 12, 18, -P * 1.5], ['ge_gas_lamp', 16, 12, -10, 0], ['ge_gas_lamp', -8, 12, 18, 0],
] as [string, number, number, number, number][]) m.prop(model, [x, y, z], yaw, 1, !['ge_portrait', 'ge_candelabra', 'ge_gas_lamp'].includes(model));

// ---------------------------------------------------------------- light

const LAMPS: string[] = [];
const lamp = (at: V3, o: Parameters<MapBuilder['light']>[1] = {}) => {
  const id = `lamp_${LAMPS.length + 1}`;
  LAMPS.push(id);
  m.light(at, { ...o, id });
};
// Chandeliers in the ring rooms (storeys 0–2), candles up the shaft, gas lamps on the roof.
for (const [x, y] of RING0) lamp([x * 8, 3.3, y * 8], { fixture: 'chandelier', color: '#ffcf8a', intensity: 1, range: 9 });
for (const [x, y] of RING1) if ((x + y) % 2 === 0) lamp([x * 8, 7.3, y * 8], { fixture: 'chandelier', color: '#ffcf8a', intensity: 1, range: 9 });
for (const [x, y] of [...RING2, [2, 0]] as [number, number][]) if ((x + y) % 2 !== 0 || x === -1) lamp([x * 8, 11.3, y * 8], { fixture: 'candle', color: '#ffb860', intensity: 0.9, range: 8 });
for (const [x, z] of [[-3, -3], [11, -3], [-3, 11], [11, 11]] as const) lamp([x, 2.6, z], { fixture: 'candle', color: '#ffb860', intensity: 1, range: 10 });
lamp([4, 9.5, 4], { fixture: 'none', color: '#ffd9a0', intensity: 1.2, range: 14 });
lamp([4, 15.2, 4], { fixture: 'chandelier', color: '#ffd9a0', intensity: 1.2, range: 12 });
for (const [x, z] of [[16, -10], [-8, 18]] as const) lamp([x, 14.2, z], { fixture: 'none', color: '#ffe0a0', intensity: 0.8, range: 10 });
LAMPS.push('lamp_face');

// ---------------------------------------------------------------- logic: the hour strikes

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
const boom = (n: number): LogicAction[] => Array.from({ length: n }, (_, i) => [act('sound', null, { state: 'boom' }), ...(i < n - 1 ? [act('wait', null, { value: 1.2 })] : [])]).flat();
m.logic({
  variables: [],
  timers: [{ id: 'timer_hour', name: 'The hour', seconds: 60, loop: true, visible: true }],
  objectives: [],
  rules: [
    rule('rule_start', 'Wind the clock', { event: 'match_start', target: null }, [act('timer_start', 'timer_hour'), act('message', null, { value: 4, text: 'Clockwork: mind the pendulum. On the hour the bell hammers come down.' })]),
    rule('rule_strike', 'The hour strikes: hammers and the boom', { event: 'timer_done', target: 'timer_hour' }, [act('message', null, { value: 2, text: 'The clock strikes!' }), act('trap_fire', 'trap_hammer_w'), act('trap_fire', 'trap_hammer_e'), ...boom(4)]),
    rule('rule_flash', 'The hour strikes: every light flashes', { event: 'timer_done', target: 'timer_hour' }, LAMPS.map((id) => act('light_flash', id, { value: 0.6 }))),
  ],
});

// ---------------------------------------------------------------- spawns and pickups

for (const [p, yaw] of [
  [[16, 0, -8], P], [[-8, 0, 16], -P], [[8, 0, 0], 0],
  [[10, 4, -8], 0], [[-2, 4, 16], S],
  [[16, 8, -8], S], [[-8, 8, 16], 0],
  [[-1.5, 12, 10], S], [[11, 8, 8], -P],
] as [V3, number][]) m.spawn(p, yaw);

m.pickup('armor_large', [4, 4, 4]); // the middle of the bridge, in the pendulum's path
m.pickup('weapon_rockets', [4, 12, -2]).pickup('ammo_explosive', [4, 12, 10]); // the belfry
m.pickup('weapon_sniper', [-6.5, 8, 4]).pickup('ammo_sniper', [-6.5, 8, 12]); // the clock room's ledge
m.pickup('weapon_shotgun', [0, 0, 8]).pickup('weapon_smg', [16, 0, 8]).pickup('weapon_burst_rifle', [-8, 4, 0.5]).pickup('weapon_launcher', [16, 4, -4]);
m.pickup('ammo_shells', [8, 0, -8]).pickup('ammo', [0, 4, -8]).pickup('ammo_light', [0, 8, 16]);
m.pickup('health_small', [-8, 0, 0]).pickup('health_small', [16, 4, -12 + 2]).pickup('health_small', [11, 8, 11]).pickup('health_small', [8, 12, -8]);
m.pickup('health_large', [-8, 4, 16]).pickup('armor_small', [16, 8, 16]).pickup('armor_small', [-3, 8, -3]);

m.bounds('invisible', 3);
m.meta({
  description:
    'A duel inside a giant clock tower. A brass pendulum the size of a car swings through the middle of the shaft, across the bridge where the armour waits, and runs over anyone it meets mid-swing. Gear lifts tick up the shaft, the clock room\'s window bay is the sniper perch behind the clock face, and every minute the clock strikes: the bell hammers come down in the belfry, every light flashes and the boom rolls four times.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 6],
});
await m.save();
