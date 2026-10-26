/**
 * Neon Spire: the demo map of Style Pack 07 Neon Megacity (our own map and
 * name), for 6–14 players in Deathmatch, Team Deathmatch and King of the Hill.
 * A vertical cyberpunk district at night: wet streets crossing under neon
 * signs and holographic billboards, alleys of noodle stalls and vending
 * machines, glass towers, and a skytrain loop 12 m up round the whole block.
 *
 * - Streets: a crossroads in the middle, four street arms out to the loop,
 *   traffic lights, street lights, overhead sign gantries and barriers.
 * - The Spire (north-east): a 31 m glass tower. Its glass elevator climbs the
 *   west face to the roof, where the sniper rifle waits among water tanks and
 *   antennas. The holographic billboard on its south face lights the street.
 * - The Kowloon block (north-west, neon facade) and the glass offices
 *   (south-west): three storeys each, stairwells inside, joined roof to roof by
 *   the sky tram, a car shuttling over the west street (ride it). Footbridges
 *   join both roofs to the skytrain deck. The block's roof console cuts the
 *   neon for 12 s: every sign and billboard goes dark.
 * - The skytrain loop: an elevated deck all round the district, where two
 *   hover cabs (the track's ambient speeders) lap all match and run down
 *   anyone in their way (shoot them up, or take one). Glass elevators west and
 *   east lift you up from the alleys.
 * - South-east: the stepped tower (skyline) and two corner shops, a ladder
 *   up to a shop roof.
 *
 * Grid x east, y north (one cell = 8 m); levels z0 (y 0), z1 (4), z2 (8), roofs at 12.
 *
 *   y  7   ( ======================= skytrain loop (12 m) ======================= )
 *   y  6   (  .  [  .  .  .  ] [St][St]  .  [   SPIRE    ]  )
 *   y  5   ( b=[K  K  st ] [St][St]  E [  (31 m)     ]  )     K Kowloon block (3 storeys)
 *   y  4   ( b=[K  K  st ] [St][St]  .  [shop][  .  ]  )     St north street, b bridge to the deck
 *   y  3   (  .  .  .  T [  CROSSROADS (4 × 4) ]  .  .  .  )     T sky tram over the west street
 *   y 1-2  ( E  [ west street ] [              ] [ east street ] E )
 *   y  0   (  .  .  .  T [                    ]  .  .  .  )
 *   y -1   (  .  market alley  [St][St]  [shop]  .  .  )
 *   y -2   ( b=[G  G  st ] [St][St]  [ stepped ]  )     G glass offices (3 storeys)
 *   y -3   ( b=[G  G  st ] [St][St]  [ tower   ]  )
 *   y -4   ( ======================= skytrain loop ======================= )
 *          x -4  -3  -2  -1   0    1   2   3    4   5   6   7
 */
import { Track, TrackGeometry, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Rotation, type Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('neon_spire', 'Neon Spire');
m.theme('neon_megacity');
m.backdrop('night', 'city', 'stone', 0.5);
m.teams([7, 7]);
const [WEST, EAST] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
/** A block along the line from (xa, za) to (xb, zb), `width` across it. */
function beam(xa: number, za: number, xb: number, zb: number, width: number, y0: number, y1: number, look: Look, extra = 0): void {
  const dx = xb - xa;
  const dz = zb - za;
  m.block([r2((xa + xb) / 2), r2(y0), r2((za + zb) / 2)], [r2(Math.hypot(dx, dz) + extra), r2(y1 - y0), r2(width)], 'solid', { ...look, yaw: +Math.atan2(-dz, dx).toFixed(4) });
}

const DECK: Look = { material: 'pbr_concrete_dark', tint: '#5a5668' };
const GIRDER: Look = { material: 'pbr_steel', tint: '#34303c' };
const NEON_RAIL: Look = { material: 'neon_tube', tint: '#ff4fd8' };
const CYAN_RAIL: Look = { material: 'neon_tube', tint: '#4fe0ff' };

// ---------------------------------------------------------------- tiles

const taken = new Set<string>();
const key = (x: number, y: number, z = 0) => `${x},${y},${z}`;
const claim = (x0: number, y0: number, x1: number, y1: number, z0 = 0, z1 = 0) => {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) taken.add(key(x, y, z));
};
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);

// Streets: the crossroads and four arms out to the loop.
m.tile('city.crossroads', 0, 0);
claim(0, 0, 3, 3);
for (const x of [-3, -2, -1, 4, 5, 6]) {
  m.tile('city.street', x, 1);
  claim(x, 1, x, 2);
}
for (const y of [-3, -2, -1, 4, 5, 6]) {
  m.tile('city.street', 1, y, 0, 1);
  claim(1, y, 2, y);
}

// Towers: the Spire (north-east, its face south) and the stepped tower (south-east, face north).
m.tile('neon.tower_a', 6, 6, 0, 2);
claim(5, 5, 6, 6);
m.tile('neon.tower_c', 5, -3, 0, 0);
claim(5, -3, 6, -2);
// Corner shops.
m.tile('neon.shop_a', 4, -1, 0, 3);
m.tile('neon.shop_a', 5, 4, 0, 2);
m.tile('neon.shop_a', 6, 4, 0, 2);
claim(4, -1, 4, -1);
claim(5, 4, 6, 4);

/** A three-storey building of rooms x0..x0+1, y0..y0+1 (with `facade`), its stairwells in column x0 + 2. */
function building(x0: number, y0: number, facade: RoomOptions['facade']): void {
  const room = (x: number, y: number, z: number) => m.tile('room', x, y, z, 0, { layout: z === 0 ? 'low_cover' : 'empty', facade, ...(z === 2 ? { ceiling: 'roof' } : {}) });
  for (let z = 0; z <= 2; z++) for (const x of [x0, x0 + 1]) for (const y of [y0, y0 + 1]) room(x, y, z);
  // Stairwells (doors west): z0 → z1 in the first row, z1 → z2 in the second; rooms fill the rest of the column.
  m.tile('stairwell', x0 + 2, y0, 0, 0 as Rotation);
  m.tile('room', x0 + 2, y0, 2, 0, { layout: 'empty', facade, ceiling: 'roof' });
  m.tile('room', x0 + 2, y0 + 1, 0, 0, { layout: 'empty', facade });
  m.tile('stairwell', x0 + 2, y0 + 1, 1, 0 as Rotation);
  claim(x0, y0, x0 + 2, y0 + 1, 0, 2);
  // Street doors on the ground floor, windows above.
  for (const y of [y0, y0 + 1]) {
    edge(x0, y, 0, 'W', 'door');
    for (const z of [1, 2]) edge(x0, y, z, 'W', 'windows');
  }
  for (const x of [x0, x0 + 1]) {
    for (const z of [1, 2]) {
      edge(x, y0, z, 'S', 'windows');
      edge(x, y0 + 1, z, 'N', 'windows');
    }
  }
  edge(x0, y0, 0, 'S', 'door');
  edge(x0 + 1, y0 + 1, 0, 'N', 'door');
}
building(-2, 4, 'neon'); // the Kowloon block: x -2..0, y 4..5
building(-2, -3, 'glass'); // the glass offices: x -2..0, y -3..-2
// Footbridges from both roofs west to the skytrain deck, 12 m up.
for (const y of [4, 5, -3, -2]) {
  m.tile('bridge', -3, y, 3, 1);
  taken.add(key(-3, y, 3));
}

// Everything else on the ground is open courtyard: alleys, plazas and the ground under the loop.
for (let x = -4; x <= 7; x++) for (let y = -4; y <= 7; y++) if (!taken.has(key(x, y))) m.tile('yard', x, y);

// ---------------------------------------------------------------- the skytrain loop (12 m)

const LOOP: { len: number; at: (t: number) => [number, number] }[] = [];
const line = (ax: number, az: number, bx: number, bz: number) => LOOP.push({ len: Math.hypot(bx - ax, bz - az), at: (t) => [ax + (bx - ax) * t, az + (bz - az) * t] });
const R = 8;
const arc = (cx: number, cz: number, a0: number, a1: number) => LOOP.push({ len: Math.abs(a1 - a0) * R, at: (t) => [cx + R * Math.cos(a0 + (a1 - a0) * t), cz + R * Math.sin(a0 + (a1 - a0) * t)] });
// Centre line: x -32 and 56, z -32 and 56 (the outer ring of cells), corners of 8 m radius.
line(-24, -32, 48, -32);
arc(48, -24, -P, 0);
line(56, -24, 56, 48);
arc(48, 48, 0, P);
line(48, 56, -24, 56);
arc(-24, 48, P, S);
line(-32, 48, -32, -24);
arc(-24, -24, S, S + P);
const LOOP_LEN = LOOP.reduce((s, p) => s + p.len, 0);
const loopAt = (d: number): [number, number] => {
  d = ((d % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
  for (const p of LOOP) {
    if (d <= p.len) return p.at(d / p.len);
    d -= p.len;
  }
  return LOOP[0]!.at(0);
};
const DECK_Y = 12;
const WIDTH = 8;
const points: V3[] = [];
const n = Math.round(LOOP_LEN / 6);
for (let i = 0; i < n; i++) {
  const [x, z] = loopAt(36 + (i * LOOP_LEN) / n);
  points.push([r2(x), DECK_Y, r2(z)]);
}
const track = Track.parse({ points, width: WIDTH, loop: true, laps: 3, grid: 14, vehicle: 'speeder', combat: false, surface: 'asphalt', curbs: false, ambient: 2, ambientVehicle: 'speeder', pit: [-32, DECK_Y, 30] });
m.track(track);
const g = new TrackGeometry(track);
const smp = g.samples;
{
  let i = 0;
  while (i < smp.length) {
    const a = smp[i]!;
    const head = (k: number) => {
      const p = smp[k % smp.length]!;
      const q = smp[(k + 1) % smp.length]!;
      return Math.atan2(q.z - p.z, q.x - p.x);
    };
    const h0 = head(i);
    let j = i + 1;
    while (j < smp.length && turn(head(j), h0) < 0.004 && Math.hypot(smp[j % smp.length]!.x - a.x, smp[j % smp.length]!.z - a.z) < 60) j++;
    const b = smp[j % smp.length]!;
    beam(a.x, a.z, b.x, b.z, WIDTH, DECK_Y - 0.6, DECK_Y, DECK, j - i > 1 ? 0.6 : 0.9);
    i = j;
  }
}
// Neon railings along both edges, open where the footbridges and elevators meet the deck.
const GAPS: { x0: number; x1: number; z0: number; z1: number }[] = [
  { x0: -30, x1: -26, z0: 28, z1: 44 }, // Kowloon block footbridges
  { x0: -30, x1: -26, z0: -28, z1: -12 }, // glass offices footbridges
  { x0: -30, x1: -26, z0: -3, z1: 3 }, // west elevator
  { x0: 50, x1: 54, z0: -3, z1: 3 }, // east elevator
];
const inGap = (x: number, z: number) => GAPS.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
for (const side of [-1, 1]) {
  const off = side * (WIDTH / 2 - 0.15);
  const pts = smp.map((p) => [p.x + p.dz * off, p.z - p.dx * off] as [number, number]);
  let i = 0;
  while (i < pts.length) {
    const a = pts[i]!;
    const h0 = Math.atan2(pts[(i + 1) % pts.length]![1] - a[1], pts[(i + 1) % pts.length]![0] - a[0]);
    let j = i + 1;
    while (j < pts.length && turn(Math.atan2(pts[(j + 1) % pts.length]![1] - pts[j]![1], pts[(j + 1) % pts.length]![0] - pts[j]![0]), h0) < 0.004 && Math.hypot(pts[j]![0] - a[0], pts[j]![1] - a[1]) < 6) j++;
    const b = pts[j % pts.length]!;
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!inGap(mid[0], mid[1]) && !inGap(a[0], a[1]) && !inGap(b[0], b[1])) {
      beam(a[0], a[1], b[0], b[1], 0.3, DECK_Y, DECK_Y + 1.1, GIRDER, 0.1);
      beam(a[0], a[1], b[0], b[1], 0.32, DECK_Y + 1.1, DECK_Y + 1.2, side < 0 ? NEON_RAIL : CYAN_RAIL, 0.1);
    }
    i = j;
  }
}
// Pylons under the deck every 16 m, lit from below.
for (let s = 8; s < g.length; s += 16) {
  const p = g.at(s);
  const yaw = +Math.atan2(-p.dz, p.dx).toFixed(4);
  m.block([r2(p.x), 0, r2(p.z)], [1.3, DECK_Y - 0.6, 1.3], 'solid', { ...GIRDER, yaw });
  m.block([r2(p.x), DECK_Y - 1.4, r2(p.z)], [1.6, 0.8, WIDTH - 1], 'solid', { ...GIRDER, yaw });
  m.light([r2(p.x), DECK_Y - 1.7, r2(p.z)], { fixture: 'none', color: s % 32 < 16 ? '#ff4fd8' : '#4fe0ff', intensity: 1.2, range: 12 });
}

// ---------------------------------------------------------------- elevators and the sky tram

/** A glass elevator: a cab floor riding from `at` up `rise` metres and back, with a light in it. */
function elevator(id: string, pos: V3, rise: number, name: string): void {
  m.block(pos, [3, 0.3, 3], 'solid', { id: `${id}_cab`, material: 'pbr_tread_plate', tint: '#8a8090' });
  m.mover(id, [pos[0], pos[1], pos[2]], [`${id}_cab`], [[0, 0, 0], [0, r2(rise), 0]], { speed: 3, wait: 3, name });
}
// Up to the deck from the west and east alleys (the cab top meets the deck at 12 m).
elevator('mover_lift_w', [-26.4, -0.3, 0], DECK_Y, 'West skytrain elevator');
elevator('mover_lift_e', [50.4, -0.3, 0], DECK_Y, 'East skytrain elevator');
// Up the Spire's west face to its roof (31.29 m).
const SPIRE_ROOF = 31.29;
elevator('mover_lift_spire', [34.8, -0.3, 44], SPIRE_ROOF, 'Spire glass elevator');
for (const [x, z] of [[-26.4, 0], [50.4, 0], [34.8, 44]] as const) m.prop('nc_holo_kiosk', [x, 0, z + (z === 44 ? -3.6 : 3.4)], z === 44 ? 0 : S);
// The sky tram: a car shuttling roof to roof over the west street (z -8.4 to 24.4 at x -8), 12 m up.
{
  const z0 = -8.4;
  const parts: string[] = [];
  const part = (id: string, pos: V3, size: V3, look: Look) => {
    m.block(pos, size, 'solid', { ...look, id });
    parts.push(id);
  };
  part('tram_floor', [-8, DECK_Y - 0.3, z0], [3, 0.3, 7], { material: 'pbr_tread_plate', tint: '#6a6070' });
  part('tram_roof', [-8, DECK_Y + 2.7, z0], [3.2, 0.25, 7.2], { material: 'neon_tube', tint: '#ff4fd8' });
  for (const [dx, dz] of [[-1.4, -3.3], [1.4, -3.3], [-1.4, 3.3], [1.4, 3.3]] as const) part(`tram_post_${dx > 0 ? 'e' : 'w'}${dz > 0 ? 'n' : 's'}`, [-8 + dx, DECK_Y, z0 + dz], [0.2, 2.7, 0.2], GIRDER);
  m.mover('mover_tram', [-8, DECK_Y, z0], parts, [[0, 0, 0], [0, 0, r2(24.4 - z0)]], { speed: 4, wait: 4, name: 'Sky tram' });
}

// ---------------------------------------------------------------- streets, alleys and roofs

// Street lights along the arms, traffic lights at the crossroads corners, sign gantries over the arms.
for (const x of [-20, -4, 28, 44]) {
  m.prop('nc_streetlight', [x, 0, 3.6], S).prop('nc_streetlight', [x + 8, 0, 20.4], 0);
  m.light([x, 6.6, 5.2], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 12 });
  m.light([x + 8, 6.6, 18.8], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 12 });
}
for (const z of [-20, -4, 28, 44]) {
  m.prop('nc_streetlight', [3.6, 0, z], -P).prop('nc_streetlight', [20.4, 0, z + 8], P);
  m.light([5.2, 6.6, z], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 12 });
  m.light([18.8, 6.6, z + 8], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 12 });
}
for (const [x, z, yaw] of [[2.6, 2.6, -P / 2], [21.4, 2.6, P / 2], [2.6, 21.4, -P * 1.5], [21.4, 21.4, P * 1.5]] as const) m.prop('nc_traffic_light', [x, 0, z], yaw);
m.prop('nc_highway_sign', [-12, 0, 12], P).prop('nc_highway_sign', [36, 0, 12], P).prop('nc_highway_sign', [12, 0, -12], 0).prop('nc_highway_sign', [12, 0, 36], 0);
m.prop('nc_neon_barrier', [8, 0, 9], 0.2).prop('nc_neon_barrier', [16, 0, 15], -0.3).prop('nc_road_barrier', [-14, 0, 7], P).prop('nc_road_barrier', [38, 0, 17], P);
m.prop('nc_cone', [-15.5, 0, 8.5]).prop('nc_cone', [-15.5, 0, 6]).prop('nc_cone', [39.5, 0, 15]).prop('container', [-24, 0, 16], P);
// The market alley (south of the west street) and the alleys round the loop.
m.prop('nc_food_stall', [-12, 0, -9.8], 0).prop('nc_food_stall', [-4.5, 0, -9.8], 0).prop('nc_vending', [-18.6, 0, -5], P).prop('nc_vending', [-18.6, 0, -6.5], P);
m.prop('nc_holo_kiosk', [-1, 0, 25], S).prop('nc_vending', [27, 0, -10], -P).prop('nc_food_stall', [30, 0, 24.2], S);
m.prop('nc_dumpster', [-32, 0, -10], 0).prop('nc_dumpster', [56, 0, 30], 0).prop('nc_dumpster', [26, 0, 58], P).prop('nc_dumpster', [-14, 0, 57.5], P);
m.prop('nc_power_pole', [-34.5, 0, 22], 0).prop('nc_power_pole', [58.5, 0, -14], 0).prop('nc_street_sign', [-5.6, 0, 22.6], 0).prop('nc_street_sign', [29.6, 0, 1.4], S);
m.prop('barrier_high', [12, 0, -30], 0).prop('barrier_high', [12, 0, 54], 0).prop('nc_neon_barrier', [-30, 0, 12], P).prop('nc_neon_barrier', [54, 0, 12], P);
// Roofs: water tanks, AC units and antennas.
for (const [x, z] of [[-14, 30], [-14, -26]] as const) m.prop('nc_water_tank', [x, DECK_Y, z], 0);
for (const [x, z, yaw] of [[-10, 40, 0], [-4, 34, P], [-10, -18, 0], [-4, -24, P], [2, 30, 0], [2, -14, 0]] as const) m.prop('nc_ac_unit', [x, DECK_Y, z], yaw);
m.prop('nc_antenna', [-18, DECK_Y, 42], 0).prop('nc_antenna', [-18, DECK_Y, -14], 0);
// The Spire's roof.
m.prop('nc_water_tank', [48, SPIRE_ROOF, 48], 0).prop('nc_antenna', [40, SPIRE_ROOF, 49], 0).prop('nc_ac_unit', [47, SPIRE_ROOF, 39.5], 0).prop('nc_ac_unit', [40.5, SPIRE_ROOF, 40], P);
// A fire-escape ladder up the east shop (roof 9.45 m).
m.add({ kind: 'ladder', name: 'Fire escape', position: [32, 0, -11.75], yaw: S, height: 9.45, width: 0.9 });

// ---------------------------------------------------------------- neon signs and billboards

const SIGNS: [string, string, V3, number, string, [number, number]?][] = [
  ['sign_noodles', 'NOODLES', [-14, 5, -3.6], 0, '#ff4fd8'],
  ['sign_hotel', 'HOTEL KOWLOON', [-16.5, 9, 27.6], S, '#4fe0ff', [5, 1]],
  ['sign_karaoke', 'KARAOKE', [-0.2, 6, 36], -P, '#ffb347'],
  ['sign_arcade', 'ARCADE 24H', [-20.4, 5, 36], P, '#5dff9a', [3.2, 0.9]],
  ['sign_bar', 'BAR', [-20.4, 5, -20], P, '#ff3b3b', [1.6, 0.8]],
  ['sign_offices', 'NEXUS OFFICES', [-8, 9, -11.6], 0, '#9a6bff', [5, 1]],
  ['sign_shop', 'OPEN', [27.6, 4, -8], -P, '#ff4fd8', [1.8, 0.7]],
  ['sign_pharmacy', 'PHARMACY', [44, 5, 27.7], S, '#5dff9a', [3.2, 0.9]],
];
for (const [id, text, pos, yaw, color, size] of SIGNS) m.light(pos, { id, fixture: 'sign', text, color, yaw, intensity: 1.3, range: 9, ...(size ? { size } : {}) });
const BOARDS: [string, string, V3, number, string, [number, number]][] = [
  ['board_spire', 'SPIRE CORP', [44, 20, 36.2], S, '#4fe0ff', [12, 6]],
  ['board_stepped', 'DRINK NEON', [44, 18, -12.2], 0, '#ff4fd8', [12, 6]],
  ['board_west', 'SKYTRAIN', [-20.2, 10.5, 10], -P, '#ffb347', [6, 3.4]],
];
for (const [id, text, pos, yaw, color, size] of BOARDS) m.light(pos, { id, fixture: 'billboard', text, color, yaw, intensity: 2, range: 18, size });
const NEON = [...SIGNS.map((s) => s[0]), ...BOARDS.map((b) => b[0])];
// The blackout console on the Kowloon block's roof.
m.add({ kind: 'button', id: 'btn_blackout', name: 'Neon grid breaker', position: [-12, DECK_Y + 1.1, 43.4], yaw: S, label: 'Cut the neon', once: false, cooldownSeconds: 40, startEnabled: true });
m.prop('nc_ac_unit', [-12, DECK_Y, 42.6], 0);

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Neon Spire. Skytrain cabs do not stop: mind the deck.', 4)]),
    rule('rule_blackout', 'Cut the neon', { event: 'button_pressed', target: 'btn_blackout' }, [
      act('sound', null, { state: 'buzzer' }),
      say('Blackout! The neon is down for 12 seconds.', 3),
      ...NEON.map((id) => act('light_off', id)),
      act('wait', null, { value: 12 }),
      ...NEON.map((id) => act('light_on', id)),
      act('sound', null, { state: 'chime' }),
    ]),
  ],
});

// ---------------------------------------------------------------- objectives, spawns and pickups

// King of the Hill: the crossroads, the Kowloon roof, the deck (north straight), the market alley.
m.hill([12, 0, 12], 5);
m.hill([-10, DECK_Y, 38], 4);
m.hill([12, DECK_Y, 56], 4);
m.hill([-8, 0, -6.5], 3);

// West team: inside the two buildings.
for (const [p, yaw] of [
  [at(-2, 4, 0, -1, 0), P], [at(-1, 5, 0, 0, 1), P], [at(-2, 5, 1), 0], [at(-2, -3, 0, -1, 0), P], [at(-1, -2, 0, 0, 1), P], [at(-1, -3, 1), 0], [at(-2, 4, 2), 0],
] as [V3, number][]) m.spawn(p, yaw, WEST);
// East team: the alleys under the Spire and round the shops.
for (const [p, yaw] of [
  [at(4, 6, 0), -P], [at(4, 5, 0, 0, -2), -P], [at(5, 0, 0), -P], [at(6, 0, 0, -1, 2), -P], [at(5, -1, 0, 1, 0), S], [at(6, -1, 0), S], [at(4, 3, 0, 1, 2), -P],
] as [V3, number][]) m.spawn(p, yaw, EAST);
// Everyone else: round the district.
for (const [p, yaw] of [
  [at(-4, 6, 0), 0], [at(-4, -3, 0), 0], [at(7, -3, 0), S], [at(7, 6, 0), S], [at(3, 6, 0, 1, 0), S], [at(0, -4, 0), 0], [at(-3, 0, 0), P], [at(3, -3, 0), 0], [at(-1, -1, 0), 0], [at(0, 6, 0), S],
] as [V3, number][]) m.spawn(p, yaw, null);

// The sniper on the Spire's roof; the railgun on the deck's north straight; rockets on the glass offices' roof.
m.pickup('weapon_sniper', [44, SPIRE_ROOF, 44]).pickup('ammo_sniper', [42, SPIRE_ROOF, 47]);
m.pickup('weapon_railgun', [20, DECK_Y, 56]).pickup('ammo_cells', [-12, DECK_Y, -32]);
m.pickup('weapon_rockets', [-12, DECK_Y, -22]).pickup('ammo_explosive', [-6, DECK_Y, 36]);
m.pickup('armor_large', at(0, 5, 2)).pickup('weapon_plasma', at(0, -3, 2));
m.pickup('weapon_smg', at(-2, 5, 0)).pickup('weapon_smg', at(5, -1, 0, 0, 2)).pickup('weapon_shotgun', at(-1, -3, 0)).pickup('weapon_shotgun', at(4, 6, 0, 0, -2));
m.pickup('weapon_rifle', [12, 0, 22]).pickup('weapon_burst_rifle', [12, 0, 2]).pickup('weapon_launcher', [56, DECK_Y, 30]).pickup('weapon_lmg', [-32, DECK_Y, 20]);
m.pickup('ammo', [6, 0, 12]).pickup('ammo', [18, 0, 12]).pickup('ammo_rifle', at(-1, 4, 1)).pickup('ammo_rifle', at(4, 0, 0)).pickup('ammo_shells', [-16, 0, 26]).pickup('ammo_light', [30, 0, 30]);
m.pickup('grenades', [-24, 0, -10]).pickup('grenades', [40, 0, 26]).pickup('grenades', [12, DECK_Y, -32]);
m.pickup('armor_small', at(-1, -2, 1)).pickup('armor_small', [56, DECK_Y, -10]).pickup('armor_small', [28, 0, -24]);
m.pickup('health_large', [12, 0, 30]).pickup('health_large', at(-1, 4, 2)).pickup('health_large', [-32, DECK_Y, -10]);
for (const p of [[-28, 0, -32], [-34, 0, 8], [58, 0, 40], [44, 0, 58], [28, 0, 8], [-10, 0, 20], [4, 0, -20], at(-2, -2, 2), [32, 0, 50], [-30, 0, 50]] as V3[]) m.pickup('health_small', p);

// ---------------------------------------------------------------- light

m.lightRooms({ color: '#ffd9e8', intensity: 0.9, range: 9 });
for (const [x, z, c] of [[-12, -6.5, '#ff4fd8'], [-4.5, -6.5, '#ffb347'], [26, 24, '#4fe0ff'], [30, -10, '#ff4fd8']] as const) m.light([x, 2.6, z], { fixture: 'none', color: c, intensity: 1, range: 8 });
// Neon strips along the roof edges.
for (const [x, z, yaw] of [[-8, 28.4, 0], [-8, -11.6, 0]] as const) m.light([x, DECK_Y + 0.4, z], { fixture: 'strip', color: '#ff4fd8', intensity: 0.8, range: 8, yaw });

m.bounds('invisible', 4, { min: [-40, -40], max: [64, 64] }, 30);
m.meta({
  description:
    'A vertical cyberpunk district at night, built from the Neon Megacity style pack: wet streets under neon signs and holographic billboards, a glass elevator up the 31 m Spire to the sniper roost, two three-storey blocks joined roof to roof by a sky tram, and a skytrain loop 12 m up where hover cabs lap all match and run down anyone on the deck. Cut the neon from the Kowloon roof for a 12-second blackout.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [6, 14],
});
await m.save();
