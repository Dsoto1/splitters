// Cabinets and white goods (kit-prop families `cabinet`, `appliance`; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6
// part 5): a cabinet is a carcass of boards on a recessed plinth under a top, its bays closed by doors and drawer
// fronts or left open with a shelf (a kitchen unit under a worktop; a low, wide media unit); an appliance is an
// enamelled steel case on a dark kick with what its front needs: a fridge's two doors and handles, a stove's hob
// rings, knobs and oven door, a washing machine's round door and control strip. Each fills its bounds,
// [-w/2, w/2] × [0, h] × [-d/2, d/2]; its front is +z. Handles, knobs and door rims stand out of the case but never
// out of the box: the case's front sits back from it by what they need.
//
// They collide as their box, as the pieces they replace did.
//
// Level 1 keeps the outline (the case, the top, each front as one flat panel); level 2 is the bounds.

import { rng } from '../env/rng.mjs';
import { Mesh, box, clamp01, groundShade, hex, mix3, quadN, scale3, standIn, triN } from './geom.mjs';
import { woodTone } from './crate.mjs';

const lerp = (p, q, t) => p + (q - p) * t;

/**
 * A band of a turned shape round the y or the z axis through `c` ([cx, cz] for 'y', [cx, cy] for 'z'): from the
 * circle of radius `a[0]` at `a[1]` along the axis to the circle `b`, in `seg` flat sides. A radius of 0 makes it a
 * fan (a disc's face). `out` says which way it faces: 'axis' (along +axis), 'round' (away from the axis) or 'in'.
 * `colour(p)` or one colour.
 */
function band(m, axis, c, a, b, seg, out, colour) {
  const at = (k, [rad, t]) => {
    const ang = ((k + 0.5) / seg) * Math.PI * 2;
    const u = Math.cos(ang) * rad;
    const v = Math.sin(ang) * rad;
    return axis === 'y' ? [c[0] + u, t, c[1] + v] : [c[0] + u, c[1] + v, t];
  };
  for (let k = 0; k < seg; k++) {
    const mid = ((k + 1) / seg) * Math.PI * 2;
    const rad = axis === 'y' ? [Math.cos(mid), 0, Math.sin(mid)] : [Math.cos(mid), Math.sin(mid), 0];
    const want = out === 'axis' ? (axis === 'y' ? [0, 1, 0] : [0, 0, 1]) : out === 'round' ? rad : [-rad[0], -rad[1], -rad[2]];
    if (a[0] === 0) triN(m, at(k, a), at(k, b), at(k + 1, b), want, colour);
    else if (b[0] === 0) triN(m, at(k, a), at(k + 1, a), at(k, b), want, colour);
    else quadN(m, at(k, a), at(k + 1, a), at(k + 1, b), at(k, b), want, colour);
  }
}

/** A bar handle from `lo` to `hi` (its outer face at hi z), standing off the face at `z0` on a stub at each end of its long side. */
function handle(m, lo, hi, z0, colour) {
  box(m, lo, hi, colour);
  const k = hi[0] - lo[0] > hi[1] - lo[1] ? 0 : 1;
  const L = hi[k] - lo[k];
  for (const f of [0.08, 0.92]) {
    const a = [lo[0], lo[1], z0];
    const b = [hi[0], hi[1], lo[2]];
    a[k] = lo[k] + L * f - (hi[1 - k] - lo[1 - k]) / 2;
    b[k] = lo[k] + L * f + (hi[1 - k] - lo[1 - k]) / 2;
    box(m, a, b, colour, ['nz', 'pz']);
  }
}

/**
 * A cabinet. Settings `g`: `side` (carcass board thickness, m), `top` (top thickness), `plinth` (plinth height),
 * `kick` (how far the plinth sits back), `over` (how far the top overhangs the fronts: the handles' room), `bays`
 * (side by side), `open` (indices of bays left open, a shelf in each), `stack` (indices of bays that are a stack of
 * `drawers`), `drawerRow` (height of a drawer above each door, 0 for none), `device` (true: a set-top box on an open
 * bay's shelf). `look`: `wood`, `door` (hex: the fronts, default the wood), `top` (hex), `back` (hex: the inside),
 * `metal` (hex: handles), `jitter`, `grime`.
 */
export function cabinetMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  const topC = hex(look.top ?? look.wood);
  if (level >= 2) return standIn(size, topC, scale3(hex(look.door ?? look.wood), 0.8));
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const s = g.side ?? 0.02;
  const t = g.top ?? 0.03;
  const plinth = g.plinth ?? 0.1;
  const over = g.over ?? 0.02;
  const doorT = 0.018;
  const bays = Math.max(1, g.bays ?? 2);
  const open = new Set(g.open ?? []);
  const stack = new Set(g.stack ?? []);
  const zf = d / 2 - over;
  const zc = zf - doorT;
  const yT = h - t;
  const doorC = hex(look.door ?? look.wood);
  const inside = scale3(hex(look.back ?? look.wood), look.back ? 0.8 : 0.45);
  const bayW = (w - s * 2 - s * (bays - 1)) / bays;
  const bayX = (b) => -w / 2 + s + b * (bayW + s);
  // The top: the full footprint.
  box(m, [-w / 2, yT, -d / 2], [w / 2, h, d / 2], tone(topC, 1), level ? ['ny'] : []);
  const body = tone(wood, 2);
  if (level === 1) {
    // The case as one block; its front in flat panels: the two sides' edges, the plinth, a panel a bay.
    box(m, [-w / 2, 0, -d / 2], [w / 2, yT, zf], body, ['ny', 'py', 'pz']);
    const face = (xa, ya, xb, yb2, c) => quadN(m, [xa, ya, zf], [xb, ya, zf], [xb, yb2, zf], [xa, yb2, zf], [0, 0, 1], c);
    face(-w / 2, 0, -w / 2 + s, yT, body);
    face(w / 2 - s, 0, w / 2, yT, body);
    face(-w / 2 + s, 0, w / 2 - s, plinth, scale3(wood, 0.3));
    for (let b = 0; b < bays; b++) face(lerp(-w / 2 + s, w / 2 - s, b / bays), plinth, lerp(-w / 2 + s, w / 2 - s, (b + 1) / bays), yT, open.has(b) ? inside : tone(scale3(doorC, 1.04), 40 + b));
    return m;
  }
  // The carcass: sides to the floor, the back, the plinth set back between the sides, the bottom board, dividers.
  for (const sx of [-1, 1]) box(m, [sx < 0 ? -w / 2 : w / 2 - s, 0, -d / 2], [sx < 0 ? -w / 2 + s : w / 2, yT, zc], body, ['ny', 'py']);
  box(m, [-w / 2 + s, 0, -d / 2], [w / 2 - s, yT, -d / 2 + 0.012], (p, n) => (n[2] > 0 ? inside : body(p, n)), ['nx', 'px', 'ny', 'py', ...(open.size ? [] : ['pz'])]);
  const zk = zc - (g.kick ?? 0.05);
  quadN(m, [-w / 2 + s, 0, zk], [w / 2 - s, 0, zk], [w / 2 - s, plinth, zk], [-w / 2 + s, plinth, zk], [0, 0, 1], scale3(wood, 0.3));
  const floor = plinth + 0.018;
  box(m, [-w / 2 + s, plinth, zk], [w / 2 - s, floor, zc], tone(scale3(wood, 0.9), 4), ['nx', 'px', 'nz', ...(open.size ? [] : ['py'])]);
  if (open.size) quadN(m, [-w / 2 + s, floor, -d / 2 + 0.012], [w / 2 - s, floor, -d / 2 + 0.012], [w / 2 - s, floor, zk], [-w / 2 + s, floor, zk], [0, 1, 0], inside);
  for (let b = 1; b < bays; b++) box(m, [bayX(b) - s, floor, -d / 2 + 0.012], [bayX(b), yT, zc], body, ['ny', 'py', 'nz']);
  const metal = hex(look.metal ?? '#8b8d8f');
  const hd = Math.min(0.014, over - 0.003);
  const front = (xa, ya, xb, yb2, k) => box(m, [xa, ya, zc], [xb, yb2, zf], tone(scale3(doorC, 1.05), k), ['nz']);
  const pull = (xa, ya, xb, yb2) => box(m, [xa, ya, zf], [xb, yb2, zf + hd], metal, ['nz']);
  const row = g.drawerRow ?? 0;
  for (let b = 0; b < bays; b++) {
    const x0 = bayX(b);
    const x1 = x0 + bayW;
    if (open.has(b)) {
      // An open bay: a shelf half way up, and perhaps a set-top box on it.
      const y = lerp(floor, yT, 0.5);
      box(m, [x0, y - 0.009, -d / 2 + 0.012], [x1, y + 0.009, zc - 0.012], tone(scale3(wood, 0.95), 10 + b), ['nx', 'px', 'nz']);
      if (g.device) {
        const dw = Math.min(bayW * 0.7, 0.36);
        const x = lerp(x0 + 0.02, x1 - dw - 0.02, r.next());
        box(m, [x, y + 0.009, zc - 0.2], [x + dw, y + 0.062, zc - 0.03], (p, n) => scale3(hex('#1c1d20'), n[1] > 0.5 ? 1.6 : 1), ['ny', 'nz']);
      }
      continue;
    }
    // The fronts lie over the carcass's edges: half a board each side, the whole of an end's.
    const xa = (b === 0 ? -w / 2 : x0 - s / 2) + 0.002;
    const xb = (b === bays - 1 ? w / 2 : x1 + s / 2) - 0.002;
    const ya = plinth + 0.004;
    const yb2 = yT - 0.004;
    if (stack.has(b)) {
      const n = Math.max(2, g.drawers ?? 3);
      for (let k = 0; k < n; k++) {
        const y0 = lerp(ya, yb2, k / n) + (k ? 0.003 : 0);
        const y1 = lerp(ya, yb2, (k + 1) / n) - (k < n - 1 ? 0.003 : 0);
        front(xa, y0, xb, y1, 60 + b * 8 + k);
        pull((xa + xb) / 2 - 0.07, (y0 + y1) / 2 - 0.007, (xa + xb) / 2 + 0.07, (y0 + y1) / 2 + 0.007);
      }
      continue;
    }
    let yd = yb2;
    if (row > 0) {
      yd = yb2 - row - 0.006;
      front(xa, yb2 - row, xb, yb2, 50 + b);
      pull((xa + xb) / 2 - 0.07, yb2 - row / 2 - 0.007, (xa + xb) / 2 + 0.07, yb2 - row / 2 + 0.007);
    }
    front(xa, ya, xb, yd, 40 + b);
    // A door's pull stands upright near the edge it opens at: pairs of doors meet in the middle.
    const hx = b % 2 === 0 && b < bays - 1 ? xb - 0.045 : xa + 0.045;
    const hl = Math.min(0.14, (yd - ya) * 0.4);
    pull(hx - 0.007, yd - 0.05 - hl, hx + 0.007, yd - 0.05);
  }
  return m;
}

/**
 * A kitchen or laundry appliance. Settings `g`: `style` ('fridge', 'stove' or 'washer'), `foot` (height of the dark
 * kick it stands on, m), `proud` (how far its doors, knobs and handles stand out of the case). A fridge: `split`
 * ('side': two doors side by side; 'stack': a freezer door over the fridge's), `freezer` (the freezer's part of the
 * height, for 'stack'), `dispenser` (true: a dark panel in the first door). A stove: `knobs`. `look`: `paint` (the
 * case), `door` (hex, default the paint), `trim` (hex: handles, knobs, rims), `panel` (hex: the control strip),
 * `dark` (hex: the hob, glass), `ring` (hex: the hob rings, default the trim), `glow` (hex: a hot ring), `grime`.
 */
export function applianceMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const paint = hex(look.paint);
  const dark = hex(look.dark ?? '#1e2022');
  const style = g.style;
  if (level >= 2) return standIn(size, style === 'stove' ? scale3(dark, 1.4) : paint, scale3(paint, 0.85));
  const r = rng(seed);
  const m = new Mesh();
  const grime = look.grime ?? 0.2;
  // Enamel: a tone of its own a part, a little lighter on top and darker on the sides and towards the floor.
  const enamel = (c, k = 1) => {
    const b = scale3(c, k * (1 + r.jitter(0.02)));
    return (p, n) => scale3(b, groundShade(p[1], 0.25, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.05 : Math.abs(n[0]) > 0.5 ? 0.88 : n[2] < -0.5 ? 0.8 : 1));
  };
  const trim = hex(look.trim ?? '#8b8d8f');
  const doorC = hex(look.door ?? look.paint);
  const panelC = hex(look.panel ?? look.paint);
  const foot = g.foot ?? 0.05;
  const proud = g.proud ?? 0.04;
  const zb = d / 2 - proud;
  const fine = level === 0;
  // The kick it stands on, set back at the front, and the case.
  box(m, [-w / 2, 0, -d / 2], [w / 2, foot, zb - 0.03], scale3(dark, 0.9), ['ny', 'py']);
  const hob = style === 'stove' ? 0.006 : 0;
  box(m, [-w / 2, foot, -d / 2], [w / 2, h - hob, zb], enamel(paint), hob ? ['py'] : []);
  const glass = (lo, hi) => (p) => scale3(dark, lerp(0.8, 1.7, (p[1] - lo) / (hi - lo)));

  if (style === 'fridge') {
    const dt = proud * 0.6;
    const zd = zb + dt;
    const ya = foot + 0.012;
    const yb2 = h - 0.004;
    const doors = [];
    if ((g.split ?? 'side') === 'stack') {
      const cut = lerp(ya, yb2, 1 - (g.freezer ?? 0.3));
      doors.push([-w / 2 + 0.004, ya, w / 2 - 0.004, cut - 0.004, w / 2 - 0.075, cut - 0.06 - Math.min(0.5, (cut - ya) * 0.45), cut - 0.06]);
      doors.push([-w / 2 + 0.004, cut + 0.004, w / 2 - 0.004, yb2, w / 2 - 0.075, cut + 0.05, Math.min(yb2 - 0.04, cut + 0.05 + (yb2 - cut) * 0.6)]);
    } else {
      const mid = lerp(ya, yb2, 0.55);
      const hl = Math.min(0.6, (yb2 - ya) * 0.36);
      doors.push([-w / 2 + 0.004, ya, -0.004, yb2, -0.06, mid - hl / 2, mid + hl / 2]);
      doors.push([0.004, ya, w / 2 - 0.004, yb2, 0.06, mid - hl / 2, mid + hl / 2]);
    }
    doors.forEach(([xa, y0, xb, y1, hx, h0, h1], i) => {
      box(m, [xa, y0, zb], [xb, y1, zd], enamel(doorC, 1.03), ['nz']);
      if (!fine) return;
      handle(m, [hx - 0.013, h0, zd + (d / 2 - zd) * 0.5], [hx + 0.013, h1, d / 2], zd, scale3(trim, 1));
      if (g.dispenser && i === 0) {
        // A water and ice dispenser: a dark recess panel with a lighter sill.
        const cx = (xa + xb) / 2;
        const cy = lerp(y0, y1, 0.62);
        box(m, [cx - 0.1, cy - 0.16, zd], [cx + 0.1, cy + 0.16, zd + 0.004], glass(cy - 0.16, cy + 0.6), ['nz']);
        box(m, [cx - 0.1, cy - 0.19, zd], [cx + 0.1, cy - 0.16, zd + 0.012], scale3(trim, 0.9), ['nz']);
      }
    });
    if (fine) {
      // A badge on the last door, and the hinge caps on top.
      const [xa, , xb, y1] = doors[doors.length - 1];
      box(m, [lerp(xa, xb, 0.5) - 0.04, y1 - 0.08, zd], [lerp(xa, xb, 0.5) + 0.04, y1 - 0.062, zd + 0.003], scale3(trim, 1.1), ['nz']);
    }
    return m;
  }

  if (style === 'stove') {
    // The hob: dark glass over the whole top, four rings on it.
    const yh = h - hob;
    quadN(m, [-w / 2, yh, -d / 2], [w / 2, yh, -d / 2], [w / 2, yh, zb], [-w / 2, yh, zb], [0, 1, 0], scale3(dark, 1.4));
    const zm = (-d / 2 + zb) / 2;
    const glow = look.glow ? hex(look.glow) : null;
    if (fine) {
      let k = 0;
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const rad = Math.min(w, d) * ((sx * sz > 0 ? 0.105 : 0.085) + r.jitter(0.004));
          const c = [sx * w * 0.23, zm + sz * (zb + d / 2) * 0.23];
          const hot = glow && k++ === 1;
          const rim = hot ? mix3(trim, glow, 0.8) : scale3(hex(look.ring ?? look.trim ?? '#8b8d8f'), 0.55);
          band(m, 'y', c, [rad, yh], [rad, h], 10, 'round', scale3(trim, 0.4));
          band(m, 'y', c, [rad * 0.45, h], [rad, h], 10, 'axis', rim);
          band(m, 'y', c, [0, h], [rad * 0.45, h], 10, 'axis', scale3(dark, 1.1));
        }
    }
    // The control strip under the hob's edge, its knobs; the oven door under it: a window and a bar handle.
    const ys = h - 0.14;
    box(m, [-w / 2 + 0.004, ys, zb], [w / 2 - 0.004, h - 0.02, zb + 0.01], enamel(panelC, 1), ['nz']);
    const ya = foot + 0.03;
    const yd = ys - 0.012;
    const zd = zb + 0.014;
    box(m, [-w / 2 + 0.02, ya, zb], [w / 2 - 0.02, yd, zd], enamel(doorC, 1.02), ['nz']);
    const wy0 = lerp(ya, yd, 0.2);
    const wy1 = lerp(ya, yd, 0.72);
    if (!fine) {
      quadN(m, [-w / 2 + 0.11, wy0, zd + 0.002], [w / 2 - 0.11, wy0, zd + 0.002], [w / 2 - 0.11, wy1, zd + 0.002], [-w / 2 + 0.11, wy1, zd + 0.002], [0, 0, 1], glass(wy0, wy1));
      return m;
    }
    box(m, [-w / 2 + 0.11, wy0, zd], [w / 2 - 0.11, wy1, zd + 0.003], glass(wy0, wy1), ['nz']);
    handle(m, [-w / 2 + 0.09, yd - 0.07, lerp(zd, d / 2, 0.5)], [w / 2 - 0.09, yd - 0.045, d / 2], zd, scale3(trim, 1));
    const knobs = Math.max(2, g.knobs ?? 5);
    for (let i = 0; i < knobs; i++) {
      const c = [lerp(-w / 2 + 0.1, w / 2 - 0.1, i / (knobs - 1)), (ys + h - 0.02) / 2];
      const z1 = Math.min(d / 2 - 0.004, zb + 0.032);
      band(m, 'z', c, [0.024, zb + 0.01], [0.021, z1], 8, 'round', scale3(trim, 0.8));
      band(m, 'z', c, [0, z1], [0.021, z1], 8, 'axis', scale3(trim, 1.1));
    }
    return m;
  }

  // A washing machine: the control strip across the top of the front, the round door under it.
  const ys = h - 0.16;
  const zs = zb + 0.008;
  box(m, [-w / 2 + 0.004, ys, zb], [w / 2 - 0.004, h - 0.012, zs], enamel(panelC, 1), ['nz']);
  const cy = (foot + ys) / 2 + 0.01;
  const rad = Math.min(w * 0.37, (ys - foot) * 0.44);
  const seg = fine ? 16 : 8;
  const c = [0, cy];
  const zr = d / 2;
  const rimC = (p) => scale3(trim, lerp(0.75, 1.15, (p[1] - cy + rad) / (rad * 2)));
  const pane = (p) => scale3(dark, lerp(0.7, 2.2, clamp01((p[1] - cy) / rad * 0.5 + 0.5 - (p[0] / rad) * 0.25)));
  band(m, 'z', c, [rad, zb], [rad, zr], seg, 'round', rimC);
  if (!fine) {
    band(m, 'z', c, [rad * 0.7, zr], [rad, zr], seg, 'axis', rimC);
    band(m, 'z', c, [0, zr], [rad * 0.7, zr], seg, 'axis', pane);
    return m;
  }
  // The rim's face, the bowl of the glass dished in from it.
  band(m, 'z', c, [rad * 0.74, zr], [rad, zr], seg, 'axis', rimC);
  band(m, 'z', c, [rad * 0.74, zr], [rad * 0.6, zr - proud * 0.6], seg, 'in', scale3(trim, 0.5));
  band(m, 'z', c, [0, zr - proud * 0.6], [rad * 0.6, zr - proud * 0.6], seg, 'axis', pane);
  // The door's catch, on the rim's side.
  box(m, [rad - 0.004, cy - 0.05, zb], [rad + 0.03, cy + 0.05, zr - 0.006], scale3(trim, 0.7), ['nz', 'nx']);
  // On the strip: the soap drawer, a dial, a window and its buttons.
  const ym = (ys + h - 0.012) / 2;
  box(m, [-w / 2 + 0.03, ym - 0.045, zs], [-w / 2 + 0.03 + w * 0.28, ym + 0.045, zs + 0.006], enamel(paint, 1.04), ['nz']);
  const dc = [w / 2 - 0.1, ym];
  band(m, 'z', dc, [0.04, zs], [0.036, zs + 0.022], 10, 'round', scale3(trim, 0.85));
  band(m, 'z', dc, [0, zs + 0.022], [0.036, zs + 0.022], 10, 'axis', scale3(trim, 1.15));
  box(m, [-0.02, ym - 0.022, zs], [0.1, ym + 0.022, zs + 0.003], glass(ym - 0.022, ym + 0.05), ['nz']);
  for (let i = 0; i < 3; i++) box(m, [0.125 + i * 0.034, ym - 0.011, zs], [0.147 + i * 0.034, ym + 0.011, zs + 0.006], scale3(trim, 1), ['nz']);
  return m;
}
