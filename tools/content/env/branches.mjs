// Branch skeletons and their meshes, shared by the tree, conifer and shrub generators:
// - a skeleton is a list of nodes { p: [x,y,z], parent: index | -1, r: radius } (game space, metres);
// - `pipeRadii` gives radii by the pipe model (a parent's cross-section carries its children's);
// - `chains` splits it into limbs (each follows its thickest child), meshed as generalised cylinders by `tubes`;
// - `cards` adds cut-out leaf cards from the shared atlas (tools/content/env/textures.mjs).

import { Mesh, add, cross, dot, len, mul, norm, perp, sub } from './mesh.mjs';

/** Children lists for a skeleton. */
export function childrenOf(nodes) {
  const kids = nodes.map(() => []);
  nodes.forEach((n, i) => n.parent >= 0 && kids[n.parent].push(i));
  return kids;
}

/** Pipe-model radii: tips get `tip`, a parent r = (Σ r_child^e)^(1/e). Writes n.r; returns the root's radius. */
export function pipeRadii(nodes, tip, e = 2.4) {
  const kids = childrenOf(nodes);
  for (let i = nodes.length - 1; i >= 0; i--) {
    // Children always come after their parent, so walking back sees every child first.
    if (!kids[i].length) nodes[i].r = tip;
    else nodes[i].r = Math.max(tip, kids[i].reduce((s, k) => s + nodes[k].r ** e, 0) ** (1 / e));
  }
  return nodes[0].r;
}

/**
 * Limbs: from the root, each chain continues through its thickest child; every other child starts a new chain
 * (whose first point is the parent node, so limbs join). Chains are lists of node indices.
 */
export function chains(nodes) {
  const kids = childrenOf(nodes);
  const out = [];
  const stack = [[0]];
  while (stack.length) {
    const chain = stack.pop();
    let i = chain[chain.length - 1];
    for (;;) {
      const k = kids[i];
      if (!k.length) break;
      const sorted = [...k].sort((a, b) => nodes[b].r - nodes[a].r || a - b);
      for (const other of sorted.slice(1)) stack.push([i, other]);
      i = sorted[0];
      chain.push(i);
    }
    out.push(chain);
  }
  return out;
}

/**
 * Generalised cylinders along limbs into `mesh`. Options: minRadius (limbs starting thinner are left out: the leaf
 * cards stand in for twigs), sides(r) (ring sides by radius), step (keep every n-th node on limbs thinner than
 * `stepBelow`), uv: { u0, u1 } (the bark strip), colour(p, r) → rgb, wind(p, r) → [sway, flutter], flare(p, angle)
 * → radius factor (root flare), closeTips.
 */
export function tubes(mesh, nodes, limbs, o) {
  let made = 0;
  const start = mesh.triangles;
  // Thickest limbs first, so a triangle budget (`budget`) drops the thinnest twigs.
  const order = [...limbs].sort((a, b) => nodes[b[1] ?? b[0]].r - nodes[a[1] ?? a[0]].r || a[0] - b[0] || a.length - b.length);
  for (const chain of order) {
    const r0 = nodes[chain[1] ?? chain[0]].r;
    if (r0 < o.minRadius || chain.length < 2) continue;
    if (o.budget && mesh.triangles - start >= o.budget) break;
    // Thin out the rings along thin limbs (fewer triangles; the bend is kept by the remaining nodes).
    const keep = chain.filter((_, j) => j === 0 || j === chain.length - 1 || r0 >= (o.stepBelow ?? 0) || j % (o.step ?? 1) === 0);
    const pts = keep.map((i) => nodes[i].p);
    const rad = keep.map((i, j) => (j === 0 ? nodes[chain[1]].r : nodes[i].r));
    const sides = o.sides(r0);
    const circ = 2 * Math.PI * r0;
    // Parallel-transported frames: no twist along the limb.
    let t = norm(sub(pts[1], pts[0]));
    let nrm = perp(t);
    let s = 0;
    const rings = [];
    for (let j = 0; j < pts.length; j++) {
      const tn = j < pts.length - 1 ? norm(sub(pts[j + 1], pts[j])) : t;
      const tj = norm(add(t, tn));
      // Transport the normal onto the plane perpendicular to the new tangent.
      nrm = norm(sub(nrm, mul(tj, dot(nrm, tj))));
      const bin = cross(tj, nrm);
      if (j > 0) s += len(sub(pts[j], pts[j - 1]));
      const ring = [];
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const dir = add(mul(nrm, Math.cos(a)), mul(bin, Math.sin(a)));
        const f = o.flare ? o.flare(pts[j], a) : 1;
        const p = add(pts[j], mul(dir, rad[j] * f));
        const u = o.uv.u0 + (o.uv.u1 - o.uv.u0) * (k / sides);
        const v = s / (2 * circ);
        ring.push(mesh.vertex(p, dir, [u, v], o.colour(p, rad[j]), o.wind(p, rad[j])));
      }
      rings.push(ring);
      t = tn;
    }
    for (let j = 0; j + 1 < rings.length; j++)
      for (let k = 0; k < sides; k++) {
        const a = rings[j][k];
        const b = rings[j][k + 1];
        const c = rings[j + 1][k + 1];
        const d = rings[j + 1][k];
        // Outward faces: (b - a) runs round the ring, (d - a) along the limb.
        mesh.tri(a, b, c);
        mesh.tri(a, c, d);
      }
    made++;
  }
  return made;
}

/**
 * One cut-out card into `mesh`: centre `c`, its up direction `up` (along the twig), its facing `face`, size
 * (height, the width from the picture's aspect), the atlas rectangle `uv`, a colour, wind weights and the normal it
 * is lit by (`lit`: bent toward the outside of the crown, so the crown shades as one mass). `bend` folds the card
 * along its middle (two quads, a shallow V) for volume.
 */
export function card(mesh, { c, up, face, size, card: info, colour, wind, lit, bend = 0 }) {
  const u = norm(up);
  const side = norm(cross(u, face));
  const h = size;
  const w = size * info.aspect;
  const [u0, v0, u1, v1] = info.uv;
  const n = lit ?? norm(face);
  if (!bend) {
    const p = (sx, sy) => add(c, add(mul(side, sx * w * 0.5), mul(u, sy * h * 0.5)));
    const a = mesh.vertex(p(-1, -1), n, [u0, v1], colour, wind(p(-1, -1)));
    const b = mesh.vertex(p(1, -1), n, [u1, v1], colour, wind(p(1, -1)));
    const d = mesh.vertex(p(1, 1), n, [u1, v0], colour, wind(p(1, 1)));
    const e = mesh.vertex(p(-1, 1), n, [u0, v0], colour, wind(p(-1, 1)));
    mesh.quad(a, b, d, e);
    return 2;
  }
  // Folded: the middle line stays, the two halves turn back by `bend` along the face normal.
  const f = norm(face);
  const p = (sx, sy) => add(add(c, add(mul(side, sx * w * 0.5), mul(u, sy * h * 0.5))), mul(f, -Math.abs(sx) * bend * w * 0.5));
  const um = (u0 + u1) / 2;
  const v = [];
  for (const [sx, sy, uu, vv] of [[-1, -1, u0, v1], [0, -1, um, v1], [1, -1, u1, v1], [-1, 1, u0, v0], [0, 1, um, v0], [1, 1, u1, v0]]) {
    const q = p(sx, sy);
    v.push(mesh.vertex(q, n, [uu, vv], colour, wind(q)));
  }
  mesh.quad(v[0], v[1], v[4], v[3]);
  mesh.quad(v[1], v[2], v[5], v[4]);
  return 4;
}

/** Choose `n` of `list` spread evenly through it (deterministic). */
export function spread(list, n) {
  if (n >= list.length) return list;
  if (n <= 0) return [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor(((i + 0.5) * list.length) / n)]);
  return out;
}

export { Mesh };
