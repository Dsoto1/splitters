// Cardboard cartons (kit-prop family `box`): a closed carton with softened vertical corners, sides bowed a little
// (always inside its bounds), two top flaps meeting along the long axis under a tape strip that runs down two sides,
// and an optional label or a second tape. It fills [-w/2, w/2] × [0, h] × [-d/2, d/2]: collision is the box.

import { rng } from '../env/rng.mjs';
import { noise3 } from '../env/noise.mjs';
import { Mesh, clamp01, groundShade, hex, quadN, scale3, standIn, triN } from './geom.mjs';

/**
 * Settings `g`: `bevel` (corner softening, m), `bow` (how far the sides bow out, m), `tape` (tape width, m), `grid`
 * (side cells across, level 0). `look`: `board` (hex), `tape` (hex), `label` (hex, or none), `cross` (a second
 * tape across), `jitter`, `grime`, `crease` (how dark the folds are).
 */
export function cartonMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  if (level >= 2) return standIn(size, hex(look.board), hex(look.board));
  const r = rng(seed);
  const m = new Mesh();
  const board = scale3(hex(look.board), 1 + r.jitter(look.jitter ?? 0.06));
  const tape = hex(look.tape ?? '#c9a66b');
  const label = look.label ? hex(look.label) : null;
  const n = noise3(seed);
  const tw = g.tape;
  const bev = level === 0 ? g.bevel : 0;
  const bow = level === 0 ? g.bow : 0;
  const cells = level === 0 ? g.grid ?? 4 : 1;
  const X = w / 2;
  const Z = d / 2;
  const grime = look.grime ?? 0.2;
  const tone = (c) => (p) => scale3(c, groundShade(p[1], 0.15, 1 - grime) * (1 - 0.12 * clamp01(n(p[0] * 9, p[1] * 9, p[2] * 9))));
  // Labels sit on the +z face (lower middle), the tape runs over the top along x and down the ±x faces.
  const labelCell = label ? [Math.floor(cells / 2) - (cells > 2 ? 1 : 0), Math.max(0, Math.floor(cells / 2) - 1)] : null;
  // Sides: a grid of cells on each, the inner points bowed out (the bow tapers to 0 at the edges and corners).
  const side = (k, s) => {
    const ua = k === 0 ? 2 : 0;
    const half = k === 0 ? Z : X;
    const plane = k === 0 ? X : Z;
    const want = [0, 0, 0];
    want[k] = s;
    const P = (u, v) => {
      const p = [0, 0, 0];
      const t = (u + half) / (2 * half);
      const bowAt = bow * Math.sin(Math.PI * t) * Math.sin(Math.PI * (v / h));
      // Bevelled corners: the face stops `bev` short of the corner; the corner strip closes the gap.
      p[ua] = u;
      p[1] = v;
      p[k] = s * (plane - bow + bowAt);
      return p;
    };
    const u0 = -half + bev;
    const u1 = half - bev;
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++) {
        const a0 = u0 + ((u1 - u0) * i) / cells;
        const a1 = u0 + ((u1 - u0) * (i + 1)) / cells;
        const b0 = (h * j) / cells;
        const b1 = (h * (j + 1)) / cells;
        let c = board;
        if (labelCell && k === 2 && s > 0 && i === labelCell[0] && j === labelCell[1]) c = label;
        // The tape's down-run: the middle columns of the top row on the ±x faces.
        const mid = (a0 + a1) / 2;
        if (k === 0 && j === cells - 1 && Math.abs(mid) < tw && level === 0) c = tape;
        if (look.cross && k === 2 && j === cells - 1 && Math.abs(mid) < tw && level === 0) c = tape;
        quadN(m, P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), want, tone(c));
      }
  };
  for (const [k, s] of [[0, 1], [0, -1], [2, 1], [2, -1]]) side(k, s);
  // Softened corners: a strip at each vertical corner from one face's edge to the next, darker (a fold).
  if (bev > 0) {
    const fold = scale3(board, 1 - (look.crease ?? 0.25));
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const a0 = [sx * (X - bow), 0, sz * (Z - bev)];
        const b0 = [sx * (X - bev), 0, sz * (Z - bow)];
        const a1 = [a0[0], h, a0[2]];
        const b1 = [b0[0], h, b0[2]];
        quadN(m, a0, b0, b1, a1, [sx, 0, sz], tone(fold));
      }
  }
  // The top: two flaps meeting along x under the tape (strips side by side, never on top of each other).
  const top = [0, 1, 0];
  const tx0 = -X + bev;
  const tx1 = X - bev;
  const zs = level === 0 ? [-Z + bev, -tw / 2, -0.002, 0.002, tw / 2, Z - bev] : [-Z, Z];
  for (let i = 0; i + 1 < zs.length; i++) {
    const z0 = zs[i];
    const z1 = zs[i + 1];
    const mid = (z0 + z1) / 2;
    const c = level > 0 ? board : Math.abs(mid) < 0.003 ? scale3(tape, 0.7) : Math.abs(mid) < tw / 2 ? tape : board;
    quadN(m, [tx0, h, z0], [tx1, h, z0], [tx1, h, z1], [tx0, h, z1], top, (p) => scale3(c, 1 - 0.08 * clamp01(n(p[0] * 7, 3, p[2] * 7))));
  }
  // The top's rim over the bevelled corners and the bowed sides' margin: a thin frame round the flaps.
  if (bev > 0 || bow > 0) {
    const e = scale3(board, 0.92);
    quadN(m, [-X + bow, h, -Z + bev], [-X + bev, h, -Z + bev], [-X + bev, h, Z - bev], [-X + bow, h, Z - bev], top, e);
    quadN(m, [X - bev, h, -Z + bev], [X - bow, h, -Z + bev], [X - bow, h, Z - bev], [X - bev, h, Z - bev], top, e);
    quadN(m, [-X + bev, h, -Z + bow], [X - bev, h, -Z + bow], [X - bev, h, -Z + bev], [-X + bev, h, -Z + bev], top, e);
    quadN(m, [-X + bev, h, Z - bev], [X - bev, h, Z - bev], [X - bev, h, Z - bow], [-X + bev, h, Z - bow], top, e);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) triN(m, [sx * (X - bev), h, sz * (Z - bev)], [sx * (X - bow), h, sz * (Z - bev)], [sx * (X - bev), h, sz * (Z - bow)], top, e);
  }
  // The bottom.
  quadN(m, [-X, 0, -Z], [X, 0, -Z], [X, 0, Z], [-X, 0, Z], [0, -1, 0], scale3(board, 0.4));
  return m;
}
