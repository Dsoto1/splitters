// Station pipe pieces (kit-prop families of part 11; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6): a section of large
// coolant pipe (`coolantpipe`: along z, open through both ends, a flange at each end, a thin coolant line clamped
// along each side) and a pipe junction (`pipejunction`: a narrower pipe along z, off the ground, through a deep
// collar that stands on the floor, a blanked branch port on each side of the collar). Each fills its bounds,
// [-w/2, w/2] × [0, h] × [-d/2, d/2]; the pipes' axes are where the retired pieces' were (0.7 m and 0.85 m up).
//
// Both collide as finer boxes (a generator's `boxes`: tools/content/kitprops.mjs), the same for each variant: eight
// walls round a bore that stays open from end to end, as the retired pieces' did, and under the junction's pipe each
// side of its collar it is open too. The boxes are in metres: a family here has one size, its retired prop's.
//
// Nothing here glows or blinks: a gauge, a service panel or a band is paint (CLAUDE.md, "Accessibility").
//
// Level 1 keeps the outline with far fewer triangles (fewer than the retired pieces had: 80 and 144); level 2 is a
// stand-in of a few faces.

import { rng } from '../env/rng.mjs';
import { Mesh, annulus, bar, box, cyl, hex, mix3, quadN, scale3 } from './geom.mjs';
import { lerp, onX, onY, round, solid, tone } from './machines.mjs';

const DARK = '#17191b';

/** How far a regular polygon of `sides` sides (a corner on +u) reaches at angle `a`, for a corner radius of 1. */
const polyReach = (sides, a) => {
  const step = (Math.PI * 2) / sides;
  const t = ((a % step) + step) % step;
  return Math.cos(step / 2) / Math.cos(t - step / 2);
};

/**
 * A flat face across z at `z` between a round hole (radius `r0`, `seg` sides) and a many-sided outline (`sides`
 * sides, corner radius `r1`; `seg` a multiple of `sides`), round (0, `yc`), facing `dir` (±z).
 */
function polyFace(m, yc, z, r0, r1, seg, sides, dir, colour) {
  const P = (a, r) => [Math.cos(a) * r, yc + Math.sin(a) * r, z];
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    quadN(m, P(a0, r0), P(a1, r0), P(a1, r1 * polyReach(sides, a1)), P(a0, r1 * polyReach(sides, a0)), [0, 0, dir], colour);
  }
}

/** The inside of a bore along z: dark, darker towards the middle of its length. */
const boreShade = (c, Z) => (p) => scale3(c, 0.3 + 0.14 * Math.abs(p[2]) / Z);

// ---------------------------------------------------------------- the coolant pipe

/**
 * A section of large pipe along z, open through both ends: a flange at each end, hoops round it, a thin coolant line
 * clamped along each side, a service panel on its top. Settings `g`: `flange` ('hex' or 'round'), `hoops` (0–3),
 * `panel` (0 or 1: the service panel), `band` (a painted band round the middle: its width, m; 0 for none), `bolts`
 * (a flange). `look`: `paint`, `flange`, `line` (the side lines), `band`, `panel`, `bolt`, `grime`.
 */
export function coolantPipeMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const yc = h / 2;
  const R = h / 2;
  const rp = R - 0.05;
  const rb = 0.5;
  const lf = 0.11;
  const rl = 0.05;
  const paintC = hex(look.paint);
  const flangeC = hex(look.flange ?? look.paint);
  const lineC = hex(look.line ?? '#8b9094');
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-0.6, 0.05, -Z], [0.6, h - 0.05, Z], (p, n) => (n[2] ? scale3(hex(DARK), 1.6) : scale3(paintC, 0.85)), ['ny']);
    return m;
  }
  // Solid: the pipe as eight walls round its bore (under, over, each side, the four corners), the coolant line along
  // each side. Open: the bore, end to end.
  m.boxes = [
    [-0.4, 0, -Z, 0.4, 0.22, Z],
    [-0.4, h - 0.22, -Z, 0.4, h, Z],
    [-R, 0.36, -Z, -0.48, h - 0.36, Z],
    [0.48, 0.36, -Z, R, h - 0.36, Z],
    [-0.62, 0.08, -Z, -0.34, 0.36, Z],
    [0.34, 0.08, -Z, 0.62, 0.36, Z],
    [-0.62, h - 0.36, -Z, -0.34, h - 0.08, Z],
    [0.34, h - 0.36, -Z, 0.62, h - 0.08, Z],
    [-X, yc - 0.2, -Z, -R, yc + 0.2, Z],
    [R, yc - 0.2, -Z, X, yc + 0.2, Z],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const body = round(scale3(paintC, 1 + r.jitter(0.03)), grime);
  const line = round(lineC, grime * 0.6);
  const bore = boreShade(mix3(paintC, hex(DARK), 0.8), Z);
  if (!fine) {
    // The outline: eight sides the flange's size, the bore, the two end faces, a strip for each side line.
    cyl(m, 2, 0, yc, -Z, Z, R, 8, body);
    cyl(m, 2, 0, yc, -Z, Z, rb, 8, bore, { inside: true });
    for (const s of [-1, 1]) {
      annulus(m, 2, 0, yc, s * Z, rb, R, 8, s, body);
      box(m, [s > 0 ? R - 0.02 : -X, yc - rl, -Z], [s > 0 ? X : -R + 0.02, yc + rl, Z], line, [s > 0 ? 'nx' : 'px', 'nz', 'pz']);
    }
    return m;
  }
  const hexF = (g.flange ?? 'hex') === 'hex';
  const S = hexF ? 12 : 16;
  const flange = round(scale3(flangeC, 1 + r.jitter(0.03)), grime, 0.95);
  const steel = round(hex(look.bolt ?? '#8b9094'), grime);
  // A hexagon as tall as the pipe's bounds (a corner each side), or a round flange.
  const rf = hexF ? Math.min(X, R / Math.sin(Math.PI / 3)) : R;
  const sides = hexF ? 6 : S;
  cyl(m, 2, 0, yc, -Z + lf, Z - lf, rp, S, body);
  cyl(m, 2, 0, yc, -Z, Z, rb, S, bore, { inside: true });
  for (const s of [-1, 1]) {
    const [z0, z1] = s > 0 ? [Z - lf, Z] : [-Z, -Z + lf];
    cyl(m, 2, 0, yc, z0, z1, rf, sides, flange);
    polyFace(m, yc, s * Z, rb, rf, S, sides, s, flange);
    polyFace(m, yc, s * (Z - lf), rp, rf, S, sides, -s, flange);
    // Bolt heads on the flange's inner face, between the pipe and the flange's edge.
    const nb = Math.max(3, g.bolts ?? 6);
    for (let k = 0; k < nb; k++) {
      const a = ((k + 0.5) / nb) * Math.PI * 2;
      const [bx, by] = [Math.cos(a) * (rp + 0.024), yc + Math.sin(a) * (rp + 0.024)];
      box(m, [bx - 0.022, by - 0.022, s > 0 ? Z - lf - 0.03 : -Z + lf], [bx + 0.022, by + 0.022, s > 0 ? Z - lf : -Z + lf + 0.03], steel, [s > 0 ? 'pz' : 'nz']);
    }
  }
  // Hoops round the pipe, a painted band round its middle.
  const nh = Math.max(0, Math.min(3, g.hoops ?? 2));
  const hw = 0.04;
  for (let k = 0; k < nh; k++) {
    const z = nh === 1 ? 0 : lerp(-Z * 0.52, Z * 0.52, k / (nh - 1));
    cyl(m, 2, 0, yc, z - hw, z + hw, rp + 0.035, S, flange);
    for (const e of [-1, 1]) annulus(m, 2, 0, yc, z + e * hw, rp, rp + 0.035, S, e, flange);
  }
  const bw = Math.max(0, Math.min(0.5, g.band ?? 0));
  if (bw > 0) {
    // Between the hoops: with two hoops or none the middle is clear; with one or three the band sits beside it.
    const zb = nh % 2 ? Z * 0.26 : 0;
    cyl(m, 2, 0, yc, zb - bw / 2, zb + bw / 2, rp + 0.004, S, round(hex(look.band ?? '#c9a227'), grime * 0.5));
  }
  // The coolant line along each side, out to the bounds, in three clamps.
  for (const s of [-1, 1]) {
    cyl(m, 2, s * (X - rl), yc, -Z, Z, rl, 8, line, { caps: '01' });
    for (const t of [-0.62, 0, 0.62]) {
      const z = t * Z + (nh % 2 && t === 0 ? 0.14 : 0);
      box(m, [s > 0 ? rp - 0.02 : -X + 0.012, yc - 0.075, z - 0.035], [s > 0 ? X - 0.012 : -rp + 0.02, yc + 0.075, z + 0.035], tone(scale3(flangeC, 0.8), grime), [s > 0 ? 'nx' : 'px']);
    }
  }
  // The service panel: a dark plate on the top with a bright handle (paint).
  if ((g.panel ?? 1) > 0) {
    const zp = nh % 2 ? -Z * 0.26 : 0;
    const y = yc + Math.sqrt(rp * rp - 0.2 * 0.2) + 0.012;
    solid(m, [-0.2, y - 0.03, zp - 0.24, 0.2, y, zp + 0.24], tone(hex(look.panel ?? DARK), 0, 1.25), ['ny']);
    onY(m, -0.03, zp - 0.1, 0.03, zp + 0.1, y, scale3(hex(look.bolt ?? '#8b9094'), 0.9));
  }
  return m;
}

// ---------------------------------------------------------------- the pipe junction

/**
 * A pipe junction: a pipe along z, off the ground and open through both ends, through a deep collar that stands on
 * the floor; a blanked branch port on a block each side of the collar, out to the bounds. Settings `g`: `bolts`
 * (round each face of the collar; 0 for none), `port` ('blank', 'gauge' or 'cap': what is on a branch block's face),
 * `lips` (0 or 1: a lip round each end of the pipe), `panel` (0 or 1: a service panel on the collar's top).
 * `look`: `paint` (the pipe), `collar`, `block`, `port`, `bolt`, `grime`.
 */
export function pipeJunctionMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const yc = h / 2;
  const R = h / 2;
  const rp = 0.64;
  const rb = 0.46;
  const zc = 0.2125;
  const paintC = hex(look.paint);
  const collarC = hex(look.collar ?? look.paint);
  const blockC = hex(look.block ?? look.collar ?? look.paint);
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-0.55, yc - 0.6, -Z], [0.55, yc + 0.6, Z], (p, n) => (n[2] ? scale3(hex(DARK), 1.6) : scale3(paintC, 0.85)));
    box(m, [-0.75, 0, -zc], [0.75, h, zc], scale3(collarC, 0.85), ['ny']);
    return m;
  }
  // Solid: the pipe as eight walls round its bore (under, over, each side, the four corners); the collar as eight
  // more (under, over, each side with its branch block, the four corners). Open: the bore, end to end; under the
  // pipe each side of the collar.
  m.boxes = [
    [-0.36, yc - rp, -Z, 0.36, yc - rb, Z],
    [-0.36, yc + rb, -Z, 0.36, yc + rp, Z],
    [-rp, yc - 0.33, -Z, -rb, yc + 0.33, Z],
    [rb, yc - 0.33, -Z, rp, yc + 0.33, Z],
    [-0.55, yc - 0.55, -Z, -0.33, yc - 0.33, Z],
    [0.33, yc - 0.55, -Z, 0.55, yc - 0.33, Z],
    [-0.55, yc + 0.33, -Z, -0.33, yc + 0.55, Z],
    [0.33, yc + 0.33, -Z, 0.55, yc + 0.55, Z],
    [-0.36, 0, -zc, 0.36, yc - rb, zc],
    [-0.36, yc + rb, -zc, 0.36, h, zc],
    [-X, yc - 0.35, -zc, -rb, yc + 0.35, zc],
    [rb, yc - 0.35, -zc, X, yc + 0.35, zc],
    [-0.66, yc - 0.66, -zc, -0.33, yc - 0.33, zc],
    [0.33, yc - 0.66, -zc, 0.66, yc - 0.33, zc],
    [-0.66, yc + 0.33, -zc, -0.33, yc + 0.66, zc],
    [0.33, yc + 0.33, -zc, 0.66, yc + 0.66, zc],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const S = fine ? 16 : 8;
  const body = round(scale3(paintC, 1 + r.jitter(0.03)), grime);
  const collar = round(scale3(collarC, 1 + r.jitter(0.03)), grime, 0.97);
  const block = tone(blockC, grime);
  const bore = boreShade(mix3(paintC, hex(DARK), 0.8), Z);
  // The pipe each side of the collar, its bore right through, its end faces; the collar and its two faces.
  cyl(m, 2, 0, yc, -Z, Z, rb, S, bore, { inside: true });
  for (const s of [-1, 1]) {
    cyl(m, 2, 0, yc, s > 0 ? zc : -Z, s > 0 ? Z : -zc, rp, S, body);
    annulus(m, 2, 0, yc, s * Z, rb, rp, S, s, body);
    annulus(m, 2, 0, yc, s * zc, rp, R, S, s, collar);
  }
  cyl(m, 2, 0, yc, -zc, zc, R, S, collar);
  // The branch blocks: from inside the collar out to the bounds, as deep as the collar.
  const hb = 0.35;
  const xi = 0.76;
  const xb = fine ? X - 0.03 : X;
  for (const s of [-1, 1]) solid(m, [s > 0 ? xi : -xb, yc - hb, -zc, s > 0 ? xb : -xi, yc + hb, zc], block, [s > 0 ? 'nx' : 'px', ...(fine ? [] : ['ny'])]);
  if (!fine) return m;
  const steel = round(hex(look.bolt ?? '#8b9094'), grime);
  const nb = Math.max(0, g.bolts ?? 8);
  for (let k = 0; k < nb; k++) {
    const a = ((k + 0.5) / nb) * Math.PI * 2;
    // None where a branch block covers the collar's face.
    if (Math.abs(Math.sin(a)) * 0.75 < hb + 0.06 && Math.abs(Math.cos(a)) * 0.75 > xi - 0.1) continue;
    const [bx, by] = [Math.cos(a) * 0.75, yc + Math.sin(a) * 0.75];
    for (const s of [-1, 1]) quadN(m, [bx - 0.035, by - 0.035, s * (zc + 0.002)], [bx + 0.035, by - 0.035, s * (zc + 0.002)], [bx + 0.035, by + 0.035, s * (zc + 0.002)], [bx - 0.035, by + 0.035, s * (zc + 0.002)], [0, 0, s], steel);
  }
  // A lip round each end of the pipe.
  if ((g.lips ?? 1) > 0) {
    for (const s of [-1, 1]) {
      const [z0, z1] = s > 0 ? [Z - 0.09, Z] : [-Z, -Z + 0.09];
      cyl(m, 2, 0, yc, z0, z1, rp + 0.03, S, collar);
      annulus(m, 2, 0, yc, s > 0 ? z1 : z0, rp, rp + 0.03, S, s, collar);
      annulus(m, 2, 0, yc, s > 0 ? z0 : z1, rp, rp + 0.03, S, -s, collar);
    }
  }
  // What a branch block's face carries, out to the bounds: a blanking plate under six bolt heads, a gauge (a pale
  // dial and a still needle in a bezel; paint), or a screwed cap with a cross bar.
  const port = g.port ?? 'blank';
  const portC = hex(look.port ?? '#8b9094');
  const plate = tone(portC, grime * 0.5);
  const dark = tone(scale3(portC, 0.6), 0);
  // A slab on the block's face, from `x0` to `x1` out from it (m), `z0`–`z1` × `y0`–`y1` round the port's centre.
  const slab = (s, x0, x1, z0, y0, z1, y1, colour) => solid(m, [s > 0 ? xb + x0 : -xb - x1, yc + y0, z0, s > 0 ? xb + x1 : -xb - x0, yc + y1, z1], colour, [s > 0 ? 'nx' : 'px']);
  for (const s of [-1, 1]) {
    if (port === 'gauge') {
      slab(s, 0, 0.018, -0.1, -0.1, 0.1, 0.1, scale3(hex('#d8d4c8'), 0.9));
      onX(m, -0.012, yc - 0.01, 0.012, yc + 0.075, s * (xb + 0.018), s, scale3(hex('#7a2a26'), 1));
      for (const [z0, y0, z1, y1] of [[-0.13, -0.13, 0.13, -0.1], [-0.13, 0.1, 0.13, 0.13], [-0.13, -0.1, -0.1, 0.1], [0.1, -0.1, 0.13, 0.1]]) slab(s, 0, 0.03, z0, y0, z1, y1, dark);
      slab(s, 0, 0.03, -0.15, -0.3, 0.15, -0.22, plate);
    } else if (port === 'cap') {
      slab(s, 0, 0.018, -0.15, -0.15, 0.15, 0.15, plate);
      slab(s, 0.018, 0.03, -0.15, -0.025, 0.15, 0.025, dark);
      slab(s, 0.018, 0.03, -0.025, -0.15, 0.025, 0.15, dark);
    } else {
      slab(s, 0, 0.018, -0.16, -0.26, 0.16, 0.26, plate);
      for (const [bz, by] of [[-0.11, -0.2], [0.11, -0.2], [-0.11, 0.2], [0.11, 0.2], [-0.11, 0], [0.11, 0]]) slab(s, 0.018, 0.03, bz - 0.025, by - 0.025, bz + 0.025, by + 0.025, dark);
    }
    // A rib along the block's top.
    bar(m, [s * xi, yc + hb + 0.02, 0], [s * (xb - 0.02), yc + hb + 0.02, 0], 0.04, block);
  }
  // The service panel on the collar's top (the collar's crown is the bounds' top: the panel is paint on its faces).
  if ((g.panel ?? 0) > 0) {
    for (const s of [-1, 1]) quadN(m, [-0.16, h - 0.2, s * (zc + 0.002)], [0.16, h - 0.2, s * (zc + 0.002)], [0.16, h - 0.07, s * (zc + 0.002)], [-0.16, h - 0.07, s * (zc + 0.002)], [0, 0, s], scale3(hex(look.panel ?? DARK), 1.25));
  }
  return m;
}
