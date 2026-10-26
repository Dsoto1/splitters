/**
 * Sandsweep Circuit: a podrace-style circuit through a red desert canyon.
 * One long lap (about 1 km) round a flat-topped mesa in the middle: a fast
 * start straight along the south wall, a sweeping right-hander up the east
 * side, the twisting "Gully" esses, a crest over the north dunes, a hairpin
 * at the west end and a long run back down to the line. Sentry guns stand on
 * the rocks beside the straights; in a combat race they shoot at whoever
 * passes (in a clean race they sleep). Our own layout and name.
 *
 * Top-down (x east, z north; metres):
 *
 *   z +130        crest ~~~~~~~~ north dunes ~~~~~~~ (the esses come down here)
 *   z  +80  hairpin (                                  ) gully esses
 *   z    0  west run       [  the mesa  ]             east sweep
 *   z  -80                                             )
 *   z -110   <== grid ===|START|========= start straight ===>
 *
 * The canyon walls rise all round the edge. The pit (spawns, a tent, health)
 * sits inside the start straight.
 */
import { TERRAIN_MATERIALS, newTerrain, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('sandsweep', 'Sandsweep Circuit');
m.theme('canyon');
m.backdrop('clear', 'mesas', 'sand', 0.4);

// ---------------------------------------------------------------- the circuit

/** Control points of the road (x, z), run anticlockwise seen from above, from the start line. */
const ROUTE: [number, number][] = [
  [0, -112],
  [55, -114],
  [100, -104],
  [126, -72],
  [128, -30],
  [108, 2],
  [76, 18],
  [66, 46],
  [86, 74],
  [112, 96],
  [100, 124],
  [56, 128],
  [14, 112],
  [-24, 124],
  [-72, 126],
  [-112, 106],
  [-124, 66],
  [-100, 34],
  [-82, 0],
  [-104, -36],
  [-122, -76],
  [-98, -106],
  [-50, -114],
];

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

/** Road height along the route: level start, a rise over the north dunes (the crest), down to the line. */
const roadY = (x: number, z: number) => 1 + bump(x, z, 30, 122, 40, 5) + bump(x, z, -110, 20, 45, 2.5) + bump(x, z, 118, -40, 40, 2);

// ---------------------------------------------------------------- terrain

/** The mesa in the middle: steep sides, a flat top 16 m up. */
const mesa = (x: number, z: number) => 16 * (1 - smooth(34, 46, Math.hypot((x - 2) * 1.0, (z + 18) * 1.25)));
/** Canyon walls all round the edge. */
const walls = (x: number, z: number) => {
  const d = Math.max(Math.abs(x), Math.abs(z));
  return smooth(144, 158, d) * (26 + 4 * Math.sin(x / 13) + 3 * Math.cos(z / 9));
};
/** Rolling dunes, bigger toward the north. */
const dunes = (x: number, z: number) => (1.2 + 0.8 * smooth(-40, 120, z)) * (0.6 * Math.sin(x / 17 + z / 29) + 0.5 * Math.cos(z / 13 - x / 41) + 0.6) + bump(x, z, 30, 140, 30, 3);
/** Shortest distance from (x, z) to the route's legs (control point to control point). */
const routeDistance = (x: number, z: number) => {
  let best = Infinity;
  for (let i = 0; i < ROUTE.length; i++) {
    const [ax, az] = ROUTE[i]!;
    const [bx, bz] = ROUTE[(i + 1) % ROUTE.length]!;
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
};
/**
 * Rock outcrops for the sentries, 31 m off the road beside five straights:
 * a sentry reaches (30 m) only the near edge of the road, so racers can keep
 * to the far side to stay out of its fire.
 */
const PERCHES: [number, number][] = [1, 4, 7, 11, 13, 16, 19].flatMap((i): [number, number][] => {
  const [px, pz] = ROUTE[(i - 1 + ROUTE.length) % ROUTE.length]!;
  const [nx, nz] = ROUTE[(i + 1) % ROUTE.length]!;
  const l = Math.hypot(nx - px, nz - pz);
  const [x, z] = ROUTE[i]!;
  for (const side of [1, -1]) {
    const q: [number, number] = [Math.round(x + ((nz - pz) / l) * 31 * side), Math.round(z - ((nx - px) / l) * 31 * side)];
    if (Math.max(Math.abs(q[0]), Math.abs(q[1])) < 136 && routeDistance(q[0], q[1]) > 29 && mesa(q[0], q[1]) < 1) return [q];
  }
  return [];
}).slice(0, 5);
const perch = (x: number, z: number) => Math.max(...PERCHES.map(([px, pz]) => 4.5 * (1 - smooth(4, 7, Math.hypot(x - px, z - pz)))));

function height(x: number, z: number): number {
  return Math.max(dunes(x, z) + roadY(x, z) - 1, mesa(x, z), walls(x, z), perch(x, z) + dunes(x, z));
}

let terrain: TerrainData = { ...newTerrain(320, 2, [0, 0], 'sand'), baseY: -0.15 };
terrain = {
  ...terrain,
  heights: terrain.heights.map((_, i) => {
    const c = i % terrain.cols;
    const r = Math.floor(i / terrain.cols);
    return Math.round(height(terrain.origin[0] + c * terrain.spacing, terrain.origin[1] + r * terrain.spacing) * 100);
  }),
};
const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
const cellXZ = (i: number): [number, number] => {
  const c = i % (terrain.cols - 1);
  const r = Math.floor(i / (terrain.cols - 1));
  return [terrain.origin[0] + (c + 0.5) * terrain.spacing, terrain.origin[1] + (r + 0.5) * terrain.spacing];
};
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const [x, z] = cellXZ(i);
    if (mesa(x, z) > 3 || walls(x, z) > 3 || perch(x, z) > 1) return mat('stone');
    // The pit apron inside the start straight.
    if (Math.abs(x) < 26 && z > -100 && z < -84) return mat('gravel');
    return v;
  }),
  foliage: [],
};
terrain = paintSlopes(terrain, 30, 'stone');
m.terrain(terrain);

// The road, laid into the ground (flat under it, the shoulders blended into the dunes).
m.track({
  points: ROUTE.map(([x, z]) => [x, +roadY(x, z).toFixed(2), z]),
  width: 14,
  loop: true,
  laps: 3,
  grid: 8,
  vehicle: 'speeder',
  combat: true,
  surface: 'dirt',
  curbs: true,
});
const laid = m.doc.terrain!;
const ground = (x: number, z: number) => +(terrainHeightAt(laid, x, z) ?? 0).toFixed(2);

// ---------------------------------------------------------------- pit, spawns and pickups

// Spawns in the pit (the race puts everyone in their vehicle straight away).
for (let i = 0; i < 8; i++) {
  const x = -21 + i * 6;
  m.spawn([x, ground(x, -92), -92], Math.PI / 2);
}
m.prop('tent_canvas', [-6, ground(-6, -86), -86], Math.PI).prop('tent_canvas', [6, ground(6, -86), -86], Math.PI);
m.prop('crate_large', [-14, ground(-14, -86), -86], 0.2).prop('barrel', [14, ground(14, -86), -86]).prop('barrel', [15, ground(15, -87.2), -87.2]);
m.pickup('health_large', [0, ground(0, -95), -95]).pickup('armor_small', [10, ground(10, -95), -95]).pickup('ammo_rifle', [-10, ground(-10, -95), -95]);
m.prop('banner_long', [-24, ground(-24, -100), -100], Math.PI / 2).prop('banner_long', [24, ground(24, -100), -100], Math.PI / 2);

// ---------------------------------------------------------------- sideline guns

for (const [x, z] of PERCHES) {
  const yaw = Math.atan2(-x, -z);
  m.mount('sentry', [x, ground(x, z), z], +yaw.toFixed(3), null);
}

// ---------------------------------------------------------------- scenery

const roadPts = ROUTE;
let seed = 19990519;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
/** Clear of the road (the curve between control points too: check along each leg), the pit and the perches. */
const clear = (x: number, z: number, r: number) => {
  for (let i = 0; i < roadPts.length; i++) {
    const [ax, az] = roadPts[i]!;
    const [bx, bz] = roadPts[(i + 1) % roadPts.length]!;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < 17 + r) return false;
    }
  }
  if (Math.abs(x) < 34 && z > -104 && z < -78) return false;
  return PERCHES.every(([px, pz]) => Math.hypot(x - px, z - pz) > 8 + r) && Math.max(Math.abs(x), Math.abs(z)) < 142;
};
const scatter = (model: string, n: number, r: number, scale: [number, number]) => {
  for (let placed = 0, tries = 0; placed < n && tries < n * 40; tries++) {
    const x = +(rand() * 280 - 140).toFixed(1);
    const z = +(rand() * 280 - 140).toFixed(1);
    if (!clear(x, z, r) || mesa(x, z) > 1) continue;
    m.prop(model, [x, ground(x, z), z], +(rand() * Math.PI * 2).toFixed(2), +(scale[0] + rand() * (scale[1] - scale[0])).toFixed(2));
    placed++;
  }
};
scatter('boulder_jagged', 14, 4, [0.8, 1.6]);
scatter('rock_spire_tall', 10, 3, [1, 2.2]);
scatter('boulder_round', 6, 5, [0.7, 1.2]);
scatter('cactus_tall', 22, 1, [0.8, 1.3]);
scatter('cactus', 26, 1, [0.8, 1.4]);
scatter('rock_large', 18, 2, [0.8, 1.5]);
// Rock spires on the mesa top.
for (const [x, z] of [[-8, -24], [12, -10], [4, -30]] as const) m.prop('rocks_tall', [x, ground(x, z), z], 0.4, 1.6);

m.meta({
  description:
    'A podrace circuit through a red desert canyon: about a kilometre a lap round the mesa, with a fast start straight, the twisting Gully esses, a crest over the north dunes and a hairpin at the west end. Sentry guns on the rocks shoot at passing racers in a combat race. Race in speeders (the pilot fires twin blasters ahead), or drive it in any vehicle in Deathmatch.',
  modes: ['core.race', 'core.deathmatch'],
  players: [2, 8],
});
await m.save();
