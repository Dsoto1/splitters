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

/** A thin strip along `pts` (one quad per segment, a point at the tip when `tip`), width `w` tapering to `tipW`. */
function strip(m, pts, side, w, tipW, nrm, colourAt, windAt, tip) {
  const ids = [];
  const last = tip ? pts.length - 1 : pts.length;
  for (let k = 0; k < last; k++) {
    const t = k / (pts.length - 1);
    const half = (w + (tipW - w) * t) / 2;
    ids.push([m.vertex(add(pts[k], mul(side, -half)), nrm, [0, 1 - t], colourAt(t), windAt(t)), m.vertex(add(pts[k], mul(side, half)), nrm, [1, 1 - t], colourAt(t), windAt(t))]);
  }
  for (let k = 0; k + 1 < ids.length; k++) m.quad(ids[k][0], ids[k][1], ids[k + 1][1], ids[k + 1][0]);
  if (tip) {
    const t = 1;
    const id = m.vertex(pts[pts.length - 1], nrm, [0.5, 0], colourAt(t), windAt(t));
    m.tri(ids[ids.length - 1][0], ids[ids.length - 1][1], id);
  }
}

/**
 * A meadow flower plant (env.flower.*): a few basal leaves, 3–4 thin stems, a flower-head card on each (the leaves
 * atlas' flower pictures, `look.card` picks which), turned up and outward so the heads read from eye height.
 * { stems: Mesh (env.grass: stems and leaves, vertex colour only), heads: Mesh (env.leaf: alpha-tested cards) }.
 */
export function flowerMesh(seed, g, look, atlas) {
  const r = rng(seed);
  const stems = new Mesh();
  const heads = new Mesh();
  const stemCol = toLinear(look.stem);
  const leafCol = toLinear(look.leaf ?? look.stem);
  const petal = toLinear(look.petal);
  const headCard = atlas.cards[`flower.${look.card ?? 0}`];
  // Basal leaves: short broad blades.
  const nl = g.leaves;
  for (let b = 0; b < nl; b++) {
    const a = (b / nl) * Math.PI * 2 + r.jitter(0.6);
    const out = [Math.cos(a), 0, Math.sin(a)];
    const h = g.leafLength * r.range(0.7, 1.1);
    const pts = [0, 0.5, 1].map((t) => add(mul(out, h * (0.15 + 0.75 * t)), [0, h * (0.55 * t - 0.25 * t * t) + 0.01, 0]));
    const side = norm(cross([0, 1, 0], out));
    strip(stems, pts, side, g.leafWidth, g.leafWidth * 0.4, [0, 1, 0], (t) => leafCol.map((v) => v * (0.75 + 0.3 * t)), (t) => [t * t * 0.5, 0], true);
  }
  // Stems with a head each.
  const n = r.int(g.stems[0], g.stems[1]);
  for (let s = 0; s < n; s++) {
    const a = (s / n) * Math.PI * 2 + r.jitter(0.7);
    const out = [Math.cos(a), 0, Math.sin(a)];
    const h = g.height * r.range(0.68, 1.05);
    const lean = r.range(0.08, 0.3);
    const base = mul(out, r.range(0.01, 0.04));
    const pts = [0, 0.55, 1].map((t) => add(base, add(mul(out, lean * h * t * t), [0, h * t, 0])));
    const side = norm(cross([0, 1, 0], out));
    strip(stems, pts, side, g.stemWidth, g.stemWidth * 0.7, norm(add(mul(side, 0.2), [0, 1, 0])), (t) => stemCol.map((v) => v * (0.8 + 0.25 * t)), (t) => [t * t, 0], false);
    // The head: facing up and out, a little random.
    const face = norm(add([0, 0.8, 0], add(mul(out, 0.55), [r.jitter(0.25), 0, r.jitter(0.25)])));
    const up = norm(cross(face, norm(cross([0, 1, 0], face))));
    const size = g.headSize * r.range(0.85, 1.2);
    const top = pts[2];
    const tone = 0.9 + 0.12 * r.next();
    card(heads, { c: add(top, mul(face, 0.004)), up, face, size, card: headCard, colour: petal.map((v) => v * tone), lit: norm(add(face, [0, 0.6, 0])), wind: () => [1, 0.4] });
  }
  return { stems, heads };
}

/**
 * A fern (env.fern.*): 5–7 fronds, each the leaves atlas' frond picture on a card bent in two along an arch that
 * rises from the crown and falls back toward the ground. { fronds: Mesh (env.leaf) }.
 */
export function fernMesh(seed, g, look, atlas) {
  const r = rng(seed);
  const m = new Mesh();
  const info = atlas.cards['fern.0'];
  const [u0, v0, u1, v1] = info.uv;
  const cols = look.fronds.map(toLinear);
  const n = r.int(g.fronds[0], g.fronds[1]);
  let az = r.next() * Math.PI * 2;
  for (let f = 0; f < n; f++) {
    az += ((137.5 + r.jitter(25)) * Math.PI) / 180;
    const out = [Math.cos(az), 0, Math.sin(az)];
    const L = g.length * r.range(0.75, 1.1);
    // Steeper fronds stand taller; all arch over.
    const rise = g.height * r.range(0.75, 1.1);
    // Narrower than the picture: a frond is long and slim; the leaflets in the picture slant enough to take it.
    const w = L * info.aspect * 0.55;
    // Each frond rolled about its own length, one way or the other, so the fern is a vase of fronds, not a mat.
    const roll = (f % 2 ? 1 : -1) * r.range(0.35, 0.7);
    const flat = norm(cross([0, 1, 0], out));
    const side = norm(add(mul(flat, Math.cos(roll)), [0, Math.sin(roll), 0]));
    // Along the frond: base, middle (highest), tip (lower and further out).
    const path = [0, 0.5, 1].map((t) => add(mul(out, L * (0.04 + 0.5 * t)), [0, rise * (2.6 * t - 1.7 * t * t) + 0.02, 0]));
    const tilt = r.jitter(0.25);
    const col = cols[r.int(0, cols.length - 1)].map((v) => v * (0.85 + 0.25 * r.next()));
    const ids = path.map((p, k) => {
      const t = k / 2;
      // Each half of the frond droops a little from the rachis.
      const halfW = (w / 2) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.25 + 0.75 * t)));
      const nrm = norm(add([0, 1, 0], mul(side, tilt)));
      const vv = v1 + (v0 - v1) * t;
      const droop = [0, -halfW * 0.25, 0];
      return [
        m.vertex(add(add(p, mul(side, -halfW)), droop), nrm, [u0, vv], col, [t * t * 0.7, t]),
        m.vertex(p, nrm, [(u0 + u1) / 2, vv], col, [t * t * 0.7, t]),
        m.vertex(add(add(p, mul(side, halfW)), droop), nrm, [u1, vv], col, [t * t * 0.7, t]),
      ];
    });
    for (let k = 0; k < 2; k++) {
      m.quad(ids[k][0], ids[k][1], ids[k + 1][1], ids[k + 1][0]);
      m.quad(ids[k][1], ids[k][2], ids[k + 1][2], ids[k + 1][1]);
    }
  }
  return { fronds: m };
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
