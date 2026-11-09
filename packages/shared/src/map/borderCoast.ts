import { borderEdges, borderGround, borderNoise, borderSeed, borderStyles, type BorderEdge, type BorderSide } from './border.ts';
import type { MapDocument } from './schema.ts';
import { resolveBackdrop } from './backdrop.ts';

/**
 * The "coast" border side (map format v32): for a side a shoreline runs out through (Iron Coast's east and west
 * ends, the beach along the south). Past the line the ground at the line carries on outwards, so whatever meets the
 * boundary goes on beyond it:
 *
 * - the shore (the stretch of the line from a seaward end, ground within BEACH m of the sea): sand and shallow water
 *   carry on along the shoreline at their own height, the sea over them;
 * - higher ground by the shore (cliffs, the crest behind them): kept up close, then easing down to low headlands (a
 *   third of its height over the beach) and rounded along the line as it goes out, with dunes on the low ground behind
 *   the shore; further inland the ground carries on at its height;
 * - forest only inland: the stretches of the line more than INLAND m from the shore.
 *
 * Scenery only, like `water`: no collision and no navigation (borderBoxes gives it none). The client draws it from
 * this layout (borderCoast.ts in the client); the backdrop's ground keeps under it (coastHeightAt).
 */

/** How high over the sea the shore's ground reaches (m): a beach. */
export const COAST_BEACH = 1.5;
/** How far out the coast's land is drawn (m) before it dips under the sea. */
export const COAST_DEPTH = 120;
/** Forest grows along the line this far (m) past the shore and more. */
const INLAND = 35;
/** Higher ground eases to this share of its height over the beach, far out (a low headland). */
const HEADLAND = 0.3;
/** ... over about this distance out (m). */
const HEADLAND_FALL = 35;

export interface CoastSide {
  edge: BorderEdge;
  /** The sea's level (m): the map's own water reaching the line, else under the lowest shore. */
  sea: number;
  /** Stretches along the line [from, to] (m from the edge's `a` end) that are shore: the sea carries on past them. */
  shore: [number, number][];
  /** Stretches along the line that are inland: forest grows past them. */
  inland: [number, number][];
  /** The stretch along the line the coast's land is drawn over (past both ends, round the corners). */
  u0: number;
  u1: number;
  /** Seaward ends: whether the edge's `a` and `b` ends meet the sea (a water side, or ground under the sea). */
  seaward: [boolean, boolean];
  /** The ground at the line, every metre from u0 (prefix sums for the rounding further out). */
  profile: Float64Array;
  sums: Float64Array;
  seed: number;
  /** The backdrop past the map is sea: the whole far end of the land dips under it (else only along the shore). */
  seaBeyond: boolean;
}

/** The sea level a shoreline side has (as BorderVisuals' water draws it): the map's water at its middle, else under its lowest ground. */
export function shoreSeaLevel(map: Pick<MapDocument, 'terrain' | 'entities'>, e: BorderEdge, floorY: number): number {
  const at = (u: number): [number, number] => [e.a[0] + ((e.b[0] - e.a[0]) * u) / e.length, e.a[1] + ((e.b[1] - e.a[1]) * u) / e.length];
  let low = Infinity;
  for (let u = 0; u <= e.length; u += 4) low = Math.min(low, borderGround(map, ...at(u), floorY));
  const [mx, mz] = at(e.length / 2);
  return ownSea(map, (w) => Math.abs(mx - w.position[0]) <= w.size[0] / 2 + 1 && Math.abs(mz - w.position[2]) <= w.size[2] / 2 + 1) ?? low - 1.1;
}

function ownSea(map: Pick<MapDocument, 'entities'>, reaches: (w: { position: [number, number, number]; size: [number, number, number] }) => boolean): number | null {
  let top = -Infinity;
  for (const w of map.entities) if (w.kind === 'water' && w.liquid === 'water' && reaches(w)) top = Math.max(top, w.position[1] + w.size[1]);
  return Number.isFinite(top) ? top - 0.05 : null;
}

const RING: readonly BorderSide[] = ['north', 'west', 'south', 'east'];

/** The coast sides of a map and their layout (none without a coast side or a boundary). */
export function coastSides(map: Pick<MapDocument, 'bounds' | 'terrain' | 'backdrop' | 'entities' | 'metadata' | 'classicStructure'>, floorY: number): CoastSide[] {
  const edges = borderEdges(map);
  const coasts = edges.filter((e) => e.style === 'coast');
  if (!coasts.length) return [];
  const styles = borderStyles(map);
  const seed = borderSeed(`${map.metadata.id}:coast`);
  const seaBeyond = resolveBackdrop(map).ground === 'water';
  const out: CoastSide[] = [];
  for (const e of coasts) {
    const i = RING.indexOf(e.side);
    const prev = styles[RING[(i + 3) % 4]!];
    const next = styles[RING[(i + 1) % 4]!];
    const ground = (u: number) => borderGround(map, e.a[0] + ((e.b[0] - e.a[0]) * u) / e.length, e.a[1] + ((e.b[1] - e.a[1]) * u) / e.length, floorY);
    // The sea: the map's own water touching this line (or a neighbouring shoreline's sea), else under its lowest ground.
    const waterSide = [prev === 'water' ? edges.find((x) => x.side === RING[(i + 3) % 4]) : undefined, next === 'water' ? edges.find((x) => x.side === RING[(i + 1) % 4]) : undefined].find((x) => !!x);
    const near = (w: { position: [number, number, number]; size: [number, number, number] }) => {
      // Water whose footprint (plus a metre) the line passes through.
      const x0 = w.position[0] - w.size[0] / 2 - 1;
      const x1 = w.position[0] + w.size[0] / 2 + 1;
      const z0 = w.position[2] - w.size[2] / 2 - 1;
      const z1 = w.position[2] + w.size[2] / 2 + 1;
      return Math.max(e.a[0], e.b[0]) >= x0 && Math.min(e.a[0], e.b[0]) <= x1 && Math.max(e.a[1], e.b[1]) >= z0 && Math.min(e.a[1], e.b[1]) <= z1;
    };
    let low = Infinity;
    for (let u = 0; u <= e.length; u += 2) low = Math.min(low, ground(u));
    const sea = waterSide ? shoreSeaLevel(map, waterSide, floorY) : (ownSea(map, near) ?? low - 1.1);
    const seaward: [boolean, boolean] = [prev === 'water' || ground(0) <= sea + 0.05, next === 'water' || ground(e.length) <= sea + 0.05];
    // The shore: from each seaward end, while the ground stays within a beach of the sea.
    const shore: [number, number][] = [];
    if (seaward[0]) {
      let u = 0;
      while (u < e.length && ground(u) <= sea + COAST_BEACH) u += 1;
      shore.push([0, Math.min(e.length, u)]);
    }
    if (seaward[1]) {
      let u = e.length;
      while (u > 0 && ground(u) <= sea + COAST_BEACH) u -= 1;
      const run: [number, number] = [Math.max(0, u), e.length];
      if (shore.length && run[0] <= shore[0]![1]) shore[0]![1] = e.length;
      else shore.push(run);
    }
    // Inland: what is more than INLAND m along the line from the shore (all of it without a shore).
    let inland: [number, number][] = [[0, e.length]];
    for (const [a, b] of shore) {
      const next: [number, number][] = [];
      for (const [p, q] of inland) {
        if (q <= a - INLAND || p >= b + INLAND) next.push([p, q]);
        else {
          if (p < a - INLAND) next.push([p, a - INLAND]);
          if (q > b + INLAND) next.push([b + INLAND, q]);
        }
      }
      inland = next;
    }
    inland = inland.filter(([p, q]) => q - p >= 6);
    // Round the corners: past an end the land carries on as far as it goes out (a neighbouring water side's own
    // beach and sea take over a little way past its line).
    const u0 = prev === 'water' ? -6 : -COAST_DEPTH;
    const u1 = e.length + (next === 'water' ? 6 : COAST_DEPTH);
    const n = Math.ceil(u1 - u0) + 1;
    const profile = new Float64Array(n);
    const sums = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) {
      profile[k] = ground(Math.max(0, Math.min(e.length, u0 + k)));
      sums[k + 1] = sums[k]! + profile[k]!;
    }
    out.push({ edge: e, sea, shore, inland, u0, u1, seaward, profile, sums, seed: seed + i * 7919, seaBeyond });
  }
  return out;
}

/** How far `u` (along the line) is from the shore (0 on it; Infinity without one). A shore at an end runs on round the corner. */
export function coastShoreDistance(c: CoastSide, u: number): number {
  let best = Infinity;
  for (const [a, b] of c.shore) {
    const lo = a <= 0 ? -Infinity : a;
    const hi = b >= c.edge.length ? Infinity : b;
    best = Math.min(best, u < lo ? lo - u : u > hi ? u - hi : 0);
  }
  return best;
}

/** Whether `u` (along the line) is on a shore stretch, 0..1, easing off over 15 m past it. */
export function coastShoreWeight(c: CoastSide, u: number): number {
  return 1 - Math.min(1, coastShoreDistance(c, u) / 15);
}

/** The ground at the line averaged over `radius` m either side of `u` (the line's own ground at radius 0). */
function profileAt(c: CoastSide, u: number, radius: number): number {
  const n = c.profile.length;
  const k = Math.max(0, Math.min(n - 1, Math.round(u - c.u0)));
  const r = Math.round(radius);
  if (r < 1) return c.profile[k]!;
  const lo = Math.max(0, k - r);
  const hi = Math.min(n - 1, k + r);
  return (c.sums[hi + 1]! - c.sums[lo]!) / (hi - lo + 1);
}

/** Smooth value noise along a line (0..1), `size` m a feature. */
function vnoise(seed: number, s: number, size: number, salt: number): number {
  const t = s / size;
  const i = Math.floor(t);
  const f = t - i;
  const w = f * f * (3 - 2 * f);
  return borderNoise(seed, i * 13 + salt) * (1 - w) + borderNoise(seed, (i + 1) * 13 + salt) * w;
}

/**
 * The coast's ground `v` m out from the line at `u` along it (both in the edge's frame). The shore keeps its height
 * (it carries on along the shoreline); higher ground eases down to a headland and rounds off along the line as it
 * goes out; dunes rise on the low ground behind the shore; the last stretch dips under the sea.
 */
export function coastHeight(c: CoastSide, u: number, v: number): number {
  const vv = Math.max(0, v);
  const p = profileAt(c, u, Math.min(30, vv * 0.45));
  const rel = p - c.sea;
  let y: number;
  if (rel <= COAST_BEACH) y = p;
  else {
    // Only by the shore (the cliffs and crest where they meet it): from 5 m past the shore to 35 m on (where the
    // forest starts) the easing fades out, and inland the ground carries on at its height under the forest.
    const near = 1 - Math.min(1, Math.max(0, (coastShoreDistance(c, u) - 5) / (INLAND - 5)));
    const keep = 1 - near * (1 - HEADLAND) * (1 - Math.exp(-vv / HEADLAND_FALL));
    y = c.sea + COAST_BEACH + (rel - COAST_BEACH) * keep;
  }
  // Dunes: low dry ground near (not on) the shore, growing out from the line.
  const shore = coastShoreWeight(c, u);
  const low = 1 - Math.min(1, Math.max(0, (y - c.sea - 2) / 6));
  const dry = Math.min(1, Math.max(0, (y - c.sea - 0.4) / 0.8));
  const grow = Math.min(1, Math.max(0, (vv - 6) / 22));
  const dune = vnoise(c.seed, u + vv * 0.35, 23, 1) * 0.7 + vnoise(c.seed, u - vv * 0.5, 9, 2) * 0.3;
  y += 2.6 * dune * low * dry * grow * (1 - 0.6 * shore);
  // The far end dips under the sea: all along it when the backdrop past the map is sea, else only off the shore
  // (inland, the backdrop's ground carries on, kept just under it).
  const end = Math.min(1, Math.max(0, (vv - (COAST_DEPTH - 30)) / 30)) * (c.seaBeyond ? 1 : shore);
  if (end > 0) y = y * (1 - end) + Math.min(y, c.sea - 1.5) * end;
  return y;
}

/** The coast side a world point lies past and its frame coordinates (u along, v out), or null. */
export function coastFrameAt(sides: readonly CoastSide[], x: number, z: number): { side: CoastSide; u: number; v: number } | null {
  let best: { side: CoastSide; u: number; v: number } | null = null;
  for (const c of sides) {
    const e = c.edge;
    const dx = (e.b[0] - e.a[0]) / e.length;
    const dz = (e.b[1] - e.a[1]) / e.length;
    const u = (x - e.a[0]) * dx + (z - e.a[1]) * dz;
    const v = (x - e.a[0]) * e.out[0] + (z - e.a[1]) * e.out[1];
    if (v < -0.5 || u < c.u0 || u > c.u1) continue;
    // Past a corner (past two sides), the side it lies furthest past.
    if (!best || v > best.v) best = { side: c, u, v };
  }
  return best;
}

/** The coast's ground at a world point past a coast side, or null (not past one). */
export function coastHeightAt(sides: readonly CoastSide[], x: number, z: number): number | null {
  const f = coastFrameAt(sides, x, z);
  return f ? coastHeight(f.side, f.u, f.v) : null;
}
