// Furniture (kit-prop families `table`, `seat`, `bookcase`; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6 part 4):
// tables and desks (a top on four legs and an apron, or on a drawer pedestal and a panel leg), chairs and benches
// (a seat on four legs under a slatted or solid back) and bookcases (a carcass of shelves with rows of books, doors
// below on the wide ones). Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2]; its front is +z (a chair's
// sitter looks that way, a desk's drawers and a bookcase's books face it).
//
// Tables and bookcases collide as their box, as the pieces they replace did. A seat collides as two boxes, its back
// and the block under its seat (a generator's `boxes`: tools/content/kitprops.mjs).
//
// Level 1 keeps the outline (top, legs, back, shelves as blocks); level 2 is the bounds in the wood's colour.
// (Part 5 adds the cushioned chair: a seat's `look.back` pads its back.)
//
// Part 6 adds two pieces with finer collision, as the pieces they replace had: the pedestal table (`roundtable`: a
// six-sided or oval top on a turned column; it collides as its base, its column and its top as two crossing slabs,
// open under the top) and the office chair (`officechair`: a five-star base on castors, a gas column, a padded seat
// and back, arms; it collides as its base, the block under its seat, the seat, each arm and the back).

import { rng } from '../env/rng.mjs';
import { Mesh, box, groundShade, hex, ovalDisc, ovalShell, pad, quadN, scale3, standIn } from './geom.mjs';
import { woodTone } from './crate.mjs';

const lerp = (p, q, t) => p + (q - p) * t;

/**
 * A table or desk. Settings `g`: `top` (top thickness, m), `leg` (leg width), `apron` (apron height under the top, 0
 * for none), `inset` (how far legs and apron sit in from the top's edge), `style`: 'legs', 'desk' (a drawer pedestal
 * on the −x side, a panel leg on the other, a modesty panel at the back) or 'console' (legs, and a shelf low down),
 * `drawers` (in the pedestal). `look`: `wood`, `top` (hex, default the wood), `metal` (hex: handles), `cloth` (hex: a
 * runner along the top), `jitter`, `grime`.
 */
export function tableMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  const topC = hex(look.top ?? look.wood);
  if (level >= 2) return standIn(size, topC, scale3(wood, 0.8));
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const t = g.top;
  const leg = g.leg;
  const inset = g.inset ?? 0;
  const yTop = h - t;
  // The top: one slab at level 1; boards along the long side at level 0, each its own tone.
  // (Under a runner the top sits a hair inside the bounds: the cloth is the outside.)
  const lap = look.cloth && level === 0 ? 0.002 : 0;
  const boards = level === 0 ? Math.max(2, Math.round(d / 0.16)) : 1;
  for (let i = 0; i < boards; i++) {
    const z0 = -d / 2 + (d * i) / boards;
    const z1 = -d / 2 + (d * (i + 1)) / boards;
    box(m, [-w / 2 + lap, yTop, z0], [w / 2 - lap, h - lap * 1.5, z1], tone(topC, 20 + i), [...(i > 0 ? ['nz'] : []), ...(i < boards - 1 ? ['pz'] : [])]);
  }
  if (look.cloth && level === 0) {
    // A runner: a strip of cloth along the top, hanging a little over both ends.
    const c = hex(look.cloth);
    const cw = d * 0.3;
    quadN(m, [-w / 2, h, -cw], [w / 2, h, -cw], [w / 2, h, cw], [-w / 2, h, cw], [0, 1, 0], c);
    for (const s of [-1, 1]) quadN(m, [(s * w) / 2, h - 0.12, -cw], [(s * w) / 2, h - 0.12, cw], [(s * w) / 2, h, cw], [(s * w) / 2, h, -cw], [s, 0, 0], scale3(c, 0.85));
  }
  const x0 = -w / 2 + inset;
  const x1 = w / 2 - inset;
  const z0 = -d / 2 + inset;
  const z1 = d / 2 - inset;
  if (g.style === 'desk') {
    // The pedestal: a carcass on the −x side, drawer fronts facing +z, a handle each.
    const pw = Math.min(w * 0.32, 0.5);
    const body = tone(wood, 1);
    box(m, [x0, 0, z0], [x0 + pw, yTop, z1], body, ['py', 'ny']);
    const n = Math.max(1, g.drawers ?? 3);
    if (level === 0) {
      const metal = hex(look.metal ?? '#8b8d8f');
      for (let k = 0; k < n; k++) {
        const ya = 0.06 + ((yTop - 0.08) * k) / n;
        const yb = 0.06 + ((yTop - 0.08) * (k + 1)) / n - 0.015;
        box(m, [x0 + 0.02, ya, z1], [x0 + pw - 0.02, yb, z1 + 0.012], tone(scale3(wood, 1.08), 30 + k), ['nz']);
        box(m, [x0 + pw / 2 - 0.06, (ya + yb) / 2 - 0.008, z1 + 0.012], [x0 + pw / 2 + 0.06, (ya + yb) / 2 + 0.008, z1 + 0.026], metal, ['nz']);
      }
    }
    // The panel leg on the other side, and the modesty panel across the back.
    box(m, [x1 - leg, 0, z0], [x1, yTop, z1], tone(wood, 2), ['py', 'ny']);
    box(m, [x0 + pw, yTop * 0.3, z0], [x1 - leg, yTop, z0 + leg * 0.6], tone(scale3(wood, 0.92), 3), ['py', 'nx', 'px']);
    return m;
  }
  // Four legs.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const lx = sx < 0 ? x0 : x1 - leg;
      const lz = sz < 0 ? z0 : z1 - leg;
      box(m, [lx, 0, lz], [lx + leg, yTop, lz + leg], tone(scale3(wood, 0.95), 5 + sx + sz * 2), ['py', 'ny']);
    }
  const ap = g.apron ?? 0;
  if (ap > 0) {
    const at = Math.min(leg * 0.5, 0.03);
    const c = tone(scale3(wood, 0.9), 9);
    for (const sz of [-1, 1]) {
      const z = sz < 0 ? z0 + (leg - at) / 2 : z1 - (leg + at) / 2;
      box(m, [x0 + leg, yTop - ap, z], [x1 - leg, yTop, z + at], c, ['py', 'nx', 'px']);
    }
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? x0 + (leg - at) / 2 : x1 - (leg + at) / 2;
      box(m, [x, yTop - ap, z0 + leg], [x + at, yTop, z1 - leg], c, ['py', 'nz', 'pz']);
    }
  }
  if (g.style === 'console') {
    // A shelf low down between the legs.
    const y = h * 0.22;
    box(m, [x0 + leg * 0.3, y, z0 + leg * 0.3], [x1 - leg * 0.3, y + t * 0.8, z1 - leg * 0.3], tone(scale3(topC, 0.95), 12));
  }
  return m;
}

/**
 * A chair or bench. Settings `g`: `seat` (seat height, m), `seatT` (seat thickness), `leg` (leg width), `back` (how
 * deep the back's collision is from the rear, m), `slats` (upright slats in the back; 0 for rails across), `rails`
 * (rails across the back when there are no slats). `look`: `wood`, `seat` (hex: a cushion or a painted seat), `back`
 * (hex: a padded panel in the back instead of slats or rails), `jitter`, `grime`.
 */
export function seatMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  if (level >= 2) {
    // The back and the seat as two blocks: a chair's outline, not its bounds.
    const m = new Mesh();
    box(m, [-w / 2, 0, -d / 2], [w / 2, h, -d / 2 + g.leg], scale3(wood, 0.85), ['ny']);
    box(m, [-w / 2, 0, -d / 2 + g.leg], [w / 2, g.seat, d / 2], scale3(wood, 0.8), ['ny', 'nz']);
    return m;
  }
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  // Solid: the back, floor to top, and the block under the seat.
  m.boxes = [
    [-w / 2, 0, -d / 2, w / 2, h, -d / 2 + g.back],
    [-w / 2, 0, -d / 2 + g.back, w / 2, g.seat, d / 2],
  ];
  const leg = g.leg;
  const st = g.seatT;
  const ySeat = g.seat;
  const legC = tone(scale3(wood, 0.92), 1);
  // Legs: the back pair run up to the top as the back's posts.
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? -w / 2 : w / 2 - leg;
    box(m, [x, 0, -d / 2], [x + leg, h, -d / 2 + leg], legC, ['ny']);
    box(m, [x, 0, d / 2 - leg], [x + leg, ySeat - st, d / 2], legC, ['ny', 'py']);
  }
  // The seat: a cushion's colour when the look gives one.
  const seatC = look.seat ? hex(look.seat) : null;
  box(m, [-w / 2, ySeat - st, -d / 2 + leg], [w / 2, ySeat, d / 2], seatC ? (p) => scale3(seatC, 0.9 + 0.1 * (p[1] >= ySeat ? 1 : 0)) : tone(wood, 2));
  // The back between the posts.
  const bx0 = -w / 2 + leg;
  const bx1 = w / 2 - leg;
  const bz0 = -d / 2 + leg * 0.2;
  const bz1 = -d / 2 + leg * 0.8;
  const top = h - leg * 1.2;
  box(m, [bx0, top, bz0], [bx1, h, bz1], tone(wood, 3), ['nx', 'px']);
  if (level === 0) {
    const slats = g.slats ?? 0;
    if (look.back) {
      // A padded panel between the posts, a little proud of the rail it hangs under.
      const pad = hex(look.back);
      box(m, [bx0 + 0.004, ySeat + (h - ySeat) * 0.24, bz0], [bx1 - 0.004, top, bz1 + 0.01], (p, n) => scale3(pad, n[1] < -0.5 ? 0.7 : n[2] < -0.5 ? 0.8 : 1), ['py']);
    } else if (slats > 0) {
      const low = ySeat + (h - ySeat) * 0.22;
      box(m, [bx0, low, bz0], [bx1, low + leg, bz1], tone(wood, 4), ['nx', 'px']);
      const sw = Math.min(0.045, ((bx1 - bx0) / slats) * 0.5);
      for (let k = 0; k < slats; k++) {
        const x = lerp(bx0, bx1, (k + 0.5) / slats);
        box(m, [x - sw / 2, low + leg, bz0 + 0.004], [x + sw / 2, top, bz1 - 0.004], tone(scale3(wood, 1.04), 10 + k), ['ny', 'py']);
      }
    } else {
      const rails = Math.max(1, g.rails ?? 2);
      for (let k = 0; k < rails; k++) {
        const y = lerp(ySeat + (h - ySeat) * 0.2, top, k / rails);
        box(m, [bx0, y, bz0], [bx1, y + (top - ySeat) / rails * 0.55, bz1], tone(wood, 10 + k), ['nx', 'px']);
      }
    }
    // Stretchers between the legs, low down.
    const sy = ySeat * 0.3;
    const sT = leg * 0.5;
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? -w / 2 + (leg - sT) / 2 : w / 2 - (leg + sT) / 2;
      box(m, [x, sy, -d / 2 + leg], [x + sT, sy + sT, d / 2 - leg], legC, ['nz', 'pz']);
    }
  } else {
    // One panel for the back.
    box(m, [bx0, ySeat + (h - ySeat) * 0.25, bz0], [bx1, top, bz1], look.back ? scale3(hex(look.back), 0.92) : tone(wood, 4), ['nx', 'px', 'py']);
  }
  return m;
}

const BOOKS = ['#7a2e2a', '#2f4a6b', '#3f5f3a', '#8a6a2c', '#4a3558', '#a39a86', '#5a2f1f', '#274a4a', '#8c4a2a', '#c2b8a0'];

/**
 * A bookcase. Settings `g`: `side` (carcass board thickness, m), `plinth` (height of the base), `shelves` (shelf
 * spaces), `bays` (side by side, a divider between), `doors` (shelf spaces from the bottom closed by doors), `fill`
 * (0–1: how full the shelves are). `look`: `wood`, `back` (hex, default a darker wood), `metal` (hex: door knobs),
 * `books` (0–1: how colourful; 0 for ledgers in buff and brown), `jitter`, `grime`.
 */
export function bookcaseMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  if (level >= 2) return standIn(size, scale3(wood, 0.9), scale3(wood, 0.75));
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const s = g.side;
  const plinth = g.plinth ?? 0.08;
  const body = tone(wood, 1);
  const backC = tone(hex(look.back ?? look.wood), 2);
  // The carcass: sides, top, plinth, back.
  for (const sx of [-1, 1]) box(m, [sx < 0 ? -w / 2 : w / 2 - s, 0, -d / 2], [sx < 0 ? -w / 2 + s : w / 2, h, d / 2], body, ['ny']);
  box(m, [-w / 2 + s, h - s, -d / 2], [w / 2 - s, h, d / 2], body, ['nx', 'px']);
  box(m, [-w / 2 + s, 0, -d / 2], [w / 2 - s, plinth, d / 2 - 0.02], tone(scale3(wood, 0.85), 3), ['nx', 'px', 'ny']);
  box(m, [-w / 2 + s, plinth, -d / 2], [w / 2 - s, h - s, -d / 2 + 0.015], look.back ? backC : tone(scale3(wood, 0.7), 2), ['nx', 'px', 'ny', 'py']);
  const shelves = Math.max(2, g.shelves ?? 5);
  const bays = Math.max(1, g.bays ?? 1);
  const doors = Math.min(shelves - 1, g.doors ?? 0);
  const inner = w - s * 2;
  const bayW = (inner - s * (bays - 1)) / bays;
  const rise = (h - s - plinth) / shelves;
  const shelfT = Math.min(s, 0.025);
  const front = d / 2 - 0.012;
  for (let b = 1; b < bays; b++) {
    const x = -w / 2 + s + b * (bayW + s) - s;
    box(m, [x, plinth, -d / 2 + 0.015], [x + s, h - s, front], body, ['ny', 'py', 'nz']);
  }
  const metal = hex(look.metal ?? '#8b8d8f');
  const colourful = look.books ?? 0.8;
  for (let b = 0; b < bays; b++) {
    const x0 = -w / 2 + s + b * (bayW + s);
    const x1 = x0 + bayW;
    if (doors > 0) {
      // Doors over the lower spaces: two leaves a bay, a knob each (one panel at level 1).
      const y1 = plinth + rise * doors;
      const leaves = level === 0 ? 2 : 1;
      for (let k = 0; k < leaves; k++) {
        const a = lerp(x0, x1, k / leaves) + 0.004;
        const c = lerp(x0, x1, (k + 1) / leaves) - 0.004;
        box(m, [a, plinth + 0.005, front - 0.02], [c, y1 - 0.005, front], tone(scale3(wood, 1.06), 40 + b * 4 + k), ['nz']);
        if (level === 0) {
          const kx = k === 0 ? c - 0.04 : a + 0.04;
          box(m, [kx - 0.012, (plinth + y1) / 2 - 0.012, front], [kx + 0.012, (plinth + y1) / 2 + 0.012, d / 2], metal, ['nz']);
        }
      }
    }
    for (let k = doors; k < shelves; k++) {
      const y = plinth + rise * k;
      // The shelf board (the plinth's top for the lowest), then what stands on it.
      box(m, [x0, y, -d / 2 + 0.015], [x1, y + shelfT, front], tone(scale3(wood, 0.95), 50 + b * 8 + k), ['nx', 'px', 'ny', 'nz']);
      const base = y + shelfT;
      const room = rise - shelfT - 0.03;
      const deep = Math.min(d * 0.62, 0.24);
      const zb = front - 0.03;
      if (level >= 1) {
        // A row of books as one block, its colour the shelf's mix.
        const c = hex(BOOKS[(seed + b * 3 + k) % BOOKS.length]);
        box(m, [x0 + 0.02, base, zb - deep], [x1 - bayW * 0.2, base + room * 0.85, zb], scale3(c, 0.8), ['ny', 'nz']);
        continue;
      }
      let x = x0 + 0.012;
      const fill = g.fill ?? 0.8;
      const stop = x0 + bayW * Math.min(1, fill + r.jitter(0.18));
      while (x < stop) {
        const bw = r.range(0.028, 0.06);
        if (x + bw > x1 - 0.01) break;
        const bh = room * r.range(0.68, 0.98);
        const pick = r.next() < colourful ? BOOKS[r.int(0, BOOKS.length - 1)] : ['#a39a86', '#8c7a5c', '#6e5a42'][r.int(0, 2)];
        const c = scale3(hex(pick), r.range(0.75, 1.05));
        // A book: its spine, its top and its two sides (the back and bottom are never seen).
        box(m, [x, base, zb - deep * r.range(0.82, 1)], [x + bw, base + bh, zb], (p, n) => scale3(c, n[1] > 0.5 ? 1.5 : n[2] > 0.5 ? 1 : 0.7), ['ny', 'nz']);
        x += bw + 0.002;
        // A gap now and then.
        if (r.next() < 0.08) x += r.range(0.03, 0.09);
      }
    }
  }
  return m;
}

/**
 * A pedestal table: a six-sided or oval top the size of the bounds, on a column and a base. Settings `g`: `sides` (6:
 * a hexagon, its points at ±z; else the oval's sides at level 0), `top` (top thickness, m), `apron` (depth of the
 * drum under the top, 0 for none), `apronK` (the drum's size as a part of the top's), `foot` ('round': a turned base;
 * 'cross': four feet), and its collision, the same for every variant: `base` (the base's width), `baseH` (its
 * height), `column` (the column's width), `under` (the underside of the top's two slabs), `long` (half the width of
 * the slab that runs the whole depth), `wide` (half the depth of the slab that runs the whole width). `look`: `wood`,
 * `top` (hex, default the wood), `cloth` (hex: a cloth over the top, hanging a hand down), `jitter`, `grime`.
 */
export function roundTableMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  const topC = hex(look.top ?? look.wood);
  const cloth = look.cloth ? hex(look.cloth) : null;
  if (level >= 2) return standIn(size, cloth ?? topC, scale3(wood, 0.8));
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const six = g.sides === 6;
  const seg = six ? 6 : level === 0 ? (g.sides ?? 20) : 12;
  // A hexagon's flat sides are the bounds' ±x, its points the bounds' ±z.
  const outline = { rx: six ? w / 2 / Math.cos(Math.PI / 6) : w / 2, rz: d / 2, phase: six ? Math.PI / 2 : 0, smooth: !six };
  const R = g.base / 2;
  const c = g.column / 2;
  // Solid: the base, the column, and the top as two crossing slabs (you can shoot under the top, either side of the column).
  m.boxes = [
    [-R, 0, -R, R, g.baseH, R],
    [-c, g.baseH, -c, c, h, c],
    [-g.long, g.under, -d / 2, g.long, h, d / 2],
    [-w / 2, g.under, -g.wide, w / 2, h, g.wide],
  ];
  const y0 = h - g.top;
  // Under a cloth the top sits a hair inside the bounds: the cloth is the outside.
  const lap = cloth && level === 0 ? 0.003 : 0;
  const k = 1 - lap / (d / 2);
  const bev = level === 0 ? 0.012 : 0;
  const kb = k - bev / (d / 2);
  const face = cloth && level > 0 ? cloth : null;
  const topTone = face ?? tone(topC, 20);
  const rim = face ? scale3(face, 0.85) : tone(scale3(topC, 0.9), 21);
  ovalShell(m, bev ? [[k, y0], [k, h - lap - bev], [kb, h - lap]] : [[k, y0], [k, h]], seg, rim, outline);
  ovalDisc(m, outline.rx * kb, outline.rz * kb, h - lap, seg, topTone, outline);
  ovalDisc(m, outline.rx * k, outline.rz * k, y0, seg, tone(scale3(wood, 0.7), 22), { ...outline, down: true });
  if (cloth && level === 0) {
    ovalDisc(m, outline.rx, outline.rz, h, seg, cloth, outline);
    ovalShell(m, [[1, h - 0.15], [1, h]], seg, (p) => scale3(cloth, p[1] > h - 0.01 ? 0.92 : 0.78), outline);
  }
  if (level >= 1) {
    // The column and the base as blocks.
    box(m, [-c * 0.75, g.baseH * 0.5, -c * 0.75], [c * 0.75, y0, c * 0.75], tone(scale3(wood, 0.9), 1), ['ny', 'py']);
    box(m, [-R * 0.85, 0, -R * 0.85], [R * 0.85, g.baseH * 0.5, R * 0.85], tone(scale3(wood, 0.85), 2), ['ny']);
    return m;
  }
  const ap = g.apron ?? 0;
  if (ap > 0) {
    const ka = g.apronK ?? 0.86;
    ovalShell(m, [[ka, y0 - ap], [ka, y0]], seg, tone(scale3(wood, 0.88), 3), outline);
  }
  // The pedestal: turned (six-sided under a hexagon) on a round base, or on four feet.
  const turned = { phase: outline.phase, smooth: !six };
  const sides = six ? 6 : 8;
  const col = tone(scale3(wood, 0.92), 1);
  const cross = g.foot === 'cross';
  const yb = cross ? 0.08 : 0;
  if (cross) {
    const f = 0.04;
    const feet = tone(scale3(wood, 0.85), 2);
    box(m, [-R, 0, -f], [R, yb, f], feet, ['ny']);
    box(m, [-f, 0, -R], [f, yb, -f], feet, ['ny', 'pz']);
    box(m, [-f, 0, f], [f, yb, R], feet, ['ny', 'nz']);
  }
  const foot = cross ? [[c * 1.15, yb], [c * 1.15, yb + 0.05], [c * 0.75, g.baseH + 0.03]] : [[R, 0], [R, 0.035], [R * 0.8, 0.06], [c * 1.1, g.baseH * 0.75], [c * 0.75, g.baseH + 0.03]];
  ovalShell(m, [...foot, [c * 0.62, h * 0.52], [c * 0.85, y0 - ap * 0.5], [c, y0]], sides, col, turned);
  return m;
}

/** Fabric, plastic and paint on a chair: lighter on top, darker underneath, at the sides and towards the floor. */
const shaded = (c, grime) => (p, n) => scale3(c, groundShade(p[1], 0.25, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.1 : n[1] < -0.5 ? 0.7 : Math.abs(n[0]) > 0.5 ? 0.88 : n[2] < -0.5 ? 0.82 : 1));

/**
 * An office chair: a five-star base on castors (one arm forward), a gas column, a padded seat on its pan, a padded
 * back on a spine, an arm rest each side on a bracket. Its front is +z. Settings `g`: `seat` (the cushion's top, m),
 * `hub` (z of the column), `headrest` (true: a shorter back under a head rest), and its collision, the same for every
 * variant: `base` [half width, height] and `baseZ` [in from the rear, in from the front] (the star), `stem` (half the
 * width of the block under the seat, which reaches the front), `pan` and `seatTop` (the seat's slab, from under its
 * mechanism), `seatRear` (how far the seat starts in front of the rear), `back` (the back's depth; it stands from
 * `seatTop` up), `arm` (an arm's width), `armY` [from, to], `armZ` [in from the rear, in from the front]. `look`:
 * `fabric`, `frame` (hex: base, pan, shells and brackets), `metal` (hex: the column), `pad` (hex: the arm rests),
 * `grime`.
 */
export function officeChairMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const grime = look.grime ?? 0.15;
  const fabric = hex(look.fabric);
  const frame = hex(look.frame ?? '#2b2d30');
  const seat = g.seat;
  const zs = -d / 2 + g.seatRear;
  if (level >= 2) {
    // The back and the block under the seat: a chair's outline, not its bounds.
    const m = new Mesh();
    box(m, [-w / 2 + g.arm, seat, -d / 2], [w / 2 - g.arm, h, -d / 2 + g.back * 0.5], scale3(fabric, 0.85), ['ny']);
    box(m, [-w / 2 + g.arm, 0, zs], [w / 2 - g.arm, seat, d / 2], scale3(frame, 1.2), ['ny']);
    return m;
  }
  const r = rng(seed);
  const m = new Mesh();
  const [bw, bh] = g.base;
  // Solid: the star, the block under the seat, the seat, the arms, the back.
  m.boxes = [
    [-bw, 0, -d / 2 + g.baseZ[0], bw, bh, d / 2 - g.baseZ[1]],
    [-g.stem, 0, -g.stem, g.stem, seat, d / 2],
    [-w / 2, g.pan, zs, w / 2, g.seatTop, d / 2],
    [w / 2 - g.arm, g.armY[0], -d / 2 + g.armZ[0], w / 2, g.armY[1], d / 2 - g.armZ[1]],
    [-w / 2, g.armY[0], -d / 2 + g.armZ[0], -w / 2 + g.arm, g.armY[1], d / 2 - g.armZ[1]],
    [-w / 2, g.seatTop, -d / 2, w / 2, h, -d / 2 + g.back],
  ];
  const tint = (c, k = 1) => shaded(scale3(c, k * (1 + r.jitter(0.03))), grime);
  const cz = g.hub ?? 0;
  const R = bw - 0.008;
  const base = tint(frame);
  const dark = scale3(frame, 0.6);
  // The star: five tapered arms, one forward, a castor under each tip.
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 + (k * Math.PI * 2) / 5;
    const dir = [Math.cos(a), 0, Math.sin(a)];
    const side = [-dir[2], 0, dir[0]];
    const at = (t, s, y) => [dir[0] * t + side[0] * s, y, cz + dir[2] * t + side[2] * s];
    const y1 = level === 0 ? 0.045 : 0;
    const hub = [at(0.03, -0.03, bh), at(0.03, 0.03, bh), at(0.03, 0.03, y1), at(0.03, -0.03, y1)];
    const tip = [at(R, -0.02, bh * 0.7), at(R, 0.02, bh * 0.7), at(R, 0.02, y1), at(R, -0.02, y1)];
    quadN(m, hub[0], hub[1], tip[1], tip[0], [0, 1, 0], base);
    quadN(m, hub[1], hub[2], tip[2], tip[1], side, base);
    quadN(m, hub[0], hub[3], tip[3], tip[0], [-side[0], 0, -side[2]], base);
    if (level === 0) {
      quadN(m, tip[0], tip[1], tip[2], tip[3], dir, base);
      const [x, , z] = at(R - 0.026, 0, 0);
      box(m, [x - 0.025, 0, z - 0.025], [x + 0.025, 0.048, z + 0.025], dark, ['ny']);
    }
  }
  const panY = seat - 0.085;
  const metal = tint(hex(look.metal ?? '#8b8d8f'));
  if (level === 0) {
    // The hub, the gas column (its sleeve, then the piston), the mechanism under the pan.
    ovalShell(m, [[0.05, 0.045], [0.05, bh + 0.008], [0.034, bh + 0.008], [0.034, bh + 0.17], [0.021, bh + 0.17], [0.021, panY - 0.03]], 8, (p, n, row) => (row < 2 ? base(p, n) : metal(p, n)), { cz });
    box(m, [-0.09, panY - 0.04, cz - 0.1], [0.09, panY, cz + 0.1], dark, ['py']);
  } else box(m, [-0.03, bh, cz - 0.03], [0.03, panY, cz + 0.03], metal, ['ny', 'py']);
  // The seat: a pan to the front of the bounds, the cushion on it.
  const sw = w / 2 - g.arm;
  const cushion = tint(fabric);
  if (level === 0) {
    box(m, [-sw, panY, zs], [sw, panY + 0.03, d / 2], base, ['py']);
    pad(m, [-sw + 0.004, panY + 0.03, zs + 0.004], [sw - 0.004, seat, d / 2 - 0.004], 0.022, cushion);
  } else box(m, [-sw, panY, zs], [sw, seat, d / 2], cushion);
  // The back: a shell at the rear of the bounds, its cushion in front, on a spine from under the seat.
  const xb = w / 2 - 0.07;
  const by0 = seat + 0.14;
  const by1 = g.headrest ? h - 0.25 : h;
  const zr = -d / 2;
  const padC = tint(fabric, 1.04);
  if (level === 0) {
    box(m, [-xb, by0, zr], [xb, by1, zr + 0.03], base, ['pz']);
    box(m, [-xb + 0.008, by0 + 0.008, zr + 0.03], [xb - 0.008, by1 - 0.008, zr + 0.075], padC, ['nz']);
    box(m, [-0.035, panY - 0.03, zr + 0.003], [0.035, by0, zr + 0.027], dark, ['py']);
    box(m, [-0.035, panY - 0.03, zr + 0.027], [0.035, panY, zs + 0.06], dark, ['nz', 'pz']);
    if (g.headrest) {
      box(m, [-0.03, by1, zr + 0.003], [0.03, h - 0.17, zr + 0.027], dark, ['ny', 'py']);
      box(m, [-0.15, h - 0.17, zr], [0.15, h, zr + 0.03], base, ['pz']);
      box(m, [-0.142, h - 0.162, zr + 0.03], [0.142, h - 0.008, zr + 0.07], padC, ['nz']);
    }
  } else box(m, [-xb, by0, zr], [xb, h, zr + 0.07], padC);
  // The arms: a rest out to the side of the bounds, on an upright from a bracket under the pan.
  const rest = tint(hex(look.pad ?? look.frame ?? '#2b2d30'), 1.15);
  const top = g.armY[1] - 0.04;
  const za = -d / 2 + g.armZ[0] + 0.1;
  const zb = d / 2 - g.armZ[1] - 0.07;
  for (const sx of [-1, 1]) {
    const bx = (x0, y0, z0, x1, y1, z1, colour, skip = []) => {
      const flip = { px: 'nx', nx: 'px' };
      if (sx > 0) box(m, [x0, y0, z0], [x1, y1, z1], colour, skip);
      else box(m, [-x1, y0, z0], [-x0, y1, z1], colour, skip.map((f) => flip[f] ?? f));
    };
    bx(w / 2 - g.arm + 0.012, top - 0.04, za, w / 2, top, zb, rest, level === 0 ? [] : ['ny']);
    bx(w / 2 - 0.045, panY, -0.025, w / 2 - 0.012, top - 0.04, 0.025, base, ['ny', 'py']);
    if (level === 0) bx(sw - 0.05, panY - 0.025, -0.025, w / 2 - 0.012, panY, 0.025, base, ['nx']);
  }
  return m;
}
