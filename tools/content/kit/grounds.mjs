// Grounds pieces (St. John's step 4; docs/map-briefs/st_johns, PLAN_2026-11-12.md §3.2 C and §3.5): the entrance's
// fieldstone cairn and its kerbed island bed, fieldstone gate piers (one with a caged globe lamp) and low fieldstone
// walls, a black lamp post with a banner, a dark marker stone, a stone bench. All generated here from seeds: our own
// shapes and colours, nothing downloaded, nothing drawn from a photograph; banners and the marker carry no school mark.
//
// Fieldstone (`fieldFace`): rows of rounded stones of mixed colour laid on a face, each a stone face standing a few
// centimetres proud of a dark mortar ground and bevelled back to it at the nearest level; lighter levels lay the
// stones flat on the ground (no bevels), the farthest only the face's ground in the stones' mean colour.
//
// Every piece stands on y = 0 centred on its footprint, its front +z. Collision: the walls, piers, marker and bench
// as their box; the cairn, the lamp pier, the lamp post and the island bed as boxes written here (stepped or the solid
// part only). Nothing glows or blinks: the globe and the lantern are paint (a light entity beside them lights them).

import { rng } from '../env/rng.mjs';
import { Mesh, bar, box, cyl, groundShade, hex, lathe, mix3, ovalDisc, ovalShell, quadN, scale3, standIn, triN, wirePanel } from './geom.mjs';

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (p, q, t) => p + (q - p) * t;

/** A stone colour from the look's palette, jittered. */
function stoneTone(r, look) {
  const pal = (look.stones ?? ['#8d877c']).map(hex);
  const c = pal[r.int(0, pal.length - 1)];
  return scale3(c, 1 + r.range(-1, 1) * (look.jitter ?? 0.1));
}

/**
 * Fieldstone laid on a face. The face is a trapezoid: `at(s, t)` gives its point at s ∈ [−1, 1] across and t ∈ [0, 1]
 * up; `n` is its outward normal. Rows `row` m high ([min, max]), stones `wide` m ([min, max]); `H` the face's height,
 * `W(t)` its width at t. `skip(s, t)`: leave a stone out (a niche). Level 0: proud stones with bevels; 1: flat stones;
 * 2: the ground only.
 */
function fieldFace(m, r, look, { at, n, H, W, row = [0.26, 0.4], wide = [0.3, 0.6], proud = 0.04, level, skip }) {
  const mortar = scale3(hex(look.mortar ?? '#4a4640'), 1);
  const a = at(-1, 0);
  const b = at(1, 0);
  const c = at(1, 1);
  const d = at(-1, 1);
  if (level >= 2) {
    quadN(m, a, b, c, d, n, mix3(stoneTone(r, look), mortar, 0.2));
    return;
  }
  quadN(m, a, b, c, d, n, mortar);
  const gap = 0.018;
  let t0 = 0;
  while (t0 < 0.999) {
    const h = Math.min(1 - t0, r.range(row[0], row[1]) / H);
    const t1 = 1 - t0 - h < (row[0] * 0.6) / H ? 1 : t0 + h;
    const tm = (t0 + t1) / 2;
    const w = W(tm);
    let s0 = -1;
    let first = true;
    while (s0 < 0.999) {
      const sw = (2 * r.range(first ? wide[0] * 0.5 : wide[0], wide[1])) / w;
      first = false;
      const s1 = 1 - s0 - sw < (wide[0] * 1.2) / w ? 1 : s0 + sw;
      const sm = (s0 + s1) / 2;
      if (!skip?.(sm, tm)) {
        const gs = (2 * gap) / w;
        const gt = gap / H;
        const [sa, sb, ta, tb] = [s0 + gs, s1 - gs, t0 + gt, t1 - gt];
        const col = stoneTone(r, look);
        if (level === 0) {
          // A pillow: the stone's foot on the ground, its face smaller and proud, the sides sloping between (shared
          // corners, so it shades round).
          const lift = proud * r.range(0.65, 1);
          const bs = Math.min(0.35 * (sb - sa), (0.07 * 2) / w);
          const bt = Math.min(0.35 * (tb - ta), 0.07 / H);
          const foot = [[sa, ta], [sb, ta], [sb, tb], [sa, tb]].map(([u, t]) => at(u, t));
          const face = [[sa + bs, ta + bt], [sb - bs, ta + bt], [sb - bs, tb - bt], [sa + bs, tb - bt]].map(([u, t]) => add3(at(u, t), mul3(n, lift)));
          const mid = mul3(add3(add3(face[0], face[1]), add3(face[2], face[3])), 0.25);
          const vn = (p, k) => {
            const d = [p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]];
            const q = add3(mul3(n, k), d);
            const L = Math.hypot(...q) || 1;
            return q.map((v) => v / L);
          };
          const ids = [...foot.map((p) => m.vertex(p, vn(p, 0.25), [0, 0], scale3(col, 0.7))), ...face.map((p) => m.vertex(p, vn(p, 1.6), [0, 0], col))];
          const front = (i, j, k) => {
            // Wind each triangle to face out of the face.
            const [A, B, C] = [i, j, k].map((x) => [m.P[x * 3], m.P[x * 3 + 1], m.P[x * 3 + 2]]);
            const c = [(B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])];
            if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0) m.tri(i, k, j);
            else m.tri(i, j, k);
          };
          front(ids[4], ids[5], ids[6]);
          front(ids[4], ids[6], ids[7]);
          for (let k = 0; k < 4; k++) {
            const k2 = (k + 1) % 4;
            front(ids[k], ids[k2], ids[4 + k2]);
            front(ids[k], ids[4 + k2], ids[4 + k]);
          }
        } else {
          const P = (u, t) => add3(at(u, t), mul3(n, 0.004));
          quadN(m, P(sa, ta), P(sb, ta), P(sb, tb), P(sa, tb), n, col);
        }
      }
      s0 = s1;
    }
    t0 = t1;
  }
}

/** The four faces of a square shaft, half width `hw(y)`, from y0 to y1, round its axis; `skip` for the +z face. */
function fieldShaft(m, r, look, y0, y1, hw0, hw1, level, opts = {}) {
  const H = y1 - y0;
  const hw = (t) => lerp(hw0, hw1, t);
  const faces = [
    [(s, t) => [s * hw(t), y0 + t * H, hw(t)], [0, (hw0 - hw1) / H, 1]],
    [(s, t) => [-s * hw(t), y0 + t * H, -hw(t)], [0, (hw0 - hw1) / H, -1]],
    [(s, t) => [hw(t), y0 + t * H, -s * hw(t)], [1, (hw0 - hw1) / H, 0]],
    [(s, t) => [-hw(t), y0 + t * H, s * hw(t)], [-1, (hw0 - hw1) / H, 0]],
  ];
  faces.forEach(([at, nn], i) => {
    const L = Math.hypot(...nn);
    fieldFace(m, r, look, { at, n: nn.map((v) => v / L), H, W: (t) => 2 * hw(t), level, skip: i === 0 ? opts.skipFront : undefined, ...(opts.face ?? {}) });
  });
}

// ---------------------------------------------------------------- the cairn

/**
 * The entrance's fieldstone cairn: a dressed plinth, a shaft of rounded field stones tapering from `foot` to `head`
 * (m across) up to `shaft` m, a pointed-arched niche with dressed edges near the top of the +z face, a dressed cap.
 * Settings `g`: `plinth` (height), `foot`, `head`, `shaft` (the shaft's top), `niche` ([width, sill, crown]).
 * `look`: `stones` (hex list), `mortar`, `dressed` (the plinth, cap and niche edges), `niche` (the recess), `jitter`.
 * Collides as the plinth and three steps up the shaft.
 */
export function cairnMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const r = rng(seed);
  const m = new Mesh();
  const dressed = hex(look.dressed ?? '#b9b2a2');
  const P = g.plinth;
  const top = g.shaft;
  const hw0 = g.foot / 2;
  const hw1 = g.head / 2;
  const hw = (y) => lerp(hw0, hw1, (y - P) / (top - P));
  if (level === 0) {
    const steps = [P, lerp(P, top, 0.38), lerp(P, top, 0.7), top];
    m.boxes = [[-w / 2, 0, -w / 2, w / 2, P, w / 2], ...[0, 1, 2].map((k) => {
      const e = hw(steps[k + 1]) - 0.02;
      return [-e, steps[k], -e, e, steps[k + 1], e];
    })];
  }
  // The plinth: two dressed courses, the upper set back.
  box(m, [-w / 2, 0, -w / 2], [w / 2, P * 0.55, w / 2], scale3(dressed, 0.92), ['ny']);
  box(m, [-w / 2 + 0.08, P * 0.55, -w / 2 + 0.08], [w / 2 - 0.08, P, w / 2 - 0.08], dressed, ['ny']);
  // The niche on the +z face, in face coordinates: s ∈ [−nw, nw] of the half width there, t up the shaft.
  const [nw, sill, crown] = g.niche;
  const H = top - P;
  const tS = (sill - P) / H;
  const tC = (crown - P) / H;
  const inNiche = (s, t) => {
    const half = nw / 2 + 0.2;
    return t > tS - 0.25 / H && t < tC + 0.2 / H && Math.abs(s * hw(P + t * H)) < half;
  };
  fieldShaft(m, r, look, P, top, hw0, hw1, level, { skipFront: inNiche, face: { row: [0.3, 0.46], wide: [0.4, 0.72] } });
  if (level < 2) {
    // The niche: a dark recess under a pointed arch, its outline dressed stone.
    const slope = (hw0 - hw1) / H;
    const face = (x, y, inset) => [x, y, hw(y) - inset];
    const spring = lerp(sill, crown, 0.55);
    // A pointed arch: two arcs, each centred on the springing line on the far side of the middle, meeting at the crown.
    const half = nw / 2;
    const Hc = crown - spring;
    const R = (Hc * Hc + half * half) / (2 * half);
    const c = R - half;
    const N = level === 0 ? 5 : 2;
    const a1 = Math.acos(Math.min(1, c / R));
    const arc = [];
    for (let k = 0; k <= N; k++) {
      const ang = (a1 * k) / N;
      arc.push([-c + Math.cos(ang) * R, spring + Math.sin(ang) * R]);
    }
    // Round the outline: the sill, up the right side, over the crown, down the left (the right arc mirrored).
    const ring = [[-half, sill], [half, sill], ...arc, ...arc.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
    const fn = [0, slope, 1];
    const L = Math.hypot(...fn);
    const nrm = fn.map((v) => v / L);
    const recess = scale3(hex(look.niche ?? '#2c2925'), 1);
    const depth = 0.22;
    const cxy = [0, lerp(sill, crown, 0.45)];
    const back = (p) => face(p[0] * 0.92, p[1], depth);
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k];
      const q = ring[(k + 1) % ring.length];
      triN(m, back(cxy), back(p), back(q), nrm, recess);
      // The reveal: from the face into the recess.
      const out = [-(p[0] + q[0]) / 2, -((p[1] + q[1]) / 2 - cxy[1]), 0];
      quadN(m, face(p[0], p[1], -0.01), face(q[0], q[1], -0.01), back(q), back(p), out, scale3(dressed, 0.6));
      // The dressed surround: a band round the outline, proud of the stones.
      const grow = (v, k2) => [cxy[0] + (v[0] - cxy[0]) * k2, cxy[1] + (v[1] - cxy[1]) * k2];
      const po = grow(p, 1.28);
      const qo = grow(q, 1.28);
      quadN(m, face(p[0], p[1], -0.045), face(q[0], q[1], -0.045), face(qo[0], qo[1], -0.045), face(po[0], po[1], -0.045), nrm, dressed);
    }
  }
  // The cap: a dressed slab and a low pyramid to the top.
  const ct = top + 0.12;
  box(m, [-hw1 - 0.06, top, -hw1 - 0.06], [hw1 + 0.06, ct, hw1 + 0.06], dressed, ['ny']);
  const apex = [0, h, 0];
  const e = hw1 + 0.02;
  const cs = [[-e, ct, e], [e, ct, e], [e, ct, -e], [-e, ct, -e]];
  for (let k = 0; k < 4; k++) triN(m, apex, cs[k], cs[(k + 1) % 4], [cs[k][0] + cs[(k + 1) % 4][0], 0.5, cs[k][2] + cs[(k + 1) % 4][2]], scale3(dressed, 0.95));
  return m;
}

// ---------------------------------------------------------------- piers and low walls

/**
 * A fieldstone gate pier: a square shaft of field stones under a dressed cap, a bronze plaque on its +z face; with
 * `lamp`, a round globe in an iron cage on a short iron stem on the cap. Settings `g`: `pier` (the shaft's top),
 * `cap` (the cap's height), `plaque` ([w, h, y]), `lamp` (the globe's radius, or 0). `look`: `stones`, `mortar`,
 * `dressed`, `bronze`, `iron`, `globe`, `jitter`. Without a lamp it collides as its box; with one, as the pier and a
 * box round the lamp.
 */
export function pierMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const r = rng(seed);
  const m = new Mesh();
  const dressed = hex(look.dressed ?? '#b9b2a2');
  const capTop = g.pier + g.cap;
  const sw = w / 2 - 0.05;
  if (level >= 2) {
    box(m, [-sw, 0, -sw], [sw, g.pier, sw], mix3(stoneTone(r, look), hex(look.mortar ?? '#4a4640'), 0.2), ['ny']);
    box(m, [-w / 2, g.pier, -w / 2], [w / 2, capTop, w / 2], dressed, ['ny']);
    if (g.lamp) box(m, [-g.lamp, capTop, -g.lamp], [g.lamp, h, g.lamp], hex(look.globe ?? '#efe6cf'), ['ny']);
    return m;
  }
  if (level === 0 && g.lamp) m.boxes = [[-w / 2, 0, -w / 2, w / 2, capTop, w / 2], [-g.lamp - 0.04, capTop, -g.lamp - 0.04, g.lamp + 0.04, h, g.lamp + 0.04]];
  const plaque = g.plaque;
  const pTop = plaque[2] + plaque[1] / 2 + 0.05;
  const pBot = plaque[2] - plaque[1] / 2 - 0.05;
  fieldShaft(m, r, look, 0, g.pier, sw, sw, level, { skipFront: (s, t) => Math.abs(s * sw) < plaque[0] / 2 + 0.05 && t * g.pier > pBot && t * g.pier < pTop });
  // The cap: a dressed slab with a weathered top.
  box(m, [-w / 2, g.pier, -w / 2], [w / 2, capTop - 0.04, w / 2], dressed);
  box(m, [-w / 2 + 0.05, capTop - 0.04, -w / 2 + 0.05], [w / 2 - 0.05, capTop, w / 2 - 0.05], scale3(dressed, 1.05), ['ny']);
  // The plaque: a bronze plate (blank: raised border and lines, no words) on a dressed panel.
  const pz = sw;
  box(m, [-plaque[0] / 2 - 0.05, pBot, pz - 0.02], [plaque[0] / 2 + 0.05, pTop, pz + 0.01], dressed, ['ny', 'nz']);
  const bronze = hex(look.bronze ?? '#6e5a34');
  box(m, [-plaque[0] / 2, plaque[2] - plaque[1] / 2, pz], [plaque[0] / 2, plaque[2] + plaque[1] / 2, pz + 0.025], bronze, ['nz']);
  if (level === 0)
    for (let k = 0; k < 3; k++) {
      const y = plaque[2] + plaque[1] * (0.22 - k * 0.2);
      box(m, [-plaque[0] * 0.32, y - 0.008, pz + 0.025], [plaque[0] * 0.32, y + 0.008, pz + 0.032], scale3(bronze, 1.5), ['nz']);
    }
  if (g.lamp) {
    const iron = hex(look.iron ?? '#1e1f21');
    const R = g.lamp;
    const y0 = capTop;
    const gy = y0 + 0.16 + R;
    const seg = level === 0 ? 12 : 6;
    // A stem with a collar, the globe, the cage's ribs and rings, a cap and finial.
    lathe(m, [[0.09, y0], [0.07, y0 + 0.06], [0.045, y0 + 0.08], [0.045, y0 + 0.14], [0.08, y0 + 0.16]], seg, () => iron);
    const globe = hex(look.globe ?? '#efe6cf');
    const rows = level === 0 ? 7 : 4;
    const prof = Array.from({ length: rows + 1 }, (_, k) => {
      const a = -Math.PI / 2 + (Math.PI * k) / rows;
      return [Math.max(0.01, Math.cos(a) * R * 0.97), gy + Math.sin(a) * R * 0.97];
    });
    lathe(m, prof, seg, (p) => scale3(globe, 0.85 + 0.15 * ((p[1] - gy) / R + 1) / 2));
    const ribs = level === 0 ? 6 : 4;
    for (let k = 0; k < ribs; k++) {
      const a = (k / ribs) * Math.PI * 2;
      const pts = Array.from({ length: 5 }, (_, j) => {
        const b = -Math.PI / 2 + (Math.PI * j) / 4;
        const rr = Math.cos(b) * R + 0.015;
        return [Math.cos(a) * rr, gy + Math.sin(b) * (R + 0.015), Math.sin(a) * rr];
      });
      for (let j = 0; j < 4; j++) bar(m, pts[j], pts[j + 1], 0.018, iron);
    }
    if (level === 0) lathe(m, [[R + 0.02, gy - 0.012], [R + 0.025, gy], [R + 0.02, gy + 0.012]], seg, () => iron);
    lathe(m, [[0.1, gy + R - 0.02], [0.12, gy + R + 0.02], [0.03, gy + R + 0.06], [0.03, h - 0.06], [0.04, h - 0.03], [0.005, h]], seg, () => iron);
  }
  return m;
}

/**
 * A low fieldstone wall: rounded field stones on both faces and the ends, a cap of rough flat stones. Settings `g`:
 * `cap` (the cap's thickness). `look`: `stones`, `mortar`, `cap` (hex), `jitter`. Collides as its box.
 */
export function fieldWallMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const r = rng(seed);
  const capC = hex(look.cap ?? '#9d968a');
  if (level >= 2) return standIn(size, capC, mix3(stoneTone(r, look), hex(look.mortar ?? '#4a4640'), 0.2));
  const m = new Mesh();
  const X = w / 2;
  const Z = d / 2;
  const y1 = h - g.cap;
  const inset = 0.045;
  const [xa, xb, za, zb] = [-X + inset, X - inset, -Z + inset, Z - inset];
  const faces = [
    [(s, t) => [s * (xb - 0) , t * y1, zb], [0, 0, 1], xb * 2],
    [(s, t) => [-s * xb, t * y1, za], [0, 0, -1], xb * 2],
    [(s, t) => [xb, t * y1, -s * zb], [1, 0, 0], zb * 2],
    [(s, t) => [xa, t * y1, s * zb], [-1, 0, 0], zb * 2],
  ];
  for (const [at, n, W] of faces) fieldFace(m, r, look, { at, n, H: y1, W: () => W, row: [0.2, 0.32], wide: [0.25, 0.5], level });
  // The cap: flat stones edge to edge, each its own tone and a few millimetres of height, over a dark bed.
  box(m, [xa, y1 - 0.01, za], [xb, y1 + 0.01, zb], hex(look.mortar ?? '#4a4640'), ['ny']);
  let x = -X;
  while (x < X - 0.01) {
    const sw = Math.min(X - x, r.range(0.35, 0.7));
    const x1 = X - (x + sw) < 0.2 ? X : x + sw;
    const top = x === -X ? h : h - r.range(0, 0.025);
    box(m, [x === -X ? x : x + 0.008, y1, -Z], [x1 === X ? X : x1 - 0.008, top, Z], scale3(capC, 1 + r.range(-1, 1) * 0.08), ['ny']);
    x = x1;
  }
  return m;
}

// ---------------------------------------------------------------- the lamp post with a banner

/**
 * A black lamp post with a lantern head and a banner arm: a fluted base, a slim round shaft, a four-sided lantern
 * under a cap and finial at the top; an arm at `arm` m reaching +x carries a banner of two colours with a chevron
 * (plain colours of the map's own, no mark). Settings `g`: `base` (its height), `shaft` (the lantern's foot),
 * `arm` (the arm's height), `banner` ([x0, x1, y0]: its sides and foot). `look`: `iron`, `glass` (the lantern's
 * panes), `banner` (hex), `band` (hex: the chevron and border), `trim` (hex, optional: a thin edge round the sides and
 * foot; none when unset). Collides as the post (its base's box to the top).
 */
export function bannerPostMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const m = new Mesh();
  const iron = hex(look.iron ?? '#1b1c1e');
  const seg = level === 0 ? 10 : level === 1 ? 6 : 4;
  const b = g.base;
  if (level === 0) m.boxes = [[-0.17, 0, -0.17, 0.17, h, 0.17]];
  if (level >= 2) {
    box(m, [-0.12, 0, -0.12], [0.12, h, 0.12], iron, ['ny']);
    const [bx0, bx1, by0] = g.banner;
    for (const side of [1, -1]) quadN(m, [bx0, by0, side * 0.01], [bx1, by0, side * 0.01], [bx1, g.arm, side * 0.01], [bx0, g.arm, side * 0.01], [0, 0, side], hex(look.banner ?? '#7b2027'));
    return m;
  }
  box(m, [-0.17, 0, -0.17], [0.17, b * 0.25, 0.17], iron, ['ny']);
  lathe(m, [[0.14, b * 0.25], [0.12, b * 0.6], [0.09, b * 0.8], [0.07, b], [0.055, b + 0.05], [0.05, g.shaft - 0.15], [0.07, g.shaft - 0.08], [0.06, g.shaft]], seg, () => iron);
  // The lantern: a tapered four-sided case of glass between iron posts, a cap and a finial.
  const L0 = g.shaft;
  const L1 = h - 0.32;
  const lw0 = 0.13;
  const lw1 = 0.19;
  const glass = hex(look.glass ?? '#d9cfb4');
  const corners = (y, s) => [[-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]];
  const lo = corners(L0, lw0);
  const hi = corners(L1, lw1);
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4;
    const out = [lo[k][0] + lo[k2][0], 0, lo[k][2] + lo[k2][2]];
    quadN(m, lo[k], lo[k2], hi[k2], hi[k], out, glass);
    if (level < 2) bar(m, lo[k], hi[k], 0.025, iron);
  }
  box(m, [-lw0 - 0.01, L0 - 0.03, -lw0 - 0.01], [lw0 + 0.01, L0, lw0 + 0.01], iron);
  const capPts = corners(L1, lw1 + 0.05);
  box(m, [-lw1 - 0.05, L1, -lw1 - 0.05], [lw1 + 0.05, L1 + 0.03, lw1 + 0.05], iron);
  const apex = [0, h - 0.1, 0];
  for (let k = 0; k < 4; k++) triN(m, apex, capPts[k].map((v, i) => (i === 1 ? L1 + 0.03 : v)), capPts[(k + 1) % 4].map((v, i) => (i === 1 ? L1 + 0.03 : v)), [capPts[k][0] + capPts[(k + 1) % 4][0], 0.6, capPts[k][2] + capPts[(k + 1) % 4][2]], iron);
  lathe(m, [[0.02, h - 0.1], [0.035, h - 0.06], [0.004, h]], Math.max(4, seg / 2), () => iron);
  // The arm and a brace, and the banner hung from a rod under it.
  const [bx0, bx1, by0] = g.banner;
  const ay = g.arm;
  bar(m, [0.04, ay, 0], [bx1 + 0.04, ay, 0], 0.04, iron, { ends: true });
  bar(m, [0.04, ay - 0.35, 0], [bx0 + 0.15, ay, 0], 0.025, iron);
  const banner = hex(look.banner ?? '#7b2027');
  const band = hex(look.band ?? '#c9a54a');
  const rodY = ay - 0.08;
  bar(m, [bx0 - 0.03, rodY, 0], [bx1 + 0.03, rodY, 0], 0.02, iron, { ends: true });
  for (const x of [bx0 + 0.02, bx1 - 0.02]) bar(m, [x, rodY, 0], [x, ay - 0.02, 0], 0.012, iron);
  // The cloth both ways: a field, a border band at its foot and a chevron (flat, a hair proud of the field each side).
  const yTop = rodY - 0.02;
  const yFoot = by0;
  for (const side of [1, -1]) {
    const z = side * 0.006;
    const zz = side * 0.009;
    quadN(m, [bx0, yFoot, z], [bx1, yFoot, z], [bx1, yTop, z], [bx0, yTop, z], [0, 0, side], banner);
    if (level < 2) {
      quadN(m, [bx0, yFoot, zz], [bx1, yFoot, zz], [bx1, yFoot + 0.09, zz], [bx0, yFoot + 0.09, zz], [0, 0, side], band);
      const mx = (bx0 + bx1) / 2;
      const cy = lerp(yFoot, yTop, 0.45);
      const ww = (bx1 - bx0) / 2 - 0.05;
      const t = 0.07;
      quadN(m, [mx - ww, cy, zz], [mx, cy + 0.32, zz], [mx, cy + 0.32 + t, zz], [mx - ww, cy + t, zz], [0, 0, side], band);
      quadN(m, [mx, cy + 0.32, zz], [mx + ww, cy, zz], [mx + ww, cy + t, zz], [mx, cy + 0.32 + t, zz], [0, 0, side], band);
      // `trim`: a thin edge down both sides and along the foot (a variant without one has none: its look unchanged).
      if (look.trim) {
        const trim = hex(look.trim);
        const e = 0.03;
        const z3 = side * 0.011;
        quadN(m, [bx0, yFoot, z3], [bx0 + e, yFoot, z3], [bx0 + e, yTop, z3], [bx0, yTop, z3], [0, 0, side], trim);
        quadN(m, [bx1 - e, yFoot, z3], [bx1, yFoot, z3], [bx1, yTop, z3], [bx1 - e, yTop, z3], [0, 0, side], trim);
        quadN(m, [bx0, yFoot, z3], [bx1, yFoot, z3], [bx1, yFoot + e, z3], [bx0, yFoot + e, z3], [0, 0, side], trim);
      }
    }
  }
  void w;
  return m;
}

// ---------------------------------------------------------------- marker stone, bench

/**
 * A dark polished marker stone on a low base: its top sloped back, a border and a plain star cut into its face
 * (lighter, a hair proud). Settings `g`: `base` (the base's height), `slope` (how much lower the back edge is).
 * `look`: `stone`, `cut` (the cut lines), `base`. Collides as its box.
 */
export function markerMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const stone = hex(look.stone ?? '#2a2b2e');
  const baseC = hex(look.base ?? '#6c6a66');
  if (level >= 2) return standIn(size, scale3(stone, 1.2), stone);
  const m = new Mesh();
  const X = w / 2;
  const Z = d / 2;
  const b = g.base;
  box(m, [-X, 0, -Z], [X, b, Z], baseC, ['ny']);
  const sx = X - 0.06;
  const sz = Z - 0.06;
  const yb = h - g.slope;
  // The block: sides, a sloped top (high at the front).
  const A = [[-sx, b, sz], [sx, b, sz], [sx, h, sz], [-sx, h, sz]];
  quadN(m, A[0], A[1], A[2], A[3], [0, 0, 1], stone);
  quadN(m, [-sx, b, -sz], [sx, b, -sz], [sx, yb, -sz], [-sx, yb, -sz], [0, 0, -1], scale3(stone, 0.9));
  for (const s of [-1, 1]) quadN(m, [s * sx, b, -sz], [s * sx, b, sz], [s * sx, h, sz], [s * sx, yb, -sz], [s, 0, 0], scale3(stone, 0.95));
  quadN(m, [-sx, h, sz], [sx, h, sz], [sx, yb, -sz], [-sx, yb, -sz], [0, 1, 0.3], scale3(stone, 1.2));
  if (level < 2) {
    const cut = hex(look.cut ?? '#8c8b86');
    const z = sz + 0.003;
    const fr = [[-sx + 0.06, b + 0.06], [sx - 0.06, b + 0.06], [sx - 0.06, h - 0.06], [-sx + 0.06, h - 0.06]];
    for (let k = 0; k < 4; k++) {
      const p = fr[k];
      const q = fr[(k + 1) % 4];
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const L = Math.hypot(dx, dy);
      const nx = (-dy / L) * 0.012;
      const ny = (dx / L) * 0.012;
      quadN(m, [p[0] - nx, p[1] - ny, z], [q[0] - nx, q[1] - ny, z], [q[0] + nx, q[1] + ny, z], [p[0] + nx, p[1] + ny, z], [0, 0, 1], cut);
    }
    // A five-pointed star in the middle (the nearest level only).
    if (level > 0) return m;
    const cy = (b + h) / 2;
    const R = Math.min(sx, (h - b) / 2) * 0.42;
    const pts = Array.from({ length: 10 }, (_, k) => {
      const a = Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? R * 0.4 : R;
      return [Math.cos(a) * rr, cy + Math.sin(a) * rr, z];
    });
    for (let k = 0; k < 10; k++) triN(m, [0, cy, z], pts[k], pts[(k + 1) % 10], [0, 0, 1], cut);
  }
  return m;
}

/**
 * A stone bench: a dressed slab on two plinths. Settings `g`: `slab` (its thickness), `leg` (a plinth's width along
 * x), `inset` (the plinths in from the ends). `look`: `stone`, `jitter`. Collides as its box.
 */
export function stoneBenchMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const stone = hex(look.stone ?? '#b3ac9d');
  if (level >= 2) return standIn(size, scale3(stone, 1.06), scale3(stone, 0.9));
  const m = new Mesh();
  const X = w / 2;
  const Z = d / 2;
  const ys = h - g.slab;
  box(m, [-X, ys, -Z], [X, h, Z], (p, n) => scale3(stone, n[1] > 0.5 ? 1.06 : 0.92));
  for (const s of [-1, 1]) {
    const x0 = s * (X - g.inset);
    const x1 = x0 - s * g.leg;
    box(m, [Math.min(x0, x1), 0, -Z + 0.06], [Math.max(x0, x1), ys, Z - 0.06], scale3(stone, 0.86), ['ny', 'py']);
  }
  if (level === 0) box(m, [-X + 0.02, ys - 0.02, -Z + 0.02], [X - 0.02, ys, Z - 0.02], scale3(stone, 0.6), ['py', 'ny']);
  return m;
}

// ---------------------------------------------------------------- the island bed

/**
 * The cairn's island: an oval bed in the drive, a concrete kerb round a low wall of field stones, mulch inside with
 * clumps of flowers and low shrubs (the cairn stands in its middle: a separate prop). It fills `size` (the oval's
 * width and length, the wall's height). Settings `g`: `kerb` ([width, height]), `wall` ([width, height]: the wall's
 * height is the size's), `clumps` (how many flower clumps), `clear` (the radius left bare round the middle for the
 * cairn's plinth). `look`: `kerb`, `stones`, `mortar`, `mulch`, `flowers` (hex list), `leaf`, `jitter`. Collides as
 * three boxes stepped round the oval, the wall's height.
 */
export function islandBedMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const r = rng(seed);
  const m = new Mesh();
  const rx = w / 2;
  const rz = d / 2;
  const seg = level === 0 ? 40 : level === 1 ? 20 : 12;
  const [kw, kh] = g.kerb;
  const [ww, wh] = g.wall;
  if (level === 0) m.boxes = [[0.92, 0.42], [0.72, 0.72], [0.42, 0.92]].map(([kx, kz]) => [-rx * kx, 0, -rz * kz, rx * kx, wh, rz * kz]);
  const kerbC = hex(look.kerb ?? '#a7a49c');
  // The kerb: its outer face, its top, and its inner face down to the wall's foot.
  ovalShell(m, [[1, 0], [1, kh]], seg, kerbC, { rx, rz });
  const k1 = 1 - kw / Math.min(rx, rz);
  ovalShell(m, [[1, kh], [k1, kh]], seg, scale3(kerbC, 1.06), { rx, rz });
  // The wall: field stones round the oval (each a facet of its own tone), a rough top.
  const k2 = k1;
  const k3 = k1 - ww / Math.min(rx, rz);
  const tones = Array.from({ length: seg }, () => stoneTone(r, look));
  let s = 0;
  ovalShell(m, [[k2, kh], [k2, wh - 0.04], [k2 * 0.99, wh]], seg, (p) => {
    const a = Math.atan2(p[2] / rz, p[0] / rx);
    const i = Math.floor((((a / (Math.PI * 2)) % 1) + 1) % 1 * seg) % seg;
    return scale3(tones[i], p[1] < kh + 0.05 ? 0.75 : 1);
  }, { rx, rz, smooth: false });
  ovalShell(m, [[k2 * 0.99, wh], [k3, wh]], seg, scale3(hex(look.cap ?? '#9d968a'), 1), { rx, rz, smooth: false });
  ovalShell(m, [[k3, wh], [k3, wh - 0.1]], seg, scale3(hex(look.mortar ?? '#4a4640'), 1), { rx, rz, smooth: false });
  // The mulch, a little under the wall's top.
  const mulch = hex(look.mulch ?? '#4a3426');
  ovalDisc(m, rx * k3, rz * k3, wh - 0.1, seg, (p) => scale3(mulch, 0.9 + 0.2 * ((Math.abs(p[0] * 7.3 + p[2] * 3.1) % 1))), {});
  void s;
  if (level >= 2) return m;
  // Clumps: flowers and low leaf mounds in two rings, clear of the middle.
  const flowers = (look.flowers ?? ['#c23b4a', '#e8c547', '#f2f0e6', '#8a4fa8']).map(hex);
  const leaf = hex(look.leaf ?? '#3f6131');
  const n = level === 0 ? g.clumps : Math.ceil(g.clumps / 3);
  const y0g = wh - 0.1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.range(-0.15, 0.15);
    const k = lerp(g.clear / Math.min(rx, rz) + 0.12, k3 - 0.08, r.range(0.15, 0.95));
    const cx = Math.cos(a) * rx * k;
    const cz = Math.sin(a) * rz * k;
    const cw = r.range(0.18, 0.32);
    const ch = Math.min(r.range(0.15, 0.32), (h - y0g) / 1.0);
    const y0 = wh - 0.1;
    box(m, [cx - cw, y0, cz - cw], [cx + cw, y0 + ch * 0.7, cz + cw], scale3(leaf, r.range(0.8, 1.1)), ['ny']);
    if (level === 0 && i % 3 !== 2) {
      const fc = flowers[r.int(0, flowers.length - 1)];
      box(m, [cx - cw * 0.7, y0 + ch * 0.7, cz - cw * 0.7], [cx + cw * 0.7, y0 + ch, cz + cw * 0.7], fc, ['ny']);
    }
  }
  return m;
}

// ---------------------------------------------------------------- the guard post (St. John's step 4b: the Cadet Post)

/**
 * A small stone guard post by a gate: a dressed base course, walls of thin layered stone (lannonstone) with a wide
 * window to the front (+z), a window on the −x side and a door on the +x side, a dressed lintel band round the top, a
 * white fascia under a low hipped slate roof that overhangs the walls on every side. The windows are dark glass in
 * white frames (paint: nothing glows). Settings `g`: `walls` ([half width, half depth] of the walls), `base` (the
 * base course's height), `sill` (the windows' sill), `head` (their head and the door's), `band` (the lintel band's
 * top), `eave` (the fascia's top), `door` ([z0, z1] on the +x face), `side` ([z0, z1]: the −x window). `look`:
 * `stones` (hex list), `mortar`, `dressed`, `fascia`, `roof`, `glass`, `frame`, `door`, `jitter`. Collides as its box.
 */
export function guardPostMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const r = rng(seed);
  const m = new Mesh();
  const X = w / 2;
  const Z = d / 2;
  const [wx, wz] = g.walls;
  const dressed = hex(look.dressed ?? '#c9c0ad');
  const fascia = hex(look.fascia ?? '#e9e6dd');
  const roof = hex(look.roof ?? '#3d4248');
  const glass = hex(look.glass ?? '#2f3d47');
  const frame = hex(look.frame ?? '#ece9e1');
  const doorC = hex(look.door ?? '#2d4a3a');
  const { base, sill, head, band, eave } = g;
  const [dz0, dz1] = g.door;
  const [sz0, sz1] = g.side;
  const fx = wx - 0.35; // the front window's half width
  // The openings on each face, in the face's own (s across, y up) terms; s runs along the face's `along` axis.
  const faces = [
    { n: [0, 0, 1], at: (s, y) => [s, y, wz], half: wx, holes: [[-fx, fx, sill, head]] },
    { n: [0, 0, -1], at: (s, y) => [-s, y, -wz], half: wx, holes: [] },
    { n: [1, 0, 0], at: (s, y) => [wx, y, -s], half: wz, holes: [[-dz1, -dz0, base, head]] },
    { n: [-1, 0, 0], at: (s, y) => [-wx, y, s], half: wz, holes: [[sz0, sz1, sill, head]] },
  ];
  // The base course: a dressed plinth a little proud of the walls.
  const bp = 0.05;
  box(m, [-wx - bp, 0, -wz - bp], [wx + bp, base, wz + bp], (p, n) => scale3(dressed, n[1] > 0.5 ? 1.04 : 0.9 * groundShade(p[1], 0.3, 0.8)), ['ny']);
  // The walls between base and band: laid stone, the openings left out.
  const H = band - base;
  for (const f of faces) {
    const inHole = (s, y) => f.holes.some(([a, b, y0, y1]) => s > a - 0.02 && s < b + 0.02 && y > y0 - 0.02 && y < y1 + 0.02);
    const at = (s, t) => f.at(s * f.half, base + t * H);
    if (level >= 2) {
      // Far: the face's ground, the openings as dark panels on it.
      quadN(m, at(-1, 0), at(1, 0), at(1, 1), at(-1, 1), f.n, mix3(stoneTone(r, look), hex(look.mortar ?? '#4a4640'), 0.2));
      for (const [a, b, y0, y1] of f.holes) {
        const o = f.n.map((v) => v * 0.01);
        const P = (s, y) => add3(f.at(s, y), o);
        quadN(m, P(a, y0), P(b, y0), P(b, y1), P(a, y1), f.n, f === faces[2] ? doorC : glass);
      }
      continue;
    }
    fieldFace(m, r, look, { at, n: f.n, H, W: () => 2 * f.half, row: [0.12, 0.22], wide: [0.35, 0.8], proud: 0.025, level, skip: (s, t) => inHole(s * f.half, base + t * H) });
    // Each opening: a recessed panel (glass or the door), a dressed surround standing a little proud, glazing bars.
    for (const [a, b, y0, y1] of f.holes) {
      const isDoor = f === faces[2];
      const back = f.n.map((v) => v * -0.06);
      const P = (s, y, o = back) => add3(f.at(s, y), o);
      quadN(m, P(a, y0), P(b, y0), P(b, y1), P(a, y1), f.n, isDoor ? doorC : glass);
      // The reveal: the opening's sides, head and sill, back to the panel.
      const out = f.n.map((v) => v * 0.03);
      const along = sub3(f.at(1, 0), f.at(0, 0));
      quadN(m, P(a, y0, out), P(a, y1, out), P(a, y1), P(a, y0), along, scale3(dressed, 0.8));
      quadN(m, P(b, y0, out), P(b, y1, out), P(b, y1), P(b, y0), mul3(along, -1), scale3(dressed, 0.8));
      quadN(m, P(a, y1, out), P(b, y1, out), P(b, y1), P(a, y1), [0, -1, 0], scale3(dressed, 0.7));
      if (!isDoor) quadN(m, P(a, y0, out), P(b, y0, out), P(b, y0), P(a, y0), [0, 1, 0], scale3(dressed, 1.05));
      // The surround: a dressed frame 0.1 m wide on the face, round the opening.
      const t = 0.1;
      const strips = isDoor ? [[a - t, a, y0, y1 + t], [b, b + t, y0, y1 + t], [a, b, y1, y1 + t]] : [[a - t, a, y0 - t, y1 + t], [b, b + t, y0 - t, y1 + t], [a, b, y1, y1 + t], [a, b, y0 - t, y0]];
      for (const [s0, s1, v0, v1] of strips) quadN(m, P(s0, v0, out), P(s1, v0, out), P(s1, v1, out), P(s0, v1, out), f.n, dressed);
      if (level > 0) continue;
      // Glazing bars on the windows (painted frames, a hair in front of the glass); the door a glazed top panel.
      const bars = isDoor ? [] : Array.from({ length: Math.max(1, Math.round((b - a) / 0.6)) - 1 }, (_, k) => a + ((k + 1) * (b - a)) / Math.max(1, Math.round((b - a) / 0.6)));
      const front = f.n.map((v) => v * -0.055);
      for (const s of bars) quadN(m, P(s - 0.025, y0, front), P(s + 0.025, y0, front), P(s + 0.025, y1, front), P(s - 0.025, y1, front), f.n, frame);
      if (!isDoor) {
        const ym = y0 + (y1 - y0) * 0.62;
        quadN(m, P(a, ym - 0.025, front), P(b, ym - 0.025, front), P(b, ym + 0.025, front), P(a, ym + 0.025, front), f.n, frame);
      } else {
        const m0 = a + 0.12;
        const m1 = b - 0.12;
        quadN(m, P(m0, y1 - 0.75, front), P(m1, y1 - 0.75, front), P(m1, y1 - 0.15, front), P(m0, y1 - 0.15, front), f.n, glass);
        quadN(m, P(m1 - 0.12, base + 0.95, front), P(m1 - 0.04, base + 0.95, front), P(m1 - 0.04, base + 1.0, front), P(m1 - 0.12, base + 1.0, front), f.n, hex('#b59a52'));
      }
    }
  }
  // The lintel band: dressed stone all round, flush with the base course.
  box(m, [-wx - bp * 0.6, band - 0.0001, -wz - bp * 0.6], [wx + bp * 0.6, band + 0.25, wz + bp * 0.6], (p, n) => scale3(dressed, n[1] < -0.5 ? 0.7 : 1), ['py']);
  // The fascia (white) under the eaves, and its soffit.
  const y0 = band + 0.25;
  box(m, [-X, y0, -Z], [X, eave, Z], (p, n) => (n[1] < -0.5 ? scale3(fascia, 0.75) : fascia));
  // The roof: a low hip from the eaves to a ridge along x.
  const ridge = Math.max(0.05, X - Z);
  const A = [[-X, eave, -Z], [X, eave, -Z], [X, eave, Z], [-X, eave, Z]];
  const hr = level === 0 ? h - 0.035 : h; // the ridge cap's top is the size's
  const R0 = [-ridge, hr, 0];
  const R1 = [ridge, hr, 0];
  const slate = (p, n) => scale3(roof, 0.9 + 0.12 * n[1] + (level === 0 ? 0.04 * Math.sin(p[1] * 40) : 0));
  quadN(m, A[2], A[3], R0, R1, [0, 1, 1], slate);
  quadN(m, A[0], A[1], R1, R0, [0, 1, -1], slate);
  triN(m, A[1], A[2], R1, [1, 1, 0], slate);
  triN(m, A[3], A[0], R0, [-1, 1, 0], slate);
  if (level === 0) {
    // A ridge cap and hip rolls (a shade darker).
    const cap = scale3(roof, 0.7);
    bar(m, R0, R1, 0.07, cap, { ends: true });
    for (const [p, q] of [[A[0], R0], [A[3], R0], [A[1], R1], [A[2], R1]]) bar(m, add3(p, [-Math.sign(p[0]) * 0.06, 0.03, -Math.sign(p[2]) * 0.06]), q, 0.05, cap);
  }
  void d;
  return m;
}

// ---------------------------------------------------------------- the volleyball net and court

/**
 * A volleyball net between two steel posts: the posts on small foot plates at ±(w/2 − plate/2), the net a band `net`
 * m deep hung with its top at `top` m, a white tape along its top and foot and down its sides, a cord grid between
 * (dark), guy cords from the tape's ends to the posts. Settings `g`: `top`, `net` (its depth), `span` (the net's
 * width), `post` (a post's width), `plate`, `cell` (the grid's mesh, m). `look`: `post`, `tape`, `cord`, `plate`.
 * Collides as its posts and the net's band (boxes: a lattice to sight, as the chain-link fence is).
 */
export function volleyNetMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const postC = hex(look.post ?? '#3c5e7c');
  const tape = hex(look.tape ?? '#f1efe8');
  const cord = hex(look.cord ?? '#1f2124');
  const plateC = hex(look.plate ?? '#5b5d60');
  const px = w / 2 - g.plate / 2;
  const hp = g.post / 2;
  const nx = g.span / 2;
  const y1 = g.top;
  const y0 = g.top - g.net;
  if (level === 0) m.boxes = [[-px - g.plate / 2, 0, -d / 2, -px + g.plate / 2, h, d / 2], [px - g.plate / 2, 0, -d / 2, px + g.plate / 2, h, d / 2], [-nx, y0, -0.03, nx, y1, 0.03]];
  for (const s of [-1, 1]) {
    const x = s * px;
    box(m, [x - g.plate / 2, 0, -d / 2], [x + g.plate / 2, 0.02, d / 2], plateC, ['ny']);
    if (level >= 2) box(m, [x - hp, 0.02, -hp], [x + hp, h, hp], postC, ['ny']);
    else cyl(m, 1, 0, x, 0.02, h - 0.03, hp, level === 0 ? 8 : 4, postC, { caps: '1' });
    // A cap on the post's top (fills the height).
    box(m, [x - hp * 1.15, h - 0.03, -hp * 1.15], [x + hp * 1.15, h, hp * 1.15], scale3(postC, 0.8));
  }
  // Fill the size's depth exactly: the foot plates are `d` deep (above). The net: tapes, then the cord grid.
  const tw = 0.07;
  const zf = 0.004;
  for (const side of [1, -1]) {
    const z = side * zf;
    quadN(m, [-nx, y1 - tw, z], [nx, y1 - tw, z], [nx, y1, z], [-nx, y1, z], [0, 0, side], tape);
    quadN(m, [-nx, y0, z], [nx, y0, z], [nx, y0 + 0.05, z], [-nx, y0 + 0.05, z], [0, 0, side], tape);
    for (const sx of [-1, 1]) quadN(m, [sx * nx - (sx > 0 ? 0.05 : 0), y0, z], [sx * nx + (sx < 0 ? 0.05 : 0), y0, z], [sx * nx + (sx < 0 ? 0.05 : 0), y1, z], [sx * nx - (sx > 0 ? 0.05 : 0), y1, z], [0, 0, side], tape);
  }
  if (level >= 2) {
    // Far: the net as one dark see-through-looking band (both faces).
    for (const side of [1, -1]) quadN(m, [-nx, y0 + 0.05, side * 0.002], [nx, y0 + 0.05, side * 0.002], [nx, y1 - tw, side * 0.002], [-nx, y1 - tw, side * 0.002], [0, 0, side], scale3(cord, 1.4));
  } else {
    const cell = level === 0 ? g.cell : g.cell * 2.5;
    const nu = Math.max(1, Math.round((2 * nx) / cell) - 1);
    const nv = Math.max(1, Math.round((y1 - tw - (y0 + 0.05)) / cell) - 1);
    wirePanel(m, [-nx, y0 + 0.05, 0], [nx, y0 + 0.05, 0], [-nx, y1 - tw, 0], [nx, y1 - tw, 0], nu, nv, level === 0 ? 0.012 : 0.03, cord);
    // Guy cords from the tape's ends to the posts, top and foot.
    for (const sx of [-1, 1]) for (const y of [y1 - 0.03, y0 + 0.02]) bar(m, [sx * nx, y, 0], [sx * (px - hp), y, 0], 0.012, cord);
  }
  return m;
}

/**
 * A sand court laid on the ground: a shallow sand bed `size` (its width, thickness and length) with a bevelled edge,
 * in patches of slightly different tone, and painted boundary lines round the court `court` ([width, length], m)
 * centred on it, with a centre line across (under the net). Settings `g`: `court`, `line` (the lines' width),
 * `patch` (the tone patches' size). `look`: `sand`, `line`, `jitter`. No collision: it is walked on as the ground.
 */
export function courtMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const r = rng(seed);
  const m = new Mesh();
  const sand = hex(look.sand ?? '#cdb78f');
  const lineC = hex(look.line ?? '#f2f1ec');
  const X = w / 2;
  const Z = d / 2;
  const b = Math.min(0.12, X / 4); // the bevel's width
  if (level >= 2) {
    // Far: the bed's top alone.
    quadN(m, [-X, h, -Z], [X, h, -Z], [X, h, Z], [-X, h, Z], [0, 1, 0], sand);
    return m;
  }
  // The bevel round the bed, from the ground up to the top.
  const lo = [[-X, 0, -Z], [X, 0, -Z], [X, 0, Z], [-X, 0, Z]];
  const hi = [[-X + b, h - 0.004, -Z + b], [X - b, h - 0.004, -Z + b], [X - b, h - 0.004, Z - b], [-X + b, h - 0.004, Z - b]];
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4;
    const out = [lo[k][0] + lo[k2][0], 0.5, lo[k][2] + lo[k2][2]];
    quadN(m, lo[k], lo[k2], hi[k2], hi[k], out, scale3(sand, 0.82));
  }
  // The top: tone patches at the nearest level, one face farther off (the lines a hair over it reach the size's top).
  const top = h - 0.004;
  if (level === 0) {
    const nxp = Math.max(1, Math.round((2 * (X - b)) / g.patch));
    const nzp = Math.max(1, Math.round((2 * (Z - b)) / g.patch));
    for (let i = 0; i < nxp; i++) {
      for (let j = 0; j < nzp; j++) {
        const x0 = -X + b + ((2 * (X - b)) * i) / nxp;
        const x1 = -X + b + ((2 * (X - b)) * (i + 1)) / nxp;
        const z0 = -Z + b + ((2 * (Z - b)) * j) / nzp;
        const z1 = -Z + b + ((2 * (Z - b)) * (j + 1)) / nzp;
        quadN(m, [x0, top, z0], [x1, top, z0], [x1, top, z1], [x0, top, z1], [0, 1, 0], scale3(sand, 1 + r.range(-1, 1) * (look.jitter ?? 0.05)));
      }
    }
  } else {
    quadN(m, hi[0], hi[1], hi[2], hi[3], [0, 1, 0], sand);
  }
  // The lines: a hair over the sand, the court's outline and its centre line (across, at z = 0).
  const [cw, cl] = g.court;
  const lw = g.line;
  const y = top + 0.004;
  const cx = cw / 2;
  const cz = cl / 2;
  const strip = (x0, z0, x1, z1) => quadN(m, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], lineC);
  strip(-cx, -cz, cx, -cz + lw);
  strip(-cx, cz - lw, cx, cz);
  strip(-cx, -cz + lw, -cx + lw, cz - lw);
  strip(cx - lw, -cz + lw, cx, cz - lw);
  strip(-cx + lw, -lw / 2, cx - lw, lw / 2);
  return m;
}
