// Sight fit (owner, 2026-11-18, "Sights and scopes pass" (1): aiming down sights puts the camera exactly behind each
// gun's own drawn sights, measured from the model as the grips auto-fit measures hands). For every hand-held weapon
// that aims down its sights, the tool reads the built model (packages/client/public/models/<view.model>) and finds
//   front   the top of the front sight: the front end of the line that rests on the gun's top along its centre plane
//           (the edge of the top profile's upper hull that spans the middle between the grip and the muzzle), a post
//           read inside its hood when it has one;
//   rear    where the eye looks at the rear sight: the middle of an aperture's hole, the top of a notch's ears, or the
//           top of whatever the line rests on at the back (a plain block, the receiver);
//   eye     where the camera sits: on the line through rear and front, as far behind the gun as it aimed before the
//           fit (the stock's end 0.2 m ahead of the eye, never nearer than the hip distance): any nearer and the
//           camera's near plane (0.1 m) cuts the stock open inside the view, so the arms and the depth are unchanged;
// and checks them: the line from the eye to the front sight's top is clear of the model (exact ray tests), and the
// flags below (a short sight radius, a line far off the bore, a rear point on the stock) mark a fit to look at.
// Hand corrections and exclusions are in content/sight-fit.json (each with its reason); the audit page is the
// client's `?mode=sights` (tools/sightSheet.ts) and docs/GUNPLAY_SPEC.md §15 says how to add a gun.
//
//   node tools/content/sight-fit.mjs            write packages/shared/src/content/sightFit.generated.ts
//   node tools/content/sight-fit.mjs --check    fail when it is out of date, or a weapon has neither a fit nor an exclusion
//   node tools/content/sight-fit.mjs --report   the audit table (per weapon: kind, sight radius, error before, flags)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
export const SIGHT_FIT_FILE = join(ROOT, 'content/sight-fit.json');
export const SIGHT_FIT_TS = join(ROOT, 'packages/shared/src/content/sightFit.generated.ts');

/** Half-width of the centre band the top profile is read in (m): a front post is 1.5-3 mm wide. */
export const NARROW = 0.0012;
/** Half-width searched for a notch's ears and an aperture's ring (m). */
export const WIDE = 0.009;
const WIDE_DEFAULT = WIDE;
/** Half-width searched for a front sight's hood when it is wider than WIDE (a ring round a post, up to 4.4 cm across). */
export const HOOD_WIDE = 0.022;
/** Half-depth of the slice across a sight (m): a rear sight's plate, a hood. */
export const SLAB = 0.003;
/** Cell of the top profile and of a sight's cross-section (m). */
const CELL = 0.0004;
const FINE = 0.0002;
/** Points this close under the line count as on it (m): a flat top is one line, not many. */
const ON_LINE = 0.0003;
/** The line is tested this far above the sights it rests on (m). */
const OVER = 0.0003;
/** The stock's end stays this far ahead of the eye (m; view.ts's rule before the fit, kept). */
export const STOCK_AHEAD = 0.2;
/** The eye sits this far above the top of the model's bounds where there is no fit (m; view.ts's rule). */
export const LEGACY_OVER = 0.006;
/** Over a plain rear sight (no notch, no aperture) the eye looks this far above its top (m), so the front sight shows over it. */
export const PLAIN_OVER = 0.0015;
/** A sight stands at least this far above the gun's top either side of it (m); under it the fit is `top`. */
const PROUD = 0.001;

const round = (v, k = 1e5) => Math.round(v * k) / k || 0;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const median = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : NaN;
};

/**
 * Where a triangle list crosses the plane `axis` = `at` (axis 0: x, 2: z): each crossing's segment walked in steps of
 * `step` (m), to `fn(x, y, z)`. Exact on the plane, so a thin post or a ring's edge is not missed between samples.
 */
function slice(tris, axis, at, step, fn) {
  for (const t of tris) {
    const ends = [];
    for (let i = 0; i < 3 && ends.length < 2; i++) {
      const p = t[i];
      const q = t[(i + 1) % 3];
      const dp = p[axis] - at;
      const dq = q[axis] - at;
      if (dp === 0 && dq === 0) {
        ends.length = 0;
        ends.push(p, q);
        break;
      }
      if ((dp < 0 && dq < 0) || (dp > 0 && dq > 0) || dp === dq) continue;
      const k = dp / (dp - dq);
      if (k === 1 && i < 2) continue;
      ends.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k]);
    }
    if (ends.length < 2) continue;
    const [p, q] = ends;
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / step));
    for (let i = 0; i <= n; i++) fn(p[0] + ((q[0] - p[0]) * i) / n, p[1] + ((q[1] - p[1]) * i) / n, p[2] + ((q[2] - p[2]) * i) / n);
  }
}

/** The distance along `from` → `to` (0..1) of the first triangle the segment meets, or null when it is clear. */
export function firstHit(tris, from, to) {
  const d = sub(to, from);
  const lo = [0, 1, 2].map((k) => Math.min(from[k], to[k]) - 1e-6);
  const hi = [0, 1, 2].map((k) => Math.max(from[k], to[k]) + 1e-6);
  let best = null;
  for (const [A, B, C] of tris) {
    let out = false;
    for (let k = 0; k < 3 && !out; k++) out = Math.max(A[k], B[k], C[k]) < lo[k] || Math.min(A[k], B[k], C[k]) > hi[k];
    if (out) continue;
    const e1 = sub(B, A);
    const e2 = sub(C, A);
    const p = cross(d, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-18) continue;
    const s = sub(from, A);
    const u = dot(s, p) / det;
    if (u < 0 || u > 1) continue;
    const q = cross(s, e1);
    const v = dot(d, q) / det;
    if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det;
    if (t > 1e-6 && t < 1 - 1e-6 && (best === null || t < best)) best = t;
  }
  return best;
}

/** The bounds of a triangle list: [min, max]. */
export function boundsOf(tris) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) {
    if (p[k] < min[k]) min[k] = p[k];
    if (p[k] > max[k]) max[k] = p[k];
  }
  return [min, max];
}

/** The middle (x) of the model's front-most geometry: the barrel's end, the plane the sights stand on. */
function frontX(tris, min, max) {
  const band = Math.max(0.01, (max[2] - min[2]) * 0.03);
  let lo = Infinity;
  let hi = -Infinity;
  for (const t of tris) for (const p of t) if (p[2] >= max[2] - band) {
    lo = Math.min(lo, p[0]);
    hi = Math.max(hi, p[0]);
  }
  return lo <= hi ? (lo + hi) / 2 : 0;
}

/**
 * The slice across the gun at `z` (± SLAB), as seen along the barrel: which cells of (x, y) hold geometry, within WIDE
 * of `x0` and from `lo` to `hi` in height.
 */
function crossSection(tris, x0, z, lo, hi, WIDE = WIDE_DEFAULT) {
  const near = tris.filter((t) => Math.max(t[0][2], t[1][2], t[2][2]) >= z - SLAB && Math.min(t[0][2], t[1][2], t[2][2]) <= z + SLAB && Math.max(t[0][0], t[1][0], t[2][0]) >= x0 - WIDE && Math.min(t[0][0], t[1][0], t[2][0]) <= x0 + WIDE);
  const w = Math.round((2 * WIDE) / FINE) + 1;
  const h = Math.max(1, Math.round((hi - lo) / FINE) + 1);
  const full = new Uint8Array(w * h);
  const col = (x) => (x - x0 + WIDE) / FINE;
  const row = (y) => (y - lo) / FINE;
  for (const t of near) {
    // The part of the triangle inside the slice, drawn filled as seen along the barrel.
    let poly = t;
    for (const [limit, sign] of [[z - SLAB, 1], [z + SLAB, -1]]) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        const dp = (p[2] - limit) * sign;
        const dq = (q[2] - limit) * sign;
        if (dp >= 0) out.push(p);
        if ((dp < 0) !== (dq < 0)) {
          const k = dp / (dp - dq);
          out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, limit]);
        }
      }
      poly = out;
    }
    if (poly.length < 2) continue;
    const r0 = Math.max(0, Math.round(Math.min(...poly.map((p) => row(p[1])))));
    const r1 = Math.min(h - 1, Math.round(Math.max(...poly.map((p) => row(p[1])))));
    for (let r = r0; r <= r1; r++) {
      // The polygon's reach across this row of cells (half a cell either side of the row's middle).
      let c0 = Infinity;
      let c1 = -Infinity;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        const [pr, qr] = [row(p[1]), row(q[1])];
        const [a, b] = [Math.max(r - 0.5, Math.min(pr, qr)), Math.min(r + 0.5, Math.max(pr, qr))];
        if (a > b) continue;
        for (const rr of [a, b]) {
          const k = qr === pr ? 0 : (rr - pr) / (qr - pr);
          const c = col(p[0] + (q[0] - p[0]) * k);
          c0 = Math.min(c0, c);
          c1 = Math.max(c1, c);
        }
        if (qr === pr) {
          c0 = Math.min(c0, col(q[0]));
          c1 = Math.max(c1, col(q[0]));
        }
      }
      for (let c = Math.max(0, Math.round(c0)); c <= Math.min(w - 1, Math.round(c1)); c++) full[r * w + c] = 1;
    }
  }
  return { full, w, h, x: (c) => x0 - WIDE + c * FINE, y: (r) => lo + r * FINE, col: (x) => Math.round((x - x0 + WIDE) / FINE) };
}

/**
 * The hole of a ring in a cross-section (an aperture, a hood): the empty cells the outside cannot reach, the group
 * nearest the centre column; null when there is none at least 0.8 mm across. Returns its middle and its extent.
 */
function enclosedHole(cs) {
  const { full, w, h } = cs;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => {
    if (!full[i] && !seen[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  // The outside: everything open to the top or the sides (the bottom edge is the gun's body).
  for (let c = 0; c < w; c++) push((h - 1) * w + c);
  for (let r = 0; r < h; r++) {
    push(r * w);
    push(r * w + w - 1);
  }
  const flood = () => {
    while (stack.length) {
      const i = stack.pop();
      const c = i % w;
      if (c > 0) push(i - 1);
      if (c < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < (h - 1) * w) push(i + w);
    }
  };
  flood();
  const mid = cs.col(cs.x(Math.round((w - 1) / 2)));
  let best = null;
  for (let r = 1; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (full[i] || seen[i]) continue;
      // One enclosed group.
      const group = [];
      seen[i] = 2;
      const q = [i];
      while (q.length) {
        const j = q.pop();
        group.push(j);
        const cc = j % w;
        for (const n of [cc > 0 ? j - 1 : -1, cc < w - 1 ? j + 1 : -1, j - w, j + w]) {
          if (n < 0 || n >= w * h || full[n] || seen[n]) continue;
          seen[n] = 2;
          q.push(n);
        }
      }
      let c0 = w;
      let c1 = 0;
      let r0 = h;
      let r1 = 0;
      let sc = 0;
      let sr = 0;
      for (const j of group) {
        const cc = j % w;
        const rr = (j - cc) / w;
        c0 = Math.min(c0, cc);
        c1 = Math.max(c1, cc);
        r0 = Math.min(r0, rr);
        r1 = Math.max(r1, rr);
        sc += cc;
        sr += rr;
      }
      const across = Math.min(c1 - c0 + 1, r1 - r0 + 1) * FINE;
      // Open at the slice's floor: a gap between parts of the gun's body, not a ring.
      if (r0 === 0 || across < 0.0008 || c0 > mid || c1 < mid) continue;
      const hole = { x: cs.x(sc / group.length), y: cs.y(sr / group.length), across, bottomAt: (col) => group.filter((j) => j % w === col).reduce((m, j) => Math.min(m, (j - (j % w)) / w), h), top: cs.y(r1), cells: group.length };
      if (!best || hole.top > best.top) best = hole;
    }
  }
  return best;
}

/** The top of each column of a cross-section (m; -Infinity where empty). */
function columnTops(cs) {
  const tops = new Float64Array(cs.w).fill(-Infinity);
  for (let c = 0; c < cs.w; c++) for (let r = cs.h - 1; r >= 0; r--) if (cs.full[r * cs.w + c]) {
    tops[c] = cs.y(r);
    break;
  }
  return tops;
}

/**
 * The sights of a gun model. `tris`: its triangles (model space: +Z the barrel, +Y up, metres); `grip` and `muzzle`:
 * the hand's point and the barrel's end (z is what matters); `x0`: the plane the sights stand on (default: the middle
 * of the front-most geometry, the barrel's end). Returns the rear and front points of the sight line, what the sights
 * are (`aperture`: the eye looks through a ring; `notch`: over a notch's ears; `post`: over a plain rear sight;
 * `bead`: a front sight only, over the receiver's top; `top`: nothing stands proud at the front, the line only rests
 * on the gun's top), and the measures the audit reads; null when the centre band holds no geometry.
 */
export function fitSights(tris, { grip, muzzle, x0 }) {
  const [min, max] = boundsOf(tris);
  const cx = x0 ?? frontX(tris, min, max);
  const n = Math.max(2, Math.ceil((max[2] - min[2]) / CELL) + 1);
  const top = new Float64Array(n).fill(-Infinity);
  const band = tris.filter((t) => Math.max(t[0][0], t[1][0], t[2][0]) >= cx - NARROW && Math.min(t[0][0], t[1][0], t[2][0]) <= cx + NARROW);
  for (let k = -3; k <= 3; k++) {
    slice(band, 0, cx + (k * NARROW) / 3, CELL / 4, (x, y, z) => {
      const i = Math.round((z - min[2]) / CELL);
      if (y > top[i]) top[i] = y;
    });
  }
  const zOf = (i) => min[2] + i * CELL;
  const pts = [];
  for (let i = 0; i < n; i++) if (top[i] > -Infinity) pts.push([zOf(i), top[i]]);
  if (pts.length < 2) return null;
  // The upper hull of the top profile: the lines of sight that rest on the gun's top.
  const hull = [];
  for (const p of pts) {
    while (hull.length >= 2) {
      const [a, b] = [hull[hull.length - 2], hull[hull.length - 1]];
      if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0) hull.pop();
      else break;
    }
    hull.push(p);
  }
  // The one that spans the middle between the hand and the muzzle, lengthened over points that lie on it.
  const mid = Math.min(Math.max((grip[2] + muzzle[2]) / 2, hull[0][0] + CELL), hull[hull.length - 1][0] - CELL);
  let b = hull.findIndex((p) => p[0] >= mid);
  if (b <= 0) b = 1;
  let a = b - 1;
  const under = (p, r, f) => r[1] + ((f[1] - r[1]) * (p[0] - r[0])) / (f[0] - r[0]) - p[1];
  while (a > 0 && under(hull[a - 1], hull[a], hull[b]) < ON_LINE) a--;
  while (b < hull.length - 1 && under(hull[b + 1], hull[a], hull[b]) < ON_LINE) b++;
  let rear = [cx, hull[a][1], hull[a][0]];
  let front = [cx, hull[b][1], hull[b][0]];
  // How far each end stands above the gun's top around it.
  const proud = (z, y) => {
    const near = [];
    for (let i = 0; i < n; i++) {
      const d = Math.abs(zOf(i) - z);
      if (d > 0.006 && d < 0.04 && top[i] > -Infinity) near.push(top[i]);
    }
    return near.length ? y - median(near) : 0;
  };
  const proudRear = proud(rear[2], rear[1]);
  const proudFront = proud(front[2], front[1]);

  // The front sight in a hood: the post's top is the floor of the ring's hole on the centre plane. Otherwise a
  // post's own middle across the gun (a blade a few millimetres wide), where it is not the plane's.
  let hood = false;
  {
    // The post's top in a hood's ring at `z`, read `wide` either side of the plane; null when there is none.
    const postIn = (z, wide) => {
      const ring = crossSection(tris, cx, z, front[1] - 0.03, front[1] + 0.002, wide);
      const hole = enclosedHole(ring);
      if (!(hole && hole.top > front[1] - 0.012 && Math.abs(hole.x - cx) < 0.003)) return null;
      const floor = hole.bottomAt(ring.col(cx));
      if (!(floor < ring.h && floor > 0)) return null;
      // Only when a post stands in the ring (its top above the ring's lowest point by a millimetre).
      const lowest = Math.min(...Array.from({ length: ring.w }, (_, c) => hole.bottomAt(c)).filter((r) => r < ring.h));
      return floor - lowest >= 0.001 / FINE ? [cx, ring.y(floor) - FINE / 2, front[2]] : null;
    };
    const cs = crossSection(tris, cx, front[2], front[1] - 0.03, front[1] + 0.002);
    // Where the line touches the hood's top, then (a hood wider than the band is open to the sides in it, and a post
    // may stand further into the hood than the slice reaches) wider and a little further forward.
    let post = postIn(front[2], WIDE);
    for (const dz of [0, 0.004, 0.008]) for (const wide of [WIDE, HOOD_WIDE]) post ??= postIn(front[2] + dz, wide);
    if (post) {
      front = post;
      hood = true;
    }
    if (!hood) {
      const tops = columnTops(cs);
      const c0 = cs.col(cx);
      let l = c0;
      let r = c0;
      const level = front[1] - 0.0004;
      while (l > 0 && tops[l - 1] >= level) l--;
      while (r < cs.w - 1 && tops[r + 1] >= level) r++;
      if ((r - l) * FINE <= 0.005 && l > 0 && r < cs.w - 1) front = [cs.x((l + r) / 2), front[1], front[2]];
    }
  }

  // The rear sight: an aperture's hole, else a notch's ears, else the top the line rests on.
  let kind = proudFront < PROUD ? 'top' : proudRear >= PROUD ? 'post' : 'bead';
  let gap = 0;
  {
    const cs = crossSection(tris, cx, rear[2], rear[1] - 0.02, rear[1] + 0.012);
    const hole = enclosedHole(cs);
    const through = hole && hole.top > rear[1] - 0.012 && Math.abs(hole.x - cx) < 0.003 ? [hole.x, hole.y, rear[2]] : null;
    if (through && firstHit(tris, [through[0], through[1], through[2] - SLAB * 2], [front[0], front[1] + OVER, front[2]]) === null) {
      rear = through;
      kind = 'aperture';
      gap = hole.across;
    } else if (!hood) {
      const tops = columnTops(cs);
      const c0 = cs.col(cx);
      const reach = Math.round(0.006 / FINE);
      const ear = (from, to) => {
        let m = -Infinity;
        for (let c = Math.max(0, from); c <= Math.min(cs.w - 1, to); c++) m = Math.max(m, tops[c]);
        return m;
      };
      // A notch on the plane: its floor is the top of the columns within 0.6 mm of it, its ears the tops either side.
      // Else one beside the plane: the lowest column within a millimetre of it, with an ear on each side of that.
      const tryNotch = (floor, half) => {
        let centre = -Infinity;
        for (let c = floor - half; c <= floor + half; c++) centre = Math.max(centre, tops[c] ?? -Infinity);
        const ears = Math.min(ear(floor - reach, floor - half - 1), ear(floor + half + 1, floor + reach));
        if (!(ears - centre >= 0.0005 && ears - centre <= 0.01)) return false;
        // The notch's own middle: the columns between the ears.
        let l = floor;
        let r = floor;
        while (l > floor - reach && tops[l - 1] < ears - 0.0003) l--;
        while (r < floor + reach && tops[r + 1] < ears - 0.0003) r++;
        rear = [cs.x((l + r) / 2), ears, rear[2]];
        kind = 'notch';
        gap = ears - centre;
        return true;
      };
      if (!tryNotch(c0, Math.round(0.0006 / FINE))) {
        const side = Math.round(0.001 / FINE);
        let lowest = c0;
        for (let c = c0 - side; c <= c0 + side; c++) if ((tops[c] ?? Infinity) < tops[lowest]) lowest = c;
        tryNotch(lowest, 0);
      }
    }
  }
  // Seen from an aperture's middle or over a notch's ears, the front sight's top is the point of it that stands
  // highest from there (its rear edge), not where the line over the gun's top touched it.
  if (kind === 'post' || kind === 'bead' || kind === 'top') rear = [rear[0], rear[1] + PLAIN_OVER, rear[2]];
  else {
    let best = -Infinity;
    for (const p of pts) {
      if (p[0] < front[2] - 0.01 || p[0] <= rear[2] + 0.02) continue;
      const slope = (p[1] - rear[1]) / (p[0] - rear[2]);
      if (slope > best + 1e-9 && !(hood && p[1] > front[1] + 1e-6)) {
        best = slope;
        if (!hood) front = [front[0], p[1], p[0]];
      }
    }
  }
  return { rear, front, kind, hood, gap, proudRear, proudFront, min, max, x0: cx };
}

/** Where the eye sits for a sight line (model space): on the line, `depth` behind the model's origin. */
export function eyeOn(rear, front, depth) {
  const d = sub(front, rear);
  const t = (-depth - rear[2]) / d[2];
  return [rear[0] + d[0] * t, rear[1] + d[1] * t, -depth];
}

/** How far ahead of the eye the model's origin sits when aimed (m): view.ts's rule from before the fit, kept. */
export const aimDepth = (viewOffsetZ, minZ) => Math.max(viewOffsetZ, STOCK_AHEAD - minZ);

/** The angle (degrees) at `eye` between the direction `axis` and the point `p`. */
export function angleTo(eye, axis, p) {
  const v = sub(p, eye);
  const c = dot(v, axis) / (Math.hypot(...v) * Math.hypot(...axis));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

// ---------------------------------------------------------------- the weapons

/** Every weapon file (content/weapons/<name>.json), by id. */
export function readWeapons() {
  const dir = join(ROOT, 'content/weapons');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'families.json')
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

/** Why a weapon has no sight fit by its own nature (null: it aims down sights in the hand, so it needs one or a named exclusion). */
export function builtInExclusion(w) {
  if (w.slot === 0) return 'mounted: never held in the hand';
  if (w.kind === 'melee') return 'melee or a tool: no aiming down sights';
  if (w.view?.zoomFov) return 'scope: the view is the scope overlay, the gun is hidden';
  if (w.view?.optic) return "optic: the eye goes to the eyepiece of the model's own scope (view.optic)";
  if (!/\.glb$/.test(w.view?.model ?? '')) return 'no model file';
  return null;
}

let io;
/** A built model's triangles (model space as the client loads it: +Z the barrel, +Y up, x mirrored from the file), without its level-of-detail copies. */
export async function modelTriangles(file) {
  if (!io) {
    const { NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const { MeshoptDecoder } = await import('meshoptimizer');
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  }
  const { dequantize } = await import('@gltf-transform/functions');
  const doc = await io.read(file);
  await doc.transform(dequantize());
  const out = [];
  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh || /_lod\d*$/.test(node.getName())) return;
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos || prim.getMode() !== 4) continue;
        const a = pos.getArray();
        const idx = prim.getIndices()?.getArray();
        // The client's loader turns a glTF file's right-handed space into its own: x mirrored.
        const at = (i) => {
          const [x, y, z] = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
          return [-(m[0] * x + m[4] * y + m[8] * z + m[12]), m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
        };
        const count = idx ? idx.length : a.length / 3;
        for (let t = 0; t + 2 < count; t += 3) out.push([at(idx ? idx[t] : t), at(idx ? idx[t + 1] : t + 1), at(idx ? idx[t + 2] : t + 2)]);
      }
    });
  }
  return out;
}

/**
 * What the audit sees wrong with a fit. `no-sights` (nothing stands proud at the front), `off-bore` (the line is more
 * than 4° off the barrel), `rear-on-stock` (a long gun's line starts well behind its grip) and `blocked` (the model
 * stands in the line from the eye to the front sight) each need a hand correction or an exclusion with its reason;
 * `short` (a sight radius under a third of the gun) is a note.
 */
export const BLOCKING = ['no-sights', 'off-bore', 'rear-on-stock', 'blocked'];
export function flagsOf(fit, w, length) {
  const flags = [];
  if (fit.kind === 'top') flags.push('no-sights');
  const radius = fit.front[2] - fit.rear[2];
  if (radius < Math.max(0.05, length * 0.3)) flags.push('short');
  const d = sub(fit.front, fit.rear);
  if ((Math.atan2(Math.hypot(d[0], d[1]), d[2]) * 180) / Math.PI > 4) flags.push('off-bore');
  if (w.view.hold?.style === 'long' && fit.rear[2] < (w.view.hold.grip?.[2] ?? 0) - 0.1) flags.push('rear-on-stock');
  if (!fit.clear) flags.push('blocked');
  return flags;
}

/**
 * One weapon's fit: measured from its model, a hand correction over it (content/sight-fit.json `corrections`: `rear`
 * and/or `front`, model space as `view.muzzleAt`). `error`: degrees between the sights and the aim before the fit
 * (the eye where view.ts put it: over the top of the bounds, looking along the barrel).
 */
export async function fitWeapon(w, correction) {
  const tris = await modelTriangles(join(MODELS, w.view.model));
  const [min, max] = boundsOf(tris);
  const muzzle = w.view.muzzleAt ?? [0, 0, max[2]];
  const auto = fitSights(tris, { grip: w.view.hold?.grip ?? [0, 0, min[2] + (max[2] - min[2]) * 0.3], muzzle, });
  if (!auto) return null;
  const rear = correction?.rear ?? auto.rear;
  const front = correction?.front ?? auto.front;
  const kind = correction?.kind ?? (correction && auto.kind === 'top' ? 'post' : auto.kind);
  const depth = aimDepth(w.view.viewOffset[2], min[2]);
  const eye = eyeOn(rear, front, depth);
  // The line of sight, a hair over the sights it rests on.
  const clear = firstHit(tris, [eye[0], eye[1] + (kind === 'aperture' ? 0 : OVER), eye[2]], [front[0], front[1] + OVER, front[2]]) === null;
  const legacyEye = [0, max[1] + LEGACY_OVER, -depth];
  const before = Math.max(angleTo(legacyEye, [0, 0, 1], rear), angleTo(legacyEye, [0, 0, 1], front));
  const fit = { rear, front, eye, kind, hood: auto.hood, clear, before, auto: correction ? { rear: auto.rear, front: auto.front, kind: auto.kind } : undefined, proud: [auto.proudRear, auto.proudFront], gap: auto.gap };
  return { ...fit, flags: flagsOf(fit, w, max[2] - min[2]) };
}

/** content/sight-fit.json: hand corrections and exclusions, each with its reason. */
export function readSightFile() {
  return existsSync(SIGHT_FIT_FILE) ? JSON.parse(readFileSync(SIGHT_FIT_FILE, 'utf8')) : { corrections: {}, excluded: {} };
}

/** Every weapon's fit or exclusion, and what is wrong (a weapon with neither, a correction or exclusion nothing uses). */
export async function fitAll() {
  const file = readSightFile();
  const fits = {};
  const excluded = {};
  const problems = [];
  const weapons = readWeapons();
  const opticsFile = join(ROOT, 'content/optics.json');
  const noOptic = new Set(existsSync(opticsFile) ? Object.keys(JSON.parse(readFileSync(opticsFile, 'utf8')).none ?? {}) : []);
  for (const w of weapons) {
    const own = builtInExclusion(w);
    const named = file.excluded?.[w.id];
    const correction = file.corrections?.[w.id];
    if (own) {
      excluded[w.id] = own;
      if (named || correction) problems.push(`content/sight-fit.json: ${w.id} needs no entry (${own})`);
      continue;
    }
    if (named) {
      if (typeof named !== 'string' || named.length < 8) problems.push(`content/sight-fit.json: ${w.id}'s exclusion needs a reason`);
      if (correction) problems.push(`content/sight-fit.json: ${w.id} is both excluded and corrected`);
      excluded[w.id] = named;
      // An exclusion is for a gun with no usable sights. One that aims with no optic (content/optics.json \`none\`)
      // while the tool reads sights on it (a fit with no flags, or one only blocked) would be aimed over the top of
      // its bounds with its own sights drawn off the aim (the Woodland SMG, 2026-11-22): fit it instead.
      if (noOptic.has(w.id)) {
        const auto = await fitWeapon(w, undefined);
        if (auto && auto.kind !== 'top' && !auto.flags.some((f) => f === 'no-sights' || f === 'off-bore' || f === 'rear-on-stock'))
          problems.push(`${w.id}: excluded in content/sight-fit.json and carries no optic, but the tool reads ${auto.kind} sights on it${auto.flags.length ? ` (${auto.flags.join(', ')})` : ''}: aimed without a fit its own sights are drawn off the aim. Fit it (a \`correction\` where the line is blocked) or give it an optic in content/optics.json (docs/GUNPLAY_SPEC.md §15)`);
      }
      continue;
    }
    if (correction && (typeof correction.reason !== 'string' || correction.reason.length < 8)) problems.push(`content/sight-fit.json: ${w.id}'s correction needs a reason`);
    const fit = await fitWeapon(w, correction);
    if (!fit) problems.push(`${w.id}: no geometry on its centre plane to fit sights to (exclude it in content/sight-fit.json with a reason)`);
    else {
      fits[w.id] = fit;
      const wrong = fit.flags.filter((f) => BLOCKING.includes(f));
      if (wrong.length) problems.push(`${w.id}: its sights did not fit (${wrong.join(', ')}): look at it on the sight sheet (?mode=sights), then give it a correction or an exclusion with its reason in content/sight-fit.json (docs/GUNPLAY_SPEC.md §15)`);
    }
  }
  for (const id of [...Object.keys(file.corrections ?? {}), ...Object.keys(file.excluded ?? {})]) if (!weapons.some((w) => w.id === id)) problems.push(`content/sight-fit.json: no weapon ${id}`);
  return { fits, excluded, problems, corrected: Object.keys(file.corrections ?? {}).filter((id) => fits[id]) };
}

const tuple = (p) => `[${p.map((v) => round(v)).join(', ')}]`;
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The generated table's TypeScript. */
export function sightFitSource({ fits, excluded, corrected }) {
  const lines = Object.keys(fits)
    .sort()
    .map((id) => `  ${q(id)}: { eye: ${tuple(fits[id].eye)}, rear: ${tuple(fits[id].rear)}, front: ${tuple(fits[id].front)}, kind: ${q(fits[id].kind)}${corrected.includes(id) ? ', corrected: true' : ''} },`);
  const out = Object.keys(excluded)
    .sort()
    .map((id) => `  ${q(id)}: ${q(excluded[id])},`);
  return `// Generated by tools/content/sight-fit.mjs from the gun models and content/sight-fit.json. Do not edit by hand:
// run \`node tools/content/sight-fit.mjs\` (pnpm content:check fails until you do). Loaded with the first weapon drawn
// in first person, not with the menu.

/**
 * A gun's sights, measured from its model (model space as \`view.muzzleAt\`: +Z the barrel, +Y up, metres). \`eye\`:
 * where the camera sits aiming down the sights; \`rear\` and \`front\`: the points of the sight line the eye looks
 * along (an aperture's middle, the top of a notch's ears, or a little over a plain rear sight or the receiver; the
 * front sight's top). \`kind\`: what the eye looks through or over (\`bead\`: a front sight only). \`corrected\`: set
 * by hand in content/sight-fit.json.
 */
export interface SightFit {
  eye: readonly [number, number, number];
  rear: readonly [number, number, number];
  front: readonly [number, number, number];
  kind: 'aperture' | 'notch' | 'post' | 'bead';
  corrected?: true;
}

/** Per weapon that aims down its own sights. */
export const SIGHT_FITS: Readonly<Record<string, SightFit>> = {
${lines.join('\n')}
};

/** The weapons without a sight fit, and why (they keep the placement they had: view.ts). */
export const SIGHT_EXCLUDED: Readonly<Record<string, string>> = {
${out.join('\n')}
};
`;
}

/** The audit table (markdown): every fit with its measures. */
export function reportOf({ fits, excluded, corrected }) {
  const rows = Object.keys(fits)
    .sort()
    .map((id) => {
      const f = fits[id];
      return `| ${id} | ${f.kind}${f.hood ? ' (hooded post)' : ''}${corrected.includes(id) ? ' (corrected)' : ''} | ${Math.round((f.front[2] - f.rear[2]) * 1000)} | ${f.before.toFixed(2)} | ${f.proud.map((v) => (v * 1000).toFixed(1)).join(' / ')} | ${f.flags.join(', ') || '-'} |`;
    });
  return ['| Weapon | Rear sight | Sight radius (mm) | Error before (°) | Proud rear / front (mm) | Flags |', '|---|---|---|---|---|---|', ...rows, '', 'Excluded:', ...Object.keys(excluded).sort().map((id) => `- ${id}: ${excluded[id]}`)].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await fitAll();
  if (process.argv.includes('--report')) console.log(reportOf(result));
  const text = sightFitSource(result);
  const problems = [...result.problems];
  if (process.argv.includes('--check')) {
    if (!existsSync(SIGHT_FIT_TS) || readFileSync(SIGHT_FIT_TS, 'utf8') !== text) problems.push('packages/shared/src/content/sightFit.generated.ts is out of date (run node tools/content/sight-fit.mjs)');
  } else if (!problems.length && !process.argv.includes('--report')) writeFileSync(SIGHT_FIT_TS, text);
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log(`sight fit: ${Object.keys(result.fits).length} weapons fitted (${result.corrected.length} corrected by hand), ${Object.keys(result.excluded).length} excluded`);
}
