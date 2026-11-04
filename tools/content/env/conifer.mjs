// Conifers (env.conifer.*): a monopodial trunk (a slight lean and wander) with whorls of 4–6 branches every
// 0.4–0.7 m, longer low down (an irregular cone), drooping with length, about one branch in seven missing, the
// lowest whorls dead (bare twigs). Needle sprays are bent cards from the shared atlas laid along each live branch.
// Collision (shared): the trunk as two capsules that stop everything; branches and needles none.

import { rng } from './rng.mjs';
import { Mesh, add, cross, mul, norm, rotate } from './mesh.mjs';
import { card, chains, tubes } from './branches.mjs';
import { toLinear } from './tree.mjs';

const GOLDEN = (137.5 * Math.PI) / 180;

export function coniferSkeleton(seed, g) {
  const r = rng(seed);
  const H = g.height;
  const leanAxis = rotate([1, 0, 0], [0, 1, 0], r.next() * Math.PI * 2);
  let dir = rotate([0, 1, 0], leanAxis, (r.range(g.lean[0], g.lean[1]) * Math.PI) / 180);
  const nodes = [{ p: [0, -0.15, 0], parent: -1, r: 0 }];
  let p = [0, 0, 0];
  nodes.push({ p, parent: 0, r: 0 });
  const trunk = [0, 1];
  while (p[1] < H - 0.3) {
    dir = norm(add(dir, [r.jitter(0.03), 0.04, r.jitter(0.03)]));
    p = add(p, mul(dir, 0.35));
    nodes.push({ p, parent: nodes.length - 1, r: 0 });
    trunk.push(nodes.length - 1);
  }
  // Radii along the trunk: linear taper from the base to a fine tip.
  const top = nodes[trunk[trunk.length - 1]].p[1];
  for (const i of trunk) nodes[i].r = Math.max(0.02, g.trunkRadius * (1 - Math.max(0, nodes[i].p[1]) / (top + 0.6)) ** 1.1);
  // Whorls.
  const branches = [];
  let h = g.firstWhorl + r.jitter(0.2);
  let az = r.next() * Math.PI * 2;
  while (h < top - 0.4) {
    const ti = trunk.reduce((best, i) => (Math.abs(nodes[i].p[1] - h) < Math.abs(nodes[best].p[1] - h) ? i : best), trunk[1]);
    const n = r.int(g.whorl[0], g.whorl[1]);
    const t = (h - g.firstWhorl) / Math.max(1, top - g.firstWhorl);
    const dead = h < g.deadBelow;
    for (let k = 0; k < n; k++) {
      az += (Math.PI * 2) / n + r.jitter(0.35);
      if (r.chance(g.missing)) continue;
      // Length: an irregular cone, with a little swell at the lower middle; dead ones shorter.
      const L = (g.maxBranch * (1 - t) ** 0.85 * r.range(0.8, 1.15) + 0.25) * (dead ? 0.55 : 1);
      const elev = ((g.elevation[0] + (g.elevation[1] - g.elevation[0]) * t + r.jitter(6)) * Math.PI) / 180;
      let d = [Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)];
      let q = nodes[ti].p;
      let parent = ti;
      const segs = L > 1.6 ? 3 : 2;
      const ids = [];
      for (let s = 0; s < segs; s++) {
        // Droop grows with length along the branch.
        d = norm(add(d, [0, -g.droop * (L / g.maxBranch) * (s + 1) * 0.35, 0]));
        q = add(q, mul(d, L / segs));
        nodes.push({ p: q, parent, r: 0 });
        parent = nodes.length - 1;
        ids.push(parent);
      }
      const rb = Math.max(0.012, Math.min(nodes[ti].r * 0.45, 0.018 + 0.022 * L));
      ids.forEach((id, s) => (nodes[id].r = rb * (1 - (s + 1) / (segs + 1)) + 0.008));
      branches.push({ base: ti, ids, dead, L, az, t });
    }
    h += r.range(g.whorlStep[0], g.whorlStep[1]);
    az += GOLDEN;
  }
  return { nodes, trunk, branches, H: top };
}

/** One level of detail: { bark, leaf }. lod = { trunkSides, branchSides, branchMin, sprays (per branch metre), sprayScale, deadTwigs }. */
export function coniferMesh(seed, sk, g, lod, look, atlas) {
  const { nodes, branches, H } = sk;
  const bark = new Mesh();
  const leaf = new Mesh();
  const r = rng(seed + 9);
  const barkCol = toLinear(look.bark);
  const limbs = chains(nodes);
  const wind = (p, rad) => [Math.min(1, Math.max(0, (p[1] - 1) / (H - 1))) ** 1.5 * Math.min(1, 0.1 / Math.max(rad, 0.02)), 0];
  tubes(bark, nodes, limbs, {
    minRadius: lod.branchMin,
    budget: lod.barkBudget,
    sides: (rad) => (rad > 0.06 ? lod.trunkSides : lod.branchSides),
    step: lod.step ?? 1,
    stepBelow: 1,
    uv: { u0: 0.5, u1: 1 },
    colour: (p) => {
      const ao = 0.6 + 0.4 * Math.min(1, p[1] / (H * 0.5));
      return [barkCol[0] * ao, barkCol[1] * ao, barkCol[2] * ao];
    },
    wind,
    flare: (p, a) => (p[1] < 0.6 ? 1 + 0.45 * Math.exp(-Math.max(0, p[1]) / 0.25) * (0.8 + 0.2 * Math.sin(4 * a)) : 1),
  });
  const needles = look.leaves.map(toLinear);
  const keys = ['needle.0', 'needle.1', 'needle.2', 'needle.3'];
  for (const b of branches) {
    if (b.dead) continue;
    const pts = [nodes[b.base].p, ...b.ids.map((i) => nodes[i].p)];
    const n = Math.max(lod.minSprays ?? 1, Math.round(b.L * lod.sprays));
    for (let k = 0; k < n; k++) {
      // Along the outer part of the branch.
      const s = 0.35 + 0.65 * ((k + 0.5) / n);
      const seg = Math.min(pts.length - 2, Math.floor(s * (pts.length - 1)));
      const f = s * (pts.length - 1) - seg;
      const a = pts[seg];
      const c0 = pts[seg + 1];
      const c = [a[0] + (c0[0] - a[0]) * f, a[1] + (c0[1] - a[1]) * f, a[2] + (c0[2] - a[2]) * f];
      const along = norm([c0[0] - a[0], c0[1] - a[1], c0[2] - a[2]]);
      // The spray lies nearly flat (its face up), turned a little round the branch.
      const sideways = norm(cross([0, 1, 0], along));
      const face = norm(add([0, 1, 0], mul(sideways, r.jitter(1.1))));
      const base = needles[r.int(0, needles.length - 1)];
      const shade = (0.6 + 0.4 * b.t) * (0.85 + 0.3 * s) * (1 + r.jitter(look.jitter));
      // Snow lies on about half the sprays, thickest on the flattest.
      const snow = look.snow ? look.snow * Math.max(0, face[1]) ** 2 * (r.chance(0.5) ? 1 : 0.2) : 0;
      const colour = [base[0] * shade * (1 - snow) + snow * 0.85, base[1] * shade * (1 - snow) + snow * 0.88, base[2] * shade * (1 - snow) + snow * 0.92];
      const out = norm([Math.cos(b.az), 0.5, Math.sin(b.az)]);
      const size = Math.min(1.25, 0.55 + b.L * 0.3) * lod.sprayScale * r.range(0.85, 1.1);
      card(leaf, { c: add(c, mul(along, size * 0.15)), up: along, face, size, card: atlas.cards[keys[r.int(0, 3)]], colour, lit: norm(add(mul(out, 0.6), [0, 0.5, 0])), bend: lod.bend, wind: (q) => [wind(q, 0.02)[0], 1] });
    }
  }
  // The leader: a few upright sprays round the top.
  const tip = nodes[sk.trunk[sk.trunk.length - 1]].p;
  for (let k = 0; k < lod.leader; k++) {
    const a = (k / lod.leader) * Math.PI * 2 + r.jitter(0.3);
    const face = [Math.cos(a), 0, Math.sin(a)];
    const size = 1.0 * lod.sprayScale;
    const base = needles[0];
    card(leaf, { c: add(tip, [0, -size * 0.35, 0]), up: [0, 1, 0], face, size, card: atlas.cards[keys[k % 4]], colour: base.map((v) => v * 0.95), lit: norm(add(face, [0, 1, 0])), wind: (q) => [wind(q, 0.02)[0], 1] });
  }
  return { bark, leaf };
}

export function coniferShapes(sk, g) {
  const { nodes, trunk } = sk;
  const at = (y) => nodes[trunk.reduce((best, i) => (Math.abs(nodes[i].p[1] - y) < Math.abs(nodes[best].p[1] - y) ? i : best), trunk[1])];
  const base = nodes[trunk[1]].p;
  const mid = at(sk.H * 0.42);
  const high = at(sk.H * 0.78);
  return [
    { kind: 'capsule', a: [base[0], 0, base[2]], b: mid.p, r: Math.max(g.minShapeRadius, at(1).r), blocks: 'all', surface: 'bark' },
    { kind: 'capsule', a: mid.p, b: high.p, r: Math.max(0.12, mid.r), blocks: 'all', surface: 'bark' },
  ];
}
