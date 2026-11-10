// Drums and barrels (kit-prop family `drum`): a steel drum turned from a profile (rolled chimes top and bottom, two
// rolling hoops, a recessed lid with two bungs, or open with a dark inside and a liquid line), its paint worn at the
// hoops and chimes, rust in patches from seeded noise. It fills its bounds: [-w/2, w/2] × [0, h] × [-d/2, d/2], round
// in plan (w = d). Collision is the box round it, as the Kenney drums' was (a round piece's box stands off it only at
// 45°: docs/CONTENT_PIPELINE.md, "Prop collision").

import { rng } from '../env/rng.mjs';
import { noise3 } from '../env/noise.mjs';
import { Mesh, clamp01, disc, groundShade, hex, lathe, mix3, scale3 } from './geom.mjs';

/**
 * Settings `g`: `segments` per level, `hoops` (heights as shares of h), `open` (no lid). `look`: `paint` (hex),
 * `rust` (0-1), `wear` (0-1: bare steel at the hoops and chimes), `band` (hex: a painted band between the hoops),
 * `liquid` (hex: an open drum's contents).
 */
export function drumMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const R = w / 2;
  const seg = g.segments[Math.min(level, g.segments.length - 1)];
  const r = rng(seed);
  const m = new Mesh();
  const paint = hex(look.paint);
  const steel = hex('#7c7f82');
  const rustC = hex(look.rustColour ?? '#6a3a20');
  const band = look.band ? hex(look.band) : null;
  const rn = noise3(seed + 3);
  const sn = noise3(seed + 41);
  // Turned by a whole eighth, so every level's polygon has corners on the bounds' sides (it fills its box exactly).
  const phase = r.int(0, 7) * (Math.PI / 4);
  if (level >= 2) {
    // The farthest level: a prism and its lid, the paint's colour, the ground's shade.
    const paint = hex(look.paint);
    lathe(m, [[R, 0], [R, h]], seg, (p) => scale3(paint, groundShade(p[1], 0.2, 0.75)), { phase });
    disc(m, R, h, seg, scale3(paint, g.open ? 0.3 : 0.85), { phase });
    return m;
  }
  const hoops = g.hoops ?? [0.34, 0.66];
  const rb = R * 0.975;
  // Rows that are worn bare (chimes and hoop crests): their index in the profile.
  const crest = new Set();
  const prof = [];
  const add = (rad, y, worn = false) => {
    if (worn) crest.add(prof.length);
    prof.push([rad, y]);
  };
  const chime = Math.min(0.03, h * 0.035);
  if (level === 0) {
    add(R * 0.94, 0);
    add(R, chime * 0.4, true);
    add(R, chime, true);
    add(rb, chime * 1.4);
    for (const hy of hoops) {
      const y = hy * h;
      add(rb, y - 0.03);
      add(R, y - 0.008, true);
      add(R, y + 0.008, true);
      add(rb, y + 0.03);
    }
    add(rb, h - chime * 1.4);
    add(R, h - chime, true);
    add(R, h - chime * 0.3, true);
    add(R * 0.95, h, true);
  } else {
    add(R * 0.96, 0);
    add(R, chime);
    for (const hy of hoops) add(R, hy * h);
    add(R, h - chime);
    add(R * 0.96, h);
  }
  // The painted band between the hoops (its rows' own vertices: the hoops keep their paint).
  const between = (y) => band && y >= hoops[0] * h + 0.03 - 1e-6 && y <= hoops[hoops.length - 1] * h - 0.03 + 1e-6;
  const colour = (p, n, row) => {
    const worn = crest.has(row) || crest.has(row + 1);
    let c = between(p[1]) ? band : paint;
    // Scratches and chips: bare steel where noise is high, more on the worn rows.
    const chip = clamp01((sn(p[0] * 14, p[1] * 9, p[2] * 14) * 0.5 + 0.5) - (1 - (look.wear ?? 0.25) * (worn ? 1.6 : 0.5))) * 4;
    c = mix3(c, steel, clamp01(chip));
    const rust = clamp01((rn(p[0] * 4, p[1] * 5, p[2] * 4) * 0.5 + 0.5 - (1 - (look.rust ?? 0.2))) * 3 + (p[1] < 0.12 ? (look.rust ?? 0.2) * 0.6 : 0));
    c = mix3(c, rustC, rust);
    return scale3(c, groundShade(p[1], 0.2, 0.75) * (worn ? 1.08 : 1));
  };
  lathe(m, prof, seg, colour, { phase, hard: level === 0 ? [1, 3] : [] });
  const lidY = h - chime * 0.8;
  const rimR = prof[prof.length - 1][0];
  if (g.open) {
    // Inside: the shell turned inward (dark), a liquid line part way down.
    const ins = new Mesh();
    const inner = scale3(paint, 0.25);
    const liquidY = h * (look.fill ?? 0.72);
    lathe(ins, [[rimR * 0.97, h], [rimR * 0.97, liquidY]], seg, (p) => scale3(inner, 0.5 + 0.5 * clamp01((p[1] - liquidY) / (h - liquidY))), { phase });
    m.append(ins);
    disc(m, rimR * 0.97, liquidY, seg, hex(look.liquid ?? '#1c1a16'), { phase });
    // The rim's top edge, between outside and inside.
    lathe(m, [[rimR, h], [rimR * 0.97, h]], seg, () => scale3(steel, 0.9), { phase });
  } else {
    // A recessed lid inside the top chime, two bungs on it.
    lathe(m, [[rimR, h], [rimR * 0.96, lidY]], seg, (p) => scale3(colour(p, [0, 1, 0], prof.length - 1), 0.85), { phase });
    disc(m, rimR * 0.96, lidY, seg, (p) => colour(p, [0, 1, 0], -2), { phase });
    if (level === 0) {
      for (const [a, k] of [[phase + 0.6, 0.62], [phase + 0.6 + Math.PI, 0.55]]) {
        const bx = Math.cos(a) * R * k;
        const bz = Math.sin(a) * R * k;
        const bung = new Mesh();
        const br = R * (k > 0.6 ? 0.14 : 0.09);
        lathe(bung, [[br, lidY], [br, lidY + 0.012], [br * 0.8, lidY + 0.016]], 8, () => scale3(steel, 0.8));
        disc(bung, br * 0.8, lidY + 0.016, 8, scale3(steel, 0.7));
        for (let i = 0; i < bung.P.length; i += 3) {
          bung.P[i] += bx;
          bung.P[i + 2] += bz;
        }
        m.append(bung);
      }
    }
  }
  // The bottom (seen when it lies or from below a ledge): a plain disc.
  if (level === 0) disc(m, R * 0.94, 0, seg, scale3(paint, 0.4), { down: true, phase });
  return m;
}
