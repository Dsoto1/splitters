/**
 * Apex Ring: a Grand Prix circuit (our own layout and name; no real circuit,
 * team or sponsor). A 1.37 km lap in single-seat karts, with twelve NPC race
 * cars (track.ambient) lapping it in every mode: they belong to nobody, run
 * down anyone on the road, can be shot up or hijacked, and come back out of
 * the pit exit when wrecked. The fight is round them: in the pit garages, on
 * the grandstands, the footbridge, the tunnel suites and the paddock.
 *
 * Top-down (x east, z north; metres). The lap runs anticlockwise from the
 * start line at x 0 on the main straight:
 *
 *   z +142   NW ( === Skyline tunnel (suites over the road) ===  ~~chicane~~  ) NE
 *   z  +40   west     [infield lounge]           [helipad]        east sweeper
 *   z    0   side  ( === infield straight ===> hairpin )  hairpin stand
 *   z  -38        ( <=== return straight =====  )             paddock club
 *   z  -80   last  [ pit building: 10 garages, tower ] pit exit     T1
 *   z -110   corner =FOOTBRIDGE== grid ===|START|=== main straight ===> )
 *   z -130          [ main grandstand, commentary boxes on top ]
 *   z -170          fan zone, podium stage, stalls
 *
 * Teams: Embers hold the west garages and the west paddock strip, Tide the
 * east garages and the east paddock; CTF flags stand in the two end garages.
 * KOTH: the podium stage, the race control tower deck and the footbridge.
 * Snipers on the commentary boxes, the tower and the hairpin booth; SMGs and
 * shotguns in the garages; rockets on the footbridge; armour in hospitality.
 */
import { TERRAIN_MATERIALS, Track, TrackGeometry, newTerrain, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('apex_ring', 'Apex Ring');
m.theme('city');
m.backdrop('clear', 'city', 'grass', 0.35);
m.teams([8, 8]);
const [WEST, EAST] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Mat = { material: string; tint?: string };
const P = Math.PI / 2;
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- materials

const CONC: Mat = { material: 'pbr_concrete' };
const CONC_DARK: Mat = { material: 'pbr_concrete_dark' };
const WHITE: Mat = { material: 'pbr_white_panel' };
const GLASS: Mat = { material: 'pbr_glass_facade' };
const STEEL: Mat = { material: 'pbr_steel' };
const FLOOR: Mat = { material: 'pbr_terrazzo' };
const EPOXY: Mat = { material: 'paint_gloss', tint: '#5a5f66' }; // garage floors
const ASPHALT: Mat = { material: 'pbr_asphalt' };
const TYRE: Mat = { material: 'paint_matte', tint: '#1c1c1e' };
const RED: Mat = { material: 'paint_matte', tint: '#c8302a' };
const PAINT_W: Mat = { material: 'paint_matte', tint: '#efefea' };
const SEAT_A: Mat = { material: 'paint_matte', tint: '#2f5fa8' };
const SEAT_B: Mat = { material: 'paint_matte', tint: '#3a6fbe' };
const SEAT_C: Mat = { material: 'paint_matte', tint: '#d9a62a' };
const LAMP_RED: Mat = { material: 'light_strip', tint: '#ff2a1a' };
const LAMP_W: Mat = { material: 'light_strip', tint: '#f4f4ff' };
const EMBER: Mat = { material: 'paint_gloss', tint: '#c9542e' };
const TIDE: Mat = { material: 'paint_gloss', tint: '#2f7fc8' };

// ---------------------------------------------------------------- block helpers

/** A solid box from min to max corner (split into pieces no bigger than blocks allow). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: Mat): void {
  if (x1 - x0 < 0.04 || z1 - z0 < 0.04 || y1 - y0 < 0.02) return;
  if (y1 - y0 < 0.101) y0 = y1 - 0.101;
  if (x1 - x0 < 0.201) [x0, x1] = [(x0 + x1) / 2 - 0.101, (x0 + x1) / 2 + 0.101];
  if (z1 - z0 < 0.201) [z0, z1] = [(z0 + z1) / 2 - 0.101, (z0 + z1) / 2 + 0.101];
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  if (w > 64 || d > 64 || h > 32) {
    const nx = Math.ceil(w / 64);
    const nz = Math.ceil(d / 64);
    const ny = Math.ceil(h / 32);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        for (let k = 0; k < ny; k++) box(x0 + (w * i) / nx, y0 + (h * k) / ny, z0 + (d * j) / nz, x0 + (w * (i + 1)) / nx, y0 + (h * (k + 1)) / ny, z0 + (d * (j + 1)) / nz, mat);
    return;
  }
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(w), r2(h), r2(d)], 'solid', mat);
}

/** A turned block: centre (x, z), base y, `len` along the heading `yaw`, `thick` across. */
function turned(x: number, y: number, z: number, len: number, h: number, thick: number, yaw: number, mat: Mat): void {
  m.block([r2(x), r2(y), r2(z)], [r2(thick), r2(h), r2(len)], 'solid', { ...mat, yaw: +yaw.toFixed(4) });
}

/** An opening in a wall run: centre along the run, width, bottom and top above the wall's base. */
interface Hole {
  c: number;
  w: number;
  b: number;
  t: number;
}

/**
 * A wall along x (`axis` 'x': from a0 to a1 in x, c0..c1 in z) or along z,
 * from y0 to y1, with openings cut out (piers between, sills below, lintels above).
 */
function wall(axis: 'x' | 'z', a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, holes: Hole[], mat: Mat): void {
  const seg = (s0: number, s1: number, b: number, t: number) => {
    if (s1 - s0 < 0.05 || t - b < 0.05) return;
    if (axis === 'x') box(s0, y0 + b, c0, s1, y0 + t, c1, mat);
    else box(c0, y0 + b, s0, c1, y0 + t, s1, mat);
  };
  const h = y1 - y0;
  const cut = holes
    .map((o) => ({ s0: o.c - o.w / 2, s1: o.c + o.w / 2, b: o.b, t: Math.min(h, o.t) }))
    .filter((o) => o.s0 > a0 + 0.2 && o.s1 < a1 - 0.2)
    .sort((p, q) => p.s0 - q.s0);
  let s = a0;
  for (const o of cut) {
    if (o.s0 < s) continue;
    seg(s, o.s0, 0, h);
    seg(o.s0, o.s1, 0, o.b);
    seg(o.s0, o.s1, o.t, h);
    s = o.s1;
  }
  seg(s, a1, 0, h);
}

/** Windows every `every` metres along a run (skipping near the given doors). */
const windows = (a0: number, a1: number, every: number, w: number, b: number, t: number, avoid: number[] = []): Hole[] => {
  const n = Math.floor((a1 - a0) / every);
  const out: Hole[] = [];
  for (let i = 0; i < n; i++) {
    const c = a0 + ((i + 0.5) * (a1 - a0)) / n;
    if (avoid.some((d) => Math.abs(d - c) < w / 2 + 1.8)) continue;
    out.push({ c, w, b, t });
  }
  return out;
};

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Rectangle minus a hole (up to four rectangles). */
function minus(r: Rect, hole: Rect | null): Rect[] {
  if (!hole) return [r];
  const out: Rect[] = [];
  if (hole.z0 > r.z0) out.push({ ...r, z1: hole.z0 });
  if (hole.z1 < r.z1) out.push({ ...r, z0: hole.z1 });
  if (hole.x0 > r.x0) out.push({ x0: r.x0, x1: hole.x0, z0: Math.max(r.z0, hole.z0), z1: Math.min(r.z1, hole.z1) });
  if (hole.x1 < r.x1) out.push({ x0: hole.x1, x1: r.x1, z0: Math.max(r.z0, hole.z0), z1: Math.min(r.z1, hole.z1) });
  return out;
}
const slab = (r: Rect, y0: number, y1: number, mat: Mat) => box(r.x0, y0, r.z0, r.x1, y1, r.z1, mat);

const TREAD = 0.5;
/**
 * A straight flight of steps (at most 0.25 m rise, 0.5 m tread) from yBase to
 * yTop, climbing along `axis` in direction `dir` from `a` (the foot), across
 * l0..l0+width. Returns the end of the flight along the axis (the top edge).
 */
function flight(axis: 'x' | 'z', dir: 1 | -1, a: number, l0: number, width: number, yBase: number, yTop: number, mat: Mat, ground = yBase): number {
  const steps = Math.ceil((yTop - yBase) / 0.25 - 1e-6);
  const rise = (yTop - yBase) / steps;
  for (let i = 0; i < steps; i++) {
    const s0 = a + dir * i * TREAD;
    const s1 = a + dir * (i + 1) * TREAD;
    const [lo, hi] = [Math.min(s0, s1), Math.max(s0, s1)];
    if (axis === 'z') box(l0, ground, lo, l0 + width, yBase + (i + 1) * rise, hi, mat);
    else box(lo, ground, l0, hi, yBase + (i + 1) * rise, l0 + width, mat);
  }
  return a + dir * steps * TREAD;
}

/** A railing (a 1.05 m solid half wall, 0.2 thick) from (x0, z0) to (x1, z1), axis aligned, standing on y. */
function rail(x0: number, z0: number, x1: number, z1: number, y: number, mat: Mat = STEEL): void {
  if (Math.abs(x1 - x0) >= Math.abs(z1 - z0)) box(Math.min(x0, x1), y, z0 - 0.1, Math.max(x0, x1), y + 1.05, z0 + 0.1, mat);
  else box(x0 - 0.1, y, Math.min(z0, z1), x0 + 0.1, y + 1.05, Math.max(z0, z1), mat);
}

// ---------------------------------------------------------------- the circuit

/** Road centre line (x, z), anticlockwise from the start line. */
const ROUTE: [number, number][] = [
  [0, -110], [50, -110], [100, -110], // main straight
  [136, -100], [155, -74], // turn 1
  [164, -36], [166, 4], [160, 44], [144, 78], // the east sweeper
  [118, 104], [84, 128], [50, 140], // north-east
  [30, 141], [16, 139], [6, 131], [-6, 129], [-16, 135], [-30, 141], // the chicane
  [-60, 142], [-100, 142], // the Skyline tunnel
  [-136, 134], [-158, 110], [-166, 72], [-164, 34], // north-west and the west side
  [-152, 10], [-126, 0], [-80, 0], [-30, 0], [12, 0], // into the infield straight
  [32, -6], [41, -19], [33, -32], [12, -38], // the hairpin
  [-40, -38], [-96, -38], // return straight
  [-128, -46], [-150, -66], [-152, -92], [-136, -107], // last corners
  [-100, -110], [-50, -110],
];
const WIDTH = 14;
const HALF = WIDTH / 2;
/** Where wrecked NPC cars come back: the pit exit, lined up behind this point facing down the road. */
const PIT: V3 = [100, 0.05, -95];
const track = Track.parse({
  points: ROUTE.map(([x, z]) => [x, 0, z]),
  width: WIDTH,
  loop: true,
  laps: 3,
  grid: 16,
  vehicle: 'kart',
  combat: false,
  surface: 'asphalt',
  curbs: true,
  ambient: 12,
  ambientVehicle: 'kart',
  pit: PIT,
});
const g = new TrackGeometry(track);
const sOf = (i: number) => g.nearest(ROUTE[i]![0], ROUTE[i]![1])!.sample.s;
/** Distance from the road's edge (negative on the road). */
const offRoad = (x: number, z: number) => {
  const n = g.nearest(x, z, 400);
  return n ? Math.abs(n.lateral) - HALF : Infinity;
};
/** Distance from the road edge, measuring to the nearest centre-line sample (ignores which side). */
const roadGap = (x: number, z: number) => {
  const n = g.nearest(x, z, 400);
  return n ? n.dist - HALF : Infinity;
};

// ---------------------------------------------------------------- terrain

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Grass banks beyond the north, east and west of the circuit (the south stays flat for the fan zone). */
const hills = (x: number, z: number) =>
  Math.max(smooth(170, 199, z) * (8 + 3 * Math.sin(x / 27) + 2 * Math.cos(x / 11)), smooth(184, 199, x) * (6 + 2 * Math.sin(z / 19)), smooth(184, 199, -x) * (6 + 2 * Math.cos(z / 23)));

/** Gravel traps on the outside of the corners: from control point i to j, this deep beyond the road edge. */
const TRAPS: { from: number; to: number; depth: number; ground: TerrainMaterial; pad: [number, number] }[] = [
  { from: 2, to: 5, depth: 20, ground: 'gravel', pad: [0, 10] }, // turn 1
  { from: 8, to: 10, depth: 14, ground: 'gravel', pad: [10, 10] }, // north-east
  { from: 19, to: 22, depth: 14, ground: 'gravel', pad: [10, 10] }, // north-west
  { from: 23, to: 25, depth: 12, ground: 'gravel', pad: [10, 0] }, // into the infield
  { from: 28, to: 32, depth: 12, ground: 'sand', pad: [0, 0] }, // the hairpin (outside is on the left)
  { from: 35, to: 38, depth: 14, ground: 'gravel', pad: [10, 10] }, // last corners
];
/** Outside of a corner: right of travel (+) on this anticlockwise lap, left at the right-hand hairpin. */
const trapSide = (t: (typeof TRAPS)[number]) => (t.from === 28 ? -1 : 1);
const inTrap = (x: number, z: number): TerrainMaterial | null => {
  const n = g.nearest(x, z, 60);
  if (!n) return null;
  for (const t of TRAPS) {
    const [s0, s1] = [sOf(t.from), sOf(t.to)];
    if (n.sample.s < s0 || n.sample.s > s1) continue;
    const d = n.lateral * trapSide(t);
    if (d > HALF + 0.5 && d < HALF + t.depth) return t.ground;
  }
  return null;
};

/** Areas painted gravel underfoot: the paddocks and the fan zone. */
const PAVED: Rect[] = [
  { x0: -128, x1: 124, z0: -194, z1: -150 }, // fan zone
  { x0: -82, x1: 30, z0: -71, z1: -47 }, // west paddock strip behind the garages
  { x0: 36, x1: 132, z0: -86, z1: -46 }, // east paddock
];
const inRect = (r: Rect, x: number, z: number, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

let terrain: TerrainData = { ...newTerrain(400, 2.5, [0, 0], 'grass'), baseY: -0.15 };
terrain = {
  ...terrain,
  heights: terrain.heights.map((_, i) => {
    const c = i % terrain.cols;
    const r = Math.floor(i / terrain.cols);
    return Math.round((hills(terrain.origin[0] + c * terrain.spacing, terrain.origin[1] + r * terrain.spacing) + 0.15) * 100);
  }),
};
const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const c = i % (terrain.cols - 1);
    const r = Math.floor(i / (terrain.cols - 1));
    const x = terrain.origin[0] + (c + 0.5) * terrain.spacing;
    const z = terrain.origin[1] + (r + 0.5) * terrain.spacing;
    const trap = inTrap(x, z);
    if (trap) return mat(trap);
    if (PAVED.some((p) => inRect(p, x, z))) return mat('gravel');
    return v;
  }),
};
m.terrain(terrain);
// The road, laid into the ground.
m.track(track);

// ---------------------------------------------------------------- run-off: tyre walls and barriers

/** Keep-out boxes: everything built, plus the pit and paddock aprons (filled in as we go). */
const BUILT: Rect[] = [
  { x0: -88, x1: 40, z0: -102, z1: -45 }, // pit building, apron, west paddock
  { x0: 30, x1: 140, z0: -102, z1: -44 }, // east paddock
  { x0: 58, x1: 92, z0: -44, z1: 8 }, // hairpin stand
  { x0: 104, x1: 132, z0: 16, z1: 44 }, // helipad
  { x0: -70, x1: -30, z0: 30, z1: 60 }, // lounge
  { x0: -116, x1: -44, z0: 120, z1: 160 }, // tunnel
  { x0: -125, x1: 125, z0: -200, z1: -118 }, // stand and fan zone
  { x0: -120, x1: -110, z0: -142, z1: -78 }, // footbridge
];


/** Walls along the road: segments `seg` long at `off` metres right (+) or left (−) of the centre line, from s0 to s1. */
function alongRoad(s0: number, s1: number, side: 1 | -1, off: number, seg: number, place: (x: number, z: number, len: number, yaw: number, k: number) => void, gapEvery = 0): void {
  let k = 0;
  for (let s = s0; s + seg <= s1 + 0.01; s += seg, k++) {
    if (gapEvery && s - s0 > 8 && (s - s0) % gapEvery < seg) continue; // a way through every so often
    const a = g.at(s);
    const b = g.at(s + seg);
    const ax = a.x + a.dz * off * side;
    const az = a.z - a.dx * off * side;
    const bx = b.x + b.dz * off * side;
    const bz = b.z - b.dx * off * side;
    const cx = (ax + bx) / 2;
    const cz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az);
    // Folded back on itself, or too near another stretch of road: leave it out.
    if (len < seg * 0.5 || roadGap(cx, cz) < 1.5) continue;
    place(cx, cz, len + 0.15, Math.atan2(bx - ax, bz - az), k);
  }
}

// Tyre walls at the back of every gravel trap: black stacks, banded red and white along the top.
for (const t of TRAPS) {
  alongRoad(sOf(t.from) - t.pad[0], sOf(t.to) + t.pad[1], trapSide(t) as 1 | -1, HALF + t.depth + 0.6, 2.4, (x, z, len, yaw, k) => {
    if (BUILT.some((b) => inRect(b, x, z, 1))) return;
    turned(x, -0.2, z, len, 1.1, 1.2, yaw, TYRE);
    turned(x, 0.9, z, len - 0.05, 0.22, 1.24, yaw, k % 2 ? RED : PAINT_W);
  });
}

/** Concrete barriers on the outside of the straights (with gaps to cross), avoiding the structures. */
const NO_BARRIER: Rect[] = [
  { x0: -100, x1: -60, z0: 120, z1: 165 }, // the tunnel
  { x0: -36, x1: 36, z0: 120, z1: 160 }, // the chicane (open run-off)
];
const barrier = (s0: number, s1: number, side: 1 | -1) =>
  alongRoad(s0, s1, side, HALF + 3, 6, (x, z, len, yaw, k) => {
    if (NO_BARRIER.some((r) => inRect(r, x, z)) || BUILT.some((b) => inRect(b, x, z, 1))) return;
    turned(x, -0.2, z, len, 1.3, 0.6, yaw, CONC);
    if (k % 3 === 0) turned(x, 1.1, z, len - 0.1, 0.12, 0.64, yaw, RED);
  }, 54);
barrier(sOf(5) + 10, sOf(8) - 10, 1); // east sweeper
barrier(sOf(10) + 10, sOf(19) - 4, 1); // north straight
barrier(sOf(22) - 6, sOf(23) + 8, 1); // west side
barrier(sOf(26), sOf(28) - 4, 1); // infield straight (the median towards the return straight)

// ---------------------------------------------------------------- pit lane, pit wall, start gantry

// Pit lane apron (asphalt), from the pit entry by the last corner to the pit exit before turn 1.
box(-86, -0.3, -101, 108, 0.05, -88, ASPHALT);
// Pit-exit lines on the apron (thin, flush) and cones to the side.
box(30, 0.05, -101, 108, 0.06, -100.8, PAINT_W);
for (let x = 36; x <= 104; x += 8) m.prop('cone', [x, 0.06, -88.8], 0, 1, false);
// Pit wall: concrete with a red cap, the length of the garages.
box(-78, -0.2, -101.6, 26, 1.2, -101, CONC);
box(-78, 1.2, -101.65, 26, 1.32, -100.95, RED);
// Pit wall stands: a timing screen and a canopy on two posts.
for (const x of [-62, -42, -22, 12]) {
  box(x - 1.6, 1.2, -101.5, x - 1.4, 3.4, -101.1, STEEL);
  box(x + 1.4, 1.2, -101.5, x + 1.6, 3.4, -101.1, STEEL);
  box(x - 2, 3.4, -101.8, x + 2, 3.6, -99, WHITE);
  m.prop('screen_panel', [x, 1.32, -101.3], Math.PI, 0.8, false);
}
// Start-light gantry across the road at the line: posts outside each edge, a beam overhead, five red lamps.
box(-0.4, -0.2, -122.8, 0.4, 7.8, -122, STEEL);
box(-0.4, -0.2, -100.9, 0.4, 7.8, -100.1, STEEL);
box(-0.5, 7, -122.8, 0.5, 7.9, -100.1, STEEL);
for (let i = 0; i < 5; i++) box(-0.75, 7.15, -114.4 + i * 2.2, -0.5, 7.75, -113.4 + i * 2.2, LAMP_RED);
m.light([-1.6, 7.4, -110], { fixture: 'none', color: '#ff3a22', intensity: 1.2, range: 10 });
// Start/finish line board on the beam.
box(0.5, 7.1, -118, 0.62, 7.8, -116, LAMP_W);

// ---------------------------------------------------------------- the pit building: ten garages

const PB = { x0: -70, x1: 30, z0: -88, z1: -72 };
const GW = 10;
const GH = 4.6; // garage ceiling
const ROOF_Y = 4.9;
const T = 0.4;
const garageX = (i: number) => PB.x0 + GW / 2 + i * GW;
slab({ x0: PB.x0 + T, x1: PB.x1 - T, z0: PB.z0 + T, z1: PB.z1 - T }, -0.3, 0.1, EPOXY);
// Front onto the pit lane: a wide opening per garage, a team-coloured fascia over it.
wall('x', PB.x0, PB.x1, PB.z0, PB.z0 + T, 0, GH, Array.from({ length: 10 }, (_, i) => ({ c: garageX(i), w: 7, b: 0, t: 3.8 })), WHITE);
for (let i = 0; i < 10; i++) box(garageX(i) - 3.6, 3.85, PB.z0 - 0.15, garageX(i) + 3.6, 4.45, PB.z0, i < 5 ? EMBER : TIDE);
// Back onto the paddock: a door per garage and a window.
wall('x', PB.x0, PB.x1, PB.z1 - T, PB.z1, 0, GH, Array.from({ length: 10 }, (_, i) => [{ c: garageX(i) - 1, w: 2.4, b: 0, t: 3 }, { c: garageX(i) + 2.8, w: 2.2, b: 1.1, t: 2.6 }]).flat(), WHITE);
// End walls with a door near the front (the roof stairs run up the back half).
wall('z', PB.z0 + T, PB.z1 - T, PB.x0, PB.x0 + T, 0, GH, [{ c: -86, w: 2.4, b: 0, t: 3 }], WHITE);
wall('z', PB.z0 + T, PB.z1 - T, PB.x1 - T, PB.x1, 0, GH, [{ c: -86, w: 2.4, b: 0, t: 3 }], WHITE);
// Dividers between garages, a doorway through each: fight room to room.
for (let i = 1; i < 10; i++) {
  const x = PB.x0 + i * GW;
  wall('z', PB.z0 + T, PB.z1 - T, x - 0.15, x + 0.15, 0, GH, [{ c: -79, w: 2.4, b: 0, t: 3 }], CONC);
}
// Roof (a terrace for the paddock club, with the race control tower in the middle).
slab(PB, GH, ROOF_Y, CONC_DARK);
rail(PB.x0, PB.z0 + 0.1, -7, PB.z0 + 0.1, ROOF_Y, GLASS);
rail(7, PB.z0 + 0.1, PB.x1, PB.z0 + 0.1, ROOF_Y, GLASS);
rail(PB.x0, PB.z1 - 0.1, -7, PB.z1 - 0.1, ROOF_Y);
rail(7, PB.z1 - 0.1, PB.x1, PB.z1 - 0.1, ROOF_Y);
rail(PB.x0 + 0.1, PB.z0, PB.x0 + 0.1, -74.2, ROOF_Y);
rail(PB.x1 - 0.1, PB.z0, PB.x1 - 0.1, -74.2, ROOF_Y);
// Roof stairs outside each end: up the back half to a landing at the roof's corner.
for (const [x0, x1] of [[PB.x0 - 2.8, PB.x0], [PB.x1, PB.x1 + 2.8]] as const) {
  const top = flight('z', 1, -84.2, x0, 2.6, 0, ROOF_Y, CONC_DARK);
  box(x0, -0.2, top, x1, ROOF_Y, -71.2, CONC_DARK);
}
// Garage lights and kit: tool racks, tyre stacks, fuel rigs.
const tyreStack = (x: number, z: number, n = 4) => {
  for (let k = 0; k < n; k++) m.block([r2(x), r2(0.1 + k * 0.26), r2(z)], [0.64, 0.25, 0.64], 'solid', { ...TYRE, yaw: k % 2 ? Math.PI / 4 : 0 });
};
for (let i = 0; i < 10; i++) {
  const cx = garageX(i);
  m.light([cx, GH - 0.5, -80], { color: '#f4f6ff', intensity: 1.1, range: 10, fixture: 'strip' });
  m.prop('shelf_boxes', [cx - 3.6, 0.1, -73.6], Math.PI);
  m.prop('workbench', [cx + 3.8, 0.1, -76.2], -P);
  m.prop('hm_shelf_large', [cx + 4.3, 0.1, -82.5], -P);
  tyreStack(cx - 4.1, -86.6);
  tyreStack(cx - 4.1, -85.8, 3);
  if (i % 2) m.breakable('barrel', [cx + 3.9, 0.1, -86.4]);
  else m.breakable('gas', [cx + 4.1, 0.1, -86.6]);
  m.prop('sv_gas_can', [cx + 4.2, 0.1, -84.4], 0.4);
  m.prop('sv_gas_can', [cx + 4.3, 0.1, -84.9], 1.3);
  m.prop('cardboard_box', [cx - 4.2, 0.1, -76], 0.2);
}

// ---------------------------------------------------------------- race control tower (on the pit roof)

{
  const R = { x0: -7, x1: 7, z0: PB.z0, z1: PB.z1 };
  const inner = { x0: R.x0 + T, x1: R.x1 - T, z0: R.z0 + T, z1: R.z1 - T };
  const Y1 = ROOF_Y;
  const Y2 = Y1 + 4;
  const Y3 = Y2 + 4;
  // Storey 1: wide windows to the track, doors west and east by the front.
  wall('x', R.x0, R.x1, R.z0, R.z0 + T, Y1, Y2 - 0.3, windows(R.x0, R.x1, 4, 3, 1, 3.4), GLASS);
  wall('x', R.x0, R.x1, R.z1 - T, R.z1, Y1, Y2 - 0.3, windows(R.x0, R.x1, 5, 2, 1.1, 2.8), WHITE);
  wall('z', R.z0 + T, R.z1 - T, R.x0, R.x0 + T, Y1, Y2 - 0.3, [{ c: -86, w: 2.2, b: 0, t: 3 }], WHITE);
  wall('z', R.z0 + T, R.z1 - T, R.x1 - T, R.x1, Y1, Y2 - 0.3, [{ c: -86, w: 2.2, b: 0, t: 3 }, { c: -78, w: 2.4, b: 1.1, t: 2.8 }], WHITE);
  // Switchback stairs: up north on the west side, then back south beside it.
  flight('z', 1, -84, inner.x0, 2.6, Y1, Y2, CONC);
  const holeA = { x0: inner.x0, x1: inner.x0 + 2.6, z0: -84, z1: -76 };
  for (const part of minus(inner, holeA)) slab(part, Y2 - 0.3, Y2, FLOOR);
  flight('z', -1, -76, inner.x0 + 2.6, 2.6, Y2, Y3, CONC);
  // Storey 2: race control, windows all round.
  wall('x', R.x0, R.x1, R.z0, R.z0 + T, Y2, Y3 - 0.3, windows(R.x0, R.x1, 3.5, 2.6, 1, 2.9), GLASS);
  wall('x', R.x0, R.x1, R.z1 - T, R.z1, Y2, Y3 - 0.3, windows(R.x0, R.x1, 4, 2.4, 1.1, 2.8), GLASS);
  wall('z', R.z0 + T, R.z1 - T, R.x0, R.x0 + T, Y2, Y3 - 0.3, windows(R.z0 + T, R.z1 - T, 5, 2.2, 1.1, 2.8, [-80]), GLASS);
  wall('z', R.z0 + T, R.z1 - T, R.x1 - T, R.x1, Y2, Y3 - 0.3, windows(R.z0 + T, R.z1 - T, 4, 2.2, 1.1, 2.8), GLASS);
  const holeB = { x0: inner.x0 + 2.6, x1: inner.x0 + 5.2, z0: -84, z1: -76 };
  for (const part of minus({ x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1 }, holeB)) slab(part, Y3 - 0.3, Y3, CONC_DARK);
  // The top deck: railings, the timing board on the front, a mast.
  rail(R.x0, R.z0 + 0.1, R.x1, R.z0 + 0.1, Y3, GLASS);
  rail(R.x0, R.z1 - 0.1, R.x1, R.z1 - 0.1, Y3, GLASS);
  rail(R.x0 + 0.1, R.z0, R.x0 + 0.1, R.z1, Y3, GLASS);
  rail(R.x1 - 0.1, R.z0, R.x1 - 0.1, R.z1, Y3, GLASS);
  box(-5, Y2 + 0.4, R.z0 - 0.25, 5, Y2 + 0.9, R.z0, LAMP_W);
  box(4.6, Y3, -74.6, 5, Y3 + 5, -74.2, STEEL);
  m.prop('computer_wide', [3.2, Y2, -86.6], Math.PI);
  m.prop('computer', [-0.4, Y2, -86.6], Math.PI);
  m.prop('office_chair', [3.2, Y2, -85.4], 0);
  m.prop('desk', [3.4, Y1, -86.6], Math.PI);
  m.light([0, Y2 - 0.6, -80], { color: '#f4f6ff', intensity: 1, range: 10 });
  m.light([2, Y3 - 0.6, -80], { color: '#f4f6ff', intensity: 1, range: 10 });
}

// ---------------------------------------------------------------- main grandstand and commentary boxes

const GS = { x0: -100, x1: 96, front: -124, tiers: 12, back: -146 };
const AISLES = [-76, -28, 28, 76];
const seat = (k: number) => (k % 4 === 3 ? SEAT_C : k % 2 ? SEAT_B : SEAT_A);
// The track-side wall south of the main straight (open at both ends).
box(-100, -0.2, -121, 100, 1.3, -120.4, CONC);
box(-100, 1.3, -121.05, 100, 1.42, -120.35, RED);
for (let k = 0; k < GS.tiers; k++) {
  const z1 = GS.front - k;
  const z0 = k === GS.tiers - 1 ? GS.back : z1 - 1;
  box(GS.x0, -0.3, z0, GS.x1, (k + 1) * 0.5, z1, k === GS.tiers - 1 ? CONC : seat(k));
  // Aisle steps: half a tier at the back of the tier below.
  for (const a of AISLES) box(a - 1.3, k ? k * 0.5 : -0.3, z1, a + 1.3, k * 0.5 + 0.25, z1 + 0.5, CONC);
}
const DECK = GS.tiers * 0.5;
// Railings: the front of the stand between aisles, its ends, the back of the deck.
{
  const gaps = [GS.x0, ...AISLES.flatMap((a) => [a - 1.4, a + 1.4]), GS.x1];
  for (let i = 0; i < gaps.length; i += 2) rail(gaps[i]!, GS.front - 0.1, gaps[i + 1]!, GS.front - 0.1, 0.5);
  for (let k = 0; k < GS.tiers; k++) {
    const z1 = GS.front - k;
    const z0 = k === GS.tiers - 1 ? GS.back : z1 - 1;
    box(GS.x0, (k + 1) * 0.5, z0, GS.x0 + 0.2, (k + 1) * 0.5 + 1.05, z1, STEEL);
    box(GS.x1 - 0.2, (k + 1) * 0.5, z0, GS.x1, (k + 1) * 0.5 + 1.05, z1, STEEL);
  }
}
// Back stairs from the fan zone up to the deck, and the rear railing round them.
const BACK_STAIRS = [-62, 60];
for (const x of BACK_STAIRS) flight('z', 1, GS.back - 12, x - 1.3, 2.6, 0, DECK, CONC_DARK, -0.2);
{
  const gaps = [GS.x0 + 0.2, ...BACK_STAIRS.flatMap((x) => [x - 1.4, x + 1.4]), GS.x1 - 0.2];
  for (let i = 0; i < gaps.length; i += 2) rail(gaps[i]!, GS.back + 0.1, gaps[i + 1]!, GS.back + 0.1, DECK);
}
// Commentary boxes along the deck: five booths with windows to the track, a roof to snipe from.
const CB = { x0: -40, x1: 40, z0: GS.back + 0.2, z1: GS.back + 6.2, y0: DECK, y1: DECK + 3.5 };
{
  const doors = [-36, -20, -4, 12, 28];
  const front = windows(CB.x0, CB.x1, 4, 2.8, 1, 2.9, doors).concat(doors.map((c) => ({ c, w: 1.8, b: 0, t: 2.6 })));
  wall('x', CB.x0, CB.x1, CB.z1 - T, CB.z1, CB.y0, CB.y1, front, GLASS);
  wall('x', CB.x0, CB.x1, CB.z0, CB.z0 + T, CB.y0, CB.y1, [], WHITE);
  wall('z', CB.z0 + T, CB.z1 - T, CB.x0, CB.x0 + T, CB.y0, CB.y1, [{ c: CB.z1 - 1.6, w: 1.8, b: 0, t: 2.6 }], WHITE);
  wall('z', CB.z0 + T, CB.z1 - T, CB.x1 - T, CB.x1, CB.y0, CB.y1, [{ c: CB.z1 - 1.6, w: 1.8, b: 0, t: 2.6 }], WHITE);
  for (const x of [-24, -8, 8, 24]) wall('z', CB.z0 + T, CB.z1 - T, x - 0.12, x + 0.12, CB.y0, CB.y1, [{ c: CB.z0 + 2.6, w: 1.6, b: 0, t: 2.5 }], WHITE);
  slab({ x0: CB.x0, x1: CB.x1, z0: CB.z0, z1: CB.z1 }, CB.y1, CB.y1 + 0.3, CONC_DARK);
  const ROOF = CB.y1 + 0.3;
  rail(CB.x0, CB.z1 - 0.1, CB.x1, CB.z1 - 0.1, ROOF);
  rail(CB.x0 + 2.8, CB.z0 + 0.1, CB.x1, CB.z0 + 0.1, ROOF);
  rail(CB.x1 - 0.1, CB.z0, CB.x1 - 0.1, CB.z1, ROOF);
  rail(CB.x0 + 0.1, CB.z0 + 2.8, CB.x0 + 0.1, CB.z1, ROOF);
  // Stairs up to the roof, along the back of the deck west of the boxes.
  flight('x', 1, CB.x0 - 2 - Math.ceil((ROOF - DECK) / 0.25) * TREAD, CB.z0, 2.6, DECK, ROOF, CONC_DARK);
  box(CB.x0 - 2, DECK, CB.z0, CB.x0 + 0.01, ROOF, CB.z0 + 2.6, CONC_DARK);
  for (let i = 0; i < 5; i++) {
    const cx = -32 + i * 16;
    m.prop('desk', [cx + 2, DECK, CB.z1 - 1.1], 0, 1.2);
    m.prop('office_chair', [cx + 1.4, DECK, CB.z1 - 2.2], Math.PI);
    m.prop('tv', [cx + 4.5, DECK, CB.z0 + 0.7], Math.PI);
    m.light([cx, CB.y1 - 0.5, (CB.z0 + CB.z1) / 2], { color: '#fff1d8', intensity: 0.9, range: 8 });
  }
}
// Canopies over the outer sections of the stand, on columns at the back of the deck.
for (const [x0, x1] of [[GS.x0, -48], [48, GS.x1]] as const) {
  for (let x = x0 + 2; x <= x1 - 2; x += 13) box(x - 0.25, DECK, GS.back + 0.3, x + 0.25, DECK + 5, GS.back + 0.8, STEEL);
  box(x0, DECK + 5, GS.back, x1, DECK + 5.3, GS.front - 4, WHITE);
}

// ---------------------------------------------------------------- the footbridge over the main straight

const FB = { x0: -117, x1: -113, z0: -126, z1: -94, y: 6.3 };
box(FB.x0, FB.y - 0.3, FB.z0, FB.x1, FB.y, FB.z1, STEEL);
box(FB.x0, FB.y, FB.z0, FB.x0 + 0.2, FB.y + 1.1, FB.z1, GLASS);
box(FB.x1 - 0.2, FB.y, FB.z0, FB.x1, FB.y + 1.1, FB.z1, GLASS);
box(FB.x0, -0.2, -121.6, FB.x1, FB.y - 0.3, -120.6, CONC);
box(FB.x0, -0.2, -99.2, FB.x1, FB.y - 0.3, -98.2, CONC);
// A banner board along each side over the road.
box(FB.x0 - 0.12, FB.y - 1.6, -116, FB.x0, FB.y - 0.3, -103, RED);
box(FB.x1, FB.y - 1.6, -116, FB.x1 + 0.12, FB.y - 0.3, -103, RED);
flight('z', 1, FB.z0 - Math.ceil(FB.y / 0.25) * TREAD, FB.x0, FB.x1 - FB.x0, 0, FB.y, STEEL, -0.2);
flight('z', -1, FB.z1 + Math.ceil(FB.y / 0.25) * TREAD, FB.x0, FB.x1 - FB.x0, 0, FB.y, STEEL, -0.2);

// ---------------------------------------------------------------- the Skyline tunnel: suites over the road

const TN = { x0: -95, x1: -65, z0: 128, z1: 156, ceil: 6, floor: 6.4, top: 10.4 };
{
  box(TN.x0, -0.3, TN.z0, TN.x1, TN.ceil, TN.z0 + 0.6, CONC);
  box(TN.x0, -0.3, TN.z1 - 0.6, TN.x1, TN.ceil, TN.z1, CONC);
  // Floor of the suites (the tunnel's ceiling), with a balcony along the infield side.
  box(TN.x0, TN.ceil, TN.z0 - 2.6, TN.x1, TN.floor, TN.z1, CONC_DARK);
  // Light strips in the tunnel roof.
  for (let x = TN.x0 + 4; x < TN.x1; x += 7.5) {
    box(x - 1.5, TN.ceil - 0.1, 140.5, x + 1.5, TN.ceil, 141.5, LAMP_W);
    m.light([x, TN.ceil - 0.6, 141], { fixture: 'none', color: '#eef2ff', intensity: 1, range: 12 });
  }
  // The suites: big windows up and down the straight, doors onto the balcony.
  const doors = [TN.x0 + 6, (TN.x0 + TN.x1) / 2, TN.x1 - 6];
  wall('x', TN.x0, TN.x1, TN.z0, TN.z0 + T, TN.floor, TN.top, windows(TN.x0, TN.x1, 5, 2.2, 1.1, 2.9, doors).concat(doors.map((c) => ({ c, w: 2.4, b: 0, t: 3 }))), WHITE);
  wall('x', TN.x0, TN.x1, TN.z1 - T, TN.z1, TN.floor, TN.top, windows(TN.x0, TN.x1, 5, 2.4, 1.1, 2.9), WHITE);
  wall('z', TN.z0 + T, TN.z1 - T, TN.x0, TN.x0 + T, TN.floor, TN.top, windows(TN.z0 + T, TN.z1 - T, 4, 3, 1, 3.2), GLASS);
  wall('z', TN.z0 + T, TN.z1 - T, TN.x1 - T, TN.x1, TN.floor, TN.top, windows(TN.z0 + T, TN.z1 - T, 4, 3, 1, 3.2), GLASS);
  wall('z', TN.z0 + T, TN.z1 - T, -80.15, -79.85, TN.floor, TN.top, [{ c: 136, w: 2.4, b: 0, t: 3 }, { c: 148, w: 2.4, b: 0, t: 3 }], WHITE);
  slab({ x0: TN.x0, x1: TN.x1, z0: TN.z0, z1: TN.z1 }, TN.top, TN.top + 0.3, CONC_DARK);
  // A name board over each tunnel mouth.
  box(TN.x0 - 0.15, TN.ceil + 0.6, 132, TN.x0, TN.ceil + 2.4, 152, EMBER);
  box(TN.x1, TN.ceil + 0.6, 132, TN.x1 + 0.15, TN.ceil + 2.4, 152, TIDE);
  // Balcony railing, stairs up from the infield at both ends.
  rail(TN.x0 - 2, TN.z0 - 2.5, TN.x1 + 2, TN.z0 - 2.5, TN.floor);
  for (const dir of [1, -1] as const) {
    const end = dir > 0 ? TN.x0 - 2 : TN.x1 + 2;
    const steps = Math.ceil(TN.floor / 0.25);
    flight('x', dir, end - dir * steps * TREAD, TN.z0 - 2.6, 2.6, 0, TN.floor, CONC_DARK, -0.2);
    box(Math.min(end, end + dir * 2), -0.2, TN.z0 - 2.6, Math.max(end, end + dir * 2), TN.floor, TN.z0, CONC_DARK);
  }
  for (const [x, z] of [[-88, 134], [-72, 134], [-88, 150], [-72, 150]] as const) {
    m.prop('sofa', [x, TN.floor, z], z < 140 ? 0 : Math.PI);
    m.prop('table_round', [x + 3, TN.floor, z], 0);
    m.light([x, TN.top - 0.5, z], { color: '#fff1d8', intensity: 0.9, range: 9 });
  }
  m.prop('display_table', [-80 + 4, TN.floor, 142], P);
}

// ---------------------------------------------------------------- hospitality buildings

/**
 * A two-storey hospitality building: glass and white panels, doors on the
 * given sides, switchback stairs to the upper floor and the roof terrace.
 */
function hospitality(r: Rect, doors: { side: 'N' | 'S' | 'E' | 'W'; at: number }[], name: Mat): void {
  const H = 4;
  const inner = { x0: r.x0 + T, x1: r.x1 - T, z0: r.z0 + T, z1: r.z1 - T };
  slab(inner, -0.3, 0.1, FLOOR);
  const sx = inner.x0;
  const sz = inner.z0 + 2.2;
  for (let s = 0; s < 2; s++) {
    const y0 = s * H;
    const holes = (side: 'N' | 'S' | 'E' | 'W', a0: number, a1: number): Hole[] => {
      const d = s === 0 ? doors.filter((o) => o.side === side).map((o) => a0 + (a1 - a0) * o.at) : [];
      const win = windows(a0, a1, 4, 2.6, 1, 3.2, d);
      // No windows beside the stairs (west side).
      const keep = side === 'W' ? win.filter((w) => w.c < sz - 2 || w.c > sz + 10) : win;
      return keep.concat(d.map((c) => ({ c, w: 2.6, b: 0, t: 3 })));
    };
    wall('x', r.x0, r.x1, r.z0, r.z0 + T, y0, y0 + H, holes('S', r.x0, r.x1), s ? GLASS : WHITE);
    wall('x', r.x0, r.x1, r.z1 - T, r.z1, y0, y0 + H, holes('N', r.x0, r.x1), s ? GLASS : WHITE);
    wall('z', r.z0 + T, r.z1 - T, r.x0, r.x0 + T, y0, y0 + H, holes('W', r.z0 + T, r.z1 - T), WHITE);
    wall('z', r.z0 + T, r.z1 - T, r.x1 - T, r.x1, y0, y0 + H, holes('E', r.z0 + T, r.z1 - T), s ? GLASS : WHITE);
  }
  // Stairs: up north on the west wall to the first floor, back south beside it to the roof.
  const e1 = flight('z', 1, sz, sx, 2.6, 0.1, H + 0.3, CONC);
  const holeA = { x0: sx, x1: sx + 2.6, z0: sz, z1: e1 };
  for (const part of minus(inner, holeA)) slab(part, H, H + 0.3, FLOOR);
  const e2 = flight('z', -1, e1, sx + 2.6, 2.6, H + 0.3, 2 * H + 0.3, CONC);
  const holeB = { x0: sx + 2.6, x1: sx + 5.2, z0: e2, z1: e1 };
  for (const part of minus(r, holeB)) slab(part, 2 * H, 2 * H + 0.3, CONC_DARK);
  const roof = 2 * H + 0.3;
  rail(r.x0, r.z0 + 0.1, r.x1, r.z0 + 0.1, roof, GLASS);
  rail(r.x0, r.z1 - 0.1, r.x1, r.z1 - 0.1, roof, GLASS);
  rail(r.x0 + 0.1, r.z0, r.x0 + 0.1, r.z1, roof, GLASS);
  rail(r.x1 - 0.1, r.z0, r.x1 - 0.1, r.z1, roof, GLASS);
  // A name band round the top of the ground floor.
  box(r.x0 - 0.15, H - 0.7, r.z0 - 0.15, r.x1 + 0.15, H - 0.2, r.z0, name);
  box(r.x0 - 0.15, H - 0.7, r.z1, r.x1 + 0.15, H - 0.2, r.z1 + 0.15, name);
  // Furniture: a bar and lounge downstairs, tables upstairs.
  const cx = (r.x0 + r.x1) / 2 + 3;
  const cz = (r.z0 + r.z1) / 2;
  m.prop('hm_kitchen_counter_long', [inner.x1 - 0.7, 0.1, cz], -P);
  m.prop('sofa_long', [cx, 0.1, inner.z1 - 1.2], Math.PI);
  m.prop('table_round', [cx + 4, 0.1, cz - 2], 0);
  m.prop('hm_potted_palm', [inner.x1 - 1, 0.1, inner.z0 + 1], 0);
  m.prop('table_cloth', [cx, H + 0.3, cz], 0);
  m.prop('table_cloth', [cx + 5, H + 0.3, cz], 0);
  m.prop('parasol', [cx + 4, roof, cz], 0);
  m.prop('parasol', [cx - 2, roof, cz + 3], 0);
  for (const y of [H - 0.55, 2 * H - 0.25]) {
    m.light([cx - 2, y, cz], { color: '#fff1d8', intensity: 1, range: 11 });
    m.light([cx + 6, y, cz], { color: '#fff1d8', intensity: 1, range: 11 });
  }
}
const CLUB = { x0: 92, x1: 120, z0: -80, z1: -62 }; // paddock club (east paddock)
const LOUNGE = { x0: -64, x1: -36, z0: 36, z1: 54 }; // infield lounge
hospitality(CLUB, [{ side: 'S', at: 0.5 }, { side: 'N', at: 0.6 }, { side: 'E', at: 0.5 }], TIDE);
hospitality(LOUNGE, [{ side: 'S', at: 0.6 }, { side: 'N', at: 0.6 }, { side: 'E', at: 0.5 }], EMBER);

// ---------------------------------------------------------------- the hairpin grandstand and booth

const HS = { front: 62, tiers: 10, z0: -40, z1: 4, back: 77 };
{
  const aisles = [-30, -6];
  for (let k = 0; k < HS.tiers; k++) {
    const x0 = HS.front + k;
    const x1 = k === HS.tiers - 1 ? HS.back : x0 + 1;
    box(x0, -0.3, HS.z0, x1, (k + 1) * 0.5, HS.z1, k === HS.tiers - 1 ? CONC : seat(k));
    for (const a of aisles) box(x0 - 0.5, k ? k * 0.5 : -0.3, a - 1.3, x0, k * 0.5 + 0.25, a + 1.3, CONC);
    box(x0, (k + 1) * 0.5, HS.z0, x1, (k + 1) * 0.5 + 1.05, HS.z0 + 0.2, STEEL);
    box(x0, (k + 1) * 0.5, HS.z1 - 0.2, x1, (k + 1) * 0.5 + 1.05, HS.z1, STEEL);
  }
  const top = HS.tiers * 0.5;
  {
    const gaps = [HS.z0, ...aisles.flatMap((a) => [a - 1.4, a + 1.4]), HS.z1];
    for (let i = 0; i < gaps.length; i += 2) rail(HS.front + 0.1, gaps[i]!, HS.front + 0.1, gaps[i + 1]!, 0.5);
  }
  // Back stairs down to the paddock, the rear railing round them.
  flight('x', -1, HS.back + Math.ceil(top / 0.25) * TREAD, -38, 2.6, 0, top, CONC_DARK, -0.2);
  rail(HS.back - 0.1, -35.2, HS.back - 0.1, HS.z1, top);
  // The booth on the deck, with a stair up the side to its roof.
  const B = { x0: 72, x1: 77, z0: -12, z1: -2 };
  const by = top + 3.3;
  wall('z', B.z0, B.z1, B.x0, B.x0 + T, top, by, windows(B.z0, B.z1, 3.2, 2.4, 1, 2.8), GLASS);
  wall('z', B.z0, B.z1, B.x1 - T, B.x1, top, by, [], WHITE);
  wall('x', B.x0 + T, B.x1 - T, B.z1 - T, B.z1, top, by, [], WHITE);
  wall('x', B.x0 + T, B.x1 - T, B.z0, B.z0 + T, top, by, [{ c: 73.4, w: 1.6, b: 0, t: 2.5 }], WHITE);
  slab(B, by, by + 0.3, CONC_DARK);
  const roof = by + 0.3;
  const foot = B.z0 - Math.ceil((roof - top) / 0.25) * TREAD - 2.6;
  const end = flight('z', 1, foot, B.x1 - 2.6, 2.6, top, roof, CONC_DARK);
  box(B.x1 - 2.6, top, end, B.x1, roof, B.z0, CONC_DARK);
  rail(B.x0, B.z1 - 0.1, B.x1, B.z1 - 0.1, roof);
  rail(B.x0 + 0.1, B.z0, B.x0 + 0.1, B.z1, roof);
  rail(B.x0, B.z0 + 0.1, B.x1 - 2.7, B.z0 + 0.1, roof);
  rail(B.x1 - 0.1, B.z0, B.x1 - 0.1, B.z1, roof);
  m.prop('desk', [73.4, top, -7], -P);
  m.light([74.5, by - 0.5, -7], { color: '#fff1d8', intensity: 0.9, range: 7 });
}

// ---------------------------------------------------------------- paddock: trucks, motorhomes, helipad

/** A team transporter (trailer and cab), along z, cab to the north when `north`. */
function truck(x: number, z: number, north: boolean, livery: Mat): void {
  box(x - 1.3, -0.1, z - 6.5, x + 1.3, 4, z + 6.5, livery);
  box(x - 1.34, 0.4, z - 6.3, x + 1.34, 1.1, z + 6.3, CONC_DARK);
  const c = north ? z + 6.6 : z - 9.4;
  box(x - 1.25, -0.1, c, x + 1.25, 3.2, c + 2.8, WHITE);
  box(x - 1.1, 2.1, north ? c + 2.8 : c - 0.05, x + 1.1, 2.9, north ? c + 2.85 : c, GLASS);
}
/** A motorhome (white box with a team stripe), along x. */
function motorhome(x: number, z: number, livery: Mat): void {
  box(x - 5.5, -0.1, z - 1.3, x + 5.5, 3.4, z + 1.3, WHITE);
  box(x - 5.55, 1.6, z - 1.35, x + 5.55, 2.1, z + 1.35, livery);
}
for (const x of [-60, -48, -36]) truck(x, -58.5, false, EMBER);
motorhome(-10, -66, EMBER);
motorhome(14, -66, EMBER);
for (const x of [50, 62, 74]) truck(x, -70, true, TIDE);
motorhome(84, -52, TIDE);
motorhome(108, -52, TIDE);
// Helipad in the infield, inside the sweeper.
{
  const [hx, hz] = [118, 30];
  m.block([hx, -0.1, hz], [14, 0.35, 14], 'solid', CONC_DARK);
  m.block([hx, -0.1, hz], [11.6, 0.35, 11.6], 'solid', { ...CONC_DARK, yaw: Math.PI / 4 });
  box(hx - 2.2, 0.25, hz - 2.6, hx - 1.4, 0.35, hz + 2.6, PAINT_W);
  box(hx + 1.4, 0.25, hz - 2.6, hx + 2.2, 0.35, hz + 2.6, PAINT_W);
  box(hx - 1.4, 0.25, hz - 0.4, hx + 1.4, 0.35, hz + 0.4, PAINT_W);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    m.prop('sf_floor_light', [r2(hx + Math.sin(a) * 7.6), 0, r2(hz + Math.cos(a) * 7.6)], a, 1, false);
  }
  m.prop('pennant', [hx + 9, 0, hz + 9], 0);
}

// ---------------------------------------------------------------- fan zone and podium

{
  // The podium stage: steps up the front, the three places, a screen and flags behind.
  const S = { x0: -12, x1: 12, z0: -182, z1: -170, y: 1.2 };
  box(S.x0, -0.3, S.z0, S.x1, S.y, S.z1, CONC_DARK);
  flight('z', -1, S.z1 + 5 * TREAD, -3, 6, 0, S.y, CONC_DARK, -0.2);
  box(-1.5, S.y, -178, 1.5, S.y + 1, -175.5, PAINT_W);
  box(-4.7, S.y, -178, -1.5, S.y + 0.6, -175.5, PAINT_W);
  box(1.5, S.y, -178, 4.7, S.y + 0.4, -175.5, PAINT_W);
  box(-11, S.y, S.z0, 11, S.y + 7, S.z0 + 0.6, STEEL);
  box(-9, S.y + 2, S.z0 + 0.6, 9, S.y + 6.5, S.z0 + 0.75, LAMP_W);
  for (const x of [-8, 0, 8]) m.prop('flag', [x, S.y, S.z0 + 1.4], 0);
  m.light([0, S.y + 6, -174], { fixture: 'none', color: '#fff3e0', intensity: 1.2, range: 14 });
}
// Food stalls, awnings and tables round the fan zone.
for (const [x, z, yaw, kind] of [
  [-96, -168, P, 'stall'], [-96, -178, P, 'stall_green'], [-70, -186, 0, 'stall'], [-46, -186, 0, 'stall_green'],
  [46, -186, 0, 'stall'], [70, -186, 0, 'stall_green'], [96, -168, -P, 'stall'], [96, -178, -P, 'stall_green'],
] as const) m.prop(kind, [x, 0, z], yaw);
for (const [x, z] of [[-72, -166], [-50, -172], [-30, -164], [30, -164], [50, -172], [72, -166], [-84, -180], [84, -180]] as const) {
  m.prop('parasol', [x, 0, z], 0);
  m.prop('table_round', [x, 0, z], 0.3);
}
for (const x of [-110, -86, 86, 110]) m.prop('banner_long', [x, 0, -152], 0);
// A big screen at the back of the fan zone, facing the stand.
box(-30, -0.2, -192, -29.4, 9, -191.4, STEEL);
box(29.4, -0.2, -192, 30, 9, -191.4, STEEL);
box(-22, 3, -191.9, 22, 9, -191.5, CONC_DARK);
box(-21, 3.5, -191.5, 21, 8.5, -191.35, LAMP_W);
// Trees round the outside.
for (let x = -120; x <= 120; x += 20) m.prop(x % 40 ? 'nt_common_tree' : 'nt_birch', [x, 0, -196], x / 7);

// ---------------------------------------------------------------- infield and verge dressing

let seed = 20260426;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const free = (x: number, z: number, r: number) => offRoad(x, z) > 24 + r && !BUILT.some((b) => inRect(b, x, z, r + 2)) && Math.abs(x) < 190 && Math.abs(z) < 190 && hills(x, z) < 0.5;
const scatter = (model: string, n: number, r: number, scale: [number, number]) => {
  for (let placed = 0, tries = 0; placed < n && tries < n * 60; tries++) {
    const x = r2(rand() * 360 - 180);
    const z = r2(rand() * 300 - 120);
    if (!free(x, z, r) || inTrap(x, z)) continue;
    m.prop(model, [x, 0, z], r2(rand() * Math.PI * 2), r2(scale[0] + rand() * (scale[1] - scale[0])));
    placed++;
  }
};
scatter('nt_common_tree', 26, 4, [0.9, 1.3]);
scatter('nt_birch', 18, 2, [0.9, 1.2]);
scatter('bush_large', 16, 2, [0.9, 1.2]);
scatter('nt_bush_leafy', 18, 1, [0.9, 1.3]);
// Cover in the infield: support containers, marquees and pallets of tyres.
for (const [x, z, yaw] of [[-110, 60, 0.2], [-20, 70, P], [20, 92, 0.1], [70, 70, -0.4], [-100, 100, P], [40, 40, 0.3], [-120, 30, 0.1], [90, 100, 0.6]] as const) m.prop('cargo_crate', [x, 0, z], yaw);
for (const [x, z] of [[-20, 40], [10, 60], [-110, 80], [60, 30]] as const) {
  m.prop('tent_canvas', [x, 0, z], 0.3);
  tyreStack(x + 3.2, z, 4);
  tyreStack(x + 3.9, z + 0.8, 3);
}
// Grandstand-side dressing on the hills: flags along the north bank.
for (let x = -150; x <= 150; x += 30) m.prop('banner_red', [x, 0, 166], Math.PI);

// ---------------------------------------------------------------- spawns, flags, hills and pickups

const spawnClear = (x: number, z: number, y = 0) => {
  // Above the road (the suites over the tunnel) is fine.
  if (y < 5 && offRoad(x, z) < 4) throw new Error(`spawn at ${x},${z} is on the track`);
};
const spawn = (p: V3, yaw: number, team: string | null) => {
  spawnClear(p[0], p[2], p[1]);
  m.spawn(p, r2(yaw), team);
};
// Embers: the west garages and the strip behind them. Tide: the east garages and the east paddock.
for (let i = 0; i < 5; i++) {
  spawn([garageX(i) - 1, 0.1, -80], P, WEST);
  spawn([garageX(9 - i) + 1, 0.1, -80], -P, EAST);
}
for (const [x, z] of [[-74, -66], [-66, -50], [-54, -50], [-42, -50], [-28, -56], [-20, -50], [-80, -56]] as const) spawn([x, 0, z], P, WEST);
for (const [x, z] of [[44, -58], [56, -52], [68, -56], [88, -60], [100, -86], [124, -86], [84, -84]] as const) spawn([x, 0, z], -P, EAST);
// Everyone else (deathmatch): the stands, the fan zone, the infield, the tunnel suites and the hospitality.
for (const [p, yaw] of [
  [[-80, DECK, -140], 0], [[80, DECK, -140], 0], [[-60, 0, -164], 0], [[60, 0, -164], 0], [[0, 0, -160], 0], [[-104, 0, -186], P], [[104, 0, -186], -P],
  [[74, 5, -30], -P], [[-50, 0.1, 40], 0], [[-50, 4.3, 50], Math.PI], [[106, 0.1, -66], 0], [[-86, 6.4, 146], P], [[-74, 6.4, 136], -P],
  [[-120, 0, 50], P], [[0, 0, 40], 0], [[90, 0, 40], -P], [[120, 0, 70], Math.PI], [[-130, 0, -72], P], [[-130, 0, 110], P],
] as [V3, number][]) spawn(p, yaw, null);

// Capture the Flag: in the two end garages.
m.flag(WEST, [garageX(0) + 1.5, 0.1, -76.5], P);
m.flag(EAST, [garageX(9) - 1.5, 0.1, -76.5], -P);
// King of the Hill: the podium stage, the race control tower deck, the footbridge.
m.hill([0, 1.2, -173], 5);
m.hill([1.5, ROOF_Y + 8, -80], 5);
m.hill([-115, FB.y, -110], 4);

// Snipers on the high perches.
m.pickup('weapon_sniper', [0, CB.y1 + 0.3, CB.z0 + 3]);
m.pickup('weapon_sniper', [-2, ROOF_Y + 8, -86]);
m.pickup('weapon_marksman', [74.5, 5 + 3.6, -7]);
m.pickup('ammo_sniper', [20, CB.y1 + 0.3, CB.z0 + 3]).pickup('ammo_sniper', [2, ROOF_Y + 8, -74]);
// SMGs and shotguns in the garages.
m.pickup('weapon_smg', [garageX(1), 0.1, -84]).pickup('weapon_smg', [garageX(8), 0.1, -84]);
m.pickup('weapon_shotgun', [garageX(3), 0.1, -84]).pickup('weapon_shotgun', [garageX(6), 0.1, -84]);
m.pickup('weapon_auto_shotgun', [garageX(4) + 4.5, 0.1, -79]);
m.pickup('ammo_shells', [garageX(2), 0.1, -76]).pickup('ammo_shells', [garageX(7), 0.1, -76]);
m.pickup('ammo', [garageX(0), 0.1, -84]).pickup('ammo', [garageX(9), 0.1, -84]).pickup('ammo', [garageX(5), 0.1, -76]);
// Rockets on the footbridge.
m.pickup('weapon_rockets', [-115, FB.y, -110]).pickup('ammo_explosive', [-115, FB.y, -97]);
// Armour in the hospitality buildings and the suites.
m.pickup('armor_large', [CLUB.x0 + 14, 4.3, CLUB.z0 + 4]).pickup('armor_large', [LOUNGE.x0 + 14, 4.3, LOUNGE.z0 + 4]);
m.pickup('armor_small', [-80, TN.floor, 138]).pickup('armor_small', [-80, TN.floor, 150]);
// Rifles and the rest round the outside.
m.pickup('weapon_rifle', [0, 0, -186]).pickup('weapon_burst_rifle', [-90, TN.floor, 142]).pickup('weapon_launcher', [118, 0.25, 33]);
m.pickup('weapon_rifle', [-42, 0, -62]).pickup('weapon_burst_rifle', [96, 0, -54]);
m.pickup('ammo_rifle', [-40, DECK, -138]).pickup('ammo_rifle', [40, DECK, -138]).pickup('ammo_rifle', [0, 0, 60]);
m.pickup('grenades', [-20, 0, -164]).pickup('grenades', [20, 0, -164]).pickup('grenades', [-130, 0, 60]);
m.pickup('health_large', [CLUB.x0 + 20, 0.1, CLUB.z0 + 9]).pickup('health_large', [LOUNGE.x0 + 20, 0.1, LOUNGE.z0 + 9]).pickup('health_large', [0, ROOF_Y, -76]);
for (const [x, y, z] of [[-90, DECK, -138], [90, DECK, -138], [-115, FB.y, -122], [72, 5, -24], [-140, 0, 70], [140, 0, 0], [-30, 0, 90], [-100, 0, -60], [56, 0, -64], [-60, 0, -186], [60, 0, -186]] as const) m.pickup('health_small', [x, y, z]);

// ---------------------------------------------------------------- checks and save

// No low block may stand on the road (the tunnel walls, bridge posts and gantry stand clear of it).
{
  const blocks = (m as unknown as { pending: { kind: string; position: V3; size: V3; yaw: number }[] }).pending.filter((e) => e.kind === 'block' && e.position[1] < 2.5);
  for (const b of blocks) {
    const [sx, , sz] = b.size;
    const n = Math.max(2, Math.ceil(Math.max(sx, sz)));
    for (let i = 0; i <= n; i++)
      for (const j of [-0.5, 0, 0.5]) {
        const t = i / n - 0.5;
        const [lx, lz] = sx >= sz ? [t * sx, j * sz] : [j * sx, t * sz];
        const c = Math.cos(b.yaw);
        const s = Math.sin(b.yaw);
        const x = b.position[0] + lx * c + lz * s;
        const z = b.position[2] - lx * s + lz * c;
        if (offRoad(x, z) < 0.6 && b.position[1] + b.size[1] > -0.05 && b.position[1] < 2.5) throw new Error(`block at ${b.position} (${b.size}) is on the road at ${x.toFixed(1)},${z.toFixed(1)}`);
      }
  }
}

m.bounds('invisible', 0, { min: [-197, -197], max: [197, 197] }, 12);
// The city the Skyline tunnel is named for rises to the north and east; parkland woods west and south.
m.border('skyline', { west: 'forest', south: 'forest' });
m.meta({
  description:
    'A Grand Prix circuit, 1.4 km a lap: a long main straight past the pits and the grandstand, a fast east sweeper, a chicane, the Skyline tunnel under hospitality suites, a footbridge over the straight, and a hairpin in the infield. Twelve NPC race cars lap it in every mode and run down anyone on the road. Fight through the ten pit garages, up the stands to the commentary boxes, round the paddock trucks and the podium; or race them in karts.',
  modes: ['core.deathmatch', 'core.tdm', 'core.ctf', 'core.koth', 'core.race'],
  players: [4, 16],
});
await m.save();
