/**
 * Eagle Spires: a sniper's mountain valley. Tall rock spires and mesas rise
 * out of a forested alpine valley with a river through the middle; every top
 * holds a sniper nest, and the tops are linked by rope bridges, climbed by
 * chains of jump pads over wooden scaffolds, and left by "zipline" pads that
 * throw you back down into the valley (or grab a glider and fly). Our own map.
 *
 * Top-down (x east, z north; metres), point-symmetric about the centre:
 *
 *   z +104            [ TIDE MESA 40 m: ruined lookout tower, flag ]
 *                F3 40 m ====bridge====/      \====bridge==== F4 40 m
 *   z  +58        (scaffold nest)       TIDE CAMP: dropship, hover bikes
 *   z  +38   ~~~~~~~~~~~~~~~~~~~~~~~~~~ north arm ~~~~~~~~~~~~~~~~~~~~~~~~
 *   z    0   CAVE W 32 m ~~~ river ~~~~  EAGLE SPIRE 64 m  ~~~ river ~~~ CAVE E 32 m
 *            (tunnel N-S)                (the Eagle's Nest)              (tunnel N-S)
 *   z  -38   ~~~~~~~~~~~~~~~~~~~~~~~~~~ south arm ~~~~~~~~~~~~~~~~~~~~~~~~
 *   z  -58   EMBERS CAMP: dropship, hover bikes        (scaffold nest)
 *                F2 40 m ====bridge====\      /====bridge==== F1 40 m
 *   z -104            [ EMBERS MESA 40 m: ruined lookout tower, flag ]
 *
 * Climbs: two pad chains up each home mesa (via a scaffold at 20 m), one up
 * each flank spire and cave spire, and a three-stage chain each side up the
 * Eagle Spire (scaffolds at 22 m and 43 m). The river forks round the Eagle
 * Spire's island; six bridges and the riverbed cross it. The two cave spires
 * have a tunnel right through them at valley level (shotguns inside).
 */
import { AIR_PUSH_DECAY, PLAYER, TERRAIN_MATERIALS, TICK_DT, newTerrain, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const m = new MapBuilder('eagle_spires', 'Eagle Spires');
m.theme('ruins');
m.teams([12, 12]);
const [embers, tide] = m.teamIds(2) as [string, string];

// ---------------------------------------------------------------- helpers

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r2 = (n: number) => +n.toFixed(2);
const symAvg = (f: (x: number, z: number) => number) => (x: number, z: number) => (f(x, z) + f(-x, -z)) / 2;
const BASE = -0.15; // terrain sits 15 cm under level 0, so a spire "40 m" high has its top at 39.85

// ---------------------------------------------------------------- spires

interface Spire {
  name: string;
  x: number;
  z: number;
  /** Top height (a tile level: the flat top is 15 cm under it). */
  H: number;
  rt: number;
  rb: number;
  /** Turn of the rock outline (0 or π for the point-symmetric partner), and its own wobble. */
  rot: number;
  ph: number;
  cave?: boolean;
}
const SPIRES: Spire[] = [];
const pair = (s: Omit<Spire, 'rot'>) => {
  SPIRES.push({ ...s, rot: 0 }, { ...s, name: s.name + "'", x: -s.x, z: -s.z, rot: Math.PI });
};
pair({ name: 'homeS', x: 0, z: -104, H: 40, rt: 17, rb: 32, ph: 0.7 });
pair({ name: 'F1', x: 64, z: -64, H: 40, rt: 10, rb: 24, ph: 2.1 });
pair({ name: 'F2', x: -64, z: -64, H: 40, rt: 10, rb: 24, ph: 4.0 });
pair({ name: 'caveW', x: -112, z: 0, H: 32, rt: 10, rb: 24, ph: 1.3, cave: true });
SPIRES.push({ name: 'eagle', x: 0, z: 0, H: 64, rt: 11, rb: 29, rot: 0, ph: 0.4 });
const spire = (name: string) => SPIRES.find((s) => s.name === name)!;
const homeS = spire('homeS');
const homeN = spire("homeS'");
const F1 = spire('F1');
const F3 = spire("F1'");
const F2 = spire('F2');
const F4 = spire("F2'");
const caveW = spire('caveW');
const caveE = spire("caveW'");
const eagle = spire('eagle');

/** Outline wobble: the eagle spire is its own partner, so its wobble is point-symmetric too. */
const wob = (s: Spire, a: number) => {
  const b = a + s.rot;
  const w = 0.07 * Math.sin(3 * b + s.ph) + 0.04 * Math.sin(5 * b + 2 * s.ph);
  const w2 = 0.07 * Math.sin(3 * (b + Math.PI) + s.ph) + 0.04 * Math.sin(5 * (b + Math.PI) + 2 * s.ph);
  return 1 + (s.name === 'eagle' ? (w + w2) / 2 + 0.05 * Math.sin(2 * b + 1) : w);
};
const spireH = (s: Spire, x: number, z: number) => {
  const d = Math.hypot(x - s.x, z - s.z);
  if (d > s.rb * 1.2 + 2) return 0;
  const a = Math.atan2(z - s.z, x - s.x);
  return s.H * (1 - smooth(s.rt, s.rb, d / wob(s, a)));
};
/** Radius at angle `a` where the spire stands `h` high. */
const radiusAt = (s: Spire, h: number, a: number) => {
  const want = 1 - h / s.H;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (mid * mid * (3 - 2 * mid) < want) lo = mid;
    else hi = mid;
  }
  return (s.rt + lo * (s.rb - s.rt)) * wob(s, a);
};
const at = (s: Spire, a: number, r: number): P2 => [s.x + Math.cos(a) * r, s.z + Math.sin(a) * r];
const deg = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------- the valley and the river

/** River boxes [x0, z0, x1, z1]: a channel from the west cave spire, forking round the island, on to the east one. */
const RIVER: [number, number, number, number][] = [
  [-87, -5, -47, 5],
  [-47, -43, -37, 43],
  [-37, 33, 37, 43],
  [-37, -43, 37, -33],
  [37, -43, 47, 43],
  [47, -5, 87, 5],
];
const boxDist = (x: number, z: number, [x0, z0, x1, z1]: [number, number, number, number]) => {
  const dx = Math.max(x0 - x, x - x1);
  const dz = Math.max(z0 - z, z - z1);
  return dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz);
};
const riverD = (x: number, z: number) => Math.min(...RIVER.map((b) => boxDist(x, z, b)));
const BED = -2.2;
const WATER_TOP = -0.6; // actual height of the river surface

const CAMP = { x: 24, z0: -68, z1: -47 };
const campW = (x: number, z: number) => {
  const f = (zz: number, xx: number) => (1 - smooth(0, 8, Math.max(Math.abs(xx) - CAMP.x, 0))) * (1 - smooth(0, 8, Math.max(CAMP.z0 - zz, zz - CAMP.z1, 0)));
  return Math.max(f(z, x), f(-z, -x));
};
const rolling = symAvg((x, z) => 1.0 * Math.sin(x / 23 + 0.3) * Math.cos(z / 19) + 0.7 * Math.sin((x + z) / 31 + 1.1) + 0.35 * Math.cos(x / 9 - z / 13));
const rim = symAvg((x, z) => {
  const e = Math.max(Math.abs(x), Math.abs(z));
  const a = Math.atan2(z, x);
  return smooth(126, 150, e) * (24 + 5 * Math.sin(a * 5) + 3 * Math.cos(a * 11 + 1));
});
function valley(x: number, z: number): number {
  const rd = riverD(x, z);
  let h = Math.max(0, rolling(x, z) + 0.5) * smooth(4, 14, rd) * (1 - campW(x, z));
  h = lerp(BED, h, smooth(-3.5, 0.5, rd));
  return h + rim(x, z);
}
/** Tunnel slot through a cave spire (along z at the spire's x). */
const SLOT = 4.2;
const inSlot = (s: Spire, x: number, z: number) => !!s.cave && Math.abs(x - s.x) <= SLOT && Math.abs(z - s.z) < s.rb * 1.25;
function heightRel(x: number, z: number): number {
  let h = valley(x, z);
  for (const s of SPIRES) {
    if (inSlot(s, x, z)) return Math.min(h, 0);
    h = Math.max(h, spireH(s, x, z));
  }
  return h;
}

let terrain: TerrainData = { ...newTerrain(300, 2, [0, 0], 'grass'), baseY: BASE };
const vx = (i: number) => terrain.origin[0] + (i % terrain.cols) * terrain.spacing;
const vz = (i: number) => terrain.origin[1] + Math.floor(i / terrain.cols) * terrain.spacing;
terrain = { ...terrain, heights: terrain.heights.map((_, i) => Math.round(heightRel(vx(i), vz(i)) * 100)) };

// Trails (south half; each also laid turned 180°).
const TRAILS: P2[][] = [
  [[0, -66], [0, -48], [0, -30]], // camp to the south bridge and the island
  [[-20, -58], [-56, -40], [-92, -30], [-112, -26]], // to the west cave
  [[20, -56], [50, -30], [62, -14], [66, -8]], // to the east bridge
  [[-31, 0], [-34, -14], [-42, -18], [-52, -18], [-66, -10]], // island to the west bridges
];
const segDist = (x: number, z: number, [ax, az]: P2, [bx, bz]: P2) => {
  const ux = bx - ax;
  const uz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / (ux * ux + uz * uz)));
  return Math.hypot(x - ax - ux * t, z - az - uz * t);
};
const lineDist = (x: number, z: number, l: P2[]) => Math.min(...l.slice(1).map((b, i) => segDist(x, z, l[i]!, b)));
const trailD = (x: number, z: number) => Math.min(...TRAILS.map((l) => Math.min(lineDist(x, z, l), lineDist(-x, -z, l))));
const maxSpire = (x: number, z: number) => Math.max(...SPIRES.map((s) => spireH(s, x, z)));

const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
const cx = (i: number) => terrain.origin[0] + ((i % (terrain.cols - 1)) + 0.5) * terrain.spacing;
const cz = (i: number) => terrain.origin[1] + (Math.floor(i / (terrain.cols - 1)) + 0.5) * terrain.spacing;
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const [x, z] = [cx(i), cz(i)];
    const sp = maxSpire(x, z);
    if (SPIRES.some((s) => inSlot(s, x, z) && spireH(s, x, z) > 1)) return mat('gravel');
    if (sp > 56) return mat('snow');
    if (SPIRES.some((s) => spireH(s, x, z) > s.H - 0.5)) return mat(sp > 35 ? 'gravel' : 'dirt');
    if (riverD(x, z) < 1.5) return mat('gravel');
    if (campW(x, z) > 0.6) return mat('gravel');
    if (trailD(x, z) < 2) return mat('dirt');
    if (rim(x, z) > 10) return mat('stone');
    if (sp > 3 || rim(x, z) > 3) return mat('moss');
    return v;
  }),
};
terrain = paintSlopes(terrain, 38, 'stone');
terrain = {
  ...terrain,
  foliage: terrain.materials.map((v, i) => {
    const name = TERRAIN_MATERIALS[v];
    if (name === 'moss') return 1;
    if (name !== 'grass') return 0;
    const [x, z] = [cx(i), cz(i)];
    if (trailD(x, z) < 4) return 1;
    if (riverD(x, z) < 6) return 4;
    return 3;
  }),
};
m.terrain(terrain);
const ground = (x: number, z: number) => r2(terrainHeightAt(terrain, x, z) ?? 0);

// The river: water boxes over the channel (floor under the bed, surface at WATER_TOP).
for (const [x0, z0, x1, z1] of RIVER) m.water([(x0 + x1) / 2, BASE + BED - 0.3, (z0 + z1) / 2], [x1 - x0, WATER_TOP - (BASE + BED - 0.3), z1 - z0], 'water');

// ---------------------------------------------------------------- blocks (tracked for the pad-flight checks)

interface SolidBox { x: number; z: number; y0: number; y1: number; w: number; d: number; yaw: number }
const solids: SolidBox[] = [];
const block = (pos: V3, size: V3, material: string, yaw = 0) => {
  m.block([r2(pos[0]), r2(pos[1]), r2(pos[2])], [r2(size[0]), r2(size[1]), r2(size[2])], 'solid', { material, yaw: +yaw.toFixed(4), respawn: null });
  solids.push({ x: pos[0], z: pos[2], y0: pos[1], y1: pos[1] + size[1], w: size[0], d: size[2], yaw });
};
const inBox = (b: SolidBox, x: number, z: number, pad: number) => {
  const dx = x - b.x;
  const dz = z - b.z;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= b.w / 2 + pad && Math.abs(lz) <= b.d / 2 + pad;
};

// ---------------------------------------------------------------- cave tunnels

for (const s of [caveW, caveE]) {
  const top = s.H + BASE;
  // Fill the slot over the tunnel in 2 m tiers, each as far along as the rock either side stands that high.
  const side = (z: number) => Math.min(terrainHeightAt(terrain, s.x - 6.5, z) ?? 0, terrainHeightAt(terrain, s.x + 6.5, z) ?? 0);
  for (let y0 = 4.6; y0 < top - 0.01; y0 += 2) {
    const y1 = Math.min(y0 + 2, top);
    let n = 0;
    while (n < 40 && side(s.z + n + 0.5) >= y1 - 0.4) n += 0.5;
    let sN = 0;
    while (sN < 40 && side(s.z - sN - 0.5) >= y1 - 0.4) sN += 0.5;
    if (n + sN < 1) continue;
    block([s.x, y0, s.z + (n - sN) / 2], [12.6, y1 - y0, n + sN], 'pbr_rock');
  }
  // Torches along the tunnel walls and a warm glow.
  for (const z of [-14, -5, 5, 14]) {
    const wx = s.x + (z > 0 ? 3.2 : -3.2) * (s.x > 0 ? 1 : -1);
    m.prop('sv_torch_stand', [r2(wx), ground(wx, s.z + z), s.z + z], 0);
    m.light([s.x, 3.6, s.z + z], { fixture: 'none', color: '#ffb066', intensity: 1.6, range: 12 });
  }
}

// ---------------------------------------------------------------- pads: flights checked against the rock and the blocks

const flightPush = (from: V3, to: V3, power: number): number | null => {
  const want = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const fly = (push: number) => {
    let y = from[1];
    let vy = power;
    let v = push;
    let d = 0;
    for (let t = 0; t < 8; t += TICK_DT) {
      d += v * TICK_DT;
      y += vy * TICK_DT;
      vy -= PLAYER.gravity * TICK_DT;
      v *= AIR_PUSH_DECAY;
      if (vy < 0 && y <= to[1]) return d;
    }
    return null;
  };
  if (fly(0) === null) return null;
  let lo = 0;
  let hi = 80;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if ((fly(mid) ?? Infinity) < want) lo = mid;
    else hi = mid;
  }
  return lo <= 40 ? lo : null;
};
/** Fly the launch tick by tick: clear of the rock and every block until it comes down within 2 m of `to`. */
const flightClear = (from: V3, to: V3, power: number, push: number): boolean => {
  const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
  let x = from[0];
  let y = from[1] + 0.05;
  let z = from[2];
  let vy = power;
  let vxp = Math.sin(yaw) * push;
  let vzp = Math.cos(yaw) * push;
  for (let t = 0; t < 8; t += TICK_DT) {
    x += vxp * TICK_DT;
    y += vy * TICK_DT;
    z += vzp * TICK_DT;
    vy -= PLAYER.gravity * TICK_DT;
    vxp *= AIR_PUSH_DECAY;
    vzp *= AIR_PUSH_DECAY;
    let floor = terrainHeightAt(terrain, x, z) ?? -50;
    for (const b of solids) if (b.y1 <= y + 0.3 && inBox(b, x, z, 0) && b.y1 > floor) floor = b.y1;
    if (vy < 0 && y <= floor) return Math.hypot(x - to[0], z - to[2]) < 2 && Math.abs(floor - to[1]) < 0.6;
    if (t < 0.15) continue;
    for (const [ox, oz] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45], [0, 0]]) {
      if (y < (terrainHeightAt(terrain, x + ox!, z + oz!) ?? -50) - 0.3) return false;
    }
    for (const b of solids) if (inBox(b, x, z, 0.45) && y < b.y1 - 0.3 && y + 1.9 > b.y0) return false;
  }
  return false;
};
const pads: V3[] = [];
const landings: V3[] = [];
const pad = (from: V3, to: V3, minPower = 4) => {
  const need = Math.sqrt(2 * PLAYER.gravity * Math.max(0, to[1] - from[1] + 1));
  for (let power = Math.max(minPower, Math.ceil(need)); power <= 40; power++) {
    const push = flightPush(from, to, power);
    if (push === null || !flightClear(from, to, power, push)) continue;
    m.pad([r2(from[0]), r2(from[1]), r2(from[2])], +Math.atan2(to[0] - from[0], to[2] - from[2]).toFixed(4), power, r2(push));
    pads.push(from);
    landings.push(to);
    return;
  }
  throw new Error(`eagle_spires: no clear pad flight from ${from.map(r2)} to ${to.map(r2)}`);
};

/** A plank scaffold deck hung on spire `s` at angle `a`, its top at `h`: returns its frame. */
function scaffold(s: Spire, a: number, h: number) {
  const u: P2 = [Math.cos(a), Math.sin(a)];
  const v: P2 = [-u[1], u[0]];
  // Inner edge: where the rock stands no higher than the deck all along its width.
  let r0 = radiusAt(s, h, a);
  const clear = (r: number) => [-3.5, -1.75, 0, 1.75, 3.5].every((t) => (terrainHeightAt(terrain, s.x + u[0] * r + v[0] * t, s.z + u[1] * r + v[1] * t) ?? 0) <= h - 0.05);
  for (let n = 0; n < 60 && !clear(r0 + 0.5); n++) r0 += 0.25;
  const p = (r: number, t: number): V3 => [s.x + u[0] * r + v[0] * t, h, s.z + u[1] * r + v[1] * t];
  const yaw = Math.atan2(u[0], u[1]);
  const c = p(r0 + 2.5, 0);
  block([c[0], h - 0.35, c[2]], [7, 0.35, 8], 'pbr_planks', yaw);
  // Posts down to the rock under the outer corners, and a beam back into the cliff.
  for (const t of [-3.1, 3.1]) {
    const q = p(r0 + 6.1, t);
    const g = terrainHeightAt(terrain, q[0], q[2]) ?? 0;
    const len = Math.min(32, h - 0.35 - g + 0.3);
    if (len > 0.5) block([q[0], h - 0.35 - len, q[2]], [0.35, len, 0.35], 'pbr_walnut', yaw);
  }
  return { landing: p(r0 + 2.5, -1.6), launch: p(r0 + 5, 2), r0 };
}
/** Top landing spot on a spire, `back` m in from the edge of its flat top. */
const topSpot = (s: Spire, a: number, back = 2.5): V3 => {
  const [x, z] = at(s, a, s.rt * 0.89 - back);
  return [x, s.H + BASE, z];
};
/** The foot of a climb: just outside the spire's skirt. */
const footSpot = (s: Spire, a: number, out = 3): V3 => {
  const [x, z] = at(s, a, s.rb * wob(s, a) + out);
  return [x, ground(x, z), z];
};
/** A chain of pads from the valley up spire `s`: scaffold stages at `stages` (angle, height), then the top. */
function climb(s: Spire, a0: number, stages: [number, number][], topA: number) {
  let from = footSpot(s, a0);
  for (const [a, h] of stages) {
    const sc = scaffold(s, a, h);
    pad(from, sc.landing);
    from = sc.launch;
  }
  pad(from, topSpot(s, topA));
}

// ---------------------------------------------------------------- bridges between the tops

function bridge(a: Spire, b: Spire) {
  const ang = Math.atan2(b.z - a.z, b.x - a.x);
  const [ax, az] = at(a, ang, a.rt * 0.89 - 2);
  const [bx, bz] = at(b, ang + Math.PI, b.rt * 0.89 - 2);
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bx - ax, bz - az);
  const top = a.H + BASE + 0.1;
  const mid: P2 = [(ax + bx) / 2, (az + bz) / 2];
  block([mid[0], top - 0.3, mid[1]], [3.2, 0.3, len], 'pbr_planks', yaw);
  const side: P2 = [Math.cos(yaw), -Math.sin(yaw)];
  for (const k of [-1.5, 1.5]) {
    // Rope hand lines and posts every 6 m.
    block([mid[0] + side[0] * k, top + 0.95, mid[1] + side[1] * k], [0.2, 0.1, len], 'pbr_walnut', yaw);
    const n = Math.max(2, Math.round(len / 6));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (len * i) / n;
      block([mid[0] + side[0] * k + Math.sin(yaw) * t, top, mid[1] + side[1] * k + Math.cos(yaw) * t], [0.2, 1.0, 0.2], 'pbr_walnut', yaw);
    }
  }
}
bridge(homeS, F1);
bridge(homeS, F2);
bridge(homeN, F3);
bridge(homeN, F4);

// River crossings: plank bridges flush with the banks.
const footbridge = (x: number, z: number, along: 'x' | 'z', len: number) => block([x, BASE - 0.15, z], along === 'z' ? [4, 0.3, len] : [len, 0.3, 4], 'pbr_planks');
footbridge(0, -38, 'z', 18);
footbridge(0, 38, 'z', 18);
footbridge(-66, 0, 'z', 20);
footbridge(66, 0, 'z', 20);
footbridge(-42, -18, 'x', 16);
footbridge(42, 18, 'x', 16);

// ---------------------------------------------------------------- tops: towers, nests and the eagle's nest

// Home mesas: a ruined two-storey lookout (a room with broken walls, a stairwell to a railed roof).
function lookout(s: 1 | -1) {
  const y = s * 13;
  m.tile('room', 0, y, 10);
  m.tile('stairwell', -s, y, 10, s < 0 ? 0 : 2);
  m.tile('platform_rail', 0, y, 11);
  m.edge(0, y, 10, s < 0 ? 'S' : 'N', 'broken');
  m.edge(0, y, 10, s < 0 ? 'N' : 'S', 'slit');
  m.edge(0, y, 10, s < 0 ? 'W' : 'E', 'arch');
}
lookout(-1);
lookout(1);

// Flank spires: a plank sniper nest on stilts, a ladder up its open side.
function nest(s: Spire) {
  const g = s.H + BASE;
  const top = g + 6.15;
  const f = s.z < 0 ? 1 : -1; // open side faces the valley
  for (const [dx, dz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]] as const) block([s.x + dx, g - 0.2, s.z + dz], [0.3, top - 0.35 - g + 0.2, 0.3], 'pbr_walnut');
  block([s.x, top - 0.35, s.z], [4.4, 0.35, 4.4], 'pbr_planks');
  // Waist-high plank walls on three sides.
  block([s.x, top, s.z - f * 2.1], [4.4, 1.1, 0.2], 'pbr_planks');
  block([s.x - 2.1, top, s.z], [0.2, 1.1, 4.4], 'pbr_planks');
  block([s.x + 2.1, top, s.z], [0.2, 1.1, 4.4], 'pbr_planks');
  block([s.x, g - 0.2, s.z + f * 2.25], [1.0, top - g + 0.2, 0.2], 'pbr_planks');
  m.add({ kind: 'ladder', position: [s.x, r2(g), r2(s.z + f * 2.45)], yaw: f > 0 ? 0 : Math.PI, height: r2(top - g), width: 0.9 });
  return top;
}
const nestTops = [F1, F2, F3, F4].map((s) => [s, nest(s)] as const);

// Cave spires: an open watchtower; the Eagle Spire: a walled nest with arches and slits.
m.tile('tower', -14, 0, 8, 0).tile('tower', 14, 0, 8, 2);
for (const [x, open, half] of [[-14, ['E', 'S'], ['N', 'W']], [14, ['W', 'N'], ['S', 'E']]] as const) {
  for (const side of open) m.edge(x, 0, 8, side, 'open');
  for (const side of half) m.edge(x, 0, 8, side, 'half');
}
m.tile('room', 0, 0, 16);
m.edge(0, 0, 16, 'N', 'arch').edge(0, 0, 16, 'S', 'arch').edge(0, 0, 16, 'E', 'slit').edge(0, 0, 16, 'W', 'slit');

// ---------------------------------------------------------------- climbs (south half, then turned 180°)

const climbs = (flip: boolean) => {
  const S = (s: Spire) => (flip ? spire(s.name.endsWith("'") ? s.name.slice(0, -1) : `${s.name}'`) : s);
  const A = (d: number) => deg(d) + (flip ? Math.PI : 0);
  // Home mesa: two routes from the camp side, via a scaffold at 20 m.
  climb(S(homeS), A(62), [[A(62), 20]], A(62));
  climb(S(homeS), A(118), [[A(118), 20]], A(118));
  // Flank spires: one route each, from the camp side, via a scaffold at 20 m.
  climb(S(F1), A(165), [[A(165), 20]], A(165));
  climb(S(F2), A(15), [[A(15), 20]], A(15));
  // Cave spire: from the south-east, via a scaffold at 16 m.
  climb(S(caveW), A(-30), [[A(-30), 16]], A(-30));
};
climbs(false);
climbs(true);
// The Eagle Spire: from the island's east and west ends, scaffolds at 22 m and 43 m.
for (const k of [0, 180]) climb(eagle, deg(k), [[deg(k), 22], [deg(k + 62), 43]], deg(k + 118));

// Ziplines: pads on the tops that throw you back down into the valley.
const zip = (s: Spire, a: number, to: P2, back = 2.5) => pad(topSpot(s, a, back), [to[0], ground(to[0], to[1]), to[1]], 3);
for (const f of [1, -1] as const) {
  zip(f > 0 ? homeS : homeN, deg(90) + (f > 0 ? 0 : Math.PI), [f * -32, f * -50], 3);
  zip(f > 0 ? F1 : F3, deg(100) + (f > 0 ? 0 : Math.PI), [f * 54, f * -28]);
  zip(f > 0 ? F2 : F4, deg(80) + (f > 0 ? 0 : Math.PI), [f * -54, f * -28]);
  zip(f > 0 ? caveW : caveE, deg(40) + (f > 0 ? 0 : Math.PI), [f * -84, f * 20]);
  zip(eagle, deg(250) + (f > 0 ? 0 : Math.PI), [f * 14, f * -47], 2);
}

// ---------------------------------------------------------------- camps, spawns and vehicles

const pt = (s: 1 | -1, x: number, z: number): V3 => [s * x, ground(s * x, s * z), s * z];

for (const [team, s] of [[embers, 1], [tide, -1]] as const) {
  const face = s > 0 ? 0 : Math.PI;
  // Camp spawns, first, then two on the mesa top.
  for (const [x, z] of [[-18, -64], [-6, -64], [6, -64], [18, -64], [-18, -58], [-6, -58], [6, -58], [18, -58]] as const) m.spawn(pt(s, x, z), face, team);
  for (const [x, z] of [[-11, -98], [4, -112]] as const) m.spawn([s * x, homeS.H + BASE, s * z], face, team);
  m.mount('dropship', pt(s, -12, -51), face, team);
  m.mount('hover_bike', pt(s, 8, -53), face, team);
  m.mount('hover_bike', pt(s, 14, -53), face, team);
  m.flag(team, [s * -9, homeS.H + BASE, s * -105], face);
  // Camp dressing: tents along the back, crates, a fire.
  for (const x of [-24, 12, 24]) m.prop('tent_canvas', pt(s, x, -67), face);
  m.prop('campfire', pt(s, 0, -60)).prop('crate_large', pt(s, 24, -58), face + 0.3).prop('crate_small', pt(s, 24.5, -60.2)).prop('barrel', pt(s, -24, -58)).prop('barrel', pt(s, -24.6, -59.2));
  m.prop('wood_support', pt(s, -25, -50), face + Math.PI / 2).prop('lantern', pt(s, 1.2, -61.6));
  m.light([0, 1.2, s * -60], { fixture: 'none', color: '#ff9a4a', intensity: 1.5, range: 10 });
  // Camp kit.
  m.pickup('weapon_rifle', pt(s, -12, -61)).pickup('weapon_smg', pt(s, 12, -61)).pickup('ammo_rifle', pt(s, 0, -64)).pickup('health_small', pt(s, 0, -55));
  m.pickup('grenades', pt(s, -22, -53)).pickup('armor_small', pt(s, 22, -53));
  // Mesa top: sniper kit and a glider; marksman rifle on the lookout's roof.
  m.pickup('weapon_sniper', [s * -2, homeS.H + BASE, s * -96.5]).pickup('ammo_sniper', [s * -6, homeS.H + BASE, s * -113]).pickup('glider', [s * 8, homeS.H + BASE, s * -112]);
  m.pickup('health_small', [s * -12, homeS.H + BASE, s * -104]);
  m.pickup('weapon_marksman', [0, 44, s * -104]).pickup('ammo_sniper', [s * 2, 40, s * -104]);
}
// Flank nests: marksman rifles up top, gliders by the ladders.
for (const [s, top] of nestTops) {
  const f = s.z < 0 ? 1 : -1;
  m.pickup(s.x * s.z < 0 ? 'weapon_marksman' : 'weapon_sniper', [s.x, r2(top), s.z]);
  m.pickup('glider', [r2(s.x + 4.2 * Math.sign(s.x)), s.H + BASE, r2(s.z - 3 * f)]);
}
// Cave spire tops: sniper rifle, glider; caves: shotguns.
for (const [s, f] of [[caveW, 1], [caveE, -1]] as const) {
  const g = s.H + BASE;
  m.pickup('weapon_sniper', [s.x + f * 0.5, g, s.z - f * 6.5]).pickup('glider', [s.x - f * 5, g, s.z - f * 3.6]).pickup('armor_small', [s.x - f * 1.5, g, s.z + f * 6]);
  m.pickup('weapon_shotgun', [s.x, BASE, s.z - f * 6]).pickup('weapon_auto_shotgun', [s.x, BASE, s.z + f * 6]).pickup('ammo_shells', [s.x + f * 2, BASE, s.z]);
  m.pickup('health_large', [s.x - f * 2, BASE, s.z + f * 14]);
  m.spawn([s.x, ground(s.x, s.z - f * 12), s.z - f * 12], f > 0 ? 0 : Math.PI);
}
// The Eagle's Nest: the railgun and gliders.
m.pickup('weapon_railgun', [0, 64, 0]).pickup('ammo_cells', [2, 64, -2]).pickup('glider', [r2(6.5 * Math.cos(deg(-20))), eagle.H + BASE, r2(6.5 * Math.sin(deg(-20)))]).pickup('glider', [r2(-6.5 * Math.cos(deg(-20))), eagle.H + BASE, r2(-6.5 * Math.sin(deg(-20)))]);
m.pickup('health_large', [-2, 64, 2]);

// Valley pickups and roaming spawns (point-symmetric pairs).
const field: [string, number, number][] = [
  ['weapon_rockets', 30, 26],
  ['weapon_launcher', -30, -26],
  ['armor_large', -22, 24],
  ['powerup_damage', 22, -24],
  ['weapon_lmg', 92, -60],
  ['weapon_lmg', -92, 60],
  ['weapon_marksman', -60, -18],
  ['weapon_marksman', 60, 18],
  ['health_large', 100, -36],
  ['health_large', -100, 36],
  ['ammo_explosive', -36, -76],
  ['ammo_explosive', 36, 76],
  ['ammo_sniper', 78, -24],
  ['ammo_sniper', -78, 24],
  ['health_small', -66, -28],
  ['health_small', 66, 28],
  ['armor_small', 100, 80],
  ['armor_small', -100, -80],
  ['weapon_rifle', -96, -100],
  ['weapon_rifle', 96, 100],
  ['mines', 40, -104],
  ['mines', -40, 104],
];
for (const [item, x, z] of field) m.pickup(item, [x, ground(x, z), z]);
for (const [x, z] of [[0, -29.5], [0, 29.5], [-60, 22], [60, -22], [-96, -68], [96, 68]] as const) m.spawn([x, ground(x, z), z], Math.atan2(-x, -z));
// Two hover bikes by the cave spires.
m.mount('hover_bike', [-92, ground(-92, 34), 34], Math.PI / 2).mount('hover_bike', [92, ground(92, -34), -34], -Math.PI / 2);

// King of the Hill: the Eagle's Nest, then the cave spire tops.
m.hill([0, 64, 0], 8).hill([caveW.x, caveW.H + BASE, 0], 6).hill([caveE.x, caveE.H + BASE, 0], 6);

// ---------------------------------------------------------------- forest, bushes and rocks

let seed = 0xea61e;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const keep: [number, number, number][] = [
  ...pads.map((p) => [p[0], p[2], 7] as [number, number, number]),
  ...landings.map((p) => [p[0], p[2], 5] as [number, number, number]),
  ...m.doc.entities.filter((e) => e.kind !== 'prop' && e.kind !== 'block' && e.kind !== 'water' && e.kind !== 'light').map((e) => [e.position[0], e.position[2], 4] as [number, number, number]),
];
const placed: [number, number, number][] = [];
const okAt = (x: number, z: number, r: number) =>
  Math.abs(x) < 140 &&
  Math.abs(z) < 140 &&
  maxSpire(x, z) < 0.4 &&
  rim(x, z) < 1.5 &&
  riverD(x, z) > 3 + r &&
  campW(x, z) < 0.05 &&
  trailD(x, z) > 3 + r &&
  !solids.some((b) => b.y0 < 2 && inBox(b, x, z, 2 + r)) &&
  keep.every(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) > kr + r) &&
  placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > pr + r + 1);
const plant = (model: string, x: number, z: number, scale: number, r: number, solid = true, sink = 0.1) => {
  placed.push([x, z, r]);
  m.prop(model, [r2(x), r2(ground(x, z) - sink), r2(z)], +(rand() * 6.28).toFixed(2), +scale.toFixed(2), solid);
};
// Pine woods in clumps (mirrored), broadleaves on the low ground.
const WOODS: P2[] = [[-92, -48], [-40, -86], [96, -96], [-76, 76], [-20, 56], [106, 40], [36, 92], [-120, -100], [70, 0]];
for (const [wx, wz] of WOODS) {
  for (let k = 0; k < 40; k++) {
    const x = wx + (rand() - 0.5) * 34;
    const z = wz + (rand() - 0.5) * 34;
    const pick = rand();
    const [model, scale] = pick < 0.45 ? ['nt_pine_tall', 1 + rand() * 0.5] : pick < 0.75 ? ['pine_tall', 0.9 + rand() * 0.4] : pick < 0.9 ? ['nt_pine_small', 1 + rand() * 0.4] : ['nt_common_tree', 0.9 + rand() * 0.3];
    if (!okAt(x, z, 1.2) || !okAt(-x, -z, 1.2)) continue;
    plant(model as string, x, z, scale as number, 1.2);
    plant(model as string, -x, -z, scale as number, 1.2);
  }
}
// Bushes to hide in: round the woods and along the river.
for (let k = 0; k < 900 && placed.length < 420; k++) {
  const near = rand() < 0.5;
  const [wx, wz] = WOODS[Math.floor(rand() * WOODS.length)]!;
  const x = near ? wx + (rand() - 0.5) * 50 : (rand() - 0.5) * 240;
  const z = near ? wz + (rand() - 0.5) * 50 : (rand() - 0.5) * 240;
  if (!near && riverD(x, z) > 12) continue;
  if (!okAt(x, z, 0.8) || !okAt(-x, -z, 0.8)) continue;
  const pick = rand();
  const model = pick < 0.45 ? 'nt_bush_leafy' : pick < 0.75 ? 'bush_large' : 'nt_fern_wide';
  const scale = model === 'nt_bush_leafy' ? 1.4 + rand() * 0.4 : model === 'bush_large' ? 1 + rand() * 0.3 : 1.2 + rand() * 0.4;
  plant(model, x, z, scale, 0.8, false, 0.05);
  plant(model, -x, -z, scale, 0.8, false, 0.05);
}
// Boulders at the spire feet and in the valley.
for (let k = 0; k < 600 && placed.length < 520; k++) {
  const x = (rand() - 0.5) * 260;
  const z = (rand() - 0.5) * 260;
  if (!okAt(x, z, 1.6) || !okAt(-x, -z, 1.6)) continue;
  const nearSpire = SPIRES.some((s) => {
    const d = Math.hypot(x - s.x, z - s.z);
    return d > s.rb * 1.12 && d < s.rb * 1.12 + 10;
  });
  if (!nearSpire && rand() < 0.6) continue;
  const model = rand() < 0.5 ? 'nt_boulder' : rand() < 0.5 ? 'rock_large' : 'boulder_jagged';
  const scale = model === 'boulder_jagged' ? 0.6 + rand() * 0.4 : 1.2 + rand() * 1.2;
  plant(model, x, z, scale, 1.6, true, 0.3);
  plant(model, -x, -z, scale, 1.6, true, 0.3);
}
// Logs and stumps.
for (let k = 0; k < 300 && placed.length < 580; k++) {
  const x = (rand() - 0.5) * 240;
  const z = (rand() - 0.5) * 240;
  if (!okAt(x, z, 1) || !okAt(-x, -z, 1)) continue;
  const model = rand() < 0.5 ? 'nt_log_large' : 'stump';
  plant(model, x, z, 1.2, 1, true, 0.05);
  plant(model, -x, -z, 1.2, 1, true, 0.05);
}

// ---------------------------------------------------------------- map settings

// Every round starts in a transport plane looping high over the valley: jump out and parachute in.
m.add({ kind: 'airplane', position: [0, 0, 0], route: [[0, -118], [104, -60], [104, 60], [0, 118], [-104, 60], [-104, -60]], altitude: 105, loopSeconds: 60, closed: true, airdrop: 'start' });
m.backdrop('clear', 'peaks', 'grass', 0.22, 0.5);
m.bounds('invisible', 0, { min: [-149, -149], max: [149, 149] }, 12);
await m.fillTeamSpawns(12);
m.meta({
  description:
    'A sniper’s alpine valley. Embers and Tide each hold a 40 m mesa with a ruined lookout tower and their flag, roped by plank bridges to two flank spires with stilted sniper nests. Jump-pad chains climb every top over wooden scaffolds, zipline pads throw you back down, and gliders wait on the peaks; every round starts with a parachute drop from a transport plane. The 64 m Eagle Spire holds the railgun over a river island, two cave spires have shotgun tunnels right through them, and dropships and hover bikes wait in the forested, misty valley.',
  modes: ['core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch', 'core.elim'],
  players: [12, 24],
});
await m.save();
