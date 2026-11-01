/**
 * Fitting gear to a head (no Babylon here: plain numbers, so it is unit-tested on its own). A head is measured as
 * a map of how far its surface is from a centre in every direction (HeadMap); hats, bands and straps are surfaces
 * laid over that map, eyewear sits on points read off it. Geo collects the triangles (faces turned outwards).
 *
 * Directions: θ round the head (0: the face, +Z; π/2: +X), φ up from level (π/2: straight up).
 */
export type P3 = [number, number, number];

export const dirOf = (theta: number, phi: number): P3 => [Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi)];
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: P3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: P3): P3 => scale(a, 1 / (len(a) || 1));
export const v3 = { sub, add, scale, dot, cross, len, norm, lerp: (a: P3, b: P3, t: number): P3 => add(a, scale(sub(b, a), t)) };

const TAU = Math.PI * 2;
const NT = 48;
const NP = 32;
const PMIN = -1.35;
const PMAX = Math.PI / 2;
const STEP_P = (PMAX - PMIN) / (NP - 1);

/**
 * How far a head's surface is from its centre `c`, in NT × NP directions (θ round, φ from PMIN up to straight up):
 * the farthest point measured in each. Directions nothing was measured in take their neighbours'.
 */
export class HeadMap {
  readonly r: Float32Array;
  readonly c: P3;
  constructor(c: P3, points?: ArrayLike<number>, r?: Float32Array) {
    this.c = c;
    this.r = r ?? new Float32Array(NT * NP);
    if (points) {
      for (let i = 0; i + 2 < points.length; i += 3) {
        const d: P3 = [points[i]! - c[0], points[i + 1]! - c[1], points[i + 2]! - c[2]];
        const l = len(d);
        if (l < 1e-6) continue;
        const phi = Math.asin(Math.max(-1, Math.min(1, d[1] / l)));
        if (phi < PMIN - STEP_P / 2) continue;
        const a = Math.round((((Math.atan2(d[0], d[2]) / TAU + 1) % 1) * NT)) % NT;
        const b = Math.round((phi - PMIN) / STEP_P);
        const k = b * NT + a;
        if (l > this.r[k]!) this.r[k] = l;
      }
      this.fill();
    }
  }

  private fill(): void {
    const r = this.r;
    for (let pass = 0; pass < NT + NP; pass++) {
      let empty = 0;
      const next = Float32Array.from(r);
      for (let b = 0; b < NP; b++)
        for (let a = 0; a < NT; a++) {
          if (r[b * NT + a]! > 0) continue;
          let best = 0;
          for (let db = -1; db <= 1; db++) {
            const bb = b + db;
            if (bb < 0 || bb >= NP) continue;
            for (let da = -1; da <= 1; da++) best = Math.max(best, r[bb * NT + ((a + da + NT) % NT)]!);
          }
          if (best > 0) next[b * NT + a] = best;
          else empty++;
        }
      r.set(next);
      if (!empty) return;
    }
  }

  /** Each direction no nearer than `other`'s, nor farther than `other`'s + `extra` (hair over the skin, kept close). */
  over(other: HeadMap, extra: number): HeadMap {
    return new HeadMap(
      this.c,
      undefined,
      this.r.map((d, k) => Math.max(other.r[k]!, Math.min(d, other.r[k]! + extra))),
    );
  }

  /** The map as cloth would lie over it: across the dips between bumps (each direction at least its neighbours' average), then smoothed. */
  draped(passes = 2): HeadMap {
    let r = Float32Array.from(this.r);
    for (let p = 0; p < passes; p++) {
      const next = new Float32Array(r.length);
      for (let b = 0; b < NP; b++)
        for (let a = 0; a < NT; a++) {
          let sum = 0;
          let n = 0;
          for (let db = -1; db <= 1; db++) {
            const bb = Math.max(0, Math.min(NP - 1, b + db));
            for (let da = -1; da <= 1; da++) {
              sum += r[bb * NT + ((a + da + NT) % NT)]!;
              n++;
            }
          }
          next[b * NT + a] = Math.max(r[b * NT + a]!, sum / n);
        }
      r = next;
    }
    return new HeadMap(this.c, undefined, r);
  }

  /** The surface's distance in direction (θ, φ). */
  at(theta: number, phi: number): number {
    const u = ((((theta / TAU) % 1) + 1) % 1) * NT;
    const v = Math.max(0, Math.min(NP - 1, (phi - PMIN) / STEP_P));
    const a0 = Math.floor(u) % NT;
    const a1 = (a0 + 1) % NT;
    const b0 = Math.min(NP - 2, Math.floor(v));
    const fu = u - Math.floor(u);
    const fv = v - b0;
    const r = this.r;
    const lo = r[b0 * NT + a0]! * (1 - fu) + r[b0 * NT + a1]! * fu;
    const hi = r[(b0 + 1) * NT + a0]! * (1 - fu) + r[(b0 + 1) * NT + a1]! * fu;
    return lo * (1 - fv) + hi * fv;
  }

  /** The surface's distance along a direction from the centre. */
  along(d: P3): number {
    const l = len(d) || 1;
    return this.at(Math.atan2(d[0], d[2]), Math.asin(Math.max(-1, Math.min(1, d[1] / l))));
  }

  /** The point `pad` out from the surface in direction (θ, φ). */
  point(theta: number, phi: number, pad = 0): P3 {
    return add(this.c, scale(dirOf(theta, phi), this.at(theta, phi) + pad));
  }

  /** The elevation at which the surface (padded) reaches height y, round at θ. */
  phiAt(theta: number, y: number, pad = 0): number {
    let lo = PMIN;
    let hi = PMAX;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (this.point(theta, mid, pad)[1] < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** `p` pushed straight out from the centre until it is at least `pad` outside the surface. */
  clear(p: P3, pad: number): P3 {
    const d = sub(p, this.c);
    const want = this.along(d) + pad;
    const l = len(d);
    return l >= want ? p : add(this.c, scale(d, want / (l || 1)));
  }
}

/** A height round the head from three: at the front (θ 0), the sides (θ ±π/2) and the back (θ π), smoothly between. */
export const ringHeight = (front: number, side: number, back: number) => (theta: number) => {
  const c = Math.cos(theta);
  return side + ((front - back) / 2) * c + ((front + back) / 2 - side) * c * c;
};

/** Triangles with their faces turned outwards. */
export class Geo {
  readonly positions: number[] = [];
  readonly indices: number[] = [];

  private vert(p: P3): number {
    this.positions.push(p[0], p[1], p[2]);
    return this.positions.length / 3 - 1;
  }

  /** Face normal as Babylon's ComputeNormals takes it: (p1 - p2) × (p3 - p2). */
  private faceNormal(a: number, b: number, c: number): P3 {
    const p = this.positions;
    const P = (i: number): P3 => [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!];
    return cross(sub(P(a), P(b)), sub(P(c), P(b)));
  }

  /**
   * A surface through rows of points (rows the same length; `closed`: each row wraps round). Its faces turn
   * towards `out` (a direction), or away from a point (`from`), as most of its area does; `flip` turns them the other way.
   */
  grid(rows: P3[][], closed: boolean, out: { dir: P3 } | { from: P3 }, flip = false): number[][] {
    const ids = rows.map((row) => row.map((p) => this.vert(p)));
    const quads: [number, number, number, number][] = [];
    const cols = rows[0]!.length;
    for (let j = 0; j + 1 < rows.length; j++)
      for (let i = 0; i < (closed ? cols : cols - 1); i++) {
        const i1 = (i + 1) % cols;
        quads.push([ids[j]![i]!, ids[j]![i1]!, ids[j + 1]![i1]!, ids[j + 1]![i]!]);
      }
    let vote = 0;
    for (const [a, b, c] of quads) {
      const n = this.faceNormal(a, b, c);
      const p = this.positions;
      const at: P3 = [p[b * 3]!, p[b * 3 + 1]!, p[b * 3 + 2]!];
      vote += dot(n, 'dir' in out ? out.dir : sub(at, out.from));
    }
    const turn = vote < 0 !== flip;
    for (const [a, b, c, d] of quads) {
      if (turn) this.indices.push(a, c, b, a, d, c);
      else this.indices.push(a, b, c, a, c, d);
    }
    return ids;
  }

  /**
   * A surface with thickness: the rows are its outer face (turned towards `out`), a copy `thick` inside it its
   * inner face, and strips close the edges between them.
   */
  slab(rows: P3[][], closed: boolean, thick: number, out: { dir: P3 } | { from: P3 }): void {
    const nr = rows.length;
    const nc = rows[0]!.length;
    const at = (j: number, i: number) => rows[Math.max(0, Math.min(nr - 1, j))]![closed ? (i + nc) % nc : Math.max(0, Math.min(nc - 1, i))]!;
    // Vertex normals from the grid's tangents, turned to agree with `out`.
    const normals = rows.map((row, j) =>
      row.map((p, i) => {
        const n = norm(cross(sub(at(j + 1, i), at(j - 1, i)), sub(at(j, i + 1), at(j, i - 1))));
        const ref = 'dir' in out ? out.dir : sub(p, out.from);
        return dot(n, ref) < 0 ? scale(n, -1) : n;
      }),
    );
    const inner = rows.map((row, j) => row.map((p, i) => sub(p, scale(normals[j]![i]!, thick))));
    this.grid(rows, closed, out);
    this.grid(inner, closed, out, true);
    // Edges: the first and last rows, and (open surfaces) the first and last columns.
    const strip = (a: P3[], b: P3[], away: P3[]) => {
      const mid = a.map((p, k) => scale(add(p, b[k]!), 0.5));
      const ids = [a, b].map((r) => r.map((p) => this.vert(p)));
      for (let k = 0; k + 1 < a.length; k++) {
        const o = sub(mid[k]!, away[k]!);
        const q = [ids[0]![k]!, ids[0]![k + 1]!, ids[1]![k + 1]!, ids[1]![k]!] as const;
        const n = this.faceNormal(q[0], q[1], q[2]);
        if (dot(n, o) >= 0) this.indices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        else this.indices.push(q[0], q[2], q[1], q[0], q[3], q[2]);
      }
    };
    const wrap = (r: P3[]) => (closed ? [...r, r[0]!] : r);
    strip(wrap(rows[0]!), wrap(inner[0]!), wrap(rows[1]!));
    strip(wrap(rows[nr - 1]!), wrap(inner[nr - 1]!), wrap(rows[nr - 2]!));
    if (!closed) {
      const col = (rs: P3[][], i: number) => rs.map((r) => r[i]!);
      strip(col(rows, 0), col(inner, 0), col(rows, 1));
      strip(col(rows, nc - 1), col(inner, nc - 1), col(rows, nc - 2));
    }
  }

  /** A round tube along a path, `radius` thick (`radii`: per point). */
  tube(path: P3[], radius: number | number[], sides = 8): void {
    const rings: P3[][] = [];
    let ref: P3 = [0, 1, 0];
    for (let k = 0; k < path.length; k++) {
      const t = norm(sub(path[Math.min(path.length - 1, k + 1)]!, path[Math.max(0, k - 1)]!));
      if (Math.abs(dot(t, ref)) > 0.95) ref = [1, 0, 0];
      const u = norm(cross(t, ref));
      const w = cross(u, t);
      const r = typeof radius === 'number' ? radius : radius[k]!;
      rings.push(Array.from({ length: sides }, (_, s) => {
        const a = (s / sides) * TAU;
        return add(path[k]!, add(scale(u, Math.cos(a) * r), scale(w, Math.sin(a) * r)));
      }));
    }
    // Outward from the path: per quad, against its path point.
    const ids = rings.map((ring) => ring.map((p) => this.vert(p)));
    for (let k = 0; k + 1 < rings.length; k++)
      for (let s = 0; s < sides; s++) {
        const s1 = (s + 1) % sides;
        const q = [ids[k]![s]!, ids[k]![s1]!, ids[k + 1]![s1]!, ids[k + 1]![s]!] as const;
        const n = this.faceNormal(q[0], q[1], q[2]);
        const o = sub(rings[k]![s]!, path[k]!);
        if (dot(n, o) >= 0) this.indices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        else this.indices.push(q[0], q[2], q[1], q[0], q[3], q[2]);
      }
    // Caps.
    for (const k of [0, rings.length - 1]) {
      const centre = this.vert(path[k]!);
      const o = sub(path[k]!, path[k === 0 ? 1 : k - 1]!);
      for (let s = 0; s < sides; s++) {
        const a = ids[k]![s]!;
        const b = ids[k]![(s + 1) % sides]!;
        if (dot(this.faceNormal(centre, a, b), o) >= 0) this.indices.push(centre, a, b);
        else this.indices.push(centre, b, a);
      }
    }
  }

  /** A flat fan from a centre to a closed ring of points, its face towards `out`. */
  fan(centre: P3, ring: P3[], out: P3): void {
    const c = this.vert(centre);
    const ids = ring.map((p) => this.vert(p));
    for (let s = 0; s < ids.length; s++) {
      const a = ids[s]!;
      const b = ids[(s + 1) % ids.length]!;
      if (dot(this.faceNormal(c, a, b), out) >= 0) this.indices.push(c, a, b);
      else this.indices.push(c, b, a);
    }
  }
}

/** A rounded-rectangle outline (superellipse of power `n`), `half` [w, h], in the plane of `ax` (across) and `ay` (up) round `centre`. */
export function outline(centre: P3, ax: P3, ay: P3, half: [number, number], n: number, steps = 24, shapeY?: (x: number, y: number) => number): P3[] {
  return Array.from({ length: steps }, (_, s) => {
    const t = (s / steps) * TAU;
    const c = Math.cos(t);
    const si = Math.sin(t);
    const x = Math.sign(c) * Math.abs(c) ** (2 / n) * half[0];
    let y = Math.sign(si) * Math.abs(si) ** (2 / n) * half[1];
    if (shapeY) y = shapeY(x / half[0], y / half[1]) * half[1];
    return add(centre, add(scale(ax, x), scale(ay, y)));
  });
}

/** Where a helmet model goes on a head: its points (in its own units) are scaled by `k` (and by `k * sy` upright) and moved by `at`. */
export interface ModelFit {
  k: number;
  sy: number;
  at: P3;
}

/**
 * Seat a hard hat (a helmet model's points, x y z triples in its own units, front +Z, top +Y) on a head: the
 * smallest size and lowest seat at which no part of the skull above `floorY` (`head`: skin with the hair kept close)
 * comes within `pad` of the inside of its shell, while its rim over the eyes comes down to `rimY` (just above the
 * brows). A deep shell may be made a little shallower (`sy` down to 0.76) to get there. Below `floorY` (ear flaps,
 * nose guards, straps) nothing is checked. Directions are compared through radial maps round the head's centre, as
 * HeadMap measures the head.
 */
export function fitModel(all: ArrayLike<number>, head: HeadMap, rimY: number, floorY: number, pad = 0.005): ModelFit {
  const c = head.c;
  // At most ~1200 points: plenty for the shell's inside at the map's resolution, and quick.
  const stride = Math.max(1, Math.ceil(all.length / 3 / 1200));
  const points: number[] = [];
  for (let i = 0; i + 2 < all.length; i += 3 * stride) points.push(all[i]!, all[i + 1]!, all[i + 2]!);
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    minX = Math.min(minX, points[i]!);
    maxX = Math.max(maxX, points[i]!);
    maxY = Math.max(maxY, points[i + 1]!);
    minZ = Math.min(minZ, points[i + 2]!);
    maxZ = Math.max(maxZ, points[i + 2]!);
  }
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const halfW = (maxX - minX) / 2;
  const headHalf = Math.max(head.at(Math.PI / 2, 0.2), head.at(-Math.PI / 2, 0.2)) * Math.cos(0.2);
  const headTop = head.point(0, Math.PI / 2)[1];
  // The skull's directions that are checked: those whose surface is above floorY.
  const checked = new Uint8Array(NT * NP);
  for (let b = 0; b < NP; b++) for (let a = 0; a < NT; a++) checked[b * NT + a] = c[1] + Math.sin(PMIN + b * STEP_P) * head.r[b * NT + a]! >= floorY ? 1 : 0;
  const n = points.length / 3;
  const world = new Float32Array(points.length);
  const place = (k: number, sy: number, y: number, dz: number) => {
    for (let i = 0; i < n; i++) {
      world[i * 3] = c[0] + (points[i * 3]! - midX) * k;
      world[i * 3 + 1] = y + points[i * 3 + 1]! * k * sy;
      world[i * 3 + 2] = c[2] + dz + (points[i * 3 + 2]! - midZ) * k;
    }
  };
  const r = new Float32Array(NT * NP);
  /** Clear of the skull: every checked direction the shell covers is farther out than the head. */
  const clear = (k: number, sy: number, y: number, dz: number): boolean => {
    place(k, sy, y, dz);
    r.fill(Infinity);
    for (let i = 0; i < n; i++) {
      const dx = world[i * 3]! - c[0];
      const dy = world[i * 3 + 1]! - c[1];
      const dzz = world[i * 3 + 2]! - c[2];
      const l = Math.hypot(dx, dy, dzz);
      if (l < 1e-6) continue;
      const b = Math.round((Math.asin(Math.max(-1, Math.min(1, dy / l))) - PMIN) / STEP_P);
      if (b < 0) continue;
      const a = Math.round((((Math.atan2(dx, dzz) / TAU + 1) % 1) * NT)) % NT;
      const kk = b * NT + a;
      if (l < r[kk]!) r[kk] = l;
    }
    for (let kk = 0; kk < r.length; kk++) if (checked[kk] && r[kk]! < head.r[kk]! + pad) return false;
    return true;
  };
  /** The shell's lowest edge over the eyes (left and right of the middle, so a nose guard isn't taken for it). */
  const rimOverEyes = (): number => {
    let y = Infinity;
    for (let i = 0; i < n; i++) {
      const ax = Math.abs(world[i * 3]! - c[0]);
      if (world[i * 3 + 2]! - c[2] > 0.03 && ax > 0.02 && ax < 0.045) y = Math.min(y, world[i * 3 + 1]!);
    }
    return y;
  };
  let best: (ModelFit & { score: number }) | null = null;
  const k0 = headHalf / halfW;
  for (const sy of [1, 0.88, 0.76]) {
    // A shallower shell only when the full one can't come down to the brows.
    if (best && best.score < 0.006) break;
    for (const dz of [-0.008, 0, 0.008]) {
      for (let s = 1.05; s <= 1.8; s += 0.075) {
        const k = k0 * s;
        // The lowest clear seat (its top at most 7 cm over the head).
        let lo = headTop - maxY * k * sy - 0.08;
        let hi = headTop - maxY * k * sy + 0.07;
        if (!clear(k, sy, hi, dz)) continue;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          if (clear(k, sy, mid, dz)) hi = mid;
          else lo = mid;
        }
        place(k, sy, hi, dz);
        const rim = rimOverEyes();
        // Down to the brows is right; perched higher is worse the higher it is; a bigger or flattened shell a little worse.
        const score = Math.max(0, rim - rimY) * 4 + Math.max(0, rimY - rim) * 2 + (s - 1) * 0.01 + (1 - sy) * 0.04;
        if (!best || score < best.score) best = { k, sy, at: [c[0] - midX * k, hi, c[2] + dz - midZ * k], score };
        // Bigger shells only sit lower from here.
        if (rim < rimY) break;
      }
    }
  }
  if (best) return { k: best.k, sy: best.sy, at: best.at };
  const k = k0 * 1.4;
  return { k, sy: 1, at: [c[0] - midX * k, headTop - maxY * k + 0.03, c[2] - midZ * k] };
}
