/**
 * Underdrain: a night-time city block over a sprawling Victorian brick sewer
 * (our own map, name and layout). Three levels: the street (y 0), the sewer
 * walkways (y -8) and the deep cistern (y -17). 6–14 players; DM, TDM, CTF,
 * KOTH and Zombies.
 *
 * - Street (x -76..-12, z -20..28): a crossroads under a brownstone and a
 *   midrise, corner shops you can run through, a manhole in the road and one
 *   in the north alley (ladders down), a collapsed hole in the road (drop into
 *   the interceptor's sewage) and a storm drain whose stairs run down into the
 *   sewer south of the crossroads.
 * - The interceptor: a big arched brick tunnel along z 0 with a sewage channel
 *   (waist-deep swamp, slow) between two walkways, bridges and access steps.
 *   West outfall (Embers' base, flag, a penstock lever) → west interceptor →
 *   the overflow chamber → east interceptor (two sluice doors and a crouch gap
 *   under the bulkhead) → the pumping station (Tide's base, flag).
 * - Maintenance ducts run parallel on the north side (rat runs, a crouch culvert
 *   from the east interceptor); a rat run links the outfall to the collapsed hall.
 * - Overflow chamber: a cathedral of brick pillars round a deep pool with an
 *   island (hill) and a waterfall from an inflow pipe; galleries on three sides
 *   (sniper rifle on the north one), stairs and a ladder up.
 * - Pumping station: sump, pump machinery, catwalks, a jump pad, and a raised
 *   control room (hill) with the floodgate lever: it shuts the two interceptor
 *   sluices and opens the acid bypass for 20 s (red lamp tell, 45 s cycle).
 * - Acid chamber (toxic waste) south of the east interceptor: an acid pit with a
 *   catwalk that crumbles in the middle, stepping stones and gas grenades.
 * - Collapsed hall south of the west interceptor: rubble, a crumbling floor over
 *   the cistern, a ladder and a jump pad hole.
 * - Cistern (y -17): columns standing in shallow water, the rocket launcher on a
 *   dais. Out by the long stairs to the overflow chamber, the ladder or the pad.
 *
 *   z   28 ┌ alley ┬ brownstone ┬ ░ ┬ N stub ┬ ░ ┬ shop ┐            street (y 0)
 *        0 │ road ══(collapse)═══ CROSSROADS ═══ road ═│
 *      -20 └ alley ┴ midrise ─────┴ [storm drain] ┴ shop ┘
 *
 *   z   12      ═════ north duct W ═════════      ═══ north duct E ═══     sewer (y -8)
 *        0  OUTFALL ══ interceptor W ════ OVERFLOW ══ interceptor E ══ PUMPING
 *      -14   │rat run   │      │culverts    CHAMBER  │acid door        STATION
 *      -38   └─ COLLAPSED HALL ─ storm drain     │  ACID CHAMBER ─bypass─┘
 *      -52        └──────── CISTERN (y -17) ──────┘
 *          x -104   -80   -60   -40   -20  -8      24  28   52  56       92
 */
import { AIR_PUSH_DECAY, PLAYER, TICK_DT, type EdgeStyle, type LogicAction, type LogicRule, type Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('underdrain', 'Underdrain');
m.theme('city');
m.backdrop('night', 'city', 'stone', 0.55, 0.45);
type V3 = [number, number, number];
const P = Math.PI / 2;
const PI = Math.PI;

// ---------------------------------------------------------------- materials and levels

const BRICK = 'pbr_brick_old';
const SOOT = 'dark_brick';
const MOSSY = 'pbr_castle_stone';
const FLAG = 'pbr_flagstone';
const SILT = 'pbr_rock';
const CONC = 'pbr_concrete_dark';
const GRATE = 'pbr_walkway';
const TREAD = 'pbr_tread_plate';
const STEEL = 'pbr_steel';
const RUST = 'pbr_rusted_plate';
const ASPH = 'pbr_asphalt';
const PAVE = 'pbr_hex_paving';
const HAZARD = 'hazard';
const GRIME = '#a7b49c'; // a green-grey tint on the sewer brick

const W = -8; // sewer walkway floors
const CH = -9.4; // channel bed
const SURF = -8.4; // sewage surface
const C = -17; // cistern floor
const DUCT_TOP = -5.2;

// ---------------------------------------------------------------- block helpers

type BlockOpts = Parameters<MapBuilder['block']>[3];
type Beh = 'solid' | 'breakable' | 'crumble' | 'trapdoor';
const r3 = (n: number) => +n.toFixed(3);
/** A block from its extents (split when longer than 64 m). */
function B(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: string, behaviour: Beh = 'solid', o: BlockOpts = {}): void {
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01 || z1 - z0 < 0.01) return;
  // The schema's smallest block: 0.2 m across, 0.1 m thick (thin trim grows round its middle).
  const grow = (a: number, b: number, min: number): [number, number] => (b - a >= min - 1e-9 ? [a, b] : [(a + b) / 2 - min / 2, (a + b) / 2 + min / 2]);
  [x0, x1] = grow(x0, x1, 0.2);
  [z0, z1] = grow(z0, z1, 0.2);
  [y0, y1] = grow(y0, y1, 0.1);
  if (x1 - x0 > 64) return void (B(x0, (x0 + x1) / 2, y0, y1, z0, z1, material, behaviour, o), B((x0 + x1) / 2, x1, y0, y1, z0, z1, material, behaviour, o));
  if (z1 - z0 > 64) return void (B(x0, x1, y0, y1, z0, (z0 + z1) / 2, material, behaviour, o), B(x0, x1, y0, y1, (z0 + z1) / 2, z1, material, behaviour, o));
  m.block([r3((x0 + x1) / 2), r3(y0), r3((z0 + z1) / 2)], [r3(x1 - x0), r3(y1 - y0), r3(z1 - z0)], behaviour, { material, ...o });
}
/** Brick with the sewer grime tint. */
const G = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material = BRICK) => B(x0, x1, y0, y1, z0, z1, material, 'solid', { tint: GRIME });

type Rect = [number, number, number, number]; // x0, x1, z0, z1
/** A slab over a rectangle with rectangular holes left out (merged into as few blocks as it can). */
function slab(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, material: string, holes: Rect[] = [], tint?: string): void {
  const hs = holes.map(([a, b, c, d]) => [Math.max(a, x0), Math.min(b, x1), Math.max(c, z0), Math.min(d, z1)] as Rect).filter(([a, b, c, d]) => b > a && d > c);
  const xs = [...new Set([x0, x1, ...hs.flatMap((h) => [h[0], h[1]])])].sort((a, b) => a - b);
  const zs = [...new Set([z0, z1, ...hs.flatMap((h) => [h[2], h[3]])])].sort((a, b) => a - b);
  const strips: { a: number; b: number; runs: [number, number][] }[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const [a, b] = [xs[i]!, xs[i + 1]!];
    const mx = (a + b) / 2;
    const runs: [number, number][] = [];
    for (let j = 0; j < zs.length - 1; j++) {
      const [c, d] = [zs[j]!, zs[j + 1]!];
      const mz = (c + d) / 2;
      if (hs.some((h) => mx > h[0] && mx < h[1] && mz > h[2] && mz < h[3])) continue;
      const last = runs[runs.length - 1];
      if (last && last[1] === c) last[1] = d;
      else runs.push([c, d]);
    }
    const prev = strips[strips.length - 1];
    if (prev && prev.b === a && JSON.stringify(prev.runs) === JSON.stringify(runs)) prev.b = b;
    else strips.push({ a, b, runs });
  }
  for (const s of strips) for (const [c, d] of s.runs) B(s.a, s.b, y0, y1, c, d, material, 'solid', tint ? { tint } : {});
}

type Gap = [number, number, number, number]; // along0, along1, y0, y1
/** A wall running along x (x0..x1, z0..z1 thick) with openings. */
function wallX(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, material: string, gaps: Gap[] = [], tint: string | undefined = GRIME): void {
  const o = tint ? { tint } : {};
  let a = x0;
  for (const [g0, g1, gy0, gy1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    B(a, g0, y0, y1, z0, z1, material, 'solid', o);
    B(g0, g1, y0, gy0, z0, z1, material, 'solid', o);
    B(g0, g1, gy1, y1, z0, z1, material, 'solid', o);
    a = g1;
  }
  B(a, x1, y0, y1, z0, z1, material, 'solid', o);
}
/** A wall running along z (z0..z1, x0..x1 thick) with openings. */
function wallZ(z0: number, z1: number, x0: number, x1: number, y0: number, y1: number, material: string, gaps: Gap[] = [], tint: string | undefined = GRIME): void {
  const o = tint ? { tint } : {};
  let a = z0;
  for (const [g0, g1, gy0, gy1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    B(x0, x1, y0, y1, a, g0, material, 'solid', o);
    B(x0, x1, y0, gy0, g0, g1, material, 'solid', o);
    B(x0, x1, gy1, y1, g0, g1, material, 'solid', o);
    a = g1;
  }
  B(x0, x1, y0, y1, a, z1, material, 'solid', o);
}
/** Four walls (0.6 m) round an interior rectangle, each with its openings; `skip` leaves sides out. */
function walls(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, material: string, g: Partial<Record<Side, Gap[]>> = {}, skip: Side[] = []): void {
  const t = 0.6;
  if (!skip.includes('N')) wallX(x0 - t, x1 + t, z1, z1 + t, y0, y1, material, g.N);
  if (!skip.includes('S')) wallX(x0 - t, x1 + t, z0 - t, z0, y0, y1, material, g.S);
  if (!skip.includes('E')) wallZ(z0, z1, x1, x1 + t, y0, y1, material, g.E);
  if (!skip.includes('W')) wallZ(z0, z1, x0 - t, x0, y0, y1, material, g.W);
}
/** A plain passage: floor, walls on its two long sides and a roof. */
function passage(x0: number, x1: number, z0: number, z1: number, top: number, alongX: boolean, material = BRICK): void {
  B(x0, x1, W - 0.6, W, z0, z1, FLAG);
  if (alongX) {
    G(x0, x1, W - 0.6, top, z0 - 0.6, z0, material);
    G(x0, x1, W - 0.6, top, z1, z1 + 0.6, material);
    G(x0, x1, top, top + 0.6, z0 - 0.6, z1 + 0.6, material);
  } else {
    G(x0 - 0.6, x0, W - 0.6, top, z0, z1, material);
    G(x1, x1 + 0.6, W - 0.6, top, z0, z1, material);
    G(x0 - 0.6, x1 + 0.6, top, top + 0.6, z0, z1, material);
  }
}
/** Stairs of 0.25 m risers on 0.5 m treads: `n` steps from `start` along `axis` (dir ±1), across c0..c1, from y0 rising by `rise` a step; solid down to `base`. */
function stairs(axis: 'x' | 'z', start: number, dir: 1 | -1, c0: number, c1: number, y0: number, rise: number, n: number, base: number, material: string): void {
  for (let i = 1; i <= n; i++) {
    const a = start + dir * 0.5 * (i - 1);
    const b = start + dir * 0.5 * i;
    const top = y0 + rise * i;
    if (axis === 'x') B(Math.min(a, b), Math.max(a, b), base, top, c0, c1, material);
    else B(c0, c1, base, top, Math.min(a, b), Math.max(a, b), material);
  }
}
/** Bars across an opening: thin uprights every 0.45 m from a0 to a1 (along x or z) at `at`. */
function bars(along: 'x' | 'z', a0: number, a1: number, at: number, y0: number, y1: number): void {
  const n = Math.round((a1 - a0) / 0.45);
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    if (along === 'x') B(a - 0.06, a + 0.06, y0, y1, at - 0.06, at + 0.06, STEEL);
    else B(at - 0.06, at + 0.06, y0, y1, a - 0.06, a + 0.06, STEEL);
  }
  if (along === 'x') B(a0, a1, (y0 + y1) / 2 - 0.06, (y0 + y1) / 2 + 0.06, at - 0.08, at + 0.08, STEEL);
  else B(at - 0.08, at + 0.08, (y0 + y1) / 2 - 0.06, (y0 + y1) / 2 + 0.06, a0, a1, STEEL);
}
/** A waist-high rail (0.2 m thick) from (x0, z0) to (x1, z1) on a floor at y. */
const rail = (x0: number, x1: number, z0: number, z1: number, y: number) => B(x0, x1, y, y + 1.05, z0, z1, STEEL);

// ---------------------------------------------------------------- the interceptor

/** A stretch of the big arched tunnel along z 0, from x0 to x1. */
function interceptor(x0: number, x1: number, o: { N?: Gap[]; S?: Gap[]; holes?: Rect[] } = {}): void {
  B(x0, x1, -10.6, W, 2.5, 6, FLAG);
  B(x0, x1, -10.6, W, -6, -2.5, FLAG);
  B(x0, x1, -10.6, CH, -2.5, 2.5, SILT);
  // Kerbs of dressed brick along the channel.
  B(x0, x1, W - 0.05, W, 2.5, 2.8, MOSSY);
  B(x0, x1, W - 0.05, W, -2.8, -2.5, MOSSY);
  wallX(x0, x1, 6, 6.6, -10.6, -3.5, BRICK, o.N);
  wallX(x0, x1, -6.6, -6, -10.6, -3.5, BRICK, o.S);
  // The vault: three courses stepping in to the crown.
  for (const s of [1, -1]) {
    const zr = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
    G(x0, x1, -3.5, -2.6, ...zr(5.3, 6.6));
    G(x0, x1, -2.6, -1.9, ...zr(4.3, 6.6));
    G(x0, x1, -1.9, -1.2, ...zr(2.8, 6.6));
  }
  slab(x0, x1, -6.6, 6.6, -1.2, -0.6, BRICK, o.holes ?? [], GRIME);
}
/** A rib across the tunnel: pilasters on both walls and an arch band under the crown. */
function rib(x: number): void {
  for (const s of [1, -1]) G(x - 0.35, x + 0.35, W, -1.2, s > 0 ? 5.5 : -6, s > 0 ? 6 : -5.5, SOOT);
  G(x - 0.35, x + 0.35, -1.7, -1.2, -2.8, 2.8, SOOT);
}
/** Steps out of the channel up to a walkway (side +1 north, -1 south). */
function channelSteps(x: number, side: 1 | -1, material = MOSSY): void {
  for (let k = 0; k < 5; k++) {
    const [a, b] = side > 0 ? [0.5 * k, 0.5 * k + 0.5] : [-0.5 * k - 0.5, -0.5 * k];
    B(x - 1.5, x + 1.5, CH, CH + 0.25 * (k + 1), a, b, material);
  }
}
/** A humpback bridge across the channel: three steps up each side, high enough to wade under. */
function bridge(x: number): void {
  B(x - 1.5, x + 1.5, -7.5, -7.25, -2.5, 2.5, GRATE);
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
    const [a, b] = [2.5 + 0.5 * k, 3 + 0.5 * k];
    B(x - 1.5, x + 1.5, W, -7.25 - 0.25 * k, ...(s > 0 ? [a, b] : [-b, -a]) as [number, number], MOSSY);
  }
}

// ======================================================================== 1. West outfall (Embers)

// Floor: walkways each side of the channel, the channel bed.
B(-104, -80, -10.6, W, 2.5, 14, FLAG);
B(-104, -80, -10.6, W, -14, -2.5, FLAG);
B(-104, -80, -10.6, CH, -2.5, 2.5, SILT);
B(-104, -80, W - 0.05, W, 2.5, 2.8, MOSSY);
B(-104, -80, W - 0.05, W, -2.8, -2.5, MOSSY);
// Walls: the barred outfall arch west, the duct (north-east) and the rat run (south-east).
wallZ(-14.6, 14.6, -104.6, -104, -10.6, -1, BRICK, [[-3.5, 3.5, CH, -4]]);
wallX(-104.6, -79.4, 14, 14.6, -10.6, -1, BRICK);
wallX(-104.6, -79.4, -14.6, -14, -10.6, -1, BRICK, [[-84, -81.6, W, -5.4]]);
wallZ(-14, 14, -80, -79.4, -10.6, -1, BRICK, [[-6.6, 6.6, -10.6, -1.2], [10, 12.4, W, DUCT_TOP]]);
G(-104.6, -79.4, -1, -0.4, -14.6, 14.6, SOOT);
// Arched recesses in the long walls (blind arches, brick piers between).
for (const x of [-98, -90]) for (const z of [13.6, -14]) G(x - 0.4, x + 0.4, W, -1, z, z + 0.4, SOOT);
bars('z', -3.5, 3.5, -104.3, CH, -4);
// The river beyond the bars.
B(-112, -104.6, -11.2, -10.6, -8, 8, SILT);
wallZ(-8.6, 8.6, -112.6, -112, -11.2, -1, BRICK);
wallX(-112.6, -104.6, 8, 8.6, -11.2, -1, BRICK);
wallX(-112.6, -104.6, -8.6, -8, -11.2, -1, BRICK);
G(-112.6, -104.6, -1, -0.4, -8.6, 8.6, SOOT);
m.water([-108.3, -10.6, 0], [7.4, 2.2, 16], 'water');
// Weir terraces: raised stone platforms (3 m) along the west end, stairs down east.
B(-104, -90, -10.6, -5, 9, 14, MOSSY);
B(-104, -90, -10.6, -5, -14, -9, MOSSY);
stairs('x', -84, -1, 9.5, 14, W, 0.25, 12, -10.6, MOSSY);
stairs('x', -84, -1, -14, -9.5, W, 0.25, 12, -10.6, MOSSY);
for (const z of [9, -9.25]) rail(-104, -90, z, z + 0.25, -5);
// Bridges over the channel and steps out of it.
bridge(-95);
bridge(-86);
channelSteps(-100, 1);
channelSteps(-100, -1);

// ======================================================================== 2. The west interceptor (x -80 .. -8)

const COLLAPSE: Rect = [-60, -54, -3, 3];
interceptor(-80, -8, {
  N: [[-65, -63, W, DUCT_TOP], [-36, -33, W, DUCT_TOP]],
  S: [[-58, -56, W, -6.6], [-52, -49, W, -5]],
  holes: [COLLAPSE],
});
for (const x of [-72, -46, -26, -16]) rib(x);
for (const x of [-74, -40, -22]) bridge(x);
channelSteps(-77, 1);
channelSteps(-68, -1);
channelSteps(-30, 1);
channelSteps(-12, -1);
// The collapse: rubble heaped in the channel under the hole, a way out both sides.
B(-61, -53, CH, -9.0, -2.5, 2.5, SILT);
channelSteps(-57, 1, SILT);
channelSteps(-57, -1, SILT);
B(-60.5, -58.6, -9, -8.3, -1.6, 0.4, SILT, 'solid', { yaw: 0.5 });
B(-55.4, -53.6, -9, -8.5, -0.8, 1.2, SILT, 'solid', { yaw: -0.4 });
// Manhole M1: a niche in the north wall with a ladder up to the road.
B(-65, -63, W - 0.6, W, 6.6, 8.4, FLAG);
G(-65.6, -65, W - 0.6, -0.6, 6.6, 9);
G(-63, -62.4, W - 0.6, -0.6, 6.6, 9);
G(-65.6, -62.4, W - 0.6, -0.6, 8.4, 9);
m.add({ kind: 'ladder', position: [-64, W, 8.4], yaw: PI, height: 8, width: 1 });
// Passage north to the duct; a crouch culvert and a passage south to the collapsed hall.
passage(-36, -33, 6.6, 9.4, DUCT_TOP, false);
B(-58, -56, W - 0.6, W, -13.4, -6.6, FLAG);
G(-58.6, -58, W - 0.6, -6.6, -13.4, -6.6);
G(-56, -55.4, W - 0.6, -6.6, -13.4, -6.6);
G(-58.6, -55.4, -6.6, -6, -13.4, -6.6, SOOT);
passage(-52, -49, -13.4, -6.6, -5, false);

// ======================================================================== 3. The north ducts (rat runs)

/** A 2.4 m maintenance duct along z 10 .. 12.4. */
function duct(x0: number, x1: number, south: Gap[], north: Gap[]): void {
  B(x0, x1, W - 0.6, W, 10, 12.4, CONC);
  wallX(x0, x1, 9.4, 10, W - 0.6, DUCT_TOP, BRICK, south);
  wallX(x0, x1, 12.4, 13, W - 0.6, DUCT_TOP, BRICK, north);
  G(x0, x1, DUCT_TOP, DUCT_TOP + 0.6, 9.4, 13, SOOT);
}
duct(-79.4, -8.6, [[-36, -33, W, DUCT_TOP]], [[-74, -72, W, DUCT_TOP]]);
duct(24.6, 55.4, [[44, 46, W, -6.6]], []);
// Manhole M2: the duct's north niche, a ladder up to the alley.
B(-74, -72, W - 0.6, W, 12.4, 14.8, FLAG);
G(-74.6, -74, W - 0.6, -0.6, 12.4, 15.4);
G(-72, -71.4, W - 0.6, -0.6, 12.4, 15.4);
G(-74.6, -71.4, W - 0.6, -0.6, 14.8, 15.4);
m.add({ kind: 'ladder', position: [-73, W, 14.8], yaw: PI, height: 8, width: 1 });
// Crouch culvert from the east interceptor into the east duct.
B(44, 46, W - 0.6, W, 6.6, 9.4, FLAG);
G(43.4, 44, W - 0.6, -6.6, 6.6, 9.4);
G(46, 46.6, W - 0.6, -6.6, 6.6, 9.4);
G(43.4, 46.6, -6.6, -6, 6.6, 9.4, SOOT);
// Pipes along the ducts.
for (const [x0, x1] of [[-79, -9], [25, 55]] as const) B(x0, x1, -6.1, -5.6, 12.1, 12.4, RUST);

// ======================================================================== 4. The overflow chamber (x -8 .. 24, z -18 .. 18)

const POOL: Rect = [-2, 18, -8, 8];
const BASIN: Rect = [6, 10, 8, 13];
slab(-8, 24, -18, 18, -11.1, W, FLAG, [[-8, -2, -2.5, 2.5], POOL, [18, 24, -2.5, 2.5], BASIN]);
B(-8, -2, -11.1, CH, -2.5, 2.5, SILT);
B(18, 24, -11.1, CH, -2.5, 2.5, SILT);
B(-2, 18, -11.6, -10.5, -8, 8, SILT);
B(6, 10, -11.6, -10.5, 8, 13, SILT);
// Pool kerb.
for (const [x0, x1, z0, z1] of [[-2, 18, 8, 8.3], [-2, 18, -8.3, -8]] as const) B(x0, x1, W - 0.05, W, z0, z1, MOSSY);
m.water([8, -10.5, 0], [20, 2.1, 16], 'water');
m.water([8, -10.5, 10.5], [4, 2.1, 5], 'water');
m.water([8, -10.5, 12.6], [3, 10.9, 1.2], 'water'); // the waterfall
// The island (a hill) and its two bridges; steps up out of the pool.
B(4, 12, -11.6, W, -3, 3, MOSSY);
B(7, 9, W - 0.3, W, 3, 8, GRATE);
B(7, 9, W - 0.3, W, -8, -3, GRATE);
for (let k = 0; k < 10; k++) {
  B(0, 3, -10.5, -10.5 + 0.25 * (k + 1), -3.5 - 0.5 * k, -3 - 0.5 * k, MOSSY);
  B(13, 16, -10.5, -10.5 + 0.25 * (k + 1), 3 + 0.5 * k, 3.5 + 0.5 * k, MOSSY);
}
bridge(-5);
bridge(21);
// Walls and roof (12 m up).
wallZ(-18.6, 18.6, -8.6, -8, -11.6, 4.6, BRICK, [[-6.6, 6.6, -11.6, -1.2], [10, 12.4, W, DUCT_TOP]]);
wallZ(-18.6, 18.6, 24, 24.6, -11.6, 4.6, BRICK, [[-16, -13, W, -5], [-6.6, 6.6, -11.6, -1.2], [10, 12.4, W, DUCT_TOP]]);
wallX(-8.6, 24.6, 18, 18.6, -11.6, 4.6, BRICK);
wallX(-8.6, 24.6, -18.6, -18, -11.6, 4.6, BRICK, [[16, 20, W, -5]]);
G(-8.6, 24.6, 4.6, 5.2, -18.6, 18.6, SOOT);
// Vaulting ribs across the roof and the pillars.
for (const x of [-1, 8, 17]) G(x - 0.4, x + 0.4, 3.4, 4.6, -18, 18, SOOT);
const PILLARS: [number, number][] = [[-1, 11], [-1, -11], [8, -11], [17, 11], [17, -11]];
for (const [x, z] of PILLARS) {
  G(x - 0.8, x + 0.8, W, 4.6, z - 0.8, z + 0.8);
  G(x - 1, x + 1, W, W + 0.6, z - 1, z + 1, SOOT); // plinth
  G(x - 1, x + 1, 2.8, 3.4, z - 1, z + 1, SOOT); // capital
}
// Galleries 6 m up on the north, east and south walls.
B(-8, 24, -2.4, -2, 14, 18, SOOT);
B(20, 24, -2.4, -2, -14, 14, SOOT);
B(6, 24, -2.4, -2, -18, -14, SOOT);
rail(-8, -5, 13.8, 14, -2);
rail(-3, 20, 13.8, 14, -2);
rail(19.8, 20, -14, 14, -2);
rail(6, 20, -14, -13.8, -2);
// Stairs up the south wall to the south gallery; a ladder pier to the north one.
stairs('x', -6, 1, -18, -14.6, W, 0.25, 24, W - 0.6, MOSSY);
G(-6, -2, W - 0.6, -2.4, 14, 18);
m.add({ kind: 'ladder', position: [-4, W, 14], yaw: PI, height: 6, width: 1 });
// The inflow pipe high in the north wall, pouring into the basin.
B(5.5, 10.5, 0.4, 3.4, 13, 18, RUST);
B(5.2, 10.8, 0.1, 3.7, 12.7, 13.1, STEEL);
B(6.5, 9.5, 0.4, 0.6, 13.1, 17.9, 'pbr_charred_wood'); // the dark inside of the mouth
// The acid passage (east wall, south end) and the corridor down to the cistern stairs.
passage(24.6, 27.4, -16, -13, -5, true);
B(16, 20, W - 0.6, W, -22, -18, FLAG);
G(15.4, 16, -8.6, -5, -40.6, -18);
G(20, 20.6, -17.6, -5, -40.6, -18);
G(15.4, 20, -8.6, -5, -40.6, -40);
G(15.4, 20.6, -5, -4.4, -40.6, -18, SOOT);

// ======================================================================== 5. The east interceptor (x 24 .. 56)

interceptor(24, 56, { N: [[44, 46, W, -6.6]], S: [[30, 33, W, -5]] });
for (const x of [36, 50]) rib(x);
for (const x of [28, 52]) bridge(x);
channelSteps(34, 1);
channelSteps(47, -1);
m.water([39, CH, 0], [42, 1, 5], 'swamp');
m.water([-53, CH, 0], [102, 1, 5], 'swamp'); // outfall and west interceptor
passage(30, 33, -11.4, -6.6, -5, false);
// The sluice bulkhead at x 40: a door on each walkway, a crouch gap over the sewage.
for (const s of [1, -1]) {
  const zr = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
  B(40, 40.4, W, -1.2, ...zr(5.75, 6.6), RUST);
  B(40, 40.4, W, -1.2, ...zr(2.5, 2.75), RUST);
  B(40, 40.4, -5, -1.2, ...zr(2.75, 5.75), RUST);
}
B(40, 40.4, -8.1, -1.2, -2.5, 2.5, RUST);
B(39.8, 40.6, -5.3, -5, -6, 6, HAZARD);
const door = (id: string, name: string, pos: V3, yaw: number, locked = false) => m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked, auto: true });
door('sluice_n', 'North sluice', [40.2, W, 4.25], P);
door('sluice_s', 'South sluice', [40.2, W, -4.25], P);

// ======================================================================== 6. The pumping station (Tide)

slab(56, 92, -18, 18, -11.6, W, TREAD, [[56, 60, -2.5, 2.5], [60, 76, -5, 5]]);
B(56, 60, -11.6, CH, -2.5, 2.5, SILT);
B(60, 76, -12.2, -11, -5, 5, CONC);
m.water([68, -11, 0], [16, 2.6, 10], 'water');
for (let k = 0; k < 12; k++) B(70 + 0.5 * k, 70.5 + 0.5 * k, -11, -11 + 0.25 * (k + 1), -1.5, 1.5, CONC);
for (const [x0, x1, z0, z1] of [[60, 76, 5, 5.25], [60, 76, -5.25, -5]] as const) B(x0, x1, W, W + 0.9, z0, z1, HAZARD);
// Walls and roof.
wallZ(-18.6, 18.6, 55.4, 56, -11.6, 4.6, BRICK, [[-6.6, 6.6, -11.6, -1.2], [10, 12.4, W, DUCT_TOP]]);
wallZ(-18.6, 18.6, 92, 92.6, -11.6, 4.6, BRICK);
wallX(55.4, 92.6, 18, 18.6, -11.6, 4.6, BRICK);
wallX(55.4, 92.6, -18.6, -18, -11.6, 4.6, BRICK, [[73, 76, W, -5]]);
B(55.4, 92.6, 4.6, 5.2, -18.6, 18.6, 'pbr_corrugated', 'solid', { tint: '#5a6a60' });
for (const x of [64, 76, 88]) B(x - 0.3, x + 0.3, 3.8, 4.6, -18, 18, STEEL); // roof trusses
// Stairs up to the catwalks, the catwalks, the crossing over the sump.
stairs('x', 60, 1, 14, 18, W, 0.25, 20, W - 0.6, TREAD);
stairs('x', 60, 1, -18, -14, W, 0.25, 20, W - 0.6, TREAD);
B(70, 92, -3.3, -3, 14, 18, GRATE);
B(70, 92, -3.3, -3, -18, -14, GRATE);
B(69, 72, -3.3, -3, -14, 14, GRATE);
rail(72, 74, 13.8, 14, -3);
rail(78, 84, 13.8, 14, -3);
rail(87, 92, 13.8, 14, -3);
rail(72, 84, -14, -13.8, -3);
rail(87, 92, -14, -13.8, -3);
rail(68.8, 69, -13.8, 13.8, -3);
rail(72, 72.2, -13.8, 13.8, -3);
for (const z of [-14, 14]) for (const x of [74, 80, 90]) B(x - 0.2, x + 0.2, W, -3.3, z - 0.2, z + 0.2, STEEL); // catwalk legs
for (const x of [69.2, 71.8]) B(x - 0.2, x + 0.2, W, -3.3, 6, 6.4, STEEL);
// The control room (3 m up, east end): windows west over the sump, doors onto catwalk spurs.
B(80, 92, -3.3, -3, -8.6, 8.6, TREAD);
wallZ(-8.6, 8.6, 79.4, 80, -3, -2, STEEL, [], undefined);
wallZ(-8.6, 8.6, 79.4, 80, 0, 1, STEEL, [], undefined);
for (const z of [-8.3, -2.5, 2.5, 8.3]) B(79.4, 80, -2, 0, z - 0.3, z + 0.3, STEEL);
wallX(79.4, 92, 8, 8.6, -3, 1, STEEL, [[84, 87, -3, 0]], undefined);
wallX(79.4, 92, -8.6, -8, -3, 1, STEEL, [[84, 87, -3, 0]], undefined);
B(79.4, 92, 1, 1.4, -8.6, 8.6, CONC);
B(84, 87, -3.3, -3, 8.6, 14, GRATE);
B(84, 87, -3.3, -3, -14, -8.6, GRATE);
for (const [x, z] of [[80.3, -8.3], [80.3, 8.3], [86, -8.3], [86, 8.3]] as const) B(x - 0.3, x + 0.3, W, -3.3, z - 0.3, z + 0.3, STEEL);
B(88, 91.4, -3, -2.1, -2, 2, STEEL); // the control desk
// Pump housings round the sump.
for (const [x, z] of [[63, 8], [72, 8], [63, -8], [72, -8]] as const) {
  B(x - 1.6, x + 1.6, W, W + 0.5, z - 1.6, z + 1.6, CONC);
  B(x - 1.2, x + 1.2, W + 0.5, W + 2.6, z - 1.2, z + 1.2, 'pbr_steel', 'solid', { tint: '#4f7a5a' });
  B(x - 0.35, x + 0.35, W + 2.6, -3.3, z - 0.35, z + 0.35, RUST); // riser pipe to the catwalk level
}
// The bypass corridor: acid chamber → pumping station (sluice door, locked until the floodgates cycle).
B(52.6, 76, W - 0.6, W, -27, -24, CONC);
B(73, 76, W - 0.6, W, -24, -18.6, CONC);
G(52.6, 76.6, W - 0.6, -5, -27.6, -27);
G(52.6, 73, W - 0.6, -5, -24, -23.4);
G(76, 76.6, W - 0.6, -5, -27, -18.6);
G(72.4, 73, W - 0.6, -5, -23.4, -18.6);
G(52.6, 76.6, -5, -4.4, -27.6, -18.6, SOOT);
door('sluice_bypass', 'Acid bypass sluice', [64, W, -25.5], P, true);

// ======================================================================== 7. The acid chamber (x 28 .. 52, z -34 .. -12)

const PIT: Rect = [31, 49, -31, -16];
slab(28, 52, -34, -12, -9.6, W, CONC, [PIT]);
B(31, 49, -10.2, -9, -31, -16, SILT);
m.water([40, -9, -23.5], [18, 0.6, 15], 'acid');
walls(28, 52, -34, -12, -9.6, -1, BRICK, { N: [[30, 33, W, -5]], W: [[-16, -13, W, -5]], E: [[-27, -24, W, -5]] });
G(27.4, 52.6, -1, -0.4, -34.6, -11.4, SOOT);
// The catwalk across the pit: it holds at the ends and crumbles in the middle.
B(38.5, 41.5, W - 0.3, W, -31, -25, GRATE);
B(38.5, 41.5, W - 0.3, W, -25, -22, RUST, 'crumble', { delay: 0.8, respawn: 7 });
B(38.5, 41.5, W - 0.3, W, -22, -16, GRATE);
// Stepping stones along the east side, steps out of the pit on the north.
for (const z of [-28, -24.5, -21]) B(44.4, 46, -9, W, z - 0.8, z + 0.8, MOSSY);
for (let k = 0; k < 4; k++) B(45, 48, -9, -9 + 0.25 * (k + 1), -18 + 0.5 * k, -17.5 + 0.5 * k, CONC);
for (const [x0, x1, z0, z1] of [[31, 49, -16, -15.8], [31, 49, -31.2, -31], [30.8, 31, -31, -16], [49, 49.2, -31, -16]] as const) B(x0, x1, W, W + 0.08, z0, z1, HAZARD);

// ======================================================================== 8. The collapsed hall (x -76 .. -48, z -38 .. -14)

const HOLE_A: Rect = [-62, -56, -32, -26]; // under the crumbling floor
const HOLE_B: Rect = [-54, -50, -26, -22]; // the pad shaft
const HOLE_L: Rect = [-65, -63, -23.8, -22]; // the ladder
slab(-76, -48, -38, -14, W - 0.6, W, FLAG, [HOLE_A, HOLE_B, HOLE_L]);
walls(-76, -48, -38, -14, W - 0.6, -1, BRICK, { N: [[-58, -56, W, -6.6], [-52, -49, W, -5]], W: [[-26, -23.6, W, -5.4]], E: [[-36, -33, W, -5]] });
G(-76.6, -47.4, -1, -0.4, -38.6, -13.4, SOOT);
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) B(-62 + 2 * i, -60 + 2 * i, W - 0.3, W, -32 + 2 * j, -30 + 2 * j, 'pbr_planks', 'crumble', { delay: 0.9, respawn: 8, tint: '#8a7a64' });
// Rubble: fallen vault courses, a broken pier, heaps against the walls.
B(-75, -70, W, -6.6, -37, -33, SILT, 'solid', { yaw: 0.2 });
B(-74, -71, -6.6, -5.6, -36.5, -34, SILT, 'solid', { yaw: 0.5 });
B(-52, -49.5, W, -7.2, -37, -34.5, SILT, 'solid', { yaw: -0.3 });
G(-67, -65.4, W, -4.5, -18.8, -17.2, SOOT); // a broken pier
B(-66.4, -64.2, W, -7.3, -20.6, -19.6, SOOT, 'solid', { yaw: 0.9 });
G(-55, -53.4, W, -1, -34.8, -33.2, SOOT); // a pier that holds
G(-69, -67.4, W, -1, -34.8, -33.2, SOOT);
B(-60, -58, -2.6, -1, -25, -15, SOOT, 'solid', { yaw: 0.15 }); // a sagging beam
B(-76, -70, -1.6, -1, -38, -14, MOSSY, 'solid', { yaw: 0 });
// The rat run from the outfall: south from its south-east corner, then east into the hall.
B(-84, -81.6, W - 0.6, W, -26, -14.6, CONC);
B(-81.6, -76.6, W - 0.6, W, -26, -23.6, CONC);
G(-84.6, -84, W - 0.6, -5.4, -26.6, -14.6);
G(-84.6, -76.6, W - 0.6, -5.4, -26.6, -26);
G(-81.6, -81, W - 0.6, -5.4, -23, -14.6);
G(-81.6, -76.6, W - 0.6, -5.4, -23.6, -23);
G(-84.6, -76.6, -5.4, -4.8, -26.6, -14.6, SOOT);
// Passage east to the storm drain.
passage(-47.4, -42.6, -36, -33, -5, true);

// ======================================================================== 9. The storm drain (street → sewer)

// The stair flight down the cut, the landing at the bottom, the cut walls (open to the sky).
stairs('z', -16, -1, -42, -30, 0, -0.25, 32, W - 0.6, CONC);
for (const [x0, x1] of [[-42.6, -42], [-30, -29.4]] as const) {
  B(x0, x1, W - 0.6, 0, -20, -16, CONC);
  B(x0, x1, 0, 1.05, -20, -16, CONC);
}
wallZ(-38.6, -20, -42.6, -42, W - 0.6, 6, CONC, [[-36, -33, W, -5]], undefined);
wallZ(-38.6, -20, -30, -29.4, W - 0.6, 6, CONC, [], undefined);
wallX(-42.6, -29.4, -38.6, -38, W - 0.6, 6, CONC, [[-38, -34, W, -5]], undefined);
bars('x', -38, -34, -38.3, W, -5);
passage(-38, -34, -41, -38.6, -5, true, CONC);
G(-38.6, -33.4, W - 0.6, -5, -41.6, -41, CONC);
B(-42, -30, W - 0.05, W, -38, -32, 'pbr_concrete');

// ======================================================================== 10. The cistern (y -17)

const STAIRWELL: Rect = [16, 20, -40, -22];
B(-68, 20, C - 0.6, C, -52, -22, FLAG);
walls(-68, 20, -52, -22, C - 0.6, W - 0.6, BRICK);
// Its ceiling is the floor above (the collapsed hall builds its own).
slab(-68.6, 20.6, -52.6, -21.4, W - 0.6, W, FLAG, [[-76, -47.4, -38.6, -13.4], STAIRWELL]);
m.water([-24, C, -37], [88, 0.4, 30], 'water');
for (let x = -60; x <= 12; x += 8) for (const z of [-44, -30]) {
  if (x >= -28 && x <= -20 && z === -44) continue;
  G(x - 0.7, x + 0.7, C, W - 0.6, z - 0.7, z + 0.7, SOOT);
  G(x - 0.9, x + 0.9, -10.2, W - 0.6, z - 0.9, z + 0.9, SOOT);
}
// The dais (rocket launcher).
B(-29.5, -18.5, C, C + 0.25, -42.5, -31.5, MOSSY);
B(-29, -19, C + 0.25, C + 0.5, -42, -32, MOSSY);
B(-28, -20, C + 0.5, C + 0.75, -41, -33, 'pbr_marble_black');
// The long stairs up the east wall to the overflow chamber.
stairs('z', -22, -1, 16, 20, W, -0.25, 36, C - 0.6, MOSSY);
// The ladder up to the collapsed hall (against the north wall).
m.add({ kind: 'ladder', position: [-64, C, -22], yaw: PI, height: 9, width: 1 });

// The jump pad up the open shaft: checked tick by tick so the flight clears the hole.
function solvePush(from: V3, to: V3, power: number): number {
  const want = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const flight = (push: number): number | null => {
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
  let lo = 0;
  let hi = 40;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if ((flight(mid) ?? Infinity) < want) lo = mid;
    else hi = mid;
  }
  return lo;
}
/** Where along the flight (metres from the pad) the feet and head pass a slab between y0 and y1. */
function crossing(from: V3, power: number, push: number, y0: number, y1: number): [number, number] {
  let y = from[1];
  let vy = power;
  let v = push;
  let d = 0;
  let first = Infinity;
  let last = -Infinity;
  for (let t = 0; t < 8 && vy > -1; t += TICK_DT) {
    if (y + PLAYER.height > y0 && y < y1 && vy > 0) {
      first = Math.min(first, d);
      last = Math.max(last, d);
    }
    d += v * TICK_DT;
    y += vy * TICK_DT;
    vy -= PLAYER.gravity * TICK_DT;
    v *= AIR_PUSH_DECAY;
  }
  return [first, last];
}
{
  const from: V3 = [-52, C, -25.4];
  const to: V3 = [-52, W, -19.5];
  const power = 22;
  const push = solvePush(from, to, power);
  const [a, b] = crossing(from, power, push, W - 0.6, W);
  // The shaft runs z -26 .. -22: the body (0.4 m round) must be inside it from first touch to last.
  if (from[2] + a - 0.4 < HOLE_B[2] || from[2] + b + 0.4 > HOLE_B[3]) throw new Error(`underdrain: the cistern pad clips the shaft (${a.toFixed(2)}..${b.toFixed(2)} m)`);
  m.pad(from, 0, power, +push.toFixed(2));
}

// ======================================================================== 11. The street (y 0)

m.tile('city.crossroads', -6, -1);
m.tile('city.street', -2, 0);
m.tile('city.street', -5, 3, 0, 1);
m.tile('city.brownstone', -7, 3, 0, 2);
m.tile('city.midrise', -8, -2);
// Corner shops: a pub on the north-east corner, a shop on the south-east.
m.tile('room', -2, 2, 0, 0, { facade: 'brick', ceiling: 'roof' });
m.tile('room', -2, 3, 0, 0, { facade: 'brick', ceiling: 'roof' });
m.tile('room', -2, -1, 0, 0, { facade: 'storefront', ceiling: 'roof' });
m.tile('room', -2, -2, 0, 0, { facade: 'plaster', ceiling: 'roof' });
const edge = (x: number, y: number, side: Side, style: EdgeStyle) => m.edge(x, y, 0, side, style);
edge(-2, 2, 'S', 'door');
edge(-2, 2, 'W', 'window');
edge(-2, 2, 'N', 'open');
edge(-2, 3, 'W', 'door');
edge(-2, -1, 'N', 'wide');
edge(-2, -1, 'W', 'window');
edge(-2, -1, 'S', 'open');
edge(-2, -2, 'W', 'door');

const M1: Rect = [-65, -63, 6.6, 8.4];
const M2: Rect = [-74, -72, 12.4, 14.8];
const DRAIN: Rect = [-42, -30, -20, -16];
// The west road: asphalt between pavements, the manhole and the collapse.
slab(-76, -52, -1, 9, -0.6, 0, ASPH, [M1, COLLAPSE]);
slab(-76, -52, 9, 12, -0.6, 0, PAVE, [M1, COLLAPSE]);
slab(-76, -52, -4, -1, -0.6, 0, PAVE, [M1, COLLAPSE]);
// Alleys and pavements round the tiles.
slab(-76, -68, 12, 28, -0.6, 0, PAVE, [M2]);
slab(-76, -68, -20, -4, -0.6, 0, PAVE);
slab(-52, -44, 20, 28, -0.6, 0, PAVE);
slab(-28, -20, 20, 28, -0.6, 0, PAVE);
slab(-52, -20, -20, -12, -0.6, 0, PAVE, [DRAIN]);
// The enclosing walls (a railway viaduct's brick, 14 m).
const VIADUCT = { tint: '#6a4a3e' };
B(-76.6, -76, 0, 14, -21, 29, 'pbr_brick_red', 'solid', VIADUCT);
B(-76.6, -11.4, 0, 14, 28.4, 29, 'pbr_brick_red', 'solid', VIADUCT);
B(-76.6, -42.6, 0, 14, -21, -20.4, 'pbr_brick_red', 'solid', VIADUCT);
B(-29.4, -11.4, 0, 14, -21, -20.4, 'pbr_brick_red', 'solid', VIADUCT);
B(-12, -11.4, 0, 14, -4, 12, 'pbr_brick_red', 'solid', VIADUCT);
for (const x of [-72, -56, -40, -24]) B(x - 1, x + 1, 0, 14, 27.6, 28.4, 'pbr_brick_red', 'solid', VIADUCT); // piers
// The collapse: broken road slabs tipped into the hole, kerb stones on the road.
B(-60.4, -59.6, -1.6, -0.5, -2.6, 2.4, ASPH, 'solid', { yaw: 0.2 }); // broken lips hanging into the hole
B(-54.4, -53.6, -1.5, -0.6, -1.8, 2.2, ASPH, 'solid', { yaw: -0.25 });
B(-58.4, -55.6, -0.4, 0.15, 3, 3.9, ASPH, 'solid', { yaw: 0.1 });
B(-58, -55.8, -0.4, 0.12, -3.9, -3.1, ASPH, 'solid', { yaw: -0.15 });
// The storm drain's parapet on the street.
B(-42.6, -29.4, 0, 1.05, -20.6, -20, CONC);

// ======================================================================== props

// Street: lamp posts, road works round the collapse, bins, a skip.
const STREETLAMPS: [number, number, number][] = [[-70, -3.2, 0], [-58, 11.2, PI], [-48, -10, 0], [-24, -10, 0], [-48, 18, PI], [-24, 18, PI], [-16, -3.2, 0], [-40, 26.5, PI], [-72, 26, PI], [-72, -18, 0]];
for (const [x, z, yaw] of STREETLAMPS) {
  m.prop('lightpost', [x, 0, z], yaw, 1.5, true);
  m.light([x, 4.3, z], { fixture: 'none', color: '#ffcf8a', intensity: 1.6, range: 16 });
}
for (const [x, z] of [[-61.5, -4.6], [-52.6, -4.6], [-61.5, 4.6], [-52.6, 4.6]] as const) m.prop('cone', [x, 0, z]);
m.prop('barrier', [-57, 0, -5], 0).prop('barrier', [-57, 0, 5.2], 0).prop('barrier', [-63, 0, 0], P);
m.prop('warning_sign', [-51, 0, 0], -P);
m.prop('skip', [-73, 0, -10], 0, 1.4).prop('sv_trashcan_metal', [-69.2, 0, -16]).prop('hm_bin_large', [-70.5, 0, 18]).prop('hm_bin_large', [-69.2, 0, 22]);
m.prop('container', [-74, 0, 25], 0.2).prop('crate_large', [-25, 0, 26], 0.3).prop('cardboard_box', [-26.5, 0, 22.5], 0.6);
m.prop('cart', [-49, 0, 25], 1.2).prop('sv_trashcan_metal', [-21, 0, 21]);
m.prop('barrier', [-36, 0, -13.3], 0).prop('cone', [-41, 0, -15]).prop('cone', [-31, 0, -15]);
m.prop('cardboard_box', [-14.5, 0, -16.5], 0.4).prop('shelf_boxes', [-13.2, 0, -14], -P).prop('shelf_boxes', [-13.2, 0, -10], -P);
m.prop('table_round', [-16, 0, 25]).prop('bar_stool', [-14.8, 0, 25.4]).prop('bar_stool', [-17, 0, 26]).prop('barrel', [-13.4, 0, 27]).prop('barrel', [-13.4, 0, 18.5]);
// Sewer: wall torches (warm lamps), barrels, crates, rubble.
const LAMP = '#ffb45c';
const SLIME = '#58c47c';
const lamp = (p: V3, yaw: number) => {
  m.prop('dg_wall_torch', p, yaw, 1, false);
  m.light([p[0] + Math.sin(yaw) * 0.4, p[1] + 0.9, p[2] + Math.cos(yaw) * 0.4], { fixture: 'none', color: LAMP, intensity: 1.2, range: 10 });
};
for (const x of [-68, -52, -36, -20]) lamp([x, -5.3, 5.85], PI);
for (const x of [-60, -44, -28, -12]) lamp([x, -5.3, -5.85], 0);
for (const x of [30, 46]) lamp([x, -5.3, 5.85], PI);
lamp([54, -5.3, -5.85], 0);
for (const z of [-10, 6]) lamp([-79.6, -4.8, z], -P);
lamp([-103.6, -2.5, 10], P);
lamp([-103.6, -2.5, -10], P);
for (const [x, z, yaw] of [[-75.6, -30, P], [-48.4, -20, -P], [-62, -37.6, 0], [-62, -14.4, PI]] as const) lamp([x, -4.5, z], yaw);
for (const [x, z, yaw] of [[-7.6, -12, P], [-7.6, 8, P], [23.6, 8, -P], [23.6, -8, -P]] as const) lamp([x, -4.5, z], yaw);
for (const [x, z, yaw] of [[27.6, -20, P], [51.6, -30, -P]] as const) lamp([x, -4.5, z], yaw);
m.prop('barrel', [-102.5, W, -4.2]).prop('dungeon_barrel', [-101.2, W, -5.2]).prop('crate_small', [-82, W, 4.5], 0.3);
m.prop('crate_large', [-101.5, -5, -13], 0.2).prop('dg_crate', [-82.2, W, -12.6], 0.4);
m.prop('debris', [-70, W, -21], 0.4, 1.6).prop('debris', [-52, W, -16], 1.7, 1.4).prop('rock_large', [-71, W, -28], 0.6, 0.9).prop('rocks_tall', [-50, W, -30], 0.2, 0.8);
m.prop('planks_stack', [-64, W, -36], 0.1).prop('dg_barrel', [-74.5, W, -16]).prop('bucket', [-73.6, W, -15.4]);
m.prop('debris', [-58, W, 4.2], 0.5, 1.2).prop('rock_medium', [-55.6, W, -4.4], 0.3).prop('rock_small', [-59.2, W, -4.8], 1.2);
m.prop('dg_barrel', [-30, W, 4.5]).prop('crate_small', [-18, W, -4.6], 0.5).prop('dungeon_barrel', [-78.8, W, -4.5]);
m.prop('sf_pipe_rack', [-46, W, 11.2], 0, 1, false);
m.prop('sf_pipe_rack', [38, W, 11.2], 0, 1, false);
// Overflow chamber: crates by the stair foot, a toolbox of barrels on the galleries.
m.prop('crate_large', [-6.5, W, -11.5], 0.1).prop('barrel', [22.6, W, 14.6]).prop('dungeon_barrel', [22.4, W, -9.6]);
m.prop('crate_small', [22.5, -2, -2], 0.4).prop('metal_crate', [-7, -2, 17.3], 0.2).prop('barrel', [22.8, -2, 10]);
// Pumping station machinery.
m.prop('machine', [88.8, W, 14.8], PI).prop('hopper_tall', [59.4, W, 9], 0).prop('hopper_tall', [59.4, W, -9], 0);
m.prop('big_pipe', [80, W, 11], 0).prop('big_pipe', [78, W, -10.5], 0).prop('conveyor', [81, W, -16.2], 0, 0.8);
m.prop('pipe_valve', [74.2, W, 2.2]).prop('cog', [90.8, W, -15.6], P, 0.5).prop('metal_crate', [57.4, W, 7.2], 0.3).prop('factory_box', [90.6, W, 10], 0);
m.prop('sf_column_pipes', [76.4, W, 16.6], 0, 1, true).prop('sf_column_pipes', [76.4, W, -16.6], 0, 1, true);
m.prop('computer_bank', [91, -3, 5.6], -P).prop('screen_panel', [91.4, -3, -5.2], -P).prop('office_chair', [87, -3, 0.6], P, 1, false);
m.prop('warning_sign', [57.4, W, -4.6], P).prop('warning_sign', [39.2, W, 6.6 - 0.5], PI);
// Acid chamber: drums of waste.
for (const [x, z] of [[33, -29.5], [34.2, -28.6], [47, -17.6], [36.4, -18], [47.6, -29.8]] as const) m.prop('sf_barrel', [x, -9, z], x * 0.3); // dumped in the pit
m.prop('barrel_open', [32.2, -9, -17.4]).prop('warning_sign', [36.4, W, -13.4], PI).prop('warning_sign', [43.6, W, -32.6], 0);
// Cistern: buckets, a boat, candles at the dais.
m.prop('rowboat', [4, C, -48], 0.4).prop('candles', [-28.4, C + 0.25, -32]).prop('candles', [-19.6, C + 0.25, -42]).prop('urn', [-29, C + 0.25, -42]);

// ======================================================================== lights (sewer greens, warm lamps)

const glow = (p: V3, color = SLIME, intensity = 0.9, range = 12) => m.light(p, { fixture: 'none', color, intensity, range });
for (const x of [-96, -84]) glow([x, -7.2, 0]);
for (const x of [-70, -54, -38, -22]) glow([x, -7.2, 0]);
for (const x of [32, 48]) glow([x, -7.2, 0]);
for (const x of [-64, -44, -24]) m.light([x, DUCT_TOP - 0.3, 11.2], { fixture: 'bulb', color: '#d8c890', intensity: 0.7, range: 9 });
for (const x of [32, 48]) m.light([x, DUCT_TOP - 0.3, 11.2], { fixture: 'bulb', color: '#d8c890', intensity: 0.7, range: 9 });
// Overflow chamber: a green glow off the pool, the waterfall lit cold, lamps on the galleries.
for (const [x, z] of [[2, -4], [14, -4], [2, 5], [14, 5]] as const) glow([x, -9.4, z], '#4fd08a', 1.1, 13);
m.light([8, 1.4, 12.2], { fixture: 'none', color: '#a8e0ff', intensity: 1.3, range: 12 });
for (const x of [-4, 12]) m.light([x, 3, 0], { fixture: 'bulb', color: LAMP, intensity: 1.1, range: 18 });
for (const [x, z] of [[2, 16.5], [18, 16.5], [22, 0], [14, -16.5]] as const) m.light([x, 0.2, z], { fixture: 'none', color: LAMP, intensity: 0.9, range: 9 });
// Pumping station: work lamps under the roof, cool screens in the control room.
for (const x of [62, 74, 86]) for (const z of [-9, 9]) m.light([x, 3.2, z], { fixture: 'bulb', color: '#ffd9a8', intensity: 1, range: 15 });
m.light([86, 0.6, -3], { fixture: 'ceiling', color: '#cfe0ff', intensity: 1, range: 9 }).light([86, 0.6, 4], { fixture: 'ceiling', color: '#cfe0ff', intensity: 0.9, range: 9 });
glow([68, -9, 0], '#4fd08a', 0.9, 10);
// Acid chamber: poisonous green over the pit.
for (const [x, z] of [[34, -27], [46, -27], [34, -19], [46, -19]] as const) glow([x, -8.6, z], '#86ff3a', 1.5, 12);
// Collapsed hall, rat runs, storm drain, street hole.
glow([-59, -9.5, -29], '#4fb0a0', 1, 10);
m.light([-58, -1.6, 0], { fixture: 'none', color: '#9ab8ff', intensity: 0.8, range: 10 }); // moonlight through the hole
m.light([-82.8, -5.8, -20], { fixture: 'bulb', color: '#d8c890', intensity: 0.6, range: 8 });
m.light([-36, -2, -30], { fixture: 'none', color: '#b8c8ff', intensity: 0.9, range: 14 });
m.light([-36, -5.6, -36], { fixture: 'wall', color: LAMP, intensity: 0.9, range: 9, yaw: 0 });
m.light([-45, -5.6, -34.5], { fixture: 'bulb', color: '#d8c890', intensity: 0.6, range: 7 });
// Cistern: a cold blue-green gloom, one warm lamp on the dais.
for (let x = -56; x <= 8; x += 16) for (const z of [-37]) glow([x, -11, z], '#3f8f86', 1, 16);
glow([-60, -11, -26], '#3f8f86', 0.8, 10);
m.light([-24, -12, -37], { fixture: 'none', color: '#ffb060', intensity: 1.4, range: 10 });
m.light([18, -9, -30], { fixture: 'none', color: LAMP, intensity: 0.8, range: 9 });
// Shops.
for (const [x, z] of [[-16, 16], [-16, 24], [-16, -8], [-16, -16]] as const) m.light([x, 3.4, z], { fixture: 'ceiling', color: '#ffe2b0', intensity: 0.9, range: 9 });

// ======================================================================== the floodgates (logic)

const button = (id: string, name: string, pos: V3, yaw: number, label: string) => {
  m.add({ kind: 'button', id, name, position: pos, yaw, label, once: false, cooldownSeconds: 1, startEnabled: true });
  // The tell: a red lamp over each lever.
  m.light([pos[0] - Math.sin(yaw) * 0.25, pos[1] + 2.3, pos[2] - Math.cos(yaw) * 0.25], { fixture: 'wall', color: '#ff3a2a', intensity: 1, range: 5, yaw });
  m.prop('lever', [pos[0] + Math.sin(yaw) * 0.6, pos[1], pos[2] + Math.cos(yaw) * 0.6], yaw + PI, 1, false);
};
button('btn_floodgates', 'Floodgate lever (control room)', [91.7, -3, -1.6], -P, 'Cycle the floodgates');
button('btn_penstock', 'Penstock lever (outfall)', [-103.7, -5, 11.4], P, 'Cycle the floodgates');
const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const wait = (s: number) => act('wait', null, { value: s });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], once = false): LogicRule => ({ id, name, enabled: true, once, when, if: [], do: does });
const SLUICES = ['sluice_n', 'sluice_s'];
const cycle = (btn: string): LogicAction[] => [
  act('disable', 'btn_floodgates'),
  act('disable', 'btn_penstock'),
  act('sound', null, { state: 'alarm' }),
  say('Floodgates! The interceptor sluices are shutting and the acid bypass is open for 20 seconds.', 4),
  ...SLUICES.flatMap((d) => [act('door_lock', d), act('door_close', d)]),
  act('door_unlock', 'sluice_bypass'),
  act('door_open', 'sluice_bypass'),
  wait(20),
  act('door_close', 'sluice_bypass'),
  act('door_lock', 'sluice_bypass'),
  ...SLUICES.map((d) => act('door_unlock', d)),
  act('sound', null, { state: 'chime' }),
  say('The sluices are open again; the bypass is sealed.', 3),
  wait(25),
  act('enable', 'btn_floodgates'),
  act('enable', 'btn_penstock'),
  say(btn === 'btn_floodgates' ? 'The floodgate levers are reset.' : 'The penstock and floodgate levers are reset.', 2),
];
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_intro', 'Welcome', { event: 'match_start', target: null }, [say('Underdrain: red lamps mark the floodgate levers, in the pump control room and on the outfall terrace.', 6)], true),
    rule('rule_floodgates', 'Floodgates (control room)', { event: 'button_pressed', target: 'btn_floodgates' }, cycle('btn_floodgates')),
    rule('rule_penstock', 'Floodgates (outfall)', { event: 'button_pressed', target: 'btn_penstock' }, cycle('btn_penstock')),
    rule('rule_rockets', 'Rockets taken', { event: 'pickup_taken', target: 'pickup_rockets' }, [say('Someone has taken the rockets from the cistern.', 3)]),
  ],
});

// ======================================================================== spawns, flags, hills

m.teams([7, 7]);
const [embers, tide] = m.teamIds(2) as [string, string];
const FFA: [V3, number][] = [
  [[-70, 0, 4], P], [[-46, 0, 16], PI], [[-26, 0, -8], -P], [[-36, 0, 25], PI], [[-16, 0, 22], PI], [[-16, 0, -15], 0], [[-72, 0, -14], 0],
  [[-62, W, 4.4], P], [[-30, W, -4.4], -P], [[-44, W, 11.2], P],
  [[-70, W, -26], P], [[-44, W, -35.5], P],
  [[-4, W, -12], 0], [[20, W, 12], PI], [[14, -2, -16], -P],
  [[36, W, 4.4], -P], [[44, W, -14.5], PI], [[40, W, 11.2], -P],
  [[-40, C, -26], 0], [[0, C, -48], 0],
];
for (const [p, yaw] of FFA) m.spawn(p, yaw);
for (const [p, yaw] of [
  [[-100, -5, 11.5], P], [[-94, -5, 11.5], P], [[-100, -5, -11.5], P], [[-90, W, 5], P], [[-90, W, -5], P], [[-98, W, 5], P], [[-84, W, -7], P],
] as [V3, number][]) m.spawn(p, yaw, embers);
for (const [p, yaw] of [
  [[84, W, -4.5], -P], [[84, W, 4.5], -P], [[89.5, W, -4], -P], [[89.5, W, 4], -P], [[86, -3, -5], -P], [[84, -3, 5], -P], [[80, -3, 16], -P],
] as [V3, number][]) m.spawn(p, yaw, tide);
m.flag(embers, [-96, -5, -11.6], P).flag(tide, [87, W, 12], -P);
// King of the Hill: the overflow island, the pump control room, the street crossroads.
m.hill([8, W, 0], 4).hill([86, -3, 0], 4).hill([-36, 0, 4], 6);

// ======================================================================== pickups

// Street.
m.pickup('weapon_burst_rifle', [-36, 0, 24]).pickup('weapon_smg', [-70, 0, -12]).pickup('health_small', [-72, 0, 20]);
m.pickup('armor_small', [-17.5, 0, 21]).pickup('ammo', [-16, 0, -12]).pickup('ammo_rifle', [-24, 0, 12]).pickup('grenades', [-46, 0, -16]);
// Outfall (Embers).
m.pickup('weapon_smg', [-92, W, 6]).pickup('weapon_shotgun', [-92, W, -6]).pickup('ammo', [-102, W, 8]).pickup('health_small', [-102, W, -8]).pickup('armor_small', [-97, -5, 12.6]);
// West interceptor, ducts, collapsed hall: close-quarters guns.
m.pickup('weapon_shotgun', [-48, W, 4.4]).pickup('ammo_shells', [-74, W, -4.4]).pickup('health_small', [-20, W, 4.4]).pickup('ammo_light', [-34, W, -4.4]);
m.pickup('weapon_sawed_off', [-56, W, 11.2]).pickup('ammo_shells', [-20, W, 11.2]).pickup('health_small', [-82.8, W, -20]);
m.pickup('weapon_auto_shotgun', [-62, W, -19]).pickup('health_large', [-58, W, -36.5]).pickup('armor_small', [-73, W, -24.8]).pickup('ammo_shells', [-36, W, -35]);
// Overflow chamber: the sniper rifle on the north gallery, armour on the south one.
m.pickup('weapon_sniper', [16, -2, 16]).pickup('ammo_sniper', [-6.5, -2, 15.8]).pickup('armor_large', [20, -2, -16], 40);
m.pickup('health_small', [-5, W, 9]).pickup('health_small', [21, W, -10]).pickup('ammo', [8, W, 0]).pickup('ammo_rifle', [22, -2, 6]);
// East interceptor and duct.
m.pickup('weapon_smg', [48, W, -4.4]).pickup('ammo_light', [30, W, 4.4]).pickup('weapon_shotgun', [50, W, 11.2]).pickup('health_small', [34, W, 11.2]);
// Acid chamber.
m.pickup('gas_grenades', [40, W, -18]).pickup('health_large', [50, W, -22]).pickup('armor_small', [30, W, -28]);
// Pumping station (Tide): grenades round the machinery.
m.pickup('grenades', [58, W, 15.5]).pickup('grenades', [58, W, -15.5]).pickup('grenades', [80, W, 0]).pickup('weapon_rifle', [72, -3, 16]);
m.pickup('ammo', [90, W, -12]).pickup('health_small', [82, W, -14]).pickup('armor_small', [70.5, -3, 0]).pickup('health_large', [83, -3, -2]);
m.pickup('weapon_shotgun', [74, -3, -16]);
// The cistern: the power weapon.
m.add({ kind: 'pickup', id: 'pickup_rockets', item: 'core.weapon_rockets', position: [-24, C + 0.75, -37], respawnSeconds: 60 });
m.pickup('ammo_explosive', [8, C, -26]).pickup('armor_large', [-60, C, -48], 45).pickup('health_small', [-44, C, -40]).pickup('health_small', [12, C, -48]);

// Pads: the pumping-station floor up to the north catwalk.
m.padTo([76, W, 9.6], [76, -3, 16], 16);

m.bounds('invisible', 4);
m.meta({
  description:
    'A night-time city crossroads over a sprawling Victorian sewer. Climb down the manholes, drop through the collapsed road or take the storm drain stairs into the great arched interceptor, wade its sewage channel or hold its walkways. The overflow chamber is a cathedral of brick round a deep pool and a waterfall (sniper on the gallery); the pumping station\'s floodgate lever shuts the sluices and opens the acid bypass. A crumbling floor drops into the flooded cistern, where the rocket launcher waits. Embers hold the west outfall, Tide the pumping station.',
  modes: ['core.deathmatch', 'core.tdm', 'core.ctf', 'core.koth', 'core.zombies'],
  players: [6, 14],
});
await m.save();
