// Palms (env.palm.*): a single unbranched trunk that leans out from its base and curves back toward upright, ringed
// with leaf scars (the bark picture's palm strip), swelling into a bulb at the foot; a crown of 14–18 pinnate fronds
// set round the top by the golden angle, the youngest standing up, the oldest arching out and down, each a long card
// from the leaves atlas (palm.0 / palm.1) folded into a shallow V along its rachis and bent along its length; a few
// dead fronds hanging against the trunk under the crown, and a cluster of nuts.
// Collision (shared): the trunk as three capsules that stop everything; fronds none (they are overhead).

import { rng } from './rng.mjs';
import { Mesh, add, cross, mul, norm, rotate } from './mesh.mjs';
import { card, chains, tubes } from './branches.mjs';
import { toLinear } from './tree.mjs';
import { BARK_STRIPS } from './textures.mjs';

const GOLDEN = (137.5 * Math.PI) / 180;
const DEG = Math.PI / 180;

/** The trunk and the fronds' layout (shared by every level and variant). */
export function palmSkeleton(seed, g) {
  const r = rng(seed);
  const az = r.next() * Math.PI * 2;
  const out = [Math.cos(az), 0, Math.sin(az)];
  const lean = r.range(g.lean[0], g.lean[1]) * DEG;
  const trunkH = g.height * g.trunkShare;
  const nodes = [{ p: [0, -0.15, 0], parent: -1, r: 0 }];
  let p = [0, 0, 0];
  nodes.push({ p, parent: 0, r: 0 });
  const trunk = [0, 1];
  const wob = r.fork('wobble');
  // Walk up the trunk: the lean is largest at the foot and eases off (`straighten`) toward the crown.
  let s = 0;
  for (let k = 0; k < 200 && p[1] < trunkH; k++) {
    const t = Math.min(1, p[1] / trunkH);
    const a = lean * (1 - g.straighten * t ** 0.8) + wob.jitter(0.6) * DEG;
    const d = norm(add(mul(out, Math.sin(a)), [wob.jitter(0.015), Math.cos(a), wob.jitter(0.015)]));
    p = add(p, mul(d, g.step));
    s += g.step;
    nodes.push({ p, parent: nodes.length - 1, r: 0 });
    trunk.push(nodes.length - 1);
  }
  // Radii: a bulb at the foot, a long gentle taper, the crown shaft a touch wider just under the fronds.
  const top = nodes[trunk[trunk.length - 1]].p;
  for (const i of trunk) {
    const y = Math.max(0, nodes[i].p[1]);
    const t = y / Math.max(1, top[1]);
    const bulb = 1 + 0.35 * Math.exp(-y / 0.45);
    const shaft = t > 0.93 ? 1.08 : 1;
    nodes[i].r = g.trunkRadius * (1 - 0.32 * t) * bulb * shaft;
  }
  // The trunk's direction at the top (the crown sits square on it).
  const last = nodes[trunk[trunk.length - 1]].p;
  const prev = nodes[trunk[Math.max(1, trunk.length - 3)]].p;
  const up = norm([last[0] - prev[0], last[1] - prev[1], last[2] - prev[2]]);
  const fr = r.fork('fronds');
  const n = fr.int(g.fronds[0], g.fronds[1]);
  const fronds = [];
  let fa = fr.next() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    fa += GOLDEN + fr.jitter(0.12);
    // Age: 0 the youngest (upright, a little shorter), 1 the oldest (low, arching furthest).
    const age = (k + 0.5) / n;
    const elev = (g.elevation[1] + (g.elevation[0] - g.elevation[1]) * age + fr.jitter(8)) * DEG;
    const L = g.frondLength * (age < 0.15 ? 0.7 + 2 * age : 1) * fr.range(0.88, 1.08);
    fronds.push({ az: fa, elev, L, age, card: fr.chance(0.3) ? 1 : 0, twist: fr.jitter(0.35), tone: fr.range(0.85, 1.12), droop: g.droop * (0.6 + 0.8 * age) * fr.range(0.85, 1.15) });
  }
  const dead = [];
  const nd = fr.int(g.dead[0], g.dead[1]);
  for (let k = 0; k < nd; k++) dead.push({ az: fr.next() * Math.PI * 2, elev: -fr.range(62, 82) * DEG, L: g.frondLength * fr.range(0.55, 0.75), tone: fr.range(0.8, 1.1) });
  const nuts = [];
  for (let k = 0; k < g.nuts; k++) nuts.push({ az: fr.next() * Math.PI * 2, drop: fr.range(0.1, 0.35), out: fr.range(0.16, 0.26), size: fr.range(0.1, 0.13) });
  return { nodes, trunk, top: last, up, fronds, dead, nuts, H: g.height };
}

/** The rachis of a frond: K + 1 points from the crown, out along its azimuth and elevation, bending down as it goes. */
function rachis(sk, f, K) {
  const base = sk.top;
  let d = [Math.cos(f.az) * Math.cos(f.elev), Math.sin(f.elev), Math.sin(f.az) * Math.cos(f.elev)];
  // Lean the whole crown with the trunk's top.
  d = norm(add(d, mul(sk.up, 0.35)));
  const pts = [base];
  let p = base;
  for (let k = 0; k < K; k++) {
    d = norm(add(d, [0, -f.droop * ((k + 1) / K) ** 1.3 / K * 2.2, 0]));
    p = add(p, mul(d, f.L / K));
    pts.push(p);
  }
  return pts;
}

/** A frond as a folded strip of K segments along its rachis (the card's v runs base → tip, u across). */
function frond(m, pts, f, info, colour, fold, wind, widthShare) {
  const [u0, v0, u1, v1] = info.uv;
  const W = f.L * widthShare;
  const K = pts.length - 1;
  const ids = [];
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    const along = norm(k < K ? [pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1], pts[k + 1][2] - pts[k][2]] : [pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]]);
    let side = norm(cross([0, 1, 0], along));
    side = rotate(side, along, f.twist * t);
    const half = (W / 2) * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, 0.12 + 0.95 * t)));
    // The leaflets hang from the rachis: each half drops by `fold` of its width, more toward the tip.
    const drop = [0, -half * fold * (0.6 + 0.6 * t), 0];
    const nrm = norm(add(cross(along, side), [0, 0.6, 0]));
    const n = nrm[1] < 0 ? mul(nrm, -1) : nrm;
    const vv = v1 + (v0 - v1) * t;
    const w = wind(pts[k], t);
    ids.push([
      m.vertex(add(add(pts[k], mul(side, -half)), drop), n, [u0, vv], colour, w),
      m.vertex(pts[k], n, [(u0 + u1) / 2, vv], colour, w),
      m.vertex(add(add(pts[k], mul(side, half)), drop), n, [u1, vv], colour, w),
    ]);
  }
  for (let k = 0; k < K; k++) {
    m.quad(ids[k][0], ids[k][1], ids[k + 1][1], ids[k + 1][0]);
    m.quad(ids[k][1], ids[k][2], ids[k + 1][2], ids[k + 1][1]);
  }
}

/** A small faceted nut (an octahedron, squashed). */
function nut(m, c, s, colour) {
  const v = [[s, 0, 0], [-s, 0, 0], [0, s * 0.9, 0], [0, -s * 1.1, 0], [0, 0, s], [0, 0, -s]].map((o) => ({ p: add(c, o), n: norm(o) }));
  const ids = v.map(({ p, n }) => m.vertex(p, n, [0.6, 0.5], colour, [0.4, 0]));
  for (const [a, b, d] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) m.tri(ids[a], ids[b], ids[d]);
}

/** One level of detail: { bark, leaf }. lod = { trunkSides, step, frondSegs, fronds (share kept), dead, nuts, widen }. */
export function palmMesh(seed, sk, g, lod, look, atlas) {
  const { nodes, H } = sk;
  const bark = new Mesh();
  const leaf = new Mesh();
  const r = rng(seed + 11);
  const barkCol = toLinear(look.bark);
  const sway = (p) => Math.min(1, Math.max(0, p[1] / H)) ** 2 * 0.35;
  tubes(bark, nodes, chains(nodes), {
    minRadius: 0,
    sides: () => lod.trunkSides,
    step: lod.step ?? 1,
    stepBelow: 1,
    uv: BARK_STRIPS.palm,
    colour: (p) => {
      // Paler and greyer up the trunk, damp and darker at the foot, the crown shaft greener.
      const t = Math.min(1, Math.max(0, p[1]) / Math.max(1, sk.top[1]));
      const k = 0.72 + 0.35 * t;
      const shaft = t > 0.94 ? 1 : 0;
      return [barkCol[0] * k * (1 - 0.15 * shaft), barkCol[1] * k * (1 + 0.12 * shaft), barkCol[2] * k * (1 - 0.1 * shaft)];
    },
    wind: (p) => [sway(p), 0],
    flare: (p, a) => (p[1] < 0.5 ? 1 + 0.12 * Math.sin(7 * a) * Math.exp(-Math.max(0, p[1]) / 0.2) : 1),
  });
  const greens = look.leaves.map(toLinear);
  const deadCol = toLinear(look.dead);
  const keep = Math.max(1, Math.round(sk.fronds.length * (lod.fronds ?? 1)));
  // Lighter levels keep the oldest and the youngest spread evenly, a little wider so the crown keeps its mass.
  const chosen = sk.fronds.filter((_, i) => keep >= sk.fronds.length || Math.floor((i * keep) / sk.fronds.length) !== Math.floor(((i + 1) * keep) / sk.fronds.length) || i === sk.fronds.length - 1).slice(0, keep);
  for (const f of chosen) {
    const pts = rachis(sk, f, lod.frondSegs);
    const base = greens[r.int(0, greens.length - 1)];
    // Older fronds lower and darker, the youngest a fresher yellow-green.
    const v = f.tone * (0.78 + 0.3 * (1 - f.age));
    const colour = [base[0] * v * (1 + 0.15 * (1 - f.age)), base[1] * v, base[2] * v * 0.95];
    frond(leaf, pts, { ...f, L: f.L }, atlas.cards[`palm.${f.card}`], colour, g.fold, (p, t) => [sway(p) + t * t * 0.6, t], g.frondWidth * (lod.widen ?? 1));
  }
  if (lod.dead)
    for (const f of sk.dead) {
      const pts = rachis(sk, { ...f, droop: 0.15, twist: 0 }, Math.max(2, lod.frondSegs - 2));
      frond(leaf, pts, { ...f, twist: 0 }, atlas.cards['palm.1'], deadCol.map((c) => c * f.tone), 0.9, (p, t) => [sway(p) + t * 0.15, t * 0.3], g.frondWidth * 0.6);
    }
  if (lod.nuts)
    for (const n of sk.nuts) {
      const c = add(sk.top, [Math.cos(n.az) * n.out, -n.drop, Math.sin(n.az) * n.out]);
      nut(bark, c, n.size, toLinear(look.nut));
    }
  return { bark, leaf };
}

/** Gameplay shapes (game space, scale 1): the trunk in three capsules that stop everything. */
export function palmShapes(sk, g) {
  const { nodes, trunk } = sk;
  const at = (f) => nodes[trunk[Math.min(trunk.length - 1, Math.max(1, Math.round(1 + f * (trunk.length - 2))))]];
  const base = nodes[trunk[1]];
  const pts = [[base.p[0], 0, base.p[2]], at(1 / 3).p, at(2 / 3).p, at(1).p];
  const shapes = [];
  for (let i = 0; i < 3; i++) shapes.push({ kind: 'capsule', a: pts[i], b: pts[i + 1], r: Math.max(g.minShapeRadius, at(i / 3 + 1 / 6).r), blocks: 'all', surface: 'bark' });
  return shapes;
}
