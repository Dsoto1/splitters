/**
 * Bunker Cross: a remake, from the original's layout, of Half-Life
 * deathmatch's Crossfire (our own pieces, names and dressing). Two concrete
 * base complexes, Embers west and Tide east, face each other across a sunken
 * courtyard open to the sky. Everything is point-symmetric about the middle of
 * the bridge.
 *
 * - The courtyard (4 m down): sand, sandbags and crates, two concrete stair
 *   huts down to the bomb shelter, and a grated vent hole at each end that
 *   drops into the tunnels (a jump pad under each throws you back up). Long
 *   ramps climb out of its four corners to the bases' ground floors, and each
 *   base has two doors from its basement straight onto the courtyard floor.
 * - The bridge: a railed walkway across the middle of the courtyard at
 *   ground-floor height, base to base, with the rocket launcher at its centre.
 * - The crossfire walkways: open catwalks along the north and south rims a
 *   storey up, joining the bases' sniper galleries (fenced on the outside,
 *   railed over the courtyard), over the side halls that join the bases'
 *   ground floors behind slit windows.
 * - Each base: a basement (doors to the courtyard, stairs down to the
 *   tunnel), a ground floor whose front hall opens on the ramps and the bridge
 *   (one balcony to jump down from), a sniper gallery over it, back rooms,
 *   and a sandbagged sniper nest on the roof over the gallery (the sniper
 *   rifle, our crossbow).
 * - Underground: a tunnel from each base basement to the bomb shelter under
 *   the bridge (the railgun), past the vents.
 * - The air strike: a button in the strike control room off the north side
 *   hall (red lamps). Siren three times and a 10 s countdown on every HUD; at
 *   7 s the shelter's four blast doors (amber lamps) lock shut; at 10 s a
 *   rolling bombardment sweeps the courtyard, the ramps, the bridge, the
 *   catwalks and the roof nests from west to east; the doors reopen after it
 *   and the button comes back after 60 s. The bases and halls are roofed and
 *   safe; out in the open you have ten seconds to get indoors or underground.
 *
 * Grid x east, y north (one cell = 8 m); levels z-2 tunnels and shelter (-8 m),
 * z-1 courtyard and basements (-4 m), z0 ground floors, bridge and side halls,
 * z1 galleries and catwalks, z2 roof nests.
 *
 *   y4                            C                               C strike control (button), R radar room
 *   y3   r  g  h  h  h  h  h  h  h  h  h  g  r                    h side halls (z0) under the catwalks (z1)
 *   y2   r  r  g  /  /  .  .  .  \  \  g  r  r                    / \ ramps up to the ground floors
 *   y1   r  s  g  d  v  .  H  .  .  .  b  s  r                    d basement doors (z-1) / balconies (z0)
 *   y0   r  r  g  =  =  =  =  =  =  =  g  r  r                    = bridge (z0) over the shelter (z-2); H huts down
 *   y-1  r  s  b  .  .  .  H  .  v  d  g  s  r                    v vent holes into the tunnels, s stairwells
 *   y-2  r  r  g  /  /  .  .  .  \  \  g  r  r                    g front halls (z0) / sniper galleries (z1)
 *   y-3  r  g  h  h  h  h  h  h  h  h  h  g  r
 *   y-4                            R
 *       -6 -5 -4 -3 -2 -1  0  1  2  3  4  5  6
 */
import { TERRAIN_MATERIALS, boxBounds, buildMapGeometry, newTerrain, paintSlopes, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Rotation, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('bunker_cross', 'Bunker Cross');
m.theme('bunker');
m.backdrop('clear', 'mesas', 'sand', 0.45);
m.teams([8, 8]);
const [embers, tide] = m.teamIds() as [string, string];
const P = Math.PI / 2;
type V3 = [number, number, number];
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];

// ---------------------------------------------------------------- surfaces

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const BASE: TileSurfaces = { floor: mat('pbr_concrete_dark', '#8f8a7e'), walls: mat('pbr_concrete', '#cbbf9f'), solids: mat('pbr_concrete', '#a99f86'), trim: mat('pbr_steel', '#4a4e48') };
const GALLERY: TileSurfaces = { floor: mat('pbr_tread_plate', '#8a8a80'), walls: mat('pbr_concrete', '#c2b696'), trim: mat('hazard') };
const BACK: TileSurfaces = { floor: mat('pbr_concrete', '#9a9384'), walls: mat('pbr_plaster', '#b9b49a'), trim: mat('pbr_steel', '#4a4e48') };
const YARD: TileSurfaces = { floor: mat('pbr_sand', '#cdb487'), walls: mat('pbr_concrete', '#bdae8c'), solids: mat('pbr_concrete', '#b0a282'), trim: mat('pbr_concrete', '#8f8670') };
const RAMP: TileSurfaces = { floor: mat('pbr_concrete', '#a89c80'), walls: mat('pbr_concrete', '#bdae8c'), solids: mat('pbr_concrete', '#b2a586'), trim: mat('hazard') };
const WALK: TileSurfaces = { floor: mat('pbr_walkway'), walls: mat('pbr_concrete', '#bdae8c'), trim: mat('pbr_steel', '#3e423c') };
const SHELTER: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_concrete', '#8e8c84'), solids: mat('pbr_concrete', '#7e7c74'), trim: mat('hazard') };
const TUNNEL: TileSurfaces = { floor: mat('pbr_concrete_dark'), walls: mat('pbr_concrete', '#86847a'), solids: mat('pbr_concrete', '#76746a'), trim: mat('pbr_rusted_plate') };
const CONTROL: TileSurfaces = { floor: mat('pbr_terrazzo', '#8c8a80'), walls: mat('pbr_white_panel', '#c8c6b8'), trim: mat('hazard') };

function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
function place(kind: string, x: number, y: number, z: number, surf: TileSurfaces, rot: Rotation = 0, opts?: RoomOptions): void {
  m.tile(kind, x, y, z, rot, opts);
  paint(x, y, z, surf);
}
const edges = (x: number, y: number, z: number, list: [Side, EdgeStyle][]) => list.forEach(([s, e]) => m.edge(x, y, z, s, e));
const ROOF: RoomOptions = { ceiling: 'roof', corners: 'chamfered' };

// ---------------------------------------------------------------- the courtyard (z-1)

/** Long ramps out of the four corners: anchored on the courtyard side, climbing out to the bases. */
const RAMPS: [number, number, Rotation][] = [[-2, 2, 2], [-2, -2, 2], [2, 2, 0], [2, -2, 0]];
const rampCell = (x: number, y: number) => RAMPS.some(([ax, ay]) => ay === y && (x === ax || x === ax + Math.sign(ax)));
/** Vent holes (drop shafts) into the tunnels: west one north of the bridge, east one south. */
const VENTS: [number, number, Rotation][] = [[-2, 1, 0], [2, -1, 2]];
const yardCells: [number, number][] = [];
for (let x = -3; x <= 3; x++) {
  for (let y = -2; y <= 2; y++) {
    if (rampCell(x, y) || (x === 0 && Math.abs(y) === 1) || VENTS.some(([vx, vy]) => vx === x && vy === y)) continue;
    place('yard', x, y, -1, YARD);
    yardCells.push([x, y]);
  }
}
for (const [ax, ay, rot] of RAMPS) {
  place('ramp', ax, ay, -1, RAMP, rot);
  const inner: Side = ay > 0 ? 'S' : 'N';
  const s = Math.sign(ax);
  // Open along the courtyard side (walk off the ramp anywhere), and no door frame at its foot.
  for (const x of [ax, ax + s]) for (const z of [-1, 0]) m.edge(x, ay, z, inner, 'open');
  m.edge(ax - s, ay, -1, s < 0 ? 'W' : 'E', 'open');
}
for (const [vx, vy, rot] of VENTS) {
  place('drop', vx, vy, -1, YARD, rot);
  for (const side of ['N', 'S', 'E', 'W'] as const) m.edge(vx, vy, -1, side, 'open');
}

// ---------------------------------------------------------------- the shelter and the tunnels (z-2)

// The bomb shelter under the bridge: three bays joined by arches.
for (const x of [-1, 0, 1]) place('room', x, 0, -2, SHELTER, 0, { corners: 'chamfered' });
m.edge(-1, 0, -2, 'E', 'arch').edge(0, 0, -2, 'E', 'arch');
// Stair huts from the courtyard down into the shelter's middle bay (the huts stand in the courtyard).
place('stairs', 0, 1, -2, SHELTER, 3);
place('stairs', 0, -1, -2, SHELTER, 1);
for (const y of [1, -1]) m.block(at(0, y, 0, 0, 0, -0.35), [8.6, 0.35, 8.6], 'solid', { material: 'pbr_concrete', tint: '#a89c80' });
for (const s of [-1, 1] as const) {
  // Junction (with the vent chamber off it), tunnel, and stairs up into the base basement.
  place('junction_t', 2 * s, 0, -2, TUNNEL, s < 0 ? 0 : 2);
  place('corridor_clear', 3 * s, 0, -2, TUNNEL, 1);
  place('stairs', 4 * s, 0, -2, TUNNEL, s < 0 ? 2 : 0);
  place('room', 2 * s, -s, -2, TUNNEL); // vent chamber under the hole
}

// ---------------------------------------------------------------- the bridge (z0) and the rims (side halls z0, catwalks z1)

for (let x = -3; x <= 3; x++) place('bridge', x, 0, 0, WALK, 1);
for (const y of [3, -3] as const) {
  const inner: Side = y > 0 ? 'S' : 'N';
  const outer: Side = y > 0 ? 'N' : 'S';
  for (let x = -3; x <= 3; x++) {
    place('room', x, y, 0, BASE);
    if (Math.abs(x) <= 1) m.edge(x, y, 0, inner, x === 0 ? 'slit' : 'windows'); // over the courtyard
    if (x < 3) m.edge(x, y, 0, 'E', 'arch');
    if (x !== 0) m.edge(x, y, 0, outer, 'wall');
    place('platform_rail', x, y, 1, WALK);
    m.edge(x, y, 1, outer, 'fence');
  }
}
// Strike control (north, the button) and the radar room (south), off the middle of the side halls.
place('room', 0, 4, 0, CONTROL, 0, ROOF);
place('room', 0, -4, 0, CONTROL, 0, ROOF);

// ---------------------------------------------------------------- the bases (west: s = -1, Embers; east: s = 1, Tide)

for (const s of [-1, 1] as const) {
  const X = (n: number) => s * n;
  /** Point symmetry: the east base is the west one turned half round. */
  const Y = (n: number) => -s * n;
  const ins: Side = s < 0 ? 'E' : 'W';
  const climbOut: Rotation = s < 0 ? 2 : 0; // stairs climbing away from the courtyard; stairwells opening toward it
  const climbIn: Rotation = s < 0 ? 0 : 2;

  // Basement (z-1): two doors onto the courtyard, the tunnel stairs arriving in the middle, a stairwell up.
  for (const n of [1, -1]) place('room', X(4), Y(n), -1, BASE);
  place('room', X(5), Y(-1), -1, BASE);
  place('room', X(5), 0, -1, BASE);
  place('stairwell', X(5), Y(1), -1, BASE, climbOut);
  for (const n of [1, -1]) m.edge(X(4), Y(n), -1, ins, 'wide');

  // Ground floor (z0): the front hall (arches along it), back rooms, rear block.
  for (let y = -3; y <= 3; y++) place('room', X(4), y, 0, BASE, 0, Math.abs(y) <= 2 ? { layout: 'empty' } : undefined);
  for (let y = -2; y <= 1; y++) m.edge(X(4), y, 0, 'N', 'arch');
  for (const y of [2, -2]) m.edge(X(4), y, 0, ins, 'wide'); // onto the ramp tops
  m.edge(X(4), 0, 0, ins, 'arch'); // onto the bridge
  m.edge(X(4), Y(1), 0, ins, 'half'); // a balcony to jump down from
  m.edge(X(4), Y(-1), 0, ins, 'windows');
  for (const n of [-3, -2, 0, 2, 3]) place('room', X(5), Y(n), 0, BACK);
  place('stairwell', X(5), Y(-1), 0, BASE, climbOut);
  for (const y of [-1, 0, 1]) place('room', X(6), y, 0, BACK);

  // Upper floor (z1): the sniper gallery over the hall, back rooms, the stairs up to the roof nest.
  for (let y = -3; y <= 3; y++) place('room', X(4), y, 1, GALLERY, 0, ROOF);
  for (let y = -2; y <= 1; y++) m.edge(X(4), y, 1, 'N', 'arch');
  for (const [y, style] of [[0, 'slit'], [1, 'windows'], [-1, 'windows'], [2, 'window'], [-2, 'window']] as const) m.edge(X(4), y, 1, ins, style);
  for (const n of [-3, -2, 1, 2, 3]) place('room', X(5), Y(n), 1, BACK, 0, ROOF);
  place('stairs', X(5), 0, 1, BASE, climbIn);
  for (const y of [-1, 0, 1]) place('room', X(6), y, 1, BACK, 0, ROOF);

  // The roof nest (z2) over the middle of the gallery: slits to the sides, railed over the courtyard.
  place('platform_rail', X(4), 0, 2, WALK);
  edges(X(4), 0, 2, [['N', 'slit'], ['S', 'slit'], [ins, 'railing']]);
  // Concrete lids on the stairwell and the nest stairs.
  m.block(at(X(5), Y(-1), 2), [8.6, 0.35, 8.6], 'solid', { material: 'pbr_concrete', tint: '#a99f86' });
  m.block(at(X(5), 0, 3), [8.6, 0.35, 8.6], 'solid', { material: 'pbr_concrete', tint: '#a99f86' });
}

// ---------------------------------------------------------------- jump pads out of the vents

for (const [vx, vy, rot] of VENTS) {
  const f = rot === 2 ? -1 : 1;
  m.padTo(at(vx, vy, -2, 0, -1.2 * f), at(vx, vy, -1, 0, 2.8 * f), 17);
}

// ---------------------------------------------------------------- scenario: the air strike

const DOORS = ['door_shelter_n', 'door_shelter_s', 'door_shelter_w', 'door_shelter_e'];
const door = (id: string, name: string, pos: V3, yaw: number) => m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked: false, auto: true });
door('door_shelter_n', 'Shelter door (north hut)', [0, -8, 4], 0);
door('door_shelter_s', 'Shelter door (south hut)', [0, -8, -4], 0);
door('door_shelter_w', 'Shelter door (west tunnel)', [-12, -8, 0], P);
door('door_shelter_e', 'Shelter door (east tunnel)', [12, -8, 0], P);
m.add({ kind: 'button', id: 'btn_strike', name: 'Air strike control', position: at(0, 4, 0, 0, 3.2), yaw: Math.PI, label: 'Call the air strike', once: false, cooldownSeconds: 60, startEnabled: true });

/** A wall lamp `up` m over a spot on a wall, facing out of it along `yaw`. */
const lamp = (pos: V3, yaw: number, color: string, up = 2.3, range = 5) => m.light([pos[0] - Math.sin(yaw) * 0.25, pos[1] + up, pos[2] - Math.cos(yaw) * 0.25], { fixture: 'wall', color, intensity: 1, range, yaw });
// Tells: red lamps either side of the button, amber lamps over every shelter door (both faces) and at the hut doors.
lamp(at(0, 4, 0, -1.2, 3.75), Math.PI, '#ff3a2a');
lamp(at(0, 4, 0, 1.2, 3.75), Math.PI, '#ff3a2a');
for (const [y, yaw] of [[4, 0], [-4, Math.PI]] as const) {
  lamp([0, -8, y + (y > 0 ? -0.15 : 0.15)], yaw + Math.PI, '#ffb040', 3.3, 6);
  lamp([0, -4, y * 3 + (y > 0 ? -0.15 : 0.15)], yaw, '#ffb040', 3.3, 7); // over the hut doors in the courtyard
}
for (const x of [-12, 12]) {
  lamp([x + (x > 0 ? -0.15 : 0.15), -8, 0], x > 0 ? -P : P, '#ffb040', 3.3, 6);
  lamp([x + (x > 0 ? 0.15 : -0.15), -8, 0], x > 0 ? P : -P, '#ffb040', 3.3, 6);
}

// The charges: logic-only mines (enabled for the second they fire) buried 0.2 m under every
// open floor on a 4 m grid, so nowhere outside is more than about 3 m from one.
const spots: V3[] = [];
const GRID = [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const;
for (const [x, y] of yardCells) for (const [dx, dy] of GRID) spots.push(at(x, y, -1, dx, dy, -0.2));
for (const [vx, vy, rot] of VENTS) for (const dx of [-2.5, 2.5]) spots.push(at(vx, vy, -1, dx, 2.75 * (rot === 2 ? -1 : 1), -0.2)); // the strip beside the hole
for (const [ax, ay] of RAMPS) {
  const s = Math.sign(ax);
  // Steps of 1 m run and 0.25 m rise from the foot (on the courtyard side) out to the base.
  for (const u of [2.5, 6.5, 10.5, 14.5]) for (const dy of [-2, 2]) spots.push([ax * 8 - 4 * s + u * s, -4 + (Math.floor(u) + 1) * 0.25 - 0.2, ay * 8 + dy]);
}
for (let x = -3; x <= 3; x++) for (const dx of [-2, 2]) spots.push(at(x, 0, 0, dx, 0, -0.2)); // the bridge deck
for (const y of [3, -3]) for (let x = -3; x <= 3; x++) for (const [dx, dy] of GRID) spots.push(at(x, y, 1, dx, dy, -0.2)); // catwalks
for (const s of [-1, 1]) for (const dy of [-2, 2]) spots.push(at(4 * s, 0, 2, 0, dy, -0.2)); // roof nests
// West to east, so the bombardment rolls across the map.
spots.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
const charges = spots.map((pos, i) => {
  const id = `charge_${String(i + 1).padStart(3, '0')}`;
  m.add({ kind: 'trap', id, name: 'Air strike charge', trap: 'mine', position: [+pos[0].toFixed(2), +pos[1].toFixed(2), +pos[2].toFixed(2)], yaw: 0, activation: 'proximity', onSeconds: 0.2, offSeconds: 600, offsetSeconds: 0, startEnabled: false, damage: 1000 });
  return id;
});

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const wait = (s: number) => act('wait', null, { value: s });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], once = false): LogicRule => ({ id, name, enabled: true, once, when, if: [], do: does });
const pressed = { event: 'button_pressed', target: 'btn_strike' } as const;
const strike = { event: 'timer_done', target: 'timer_strike' } as const;
const COUNTDOWN = 10;
const SEAL_AT = 7;
const RIPPLE = 0.25; // seconds between groups of ten charges
const groups = Math.ceil(charges.length / 10);
const REOPEN_AT = COUNTDOWN + groups * RIPPLE + 2;

const rules: LogicRule[] = [
  rule('rule_intro', 'Intro', { event: 'match_start', target: null }, [say('Strike control, off the north side hall, can call an air strike on the courtyard. The shelter is under the bridge.', 6)], true),
  rule('rule_strike_call', 'Air strike: siren, countdown, cooldown', pressed, [
    act('disable', 'btn_strike'),
    act('timer_start', 'timer_strike'),
    say('AIR STRIKE INBOUND! Get indoors or down into the shelter!', 4),
    act('sound', null, { state: 'alarm' }),
    wait(3),
    act('sound', null, { state: 'alarm' }),
    wait(3),
    act('sound', null, { state: 'alarm' }),
    say('Shelter doors sealing!', 2),
    wait(COUNTDOWN - 6),
    say('Incoming!', 2),
    wait(60 - COUNTDOWN),
    act('enable', 'btn_strike'),
    say('Air strike control is ready again.', 3),
    act('sound', null, { state: 'chime' }),
  ]),
  rule('rule_strike_doors', 'Air strike: shelter doors', pressed, [
    wait(SEAL_AT),
    ...DOORS.flatMap((d) => [act('door_lock', d), act('door_close', d)]),
    act('sound', null, { state: 'buzzer' }),
    wait(REOPEN_AT - SEAL_AT),
    ...DOORS.flatMap((d) => [act('door_unlock', d), act('door_open', d)]),
    say('All clear. The shelter doors are open.', 3),
  ]),
  rule('rule_strike_booms', 'Air strike: the bombardment heard', strike, [
    ...Array.from({ length: Math.ceil((groups * RIPPLE) / 0.75) + 1 }, () => [act('sound', null, { state: 'boom' }), wait(0.75)]).flat(),
  ]),
];
// The charges, ten to a rule: each group waits its turn, fires, and is switched off again a second later.
for (let g = 0; g < groups; g++) {
  const group = charges.slice(g * 10, g * 10 + 10);
  rules.push(
    rule(`rule_strike_${String(g + 1).padStart(2, '0')}`, `Air strike: charges ${g * 10 + 1}-${g * 10 + group.length}`, strike, [
      wait(+(g * RIPPLE).toFixed(2) + 0.05),
      ...group.flatMap((c) => [act('enable', c), act('trap_fire', c)]),
      wait(1),
      ...group.map((c) => act('disable', c)),
    ]),
  );
}
m.logic({ variables: [], timers: [{ id: 'timer_strike', name: 'Air strike', seconds: COUNTDOWN, loop: false, visible: true }], objectives: [], rules });

// ---------------------------------------------------------------- spawns, flags, hills

for (const [team, s] of [[embers, -1], [tide, 1]] as const) {
  const face = -s * P;
  const Y = (n: number) => -s * n;
  for (const [x, y, z, dx, dy] of [[6, -1, 0, 0, -1.5], [6, 1, 0, 0, 1.5], [6, -1, 1, 0, 0], [6, 1, 1, 0, 0], [5, Y(2), 0, 0, 0], [5, Y(-2), 0, 0, 0], [5, 3, 1, 0, 0], [5, -3, 1, 0, 0]] as const) {
    m.spawn(at(x * s, y, z, dx, dy), face, team);
  }
  m.flag(team, at(6 * s, 0, 0, s * 1.5, 0), face);
}
// Shared spawns (deathmatch): both bases, the tunnels, the vent chambers, the side halls and the shelter.
for (const s of [-1, 1] as const) {
  const face = -s * P;
  m.spawn(at(5 * s, 3, 0, 0, 0), face).spawn(at(5 * s, -3, 0, 0, 0), face);
  m.spawn(at(5 * s, -s * 2, 1, 0, 0), face);
  m.spawn(at(3 * s, 0, -2, 0, 2), -face);
  m.spawn(at(2 * s, -s, -2, 0, -s * 2), s < 0 ? Math.PI : 0);
  m.spawn(at(3 * s, 3 * -s, 0, 0, 0), face);
  m.spawn(at(s, 0, -2, s * 0.5, -s * 1), -face);
}
m.hill(at(0, 0, 0), 5).hill(at(0, 2, -1), 5).hill(at(0, -2, -1), 5);

// ---------------------------------------------------------------- pickups (Crossfire's spread, in our arsenal)

m.pickup('weapon_rockets', at(0, 0, 0)).pickup('ammo_explosive', at(-3, 0, 0)).pickup('ammo_explosive', at(3, 0, 0)); // the bridge
m.pickup('weapon_railgun', at(0, 0, -2)); // the shelter
m.pickup('powerup_damage', at(0, 0, -1)); // under the bridge, between the huts
m.pickup('armor_large', at(0, 4, 0, 0, -1)); // strike control
m.pickup('weapon_laser_rifle', at(0, -4, 0)).pickup('ammo_cells', at(0, -4, 0, 2.5, 2)); // radar room
for (const s of [-1, 1] as const) {
  const Y = (n: number) => -s * n;
  m.pickup('weapon_sniper', at(4 * s, 0, 2, s * 1, 0)).pickup('ammo_sniper', at(4 * s, Y(2), 1)).pickup('ammo_sniper', at(4 * s, Y(-2), 1)); // the nest, the gallery
  m.pickup('weapon_rifle', at(4 * s, Y(3), 1)).pickup('armor_small', at(4 * s, Y(-3), 1)).pickup('ammo_rifle', at(5 * s, Y(1), 1));
  m.pickup('weapon_smg', at(4 * s, Y(2), 0)).pickup('ammo_light', at(4 * s, Y(-2), 0)).pickup('health_small', at(4 * s, Y(3), 0)).pickup('weapon_shotgun', at(5 * s, 0, 0));
  m.pickup('ammo_shells', at(4 * s, Y(1), -1)).pickup('weapon_auto_shotgun', at(5 * s, Y(-1), -1)).pickup('health_large', at(5 * s, 0, -1));
  m.pickup('weapon_burst_rifle', at(3 * s, 0, -2, s * 2, 1)).pickup('grenades', at(2 * s, -s, -2, 2, 0)).pickup('health_small', at(2 * s, 0, -2));
  m.pickup('weapon_launcher', at(3 * s, Y(1), -1, 0, Y(-1.5))).pickup('ammo_explosive', at(1 * s, Y(2), -1, 0, -s * 2));
  m.pickup('weapon_hand_cannon', at(2 * s, 3 * -s, 0)).pickup('ammo', at(-2 * s, 3 * -s, 0));
  m.pickup('health_small', at(1 * s, 0, -2, -s * 2, s * 0.5)).pickup('health_small', at(2 * s, 0, -1, s * 2.5, 0));
  m.pickup('armor_small', at(2 * s, Y(3), 1)).pickup('ammo_sniper', at(-2 * s, Y(3), 1));
}

// ---------------------------------------------------------------- dressing

const SANDBAG = { material: 'pbr_canvas', tint: '#9a8c66' };
/** A sandbag wall `len` m long, `h` high, along `yaw` (0: along x). */
const bags = (pos: V3, len: number, yaw = 0, h = 1) => m.block(pos, [len, h, 0.9], 'solid', { ...SANDBAG, yaw });
for (const s of [-1, 1] as const) {
  const Y = (n: number) => -s * n;
  // Courtyard: a sandbag arc in front of each pair of base doors, sandbags under the bridge, crates and drums.
  bags(at(-1 * s, Y(1), -1), 2.8, 0);
  bags(at(-3 * s, Y(1), -1, s * -1.4, 0), 2.6, P);
  bags(at(-2 * s, 0, -1), 2.4, P);
  m.prop('cargo_crate', at(-1 * s, Y(-2), -1, 0, 0), 0.2).prop('crate_large', at(1 * s, Y(2), -1, s * 0, Y(-1.2)), P);
  m.prop('factory_box', at(3 * s, Y(1), -1, -s * 1, Y(2.6)), 0.15);
  m.breakable('barrel', at(-3 * s, 0, -1, s * 2.8, 0)).breakable('gas', at(1 * s, Y(1), -1, s * 3, Y(-3.2)));
  m.prop('barrier_high', at(-1 * s, Y(2), -1, s * 3.2, Y(-0.5)), P).prop('barrier', at(1 * s, Y(-1), -1, 0, Y(3)), 0);
  for (const y of [2, -2]) m.prop('warning_sign', at(4 * s, y, 0, -s * 3.4, Y(0) + (y > 0 ? -3.2 : 3.2)), s * P, 1, false);
  // Catwalks: sandbag nests and ammo boxes.
  for (const y of [3, -3]) {
    bags(at(-1 * s, y, 1), 3, P, 1.1);
    m.prop('metal_crate', at(-3 * s, y, 1, s * 2.5, y > 0 ? 2.5 : -2.5)).prop('crate_small', at(2 * s, y, 1, 0, y > 0 ? 2.8 : -2.8));
  }
  // The roof nest: a sandbag lip behind the railing.
  bags(at(4 * s, 0, 2, -s * 3, 0), 3, P, 0.8);
  // The front hall: barriers by the doors, crates and the base's lockers.
  m.prop('barrier', at(4 * s, Y(2), 0, -s * 2, Y(-2.5)), 0).prop('barrier', at(4 * s, Y(-2), 0, -s * 2, Y(2.5)), 0);
  m.prop('crate_large', at(4 * s, Y(1), 0, s * 2.6, Y(2.6)), 0).prop('metal_crate', at(4 * s, Y(-1), 0, s * 2.8, Y(-2.6)));
  // Basements: crates, drums and pipes.
  m.prop('cargo_crate', at(4 * s, Y(1), -1, s * 2.4, Y(2.6)), P).prop('barrel', at(4 * s, Y(-1), -1, s * 3, Y(-3))).prop('barrel_open', at(4 * s, Y(-1), -1, s * 3, Y(-2)));
  m.prop('pipe_valve', at(5 * s, 0, -1, s * 2.8, Y(2.8))).prop('shelf_boxes', at(5 * s, Y(-1), -1, s * 3, 0), -s * P);
  // Tunnels and the vents: pipes, drums, cable.
  m.prop('big_pipe', at(3 * s, 0, -2, 0, -3), 0).prop('barrel', at(2 * s, -s, -2, s * 3, -s * 3)).prop('sf_cable_long', at(3 * s, 0, -2, 0, 2.5), P, 1, false);
  // The galleries: crates under the windows.
  m.prop('crate_small', at(4 * s, Y(1), 1, -s * 2.8, Y(2.8))).prop('crate_small', at(4 * s, Y(-1), 1, -s * 2.8, Y(-2.8)));
}
// The shelter: bunks, lockers, medical kit, a radio set.
for (const x of [-1, 1]) {
  m.prop('bunk_bed', at(x, 0, -2, x * 2.6, 2.6), 0).prop('bunk_bed', at(x, 0, -2, x * 2.6, -2.6), 0);
  m.prop('shelf_boxes', at(x, 0, -2, -x * 0.5, 3.1), Math.PI).prop('metal_crate', at(x, 0, -2, -x * 0.5, -3.1));
}
m.prop('sv_medkit_case', at(0, 0, -2, -2.8, 2.9), 0, 1, false).prop('sv_radio', at(0, 0, -2, 2.8, -2.9), 0, 1, false).prop('warning_sign', at(0, 0, -2, 3.4, 3.4), 0, 1, false);
// Strike control: consoles round the button. Radar room: the plot table and screens.
m.prop('computer_bank', at(0, 4, 0, -2.6, 2.4), Math.PI).prop('screen_panel', at(0, 4, 0, 2.6, 2.9), Math.PI).prop('desk', at(0, 4, 0, 3, -1), -P).prop('office_chair', at(0, 4, 0, 2, -1), P, 1, false);
m.prop('holo_table', at(0, -4, 0, 0, -1), 0).prop('computer_wide', at(0, -4, 0, -2.6, -2.9), 0).prop('screen_panel', at(0, -4, 0, 2.6, -2.9), 0);
// Side halls: crates and benches by the slits.
for (const [x, y] of [[-2, 3], [2, -3], [1, 3], [-1, -3]] as const) m.prop('crate_large', at(x, y, 0, x > 0 ? 2.6 : -2.6, y > 0 ? 2.6 : -2.6), P);
for (const [x, y] of [[0, 3], [0, -3]] as const) m.prop('bench', at(x, y, 0, 0, y > 0 ? 2.8 : -2.8), y > 0 ? Math.PI : 0, 1, false);

// Light: every room with a floor over it gets a panel; the roofed upper floors, the nests and the huts their own.
m.bounds('invisible');
m.furnish('barracks', (x, y, z) => Math.abs(x) <= 4 || z === -2);
m.lightRooms({ color: '#f4ead4' });
for (const s of [-1, 1]) {
  for (let y = -3; y <= 3; y++) m.light(at(4 * s, y, 1, 0, 0, 3.45), { color: '#f4ead4' });
  for (const y of [-3, -2, 1, 2, 3]) m.light(at(5 * s, -s * y, 1, 0, 0, 3.45), { color: '#f4ead4' });
  for (const y of [-1, 0, 1]) m.light(at(6 * s, y, 1, 0, 0, 3.45), { color: '#f4ead4' });
}
m.light(at(0, 4, 0, 0, 0, 3.45), { color: '#e4f0ff' }).light(at(0, -4, 0, 0, 0, 3.45), { color: '#e4f0ff' });
for (const y of [1, -1]) m.light(at(0, y, -1, 0, 0, 3.4), { fixture: 'bulb', color: '#ffd9a0', range: 8 });

// ---------------------------------------------------------------- ground: desert round the complex

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/**
 * Terrain under and round the built map (after the boundary is set). `shape(x, z, d)` is the
 * natural ground, `d` metres outside the play boundary (0 inside). It is held 0.1 m under every
 * floor, slab and solid it would reach into, and nowhere climbs faster than `rise` metres per metre
 * away from those, so nothing built is buried. `paint` picks each cell's ground and plant cover.
 */
function sculpt(shape: (x: number, z: number, d: number) => number, paint: (x: number, z: number, d: number, h: number) => [TerrainMaterial, number], o: { margin?: number; rise?: number } = {}): TerrainData {
  const b = m.doc.bounds;
  if (!b) throw new Error('sculpt needs the boundary');
  const [x0, z0] = b.min;
  const [x1, z1] = b.max;
  const size = Math.min(320, Math.max(x1 - x0, z1 - z0) + 2 * (o.margin ?? 60));
  const t = newTerrain(size, 2, [Math.round((x0 + x1) / 4) * 2, Math.round((z0 + z1) / 4) * 2]);
  const outside = (x: number, z: number) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  const solids = buildMapGeometry(m.doc).filter((q) => q.kind !== 'barrier').map(boxBounds);
  const { cols, rows } = t;
  const h: number[] = [];
  const covered: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = t.origin[0] + c * 2;
      const z = t.origin[1] + r * 2;
      let y = shape(x, z, outside(x, z));
      let under = false;
      for (const s of solids) {
        if (x > s.min[0] - 0.3 && x < s.max[0] + 0.3 && z > s.min[2] - 0.3 && z < s.max[2] + 0.3 && s.min[1] - 0.1 < y + 0.5) {
          y = Math.min(y, s.min[1] - 0.1);
          under = true;
        }
      }
      h.push(y);
      covered.push(under);
    }
  }
  const rise = o.rise ?? 0.7;
  const steps: [number, number, number][] = [[-1, 0, 2], [0, -1, 2], [-1, -1, 2.83], [1, -1, 2.83]];
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < cols * rows; k++) {
      const i = pass ? cols * rows - 1 - k : k;
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dc, dr, dist] of steps) {
        const nc = c + (pass ? -dc : dc);
        const nr = r + (pass ? -dr : dr);
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        h[i] = Math.min(h[i]!, h[nr * cols + nc]! + rise * dist);
      }
    }
  }
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const corners = [r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1];
      const x = t.origin[0] + c * 2 + 1;
      const z = t.origin[1] + r * 2 + 1;
      const [g, f] = paint(x, z, outside(x, z), corners.reduce((s, i) => s + h[i]!, 0) / 4);
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      foliage.push(corners.some((i) => covered[i]) ? 0 : f);
    }
  }
  return paintSlopes({ ...t, heights: h.map((y) => Math.round(y * 100)), materials, foliage }, 38, 'stone');
}
// Sun-baked flats round the complex, rising to broken mesas all round; scrub on the dirt, bare sand in the open.
m.terrain(
  sculpt(
    (x, z, d) => -0.1 + smooth(4, 34, d) * (9 + 4 * Math.sin(x / 23 + 1) * Math.cos(z / 19) + 2.5 * Math.sin(z / 11 + x / 31)) + smooth(30, 52, d) * 8 * smooth(0.2, 0.6, Math.sin(x / 17) * Math.cos(z / 21) + 0.5),
    (x, z, d, y) => {
      if (d < 3) return ['sand', 0];
      const scrub = Math.sin(x / 7 + z / 13) * Math.cos(z / 9 - x / 17) > 0.15;
      return y > 9 ? ['stone', 0] : scrub ? ['dirt', 1] : ['sand', 0];
    },
  ),
);
m.meta({
  description:
    'Crossfire remade: two concrete bases glare at each other across a sunken courtyard. Snipe from the roof nests and galleries, fight over the rocket launcher on the bridge and the railgun in the shelter under it, run the tunnels and vents, and when the courtyard fills up, hit the air strike in strike control: a siren, a ten-second countdown, the shelter doors seal and the bombardment rolls across everything outside.',
  modes: ['core.deathmatch', 'core.tdm', 'core.ctf', 'core.koth'],
  players: [6, 16],
});
await m.save();
