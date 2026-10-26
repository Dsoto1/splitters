/**
 * Sunstone Crag: a giant stepped pyramid in the desert, a king-of-the-hill
 * mountain to fight up. Seven sandstone tiers climb to a summit platform with
 * a beacon (the main hill); flights of steps zigzag up every face, jump pads
 * throw you from the sand to the third terrace and from the fourth to the
 * summit, and sand drifts against two corners let vehicles onto the first
 * terrace. Inside: four tunnels to a ring of catacombs round the tomb (a
 * lava pit with a crumbling walkway to the sarcophagus and its double
 * damage), and on the third tier the treasure vault with the railgun.
 * Around it: dunes, an avenue of obelisks to each team camp, ruined temples,
 * two oases and sand traps that give way under you. Our own map.
 *
 * Top-down (x east, z north; metres), point-symmetric about the centre:
 *
 *   z +100                     ~~ north oasis ~~
 *   z  +62   ruined temple                         ruin field
 *   z   +9   EMBERS CAMP  ob  ob  ob  [ PYRAMID ±40, 28 m ]  ob  ob  ob  TIDE CAMP
 *   z   -9   (x -104)      the avenue          the avenue           (x +104)
 *   z  -62   ruin field                          ruined temple
 *   z -100                     ~~ south oasis ~~
 *
 * Pyramid tiers (top, half-width): 4/40, 8/34, 12/28, 16/22, 20/16, 24/11, 28/6.
 */
import { AIR_PUSH_DECAY, PLAYER, TERRAIN_MATERIALS, TICK_DT, newTerrain, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type P2 = [number, number];
type Rect = [number, number, number, number]; // x0, z0, x1, z1
const m = new MapBuilder('sunstone_crag', 'Sunstone Crag');
m.theme('tomb');
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
const BASE = -0.15;
const boxDist = (x: number, z: number, [x0, z0, x1, z1]: Rect) => {
  const dx = Math.max(x0 - x, x - x1);
  const dz = Math.max(z0 - z, z - z1);
  return dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz);
};

/** Face f of the pyramid (0 north, 1 east, 2 south, 3 west): `u` out along its normal, `v` along it. */
const face = (f: number, u: number, v: number): P2 => {
  let p: P2 = [v, u];
  for (let i = 0; i < f; i++) p = [p[1], -p[0]];
  return p;
};
const faceRect = (f: number, u0: number, u1: number, v0: number, v1: number): Rect => {
  const a = face(f, u0, v0);
  const b = face(f, u1, v1);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
};

// ---------------------------------------------------------------- terrain

const PLAZA = 52;
const CAMP: Rect = [-124, -20, -86, 20];
const OASIS: Rect = [-9, -106, 9, -94];
const TRAPS: P2[] = [[-74, -30], [-38, -74], [-80, 40]];
const RUINS: P2[] = [[62, -62], [-62, -62]]; // temple (and its turn), ruin field (and its turn)
const DRIFT: P2 = [40, 40]; // and (-40, -40)

const both = <T,>(f: (x: number, z: number) => T) => (x: number, z: number) => [f(x, z), f(-x, -z)] as const;
const campW = (x: number, z: number) => Math.max(...both((x, z) => 1 - smooth(0, 10, Math.max(boxDist(x, z, CAMP), 0)))(x, z));
const oasisD = (x: number, z: number) => Math.min(...both((x, z) => boxDist(x, z, OASIS))(x, z));
const trapD = (x: number, z: number) => Math.min(...TRAPS.flatMap(([tx, tz]) => [Math.max(Math.abs(x - tx), Math.abs(z - tz)), Math.max(Math.abs(x + tx), Math.abs(z + tz))]));
const ruinD = (x: number, z: number) => Math.min(...RUINS.flatMap(([rx, rz]) => [Math.hypot(x - rx, z - rz), Math.hypot(x + rx, z + rz)]));
const avenueW = (x: number, z: number) => (1 - smooth(10, 20, Math.abs(z))) * smooth(30, 44, Math.abs(x));
const dunes = symAvg((x, z) => {
  const ridge = 1 - Math.abs(Math.sin((x * 0.8 + z * 0.6) / 19 + 0.7 * Math.sin(z / 41)));
  return 5 * ridge ** 1.6 + 1.6 * Math.sin(x / 27 + 1) * Math.cos(z / 33) + 1.2 * Math.sin((x - z) / 45) + 1.8;
});
const rim = symAvg((x, z) => {
  const e = Math.max(Math.abs(x), Math.abs(z));
  return smooth(124, 150, e) * (14 + 4 * Math.sin(Math.atan2(z, x) * 6));
});
const flatMask = (x: number, z: number) => {
  const e = Math.max(Math.abs(x), Math.abs(z));
  let k = smooth(PLAZA, PLAZA + 18, e);
  k *= 1 - avenueW(x, z);
  k *= 1 - campW(x, z);
  k *= smooth(4, 16, oasisD(x, z));
  k *= smooth(6, 12, trapD(x, z));
  k *= smooth(14, 22, ruinD(x, z));
  return k;
};
const driftH = (x: number, z: number) => Math.max(...both((x, z) => 4.15 * (1 - smooth(3, 26, Math.hypot(x - DRIFT[0], z - DRIFT[1])) ** 1.3))(x, z));
const TRAP_HALF = 2.5;
function heightRel(x: number, z: number): number {
  let h = 0.15 + Math.max(0, dunes(x, z)) * flatMask(x, z) + rim(x, z);
  // Oasis pools.
  const od = oasisD(x, z);
  h = lerp(-1.9, h, smooth(-3, 1, od));
  // Sand traps: a shallow pit under a crumbling lid.
  if (trapD(x, z) <= TRAP_HALF + 0.01) h = -0.85;
  // Tomb lava pit.
  if (Math.max(Math.abs(x), Math.abs(z)) <= 4.01) h = -1.25;
  // Sand drifts up two corners.
  return Math.max(h, driftH(x, z));
}

let terrain: TerrainData = { ...newTerrain(300, 2, [0, 0], 'sand'), baseY: BASE };
const vx = (i: number) => terrain.origin[0] + (i % terrain.cols) * terrain.spacing;
const vz = (i: number) => terrain.origin[1] + Math.floor(i / terrain.cols) * terrain.spacing;
terrain = { ...terrain, heights: terrain.heights.map((_, i) => Math.round(heightRel(vx(i), vz(i)) * 100)) };
const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
const cx = (i: number) => terrain.origin[0] + ((i % (terrain.cols - 1)) + 0.5) * terrain.spacing;
const cz = (i: number) => terrain.origin[1] + (Math.floor(i / (terrain.cols - 1)) + 0.5) * terrain.spacing;
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const [x, z] = [cx(i), cz(i)];
    const od = oasisD(x, z);
    if (od < 1) return mat('mud');
    if (od < 10) return mat('grass');
    if (od < 15) return mat('moss');
    if (Math.max(Math.abs(x), Math.abs(z)) < 46) return mat('stone');
    if (avenueW(x, z) > 0.75 && Math.abs(z) < 7) return mat('gravel');
    if (campW(x, z) > 0.8) return mat('dirt');
    if (ruinD(x, z) < 15) return mat('gravel');
    return v;
  }),
};
terrain = paintSlopes(terrain, 40, 'stone');
terrain = {
  ...terrain,
  foliage: terrain.materials.map((v, i) => {
    const name = TERRAIN_MATERIALS[v];
    return name === 'grass' ? 4 : name === 'moss' ? 2 : name === 'sand' ? 1 : 0;
  }),
};
m.terrain(terrain);
const ground = (x: number, z: number) => r2(terrainHeightAt(terrain, x, z) ?? 0);

// ---------------------------------------------------------------- blocks (tracked for the pad-flight checks)

interface SolidBox { x: number; z: number; y0: number; y1: number; w: number; d: number }
const solids: SolidBox[] = [];
const STONE = 'sandstone';
const block = (pos: V3, size: V3, material = STONE) => {
  m.block([r2(pos[0]), r2(pos[1]), r2(pos[2])], [r2(size[0]), r2(size[1]), r2(size[2])], 'solid', { material, respawn: null });
  solids.push({ x: pos[0], z: pos[2], y0: pos[1], y1: pos[1] + size[1], w: size[0], d: size[2] });
};
/** A box over a rectangle, split into pieces no wider than 64 m (the most a block can be). */
const rectBlock = ([x0, z0, x1, z1]: Rect, y0: number, y1: number, material = STONE) => {
  const nx = Math.ceil((x1 - x0) / 64);
  const nz = Math.ceil((z1 - z0) / 64);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const [a, b] = [x0 + ((x1 - x0) * i) / nx, x0 + ((x1 - x0) * (i + 1)) / nx];
      const [c, d] = [z0 + ((z1 - z0) * j) / nz, z0 + ((z1 - z0) * (j + 1)) / nz];
      block([(a + b) / 2, y0, (c + d) / 2], [b - a, y1 - y0, d - c], material);
    }
  }
};

/** Solid boxes covering the square ±s (1 m cells) minus the void rectangles, merged greedily. */
function solidRects(s: number, voids: Rect[]): Rect[] {
  const n = 2 * s;
  const solid = (i: number, j: number) => {
    const x = -s + i + 0.5;
    const z = -s + j + 0.5;
    return !voids.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  };
  const used = new Set<number>();
  const out: Rect[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (used.has(j * n + i) || !solid(i, j)) continue;
      let w = 1;
      while (i + w < n && !used.has(j * n + i + w) && solid(i + w, j)) w++;
      let h = 1;
      while (j + h < n && Array.from({ length: w }, (_, k) => i + k).every((k) => !used.has((j + h) * n + k) && solid(k, j + h))) h++;
      for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) used.add((j + b) * n + i + a);
      out.push([-s + i, -s + j, -s + i + w, -s + j + h]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- the pyramid

const TIERS = [40, 34, 28, 22, 16, 11, 6]; // half-widths; tier k (1-based) tops out at 4k
const LID = 0.4;
const all4 = (f: (face: number) => Rect) => [0, 1, 2, 3].map(f);
const TOMB: Rect = [-12, -12, 12, 12];
const tunnels = all4((f) => faceRect(f, 22, 40.5, 8, 12));
const ring = [faceRect(0, 18, 22, -22, 22), faceRect(2, 18, 22, -22, 22), faceRect(1, 18, 22, -18, 18), faceRect(3, 18, 22, -18, 18)];
const tombDoors = all4((f) => faceRect(f, 11.5, 18.5, -2, 2));
const VAULT: Rect = [-6, -6, 6, 6];
const vaultHalls = [0, 2].map((f) => faceRect(f, 5.5, 28.5, -5, -1));
const voids: { body: Rect[]; lid: Rect[] }[] = [
  { body: [...tunnels, ...ring, ...tombDoors, TOMB], lid: [TOMB] },
  { body: [TOMB], lid: [] },
  { body: [VAULT, ...vaultHalls], lid: [] },
];
TIERS.forEach((s, k) => {
  const top = 4 * (k + 1);
  const bottom = k === 0 ? -0.5 : top - 4;
  const v = voids[k];
  if (!v) return rectBlock([-s, -s, s, s], bottom, top);
  for (const r of solidRects(s, v.body)) rectBlock(r, bottom, top - LID);
  for (const r of solidRects(s, v.lid)) rectBlock(r, top - LID, top);
});

// Flights of steps up every face: against tier k+1's wall, on tier k's terrace (k = 0 is the sand).
const FLIGHTS: [number, number][] = [[-3, -1], [3, 1], [3, 1], [-3, -1], [3, 1], [-1, -1], [-5.8, 1]]; // start v, direction
for (let f = 0; f < 4; f++) {
  FLIGHTS.forEach(([v0, dir], k) => {
    const wall = TIERS[k]!;
    const y0 = 4 * k;
    for (let i = 0; i < 16; i++) {
      const v = v0 + dir * (0.45 * i + 0.225);
      const [x, z] = face(f, wall + 1.25, v);
      const along = f % 2 === 0;
      block([x, y0 - (k === 0 ? 0.3 : 0), z], along ? [0.47, 0.25 * (i + 1) + (k === 0 ? 0.3 : 0), 2.5] : [2.5, 0.25 * (i + 1) + (k === 0 ? 0.3 : 0), 0.47], 'pbr_travertine');
    }
    // A landing at the top, level with the next terrace, so the flight meets it along a proper width.
    const [lx, lz] = face(f, wall + 1.25, v0 + dir * (7.2 + 1.25));
    block([lx, y0 - (k === 0 ? 0.3 : 0), lz], [2.5, 4 + (k === 0 ? 0.3 : 0), 2.5], 'pbr_travertine');
  });
}

// The tomb: four pillars, the lava pit with the sarcophagus island and two crumbling walkways to it.
for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]] as const) block([x, -0.2, z], [1.6, 7.8, 1.6], 'pbr_travertine');
m.water([0, -1.6, 0], [10.8, 1.2, 10.8], 'lava');
block([0, -1.6, 0], [4, 1.6, 4], 'pbr_travertine');
for (const s of [1, -1]) {
  for (let i = 0; i < 3; i++) {
    const z = s * (2 + (4 / 3) * i + 2 / 3);
    m.block([0, -0.3, r2(z)], [2.4, 0.3, r2(4 / 3 + 0.02)], 'crumble', { material: 'sand', delay: 0.7, respawn: 8 });
  }
}
// The summit beacon.
block([0, 28, 0], [1.2, 1.6, 1.2], 'pbr_travertine');
block([0, 29.6, 0], [1.4, 0.5, 1.4], 'light_strip');
m.light([0, 31, 0], { fixture: 'none', color: '#ffb347', intensity: 3, range: 30 });

// Lights and dressing inside.
const torch = (x: number, z: number, y = 2.6, range = 10) => m.light([r2(x), y, r2(z)], { fixture: 'wall', color: '#ffa04a', intensity: 1.4, range });
for (let f = 0; f < 4; f++) {
  const [ax, az] = face(f, 31, 10);
  torch(ax, az);
  const [bx, bz] = face(f, 20, 0);
  torch(bx, bz);
  const [cx2, cz2] = face(f, 20, 20);
  torch(cx2, cz2);
}
for (const [x, z] of [[-6, -10], [6, 10], [10, -6], [-10, 6]] as const) torch(x, z, 5, 14);
m.light([0, 1.5, 0], { fixture: 'none', color: '#ff5a1e', intensity: 2.2, range: 14 });
torch(0, 0, 10.6, 12);
for (const f of [0, 2]) {
  const [x, z] = face(f, 17, -3);
  torch(x, z, 10.4);
}
m.prop('coffin', [0, 0, -10.2], Math.PI / 2, 1.3).prop('coffin', [0, 0, 10.2], Math.PI / 2, 1.3).prop('rn_candles', [1.2, 0, 1.2], 0, 1, false).prop('rn_statue_fox', [-10.5, 0, -10.5], Math.PI / 4).prop('rn_statue_fox', [10.5, 0, 10.5], -3 * Math.PI / 4);
m.prop('rn_urn', [-10.6, 0, 10.6]).prop('rn_urn', [10.6, 0, -10.6]).prop('dg_skull', [6.6, 0, 2]).prop('rn_candles', [-6.6, 0, -2]);
m.prop('dg_chest', [4.6, 8, 4.6], -3 * Math.PI / 4).prop('dg_chest', [-4.6, 8, -4.6], Math.PI / 4).prop('dg_coin_pile', [4.6, 8, 2.6]).prop('dg_coin_pile', [-4.6, 8, -2.6]).prop('dg_coin_bag', [2.6, 8, 4.8]).prop('dg_pedestal', [-2.6, 8, -4.8]);
for (let f = 0; f < 4; f++) {
  const [x, z] = face(f, 21.4, 14);
  m.prop('dg_vase', [r2(x), 0, r2(z)]);
}

// ---------------------------------------------------------------- pads: flights checked against every block

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
const inBox = (b: SolidBox, x: number, z: number, pad: number) => Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(z - b.z) <= b.d / 2 + pad;
const flightClear = (from: V3, to: V3, power: number, push: number): boolean => {
  const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
  let [x, y, z] = from;
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
    for (const b of solids) if (inBox(b, x, z, 0.45) && y < b.y1 - 0.3 && y + 1.9 > b.y0) return false;
  }
  return false;
};
const pads: V3[] = [];
const pad = (from: V3, to: V3) => {
  const need = Math.sqrt(2 * PLAYER.gravity * Math.max(0, to[1] - from[1] + 1));
  for (let power = Math.ceil(need); power <= 40; power++) {
    const push = flightPush(from, to, power);
    if (push === null || !flightClear(from, to, power, push)) continue;
    m.pad([r2(from[0]), r2(from[1]), r2(from[2])], +Math.atan2(to[0] - from[0], to[2] - from[2]).toFixed(4), power, r2(push));
    pads.push(from, to);
    return;
  }
  throw new Error(`sunstone_crag: no clear pad flight from ${from.map(r2)} to ${to.map(r2)}`);
};
for (let f = 0; f < 4; f++) {
  const [gx, gz] = face(f, 45, 0);
  const [lx, lz] = face(f, 25, 0);
  pad([gx, ground(gx, gz), gz], [lx, 12, lz]);
  const [ux, uz] = face(f, 19.5, 0);
  const [sx, sz] = face(f, 3, 0);
  pad([ux, 16, uz], [sx, 28, sz]);
}

// ---------------------------------------------------------------- sand traps and the oases

for (const [tx, tz] of [...TRAPS, ...TRAPS.map(([x, z]) => [-x, -z] as P2)]) {
  const g = BASE + 0.15 + 0; // flattened round the trap
  m.water([tx, -1, tz], [8, 0.75, 8], 'swamp');
  m.block([tx, r2(g - 0.3), tz], [8, 0.3, 8], 'crumble', { material: 'sand', delay: 0.5, respawn: 10 });
}
for (const s of [1, -1]) {
  const [x0, z0, x1, z1] = OASIS;
  m.water([0, -2.05, s * ((z0 + z1) / 2)], [x1 - x0 + 2, 1.55, z1 - z0 + 2], 'water');
}

// ---------------------------------------------------------------- camps

const pt = (s: 1 | -1, x: number, z: number): V3 => [s * x, ground(s * x, s * z), s * z];
for (const [team, s] of [[embers, 1], [tide, -1]] as const) {
  const fwd = s > 0 ? Math.PI / 2 : -Math.PI / 2; // facing the pyramid
  // Mud-brick walls round the back of the camp.
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const a = pt(s, x0, z0);
    const b = pt(s, x1, z1);
    rectBlock([Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2])], -0.3, 1.4, 'pbr_plaster');
  };
  wall(-123, -18, -122.4, -4);
  wall(-123, 4, -122.4, 18);
  wall(-123, 17.4, -104, 18);
  wall(-123, -18, -104, -17.4);
  m.flag(team, pt(s, -116, 0), fwd);
  for (const [x, z] of [[-106, -10], [-106, 10], [-100, -4], [-100, 4], [-112, -12], [-112, 12], [-96, -14], [-96, 14]] as const) m.spawn(pt(s, x, z), fwd, team);
  m.mount('buggy', pt(s, -92, -8), fwd, team).mount('buggy', pt(s, -92, 8), fwd, team).mount('gun_jeep', pt(s, -88, 0), fwd, team);
  m.mount('gun_jeep', pt(s, -98, -26), fwd, team);
  m.prop('sv_tent', pt(s, -118, -11), fwd).prop('sv_tent', pt(s, -118, 11), fwd).prop('tent_canvas', pt(s, -110, -15.5), fwd).prop('tent_canvas', pt(s, -110, 15.5), fwd);
  m.prop('stall', pt(s, -120.5, 0), fwd).prop('awning', pt(s, -119, 4)).prop('campfire', pt(s, -108, 0)).prop('crate_large', pt(s, -103, -16), 0.3).prop('crate_small', pt(s, -102, -15.6)).prop('barrel', pt(s, -103, 16.2)).prop('barrel', pt(s, -102, 15.4));
  m.prop('banner', pt(s, -122, -6), fwd).prop('banner', pt(s, -122, 6), fwd);
  m.light([s * -108, 1.4, 0], { fixture: 'none', color: '#ff9a4a', intensity: 1.6, range: 12 });
  m.pickup('weapon_rifle', pt(s, -104, -4)).pickup('weapon_smg', pt(s, -104, 4)).pickup('weapon_shotgun', pt(s, -113, -6)).pickup('ammo_rifle', pt(s, -113, 6));
  m.pickup('health_small', pt(s, -98, 0)).pickup('armor_small', pt(s, -116, -15)).pickup('grenades', pt(s, -116, 15));
}

// ---------------------------------------------------------------- pickups, hills and roaming spawns

const P: [string, number, number, number][] = [
  // Pyramid: the vault and the tomb.
  ['weapon_railgun', 0, 8, 0],
  ['ammo_cells', -3, 8, 3],
  ['ammo_cells', 3, 8, -3],
  ['powerup_damage', 0, 0, 0],
  // Catacombs (point-symmetric pairs).
  ['weapon_auto_shotgun', 20, 0, 12],
  ['weapon_auto_shotgun', -20, 0, -12],
  ['ammo_shells', -12, 0, 20],
  ['ammo_shells', 12, 0, -20],
  ['health_large', 20, 0, -20],
  ['health_large', -20, 0, 20],
  // Terraces.
  ['weapon_marksman', 37, 4, -37],
  ['weapon_marksman', -37, 4, 37],
  ['weapon_launcher', 31, 8, 31],
  ['weapon_launcher', -31, 8, -31],
  ['health_small', -25, 12, -25],
  ['health_small', 25, 12, 25],
  ['ammo_explosive', 19, 16, -19],
  ['ammo_explosive', -19, 16, 19],
  ['armor_small', 13.5, 20, -13.5],
  ['armor_small', -13.5, 20, 13.5],
  ['health_small', 8.5, 24, 8.5],
  ['health_small', -8.5, 24, -8.5],
];
for (const [item, x, y, z] of P) m.pickup(item, [x, y, z]);
const field: [string, number, number][] = [
  ['weapon_sniper', 62, -65],
  ['weapon_sniper', -62, 65],
  ['ammo_sniper', 68, -60],
  ['ammo_sniper', -68, 60],
  ['weapon_rockets', -62, -56],
  ['weapon_plasma', 62, 56],
  ['armor_large', 6, -90],
  ['armor_large', -6, 90],
  ['health_large', -12, -98],
  ['health_large', 12, 98],
  ['weapon_lmg', -70, -12],
  ['weapon_lmg', 70, 12],
  ['ammo_rifle', -48, 20],
  ['ammo_rifle', 48, -20],
  ['mines', -96, -50],
  ['mines', 96, 50],
  ['health_small', -54, -36],
  ['health_small', 54, 36],
];
for (const [item, x, z] of field) m.pickup(item, [x, ground(x, z), z]);
// King of the Hill: the summit, then terraces round the pyramid.
m.hill([0, 28, 2.5], 5.5).hill([31, 8, 0], 3).hill([-31, 8, 0], 3).hill([19, 16, 19], 3).hill([-19, 16, -19], 3);
// Roaming spawns for free-for-all: the oases, the ruins, the catacombs, the plaza corners.
for (const [x, z] of [[0, -84], [0, 84], [70, -50], [-70, 50], [20, 0], [-20, 0], [50, -30], [-50, 30]] as const) {
  const inside = Math.abs(x) === 20 && z === 0;
  m.spawn([x, inside ? 0 : ground(x, z), z], Math.atan2(-x, -z));
}

// ---------------------------------------------------------------- obelisks, ruins and the desert

let seed = 0x5a7d;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const placed: [number, number, number][] = [];
const prop = (model: string, x: number, z: number, yaw: number, scale = 1, solid = true, r = 1.5, sink = 0.05) => {
  placed.push([x, z, r]);
  m.prop(model, [r2(x), r2(ground(x, z) - sink), r2(z)], +yaw.toFixed(3), scale, solid);
};
// The avenues: obelisks in pairs from each camp to the plaza, and at the plaza corners.
for (const s of [1, -1] as const) {
  for (const x of [54, 66, 78]) for (const z of [-9, 9]) prop('obelisk', s * x, s * z, 0, 3.2, true, 3);
  prop('obelisk', s * 47, s * -47, Math.PI / 4, 3.8, true, 3);
}
// Ruined temple (and its turn): broken walls round a court, columns, an arch and statues.
for (const s of [1, -1] as const) {
  const [rx, rz] = [s * RUINS[0]![0], s * RUINS[0]![1]];
  const at = (dx: number, dz: number) => [rx + s * dx, rz + s * dz] as P2;
  const w = (model: string, dx: number, dz: number, yaw: number) => {
    const [x, z] = at(dx, dz);
    prop(model, x, z, yaw + (s < 0 ? Math.PI : 0), 1.2, true, 2.4);
  };
  w('rn_wall', -6, -8, 0);
  w('rn_wall_broken', -1, -8, 0);
  w('rn_arch_round', 5, -8, 0);
  w('rn_wall_hole', -8.5, -4, Math.PI / 2);
  w('rn_wall_broken', -8.5, 2, Math.PI / 2);
  w('rn_wall', 8.5, 0, Math.PI / 2);
  w('rn_wall_broken', 8.5, 5.5, Math.PI / 2);
  w('rn_wall_arch_ivy', -3, 8, 0);
  w('rn_wall_half', 4, 8, 0);
  for (const [dx, dz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]] as const) {
    const [x, z] = at(dx, dz);
    prop(dx * dz > 0 ? 'rn_column_round' : 'rn_column_broken', x, z, 0, 1.3, true, 1);
  }
  const [sx, sz] = at(0, 5);
  prop('rn_statue_stag', sx, sz, s > 0 ? Math.PI : 0, 1.4, true, 1.2);
  const [ux, uz] = at(-6, 6);
  prop('rn_urn_broken', ux, uz, 0, 1.2, true, 0.6);
}
// Ruin field (and its turn): standing stones and broken columns.
for (const s of [1, -1] as const) {
  const [rx, rz] = [s * RUINS[1]![0], s * RUINS[1]![1]];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const x = rx + Math.cos(a + (s < 0 ? Math.PI : 0)) * 11 * s;
    const z = rz + Math.sin(a + (s < 0 ? Math.PI : 0)) * 11 * s;
    prop(k % 3 === 0 ? 'stone_pillar' : k % 3 === 1 ? 'rn_column_broken' : 'rn_buttress', x, z, a, k % 3 === 1 ? 1.6 : 1.1, true, 2);
  }
  prop('obelisk', rx, rz, 0.4, 2.6, true, 2.5);
}
const keep: [number, number, number][] = [
  ...pads.map((p) => [p[0], p[2], 6] as [number, number, number]),
  ...m.doc.entities.filter((e) => ['pickup', 'spawn', 'mount', 'flag', 'hill'].includes(e.kind)).map((e) => [e.position[0], e.position[2], 4] as [number, number, number]),
];
const kept = (x: number, z: number) => keep.some(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) < kr);
// Oases: palms and bushes round the pools.
for (const s of [1, -1] as const) {
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.2;
    const r = 13 + (k % 3) * 2;
    const x = s * (Math.cos(a) * r);
    const z = s * (-100 + Math.sin(a) * r * 0.8);
    if (kept(x, z) || placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + 1.5)) continue;
    const model = k % 3 === 0 ? 'nt_palm_tall' : k % 3 === 1 ? 'palm_tall' : 'nt_palm_curved';
    prop(model, x, z, a * 3, model === 'palm_tall' ? 0.9 : 1.1, true, 1);
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.5;
    const x = s * (Math.cos(a) * 18.5);
    const z = s * (-100 + Math.sin(a) * 14);
    if (!kept(x, z)) prop(k % 2 ? 'nt_bush_leafy' : 'bush_large', x, z, a, 1.3, false, 1);
  }
}
// Desert scrub, cacti and rocks over the dunes (mirrored).
const okAt = (x: number, z: number, r: number) =>
  Math.abs(x) < 138 &&
  Math.abs(z) < 138 &&
  Math.max(Math.abs(x), Math.abs(z)) > 50 + r &&
  avenueW(x, z) < 0.3 &&
  campW(x, z) < 0.05 &&
  oasisD(x, z) > 6 + r &&
  trapD(x, z) > 5 + r &&
  ruinD(x, z) > 16 + r &&
  driftH(x, z) < 0.2 &&
  keep.every(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) > kr + r) &&
  placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > pr + r + 1.5);
for (let k = 0; k < 1500 && placed.length < 420; k++) {
  const x = (rand() - 0.5) * 276;
  const z = (rand() - 0.5) * 276;
  const pick = rand();
  const [model, scale, r, solid] =
    pick < 0.18 ? ['nt_saguaro', 1 + rand() * 0.6, 1, true] :
    pick < 0.32 ? ['cactus_tall', 1 + rand() * 0.5, 1, true] :
    pick < 0.42 ? ['nt_cactus_round', 1 + rand() * 0.5, 0.8, true] :
    pick < 0.6 ? ['boulder_jagged', 0.5 + rand() * 0.5, 2.5, true] :
    pick < 0.74 ? ['rock_large', 1.2 + rand(), 1.6, true] :
    pick < 0.84 ? ['nt_dead_tree', 0.8 + rand() * 0.4, 1, true] :
    pick < 0.92 ? ['stones', 1 + rand(), 0.8, false] :
    ['plant_low', 1 + rand() * 0.5, 0.6, false];
  if (!okAt(x, z, r as number) || !okAt(-x, -z, r as number)) continue;
  const yaw = rand() * 6.28;
  prop(model as string, x, z, yaw, +(scale as number).toFixed(2), solid as boolean, r as number, model === 'boulder_jagged' || model === 'rock_large' ? 0.4 : 0.05);
  prop(model as string, -x, -z, yaw + Math.PI, +(scale as number).toFixed(2), solid as boolean, r as number, model === 'boulder_jagged' || model === 'rock_large' ? 0.4 : 0.05);
}

// ---------------------------------------------------------------- map settings

m.backdrop('sunset', 'dunes', 'sand', 0.6, 0.12);
m.bounds('invisible', 0, { min: [-149, -149], max: [149, 149] }, 12);
await m.fillTeamSpawns(12);
m.meta({
  description:
    'A giant stepped pyramid in the desert, the king-of-the-hill mountain at the heart of the map. Fight up seven sandstone tiers by the zigzag stairs, the face jump pads or the sand drifts at two corners to the summit and its beacon, or go inside: four tunnels lead to the catacombs round the tomb, where a crumbling walkway crosses the lava pit to double damage, and the treasure vault on the third tier holds the railgun. Embers and Tide camp at either end of an avenue of obelisks with buggies and gun jeeps; between them lie dunes, ruined temples, two palm oases and sand traps that give way under your feet.',
  modes: ['core.koth', 'core.ctf', 'core.tdm', 'core.deathmatch', 'core.elim'],
  players: [12, 24],
});
await m.save();
