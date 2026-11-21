import { describe, expect, it } from 'vitest';
import { plugGeometry } from '../plugs.mjs';

// A body 2 m tall (two points mark its feet and top) and a cloud of points on an ellipsoid round (0.2, 1.5, 0) with
// radii 0.08 / 0.05 / 0.04 along x / y / z: an open shoulder the plug must fit inside.
function body() {
  const pts = [[0, 0, 0], [0, 2, 0]];
  for (let i = 1; i < 12; i++) {
    for (let j = 0; j < 16; j++) {
      const th = (Math.PI * i) / 12;
      const ph = (2 * Math.PI * j) / 16;
      pts.push([0.2 + 0.08 * Math.sin(th) * Math.cos(ph), 1.5 + 0.05 * Math.cos(th), 0.04 * Math.sin(th) * Math.sin(ph)]);
    }
  }
  const pos = new Float32Array(pts.flat());
  const uv = new Float32Array(pts.flatMap((_, v) => [v / pts.length, 0.5]));
  return { pos, uv };
}

describe('plugs (fixes.plugs)', () => {
  it('fits a closed ellipsoid inside the surface round each centre, facing out', () => {
    const { pos, uv } = body();
    const g = plugGeometry(pos, uv, [[0.1, 0.75, 0, 0.06]], 0.85);
    expect(g.pos.length).toBe(11 * 16);
    expect(g.idx.length).toBe(10 * 16 * 2 * 3);
    // Inside the cloud: every plug point within the cloud's ellipsoid.
    for (const [x, y, z] of g.pos) {
      expect(((x - 0.2) / 0.08) ** 2 + ((y - 1.5) / 0.05) ** 2 + (z / 0.04) ** 2).toBeLessThan(1);
    }
    // Its longest axis along x, as the cloud's is.
    const xs = g.pos.map((p) => p[0]);
    const ys = g.pos.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
    // Facing out: each triangle's normal points away from the centre.
    for (let i = 0; i < g.idx.length; i += 3) {
      const [a, b, c] = [g.pos[g.idx[i]], g.pos[g.idx[i + 1]], g.pos[g.idx[i + 2]]];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (Math.hypot(...f) < 1e-12) continue;
      const m = [(a[0] + b[0] + c[0]) / 3 - 0.2, (a[1] + b[1] + c[1]) / 3 - 1.5, (a[2] + b[2] + c[2]) / 3];
      expect(f[0] * m[0] + f[1] * m[1] + f[2] * m[2]).toBeGreaterThan(0);
    }
    // One texture coordinate: the cloud's point nearest the centre.
    expect(new Set(g.uv.map((t) => t.join())).size).toBe(1);
  });

  it('leaves a plug out where too few points are within reach', () => {
    const { pos, uv } = body();
    const g = plugGeometry(pos, uv, [[0.5, 0.2, 0, 0.02]]);
    expect(g.pos.length).toBe(0);
    expect(g.log[0]).toMatch(/left out/);
  });
});
