// Small plants: broadleaf shrubs (env.shrub.*) and grass clumps (env.grass.*).
//
// Shrub: 4–7 short stems from one root, two orders of side shoots, leaf-cluster cards packed toward a squashed,
// noisy ellipsoid. No collision; it conceals (bots spot someone inside only up close), sized from its bounds.
// Grass clump: 7–11 tapered blades of three segments (two triangles a segment, one at the tip), bent along a
// seeded curve, two colour ramps. No texture, no collision, no LOD (distance thinning instead).

import { rng } from './rng.mjs';
import { fbm3 } from './noise.mjs';
import { Mesh, add, cross, len, mul, norm, perp, sub } from './mesh.mjs';
import { card, chains, spread, tubes } from './branches.mjs';
import { toLinear } from './tree.mjs';

export function shrubSkeleton(seed, g) {
  const r = rng(seed);
  const nodes = [{ p: [0, -0.05, 0], parent: -1, r: 0.03 }];
  const n = r.int(g.stems[0], g.stems[1]);
  let az = r.next() * Math.PI * 2;
  for (let s = 0; s < n; s++) {
    az += ((137.5 + r.jitter(30)) * Math.PI) / 180;
    const tilt = r.range(0.25, 0.7);
    let d = norm([Math.cos(az) * tilt, 1, Math.sin(az) * tilt]);
    let p = [Math.cos(az) * 0.05, 0, Math.sin(az) * 0.05];
    let parent = 0;
    const L = g.height * r.range(0.7, 1.0);
    const segs = 4;
    for (let k = 0; k < segs; k++) {
      d = norm(add(d, [r.jitter(0.15), -0.02, r.jitter(0.15)]));
      p = add(p, mul(d, L / segs));
      nodes.push({ p, parent, r: 0.022 * (1 - k / segs) + 0.006 });
      parent = nodes.length - 1;
      // Side shoots from the upper stem.
      if (k >= 1 && r.chance(0.8)) {
        let sd = norm(add(d, mul(perp(d), r.jitter(1.2))));
        sd = norm(add(sd, [r.jitter(0.4), 0.1, r.jitter(0.4)]));
        let q = p;
        let sp = parent;
        for (let j = 0; j < 2; j++) {
          q = add(q, mul(sd, L * 0.18));
          nodes.push({ p: q, parent: sp, r: 0.008 });
          sp = nodes.length - 1;
        }
      }
    }
  }
  return { nodes };
}

/** One level of detail: { bark, leaf }. lod = { stems (mesh the stems?), cards, cardScale }. */
export function shrubMesh(seed, sk, g, lod, look, atlas) {
  const r = rng(seed + 3);
  const bark = new Mesh();
  const leaf = new Mesh();
  const col = toLinear(look.bark);
  if (lod.stems) {
    tubes(bark, sk.nodes, chains(sk.nodes), { minRadius: 0.009, sides: () => 3, step: 1, uv: { u0: 0, u1: 0.5 }, colour: () => col.map((v) => v * 0.8), wind: (p) => [Math.min(1, p[1] / g.height) ** 1.5 * 0.6, 0] });
  }
  // Card centres: points in a squashed noisy ellipsoid, nearest a shoot (so cards sit on the plant, not in air).
  const edge = fbm3(seed + 5, 2);
  const rx = g.width / 2;
  const ry = g.height / 2;
  const cy = g.height * 0.52;
  const pts = [];
  for (let t = 0; pts.length < lod.cards * 3 && t < lod.cards * 60; t++) {
    const q = [r.jitter(rx), cy + r.jitter(ry), r.jitter(rx)];
    const d = (q[0] / rx) ** 2 + ((q[1] - cy) / ry) ** 2 + (q[2] / rx) ** 2;
    if (d < 1 + 0.4 * edge(q[0] * 2, q[1] * 2, q[2] * 2) && d > 0.15 && q[1] > 0.12) pts.push(q);
  }
  // Outer points first (they make the outline), then spread.
  pts.sort((a, b) => len(sub(b, [0, cy, 0])) - len(sub(a, [0, cy, 0])));
  const chosen = spread(pts.slice(0, Math.max(lod.cards, Math.round(pts.length * 0.6))), lod.cards);
  const leaves = look.leaves.map(toLinear);
  const keys = ['shrub.0', 'shrub.1', 'shrub.2', 'shrub.3'];
  for (const q of chosen) {
    const out = norm(sub(q, [0, cy * 0.6, 0]));
    const face = norm(add(mul(out, 0.7), r.unit()));
    const up = norm(add(out, [0, 0.8, 0]));
    const depth = Math.min(1, len(sub(q, [0, cy, 0])) / Math.max(rx, ry));
    const base = leaves[r.int(0, leaves.length - 1)];
    const v = (0.5 + 0.5 * depth) * (1 + r.jitter(look.jitter)) * (0.75 + 0.25 * Math.min(1, q[1] / g.height));
    const size = g.cardSize * lod.cardScale * r.range(0.85, 1.15);
    const c = add(mul(q, 1 - 0.12 * (lod.cardScale - 1)), [0, 0, 0]);
    card(leaf, { c, up, face, size, card: atlas.cards[keys[r.int(0, 3)]], colour: base.map((x) => x * v), lit: norm(add(mul(out, 0.8), [0, 0.3, 0])), wind: (p) => [Math.min(1, p[1] / g.height) ** 1.5 * 0.6, 1] });
  }
  return { bark, leaf };
}

/** A grass clump: { grass: Mesh } (one level). */
export function grassMesh(seed, g, look) {
  const r = rng(seed);
  const m = new Mesh();
  const [root, tip] = [toLinear(look.root), toLinear(look.tip)];
  const alt = look.alt ? toLinear(look.alt) : tip;
  const n = r.int(g.blades[0], g.blades[1]);
  for (let b = 0; b < n; b++) {
    const a = (b / n) * Math.PI * 2 + r.jitter(0.5);
    const base = [Math.cos(a) * r.range(0, g.spread), 0, Math.sin(a) * r.range(0, g.spread)];
    const h = g.height * r.range(0.6, 1.05);
    // Leaning out from the clump's middle, then curving over.
    const lean = r.range(0.15, 0.55);
    const out = [Math.cos(a + r.jitter(0.6)), 0, Math.sin(a + r.jitter(0.6))];
    const w = g.width * r.range(0.8, 1.2);
    const tint = r.chance(0.35) ? alt : tip;
    const segs = 3;
    const pts = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      pts.push(add(base, add(mul(out, lean * h * t * t * 1.2), [0, h * t * (1 - 0.18 * lean * t), 0])));
    }
    const side = norm(cross([0, 1, 0], out));
    // Lit mostly from above (grass reads as a lit mass, not as thin cards).
    const nrm = norm(add(mul(cross(side, norm(sub(pts[1], pts[0]))), 0.4), [0, 1, 0]));
    const ids = [];
    for (let k = 0; k < segs; k++) {
      const t = k / segs;
      const half = (w / 2) * (1 - t * 0.75);
      const c = root.map((v, i) => v + (tint[i] - v) * Math.min(1, t * 1.3));
      const wind = [t * t, 0];
      ids.push([m.vertex(add(pts[k], mul(side, -half)), nrm, [0, 1 - t], c, wind), m.vertex(add(pts[k], mul(side, half)), nrm, [1, 1 - t], c, wind)]);
    }
    const tipId = m.vertex(pts[segs], nrm, [0.5, 0], tint, [1, 0]);
    for (let k = 0; k + 1 < segs; k++) m.quad(ids[k][0], ids[k][1], ids[k + 1][1], ids[k + 1][0]);
    m.tri(ids[segs - 1][0], ids[segs - 1][1], tipId);
  }
  return { grass: m };
}
