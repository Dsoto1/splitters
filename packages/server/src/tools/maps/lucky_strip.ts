/**
 * Lucky Strip: a casino boulevard at night (our own street, casinos and
 * hotels; no real names), built from Style Pack 07 Neon Megacity, for 16–32
 * players in Bomb (the heist), Hostage Rescue, Team Deathmatch, Capture the
 * Flag, King of the Hill and Deathmatch.
 *
 * The Strip runs north–south through a crossroads, lined with casino-resort
 * fronts under neon signs and holographic billboards; service alleys run
 * round the back, and a monorail beam loops round the whole district 12 m
 * up, a train shuttling along each side of it all match (ride the chassis,
 * or get run over).
 *
 * - The Crimson Ace (north-west, the first team's house): a casino floor of
 *   slot banks and card tables and the Ace Lounge behind it, fronting the
 *   fountain lake. Walkways cross the lake to its doors; the fountain stands
 *   on an island in the middle. Every 40 s the fountain show starts: the
 *   lake lights cycle magenta, cyan and gold, then blink.
 * - The Silver Comet (north-east, the second team's house): its casino floor,
 *   the cashier cage behind bars (bomb site A), the vault (bomb site B)
 *   behind vault doors only Comet security opens, and the showroom, whose
 *   stage holds the hostages. Heist crews get into the vault by blowing the
 *   reinforced back wall or working the override console in the service
 *   corridor (doors open 15 s, alarms going). Its hotel tower rises over it to
 *   the Sky Lounge on the roof (glass elevator up the east face, or the
 *   stairs).
 * - The Desert Orchid (south-west): a four-storey hotel tower, a glass
 *   elevator up its west face to the rooftop pool (or the stairs).
 * - The parking garage (south-east): two decks of buggies, ramps up to the
 *   roof and its helipad (a dropship waits).
 * - Pedestrian bridges cross the Strip north and south of the crossroads.
 * - The monorail station on the south straight of the loop: elevators up from
 *   the alleys; stay on the platform, the cars do not stop for anyone.
 * - Each casino floor has a jackpot lever: the slot banks blink and chime.
 *
 * Teams: the Crimson Ace crew (first: attackers in Bomb, rescuers in
 * Hostage) and Silver Comet security (second). CTF: casino against casino.
 * KOTH: the fountain island, the Sky Lounge, the monorail station.
 *
 * Grid x east, y north; one cell = 8 m; levels 4 m. Loop at x -9 / 10 and
 * y -10 / 9 (12 m up), alleys inside it, the Strip at x 0..1, the cross
 * street at y -1..0.
 *
 *   y 2..7   [alley][Crimson Ace][lake][walk][ STRIP ][walk][Silver Comet + tower][alley]
 *   y -2..1  [cross street][ CROSSROADS ][cross street]
 *   y -8..-3 [alley][Desert Orchid tower][walk][ STRIP ][walk][garage + helipad][alley]
 *            x -8  -7..-4  -3..-2  -1   0..1   2   3..8   9
 */
import { type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Rotation, type Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('lucky_strip', 'Lucky Strip');
m.theme('neon_megacity');
m.backdrop('night', 'city', 'stone', 0.5);
m.teams([16, 16]);
const [ACE, COMET] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);
/** A block along the line from (xa, za) to (xb, zb), `width` across it. */
function beam(xa: number, za: number, xb: number, zb: number, width: number, y0: number, y1: number, look: Look, extra = 0): void {
  const dx = xb - xa;
  const dz = zb - za;
  m.block([r2((xa + xb) / 2), r2(y0), r2((za + zb) / 2)], [r2(Math.hypot(dx, dz) + extra), r2(y1 - y0), r2(width)], 'solid', { ...look, yaw: +Math.atan2(-dz, dx).toFixed(4) });
}

const DECK: Look = { material: 'pbr_concrete_dark', tint: '#5a5668' };
const GIRDER: Look = { material: 'pbr_steel', tint: '#34303c' };
const NEON_RAIL: Look = { material: 'neon_tube', tint: '#ff4fd8' };
const GOLD_RAIL: Look = { material: 'neon_tube', tint: '#ffcf4f' };
const STONE: Look = { material: 'pbr_travertine', tint: '#c8b8a0' };
const POOL: Look = { material: 'white_tiles', tint: '#bfe6f0' };

// ---------------------------------------------------------------- tiles

const taken = new Set<string>();
const key = (x: number, y: number, z = 0) => `${x},${y},${z}`;
const claim = (x0: number, y0: number, x1: number, y1: number, z0 = 0, z1 = 0) => {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) taken.add(key(x, y, z));
};
function tile(kind: string, x: number, y: number, z = 0, rot: Rotation = 0, o?: RoomOptions): void {
  m.tile(kind, x, y, z, rot, o);
}

// The Strip, the crossroads and the cross street.
m.tile('city.crossroads', -1, -2);
claim(-1, -2, 2, 1);
for (const y of [2, 3, 4, 5, 6, 7, 8, -9, -8, -7, -6, -5, -4, -3]) {
  m.tile('city.street', 0, y, 0, 1);
  claim(0, y, 1, y);
}
for (const x of [-8, -7, -6, -5, -4, -3, -2, 3, 4, 5, 6, 7, 8, 9]) {
  m.tile('city.street', x, -1);
  claim(x, -1, x, 0);
}

// ---- The Crimson Ace (x -7..-4, y 2..7): casino floor, the Ace Lounge, a service corridor down the back.
const CASINO: RoomOptions = { layout: 'empty', ceiling: 'roof', facade: 'neon' };
tile('hall', -6, 2, 0, 0, CASINO);
tile('hall', -6, 5, 0, 0, CASINO);
for (let y = 2; y <= 7; y++) tile('corridor', -7, y, 0, 0);
claim(-7, 2, -4, 7);
// The lake (x -3..-2, y 2..7) is a basin of blocks, no tiles.
claim(-3, 2, -2, 7);

// ---- The Silver Comet (x 3..8, y 2..7): casino floor, showroom, cashier cage, vault, service corridor, hotel tower.
tile('hall', 3, 2, 0, 0, CASINO);
tile('hall', 3, 5, 0, 0, { layout: 'platform', ceiling: 'roof', facade: 'neon' });
tile('room_large', 6, 2, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'neon' });
tile('room_large', 6, 4, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'neon' });
for (let y = 2; y <= 5; y++) tile('corridor', 8, y, 0, 0);
// The tower: rooms x 6..7, y 6..7 on levels 0..3, the Sky Lounge on level 4; stairwells up column x 8.
const GLASS: RoomOptions = { layout: 'empty', facade: 'glass' };
for (let z = 0; z <= 4; z++) for (const x of [6, 7]) for (const y of [6, 7]) tile('room', x, y, z, 0, z === 4 ? { layout: 'empty', ceiling: 'roof', facade: 'glass' } : GLASS);
tile('stairwell', 8, 6, 0);
tile('room', 8, 7, 0, 0, { layout: 'empty' });
tile('stairwell', 8, 7, 1);
tile('stairwell', 8, 6, 2);
tile('stairwell', 8, 7, 3);
tile('room', 8, 6, 4, 0, { layout: 'empty', ceiling: 'roof', facade: 'glass' });
claim(3, 2, 8, 7);

// ---- The Desert Orchid (x -6..-5, y -6..-5, levels 0..3), stairwells up column x -4 (the last onto the roof).
for (let z = 0; z <= 3; z++) for (const x of [-6, -5]) for (const y of [-6, -5]) tile('room', x, y, z, 0, z === 3 ? { layout: 'empty', ceiling: 'roof', facade: 'glass' } : GLASS);
tile('stairwell', -4, -6, 0);
tile('room', -4, -5, 0, 0, { layout: 'empty' });
tile('stairwell', -4, -5, 1);
tile('stairwell', -4, -6, 2);
tile('stairwell', -4, -5, 3);
claim(-6, -6, -4, -5);

// ---- The parking garage (x 4..7, y -7..-4): two decks and a roof, a ramp up each storey.
tile('ramp', 4, -7, 0, 0); // up east from the street onto deck 1
tile('ramp', 7, -6, 1, 3); // up north from deck 1 onto the roof
const GARAGE = new Set<string>();
for (let x = 4; x <= 7; x++)
  for (let y = -7; y <= -4; y++) {
    for (const z of [0, 1]) {
      if ((y === -7 && (x === 4 || x === 5)) || (z === 1 && x === 7 && (y === -6 || y === -5))) continue;
      tile('room', x, y, z, 0, { layout: z === 0 && (x + y) % 2 === 0 ? 'pillar' : 'empty' });
      GARAGE.add(key(x, y, z));
    }
  }
tile('military.helipad', 4, -6, 2);
for (const [x, y] of [[4, -7], [5, -7], [6, -7], [7, -7], [6, -6], [6, -5], [4, -4], [5, -4], [6, -4], [7, -4]] as const) tile('platform_rail', x, y, 2);
claim(4, -7, 7, -4);

// ---- Pedestrian bridges over the Strip, north (y 5) and south (y -6): stairs up each kerb, a deck across.
for (const y of [5, -6]) {
  for (const x of [-1, 2]) {
    tile('stairs_open', x, y - 1, 0, 3); // climbs north onto the deck
    tile('platform_rail', x, y, 1);
    taken.add(key(x, y - 1));
  }
  for (const x of [0, 1]) tile('bridge', x, y, 1, 1);
}

// Everything else on the ground is open: sidewalks, plazas, alleys, the ground under the monorail.
for (let x = -9; x <= 10; x++) for (let y = -10; y <= 9; y++) if (!taken.has(key(x, y))) tile('yard', x, y);

// ---------------------------------------------------------------- walls and openings

// The Crimson Ace: the floor opens south onto the sidewalk and east over the lake; the lounge behind it.
edge(-5, 2, 0, 'S', 'wide').edge(-6, 2, 0, 'S', 'windows').edge(-4, 2, 0, 'S', 'windows');
edge(-4, 2, 0, 'E', 'windows').edge(-4, 3, 0, 'E', 'door').edge(-4, 4, 0, 'E', 'windows');
edge(-6, 4, 0, 'N', 'wall').edge(-5, 4, 0, 'N', 'wide').edge(-4, 4, 0, 'N', 'wall');
edge(-4, 5, 0, 'E', 'windows').edge(-4, 6, 0, 'E', 'door').edge(-4, 7, 0, 'E', 'windows');
edge(-6, 7, 0, 'N', 'windows').edge(-5, 7, 0, 'N', 'door').edge(-4, 7, 0, 'N', 'windows');
edge(-7, 3, 0, 'E', 'door').edge(-7, 6, 0, 'E', 'door').edge(-7, 4, 0, 'W', 'door');
// The lake basin: open edges round it.
for (let y = 2; y <= 7; y++) edge(-1, y, 0, 'W', 'open');
for (const x of [-3, -2]) edge(x, 1, 0, 'N', 'open').edge(x, 8, 0, 'S', 'open');

// The Silver Comet floor: a wide door off the Strip, a door south; the cage behind bars; the showroom north.
edge(3, 3, 0, 'W', 'wide').edge(3, 2, 0, 'W', 'windows').edge(3, 4, 0, 'W', 'windows');
edge(4, 2, 0, 'S', 'door').edge(3, 2, 0, 'S', 'windows').edge(5, 2, 0, 'S', 'windows');
edge(5, 2, 0, 'E', 'bars').edge(5, 3, 0, 'E', 'door').edge(5, 4, 0, 'E', 'wall');
edge(3, 4, 0, 'N', 'wall').edge(4, 4, 0, 'N', 'wide').edge(5, 4, 0, 'N', 'wall');
// The showroom: a stage door to the sidewalk and one to the alley, a door into the hotel lobby.
edge(3, 5, 0, 'W', 'wall').edge(3, 6, 0, 'W', 'door').edge(3, 7, 0, 'W', 'wall');
edge(3, 7, 0, 'N', 'wall').edge(4, 7, 0, 'N', 'door').edge(5, 7, 0, 'N', 'wall');
edge(5, 5, 0, 'E', 'wall').edge(5, 6, 0, 'E', 'door').edge(5, 7, 0, 'E', 'wall');
// Cashier cage (x 6..7, y 2..3): walls to the street, a back door to the service corridor.
edge(6, 2, 0, 'S', 'wall').edge(7, 2, 0, 'S', 'wall').edge(7, 2, 0, 'E', 'wall').edge(7, 3, 0, 'E', 'door');
// The vault (x 6..7, y 4..5): a vault door from the cage, one from the service corridor, the reinforced back wall.
edge(6, 4, 0, 'S', 'door').edge(7, 4, 0, 'S', 'door').edge(7, 5, 0, 'E', 'door').edge(7, 4, 0, 'E', 'wall');
edge(6, 5, 0, 'N', 'wall').edge(7, 5, 0, 'N', 'wall');
edge(8, 3, 0, 'E', 'door');
// The tower lobby: one room, glass to the alley, a door out.
edge(6, 6, 0, 'E', 'open').edge(6, 7, 0, 'E', 'open').edge(6, 6, 0, 'N', 'open').edge(7, 6, 0, 'N', 'open');
edge(6, 7, 0, 'N', 'windows').edge(7, 7, 0, 'N', 'door');
// Tower floors: glass all round; the Sky Lounge one room, the glass elevator's door east.
for (let z = 1; z <= 4; z++) {
  for (const x of [6, 7]) edge(x, 7, z, 'N', 'windows');
  for (const y of [6, 7]) edge(6, y, z, 'W', 'windows');
  if (z < 4) edge(6, 6, z, 'S', 'windows').edge(7, 6, z, 'S', 'windows');
}
for (const x of [6, 7, 8]) edge(x, 6, 4, 'S', 'windows');
edge(6, 6, 4, 'E', 'open').edge(6, 7, 4, 'E', 'open').edge(6, 6, 4, 'N', 'open').edge(7, 6, 4, 'N', 'open').edge(7, 6, 4, 'E', 'open');
edge(8, 6, 4, 'E', 'door');

// The Desert Orchid: a lobby on the ground, glass all round above, the roof door off the top stairwell.
edge(-6, -6, 0, 'E', 'open').edge(-6, -5, 0, 'E', 'open').edge(-6, -6, 0, 'N', 'open').edge(-5, -6, 0, 'N', 'open');
edge(-6, -6, 0, 'S', 'door').edge(-5, -6, 0, 'S', 'windows').edge(-5, -5, 0, 'N', 'door').edge(-6, -5, 0, 'N', 'windows');
edge(-6, -5, 0, 'W', 'door').edge(-6, -6, 0, 'W', 'windows').edge(-4, -5, 0, 'E', 'door');
for (let z = 1; z <= 3; z++) {
  for (const y of [-6, -5]) edge(-6, y, z, 'W', 'windows');
  for (const x of [-6, -5]) edge(x, -5, z, 'N', 'windows').edge(x, -6, z, 'S', 'windows');
}
edge(-4, -5, 4, 'W', 'door');

// The garage: open between bays, parapets round the decks, open to the street on the ground.
for (const k of GARAGE) {
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  for (const [side, dx, dy] of [['N', 0, 1], ['E', 1, 0], ['S', 0, -1], ['W', -1, 0]] as const) {
    const n = key(x + dx, y + dy, z);
    if (GARAGE.has(n)) {
      if (dx > 0 || dy > 0) edge(x, y, z, side, 'open');
    } else if (x + dx >= 4 && x + dx <= 7 && y + dy >= -7 && y + dy <= -4) continue; // a ramp
    else edge(x, y, z, side, z === 0 && (side === 'W' || side === 'N' || (side === 'S' && x >= 6)) ? 'open' : 'half');
  }
}
edge(7, -5, 2, 'N', 'open');

// ---------------------------------------------------------------- the fountain lake (x -28..-12, z 12..60)

const LAKE = { x0: -28, x1: -12, z0: 12, z1: 60 };
m.block([-20, -1.8, 36], [16, 0.3, 48], 'solid', STONE);
beam(LAKE.x0, LAKE.z0, LAKE.x0, LAKE.z1, 0.4, -1.8, -0.02, STONE);
beam(LAKE.x1, LAKE.z0, LAKE.x1, LAKE.z1, 0.4, -1.8, -0.02, STONE);
beam(LAKE.x0, LAKE.z0, LAKE.x1, LAKE.z0, 0.4, -1.8, -0.02, STONE);
beam(LAKE.x0, LAKE.z1, LAKE.x1, LAKE.z1, 0.4, -1.8, -0.02, STONE);
m.water([-20, -1.5, 36], [16, 1.4, 48], 'water', '#2a4a6a');
// The fountain island and the walkways: across to the casino's two doors, out to the island from the sidewalk.
m.block([-20, -1.8, 36], [12, 1.8, 12], 'solid', STONE);
m.block([-20, -1.8, 24], [16, 1.8, 3.6], 'solid', STONE);
m.block([-20, -1.8, 48], [16, 1.8, 3.6], 'solid', STONE);
m.block([-13, -1.8, 40], [2.2, 1.8, 3.6], 'solid', STONE);
m.prop('fountain', [-22, 0, 36], 0, 0.7);
const SHOW: string[] = [];
for (const [x, z] of [[-26, 16], [-14, 16], [-26, 30], [-26, 42], [-14, 56], [-26, 56], [-20, 36], [-14, 30]] as const) {
  const id = `lamp_show_${SHOW.length + 1}`;
  SHOW.push(id);
  m.light([x, x === -20 ? 2.6 : -0.6, z], { id, fixture: 'none', color: '#9fe8ff', intensity: x === -20 ? 1.8 : 1.4, range: 12 });
}
m.add({ kind: 'button', id: 'btn_show', name: 'Fountain show console', position: [-11.4, 1.1, 30], yaw: -P, label: 'Start the show', once: false, cooldownSeconds: 20, startEnabled: true });
m.prop('nc_holo_kiosk', [-10.6, 0, 28], P);

// ---------------------------------------------------------------- the monorail loop (12 m)

const LOOP: { len: number; at: (t: number) => [number, number] }[] = [];
const line = (ax: number, az: number, bx: number, bz: number) => LOOP.push({ len: Math.hypot(bx - ax, bz - az), at: (t) => [ax + (bx - ax) * t, az + (bz - az) * t] });
const R = 8;
const arc = (cx: number, cz: number, a0: number, a1: number) => LOOP.push({ len: Math.abs(a1 - a0) * R, at: (t) => [cx + R * Math.cos(a0 + (a1 - a0) * t), cz + R * Math.sin(a0 + (a1 - a0) * t)] });
// Centre line: x -72 and 80, z -80 and 72 (the outer ring of cells), corners of 8 m radius.
line(-64, -80, 72, -80);
arc(72, -72, -P, 0);
line(80, -72, 80, 64);
arc(72, 64, 0, P);
line(72, 72, -64, 72);
arc(-64, 64, P, S);
line(-72, 64, -72, -72);
arc(-64, -72, S, S + P);
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
/** The beam's centre line sampled every 2 m: position and unit heading. */
type Sample = { x: number; z: number; dx: number; dz: number };
const sampleAt = (d: number): Sample => {
  const [x, z] = loopAt(d);
  const [ax, az] = loopAt(d - 0.5);
  const [bx, bz] = loopAt(d + 0.5);
  const l = Math.hypot(bx - ax, bz - az) || 1;
  return { x, z, dx: (bx - ax) / l, dz: (bz - az) / l };
};
const smp: Sample[] = [];
for (let d = 0; d < LOOP_LEN - 0.01; d += LOOP_LEN / Math.round(LOOP_LEN / 2)) smp.push(sampleAt(d));
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
// The station platform on the inside of the south straight (x -15..23), off the cars' line.
const ST = { x0: -15, x1: 23, z0: -76, z1: -72 };
m.block([4, DECK_Y - 0.3, -74], [38, 0.3, 4], 'solid', DECK);
// Railings along both edges of the beam, open where the station platform meets it.
const GAPS = [{ x0: ST.x0 + 1, x1: ST.x1 - 1, z0: -78, z1: -74 }];
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
      beam(a[0], a[1], b[0], b[1], 0.32, DECK_Y + 1.1, DECK_Y + 1.2, side < 0 ? NEON_RAIL : GOLD_RAIL, 0.1);
    }
    i = j;
  }
}
// Pylons under the beam every 16 m (none in the station), lit from below.
for (let s = 8; s < LOOP_LEN; s += 16) {
  const p = sampleAt(s);
  const yaw = +Math.atan2(-p.dz, p.dx).toFixed(4);
  m.block([r2(p.x), 0, r2(p.z)], [1.3, DECK_Y - 0.6, 1.3], 'solid', { ...GIRDER, yaw });
  m.block([r2(p.x), DECK_Y - 1.4, r2(p.z)], [1.6, 0.8, WIDTH - 1], 'solid', { ...GIRDER, yaw });
  m.light([r2(p.x), DECK_Y - 1.7, r2(p.z)], { fixture: 'none', color: s % 32 < 16 ? '#ff4fd8' : '#ffcf4f', intensity: 1.2, range: 12 });
}
// The station: its rail on the inside edge (open at the elevators), a canopy over platform and beam, posts.
for (const [x0, x1] of [[ST.x0, -12], [-8, 16], [20, ST.x1]] as const) {
  m.block([r2((x0 + x1) / 2), DECK_Y, ST.z1 - 0.15], [x1 - x0, 1.1, 0.3], 'solid', GIRDER);
  m.block([r2((x0 + x1) / 2), DECK_Y + 1.1, ST.z1 - 0.15], [x1 - x0, 0.1, 0.32], 'solid', GOLD_RAIL);
}
m.block([4, DECK_Y + 4, -77], [38, 0.3, 10], 'solid', { material: 'pbr_glass_facade', tint: '#5a6a8a' });
for (const x of [ST.x0 + 0.3, -4, 12, ST.x1 - 0.3]) m.block([x, DECK_Y, ST.z1 - 0.6], [0.3, 4, 0.3], 'solid', GIRDER);
m.prop('bench', [0, DECK_Y, -73], S).prop('bench', [8, DECK_Y, -73], S).prop('nc_vending', [-2, DECK_Y, -72.7], S).prop('nc_holo_kiosk', [14, DECK_Y, -73.2], S);
m.light([4, DECK_Y + 3.5, -76], { fixture: 'sign', text: 'MONORAIL', color: '#ffcf4f', yaw: 0, intensity: 1.2, range: 10, size: [4, 0.9] });
for (const x of [-8, 4, 16]) m.light([x, DECK_Y + 3.6, -74], { fixture: 'strip', color: '#fff0d8', intensity: 1, range: 10 });

// The monorail: a two-car train shuttling along each straight of the beam (ride the chassis; at 8 m/s it runs
// over anyone standing in its way, so keep to the walkways either side).
const TRAINS: [string, V3, V3][] = [
  ['south', [-56, DECK_Y, -80], [120, 0, 0]],
  ['east', [80, DECK_Y, -64], [0, 0, 120]],
  ['north', [64, DECK_Y, 72], [-120, 0, 0]],
  ['west', [-72, DECK_Y, 56], [0, 0, -120]],
];
for (const [name, pos, run] of TRAINS) {
  const alongX = run[0] !== 0;
  const sx = Math.sign(run[0] + run[2]);
  const yaw = alongX ? (sx > 0 ? P : -P) : sx > 0 ? 0 : S;
  m.block(pos, alongX ? [10.5, 0.4, 2.6] : [2.6, 0.4, 10.5], 'solid', { id: `train_${name}_chassis`, material: 'pbr_steel', tint: '#c8ccd8' });
  const off = (d: number): V3 => [r2(pos[0] + (alongX ? sx * d : 0)), DECK_Y, r2(pos[2] + (alongX ? 0 : sx * d))];
  m.add({ kind: 'prop', id: `train_${name}_front`, model: 'prop.nc_skytrain_front', position: off(2.6), yaw, scale: 1, solid: false, tint: null });
  m.add({ kind: 'prop', id: `train_${name}_end`, model: 'prop.nc_skytrain_end', position: off(-2.5), yaw, scale: 1, solid: false, tint: null });
  m.mover(`mover_train_${name}`, pos, [`train_${name}_chassis`], [[0, 0, 0], run], { mode: 'pingpong', speed: 8, wait: 4, name: `Monorail (${name})`, props: [`train_${name}_front`, `train_${name}_end`] });
}

// ---------------------------------------------------------------- elevators

/** A glass elevator: a cab floor riding from `pos` up `rise` metres and back, with a light in it. */
function elevator(id: string, pos: V3, rise: number, name: string, width = 3): void {
  m.block(pos, [width, 0.3, 3], 'solid', { id: `${id}_cab`, material: 'pbr_tread_plate', tint: '#8a8090' });
  m.mover(id, [pos[0], pos[1], pos[2]], [`${id}_cab`], [[0, 0, 0], [0, r2(rise), 0]], { speed: 3, wait: 3, name });
}
// Up to the monorail station from the alleys either side of the Strip.
elevator('mover_lift_station_w', [-10, -0.3, -70.4], DECK_Y, 'Monorail elevator (west)');
elevator('mover_lift_station_e', [18, -0.3, -70.4], DECK_Y, 'Monorail elevator (east)');
// The Desert Orchid's glass elevator up its west face to the pool roof (16 m).
elevator('mover_lift_orchid', [-54, -0.3, -44], 16, 'Desert Orchid glass elevator');
// The Silver Comet tower's glass elevator up its east face to the Sky Lounge (16 m).
elevator('mover_lift_lounge', [69.6, -0.3, 48], 16, 'Sky Lounge glass elevator', 2.6);
for (const [x, z, yaw] of [[-10, -67, S], [18, -67, S], [-54, -40.6, 0], [69.6, 51.4, 0]] as const) m.prop('nc_holo_kiosk', [x, 0, z], yaw);

// ---------------------------------------------------------------- casino floors

/** A bank of slot machines (vending cabinets, lit) back to back along x from `x0`, stools in front, a lit sign over it. */
const SLOTS: string[] = [];
function slotBank(x0: number, z: number, count: number, sign: string, color: string): void {
  for (let i = 0; i < count; i++) {
    const x = x0 + i * 1.6;
    m.prop('nc_vending', [r2(x), 0, r2(z - 0.45)], S).prop('nc_vending', [r2(x), 0, r2(z + 0.45)], 0);
    m.prop('bar_stool', [r2(x), 0, r2(z - 1.6)], 0).prop('bar_stool', [r2(x), 0, r2(z + 1.6)], S);
  }
  const id = `lamp_slots_${SLOTS.length + 1}`;
  SLOTS.push(id);
  m.light([r2(x0 + ((count - 1) * 1.6) / 2), 2.7, z], { id, fixture: 'sign', text: sign, color, yaw: 0, intensity: 1.1, range: 6, size: [2.6, 0.7] });
}
/** A card table: a round table, chairs round it, a lamp over it. */
function cardTable(x: number, z: number): void {
  m.prop('table_round', [x, 0, z], 0).prop('rug_round', [x, 0, z], 0, 1.4, false);
  for (const [dx, dz, yaw] of [[1.5, 0, -P], [-1.5, 0, P], [0, 1.5, S], [0, -1.5, 0]] as const) m.prop('chair_cushion', [r2(x + dx), 0, r2(z + dz)], yaw);
  m.light([x, 3.2, z], { fixture: 'bulb', color: '#ffe0a0', intensity: 0.9, range: 6 });
}
// The Crimson Ace floor (x -52..-28, z 12..36): slots west, tables east.
slotBank(-50, 17, 4, '777', '#ff3b3b');
slotBank(-50, 25, 4, 'JACKPOT', '#ffcf4f');
slotBank(-50, 33, 4, 'SLOTS', '#ff4fd8');
cardTable(-32, 17);
cardTable(-32, 30);
m.prop('display_table', [-40, 0, 35], 0);
m.add({ kind: 'button', id: 'btn_jackpot_ace', name: 'Crimson Ace jackpot lever', position: [-51.3, 1.1, 21], yaw: P, label: 'Pull the lever', once: false, cooldownSeconds: 20, startEnabled: true });
// The Silver Comet floor (x 20..44, z 12..36): tables west, slots east.
slotBank(36.4, 17, 4, '777', '#4fe0ff');
slotBank(36.4, 25, 4, 'JACKPOT', '#ffcf4f');
slotBank(36.4, 33, 4, 'SLOTS', '#9a6bff');
cardTable(25, 17);
cardTable(25, 30);
m.add({ kind: 'button', id: 'btn_jackpot_comet', name: 'Silver Comet jackpot lever', position: [43.3, 1.1, 21], yaw: -P, label: 'Pull the lever', once: false, cooldownSeconds: 20, startEnabled: true });
// The cashier cage (x 44..60, z 12..28): counters behind the bars, the safes, the money.
for (const z of [14.5, 17.5]) m.prop('checkout', [46.4, 0, z], P);
m.prop('shelf_boxes', [58.8, 0, 14], -P).prop('metal_crate', [58.6, 0, 19], 0).prop('dg_coin_pile', [53, 0, 14], 0).prop('desk', [52, 0, 25.5], S);
// The vault (x 44..60, z 28..44): gold, chests, safes.
m.prop('dg_coin_pile', [48, 0, 40], 0).prop('dg_coin_pile', [55, 0, 41], 0.5).prop('dg_chest', [50, 0, 42.6], S).prop('dg_coin_bag', [57, 0, 35], 0).prop('metal_crate', [46, 0, 42.3], 0).prop('metal_crate', [58.5, 0, 42.3], 0);
// The showroom (x 20..44, z 36..60): the stage (a 1.5 m platform), speakers, benches facing it.
m.prop('speaker', [27.6, 1.5, 50.4], S, 1.4).prop('speaker', [36.4, 1.5, 50.4], S, 1.4);
for (const z of [39, 41.5]) for (const x of [24, 40]) m.prop('stall_bench', [x, 0, z], P);
for (const x of [26, 32, 38]) m.light([x, 3.6, 46], { fixture: 'none', color: x === 32 ? '#ffffff' : '#ff4fd8', intensity: 1.4, range: 9 });
m.light([32, 3.2, 52.6], { fixture: 'sign', text: 'TONIGHT ONLY', color: '#ff4fd8', yaw: S, intensity: 1.2, range: 8, size: [4.4, 0.9] });
// Vault doors (Comet security only) and the reinforced back wall; the override console in the service corridor.
m.add({ kind: 'door', id: 'door_vault_cage', name: 'Vault door (cage)', position: [48, 0, 28], yaw: 0, style: 'vault', startOpen: false, locked: false, auto: true, team: COMET });
m.add({ kind: 'door', id: 'door_vault_back', name: 'Vault door (service)', position: [60, 0, 40], yaw: P, style: 'vault', startOpen: false, locked: false, auto: true, team: COMET });
m.add({ kind: 'destructible', id: 'wall_vault', model: 'wall', position: [56, 0, 28], yaw: 0, health: 600, explosiveOnly: true });
m.add({ kind: 'button', id: 'btn_vault_override', name: 'Vault override console', position: [67.3, 1.1, 30], yaw: -P, label: 'Override the vault', once: false, cooldownSeconds: 45, startEnabled: true, team: ACE });
for (const [id, pos] of [['lamp_vault_1', [52, 3.3, 36]], ['lamp_vault_2', [64, 3.3, 36]], ['lamp_vault_3', [52, 3.3, 20]]] as const) m.light(pos as unknown as V3, { id, fixture: 'bulb', color: '#ff2a1a', intensity: 1.5, range: 9, off: true, blink: 3 });
m.prop('computer_bank', [66.6, 0, 30], -P);

// ---------------------------------------------------------------- the Desert Orchid roof pool, the Sky Lounge, the helipad

// The pool on the Orchid's roof (16 m): a deck over the whole roof (out to the stair door), a tiled rim, water, loungers and parasols.
const ROOF = 16.1;
m.block([-44, 15.9, -44], [16.6, 0.2, 16.4], 'solid', { material: 'pbr_terrazzo', tint: '#d8d0c4' });
for (const [x0, z0, x1, z1] of [[-50, -50, -40, -50], [-50, -42, -40, -42], [-50, -50, -50, -42], [-40, -50, -40, -42]] as const) beam(x0, z0, x1, z1, 0.5, ROOF, ROOF + 0.5, POOL, 0.5);
m.water([-45, ROOF, -46], [9.5, 0.45, 7.5], 'water', '#3ac8e0');
m.light([-45, ROOF + 0.2, -46], { fixture: 'none', color: '#5ae0ff', intensity: 1.2, range: 9 });
for (const z of [-50, -45, -40.5]) m.prop('sofa_long', [-38, ROOF, z], -P);
m.prop('parasol', [-38.5, ROOF, -47.5], 0).prop('parasol', [-38.5, ROOF, -42.5], 0).prop('hm_potted_palm', [-50.5, ROOF, -38.5], 0).prop('hm_potted_palm', [-41, ROOF, -38.5], 0);
// Sky Lounge (x 44..68, z 44..60 on level 4): the bar is dressed below; the view is the point.
// The helipad on the garage roof (8 m).
m.add({ kind: 'mount', model: 'dropship', position: [36, 8.15, -44], yaw: P, faction: null, respawnSeconds: 90 });

// ---------------------------------------------------------------- vehicles

for (const [x, z, yaw] of [[44, -48, 0], [52, -48, 0], [44, -36, S], [52, -36, S]] as const) m.add({ kind: 'mount', model: 'buggy', position: [x, 0, z], yaw, faction: null, respawnSeconds: 45 });
m.add({ kind: 'mount', model: 'buggy', position: [44, 4, -44], yaw: 0, faction: null, respawnSeconds: 45 });
m.add({ kind: 'mount', model: 'hover_bike', position: [-60, 0, 0], yaw: P, faction: null, respawnSeconds: 45 });
m.add({ kind: 'mount', model: 'hover_bike', position: [68, 0, -4], yaw: -P, faction: null, respawnSeconds: 45 });

// ---------------------------------------------------------------- streets and alleys

for (const z of [-60, -36, 28, 52]) {
  m.prop('nc_streetlight', [-3.6, 0, z], P).prop('nc_streetlight', [11.6, 0, z + 8], -P);
  m.light([-2, 6.6, z], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 12 });
  m.light([10, 6.6, z + 8], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 12 });
}
for (const x of [-52, -28, 36, 60]) {
  m.prop('nc_streetlight', [x, 0, -11.6], 0).prop('nc_streetlight', [x + 8, 0, 3.6], S);
  m.light([x, 6.6, -10], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 12 });
  m.light([x + 8, 6.6, 2], { fixture: 'none', color: '#ffd9a0', intensity: 1, range: 12 });
}
for (const [x, z, yaw] of [[-5.4, -13.4, -P / 2], [13.4, -13.4, P / 2], [-5.4, 5.4, -P * 1.5], [13.4, 5.4, P * 1.5]] as const) m.prop('nc_traffic_light', [x, 0, z], yaw);
m.prop('nc_highway_sign', [4, 0, 64], 0).prop('nc_highway_sign', [4, 0, -68], 0);
m.prop('nc_neon_barrier', [2, 0, -6], 0.2).prop('nc_neon_barrier', [6, 0, 2], -0.3).prop('nc_road_barrier', [-30, 0, -4], P).prop('nc_road_barrier', [44, 0, -2], P);
m.prop('nc_cone', [-31.5, 0, -2.5]).prop('nc_cone', [-31.5, 0, -6]).prop('nc_cone', [45.5, 0, -6]);
// Alleys: dumpsters, AC units, power poles, crates.
for (const [x, z, yaw] of [[-64, 36, 0], [-64, -20, 0], [72, 16, 0], [72, -56, 0], [-40, 64, P], [24, 64, P], [-24, -72, P], [56, -72, P]] as const) m.prop('nc_dumpster', [x, 0, z], yaw);
m.prop('nc_power_pole', [-66, 0, 8], 0).prop('nc_power_pole', [74, 0, -24], 0).prop('container', [-62.5, 0, 52], 0).prop('container', [70.5, 0, 28], 0);
m.prop('nc_food_stall', [-30, 0, 2.5], S).prop('nc_food_stall', [52, 0, 2.5], S).prop('nc_vending', [-12.6, 0, -40], P).prop('nc_vending', [20.6, 0, 40], -P);
m.prop('nc_holo_kiosk', [-8, 0, -24], P).prop('nc_street_sign', [-5.6, 0, 13.6], 0).prop('nc_street_sign', [13.6, 0, -21.6], S);
// Roof clutter.
for (const [x, z] of [[-48, 20], [-34, 46], [26, 22], [40, 56], [52, 16]] as const) m.prop('nc_ac_unit', [x, 4, z], 0);
m.prop('nc_antenna', [62, 20, 58], 0).prop('nc_water_tank', [-30, 16, -54], 0);
// The Orchid's cabana garden (south-west plaza).
for (const [x, z] of [[-24, -60], [-16, -52], [-24, -36], [-56, -60]] as const) m.prop('nt_palm_tall', [x, 0, z], 0);
m.prop('parasol', [-20, 0, -44], 0).prop('table_round', [-20, 0, -44], 0).prop('parasol', [-56, 0, -28], 0);

// ---------------------------------------------------------------- neon signs and billboards

const SIGNS: [string, string, V3, number, string, [number, number]?][] = [
  ['sign_ace_east', 'CRIMSON ACE', [-27.5, 5.4, 36], P, '#ff3b3b', [8, 1.6]],
  ['sign_ace_south', 'CRIMSON ACE', [-40, 5.4, 11.5], S, '#ff3b3b', [8, 1.6]],
  ['sign_ace_lounge', 'ACE LOUNGE', [-27.5, 3.2, 52], P, '#ff9a3b', [4, 0.9]],
  ['sign_comet_west', 'SILVER COMET', [19.5, 5.4, 24], -P, '#bfe8ff', [8, 1.6]],
  ['sign_comet_show', 'SHOWROOM', [19.5, 3.4, 48], -P, '#ff4fd8', [4.4, 1]],
  ['sign_comet_south', 'CASINO', [32, 5.4, 11.5], S, '#4fe0ff', [5, 1.2]],
  ['sign_cashier', 'CASHIER', [43.6, 2.9, 20], -P, '#ffcf4f', [2.6, 0.7]],
  ['sign_orchid', 'DESERT ORCHID', [-40, 13.5, -52.5], S, '#c86bff', [8, 1.4]],
  ['sign_orchid_e', 'HOTEL', [-27.5, 9, -44], P, '#c86bff', [3, 0.9]],
  ['sign_parking', 'PARKING', [27.5, 5, -44], -P, '#5dff9a', [4, 1]],
  ['sign_lounge', 'SKY LOUNGE', [56, 19, 43.5], S, '#4fe0ff', [6, 1.1]],
  ['sign_open', 'OPEN 24H', [24, 3, 11.5], S, '#5dff9a', [3.2, 0.8]],
  ['sign_wedding', 'CHAPEL', [-60.5, 3, 60], -P, '#ff9ad8', [2.6, 0.7]],
  ['sign_buffet', 'BUFFET', [-52.5, 3, -49], -P, '#ffb347', [2.6, 0.7]],
];
for (const [id, text, pos, yaw, color, size] of SIGNS) m.light(pos, { id, fixture: 'sign', text, color, yaw, intensity: 1.4, range: 10, ...(size ? { size } : {}) });
const BOARDS: [string, string, V3, number, string, [number, number]][] = [
  ['board_strip_n', 'WIN BIG TONIGHT', [4, 9.5, 66], S, '#ffcf4f', [10, 4]],
  ['board_comet', 'THE COMET SHOW', [56, 10, 43.6], S, '#ff4fd8', [12, 6]],
  ['board_orchid', 'POOL PARTY', [-27.4, 10, -48], P, '#4fe0ff', [6, 3.4]],
  ['board_garage', 'JACKPOT 777', [28, 10, -27.5], 0, '#ff3b3b', [8, 4]],
];
for (const [id, text, pos, yaw, color, size] of BOARDS) m.light(pos, { id, fixture: 'billboard', text, color, yaw, intensity: 2, range: 18, size });
// Billboard poles where nothing holds them up.
m.block([4, 0, 66.6], [0.6, 7.5, 0.6], 'solid', GIRDER);
m.block([28, 0, -27], [0.6, 8, 0.6], 'solid', GIRDER);

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
const pressed = (id: string): LogicRule['when'] => ({ event: 'button_pressed', target: id });
const showAt: LogicRule['when'] = { event: 'timer_done', target: 'timer_show' };
const show = (suffix: string, when: LogicRule['when']): LogicRule[] => [
  rule(`rule_show_colours${suffix}`, 'Fountain show: colours', when, [
    act('sound', null, { state: 'chime' }),
    ...SHOW.map((id) => act('light_color', id, { text: '#ff4fd8' })),
    act('wait', null, { value: 2 }),
    ...SHOW.map((id) => act('light_color', id, { text: '#4fe0ff' })),
    act('wait', null, { value: 2 }),
    ...SHOW.map((id) => act('light_color', id, { text: '#ffcf4f' })),
  ]),
  rule(`rule_show_blink${suffix}`, 'Fountain show: finale', when, [act('wait', null, { value: 6 }), ...SHOW.map((id) => act('light_blink', id, { value: 4, state: 'on' })), act('wait', null, { value: 4 }), ...SHOW.map((id) => act('light_blink', id, { state: 'off' }))]),
  rule(`rule_show_end${suffix}`, 'Fountain show: lights back', when, [act('wait', null, { value: 10 }), ...SHOW.map((id) => act('light_color', id))]),
];
const jackpot = (id: string, slots: string[]): LogicRule =>
  rule(`rule_${id}`, 'Jackpot', pressed(id), [act('sound', null, { state: 'chime' }), say('JACKPOT!', 2), ...slots.map((s) => act('light_blink', s, { value: 5, state: 'on' })), act('wait', null, { value: 5 }), ...slots.map((s) => act('light_blink', s, { state: 'off' }))]);
const vaultAlarm = (on: boolean) => ['lamp_vault_1', 'lamp_vault_2', 'lamp_vault_3'].map((id) => act(on ? 'light_on' : 'light_off', id));
m.logic({
  variables: [],
  timers: [{ id: 'timer_show', name: 'Fountain show', seconds: 40, loop: true, visible: false }],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome to the Strip', { event: 'match_start', target: null }, [say('Lucky Strip. The monorail does not stop for anyone: stay on the platform.', 4), act('timer_start', 'timer_show')]),
    ...show('', showAt),
    ...show('_button', pressed('btn_show')),
    jackpot('btn_jackpot_ace', SLOTS.slice(0, 3)),
    jackpot('btn_jackpot_comet', SLOTS.slice(3)),
    rule('rule_vault_override', 'Override the vault', pressed('btn_vault_override'), [
      act('sound', null, { state: 'alarm' }),
      say('Vault override! The vault doors are open for 15 seconds.', 3),
      ...vaultAlarm(true),
      act('door_open', 'door_vault_cage'),
      act('door_open', 'door_vault_back'),
      act('wait', null, { value: 15 }),
      act('door_close', 'door_vault_cage'),
      act('door_close', 'door_vault_back'),
      ...vaultAlarm(false),
    ]),
    rule('rule_vault_blown', 'The vault wall is down', { event: 'destroyed', target: 'wall_vault' }, [act('sound', null, { state: 'boom' }), act('sound', null, { state: 'alarm' }), say('The vault wall is down!', 3), ...vaultAlarm(true), act('wait', null, { value: 20 }), ...vaultAlarm(false)]),
  ],
});

// ---------------------------------------------------------------- objectives

// Bomb (the heist): the cashier cage (A) and the vault (B).
m.add({ kind: 'bombsite', position: [53, 0, 20], label: 'A', radius: 3.5 });
m.add({ kind: 'bombsite', position: [52, 0, 36], label: 'B', radius: 4 });
// Hostage Rescue: four performers held on and round the showroom stage; out by the Crimson Ace or up on the helipad.
for (const [p, yaw] of [[[30, 1.5, 49.5], S], [[34, 1.5, 49.5], S], [[23, 0, 57], S], [[41, 0, 57], S]] as [V3, number][]) m.hostage(p, yaw);
m.rescue([-40, 0, 6], 6);
m.rescue([52, 8, -56], 5);
// Capture the Flag: casino against casino.
m.flag(ACE, [-48, 0, 56], S);
m.flag(COMET, [54, 0, 60], S);
// King of the Hill: the fountain island, the Sky Lounge, the monorail station.
m.hill([-16, 0, 38], 3.5);
m.hill([56, 16, 52], 5);
m.hill([4, DECK_Y, -74], 3);

// ---------------------------------------------------------------- spawns

// Crimson Ace crew: the casino floor, the lounge, the service corridor, the alley and the sidewalk.
for (const [p, yaw] of [
  [[-38.5, 0, 14], 0], [[-38.5, 0, 21], 0], [[-38.5, 0, 28.5], S], [[-29.5, 0, 24], -P],
  [[-46, 0, 41], 0], [[-34, 0, 41], 0], [[-44, 0, 50], P], [[-34, 0, 55], S],
  [[-56, 0, 16], 0], [[-56, 0, 30], 0], [[-56, 0, 42], S], [[-56, 0, 56], S],
  [[-64, 0, 24], P], [[-64, 0, 46], P], [[-48, 0, 6], 0], [[-32, 0, 6], 0],
] as [V3, number][]) m.spawn(p, yaw, ACE);
// Silver Comet security: their floor, the hotel lobby, the service corridor, the tower, the alley.
for (const [p, yaw] of [
  [[30.5, 0, 14], 0], [[30.5, 0, 21], 0], [[30.5, 0, 28.5], S], [[22, 0, 24], P],
  [[50, 0, 50], -P], [[58, 0, 50], -P], [[50, 0, 57], S], [[61, 0, 58], S],
  [[64, 0, 16], 0], [[64, 0, 24], 0], [[64, 0, 40], S], [at(6, 6, 1), S], [at(7, 7, 1), S],
  [[72, 0, 22], -P], [[72, 0, 40], -P], [[40, 0, 6], 0],
] as [V3, number][]) m.spawn(p, yaw, COMET);
// Everyone else: the Strip, the crossroads, the garage, the Orchid, the alleys.
for (const [p, yaw] of [
  [[-8, 0, -16], P], [[16, 0, -16], -P], [[-8, 0, 8], P], [[16, 0, 8], -P], [[4, 0, 40], S], [[4, 0, -40], 0],
  [[50, 0, -54], 0], [[56, 0, -44], P], [[48, 4, -38], S], [[-44, 0, -44], P], [[-16, 0, -62], 0], [at(-6, -5, 2), 0],
  [[-64, 0, -40], P], [[-40, 0, -72], 0], [[72, 0, -40], -P], [[-8, 0, 30], -P],
] as [V3, number][]) m.spawn(p, yaw, null);

// ---------------------------------------------------------------- pickups

m.pickup('weapon_sniper', [-44, ROOF, -38]).pickup('ammo_sniper', [-34, ROOF, -40]);
m.pickup('weapon_railgun', [64, 16, 56]).pickup('ammo_cells', [4, DECK_Y, -73.5]);
m.pickup('weapon_rockets', [44, 8, -40 + 6.5]).pickup('ammo_explosive', [60, 8, -56]);
m.pickup('weapon_plasma', [56, 0, 40]).pickup('armor_large', [-16.5, 0, 33]);
m.pickup('weapon_smg', [-40, 0, 24]).pickup('weapon_smg', [32, 0, 24]).pickup('weapon_shotgun', [-56, 0, 22]).pickup('weapon_shotgun', [64, 0, 32]);
m.pickup('weapon_burst_rifle', [4, 0, -24]).pickup('weapon_rifle', [4, 0, 24]).pickup('weapon_lmg', [80, DECK_Y, 0]).pickup('weapon_launcher', [-72, DECK_Y, -20]);
m.pickup('weapon_auto_shotgun', [32, 0, 56]).pickup('weapon_marksman', [-40, 12, -40]);
m.pickup('ammo', [-4, 0, -4]).pickup('ammo', [12, 0, -4]).pickup('ammo_rifle', [-40, 0, 52]).pickup('ammo_rifle', [56, 0, 52]).pickup('ammo_shells', [52, 4, -52]).pickup('ammo_light', [-56, 0, -8]);
m.pickup('grenades', [-24, 0, -4]).pickup('grenades', [36, 0, 4]).pickup('grenades', [48, 0, -60]).pickup('grenades', [-64, 0, 60]);
m.pickup('armor_small', [56, 4, 52]).pickup('armor_small', [-40, 4, -40]).pickup('armor_small', [56, 0, -36]).pickup('armor_small', [16, 0, 60]);
m.pickup('health_large', [-20, 0, 48]).pickup('health_large', [60, 16, 46]).pickup('health_large', [-36, 0, -60]).pickup('health_large', [72, 0, 60]);
for (const p of [[-8, 0, 52], [16, 0, -52], [-64, 0, -64], [72, 0, -72], [-48, 0, 64], [40, 0, 64], [-24, 0, -24], [32, 0, -24], [4, DECK_Y, 72], [-72, DECK_Y, 40], [80, DECK_Y, -40], [-52, 0, 2]] as V3[]) m.pickup('health_small', p);

// ---------------------------------------------------------------- dressing

m.dress({ x0: -6, y0: 5, x1: -4, y1: 7, z: 0 }, 'bar', { density: 'normal' });
m.dress({ x0: 6, y0: 6, x1: 7, y1: 7, z: 0 }, 'lobby', { density: 'sparse' });
m.dress({ x0: -6, y0: -6, x1: -5, y1: -5, z: 0 }, 'lobby', { density: 'sparse' });
m.dress({ x0: 6, y0: 6, x1: 8, y1: 7, z: 4 }, 'bar', { density: 'sparse' });
for (const [x, y, z, type] of [
  [6, 6, 2, 'bedroom'], [7, 7, 2, 'bedroom'], [6, 7, 3, 'living'], [7, 6, 3, 'bedroom'],
  [-6, -6, 1, 'bedroom'], [-5, -5, 1, 'bedroom'], [-6, -5, 2, 'living'], [-5, -6, 2, 'bedroom'], [-6, -6, 3, 'bedroom'], [-5, -5, 3, 'living'],
] as const) m.dress([x, y, z], type, { density: 'sparse' });

// ---------------------------------------------------------------- light

m.lightRooms({ color: '#ffe8d8', intensity: 0.9, range: 9 });
// Casino floors, the lounge and the showroom (single storeys under roofs of their own).
for (const [cx, cz, c] of [[-40, 24, '#ffd9b0'], [-40, 48, '#ff9a6a'], [32, 24, '#d8ecff'], [32, 48, '#ffb0e8']] as const) {
  for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]] as const) m.light([cx + dx, 3.5, cz + dz], { color: c, intensity: 1, range: 11 });
}
for (const [x, z] of [[48, 16], [56, 24], [48, 40], [56, 32]] as const) m.light([x, 3.45, z], { color: '#fff1d6', range: 9 });
for (let y = 2; y <= 7; y++) {
  m.light(at(-7, y, 0, 0, 0, 3.4), { fixture: 'strip', color: '#ffe0c0', intensity: 0.7, range: 8 });
  if (y <= 5) m.light(at(8, y, 0, 0, 0, 3.4), { fixture: 'strip', color: '#ffe0c0', intensity: 0.7, range: 8 });
}
// Tower tops (the Orchid's top floor and the Sky Lounge have nothing above them).
for (const x of [-6, -5]) for (const y of [-6, -5]) m.light(at(x, y, 3, 0, 0, 3.45), { color: '#ffe8d8', range: 9 });
for (const [x, y] of [[6, 6], [7, 6], [6, 7], [7, 7], [8, 6]] as const) m.light(at(x, y, 4, 0, 0, 3.45), { color: '#c8a0ff', intensity: 0.9, range: 9 });
// The garage decks and roof.
for (const [x, z] of [[40, -52], [56, -52], [40, -36], [56, -36]] as const) {
  m.light([x, 3.4, z], { fixture: 'strip', color: '#e8fff0', intensity: 0.8, range: 10 });
  m.light([x, 7.4, z], { fixture: 'strip', color: '#e8fff0', intensity: 0.8, range: 10 });
}
// Stairwell and roof caps.
m.block([-32, 16, -48], [8, 0.3, 8], 'solid', { material: 'pbr_concrete_dark' });
m.block([-32, 20, -40], [8, 0.3, 8], 'solid', { material: 'pbr_concrete_dark' });
m.block([64, 20, 56], [8, 0.3, 8], 'solid', { material: 'pbr_concrete_dark' });

m.bounds('invisible', 4, { min: [-84, -92], max: [92, 84] }, 36);
m.meta({
  description:
    'A casino boulevard at night, built from the Neon Megacity style pack. Casino-resort fronts line the Strip under neon signs and holographic billboards: the Crimson Ace behind its fountain lake (the lights put on a show every 40 seconds), the Silver Comet with its slot floor, cashier cage, vault behind team-only vault doors and a showroom stage, and its hotel tower up to the Sky Lounge. The Desert Orchid has a pool on its roof, the parking garage a helipad on its, and both towers glass elevators up the outside. Pedestrian bridges cross the Strip, service alleys run round the back, and a monorail beam loops round it all 12 m up, its trains shuttling along every side. Heist the cage and the vault, rescue the hostages from the stage, or fight casino against casino.',
  modes: ['core.bomb', 'core.hostage', 'core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [16, 32],
});
await m.save();
