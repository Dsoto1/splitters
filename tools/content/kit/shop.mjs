// Shop and market pieces (kit-prop families `shelf`, `stall`, `bin`; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6
// part 4): shop shelving (a spine panel on a base, tiers of shelves stocked with boxes, bags, tins or bottles, on both
// sides or one), a market stall (a trestle table of goods under a striped canopy on two poles), a market counter (a
// long plank counter, panelled or draped) and a waste bin. Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2].
//
// Shelving and the stall collide as finer boxes (a generator's `boxes`: tools/content/kitprops.mjs): the spine, the
// base and each tier; the table, its legs, the poles and the canopy in steps. The counter and the bin are their box.
//
// Level 1 keeps the outline (goods as one block a shelf); level 2 is the bounds, or the stall's table and canopy.

import { rng } from '../env/rng.mjs';
import { Mesh, box, groundShade, hex, quadN, scale3, standIn, triN } from './geom.mjs';
import { woodTone } from './crate.mjs';

const lerp = (p, q, t) => p + (q - p) * t;
const GOODS = {
  boxes: ['#b5894f', '#c9a36a', '#a8432f', '#3f6d9b', '#d8c9a0', '#587a3e', '#d9a429'],
  bags: ['#d9a429', '#c24a30', '#3f8a8f', '#e3dccb', '#7a4a8a', '#5f9a4a', '#d87a2a'],
  tins: ['#a8adb0', '#b23a2f', '#2f5f8a', '#d8c23a', '#3f7a4a', '#c9c2b0'],
  bottles: ['#3f6a3a', '#6a4a2a', '#2f4f6f', '#a8b8a8', '#7a2f2a', '#c9a23a'],
};

/**
 * Shop shelving. Settings `g`: `sides` (2: stocked both ways from a spine down the middle; 1: a back panel at −z,
 * shelves towards +z), `spine` (the panel's collision thickness, m), `base` (base height), `tiers` (shelves a side
 * above the base), `reach` [bottom, top] (how far a tier's shelf reaches from the middle, as a part of the half
 * depth; the base reaches all of it), `stock` (how tall a tier's goods stand, as a part of the gap between tiers),
 * `goods` ('boxes', 'bags', 'tins', 'bottles' or 'mixed'), `fill` (0–1). `look`: `frame` (hex: the steel), `panel`
 * (hex: the spine), `header` (hex: a painted board along the top), `shelf` (hex), `grime`.
 */
export function shelfMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const frame = hex(look.frame);
  const panel = hex(look.panel ?? look.frame);
  if (level >= 2) return standIn(size, scale3(frame, 0.9), scale3(panel, 0.8));
  const r = rng(seed);
  const m = new Mesh();
  const two = (g.sides ?? 2) === 2;
  const grime = look.grime ?? 0.2;
  const shade = (c) => (p) => scale3(c, groundShade(p[1], 0.3, 1 - grime * 0.5));
  const tiers = Math.max(1, g.tiers ?? 3);
  const base = g.base;
  // The middle (z of the panel's centre) and the half depth a shelf can reach from it.
  const sp = g.spine;
  const zMid = two ? 0 : -d / 2 + sp / 2;
  const half = two ? d / 2 : d - sp / 2;
  const sidesZ = two ? [-1, 1] : [1];
  const header = look.header ? hex(look.header) : null;
  const headH = header ? 0.16 : 0;
  // Solid: the spine, the base, each tier's shelf and goods (the same for every variant of a family).
  m.boxes = [[-w / 2, 0, zMid - sp / 2, w / 2, h, zMid + sp / 2]];
  m.boxes.push([-w / 2, 0, -d / 2, w / 2, base, d / 2]);
  // The spine panel between two end uprights, the header along its top.
  const up = 0.05;
  box(m, [-w / 2 + up, base, zMid - 0.02], [w / 2 - up, h - headH, zMid + 0.02], shade(panel), ['ny', 'nx', 'px', ...(header ? ['py'] : [])]);
  for (const sx of [-1, 1]) box(m, [sx < 0 ? -w / 2 : w / 2 - up, 0, zMid - sp / 2], [sx < 0 ? -w / 2 + up : w / 2, h, zMid + sp / 2], shade(scale3(frame, 0.85)), ['ny']);
  if (header) box(m, [-w / 2 + up, h - headH, zMid - sp / 2], [w / 2 - up, h, zMid + sp / 2], header, ['nx', 'px']);
  // The base: a plinth the full depth, its top the lowest shelf.
  const shelfC = shade(hex(look.shelf ?? look.frame));
  box(m, [-w / 2, 0, two ? -d / 2 : zMid + sp / 2 - 0.001], [w / 2, base, d / 2], shade(scale3(frame, 0.8)), ['ny']);
  if (!two) box(m, [-w / 2 + up, 0, -d / 2], [w / 2 - up, base, zMid + sp / 2], shade(scale3(frame, 0.8)), ['ny', 'nx', 'px', 'pz']);
  const gap = (h - headH - base) / (tiers + 1);
  const kinds = Object.keys(GOODS);
  const stockOn = (y, reach, room, sz, k) => {
    // Goods on a shelf whose top is at y, from the spine's face out to `reach`, `room` high at most.
    const kind = g.goods === 'mixed' || !g.goods ? kinds[r.int(0, kinds.length - 1)] : g.goods;
    const cols = GOODS[kind];
    const z0 = zMid + sz * (sp / 2);
    const z1 = zMid + sz * (reach - 0.03);
    const zLo = Math.min(z0, z1);
    const zHi = Math.max(z0, z1);
    const face = sz > 0 ? 'nz' : 'pz';
    if (level >= 1) {
      box(m, [-w / 2 + up + 0.04, y, zLo], [w / 2 - up - 0.04, y + room * 0.8, zHi], scale3(hex(cols[(seed + k) % cols.length]), 0.8), ['ny', face]);
      return;
    }
    const unit = kind === 'boxes' ? 0.24 : kind === 'bags' ? 0.2 : 0.13;
    let x = -w / 2 + up + 0.03;
    const end = w / 2 - up - 0.03;
    const fill = g.fill ?? 0.85;
    while (x < end) {
      const bw = unit * r.range(0.85, 1.15);
      if (x + bw > end) break;
      if (r.next() > fill) {
        x += bw;
        continue;
      }
      const c = scale3(hex(cols[r.int(0, cols.length - 1)]), r.range(0.8, 1.05));
      const bh = room * (kind === 'bottles' ? r.range(0.8, 0.95) : kind === 'tins' ? r.range(0.45, 0.6) : r.range(0.55, 0.9));
      const col = (p, n) => scale3(c, n[1] > 0.5 ? 1.15 : Math.abs(n[2]) > 0.5 ? 1 : 0.72);
      if (kind === 'bags') {
        // A bag: a pillow shape, narrower at its top.
        const t = bw * 0.18;
        const zf = sz > 0 ? zHi : zLo;
        const zb = sz > 0 ? zLo : zHi;
        quadN(m, [x, y, zf], [x + bw, y, zf], [x + bw - t, y + bh, zf - sz * 0.03], [x + t, y + bh, zf - sz * 0.03], [0, 0.2, sz], c);
        quadN(m, [x + t, y + bh, zf - sz * 0.03], [x + bw - t, y + bh, zf - sz * 0.03], [x + bw - t, y + bh, zb], [x + t, y + bh, zb], [0, 1, 0], scale3(c, 1.15));
        for (const s of [0, 1]) quadN(m, [x + s * bw, y, zf], [x + s * bw, y, zb], [x + (s ? bw - t : t), y + bh, zb], [x + (s ? bw - t : t), y + bh, zf - sz * 0.03], [s ? 1 : -1, 0.2, 0], scale3(c, 0.72));
      } else {
        const pad = kind === 'boxes' ? 0 : bw * 0.12;
        box(m, [x + pad, y, zLo], [x + bw - pad, y + bh, zHi], col, ['ny', face]);
        // A label band on tins and bottles.
        if (kind !== 'boxes') {
          const zf = (sz > 0 ? zHi : zLo) + sz * 0.002;
          quadN(m, [x + pad, y + bh * 0.3, zf], [x + bw - pad, y + bh * 0.3, zf], [x + bw - pad, y + bh * 0.62, zf], [x + pad, y + bh * 0.62, zf], [0, 0, sz], scale3(hex('#e3dccb'), 0.95));
        }
      }
      x += bw + 0.012;
    }
  };
  for (const sz of sidesZ) {
    // On the base, then each tier: a shelf board on the spine, shallower towards the top.
    stockOn(base, half, gap * (g.stock ?? 0.7), sz, sz + 3);
    for (let k = 1; k <= tiers; k++) {
      const y = base + gap * k;
      const reach = half * lerp(g.reach?.[0] ?? 0.85, g.reach?.[1] ?? 0.6, tiers > 1 ? (k - 1) / (tiers - 1) : 0);
      const za = zMid + sz * 0.02;
      const zb = zMid + sz * reach;
      box(m, [-w / 2 + up, y - 0.03, Math.min(za, zb)], [w / 2 - up, y, Math.max(za, zb)], shelfC, [sz > 0 ? 'nz' : 'pz']);
      const room = gap * (g.stock ?? 0.7);
      stockOn(y, reach, room, sz, k * 2 + sz);
      if (sz === sidesZ[0] || two) {
        const b = [-w / 2, y - 0.03, Math.min(za, zb), w / 2, y + room, Math.max(za, zb)];
        b[2] = sz > 0 ? zMid + sp / 2 : b[2];
        b[5] = sz > 0 ? b[5] : zMid - sp / 2;
        m.boxes.push(b);
      }
    }
  }
  return m;
}

/**
 * A market stall. Settings `g`: `table` [half width, top height, thickness] (the trestle table runs the full depth),
 * `leg` (leg width), `pole` (the two end poles' width), `eaves` (the canopy's lowest edge, m), `stripes` (a side).
 * `look`: `wood`, `canvas`, `stripe` (hex: alternate panels), `goods` (0–1: how much lies on the table), `jitter`,
 * `grime`.
 */
export function stallMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  const canvas = hex(look.canvas);
  const stripe = look.stripe ? hex(look.stripe) : null;
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const [tw, ty, tt] = g.table;
  const eaves = g.eaves;
  const pole = g.pole;
  // Solid: the table and its legs, the poles, the canopy as three steps.
  const lx = tw - g.leg * 1.5;
  const lz = d / 2 - g.leg * 2;
  m.boxes = [[-tw, ty - tt, -d / 2, tw, ty, d / 2]];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.boxes.push([Math.min(sx * lx, sx * (lx - g.leg)), 0, Math.min(sz * lz, sz * (lz - g.leg)), Math.max(sx * lx, sx * (lx - g.leg)), ty - tt, Math.max(sz * lz, sz * (lz - g.leg))]);
  for (const sz of [-1, 1]) m.boxes.push([-pole / 2, ty, sz < 0 ? -d / 2 : d / 2 - pole, pole / 2, h, sz < 0 ? -d / 2 + pole : d / 2]);
  const rise = h - eaves;
  for (let k = 0; k < 3; k++) m.boxes.push([(-w / 2) * (1 - k / 3), eaves + (rise * k) / 3, -d / 2, (w / 2) * (1 - k / 3), eaves + (rise * (k + 1)) / 3, d / 2]);
  // The table: a plank top on four legs with a rail between them.
  box(m, [-tw, ty - tt, -d / 2], [tw, ty, d / 2], tone(wood, 1));
  if (level < 2) {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) box(m, [Math.min(sx * lx, sx * (lx - g.leg)), 0, Math.min(sz * lz, sz * (lz - g.leg))], [Math.max(sx * lx, sx * (lx - g.leg)), ty - tt, Math.max(sz * lz, sz * (lz - g.leg))], tone(scale3(wood, 0.9), 2), ['ny', 'py']);
    for (const sz of [-1, 1]) box(m, [-pole / 2, ty, sz < 0 ? -d / 2 : d / 2 - pole], [pole / 2, h - 0.02, sz < 0 ? -d / 2 + pole : d / 2], tone(scale3(wood, 0.85), 3), ['ny', 'py']);
  }
  // The canopy: two slopes from the ridge to the eaves, in panels of alternate colours, with a hanging edge.
  const panels = level === 0 ? Math.max(2, g.stripes ?? 6) : 1;
  const drop = 0.16;
  for (const sx of [-1, 1])
    for (let k = 0; k < panels; k++) {
      const za = -d / 2 + (d * k) / panels;
      const zb = -d / 2 + (d * (k + 1)) / panels;
      const c = stripe && k % 2 ? stripe : level === 0 || !stripe ? canvas : scale3([canvas[0] + stripe[0], canvas[1] + stripe[1], canvas[2] + stripe[2]], 0.5);
      const col = (p) => scale3(c, 0.82 + 0.18 * ((p[1] - eaves) / rise));
      quadN(m, [0, h, za], [0, h, zb], [(sx * w) / 2, eaves + drop, zb], [(sx * w) / 2, eaves + drop, za], [sx * 0.5, 1, 0], col);
      if (level < 2) quadN(m, [(sx * w) / 2, eaves, za], [(sx * w) / 2, eaves, zb], [(sx * w) / 2, eaves + drop, zb], [(sx * w) / 2, eaves + drop, za], [sx, 0, 0], scale3(c, 0.8));
    }
  // The gables: the canvas's ends, and the underside (seen from below, darker).
  for (const sz of [-1, 1]) {
    const z = (sz * d) / 2;
    triN(m, [-w / 2, eaves + drop, z], [w / 2, eaves + drop, z], [0, h, z], [0, 0, sz], scale3(canvas, 0.7));
  }
  if (level < 2) for (const sx of [-1, 1]) quadN(m, [0, h - 0.01, -d / 2], [0, h - 0.01, d / 2], [(sx * w) / 2, eaves + drop - 0.01, d / 2], [(sx * w) / 2, eaves + drop - 0.01, -d / 2], [-sx * 0.5, -1, 0], scale3(canvas, 0.5));
  if (level === 0) {
    // Goods on the table: shallow trays of produce and a few boxes.
    const n = Math.round((look.goods ?? 0.7) * 6);
    const cols = ['#b23a2f', '#d9a429', '#587a3e', '#d87a2a', '#7a4a8a', '#c9a36a'];
    for (let k = 0; k < n; k++) {
      const z = lerp(-d / 2 + 0.25, d / 2 - 0.25, n > 1 ? k / (n - 1) : 0.5) + r.jitter(0.05);
      const sw = r.range(0.2, 0.3);
      const x = r.jitter(tw - sw - 0.05);
      box(m, [x - sw, ty, z - 0.14], [x + sw, ty + 0.07, z + 0.14], tone(scale3(wood, 0.8), 20 + k), ['ny']);
      box(m, [x - sw + 0.02, ty + 0.07, z - 0.12], [x + sw - 0.02, ty + r.range(0.1, 0.16), z + 0.12], scale3(hex(cols[r.int(0, cols.length - 1)]), r.range(0.8, 1)), ['ny']);
    }
  }
  return m;
}

/**
 * A market counter: a long plank top on a panelled or draped front. Settings `g`: `top` (thickness, m), `over` (how
 * far the top overhangs the body), `posts` (uprights along a side). `look`: `wood`, `top` (hex), `cloth` (hex: draped
 * to the ground instead of panels), `jitter`, `grime`.
 */
export function counterMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const wood = hex(look.wood);
  const topC = hex(look.top ?? look.wood);
  if (level >= 2) return standIn(size, topC, scale3(look.cloth ? hex(look.cloth) : wood, 0.8));
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const alongZ = d >= w;
  const L = alongZ ? d : w;
  const T = alongZ ? w : d;
  const P = (u, y, v) => (alongZ ? [v, y, u] : [u, y, v]);
  const bx = (u0, y0, v0, u1, y1, v1, c, skip = []) => {
    const a = P(u0, y0, v0);
    const b = P(u1, y1, v1);
    // (Face names are in world axes: the long axis swaps x and z.)
    const sw = (k) => (alongZ ? { px: 'pz', nx: 'nz', pz: 'px', nz: 'nx' }[k] ?? k : k);
    box(m, [Math.min(a[0], b[0]), y0, Math.min(a[2], b[2])], [Math.max(a[0], b[0]), y1, Math.max(a[2], b[2])], c, skip.map(sw));
  };
  const t = g.top;
  const over = g.over ?? 0.04;
  const boards = level === 0 ? 3 : 1;
  for (let i = 0; i < boards; i++) bx(-L / 2, h - t, -T / 2 + (T * i) / boards, L / 2, h, -T / 2 + (T * (i + 1)) / boards, tone(topC, 10 + i), [...(i > 0 ? ['nz'] : []), ...(i < boards - 1 ? ['pz'] : [])]);
  if (look.cloth) {
    const c = hex(look.cloth);
    bx(-L / 2 + over, 0, -T / 2 + over, L / 2 - over, h - t, T / 2 - over, (p) => scale3(c, groundShade(p[1], 0.4, 0.7)), ['ny', 'py']);
    return m;
  }
  bx(-L / 2 + over, 0, -T / 2 + over, L / 2 - over, h - t, T / 2 - over, tone(scale3(wood, 0.85), 1), ['ny', 'py']);
  if (level === 0) {
    // Uprights and a kick board proud of the panels.
    const posts = Math.max(2, g.posts ?? 5);
    for (const sv of [-1, 1])
      for (let k = 0; k < posts; k++) {
        const u = lerp(-L / 2 + over, L / 2 - over - 0.07, k / (posts - 1));
        bx(u, 0, sv < 0 ? -T / 2 + over - 0.02 : T / 2 - over, u + 0.07, h - t, sv < 0 ? -T / 2 + over : T / 2 - over + 0.02, tone(wood, 20 + k), ['ny', 'py', sv < 0 ? 'pz' : 'nz']);
      }
  }
  return m;
}

/**
 * A waste bin: a tapered body under a rim. Settings `g`: `taper` (the foot's size as a part of the top's), `rim`
 * (rim height, m), `bands` (painted bands round it). `look`: `paint`, `rim` (hex), `band` (hex), `grime`.
 */
export function wasteBinMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const paint = hex(look.paint);
  if (level >= 2) return standIn(size, scale3(paint, 0.5), paint);
  const m = new Mesh();
  const grime = look.grime ?? 0.3;
  const k = g.taper ?? 0.8;
  const rim = g.rim ?? 0.03;
  const col = (c) => (p) => scale3(c, groundShade(p[1], 0.2, 1 - grime * 0.6));
  const yr = h - rim;
  const ring = (y, s) => [[(-w / 2) * s, y, (-d / 2) * s], [(w / 2) * s, y, (-d / 2) * s], [(w / 2) * s, y, (d / 2) * s], [(-w / 2) * s, y, (d / 2) * s]];
  const dirs = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
  const band = look.band && level === 0 ? hex(look.band) : null;
  // The body in bands of height, each a ring of four tapered faces (the foot stands on the full footprint's middle).
  const cuts = band ? [0, 0.55, 0.7, 1] : [0, 1];
  const sAt = (f) => lerp(k, 0.94, f);
  for (let c = 0; c + 1 < cuts.length; c++) {
    const a = ring(yr * cuts[c], sAt(cuts[c]));
    const b = ring(yr * cuts[c + 1], sAt(cuts[c + 1]));
    for (let i = 0; i < 4; i++) quadN(m, a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i], dirs[i], col(band && c === 1 ? band : paint));
  }
  // The rim: a band the full footprint wide; the top is the dark inside (a lid at level 1).
  const rc = col(hex(look.rim ?? look.paint));
  const o0 = ring(yr, 1);
  const o1 = ring(h, 1);
  for (let i = 0; i < 4; i++) quadN(m, o0[i], o0[(i + 1) % 4], o1[(i + 1) % 4], o1[i], dirs[i], rc);
  const under = ring(yr, 0.94);
  for (let i = 0; i < 4; i++) quadN(m, under[i], under[(i + 1) % 4], o0[(i + 1) % 4], o0[i], [0, -1, 0], scale3(paint, 0.5));
  if (level === 0) {
    const i1 = ring(h, 0.86);
    const i0 = ring(h - 0.12, 0.84);
    for (let i = 0; i < 4; i++) {
      quadN(m, o1[i], o1[(i + 1) % 4], i1[(i + 1) % 4], i1[i], [0, 1, 0], rc);
      quadN(m, i1[i], i1[(i + 1) % 4], i0[(i + 1) % 4], i0[i], [-dirs[i][0], 0, -dirs[i][2]], scale3(paint, 0.3));
    }
    quadN(m, i0[0], i0[1], i0[2], i0[3], [0, 1, 0], scale3(hex('#2a2622'), 1));
  } else quadN(m, o1[0], o1[1], o1[2], o1[3], [0, 1, 0], scale3(paint, 0.35));
  // (The foot's four corners touch the ground inside the footprint; the rim is the bounds.)
  quadN(m, ...ring(0, k), [0, -1, 0], scale3(paint, 0.3));
  return m;
}
