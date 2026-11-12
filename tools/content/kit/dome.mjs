// The Desert City dome kit (kit-prop families `kit.dome.*`; docs/CONTENT_PIPELINE.md, "The dome kit"): a dome built
// from parts round one axis. A drum (a ring of wall 2.6 m high, 7.2 m across, in quarter segments with arched
// doorways, windows or solid), ring trims (a plinth, an impost band, a cornice), dome panels for domes of 4, 6, 8 or
// 12 segments (plain, with a window, broken off), a cap, arch transitions one cell square and one level high (a
// flat top with the round seat a drum stands on) and whole domes on their drums, one cell and a 2 × 2 cell hall.
//
// Every part's origin is the dome's centre axis at the foot of the drum, and a part is drawn where it belongs on
// that drum: the panels spring 2.6 m up, the cap sits at the crown. So parts placed at one point, each turned by
// its own step (a quarter turn for the drum, 360° / segments for a panel), make the dome with nothing to measure.
// That is why these families say `bounds: "within"` (tools/content/kitprops.mjs): a part stays inside its box and
// need not fill it. Whole domes and arch transitions fill theirs like any other piece.
//
// Angles are measured from +z towards +x. Collision is boxes (a generator's `boxes`): rings of small boxes round
// a hollow middle, so a player stands inside under the dome; doorways, windows and missing panels stay open.
// Nothing glows or blinks: every look is paint (CLAUDE.md, "Accessibility").

import { noise3 } from '../env/noise.mjs';
import { cross, norm, sub } from '../env/mesh.mjs';
import { Mesh, clamp01, disc, dot3, groundShade, hex, lathe, mix3, quadN, scale3, triN } from './geom.mjs';

const DEG = Math.PI / 180;
const pt = (a, r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
const radial = (a) => [Math.sin(a), 0, Math.cos(a)];
const tangent = (a) => [Math.cos(a), 0, -Math.sin(a)];
const neg = (v) => [-v[0], -v[1], -v[2]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The shell's rows (degrees up the curve) at each level of detail; a window adds its sill's row at level 1. */
const ROWS = [[0, 8, 23, 31, 47, 64, 82], [0, 31, 64, 82], [0, 40, 82]];
const ROWS_WINDOW_1 = [0, 8, 31, 64, 82];
/** Rows a broken panel may break at (level 0), and the collision bands between them. */
const BANDS = [[0, 3], [3, 4], [4, 5], [5, 6]];
const BAND_STEP = [15, 22.5, 45, 45];

/**
 * The kit's measures from a family's settings `g` (metres; the defaults are the one-cell kit): `radius` (the
 * bounds' half width), `lip` (how far the trims stand out from the wall), `wall` (its thickness), `drumH`, `bays`
 * (round the whole drum), `doorHalf` (degrees), `doorSpring`, `doorApex`, `winHalf`, `winSill`, `winSpring`,
 * `winApex`, `lintel` (where the frieze starts), `shell` (the dome's thickness), `rise`, `capR`, `capH`.
 */
export function domeDims(g = {}) {
  const R = g.radius ?? 3.8;
  const k = R / 3.8;
  const lip = g.lip ?? 0.2;
  const wallR = R - lip;
  const drumH = g.drumH ?? 2.6;
  const rise = g.rise ?? 3.6;
  const shellTop = drumH + rise * Math.sin(82 * DEG);
  const capH = g.capH ?? 0.95 * k;
  return {
    R, k, lip, wallR, wallT: g.wall ?? 0.4, drumH, bays: g.bays ?? 8,
    doorHalf: (g.doorHalf ?? 12.5) * DEG, doorSpring: g.doorSpring ?? 1.55, doorApex: g.doorApex ?? 2.1,
    winHalf: (g.winHalf ?? 6.5) * DEG, winSill: g.winSill ?? 0.85, winSpring: g.winSpring ?? 1.45, winApex: g.winApex ?? 1.8,
    lintel: g.lintel ?? drumH - 0.4,
    shellR: wallR - 0.1, shellT: g.shell ?? 0.2, rise, shellTop,
    dormerHalf: (g.dormerHalf ?? 7) * DEG,
    capR: g.capR ?? 0.85 * k, capH, capY: shellTop - 0.08, capTop: shellTop - 0.08 + capH,
    ribW: 0.22 * k, ribH: 0.07 * k,
  };
}

// ---------------------------------------------------------------- paint

/**
 * A look's paints. `look`: `wall`, `trim`, `shell`, `rib` (hex), `accent` (a second shell colour) with `pattern`
 * ('stone': each panel course its own tone; 'tiles': two colours in turn; 'patina': patches of the accent),
 * `frieze` and `frieze2` (the band under the cornice; the wall's colour if absent), `inside`, `finial`, `top` (an
 * arch transition's paving), `grime` (0–1).
 */
function paints(seed, look) {
  const n = noise3(seed + 11);
  const grime = look.grime ?? 0.2;
  const dirt = hex(look.dirt ?? '#5a4936');
  const flat = (c, k = 1) => (p, nrm) => {
    const v = n(p[0] * 0.9, p[1] * 0.9, p[2] * 0.9);
    const streak = clamp01((n(p[0] * 2.3, p[1] * 0.4, p[2] * 2.3) * 0.5 + 0.5 - (1 - grime)) * 1.6);
    const col = mix3(scale3(c, 1 + v * 0.07), dirt, streak * 0.45);
    return scale3(col, k * (0.87 + 0.19 * nrm[1]) * groundShade(p[1], 0.4, 1 - grime * 0.4));
  };
  const wall = hex(look.wall);
  const trim = hex(look.trim ?? look.wall);
  const shell = hex(look.shell ?? look.wall);
  const accent = hex(look.accent ?? look.shell ?? look.wall);
  const pattern = look.pattern ?? 'stone';
  /** The colour of the shell's cell (i, j) whose middle is `c`. */
  const cell = (i, j, c) => {
    if (pattern === 'tiles') return (i + j) % 2 ? shell : mix3(shell, accent, 0.3);
    const v = n(c[0] * 1.7 + 9, c[1] * 1.7, c[2] * 1.7) * 0.5 + 0.5;
    if (pattern === 'patina') return mix3(shell, accent, clamp01((v - 0.52) * 3.2));
    return scale3(shell, 0.93 + 0.14 * v);
  };
  return {
    flat, cell,
    wall: flat(wall), trim: flat(trim), rib: flat(hex(look.rib ?? look.trim ?? look.wall)),
    frieze: [flat(hex(look.frieze ?? look.wall)), flat(hex(look.frieze2 ?? look.frieze ?? look.wall))],
    recess: flat(wall, 0.84), inside: flat(hex(look.inside ?? look.wall), 0.6), reveal: flat(wall, 0.78),
    shell: flat(shell), finial: flat(hex(look.finial ?? '#a8873a')), top: flat(hex(look.top ?? look.wall), 0.94),
  };
}

// ---------------------------------------------------------------- collision

/**
 * Boxes round an arc: the ring from radius `r0` to `r1` and `y0` to `y1` between the angles `a0` and `a1`, in steps
 * of at most `step`, each the box round its piece. `jamb0`/`jamb1`: that end is the side of an opening, and the
 * box there is drawn back until it stands no more than 3 cm into the opening.
 */
function arcBoxes(out, r0, r1, y0, y1, a0, a1, step, { jamb0 = false, jamb1 = false } = {}) {
  const n = Math.max(1, Math.ceil((a1 - a0) / step - 1e-6));
  for (let s = 0; s < n; s++) {
    let s0 = a0 + ((a1 - a0) * s) / n;
    let s1 = a0 + ((a1 - a0) * (s + 1)) / n;
    const make = () => {
      const as = [s0, s1];
      for (let q = Math.ceil(s0 / (Math.PI / 2) - 1e-9); q * (Math.PI / 2) < s1 + 1e-9; q++) as.push(q * (Math.PI / 2));
      const b = [Infinity, y0, Infinity, -Infinity, y1, -Infinity];
      for (const a of as) for (const r of [r0, r1]) {
        const p = pt(a, r, 0);
        b[0] = Math.min(b[0], p[0]);
        b[2] = Math.min(b[2], p[2]);
        b[3] = Math.max(b[3], p[0]);
        b[5] = Math.max(b[5], p[2]);
      }
      return b;
    };
    // How far the box stands past the radial line at `a`, on the side `dir` (±1: towards greater or lesser angles).
    const past = (b, a, dir) => {
      const t = tangent(a);
      let most = -Infinity;
      for (const x of [b[0], b[3]]) for (const z of [b[2], b[5]]) most = Math.max(most, dir * (x * t[0] + z * t[2]));
      return most;
    };
    let b = make();
    if (jamb0 && s === 0) while (past(b, a0, -1) > 0.03 && s0 < s1 - DEG) b = ((s0 += 0.25 * DEG), make());
    if (jamb1 && s === n - 1) while (past(b, a1, 1) > 0.03 && s1 > s0 + DEG) b = ((s1 -= 0.25 * DEG), make());
    out.push(b);
  }
}

/** Boxes round a piece of the shell: between the rows `f0` and `f1` (radians) and the angles `a0` and `a1`. */
function shellBoxes(out, D, f0, f1, a0, a1, step) {
  const ri = (D.shellR - D.shellT) * Math.cos(f1);
  const ro = D.shellR * Math.cos(f0);
  arcBoxes(out, ri, ro, D.drumH + (D.rise - D.shellT) * Math.sin(f0), D.drumH + D.rise * Math.sin(f1), a0, a1, step);
}

// ---------------------------------------------------------------- the shell

const KEEPS = { A: 'LT', B: 'RT', C: 'LB', D: 'RB' };
const keeps = (kind, side) => kind === 1 || (kind !== 0 && KEEPS[kind].includes(side));

/** A flat or curved face: its corners, their normals, wound to face `want`. */
function face(m, P, N, colour, want) {
  const n = cross(sub(P[1], P[0]), sub(P[2], P[0]));
  const order = dot3(n, want) < 0 ? P.map((_, i) => P.length - 1 - i) : P.map((_, i) => i);
  const ids = order.map((i) => m.vertex(P[i], N[i], [0, 0], colour(P[i], N[i])));
  for (let i = 1; i + 1 < ids.length; i++) m.tri(ids[0], ids[i], ids[i + 1]);
}

/**
 * The dome's shell over the columns `cols` (angles) and `rows` (radians up the curve): every cell whole (1), absent
 * (0) or half of it (a triangle: 'A' lacks its low corner at the far angle, 'B' at the near angle, 'C' its high
 * corner at the far angle, 'D' at the near angle). Outside and inside faces, and the thickness wherever a cell's
 * side has no neighbour: round an opening, along a break, at the crown, and at the first and last column when
 * `sides`. `wrap`: the last column meets the first (a whole dome).
 */
function shell(m, D, P, cols, rows, kindOf, { wrap = false, sides = true, inner = true, group = null, crown = true } = {}) {
  const nc = cols.length - 1;
  const nr = rows.length - 1;
  const sp = (a, f, off = 0) => pt(a, (D.shellR - off) * Math.cos(f), D.drumH + (D.rise - off) * Math.sin(f));
  const sn = (a, f) => norm([(Math.sin(a) * Math.cos(f)) / D.shellR, Math.sin(f) / D.rise, (Math.cos(a) * Math.cos(f)) / D.shellR]);
  const kind = (i, j) => {
    if (j < 0) return 1;
    if (j >= nr) return crown ? 0 : 1;
    if (i < 0 || i >= nc) {
      if (wrap) return kindOf((i + nc) % nc, j);
      return sides ? 0 : 1;
    }
    return kindOf(i, j);
  };
  for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) {
    const k = kindOf(i, j);
    if (k === 0) continue;
    const [a0, a1, f0, f1] = [cols[i], cols[i + 1], rows[j], rows[j + 1]];
    const C = { c00: [a0, f0], c10: [a1, f0], c11: [a1, f1], c01: [a0, f1] };
    const lost = { A: 'c10', B: 'c00', C: 'c11', D: 'c01' }[k];
    const ring = ['c00', 'c10', 'c11', 'c01'].filter((c) => c !== lost).map((c) => C[c]);
    const mid = sp((a0 + a1) / 2, (f0 + f1) / 2);
    const base = P.cell(i, j, mid);
    const outer = P.flat(base);
    const want = sn((a0 + a1) / 2, (f0 + f1) / 2);
    face(m, ring.map(([a, f]) => sp(a, f)), ring.map(([a, f]) => sn(a, f)), outer, want);
    if (!inner) continue;
    // The inside: this cell's own face, or one flat face for its whole group of columns when all of them are whole
    // (`group(i)`: [first, last] column of a panel; a whole dome's inside is a web from rib to rib).
    const [g0, g1] = group ? group(i) : [i, i];
    let whole = g1 > g0;
    for (let x = g0; whole && x <= g1; x++) whole = kindOf(x, j) === 1;
    if (!whole) face(m, ring.map(([a, f]) => sp(a, f, D.shellT)), ring.map(([a, f]) => neg(sn(a, f))), P.inside, neg(want));
    else if (i === g0) {
      const web = [[cols[g0], f0], [cols[g1 + 1], f0], [cols[g1 + 1], f1], [cols[g0], f1]];
      const wm = (cols[g0] + cols[g1 + 1]) / 2;
      face(m, web.map(([a, f]) => sp(a, f, D.shellT)), web.map(() => neg(sn(wm, (f0 + f1) / 2))), P.inside, neg(sn(wm, (f0 + f1) / 2)));
    }
    const edge = (p, q, away) => {
      const A = sp(p[0], p[1]);
      const B = sp(q[0], q[1]);
      quadN(m, A, B, sp(q[0], q[1], D.shellT), sp(p[0], p[1], D.shellT), away, P.reveal);
    };
    const centre = sp((a0 + a1) / 2, (f0 + f1) / 2, D.shellT / 2);
    const side = (s, p, q, other, opp) => {
      if (!keeps(k, s) || keeps(other, opp)) return;
      const e = lerp3(sp(p[0], p[1]), sp(q[0], q[1]), 0.5);
      edge(p, q, sub(e, centre));
    };
    side('L', C.c00, C.c01, kind(i - 1, j), 'R');
    side('R', C.c10, C.c11, kind(i + 1, j), 'L');
    side('B', C.c00, C.c10, kind(i, j - 1), 'T');
    side('T', C.c01, C.c11, kind(i, j + 1), 'B');
    if (lost) {
      const [p, q] = lost === 'c10' || lost === 'c01' ? [C.c00, C.c11] : [C.c10, C.c01];
      edge(p, q, sub(sp(C[lost][0], C[lost][1]), centre));
    }
  }
  return { sp, sn, kind };
}

/**
 * A rib up the shell at the angle `a`, over the rows where `has(j)`: `side` 0 for a whole rib, 1 for the half on the
 * greater-angle side (a panel's first edge), −1 for the other half. `style`: 'box' (a raised band and its sides),
 * 'ridge' (two faces up to a ridge: a whole dome's) or 'strip' (the band alone: level 1).
 */
function rib(m, D, P, a, rows, has, side, style) {
  const half = (f) => Math.min((D.ribW / 2) / Math.max(0.05, D.shellR * Math.cos(f)), 6 * DEG);
  const sp = (ang, f, off = 0) => pt(ang, (D.shellR - off) * Math.cos(f), D.drumH + (D.rise - off) * Math.sin(f));
  for (let j = 0; j + 1 < rows.length; j++) {
    if (!has(j)) continue;
    const [f0, f1] = [rows[j], rows[j + 1]];
    const lo = (f) => a - (side > 0 ? 0 : half(f));
    const hi = (f) => a + (side < 0 ? 0 : half(f));
    const up = norm([(Math.sin(a) * Math.cos((f0 + f1) / 2)) / D.shellR, Math.sin((f0 + f1) / 2) / D.rise, (Math.cos(a) * Math.cos((f0 + f1) / 2)) / D.shellR]);
    if (style === 'ridge') {
      // Two faces up to a ridge along the rib's middle.
      for (const at of [lo, hi]) quadN(m, sp(at(f0), f0), sp(a, f0, -D.ribH), sp(a, f1, -D.ribH), sp(at(f1), f1), up, P.rib);
      continue;
    }
    quadN(m, sp(lo(f0), f0, -D.ribH), sp(hi(f0), f0, -D.ribH), sp(hi(f1), f1, -D.ribH), sp(lo(f1), f1, -D.ribH), up, P.rib);
    if (style !== 'box') continue;
    for (const [at, dir] of [[lo, -1], [hi, 1]]) {
      quadN(m, sp(at(f0), f0, -D.ribH), sp(at(f1), f1, -D.ribH), sp(at(f1), f1), sp(at(f0), f0), scale3(tangent(a), dir), P.rib);
    }
  }
}

/** A panel's columns at a level of detail: about 15°, 30° or 45° wide; a window's sides and middle when it has one. */
function panelCols(D, a0, a1, level, window) {
  const step = [15, 30, 45][level] * DEG;
  const n = Math.max(1, Math.round((a1 - a0) / step));
  let cols = Array.from({ length: n + 1 }, (_, i) => a0 + ((a1 - a0) * i) / n);
  if (window && level < 2) {
    const c = (a0 + a1) / 2;
    const w = D.dormerHalf;
    cols = cols.filter((a) => Math.abs(a - c) > w + 3 * DEG);
    cols.push(c - w, c + w);
    if (level === 0) cols.push(c);
    cols.sort((x, y) => x - y);
  }
  return cols;
}

/**
 * The panels of a dome of `n` segments from panel `from` to `to` (the first is centred on angle 0), each plain, with
 * a window (`windows` lists them) or broken off at a row (`breaks`: { panel: row }; rows 0, 3, 4 or 5 of level 0).
 * Returns its collision boxes.
 */
function panels(m, D, P, n, from, to, level, { windows = [], breaks = {}, wrap = false, crown = true } = {}) {
  const span = (Math.PI * 2) / n;
  const anyWindow = windows.length > 0;
  const rows = (level === 1 && anyWindow ? ROWS_WINDOW_1 : ROWS[level]).map((d) => d * DEG);
  const cols = [];
  const owner = [];
  const local = [];
  const starts = [];
  for (let p = from; p < to; p++) {
    const pc = panelCols(D, (p - 0.5) * span, (p + 0.5) * span, level, windows.includes(p));
    starts.push(cols.length ? cols.length - 1 : 0);
    for (let i = 0; i + 1 < pc.length; i++) {
      if (!cols.length) cols.push(pc[0]);
      cols.push(pc[i + 1]);
      owner.push(p);
      local.push([i, pc.length - 1]);
    }
  }
  const brokenAt = (p) => (breaks[p] === undefined ? null : ROWS[0][breaks[p]] * DEG);
  const kindOf = (i, j) => {
    const p = owner[i];
    const [li, ln] = local[i];
    const f0 = rows[j];
    const b = brokenAt(p);
    if (b !== null && f0 > b - 1e-6) {
      // The row a panel breaks at keeps a tooth at each side (level 0), nothing above.
      if (level === 0 && Math.abs(f0 - b) < 1e-6) return li === 0 ? 'C' : li === ln - 1 ? 'D' : 0;
      return 0;
    }
    if (windows.includes(p) && level < 2) {
      const c = p * span;
      const [a0, a1] = [cols[i], cols[i + 1]];
      const insideW = a0 > c - D.dormerHalf - 1e-6 && a1 < c + D.dormerHalf + 1e-6;
      const deg = Math.round(f0 / DEG);
      if (insideW && level === 0 && deg === 8) return 0;
      if (insideW && level === 0 && deg === 23) return a1 < c + 1e-6 ? 'A' : 'B';
      if (insideW && level === 1 && deg === 8) return 0;
    }
    return 1;
  };
  // A whole dome's inside is one web per panel and row.
  const first = [];
  owner.forEach((p, i) => (first[p] ??= i));
  const group = wrap ? (i) => [first[owner[i]], first[owner[i]] + local[i][1] - 1] : null;
  const sh = shell(m, D, P, cols, rows, kindOf, { wrap, sides: !wrap, inner: level < 2, group, crown });
  const style = level > 0 ? 'strip' : wrap ? 'ridge' : 'box';
  if (level < 2) {
    const nc = cols.length - 1;
    const has = (i) => (j) => (i > 0 || wrap ? sh.kind(i - 1, j) !== 0 : false) || (i < nc ? kindOf(i, j) !== 0 : false);
    starts.forEach((i) => rib(m, D, P, cols[i], rows, has(i), wrap ? 0 : 1, style));
    // A run of panels that is no whole ring has a half rib at its far edge too.
    if (!wrap) rib(m, D, P, cols[nc], rows, (j) => kindOf(nc - 1, j) !== 0, -1, style);
    if (!wrap) for (const i of starts.slice(1)) rib(m, D, P, cols[i], rows, has(i), -1, style);
  }
  // Collision: bands of boxes up each panel, none where it is broken off, open at a window.
  const boxes = [];
  const R0 = ROWS[0].map((d) => d * DEG);
  for (let p = from; p < to; p++) {
    const [a0, a1] = [(p - 0.5) * span, (p + 0.5) * span];
    const stop = breaks[p] ?? 99;
    BANDS.forEach(([r0, r1], bi) => {
      if (r0 >= stop) return;
      if (bi === 0 && windows.includes(p)) {
        const c = p * span;
        shellBoxes(boxes, D, R0[0], R0[1], a0, a1, BAND_STEP[0] * DEG);
        shellBoxes(boxes, D, R0[1], R0[3], a0, c - D.dormerHalf, BAND_STEP[0] * DEG);
        shellBoxes(boxes, D, R0[1], R0[3], c + D.dormerHalf, a1, BAND_STEP[0] * DEG);
      } else shellBoxes(boxes, D, R0[r0], R0[r1], a0, a1, BAND_STEP[bi] * DEG);
    });
  }
  return boxes;
}

// ---------------------------------------------------------------- the cap

function cap(m, D, P, level) {
  const [r, y, h] = [D.capR, D.capY, D.capH];
  const seg = [12, 8, 4][level];
  const prof = level === 0
    ? [[r, y], [r, y + h * 0.13], [r * 0.84, y + h * 0.18], [r * 0.6, y + h * 0.42], [r * 0.26, y + h * 0.56], [r * 0.07, y + h * 0.6], [r * 0.13, y + h * 0.72], [r * 0.035, y + h]]
    : level === 1
      ? [[r, y], [r, y + h * 0.15], [r * 0.5, y + h * 0.46], [r * 0.08, y + h * 0.6], [r * 0.035, y + h]]
      : [[r, y], [r * 0.6, y + h * 0.42], [r * 0.035, y + h]];
  const split = level === 0 ? 5 : level === 1 ? 3 : 9;
  lathe(m, prof, seg, (p, n, row) => (row >= split ? P.finial(p, n) : row < (level === 0 ? 2 : 1) ? P.trim(p, n) : P.shell(p, n)), { hard: prof.map((_, i) => i) });
  if (level === 0) disc(m, r, y, seg, P.inside, { down: true });
  return [[-r * 0.8, D.shellTop - 0.1, -r * 0.8, r * 0.8, y + h * 0.5, r * 0.8]];
}

// ---------------------------------------------------------------- the drum

/**
 * One bay of the drum, centred on angle `c`, `half` wide each side: 'arch' (a doorway to the floor), 'window' or
 * 'solid' (a blind arch sunk in paint). `ends`: [first, last] closes that end (a segment's own). Level 0 has the
 * arch's curve and its frame; level 1 a flat head, no frame and no frieze. `lean`: a whole dome's (one face for the
 * wall's top).
 */
function bay(m, D, P, c, half, kind, level, { ends = [false, false], frames = true, lean = false } = {}) {
  const win = kind === 'window';
  const hw = win ? D.winHalf : D.doorHalf;
  const sill = win ? D.winSill : 0;
  const spring = win ? D.winSpring : D.doorSpring;
  const apex = win ? D.winApex : D.doorApex;
  const [ro, ri, H, ly] = [D.wallR, D.wallR - D.wallT, D.drumH, D.lintel];
  const [aL, oL, oR, aR] = [c - half, c - hw, c + hw, c + half];
  const out = radial(c);
  const inn = neg(out);
  const up = [0, 1, 0];
  // The frieze: its two colours in turn, the piers one and the opening's head the other.
  const [fz, fz2] = P.frieze;
  // The opening's column is flat (a chord): a point at `u` (−1 to 1 across it), height y, on the face of radius r.
  const ch = (u, y, r, push = 0) => {
    const p = lerp3(pt(oL, r, y), pt(oR, r, y), (u + 1) / 2);
    return [p[0] + out[0] * push, y, p[2] + out[2] * push];
  };
  for (const [a0, a1] of [[aL, oL], [oR, aR]]) {
    const o = radial((a0 + a1) / 2);
    // Level 1 leaves the frieze and the wall's top out.
    quadN(m, pt(a0, ro, 0), pt(a1, ro, 0), pt(a1, ro, level ? H : ly), pt(a0, ro, level ? H : ly), o, P.wall);
    if (!level) quadN(m, pt(a0, ro, ly), pt(a1, ro, ly), pt(a1, ro, H), pt(a0, ro, H), o, fz);
    quadN(m, pt(a0, ri, 0), pt(a1, ri, 0), pt(a1, ri, H), pt(a0, ri, H), neg(o), P.inside);
    if (!lean && !level) quadN(m, pt(a0, ro, H), pt(a1, ro, H), pt(a1, ri, H), pt(a0, ri, H), up, P.trim);
  }
  // The wall's top: under a whole dome's cornice and shell, one face a bay is enough.
  if (lean && !level) quadN(m, pt(aL, ro, H), pt(aR, ro, H), pt(aR, ri, H), pt(aL, ri, H), up, P.trim);
  else if (!lean) quadN(m, ch(-1, H, ro), ch(1, H, ro), ch(1, H, ri), ch(-1, H, ri), up, P.trim);
  const oTop = level ? H : ly;
  if (!level) quadN(m, ch(-1, ly, ro), ch(1, ly, ro), ch(1, H, ro), ch(-1, H, ro), out, fz2);
  if (ends[0]) quadN(m, pt(aL, ri, 0), pt(aL, ro, 0), pt(aL, ro, H), pt(aL, ri, H), neg(tangent(aL)), P.reveal);
  if (ends[1]) quadN(m, pt(aR, ri, 0), pt(aR, ro, 0), pt(aR, ro, H), pt(aR, ri, H), tangent(aR), P.reveal);
  // Level 1: a flat head a little under the arch's crown.
  const S = level === 0 ? (D.archSegs ?? 6) : 1;
  const arc = level === 0
    ? Array.from({ length: S + 1 }, (_, k) => [-Math.cos((Math.PI * k) / S), spring + (apex - spring) * Math.sin((Math.PI * k) / S)])
    : [[-1, apex - 0.1 * D.k], [1, apex - 0.1 * D.k]];
  const jambTop = level === 0 ? spring : apex - 0.1 * D.k;
  if (kind === 'solid') {
    quadN(m, ch(-1, 0, ro), ch(1, 0, ro), ch(1, oTop, ro), ch(-1, oTop, ro), out, P.wall);
    quadN(m, ch(-1, 0, ri), ch(1, 0, ri), ch(1, H, ri), ch(-1, H, ri), inn, P.inside);
    if (level === 0) {
      // A blind arch: paint a hair off the wall, the frame round it.
      const line = [[-1, 0.5], ...arc, [1, 0.5]];
      for (let k = 0; k + 1 < line.length; k++) triN(m, ch(0, spring, ro, 0.004), ch(line[k][0], line[k][1], ro, 0.004), ch(line[k + 1][0], line[k + 1][1], ro, 0.004), out, P.recess);
      triN(m, ch(0, spring, ro, 0.004), ch(1, 0.5, ro, 0.004), ch(-1, 0.5, ro, 0.004), out, P.recess);
    }
  } else {
    for (const [r, want, colour, top] of [[ro, out, P.wall, oTop], [ri, inn, P.inside, H]]) {
      for (let k = 0; k < S; k++) quadN(m, ch(arc[k][0], arc[k][1], r), ch(arc[k + 1][0], arc[k + 1][1], r), ch(arc[k + 1][0], top, r), ch(arc[k][0], top, r), want, colour);
      if (win) quadN(m, ch(-1, 0, r), ch(1, 0, r), ch(1, sill, r), ch(-1, sill, r), want, colour);
    }
    // The opening's sides, its sill, the arch's underside.
    quadN(m, ch(-1, sill, ro), ch(-1, sill, ri), ch(-1, jambTop, ri), ch(-1, jambTop, ro), tangent(c), P.reveal);
    quadN(m, ch(1, sill, ro), ch(1, sill, ri), ch(1, jambTop, ri), ch(1, jambTop, ro), neg(tangent(c)), P.reveal);
    if (win) quadN(m, ch(-1, sill, ro), ch(1, sill, ro), ch(1, sill, ri), ch(-1, sill, ri), up, P.trim);
    for (let k = 0; k < S; k++) {
      const midp = ch((arc[k][0] + arc[k + 1][0]) / 2, (arc[k][1] + arc[k + 1][1]) / 2, ro);
      quadN(m, ch(arc[k][0], arc[k][1], ro), ch(arc[k + 1][0], arc[k + 1][1], ro), ch(arc[k + 1][0], arc[k + 1][1], ri), ch(arc[k][0], arc[k][1], ri), sub(ch(0, sill, ro), midp), P.reveal);
    }
  }
  if (level === 0 && frames) {
    // The frame: a band 4 cm proud round the opening (and under a window's sill).
    const fw = 0.12 * D.k;
    const du = fw / (ro * Math.sin(hw));
    const foot = kind === 'solid' ? 0.5 : sill;
    const line = [[-1, foot], ...arc, [1, foot]];
    const offs = [[-1 - du, foot - (win ? fw : 0)], ...arc.map(([u, y]) => [u * (1 + du), spring + (y - spring) * (1 + fw / (apex - spring))]), [1 + du, foot - (win ? fw : 0)]];
    for (let k = 0; k + 1 < line.length; k++) quadN(m, ch(line[k][0], line[k][1], ro, 0.04), ch(line[k + 1][0], line[k + 1][1], ro, 0.04), ch(offs[k + 1][0], offs[k + 1][1], ro, 0.04), ch(offs[k][0], offs[k][1], ro, 0.04), out, P.trim);
    if (win) quadN(m, ch(offs[0][0], offs[0][1], ro, 0.04), ch(offs[offs.length - 1][0], offs[0][1], ro, 0.04), ch(1, foot, ro, 0.04), ch(-1, foot, ro, 0.04), out, P.trim);
  }
  // Collision: the wall each side of the opening up to its head, the wall under a window, the wall over it.
  const boxes = [];
  const step = 7.5 * DEG;
  if (kind === 'solid') arcBoxes(boxes, ri, ro, 0, H, aL, aR, step);
  else {
    const head = apex - 0.1 * D.k;
    arcBoxes(boxes, ri, ro, 0, head, aL, oL, step, { jamb1: true });
    arcBoxes(boxes, ri, ro, 0, head, oR, aR, step, { jamb0: true });
    if (win) arcBoxes(boxes, ri, ro, 0, sill, oL, oR, step);
    arcBoxes(boxes, ri, ro, head, H, aL, aR, 15 * DEG);
  }
  return boxes;
}

/** The drum's bays from `from` to `to` (bay b is centred on (b + ½) × 360° / bays), their kinds by `kindOf(b)`. */
function drum(m, D, P, from, to, kindOf, level, { whole = false, frames = true } = {}) {
  const span = (Math.PI * 2) / D.bays;
  const boxes = [];
  for (let b = from; b < to; b++) boxes.push(...bay(m, D, P, (b + 0.5) * span, span / 2, kindOf(b), level, { ends: [!whole && b === from, !whole && b === to - 1], frames, lean: whole }));
  return boxes;
}

// ---------------------------------------------------------------- the trims

const TRIMS = {
  // The plinth round the drum's foot, the cornice under the dome (profiles as [radius, y], from the wall outward and up).
  bottom: (D) => [[D.R, 0], [D.R, 0.1 * D.k], [D.wallR + 0.02, 0.17 * D.k]],
  top: (D) => [[D.wallR, D.drumH - 0.2 * D.k], [D.wallR + D.lip * 0.4, D.drumH - 0.15 * D.k], [D.wallR + D.lip * 0.4, D.drumH - 0.1 * D.k], [D.R, D.drumH - 0.05 * D.k], [D.R, D.drumH + 0.02 * D.k], [D.shellR + 0.04, D.drumH + 0.1 * D.k]],
};

function ringTrim(m, D, P, which, level, plain = false) {
  const prof = TRIMS[which](D);
  const use = level === 0 && !plain ? prof : which === 'top' ? [prof[0], prof[3], prof[4], prof[5]] : prof;
  lathe(m, use, [24, 12, 8][level], P.trim, { hard: use.map((_, i) => i) });
}

/** The impost band: a moulding at the arches' springing, on the piers only (it stops each side of every bay's opening). */
function impost(m, D, P, level) {
  const span = (Math.PI * 2) / D.bays;
  const y = D.doorSpring;
  const [r0, r1] = [D.wallR, D.wallR + D.lip * 0.5];
  const prof = [[r0, y - 0.1], [r1, y - 0.06], [r1, y + 0.06], [r0, y + 0.1]];
  const gap = D.doorHalf + (0.14 * D.k) / D.wallR;
  for (let b = 0; b < D.bays; b++) {
    // The farthest level keeps every other pier's piece.
    if (level === 2 && b % 2) continue;
    const [a0, a1] = [(b + 0.5) * span + gap, (b + 1.5) * span - gap];
    const steps = level === 0 ? 2 : 1;
    for (let s = 0; s < steps; s++) {
      const [s0, s1] = [a0 + ((a1 - a0) * s) / steps, a0 + ((a1 - a0) * (s + 1)) / steps];
      const o = radial((s0 + s1) / 2);
      for (let k = 0; k + 1 < prof.length; k++) {
        if (level > 0 && k !== 1) continue;
        const [[ra, ya], [rb, yb]] = [prof[k], prof[k + 1]];
        const L = Math.hypot(rb - ra, yb - ya);
        quadN(m, pt(s0, ra, ya), pt(s1, ra, ya), pt(s1, rb, yb), pt(s0, rb, yb), [o[0] * (yb - ya) / L, -(rb - ra) / L, o[2] * (yb - ya) / L], P.trim);
      }
    }
    if (level === 0) for (const [a, dir] of [[a0, -1], [a1, 1]]) quadN(m, pt(a, r0, y - 0.1), pt(a, r1, y - 0.06), pt(a, r1, y + 0.06), pt(a, r0, y + 0.1), scale3(tangent(a), dir), P.trim);
  }
}

// ---------------------------------------------------------------- the families' generators

const parse = (s) => String(s ?? '').split(',').filter(Boolean).map(Number);
/** `breaks`: "panel:row, …" → { panel: row }. */
const parseBreaks = (s) => Object.fromEntries(String(s ?? '').split(',').filter(Boolean).map((x) => x.split(':').map(Number)));

/** The cap at the crown (`kit.dome.cap`). */
export function domeCapMesh(seed, size, g, look, level) {
  const m = new Mesh();
  m.boxes = cap(m, domeDims(g), paints(seed, look), level);
  return m;
}

/**
 * One panel of a dome of `segments` segments, centred on angle 0 (`kit.dome.panel_*`). Settings: `segments`,
 * `window` (1: an arched opening), `broken` (the row it is broken off at: 3, 4 or 5).
 */
export function domePanelMesh(seed, size, g, look, level) {
  const m = new Mesh();
  const D = domeDims(g);
  m.boxes = panels(m, D, paints(seed, look), g.segments, 0, 1, level, { windows: g.window ? [0] : [], breaks: g.broken ? { 0: g.broken } : {} });
  return m;
}

/** A quarter of the drum: two bays, `bay` their kind ('arch', 'window' or 'solid'), from −45° to 45° (`kit.dome.drum_*`). */
export function domeDrumMesh(seed, size, g, look, level) {
  const m = new Mesh();
  const D = domeDims(g);
  const P = paints(seed, look);
  if (level === 2) {
    const [a0, a1] = [-Math.PI / 4, Math.PI / 4];
    for (let s = 0; s < 2; s++) {
      const [s0, s1] = [a0 + ((a1 - a0) * s) / 2, a0 + ((a1 - a0) * (s + 1)) / 2];
      quadN(m, pt(s0, D.wallR, 0), pt(s1, D.wallR, 0), pt(s1, D.wallR, D.drumH), pt(s0, D.wallR, D.drumH), radial((s0 + s1) / 2), P.wall);
      quadN(m, pt(s0, D.wallR - D.wallT, 0), pt(s1, D.wallR - D.wallT, 0), pt(s1, D.wallR - D.wallT, D.drumH), pt(s0, D.wallR - D.wallT, D.drumH), neg(radial((s0 + s1) / 2)), P.inside);
    }
    return m;
  }
  m.boxes = drum(m, D, P, -1, 1, () => g.bay, level);
  return m;
}

/** A ring trim (`kit.dome.trim_*`): `trim` 'bottom' (the plinth), 'middle' (the impost band) or 'top' (the cornice). */
export function domeTrimMesh(seed, size, g, look, level) {
  const m = new Mesh();
  const D = domeDims(g);
  const P = paints(seed, look);
  if (g.trim === 'middle') impost(m, D, P, level);
  else ringTrim(m, D, P, g.trim, level);
  return m;
}

/**
 * A whole dome on its drum (`kit.dome.whole_*`, `kit.dome.hall_*`, and the ruins): `segments`, the drum's `bays`
 * all doorways (`blind` 2: every other bay a blind arch instead), the plinth and the cornice (`plainCornice`: without its lower moulding), the cap. A ruin: `breaks` ("panel:row, …": those panels broken off at
 * that row; 0 is the whole panel), `nocap`.
 */
export function domeMesh(seed, size, g, look, level) {
  const m = new Mesh();
  const D = domeDims(g);
  const P = paints(seed, look);
  if (level === 2) {
    lathe(m, [[D.wallR, 0], [D.wallR, D.drumH]], 8, P.wall);
    lathe(m, [0, 40, 82].map((d) => [D.shellR * Math.cos(d * DEG), D.drumH + D.rise * Math.sin(d * DEG)]), 8, P.shell);
    disc(m, D.shellR * Math.cos(82 * DEG), D.shellTop, 8, P.shell);
    return m;
  }
  D.archSegs = g.archSegs ?? 4;
  const breaks = parseBreaks(g.breaks);
  const boxes = drum(m, D, P, 0, D.bays, (b) => (g.blind && b % g.blind ? 'solid' : 'arch'), level, { whole: true, frames: g.frames !== 0 });
  ringTrim(m, D, P, 'bottom', level);
  ringTrim(m, D, P, 'top', level, !!g.plainCornice);
  // The crown's rim is under the cap (a ruin has neither).
  boxes.push(...panels(m, D, P, g.segments, 0, g.segments, level, { breaks, wrap: true, crown: !!g.nocap }));
  if (!g.nocap) boxes.push(...cap(m, D, P, level));
  if (level === 0) m.boxes = boxes;
  return m;
}

// ---------------------------------------------------------------- arch transitions

/**
 * An arch transition (`kit.dome.arch_*`): one cell square and one level high, a pier in each corner, an arch in
 * each side named in `open` ("1111": +z, +x, −z, −x; a side that is 0 is a wall with a blind arch), a flat top
 * that is solid to stand on, the round seat a drum stands on marked in it. Settings: `thick` (the walls), `openHalf`,
 * `spring`, `apex`, `seat` ([inner, outer] radius of the seat's ring).
 */
export function domeArchMesh(seed, size, g, look, level) {
  const m = new Mesh();
  const P = paints(seed, look);
  const X = size[0] / 2;
  const H = size[1];
  const T = g.thick ?? 0.9;
  const ow = g.openHalf ?? 2.7;
  const spring = g.spring ?? 1.6;
  const apex = g.apex ?? 3.3;
  const soffit = H - 0.5;
  const band = H - 0.4;
  const fw = 0.25;
  const open = String(g.open ?? '1111').split('').map((c) => c === '1');
  // A side's own frame: u along it, d in from its outer face.
  const frames = [
    { at: (u, y, d) => [u, y, X - d], out: [0, 0, 1], along: [1, 0, 0] },
    { at: (u, y, d) => [X - d, y, -u], out: [1, 0, 0], along: [0, 0, -1] },
    { at: (u, y, d) => [-u, y, -X + d], out: [0, 0, -1], along: [-1, 0, 0] },
    { at: (u, y, d) => [-X + d, y, u], out: [-1, 0, 0], along: [0, 0, 1] },
  ];
  const boxes = [[-X, soffit, -X, X, H, X]];
  const boxOf = (f, u0, u1, y0, y1) => {
    const a = f.at(u0, y0, 0);
    const b = f.at(u1, y1, T);
    return [Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2])];
  };
  const arch = (u) => spring + (apex - spring) * Math.sqrt(Math.max(0, 1 - (u / ow) ** 2));
  frames.forEach((f, si) => {
    const q = (u0, y0, u1, y1, d, want, colour) => quadN(m, f.at(u0, y0, d), f.at(u1, y0, d), f.at(u1, y1, d), f.at(u0, y1, d), want, colour);
    const inn = neg(f.out);
    const nb = level === 0 ? 8 : 1;
    if (level === 2) {
      q(-X, 0, X, H, 0, f.out, P.wall);
      return;
    }
    for (let k = 0; k < nb; k++) q(-X + (2 * X * k) / nb, band, -X + (2 * X * (k + 1)) / nb, H, 0, f.out, P.frieze[(k + si) % 2]);
    const S = level === 0 ? 8 : 4;
    const arc = Array.from({ length: S + 1 }, (_, k) => [-ow * Math.cos((Math.PI * k) / S), spring + (apex - spring) * Math.sin((Math.PI * k) / S)]);
    const off = arc.map(([u, y]) => [(u * (ow + fw)) / ow, spring + ((y - spring) * (apex - spring + fw)) / (apex - spring)]);
    const P4 = (a, b, c, d, dd, want, colour) => quadN(m, f.at(a[0], a[1], dd), f.at(b[0], b[1], dd), f.at(c[0], c[1], dd), f.at(d[0], d[1], dd), want, colour);
    // The outer face: a pier each side, the arch's frame, the wall over it.
    q(-X, 0, -ow - fw, band, 0, f.out, P.wall);
    q(ow + fw, 0, X, band, 0, f.out, P.wall);
    q(-ow - fw, 0, -ow, spring, 0, f.out, P.trim);
    q(ow, 0, ow + fw, spring, 0, f.out, P.trim);
    for (let k = 0; k < S; k++) {
      P4(arc[k], arc[k + 1], off[k + 1], off[k], 0, f.out, P.trim);
      P4(off[k], off[k + 1], [off[k + 1][0], band], [off[k][0], band], 0, f.out, P.wall);
    }
    const depth = open[si] ? T : 0.18;
    // The opening's sides and the arch's underside: right through, or 18 cm into a blind arch.
    quadN(m, f.at(-ow, 0, 0), f.at(-ow, 0, depth), f.at(-ow, spring, depth), f.at(-ow, spring, 0), f.along, P.reveal);
    quadN(m, f.at(ow, 0, 0), f.at(ow, 0, depth), f.at(ow, spring, depth), f.at(ow, spring, 0), neg(f.along), P.reveal);
    for (let k = 0; k < S; k++) {
      const down = sub(f.at(0, spring, 0), f.at((arc[k][0] + arc[k + 1][0]) / 2, (arc[k][1] + arc[k + 1][1]) / 2, 0));
      quadN(m, f.at(arc[k][0], arc[k][1], 0), f.at(arc[k + 1][0], arc[k + 1][1], 0), f.at(arc[k + 1][0], arc[k + 1][1], depth), f.at(arc[k][0], arc[k][1], depth), down, P.reveal);
    }
    const iw = X - T;
    if (open[si]) {
      // The inner face: the same arch, plain.
      q(-iw, 0, -ow, soffit, T, inn, P.inside);
      q(ow, 0, iw, soffit, T, inn, P.inside);
      for (let k = 0; k < S; k++) P4(arc[k], arc[k + 1], [arc[k + 1][0], soffit], [arc[k][0], soffit], T, inn, P.inside);
      boxes.push(boxOf(f, -X, -ow, 0, soffit), boxOf(f, ow, X, 0, soffit));
      // The haunches, stepped: never lower than the arch.
      for (const [u0, u1] of [[2.1, ow], [1.2, 2.1]]) {
        boxes.push(boxOf(f, u0, u1, arch(u0), soffit), boxOf(f, -u1, -u0, arch(u0), soffit));
      }
      boxes.push(boxOf(f, -1.2, 1.2, apex, soffit));
    } else {
      // A blind arch's back, and the plain wall inside.
      q(-ow, 0, ow, spring, depth, f.out, P.recess);
      for (let k = 0; k < S; k++) triN(m, f.at(0, spring, depth), f.at(arc[k][0], arc[k][1], depth), f.at(arc[k + 1][0], arc[k + 1][1], depth), f.out, P.recess);
      q(-iw, 0, iw, soffit, T, inn, P.inside);
      boxes.push(boxOf(f, -X, X, 0, soffit));
    }
  });
  // The ceiling inside and the top: paving, the seat's ring, the corners.
  const up = [0, 1, 0];
  if (level < 2) quadN(m, [-X + T, soffit, -X + T], [X - T, soffit, -X + T], [X - T, soffit, X - T], [-X + T, soffit, X - T], [0, -1, 0], P.inside);
  const [s0, s1] = g.seat ?? [3.15, 3.85];
  const seg = [24, 8, 8][level];
  const edge = (a) => {
    const k = X / Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a)));
    return [Math.sin(a) * k, H, Math.cos(a) * k];
  };
  for (let s = 0; s < seg; s++) {
    const [a0, a1] = [(s / seg) * Math.PI * 2, ((s + 1) / seg) * Math.PI * 2];
    if (level === 2) {
      triN(m, [0, H, 0], edge(a0), edge(a1), up, P.top);
      continue;
    }
    triN(m, [0, H, 0], pt(a0, s0, H), pt(a1, s0, H), up, P.top);
    quadN(m, pt(a0, s0, H), pt(a1, s0, H), pt(a1, s1, H), pt(a0, s1, H), up, P.trim);
    quadN(m, pt(a0, s1, H), pt(a1, s1, H), edge(a1), edge(a0), up, P.top);
  }
  if (level === 0) m.boxes = boxes;
  return m;
}
