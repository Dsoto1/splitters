// The mess hall's pieces (docs/map-briefs/st_johns, step 7d: Welles's refectory as the owner drew and described it,
// OWNER_NOTES_2026-11-21): a timber beam ceiling bay, an arcade of stone piers with small round arches, long mess
// tables with their chairs, a serving line, a drink station, a lectern, a bell on a stand, a chandelier with a pale
// bowl, a row of hanging flags, a fireplace with a picture over it, a panelled wall bay with a tall window, and a
// walk-in cooler's door. All generated here from seeds: nothing downloaded, nothing drawn from a photograph, no
// writing, no real school's crest, no real flag (the flags are colour fields of our own choosing). Nothing glows,
// flickers or moves: a bowl, a window's glass and a hearth's embers are plain vertex colour, lit as any wall is.
//
// Frames: a piece stands on y = 0 centred on its footprint, x across, z its depth; a wall piece's back is on −z and
// its face +z. Hung pieces (the ceiling bay, the chandelier, the flags) reach up to their size's height: place the
// foot so the top meets the ceiling.
//
// Level 1 keeps the outline (no small parts); level 2 is a few boxes.

import { rng } from '../env/rng.mjs';
import { Mesh, bar, box, cyl, hex, lathe, mix3, quad, quadN, scale3, triN } from './geom.mjs';

const TAU = Math.PI * 2;

/** A stable 0..1 number from two whole numbers and a seed (which stone, which plank). */
function hash01(a, b, seed) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** One tone of a base colour, by a part's number. */
const toned = (base, k, seed, spread = 0.12) => scale3(base, 1 - spread / 2 + spread * hash01(k, 7, seed));

/**
 * A box of coursed stone: its four upright faces drawn course by course (`course` m high), each course broken into
 * stones of uneven length with a tone of their own; a plain top. At `plain` it is one box.
 */
function stoneBox(m, lo, hi, base, seed, { course = 0.33, plain = false, top = true, bottom = false } = {}) {
  if (plain) {
    box(m, lo, hi, base, [...(top ? [] : ['py']), ...(bottom ? [] : ['ny'])]);
    return;
  }
  const n = Math.max(1, Math.round((hi[1] - lo[1]) / course));
  const h = (hi[1] - lo[1]) / n;
  for (let c = 0; c < n; c++) {
    const y0 = lo[1] + c * h;
    const y1 = y0 + h;
    // Along x (the −z and +z faces), then along z (the −x and +x faces).
    for (const [axis, a0, a1] of [[0, lo[0], hi[0]], [2, lo[2], hi[2]]]) {
      let u = a0;
      let k = 0;
      while (u < a1 - 1e-6) {
        const len = 0.34 + 0.4 * hash01(c * 31 + k, axis + Math.round(a0 * 10), seed);
        const v = a1 - (u + len) < 0.2 ? a1 : u + len;
        const col = toned(base, c * 131 + k * 17 + axis, seed, 0.2);
        if (axis === 0) {
          quadN(m, [u, y0, hi[2]], [v, y0, hi[2]], [v, y1, hi[2]], [u, y1, hi[2]], [0, 0, 1], col);
          quadN(m, [u, y0, lo[2]], [v, y0, lo[2]], [v, y1, lo[2]], [u, y1, lo[2]], [0, 0, -1], scale3(col, 0.97));
        } else {
          quadN(m, [hi[0], y0, u], [hi[0], y0, v], [hi[0], y1, v], [hi[0], y1, u], [1, 0, 0], col);
          quadN(m, [lo[0], y0, u], [lo[0], y0, v], [lo[0], y1, v], [lo[0], y1, u], [-1, 0, 0], scale3(col, 0.97));
        }
        u = v;
        k++;
      }
    }
  }
  if (top) quadN(m, [lo[0], hi[1], lo[2]], [hi[0], hi[1], lo[2]], [hi[0], hi[1], hi[2]], [lo[0], hi[1], hi[2]], [0, 1, 0], base);
  if (bottom) quadN(m, [lo[0], lo[1], lo[2]], [hi[0], lo[1], lo[2]], [hi[0], lo[1], hi[2]], [lo[0], lo[1], hi[2]], [0, -1, 0], scale3(base, 0.8));
}

/** A rectangle in the plane z facing +z. */
const face = (m, x0, y0, x1, y1, z, colour) => quadN(m, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1], colour);

// ---------------------------------------------------------------- the timber ceiling bay

/**
 * One 8 m bay of a timber ceiling for a hall 16 m across (x along the hall, z across it): heavy beams across the
 * hall at the bay's middle and its ends (half of an end's beam is the next bay's), joists along it between them, and the boards over the joists facing down. The top of its size is the
 * ceiling: place its foot `size[1]` under it. Settings `g`: `beams` (the beams' x), `beam` ([width, depth]), `joist`
 * ([width, depth]), `pitch` (between joists), `corbel` (a stone corbel under each beam end: [length, depth]).
 * `look`: `wood`, `boards`, `stone`. Collides as nothing.
 */
export function timberCeilingMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const m = new Mesh();
  const wood = hex(look.wood ?? '#3d2a1c');
  const boards = hex(look.boards ?? '#59402b');
  const stone = hex(look.stone ?? '#b8b0a0');
  const [bw, bd] = g.beam ?? [0.36, 0.42];
  const [jw, jd] = g.joist ?? [0.12, 0.2];
  const top = h - 0.015;
  // Boards: planks across the joists (along z), each a tone of its own; one sheet from far off.
  const planks = level === 0 ? 16 : level === 1 ? 4 : 1;
  for (let i = 0; i < planks; i++) {
    const x0 = -X + (w * i) / planks;
    const x1 = -X + (w * (i + 1)) / planks;
    quadN(m, [x0, top, -Z], [x1, top, -Z], [x1, top, Z], [x0, top, Z], [0, -1, 0], toned(boards, i, seed, 0.16));
  }
  // The beams across the hall: underside and both sides.
  for (const [i, x] of (g.beams ?? [-4, 0, 4]).entries()) {
    // (A beam on the piece's end is half inside it: the next bay's brings the other half.)
    const x0 = Math.max(-X, x - bw / 2);
    const x1 = Math.min(X, x + bw / 2);
    const col = toned(wood, Math.abs(x) > X - 0.01 ? 40 : i + 41, seed, 0.1);
    box(m, [x0, top - bd, -Z], [x1, top, Z], col, ['py', 'nz', 'pz', ...(x0 === -X ? ['nx'] : []), ...(x1 === X ? ['px'] : [])]);
    if (level === 0 && g.corbel) {
      const [cl, cd] = g.corbel;
      const c0 = Math.max(-X, x0 - 0.04);
      const c1 = Math.min(X, x1 + 0.04);
      for (const s of [-1, 1]) box(m, [c0, top - bd - cd, s > 0 ? Z - cl : -Z], [c1, top - bd, s > 0 ? Z : -Z + cl], stone, ['py', s > 0 ? 'pz' : 'nz', ...(c0 === -X ? ['nx'] : []), ...(c1 === X ? ['px'] : [])]);
    }
  }
  if (level >= 2) return m;
  // Joists along the hall.
  const pitch = (g.pitch ?? 0.8) * (level === 1 ? 2 : 1);
  const n = Math.round(d / pitch);
  for (let k = 0; k < n; k++) {
    const z = -Z + pitch * (k + 0.5);
    box(m, [-X, top - jd, z - jw / 2], [X, top, z + jw / 2], toned(wood, k + 60, seed, 0.14), ['py', 'nx', 'px']);
  }
  return m;
}

// ---------------------------------------------------------------- the arcade

/**
 * 8 m of an arcade (x along it): two round arches between stone piers, a wall over the arches to the top: half a pier
 * at each end and a whole one in the middle, so pieces end to end carry on the rhythm (a pier every 4 m), a row ends
 * in a respond against what it meets, and the piece is its own mirror image. Settings `g`: `pier` (a pier's width along the row), `spring` (the arches' springing over the foot),
 * `wall` (the thickness of the wall over the arches; the piers are the piece's full depth). `look`: `stone`, `dressed`
 * (the arch rings, imposts and bases). Collides as its piers and the stone over each arch, stepped along the curve.
 */
export function arcadeMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const m = new Mesh();
  const stone = hex(look.stone ?? '#aaa291');
  const dressed = hex(look.dressed ?? '#c2bbab');
  const pier = g.pier ?? 1;
  const spring = g.spring ?? 1.85;
  const wt = (g.wall ?? 0.6) / 2;
  const bay = w / 2;
  const span = bay - pier;
  const R = span / 2;
  const boxes = [];
  const segs = level === 0 ? 12 : level === 1 ? 6 : 2;
  // The piers: half a pier at each end (two pieces end to end make a whole one; a row's last is a respond against
  // what it meets) and a whole one in the middle; a base course and an impost block where the arches spring.
  const inset = level === 0 ? 0.04 : 0;
  for (const [k, [x0, x1]] of [[-X, -X + pier / 2], [-pier / 2, pier / 2], [X - pier / 2, X]].entries()) {
    const a = x0 === -X ? x0 : x0 + inset;
    const b = x1 === X ? x1 : x1 - inset;
    stoneBox(m, [a, 0, -d / 2 + inset], [b, h, d / 2 - inset], stone, seed + k, { plain: level >= 1, top: false });
    boxes.push([x0, 0, -d / 2, x1, h, d / 2]);
    if (level === 0) {
      box(m, [x0, 0, -d / 2], [x1, 0.5, d / 2], scale3(dressed, 0.92), ['ny', ...(x0 === -X ? ['nx'] : []), ...(x1 === X ? ['px'] : [])]);
      box(m, [x0, spring - 0.16, -d / 2], [x1, spring, d / 2], dressed, [...(x0 === -X ? ['nx'] : []), ...(x1 === X ? ['px'] : [])]);
    }
  }
  for (let b = 0; b < 2; b++) {
    // The arch and the wall over it.
    const cx = -X + pier / 2 + R + b * bay;
    const at = (i) => {
      const a = Math.PI - (Math.PI * i) / segs;
      return [cx + R * Math.cos(a), spring + R * Math.sin(a)];
    };
    for (let i = 0; i < segs; i++) {
      const [ax, ay] = at(i);
      const [bx, by] = at(i + 1);
      const col = toned(stone, b * 50 + i, seed, 0.16);
      for (const s of [-1, 1]) quadN(m, [ax, ay, s * wt], [bx, by, s * wt], [bx, h, s * wt], [ax, h, s * wt], [0, 0, s], col);
      // The soffit under the curve.
      quadN(m, [ax, ay, -wt], [bx, by, -wt], [bx, by, wt], [ax, ay, wt], [-(ax + bx) / 2 + cx, -1, 0], scale3(dressed, 0.86));
      // The ring of voussoirs on both faces, a little proud.
      if (level === 0) {
        const o = (p, k) => [Math.min(X, cx + (p[0] - cx) * k), spring + (p[1] - spring) * k];
        const k = (R + 0.28) / R;
        const [cxo, cyo] = o([ax, ay], k);
        const [dxo, dyo] = o([bx, by], k);
        const vc = toned(dressed, b * 70 + i, seed, 0.14);
        for (const s of [-1, 1]) quadN(m, [ax, ay, s * (wt + 0.03)], [bx, by, s * (wt + 0.03)], [dxo, dyo, s * (wt + 0.03)], [cxo, cyo, s * (wt + 0.03)], [0, 0, s], vc);
      }
    }
    // Collision over the curve: six steps, each from the curve's lowest point over it to the top.
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const u0 = cx - R + (span * i) / steps;
      const u1 = u0 + span / steps;
      const near = Math.max(Math.abs(u0 - cx), Math.abs(u1 - cx));
      const y = spring + Math.sqrt(Math.max(0, R * R - near * near));
      boxes.push([u0, Math.min(y, h - 0.2), -wt, u1, h, wt]);
    }
  }
  if (level === 0) m.boxes = boxes;
  return m;
}

// ---------------------------------------------------------------- mess tables

/** A plain dark chair facing +z (its back on −z): seat, back, four legs. */
function messChair(m, at, turn, colour, level, cw = 0.42, ch = 0.9, cd = 0.44) {
  const s = turn ? -1 : 1;
  const [x, z] = at;
  const zb = (v) => z + s * v;
  const lohi = (x0, y0, z0, x1, y1, z1) => [[x0, y0, Math.min(zb(z0), zb(z1))], [x1, y1, Math.max(zb(z0), zb(z1))]];
  if (level >= 2) return;
  box(m, ...lohi(x - cw / 2, 0.42, -cd / 2, x + cw / 2, 0.47, cd / 2), colour);
  box(m, ...lohi(x - cw / 2, 0.5, -cd / 2, x + cw / 2, ch, -cd / 2 + 0.04), scale3(colour, 1.15));
  if (level >= 1) return;
  for (const lx of [-1, 1]) for (const lz of [-1, 1]) box(m, ...lohi(x + lx * (cw / 2 - 0.03) - 0.018, 0, lz * (cd / 2 - 0.03) - 0.018, x + lx * (cw / 2 - 0.03) + 0.018, lz < 0 ? 0.5 : 0.42, lz * (cd / 2 - 0.03) + 0.018), scale3(colour, 0.8), ['py', 'ny']);
}

/**
 * A mess hall table (x along it) with its chairs pushed in along both long sides: a pale top on dark steel legs and a
 * rail, `seats` dark chairs a side, a napkin holder or two on the top. One prop where there would be eleven.
 * Settings `g`: `table` ([length, height, width]), `seats` (a side), `tuck` (the table's middle to a chair's middle),
 * `chairs` (false: none). `look`: `top`, `edge`, `steel`, `chair`, `holder`. Collides as the table; the chairs do not.
 */
export function messTableMesh(seed, size, g, look, level) {
  const [tl, th, tw] = g.table;
  const m = new Mesh();
  const top = hex(look.top ?? '#cdb98f');
  const edge = hex(look.edge ?? '#6b5a44');
  const steel = hex(look.steel ?? '#2b2c30');
  const chair = hex(look.chair ?? '#26272b');
  const r = rng(seed);
  if (level >= 2) {
    box(m, [-tl / 2, th - 0.3, -tw / 2], [tl / 2, th, tw / 2], top, ['ny']);
    if (g.chairs !== false) for (const s of [-1, 1]) box(m, [-tl / 2 + 0.1, 0.3, s > 0 ? g.tuck - 0.2 : -g.tuck - 0.05], [tl / 2 - 0.1, 0.9, s > 0 ? g.tuck + 0.05 : -g.tuck + 0.2], chair, ['ny']);
    return m;
  }
  // The top: a pale board with a darker edge band, in two halves of slightly different tone.
  for (const [i, x0] of [-tl / 2, 0].entries()) box(m, [x0, th - 0.04, -tw / 2], [x0 + tl / 2, th, tw / 2], scale3(top, 1 + r.jitter(0.04)), ['ny', i ? 'nx' : 'px']);
  box(m, [-tl / 2, th - 0.075, -tw / 2 + 0.01], [tl / 2, th - 0.04, tw / 2 - 0.01], edge, ['py']);
  // Legs: a T at each end and one in the middle, a rail between.
  const legs = level === 0 ? [-tl / 2 + 0.25, 0, tl / 2 - 0.25] : [-tl / 2 + 0.25, tl / 2 - 0.25];
  for (const x of legs) {
    box(m, [x - 0.03, 0.03, -0.03], [x + 0.03, th - 0.075, 0.03], steel, ['py', 'ny']);
    box(m, [x - 0.03, 0, -tw / 2 + 0.08], [x + 0.03, 0.04, tw / 2 - 0.08], steel, ['ny']);
  }
  if (level === 0) {
    box(m, [-tl / 2 + 0.25, 0.3, -0.02], [tl / 2 - 0.25, 0.34, 0.02], steel, ['nx', 'px']);
    const holder = hex(look.holder ?? '#17181a');
    for (const x of tl > 2.5 ? [-tl / 4, tl / 4] : [0]) box(m, [x - 0.07, th, -0.05], [x + 0.07, th + 0.13, 0.05], holder, ['ny']);
  }
  if (g.chairs !== false) {
    const n = g.seats ?? 5;
    for (let i = 0; i < n; i++) {
      const x = -tl / 2 + (tl * (i + 0.5)) / n;
      for (const s of [-1, 1]) messChair(m, [x, s * g.tuck], s > 0, scale3(chair, 1 + 0.2 * hash01(i, s, seed)), level);
    }
  }
  if (level === 0) m.boxes = [[-tl / 2, 0, -tw / 2, tl / 2, th, tw / 2]];
  return m;
}

// ---------------------------------------------------------------- the serving line

/**
 * A cafeteria serving counter (x along it; the diners' side is −z, the servers' +z): a steel-fronted counter with a
 * tray rail of three tubes on brackets, `wells` hot wells of food pans in its top, and a sneeze guard on posts over
 * the diners' edge (a pale pane: plain colour, it does not see through). `look`: `body`, `top`, `rail`, `guard`,
 * `food` (comma-separated hex, one a well). Collides as the counter with its rail, and the guard.
 */
export function servingLineMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const m = new Mesh();
  const body = hex(look.body ?? '#8f9499');
  const top = hex(look.top ?? '#c5c9cc');
  const railC = hex(look.rail ?? '#b9bdc1');
  const guard = hex(look.guard ?? '#cfe0e4');
  const food = (look.food ?? '#b5552d,#d9b23f,#5d8a3c,#8a5a36').split(',').map((c) => hex(c.trim()));
  const ch = g.counter ?? 0.9;
  const z0 = -d / 2 + (g.rail ?? 0.3);
  // The counter: its body and top.
  box(m, [-X, 0.1, z0 + 0.03], [X, ch - 0.04, d / 2], body, ['ny', 'py']);
  box(m, [-X + 0.04, 0, z0 + 0.08], [X - 0.04, 0.1, d / 2 - 0.05], scale3(body, 0.45), ['ny', 'py']);
  box(m, [-X, ch - 0.04, z0], [X, ch, d / 2], top, ['ny']);
  const boxes = [[-X, 0, -d / 2, X, ch, d / 2], [-X, ch, z0 - 0.02, X, h, z0 + 0.3]];
  if (level >= 2) {
    box(m, [-X, ch, z0], [X, h, z0 + 0.28], guard, ['ny']);
    return m;
  }
  // The tray rail: three tubes on brackets.
  const tubes = level === 0 ? [0.04, 0.15, 0.26] : [0.15];
  for (const o of tubes) cyl(m, 0, ch - 0.07, -d / 2 + o, -X, X, 0.018, level === 0 ? 6 : 4, railC, { caps: '01' });
  if (level === 0) for (const x of [-X + 0.3, 0, X - 0.3]) box(m, [x - 0.02, ch - 0.13, -d / 2 + 0.02], [x + 0.02, ch - 0.09, z0 + 0.03], scale3(railC, 0.7), ['pz']);
  // The wells: a dark rim, a pan of food in each.
  const wells = g.wells ?? 4;
  const wz0 = z0 + 0.34;
  const wz1 = d / 2 - 0.1;
  for (let i = 0; i < wells; i++) {
    const a = -X + 0.12 + ((w - 0.24) * i) / wells;
    const b = a + (w - 0.24) / wells - 0.08;
    quadN(m, [a, ch + 0.002, wz0], [b, ch + 0.002, wz0], [b, ch + 0.002, wz1], [a, ch + 0.002, wz1], [0, 1, 0], scale3(top, 0.35));
    if (level === 0) quadN(m, [a + 0.03, ch + 0.004, wz0 + 0.03], [b - 0.03, ch + 0.004, wz0 + 0.03], [b - 0.03, ch + 0.004, wz1 - 0.03], [a + 0.03, ch + 0.004, wz1 - 0.03], [0, 1, 0], food[i % food.length]);
  }
  // The sneeze guard: posts, a top shelf, a sloping pane on the diners' side.
  const posts = level === 0 ? [-X + 0.06, 0, X - 0.06] : [-X + 0.06, X - 0.06];
  for (const x of posts) box(m, [x - 0.02, ch, z0 + 0.22], [x + 0.02, h - 0.03, z0 + 0.26], railC, ['ny', 'py']);
  box(m, [-X, h - 0.03, z0 + 0.04], [X, h, z0 + 0.3], top, []);
  const pane = [[-X + 0.02, ch + 0.28, z0], [X - 0.02, ch + 0.28, z0], [X - 0.02, h - 0.03, z0 + 0.16], [-X + 0.02, h - 0.03, z0 + 0.16]];
  quad(m, pane[1], pane[0], pane[3], pane[2], guard);
  quad(m, pane[0], pane[1], pane[2], pane[3], scale3(guard, 0.9));
  if (level === 0) m.boxes = boxes;
  return m;
}

// ---------------------------------------------------------------- the drink station

/**
 * A drink station against a wall (its back on −z): a cabinet with a steel top; on it a fountain head with a row of
 * taps over a drip tray, two clear dispensers of juice on bases, a coffee urn, stacks of cups. `look`: `body`, `top`,
 * `machine`, `juice` (comma-separated hex), `cup`. Collides as the cabinet and what stands on it.
 */
export function drinkStationMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const m = new Mesh();
  const body = hex(look.body ?? '#5b4532');
  const top = hex(look.top ?? '#c5c9cc');
  const machine = hex(look.machine ?? '#2f3236');
  const juice = (look.juice ?? '#e08a2c,#b8323a').split(',').map((c) => hex(c.trim()));
  const cup = hex(look.cup ?? '#eeeae0');
  const ch = g.counter ?? 0.92;
  box(m, [-X, 0.08, -d / 2], [X, ch - 0.04, d / 2], body, ['ny', 'py', 'nz']);
  box(m, [-X + 0.05, 0, -d / 2], [X - 0.05, 0.08, d / 2 - 0.06], scale3(body, 0.4), ['ny', 'py', 'nz']);
  box(m, [-X, ch - 0.04, -d / 2], [X, ch, d / 2], top, ['ny', 'nz']);
  const boxes = [[-X, 0, -d / 2, X, ch, d / 2], [-X, ch, -d / 2, X, h, 0.1]];
  if (level >= 2) {
    box(m, [-X + 0.1, ch, -d / 2], [X - 0.1, h, 0.05], machine, ['ny', 'nz']);
    return m;
  }
  if (level === 0) {
    // Door lines on the cabinet's front.
    for (let i = 1; i < 4; i++) face(m, -X + (w * i) / 4 - 0.008, 0.12, -X + (w * i) / 4 + 0.008, ch - 0.08, d / 2 + 0.0006, scale3(body, 0.5));
  }
  // The fountain head: a dark box with a lit-looking front band (plain colour), taps and a drip tray.
  const fx0 = -X + 0.08;
  const fx1 = fx0 + 0.85;
  box(m, [fx0, ch, -d / 2], [fx1, h, -0.02], machine, ['ny', 'nz']);
  if (level === 0) {
    face(m, fx0 + 0.05, h - 0.3, fx1 - 0.05, h - 0.08, -0.018, hex(look.panel ?? '#d8d2c2'));
    const taps = (look.taps ?? '#b8323a,#e0b030,#3c7a4a,#2f5f9a,#e08a2c,#6b4a8a').split(',').map((c) => hex(c.trim()));
    for (const [i, c] of taps.entries()) {
      const x = fx0 + 0.1 + ((fx1 - fx0 - 0.2) * (i + 0.5)) / taps.length;
      box(m, [x - 0.035, ch + 0.34, -0.02], [x + 0.035, ch + 0.44, 0.03], c, ['nz']);
      box(m, [x - 0.012, ch + 0.26, 0.0], [x + 0.012, ch + 0.34, 0.03], scale3(top, 0.6), ['py']);
    }
    box(m, [fx0, ch, -0.02], [fx1, ch + 0.03, 0.2], scale3(machine, 1.4), ['ny', 'nz']);
  }
  // Two juice dispensers: a base, a clear tank of juice, a lid.
  const seg = level === 0 ? 10 : 6;
  for (const [i, c] of juice.entries()) {
    const x = fx1 + 0.3 + i * 0.42;
    cyl(m, 1, -0.02, x, ch, ch + 0.16, 0.15, seg, machine, { caps: '1' });
    cyl(m, 1, -0.02, x, ch + 0.16, ch + 0.56, 0.14, seg, c, { caps: '1' });
    cyl(m, 1, -0.02, x, ch + 0.56, ch + 0.62, 0.15, seg, scale3(machine, 1.3), { caps: '1' });
  }
  // A coffee urn and cups.
  const ux = X - 0.3;
  cyl(m, 1, -0.05, ux, ch + 0.06, h - 0.12, 0.16, seg, scale3(top, 0.9), { caps: '1' });
  if (level === 0) {
    cyl(m, 1, -0.05, ux, h - 0.12, h, 0.06, 6, machine, { caps: '1' });
    for (const s of [-1, 1]) box(m, [ux + s * 0.12 - 0.02, ch, -0.07], [ux + s * 0.12 + 0.02, ch + 0.06, -0.03], machine, ['ny', 'py']);
    for (const cx of [ux - 0.34, ux - 0.46]) cyl(m, 1, 0.16, cx, ch, ch + 0.2 + 0.08 * hash01(Math.round(cx * 100), 3, seed), 0.045, 6, cup, { caps: '1' });
  }
  if (level === 0) m.boxes = boxes;
  return m;
}

// ---------------------------------------------------------------- the lectern and the bell

/**
 * A wooden lectern (a speaker stands behind it on −z; its panelled front is +z): a plinth, a tapering column of
 * panels, a sloped reading top with a lip. `look`: `wood`, `trim`. Collides as its box.
 */
export function lecternMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const m = new Mesh();
  const wood = hex(look.wood ?? '#6a4326');
  const trim = hex(look.trim ?? '#4a2d18');
  if (level >= 2) {
    box(m, [-X, 0, -Z], [X, h, Z], wood, ['ny']);
    return m;
  }
  box(m, [-X, 0, -Z], [X, 0.1, Z], trim, ['ny']);
  box(m, [-X + 0.06, 0.1, -Z + 0.08], [X - 0.06, h - 0.22, Z - 0.06], wood, ['ny', 'py']);
  // The reading top: sloping up away from the speaker, a lip at its low edge.
  const y0 = h - 0.22;
  const a = [[-X, y0, -Z], [X, y0, -Z], [X, h - 0.04, Z], [-X, h - 0.04, Z]];
  quadN(m, a[0], a[1], a[2], a[3], [0, 1, 0], scale3(wood, 1.12));
  quadN(m, [-X, y0 - 0.04, -Z], [X, y0 - 0.04, -Z], [X, y0, -Z], [-X, y0, -Z], [0, 0, -1], trim);
  quadN(m, [-X, y0 - 0.04, Z], [X, y0 - 0.04, Z], [X, h, Z], [-X, h, Z], [0, 0, 1], trim);
  quadN(m, [-X, h - 0.04, Z], [X, h - 0.04, Z], [X, h, Z], [-X, h, Z], [0, 0, -1], trim);
  for (const s of [-1, 1]) {
    triN(m, [s * X, y0 - 0.04, -Z], [s * X, y0 - 0.04, Z], [s * X, h, Z], [s, 0, 0], trim);
    triN(m, [s * X, y0 - 0.04, -Z], [s * X, y0, -Z], [s * X, h, Z], [s, 0, 0], trim);
  }
  if (level === 0) {
    // A raised panel on the front and each side.
    face(m, -X + 0.14, 0.2, X - 0.14, y0 - 0.12, Z - 0.056, scale3(wood, 0.82));
    box(m, [-X + 0.18, 0.26, Z - 0.06], [X - 0.18, y0 - 0.18, Z - 0.045], scale3(wood, 1.08), ['nz', 'ny']);
  }
  return m;
}

/**
 * A brass bell on a low black stand: two A-frames joined by a top bar, the bell hung from it, a striker's cord.
 * `look`: `iron`, `brass`. Collides as its box.
 */
export function bellStandMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const m = new Mesh();
  const iron = hex(look.iron ?? '#1a1b1d');
  const brass = hex(look.brass ?? '#b98f3a');
  if (level >= 2) {
    box(m, [-X, 0, -Z], [X, 0.06, Z], iron, ['ny']);
    box(m, [-0.2, h - 0.6, -0.2], [0.2, h - 0.12, 0.2], brass, []);
    box(m, [-X, h - 0.06, -0.03], [X, h, 0.03], iron, []);
    return m;
  }
  const t = 0.045;
  for (const s of [-1, 1]) {
    const x = s * (X - t / 2);
    bar(m, [x, t / 2, -Z + t], [x, h - t / 2, 0], t, iron, { ends: true });
    bar(m, [x, t / 2, Z - t], [x, h - t / 2, 0], t, iron, { ends: true });
    box(m, [x - t / 2, 0, -Z], [x + t / 2, t, Z], iron, ['ny']);
  }
  box(m, [-X, h - t, -t / 2], [X, h, t / 2], iron, []);
  // The bell: a turned shell, mouth down.
  const by = h - 0.62;
  const seg = level === 0 ? 14 : 8;
  const prof = [[0.2, by], [0.185, by + 0.05], [0.14, by + 0.2], [0.115, by + 0.34], [0.07, by + 0.44], [0.0, by + 0.47]];
  lathe(m, prof, seg, (p) => scale3(brass, 0.85 + 0.3 * ((p[1] - by) / 0.47)));
  if (level === 0) {
    cyl(m, 1, 0, 0, by + 0.47, h - t, 0.015, 6, iron);
    cyl(m, 1, 0, 0, by - 0.06, by + 0.1, 0.03, 6, scale3(brass, 0.6), { caps: '0' });
  }
  return m;
}

// ---------------------------------------------------------------- the chandelier

/**
 * A round iron chandelier with a pale bowl, hung on chains: a ceiling rose at the top of its size, three chains down
 * to an iron ring with a band of small shades round it, a wide pale glass bowl under the ring. Plain colours: it does
 * not glow (a set piece's light gives the light). `look`: `iron`, `bowl`, `shade`. Collides as nothing.
 */
export function chandelierMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const R = w / 2;
  const m = new Mesh();
  const iron = hex(look.iron ?? '#1c1d20');
  const bowl = hex(look.bowl ?? '#f2ead2');
  const shade = hex(look.shade ?? '#efe2bd');
  const seg = level === 0 ? 16 : level === 1 ? 10 : 6;
  const ringY = g.ring ?? 0.42;
  // The bowl: a shallow pale dish, lighter towards its rim.
  const br = R * 0.66;
  lathe(m, [[0.02, 0.14], [br * 0.6, 0.17], [br * 0.92, 0.24], [br, 0.3]], seg, (p) => scale3(bowl, 0.9 + 0.1 * ((p[1] - 0.14) / 0.16)));
  if (level >= 2) {
    cyl(m, 1, 0, 0, 0.3, ringY + 0.1, R - 0.01, seg, iron);
    return m;
  }
  // The ring: a band, open top and bottom, seen from inside too.
  cyl(m, 1, 0, 0, ringY - 0.06, ringY + 0.06, R - 0.01, seg, iron);
  cyl(m, 1, 0, 0, ringY - 0.06, ringY + 0.06, R - 0.03, seg, scale3(iron, 0.8), { inside: true });
  // Small shades round the ring and three stays down to the bowl.
  const lamps = level === 0 ? 8 : 4;
  for (let i = 0; i < lamps; i++) {
    const a = (i / lamps) * TAU;
    const [x, z] = [Math.cos(a) * (R - 0.07), Math.sin(a) * (R - 0.07)];
    box(m, [x - 0.06, ringY + 0.06, z - 0.06], [x + 0.06, ringY + 0.2, z + 0.06], shade, ['ny']);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.3;
    const p = [Math.cos(a) * (R - 0.02), ringY, Math.sin(a) * (R - 0.02)];
    bar(m, p, [Math.cos(a) * br, 0.3, Math.sin(a) * br], 0.025, iron);
    // The chains: up to the rose.
    bar(m, p, [Math.cos(a) * 0.06, h - 0.05, Math.sin(a) * 0.06], level === 0 ? 0.03 : 0.04, scale3(iron, 1.3));
  }
  cyl(m, 1, 0, 0, h - 0.05, h, 0.12, level === 0 ? 10 : 6, iron, { caps: '0' });
  return m;
}

// ---------------------------------------------------------------- the hanging flags

/** The colour at (u across the fly 0..1, v down the hoist 0..1) of one of our own flag designs. */
function flagColour(design, cols, u, v) {
  switch (design) {
    case 'bands':
      return cols[Math.min(2, Math.floor(v * 3))];
    case 'pales':
      return cols[u < 0.5 ? 0 : 1];
    case 'quarters':
      return cols[(u < 0.5 ? 0 : 1) ^ (v < 0.5 ? 0 : 1)];
    case 'border':
      return u < 0.14 || u > 0.86 || v < 0.2 || v > 0.8 ? cols[1] : cols[0];
    case 'chevron':
      return Math.abs(v - 0.5) * 2 < 1 - u * 1.6 ? cols[1] : Math.abs(v - 0.5) * 2 < 1.25 - u * 1.6 ? cols[2] : cols[0];
    default:
      return Math.abs(v - 0.5) < 0.14 ? cols[1] : cols[0];
  }
}

/**
 * A row of flags hung out over a hall (x along the row; the row's back, where the poles are fixed, is −z, at the top
 * of its size): each a pole sloping down and out to +z, its flag hanging under it across the hall's length, both faces
 * drawn. The flags are colour fields of our own (bands, pales, quarters, a border, a chevron, a bar), in colours
 * picked from the look's list by the seed: no country's flag and no school's. Settings `g`: `flags` (how many),
 * `pole` (its length), `drop` (how far it slopes down over its length), `flag` ([fly, hoist]). `look`: `colours`
 * (comma-separated hex), `pole`. Collides as nothing.
 */
export function flagRowMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const r = rng(seed);
  const colours = (look.colours ?? '#4b2a84,#d9a520,#efeadc,#1f6f6b,#b8452c,#1d2a44,#3d7a3a').split(',').map((c) => hex(c.trim()));
  const pole = hex(look.pole ?? '#8a6a42');
  const n = g.flags ?? 4;
  const len = g.pole ?? 1.3;
  const drop = g.drop ?? 0.55;
  const [fly, hoist] = g.flag ?? [1.05, 0.7];
  const designs = ['bands', 'pales', 'quarters', 'border', 'chevron', 'bar'];
  const run = Math.sqrt(len * len - drop * drop);
  const cells = level === 0 ? [6, 5] : level === 1 ? [3, 3] : [1, 1];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    const design = designs[(r.int ? r.int(0, 5) : Math.floor(r.next() * 6)) % 6];
    const pick = () => colours[Math.floor(r.next() * colours.length) % colours.length];
    let cols = [pick(), pick(), pick()];
    // (Never the same colour twice running: a flag of one colour reads as a rag.)
    for (let k = 1; k < 3; k++) while (cols[k] === cols[k - 1] || (k === 2 && cols[2] === cols[0])) cols[k] = pick();
    const p0 = [x, h - 0.02, -d / 2 + 0.02];
    const p1 = [x, h - 0.02 - drop, -d / 2 + 0.02 + run];
    if (level <= 1) bar(m, p0, p1, 0.035, pole, { ends: true });
    // The flag: hoist along the pole from 0.15 m out, hanging straight down from it.
    const t0 = 0.15 / len;
    const t1 = Math.min(1, (0.15 + fly) / len);
    const on = (t) => [x, p0[1] + (p1[1] - p0[1]) * t - 0.02, p0[2] + (p1[2] - p0[2]) * t];
    const [nu, nv] = cells;
    for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) {
      const u0 = a / nu;
      const u1 = (a + 1) / nu;
      const v0 = b / nv;
      const v1 = (b + 1) / nv;
      const c = flagColour(design, cols, (u0 + u1) / 2, (v0 + v1) / 2);
      const A = on(t0 + (t1 - t0) * u0);
      const B = on(t0 + (t1 - t0) * u1);
      const q = [[A[0], A[1] - hoist * v0, A[2]], [B[0], B[1] - hoist * v0, B[2]], [B[0], B[1] - hoist * v1, B[2]], [A[0], A[1] - hoist * v1, A[2]]];
      quad(m, q[0], q[1], q[2], q[3], c);
      quad(m, q[1], q[0], q[3], q[2], scale3(c, 0.92));
    }
  }
  return m;
}

// ---------------------------------------------------------------- the fireplace

/**
 * A stone fireplace against a wall (back −z) with a picture over it: a raised hearth, stone jambs and a lintel under
 * a mantel shelf, a dark firebox with a grate of cold logs, and over the mantel a panelled wooden overmantel holding
 * a gilt frame: `picture: "portrait"` (a figure of plain shapes, no face) or `"landscape"` (hills under a sky), both
 * our own. Nothing burns or glows. `look`: `stone`, `dressed`, `wood`, `gilt`, `ground`, `figure`, `sky`, `hill`.
 * Collides as the fireplace's body and the overmantel.
 */
export function fireplaceMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const back = -d / 2;
  const m = new Mesh();
  const stone = hex(look.stone ?? '#aaa291');
  const dressed = hex(look.dressed ?? '#c2bbab');
  const wood = hex(look.wood ?? '#4a2f1c');
  const gilt = hex(look.gilt ?? '#b08d3e');
  const soot = hex('#1a1614');
  const mantel = g.mantel ?? 1.55;
  const bodyZ = back + (g.depth ?? 0.5);
  const ow = g.over ?? 2.3;
  const boxes = [[-X, 0, back, X, mantel + 0.1, d / 2], [-ow / 2, mantel + 0.1, back, ow / 2, h, back + 0.16]];
  if (level >= 2) {
    box(m, [-X, 0, back], [X, mantel + 0.1, bodyZ], stone, ['ny', 'nz']);
    box(m, [-ow / 2, mantel + 0.1, back], [ow / 2, h, back + 0.14], wood, ['ny', 'nz']);
    return m;
  }
  // The hearth and the body: jambs either side of the firebox, a lintel over it.
  box(m, [-X, 0, back], [X, 0.14, d / 2], scale3(dressed, 0.8), ['ny', 'nz']);
  const fw = g.firebox?.[0] ?? 1.5;
  const fh = g.firebox?.[1] ?? 1.05;
  const plain = level >= 1;
  stoneBox(m, [-X + 0.12, 0.14, back], [-fw / 2, mantel - 0.12, bodyZ], stone, seed, { plain, top: false });
  stoneBox(m, [fw / 2, 0.14, back], [X - 0.12, mantel - 0.12, bodyZ], stone, seed + 1, { plain, top: false });
  stoneBox(m, [-fw / 2, 0.14 + fh, back], [fw / 2, mantel - 0.12, bodyZ], dressed, seed + 2, { plain: true, top: false, bottom: true });
  box(m, [-X + 0.04, mantel - 0.12, back], [X - 0.04, mantel + 0.1, bodyZ + 0.16], dressed, ['nz']);
  // The firebox: dark sides and back, a grate with logs.
  face(m, -fw / 2, 0.14, fw / 2, 0.14 + fh, back + 0.06, soot);
  for (const s of [-1, 1]) quadN(m, [s * fw / 2, 0.14, back + 0.06], [s * fw / 2, 0.14, bodyZ], [s * fw / 2, 0.14 + fh, bodyZ], [s * fw / 2, 0.14 + fh, back + 0.06], [-s, 0, 0], scale3(soot, 1.6));
  if (level === 0) {
    const iron = hex('#232427');
    for (const s of [-1, 1]) box(m, [s * 0.4 - 0.02, 0.14, back + 0.12], [s * 0.4 + 0.02, 0.36, bodyZ - 0.06], iron, ['ny']);
    for (const [i, z] of [back + 0.18, back + 0.3, back + 0.24].entries()) cyl(m, 0, 0.3 + (i === 2 ? 0.1 : 0), z, -0.5 + i * 0.05, 0.5 - i * 0.08, 0.055, 6, scale3(hex('#4a3526'), 0.9 + 0.1 * i), { caps: '01' });
  }
  // The overmantel: a wooden panel with a frame and a picture.
  const oy0 = mantel + 0.1;
  box(m, [-ow / 2, oy0, back], [ow / 2, h, back + 0.1], wood, ['ny', 'nz']);
  box(m, [-ow / 2 - 0.05, h - 0.14, back], [ow / 2 + 0.05, h, back + 0.15], scale3(wood, 0.8), ['nz']);
  const land = g.picture === 'landscape';
  const [pw, ph] = land ? [1.5, 1.0] : [1.0, 1.3];
  const py = oy0 + (h - 0.14 - oy0 - ph) / 2;
  const fz = back + 0.14;
  box(m, [-pw / 2, py, back + 0.1], [pw / 2, py + ph, fz], gilt, ['nz']);
  const f = 0.09;
  const cz = fz + 0.003;
  if (land) {
    const sky = hex(look.sky ?? '#8fa9b8');
    const hill = hex(look.hill ?? '#4d6a3c');
    face(m, -pw / 2 + f, py + f, pw / 2 - f, py + ph - f, cz, sky);
    const base = py + f;
    const top = py + ph - f;
    const pts = [[-pw / 2 + f, base + 0.28], [-0.3, base + 0.46], [0.05, base + 0.3], [0.4, base + 0.5], [pw / 2 - f, base + 0.34]];
    for (let i = 0; i + 1 < pts.length; i++) quadN(m, [pts[i][0], base, cz + 0.002], [pts[i + 1][0], base, cz + 0.002], [pts[i + 1][0], Math.min(top, pts[i + 1][1]), cz + 0.002], [pts[i][0], Math.min(top, pts[i][1]), cz + 0.002], [0, 0, 1], scale3(hill, 0.85 + 0.1 * i));
    face(m, -pw / 2 + f, base, pw / 2 - f, base + 0.16, cz + 0.004, scale3(hill, 0.6));
  } else {
    const ground = hex(look.ground ?? '#3a2a1c');
    const figure = hex(look.figure ?? '#1d1a18');
    face(m, -pw / 2 + f, py + f, pw / 2 - f, py + ph - f, cz, ground);
    const sh = py + f + 0.02;
    quadN(m, [-0.3, sh, cz + 0.002], [0.3, sh, cz + 0.002], [0.2, sh + 0.42, cz + 0.002], [-0.2, sh + 0.42, cz + 0.002], [0, 0, 1], figure);
    const n = level === 0 ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU;
      const a1 = ((i + 1) / n) * TAU;
      triN(m, [0, sh + 0.62, cz + 0.002], [0.15 * Math.cos(a0), sh + 0.62 + 0.17 * Math.sin(a0), cz + 0.002], [0.15 * Math.cos(a1), sh + 0.62 + 0.17 * Math.sin(a1), cz + 0.002], [0, 0, 1], scale3(figure, 1.7));
    }
  }
  if (level === 0) m.boxes = boxes;
  return m;
}

// ---------------------------------------------------------------- the panelled wall bay

/**
 * A bay of dark wood panelling for a wall (back −z), with a tall window over it: a wainscot of framed panels to
 * `wainscot` m with a cap rail, and (`window: true`) a tall window set in a stone surround from `sill` up (above the rail unless given): pale panes
 * between dark bars, a banner of two colours let into its middle (plain colours: it does not glow or see through).
 * `look`: `wood`, `stone`, `glass`, `bars`, `banner` (two hex, comma-separated). Collides as nothing.
 */
export function panelWindowMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const back = -d / 2;
  const m = new Mesh();
  const wood = hex(look.wood ?? '#4a2f1c');
  const wy = g.wainscot ?? 2.0;
  const z1 = back + 0.05;
  face(m, -X, 0, X, wy, z1, wood);
  for (const s of [-1, 1]) quadN(m, [s * X, 0, back], [s * X, 0, z1], [s * X, wy, z1], [s * X, wy, back], [s, 0, 0], scale3(wood, 0.8));
  box(m, [-X, wy, back], [X, wy + 0.08, back + 0.12], scale3(wood, 0.78), ['nz']);
  if (level <= 1) {
    box(m, [-X, 0, back], [X, 0.16, back + 0.08], scale3(wood, 0.7), ['nz', 'ny']);
    const panels = g.panels ?? 4;
    const pw = w / panels;
    for (let i = 0; i < panels; i++) {
      const x0 = -X + i * pw + 0.1;
      const x1 = x0 + pw - 0.2;
      for (const [y0, y1] of level === 0 ? [[0.28, 1.0], [1.12, wy - 0.12]] : [[0.28, wy - 0.12]]) {
        face(m, x0, y0, x1, y1, z1 + 0.003, toned(wood, i * 3 + Math.round(y0 * 10), seed, 0.2));
        if (level === 0) for (const [a, b, c, e] of [[x0, y0, x1, y0 + 0.03], [x0, y1 - 0.03, x1, y1], [x0, y0, x0 + 0.03, y1], [x1 - 0.03, y0, x1, y1]]) face(m, a, b, c, e, z1 + 0.006, scale3(wood, 0.62));
      }
    }
  }
  if (!g.window) return m;
  // The window: a stone surround, glass, bars, a banner in the glass.
  const stone = hex(look.stone ?? '#c2bbab');
  const glass = hex(look.glass ?? '#cfd9d2');
  const bars = hex(look.bars ?? '#2a2622');
  const banner = (look.banner ?? '#4b2a84,#d9a520').split(',').map((c) => hex(c.trim()));
  const ww = g.width ?? 1.5;
  // (Its sill may be below the cap rail: the window then stands in the panelling, as a hall's tall end windows do.)
  const y0 = g.sill ?? wy + 0.08;
  const y1 = h;
  const s = 0.14;
  box(m, [-ww / 2 - s, y0, back], [ww / 2 + s, y1, back + 0.13], stone, ['nz', 'ny']);
  const gz = back + 0.133;
  face(m, -ww / 2, y0 + s, ww / 2, y1 - s, gz, glass);
  if (level >= 2) return m;
  const bw = ww * 0.42;
  const by0 = y0 + s + (y1 - y0 - 2 * s) * 0.3;
  const by1 = y0 + s + (y1 - y0 - 2 * s) * 0.78;
  face(m, -bw / 2, by0, bw / 2, (by0 + by1) / 2, gz + 0.002, banner[1]);
  face(m, -bw / 2, (by0 + by1) / 2, bw / 2, by1, gz + 0.002, banner[0]);
  // Bars: one mullion, transoms.
  const tr = level === 0 ? 5 : 2;
  face(m, -0.02, y0 + s, 0.02, y1 - s, gz + 0.004, bars);
  for (let i = 1; i < tr; i++) {
    const y = y0 + s + ((y1 - y0 - 2 * s) * i) / tr;
    face(m, -ww / 2, y - 0.015, ww / 2, y + 0.015, gz + 0.004, bars);
  }
  return m;
}

// ---------------------------------------------------------------- the walk-in cooler's door

/**
 * The door of a walk-in cooler, for a kitchen wall (back −z): a steel frame, an insulated steel leaf standing proud
 * of it with a kick plate, three strap hinges, a long lever latch, a small dial over the door. A still prop: it does
 * not open. `look`: `steel`, `frame`, `dark`. Collides as nothing (the wall behind it does).
 */
export function walkInDoorMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const back = -d / 2;
  const m = new Mesh();
  const steel = hex(look.steel ?? '#b4b9bd');
  const frame = hex(look.frame ?? '#8d9296');
  const dark = hex(look.dark ?? '#2a2c2f');
  box(m, [-X, 0, back], [X, h, back + 0.05], frame, ['nz', 'ny']);
  const lx = X - 0.12;
  box(m, [-lx, 0.03, back + 0.05], [lx, h - 0.2, d / 2 - 0.03], steel, ['nz', 'ny']);
  if (level >= 2) return m;
  const fz = d / 2 - 0.03;
  face(m, -lx + 0.03, 0.05, lx - 0.03, 0.4, fz + 0.002, scale3(steel, 0.75));
  if (level === 0) {
    for (const y of [0.35, h / 2, h - 0.5]) box(m, [-lx - 0.08, y - 0.04, fz - 0.02], [-lx + 0.22, y + 0.04, d / 2], scale3(frame, 0.7), ['nz']);
    box(m, [lx - 0.3, 1.0, fz], [lx - 0.06, 1.08, d / 2], dark, ['nz']);
    box(m, [lx - 0.1, 0.85, fz], [lx - 0.05, 1.25, d / 2 - 0.005], dark, ['nz']);
    box(m, [-0.12, h - 0.16, back + 0.05], [0.12, h - 0.04, back + 0.08], dark, ['nz']);
    face(m, -0.08, h - 0.14, 0.08, h - 0.06, back + 0.082, hex('#d8dcd4'));
  }
  return m;
}
