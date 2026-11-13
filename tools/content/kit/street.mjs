// Street furniture (kit-prop families of Tileset 11, Urban & Civilian: docs/map-briefs/urban/URBAN_PLAN.md step B6):
// a striped shop awning (`awning`), generated here from seeds: nothing downloaded, nothing drawn from a photograph.
// It fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2], and has no collision (its family says `collide: "none"`):
// it hangs on a wall over a shop window, as the game's other awnings do; its back (−z) goes against the wall, its
// foot is the valance's hem. Nothing glows or blinks (CLAUDE.md, "Accessibility").
//
// Level 1 keeps the outline with far fewer triangles; level 2 is a stand-in of a few faces.

import { rng } from '../env/rng.mjs';
import { noise3 } from '../env/noise.mjs';
import { Mesh, bar, clamp01, hex, mix3, quadN, scale3, triN } from './geom.mjs';
import { lerp } from './machines.mjs';

// ---------------------------------------------------------------- the shop awning

/**
 * A striped shop awning: canvas sloping from the wall (−z, at the top) out to a front bar, a valance hanging from it
 * down to the piece's foot, closed sides, two steel arms. Settings `g`: `stripes` (how many, across the width),
 * `drop` (the valance's height, m; its hem is cut to a point a stripe). `look`: `canvas`, `stripe` (alternate stripes),
 * `frame`, `fade` (0–1: sun-bleached towards the front), `grime`. No collision (the family's `collide: "none"`).
 */
export function awningMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const canvas = hex(look.canvas);
  const stripe = hex(look.stripe ?? look.canvas);
  const frameC = hex(look.frame ?? '#6a6e72');
  const drop = g.drop ?? 0.22;
  const fade = look.fade ?? 0.15;
  const grime = look.grime ?? 0.2;
  const m = new Mesh();
  const r = rng(seed);
  const n = noise3(seed + 13);
  const pale = hex('#d8d4c8');
  // Canvas: bleached towards the front edge, streaked by rain, darker underneath.
  const cloth = (c, k = 1) => (p) => scale3(mix3(c, pale, fade * clamp01((p[2] + Z) / d)), k * (1 - grime * 0.35 * clamp01(n(p[0] * 2, p[1] * 2, p[2] * 6) * 0.5 + 0.3)));
  const stripes = level >= 2 ? 1 : Math.max(2, g.stripes ?? 8);
  const tones = Array.from({ length: Math.max(2, g.stripes ?? 8) }, () => 1 + r.jitter(0.03));
  const both = level >= 2 ? scale3([canvas[0] + stripe[0], canvas[1] + stripe[1], canvas[2] + stripe[2]], 0.5) : null;
  const points = level === 0;
  const hem = points ? drop * 0.36 : 0;
  for (let k = 0; k < stripes; k++) {
    const x0 = lerp(-X, X, k / stripes);
    const x1 = lerp(-X, X, (k + 1) / stripes);
    const c = both ?? scale3(k % 2 ? stripe : canvas, tones[k]);
    // The slope, and its underside.
    quadN(m, [x0, h, -Z], [x1, h, -Z], [x1, drop, Z], [x0, drop, Z], [0, 1, 0.5], cloth(c));
    if (level === 0) quadN(m, [x0, h - 0.004, -Z], [x1, h - 0.004, -Z], [x1, drop - 0.004, Z - 0.004], [x0, drop - 0.004, Z - 0.004], [0, -1, -0.5], cloth(c, 0.55));
    // The valance: front and back, its hem straight or cut to a point a stripe.
    for (const s of level === 0 ? [1, -1] : [1]) {
      const z = s > 0 ? Z : Z - 0.004;
      const col = cloth(c, s > 0 ? 0.92 : 0.6);
      quadN(m, [x0, hem, z], [x1, hem, z], [x1, drop, z], [x0, drop, z], [0, 0, s], col);
      if (points) triN(m, [x0, hem, z], [x1, hem, z], [(x0 + x1) / 2, 0, z], [0, 0, s], col);
    }
  }
  // The closed sides.
  for (const s of [-1, 1]) {
    const col = cloth(scale3(canvas, 0.85));
    triN(m, [s * X, h, -Z], [s * X, drop, Z], [s * X, drop, -Z], [s, 0, 0], col);
    if (level === 0) triN(m, [s * (X - 0.004), h, -Z], [s * (X - 0.004), drop, Z], [s * (X - 0.004), drop, -Z], [-s, 0, 0], cloth(scale3(canvas, 0.5)));
  }
  if (level >= 2) return m;
  // The frame: an arm each side under the canvas's lower edge, the front bar, the wall bar.
  const t = 0.035;
  const steel = (p, nn) => scale3(frameC, (nn[1] > 0.5 ? 1.1 : 0.85) * (1 - grime * 0.3));
  for (const s of [-1, 1]) bar(m, [s * (X - 0.03), drop + t / 2, -Z + t / 2], [s * (X - 0.03), drop + t / 2, Z - t], t, steel, { ends: true });
  bar(m, [-X + 0.01, drop + t / 2, Z - t], [X - 0.01, drop + t / 2, Z - t], t, steel);
  if (level === 0) bar(m, [-X + 0.01, h - t, -Z + t / 2], [X - 0.01, h - t, -Z + t / 2], t, steel);
  return m;
}
