// The low-detail copy a whole-body character is drawn with from afar (`<node>_lod` beside each mesh, on the same
// skin; the game hands it to Babylon as the mesh's LOD level past LOD_DISTANCE, see content/characters.ts).
// prepare-meshy-characters.mjs adds it at import; relod-built.mjs makes it again for a character already built.
//
// Why not meshopt's sloppy cut (what it was): a Meshy texture is cut into dozens to thousands of charts, and a
// sloppy cut joins triangles across them, so a far Saint Nick wore white streaks over his red coat (1,621 of his
// 3,187 far triangles spanned a seam). Here meshopt's careful cut runs with the texture coordinates weighed in and
// seams allowed to collapse only where the colour layout on both sides agrees ("permissive" with UV weights: 3
// triangles span a seam). A mesh that cut can't bring near its share (it stalls on a very fragmented layout) is cut
// on its shape alone, every copy of a seam vertex welded into one, and each kept corner takes back the copy in the
// chart its triangle's other corners share.

import { compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

/** The share of the body's triangles its low-detail copy keeps (`fixes.lod` in a manifest sets another). */
export const LOD_SHARE = 0.3;

/** How much a texture coordinate's change counts against a collapse (against the mesh's own size, 1). */
const UV_WEIGHT = 4;

/**
 * Indices for a low-detail copy of an indexed mesh: `idx` (triangles), `P` (positions, xyz per vertex), `UV` (texture
 * coordinates 0-1, two per vertex), cut to about `share` of the triangles. The result indexes the same vertices (no
 * new ones), so every attribute (UVs, normals, tangents, skin weights) carries over as it is.
 * Returns { idx, kept, spanning, how } (the last two for logs: triangles across a texture seam, which cut).
 */
export function lowDetailIndices(idx, P, UV, share = LOD_SHARE) {
  const target = Math.max(3, Math.floor((idx.length / 3) * share) * 3);
  const [permissive] = MeshoptSimplifier.simplifyWithAttributes(idx, P, 3, UV, 2, [UV_WEIGHT, UV_WEIGHT], null, target, 0.05, ['Permissive']);
  if (permissive.length <= target * 1.15) return { idx: permissive, kept: permissive.length / 3, spanning: spanningTriangles(idx, P.length / 3, permissive), how: 'careful' };
  return weldedCut(idx, P, target);
}

/** Union-find over the vertices joined by triangles: each vertex's chart (a piece of the texture layout). */
function chartsOf(idx, n) {
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  for (let i = 0; i < idx.length; i += 3) {
    const a = find(idx[i]);
    for (const v of [idx[i + 1], idx[i + 2]]) {
      const b = find(v);
      if (a !== b) parent[b] = a;
    }
  }
  const chartOf = new Int32Array(n);
  for (let v = 0; v < n; v++) chartOf[v] = find(v);
  return chartOf;
}

/** How many of `cut`'s triangles join vertices of different charts of `idx` (drawn smeared across a seam). */
function spanningTriangles(idx, n, cut) {
  const chartOf = chartsOf(idx, n);
  let s = 0;
  for (let t = 0; t < cut.length; t += 3) if (chartOf[cut[t]] !== chartOf[cut[t + 1]] || chartOf[cut[t + 1]] !== chartOf[cut[t + 2]]) s++;
  return s;
}

/** The cut on the shape alone (seams welded), each corner given back the copy in its triangle's shared chart. */
function weldedCut(idx, P, target) {
  const n = P.length / 3;
  // Weld every copy of a position into one (the texture seams).
  const weldOf = new Uint32Array(n);
  const keys = new Map();
  const firstOf = [];
  for (let v = 0; v < n; v++) {
    const key = `${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]}`;
    let w = keys.get(key);
    if (w === undefined) {
      w = firstOf.length;
      keys.set(key, w);
      firstOf.push(v);
    }
    weldOf[v] = w;
  }
  const wn = firstOf.length;
  const WP = new Float32Array(wn * 3);
  firstOf.forEach((v, w) => WP.set([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], w * 3));
  const welded = [];
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [weldOf[idx[i]], weldOf[idx[i + 1]], weldOf[idx[i + 2]]];
    if (a !== b && b !== c && a !== c) welded.push(a, b, c);
  }
  const size = MeshoptSimplifier.getScale(WP, 3);
  let cut = Uint32Array.from(welded);
  // Careful passes, looser each time; sloppy only for what they leave far over the target.
  for (const error of [0.004, 0.01, 0.025, 0.05]) {
    if (cut.length <= target * 1.05) break;
    [cut] = MeshoptSimplifier.simplify(cut, WP, 3, target, error * size, ['ErrorAbsolute']);
  }
  if (cut.length > target * 1.5) [cut] = MeshoptSimplifier.simplifySloppy(cut, WP, 3, null, target, 0.05);

  const chartOf = chartsOf(idx, n);
  // Each welded vertex's copies, by chart.
  const copies = Array.from({ length: wn }, () => new Map());
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i];
    copies[weldOf[v]].set(chartOf[v], v);
  }
  // A chart's size (triangles), to break ties toward the bigger piece.
  const chartTris = new Map();
  for (let i = 0; i < idx.length; i += 3) chartTris.set(chartOf[idx[i]], (chartTris.get(chartOf[idx[i]]) ?? 0) + 1);

  const out = new Uint32Array(cut.length);
  let spanning = 0;
  for (let t = 0; t < cut.length; t += 3) {
    const corners = [cut[t], cut[t + 1], cut[t + 2]];
    // The chart most corners have a copy in (then the bigger chart).
    const votes = new Map();
    for (const w of corners) for (const ch of copies[w].keys()) votes.set(ch, (votes.get(ch) ?? 0) + 1);
    let best = -1;
    let bestVotes = 0;
    for (const [ch, k] of votes) if (k > bestVotes || (k === bestVotes && (chartTris.get(ch) ?? 0) > (chartTris.get(best) ?? 0))) [best, bestVotes] = [ch, k];
    if (bestVotes < 3) spanning++;
    corners.forEach((w, k) => {
      const own = copies[w].get(best);
      // No copy there: the corner's biggest chart (its colour is the one round it).
      out[t + k] = own ?? [...copies[w].entries()].sort((a, b) => (chartTris.get(b[0]) ?? 0) - (chartTris.get(a[0]) ?? 0))[0]?.[1] ?? firstOf[w];
    });
  }
  return { idx: out, kept: out.length / 3, spanning, how: 'welded' };
}

/**
 * A low-detail copy of every mesh in a character's document, as `<node>_lod` on the same skin and material, cut to
 * `share` (LOD_SHARE when unset) of its triangles. Returns the copies' triangles.
 */
export function addLowDetail(doc, share = LOD_SHARE, log = () => {}) {
  const scene = doc.getRoot().listScenes()[0];
  let total = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || /_lod$/.test(node.getName())) continue;
    const low = doc.createMesh(`${mesh.getName()}_lod`);
    for (const prim of mesh.listPrimitives()) {
      const p = doc.createPrimitive().setMode(prim.getMode()).setMaterial(prim.getMaterial());
      for (const sem of prim.listSemantics()) p.setAttribute(sem, prim.getAttribute(sem).clone());
      const cut = lowDetailIndices(new Uint32Array(prim.getIndices().getArray()), new Float32Array(prim.getAttribute('POSITION').getArray()), unitUVs(prim.getAttribute('TEXCOORD_0')), share);
      log(`low detail: ${cut.kept} triangles (share ${share}, ${cut.how} cut), ${cut.spanning} across a texture seam`);
      p.setIndices(prim.getIndices().clone().setArray(cut.idx));
      compactPrimitive(p);
      low.addPrimitive(p);
      total += cut.kept;
    }
    (node.getParentNode() ?? scene).addChild(doc.createNode(`${node.getName()}_lod`).setMesh(low).setSkin(node.getSkin()));
  }
  return total;
}

/** A texture coordinate accessor's values as 0-1 floats (a quantized file stores them as normalized integers). */
function unitUVs(accessor) {
  const a = accessor.getArray();
  if (!accessor.getNormalized()) return Float32Array.from(a);
  const max = { 5121: 255, 5123: 65535, 5120: 127, 5122: 32767 }[accessor.getComponentType()] ?? 1;
  return Float32Array.from(a, (x) => x / max);
}
