// Library pieces (docs/map-briefs/st_johns, step 8b: Memorial Hall as the owner described it): kit-prop families
// `roof` (a faceted spire with a flared eave, a ridge roof's bay on arch-braced trusses, a swept gable roof),
// `bookcase` (a bookcase press with its bench and reading ledge, a double-sided bookcase), `window` (leaded lights),
// `wall` (a parabolic stone arch), `lamp` (a hanging lantern), `library` (a globe on its stand, rugs) and `monument`
// (a bronze bird on a pedestal). All
// generated here from seeds: nothing downloaded, nothing drawn from a photograph, no writing, no real school's mark.
// Nothing glows, flickers or moves: a lantern's panes and a window's lights are plain vertex colour.
//
// Frames: a piece stands on y = 0 centred on its footprint. A roof's bay runs along z, its span across x; a spire is
// centred on its point. A wall piece's faces are ±z.
//
// Level 1 keeps the outline (courses in fewer bands, every other rafter, the truss's main members); level 2 is the
// planes alone.

import { rng } from '../env/rng.mjs';
import { Mesh, bar, box, hex, lathe, mix3, quadN, scale3, triN } from './geom.mjs';

const TAU = Math.PI * 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A convex polygon (points in space) facing `want`, as a fan. */
function poly(m, pts, want, colour) {
  for (let i = 1; i + 1 < pts.length; i++) triN(m, pts[0], pts[i], pts[i + 1], want, colour);
}

/** The part of a convex polygon where `f(p) >= 0` (f linear in p). */
function clip(pts, f) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) out.push(lerp(a, b, fa / (fa - fb)));
  }
  return out.length >= 3 ? out : [];
}

// ---------------------------------------------------------------- the faceted spire

/**
 * A faceted spire: a steep pyramid of `sides` flat faces (default 8) over a many-sided tower or a hall's faceted end,
 * shingled in courses, its eave flared out (`flare`: [how far in the steep slope starts, how far up]) and a small
 * metal cap on the point (`cap`, m). It fills its bounds: a flat of the eave on each of ±x and ±z (w = d, across the
 * flats), the point at the top. Its underside is drawn too (pale panels between dark rafters), so a room open to the
 * roof sees up into it. `under` ({ rise, half }): a ridge roof running off towards −z under it (its ridge on x = 0,
 * `rise` over the spire's foot, its eaves `half` either side): the spire's faces are cut away where they would hang
 * inside that roof, so the two roofs are one space inside. `look`: `roof` (the shingles), `trim` (the cap), `panel`
 * and `rafter` (the underside), `jitter`, `grime`. Collides as nothing (the walls and floors under it do).
 */
export function facetRoofMesh(seed, size, g, look, level) {
  const [w, h] = size;
  // (The hips' rolls and the courses' lips stand a little outside the planes.)
  const A = w / 2 - 0.09;
  const sides = g.sides ?? 8;
  const half = Math.PI / sides;
  const [fin, fup] = g.flare ?? [1.0, 0.7];
  const cap = g.cap ?? 0.5;
  const top = h - cap;
  const roof = hex(look.roof ?? '#6b4638');
  const trim = hex(look.trim ?? '#b0795a');
  const panel = hex(look.panel ?? '#d8d0bc');
  const rafter = hex(look.rafter ?? '#3a2a1e');
  const r = rng(seed);
  const m = new Mesh();
  const courses = level === 0 ? 10 : level === 1 ? 5 : 1;
  const tones = Array.from({ length: courses + 1 }, () => 1 + r.range(-1, 1) * (look.jitter ?? 0.07));
  const grime = look.grime ?? 0.25;
  const under = g.under;
  /** A point on facet `k`: `apo` out from the axis along the facet's normal, `u` (−1..1) across it. */
  const at = (k, apo, y, u) => {
    const a = k * 2 * half;
    const t = apo * Math.tan(half) * u;
    return [Math.cos(a) * apo - Math.sin(a) * t, y, Math.sin(a) * apo + Math.cos(a) * t];
  };
  /** One polygon of the roof, cut where it would hang inside the ridge roof behind (−z). */
  const emit = (pts, want, colour) => {
    if (!under) return poly(m, pts, want, colour);
    const front = clip(pts, (p) => p[2]);
    if (front.length) poly(m, front, want, colour);
    const back = clip(pts, (p) => -p[2]);
    if (!back.length) return;
    for (const s of [-1, 1]) {
      const side = clip(back, (p) => s * p[0]);
      if (!side.length) continue;
      const over = clip(side, (p) => p[1] - under.rise * (1 - (s * p[0]) / under.half) - 0.02);
      if (over.length) poly(m, over, want, colour);
    }
  };
  // The steep slope's apothem at height y (from the flare's top to the point).
  const kick = A - fin;
  const apoAt = (y) => 0.1 + (kick - 0.1) * (1 - (y - fup) / (top - fup));
  for (let k = 0; k < sides; k++) {
    const a = k * 2 * half;
    const out = [Math.cos(a), 0.6, Math.sin(a)];
    const inn = [-Math.cos(a), -0.6, -Math.sin(a)];
    // The flared eave, then the courses.
    emit([at(k, A, 0, -1), at(k, A, 0, 1), at(k, kick, fup, 1), at(k, kick, fup, -1)], out, scale3(roof, tones[0] * 0.82));
    for (let c = 0; c < courses; c++) {
      const y0 = fup + ((top - fup) * c) / courses;
      const y1 = fup + ((top - fup) * (c + 1)) / courses;
      // (No step between courses: a gap there would show the room's panels through the roof. The lower edge of each is shaded.)
      const lip = 0;
      const tone = tones[c + 1] * (1 - grime * 0.3 * (1 - y0 / h));
      emit([at(k, apoAt(y0) + lip, y0, -1), at(k, apoAt(y0) + lip, y0, 1), at(k, apoAt(y1), y1, 1), at(k, apoAt(y1), y1, -1)], out, (p) => scale3(roof, tone * (p[1] < y0 + 0.01 ? 0.86 : 1)));
    }
    // The eave's soffit.
    emit([at(k, A, 0.002, -1), at(k, A, 0.002, 1), at(k, kick - 0.2, 0.002, 1), at(k, kick - 0.2, 0.002, -1)], [0, -1, 0], scale3(roof, 0.35));
    // The underside: a pale panel, and rafters running up it.
    const d = 0.12;
    emit([at(k, kick - d, fup, -1), at(k, kick - d, fup, 1), at(k, apoAt(top) , top - d, 1), at(k, apoAt(top), top - d, -1)], inn, panel);
    // (Between the wall's top and the panel's foot, behind the flared eave: a plate, so no sky shows from inside.)
    emit([at(k, kick - 0.2, 0.002, -1), at(k, kick - 0.2, 0.002, 1), at(k, kick - d, fup, 1), at(k, kick - d, fup, -1)], inn, scale3(rafter, 1.1));
    if (level < 2) {
      const yr = fup + (top - fup) * 0.86;
      for (const u of level === 0 ? [-0.6, -0.2, 0.2, 0.6, 0.97] : [0, 0.97]) {
        const dw = (apo) => 0.07 / (apo * Math.tan(half));
        const a0 = kick - d - 0.05;
        const a1 = apoAt(yr) - d - 0.05;
        // (Rafters lean to the point: each keeps its place across the facet.)
        emit([at(k, a0, fup, u - dw(a0)), at(k, a0, fup, u + dw(a0)), at(k, a1, yr - d, u + dw(a1)), at(k, a1, yr - d, u - dw(a1))], inn, rafter);
      }
    }
    // A roll along each hip.
    if (level === 0) {
      const p = at(k, A - 0.02, 0.09, 1);
      const mid = at(k, kick + 0.01, fup + 0.03, 1);
      const q = at(k, apoAt(top) + 0.02, top, 1);
      if (!under || p[2] >= -0.01) {
        bar(m, p, mid, 0.12, scale3(roof, 0.7));
        bar(m, mid, q, 0.12, scale3(roof, 0.7));
      }
    }
  }
  // Where a ridge roof runs in (the plane z = 0): the hollow behind each side's flared eave is closed, both ways, so
  // no sky shows through it from the hall or from under the spire.
  if (under) for (const s of [-1, 1]) for (const dir of [-1, 1]) {
    const z = dir * 0.004;
    poly(m, [[s * (kick - 0.45), 0.002, z], [s * A, 0.002, z], [s * kick, fup, z], [s * (kick - 0.45), fup + 0.3, z]], [0, 0, dir], scale3(rafter, 1.1));
  }
  // The cap.
  lathe(m, [[0.26, top - 0.12], [0.2, top + cap * 0.35], [0.07, top + cap * 0.6], [0.02, h]], level === 0 ? 8 : 4, () => trim);
  return m;
}

// ---------------------------------------------------------------- a ridge roof's bay

/**
 * One bay of a ridge roof (a hall's, a wing's): two shingled slopes from eave to ridge along the bay's length (z),
 * `rise` high over the eave, the eave `spring` m over the prop's foot and flared (`flare`: [in, up]; a swept eave is a
 * long flare), the eave's edge `overhang` m outside the wall's outer face. Underneath (a room open to the roof sees
 * it): pale panels, `rafters` rafters a slope, two purlins a slope and a ridge beam; with `trusses` (their places
 * along z) an arch-braced truss at each: wall posts on stone corbels (`post` m down the wall from the eave), principal
 * rafters, a collar, curved braces springing from the posts' feet to the collar, a king post. `gable`: 'back' (−z),
 * 'front' (+z) or 'both' closes that end with a wall under the slopes, 0.5 m thick as the wall under it (`timber`: studs and
 * braces drawn on its outer face: half-timbering). `look`: `roof`, `panel`, `rafter`, `timber` (the trusses),
 * `stone` (the corbels), `gable` and `gableIn` (the end wall's two faces), `stud`. Collides as nothing.
 */
export function ridgeRoofMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const s0 = g.spring ?? 0;
  const rise = Math.min(g.rise ?? h - s0 - 0.15, h - s0 - 0.1);
  const [fin, fup] = g.flare ?? [0.9, 0.5];
  const oh = g.overhang ?? 0.6;
  const roof = hex(look.roof ?? '#6b4638');
  const panel = hex(look.panel ?? '#d8d0bc');
  const rafterC = hex(look.rafter ?? '#3a2a1e');
  const timber = hex(look.timber ?? '#3e2c1f');
  const stone = hex(look.stone ?? '#c9c2b0');
  const r = rng(seed);
  const m = new Mesh();
  const courses = level === 0 ? 9 : level === 1 ? 4 : 1;
  const tones = Array.from({ length: courses + 1 }, () => 1 + r.range(-1, 1) * (look.jitter ?? 0.07));
  const yTop = s0 + rise;
  const kx = X - fin;
  const ky = s0 + fup;
  // The main slope: from (kx, ky) to the ridge (0, yTop). `along(t)` is a point t of the way up it.
  const along = (s, t, drop = 0) => [s * kx * (1 - t), ky + (yTop - ky) * t - drop];
  const L = Math.hypot(kx, yTop - ky);
  const nIn = (s) => [(-s * (yTop - ky)) / L, -kx / L, 0];
  for (const s of [-1, 1]) {
    const out = [s * 0.5, 1, 0];
    quadN(m, [s * X, s0, -Z], [s * X, s0, Z], [s * kx, ky, Z], [s * kx, ky, -Z], out, scale3(roof, tones[0] * 0.82));
    for (let c = 0; c < courses; c++) {
      const [x0, y0] = along(s, c / courses);
      const [x1, y1] = along(s, (c + 1) / courses);
      // (No step between courses: a gap there would show the room's panels through the roof. The lower edge of each is shaded.)
      const lip = 0;
      const tone = tones[c + 1];
      quadN(m, [x0, y0 + lip, -Z], [x0, y0 + lip, Z], [x1, y1, Z], [x1, y1, -Z], out, (p) => scale3(roof, tone * (p[1] < y0 + lip + 0.01 ? 0.86 : 1)));
    }
    // The soffit under the eave, the panel under the slope.
    quadN(m, [s * X, s0 + 0.002, -Z], [s * X, s0 + 0.002, Z], [s * (X - oh - 0.05), s0 + 0.002, Z], [s * (X - oh - 0.05), s0 + 0.002, -Z], [0, -1, 0], scale3(roof, 0.35));
    const wi = X - oh - 0.5;
    // The panel from the wall's inner face up to the ridge, a little under the shingles.
    const tw = Math.max(0, 1 - wi / kx);
    const [px0, py0] = along(s, tw, 0.12);
    const [px1, py1] = along(s, 1, 0.12);
    quadN(m, [px0, py0, -Z], [px0, py0, Z], [px1, py1, Z], [px1, py1, -Z], nIn(s), panel);
    // (Between the wall's top and the panel's foot: the wall plate.)
    quadN(m, [s * wi, Math.max(0, s0 - 0.05), -Z], [s * wi, Math.max(0, s0 - 0.05), Z], [px0, py0, Z], [px0, py0, -Z], [-s, 0, 0], scale3(timber, 0.9));
    if (level < 2) {
      const n = Math.max(2, Math.round((g.rafters ?? 12) / (level === 0 ? 1 : 2)));
      const [rx0, ry0] = along(s, tw, 0.17);
      const [rx1, ry1] = along(s, 1, 0.17);
      for (let i = 0; i < n; i++) {
        const z = -Z + (d * (i + 0.5)) / n;
        quadN(m, [rx0, ry0, z - 0.06], [rx0, ry0, z + 0.06], [rx1, ry1, z + 0.06], [rx1, ry1, z - 0.06], nIn(s), rafterC);
      }
      if (level === 0) for (const t of [0.36, 0.7]) {
        const [x, y] = along(s, tw + (1 - tw) * t, 0.3);
        bar(m, [x, y, -Z], [x, y, Z], 0.2, timber, { up: nIn(s).map((v) => -v) });
      }
    }
  }
  // The ridge: a roll outside, a beam inside.
  if (level < 2) {
    bar(m, [0, yTop + 0.02, -Z], [0, yTop + 0.02, Z], 0.16, scale3(roof, 0.7));
    bar(m, [0, yTop - 0.42, -Z], [0, yTop - 0.42, Z], 0.24, timber);
  }
  const wi = X - oh - 0.5;
  // Arch-braced trusses.
  for (const zt of level < 2 ? g.trusses ?? [] : []) {
    const t = 0.28;
    const post = g.post ?? 1.5;
    const xp = wi - t / 2;
    const yc = s0 + rise * (g.collar ?? 0.56);
    const tw = Math.max(0, 1 - xp / kx);
    for (const s of [-1, 1]) {
      // Post and corbel.
      box(m, [s * xp - t / 2, s0 - post, zt - t / 2], [s * xp + t / 2, s0 + 0.15, zt + t / 2], timber, ['py']);
      box(m, [s > 0 ? xp - 0.1 : -xp - 0.34, s0 - post - 0.3, zt - 0.2], [s > 0 ? xp + 0.34 : -xp + 0.1, s0 - post, zt + 0.2], stone, []);
      // The principal rafter.
      const [ax, ay] = along(s, tw, 0.36);
      const [bx, by] = along(s, 1, 0.36);
      bar(m, [ax, ay, zt], [bx, by, zt], t, timber);
      // The brace: a quarter of an ellipse from the post's foot to under the collar's middle.
      const n = level === 0 ? 8 : 4;
      const y0 = s0 - post + 0.1;
      const pt = (i) => {
        const a = ((i / n) * Math.PI) / 2;
        return [s * (xp - t) * Math.cos(a), y0 + (yc - 0.2 - y0) * Math.sin(a), zt];
      };
      for (let i = 0; i < n; i++) bar(m, pt(i), pt(i + 1), t * 0.8, timber);
    }
    // Collar and king post.
    const tc = (yc - ky) / (yTop - ky);
    const xc = kx * (1 - tc) - 0.2;
    bar(m, [-xc, yc, zt], [xc, yc, zt], t, timber);
    bar(m, [0, yc, zt], [0, yTop - 0.4, zt], t * 0.8, timber);
  }
  // A gable wall.
  for (const dir of g.gable === 'both' ? [-1, 1] : g.gable === 'back' ? [-1] : g.gable === 'front' ? [1] : []) {
    const zo = dir * (Z - 0.03);
    const zi = dir * (Z - 0.5);
    const outer = hex(look.gable ?? '#5a3d32');
    const inner = hex(look.gableIn ?? '#d8d0bc');
    const xg = X - oh;
    const yg = (x) => (Math.abs(x) >= kx ? s0 + (fup * (X - Math.abs(x))) / fin : ky + (yTop - ky) * (1 - Math.abs(x) / kx)) - 0.06;
    const shape = [[-xg, Math.max(0, s0 - 0.02)], [xg, Math.max(0, s0 - 0.02)], [xg, yg(xg)], [kx, yg(kx)], [0, yg(0)], [-kx, yg(kx)], [-xg, yg(xg)]];
    poly(m, shape.map(([x, y]) => [x, y, zo]), [0, 0, dir], outer);
    poly(m, shape.map(([x, y]) => [x * ((xg - 0.5) / xg), y, zi]), [0, 0, -dir], inner);
    // The verge (owner, 2026-11-23, St. John's Memorial Hall: "the roofline edges look strange; you can almost see
    // through them"). The slopes are a skin: the shingles, the panel 0.12 m under them and the soffit, with nothing
    // closing their ends, and the gable wall stops 6 cm under the shingles; along a gable that left a slit open from
    // the eave to the ridge, through which the room's panels and the sky showed against the roof's edge. A barge board
    // runs up each slope at the gable's face and closes it: 3 cm over the shingles, down past the gable wall's top
    // (never below the eave's soffit), its face the roof's end.
    verge(m, dir, Z, X, s0, kx, ky, yTop, scale3(roof, 0.62), level, 0.45, oh);
    if (g.timber && level < 2) {
      const stud = hex(look.stud ?? '#3a2a1e');
      const zs = zo + dir * 0.012;
      const strip = (p, q, wd) => {
        const dx = q[0] - p[0];
        const dy = q[1] - p[1];
        const l = Math.hypot(dx, dy) || 1;
        const nx = (-dy / l) * (wd / 2);
        const ny = (dx / l) * (wd / 2);
        quadN(m, [p[0] - nx, p[1] - ny, zs], [p[0] + nx, p[1] + ny, zs], [q[0] + nx, q[1] + ny, zs], [q[0] - nx, q[1] - ny, zs], [0, 0, dir], stud);
      };
      const yb = s0 + 0.08;
      const ym = s0 + rise * 0.45;
      strip([-xg, yb], [xg, yb], 0.16);
      strip([-kx * 0.52, ym], [kx * 0.52, ym], 0.14);
      for (const x of [-0.55, -0.2, 0.2, 0.55]) strip([x * xg, yb], [x * xg, Math.min(yg(x * xg), x * x < 0.1 ? ym : yg(x * xg))], 0.14);
      strip([0, ym], [0, yg(0) - 0.05], 0.14);
      for (const s of [-1, 1]) strip([s * xg * 0.2, ym], [s * xg * 0.55, yb + 0.1], 0.12);
      // The verge boards along the slopes.
      for (const s of [-1, 1]) strip([s * kx, yg(kx) + 0.02], [0, yg(0) + 0.02], 0.2);
    }
  }
  return m;
}

/**
 * A barge board along both slopes of a ridge roof's end (`dir`: −1 the −z end, 1 the +z end; the roof's end at z =
 * dir·Z): the roof's outline (eave tip (±X, s0), the flare's top (±kx, ky), the ridge (0, yTop)) as a board from 3 cm
 * over it to `depth` under it (not below the soffit at the tip), 8 cm thick inside the end: its outer and inner faces,
 * its top and its underside (the far look: the outer face). Closes the slopes' skin where they end over a gable.
 */
function verge(m, dir, Z, X, s0, kx, ky, yTop, colour, level, depth = 0.45, oh = 0.6) {
  const zo = dir * Z;
  const zi = dir * (Z - 0.08);
  for (const s of [-1, 1]) {
    const line = [[s * X, s0], [s * kx, ky], [0, yTop]];
    const top = line.map(([x, y]) => [x, y + 0.03]);
    const bot = line.map(([x, y]) => [x, Math.max(0, s0 - 0.08, y - depth)]);
    for (let i = 0; i < 2; i++) {
      quadN(m, [top[i][0], top[i][1], zo], [top[i + 1][0], top[i + 1][1], zo], [bot[i + 1][0], bot[i + 1][1], zo], [bot[i][0], bot[i][1], zo], [0, 0, dir], colour);
      // (The far look keeps the outer face alone.)
      if (level === 2) continue;
      quadN(m, [top[i][0], top[i][1], zi], [top[i + 1][0], top[i + 1][1], zi], [bot[i + 1][0], bot[i + 1][1], zi], [bot[i][0], bot[i][1], zi], [0, 0, -dir], scale3(colour, 0.8));
      // Its top (facing up and out of the slope) and its underside (facing down and in).
      quadN(m, [top[i][0], top[i][1], zi], [top[i + 1][0], top[i + 1][1], zi], [top[i + 1][0], top[i + 1][1], zo], [top[i][0], top[i][1], zo], [s * 0.5, 1, 0], scale3(colour, 1.1));
      quadN(m, [bot[i][0], bot[i][1], zi], [bot[i + 1][0], bot[i + 1][1], zi], [bot[i + 1][0], bot[i + 1][1], zo], [bot[i][0], bot[i][1], zo], [-s * 0.5, -1, 0], scale3(colour, 0.7));
    }
    // Under the flared eave, outside the wall: the end of the hollow between the flare and the soffit.
    triN(m, [s * X, s0, zo], [s * (X - oh - 0.05), s0, zo], [s * kx, ky, zo], [0, 0, dir], colour);
    // The end at the eave's tip.
    if (level < 2) quadN(m, [top[0][0], top[0][1], zi], [top[0][0], top[0][1], zo], [bot[0][0], bot[0][1], zo], [bot[0][0], bot[0][1], zi], [s, 0, 0], scale3(colour, 0.9));
  }
}

// ---------------------------------------------------------------- a rounded roof (spire or hip end)

/**
 * A roof over a plan with rounded corners: a steep pyramid whose faces are a square's with its corners rounded
 * (`corner` m of radius at the eave's edge; each course's outline is the eave's drawn smaller towards the point, so
 * a corner is a cone between two flat faces), shingled in courses, a flared eave (`flare`: [in, up]) and (`cap`, m) a
 * small metal cap on the point. The eave's edge fills the bounds across x; its foot (y = 0) goes on the walls' top.
 * `half`: 'back' draws only the −z half of a pyramid whose middle is the bounds' +z face and whose eave runs `d` m out
 * on −z (a hall's hipped end: its point is a ridge's end at the +z face, the slopes there those of a Ridge Roof Bay of
 * the same span, rise and flare, so the two meet in one line). `under` ({ rise, half }): as the Faceted Spire's, the
 * faces cut away where they would hang inside a ridge roof running off towards −z. Drawn inside too (pale panels,
 * dark rafters). `look`: `roof`, `trim`, `panel`, `rafter`, `jitter`, `grime`. Collides as nothing.
 */
export function roundRoofMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const half = g.half === 'back';
  // (The eave's edge stands 2 cm inside the bounds.)
  const A = w / 2 - 0.02;
  // Where the pyramid's middle is in the prop's frame: its centre, or (a hip end) the +z face.
  const zc = half ? d / 2 : 0;
  const R = Math.min(A, g.corner ?? 4.7);
  const [fin, fup] = g.flare ?? [1.3, 0.75];
  const cap = g.cap ?? 0;
  const top = h - cap;
  const roof = hex(look.roof ?? '#6b4638');
  const trim = hex(look.trim ?? '#b0795a');
  const panel = hex(look.panel ?? '#d8d0bc');
  const rafter = hex(look.rafter ?? '#3a2a1e');
  const r = rng(seed);
  const m = new Mesh();
  const courses = level === 0 ? 10 : level === 1 ? 5 : 1;
  const arcN = level === 0 ? 4 : level === 1 ? 3 : 2;
  const tones = Array.from({ length: courses + 1 }, () => 1 + r.range(-1, 1) * (look.jitter ?? 0.07));
  const grime = look.grime ?? 0.25;
  const under = g.under;
  // The outline at half-size `a` (its corner radius in proportion), as [x, z, outward normal x, z] round the plan.
  const ring = (a) => {
    const k = a / A;
    const rc = R * k;
    const c = a - rc;
    const pts = [];
    for (const [q, sx, sz] of [[0, 1, 1], [1, -1, 1], [2, -1, -1], [3, 1, -1]]) {
      for (let i = 0; i <= arcN; i++) {
        const t = ((q + i / arcN) * Math.PI) / 2;
        pts.push([sx * c + rc * Math.cos(t), sz * c + rc * Math.sin(t)]);
      }
    }
    return pts;
  };
  const at = (p, y) => [p[0], y, p[1] + zc];
  /** One polygon of the roof: kept to the −z half for a hip end, cut where it would hang inside a ridge roof behind. */
  const emit = (pts, want, colour) => {
    let ps = pts;
    if (half) {
      ps = clip(ps, (p) => zc - p[2]);
      if (!ps.length) return;
    }
    if (!under) return poly(m, ps, want, colour);
    const front = clip(ps, (p) => p[2]);
    if (front.length) poly(m, front, want, colour);
    const back = clip(ps, (p) => -p[2]);
    if (!back.length) return;
    for (const s of [-1, 1]) {
      const side = clip(back, (p) => s * p[0]);
      if (!side.length) continue;
      const over = clip(side, (p) => p[1] - under.rise * (1 - (s * p[0]) / under.half) - 0.02);
      if (over.length) poly(m, over, want, colour);
    }
  };
  const kick = A - fin;
  const tip = Math.max(0.1, R * 0.02);
  const apoAt = (y) => tip + (kick - tip) * (1 - (y - fup) / (top - fup));
  const ringAt = (a, y) => ring(a).map((p) => at(p, y));
  const n = ring(A).length;
  const rows = [[A, 0], [kick, fup]];
  for (let c = 1; c <= courses; c++) {
    const y = fup + ((top - fup) * c) / courses;
    rows.push([apoAt(y), y]);
  }
  const R0 = ring(1);
  for (let j = 0; j < n; j++) {
    const j2 = (j + 1) % n;
    // The segment's outward direction (between its two points' normals).
    const nx = R0[j][0] + R0[j2][0];
    const nz = R0[j][1] + R0[j2][1];
    const out = [nx, Math.hypot(nx, nz) * 0.6, nz];
    const inn = out.map((v) => -v);
    for (let i = 0; i + 1 < rows.length; i++) {
      const [a0, y0] = rows[i];
      const [a1, y1] = rows[i + 1];
      const p0 = ring(a0);
      const p1 = ring(a1);
      const tone = i === 0 ? tones[0] * 0.82 : tones[i] * (1 - grime * 0.3 * (1 - y0 / h));
      // (No step between courses: a gap there would show the room's panels through the roof. The lower edge of each is shaded.)
      emit([at(p0[j], y0), at(p0[j2], y0), at(p1[j2], y1), at(p1[j], y1)], out, (p) => scale3(roof, tone * (i > 0 && p[1] < y0 + 0.01 ? 0.86 : 1)));
    }
    // The eave's soffit, the plate behind the flare and the underside's panel (pale, seen from the room).
    const pa = ring(A);
    const pk = ring(kick - 0.2);
    const di = 0.12;
    const pp = ring(kick - di);
    const pt = ring(apoAt(top) * 0.5);
    emit([at(pa[j], 0.002), at(pa[j2], 0.002), at(pk[j2], 0.002), at(pk[j], 0.002)], [0, -1, 0], scale3(roof, 0.35));
    emit([at(pk[j], 0.002), at(pk[j2], 0.002), at(pp[j2], fup), at(pp[j], fup)], inn, scale3(rafter, 1.1));
    emit([at(pp[j], fup), at(pp[j2], fup), at(pt[j2], top - di), at(pt[j], top - di)], inn, panel);
  }
  // Rafters on the straight faces (the corners are a cone: a rafter at each of their ends), running up to the point.
  if (level < 2) {
    const yr = fup + (top - fup) * 0.86;
    const a0 = kick - 0.17;
    const a1 = apoAt(yr) - 0.17;
    const c0 = a0 - R * (a0 / A);
    const c1 = a1 - R * (a1 / A);
    const us = level === 0 ? [-1, -0.5, 0, 0.5, 1] : [-1, 0, 1];
    for (const [ux, uz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      for (const u of us) {
        // A point on the face at apothem a, `u` of the way along its flat part.
        const p = (a, c) => [ux * a - uz * u * c, uz * a + ux * u * c];
        const q0 = p(a0, c0);
        const q1 = p(a1, c1);
        const sx = -uz * 0.07;
        const sz = ux * 0.07;
        emit([at([q0[0] - sx, q0[1] - sz], fup), at([q0[0] + sx, q0[1] + sz], fup), at([q1[0] + sx, q1[1] + sz], yr - 0.12), at([q1[0] - sx, q1[1] - sz], yr - 0.12)], [-ux, -0.6, -uz], rafter);
      }
    }
  }
  // Where a ridge roof runs in (the plane z = 0 of the pyramid): the hollow behind each side's flared eave closed both ways.
  if (under || half) for (const s of [-1, 1]) for (const dir of half ? [1] : [-1, 1]) {
    // (A hip end's, 4 mm inside its +z face, facing the bay it meets.)
    const z = half ? zc - 0.004 : zc + dir * 0.004;
    poly(m, [[s * (kick - 0.45), 0.002, z], [s * A, 0.002, z], [s * kick, fup, z], [s * (kick - 0.45), fup + 0.3, z]], [0, 0, half ? 1 : dir], scale3(rafter, 1.1));
  }
  if (cap > 0) lathe(m, [[0.26, top - 0.12], [0.2, top + cap * 0.35], [0.07, top + cap * 0.6], [0.02, h]], level === 0 ? 8 : 4, () => trim);
  return m;
}

// ---------------------------------------------------------------- bookcases

const SPINES = ['#5a3324', '#6b4226', '#7a5230', '#4a2a1c', '#8a6a3c', '#5c2a22', '#3f3a2a', '#6e5a3a', '#2f3b33', '#9a845a'];

/**
 * A library's tall bookcase standing out from a wall (a press): `case` m thick and double-sided, the length of the
 * prop (x; its −x end goes to the wall, its +x end to the aisle, panelled), under a moulded cornice with a small
 * finial at each end; `shelves` rows of leather-bound books on each face. `ledge`: 'front' or 'both': a sloped
 * reading ledge at desk height along the +z face (or both). `bench`: a bench in front of the +z face, facing the
 * ledge, its aisle end a high panel (the case stands at the prop's −z side then; without a bench it fills the depth).
 * `look`: `wood`, `books` (0–1: how colourful), `jitter`, `grime`. Collides as the case's box and the bench's.
 */
export function pressMesh(seed, size, g, look, level) {
  const [L, H, D] = size;
  // (The cornice stands 8 cm out all round.)
  const X = L / 2 - 0.08;
  const bench = !!g.bench;
  const lw = g.ledge ? 0.34 : 0;
  const cd = bench ? g.case ?? 0.7 : D - 0.16 - (g.ledge === 'both' ? 2 * lw : lw);
  const z0 = -D / 2 + 0.08 + (g.ledge === 'both' ? lw : 0);
  const z1 = z0 + cd;
  const zc = (z0 + z1) / 2;
  const wood = hex(look.wood ?? '#3d2a1c');
  const r = rng(seed);
  const m = new Mesh();
  const tone = (k) => scale3(wood, 1 + ((k * 37) % 7 - 3) * 0.02);
  const fin = level === 0 ? (g.finial ?? 0.16) : 0;
  const top = H - (g.finial ?? 0.16);
  const side = 0.07;
  // Carcass: plinth, ends, spine, cornice.
  box(m, [-X, 0, z0], [X, 0.14, z1], tone(1), ['ny']);
  box(m, [-X, 0.14, z0 + 0.02], [-X + side, top - 0.2, z1 - 0.02], tone(2), ['ny', 'py']);
  box(m, [X - side, 0.14, z0 + 0.02], [X, top - 0.2, z1 - 0.02], tone(3), ['ny', 'py']);
  box(m, [-X + side, 0.14, zc - 0.02], [X - side, top - 0.2, zc + 0.02], scale3(wood, 0.5), ['ny', 'py', 'nx', 'px']);
  box(m, [-X - 0.04, top - 0.2, z0 - 0.04], [X + 0.04, top - 0.07, z1 + 0.04], tone(4), []);
  box(m, [-X - 0.08, top - 0.07, z0 - 0.08], [X + 0.08, top, z1 + 0.08], tone(5), []);
  if (fin) for (const s of [-1, 1]) {
    const f = new Mesh();
    lathe(f, [[0.07, top], [0.09, top + fin * 0.3], [0.03, top + fin * 0.55], [0.06, top + fin * 0.75], [0.01, top + fin]], 6, () => tone(6));
    put(m, f, [s * (X - 0.1), 0, zc]);
  }
  // The aisle end's panels (a raised field).
  if (level === 0) for (const [ya, yb] of [[0.3, top * 0.45], [top * 0.45 + 0.12, top - 0.35]]) quadN(m, [X + 0.012, ya, z0 + 0.12], [X + 0.012, ya, z1 - 0.12], [X + 0.012, yb, z1 - 0.12], [X + 0.012, yb, z0 + 0.12], [1, 0, 0], scale3(wood, 1.18));
  // Shelves and books on both faces.
  const n = g.shelves ?? 5;
  const gap = (top - 0.2 - 0.14) / n;
  const colour = look.books === undefined ? 0.25 : Number(look.books);
  for (const dir of [-1, 1]) {
    const zf = dir > 0 ? z1 - 0.03 : z0 + 0.03;
    for (let k = 0; k < n; k++) {
      const y = 0.14 + k * gap;
      if (k > 0) box(m, [-X + side, y - 0.03, dir > 0 ? zc : z0 + 0.02], [X - side, y, dir > 0 ? z1 - 0.02 : zc], tone(7 + k), ['nx', 'px', dir > 0 ? 'nz' : 'pz']);
      if (level === 2) {
        quadN(m, [-X + side, y, zf], [X - side, y, zf], [X - side, y + gap * 0.82, zf], [-X + side, y + gap * 0.82, zf], [0, 0, dir], hex(SPINES[k % SPINES.length]));
        continue;
      }
      const step = level === 0 ? 0.19 : 0.5;
      for (let x = -X + side + 0.01; x < X - side - 0.05; ) {
        const wd = Math.min(X - side - 0.01 - x, step * (0.7 + r.next() * 0.7));
        const hh = gap * (0.7 + r.next() * 0.2) - 0.04;
        const c0 = hex(SPINES[Math.floor(r.next() * (colour > r.next() ? SPINES.length : 5))]);
        const c = scale3(c0, 0.8 + r.next() * 0.5);
        quadN(m, [x, y, zf], [x + wd - 0.012, y, zf], [x + wd - 0.012, y + hh, zf], [x, y + hh, zf], [0, 0, dir], (p) => scale3(c, p[1] > y + hh - 0.01 ? 1.1 : 0.92));
        if (level === 0 && y + hh < 1.5) quadN(m, [x, y + hh, zf], [x + wd - 0.012, y + hh, zf], [x + wd - 0.012, y + hh, zf - dir * 0.2], [x, y + hh, zf - dir * 0.2], [0, 1, 0], scale3(c, 0.7));
        x += wd;
      }
    }
  }
  // The reading ledge(s).
  for (const dir of g.ledge === 'both' ? [-1, 1] : g.ledge ? [1] : []) {
    const za = dir > 0 ? z1 : z0;
    const zb = za + dir * lw;
    const c = scale3(wood, 1.12);
    quadN(m, [-X + 0.05, 1.1, za], [X - 0.05, 1.1, za], [X - 0.05, 0.98, zb], [-X + 0.05, 0.98, zb], [0, 1, dir * 0.3], c);
    quadN(m, [-X + 0.05, 0.98, zb], [X - 0.05, 0.98, zb], [X - 0.05, 0.92, zb], [-X + 0.05, 0.92, zb], [0, 0, dir], scale3(c, 0.8));
    quadN(m, [-X + 0.05, 0.92, zb], [X - 0.05, 0.92, zb], [X - 0.05, 0.98, za], [-X + 0.05, 0.98, za], [0, -1, 0], scale3(c, 0.5));
    for (const x of [-X + 0.05, X - 0.05]) triN(m, [x, 1.1, za], [x, 0.98, zb], [x, 0.92, zb], [Math.sign(x), 0, 0], scale3(c, 0.8));
  }
  const boxes = [[-X, 0, z0, X, H, z1]];
  if (bench) {
    const bl = g.benchLength ?? L * 0.72;
    const bx1 = X - 0.05;
    const bx0 = bx1 - bl;
    const bz1 = D / 2;
    const bz0 = bz1 - 0.44;
    const c = scale3(wood, 1.08);
    // (The seat runs into both end boards, and it, the back and the front board stop 1 cm inside the end boards' edges, so no face lies in another's plane.)
    box(m, [bx0 + 0.03, 0.4, bz0 + 0.01], [bx1 - 0.035, 0.46, bz1 - 0.01], c, ['nx', 'px']);
    box(m, [bx0 + 0.05, 0, bz1 - 0.06], [bx1 - 0.05, 0.4, bz1 - 0.01], scale3(c, 0.85), ['ny', 'py']);
    box(m, [bx0 + 0.05, 0.46, bz1 - 0.05], [bx1 - 0.05, 0.86, bz1 - 0.01], scale3(c, 0.95), ['ny']);
    box(m, [bx0, 0, bz0], [bx0 + 0.06, 0.8, bz1], scale3(c, 0.9), ['ny']);
    box(m, [bx1 - 0.07, 0, bz0 - 0.04], [bx1, 1.25, bz1], scale3(c, 0.9), ['ny']);
    if (level === 0) quadN(m, [bx1 + 0.01, 0.2, bz0 + 0.05], [bx1 + 0.01, 0.2, bz1 - 0.06], [bx1 + 0.01, 1.1, bz1 - 0.06], [bx1 + 0.01, 1.1, bz0 + 0.05], [1, 0, 0], scale3(c, 1.15));
    boxes.push([bx0, 0, bz0, bx1, 0.86, bz1]);
  }
  if (level === 0) m.boxes = boxes;
  return m;
}

/** `sub` appended to `m`, moved by `at`. */
function put(m, sub, at) {
  const o = m.vertexCount;
  for (let i = 0; i < sub.P.length; i += 3) m.P.push(sub.P[i] + at[0], sub.P[i + 1] + at[1], sub.P[i + 2] + at[2]);
  m.N.push(...sub.N);
  m.UV.push(...sub.UV);
  m.C.push(...sub.C);
  m.W.push(...sub.W);
  for (const i of sub.I) m.I.push(i + o);
}

// ---------------------------------------------------------------- a globe on its stand

/**
 * A large library globe in a turned wooden stand: four legs and a stretcher carrying a flat horizon ring, the globe
 * (`globe` m across) sitting in it, a brass pin at the pole. The map on it is nobody's: seas and lands from a made-up
 * pattern in faded tones. `look`: `wood`, `sea`, `land`, `brass`. Collides as one box.
 */
export function globeMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const m = new Mesh();
  const wood = hex(look.wood ?? '#4a3020');
  const sea = hex(look.sea ?? '#8f9c88');
  const land = hex(look.land ?? '#b39a62');
  const brass = hex(look.brass ?? '#b08d3c');
  const R = (g.globe ?? w * 0.8) / 2;
  const cy = h - R - 0.06;
  const ring = cy - 0.02;
  const rr = w / 2;
  const r = rng(seed);
  const ph = [r.next() * 6, r.next() * 6, r.next() * 6];
  const seg = level === 0 ? 16 : level === 1 ? 10 : 6;
  const rows = level === 0 ? 9 : level === 1 ? 5 : 3;
  const prof = Array.from({ length: rows + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i / rows) * Math.PI;
    return [Math.max(0.005, R * Math.cos(a)), cy + R * Math.sin(a)];
  });
  lathe(m, prof, seg, (p) => {
    const x = p[0] / R;
    const y = (p[1] - cy) / R;
    const z = p[2] / R;
    const v = Math.sin(3.1 * x + ph[0]) * Math.sin(2.7 * y + ph[1]) + 0.6 * Math.sin(4.3 * z + ph[2]) * Math.cos(3.3 * x - y);
    return scale3(v > 0.22 ? mix3(land, scale3(land, 0.7), Math.min(1, (v - 0.22) * 2)) : sea, 0.9 + 0.1 * y);
  });
  // The horizon ring and the stand.
  if (level < 2) lathe(m, [[R + 0.02, ring - 0.03], [rr, ring - 0.03], [rr, ring + 0.03], [R + 0.02, ring + 0.03]], seg, () => wood, { hard: [0, 1, 2] });
  const legs = level === 2 ? 0 : 4;
  for (let k = 0; k < legs; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    bar(m, [c * (rr - 0.06), 0.012, s * (rr - 0.06)], [c * (rr - 0.09), ring - 0.03, s * (rr - 0.09)], 0.07, wood);
    if (level === 0 && k < 2) bar(m, [c * (rr - 0.06), 0.22, s * (rr - 0.06)], [-c * (rr - 0.06), 0.22, -s * (rr - 0.06)], 0.05, scale3(wood, 0.9));
  }
  // (Narrower than the far globe's six faces, which stand 0.36 m out: the stand's faces must not lie in their planes.)
  if (level === 2) box(m, [-rr * 0.5, 0, -rr * 0.5], [rr * 0.5, ring, rr * 0.5], wood, ['ny', 'py']);
  if (level === 0) lathe(m, [[0.03, cy + R - 0.01], [0.035, h - 0.02], [0.01, h]], 6, () => brass);
  if (level === 0) m.boxes = [[-rr * 0.8, 0, -rr * 0.8, rr * 0.8, h, rr * 0.8]];
  return m;
}

// ---------------------------------------------------------------- rugs

/**
 * A worn rug lying on the floor: a pale fringe at its two ends, a dark border, a field with rows of small lozenges
 * and (`medallion`) one large one in the middle; `plain`: a runner, the field alone between two edge stripes. `look`:
 * `field`, `border`, `motif`, `fringe`, `wear` (0–1). Lies a hair over y = 0. Collides as nothing.
 */
export function rugMesh(seed, size, g, look, level) {
  const [w, , d] = size;
  const m = new Mesh();
  const X = w / 2;
  const Z = d / 2;
  const field = hex(look.field ?? '#7a2a24');
  const border = hex(look.border ?? '#2b2530');
  const motif = hex(look.motif ?? '#c2a56a');
  const fringe = hex(look.fringe ?? '#cfc4a8');
  const wear = Number(look.wear ?? 0.4);
  const worn = (c) => (p) => {
    // Worn towards the middle of its width (where people walk), a little uneven.
    const k = 1 - wear * 0.35 * Math.max(0, 1 - Math.abs(p[0]) / (X * 0.7)) * (0.6 + 0.4 * Math.sin(p[2] * 1.7 + p[0]));
    return mix3(c, [0.35, 0.3, 0.26], (1 - k) * 0.8);
  };
  const rect = (x0, z0, x1, z1, y, c) => quadN(m, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], c);
  let y = 0.012;
  if (g.plain) {
    rect(-X, -Z, X, Z, y, worn(field));
    if (level < 2) for (const s of [-1, 1]) rect(s * (X - 0.22) - 0.05, -Z, s * (X - 0.22) + 0.05, Z, y + 0.002, motif);
    // A thin inner line beside each stripe, and the worn middle a shade paler.
    if (level === 0) {
      for (const s of [-1, 1]) rect(s * (X - 0.36) - 0.015, -Z, s * (X - 0.36) + 0.015, Z, y + 0.002, scale3(motif, 0.8));
      rect(-X * 0.42, -Z, X * 0.42, Z, y + 0.002, (p) => mix3(worn(field)(p), [0.4, 0.33, 0.28], 0.12 + 0.08 * Math.sin(p[2] * 0.9)));
    }
    return m;
  }
  rect(-X, -Z, X, Z, y, fringe);
  rect(-X, -Z + 0.08, X, Z - 0.08, (y += 0.002), worn(border));
  if (level < 2) rect(-X + 0.16, -Z + 0.24, X - 0.16, Z - 0.24, (y += 0.002), worn(motif));
  rect(-X + 0.22, -Z + 0.3, X - 0.22, Z - 0.3, (y += 0.002), worn(field));
  if (level === 0) {
    y += 0.002;
    const loz = (cx, cz, a, b, c) => quadN(m, [cx - a, y, cz], [cx, y, cz - b], [cx + a, y, cz], [cx, y, cz + b], [0, 1, 0], c);
    const nx = Math.max(2, Math.round((w - 0.8) / 0.55));
    const nz = Math.max(3, Math.round((d - 1.0) / 0.55));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const cx = -X + 0.4 + ((w - 0.8) * (i + 0.5)) / nx;
      const cz = -Z + 0.5 + ((d - 1.0) * (j + 0.5)) / nz;
      if (g.medallion && Math.abs(cx) < w * 0.24 && Math.abs(cz) < d * 0.2) continue;
      loz(cx, cz, 0.11, 0.15, worn((i + j) % 2 ? motif : scale3(border, 1.3)));
    }
    if (g.medallion) {
      loz(0, 0, w * 0.22, d * 0.18, worn(border));
      y += 0.002;
      loz(0, 0, w * 0.15, d * 0.12, worn(motif));
      y += 0.002;
      loz(0, 0, w * 0.08, d * 0.065, worn(scale3(field, 0.8)));
    }
  } else if (g.medallion && level === 1) quadN(m, [-w * 0.2, y + 0.002, 0], [0, y + 0.002, -d * 0.17], [w * 0.2, y + 0.002, 0], [0, y + 0.002, d * 0.17], [0, 1, 0], border);
  return m;
}

// ---------------------------------------------------------------- a hanging lantern

/**
 * A small iron lantern hung from a roof on a rod: the rod from the prop's top down to a square cage with a pointed
 * cap and pale panes (`body` m tall). Place its top at the beam it hangs from. The panes are a plain warm colour:
 * nothing glows (a light beside it gives the light). `look`: `iron`, `pane`. Collides as nothing.
 */
export function lanternMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const m = new Mesh();
  const iron = hex(look.iron ?? '#1d1e21');
  const pane = scale3(hex(look.pane ?? '#f0dba0'), 1.25);
  const b = g.body ?? 0.5;
  const a = w / 2;
  const y1 = b * 0.72;
  bar(m, [0, b, 0], [0, h, 0], 0.035, iron);
  if (level === 2) {
    box(m, [-a * 0.8, 0, -a * 0.8], [a * 0.8, y1, a * 0.8], pane, []);
    return m;
  }
  box(m, [-a, 0, -a], [a, 0.035, a], iron, []);
  box(m, [-a * 0.8, 0.035, -a * 0.8], [a * 0.8, y1, a * 0.8], pane, ['ny', 'py']);
  if (level === 0) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) bar(m, [sx * a * 0.86, 0.03, sz * a * 0.86], [sx * a * 0.86, y1, sz * a * 0.86], 0.03, iron);
  lathe(m, [[a * 1.25, y1], [a * 0.5, y1 + (b - y1) * 0.6], [0.03, b]], 4, () => iron, { phase: Math.PI / 4, hard: [0, 1] });
  return m;
}

// ---------------------------------------------------------------- leaded windows

/**
 * A window of small leaded lights drawn on both faces of the wall it is set in (the prop's depth is the wall's
 * thickness and a little more; the wall is solid behind it: a window you look at, not through): a frame (`frame` m
 * wide), `lights` lights side by side between mullions, each `panes` [across, up] small panes in dark leading; `sill`:
 * a sill under it. `look`: `frame`, `glass`, `lead`. Steady colours, no glow. Collides as nothing.
 */
export function leadedMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const frame = hex(look.frame ?? '#e3dcc6');
  const glass = hex(look.glass ?? '#8fa3a6');
  const lead = hex(look.lead ?? '#23262a');
  const fw = g.frame ?? 0.09;
  const lights = g.lights ?? 2;
  const [pa, pu] = g.panes ?? [3, 3];
  const r = rng(seed);
  const X = w / 2;
  const sill = g.sill ? 0.07 : 0;
  // The panes' tones, drawn once (both faces the same).
  const tones = Array.from({ length: lights * pa * pu }, () => 0.82 + r.next() * 0.36);
  const open = !!g.open;
  for (const dir of [-1, 1]) {
    const zf = (dir * d) / 2;
    const zg = zf - dir * 0.025;
    const q = (x0, y0, x1, y1, z, c) => quadN(m, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, dir], c);
    // Frame: four bars round, mullions between the lights; a sill.
    q(-X, sill, X, sill + fw, zf, frame);
    q(-X, h - fw, X, h, zf, frame);
    q(-X, sill + fw, -X + fw, h - fw, zf, frame);
    q(X - fw, sill + fw, X, h - fw, zf, frame);
    if (sill) q(-X, 0, X, sill, zf, scale3(frame, 0.85));
    const lw = (w - 2 * fw - (lights - 1) * fw * 0.7) / lights;
    if (!open) q(-X + fw, sill + fw, X - fw, h - fw, zg, lead);
    for (let i = 0; i < lights; i++) {
      const x0 = -X + fw + i * (lw + fw * 0.7);
      if (i > 0) q(x0 - fw * 0.7, sill + fw, x0, h - fw, zf, frame);
      // Open: the frame round a real opening (a glass pane in the wall fills it), no panes of its own.
      if (open) continue;
      if (level === 2) {
        q(x0 + 0.02, sill + fw + 0.02, x0 + lw - 0.02, h - fw - 0.02, zg + dir * 0.004, glass);
        continue;
      }
      const na = level === 0 ? pa : 1;
      const nu = level === 0 ? pu : Math.min(2, pu);
      const gp = 0.016;
      for (let a = 0; a < na; a++) for (let u = 0; u < nu; u++) {
        const px0 = x0 + (lw * a) / na + gp;
        const px1 = x0 + (lw * (a + 1)) / na - gp;
        const py0 = sill + fw + ((h - sill - 2 * fw) * u) / nu + gp;
        const py1 = sill + fw + ((h - sill - 2 * fw) * (u + 1)) / nu - gp;
        q(px0, py0, px1, py1, zg + dir * 0.004, scale3(glass, tones[(i * pa + a) * pu + u] ?? 1));
      }
    }
  }
  if (open) {
    // The frame's inner edges (the reveal's lining, so the wall's cut shows a frame through its depth) and the
    // mullions through the wall: a light's edges are frame all the way through.
    const lw = (w - 2 * fw - (lights - 1) * fw * 0.7) / lights;
    const Z = d / 2;
    const yb = sill + fw;
    const yt = h - fw;
    quadN(m, [-X + fw, yb, -Z], [X - fw, yb, -Z], [X - fw, yb, Z], [-X + fw, yb, Z], [0, 1, 0], scale3(frame, 0.9));
    quadN(m, [-X + fw, yt, -Z], [X - fw, yt, -Z], [X - fw, yt, Z], [-X + fw, yt, Z], [0, -1, 0], scale3(frame, 0.75));
    quadN(m, [-X + fw, yb, -Z], [-X + fw, yt, -Z], [-X + fw, yt, Z], [-X + fw, yb, Z], [1, 0, 0], scale3(frame, 0.82));
    quadN(m, [X - fw, yb, -Z], [X - fw, yt, -Z], [X - fw, yt, Z], [X - fw, yb, Z], [-1, 0, 0], scale3(frame, 0.82));
    for (let i = 1; i < lights; i++) {
      const x1 = -X + fw + i * (lw + fw * 0.7);
      box(m, [x1 - fw * 0.7, yb, -Z + 0.01], [x1, yt, Z - 0.01], scale3(frame, 0.88), ['ny', 'py', 'nz', 'pz']);
    }
  }
  return m;
}

// ---------------------------------------------------------------- a parabolic stone arch

/**
 * A big smooth stone arch of a parabola's shape, springing from the ground: a band of stone `band` m wide round the
 * opening, as deep as the prop (set it in a wall a little thinner, so it stands proud of both faces). Its voussoirs
 * alternate a little in tone. `look`: `stone`. It fills its bounds (the band's outer edge touches them: the opening
 * is the prop's width less two bands at the ground, its height less one at the crown). Collides as nothing: the wall
 * it stands in gives the piers (a wall stepped to stay inside the band).
 */
export function parabolaArchMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const stone = hex(look.stone ?? '#d6d0c0');
  const band = g.band ?? 0.55;
  const a2 = w / 2;
  const H2 = h;
  const a1 = a2 - band;
  const H1 = h - band;
  const r = rng(seed);
  const n = level === 0 ? 18 : level === 1 ? 10 : 6;
  const Z = d / 2;
  // Points at the same share of each parabola's sweep (even in x at the crown, in y at the feet).
  const pt = (a, H, i) => {
    const t = -1 + (2 * i) / n;
    const x = a * Math.sin((t * Math.PI) / 2);
    return [x, H * (1 - (x / a) * (x / a))];
  };
  for (let i = 0; i < n; i++) {
    const c = scale3(stone, 0.94 + r.next() * 0.1);
    const [ix0, iy0] = pt(a1, H1, i);
    const [ix1, iy1] = pt(a1, H1, i + 1);
    const [ox0, oy0] = pt(a2, H2, i);
    const [ox1, oy1] = pt(a2, H2, i + 1);
    for (const dir of [-1, 1]) quadN(m, [ix0, iy0, dir * Z], [ix1, iy1, dir * Z], [ox1, oy1, dir * Z], [ox0, oy0, dir * Z], [0, 0, dir], c);
    const mx = (ix0 + ix1) / 2;
    const my = (iy0 + iy1) / 2;
    quadN(m, [ix0, iy0, -Z], [ix1, iy1, -Z], [ix1, iy1, Z], [ix0, iy0, Z], [-mx, H1 * 0.45 - my, 0], scale3(c, 0.82));
    if (level < 2) quadN(m, [ox0, oy0, -Z], [ox1, oy1, -Z], [ox1, oy1, Z], [ox0, oy0, Z], [mx, my - H1 * 0.3, 0], scale3(c, 0.95));
  }
  return m;
}

// ---------------------------------------------------------------- a bronze bird on a pedestal

/**
 * A small bronze sculpture of a bird alighting, wings raised, on a stone pedestal (`pedestal`: [width, height] m) with
 * a plain bronze plate on its front (+z). Our own shape: a faceted body, two swept wings, a fanned tail, no writing.
 * `look`: `bronze`, `stone`. Collides as the pedestal's box and one over the bird.
 */
export function birdMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const m = new Mesh();
  const bronze = hex(look.bronze ?? '#4a4a38');
  const stone = hex(look.stone ?? '#8d8a80');
  const [pw, ph] = g.pedestal ?? [0.7, 0.95];
  const P = pw / 2;
  // The pedestal: a plinth, a shaft, a cap.
  box(m, [-P, 0, -P], [P, 0.12, P], scale3(stone, 0.9), ['ny']);
  box(m, [-P * 0.86, 0.12, -P * 0.86], [P * 0.86, ph - 0.08, P * 0.86], stone, ['ny', 'py']);
  box(m, [-P * 0.96, ph - 0.08, -P * 0.96], [P * 0.96, ph, P * 0.96], scale3(stone, 1.06), []);
  if (level < 2) quadN(m, [-P * 0.5, ph * 0.45, P * 0.86 + 0.006], [P * 0.5, ph * 0.45, P * 0.86 + 0.006], [P * 0.5, ph * 0.72, P * 0.86 + 0.006], [-P * 0.5, ph * 0.72, P * 0.86 + 0.006], [0, 0, 1], scale3(bronze, 1.2));
  // The bird: the body an oval leaning forward (+z), a head, a fanned tail, two wings swept up and back.
  const by = ph + (h - ph) * 0.34;
  const s = (h - ph) / 1.0;
  const seg = level === 0 ? 8 : 5;
  const body = new Mesh();
  const rows = level === 0 ? 6 : 3;
  lathe(body, Array.from({ length: rows + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i / rows) * Math.PI;
    return [Math.max(0.004, 0.13 * s * Math.cos(a)), 0.3 * s * Math.sin(a)];
  }), seg, () => bronze);
  // (The lathe's axis is y: laid forward by swapping y and z, leaning up at the head.)
  const o = m.vertexCount;
  for (let i = 0; i < body.P.length; i += 3) {
    const [x, y, z] = [body.P[i], body.P[i + 1], body.P[i + 2]];
    m.P.push(x, by + z + y * 0.45, y * 0.9);
    const [nx, ny, nz] = [body.N[i], body.N[i + 1], body.N[i + 2]];
    m.N.push(nx, nz, ny);
  }
  m.UV.push(...body.UV);
  m.C.push(...body.C);
  m.W.push(...body.W);
  // (Swapping two axes turns the faces inside out: their winding is turned back.)
  for (let i = 0; i < body.I.length; i += 3) m.I.push(body.I[i] + o, body.I[i + 2] + o, body.I[i + 1] + o);
  const head = [0, by + 0.2 * s, 0.3 * s];
  box(m, [head[0] - 0.05 * s, head[1] - 0.05 * s, head[2] - 0.05 * s], [head[0] + 0.05 * s, head[1] + 0.06 * s, head[2] + 0.07 * s], scale3(bronze, 1.1), []);
  triN(m, [-0.025 * s, head[1], head[2] + 0.07 * s], [0.025 * s, head[1], head[2] + 0.07 * s], [0, head[1] - 0.03 * s, head[2] + 0.16 * s], [0, 1, 0], scale3(bronze, 1.3));
  triN(m, [-0.025 * s, head[1], head[2] + 0.07 * s], [0.025 * s, head[1], head[2] + 0.07 * s], [0, head[1] - 0.03 * s, head[2] + 0.16 * s], [0, -1, 0], scale3(bronze, 0.8));
  // Tail.
  for (const dir of [1, -1]) quadN(m, [-0.05 * s, by - 0.1 * s, -0.22 * s], [0.05 * s, by - 0.1 * s, -0.22 * s], [0.13 * s, by - 0.2 * s, -0.46 * s], [-0.13 * s, by - 0.2 * s, -0.46 * s], [0, dir, 0], scale3(bronze, dir > 0 ? 1.05 : 0.75));
  // Wings: three feathers' worth of planes each, both faces.
  const tip = Math.min(w / 2 - 0.01, 0.42 * s);
  for (const sx of [-1, 1]) {
    const root0 = [sx * 0.09 * s, by + 0.05 * s, 0.12 * s];
    const root1 = [sx * 0.09 * s, by + 0.02 * s, -0.16 * s];
    const mid0 = [sx * tip * 0.7, by + 0.36 * s, 0.02 * s];
    const mid1 = [sx * tip * 0.75, by + 0.2 * s, -0.24 * s];
    const end = [sx * tip, by + 0.62 * s, -0.16 * s];
    for (const dir of [1, -1]) {
      const c = scale3(bronze, dir > 0 ? 1.08 : 0.78);
      quadN(m, root0, root1, mid1, mid0, [-sx * 0.2 * dir, dir, 0.3 * dir], c);
      triN(m, mid0, mid1, end, [-sx * 0.2 * dir, dir, 0.3 * dir], c);
    }
  }
  // Legs.
  if (level === 0) for (const sx of [-1, 1]) bar(m, [sx * 0.05 * s, ph, 0.02 * s], [sx * 0.05 * s, by - 0.1 * s, 0.02 * s], 0.025 * s, scale3(bronze, 0.9));
  if (level === 0) m.boxes = [[-P, 0, -P, P, ph, P], [-0.2 * s, ph, -0.3 * s, 0.2 * s, Math.min(h, by + 0.3 * s), 0.3 * s]];
  return m;
}
