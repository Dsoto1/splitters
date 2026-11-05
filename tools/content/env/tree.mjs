// Broadleaf trees (env.broadleaf.*): a leaning trunk with a clear bole, 3–5 scaffold limbs set round it by the
// golden angle, then space colonisation toward an irregular crown of 2–3 lobes (not a sphere). Radii by the pipe
// model, a root flare at the base, leaf-cluster cards at the twig ends with normals bent out of the crown.
// Collision (shared, gameplay): the trunk to the crown base as capsules that stop everything, and the scaffold
// limbs thicker than `limbShapeRadius` as capsules that stop shots only.

import { rng } from './rng.mjs';
import { fbm3 } from './noise.mjs';
import { Mesh, add, dot, len, lerp3, mul, norm, perp, rotate, sub } from './mesh.mjs';
import { card, chains, pipeRadii, spread, tubes } from './branches.mjs';

const GOLDEN = (137.5 * Math.PI) / 180;

/** The skeleton and crown of one tree (shared by every level of detail and every material variant). */
export function broadleafSkeleton(seed, g) {
  const r = rng(seed);
  const H = g.height;
  // Trunk: a lean, then a slight wander up to the crown base.
  const leanAxis = rotate([1, 0, 0], [0, 1, 0], r.next() * Math.PI * 2);
  let dir = rotate([0, 1, 0], leanAxis, (r.range(g.lean[0], g.lean[1]) * Math.PI) / 180);
  const nodes = [{ p: [0, -0.15, 0], parent: -1 }];
  const crownBase = H * r.range(g.crownBase[0], g.crownBase[1]);
  let p = [0, 0, 0];
  nodes.push({ p, parent: 0 });
  const wander = r.fork('wander');
  while (p[1] < crownBase) {
    dir = norm(add(dir, [wander.jitter(0.08), 0.02, wander.jitter(0.08)]));
    p = add(p, mul(dir, 0.4));
    nodes.push({ p, parent: nodes.length - 1 });
  }
  const trunkTop = nodes.length - 1;
  // Crown: 2–3 overlapping lobes over the lean, squashed, with a noisy edge.
  const lobes = [];
  const nl = r.int(g.lobes[0], g.lobes[1]);
  const centre = add(p, mul(dir, (H - crownBase) * 0.45));
  for (let i = 0; i < nl; i++) {
    const a = r.next() * Math.PI * 2;
    const off = i === 0 ? 0 : r.range(0.6, 1.3) * g.crownRadius * 0.45;
    lobes.push({
      c: add(centre, [Math.cos(a) * off, r.jitter(0.6) + (i === 0 ? 0.2 : -0.3), Math.sin(a) * off]),
      rx: g.crownRadius * r.range(0.72, 1.0),
      ry: (H - crownBase) * r.range(0.38, 0.5),
      rz: g.crownRadius * r.range(0.72, 1.0),
    });
  }
  const edge = fbm3(seed + 101, 3);
  const inCrown = (q) => lobes.some((l) => ((q[0] - l.c[0]) / l.rx) ** 2 + ((q[1] - l.c[1]) / l.ry) ** 2 + ((q[2] - l.c[2]) / l.rz) ** 2 < 1 + 0.35 * edge(q[0] * 0.5, q[1] * 0.5, q[2] * 0.5)) && q[1] < H - 0.1 && q[1] > crownBase + 0.4;
  // Scaffold limbs: from the top of the bole, by the golden angle, rising and bending up.
  const scaffold = [];
  const ns = r.int(g.scaffold[0], g.scaffold[1]);
  let az = r.next() * Math.PI * 2;
  for (let i = 0; i < ns; i++) {
    az += GOLDEN + r.jitter(0.35);
    const at = Math.max(2, trunkTop - r.int(0, 2));
    const elev = (r.range(g.limbElevation[0], g.limbElevation[1]) * Math.PI) / 180;
    let d = norm([Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)]);
    let q = nodes[at].p;
    let parent = at;
    const steps = r.int(3, 5);
    for (let k = 0; k < steps; k++) {
      d = norm(add(d, [r.jitter(0.12), 0.1, r.jitter(0.12)]));
      q = add(q, mul(d, 0.42));
      nodes.push({ p: q, parent });
      parent = nodes.length - 1;
    }
    scaffold.push(parent);
  }
  // The leader goes on up the middle.
  {
    let d = dir;
    let q = nodes[trunkTop].p;
    let parent = trunkTop;
    for (let k = 0; k < 3; k++) {
      d = norm(add(d, [r.jitter(0.1), 0.15, r.jitter(0.1)]));
      q = add(q, mul(d, 0.42));
      nodes.push({ p: q, parent });
      parent = nodes.length - 1;
    }
  }
  // Space colonisation toward attraction points inside the crown.
  const pr = r.fork('points');
  const pts = [];
  const span = g.crownRadius * 2.4;
  // Foliage grows in clumps with gaps between them (a noise threshold), not as one even ball.
  const clump = fbm3(seed + 202, 2);
  for (let tries = 0; pts.length < g.attractors && tries < g.attractors * 40; tries++) {
    const q = [centre[0] + pr.jitter(span), crownBase + pr.next() * (H - crownBase), centre[2] + pr.jitter(span)];
    if (inCrown(q) && clump(q[0] * g.clumpScale, q[1] * g.clumpScale, q[2] * g.clumpScale) > g.clumpCut) pts.push(q);
  }
  const grow = r.fork('grow');
  const D = g.segment;
  const alive = pts.map(() => true);
  const growable = new Set(nodes.map((_, i) => i).filter((i) => i > trunkTop - 2));
  for (let it = 0; it < 80; it++) {
    const pull = new Map();
    pts.forEach((q, pi) => {
      if (!alive[pi]) return;
      let best = -1;
      let bd = g.influence;
      for (const i of growable) {
        const d = len(sub(q, nodes[i].p));
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return;
      const v = norm(sub(q, nodes[best].p));
      const acc = pull.get(best) ?? [0, 0, 0];
      pull.set(best, add(acc, v));
    });
    if (!pull.size) break;
    const added = [];
    for (const [i, v] of [...pull.entries()].sort((a, b) => a[0] - b[0])) {
      const d = norm(add(norm(v), [grow.jitter(0.15), g.tropism + grow.jitter(0.05), grow.jitter(0.15)]));
      const q = add(nodes[i].p, mul(d, D));
      nodes.push({ p: q, parent: i });
      added.push(nodes.length - 1);
    }
    for (const i of added) growable.add(i);
    pts.forEach((q, pi) => {
      if (alive[pi] && added.some((i) => len(sub(q, nodes[i].p)) < g.kill)) alive[pi] = false;
    });
  }
  // Radii: pipe model, scaled so the bole has its radius.
  pipeRadii(nodes, g.tipRadius, g.pipe ?? 2.4);
  const bole = nodes[2].r;
  const k = g.trunkRadius / bole;
  for (const n of nodes) n.r = Math.max(g.tipRadius, n.r * k);
  const lobeCentre = lobes.reduce((s, l) => add(s, mul(l.c, 1 / lobes.length)), [0, 0, 0]);
  return { nodes, trunkTop, scaffold, lobes, crownBase, centre: lobeCentre, inCrown, H };
}

const toLinear = (hex) => [1, 3, 5].map((i) => {
  const c = parseInt(hex.slice(i, i + 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
export { toLinear };

/**
 * One level of detail of a broadleaf: { bark: Mesh, leaf: Mesh }. `lod` = { minRadius, sides: [[r, n]…], step,
 * cards (count), cardScale }. `look` = the variant's colours { bark, leaves: [hex…], jitter }.
 */
export function broadleafMesh(seed, sk, g, lod, look, atlas) {
  const { nodes, H } = sk;
  const bark = new Mesh();
  const leaf = new Mesh();
  const r = rng(seed + 7);
  const barkCol = toLinear(look.bark);
  const limbs = chains(nodes);
  const flareN = fbm3(seed + 55, 2);
  tubes(bark, nodes, limbs, {
    minRadius: lod.minRadius,
    budget: lod.barkBudget,
    sides: (rad) => (lod.sides.find(([lim]) => rad >= lim) ?? [0, 3])[1],
    step: lod.step,
    stepBelow: lod.stepBelow ?? 0.06,
    uv: { u0: 0, u1: 0.5 },
    colour: (p, rad) => {
      // Darker low down and in the crown's shade; a greener cast at the foot (moss and damp).
      const ao = 0.62 + 0.38 * Math.min(1, p[1] / (sk.crownBase + 1));
      const foot = Math.max(0, 1 - p[1] / 0.9);
      return [barkCol[0] * ao * (1 - 0.25 * foot), barkCol[1] * ao * (1 + 0.1 * foot), barkCol[2] * ao * (1 - 0.3 * foot)];
    },
    wind: (p, rad) => [Math.min(1, Math.max(0, (p[1] - 1) / (H - 1))) ** 1.6 * Math.min(1, 0.15 / Math.max(rad, 0.02)), 0],
    flare: (p, a) => (p[1] < 0.9 ? 1 + 0.65 * Math.exp(-Math.max(0, p[1]) / 0.3) * (0.75 + 0.25 * Math.sin(5 * a) + 0.2 * flareN(a, p[1], 0)) : 1),
  });
  // Leaf clusters: at twig ends and along the thinnest limbs, spread evenly, bigger on lighter levels.
  const kids = nodes.map(() => 0);
  for (const n of nodes) if (n.parent >= 0) kids[n.parent]++;
  const spots = [];
  nodes.forEach((n, i) => {
    if (i < 3 || n.p[1] < sk.crownBase) return;
    // Twig ends twice (two clusters round each end), the thin limbs once.
    if (!kids[i]) spots.push([i, 0], [i, 1]);
    else if (n.r < 0.04) spots.push([i, 0]);
  });
  const chosen = spread(spots, lod.cards);
  const cards = ['oak.0', 'oak.1', 'oak.2', 'oak.3'];
  const leaves = look.leaves.map(toLinear);
  for (const [i, second] of chosen) {
    const n = second ? { p: add(nodes[i].p, mul(r.unit(), 0.35)), parent: nodes[i].parent } : nodes[i];
    const par = nodes[n.parent];
    const twig = norm(sub(n.p, par.p));
    const out = norm(sub(n.p, sk.centre));
    // Facing: mostly out of the crown, turned at random, never edge-on to everything.
    let face = norm(add(mul(out, 0.6), r.unit()));
    if (Math.abs(dot(face, twig)) > 0.9) face = perp(twig);
    const up = norm(add(twig, mul(out, 0.5)));
    const depth = Math.min(1, len(sub(n.p, sk.centre)) / (g.crownRadius * 1.1));
    const base = leaves[r.int(0, leaves.length - 1)];
    const v = (0.55 + 0.45 * depth) * (1 + r.jitter(look.jitter));
    const colour = [base[0] * v * (1 + r.jitter(0.06)), base[1] * v, base[2] * v * (1 + r.jitter(0.06))];
    const lit = norm(add(mul(out, 0.75), mul(face, 0.25)));
    const size = g.cardSize * lod.cardScale * r.range(0.85, 1.15);
    // Bigger cards on lighter levels sit further in, so the crown keeps its outline.
    const c = add(lerp3(n.p, sk.centre, Math.min(0.4, 0.22 * (lod.cardScale - 1))), mul(up, size * 0.2));
    card(leaf, { c, up, face, size, card: atlas.cards[cards[r.int(0, 3)]], colour, lit, bend: lod.bend ?? 0, wind: (q) => [Math.min(1, Math.max(0, (q[1] - 1) / (H - 1))) ** 1.6, 1] });
  }
  return { bark, leaf };
}

/** Gameplay shapes (game space, at scale 1): trunk capsules (all) and thick scaffold limbs (shots). */
export function broadleafShapes(sk, g) {
  const { nodes, trunkTop, scaffold } = sk;
  const shapes = [];
  const boleR = Math.max(g.minShapeRadius, nodes[3]?.r ?? g.trunkRadius);
  // The trunk in two capsules (it leans and wanders a little) up to the crown base.
  const mid = Math.max(2, Math.floor(trunkTop / 2));
  const pts = [[nodes[1].p[0], 0, nodes[1].p[2]], nodes[mid].p, nodes[trunkTop].p];
  for (let i = 0; i + 1 < pts.length; i++) shapes.push({ kind: 'capsule', a: pts[i], b: pts[i + 1], r: i === 0 ? boleR : Math.max(g.minShapeRadius, nodes[mid].r), blocks: 'all', surface: 'bark' });
  // Scaffold limbs: their first stretch, where they are thick.
  for (const tip of scaffold) {
    const chain = [];
    for (let i = tip; i > trunkTop - 3 && i >= 0; i = nodes[i].parent) chain.unshift(i);
    const base = nodes[chain[1] ?? chain[0]];
    if (base.r < g.limbShapeRadius) continue;
    const end = nodes[chain[chain.length - 1]];
    shapes.push({ kind: 'capsule', a: nodes[chain[0]].p, b: end.p, r: Math.max(g.limbShapeRadius, end.r), blocks: 'shots', surface: 'bark' });
  }
  return shapes;
}

export { lerp3 };
