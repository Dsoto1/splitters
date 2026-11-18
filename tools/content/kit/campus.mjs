// Campus pieces (docs/map-briefs/st_johns, steps 7-10: DeKoven Hall, Memorial Hall, the chapel, the gym and pool):
// kit-prop families `seat` (pews, bleachers), `window` (stained glass), `table` (the altar), `cabinet` (the organ, a
// trophy case), `sign` (our own crest, an honours board), `roof` (the gym's vault bay) and `sport` (court lines, a
// wall hoop, a pool's lanes). All generated here from seeds: nothing downloaded, nothing drawn from a photograph, no
// writing, no real school's crest, flag or mark. The crest is the game's own (a shield party per chevron, two stars over
// an open book). Nothing glows, flickers or moves: stained glass is plain vertex colour, lit as any wall is.
//
// Frames: a piece stands on y = 0 centred on its footprint, x across, z its depth; a wall piece's back is on −z and its
// face +z unless it says otherwise. Pews face +z (the seat's front edge), a row of them steps back along −z.
//
// Level 1 keeps the outline (seats and backs; frame, mullions and a coarse grid of panes; ring and shield; case and
// cups as blocks); level 2 is a few boxes or one plate.

import { rng } from '../env/rng.mjs';
import { Mesh, bar, box, cyl, hex, lathe, mix3, quad, quadN, scale3, tri, triN } from './geom.mjs';
import { woodTone } from './crate.mjs';

const TAU = Math.PI * 2;

/** A convex polygon [[x, y], …] (counter-clockwise seen from +z) in the plane z, facing +z (`dir` 1) or −z (−1). */
function wallPoly(m, pts, z, dir, colour) {
  const P = pts.map(([x, y]) => [x, y, z]);
  for (let i = 1; i + 1 < P.length; i++) triN(m, P[0], P[i], P[i + 1], [0, 0, dir], colour);
}

/** A convex polygon [[x, z], …] at height y facing up. */
function floorPoly(m, pts, y, colour) {
  const P = pts.map(([x, z]) => [x, y, z]);
  for (let i = 1; i + 1 < P.length; i++) triN(m, P[0], P[i], P[i + 1], [0, 1, 0], colour);
}

/** A flat band along the polyline `pts` ([[x, y], …]) `w` wide (centred), in the plane z facing `dir`. */
function wallBand(m, pts, w, z, dir, colour) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / L) * (w / 2);
    const ny = ((x1 - x0) / L) * (w / 2);
    quadN(m, [x0 - nx, y0 - ny, z], [x1 - nx, y1 - ny, z], [x1 + nx, y1 + ny, z], [x0 + nx, y0 + ny, z], [0, 0, dir], colour);
  }
}

/** A flat band along the polyline `pts` ([[x, z], …]) `w` wide, at height y facing up. */
function floorBand(m, pts, w, y, colour) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0) || 1;
    const nx = (-(z1 - z0) / L) * (w / 2);
    const nz = ((x1 - x0) / L) * (w / 2);
    quadN(m, [x0 - nx, y, z0 - nz], [x1 - nx, y, z1 - nz], [x1 + nx, y, z1 + nz], [x0 + nx, y, z0 + nz], [0, 1, 0], colour);
  }
}

/** Points of an arc round (cx, cy) from a0 to a1 (radians), n pieces. */
const arcPts = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(a0 + ((a1 - a0) * i) / n), cy + r * Math.sin(a0 + ((a1 - a0) * i) / n)]);

/** Whether [x, y] is inside the convex polygon `pts` (counter-clockwise). */
function inside(pts, x, y) {
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < -1e-9) return false;
  }
  return true;
}

// ---------------------------------------------------------------- pews

/**
 * A church pew, or rows of them (`rows`, `pitch` m apart, stepping back along −z from the front row at +z). Each pew:
 * a plank seat 0.45 m up on solid bench ends with a rounded top, a high panelled back leaning a little, a book ledge
 * on the back's rear for the row behind, a kneeler rail low in front of it. Settings `g`: `rows`, `pitch`, `depth`
 * (one pew, m). `look`: `wood`, `jitter`, `grime`. Collides as one box a pew (the rows' boxes, `bounds: "within"`).
 */
export function pewMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const rows = g.rows ?? 1;
  const pitch = g.pitch ?? 0.95;
  const pd = g.depth ?? 0.62;
  const r = rng(seed);
  const m = new Mesh();
  const wood = hex(look.wood ?? '#4a2e1c');
  const boxes = [];
  for (let i = 0; i < rows; i++) {
    const zc = d / 2 - pd / 2 - i * pitch;
    // (The kneeler reaches 0.28 m behind the last pew: the size's depth allows for it.)
    const zf = zc + pd / 2;
    const zb = zc - pd / 2;
    boxes.push([-X, 0, zb, X, h, zf]);
    const tone = woodTone(wood, r, look, seed + i);
    if (level >= 2) {
      box(m, [-X, 0, zb], [X, h, zb + 0.12], tone, ['ny']);
      box(m, [-X, 0.3, zb + 0.12], [X, 0.45, zf], tone, ['ny']);
      continue;
    }
    const seatY = 0.45;
    // The seat, and the apron under its front.
    box(m, [-X + 0.06, seatY - 0.05, zb + 0.1], [X - 0.06, seatY, zf - 0.04], tone, level === 0 ? [] : ['ny']);
    box(m, [-X + 0.06, seatY - 0.16, zf - 0.08], [X - 0.06, seatY - 0.05, zf - 0.05], tone, ['ny', 'py']);
    // The back, leaning a little (top 0.06 m back of its foot), panelled on its face.
    const b0 = zb + 0.12;
    quadN(m, [-X + 0.06, seatY, b0], [X - 0.06, seatY, b0], [X - 0.06, h - 0.04, b0 - 0.06], [-X + 0.06, h - 0.04, b0 - 0.06], [0, 0.06, 1], tone);
    quadN(m, [-X + 0.06, seatY - 0.3, b0 - 0.05], [X - 0.06, seatY - 0.3, b0 - 0.05], [X - 0.06, h - 0.04, b0 - 0.11], [-X + 0.06, h - 0.04, b0 - 0.11], [0, 0.06, -1], scale3(wood, 0.9));
    box(m, [-X + 0.04, h - 0.05, b0 - 0.13], [X - 0.04, h, b0 + 0.01], tone, ['ny']);
    if (level === 0) {
      // Panel mouldings on the back's face: thin raised stiles.
      const n = Math.max(2, Math.round(w / 0.9));
      for (let k = 1; k < n; k++) {
        const x = -X + (w * k) / n;
        quadN(m, [x - 0.015, seatY + 0.05, b0 + 0.004], [x + 0.015, seatY + 0.05, b0 + 0.004], [x + 0.015, h - 0.1, b0 - 0.051], [x - 0.015, h - 0.1, b0 - 0.051], [0, 0.06, 1], scale3(wood, 0.75));
      }
      // The book ledge on the rear, and the kneeler in front of the row behind (low, on −z).
      box(m, [-X + 0.06, h - 0.32, zb], [X - 0.06, h - 0.29, b0 - 0.1], scale3(wood, 1.05), []);
      box(m, [-X + 0.06, 0.08, zb - 0.28], [X - 0.06, 0.16, zb - 0.12], tone, ['ny']);
    }
    // Bench ends: a solid board each side, its top rounded into a scroll (a few steps).
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -X : X - 0.06;
      const x1 = x0 + 0.06;
      box(m, [x0, 0, zb], [x1, h - 0.15, zf], tone, ['ny']);
      const steps = level === 0 ? 4 : 1;
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps;
        const t1 = (k + 1) / steps;
        const ya = h - 0.15 + 0.15 * Math.sin((t0 * Math.PI) / 2);
        const yb = h - 0.15 + 0.15 * Math.sin((t1 * Math.PI) / 2);
        box(m, [x0, h - 0.15, zb + (zf - zb) * (1 - t1) * 0.6], [x1, (ya + yb) / 2 + 0.0001, zb + (zf - zb) * (1 - t0) * 0.6], tone, ['ny']);
      }
    }
  }
  if (rows > 1 && level === 0) m.boxes = boxes;
  return m;
}

// ---------------------------------------------------------------- stained glass

/**
 * A stained-glass window drawn on both faces of the wall it is set in: the prop's depth is the wall's thickness and a
 * little more, so its ±z faces stand a hair proud of the wall's two faces (the wall is solid behind it: a window you
 * look at, not through). Each face: a stone surround, the lights filled with small panes of our own colours between
 * dark leading, a mullion and tracery. Shapes (`shape`): 'lancet' (a pointed arch on straight jambs, two lights under
 * a round tracery eye) and 'rose' (a wheel: a ring of petals round a round centre). `look`: `glass` (comma-separated
 * hex, the main colours), `fleck` (a few panes in these), `lead`, `stone`. Steady colours: no glow, nothing moves.
 * Collides as nothing (the wall it is set in does).
 */
export function stainedGlassMesh(seed, size, g, look, level) {
  const [w, hs, d] = size;
  // The shape stops a little under the size's top (its surround stands proud of the outline).
  const h = g.shape === 'rose' ? hs : hs - 0.08;
  const m = new Mesh();
  const r = rng(seed);
  const glass = (look.glass ?? '#1f3f8f,#27509e,#173273').split(',').map((c) => hex(c.trim()));
  const fleck = (look.fleck ?? '#b8862b,#8e2a2a,#3d7a46').split(',').map((c) => hex(c.trim()));
  const lead = hex(look.lead ?? '#26282c');
  const stone = hex(look.stone ?? '#d6d0c2');
  const band = g.surround ?? 0.18;
  const pane = g.pane ?? [0.22, 0.3];
  // Colours drawn once (the same pattern on both faces, mirrored).
  const colours = [];
  const pick = () => (r.next() < (g.flecks ?? 0.08) ? fleck[Math.floor(r.next() * fleck.length)] : scale3(glass[Math.floor(r.next() * glass.length)], 0.85 + r.next() * 0.3));
  for (let i = 0; i < 4096; i++) colours.push(pick());
  const shape = g.shape ?? 'lancet';
  for (const dir of [1, -1]) {
    const z = dir * (d / 2 - 0.025);
    const zs = z + dir * 0.012;
    // Mirrored on the back face, so the pattern reads the same from either side as a real window does.
    const fx = (x) => x * dir;
    const lights = [];
    const tracery = [];
    if (shape === 'rose') {
      const R = Math.min(w, h) / 2;
      const cy = h / 2;
      const seg = level === 0 ? 32 : 16;
      const outline = arcPts(0, cy, R - band, 0, TAU, seg).slice(0, seg);
      // The surround: a ring.
      const ring = arcPts(0, cy, R - band / 2, 0, TAU, seg);
      wallBand(m, ring.map(([x, y]) => [fx(x), y]), band, zs, dir, stone);
      if (level < 2) {
        // Petals: spokes from a round centre to the ring, and a smaller ring round the centre.
        const spokes = g.spokes ?? 12;
        for (let k = 0; k < spokes; k++) {
          const a = (k / spokes) * TAU;
          tracery.push([[0.26 * R * Math.cos(a), cy + 0.26 * R * Math.sin(a)], [(R - band) * Math.cos(a), cy + (R - band) * Math.sin(a)]]);
        }
        tracery.push(arcPts(0, cy, 0.26 * R, 0, TAU, seg / 2));
        tracery.push(arcPts(0, cy, 0.62 * R, 0, TAU, seg));
      }
      lights.push(outline);
    } else {
      // A pointed (equilateral) arch: two arcs of radius `w - 2 band` from the far springings.
      const ix = w / 2 - band;
      const spring = h - band - ix * Math.sqrt(3);
      const seg = level === 0 ? 10 : 4;
      const outline = [[-ix, band], [ix, band], [ix, spring], ...arcPts(-ix, spring, 2 * ix, 0, Math.PI / 3, seg).slice(1), ...arcPts(ix, spring, 2 * ix, (2 * Math.PI) / 3, Math.PI, seg).slice(1)];
      // The surround: jambs, sill and the arch, a band outside the outline.
      const ox = w / 2 - band / 2;
      const outer = [[-ox, band / 2], [ox, band / 2], [ox, spring], ...arcPts(-ox, spring, 2 * ox, 0, Math.PI / 3, seg).slice(1), ...arcPts(ox, spring, 2 * ox, (2 * Math.PI) / 3, Math.PI, seg).slice(1), [-ox, band / 2]];
      wallBand(m, outer.map(([x, y]) => [fx(x), y]), band, zs, dir, stone);
      if (level < 2) {
        // A mullion up the middle to the springing, and a round eye in the head over two pointed lights.
        const eyeR = ix * 0.42;
        const eyeY = spring + ix * 0.95;
        tracery.push([[0, band], [0, spring + ix * 0.35]]);
        tracery.push(arcPts(0, eyeY, eyeR, 0, TAU, level === 0 ? 16 : 8));
        tracery.push(arcPts(ix / 2 + ix / 2, spring, ix, Math.PI, (2 * Math.PI) / 3 - 0.05, 5));
        tracery.push(arcPts(-ix / 2 - ix / 2, spring, ix, 0, Math.PI / 3 + 0.05, 5));
        // A transom bar or two across the lights.
        for (const t of g.bars ?? [0.33, 0.66]) tracery.push([[-ix, band + (spring - band) * t], [ix, band + (spring - band) * t]]);
      }
      lights.push(outline);
    }
    // Leading behind the panes: the whole light in the lead colour.
    for (const L of lights) wallPoly(m, L.map(([x, y]) => [fx(x), y]), z + dir * 0.002, dir, lead);
    // The panes: a grid, each pane inside the light drawn a little smaller than its cell (the leading between).
    const [pw, ph] = level === 0 ? pane : level === 1 ? [pane[0] * 2.5, pane[1] * 2.5] : [w, h];
    let ci = 0;
    if (level < 2) {
      const L = lights[0];
      for (let y = 0; y < h; y += ph) {
        for (let x = -w / 2; x < w / 2; x += pw) {
          const c = colours[ci++ % colours.length];
          const gap = level === 0 ? 0.018 : 0.03;
          const x0 = x + gap;
          const x1 = x + pw - gap;
          const y0 = y + gap;
          const y1 = y + ph - gap;
          if (![[x0, y0], [x1, y0], [x1, y1], [x0, y1]].every(([a, b]) => inside(L, a, b))) continue;
          quadN(m, [fx(x0), y0, z + dir * 0.006], [fx(x1), y0, z + dir * 0.006], [fx(x1), y1, z + dir * 0.006], [fx(x0), y1, z + dir * 0.006], [0, 0, dir], c);
        }
      }
    } else {
      // Far: one colour over the leading.
      const mean = glass.reduce((a, c) => [a[0] + c[0] / glass.length, a[1] + c[1] / glass.length, a[2] + c[2] / glass.length], [0, 0, 0]);
      wallPoly(m, lights[0].map(([x, y]) => [fx(x), y]), z + dir * 0.006, dir, mix3(mean, lead, 0.3));
    }
    // Tracery and mullions in stone over the panes.
    for (const t of tracery) wallBand(m, t.map(([x, y]) => [fx(x), y]), 0.07, z + dir * 0.01, dir, scale3(stone, 0.95));
  }
  return m;
}

// ---------------------------------------------------------------- the altar

/**
 * An altar before a reredos: a stone altar `altar` ([w, h, d]) in front, a white cloth over its top falling a little at
 * each end, a frontal of cloth on its face (`frontal`), two plain candlesticks (no flame) on it; behind, a reredos, a
 * screen of pale stone with a row of blind arches and a plain cross over the middle, standing on a step. The front is
 * +z. Collides as the altar's box and the reredos's.
 */
export function altarMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const stone = hex(look.stone ?? '#ece7dc');
  const frontal = hex(look.frontal ?? '#2f5a3a');
  const cloth = hex(look.cloth ?? '#f3f1ea');
  const brass = hex(look.brass ?? '#b48a3c');
  const [aw, ah, ad] = g.altar ?? [2.2, 1.0, 0.85];
  const rt = g.reredos ?? 0.3;
  const Z = d / 2;
  const back = -Z;
  const az1 = Z - 0.02;
  const az0 = Z - ad;
  // The reredos: a screen the full width, `rt` deep, against the back.
  box(m, [-w / 2, 0, back], [w / 2, h, back + rt], stone, ['ny']);
  // The altar.
  box(m, [-aw / 2, 0, az0], [aw / 2, ah, az1], scale3(stone, 0.96), ['ny']);
  m.boxes = [[-w / 2, 0, back, w / 2, h, back + rt], [-aw / 2, 0, az0, aw / 2, ah, az1]];
  if (level >= 2) return m;
  // The cloth over its top, a little proud, hanging 0.25 m at each end; the frontal on its face.
  box(m, [-aw / 2 - 0.04, ah, az0 - 0.02], [aw / 2 + 0.04, ah + 0.02, az1 + 0.02], cloth, []);
  for (const s of [-1, 1]) box(m, [s < 0 ? -aw / 2 - 0.04 : aw / 2 + 0.02, ah - 0.25, az0 - 0.02], [s < 0 ? -aw / 2 - 0.02 : aw / 2 + 0.04, ah, az1 + 0.02], cloth, []);
  quadN(m, [-aw / 2 + 0.1, 0.12, az1 + 0.012], [aw / 2 - 0.1, 0.12, az1 + 0.012], [aw / 2 - 0.1, ah - 0.02, az1 + 0.012], [-aw / 2 + 0.1, ah - 0.02, az1 + 0.012], [0, 0, 1], frontal);
  if (level === 0) {
    // An orphrey: a gold band down the frontal's middle, and a plain cross on the reredos over the altar.
    quadN(m, [-0.08, 0.12, az1 + 0.016], [0.08, 0.12, az1 + 0.016], [0.08, ah - 0.02, az1 + 0.016], [-0.08, ah - 0.02, az1 + 0.016], [0, 0, 1], brass);
    const zr = back + rt + 0.01;
    box(m, [-0.06, ah + 0.7, zr - 0.01], [0.06, ah + 1.6, zr + 0.03], brass, ['nz']);
    box(m, [-0.3, ah + 1.25, zr - 0.01], [0.3, ah + 1.37, zr + 0.03], brass, ['nz']);
    // Blind arches along the reredos: shafts and round heads as raised strips.
    const n = g.arches ?? 7;
    const span = w / n;
    for (let k = 0; k < n; k++) {
      const cx = -w / 2 + span * (k + 0.5);
      if (Math.abs(cx) < span * 0.6) continue;
      const top = h - 0.5;
      wallBand(m, [[cx - span * 0.35, 0.3], [cx - span * 0.35, top - span * 0.35], ...arcPts(cx, top - span * 0.35, span * 0.35, Math.PI, 0, 6).slice(1), [cx + span * 0.35, 0.3]], 0.05, zr, 1, scale3(stone, 0.88));
    }
    box(m, [-w / 2, h - 0.2, back + rt], [w / 2, h, back + rt + 0.08], scale3(stone, 0.92), ['ny']);
    // Two candlesticks on the altar, plain, unlit.
    for (const s of [-1, 1]) {
      const at = [s * (aw / 2 - 0.3), ah + 0.02, az0 + 0.2];
      const c = new Mesh();
      lathe(c, [[0.08, 0], [0.07, 0.03], [0.025, 0.05], [0.02, 0.4], [0.05, 0.42], [0.05, 0.45], [0.022, 0.45], [0.022, 0.62]], 8, () => brass);
      for (let i = 0; i < c.P.length; i += 3) {
        c.P[i] += at[0];
        c.P[i + 1] += at[1];
        c.P[i + 2] += at[2];
      }
      append(m, c);
      cyl(m, 1, at[2], at[0], at[1] + 0.45, at[1] + 0.62, 0.02, 6, cloth, { caps: '1' });
    }
  }
  return m;
}

/** `sub` appended to `m` as it is. */
function append(m, sub) {
  const o = m.vertexCount;
  m.P.push(...sub.P);
  m.N.push(...sub.N);
  m.UV.push(...sub.UV);
  m.C.push(...sub.C);
  m.W.push(...sub.W);
  for (const i of sub.I) m.I.push(i + o);
}

// ---------------------------------------------------------------- the organ

/**
 * A pipe organ: a dark wood case on a plinth, three towers of front pipes (tall in the middle, shorter each side, in
 * graded rows), a cornice, and the console standing out in front (a bench, a music desk, two manuals as pale strips).
 * The front is +z. Collides as its box.
 */
export function organMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const r = rng(seed);
  const wood = hex(look.wood ?? '#3d2618');
  const pipe = hex(look.pipe ?? '#b9bcbf');
  const tone = woodTone(wood, r, look, seed);
  const X = w / 2;
  const Z = d / 2;
  const caseD = d - (g.console ?? 0.7);
  const cz1 = -Z + caseD;
  box(m, [-X, 0, -Z], [X, h * 0.3, cz1], tone, ['ny']);
  box(m, [-X, h * 0.3, -Z], [X, h - 0.25, cz1 - 0.15], tone, ['ny']);
  box(m, [-X, h - 0.25, -Z], [X, h, cz1 - 0.05], scale3(wood, 1.1), ['ny']);
  // The console: a cabinet with the manuals and a music desk, and the bench before it.
  box(m, [-0.8, 0, cz1], [0.8, 1.05, cz1 + 0.35], tone, ['ny']);
  if (level >= 2) return m;
  box(m, [-0.7, 0.75, cz1 + 0.35], [0.7, 0.8, cz1 + 0.5], hex('#e8e2d0'), ['ny']);
  box(m, [-0.7, 0.86, cz1 + 0.3], [0.7, 0.9, cz1 + 0.44], hex('#e8e2d0'), ['ny']);
  box(m, [-0.6, 0.45, Z - 0.23], [0.6, 0.5, Z], tone, []);
  for (const s of [-1, 1]) box(m, [s * 0.55 - 0.03, 0, Z - 0.22], [s * 0.55 + 0.03, 0.45, Z - 0.05], tone, ['ny']);
  // Three towers of pipes on the case's face.
  const towers = [[-X * 0.62, X * 0.36, 0.72], [0, X * 0.5, 1], [X * 0.62, X * 0.36, 0.72]];
  const pz = cz1 - 0.15 + 0.08;
  for (const [cx, half, tall] of towers) {
    const n = level === 0 ? Math.max(3, Math.round((half * 2) / 0.16)) : 3;
    for (let k = 0; k < n; k++) {
      const x = cx - half + (2 * half * (k + 0.5)) / n;
      const t = 1 - Math.abs((k + 0.5) / n - 0.5) * 0.8;
      const top = h * 0.3 + (h - 0.6 - h * 0.3) * tall * t;
      const pr = Math.min(0.065, half / n - 0.01);
      cyl(m, 1, pz, x, h * 0.3 + 0.18, top, pr, level === 0 ? 8 : 4, pipe, { caps: '1' });
      if (level === 0) {
        // The pipe's mouth: a dark notch near its foot, and a cone foot.
        quadN(m, [x - pr * 0.6, h * 0.3 + 0.32, pz + pr + 0.002], [x + pr * 0.6, h * 0.3 + 0.32, pz + pr + 0.002], [x + pr * 0.4, h * 0.3 + 0.42, pz + pr + 0.002], [x - pr * 0.4, h * 0.3 + 0.42, pz + pr + 0.002], [0, 0, 1], hex('#1b1c1e'));
      }
    }
  }
  return m;
}

// ---------------------------------------------------------------- our crest

/** The shield's outline (a heater shield), `W` across and `H` high with its top at y = H: [[x, y], …] counter-clockwise. */
function shieldOutline(W, H, n = 8) {
  const X = W / 2;
  const sideTo = H * 0.45;
  const pts = [[-X, H], [-X, sideTo]];
  // The lower sides curve in to the point.
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = (t * Math.PI) / 2;
    pts.push([-X * Math.cos(a), sideTo * (1 - Math.sin(a))]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    const a = (t * Math.PI) / 2;
    pts.push([X * Math.cos(a), sideTo * (1 - Math.sin(a))]);
  }
  pts.push([X, sideTo], [X, H]);
  // Counter-clockwise seen from +z: start at the top left, go down the left, round the point, up the right.
  return pts.reverse();
}

/** A five-pointed star centred (cx, cy), outer radius R, as triangles in a plane (via `emit(a, b, c)`). */
function star(cx, cy, R, emit) {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? R : R * 0.42;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  for (let k = 0; k < 10; k++) emit([cx, cy], pts[k], pts[(k + 1) % 10]);
}

/**
 * The game's own crest (no real school's): a heater shield, its upper part royal purple with two gold stars, a gold
 * chevron, below it silver with an open book in purple, a gold border. `form`: 'wall' (the shield on a dark board,
 * its back on −z, face +z) or 'floor' (a roundel inlaid in the floor: the shield in a stone field inside a purple band
 * with a gold laurel round it, a brass rim; lies flat, the top a hair over y = 0). `look`: `field` (the upper part),
 * `metal` (gold), `silver`, `ring` (the band), `stone` (the roundel's field), `board`. Collides as nothing.
 */
export function crestMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const field = hex(look.field ?? '#4b2a84');
  const metal = hex(look.metal ?? '#c9a23a');
  const silver = hex(look.silver ?? '#dcdcd4');
  const floor = g.form === 'floor';
  // A drawing plane: (u, v) to 3D and the facing.
  let P;
  let want;
  let layer;
  let S;
  if (floor) {
    const R = Math.min(w, d) / 2;
    want = [0, 1, 0];
    layer = (k) => 0.002 + k * 0.002;
    P = (u, v, k) => [u, layer(k), -v];
    // The roundel: brass rim, purple band, stone field, laurel.
    const seg = level === 0 ? 48 : level === 1 ? 24 : 12;
    const rings = [[R, hex(look.rim ?? '#a8823a')], [R * 0.94, hex(look.ring ?? '#3a2266')], [R * 0.72, hex(look.stone ?? '#d9d3c4')]];
    rings.forEach(([rr, c], k) => {
      const pts = arcPts(0, 0, rr, 0, TAU, seg).slice(0, seg);
      floorPoly(m, pts, layer(k), c);
    });
    if (level < 2) {
      // The laurel: leaves in a ring in the band, two branches meeting at the foot.
      const n = level === 0 ? 28 : 12;
      for (let i = 0; i < n; i++) {
        const side = i < n / 2 ? -1 : 1;
        const t = (i % (n / 2)) / (n / 2);
        const a = -Math.PI / 2 + side * (0.15 + t * 2.6);
        const rr = R * 0.83;
        const cx = rr * Math.cos(a);
        const cy = rr * Math.sin(a);
        const ta = a + side * Math.PI / 2;
        const L = R * 0.09;
        const p0 = [cx - (Math.cos(ta) * L) / 2, cy - (Math.sin(ta) * L) / 2];
        const p1 = [cx + (Math.cos(ta) * L) / 2, cy + (Math.sin(ta) * L) / 2];
        const nx = -Math.sin(ta) * L * 0.3;
        const ny = Math.cos(ta) * L * 0.3;
        for (const s of [1, -1]) triN(m, P(p0[0], p0[1], 3), P(p1[0], p1[1], 3), P((p0[0] + p1[0]) / 2 + s * nx, (p0[1] + p1[1]) / 2 + s * ny, 3), want, metal);
      }
    }
    S = { W: R * 0.86, H: R * 1.0, y0: -R * 0.52, k: 4 };
  } else {
    want = [0, 0, 1];
    const back = -d / 2;
    layer = (k) => back + 0.03 + k * 0.004;
    P = (u, v, k) => [u, v, layer(k)];
    box(m, [-w / 2, 0, back], [w / 2, h, back + 0.03], hex(look.board ?? '#3b2618'), ['nz']);
    S = { W: w * 0.82, H: h * 0.86, y0: h * 0.07, k: 0 };
  }
  // The shield: border (gold), then the silver field, the purple chief over the chevron, the chevron, stars, the book.
  const { W, H, y0, k } = S;
  const at = (x, y, kk) => P(x, y0 + y, kk);
  const poly = (pts, kk, c) => {
    for (let i = 1; i + 1 < pts.length; i++) triN(m, at(...pts[0], kk), at(...pts[i], kk), at(...pts[i + 1], kk), want, c);
  };
  const outline = shieldOutline(W, H, level === 0 ? 8 : 4);
  poly(outline, k, metal);
  const inner = shieldOutline(W * 0.88, H * 0.9, level === 0 ? 8 : 4).map(([x, y]) => [x, y + H * 0.06]);
  poly(inner, k + 1, silver);
  if (level >= 2) return m;
  const X = (W * 0.88) / 2;
  const top = H * 0.96;
  // The chevron: from the lower sides up to a peak in the middle; the chief above it purple.
  const cw = H * 0.09;
  const peak = H * 0.62;
  const foot = H * 0.36;
  const tri3 = (a, b, c, kk, col) => triN(m, at(...a, kk), at(...b, kk), at(...c, kk), want, col);
  // The chief: the part over the chevron's top edge (three triangles: the notch under the peak).
  tri3([-X, top], [X, top], [0, peak + cw], k + 2, field);
  tri3([X, top], [X, foot + cw], [0, peak + cw], k + 2, field);
  tri3([-X, top], [0, peak + cw], [-X, foot + cw], k + 2, field);
  // The chevron's two arms.
  for (const s of [-1, 1]) {
    const a = [s * X, foot];
    const b = [s * X, foot + cw];
    const c = [0, peak + cw];
    const e = [0, peak];
    tri3(a, b, c, k + 3, metal);
    tri3(a, c, e, k + 3, metal);
  }
  // Two stars in the chief.
  for (const s of [-1, 1]) star(s * X * 0.48, H * 0.8, H * 0.085, (a, b, c) => tri3(a, b, c, k + 4, metal));
  // The open book under the chevron: two pages tilted up to the spine, purple, a gold edge.
  const bw = X * 0.42;
  const by = H * 0.2;
  const bh = H * 0.13;
  for (const s of [-1, 1]) {
    const pts = [[0, by], [s * bw, by + bh * 0.25], [s * bw, by + bh * 1.25], [0, by + bh]];
    const P0 = s > 0 ? pts : pts.slice().reverse();
    tri3(P0[0], P0[1], P0[2], k + 4, field);
    tri3(P0[0], P0[2], P0[3], k + 4, field);
  }
  tri3([-0.012 * W, by - 0.01], [0.012 * W, by - 0.01], [0.012 * W, by + bh + 0.01], k + 5, metal);
  tri3([-0.012 * W, by - 0.01], [0.012 * W, by + bh + 0.01], [-0.012 * W, by + bh + 0.01], k + 5, metal);
  return m;
}

// ---------------------------------------------------------------- the trophy case

/**
 * A glass-fronted trophy case: a wood cabinet base with doors, a display above it (a dark lining, two glass shelves,
 * cups and shields on them), a cornice; the glass is drawn as its frame and glazing bars only (the cups show). The
 * front is +z. Collides as its box.
 */
export function trophyCaseMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const r = rng(seed);
  const wood = hex(look.wood ?? '#4a2c1a');
  const lining = hex(look.lining ?? '#2b1d3d');
  const gold = hex(look.gold ?? '#c9a23a');
  const silverC = hex(look.silver ?? '#c2c5c8');
  const tone = woodTone(wood, r, look, seed);
  const X = w / 2;
  const Z = d / 2;
  const baseH = g.base ?? 0.8;
  box(m, [-X, 0, -Z], [X, baseH, Z], tone, ['ny']);
  box(m, [-X, h - 0.12, -Z], [X, h, Z], scale3(wood, 1.1), ['ny']);
  if (level >= 2) {
    box(m, [-X, baseH, -Z], [X, h - 0.12, Z - 0.05], lining, ['ny']);
    return m;
  }
  // The display: lining at the back and sides, its floor and two shelves.
  quadN(m, [-X + 0.05, baseH, -Z + 0.04], [X - 0.05, baseH, -Z + 0.04], [X - 0.05, h - 0.12, -Z + 0.04], [-X + 0.05, h - 0.12, -Z + 0.04], [0, 0, 1], lining);
  box(m, [-X, baseH, -Z], [-X + 0.05, h - 0.12, Z], tone, []);
  box(m, [X - 0.05, baseH, -Z], [X, h - 0.12, Z], tone, []);
  const shelves = [baseH, baseH + (h - baseH - 0.12) * 0.36, baseH + (h - baseH - 0.12) * 0.68];
  for (const y of shelves.slice(1)) box(m, [-X + 0.05, y - 0.012, -Z + 0.04], [X - 0.05, y, Z - 0.04], hex('#b9cbd0'), []);
  // The front: a frame and glazing bars.
  const fz = Z - 0.02;
  for (const x of [-X + 0.03, 0, X - 0.03]) box(m, [x - 0.03, baseH, fz - 0.02], [x + 0.03, h - 0.12, fz + 0.02], tone, []);
  box(m, [-X, baseH, fz - 0.02], [X, baseH + 0.05, fz + 0.02], tone, []);
  // Cups and shields on each shelf.
  for (const [si, y] of shelves.entries()) {
    const n = level === 0 ? 4 : 2;
    for (let k = 0; k < n; k++) {
      const x = -X + 0.25 + ((w - 0.5) * (k + 0.5)) / n + r.range(-0.05, 0.05);
      const col = (k + si) % 3 === 2 ? silverC : gold;
      if ((k + si) % 4 === 3) {
        // A shield on a stand: a small plaque leaning on the lining.
        box(m, [x - 0.12, y, -Z + 0.06], [x + 0.12, y + 0.3, -Z + 0.09], tone, []);
        box(m, [x - 0.08, y + 0.06, -Z + 0.09], [x + 0.08, y + 0.24, -Z + 0.095], col, []);
        continue;
      }
      const s = 0.7 + r.next() * 0.6;
      const c = new Mesh();
      lathe(c, [[0.07 * s, 0], [0.06 * s, 0.04 * s], [0.02 * s, 0.06 * s], [0.018 * s, 0.14 * s], [0.06 * s, 0.17 * s], [0.09 * s, 0.26 * s], [0.085 * s, 0.27 * s]], level === 0 ? 8 : 5, () => col);
      for (let i = 0; i < c.P.length; i += 3) {
        c.P[i] += x;
        c.P[i + 1] += y;
        c.P[i + 2] += -Z + 0.22;
      }
      append(m, c);
    }
  }
  return m;
}

// ---------------------------------------------------------------- the honours board

/**
 * An honours board for a corridor wall: a portrait in a gilt frame between two bronze plaques. The portrait is a dark
 * oil of a figure seen as a head-and-shoulders shape against a warm ground (no face, nobody real); the plaques are cast
 * bronze with a raised border and lines of relief standing for lettering (no words). Its back on −z, face +z. Collides
 * as nothing.
 */
export function honoursMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const r = rng(seed);
  const gilt = hex(look.gilt ?? '#b08d3e');
  const bronze = hex(look.bronze ?? '#6e4f2a');
  const dark = hex(look.ground ?? '#3a2a1c');
  const figure = hex(look.figure ?? '#1d1a18');
  const back = -d / 2;
  const front = d / 2 - 0.006;
  const [pw, ph] = g.portrait ?? [0.8, 1.05];
  const py = (h - ph) / 2;
  // The portrait: frame, canvas, the figure (shoulders and a head as plain shapes).
  box(m, [-pw / 2, py, back], [pw / 2, py + ph, front], gilt, ['nz']);
  if (level >= 2) {
    for (const s of [-1, 1]) box(m, [s * (w / 2) - (s > 0 ? 0.5 : 0), py + 0.15, back], [s * (w / 2) + (s < 0 ? 0.5 : 0), py + ph - 0.15, front - 0.02], bronze, ['nz']);
    return m;
  }
  const f = 0.08;
  quadN(m, [-pw / 2 + f, py + f, front + 0.002], [pw / 2 - f, py + f, front + 0.002], [pw / 2 - f, py + ph - f, front + 0.002], [-pw / 2 + f, py + ph - f, front + 0.002], [0, 0, 1], dark);
  const zf = front + 0.004;
  const cx = 0;
  const sh = py + f + 0.02;
  quadN(m, [cx - 0.26, sh, zf], [cx + 0.26, sh, zf], [cx + 0.18, sh + 0.32, zf], [cx - 0.18, sh + 0.32, zf], [0, 0, 1], figure);
  const head = arcPts(cx, sh + 0.5, 0.13, 0, TAU, level === 0 ? 14 : 8).slice(0, -1);
  for (let i = 1; i + 1 < head.length; i++) triN(m, [head[0][0], head[0][1], zf], [head[i][0], head[i][1], zf], [head[i + 1][0], head[i + 1][1], zf], [0, 0, 1], scale3(figure, 1.6));
  // The plaques either side.
  const qw = g.plaque?.[0] ?? 0.5;
  const qh = g.plaque?.[1] ?? 0.7;
  for (const s of [-1, 1]) {
    const qx = s * (pw / 2 + 0.15 + qw / 2);
    if (Math.abs(qx) + qw / 2 > w / 2 + 1e-6) continue;
    const qy = py + (ph - qh) / 2;
    box(m, [qx - qw / 2, qy, back], [qx + qw / 2, qy + qh, back + d * 0.6], bronze, ['nz']);
    // Raised border and relief lines.
    const bz = back + d * 0.6 + 0.004;
    wallBand(m, [[qx - qw / 2 + 0.03, qy + 0.03], [qx + qw / 2 - 0.03, qy + 0.03], [qx + qw / 2 - 0.03, qy + qh - 0.03], [qx - qw / 2 + 0.03, qy + qh - 0.03], [qx - qw / 2 + 0.03, qy + 0.03]], 0.02, bz, 1, scale3(bronze, 1.5));
    if (level === 0) {
      const lines = g.lines ?? 7;
      for (let k = 0; k < lines; k++) {
        const y = qy + qh - 0.1 - k * ((qh - 0.18) / lines);
        const len = (qw - 0.14) * (k === 0 ? 0.7 : 0.5 + r.next() * 0.45);
        quadN(m, [qx - len / 2, y - 0.012, bz], [qx + len / 2, y - 0.012, bz], [qx + len / 2, y + 0.012, bz], [qx - len / 2, y + 0.012, bz], [0, 0, 1], scale3(bronze, 1.35));
      }
    }
  }
  return m;
}

// ---------------------------------------------------------------- the gym's vault bay

/**
 * One 8 m bay of a barrel-vaulted hall's roof (the gym, photos 2 and 3): the vault's boarded underside across the room
 * from springing to springing (x), a segmental arch `rise` high, the length of the bay (z), boards drawn along it;
 * a steel bowstring truss across the bay's middle (a curved top chord under the boards, a straight tie, a zigzag of
 * webs, plates where it bears on the walls); `lamps` pendant lamp shades hung from the tie (looks only: a set piece's
 * light gives the light). Place it with its foot at the walls' springing height. Drawn from inside (the boards face
 * down); the room's own roof covers it. Collides as nothing.
 */
export function vaultBayMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const boards = hex(look.boards ?? '#c9a77a');
  const steel = hex(look.steel ?? '#3c4045');
  const shade = hex(look.shade ?? '#2c2f33');
  const X = w / 2;
  const Z = d / 2;
  const rise = Math.min(g.rise ?? h - 0.1, h);
  const R = (X * X + rise * rise) / (2 * rise);
  const yc = rise - R;
  const n = level === 0 ? 24 : level === 1 ? 12 : 6;
  const a0 = Math.asin(X / R);
  const at = (t, rr = R) => {
    const a = -a0 + 2 * a0 * t;
    return [rr * Math.sin(a), yc + rr * Math.cos(a)];
  };
  // The boards: strips along z, facing down into the room, in two tones by turns.
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i / n);
    const [x1, y1] = at((i + 1) / n);
    const c = level === 0 && i % 2 ? scale3(boards, 0.9) : boards;
    quadN(m, [x0, y0, -Z], [x1, y1, -Z], [x1, y1, Z], [x0, y0, Z], [-(x0 + x1) / 2, yc - (y0 + y1) / 2, 0], c);
    if (level === 0) {
      // Joints between boards: thin dark lines along z at each quarter of a strip.
      for (const t of [0.5]) {
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        const nx = -x / R;
        const ny = (yc - y) / R;
        quadN(m, [x - 0.01 * ny + nx * 0.003, y + 0.01 * nx + ny * 0.003, -Z], [x + 0.01 * ny + nx * 0.003, y - 0.01 * nx + ny * 0.003, -Z], [x + 0.01 * ny + nx * 0.003, y - 0.01 * nx + ny * 0.003, Z], [x - 0.01 * ny + nx * 0.003, y + 0.01 * nx + ny * 0.003, Z], [nx, ny, 0], scale3(boards, 0.6));
      }
    }
  }
  if (level >= 2) return m;
  // The truss across the middle: a top chord 0.15 m under the boards, a tie `tie` m up, webs between.
  const tie = g.tie ?? 0.5;
  const t = 0.12;
  const zt = g.at ?? 0;
  const k = level === 0 ? 16 : 8;
  const chord = Array.from({ length: k + 1 }, (_, i) => at(i / k, R - 0.2)).map(([x, y]) => [x, Math.max(y, 0.1)]);
  for (let i = 0; i < k; i++) bar(m, [chord[i][0], chord[i][1], zt], [chord[i + 1][0], chord[i + 1][1], zt], t, steel);
  bar(m, [-X + 0.3, tie, zt], [X - 0.3, tie, zt], t * 0.8, steel, { ends: true });
  for (let i = 1; i < k; i++) {
    const [x, y] = chord[i];
    const xb = chord[i + (i % 2 ? 1 : -1)][0];
    if (y - tie < 0.15) continue;
    bar(m, [x, y, zt], [xb, tie, zt], t * 0.5, steel);
  }
  for (const s of [-1, 1]) box(m, [s > 0 ? X - 0.3 : -X, 0, zt - 0.15], [s > 0 ? X : -X + 0.3, 0.4, zt + 0.15], steel, []);
  // Pendant lamps hung from the tie on rods.
  const lamps = g.lamps ?? 4;
  for (let i = 0; i < lamps; i++) {
    const x = -X + (w * (i + 0.5)) / lamps;
    const drop = g.drop ?? 1.2;
    bar(m, [x, tie, zt + 0.6], [x, tie - drop, zt + 0.6], 0.03, steel);
    const c = new Mesh();
    lathe(c, [[0.04, 0.3], [0.12, 0.26], [0.3, 0.02], [0.32, 0]], level === 0 ? 10 : 6, () => shade);
    for (let j = 0; j < c.P.length; j += 3) {
      c.P[j] += x;
      c.P[j + 1] += tie - drop - 0.3;
      c.P[j + 2] += zt + 0.6;
    }
    append(m, c);
    // The lamp's underside: a pale disc (not lit: the light part shines).
    const discPts = arcPts(0, 0, 0.3, 0, TAU, 8).slice(0, 8);
    for (let j = 1; j + 1 < discPts.length; j++) triN(m, [x + discPts[0][0], tie - drop - 0.29, zt + 0.6 + discPts[0][1]], [x + discPts[j][0], tie - drop - 0.29, zt + 0.6 + discPts[j][1]], [x + discPts[j + 1][0], tie - drop - 0.29, zt + 0.6 + discPts[j + 1][1]], [0, -1, 0], hex('#e9e4d4'));
  }
  return m;
}

// ---------------------------------------------------------------- bleachers

/**
 * A run of bleachers: `tiers` steps rising to the back (−z), each `rise` up and `run` deep, a wood plank seat along each
 * step's front, steel risers, end frames. Walked up as stairs (each step no taller than a player steps): it collides as
 * one box a tier, stacked (`bounds: "within"`).
 */
export function bleacherMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const r = rng(seed);
  const plank = hex(look.plank ?? '#c79b62');
  const steel = hex(look.steel ?? '#6b7077');
  const tiers = g.tiers ?? 4;
  const rise = (h - 0.04) / tiers;
  const run = d / tiers;
  const X = w / 2;
  const Z = d / 2;
  const boxes = [];
  for (let i = 0; i < tiers; i++) {
    const top = rise * (i + 1);
    const zf = Z - run * i;
    boxes.push([-X, 0, -Z, X, top, zf]);
    const tone = woodTone(plank, r, look, seed + i);
    // The step: its riser (steel) and its tread (planks).
    quadN(m, [-X, top - rise, zf], [X, top - rise, zf], [X, top, zf], [-X, top, zf], [0, 0, 1], steel);
    quadN(m, [-X, top, zf], [X, top, zf], [X, top, zf - run], [-X, top, zf - run], [0, 1, 0], tone);
    if (level === 0) {
      // The seat plank along the tread's front, standing a little proud.
      box(m, [-X + 0.05, top, zf - 0.32], [X - 0.05, top + 0.04, zf - 0.02], scale3(plank, 1.08), ['ny']);
      // Plank joints across the tread.
      for (let x = -X + 2; x < X - 0.5; x += 2) quadN(m, [x - 0.01, top + 0.002, zf], [x + 0.01, top + 0.002, zf], [x + 0.01, top + 0.002, zf - run], [x - 0.01, top + 0.002, zf - run], [0, 1, 0], scale3(plank, 0.6));
    }
  }
  // The ends: steel side frames stepping up, and the back.
  for (const s of [-1, 1]) {
    for (let i = 0; i < tiers; i++) {
      const top = rise * (i + 1);
      const zf = Z - run * i;
      quadN(m, [s * X, 0, zf], [s * X, 0, zf - run], [s * X, top, zf - run], [s * X, top, zf], [s, 0, 0], steel);
    }
  }
  quadN(m, [-X, 0, -Z], [X, 0, -Z], [X, rise * tiers, -Z], [-X, rise * tiers, -Z], [0, 0, -1], steel);
  if (level === 0) m.boxes = boxes;
  return m;
}

// ---------------------------------------------------------------- the court's lines

/**
 * A basketball court's lines painted on a floor (`court`: [length along x, width along z]): the outline, the centre
 * line and circle, at each end the key (filled in `key` colour) with its free-throw circle, the three-point line (an
 * arc on short straights), a small box under the basket. Lies on the floor, a hair over it. Collides as nothing.
 */
export function courtLinesMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const line = hex(look.line ?? '#f2f0ea');
  const keyC = look.key ? hex(look.key) : null;
  const [L, W] = g.court ?? [w - 0.2, d - 0.2];
  const lw = g.width ?? 0.05;
  const y = h * 0.5;
  const yk = h * 0.25;
  const X = L / 2;
  const Zs = W / 2;
  const seg = level === 0 ? 24 : 10;
  floorBand(m, [[-X, -Zs], [X, -Zs], [X, Zs], [-X, Zs], [-X, -Zs]], lw, y, line);
  floorBand(m, [[0, -Zs], [0, Zs]], lw, y, line);
  floorBand(m, arcPts(0, 0, 1.8, 0, TAU, seg), lw, y, line);
  if (keyC) floorPoly(m, arcPts(0, 0, 1.8, 0, TAU, seg).slice(0, seg), yk, keyC);
  for (const s of [-1, 1]) {
    const kx = s * X;
    const kd = 5.8;
    const kw = 2.45;
    // The key: filled, then its outline.
    const key = [[kx, -kw], [kx - s * kd, -kw], [kx - s * kd, kw], [kx, kw]];
    if (keyC) floorPoly(m, key, yk, keyC);
    floorBand(m, [[kx, -kw], [kx - s * kd, -kw], [kx - s * kd, kw], [kx, kw]], lw, y, line);
    // The free-throw circle at the key's top.
    floorBand(m, arcPts(kx - s * kd, 0, 1.8, 0, TAU, seg), lw, y, line);
    // The three-point line: straights 0.9 m in from the sides, then an arc round the basket (1.575 m from the end).
    const bx = kx - s * 1.575;
    const R = 6.75;
    const zs = Zs - 0.9;
    const ang = Math.asin(zs / R);
    const xs = bx - s * R * Math.cos(ang);
    floorBand(m, [[kx, -zs], [xs, -zs]], lw, y, line);
    floorBand(m, [[kx, zs], [xs, zs]], lw, y, line);
    const arc = arcPts(bx, 0, R, s > 0 ? Math.PI + ang : -ang, s > 0 ? Math.PI - ang : ang, seg);
    floorBand(m, arc, lw, y, line);
  }
  // Floorboard joints are the floor's own; nothing else.
  void seed;
  return m;
}

// ---------------------------------------------------------------- the wall hoop

/**
 * A basketball hoop on a wall bracket (the gym's end walls): a steel frame from the wall (−z) out to a backboard
 * `reach` m from it, the board (white with a dark target square), an orange rim at 3.05 m with a net of cords. Collides
 * as nothing (it hangs over the court's end, above everyone's head).
 */
export function hoopMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const steel = hex(look.steel ?? '#4a4f55');
  const board = hex(look.board ?? '#f1f1ee');
  const rimC = hex(look.rim ?? '#d0571f');
  const netC = hex(look.net ?? '#eeeeea');
  const back = -d / 2;
  const reach = g.reach ?? d - 0.6;
  const bz = back + reach;
  const [bw, bh] = g.board ?? [1.8, 1.05];
  const by = g.boardY ?? 2.9;
  const rimY = 3.05;
  // The backboard (a thin box), its frame, the target square.
  box(m, [-bw / 2, by, bz - 0.04], [bw / 2, by + bh, bz], board, []);
  // The bracket: a plate on the wall and four struts to the board's back.
  box(m, [-0.5, by - 0.2, back], [0.5, by + bh + 0.1, back + 0.05], steel, ['nz']);
  for (const [sx, sy] of [[-0.4, by], [0.4, by], [-0.4, by + bh * 0.8], [0.4, by + bh * 0.8]]) bar(m, [sx, sy, back + 0.05], [sx * 0.8, sy, bz - 0.04], 0.06, steel);
  if (level >= 2) return m;
  wallBand(m, [[-0.3, by + 0.15], [0.3, by + 0.15], [0.3, by + 0.6], [-0.3, by + 0.6], [-0.3, by + 0.15]], 0.05, bz + 0.002, 1, hex('#1d1f22'));
  wallBand(m, [[-bw / 2, by], [bw / 2, by], [bw / 2, by + bh], [-bw / 2, by + bh], [-bw / 2, by]], 0.05, bz + 0.002, 1, hex('#1d1f22'));
  // The rim: a ring of short bars 0.23 m round, its back 0.15 m off the board.
  const rr = 0.23;
  const cz = bz + 0.15 + rr;
  const n = level === 0 ? 16 : 8;
  const ring = arcPts(0, cz, rr, 0, TAU, n);
  for (let i = 0; i < n; i++) bar(m, [ring[i][0], rimY, ring[i][1]], [ring[i + 1][0], rimY, ring[i + 1][1]], 0.02, rimC);
  bar(m, [0, rimY, bz], [0, rimY, cz - rr], 0.04, rimC);
  // The net: cords from the rim down to a smaller ring.
  if (level === 0) {
    const lower = arcPts(0, cz, rr * 0.6, 0, TAU, n);
    for (let i = 0; i < n; i++) {
      bar(m, [ring[i][0], rimY, ring[i][1]], [lower[(i + 1) % n][0], rimY - 0.42, lower[(i + 1) % n][1]], 0.012, netC);
      bar(m, [ring[i + 1][0], rimY, ring[i + 1][1]], [lower[i][0], rimY - 0.42, lower[i][1]], 0.012, netC);
    }
  }
  void w;
  void h;
  void seed;
  return m;
}

// ---------------------------------------------------------------- a pool's lanes

/**
 * A pool's lanes (`lanes` across z): lane ropes floating at the water's surface (the prop's top) between the lanes,
 * floats in bands of colour (`colours`, with `ends` near each wall), the lane lines on the floor (dark tile stripes
 * with a T at each end), and a target cross on each end wall. Its foot is the pool's floor; place it in the basin with
 * the water's surface at its top. Collides as nothing (the water and the basin do the work).
 */
export function poolLanesMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const m = new Mesh();
  const X = w / 2;
  const Z = d / 2;
  const lanes = g.lanes ?? 4;
  const lw = d / lanes;
  const stripe = hex(look.stripe ?? '#1d2a44');
  const cols = (look.colours ?? '#d33b2c,#f2f0ea,#2a5bd7').split(',').map((c) => hex(c.trim()));
  const endC = hex(look.ends ?? '#d33b2c');
  const ropeY = h - 0.06;
  // Lane lines on the floor: a stripe down the middle of each lane, a T near each end; targets on the end walls.
  for (let i = 0; i < lanes; i++) {
    const z = -Z + lw * (i + 0.5);
    floorPoly(m, [[-X + 2, z - 0.12], [X - 2, z - 0.12], [X - 2, z + 0.12], [-X + 2, z + 0.12]], 0.005, stripe);
    if (level >= 2) continue;
    for (const s of [-1, 1]) {
      floorPoly(m, [[s * (X - 2) - 0.5, z - 0.5], [s * (X - 2) + 0.5, z - 0.5], [s * (X - 2) + 0.5, z + 0.5], [s * (X - 2) - 0.5, z + 0.5]], 0.004, stripe);
      // The target on the end wall (x = ±X), facing into the pool.
      const fx = s * (X - 0.003);
      quadN(m, [fx, 0.3, z - 0.12], [fx, 0.3, z + 0.12], [fx, h - 0.3, z + 0.12], [fx, h - 0.3, z - 0.12], [-s, 0, 0], stripe);
      quadN(m, [fx, h - 0.75, z - 0.5], [fx, h - 0.75, z + 0.5], [fx, h - 0.55, z + 0.5], [fx, h - 0.55, z - 0.5], [-s, 0, 0], stripe);
    }
  }
  // The ropes between lanes: a square section 0.1 m across, banded in colour along x.
  const band = level === 0 ? 0.5 : 2;
  for (let i = 1; i < lanes; i++) {
    const z = -Z + lw * i;
    const n = Math.max(2, Math.round(w / band));
    for (let k = 0; k < n; k++) {
      const x0 = -X + (w * k) / n;
      const x1 = -X + (w * (k + 1)) / n;
      const near = Math.min(Math.abs(x0 + X), Math.abs(X - x1)) < 5;
      const c = near ? endC : cols[k % cols.length];
      const t = 0.05;
      quadN(m, [x0, ropeY + t, z - t], [x1, ropeY + t, z - t], [x1, ropeY + t, z + t], [x0, ropeY + t, z + t], [0, 1, 0], c);
      quadN(m, [x0, ropeY - t, z + t], [x1, ropeY - t, z + t], [x1, ropeY + t, z + t], [x0, ropeY + t, z + t], [0, 0, 1], c);
      quadN(m, [x0, ropeY - t, z - t], [x1, ropeY - t, z - t], [x1, ropeY + t, z - t], [x0, ropeY + t, z - t], [0, 0, -1], c);
      if (level === 0) quadN(m, [x0, ropeY - t, z - t], [x1, ropeY - t, z - t], [x1, ropeY - t, z + t], [x0, ropeY - t, z + t], [0, -1, 0], scale3(c, 0.7));
    }
  }
  void seed;
  return m;
}
