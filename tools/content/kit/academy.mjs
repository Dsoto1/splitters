// Academy pieces (kit-prop families `door`, and the dormitory's `table` and `cabinet`; docs/map-briefs/st_johns): a
// thick oak door in its frame for the Room doorway (content/tiles/edges.json `door_room`: 2 m × 2.6 m), a desk with a
// shelf hutch, a slim closet. All generated here from seeds: nothing downloaded, nothing drawn from a photograph.
//
// The door (`door`) stands in the wall's plane, x across the doorway, its frame filling [-w/2, w/2] × [0, h] ×
// [-0.08, 0.08]; the leaf hangs on the +x jamb and swings to +z (`swing`, degrees: 0 shut, about 25 ajar, 90 open).
// A still prop: nothing moves in play. One family is one collision, so each swing is its own family: shut and ajar
// collide as the frame's slab (a closed room); open has none (`collide: "none"`: the doorway stays clear for players,
// bots and shots, the leaf standing in the room at the jamb). Ajar and open say `bounds: "within"`: the leaf reaches
// into the room. The open door's frame stands `back` m behind the prop's centre (−z), so its box is the frame and the
// leaf and no more (a set piece's footprint must hold a prop's whole box: map/setPieceCheck.ts). Leaves (`leaf`): 'plank' (boards under three iron strap hinges, a
// ring handle each side, ledges on the room side), 'glazed' (a framed door, reeded glass in its upper half behind
// glazing bars), 'panel' (framed, a diamond of mouldings on each panel), and for the painted doors of Tileset 11
// (kit.door.painted): 'framed' (a plain two-panel house door) and 'shop' (a kick plate under one tall pane); their
// furniture is a knob and a letter plate (`handle: 'knob'`) or an upright pull bar (`'pull'`) instead of the ring.
//
// The desk (`deskhutch`) is a pedestal desk with a hutch of shelves along its back, books on them; its front is +z.
// It collides as two boxes, the desk and the hutch, open over the desk top in front of the hutch. The closet
// (`closet`) is a tall narrow cupboard, one framed door on +z with a pull, a cap on top; it collides as its box.
// The built-in closet's front (`closetfront`) is what shows of a closet that is in a wall: a face frame and a door,
// 12 mm thick, set against the wall's face (its back is left out); the wall behind it is the closet and collides, it
// does not (`collide: "none"`).
//
// Level 1 keeps the outline (frame, leaf, straps; desk, hutch and shelves; case and door); level 2 is a few boxes.

import { rng } from '../env/rng.mjs';
import { Mesh, bar, box, hex, quad, quadN, scale3, standIn, triN } from './geom.mjs';
import { woodTone } from './crate.mjs';

const lerp = (p, q, t) => p + (q - p) * t;

const CORNERS = {
  px: (lo, hi) => [[hi[0], lo[1], hi[2]], [hi[0], lo[1], lo[2]], [hi[0], hi[1], lo[2]], [hi[0], hi[1], hi[2]]],
  nx: (lo, hi) => [[lo[0], lo[1], lo[2]], [lo[0], lo[1], hi[2]], [lo[0], hi[1], hi[2]], [lo[0], hi[1], lo[2]]],
  py: (lo, hi) => [[lo[0], hi[1], hi[2]], [hi[0], hi[1], hi[2]], [hi[0], hi[1], lo[2]], [lo[0], hi[1], lo[2]]],
  ny: (lo, hi) => [[lo[0], lo[1], lo[2]], [hi[0], lo[1], lo[2]], [hi[0], lo[1], hi[2]], [lo[0], lo[1], hi[2]]],
  pz: (lo, hi) => [[lo[0], lo[1], hi[2]], [hi[0], lo[1], hi[2]], [hi[0], hi[1], hi[2]], [lo[0], hi[1], hi[2]]],
  nz: (lo, hi) => [[hi[0], lo[1], lo[2]], [lo[0], lo[1], lo[2]], [lo[0], hi[1], lo[2]], [hi[0], hi[1], lo[2]]],
};

/** A box from `lo` to `hi` in a turned frame: every corner goes through `T` first (a leaf on its hinges). */
function tbox(m, T, lo, hi, colour, skip = []) {
  for (const [k, f] of Object.entries(CORNERS)) {
    if (skip.includes(k)) continue;
    const [a, b, c, d] = f(lo, hi).map(T);
    quad(m, a, b, c, d, colour);
  }
}

// ---------------------------------------------------------------- the oak door

const FRAME = 0.07;
const FRAME_Z = 0.08;
const LEAF_T = 0.07;

/**
 * An oak door in its frame. Settings `g`: `swing` (degrees the leaf stands open, toward +z), `leaf` ('plank',
 * 'glazed', 'panel', 'framed' or 'shop'), `handle` ('ring', 'knob' or 'pull'), `back` (how far the frame stands behind the prop's centre, m: 0 in the wall's plane). `look`: `wood` (the leaf), `frame` (hex, default the wood, darker), `iron`, `glass` (the
 * glazed leaf's pane), `jitter`, `grime`.
 */
export function doorMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const X = w / 2;
  const wood = hex(look.wood);
  const frameC = look.frame ? hex(look.frame) : scale3(wood, 0.78);
  const ironC = hex(look.iron ?? '#24262a');
  const swing = ((g.swing ?? 0) * Math.PI) / 180;
  const kind = g.leaf ?? 'plank';
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  // Shut and ajar collide as the frame's slab; open (collide: "none") gives no box.
  if (level === 0 && (g.swing ?? 0) < 60) m.boxes = [[-X, 0, -FRAME_Z, X, h, FRAME_Z]];
  // The frame: two posts and a head, the full depth.
  const back = g.back ?? 0;
  const fc = tone(frameC, 1);
  box(m, [-X, 0, -FRAME_Z - back], [-X + FRAME, h, FRAME_Z - back], fc, ['ny']);
  box(m, [X - FRAME, 0, -FRAME_Z - back], [X, h, FRAME_Z - back], fc, ['ny']);
  box(m, [-X + FRAME, h - FRAME, -FRAME_Z - back], [X - FRAME, h, FRAME_Z - back], fc, ['nx', 'px']);
  // The leaf, built shut (x from the latch edge to the hinge edge, z about the wall's middle) and turned on its
  // hinges: the pin is at the hinge edge on the room (+z) face.
  const hx = X - FRAME - 0.006;
  const lx = -X + FRAME + 0.006;
  const y0 = 0.012;
  const y1 = h - FRAME - 0.008;
  const zf = LEAF_T / 2;
  const [c, s] = [Math.cos(swing), Math.sin(swing)];
  const T = ([x, y, z]) => [hx + (x - hx) * c + (z - zf) * s, y, zf - (x - hx) * s + (z - zf) * c - back];
  const iron = (p, n) => scale3(ironC, n[1] > 0.5 ? 1.5 : 1);
  if (level >= 2) {
    tbox(m, T, [lx, y0, -zf], [hx, y1, zf], scale3(wood, 0.9), ['ny']);
    return m;
  }
  const fine = level === 0;
  const st0 = 0.16;
  if (kind === 'plank') {
    // Boards side by side, each its own tone; the outer ones keep their edges.
    const n = fine ? 7 : 1;
    for (let i = 0; i < n; i++) {
      const xa = lerp(lx, hx, i / n);
      const xb = lerp(lx, hx, (i + 1) / n);
      tbox(m, T, [xa, y0, -zf], [xb, y1, zf], tone(scale3(wood, 1 + r.jitter(0.05)), 10 + i), ['ny', ...(i > 0 ? ['nx'] : []), ...(i < n - 1 ? ['px'] : [])]);
    }
    // Three ledges across the room side.
    const ledge = tone(scale3(wood, 0.82), 30);
    for (const y of [0.32, h * 0.5 - 0.06, y1 - 0.44]) tbox(m, T, [lx + 0.04, y, zf], [hx - 0.04, y + 0.13, zf + 0.028], ledge, ['nz']);
    // Three iron strap hinges across the hall side, a spear point at each one's end, studs along it.
    for (const y of [0.385, h * 0.5, y1 - 0.375]) {
      const xe = hx - (hx - lx) * 0.62;
      tbox(m, T, [xe, y - 0.035, -zf - 0.012], [hx, y + 0.035, -zf], iron, ['pz']);
      const tip = [[xe, y - 0.06, -zf - 0.012], [xe, y + 0.06, -zf - 0.012], [xe - 0.13, y, -zf - 0.012]].map(T);
      triN(m, tip[0], tip[1], tip[2], [-s, 0, -c], iron);
      if (fine) for (let k = 0; k < 3; k++) tbox(m, T, [lerp(xe, hx, 0.12 + k * 0.36) - 0.016, y - 0.016, -zf - 0.024], [lerp(xe, hx, 0.12 + k * 0.36) + 0.016, y + 0.016, -zf - 0.012], scale3(ironC, 1.7), ['pz']);
      // The knuckle on the hinge post.
      tbox(m, T, [hx - 0.01, y - 0.06, -zf - 0.03], [hx + 0.03, y + 0.06, -zf], iron, ['pz']);
    }
  } else {
    // A framed door: stiles and rails round a panel set back; the lock rail divides it.
    const st = 0.16;
    // (The shop door's lock rail is a kick plate's height up: glass from there to the top rail.)
    const lock = kind === 'shop' ? [0.34, 0.5] : [0.95, 1.17];
    const rail = tone(wood, 11);
    const field = tone(scale3(wood, 0.86), 12);
    tbox(m, T, [lx, y0, -zf], [lx + st, y1, zf], rail, ['ny']);
    tbox(m, T, [hx - st, y0, -zf], [hx, y1, zf], rail, ['ny']);
    for (const [ya, yb] of [[y0, y0 + 0.24], lock, [y1 - st, y1]]) tbox(m, T, [lx + st, ya, -zf], [hx - st, yb, zf], rail, ['nx', 'px', ...(ya === y0 ? ['ny'] : [])]);
    const panels = [[y0 + 0.24, lock[0]], [lock[1], y1 - st]];
    panels.forEach(([ya, yb], i) => {
      if (kind === 'shop' && i === 1) {
        // One clear pane the leaf's height (drawn as dark glass with the sky's light in its upper part: nothing is seen through a kit prop).
        const pane = hex(look.glass ?? '#4c6672');
        tbox(m, T, [lx + st, ya, -0.006], [hx - st, yb, 0.006], (p) => scale3(pane, 0.7 + 0.45 * ((p[1] - ya) / (yb - ya))), ['nx', 'px', 'ny', 'py']);
        return;
      }
      const glazed = kind === 'glazed' && i === 1;
      if (glazed) {
        // Reeded glass (a pale pane, opaque), a glazing bar down the middle and one across.
        const pane = hex(look.glass ?? '#aebfc0');
        tbox(m, T, [lx + st, ya, -0.006], [hx - st, yb, 0.006], (p, n) => scale3(pane, 0.9 + 0.1 * Math.sin(p[0] * 90 + p[2] * 90)), ['nx', 'px', 'ny', 'py']);
        const mid = (lx + hx) / 2;
        tbox(m, T, [mid - 0.02, ya, -0.02], [mid + 0.02, yb, 0.02], rail, ['ny', 'py']);
        if (fine) for (const side of [-1, 1]) tbox(m, T, [side < 0 ? lx + st : mid + 0.02, (ya + yb) / 2 - 0.02, -0.02], [side < 0 ? mid - 0.02 : hx - st, (ya + yb) / 2 + 0.02, 0.02], rail, ['nx', 'px']);
        return;
      }
      tbox(m, T, [lx + st, ya, -zf + 0.02], [hx - st, yb, zf - 0.02], field, ['nx', 'px', 'ny', 'py']);
      if (kind === 'panel') {
        // A diamond of mouldings on each face of each panel, a smaller one inside it.
        const cx = (lx + hx) / 2;
        const cy = (ya + yb) / 2;
        for (const face of [-1, 1]) {
          const z = face * (zf - 0.02 + 0.012);
          for (const k of fine ? [1, 0.55] : [1]) {
            const rx = ((hx - lx) / 2 - st - 0.02) * k;
            const ry = ((yb - ya) / 2 - 0.02) * k;
            const pts = [[cx - rx, cy, z], [cx, cy + ry, z], [cx + rx, cy, z], [cx, cy - ry, z]].map(T);
            for (let q = 0; q < 4; q++) bar(m, pts[q], pts[(q + 1) % 4], 0.03, tone(scale3(wood, 1.12), 20 + q));
          }
        }
      }
    });
    // Three butt hinges on the hall side.
    for (const y of [0.3, h * 0.5, y1 - 0.3]) tbox(m, T, [hx - 0.012, y - 0.07, -zf - 0.012], [hx + 0.02, y + 0.07, -zf], iron, ['pz']);
  }
  const rxc = lx + 0.2;
  const ryc = 1.06;
  if ((g.handle ?? 'ring') !== 'ring') {
    // A painted door's furniture, each side: a knob on a back plate (`handle: 'knob'`) or a shop door's upright pull bar on two standoffs (`'pull'`).
    for (const face of [-1, 1]) {
      const zs = face * zf;
      const out = (d) => zs + face * d;
      const span = (a, b) => [Math.min(a, b), Math.max(a, b)];
      const skip = [face > 0 ? 'nz' : 'pz'];
      if (g.handle === 'pull') {
        const x = lx + st0 / 2;
        const [za, zb] = span(out(0.02), out(0.042));
        tbox(m, T, [x - 0.014, 0.8, za], [x + 0.014, 1.5, zb], iron);
        const [zc, zd] = span(zs, out(0.02));
        for (const y of [0.88, 1.42]) tbox(m, T, [x - 0.012, y - 0.012, zc], [x + 0.012, y + 0.012, zd], iron, skip);
      } else {
        const x = lx + 0.085;
        const [za, zb] = span(zs, out(0.008));
        tbox(m, T, [x - 0.03, ryc - 0.09, za], [x + 0.03, ryc + 0.09, zb], iron, skip);
        const [zc, zd] = span(out(0.008), out(0.04));
        tbox(m, T, [x - 0.026, ryc - 0.026, zc], [x + 0.026, ryc + 0.026, zd], iron, skip);
      }
      // A letter plate in the lock rail of a house door (a plain flap: no words).
      if (fine && g.handle === 'knob' && face < 0) tbox(m, T, [(lx + hx) / 2 - 0.13, 1.03, out(0.006)], [(lx + hx) / 2 + 0.13, 1.09, zs], iron, ['pz']);
    }
    return m;
  }
  // A ring handle each side: a plate, a boss, a ring hanging from it; a keyhole plate under it.
  for (const face of [-1, 1]) {
    const zs = face * zf;
    const out = (d) => zs + face * d;
    const [za, zb] = [Math.min(zs, out(0.008)), Math.max(zs, out(0.008))];
    tbox(m, T, [rxc - 0.055, ryc - 0.055, za], [rxc + 0.055, ryc + 0.055, zb], iron, [face > 0 ? 'nz' : 'pz']);
    const [zc, zd] = [Math.min(out(0.008), out(0.04)), Math.max(out(0.008), out(0.04))];
    tbox(m, T, [rxc - 0.022, ryc - 0.022, zc], [rxc + 0.022, ryc + 0.022, zd], iron, [face > 0 ? 'nz' : 'pz']);
    if (fine) {
      const n = 8;
      const ring = Array.from({ length: n }, (_, i) => T([rxc + Math.sin((i / n) * Math.PI * 2) * 0.075, ryc - 0.07 + Math.cos((i / n) * Math.PI * 2) * 0.075, out(0.028)]));
      for (let i = 0; i < n; i++) bar(m, ring[i], ring[(i + 1) % n], 0.016, scale3(ironC, 1.4));
      tbox(m, T, [rxc - 0.02, ryc - 0.3, za], [rxc + 0.02, ryc - 0.2, zb], iron, [face > 0 ? 'nz' : 'pz']);
    } else tbox(m, T, [rxc - 0.06, ryc - 0.14, zc], [rxc + 0.06, ryc - 0.02, zd], iron, [face > 0 ? 'nz' : 'pz']);
  }
  return m;
}

// ---------------------------------------------------------------- the desk with a hutch

/**
 * A pedestal desk with a hutch of shelves along its back. Settings `g`: `desk` (the desk top's height, m), `hutch`
 * (how deep the hutch is from the back), `drawers` (in the pedestal), `shelves` (in the hutch, over the open space
 * above the desk top), `books` (0–1: how full the shelves are). `look`: `wood`, `top` (hex), `back` (hex: the hutch's
 * back panel), `metal` (handles), `jitter`, `grime`.
 */
export function deskHutchMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const wood = hex(look.wood);
  const topC = hex(look.top ?? look.wood);
  const dh = g.desk ?? 0.76;
  const hd = g.hutch ?? 0.3;
  const zh = -Z + hd;
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-X, 0, -Z], [X, dh, Z], (p, n) => (n[1] > 0.5 ? topC : scale3(wood, 0.8)), ['ny']);
    box(m, [-X, dh, -Z], [X, h, zh], scale3(wood, 0.75), ['ny']);
    return m;
  }
  // Solid: the desk under its top; the hutch on the back of it. Open: over the desk top in front of the hutch.
  if (level === 0) m.boxes = [[-X, 0, -Z, X, dh, Z], [-X, dh, -Z, X, h, zh]];
  const r = rng(seed);
  const fine = level === 0;
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const t = 0.04;
  const s = 0.03;
  const yTop = dh - t;
  // The desk: its top, a drawer pedestal on −x, a panel leg on +x, a modesty panel across the back.
  box(m, [-X, yTop, -Z], [X, dh, Z], tone(topC, 1));
  const pw = Math.min(w * 0.32, 0.46);
  const body = tone(wood, 2);
  box(m, [-X + 0.02, 0, -Z + 0.02], [-X + 0.02 + pw, yTop, Z - 0.03], body, ['py', 'ny']);
  box(m, [X - 0.02 - s, 0, -Z + 0.02], [X - 0.02, yTop, Z - 0.03], tone(wood, 3), ['py', 'ny']);
  box(m, [-X + 0.02 + pw, yTop * 0.3, -Z + 0.02], [X - 0.02 - s, yTop, -Z + 0.04], tone(scale3(wood, 0.9), 4), ['py', 'nx', 'px']);
  if (fine) {
    const n = Math.max(1, g.drawers ?? 3);
    const metal = hex(look.metal ?? '#3a3c40');
    for (let k = 0; k < n; k++) {
      const ya = 0.06 + ((yTop - 0.08) * k) / n;
      const yb = 0.06 + ((yTop - 0.08) * (k + 1)) / n - 0.015;
      box(m, [-X + 0.04, ya, Z - 0.03], [-X + pw, yb, Z - 0.018], tone(scale3(wood, 1.08), 30 + k), ['nz']);
      box(m, [-X + 0.02 + pw / 2 - 0.06, (ya + yb) / 2 - 0.008, Z - 0.018], [-X + 0.02 + pw / 2 + 0.06, (ya + yb) / 2 + 0.008, Z - 0.004], metal, ['nz']);
    }
  }
  // The hutch: two sides, a top, a back panel, shelves; its lowest space stays open over the desk top.
  const side = tone(wood, 5);
  box(m, [-X, dh, -Z], [-X + s, h, zh], side, ['ny']);
  box(m, [X - s, dh, -Z], [X, h, zh], side, ['ny']);
  box(m, [-X + s, h - s, -Z], [X - s, h, zh], tone(wood, 6), ['nx', 'px']);
  const backC = scale3(hex(look.back ?? look.wood), look.back ? 0.9 : 0.6);
  box(m, [-X + s, dh, -Z], [X - s, h - s, -Z + 0.015], (p, n) => (n[2] > 0 ? backC : side(p, n)), ['nx', 'px', 'ny', 'py']);
  const shelves = Math.max(1, g.shelves ?? 2);
  const open = 0.42;
  const ys = Array.from({ length: shelves }, (_, i) => lerp(dh + open, h - s, i / shelves));
  const full = g.books ?? 0.7;
  const BOOKS = ['#7a2f2a', '#2f4a6b', '#3d5a3a', '#c7b48a', '#5b3a5e', '#8a6a3a', '#30343a', '#a3463a'].map(hex);
  ys.forEach((y, i) => {
    box(m, [-X + s, y, -Z + 0.015], [X - s, y + 0.025, zh - 0.01], tone(scale3(wood, 0.95), 7 + i), ['nx', 'px', 'nz']);
    const room = (i + 1 < shelves ? ys[i + 1] : h - s) - y - 0.025;
    // A row of books from one end, a gap, sometimes a few lying flat.
    let x = -X + s + 0.02 + r.range(0, 0.06);
    const end = lerp(-X + s + 0.1, X - s - 0.04, full * r.range(0.7, 1));
    if (!fine) {
      box(m, [x, y + 0.025, -Z + 0.03], [end, y + 0.025 + room * 0.78, zh - 0.05], scale3(BOOKS[(seed + i) % BOOKS.length], 0.9), ['ny', 'nz']);
      return;
    }
    while (x < end) {
      const bw = r.range(0.028, 0.06);
      const bh = room * r.range(0.62, 0.9);
      const col = BOOKS[r.int(0, BOOKS.length - 1)];
      box(m, [x, y + 0.025, -Z + 0.03], [x + bw, y + 0.025 + bh, zh - r.range(0.03, 0.07)], (p, n) => scale3(col, n[1] > 0.5 ? 1.5 : n[2] > 0.5 ? 1 : 0.8), ['ny', 'nz']);
      x += bw + 0.004;
    }
  });
  // A divider in the open space, a pigeonhole shelf to one side of it.
  if (fine) {
    const dx = X * 0.3;
    box(m, [dx, dh, -Z + 0.015], [dx + 0.02, dh + open, zh - 0.01], tone(wood, 12), ['ny', 'py', 'nz']);
    box(m, [dx + 0.02, dh + open * 0.5, -Z + 0.015], [X - s, dh + open * 0.5 + 0.02, zh - 0.01], tone(scale3(wood, 0.95), 13), ['nx', 'px', 'nz']);
  }
  return m;
}

// ---------------------------------------------------------------- the slim closet

/**
 * A slim closet: a tall narrow case on a recessed plinth under a cap, one framed door on +z with a pull and two
 * hinges. Settings `g`: `plinth` (m), `cap` (the cap's height), `panels` (in the door, one over another), `pull`
 * ('left' or 'right': the side the pull is on). `look`: `wood`, `door` (hex: the door, default the wood), `metal`,
 * `jitter`, `grime`.
 */
export function closetMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const wood = hex(look.wood);
  const doorC = hex(look.door ?? look.wood);
  if (level >= 2) return standIn(size, scale3(wood, 0.9), scale3(doorC, 0.82));
  const r = rng(seed);
  const m = new Mesh();
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const fine = level === 0;
  const plinth = g.plinth ?? 0.09;
  const cap = g.cap ?? 0.06;
  const in1 = 0.012;
  const zc = Z - 0.04;
  const body = tone(wood, 1);
  // The cap fills the footprint; the case stands a little inside it, the plinth further back.
  box(m, [-X, h - cap, -Z], [X, h, Z], tone(scale3(wood, 1.04), 2));
  box(m, [-X + in1, plinth, -Z], [X - in1, h - cap, zc], body, ['py']);
  box(m, [-X + 0.03, 0, -Z + 0.01], [X - 0.03, plinth, zc - 0.04], scale3(wood, 0.35), ['ny', 'py']);
  // The door: stiles and rails standing proud of its panels.
  const dz = zc + 0.018;
  const [xa, xb] = [-X + in1 + 0.012, X - in1 - 0.012];
  const [ya, yb] = [plinth + 0.012, h - cap - 0.012];
  const st = 0.065;
  const rail = tone(doorC, 3);
  if (!fine) {
    box(m, [xa, ya, zc], [xb, yb, dz], rail, ['nz']);
  } else {
    box(m, [xa, ya, zc], [xa + st, yb, dz + 0.01], rail, ['nz']);
    box(m, [xb - st, ya, zc], [xb, yb, dz + 0.01], rail, ['nz']);
    const n = Math.max(1, g.panels ?? 2);
    const split = [ya, ...Array.from({ length: n - 1 }, (_, i) => lerp(ya, yb, n === 2 ? 0.42 : (i + 1) / n)), yb];
    for (let i = 0; i <= n; i++) {
      const y = split[i];
      const [r0, r1] = i === 0 ? [y, y + st * 1.3] : i === n ? [y - st, y] : [y - st / 2, y + st / 2];
      box(m, [xa + st, r0, zc], [xb - st, r1, dz + 0.01], rail, ['nz', 'nx', 'px']);
    }
    box(m, [xa + st, ya, zc], [xb - st, yb, dz - 0.004], tone(scale3(doorC, 0.9), 4), ['nz', 'nx', 'px', 'ny', 'py']);
  }
  // The pull, and two hinges on the other side.
  const metal = hex(look.metal ?? '#2a2c30');
  const right = (g.pull ?? 'right') === 'right';
  const px = right ? xb - st / 2 : xa + st / 2;
  const front = dz + (fine ? 0.01 : 0);
  box(m, [px - 0.01, h * 0.47, front], [px + 0.01, h * 0.47 + 0.14, Z], metal, ['nz']);
  if (fine) {
    const hxa = right ? xa : xb - 0.02;
    for (const y of [ya + 0.2, yb - 0.26]) box(m, [hxa, y, front], [hxa + 0.02, y + 0.07, front + 0.006], metal, ['nz']);
  }
  return m;
}

// ---------------------------------------------------------------- the built-in closet's front

/**
 * The front of a closet built into a wall: a face frame round one door of framed panels, a pull, two hinges, a kick
 * board. It fills [-w/2, w/2] × [0, h] × [-d/2, d/2] (d about 12 mm) and faces +z; its back, against the wall, is
 * left out. Settings `g`: `panels` (in the door, one over another), `pull` ('left' or 'right'), `kick` (the kick
 * board's height). `look`: `wood`, `door` (hex), `metal`, `jitter`, `grime`.
 */
export function closetFrontMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const wood = hex(look.wood);
  const doorC = hex(look.door ?? look.wood);
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-X, 0, -Z], [X, h, Z], scale3(doorC, 0.85), ['ny', 'nz']);
    return m;
  }
  const r = rng(seed);
  const tone = (c, k) => woodTone(c, r, look, seed + k);
  const fine = level === 0;
  const fr = 0.07;
  const kick = g.kick ?? 0.1;
  const frame = tone(scale3(wood, 0.74), 1);
  // A dark ground behind everything: the gap round the door and between its parts reads as a shadow line.
  quadN(m, [-X + 0.01, 0.01, -Z + 0.001], [X - 0.01, 0.01, -Z + 0.001], [X - 0.01, h - 0.01, -Z + 0.001], [-X + 0.01, h - 0.01, -Z + 0.001], [0, 0, 1], scale3(wood, 0.12));
  // The face frame: two stiles, a head, the kick board; the full depth, so the piece fills its box.
  box(m, [-X, 0, -Z], [-X + fr, h, Z], frame, ['ny', 'nz']);
  box(m, [X - fr, 0, -Z], [X, h, Z], frame, ['ny', 'nz']);
  box(m, [-X + fr, h - fr, -Z], [X - fr, h, Z], frame, ['nz', 'nx', 'px']);
  box(m, [-X + fr, 0, -Z], [X - fr, kick, Z], tone(scale3(wood, 0.55), 2), ['ny', 'nz', 'nx', 'px']);
  // The door, a shade back from the frame's face: stiles and rails round panels set back again.
  const [xa, xb, ya, yb] = [-X + fr + 0.008, X - fr - 0.008, kick + 0.008, h - fr - 0.008];
  const zd = Z - 0.003;
  const st = 0.075;
  const rail = tone(doorC, 3);
  if (!fine) box(m, [xa, ya, -Z], [xb, yb, zd], rail, ['nz']);
  else {
    box(m, [xa, ya, -Z], [xa + st, yb, zd], rail, ['nz']);
    box(m, [xb - st, ya, -Z], [xb, yb, zd], rail, ['nz']);
    const n = Math.max(1, g.panels ?? 2);
    const split = [ya, ...Array.from({ length: n - 1 }, (_, i) => lerp(ya, yb, n === 2 ? 0.42 : (i + 1) / n)), yb];
    for (let i = 0; i <= n; i++) {
      const y = split[i];
      const [r0, r1] = i === 0 ? [y, y + st * 1.3] : i === n ? [y - st, y] : [y - st / 2, y + st / 2];
      box(m, [xa + st, r0, -Z], [xb - st, r1, zd], rail, ['nz', 'nx', 'px']);
    }
    box(m, [xa + st + 0.006, ya, -Z], [xb - st - 0.006, yb, zd - 0.005], tone(scale3(doorC, 0.8), 4), ['nz', 'nx', 'px', 'ny', 'py']);
  }
  // The pull, and two hinges on the other side.
  const metal = hex(look.metal ?? '#2a2c30');
  const right = (g.pull ?? 'right') === 'right';
  const px = right ? xb - st / 2 : xa + st / 2;
  box(m, [px - 0.01, h * 0.45, zd], [px + 0.01, h * 0.45 + 0.14, Z], metal, ['nz']);
  if (fine) {
    const hx = right ? xa : xb - 0.02;
    for (const y of [ya + 0.2, yb - 0.26]) box(m, [hx, y, zd], [hx + 0.02, y + 0.07, Z], metal, ['nz']);
  }
  return m;
}
