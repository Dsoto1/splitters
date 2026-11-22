// Coplanar layers in a kit prop (z-fighting): two triangles of different colours facing the same way in the same
// plane (within `eps`), overlapping by more than a sliver. The depth test can't tell which is in front, so they
// shimmer as the camera moves (the owner's St. John's wall crest, 2026-11-22: its gold border lay on the board's face).
// A layer drawn over another must stand off it (a few millimetres at the prop's smallest placed scale).

const EPS_AREA = 1e-6;

/** Twice the signed area of a 2D triangle. */
const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Whether two 2D triangles overlap by more than `tol` (separating axes over both triangles' edges, shrunk by `tol`). */
function overlap2(A, B, tol) {
  for (const T of [A, B]) {
    for (let i = 0; i < 3; i++) {
      const p = T[i];
      const q = T[(i + 1) % 3];
      const n = [q[1] - p[1], p[0] - q[0]];
      const l = Math.hypot(n[0], n[1]);
      if (l < 1e-12) return false;
      const proj = (v) => (v[0] * n[0] + v[1] * n[1]) / l;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const v of A) {
        const s = proj(v);
        a0 = Math.min(a0, s);
        a1 = Math.max(a1, s);
      }
      for (const v of B) {
        const s = proj(v);
        b0 = Math.min(b0, s);
        b1 = Math.max(b1, s);
      }
      if (Math.min(a1, b1) - Math.max(a0, b0) <= tol) return false;
    }
  }
  return true;
}

/**
 * The coplanar overlapping pairs of differently coloured triangles in a mesh ({ P, I, C }), at most `limit` of them:
 * [{ a, b, normal, offset }] (triangle indices, the shared plane).
 * `eps`: how close two planes count as one (metres); `tol`: how far two triangles must overlap to count (metres).
 */
export function coplanarLayers(mesh, { eps = 0.0005, tol = 0.002, limit = 5 } = {}) {
  const { P, I, C } = mesh;
  const tris = [];
  for (let t = 0; t < I.length; t += 3) {
    const v = [I[t], I[t + 1], I[t + 2]].map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const e1 = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
    const e2 = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < EPS_AREA) continue;
    const u = [n[0] / l, n[1] / l, n[2] / l];
    const c = I[t] * 3;
    const colour = `${C[c].toFixed(3)},${C[c + 1].toFixed(3)},${C[c + 2].toFixed(3)}`;
    tris.push({ t: t / 3, v, n: u, d: u[0] * v[0][0] + u[1] * v[0][1] + u[2] * v[0][2], colour });
  }
  // Bucket by direction (rounded normal) so only like-facing triangles are compared.
  const buckets = new Map();
  for (const tr of tris) {
    const key = tr.n.map((x) => Math.round(x * 50)).join(',');
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = []));
    b.push(tr);
  }
  const found = [];
  for (const b of buckets.values()) {
    b.sort((x, y) => x.d - y.d);
    for (let i = 0; i < b.length; i++) {
      const A = b[i];
      // The plane's two longest axes to draw it in 2D.
      const ax = A.n.map(Math.abs);
      const drop = ax[0] >= ax[1] && ax[0] >= ax[2] ? 0 : ax[1] >= ax[2] ? 1 : 2;
      const [x, y] = [0, 1, 2].filter((k) => k !== drop);
      const a2 = A.v.map((p) => [p[x], p[y]]);
      for (let j = i + 1; j < b.length && b[j].d - A.d <= eps; j++) {
        const B = b[j];
        if (B.colour === A.colour) continue;
        if (A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2] < 0.9995) continue;
        const b2 = B.v.map((p) => [p[x], p[y]]);
        if (Math.abs(area2(...a2)) < EPS_AREA || Math.abs(area2(...b2)) < EPS_AREA) continue;
        if (!overlap2(a2, b2, tol)) continue;
        found.push({ a: A.t, b: B.t, normal: A.n.map((q) => +q.toFixed(3)), offset: +A.d.toFixed(4) });
        if (found.length >= limit) return found;
      }
    }
  }
  return found;
}
