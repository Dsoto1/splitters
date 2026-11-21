// School pieces (kit-prop families `board` and the classroom's `table`; docs/map-briefs/st_johns, step 5): a wall
// chalkboard, a pull-down projector screen, an outdoor notice board under a little shingle roof (photo 19), and a row of
// four school desks with their chairs. All generated here from seeds: nothing downloaded, nothing drawn from a
// photograph, no writing or school mark of anyone's (the chalk is a few strokes, the notices blank coloured sheets).
// Nothing glows or blinks: the boards are matt, the screen a plain pale sheet.
//
// The chalkboard (`chalkboard`) hangs on a wall: its back on the prop's −z face, its writing face +z; a wooden frame,
// the slate set back in it, a chalk ledge along the foot standing out, chalk and a duster on the ledge. A still prop
// that collides as nothing (`collide: "none"`): it is thinner than the wall it hangs on. The screen (`screen`) is a
// roller case under the ceiling with the sheet pulled part way down, a weighted bar and a pull cord; its back on −z,
// nothing collides. The notice board (`noticeboard`) stands on two posts: a framed board with pinned sheets, a gabled
// roof of shingles over it; it collides as its box. The desk row (`schooldesks`) is four single desks along x, two
// each side of an aisle (`aisle`), each on a steel frame with a book shelf under the top, a chair pushed in at each on
// +z (students face −z); it collides as the four desks' boxes; the chairs, pushed in, do not (`bounds: "within"`).
//
// Level 1 keeps the outline (frame and slate; case and sheet; posts, board and roof; tops, frames and chairs as
// blocks); level 2 is a few boxes.

import { rng } from '../env/rng.mjs';
import { Mesh, annulus, box, cyl, hex, quad, scale3, tri } from './geom.mjs';
import { woodTone } from './crate.mjs';
import { seatMesh } from './furniture.mjs';

/** `sub` appended to `m` turned `turn` quarter turns about +Y (local +x to −z, as a prop's yaw) and moved by `at`. */
function placeMesh(m, sub, turn, at) {
  const c = [1, 0, -1, 0][turn & 3];
  const s = [0, 1, 0, -1][turn & 3];
  const o = m.vertexCount;
  for (let i = 0; i < sub.P.length; i += 3) {
    const [x, y, z] = [sub.P[i], sub.P[i + 1], sub.P[i + 2]];
    const [nx, ny, nz] = [sub.N[i], sub.N[i + 1], sub.N[i + 2]];
    m.P.push(at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c);
    m.N.push(nx * c + nz * s, ny, -nx * s + nz * c);
  }
  m.UV.push(...sub.UV);
  m.C.push(...sub.C);
  m.W.push(...sub.W);
  for (const i of sub.I) m.I.push(i + o);
}

// ---------------------------------------------------------------- the chalkboard

/**
 * A wall chalkboard. Settings `g`: `frame` (the frame's width, m), `ledge` (how far the chalk ledge stands out, m),
 * `strokes` (chalk strokes on the slate; 0 for a clean board). `look`: `slate` (the board), `frame` (wood or metal),
 * `chalk` (the strokes' colour), `jitter`, `grime`. A white board is a pale slate with a metal frame.
 */
export function chalkboardMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const back = -d / 2;
  const front = back + 0.035;
  const fw = g.frame ?? 0.05;
  const ledge = Math.min(g.ledge ?? 0.06, d - 0.035);
  const slate = hex(look.slate);
  const frameC = hex(look.frame);
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const ly = 0.05;
  if (level >= 2) {
    box(m, [-X, ly, back], [X, h, front], scale3(slate, 1.4), ['nz']);
    box(m, [-X, 0, back], [X, ly, back + ledge + 0.035], frameC, ['nz']);
    return m;
  }
  // The slate, set back in its frame.
  quad(m, [-X + fw, ly + fw, front - 0.012], [X - fw, ly + fw, front - 0.012], [X - fw, h - fw, front - 0.012], [-X + fw, h - fw, front - 0.012], (p) => scale3(slate, 1 + 0.08 * Math.sin(p[0] * 3.1 + p[1] * 1.7)));
  // The frame: rails top and bottom, stiles each side.
  const fc = tone(frameC, 1);
  box(m, [-X, h - fw, back], [X, h, front], fc, ['nz']);
  box(m, [-X, ly, back], [X, ly + fw, front], fc, ['nz']);
  box(m, [-X, ly + fw, back], [-X + fw, h - fw, front], fc, ['nz', 'ny', 'py']);
  box(m, [X - fw, ly + fw, back], [X, h - fw, front], fc, ['nz', 'ny', 'py']);
  // The ledge along the foot, standing out from the frame.
  box(m, [-X, 0, back], [X, ly, front + ledge], tone(scale3(frameC, 0.9), 2), ['nz']);
  if (level === 0) {
    // Chalk on the ledge (two sticks and a duster), and a few strokes on the slate: steady, pale, no words.
    const chalk = hex(look.chalk ?? '#e8e6dc');
    for (let i = 0; i < 2; i++) {
      const x = -X * 0.5 + r.range(-0.3, 0.3) + i * 0.12;
      box(m, [x, ly, front + 0.01], [x + 0.08, ly + 0.012, front + 0.022], chalk, ['ny']);
    }
    const dx = X * 0.45 + r.range(-0.2, 0.2);
    box(m, [dx, ly, front + 0.004], [dx + 0.13, ly + 0.035, front + 0.05], tone(hex('#6b4a30'), 3), ['ny']);
    box(m, [dx, ly, front + 0.004], [dx + 0.13, ly + 0.012, front + 0.05], hex('#4a4c50'), ['ny']);
    const n = g.strokes ?? 0;
    const faint = scale3(chalk, look.faint ? +look.faint : 0.55);
    for (let i = 0; i < n; i++) {
      // A line of "writing": a thin strip, a little uneven.
      const y = h - fw - 0.16 - i * (h - 2 * fw - 0.3) / Math.max(1, n);
      const x0 = -X + fw + 0.12 + r.range(0, 0.25);
      const len = r.range(0.5, w - 2 * fw - 0.4);
      const t = 0.018 + r.range(0, 0.008);
      quad(m, [x0, y, front - 0.008], [x0 + len, y + r.range(-0.01, 0.01), front - 0.008], [x0 + len, y + t, front - 0.008], [x0, y + t, front - 0.008], faint);
    }
  }
  return m;
}

// ---------------------------------------------------------------- the projector screen

/**
 * A pull-down screen. Settings `g`: `drop` (how far the sheet is pulled down, m, from the case), `case` (the case's
 * height and depth, m). `look`: `case`, `sheet`, `border` (a dark edge round the sheet), `bar`.
 */
export function screenMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const back = -d / 2;
  const ch = g.case ?? 0.12;
  const caseC = hex(look.case);
  const sheet = hex(look.sheet);
  const border = hex(look.border ?? '#2a2b2e');
  const barC = hex(look.bar ?? look.case);
  const m = new Mesh();
  const top = h;
  const drop = Math.min(g.drop ?? h - ch - 0.05, h - ch - 0.05);
  const zs = back + ch / 2;
  if (level >= 2) {
    box(m, [-X, top - ch, back], [X, top, back + ch], caseC, ['nz']);
    quad(m, [-X + 0.06, top - ch - drop, zs], [X - 0.06, top - ch - drop, zs], [X - 0.06, top - ch, zs], [-X + 0.06, top - ch, zs], sheet);
    return m;
  }
  // The case with end caps and two wall brackets.
  box(m, [-X + 0.03, top - ch, back], [X - 0.03, top, back + ch], caseC, ['nz']);
  for (const s of [-1, 1]) box(m, [s < 0 ? -X : X - 0.03, top - ch - 0.01, back], [s < 0 ? -X + 0.03 : X, top, back + ch + 0.01], scale3(caseC, 0.7), ['nz']);
  // The sheet hanging from the slot under the case: a pale face with a dark border, both faces drawn.
  const x0 = -X + 0.07;
  const x1 = X - 0.07;
  const y1 = top - ch;
  const y0 = y1 - drop;
  const b = 0.05;
  const face = (z, flip) => {
    const q = (a, bb, c, dd, col) => (flip ? quad(m, dd, c, bb, a, col) : quad(m, a, bb, c, dd, col));
    q([x0 + b, y0 + b, z], [x1 - b, y0 + b, z], [x1 - b, y1 - 0.12, z], [x0 + b, y1 - 0.12, z], sheet);
    q([x0, y1 - 0.12, z], [x1, y1 - 0.12, z], [x1, y1, z], [x0, y1, z], border);
    q([x0, y0, z], [x1, y0, z], [x1, y0 + b, z], [x0, y0 + b, z], border);
    q([x0, y0 + b, z], [x0 + b, y0 + b, z], [x0 + b, y1 - 0.12, z], [x0, y1 - 0.12, z], border);
    q([x1 - b, y0 + b, z], [x1, y0 + b, z], [x1, y1 - 0.12, z], [x1 - b, y1 - 0.12, z], border);
  };
  face(zs + 0.002, false);
  face(zs - 0.002, true);
  // The weighted bar at the foot and its pull cord with a ring.
  box(m, [x0 - 0.01, y0 - 0.03, zs - 0.015], [x1 + 0.01, y0, zs + 0.015], barC);
  if (level === 0) {
    box(m, [-0.004, y0 - 0.3, zs - 0.004], [0.004, y0 - 0.03, zs + 0.004], border, ['py']);
    box(m, [-0.03, y0 - 0.34, zs - 0.006], [0.03, y0 - 0.3, zs + 0.006], barC);
  }
  return m;
}

// ---------------------------------------------------------------- the notice board

/**
 * An outdoor notice board on two posts under a small gabled shingle roof (photo 19). Settings `g`: `board` ([bottom,
 * top] of the board, m), `post` (the posts' width), `notes` (sheets pinned on it). `look`: `wood` (posts and frame),
 * `cork` (the board), `roof` (the shingles), `notes` (a list of sheet colours, comma separated), `jitter`, `grime`.
 */
export function noticeBoardMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const [b0, b1] = g.board ?? [0.9, 1.9];
  const pw = g.post ?? 0.12;
  const wood = hex(look.wood);
  const cork = hex(look.cork);
  const roofC = hex(look.roof);
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const eave = b1 + 0.28;
  const px = X - 0.12 - pw / 2;
  if (level >= 2) {
    for (const s of [-1, 1]) box(m, [s * px - pw / 2, 0, -pw / 2], [s * px + pw / 2, eave, pw / 2], scale3(wood, 0.8), ['ny']);
    box(m, [-px, b0, -0.05], [px, b1, 0.05], cork);
    quad(m, [-X, eave, Z], [X, eave, Z], [X, h, 0], [-X, h, 0], roofC);
    quad(m, [X, eave, -Z], [-X, eave, -Z], [-X, h, 0], [X, h, 0], roofC);
    return m;
  }
  // Two posts into the ground, the board between them in a frame, a cap rail.
  for (const s of [-1, 1]) box(m, [s * px - pw / 2, 0, -pw / 2], [s * px + pw / 2, eave, pw / 2], tone(scale3(wood, 0.85), 1 + s), ['ny']);
  const ix = px - pw / 2;
  box(m, [-ix, b0, -0.04], [ix, b1, 0.04], cork, ['nx', 'px']);
  const fc = tone(wood, 4);
  for (const zf of [-1, 1]) {
    const z0 = zf * 0.04;
    const z1 = zf * 0.07;
    const [za, zb] = zf < 0 ? [z1, z0] : [z0, z1];
    box(m, [-ix, b1 - 0.06, za], [ix, b1, zb], fc, ['nx', 'px']);
    box(m, [-ix, b0, za], [ix, b0 + 0.06, zb], fc, ['nx', 'px']);
  }
  // Sheets pinned on both faces (blank: plain colours), a little crooked.
  if (level === 0) {
    const colours = (look.notes ?? '#f2efe4,#f4e7a1,#cfe0ef,#f2cfc4').split(',').map((c) => hex(c.trim()));
    for (const zf of [-1, 1]) {
      const n = g.notes ?? 5;
      for (let i = 0; i < n; i++) {
        const sw = r.range(0.21, 0.3);
        const sh = r.range(0.28, 0.34);
        const cx = -ix + 0.1 + sw / 2 + ((2 * ix - 0.2 - sw) * (i + r.range(0.1, 0.9))) / n;
        const cy = r.range(b0 + 0.1 + sh / 2, b1 - 0.1 - sh / 2);
        const z = zf * 0.0415;
        const col = colours[(i + (zf > 0 ? 0 : 2)) % colours.length];
        const pts = [[cx - sw / 2, cy - sh / 2, z], [cx + sw / 2, cy - sh / 2, z], [cx + sw / 2, cy + sh / 2, z], [cx - sw / 2, cy + sh / 2, z]];
        if (zf > 0) quad(m, ...pts, col);
        else quad(m, pts[1], pts[0], pts[3], pts[2], col);
      }
    }
  }
  // The roof: two pitches of shingles over gable boards, a ridge.
  const sh = tone(roofC, 9);
  const rows = level === 0 ? 4 : 1;
  for (const zf of [-1, 1]) {
    for (let i = 0; i < rows; i++) {
      // Each course a little proud of the one above it.
      const t0 = i / rows;
      const t1 = (i + 1) / rows;
      const lip = level === 0 ? 0.012 * (rows - i) : 0;
      const za = zf * Z * (1 - t0);
      const zb = zf * Z * (1 - t1);
      const ya = eave + (h - eave) * t0;
      const yb = eave + (h - eave) * t1;
      const c = scale3(roofC, 0.9 + 0.1 * ((i + (zf > 0 ? 0 : 1)) % 2));
      const a = [-X, ya - lip, za];
      const bb = [X, ya - lip, za];
      const cc = [X, yb, zb];
      const dd = [-X, yb, zb];
      if (zf > 0) quad(m, a, bb, cc, dd, c);
      else quad(m, bb, a, dd, cc, c);
    }
    // The underside of the pitch.
    const u = [[-X, eave - 0.03, zf * Z], [X, eave - 0.03, zf * Z], [X, h - 0.03, 0], [-X, h - 0.03, 0]];
    if (zf > 0) quad(m, u[1], u[0], u[3], u[2], scale3(sh(u[0]), 0.6));
    else quad(m, u[0], u[1], u[2], u[3], scale3(sh(u[0]), 0.6));
  }
  // Gable boards each end and the ridge cap.
  for (const s of [-1, 1]) {
    const x = s * X;
    const pts = [[x, eave - 0.06, -Z], [x, eave - 0.06, Z], [x, h, 0]];
    const n = [s, 0, 0];
    const col = scale3(wood, 0.75);
    const i = pts.map((p) => m.vertex(p, n, [0, 0], col));
    if (s > 0) m.tri(i[0], i[2], i[1]);
    else m.tri(i[0], i[1], i[2]);
  }
  box(m, [-X, h - 0.04, -0.05], [X, h, 0.05], scale3(roofC, 0.7), ['ny']);
  return m;
}

// ---------------------------------------------------------------- the row of school desks

/**
 * One school desk: a top on a tubular steel frame with a book shelf under it; its front (where the pupil sits) +z.
 */
function schoolDesk(m, cx, size, look, tone, fine) {
  const [dw, dh, dd] = size;
  const X = dw / 2;
  const Z = dd / 2;
  const top = hex(look.top);
  const steel = hex(look.steel);
  const t = 0.025;
  box(m, [cx - X, dh - t, -Z], [cx + X, dh, Z], tone(top, Math.round(cx * 10)));
  const leg = 0.03;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, [cx + sx * (X - 0.03) - leg / 2, 0, sz * (Z - 0.03) - leg / 2], [cx + sx * (X - 0.03) + leg / 2, dh - t, sz * (Z - 0.03) + leg / 2], steel, ['ny', 'py']);
  if (fine) {
    // The book shelf (a steel tray) under the top, open to the front; a rail low across the back.
    box(m, [cx - X + 0.04, dh - 0.16, -Z + 0.04], [cx + X - 0.04, dh - 0.14, Z - 0.05], scale3(steel, 0.8));
    box(m, [cx - X + 0.04, dh - 0.16, -Z + 0.035], [cx + X - 0.04, dh - t, -Z + 0.05], scale3(steel, 0.75), ['ny', 'py']);
    box(m, [cx - X + 0.03, 0.18, -Z + 0.02], [cx + X - 0.03, 0.2, -Z + 0.04], steel);
  }
}

/**
 * A row of four school desks, two each side of an aisle, a chair pushed in at each (one prop where there would be
 * eight: a map as played holds at most 4,096 entities). Its front is +z: the chairs stand there, the pupils face −z.
 * Settings `g`: `desk` (one desk's size), `aisle` (the gap in the middle, m), `gap` (between the two of a pair), `chair`
 * (the Chair's size), `chairG` (its generator settings), `tuck` (desk's middle to chair's), `chairs` (false: none).
 * `look`: `top`, `steel`, `chair` (the chairs' look), `jitter`, `grime`. Collides as the four desks' boxes.
 */
export function schoolDesksMesh(seed, size, g, look, level) {
  const [, , d] = size;
  const [dw, dh, dd] = g.desk;
  const aisle = g.aisle ?? 0.7;
  const gap = g.gap ?? 0.1;
  const dz = -d / 2 + dd / 2;
  const xs = [-(aisle / 2 + gap + dw * 1.5), -(aisle / 2 + dw / 2), aisle / 2 + dw / 2, aisle / 2 + gap + dw * 1.5];
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const boxes = [];
  for (const [i, x] of xs.entries()) {
    const desk = new Mesh();
    if (level >= 2) box(desk, [-dw / 2, dh - 0.12, -dd / 2], [dw / 2, dh, dd / 2], hex(look.top), ['ny']);
    else schoolDesk(desk, 0, g.desk, look, tone, level === 0);
    placeMesh(m, desk, 0, [x, 0, dz]);
    boxes.push([x - dw / 2, 0, dz - dd / 2, x + dw / 2, dh, dz + dd / 2]);
    if (g.chairs !== false) placeMesh(m, seatMesh(seed + 30 + (level >= 1 ? 0 : i), g.chair, g.chairG, look.chair, level), 2, [x, 0, dz + g.tuck]);
  }
  if (level === 0) m.boxes = boxes;
  return m;
}

// ---------------------------------------------------------------- the pennant string

/**
 * A string of pennants to hang along a classroom wall under the ceiling (St. John's step 5b): a cord sagging a little
 * from end to end along x at the top of the prop, triangular pennants hanging from it, both faces drawn. Plain
 * colours, no marks. Settings `g`: `flag` ([width, drop] of one pennant, m), `gap` (between pennants), `sag` (how far
 * the cord dips in the middle). `look`: `colours` (comma-separated hex, in turn), `cord`. Collides as nothing.
 */
export function pennantMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const X = w / 2;
  const [fw, drop] = g.flag ?? [0.28, 0.36];
  const gap = g.gap ?? 0.08;
  const sag = g.sag ?? 0.1;
  const colours = (look.colours ?? '#4b2a84,#f2f0ea,#a8322d').split(',').map((c) => hex(c.trim()));
  const cord = hex(look.cord ?? '#d9d4c6');
  const m = new Mesh();
  const yAt = (x) => h - 0.01 - sag * (1 - (x / X) ** 2);
  // The cord: a thin strip, both faces.
  const segs = level === 0 ? 8 : 2;
  for (let i = 0; i < segs; i++) {
    const xa = -X + (2 * X * i) / segs;
    const xb = -X + (2 * X * (i + 1)) / segs;
    const pts = [[xa, yAt(xa) - 0.01, 0], [xb, yAt(xb) - 0.01, 0], [xb, yAt(xb) + 0.01, 0], [xa, yAt(xa) + 0.01, 0]];
    quad(m, ...pts, cord);
    quad(m, pts[1], pts[0], pts[3], pts[2], cord);
  }
  if (level >= 2) {
    // One band of colour where the pennants are.
    const pts = [[-X, h - sag - drop * 0.6, 0], [X, h - sag - drop * 0.6, 0], [X, h - 0.02, 0], [-X, h - 0.02, 0]];
    quad(m, ...pts, colours[0]);
    quad(m, pts[1], pts[0], pts[3], pts[2], colours[0]);
    return m;
  }
  const n = Math.floor((2 * X + gap) / (fw + gap));
  const x0 = -((n * (fw + gap) - gap) / 2);
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * (fw + gap);
    const xb = xa + fw;
    const xm = (xa + xb) / 2;
    const col = colours[i % colours.length];
    const a = [xa, yAt(xa), 0];
    const b = [xb, yAt(xb), 0];
    const c = [xm, yAt(xm) - drop, 0];
    const ia = [a, b, c].map((p) => m.vertex(p, [0, 0, 1], [0, 0], col));
    m.tri(ia[0], ia[2], ia[1]);
    const ib = [a, b, c].map((p) => m.vertex(p, [0, 0, -1], [0, 0], col));
    m.tri(ib[0], ib[1], ib[2]);
  }
  return m;
}

// ---------------------------------------------------------------- the clock face

/**
 * A wall clock face for a tower (St. John's step 6, the clock tower): a round dial in a moulded ring, twelve hour
 * marks, the hour and minute hands at a fixed time (`time`, [hours, minutes]; nothing moves or glows), a boss at the
 * middle. It hangs on a wall: its back on the prop's −z face, the dial facing +z; the prop's foot is the ring's foot,
 * so place it at the height it hangs. Collides as nothing (`collide: "none"`): it is thinner than the wall's dressing.
 * Settings `g`: `ring` (the ring's width, m), `marks` ([length, width] of an hour mark, m), `time`. `look`: `dial`,
 * `ring`, `marks`, `hands`, `grime`. No numerals, maker's name or mark of anyone's.
 */
export function clockFaceMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const R = Math.min(w, h) / 2;
  const cy = h / 2;
  const back = -d / 2;
  const front = d / 2;
  const ringW = g.ring ?? 0.16;
  const dial = hex(look.dial);
  const ringC = hex(look.ring);
  const markC = hex(look.marks ?? look.hands);
  const handC = hex(look.hands);
  const grime = +(look.grime ?? 0);
  const m = new Mesh();
  const seg = level === 0 ? 32 : level === 1 ? 20 : 12;
  // The dial, a little darker towards its rim (weathering), set back in the ring: a fan of triangles facing +z.
  const zDial = front - Math.min(0.035, d * 0.4);
  const rd = R - ringW * 0.5;
  const dialCol = (p) => scale3(dial, 1 - grime * Math.min(1, Math.hypot(p[0], p[1] - cy) / R) * 0.6);
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    tri(m, [0, cy, zDial], [Math.cos(a0) * rd, cy + Math.sin(a0) * rd, zDial], [Math.cos(a1) * rd, cy + Math.sin(a1) * rd, zDial], dialCol);
  }
  // The ring's face (and at the nearest look the band's outer edge and an inner bead).
  annulus(m, 2, 0, cy, level >= 1 ? zDial + 0.004 : front, R - ringW, R, seg, 1, ringC);
  if (level >= 2) return m;
  if (level === 0) {
    cyl(m, 2, 0, cy, back, front, R, seg, scale3(ringC, 0.85));
    cyl(m, 2, 0, cy, zDial, front, R - ringW, seg, scale3(ringC, 0.7), { inside: true });
  }
  // Hour marks: twelve bars round the dial, the quarters longer.
  const [ml, mw] = g.marks ?? [0.22, 0.06];
  const zm = zDial + 0.006;
  for (let k = 0; k < 12; k++) {
    if (level === 1 && k % 3) continue;
    const a = (k / 12) * Math.PI * 2;
    const len = k % 3 ? ml : ml * 1.5;
    const r1 = R - ringW - 0.06;
    const r0 = r1 - len;
    const [s, c] = [Math.sin(a), Math.cos(a)];
    const half = (k % 3 ? mw : mw * 1.4) / 2;
    // Corners along the radius (up the dial is +y), the bar's width across it.
    const P = (rad, off) => [s * rad + c * off, cy + c * rad - s * off, zm];
    quad(m, P(r0, -half), P(r0, half), P(r1, half), P(r1, -half), markC);
  }
  // The hands: tapering blades from the boss, the hour hand shorter and broader; both stand off the dial a little.
  const [hh, mm] = g.time ?? [10, 10];
  const hand = (ang, len, wid, z) => {
    const [s, c] = [Math.sin(ang), Math.cos(ang)];
    const P = (rad, off) => [s * rad + c * off, cy + c * rad - s * off, z];
    // A tail behind the boss, a blade out to a point.
    quad(m, P(-len * 0.18, -wid * 0.35), P(-len * 0.18, wid * 0.35), P(len * 0.8, wid * 0.5), P(len * 0.8, -wid * 0.5), handC);
    tri(m, P(len * 0.8, -wid * 0.5), P(len * 0.8, wid * 0.5), P(len, 0), handC);
  };
  const minuteA = (mm / 60) * Math.PI * 2;
  const hourA = ((hh % 12) / 12 + mm / 720) * Math.PI * 2;
  hand(hourA, (R - ringW) * 0.55, 0.12, zDial + 0.012);
  hand(minuteA, (R - ringW) * 0.85, 0.08, zDial + 0.02);
  // The boss over the hands' arbor.
  cyl(m, 2, 0, cy, zDial, Math.min(front, zDial + 0.035), 0.07, 8, scale3(handC, 1.1), { caps: '1' });
  return m;
}
