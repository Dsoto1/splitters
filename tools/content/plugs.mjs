// Plugs (`fixes.plugs`, prepare-meshy-characters.mjs on an unrigged download, before it is rigged): closed shapes
// added inside a body where the download's own surface is open, so its gaps show the body's colour, not the scene
// behind it. A Meshy low-poly download can model torn cloth as loose sheets with holes between them: Freaky Frida's
// shirt under her vest's armholes (108 and 68 open edges round her shoulders, see-through in the download itself);
// in the T-pose her arms covered the holes, and once they came down to hold a gun or run you saw through her
// shoulders: the "textures that are tearing" (owner, 2026-11-17).
//
// Each plug is `[x, y, z, r]` in shares of the download's height in its own pose (feet at 0, x and z from its origin:
// the `landmarks` frame): an ellipsoid fitted INSIDE the download's surface there: its points within `r` give the
// principal axes, and each radius is `shrink` (0.85 unless set) times the points' 70th percentile spread along it,
// so it stays under the cloth. It takes the colour of the download's point nearest its centre (one texture
// coordinate: the cloth over it), and is rigged with the rest by bone heat (autoskin.mjs), so it moves as the
// shoulder does.

const RINGS = 10;
const SEGMENTS = 16;

/** The plugs' geometry: { pos, nrm, uv, idx } (idx indexing the new vertices from 0), and a line per plug for the log. */
export function plugGeometry(pos, uv, plugs, shrink = 0.85) {
  const n = pos.length / 3;
  let lo = Infinity;
  let hi = -Infinity;
  for (let v = 0; v < n; v++) [lo, hi] = [Math.min(lo, pos[v * 3 + 1]), Math.max(hi, pos[v * 3 + 1])];
  const H = hi - lo;
  const out = { pos: [], nrm: [], uv: [], idx: [], log: [] };
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  for (const [cx, cy, cz, r] of plugs) {
    const c = [cx * H, lo + cy * H, cz * H];
    const near = [];
    for (let v = 0; v < n; v++) {
      const p = P(v);
      if (Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < r * H) near.push(v);
    }
    if (near.length < 12) {
      out.log.push(`plug at [${cx}, ${cy}, ${cz}]: only ${near.length} points within reach; left out`);
      continue;
    }
    // Principal axes of the points about the centre (Jacobi on the 3x3 covariance).
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const v of near) {
      const p = P(v);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i][j] += ((p[i] - c[i]) * (p[j] - c[j])) / near.length;
    }
    const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 30; sweep++) {
      for (let p = 0; p < 3; p++) {
        for (let q = p + 1; q < 3; q++) {
          if (Math.abs(A[p][q]) < 1e-14) continue;
          const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
          const [cs, sn] = [Math.cos(th), Math.sin(th)];
          for (let k = 0; k < 3; k++) [A[k][p], A[k][q]] = [cs * A[k][p] - sn * A[k][q], sn * A[k][p] + cs * A[k][q]];
          for (let k = 0; k < 3; k++) [A[p][k], A[q][k]] = [cs * A[p][k] - sn * A[q][k], sn * A[p][k] + cs * A[q][k]];
          for (let k = 0; k < 3; k++) [V[k][p], V[k][q]] = [cs * V[k][p] - sn * V[k][q], sn * V[k][p] + cs * V[k][q]];
        }
      }
    }
    const axes = [0, 1, 2].map((i) => [V[0][i], V[1][i], V[2][i]]);
    const radii = axes.map((a) => {
      const d = near.map((v) => {
        const p = P(v);
        return Math.abs((p[0] - c[0]) * a[0] + (p[1] - c[1]) * a[1] + (p[2] - c[2]) * a[2]);
      }).sort((x, y) => x - y);
      return shrink * d[Math.floor(d.length * 0.7)];
    });
    let best = near[0];
    let bd = Infinity;
    for (const v of near) {
      const p = P(v);
      const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
      if (d < bd) [bd, best] = [d, v];
    }
    const tex = uv ? [uv[best * 2], uv[best * 2 + 1]] : [0, 0];
    const base = out.pos.length;
    for (let i = 0; i <= RINGS; i++) {
      for (let j = 0; j < SEGMENTS; j++) {
        const th = (Math.PI * i) / RINGS;
        const ph = (2 * Math.PI * j) / SEGMENTS;
        const u = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        out.pos.push([0, 1, 2].map((k) => c[k] + axes[0][k] * u[0] * radii[0] + axes[1][k] * u[1] * radii[1] + axes[2][k] * u[2] * radii[2]));
        const nn = [0, 1, 2].map((k) => (axes[0][k] * u[0]) / radii[0] + (axes[1][k] * u[1]) / radii[1] + (axes[2][k] * u[2]) / radii[2]);
        const l = Math.hypot(...nn) || 1;
        out.nrm.push(nn.map((x) => x / l));
        out.uv.push(tex);
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SEGMENTS; j++) {
        const a = base + i * SEGMENTS + j;
        const b = base + i * SEGMENTS + ((j + 1) % SEGMENTS);
        const d = base + (i + 1) * SEGMENTS + j;
        const e = base + (i + 1) * SEGMENTS + ((j + 1) % SEGMENTS);
        // Facing out, as the normals do.
        for (const [x, y, z] of [[a, d, b], [b, d, e]]) {
          const [px, py, pz] = [out.pos[x], out.pos[y], out.pos[z]];
          const e1 = [py[0] - px[0], py[1] - px[1], py[2] - px[2]];
          const e2 = [pz[0] - px[0], pz[1] - px[1], pz[2] - px[2]];
          const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          const nx = out.nrm[x];
          if (f[0] * nx[0] + f[1] * nx[1] + f[2] * nx[2] < 0) out.idx.push(x, z, y);
          else out.idx.push(x, y, z);
        }
      }
    }
    out.log.push(`plug at [${cx}, ${cy}, ${cz}]: fitted to ${near.length} points, radii ${radii.map((x) => ((x / H) * 100).toFixed(1)).join(' / ')}% of the height`);
  }
  return out;
}

/** Add the plugs to a glTF-Transform primitive (float positions, indexed), in place. */
export function addPlugs(prim, plugs, shrink, log = () => {}) {
  const P = prim.getAttribute('POSITION');
  const UV = prim.getAttribute('TEXCOORD_0');
  const n = P.getCount();
  const pos = new Float32Array(n * 3);
  const el = [0, 0, 0];
  for (let v = 0; v < n; v++) pos.set(P.getElement(v, el), v * 3);
  let uv = null;
  if (UV) {
    uv = new Float32Array(n * 2);
    for (let v = 0; v < n; v++) uv.set(UV.getElement(v, [0, 0]), v * 2);
  }
  const g = plugGeometry(pos, uv, plugs, shrink);
  for (const line of g.log) log(line);
  if (!g.pos.length) return 0;
  const values = { POSITION: g.pos, NORMAL: g.nrm, TEXCOORD_0: g.uv };
  for (const sem of prim.listSemantics()) {
    const a = prim.getAttribute(sem);
    if (!values[sem]) {
      // Anything else (a colour, a second set of coordinates) the new vertices copy from the download's first.
      const first = a.getElement(0, []);
      values[sem] = g.pos.map(() => first);
    }
    const old = a.getArray();
    const grown = new old.constructor((n + g.pos.length) * a.getElementSize());
    grown.set(old);
    a.setArray(grown);
    values[sem].forEach((v, i) => a.setElement(n + i, v));
  }
  const I = prim.getIndices();
  const old = I.getArray();
  const idx = new Uint32Array(old.length + g.idx.length);
  idx.set(old);
  g.idx.forEach((x, i) => (idx[old.length + i] = n + x));
  I.setArray(idx);
  return g.idx.length / 3;
}
