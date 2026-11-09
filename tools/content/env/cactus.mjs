// Columnar cacti (env.cactus.*): a saguaro-like column with 12 ribs (a star cross-section, crests on the bark
// picture's areole columns), a rounded crown, and 1–3 arms that leave the column, turn up through an elbow and rise
// parallel to it. Ribs and areoles carry it at eye height; vertex colour gives the green (and the dry variant's
// olive); the waxy skin is the cactus strip of the bark picture.
// Collision (shared): the column and each arm's two stretches as capsules that stop everything.

import { rng } from './rng.mjs';
import { Mesh, add, cross, dot, len, mul, norm, perp, sub } from './mesh.mjs';
import { toLinear } from './tree.mjs';
import { BARK_STRIPS } from './textures.mjs';

const RIBS = 12;

/** The column and arms as polylines with radii (shared by every level and variant). */
export function cactusSkeleton(seed, g) {
  const r = rng(seed);
  const H = g.height;
  const R = g.radius;
  const lean = r.range(0, g.lean) * (Math.PI / 180);
  const az = r.next() * Math.PI * 2;
  const tilt = [Math.cos(az) * Math.sin(lean), 0, Math.sin(az) * Math.sin(lean)];
  const column = [];
  // Up the column: a slight lean, a waist just above the foot, the crown rounding off in the last radius.
  const steps = Math.ceil((H - R) / 0.25);
  for (let k = 0; k <= steps; k++) {
    const y = ((H - R) * k) / steps;
    column.push({ p: [tilt[0] * y, y, tilt[2] * y], r: R * (1 - 0.06 * Math.exp(-y / 0.3)) * (1 - 0.08 * (y / H)) });
  }
  crown(column, R * (1 - 0.08 * ((H - R) / H)));
  const arms = [];
  const n = r.int(g.arms[0], g.arms[1]);
  let aa = r.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    aa += (Math.PI * 2) / n + r.jitter(0.6);
    const out = [Math.cos(aa), 0, Math.sin(aa)];
    const h0 = H * r.range(g.armFrom[0], g.armFrom[1]);
    const ar = R * r.range(0.62, 0.75);
    const reach = R + r.range(0.22, 0.38);
    const top = Math.min(H - 0.25, h0 + r.range(0.55, 1.15));
    const base = [tilt[0] * h0, h0, tilt[2] * h0];
    const pts = [];
    // Out of the column (from inside it), then a quarter circle of radius `bend` up into the rising stretch.
    const bend = r.range(0.16, 0.24);
    pts.push({ p: add(base, mul(out, R * 0.3)), r: ar });
    const x0 = reach - bend;
    pts.push({ p: add(base, mul(out, x0)), r: ar });
    for (let k = 1; k <= 4; k++) {
      const a = (k / 4) * (Math.PI / 2);
      pts.push({ p: add(add(base, mul(out, x0 + Math.sin(a) * bend)), [0, bend * (1 - Math.cos(a)), 0]), r: ar });
    }
    const rise = top - (h0 + bend);
    const rs = Math.max(2, Math.ceil(rise / 0.25));
    const elbow = pts[pts.length - 1].p;
    for (let k = 1; k <= rs; k++) pts.push({ p: add(elbow, [0, (rise * k) / rs, 0]), r: ar * (1 - 0.06 * (k / rs)) });
    crown(pts, ar * 0.94);
    arms.push({ pts, out, h0, reach, top, r: ar, elbow });
  }
  return { column, arms, H, R };
}

/** Round off the end of a polyline: a few rings closing to a point over one radius. */
function crown(pts, rad) {
  const end = pts[pts.length - 1].p;
  const prev = pts[pts.length - 2].p;
  const d = norm(sub(end, prev));
  for (const a of [0.35, 0.65, 0.88, 1]) pts.push({ p: add(end, mul(d, rad * Math.sin((a * Math.PI) / 2))), r: Math.max(0.004, rad * Math.cos((a * Math.PI) / 2)) });
}

/**
 * A ribbed tube along `pts` into `m`: `sides` vertices a ring (2 per rib on the nearest level: crest and furrow),
 * each ring's radius r·(1 − depth·(1 − cos(ribs·a))/2), normals from that star shape, parallel-transported frames.
 */
function ribbedTube(m, pts, sides, depth, colour, wind) {
  let t = norm(sub(pts[1].p, pts[0].p));
  let nrm = perp(t);
  let s = 0;
  const circ = 2 * Math.PI * pts[0].r;
  const rings = [];
  const { u0, u1 } = BARK_STRIPS.cactus;
  for (let j = 0; j < pts.length; j++) {
    const tn = j < pts.length - 1 ? norm(sub(pts[j + 1].p, pts[j].p)) : t;
    const tj = norm(add(t, tn));
    nrm = norm(sub(nrm, mul(tj, dot(nrm, tj))));
    const bin = cross(tj, nrm);
    if (j > 0) s += len(sub(pts[j].p, pts[j - 1].p));
    const ring = [];
    const rad = pts[j].r;
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const er = add(mul(nrm, Math.cos(a)), mul(bin, Math.sin(a)));
      const et = add(mul(nrm, -Math.sin(a)), mul(bin, Math.cos(a)));
      const f = 1 - depth * (1 - Math.cos(RIBS * a)) * 0.5;
      const df = -depth * 0.5 * RIBS * Math.sin(RIBS * a);
      // Outward normal of the star-shaped ring (r e_r − r' e_t), tipped by the taper along the tube.
      const n = norm(sub(mul(er, f), mul(et, df * (sides >= RIBS * 2 ? 1 : 0))));
      const p = add(pts[j].p, mul(er, rad * f));
      // Furrows a shade darker (they hold shadow and dust).
      const shade = 0.82 + 0.18 * (1 - (1 - Math.cos(RIBS * a)) * 0.5);
      ring.push(m.vertex(p, n, [u0 + (u1 - u0) * (k / sides), s / (2 * circ)], colour(p).map((c) => c * shade), wind(p)));
    }
    rings.push(ring);
    t = tn;
  }
  for (let j = 0; j + 1 < rings.length; j++)
    for (let k = 0; k < sides; k++) {
      m.tri(rings[j][k], rings[j][k + 1], rings[j + 1][k + 1]);
      m.tri(rings[j][k], rings[j + 1][k + 1], rings[j + 1][k]);
    }
}

/** Every `step`-th point of a polyline (its ends and its crown kept). */
const thin = (pts, step) => pts.filter((_, i) => step <= 1 || i === 0 || i >= pts.length - 5 || i % step === 0);

/** One level of detail: { bark }. lod = { sides (24 = crest and furrow per rib), step, depth }. */
export function cactusMesh(seed, sk, g, lod, look) {
  const bark = new Mesh();
  const col = toLinear(look.skin);
  const foot = toLinear(look.foot ?? look.skin);
  const colour = (p) => {
    // A corky, paler foot (old saguaros scar there), the crown a fresher green.
    const t = Math.min(1, Math.max(0, p[1]) / 0.6);
    const top = Math.max(0, (p[1] - sk.H * 0.85) / (sk.H * 0.15));
    return [0, 1, 2].map((i) => (foot[i] + (col[i] - foot[i]) * t) * (1 + 0.12 * top));
  };
  const wind = () => [0, 0];
  ribbedTube(bark, thin(sk.column, lod.step), lod.sides, lod.depth ?? g.ribDepth, colour, wind);
  for (const a of sk.arms) ribbedTube(bark, thin(a.pts, lod.step), lod.sides, lod.depth ?? g.ribDepth, colour, wind);
  return { bark };
}

/** Gameplay shapes: the column, and each arm out and up, as capsules (stop everything). */
export function cactusShapes(sk, g) {
  const col = sk.column;
  const shapes = [{ kind: 'capsule', a: [col[0].p[0], 0, col[0].p[2]], b: col[col.length - 5].p, r: sk.R, blocks: 'all', surface: g.surface }];
  for (const a of sk.arms) {
    shapes.push({ kind: 'capsule', a: a.pts[0].p, b: a.elbow, r: a.r, blocks: 'all', surface: g.surface });
    shapes.push({ kind: 'capsule', a: a.elbow, b: a.pts[a.pts.length - 5].p, r: a.r, blocks: 'all', surface: g.surface });
  }
  return shapes;
}
