// Factory floor pieces (kit-prop families of part 8; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6): a big shipping
// crate under a lifting saddle (`yokecrate`: the board crate of crate.mjs, a timber or steel saddle over its middle
// that stands out of its sides and over its top), a free-standing warning sign (`sign`: a hazard board on a post and
// a weighted base, a folding A-frame, or a banded post marker) and a belt conveyor section (`conveyor`: side frames
// on legs over a panelled base, a dark belt round its end drums, low guide rails, sometimes cartons riding it).
// Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2].
//
// The crate collides as two boxes, as the piece it replaces did: its body and the saddle (a generator's `boxes`:
// tools/content/kitprops.mjs). The sign and the conveyor collide as their box.
//
// Nothing here glows or blinks: a sign is paint on sheet steel (CLAUDE.md, "Accessibility").

import { rng } from '../env/rng.mjs';
import { noise3 } from '../env/noise.mjs';
import { cross, sub } from '../env/mesh.mjs';
import { Mesh, box, clamp01, disc, groundShade, hex, lathe, mix3, pad, quadN, scale3, standIn, triN } from './geom.mjs';
import { crateMesh, woodTone } from './crate.mjs';

const lerp = (p, q, t) => p + (q - p) * t;

// ---------------------------------------------------------------- the crate under a lifting saddle

/**
 * A board crate (crate.mjs: `batten`, `thick`, `plank`, `brace`) with a lifting saddle over its middle. `g.yoke`:
 * [how far the saddle stands out of each side (m), how far over the top, the height its cheeks start at, its half
 * width along the crate]. `look`: the crate's, and `yoke` (hex), `yokeSteel` (true: painted steel, not timber).
 */
export function yokeCrateMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  if (level >= 2) return standIn(size, hex(look.batten ?? look.wood), hex(look.wood));
  const [out, up, from, half] = g.yoke;
  const xb = w / 2 - out;
  const yb = h - up;
  const m = crateMesh(seed, [xb * 2, yb, d], { ...g, skids: 0 }, look, level);
  const r = rng(seed + 77);
  const base = hex(look.yoke ?? look.batten ?? look.wood);
  const steel = (c) => (p, n) => scale3(c, groundShade(p[1], 0.3, 0.9) * (n[1] > 0.5 ? 1.08 : Math.abs(n[2]) > 0.5 ? 0.82 : 0.95));
  const tone = (k, f = 1) => (look.yokeSteel ? steel(scale3(base, f)) : woodTone(scale3(base, f), r, look, seed + 700 + k));
  if (level === 1) {
    // The beam's top and long sides; each cheek's outer face (up to the beam's top) and its two edges.
    box(m, [-w / 2, yb, -half], [w / 2, h, half], tone(1), ['ny', 'px', 'nx']);
    for (const s of [-1, 1]) {
      const c = tone(2 + s);
      quadN(m, [s * w / 2, from, -half], [s * w / 2, from, half], [s * w / 2, h, half], [s * w / 2, h, -half], [s, 0, 0], c);
      for (const z of [-half, half]) quadN(m, [s * xb, from, z], [s * w / 2, from, z], [s * w / 2, yb, z], [s * xb, yb, z], [0, 0, z], c);
    }
  } else {
    // The beam: three planks side by side across the crate.
    for (let i = 0; i < 3; i++) box(m, [-w / 2, yb, lerp(-half, half, i / 3)], [w / 2, h, lerp(-half, half, (i + 1) / 3)], tone(10 + i, i === 1 ? 0.94 : 1), ['ny', ...(i ? ['nz'] : []), ...(i < 2 ? ['pz'] : [])]);
    // Each cheek: two uprights the saddle's full thickness and a thinner board between them.
    const bw = Math.min(half * 0.36, 0.14);
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -w / 2 : xb;
      const x1 = s < 0 ? -xb : w / 2;
      const inner = s < 0 ? 'px' : 'nx';
      for (const e of [-1, 1]) box(m, [x0, from, e < 0 ? -half : half - bw], [x1, yb, e < 0 ? -half + bw : half], tone(20 + s * 2 + e), [inner, 'py']);
      const xi = s < 0 ? -xb - out * 0.55 : xb;
      const xo = s < 0 ? -xb : xb + out * 0.55;
      box(m, [xi, from + 0.04, -half + bw], [xo, yb, half - bw], tone(30 + s, 0.9), [inner, 'py', 'nz', 'pz']);
    }
  }
  m.boxes = [[-xb, 0, -d / 2, xb, yb, d / 2], [-w / 2, from, -half, w / 2, h, half]];
  return m;
}

// ---------------------------------------------------------------- the warning sign

/** A convex polygon [[u, v], …] cut down to where f ≥ 0 (f linear in u and v). */
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = f(p);
    const fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp > 0 && fq < 0) || (fp < 0 && fq > 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** A flat convex polygon [[u, v], …] placed by `P(u, v)`, facing `want`, as a fan (slivers left out). */
function fan(m, poly, P, want, colour) {
  const q = poly.map(([u, v]) => P(u, v));
  for (let i = 1; i + 1 < q.length; i++) {
    const n = cross(sub(q[i], q[0]), sub(q[i + 1], q[0]));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-7) continue;
    triN(m, q[0], q[i], q[i + 1], want, colour);
  }
}

/** Diagonal hazard stripes over the rectangle [u0, v0, u1, v1]: bands `pitch` wide at 45°, colours `a` and `b` in turn. */
function stripes(m, [u0, v0, u1, v1], P, want, a, b, pitch) {
  const rect = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const n = Math.ceil((u1 - u0 + v1 - v0) / pitch);
  for (let k = 0; k < n; k++) {
    const lo = k * pitch;
    const hi = lo + pitch;
    const poly = clip(clip(rect, (p) => p[0] - u0 + p[1] - v0 - lo), (p) => hi - (p[0] - u0 + p[1] - v0));
    if (poly.length >= 3) fan(m, poly, P, want, k % 2 ? b : a);
  }
}

/** A warning triangle (a dark border round a field, a mark in it when `fine`), point up, centred on `u`, standing on `v`, `s` wide; each layer `lift(k)` off the face. */
function triangleMark(m, u, v, s, P, lift, want, field, ink, fine) {
  const hgt = s * 0.866;
  const tri = (k) => [[u - s / 2 * k, v + hgt / 3 * (1 - k)], [u + s / 2 * k, v + hgt / 3 * (1 - k)], [u, v + hgt / 3 + (hgt * 2 / 3) * k]];
  const layer = (poly, k, colour) => fan(m, poly, (a, b) => lift(P(a, b), k), want, colour);
  layer(tri(1), 1, ink);
  layer(tri(0.7), 2, field);
  if (!fine) return;
  // An exclamation mark: a bar and a dot.
  const bw = s * 0.05;
  const y0 = v + hgt * 0.14;
  layer([[u - bw, y0], [u + bw, y0], [u + bw, y0 + bw * 2], [u - bw, y0 + bw * 2]], 3, ink);
  layer([[u - bw, y0 + bw * 3.2], [u + bw, y0 + bw * 3.2], [u + bw * 1.3, v + hgt * 0.56], [u - bw * 1.3, v + hgt * 0.56]], 3, ink);
}

/**
 * A free-standing warning sign. Settings `g`: `style` ('panel': a board on a post and a weighted base; 'aframe': a
 * folding floor sign; 'post': a banded post marker), `base` (the base's height, m), `board` (the board's height),
 * `mark` ('stripes' or 'triangle': what the board or the A-frame shows), `pitch` (stripe width). `look`: `a` and `b`
 * (hex: the two paints), `base`, `post` (hex), `ink` (hex: the triangle's border and mark), `grime`.
 */
export function signMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const r = rng(seed);
  const grime = look.grime ?? 0.25;
  const wear = 1 + r.jitter(0.03);
  const shade = (c, k = 1) => {
    const b = scale3(c, k * wear);
    return (p, n) => scale3(b, groundShade(p[1], 0.3, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.06 : n[1] < -0.5 ? 0.6 : Math.abs(n[0]) > 0.5 ? 0.86 : 1));
  };
  const a = shade(hex(look.a));
  const b = shade(hex(look.b));
  const ink = shade(hex(look.ink ?? '#1c1d20'));
  const baseC = shade(hex(look.base ?? '#26272a'));
  const postC = shade(hex(look.post ?? '#8b8d8f'));
  const style = g.style ?? 'panel';
  const bh = g.base ?? 0.07;
  const m = new Mesh();
  const fine = level === 0;

  if (style === 'aframe') {
    // Two boards leaning together under a hinge cap, a strap between them.
    const tz = 0.022;
    const yt = h - 0.05;
    const run = d / 2 - tz;
    const L = Math.hypot(run, yt);
    const t = 0.012;
    if (level >= 2) {
      for (const s of [-1, 1]) quadN(m, [-w / 2, 0, s * d / 2], [w / 2, 0, s * d / 2], [w / 2, yt, s * tz], [-w / 2, yt, s * tz], [0, 0.2, s], a);
      for (const sx of [-1, 1]) triN(m, [sx * w / 2, 0, -d / 2], [sx * w / 2, 0, d / 2], [sx * w / 2, yt, 0], [sx, 0, 0], scale3(hex(look.a), 0.4));
      return m;
    }
    for (const s of [-1, 1]) {
      // The board's face, by distance across it and up its slope; `k` layers of paint off it.
      const nrm = [0, run / L, (s * yt) / L];
      const P = (u, v) => [u, (v / L) * yt, s * (d / 2 - (v / L) * run)];
      const lift = (p, k) => [p[0], p[1] + nrm[1] * 0.0015 * k, p[2] + nrm[2] * 0.0015 * k];
      const In = (u, v) => {
        const p = P(u, v);
        return [p[0], p[1], p[2] - s * t * (L / yt)];
      };
      quadN(m, P(-w / 2, 0), P(w / 2, 0), P(w / 2, L), P(-w / 2, L), nrm, a);
      quadN(m, In(-w / 2, 0), In(w / 2, 0), In(w / 2, L), In(-w / 2, L), [0, -nrm[1], -nrm[2]], shade(hex(look.a), 0.55));
      if (fine) {
        for (const sx of [-1, 1]) quadN(m, P(sx * w / 2, 0), In(sx * w / 2, 0), In(sx * w / 2, L), P(sx * w / 2, L), [sx, 0, 0], shade(hex(look.a), 0.8));
        // A cut-out at the foot, drawn as a dark gap, so it stands on two feet.
        const fw = w * 0.22;
        fan(m, [[-w / 2 + fw, 0.02], [w / 2 - fw, 0.02], [w / 2 - fw - 0.02, 0.07], [-w / 2 + fw + 0.02, 0.07]], (u, v) => lift(P(u, v), 1), nrm, scale3(hex('#141517'), 1));
      }
      if ((g.mark ?? 'triangle') === 'stripes') stripes(m, [-w / 2 + 0.012, L * 0.5, w / 2 - 0.012, L * 0.8], (u, v) => lift(P(u, v), 1), nrm, ink, a, g.pitch ?? 0.06);
      else triangleMark(m, 0, L * 0.56, w * 0.8, P, lift, nrm, a, ink, fine);
      // A band of the second paint under the mark.
      const [v1, v2] = [L * 0.3, L * 0.4];
      quadN(m, lift(P(-w / 2 + 0.012, v1), 1), lift(P(w / 2 - 0.012, v1), 1), lift(P(w / 2 - 0.012, v2), 1), lift(P(-w / 2 + 0.012, v2), 1), nrm, b);
    }
    // The hinge cap, with a hand hole's bar over it.
    box(m, [-w / 2, yt - 0.012, -tz - 0.004], [w / 2, yt + 0.012, tz + 0.004], shade(hex(look.a), 0.8), ['ny']);
    if (fine) {
      for (const sx of [-1, 1]) box(m, [sx * w * 0.3 - 0.01, yt + 0.012, -0.008], [sx * w * 0.3 + 0.01, h - 0.014, 0.008], shade(hex(look.a), 0.8), ['ny', 'py']);
      box(m, [-w * 0.3 - 0.01, h - 0.014, -0.008], [w * 0.3 + 0.01, h, 0.008], shade(hex(look.a), 0.85));
      // The strap that stops it spreading.
      const ys = h * 0.3;
      const zs = d / 2 - (ys / yt) * run - t * (L / yt);
      box(m, [-0.012, ys - 0.002, -zs], [0.012, ys + 0.002, zs], ink, ['nz', 'pz']);
    } else box(m, [-w * 0.3, yt + 0.012, -0.008], [w * 0.3, h, 0.008], shade(hex(look.a), 0.82), ['ny']);
    return m;
  }

  if (style === 'post') {
    // A post marker: a round post in bands of the two paints on a weighted base, a domed cap.
    const rad = Math.min(w, d) * (g.radius ?? 0.19);
    if (level >= 2) {
      box(m, [-rad, 0, -rad], [rad, h, rad], (p) => (p[1] > h * 0.55 && p[1] < h * 0.9 ? b(p, [0, 0, 1]) : a(p, [0, 0, 1])), ['ny']);
      return m;
    }
    pad(m, [-w / 2, 0, -d / 2], [w / 2, bh, d / 2], Math.min(w, d) * 0.16, baseC);
    const seg = fine ? 10 : 6;
    const ys = [bh, lerp(bh, h, 0.5), lerp(bh, h, 0.62), lerp(bh, h, 0.74), lerp(bh, h, 0.86), h - 0.03];
    const profile = [...ys.map((y) => [rad, y]), [rad * 0.6, h]];
    lathe(m, profile, seg, (p, n, row) => (row % 2 && row < 5 ? b : a)(p, n), { hard: [1, 2, 3, 4, 5, 6], phase: Math.PI / seg });
    disc(m, rad * 0.6, h, seg, a, { phase: Math.PI / seg });
    if (fine) {
      // A collar where the post meets the base, and the base's carry slot (a dark notch on two sides).
      lathe(m, [[rad * 1.5, bh], [rad * 1.5, bh + 0.025], [rad, bh + 0.045]], seg, (p, n) => baseC(p, n), { hard: [1], phase: Math.PI / seg });
      for (const s of [-1, 1]) quadN(m, [-w * 0.2, 0.012, s * d / 2], [w * 0.2, 0.012, s * d / 2], [w * 0.2, bh * 0.4, s * (d / 2 - 0.006)], [-w * 0.2, bh * 0.4, s * (d / 2 - 0.006)], [0, 0, s], scale3(hex('#101113'), 1));
    }
    return m;
  }

  // A board on a post: the weighted base, the post, the board with its two faces painted.
  const ph = g.board ?? 0.4;
  const pt = 0.02;
  const y0 = h - ph;
  const post = Math.min(w, d) * 0.085;
  if (level >= 2) {
    box(m, [-w / 2, 0, -d / 2], [w / 2, bh, d / 2], baseC, ['ny']);
    box(m, [-w / 2, y0, -pt / 2], [w / 2, h, pt / 2], shade(mix3(hex(look.a), hex(look.b), 0.4)), ['ny', 'py']);
    quadN(m, [-post, bh, 0], [post, bh, 0], [post, y0, 0], [-post, y0, 0], [0, 0, 1], postC);
    quadN(m, [-post, bh, 0], [post, bh, 0], [post, y0, 0], [-post, y0, 0], [0, 0, -1], postC);
    return m;
  }
  if (fine) {
    // The base: a slab with a sloped shoulder, a socket the post stands in.
    box(m, [-w / 2, 0, -d / 2], [w / 2, bh * 0.45, d / 2], baseC, ['ny', 'py']);
    pad(m, [-w / 2, bh * 0.45, -d / 2], [w / 2, bh, d / 2], Math.min(w, d) * 0.14, baseC);
    box(m, [-post * 1.7, bh, -post * 1.7], [post * 1.7, bh + 0.05, post * 1.7], shade(hex(look.base ?? '#26272a'), 1.3), ['ny']);
    lathe(m, [[post, bh + 0.05], [post, y0 + 0.02]], 8, (p, n) => postC(p, n), { phase: Math.PI / 8 });
  } else {
    pad(m, [-w / 2, 0, -d / 2], [w / 2, bh, d / 2], Math.min(w, d) * 0.14, baseC);
    box(m, [-post, bh, -post], [post, y0, post], postC, ['ny', 'py']);
  }
  // The board: its rim, then each face.
  box(m, [-w / 2, y0, -pt / 2], [w / 2, h, pt / 2], shade(hex(look.rim ?? look.post ?? '#8b8d8f'), 0.8), ['pz', 'nz']);
  for (const s of [-1, 1]) {
    const P = (u, v) => [s * u, v, (s * pt) / 2];
    const lift = (p, k) => [p[0], p[1], p[2] + s * 0.0015 * k];
    const want = [0, 0, s];
    if ((g.mark ?? 'stripes') === 'stripes') stripes(m, [-w / 2, y0, w / 2, h], P, want, a, b, g.pitch ?? 0.07);
    else {
      quadN(m, P(-w / 2, y0), P(w / 2, y0), P(w / 2, h), P(-w / 2, h), want, b);
      triangleMark(m, 0, y0 + ph * 0.3, w * 0.86, P, lift, want, a, ink, fine);
      quadN(m, lift(P(-w / 2 + 0.014, y0 + 0.03), 1), lift(P(w / 2 - 0.014, y0 + 0.03), 1), lift(P(w / 2 - 0.014, y0 + ph * 0.2), 1), lift(P(-w / 2 + 0.014, y0 + ph * 0.2), 1), want, ink);
    }
    if (fine) {
      // The bolts that hold the board to its post.
      for (const f of [0.25, 0.75]) box(m, [-0.008, y0 + ph * f - 0.008, s > 0 ? pt / 2 : -pt / 2 - 0.005], [0.008, y0 + ph * f + 0.008, s > 0 ? pt / 2 + 0.005 : -pt / 2], postC, [s > 0 ? 'nz' : 'pz']);
    }
  }
  return m;
}

// ---------------------------------------------------------------- the belt conveyor

/** A band of a cylinder along z through (`cx`, `cy`), radius `rad`, from angle `a0` to `a1` in `seg` flat sides, facing out. */
function arcZ(m, cx, cy, rad, z0, z1, a0, a1, seg, colour) {
  for (let k = 0; k < seg; k++) {
    const t0 = lerp(a0, a1, k / seg);
    const t1 = lerp(a0, a1, (k + 1) / seg);
    const mid = (t0 + t1) / 2;
    const p0 = [cx + Math.cos(t0) * rad, cy + Math.sin(t0) * rad];
    const p1 = [cx + Math.cos(t1) * rad, cy + Math.sin(t1) * rad];
    quadN(m, [p0[0], p0[1], z0], [p0[0], p0[1], z1], [p1[0], p1[1], z1], [p1[0], p1[1], z0], [Math.cos(mid), Math.sin(mid), 0], colour);
  }
}

/** An upright box turned by `yaw` about its centre (`cx`, `cz`): its four sides and its top. */
function turnedBox(m, cx, cz, hx, hz, y0, y1, yaw, colour) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const at = (u, v, y) => [cx + u * c - v * s, y, cz + u * s + v * c];
  const ring = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  for (let k = 0; k < 4; k++) {
    const [u0, v0] = ring[k];
    const [u1, v1] = ring[(k + 1) % 4];
    const mid = at((u0 + u1) / 2, (v0 + v1) / 2, 0);
    quadN(m, at(u0, v0, y0), at(u1, v1, y0), at(u1, v1, y1), at(u0, v0, y1), [mid[0] - cx, 0, mid[2] - cz], colour);
  }
  quadN(m, at(-hx, -hz, y1), at(hx, -hz, y1), at(hx, hz, y1), at(-hx, hz, y1), [0, 1, 0], colour);
}

/**
 * A belt conveyor section, the belt running along x. Settings `g`: `belt` (the belt's height, m), `drum` (the end
 * drums' radius), `frame` (the side frames' width), `legs` (pairs of legs), `guides` ('both' or 'back': the low guide
 * rails), `cartons` (how many ride the belt), `idlers` (spacing of the roller bearings along the frames). `look`:
 * `paint` (the frames), `leg`, `skirt` (the base's panels), `belt`, `guide`, `box` (the control box), `carton` (hex),
 * `scuff` (0–1: how worn the belt's middle is), `rust` (0–1), `grime`.
 */
export function conveyorMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const paint = hex(look.paint);
  const beltC = hex(look.belt ?? '#1c1d20');
  if (level >= 2) return standIn(size, scale3(beltC, 1.3), scale3(paint, 0.8));
  const r = rng(seed);
  const m = new Mesh();
  const fine = level === 0;
  const grime = look.grime ?? 0.3;
  const rust = look.rust ?? 0;
  const rustC = hex('#6b3d22');
  const blot = noise3(seed);
  // Paint: darker towards the floor and on the sides, rust where the seeded noise puts it.
  const painted = (c, k = 1) => {
    const b0 = scale3(c, k * (1 + r.jitter(0.025)));
    return (p, n) => {
      const q = rust > 0 ? mix3(b0, rustC, rust * clamp01(blot(p[0] * 1.7, p[1] * 4.3, p[2] * 1.7) * 1.4 + 0.1)) : b0;
      return scale3(q, groundShade(p[1], 0.3, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.08 : n[1] < -0.5 ? 0.6 : Math.abs(n[0]) > 0.5 ? 0.85 : 1));
    };
  };
  const by = g.belt ?? 0.78;
  const rd = g.drum ?? 0.09;
  const fw = g.frame ?? 0.08;
  const zf = d / 2 - 0.03;
  const zi = zf - fw;
  const zs = zf - 0.04;
  const yb = by - rd * 2;
  const y0 = yb - 0.04;
  const y1 = by + 0.05;
  const xe = w / 2 - rd;
  const legC = hex(look.leg ?? look.paint);
  const skirtC = hex(look.skirt ?? '#3a3d42');
  const guideC = hex(look.guide ?? '#8b8d8f');

  // The base: panels between the legs, set back behind them.
  const panels = fine ? Math.max(2, (g.legs ?? 3) + 1) : 1;
  box(m, [-xe, 0.06, -zs], [xe, yb, zs], painted(skirtC, 0.85), ['ny', 'py']);
  if (fine) {
    for (const s of [-1, 1])
      for (let i = 0; i < panels; i++) {
        const xa = lerp(-xe, xe, i / panels) + 0.05;
        const xb2 = lerp(-xe, xe, (i + 1) / panels) - 0.05;
        box(m, [xa, 0.1, s > 0 ? zs : -zs - 0.008], [xb2, yb - 0.08, s > 0 ? zs + 0.008 : -zs], painted(skirtC, 1 + r.jitter(0.05)), [s > 0 ? 'nz' : 'pz']);
      }
  }
  // The side frames, the full length.
  for (const s of [-1, 1]) box(m, [-w / 2, y0, s > 0 ? zi : -zf], [w / 2, y1, s > 0 ? zf : -zi], painted(paint), ['ny']);
  // The belt: its top in three strips (the middle one scuffed), round the end drums.
  const scuff = look.scuff ?? 0;
  const beltAt = (k) => {
    const c = scale3(beltC, k);
    return (p, n) => scale3(c, n[1] > 0.5 ? 1 : 0.55 + 0.45 * clamp01(n[1] + 0.6));
  };
  const strips = fine ? [[-zi, -zi * 0.55, 1], [-zi * 0.55, zi * 0.55, 1 + scuff * 0.9], [zi * 0.55, zi, 1]] : [[-zi, zi, 1 + scuff * 0.5]];
  for (const [za, zb2, k] of strips) quadN(m, [-xe, by, za], [xe, by, za], [xe, by, zb2], [-xe, by, zb2], [0, 1, 0], beltAt(k));
  const seg = fine ? 6 : 2;
  arcZ(m, xe, by - rd, rd, -zi, zi, -Math.PI / 2, Math.PI / 2, seg, beltAt(1));
  arcZ(m, -xe, by - rd, rd, -zi, zi, Math.PI / 2, Math.PI * 1.5, seg, beltAt(1));
  if (fine) {
    // Belt lacing: a joint across it, a little off the middle.
    const xj = lerp(-xe, xe, 0.3 + r.next() * 0.4);
    quadN(m, [xj - 0.02, by + 0.002, -zi], [xj + 0.02, by + 0.002, -zi], [xj + 0.02, by + 0.002, zi], [xj - 0.02, by + 0.002, zi], [0, 1, 0], scale3(beltC, 2.2));
  }
  // Legs under the frames, on foot plates that reach the edge.
  const legs = Math.max(2, g.legs ?? 3);
  const lw = 0.05;
  for (let i = 0; i < legs; i++) {
    const x = lerp(-w / 2 + 0.3, w / 2 - 0.3, i / (legs - 1));
    for (const s of [-1, 1]) {
      const za = s > 0 ? zf - lw * 2 : -zf;
      const zb2 = s > 0 ? zf : -zf + lw * 2;
      box(m, [x - lw, fine ? 0.012 : 0, za], [x + lw, y0, zb2], painted(legC, 0.9), ['ny', 'py', s > 0 ? 'nz' : 'pz']);
      if (fine) box(m, [x - lw * 1.9, 0, s > 0 ? zf - lw * 2.6 : -d / 2], [x + lw * 1.9, 0.012, s > 0 ? d / 2 : -zf + lw * 2.6], painted(legC, 0.7), ['ny']);
    }
  }
  // Guide rails over the frames: posts and a rail, its top the piece's top.
  const sides = (g.guides ?? 'both') === 'back' ? [-1] : [-1, 1];
  const gz = zf - fw / 2;
  const gt = 0.02;
  for (const s of sides) {
    const gc = painted(guideC);
    box(m, [-w / 2 + 0.08, h - 0.04, s * gz - gt], [w / 2 - 0.08, h, s * gz + gt], gc, fine ? [] : ['ny', 'px', 'nx']);
    const posts = Math.max(2, Math.round((w - 0.4) / (g.posts ?? 0.8)) + 1);
    for (let i = 0; i < posts; i++) {
      const x = lerp(-w / 2 + 0.2, w / 2 - 0.2, i / (posts - 1));
      if (fine) box(m, [x - 0.015, y1, s * gz - 0.015], [x + 0.015, h - 0.04, s * gz + 0.015], gc, ['ny', 'py']);
      else for (const f of [-1, 1]) quadN(m, [x - 0.015, y1, s * gz + f * 0.015], [x + 0.015, y1, s * gz + f * 0.015], [x + 0.015, h - 0.04, s * gz + f * 0.015], [x - 0.015, h - 0.04, s * gz + f * 0.015], [0, 0, f], gc);
    }
  }
  // The control box on the front, by the drive end; a stop button on it (paint, not a lamp).
  const boxC = hex(look.box ?? '#c9a227');
  const xc = xe - 0.75;
  box(m, [xc, 0.2, zs], [xc + 0.4, yb - 0.06, d / 2 - 0.008], painted(boxC), ['nz', ...(fine ? [] : ['ny'])]);
  if (fine) {
    box(m, [xc + 0.15, 0.34, d / 2 - 0.008], [xc + 0.25, 0.44, d / 2], scale3(hex('#8f2a22'), 1), ['nz']);
    // Roller bearings along the frames, and the drums' bearing housings at the ends, which reach the edge.
    const n = Math.max(2, Math.round((xe * 2 - 0.5) / (g.idlers ?? 0.42)));
    const steel = painted(hex('#8b8d8f'), 0.8);
    for (const s of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const x = lerp(-xe + 0.25, xe - 0.25, i / (n - 1));
        box(m, [x - 0.028, by - 0.085, s > 0 ? zf : -zf - 0.014], [x + 0.028, by - 0.03, s > 0 ? zf + 0.014 : -zf], steel, [s > 0 ? 'nz' : 'pz']);
      }
      for (const e of [-1, 1]) box(m, [e * xe - 0.07, by - rd - 0.07, s > 0 ? zf : -d / 2], [e * xe + 0.07, by - rd + 0.07, s > 0 ? d / 2 : -zf], painted(legC, 0.75), [s > 0 ? 'nz' : 'pz']);
    }
  }
  // Cartons riding the belt, each inside the guides and under the piece's top.
  const cartons = g.cartons ?? 0;
  if (cartons > 0) {
    const cr = rng(seed + 31);
    const cc = hex(look.carton ?? '#b08a5e');
    for (let i = 0; i < cartons; i++) {
      const hx = cr.range(0.2, 0.32);
      const hz = cr.range(0.16, 0.26);
      const reach = Math.hypot(hx, hz);
      const x = lerp(-xe + reach + 0.1, xe - reach - 0.1, (i + 0.5 + cr.jitter(0.15)) / cartons);
      const z = cr.jitter(Math.max(0, gz - gt - reach - 0.05));
      const top = Math.min(h - 0.006, by + cr.range(0.13, 0.21));
      const tone = scale3(cc, 1 + cr.jitter(0.12));
      const yaw = cr.jitter(0.5);
      turnedBox(m, x, z, hx, hz, by, top, yaw, (p, n) => scale3(tone, n[1] > 0.5 ? 1.08 : 0.8 + 0.12 * Math.abs(n[2])));
      // A strip of tape over the top.
      if (fine) turnedBox(m, x, z, hx + 0.001, hz * 0.14, top - 0.03, top + 0.002, yaw, scale3(cc, 0.62));
    }
  }
  return m;
}
