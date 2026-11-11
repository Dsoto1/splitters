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

import { rng } from '../env/rng.mjs';
import { Mesh, box, hex, quadN, scale3, standIn } from './geom.mjs';
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
 * (rails across the back when there are no slats). `look`: `wood`, `seat` (hex: a cushion or a painted seat),
 * `jitter`, `grime`.
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
    if (slats > 0) {
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
    box(m, [bx0, ySeat + (h - ySeat) * 0.25, bz0], [bx1, top, bz1], tone(wood, 4), ['nx', 'px', 'py']);
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
