import { describe, expect, it } from 'vitest';
import { Geo, HeadMap, fitModel, ringHeight, v3, type P3 } from '../src/content/headFit.ts';

/** Points on a sphere (an ellipsoid with `sy`, `sz`) round `c`. */
function ball(c: P3, r: number, sy = 1, sz = 1, n = 40): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++)
    for (let j = 0; j < n * 2; j++) {
      const phi = -Math.PI / 2 + (Math.PI * i) / n;
      const th = (Math.PI * j) / n;
      out.push(c[0] + Math.sin(th) * Math.cos(phi) * r, c[1] + Math.sin(phi) * r * sy, c[2] + Math.cos(th) * Math.cos(phi) * r * sz);
    }
  return out;
}

describe('head fitting', () => {
  const c: P3 = [0, 1.7, 0];
  const head = new HeadMap(c, ball(c, 0.09));

  it('measures how far the head reaches in every direction', () => {
    for (const [th, phi] of [
      [0, 0],
      [1, 0.4],
      [-2, 1.2],
      [3, -0.6],
    ] as const)
      expect(head.at(th, phi)).toBeCloseTo(0.09, 3);
    // Up the side of the head, the height a hat edge asks for.
    const phi = head.phiAt(Math.PI / 2, 1.75, 0.004);
    expect(head.point(Math.PI / 2, phi, 0.004)[1]).toBeCloseTo(1.75, 4);
  });

  it('pushes a point inside the head out past its surface', () => {
    const p = head.clear([0.02, 1.72, 0.03], 0.005);
    expect(v3.len(v3.sub(p, c))).toBeCloseTo(0.095, 3);
    const far: P3 = [0, 1.7, 0.2];
    expect(head.clear(far, 0.005)).toEqual(far);
  });

  it('keeps hair over the skin close to it, and lays cloth over the dips', () => {
    const hair = new HeadMap(c, ball(c, 0.15));
    expect(hair.over(head, 0.012).at(0.5, 0.5)).toBeCloseTo(0.102, 3);
    // A dent in a head: cloth lies across it.
    const dented = new HeadMap(c, ball(c, 0.09).map((v, i) => (i % 3 === 1 && v > 1.785 ? 1.76 : v)));
    expect(dented.draped(2).at(0, Math.PI / 2)).toBeGreaterThan(dented.at(0, Math.PI / 2));
  });

  it('turns faces outwards', () => {
    const g = new Geo();
    const rows = [0.2, 0.6, 1.0].map((phi) => Array.from({ length: 16 }, (_, i) => head.point((i / 16) * Math.PI * 2, phi, 0.005)));
    g.slab(rows, true, 0.003, { from: c });
    const p = g.positions;
    const P = (i: number): P3 => [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!];
    let out = 0;
    let inward = 0;
    for (let t = 0; t < g.indices.length; t += 3) {
      const [a, b, d] = [P(g.indices[t]!), P(g.indices[t + 1]!), P(g.indices[t + 2]!)];
      // Babylon's face normal: (p1 - p2) x (p3 - p2).
      const n = v3.cross(v3.sub(a, b), v3.sub(d, b));
      const mid = v3.scale(v3.add(v3.add(a, b), d), 1 / 3);
      if (v3.dot(n, v3.sub(mid, c)) > 0) out++;
      else inward++;
    }
    // The outer face and the edges outwards, the inner face (and the edge strips' inner halves) towards the head.
    expect(out).toBeGreaterThan(inward);
    expect(inward).toBeGreaterThan(0);
  });

  it('heights round the head go from front to sides to back', () => {
    const h = ringHeight(1.75, 1.76, 1.7);
    expect(h(0)).toBeCloseTo(1.75);
    expect(h(Math.PI / 2)).toBeCloseTo(1.76);
    expect(h(-Math.PI / 2)).toBeCloseTo(1.76);
    expect(h(Math.PI)).toBeCloseTo(1.7);
  });

  it('seats a helmet clear of the head, its rim down at the brows', () => {
    // A dome shell in its own units (origin at its rim's middle), outer radius 1, 0.1 thick.
    const shell: number[] = [];
    for (const r of [1, 0.9]) for (let i = 0; i <= 12; i++) for (let j = 0; j < 32; j++) {
      const phi = (Math.PI / 2) * (i / 12);
      const th = (Math.PI * 2 * j) / 32;
      shell.push(Math.sin(th) * Math.cos(phi) * r, Math.sin(phi) * r, Math.cos(th) * Math.cos(phi) * r);
    }
    const rimY = 1.73;
    const seat = fitModel(shell, head, rimY, 1.7);
    // Not grossly oversized: about the head's size.
    expect(seat.k).toBeGreaterThan(0.08);
    expect(seat.k).toBeLessThan(0.14);
    // Every inner point above the rim is outside the head.
    for (let i = shell.length / 2; i < shell.length; i += 3) {
      if (shell[i + 1]! < 0.15) continue;
      const w: P3 = [seat.at[0] + shell[i]! * seat.k, seat.at[1] + shell[i + 1]! * seat.k * seat.sy, seat.at[2] + shell[i + 2]! * seat.k];
      expect(v3.len(v3.sub(w, c))).toBeGreaterThan(0.09);
    }
    // The front rim near the brows.
    expect(Math.abs(seat.at[1] - rimY)).toBeLessThan(0.03);
  });
});
