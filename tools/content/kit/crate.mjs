// Crates (kit-prop family `crate`): a closed board crate (sheathing planks inside a batten frame on every face, an
// optional diagonal or X brace, optional skids), a steel-framed crate (a square-tube frame on the twelve edges round
// board panels) and an open cargo bin (plank walls between tall corner posts, a floor, iron bands). Each fills its
// bounds exactly: collision is the box (docs/PROCEDURAL_ENVIRONMENT.md §6: a crate is solid cover, its box is its shape).
//
// Every structural choice comes from the variant's seed (env/rng.mjs) and its settings; the look (colours, wear) from
// its `look`. Level 1 drops the plank seams, braces and bands' detail; level 2 is the bounds as a five-faced box.

import { rng } from '../env/rng.mjs';
import { noise3 } from '../env/noise.mjs';
import { Mesh, board, box, clamp01, groundShade, hex, mix3, quad, quadN, scale3, standIn } from './geom.mjs';

/** A colour function for wood: per-board tone, grime in the lower part and near edges, a little noise. */
function woodTone(base, r, look, seed) {
  const n = noise3(seed);
  const tone = 1 + r.jitter(look.jitter ?? 0.1);
  const warm = r.jitter(0.04);
  const c = [base[0] * tone * (1 + warm), base[1] * tone, base[2] * tone * (1 - warm)];
  const grime = look.grime ?? 0.3;
  return (p) => {
    const g = groundShade(p[1], look.groundReach ?? 0.3, 1 - grime * 0.5);
    const blot = 1 - grime * 0.35 * clamp01(n(p[0] * 3.1, p[1] * 3.1, p[2] * 3.1) * 0.5 + 0.5 - 0.35);
    return scale3(c, g * blot);
  };
}

// ---------------------------------------------------------------- the closed crate

/**
 * A closed board crate filling [-w/2, w/2] × [0, h] × [-d/2, d/2]. Settings `g`: `batten` (frame board width, m),
 * `thick` (frame board thickness), `planks` [min, max] sheathing boards across a side, `brace` ('diagonal', 'x',
 * 'none' or 'random'), `skids` (height of two runners along the long axis, 0 for none). `look`: `wood`, `batten`
 * (hex), `seam` (how dark the seams are), `jitter`, `grime`, `paint` (hex: painted boards), `band` (hex: a painted
 * band round the middle).
 */
export function crateMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  if (level >= 2) return standIn(size, hex(look.batten ?? look.wood), hex(look.wood));
  if (level === 1) return crateFlat(seed, size, g, look);
  const r = rng(seed);
  const m = new Mesh();
  const t = g.thick;
  const b = g.batten;
  const sk = g.skids ?? 0;
  const wood = hex(look.paint ?? look.wood);
  const batten = hex(look.paint ? (look.paintBatten ?? look.paint) : (look.batten ?? look.wood));
  const seam = look.seam ?? 0.55;
  const braceKind = g.brace === 'random' ? ['diagonal', 'x', 'diagonal', 'none'][r.int(0, 3)] : (g.brace ?? 'none');
  const flip = r.next() < 0.5;
  const long = d >= w ? 2 : 0;
  const y0 = sk;
  // Skids: two runners along the long axis under the body.
  if (sk > 0) {
    const sw = Math.min(b * 1.2, (long === 2 ? w : d) * 0.16);
    for (const s of [-1, 1]) {
      const col = woodTone(batten, r, { ...look, grime: (look.grime ?? 0.3) + 0.2 }, seed + 11 + s);
      if (long === 2) box(m, [s * (w / 2 - sw * 0.9) - sw / 2, 0, -d / 2], [s * (w / 2 - sw * 0.9) + sw / 2, sk, d / 2], col, ['py', 'ny']);
      else box(m, [-w / 2, 0, s * (d / 2 - sw * 0.9) - sw / 2], [w / 2, sk, s * (d / 2 - sw * 0.9) + sw / 2], col, ['py', 'ny']);
    }
  }
  // The six faces: axis k (0 x, 1 y, 2 z), side s. Faces along z get the full width, x faces sit inside them, y faces
  // inside both, so no two boards share a plane where both can be seen.
  const lo = [-w / 2, y0, -d / 2];
  const hi = [w / 2, h, d / 2];
  const faces = [
    [2, 1], [2, -1], [0, 1], [0, -1], [1, 1], [1, -1],
  ];
  for (const [k, s] of faces) {
    // In-plane axes (u, v) of the face, and how far each runs.
    const [ua, va] = k === 0 ? [2, 1] : k === 1 ? [0, 2] : [0, 1];
    const inset = (axis) => (k === 0 && axis === 2) || (k === 1 && axis !== 1) ? t : 0;
    const u0 = lo[ua] + inset(ua);
    const u1 = hi[ua] - inset(ua);
    const v0 = lo[va] + inset(va);
    const v1 = hi[va] - inset(va);
    const outer = s > 0 ? hi[k] : lo[k];
    const inner = outer - s * t;
    const P = (u, v, n) => {
      const p = [0, 0, 0];
      p[ua] = u;
      p[va] = v;
      p[k] = n;
      return p;
    };
    const want = [0, 0, 0];
    want[k] = s;
    const q2 = (a, bb, c, dd, col) => quadN(m, a, bb, c, dd, want, col);
    // The bottom: one plain board face (seen only from below).
    if (k === 1 && s < 0) {
      q2(P(u0, v0, outer), P(u1, v0, outer), P(u1, v1, outer), P(u0, v1, outer), scale3(batten, 0.45));
      continue;
    }
    // Battens: two along u (at v0 and v1), two along v between them (at u0 and u1). Box from inner to outer plane.
    const bw = Math.min(b, (u1 - u0) / 3, (v1 - v0) / 3);
    const battens = [
      [u0, v0, u1, v0 + bw],
      [u0, v1 - bw, u1, v1],
      [u0, v0 + bw, u0 + bw, v1 - bw],
      [u1 - bw, v0 + bw, u1, v1 - bw],
    ];
    for (const [a0, c0, a1, c1] of battens) {
      const bl = [0, 0, 0];
      const bh = [0, 0, 0];
      bl[ua] = a0;
      bh[ua] = a1;
      bl[va] = c0;
      bh[va] = c1;
      bl[k] = Math.min(inner, outer);
      bh[k] = Math.max(inner, outer);
      const keys = ['x', 'y', 'z'];
      box(m, bl, bh, woodTone(batten, r, look, seed + 101 + m.vertexCount), [`${s > 0 ? 'n' : 'p'}${keys[k]}`]);
    }
    // Sheathing inside the frame: boards across the longer in-plane axis, seams between them.
    const iu0 = u0 + bw;
    const iu1 = u1 - bw;
    const iv0 = v0 + bw;
    const iv1 = v1 - bw;
    const alongU = k === 1 ? (hi[0] - lo[0] >= hi[2] - lo[2] ? ua === 0 : ua === 2) : true;
    const span = alongU ? iv1 - iv0 : iu1 - iu0;
    const n = level >= 1 ? 1 : Math.max(1, Math.round(span / ((g.plank ?? 0.14) * (1 + r.jitter(0.15)))));
    const sw = level >= 1 ? 0 : Math.min(0.008, span / n / 8);
    // Board edges: jittered a little, so no two boards are the same width.
    const cuts = [0];
    for (let i = 1; i < n; i++) cuts.push((i + r.jitter(0.18)) / n);
    cuts.push(1);
    for (let i = 0; i < n; i++) {
      const a = cuts[i] + (i ? sw / span / 2 : 0);
      const c = cuts[i + 1] - (i < n - 1 ? sw / span / 2 : 0);
      const col = woodTone(wood, r, look, seed + 7 * i + 31 * k + s);
      if (alongU) {
        const va0 = iv0 + a * span;
        const va1 = iv0 + c * span;
        q2(P(iu0, va0, inner), P(iu1, va0, inner), P(iu1, va1, inner), P(iu0, va1, inner), col);
      } else {
        const ua0 = iu0 + a * span;
        const ua1 = iu0 + c * span;
        q2(P(ua0, iv0, inner), P(ua1, iv0, inner), P(ua1, iv1, inner), P(ua0, iv1, inner), col);
      }
      if (i < n - 1 && sw > 0) {
        const sc = scale3(wood, seam * 0.6);
        const sa = iv0 + (cuts[i + 1] - sw / span / 2) * span;
        const sb = iv0 + (cuts[i + 1] + sw / span / 2) * span;
        const ta = iu0 + (cuts[i + 1] - sw / span / 2) * span;
        const tb = iu0 + (cuts[i + 1] + sw / span / 2) * span;
        if (alongU) q2(P(iu0, sa, inner), P(iu1, sa, inner), P(iu1, sb, inner), P(iu0, sb, inner), sc);
        else q2(P(ta, iv0, inner), P(tb, iv0, inner), P(tb, iv1, inner), P(ta, iv1, inner), sc);
      }
    }
    // Braces on the sides (and the top of a long crate): boards from corner to corner of the inner rectangle.
    if (level === 0 && braceKind !== 'none' && (k !== 1 || (k === 1 && Math.max(w, d) > 1.6 * Math.min(w, d)))) {
      const dirs = braceKind === 'x' ? [1, -1] : [flip !== (s < 0) ? 1 : -1];
      dirs.forEach((dir, j) => {
        const a = P(iu0, dir > 0 ? iv0 : iv1, inner);
        const c = P(iu1, dir > 0 ? iv1 : iv0, inner);
        const along = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const L = Math.hypot(...along);
        const side = [0, 0, 0];
        // At right angles to the brace, in the face's plane.
        const du = (c[ua] - a[ua]) / L;
        const dv = (c[va] - a[va]) / L;
        side[ua] = -dv;
        side[va] = du;
        const out = [0, 0, 0];
        out[k] = s;
        // An X's second board sits on the first.
        const lift = j * 0.002;
        const a2 = [...a];
        const c2 = [...c];
        a2[k] += s * lift;
        c2[k] += s * lift;
        board(m, a2, c2, side, out, bw * 0.95, t * 0.85, woodTone(batten, r, look, seed + 503 + j + 13 * k), { ends: false });
      });
    }
  }
  return m;
}

/**
 * The crate's middle level: its bounds, each face painted as its frame and panel (flat, no depth), the skids as one
 * block each. The same outline and colours as level 0 at a quarter of its triangles.
 */
function crateFlat(seed, size, g, look) {
  const [w, h, d] = size;
  const r = rng(seed);
  const m = new Mesh();
  const sk = g.skids ?? 0;
  const wood = hex(look.paint ?? look.wood);
  const batten = hex(look.paint ? (look.paintBatten ?? look.paint) : (look.batten ?? look.wood));
  const lo = [-w / 2, sk, -d / 2];
  const hi = [w / 2, h, d / 2];
  if (sk > 0) {
    const long = d >= w;
    const sw = Math.min(g.batten * 1.2, (long ? w : d) * 0.16);
    for (const s of [-1, 1]) {
      if (long) box(m, [s * (w / 2 - sw * 0.9) - sw / 2, 0, -d / 2], [s * (w / 2 - sw * 0.9) + sw / 2, sk, d / 2], scale3(batten, 0.8), ['py', 'ny']);
      else box(m, [-w / 2, 0, s * (d / 2 - sw * 0.9) - sw / 2], [w / 2, sk, s * (d / 2 - sw * 0.9) + sw / 2], scale3(batten, 0.8), ['py', 'ny']);
    }
  }
  for (const [k, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const [ua, va] = k === 0 ? [2, 1] : k === 1 ? [0, 2] : [0, 1];
    const plane = s > 0 ? hi[k] : lo[k];
    const want = [0, 0, 0];
    want[k] = s;
    const P = (u, v) => {
      const p = [0, 0, 0];
      p[ua] = u;
      p[va] = v;
      p[k] = plane;
      return p;
    };
    const u0 = lo[ua];
    const u1 = hi[ua];
    const v0 = lo[va];
    const v1 = hi[va];
    if (k === 1 && s < 0) {
      quadN(m, P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1), want, scale3(batten, 0.45));
      continue;
    }
    const bw = Math.min(g.batten, (u1 - u0) / 3, (v1 - v0) / 3);
    const fr = woodTone(batten, r, look, seed + 900 + k * 2 + s);
    const pn = woodTone(scale3(wood, 0.92), r, look, seed + 950 + k * 2 + s);
    // Frame strips round the panel (the long ones along u), then the panel.
    quadN(m, P(u0, v0), P(u1, v0), P(u1, v0 + bw), P(u0, v0 + bw), want, fr);
    quadN(m, P(u0, v1 - bw), P(u1, v1 - bw), P(u1, v1), P(u0, v1), want, fr);
    quadN(m, P(u0, v0 + bw), P(u0 + bw, v0 + bw), P(u0 + bw, v1 - bw), P(u0, v1 - bw), want, fr);
    quadN(m, P(u1 - bw, v0 + bw), P(u1, v0 + bw), P(u1, v1 - bw), P(u1 - bw, v1 - bw), want, fr);
    quadN(m, P(u0 + bw, v0 + bw), P(u1 - bw, v0 + bw), P(u1 - bw, v1 - bw), P(u0 + bw, v1 - bw), want, pn);
  }
  return m;
}

// ---------------------------------------------------------------- the steel-framed crate

/**
 * A crate in a steel frame: square tube along the twelve edges (`tube` across), board panels set in (`inset` from the
 * frame's face), a diagonal brace board across each side panel. `look`: `frame` (paint), `wood`, `jitter`, `grime`,
 * `rust` (how much of the frame shows rust, 0-1).
 */
export function framedCrateMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  // The farthest level: the bounds in the faces' average colour (more board than frame).
  if (level >= 2) return standIn(size, mix3(hex(look.frame), hex(look.wood), 0.6), mix3(hex(look.frame), hex(look.wood), 0.55));
  const r = rng(seed);
  const m = new Mesh();
  const tb = g.tube;
  const ins = g.inset;
  const frame = hex(look.frame);
  const rustC = hex(look.rustColour ?? '#6b3a22');
  const rn = noise3(seed + 9);
  const steel = (p) => {
    const rust = clamp01((rn(p[0] * 6, p[1] * 6, p[2] * 6) * 0.5 + 0.5 - (1 - (look.rust ?? 0.2))) * 3);
    return scale3(mix3(frame, rustC, rust), groundShade(p[1], 0.25, 0.8));
  };
  const X = w / 2;
  const Z = d / 2;
  // Vertical posts at the corners, full height; rails along x and z between them, top and bottom.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, [sx > 0 ? X - tb : -X, 0, sz > 0 ? Z - tb : -Z], [sx > 0 ? X : -X + tb, h, sz > 0 ? Z : -Z + tb], steel, ['ny']);
  for (const y of [0, h - tb]) {
    for (const sz of [-1, 1]) box(m, [-X + tb, y, sz > 0 ? Z - tb : -Z], [X - tb, y + tb, sz > 0 ? Z : -Z + tb], steel, ['nx', 'px', ...(y === 0 ? ['ny'] : [])]);
    for (const sx of [-1, 1]) box(m, [sx > 0 ? X - tb : -X, y, -Z + tb], [sx > 0 ? X : -X + tb, y + tb, Z - tb], steel, ['nz', 'pz', ...(y === 0 ? ['ny'] : [])]);
  }
  // Panels: boards set `ins` in from the frame's outer face, filling between the tubes; the tube's inner sides show.
  const wood = hex(look.wood);
  const panel = (k, s) => {
    const [ua, va] = k === 0 ? [2, 1] : k === 1 ? [0, 2] : [0, 1];
    const lo = [-X + tb, tb, -Z + tb];
    const hi = [X - tb, h - tb, Z - tb];
    const plane = (s > 0 ? [X, h, Z][k] : [-X, 0, -Z][k]) - s * ins;
    const P = (u, v) => {
      const p = [0, 0, 0];
      p[ua] = u;
      p[va] = v;
      p[k] = plane;
      return p;
    };
    const want = [0, 0, 0];
    want[k] = s;
    const q = (a, b, c, dd, col) => quadN(m, a, b, c, dd, want, col);
    // The tubes' inner sides, from the frame face down to the panel (a recess round each panel), facing the panel's middle.
    const rim = scale3(frame, 0.7);
    const mid = P((lo[ua] + hi[ua]) / 2, (lo[va] + hi[va]) / 2);
    const edges = [
      [P(lo[ua], lo[va]), P(hi[ua], lo[va])],
      [P(hi[ua], lo[va]), P(hi[ua], hi[va])],
      [P(hi[ua], hi[va]), P(lo[ua], hi[va])],
      [P(lo[ua], hi[va]), P(lo[ua], lo[va])],
    ];
    for (const [a, b] of edges) {
      const ao = [...a];
      const bo = [...b];
      ao[k] += s * ins;
      bo[k] += s * ins;
      const em = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      quadN(m, a, b, bo, ao, [mid[0] - em[0], mid[1] - em[1], mid[2] - em[2]], rim);
    }
    const n = level >= 1 ? 1 : Math.max(2, Math.round((hi[va] - lo[va]) / (g.plank ?? 0.16)));
    for (let i = 0; i < n; i++) {
      const v0 = lo[va] + ((hi[va] - lo[va]) * i) / n;
      const v1 = lo[va] + ((hi[va] - lo[va]) * (i + 1)) / n - (level === 0 && i < n - 1 ? 0.006 : 0);
      q(P(lo[ua], v0), P(hi[ua], v0), P(hi[ua], v1), P(lo[ua], v1), woodTone(wood, r, look, seed + 17 * i + 5 * k + s));
      if (level === 0 && i < n - 1) q(P(lo[ua], v1), P(hi[ua], v1), P(hi[ua], v1 + 0.006), P(lo[ua], v1 + 0.006), scale3(wood, 0.3));
    }
    if (level === 0 && k !== 1) {
      const dir = (seed + k + (s > 0 ? 1 : 0)) % 2 ? 1 : -1;
      const a = P(lo[ua], dir > 0 ? lo[va] : hi[va]);
      const c = P(hi[ua], dir > 0 ? hi[va] : lo[va]);
      const L = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      const side = [0, 0, 0];
      side[ua] = -(c[va] - a[va]) / L;
      side[va] = (c[ua] - a[ua]) / L;
      const out = [0, 0, 0];
      out[k] = s;
      board(m, a, c, side, out, tb * 0.9, ins * 0.8, woodTone(scale3(wood, 0.85), r, look, seed + 77 + k), { ends: false });
    }
  };
  for (const [k, s] of [[0, 1], [0, -1], [2, 1], [2, -1], [1, 1]]) panel(k, s);
  return m;
}

// ---------------------------------------------------------------- the open cargo bin

/**
 * An open-topped cargo bin: four corner posts (`post` across) full height, plank walls between them `wall` of the
 * height (`wallThick` thick, both faces drawn), a floor at `floor`, two iron bands round the outside. `look`: `wood`,
 * `post`, `band`, `jitter`, `grime`.
 */
export function binMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  if (level >= 2) {
    const m = new Mesh();
    const post = hex(look.post ?? look.wood);
    const wood = hex(look.wood);
    const wh = h * g.wall;
    box(m, [-w / 2, 0, -d / 2], [w / 2, wh, d / 2], (p, n) => (n[1] > 0.5 ? scale3(wood, 0.5) : scale3(wood, groundShade(p[1]))), ['ny']);
    const pc = g.post;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, [sx > 0 ? w / 2 - pc : -w / 2, wh, sz > 0 ? d / 2 - pc : -d / 2], [sx > 0 ? w / 2 : -w / 2 + pc, h, sz > 0 ? d / 2 : -d / 2 + pc], post, ['ny']);
    return m;
  }
  const r = rng(seed);
  const m = new Mesh();
  const pc = g.post;
  const wt = g.wallThick;
  const wh = h * g.wall;
  const fy = g.floor;
  const wood = hex(look.wood);
  const post = hex(look.post ?? look.wood);
  const X = w / 2;
  const Z = d / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, [sx > 0 ? X - pc : -X, 0, sz > 0 ? Z - pc : -Z], [sx > 0 ? X : -X + pc, h, sz > 0 ? Z : -Z + pc], woodTone(post, r, look, seed + sx * 3 + sz), ['ny']);
  // Walls: planks between the posts, outer face flush with the bounds, a top edge, an inner face.
  const n = level >= 1 ? 1 : Math.max(2, Math.round((wh - fy * 0.5) / (g.plank ?? 0.2)));
  const inner = (p) => scale3(wood, 0.55 + 0.35 * clamp01((p[1] - fy) / (wh - fy)));
  const wallBox = (lo, hi, skip) => {
    for (let i = 0; i < n; i++) {
      const y0 = (wh * i) / n;
      const y1 = (wh * (i + 1)) / n - (level === 0 && i < n - 1 ? 0.01 : 0);
      const l = [...lo];
      const hh = [...hi];
      l[1] = y0;
      hh[1] = y1;
      const tone = woodTone(wood, r, look, seed + 19 * i + m.vertexCount);
      box(m, l, hh, (p, nn) => (Math.abs(nn[1]) > 0.5 ? scale3(tone(p), 0.8) : tone(p)), skip(i));
      if (level === 0 && i < n - 1) {
        // The gap between planks: a dark strip set back in it (nothing to see through).
        const gl = [...lo];
        const gh = [...hi];
        gl[1] = y1;
        gh[1] = y1 + 0.01;
        box(m, gl, gh, scale3(wood, 0.2), ['py', 'ny', ...skip(i)]);
      }
    }
  };
  // Along x (front and back walls), between the posts; along z (side walls). Set back by the bands' thickness, so the
  // bands stay inside the bounds.
  const bt = level === 0 && (g.bands ?? []).length ? 0.01 : 0;
  const Zo = Z - bt;
  const Xo = X - bt;
  wallBox([-X + pc, 0, Zo - wt], [X - pc, wh, Zo], () => ['nx', 'px', 'ny']);
  wallBox([-X + pc, 0, -Zo], [X - pc, wh, -Zo + wt], () => ['nx', 'px', 'ny']);
  wallBox([Xo - wt, 0, -Z + pc], [Xo, wh, Z - pc], () => ['nz', 'pz', 'ny']);
  wallBox([-Xo, 0, -Z + pc], [-Xo + wt, wh, Z - pc], () => ['nz', 'pz', 'ny']);
  // Inner faces of the posts below the wall top are hidden by the walls; the floor inside.
  quad(m, [-X + wt, fy, Z - wt], [X - wt, fy, Z - wt], [X - wt, fy, -Z + wt], [-X + wt, fy, -Z + wt], (p) => scale3(inner(p), 0.75));
  // Iron bands round the outside, a little proud of the planks (inside the posts' outer faces).
  if (level === 0) {
    const band = hex(look.band ?? '#3a3a38');
    for (const y of g.bands ?? []) {
      const by0 = y * wh - 0.025;
      const by1 = y * wh + 0.025;
      box(m, [-X + pc, by0, Zo], [X - pc, by1, Z], band, ['nz', 'nx', 'px']);
      box(m, [-X + pc, by0, -Z], [X - pc, by1, -Zo], band, ['pz', 'nx', 'px']);
      box(m, [Xo, by0, -Z + pc], [X, by1, Z - pc], band, ['nx', 'nz', 'pz']);
      box(m, [-X, by0, -Z + pc], [-Xo, by1, Z - pc], band, ['px', 'nz', 'pz']);
    }
  }
  return m;
}
