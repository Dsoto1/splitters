// Soft seats (kit-prop family `sofa`; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6 part 5): armchairs and sofas, an
// upholstered frame on feet (or a skirt to the floor) with a back the full width, an arm at each end, a seat cushion
// a place and a back cushion leaning behind each. Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2]; its
// front is +z (the sitter looks that way). Nothing stands outside the box: the cushions sit a little inside the arms'
// fronts, a throw lies on the seat and a scatter cushion leans in a corner.
//
// A sofa collides as its box, as the pieces it replaces did.
//
// Level 1 keeps the outline (frame, back, arms, one seat and one back cushion); level 2 is the back and the block in
// front of it, in the fabric's colour.

import { rng } from '../env/rng.mjs';
import { Mesh, box, groundShade, hex, quadN, scale3 } from './geom.mjs';

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
