/**
 * Shingle Point: a big attack/defend beach landing. The Assault team comes
 * ashore at the waterline in the lee of beached landing-craft hulks, with
 * three dropships standing in for the boats; the Garrison holds concrete
 * bunkers and trenches on the bluff above, and a farming village behind it.
 * Our own map and name.
 *
 * Top-down (x east, z north; metres):
 *
 *   z +134  ......... hedgerows, orchard, back fields .........  Garrison spawns
 *   z +110   tank   barn   house    buggy   house               (village rear)
 *   z  +84   orchard  cottage  [HQ = site B] radar  cottage  house
 *   z  +50   ===== hedgerows =====  MG at the gully head  ===== hedges =====
 *   z  +30   comm trench ^           ^ gully road            ^ comm trench
 *   z   +9   W2 bunker ~trench~ W1 ~ C ~ MG |GULLY| [CASEMATE = site A] ~ E bunker
 *   z   +3   ------------- bluff crest (16 m) -------------- landslide (far east)
 *   z   -8   promenade: pads up, ladder tower west, the west draw, the gully mouth
 *   z  -15   ===== concrete seawall (3 m): ladders, three gaps, two weak sections =====
 *   z  -22   shingle bank
 *   z  -55   craters, steel hedgehogs, burnt-out hulks (the long open beach)
 *   z  -85   landing-craft hulks (Assault spawns) and dropships in the surf
 *   z -100   the sea
 *
 * Routes up from the beach: the wide gully road (centre-east), the narrow
 * west draw, two jump pads at the cliff foot, a ladder tower at the far west,
 * a landslide at the far east, and the trench lines along the crest join the
 * bunkers (side doors) to each other and to the rear.
 */
import { TERRAIN_MATERIALS, paintSlopes, terrainHeightAt, yawXZ, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('shingle_point', 'Shingle Point');
m.theme('bunker');
m.factions([
  { id: 'assault', name: 'Assault', color: '#3f7fd8', relations: {} },
  { id: 'garrison', name: 'Garrison', color: '#c8543a', relations: {} },
]);
m.teams([12, 12]);
const [ATK, DEF] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI; // facing south (toward the sea)

// ---------------------------------------------------------------- helpers

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
let seed = 19440606 % 2147483647;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const segDist = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return { d: Math.hypot(x - ax - vx * t, z - az - vz * t), t, len: Math.hypot(vx, vz) };
};
const lineDist = (x: number, z: number, pts: [number, number][]) => Math.min(...pts.slice(1).map((b, i) => segDist(x, z, pts[i]![0], pts[i]![1], b[0], b[1]).d));

// ---------------------------------------------------------------- terrain shape

const PLAT = 15.85; // plateau ground (tile level 4 floor is 16)
const L = 4; // tile level on the plateau
const FLOOR = 16;
const PROM = 4.85; // promenade behind the seawall
const FOOT = 2.0; // sand at the foot of the seawall
const WALL_Z0 = -17; // seawall, beach face
const WALL_Z1 = -13; // seawall, promenade face
const WALL_TOP = 5.0;

/** Cliff foot and crest (z) at x; the far east crumbles into a walkable landslide. */
const zFoot = (x: number) => 2 + Math.sin(x / 17 + 0.5) - 7.5 + 0.8 * Math.sin(x / 7);
const cliffW = (x: number) => 7.5 + 15 * smooth(96, 104, x);
const zCrest = (x: number) => zFoot(x) + cliffW(x);

/** Gaps in the seawall: centre x and half-width. */
const GAPS: [number, number][] = [[-64, 4], [26, 8], [84, 4]];
const gapWeight = (x: number) => Math.max(0, ...GAPS.map(([c, hw]) => 1 - smooth(hw, hw + 2, Math.abs(x - c))));

/** Shell craters on the beach: x, z, radius, depth. */
const CRATERS: [number, number, number, number][] = [];
for (let n = 0; n < 400 && CRATERS.length < 22; n++) {
  const x = (rand() - 0.5) * 210;
  const z = -78 + rand() * 50;
  const r = 2.6 + rand() * 2;
  if (CRATERS.some(([cx, cz, cr]) => Math.hypot(cx - x, cz - z) < cr + r + 5)) continue;
  CRATERS.push([+x.toFixed(1), +z.toFixed(1), +r.toFixed(1), +(0.9 + rand() * 0.7).toFixed(2)]);
}
// A couple more on the promenade and the plateau lip, from the bombardment.
CRATERS.push([-6, -9, 2.4, 0.7], [62, -9.5, 2.2, 0.6]);

function sand(x: number, z: number): number {
  if (z < -88) {
    const d = -88 - z;
    return Math.max(-5.5, -0.15 - 0.07 * d - 0.1 * Math.max(0, d - 12));
  }
  const bank = 0.75 * Math.exp(-(((z + 21.5) / 2.2) ** 2));
  if (z < -26) {
    const t = (z + 88) / 62;
    return -0.15 + 1.85 * t ** 1.3 + 0.12 * Math.sin(x / 11) * Math.cos(z / 7) * t + bank;
  }
  return 1.7 + 0.3 * smooth(-26, WALL_Z0, z) + bank;
}

/** Everything south of the cliff foot: sea, beach, seawall step (or ramps at the gaps), promenade. */
function lowland(x: number, z: number): number {
  const step = z <= WALL_Z0 ? sand(x, z) : z >= WALL_Z1 - 1 ? PROM : lerp(FOOT, PROM, smooth(WALL_Z0, WALL_Z1 - 1, z));
  const r0 = sand(x, -26);
  const ramp = z <= -26 ? sand(x, z) : z >= -10 ? PROM : lerp(r0, PROM, smooth(-26, -10, z));
  return lerp(step, ramp, gapWeight(x));
}

const rolling = (x: number, z: number) => 0.6 * Math.sin(x / 19 + 0.3) * Math.cos(z / 23) + 0.3 * Math.sin((x + z) / 31);
function plateau(x: number, z: number): number {
  const cr = zCrest(x);
  return PLAT + rolling(x, z) * smooth(cr + 14, cr + 32, z) + 1.2 * smooth(112, 136, z);
}

function base(x: number, z: number): number {
  const f = zFoot(x);
  const cr = zCrest(x);
  if (z <= f) return lowland(x, z);
  if (z >= cr) return plateau(x, z);
  return lerp(PROM, PLAT, smooth(f, cr, z)) + (z > cr - 2 ? (plateau(x, z) - PLAT) * smooth(cr - 2, cr, z) : 0);
}

/** Trenches: z 9 along the crest, plus communication trenches to the rear. */
const TRENCHES: [number, number, number, number][] = [
  [-110, 9, 11, 9],
  [41, 9, 110, 9],
  [-24, 13, -24, 38],
  [88, 13, 88, 36],
];
function trenchDepth(x: number, z: number): number {
  let d = 0;
  for (const [ax, az, bx, bz] of TRENCHES) {
    const s = segDist(x, z, ax, az, bx, bz);
    const across = 1 - smooth(1.3, 2.8, s.d);
    const ends = smooth(0, 4, s.t * s.len) * smooth(0, 4, (1 - s.t) * s.len);
    d = Math.max(d, 1.8 * across * ends);
  }
  return d;
}

/** Tile footprints (and set-piece pads) on the plateau, kept flat at PLAT. */
const FLAT: [number, number, number, number][] = [];
const flatRect = (x0: number, z0: number, x1: number, z1: number) => FLAT.push([x0, z0, x1, z1]);
function flatWeight(x: number, z: number): number {
  let w = 0;
  for (const [x0, z0, x1, z1] of FLAT) {
    const dx = Math.max(x0 - x, x - x1, 0);
    const dz = Math.max(z0 - z, z - z1, 0);
    w = Math.max(w, 1 - smooth(1, 5, Math.hypot(dx, dz)));
  }
  return w;
}

/** The gully road: centre line, floor height. */
const gullyX = (z: number) => 26 + 2 * Math.sin(z / 14);
const gullyFloor = (z: number) => lerp(PROM, PLAT, smooth(-8, 48, z));
const gully = (x: number, z: number) => gullyFloor(z) + 30 * smooth(0, 7, Math.abs(x - gullyX(z)) - 5);
/** The narrow west draw: a footpath. */
const drawX = (z: number) => -64 + 3 * Math.sin(z / 9);
const drawFloor = (z: number) => lerp(PROM, PLAT, Math.max(0, Math.min(1, (z + 7) / 33)));
const draw = (x: number, z: number) => (z < -7 ? 99 : drawFloor(z) + 30 * smooth(0, 5, Math.abs(x - drawX(z)) - 2.2));

function crater(x: number, z: number): number {
  let h = 0;
  for (const [cx, cz, r, d] of CRATERS) {
    const q = Math.hypot(x - cx, z - cz);
    if (q > r * 1.8) continue;
    if (q < r) h -= d * (1 - (q / r) ** 2);
    h += 0.35 * Math.exp(-(((q - r) / (0.3 * r)) ** 2));
  }
  return h;
}

// ---------------------------------------------------------------- the buildings' footprints (for the terrain)

// Bunkers (core.bunker, turned to face the sea: footprint is the origin cell and the one west of it).
const BUNKERS: [string, number][] = [['W2', -11], ['W1', -3], ['C', 0], ['E', 11]];
for (const [, cx] of BUNKERS) flatRect((cx - 1) * 8 - 4, 4, cx * 8 + 4, 12);
flatRect(44, 4, 68, 12); // casemate
flatRect(52, 12, 60, 20); // casemate magazine
const VILLAGE = {
  hq: [-2, 10] as const,
  houseA: [2, 12] as const,
  houseB: [-6, 13] as const,
  houseC: [6, 9] as const,
  barn: [8, 13] as const,
  cottage1: [1, 9] as const,
  cottage2: [-5, 9] as const,
};
const cellRect = (cx: number, cy: number, w: number, h: number) => flatRect(cx * 8 - 4, cy * 8 - 4, (cx + w) * 8 - 4, (cy + h) * 8 - 4);
cellRect(...VILLAGE.hq, 2, 2);
cellRect(...VILLAGE.houseA, 2, 2);
cellRect(...VILLAGE.houseB, 2, 2);
cellRect(...VILLAGE.houseC, 2, 2);
cellRect(...VILLAGE.barn, 3, 2);
cellRect(...VILLAGE.cottage1, 1, 1);
cellRect(...VILLAGE.cottage2, 1, 1);
flatRect(-31, 92, -23, 100); // radar mast

function height(x: number, z: number): number {
  let h = base(x, z);
  const onTop = z >= zCrest(x) + 1;
  if (onTop) h -= trenchDepth(x, z);
  if (z >= zCrest(x) - 0.5) h = lerp(h, PLAT, flatWeight(x, z));
  if (z > WALL_Z1) h = Math.min(h, gully(x, z), draw(x, z));
  if (z < -24 || (z > WALL_Z1 && z < zFoot(x) - 1) || onTop) h += crater(x, z) * (z < -24 ? 1 : onTop ? 0 : 1);
  return h;
}

const COLS = 121; // x -120..120
const ROWS = 141; // z -140..140
let terrain: TerrainData = {
  origin: [-120, -140],
  spacing: 2,
  cols: COLS,
  rows: ROWS,
  baseY: 0,
  heights: [],
  materials: new Array((COLS - 1) * (ROWS - 1)).fill(TERRAIN_MATERIALS.indexOf('grass')),
  boundary: true,
  foliage: [],
};
terrain.heights = Array.from({ length: COLS * ROWS }, (_, i) => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  return Math.round(height(terrain.origin[0] + c * 2, terrain.origin[1] + r * 2) * 100);
});

// Lanes and roads on the plateau (gravel and dirt).
const ROADS: [number, number][][] = [
  [[26, 46], [24, 60], [16, 72], [8, 84], [0, 96], [-4, 112], [-6, 136]],
  [[-110, 64], [-60, 64], [-24, 70], [8, 72], [40, 90], [60, 94], [110, 96]],
];
const roadDist = (x: number, z: number) => Math.min(...ROADS.map((r) => lineDist(x, z, r)));

const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
const cellXZ = (i: number): [number, number] => {
  const c = i % (COLS - 1);
  const r = Math.floor(i / (COLS - 1));
  return [terrain.origin[0] + (c + 0.5) * 2, terrain.origin[1] + (r + 0.5) * 2];
};
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const [x, z] = cellXZ(i);
    if (z < -26) return mat(crater(x, z) < -0.3 ? 'dirt' : 'sand');
    if (z < WALL_Z0 + 0.5) return mat('gravel'); // the shingle bank
    if (z < zFoot(x)) return mat(Math.abs(x - gullyX(z)) < 6 ? 'dirt' : 'gravel');
    if (z < zCrest(x)) return mat('stone');
    if (Math.abs(x - gullyX(z)) < 5.5 && z < 50) return mat('dirt');
    if (Math.abs(x - drawX(z)) < 2.6 && z < 28) return mat('dirt');
    if (trenchDepth(x, z) > 0.4) return mat('mud');
    if (flatWeight(x, z) > 0.85) return mat('gravel');
    if (roadDist(x, z) < 2.4) return mat('dirt');
    return v;
  }),
};
terrain = paintSlopes(terrain, 38, 'stone');
terrain = {
  ...terrain,
  foliage: terrain.materials.map((v, i) => {
    const [x, z] = cellXZ(i);
    const name = TERRAIN_MATERIALS[v];
    if (name === 'sand') return z > -60 ? 1 : 0;
    if (name !== 'grass') return 0;
    if (z < zCrest(x) + 10) return 2;
    return z > 56 && Math.abs(x) > 60 ? 4 : 3;
  }),
};
m.terrain(terrain);
const ground = (x: number, z: number) => +(terrainHeightAt(terrain, x, z) ?? 0).toFixed(2);
const at = (x: number, z: number, lift = 0): V3 => [+x.toFixed(2), +(ground(x, z) + lift).toFixed(2), +z.toFixed(2)];

// ---------------------------------------------------------------- the sea, the hulks and the beach

// The sea: one body of water out past the edge of the land (its floor below the deepest sea bed).
m.water([0, -6.5, -143], [512, 6.5, 118]);

const STEEL = { material: 'pbr_steel', tint: '#4a4e50' };
const RUST = { material: 'pbr_rusted_plate' };
const CONCRETE = { material: 'pbr_concrete', tint: '#b4b0a6' };
const SANDBAG = { material: 'pbr_canvas', tint: '#9a8c66' };

/** A block in a turned frame: local offset (lx, lz) from (cx, cz), turned by yaw. */
function tblock(cx: number, cz: number, yaw: number, lx: number, lz: number, y: number, size: V3, o: { material: string; tint?: string }): void {
  const [dx, dz] = yawXZ(lx, lz, yaw);
  m.block([+(cx + dx).toFixed(2), +y.toFixed(2), +(cz + dz).toFixed(2)], size, 'solid', { ...o, yaw: +yaw.toFixed(4) });
}

/** Lowest and highest ground under a turned rectangle. */
function groundRange(cx: number, cz: number, yaw: number, w: number, l: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    const [dx, dz] = yawXZ((i / 4 - 0.5) * w, (j / 4 - 0.5) * l, yaw);
    const g = ground(cx + dx, cz + dz);
    lo = Math.min(lo, g);
    hi = Math.max(hi, g);
  }
  return [lo, hi];
}

/**
 * A landing-craft hulk: an open-topped steel box, bow (local +z) walled high
 * against the bluff, sides lower with a gap by the bow, stern open to the sea.
 * `wrecked` knocks one side down to a stub.
 */
function hulk(cx: number, cz: number, yaw: number, o: { bow?: number; side?: number; wrecked?: boolean } = {}): void {
  const W = 5.8;
  const Lh = 10;
  const t = 0.4;
  const [lo, hi] = groundRange(cx, cz, yaw, W, Lh);
  const y = lo - 0.4;
  const bow = hi - y + (o.bow ?? 3.2);
  const side = hi - y + (o.side ?? 2.3);
  const mat = o.wrecked ? RUST : STEEL;
  tblock(cx, cz, yaw, 0, Lh / 2 - t / 2, y, [W, bow, t], mat);
  // Sides: from the stern to 2 m short of the bow (a way out each side).
  const run = Lh - 2.2;
  tblock(cx, cz, yaw, -W / 2 + t / 2, -Lh / 2 + run / 2, y, [t, side, run], mat);
  tblock(cx, cz, yaw, W / 2 - t / 2, -Lh / 2 + run / 2, y, [t, o.wrecked ? hi - y + 0.9 : side, run], mat);
  // A stub of the bow ramp lying in front of the hull.
  if (!o.wrecked) tblock(cx, cz, yaw, 0, Lh / 2 + 0.7, y, [W - 1.2, hi - y + 0.5, 0.9], mat);
}

// Spawn hulks at the waterline (Assault spawns sit in their lee).
const HULKS = [-75, -25, 25, 75];
for (const x of HULKS) hulk(x, -85, 0);
// Burnt-out hulks up the beach: cover on the way in.
const WRECKS: [number, number, number][] = [[-50, -56, 0.35], [12, -61, -0.25], [62, -50, 0.5], [-90, -41, -0.4], [36, -37, 0.12], [-22, -36, -0.6]];
for (const [x, z, yaw] of WRECKS) hulk(x, z, yaw, { bow: 1.4, side: 1.6, wrecked: true });

const keepClear: [number, number, number][] = [
  ...HULKS.map((x) => [x, -85, 9] as [number, number, number]),
  ...[-50, 0, 50].map((x) => [x, -84, 8] as [number, number, number]),
  ...WRECKS.map(([x, z]) => [x, z, 7] as [number, number, number]),
  ...CRATERS.map(([x, z, r]) => [x, z, r + 1.5] as [number, number, number]),
  ...GAPS.map(([x]) => [x, -21, 10] as [number, number, number]),
];
const clearAt = (x: number, z: number, r: number) => keepClear.every(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) > kr + r);

/** A steel hedgehog: three crossed beams. */
function hedgehog(x: number, z: number, yaw: number): void {
  const g = ground(x, z) - 0.15;
  tblock(x, z, yaw + Math.PI / 4, 0, 0, g, [2.8, 0.32, 0.3], STEEL);
  tblock(x, z, yaw - Math.PI / 4, 0, 0, g + 0.32, [2.8, 0.32, 0.3], STEEL);
  tblock(x, z, yaw, 0, 0, g, [0.3, 1.5, 0.3], STEEL);
  keepClear.push([x, z, 2]);
}
let hedgehogs = 0;
for (let n = 0; n < 2000 && hedgehogs < 46; n++) {
  const x = (rand() - 0.5) * 214;
  const z = -76 + rand() * 46;
  if (!clearAt(x, z, 3.2)) continue;
  hedgehog(x, z, rand() * Math.PI);
  hedgehogs++;
}
// Wooden stakes and log ramps (beach obstacles), and odd flotsam.
let stakes = 0;
for (let n = 0; n < 1500 && stakes < 26; n++) {
  const x = (rand() - 0.5) * 214;
  const z = -80 + rand() * 50;
  if (!clearAt(x, z, 2)) continue;
  keepClear.push([x, z, 1.5]);
  stakes++;
  if (stakes % 3 === 0) m.prop('log_big', at(x, z, -0.2), +(rand() * 6).toFixed(2), 1.2);
  else if (stakes % 3 === 1) m.prop('log', at(x, z, -0.1), +(rand() * 6).toFixed(2), 1.3);
  else m.prop('rowboat', at(x, z, -0.1), +(rand() * 6).toFixed(2), 1);
}

// ---------------------------------------------------------------- the seawall

const WALL_RUNS: [number, number][] = [[-112, -68], [-60, -20], [-16, 18], [34, 56], [60, 80], [88, 112]];
const WEAK: [number, number][] = [[-20, -16], [56, 60]];
const wallY = FOOT - 0.4;
for (const [x0, x1] of WALL_RUNS) {
  const pieces = Math.ceil((x1 - x0) / 32);
  for (let i = 0; i < pieces; i++) {
    const a = x0 + ((x1 - x0) * i) / pieces;
    const b = x0 + ((x1 - x0) * (i + 1)) / pieces;
    m.block([(a + b) / 2, wallY, (WALL_Z0 + WALL_Z1) / 2], [b - a, WALL_TOP - wallY, WALL_Z1 - WALL_Z0], 'solid', CONCRETE);
  }
}
// Two weak sections: blow them open for another way up.
for (const [x0, x1] of WEAK) m.block([(x0 + x1) / 2, wallY, (WALL_Z0 + WALL_Z1) / 2], [x1 - x0, WALL_TOP - wallY, WALL_Z1 - WALL_Z0], 'breakable', { ...CONCRETE, tint: '#a29a8c', health: 350, respawn: 90 });
// Ladders up the beach face.
for (const x of [-92, -30, 2, 46, 100]) {
  const g = ground(x, WALL_Z0 - 0.8);
  m.add({ kind: 'ladder', position: [x, g, WALL_Z0], yaw: S, height: +(WALL_TOP - g).toFixed(2), width: 1 });
}

// ---------------------------------------------------------------- the bluff: ladder tower, pads, the crest line

// A concrete ladder tower against the cliff at the far west.
{
  const x = -106;
  const z0 = zFoot(x) - 2.5;
  const z1 = zCrest(x) + 0.5;
  m.block([x, PROM - 0.4, (z0 + z1) / 2], [3.2, FLOOR + 0.1 - (PROM - 0.4), z1 - z0], 'solid', CONCRETE);
  const g = ground(x, z0 - 0.8);
  m.add({ kind: 'ladder', position: [x, g, +z0.toFixed(2)], yaw: S, height: +(FLOOR + 0.1 - g).toFixed(2), width: 1 });
}
// Jump pads at the cliff foot onto the crest behind the trench.
m.padTo(at(-46, -9), at(-46, 18), 26);
m.padTo(at(8, -9), at(8, 19), 26);

// ---------------------------------------------------------------- bunkers, casemate, turrets

for (const [, cx] of BUNKERS) {
  m.tile('bunker', cx, 1, L, 2);
  // Doors at the back and into the trench either side; slits everywhere else.
  m.edge(cx, 1, L, 'N', 'door').edge(cx, 1, L, 'E', 'door').edge(cx - 1, 1, L, 'W', 'door');
}

// The casemate (bomb site A): three gun rooms on the crest and a magazine behind.
for (const cx of [6, 7, 8]) m.tile('room', cx, 1, L, 0, { ceiling: 'roof', corners: 'chamfered' });
m.tile('room', 7, 2, L, 0, { ceiling: 'roof', layout: 'empty' });
m.edge(6, 1, L, 'S', 'slit').edge(7, 1, L, 'S', 'wide').edge(8, 1, L, 'S', 'slit');
m.edge(6, 1, L, 'E', 'wide').edge(7, 1, L, 'E', 'wide');
m.edge(6, 1, L, 'W', 'door').edge(8, 1, L, 'E', 'door');
m.edge(6, 1, L, 'N', 'window').edge(8, 1, L, 'N', 'window').edge(7, 1, L, 'N', 'door');
m.edge(7, 2, L, 'W', 'door').edge(7, 2, L, 'E', 'door').edge(7, 2, L, 'N', 'wide');
// The big gun: breech on a plinth, barrel out through the embrasure over the cliff.
m.block([56, FLOOR, 9.6], [2.6, 1.2, 3.2], 'solid', { material: 'pbr_concrete_dark' });
m.block([56, FLOOR + 1.2, 9], [1.6, 1.0, 2.4], 'solid', STEEL);
m.block([56, FLOOR + 1.45, 4.4], [0.6, 0.6, 7], 'solid', STEEL);
m.add({ kind: 'bombsite', position: [49, FLOOR, 8], label: 'A', radius: 7 });

// Turrets on the crest (facing the beach; open to the flanks and the rear).
m.mount('turret_mg', at(-56, 5), S, DEF);
m.mount('turret_rocket', at(-16, 5), S, DEF);
m.mount('turret_mg', at(9, 5), (3 * Math.PI) / 4, DEF);
m.mount('turret_rocket', at(72, 5), S, DEF);
m.mount('turret_mg', at(26, 52), S, DEF); // at the head of the gully, looking down it
// Sentries: one over the gully, one at the top of the west draw.
m.mount('sentry', at(41, 30), -P - 0.4, DEF);
m.mount('sentry', at(-52, 26), -P + 0.3, DEF);

// Sandbag walls along the trench lips and round the turrets.
function sandbags(x: number, z: number, len: number, yaw: number): void {
  const g = groundRange(x, z, yaw, len, 0.9);
  m.block([+x.toFixed(2), +(g[0] - 0.25).toFixed(2), +z.toFixed(2)], [len, g[1] - g[0] + 0.25 + 0.75, 0.9], 'solid', { ...SANDBAG, yaw });
}
for (const [tx, tz] of [[-56, 5], [-16, 5], [72, 5]] as const) {
  sandbags(tx - 1.9, tz - 0.4, 2.2, P - 0.3);
  sandbags(tx + 1.9, tz - 0.4, 2.2, P + 0.3);
}
sandbags(26 - 2, 50.5, 2.2, P - 0.3);
sandbags(26 + 2, 50.5, 2.2, P + 0.3);
// Short runs of sandbags on the trench's seaward lip (gaps between them to step up and shoot).
for (let x = -104; x < 108; x += 7) {
  if (FLAT.some(([x0, z0, x1]) => z0 < 6 && x > x0 - 6 && x < x1 + 6)) continue;
  if (x > 8 && x < 44) continue;
  if ([-56, -16, 72].some((t) => Math.abs(t - x) < 5)) continue;
  if (Math.abs(x - drawX(9)) < 9) continue;
  sandbags(x, 6.6, 3, 0);
}
// Concrete barriers and crates in the trenches and behind the bunkers.
for (const [x, z, yaw] of [[-70, 9, 0.2], [-44, 9, -0.3], [-8, 16, 0.4], [30, 22, 0], [96, 9, 0.1], [-24, 30, P], [88, 26, P]] as const) m.prop('barrier', at(x, z), yaw);
for (const [x, z, yaw] of [[-92, 16, 0.3], [-28, 16, 0.2], [62, 22, -0.4], [84, 16, 0.6], [4, 24, 0.1]] as const) m.prop('crate_large', at(x, z), yaw);
for (const [x, z] of [[-88, 18], [-20, 18], [66, 18], [80, 18]] as const) m.prop('metal_crate', at(x, z), rand() * 2);

// ---------------------------------------------------------------- the village

const v = (cell: readonly [number, number]) => cell;
m.tile('room_large', ...v(VILLAGE.hq), L, 0, { ceiling: 'roof', facade: 'brick', layout: 'low_cover', corners: 'columns' });
{
  const [hx, hy] = VILLAGE.hq;
  m.edge(hx, hy, L, 'S', 'door').edge(hx + 1, hy, L, 'S', 'wide');
  m.edge(hx + 1, hy, L, 'E', 'window').edge(hx + 1, hy + 1, L, 'E', 'door');
  m.edge(hx, hy, L, 'W', 'window').edge(hx, hy + 1, L, 'W', 'door');
  m.edge(hx, hy + 1, L, 'N', 'window').edge(hx + 1, hy + 1, L, 'N', 'door');
}
m.add({ kind: 'bombsite', position: [-12, FLOOR, 84], label: 'B', radius: 6 });
m.tile('house', ...v(VILLAGE.houseA), L);
m.tile('house', ...v(VILLAGE.houseB), L);
m.tile('house', ...v(VILLAGE.houseC), L);
m.tile('warehouse', ...v(VILLAGE.barn), L);
{
  const [bx, by] = VILLAGE.barn;
  m.edge(bx, by, L, 'S', 'wide').edge(bx + 2, by, L, 'S', 'door').edge(bx, by + 1, L, 'W', 'door').edge(bx + 2, by, L, 'E', 'door');
}
for (const [hx, hy] of [VILLAGE.houseA, VILLAGE.houseB, VILLAGE.houseC]) m.edge(hx, hy, L, 'S', 'door').edge(hx + 1, hy, L, 'E', 'door').edge(hx + 1, hy + 1, L, 'N', 'door');
m.tile('room', ...v(VILLAGE.cottage1), L, 0, { ceiling: 'roof', facade: 'plaster' });
m.tile('room', ...v(VILLAGE.cottage2), L, 0, { ceiling: 'roof', facade: 'brick' });
m.edge(...VILLAGE.cottage1, L, 'S', 'door').edge(...VILLAGE.cottage1, L, 'N', 'door').edge(...VILLAGE.cottage1, L, 'E', 'window').edge(...VILLAGE.cottage1, L, 'W', 'window');
m.edge(...VILLAGE.cottage2, L, 'S', 'door').edge(...VILLAGE.cottage2, L, 'E', 'door').edge(...VILLAGE.cottage2, L, 'N', 'window').edge(...VILLAGE.cottage2, L, 'W', 'window');

function paint(x: number, y: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === L);
  if (!t) throw new Error(`no tile at ${x},${y}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const surf = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
paint(...VILLAGE.barn, { walls: surf('pbr_planks'), floor: surf('pbr_floorboards'), solids: surf('pbr_planks') });
for (const [cell, tint] of [[VILLAGE.houseA, '#d8cbb0'], [VILLAGE.houseB, '#c9b8a0'], [VILLAGE.houseC, '#e0d6c0']] as const) {
  paint(cell[0], cell[1], { walls: surf('pbr_plaster', tint), floor: surf('pbr_floorboards'), trim: surf('pbr_plaster_white') });
}

// The radar mast behind the HQ: a lattice tower with a dish.
{
  const [cx, cz] = [-27, 96];
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]] as const) m.block([cx + dx, PLAT - 0.2, cz + dz], [0.3, 12.2, 0.3], 'solid', STEEL);
  for (const y of [3, 6, 9]) {
    m.block([cx, PLAT + y, cz - 1.2], [2.7, 0.2, 0.2], 'solid', STEEL).block([cx, PLAT + y, cz + 1.2], [2.7, 0.2, 0.2], 'solid', STEEL);
    m.block([cx - 1.2, PLAT + y, cz], [0.2, 0.2, 2.7], 'solid', STEEL).block([cx + 1.2, PLAT + y, cz], [0.2, 0.2, 2.7], 'solid', STEEL);
  }
  m.block([cx, PLAT + 12, cz], [3.2, 0.3, 3.2], 'solid', STEEL);
  m.block([cx, PLAT + 12.3, cz], [0.4, 1.2, 0.4], 'solid', STEEL);
  m.block([cx, PLAT + 13.5, cz], [5.5, 2.6, 0.25], 'solid', { material: 'pbr_white_panel', yaw: 0.5 });
  m.prop('sv_radio', [-12, FLOOR + 0.0, 80.5], 0.3);
}
// HQ furniture: map tables and kit (kept off the middle, where the bomb goes).
for (const [x, z, model, yaw] of [[-18, 78.5, 'desk', 0], [-6, 78.5, 'computer_bank', 0], [-18, 89.5, 'metal_crate', 0.3], [-6, 90, 'crate_large', P]] as const) m.prop(model, [x, FLOOR, z], yaw);

// Vehicles for the counter-attack: a tank and a buggy in the village.
m.mount('tank', at(44, 112), S, DEF);
m.mount('buggy', at(-2, 116), S, DEF);
// Dropships at the waterline for the landing.
for (const x of [-50, 0, 50]) m.mount('dropship', at(x, -84), 0, ATK);

// Hedgerows: tall hedges in broken lines, leafy bushes filling the gaps (walk-through, they hide you).
const HEDGEROWS: [number, number, number, number][] = [
  [-108, 58, -36, 58],
  [-28, 56, 14, 56],
  [40, 58, 108, 58],
  [-34, 96, -34, 132],
  [36, 120, 108, 120],
  [-108, 104, -60, 104],
  [96, 64, 96, 110],
];
const houses = FLAT.filter(([, z0]) => z0 > 40);
const nearBuilt = (x: number, z: number, r: number) => houses.some(([x0, z0, x1, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
const nearRoad = (x: number, z: number, r: number) => roadDist(x, z) < r;
for (const [ax, az, bx, bz] of HEDGEROWS) {
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bx - ax, bz - az);
  for (let s = 2; s < len; s += 3.8) {
    const x = ax + ((bx - ax) * s) / len;
    const z = az + ((bz - az) * s) / len;
    if (nearBuilt(x, z, 3) || nearRoad(x, z, 4)) continue;
    const k = Math.floor(rand() * 10);
    if (k < 5) m.prop('hedge_large', at(x, z), +yaw.toFixed(3));
    else if (k < 8) m.prop('nt_bush_leafy', at(x, z), +(rand() * 6).toFixed(2), +(1.4 + rand() * 0.6).toFixed(2), false);
    else if (k < 9) m.prop('bush_large', at(x, z), +(rand() * 6).toFixed(2), 1.1, false);
    // else a gap to slip through
  }
}
// The orchard (west of the village).
for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
  const x = -92 + i * 7 + (rand() - 0.5);
  const z = 70 + j * 7 + (rand() - 0.5);
  if (nearRoad(x, z, 3)) continue;
  m.prop(j % 2 ? 'tree_round' : 'tree_fat', at(x, z, -0.05), +(rand() * 6).toFixed(2), +(0.9 + rand() * 0.3).toFixed(2));
}
// Big trees round the village, hay bales, carts and woodpiles.
for (const [x, z] of [[-60, 120], [30, 130], [100, 130], [-100, 128], [70, 76], [-2, 64], [104, 76], [-70, 46], [60, 42], [-104, 30]] as const) {
  m.prop(rand() < 0.5 ? 'oak' : 'nt_common_tree', at(x, z, -0.05), +(rand() * 6).toFixed(2), +(0.9 + rand() * 0.3).toFixed(2));
}
for (const [x, z, model, yaw] of [
  [74, 92, 'hay_bale', 0.3], [76, 90, 'hay_bale', 1.2], [-66, 112, 'hay_bale', 0.1], [50, 96, 'cart', 0.6], [-50, 92, 'cart', -0.3],
  [32, 100, 'woodpile', P], [-30, 112, 'woodpile', 0], [64, 118, 'hay_bale', 0.8], [-80, 112, 'cart', 1.2],
] as const) m.prop(model, at(x, z), yaw);
for (const [x, z] of [[20, 70], [-2, 100], [36, 86], [-28, 64], [56, 64]] as const) m.prop('lantern_post', at(x, z));
// Wheat in the eastern field.
for (let n = 0; n < 60; n++) {
  const x = 46 + rand() * 50;
  const z = 124 + rand() * 10;
  if (nearRoad(x, z, 2.5)) continue;
  m.prop('wheat', at(x, z), +(rand() * 6).toFixed(2), +(1 + rand() * 0.4).toFixed(2), false);
}

// The gully and draw: boulders and bushes for cover on the way up.
for (const [x, z, s] of [[gullyX(4) - 3, 4, 1.4], [gullyX(14) + 3, 14, 1.6], [gullyX(24) - 2.5, 24, 1.3], [gullyX(34) + 2.5, 34, 1.5]] as const) m.prop('rock_large', at(x, z, -0.3), rand() * 6, s);
for (const [x, z] of [[gullyX(9) + 3, 9], [gullyX(19) - 3, 19], [gullyX(29) + 3.2, 29], [gullyX(40) - 3, 40], [drawX(4) + 1, 4], [drawX(16) - 1, 16]] as const) {
  m.prop('nt_bush_leafy', at(x, z), rand() * 6, 1.5, false);
}
// Ruins on the promenade: what is left of the beach villas.
for (const [x, z, yaw, model] of [[-84, -9, 0, 'rn_wall_broken'], [-38, -9.5, 0.1, 'rn_wall_broken'], [60, -9, -0.1, 'rn_wall_broken'], [-8, -10.5, 0.2, 'stone_wall_damaged'], [94, -9, 0, 'stone_wall_damaged']] as const) {
  m.prop(model, at(x, z), yaw);
}
for (const [x, z] of [[-80, -7], [-34, -7], [64, -6.5], [12, -10], [40, -10]] as const) m.prop('debris', at(x, z), rand() * 6, 1.5, false);
// Rock and scree at the cliff foot and on the landslide.
for (let n = 0; n < 500; n++) {
  const x = (rand() - 0.5) * 220;
  const z = zFoot(x) - 0.5 - rand() * 1.5;
  if (Math.abs(x - gullyX(z)) < 10 || Math.abs(x - drawX(z)) < 6 || [-46, 8, -106].some((p) => Math.abs(p - x) < 5)) continue;
  if (rand() < 0.88) continue;
  m.prop(rand() < 0.5 ? 'nt_boulder' : 'rock_small', at(x, z, -0.2), +(rand() * 6).toFixed(2), +(1 + rand()).toFixed(2));
}
for (const [x, z] of [[100, 4], [104, 10], [108, 16], [102, 20]] as const) m.prop('nt_boulder', at(x, z, -0.25), rand() * 6, 1.6);
// Grass and flowers up top.
for (let n = 0; n < 1800 && n < 9999; n++) {
  const x = (rand() - 0.5) * 220;
  const z = 24 + rand() * 108;
  if (nearBuilt(x, z, 2) || nearRoad(x, z, 3) || trenchDepth(x, z) > 0.1) continue;
  if (rand() < 0.9) continue;
  m.prop(rand() < 0.6 ? 'grass_tall' : 'nt_wildflowers', at(x, z), +(rand() * 6).toFixed(2), +(1 + rand()).toFixed(2), false);
}

// ---------------------------------------------------------------- spawns

// Assault: in the lee of the four hulks at the waterline (first, so the route checks run from the beach).
for (const x of HULKS) {
  m.spawn(at(x - 1.3, -88.6), 0, ATK);
  m.spawn(at(x + 1.3, -86.2), 0, ATK);
  m.spawn(at(x - 1.3, -83.8), 0, ATK);
}
// Garrison: the village rear, and a forward group behind the crest.
for (const [x, z] of [[-60, 126], [-44, 124], [-14, 124], [10, 126], [24, 118], [40, 126], [60, 128], [86, 126]] as const) m.spawn(at(x, z), S, DEF);
for (const [x, z] of [[-44, 30], [-6, 32], [60, 30], [100, 28]] as const) m.spawn(at(x, z), S, DEF);

// ---------------------------------------------------------------- pickups

// The landing: kit in the hulks, health and explosives up the beach.
for (const x of HULKS) m.pickup('ammo', at(x + 1.3, -83.6));
m.pickup('health_small', at(-75 + 1.3, -88.6)).pickup('health_small', at(25 + 1.3, -88.6));
m.pickup('grenades', at(-25 + 1.3, -88.6)).pickup('grenades', at(75 + 1.3, -88.6));
m.pickup('weapon_rockets', at(12, -61), 45); // in the middle burnt-out hulk
m.pickup('weapon_launcher', at(-50, -56));
m.pickup('ammo_explosive', at(62, -50));
m.pickup('weapon_smg', at(-90, -41)).pickup('weapon_shotgun', at(36, -37));
m.pickup('armor_small', at(-22, -36));
for (const [x, z, r] of CRATERS.slice(0, 6)) m.pickup('health_small', at(x + r * 0.2, z));
m.pickup('grenades', at(-40, -19.5)).pickup('health_small', at(60, -19.5)).pickup('ammo_rifle', at(-4, -19.5)).pickup('armor_small', at(100, -19.5));
m.pickup('weapon_marksman', at(-100, -9)).pickup('health_large', at(26, -9));
// The bluff: defenders' weapons in the bunkers and trenches.
m.pickup('weapon_lmg', [-7.5, FLOOR, 9.5]);
m.pickup('weapon_rifle', [-31.5, FLOOR, 9.5]).pickup('weapon_rifle', [80.5, FLOOR, 9.5]);
m.pickup('weapon_sniper', [56, FLOOR, 16]).pickup('ammo_sniper', [53, FLOOR, 18]);
m.pickup('weapon_burst_rifle', [-95.5, FLOOR, 9.5]);
m.pickup('ammo_rifle', at(-60, 9)).pickup('ammo_rifle', at(71, 10)).pickup('grenades', at(-24, 24)).pickup('grenades', at(88, 24));
m.pickup('health_small', at(-8, 22)).pickup('health_small', at(70, 24));
m.pickup('mines', at(30, 40));
// The village.
m.pickup('armor_large', [-12, FLOOR, 90]).pickup('health_large', at(20, 86)).pickup('ammo', at(-30, 80));
m.pickup('weapon_shotgun', [8, FLOOR, 72]).pickup('ammo_shells', [-40, FLOOR, 72]);
m.pickup('weapon_rockets', [74, FLOOR, 104], 60).pickup('health_small', at(50, 124)).pickup('health_small', at(-50, 128));

// ---------------------------------------------------------------- King of the Hill (bluff top)

m.hill(at(26, 60), 7).hill(at(-40, 24), 6).hill(at(72, 26), 6);

// ---------------------------------------------------------------- map settings

m.backdrop('overcast', 'ocean', 'water', 0.5, 0.4);
m.bounds('invisible', 0, { min: [-112, -150], max: [112, 134] }, 40);
// The sea off the beach to the south, headland cliffs east and west, woods behind the village.
m.border('cliffs', { south: 'water', north: 'forest' });
m.furnish('home', (x, y) => !(x === VILLAGE.cottage1[0] && y === VILLAGE.cottage1[1]) && !(x === VILLAGE.cottage2[0] && y === VILLAGE.cottage2[1]));
m.furnish('barracks', (x, y) => !(x === 7 && y === 2));
m.lightRooms();
m.meta({
  description:
    'A beach landing. Assault come ashore at the waterline behind beached landing-craft hulks, with three dropships to fly over the bluff, and must cross 70 m of open sand, craters and steel hedgehogs to a concrete seawall (ladders, three gaps and two weak sections you can blow open). The Garrison holds the 16 m bluff above: four bunkers with firing slits joined by a crest trench, MG and rocket turrets with open flanks, two sentries, and the gun casemate (bomb site A). Get up through the gully road, the narrow west draw, the jump pads, the far-west ladder tower or the landslide in the far east. Behind the bluff a farming village of hedgerows and an orchard hides the HQ (bomb site B) under its radar mast, and the Garrison keeps a tank and a buggy for the counter-attack.',
  modes: ['core.bomb', 'core.tdm', 'core.koth'],
  players: [12, 24],
});
await m.save();
