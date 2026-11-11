// Soft seats (kit-prop family `sofa`; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6 part 5): armchairs and sofas, an
// upholstered frame on feet (or a skirt to the floor) with a back the full width, an arm at each end, a seat cushion
// a place and a back cushion leaning behind each. Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2]; its
// front is +z (the sitter looks that way). Nothing stands outside the box: the cushions sit a little inside the arms'
// fronts, a throw lies on the seat and a scatter cushion leans in a corner.
//
// A sofa collides as its box, as the pieces it replaces did.
//
// Part 6 adds the corner sofa (`cornersofa`): a sofa whose first place runs forward as a chaise, the rest of its
// footprint empty. It collides as finer boxes, as the piece it replaces did: the main part up to its seat, the chaise,
// the back (its cushions included) and each arm.
//
// Level 1 keeps the outline (frame, back, arms, one seat and one back cushion); level 2 is the back and the block in
// front of it, in the fabric's colour.

import { rng } from '../env/rng.mjs';
import { Mesh, box, groundShade, hex, quadN, scale3, triN } from './geom.mjs';

const lerp = (p, q, t) => p + (q - p) * t;

/**
 * A cushion that leans back: `x0`–`x1` wide, standing on `y0` up to `y1`, its back at `zb`, `bt` thick at its foot and
 * `tt` at its top. Its front, top and two sides (the back and the underside are never seen).
 */
function leaning(m, x0, x1, y0, y1, zb, bt, tt, colour) {
  const a = [x0, y0, zb + bt];
  const b = [x1, y0, zb + bt];
  const c = [x1, y1, zb + tt];
  const e = [x0, y1, zb + tt];
  quadN(m, a, b, c, e, [0, 0.2, 1], colour);
  quadN(m, e, c, [x1, y1, zb], [x0, y1, zb], [0, 1, 0], colour);
  quadN(m, a, e, [x0, y1, zb], [x0, y0, zb], [-1, 0, 0], colour);
  quadN(m, b, c, [x1, y1, zb], [x1, y0, zb], [1, 0, 0], colour);
}

/**
 * An armchair or sofa. Settings `g`: `seats` (places: a seat and a back cushion each), `seat` (height of the seat's
 * top, m), `cushion` (seat cushion thickness), `arm` (arm width), `armH` (arm height), `back` (the back's thickness),
 * `plinth` (how high the frame stands off the floor), `skirt` (true: fabric to the floor instead of feet). `look`:
 * `fabric`, `cushion` (hex: the seat and back cushions, default the fabric), `piping` (hex: a cord along the
 * cushions' front edges), `throw` (hex: a folded throw on the last place), `scatter` (hex: a scatter cushion in the
 * first corner), `wood` (hex: the feet), `jitter`, `grime`.
 */
export function sofaMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const fabric = hex(look.fabric);
  const arm = g.arm;
  const armH = g.armH;
  const zb = -d / 2 + g.back;
  if (level >= 2) {
    // The back and the block in front of it: a sofa's outline, not its bounds.
    const m = new Mesh();
    box(m, [-w / 2, 0, -d / 2], [w / 2, h, zb], scale3(fabric, 0.85), ['ny']);
    box(m, [-w / 2, 0, zb], [w / 2, (armH + g.seat) / 2, d / 2], scale3(fabric, 0.8), ['ny', 'nz']);
    return m;
  }
  const r = rng(seed);
  const m = new Mesh();
  const grime = look.grime ?? 0.2;
  // Cloth: a tone of its own a part, lighter on top, darker on the sides and towards the floor.
  const cloth = (c, k = 1) => {
    const b = scale3(c, k * (1 + r.jitter(look.jitter ?? 0.04)));
    return (p, n) => scale3(b, groundShade(p[1], 0.3, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.1 : Math.abs(n[0]) > 0.5 ? 0.86 : n[2] < -0.5 ? 0.8 : 1));
  };
  const plinth = g.plinth ?? 0.08;
  const seat = g.seat;
  const yb = seat - (g.cushion ?? 0.14);
  const places = Math.max(1, g.seats ?? 1);
  const x0 = -w / 2 + arm;
  const x1 = w / 2 - arm;
  const front = d / 2 - 0.02;
  const body = cloth(fabric, 0.94);
  // What it stands on: four feet, a skirt to the floor, or (level 1) the frame itself.
  let y0 = plinth;
  if (level === 1) y0 = 0;
  else if (g.skirt) box(m, [-w / 2, 0, -d / 2], [w / 2, plinth, d / 2], cloth(fabric, 0.82), ['ny', 'py']);
  else {
    const f = 0.07;
    const wood = scale3(hex(look.wood ?? '#3a2a1e'), 0.9);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, [sx < 0 ? -w / 2 : w / 2 - f, 0, sz < 0 ? -d / 2 : d / 2 - f], [sx < 0 ? -w / 2 + f : w / 2, plinth, sz < 0 ? -d / 2 + f : d / 2], wood, ['ny', 'py']);
  }
  // The frame under the seat, the back across the whole width, an arm at each end in front of it.
  box(m, [-w / 2, y0, -d / 2], [w / 2, yb, d / 2], body, ['ny', 'py']);
  box(m, [-w / 2, yb, -d / 2], [w / 2, h, zb], body, ['ny']);
  for (const sx of [-1, 1]) box(m, [sx < 0 ? -w / 2 : x1, yb, zb], [sx < 0 ? x0 : w / 2, armH, d / 2], cloth(fabric, 0.98), ['ny', 'nz']);
  const cushion = hex(look.cushion ?? look.fabric);
  const top = h - 0.025;
  const bt = Math.min(0.17, (front - zb) * 0.3);
  const tt = bt * 0.55;
  if (level === 1) {
    box(m, [x0, yb, zb], [x1, seat, front], cloth(cushion, 1.04), ['ny', 'nz', 'nx', 'px']);
    leaning(m, x0, x1, seat, top, zb, bt, tt, cloth(cushion, 1.06));
    return m;
  }
  const piping = look.piping ? scale3(hex(look.piping), 1) : null;
  const gap = 0.004;
  for (let i = 0; i < places; i++) {
    const xa = lerp(x0, x1, i / places) + gap;
    const xb = lerp(x0, x1, (i + 1) / places) - gap;
    box(m, [xa, yb, zb], [xb, seat, front], cloth(cushion, 1.04), ['ny', 'nz']);
    leaning(m, xa, xb, seat, top, zb, bt, tt, cloth(cushion, 1.08));
    if (piping) {
      // A cord along the seat cushion's front edge and the back cushion's top.
      box(m, [xa, seat - 0.014, front], [xb, seat + 0.004, front + 0.007], piping, ['nz', 'ny']);
      box(m, [xa, top - 0.012, zb + tt], [xb, top + 0.004, zb + tt + 0.007], piping, ['nz', 'ny']);
    }
  }
  if (look.scatter) {
    // A scatter cushion leaning in the first corner.
    const sw = Math.min(0.34, (x1 - x0) / places - 0.12);
    const xa = x0 + 0.03 + r.range(0, 0.03);
    leaning(m, xa, xa + sw, seat, seat + sw * 0.92, zb + tt, bt + 0.1, 0.07, cloth(hex(look.scatter), 1));
  }
  if (look.throw) {
    // A folded throw on the last place, hanging over the cushion's front.
    const c = cloth(hex(look.throw), 1);
    const tw = Math.min(0.36, (x1 - x0) / places - 0.1);
    const xb = x1 - 0.03 - r.range(0, 0.04);
    box(m, [xb - tw, seat, zb + bt + 0.02], [xb, seat + 0.03, front + 0.012], c, ['ny']);
    box(m, [xb - tw, yb + 0.01, front], [xb, seat, front + 0.012], c, ['nz', 'py']);
  }
  return m;
}

/**
 * A corner sofa: a sofa along the back of its bounds whose first place (−x) runs forward to the front as a chaise;
 * the rest of the front is empty. Arms with raked fronts. Settings `g`: `seat` (height of the seat's top, m),
 * `cushion` (seat cushion thickness), `slab` (the back's own thickness), `plinth` (how high the frame stands off the
 * floor), `skirt` (true: fabric to the floor instead of feet), and its collision, the same for every variant: `main`
 * (the main part's depth), `deck` (the height of the main part's block), `back` (the depth of the back's block, its
 * cushions included), `arm` (arm width), `armH` (arm height), `armSet` (how far an arm's top stops short of the main
 * part's front), `chaiseIn` (how far the chaise stands in from the −x end) and `chaiseW` (its width); the chaise's
 * block is as high as the seat. `look`: as the sofa's (`fabric`, `cushion`, `piping`, `throw`: on the chaise,
 * `scatter`, `wood`, `jitter`, `grime`).
 */
export function cornerSofaMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const fabric = hex(look.fabric);
  const arm = g.arm;
  const armH = g.armH;
  const seat = g.seat;
  const zf = -d / 2 + g.main;
  const zc = -d / 2 + g.back;
  const zs = -d / 2 + g.slab;
  const cx0 = -w / 2 + g.chaiseIn;
  const cx1 = cx0 + g.chaiseW;
  if (level >= 2) {
    // The back, the block in front of it and the chaise: its outline, not its bounds.
    const m = new Mesh();
    box(m, [-w / 2, 0, -d / 2], [w / 2, h, zc], scale3(fabric, 0.85), ['ny']);
    box(m, [-w / 2, 0, zc], [w / 2, seat, zf], scale3(fabric, 0.8), ['ny', 'nz']);
    box(m, [cx0, 0, zf], [cx1, seat, d / 2], scale3(fabric, 0.8), ['ny', 'nz']);
    return m;
  }
  const r = rng(seed);
  const m = new Mesh();
  // Solid: the main part up to its deck, the chaise, the back, the arms.
  m.boxes = [
    [-w / 2, 0, -d / 2, w / 2, g.deck, zf],
    [cx0, 0, zf, cx1, seat, d / 2],
    [-w / 2, g.deck, -d / 2, w / 2, h, zc],
    [w / 2 - arm, g.deck, zc, w / 2, armH, zf - g.armSet],
    [-w / 2, g.deck, zc, -w / 2 + arm, armH, zf - g.armSet],
  ];
  const grime = look.grime ?? 0.2;
  const cloth = (c, k = 1) => {
    const b = scale3(c, k * (1 + r.jitter(look.jitter ?? 0.04)));
    return (p, n) => scale3(b, groundShade(p[1], 0.3, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.1 : Math.abs(n[0]) > 0.5 ? 0.86 : n[2] < -0.5 ? 0.8 : 1));
  };
  const plinth = g.plinth ?? 0.09;
  const yb = seat - (g.cushion ?? 0.13);
  const body = cloth(fabric, 0.94);
  // What it stands on: feet at the corners of both parts, a skirt to the floor, or (level 1) the frame itself.
  let y0 = plinth;
  if (level === 1) y0 = 0;
  else if (g.skirt) {
    box(m, [-w / 2, 0, -d / 2], [w / 2, plinth, zf], cloth(fabric, 0.82), ['ny', 'py']);
    box(m, [cx0, 0, zf], [cx1, plinth, d / 2], cloth(fabric, 0.82), ['ny', 'py', 'nz']);
  } else {
    const f = 0.07;
    const wood = scale3(hex(look.wood ?? '#3a2a1e'), 0.9);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) box(m, [sx < 0 ? -w / 2 : w / 2 - f, 0, sz < 0 ? -d / 2 : zf - f], [sx < 0 ? -w / 2 + f : w / 2, plinth, sz < 0 ? -d / 2 + f : zf], wood, ['ny', 'py']);
      box(m, [sx < 0 ? cx0 : cx1 - f, 0, d / 2 - f], [sx < 0 ? cx0 + f : cx1, plinth, d / 2], wood, ['ny', 'py']);
    }
  }
  // The frames under the seats, the back across the whole width.
  box(m, [-w / 2, y0, -d / 2], [w / 2, yb, zf], body, ['ny', 'py']);
  box(m, [cx0, y0, zf], [cx1, yb, d / 2], body, ['ny', 'nz']);
  box(m, [-w / 2, yb, -d / 2], [w / 2, h, zs], body, ['ny']);
  // An arm at each end of the main part: square to the deck's height at the front, raked back from there to its top.
  const za = zf - g.armSet;
  for (const sx of [-1, 1]) {
    const c = cloth(fabric, 0.98);
    const xo = (sx * w) / 2;
    const xn = sx * (w / 2 - arm);
    const ring = (x) => [[x, yb, zs], [x, yb, zf], [x, g.deck, zf], [x, armH, za], [x, armH, zs]];
    for (const [x, out] of [[xo, sx], [xn, -sx]]) {
      const q = ring(x);
      for (let k = 1; k < 4; k++) triN(m, q[0], q[k], q[k + 1], [out, 0, 0], c);
    }
    const a = ring(xo);
    const b = ring(xn);
    quadN(m, a[1], b[1], b[2], a[2], [0, 0, 1], c);
    quadN(m, a[2], b[2], b[3], a[3], [0, 0.6, 0.8], c);
    quadN(m, a[3], b[3], b[4], a[4], [0, 1, 0], c);
  }
  // The seats: the first place's cushion runs on down the chaise; back cushions lean behind both places.
  const cushion = hex(look.cushion ?? look.fabric);
  const x0 = -w / 2 + arm;
  const x1 = w / 2 - arm;
  const xm = cx1 - (x0 - cx0);
  const front = zf - 0.02;
  const end = d / 2 - 0.02;
  const top = h - 0.025;
  const bt = zc - zs;
  const tt = bt * 0.55;
  if (level === 1) {
    box(m, [x0, yb, zs], [x1, seat, front], cloth(cushion, 1.04), ['ny', 'nz', 'nx', 'px']);
    box(m, [x0, yb, front], [xm, seat, end], cloth(cushion, 1.04), ['ny', 'nz']);
    leaning(m, x0, x1, seat, top, zs, bt, tt, cloth(cushion, 1.06));
    return m;
  }
  const piping = look.piping ? hex(look.piping) : null;
  const gap = 0.004;
  const places = [[x0 + gap, xm - gap, end], [xm + gap, x1 - gap, front]];
  for (const [xa, xb, zz] of places) {
    box(m, [xa, yb, zs], [xb, seat, zz], cloth(cushion, 1.04), ['ny', 'nz']);
    leaning(m, xa, xb, seat, top, zs, bt, tt, cloth(cushion, 1.08));
    if (piping) {
      box(m, [xa, seat - 0.014, zz], [xb, seat + 0.004, zz + 0.007], piping, ['nz', 'ny']);
      box(m, [xa, top - 0.012, zs + tt], [xb, top + 0.004, zs + tt + 0.007], piping, ['nz', 'ny']);
    }
  }
  if (look.scatter) {
    // A scatter cushion leaning in the far corner (the place without the chaise).
    const sw = 0.34;
    const xb = x1 - 0.03 - r.range(0, 0.03);
    leaning(m, xb - sw, xb, seat, seat + sw * 0.92, zs + tt, bt + 0.1, 0.07, cloth(hex(look.scatter), 1));
  }
  if (look.throw) {
    // A folded throw over the chaise's end.
    const c = cloth(hex(look.throw), 1);
    const xa = x0 + 0.08 + r.range(0, 0.05);
    const xb = xa + Math.min(0.42, xm - x0 - 0.2);
    box(m, [xa, seat, end - 0.38], [xb, seat + 0.03, end + 0.012], c, ['ny']);
    box(m, [xa, yb + 0.01, end], [xb, seat, end + 0.012], c, ['nz', 'py']);
  }
  return m;
}
