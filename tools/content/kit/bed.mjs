// Beds (kit-prop family `bed`; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6 part 6): a double bed (a frame on short
// legs, a headboard, a mattress, pillows leaning on the headboard, a blanket turned back) and a bunk bed (two bunks
// between four broad posts, a head and a foot board each, a rail along one side, a ladder at the foot). Each fills its
// bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2]; the head is at −z.
//
// Both collide as finer boxes, as the pieces they replace did (a generator's `boxes`: tools/content/kitprops.mjs).
// The double bed: its deck, floor to mattress, and the headboard with the pillows against it. The bunk bed: the four
// posts, each bunk's slab, its head (the board and the pillow) and its foot rail, and the rail along the −x side of
// each; rounds pass under the lower bunk, between the bunks and between the ladder's rungs.
//
// Level 1 keeps the outline (frame, mattress and blanket as blocks); level 2 is the deck and the headboard, or the
// posts and the two slabs.

import { rng } from '../env/rng.mjs';
import { Mesh, box, groundShade, hex, pad, quadN, scale3 } from './geom.mjs';
import { woodTone } from './crate.mjs';

/** Bedding: lighter on top, darker at the sides. */
const linen = (c, k = 1) => (p, n) => scale3(c, k * (n[1] > 0.5 ? 1.08 : Math.abs(n[0]) > 0.5 ? 0.86 : 0.92) * groundShade(p[1], 0.2, 0.9));

/**
 * A pillow leaning on the headboard: `x0`–`x1` wide, standing on `y0` up to `y1`, its back at `zb`, `bt` thick at its
 * foot and `tt` at its top. Its front, top and two sides.
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
 * A bed. Settings `g`: `style` ('double' or 'bunk') and that style's own (below). `look`: `wood`, `sheet` (hex: the
 * mattress and pillows), `blanket` (hex; none: a bare mattress), `blanket2` (hex: the upper bunk's, default the
 * same), `fold` (hex: the blanket's turned-back edge, default the sheet), `head` (hex: an upholstered headboard
 * panel), `runner` (hex: a runner across the double bed's blanket), `jitter`, `grime`.
 */
export function bedMesh(seed, size, g, look, level) {
  return g.style === 'bunk' ? bunkMesh(seed, size, g, look, level) : doubleMesh(seed, size, g, look, level);
}

/**
 * The double bed. Settings: `legs` (leg height, m), `rail` (the frame's top), `mattress` (the mattress's top),
 * `board` (the headboard's thickness), `headboard` ('cap': a cap along its top; 'plain'), `pillows` (leaning on the
 * headboard), and its collision, the same for every variant:
 * `deck` (the top of the block from the floor) and `head` (the depth of the headboard's block, pillows included).
 */
function doubleMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  const sheet = hex(look.sheet ?? '#d9d4c6');
  const blanket = look.blanket ? hex(look.blanket) : null;
  const zh = -d / 2 + g.board;
  if (level >= 2) {
    // The deck and the headboard: a bed's outline, not its bounds.
    const m = new Mesh();
    box(m, [-w / 2, 0, -d / 2], [w / 2, h, zh], scale3(wood, 0.85), ['ny']);
    box(m, [-w / 2, 0, zh], [w / 2, g.mattress, d / 2], scale3(blanket ?? sheet, 0.85), ['ny', 'nz']);
    return m;
  }
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  // Solid: the deck from the floor, and the headboard with the pillows against it.
  m.boxes = [
    [-w / 2, 0, -d / 2, w / 2, g.deck, d / 2],
    [-w / 2, g.deck, -d / 2, w / 2, h, -d / 2 + g.head],
  ];
  const legs = level === 0 ? g.legs : 0;
  const rail = g.rail;
  const body = tone(wood, 1);
  if (level === 0) {
    const f = 0.08;
    const legC = tone(scale3(wood, 0.8), 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, [sx < 0 ? -w / 2 : w / 2 - f, 0, sz < 0 ? -d / 2 : d / 2 - f], [sx < 0 ? -w / 2 + f : w / 2, legs, sz < 0 ? -d / 2 + f : d / 2], legC, ['ny', 'py']);
  }
  // The frame, the headboard from the floor to the top, a foot board a little above the frame.
  box(m, [-w / 2, legs, zh], [w / 2, rail, d / 2], body, ['nz']);
  box(m, [-w / 2, legs, -d / 2], [w / 2, h, zh], tone(scale3(wood, 0.96), 3), level === 0 ? [] : ['ny']);
  const foot = Math.min(g.deck, rail + 0.1);
  if (level === 0) box(m, [-w / 2, rail, d / 2 - 0.035], [w / 2, foot, d / 2], tone(scale3(wood, 1.04), 4), ['ny']);
  // The mattress inside the frame, the blanket over it and down its sides, turned back below the pillows.
  const in0 = 0.035;
  const x0 = -w / 2 + in0;
  const x1 = w / 2 - in0;
  const z1 = d / 2 - (level === 0 ? 0.04 : 0);
  const top = g.mattress;
  const lap = 0.012;
  const zf = zh + (z1 - zh) * 0.3;
  box(m, [x0, rail, zh], [x1, top - (blanket ? lap : 0), blanket ? zf : z1], linen(sheet), ['ny', 'nz', ...(blanket ? ['pz'] : [])]);
  if (blanket) {
    const cover = linen(blanket);
    box(m, [x0 - lap, rail + 0.01, zf], [x1 + lap, top, z1], cover, ['ny', ...(level === 0 ? [] : ['nz'])]);
    if (level === 0) {
      const fold = linen(hex(look.fold ?? look.sheet ?? '#d9d4c6'), 1.04);
      box(m, [x0 - lap, top - 0.03, zf - 0.16], [x1 + lap, top + 0.002, zf], fold, ['ny', 'pz']);
    }
  }
  // Pillows leaning on the headboard (inside its block).
  const n = Math.max(1, g.pillows ?? 2);
  const zt = top - (blanket ? lap : 0);
  const reach = g.head - g.board;
  const pt = Math.min(h - 0.05, top + 0.14);
  const white = linen(sheet, 1.06);
  for (let i = 0; i < (level === 0 ? n : 1); i++) {
    const k = level === 0 ? n : 1;
    const xa = x0 + 0.06 + ((x1 - x0 - 0.12) * i) / k + 0.02;
    const xb = x0 + 0.06 + ((x1 - x0 - 0.12) * (i + 1)) / k - 0.02;
    leaning(m, xa, xb, zt, pt, zh, reach, reach * 0.45, white);
  }
  if (level >= 1) return m;
  // The headboard's face above the pillows: an upholstered panel, or a cap along the top.
  if (look.head) box(m, [-w / 2 + 0.03, top, zh], [w / 2 - 0.03, h - 0.015, zh + 0.012], linen(hex(look.head)), ['nz', 'ny']);
  else if ((g.headboard ?? 'cap') === 'cap') box(m, [-w / 2, h - 0.04, zh], [w / 2, h, zh + 0.014], tone(scale3(wood, 1.08), 10), ['nz']);
  if (blanket && look.runner) {
    // A runner across the blanket near the foot.
    const zr = z1 - (z1 - zf) * 0.36;
    box(m, [x0 - lap - 0.003, rail + 0.03, zr], [x1 + lap + 0.003, top + 0.003, zr + (z1 - zf) * 0.2], linen(hex(look.runner)), ['ny', 'nz', 'pz']);
  }
  return m;
}

/**
 * The bunk bed. Settings: `low` and `high` (each bunk's underside, m), `slab` (a bunk's height: frame, mattress and
 * bedding), `post` [width, depth] (the four posts, as broad as they are in the ends' plane), `rail` (thickness of the
 * side rail's block), `lowRail` and `topRail` [from, to] (the rail along the −x side of each bunk), `headLow` and
 * `headHigh` [to, depth] (each head's block: the board between the posts and the pillow), `footRail` (height of each
 * foot rail's block above its slab), `ladder` (the ladder's width, at the foot, from the +x post), `rungs`. All but
 * the last two are its collision too, the same for every variant.
 */
function bunkMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  const sheet = hex(look.sheet ?? '#d9d4c6');
  const [pw, pd] = g.post;
  const slab = g.slab;
  const bunks = [g.low, g.high];
  const posts = (m, colour, skip) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, [sx < 0 ? -w / 2 : w / 2 - pw, 0, sz < 0 ? -d / 2 : d / 2 - pd], [sx < 0 ? -w / 2 + pw : w / 2, h, sz < 0 ? -d / 2 + pd : d / 2], colour, skip);
  };
  if (level >= 2) {
    const m = new Mesh();
    posts(m, scale3(wood, 0.85), ['ny', 'py']);
    for (const [i, y] of bunks.entries()) box(m, [-w / 2, y, -d / 2 + pd], [w / 2, y + slab, d / 2 - pd], scale3(hex((i ? look.blanket2 : null) ?? look.blanket ?? look.sheet ?? '#d9d4c6'), 0.85), ['ny']);
    return m;
  }
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, { ...look, groundReach: 0.2 }, seed + k);
  const xi = w / 2 - pw;
  const zb = -d / 2 + pd;
  // Solid: the posts; each bunk's slab, its head (board and pillow) and foot rail; the rail along −x of each.
  m.boxes = [];
  for (const sx of [1, -1]) for (const sz of [-1, 1]) m.boxes.push([sx < 0 ? -w / 2 : xi, 0, sz < 0 ? -d / 2 : d / 2 - pd, sx < 0 ? -xi : w / 2, h, sz < 0 ? zb : d / 2]);
  const heads = [g.headLow, g.headHigh];
  const rails = [g.lowRail, g.topRail];
  for (const [i, y] of bunks.entries()) {
    m.boxes.push([-w / 2, y, zb, w / 2, y + slab, d / 2]);
    m.boxes.push([i ? -w / 2 : -xi, y, -d / 2, xi, heads[i][0], -d / 2 + heads[i][1]]);
    m.boxes.push([-w / 2, rails[i][0], zb, -w / 2 + g.rail, rails[i][1], d / 2]);
    m.boxes.push([-w / 2, y + slab, d / 2 - pd, xi, y + slab + g.footRail, d / 2]);
  }
  posts(m, tone(scale3(wood, 0.95), 1), ['ny']);
  const bt = 0.03;
  const z1 = d / 2 - pd;
  for (const [i, y] of bunks.entries()) {
    const frame = tone(wood, 10 + i);
    const fh = slab * 0.4;
    const top = y + slab;
    // The side rails, the board under the mattress, the head and foot boards between the posts.
    for (const sx of [-1, 1]) box(m, [sx < 0 ? -w / 2 : w / 2 - bt, y, zb], [sx < 0 ? -w / 2 + bt : w / 2, y + fh, z1], frame, ['nz', 'pz']);
    quadN(m, [-w / 2 + bt, y + 0.02, zb], [w / 2 - bt, y + 0.02, zb], [w / 2 - bt, y + 0.02, z1], [-w / 2 + bt, y + 0.02, z1], [0, -1, 0], tone(scale3(wood, 0.7), 20 + i));
    box(m, [-xi, y, -d / 2 + 0.01], [xi, heads[i][0], -d / 2 + 0.01 + bt], tone(scale3(wood, 1.04), 30 + i), ['nx', 'px']);
    box(m, [-xi, y, d / 2 - 0.03 - bt], [xi, top + g.footRail, d / 2 - 0.03], tone(scale3(wood, 1.04), 40 + i), ['nx', 'px']);
    // The rail along −x, between the end posts.
    const [ra, rb] = rails[i];
    box(m, [-w / 2, Math.max(ra, top), zb], [-w / 2 + bt, rb, z1], tone(scale3(wood, 1.02), 50 + i), ['nz', 'pz']);
    // The mattress, the blanket turned back below the pillow, the pillow.
    const x0 = -w / 2 + bt + 0.005;
    const x1 = w / 2 - bt - 0.005;
    const za = zb + 0.005;
    const zc = z1 - 0.005;
    const blanketHex = (i ? look.blanket2 : null) ?? look.blanket;
    const lap = 0.012;
    const mt = top - 0.02;
    const zf = za + (zc - za) * 0.3;
    if (level >= 1) {
      box(m, [x0, y + fh, za], [x1, mt, zc], linen(hex(blanketHex ?? look.sheet ?? '#d9d4c6')), ['ny']);
      continue;
    }
    box(m, [x0, y + fh, za], [x1, mt - (blanketHex ? lap : 0), blanketHex ? zf : zc], linen(sheet), ['ny', ...(blanketHex ? ['pz'] : [])]);
    if (blanketHex) {
      box(m, [x0, y + fh, zf], [x1, mt, zc], linen(hex(blanketHex)), ['ny', 'nz']);
      box(m, [x0, mt - 0.03, zf - 0.12], [x1, mt + 0.002, zf], linen(hex(look.fold ?? look.sheet ?? '#d9d4c6'), 1.04), ['ny', 'pz']);
    }
    const pz0 = -d / 2 + 0.01 + bt + 0.01;
    pad(m, [-xi + 0.05, mt - (blanketHex ? lap : 0), pz0], [xi - 0.05, mt + 0.075, pz0 + 0.32], 0.03, linen(sheet, 1.06));
  }
  // The ladder at the foot, proud of the foot boards: a stile, rungs from it to the +x post.
  const lx = xi - (g.ladder ?? 0.4);
  const st = 0.035;
  const lz0 = d / 2 - 0.028;
  const lz1 = d / 2;
  const ladder = tone(scale3(wood, 1.06), 60);
  const ly1 = bunks[1] + slab + g.footRail;
  box(m, [lx - st, 0, lz0], [lx, ly1, lz1], ladder, ['ny', ...(level === 0 ? [] : ['py'])]);
  const rungs = Math.max(2, g.rungs ?? 5);
  for (let k = 0; k < rungs; k++) {
    const y = (ly1 * (k + 0.7)) / (rungs + 0.4);
    box(m, [lx, y, lz0 + 0.004], [xi, y + 0.03, lz1 - 0.004], ladder, ['nx', 'px', ...(level === 0 ? [] : ['nz'])]);
  }
  return m;
}
