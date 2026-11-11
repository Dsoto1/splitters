import { describe, expect, it } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MOUNT_DEFS } from '@tiletrigger/shared';
import { partitionByBox, type ModelBox } from '../src/game/cockpitInterior.ts';
import { buildCockpit, needleAngle, rounded, triangleCount, type Geometry } from '../src/game/cockpitGeometry.ts';
import { COCKPITS, type V3 } from '../src/content/cockpits.ts';

describe('cockpit interior', () => {
  // Three triangles: one inside the box, one outside, one straddling its face.
  const positions = [0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 5, 5, 5, 6, 5, 5, 5, 6, 5, 0.5, 0.5, 0.5, 3, 0.5, 0.5, 0.5, 0.6, 0.5];
  const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const box: ModelBox = [
    [-1, -1, -1],
    [1, 1, 1],
  ];

  it('puts the triangles wholly inside the box last and keeps every triangle', () => {
    const { indices: out, outside } = partitionByBox(indices, positions, box, (p) => p);
    expect(outside).toBe(6);
    expect([...out.slice(outside)]).toEqual([0, 1, 2]);
    expect([...out].sort()).toEqual([...indices].sort());
  });

  it('tests corners in the box frame', () => {
    // Shifted 5 m: now the far triangle is the one inside.
    const { indices: out, outside } = partitionByBox(indices, positions, box, (p) => p.subtract(new Vector3(5.2, 5.2, 5)));
    expect([...out.slice(outside)]).toEqual([3, 4, 5]);
  });

  it('hides a triangle wholly inside any one of several boxes, not one split between two', () => {
    const boxes: ModelBox[] = [
      [
        [-1, -1, -1],
        [1, 1, 1],
      ],
      [
        [4, 4, 4],
        [7, 7, 7],
      ],
    ];
    const { indices: out, outside } = partitionByBox(indices, positions, boxes, (p) => p);
    expect([...out.slice(outside)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    // Corners in two different boxes: stays.
    const split = partitionByBox([0, 1, 3], positions, boxes, (p) => p);
    expect(split.outside).toBe(3);
  });
});

describe('in-house cockpits', () => {
  const buggy = COCKPITS.buggy!;
  const built = buildCockpit(buggy);

  it('the buggy has one, every other mount id it names exists', () => {
    for (const id of Object.keys(COCKPITS)) expect(MOUNT_DEFS[id as keyof typeof MOUNT_DEFS]).toBeTruthy();
    expect(built.wheel).not.toBeNull();
    expect(built.needles.map((n) => n.drive).sort()).toEqual(['revs', 'speed']);
  });

  it('every cockpit names a colour for each part: none falls back to the missing-colour magenta', () => {
    for (const [id, def] of Object.entries(COCKPITS)) {
      const b = buildCockpit(def);
      const groups = [...Object.values(b.groups), ...Object.values(b.wheel?.groups ?? {}), ...b.needles.flatMap((n) => Object.values(n.groups))];
      let magenta = 0;
      for (const g of groups) for (let i = 0; i < g.colors.length; i += 4) if (g.colors[i] === 1 && g.colors[i + 1] === 0 && g.colors[i + 2] === 1) magenta++;
      expect(magenta, id).toBe(0);
    }
  });

  it('stays within its triangle budget', () => {
    const all = triangleCount(built.groups) + triangleCount(built.wheel!.groups) + built.needles.reduce((n, x) => n + triangleCount(x.groups), 0);
    expect(all).toBeGreaterThan(5000);
    expect(all).toBeLessThan(24000);
  });

  it('builds whole triangles, unit normals and colours for every vertex', () => {
    const check = (g: Geometry): void => {
      const n = g.positions.length / 3;
      expect(g.normals.length).toBe(n * 3);
      expect(g.uvs.length).toBe(n * 2);
      expect(g.colors.length).toBe(n * 4);
      expect(g.indices.length % 3).toBe(0);
      expect(Math.max(...g.indices)).toBeLessThan(n);
      for (let i = 0; i < g.normals.length; i += 3) expect(Math.hypot(g.normals[i]!, g.normals[i + 1]!, g.normals[i + 2]!)).toBeCloseTo(1, 3);
      for (const v of g.positions) expect(Number.isFinite(v)).toBe(true);
    };
    for (const g of Object.values(built.groups)) check(g);
    for (const g of Object.values(built.wheel!.groups)) check(g);
  });

  it('winds triangles the engine way round: clockwise seen from the side their normals face', () => {
    // Babylon's own box: cross(b - a, c - a) points into the box, against the vertex normals.
    let agree = 0;
    let total = 0;
    for (const g of Object.values(built.groups)) {
      for (let i = 0; i < g.indices.length; i += 3) {
        const [a, b, c] = [g.indices[i]!, g.indices[i + 1]!, g.indices[i + 2]!];
        const p = (k: number): V3 => [g.positions[k * 3]!, g.positions[k * 3 + 1]!, g.positions[k * 3 + 2]!];
        const [pa, pb, pc] = [p(a), p(b), p(c)];
        const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
        const e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
        const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
        const len = Math.hypot(cr[0]!, cr[1]!, cr[2]!);
        if (len < 1e-10) continue;
        const nx = g.normals[a * 3]! + g.normals[b * 3]! + g.normals[c * 3]!;
        const ny = g.normals[a * 3 + 1]! + g.normals[b * 3 + 1]! + g.normals[c * 3 + 1]!;
        const nz = g.normals[a * 3 + 2]! + g.normals[b * 3 + 2]! + g.normals[c * 3 + 2]!;
        total++;
        if (cr[0]! * nx + cr[1]! * ny + cr[2]! * nz < 0) agree++;
      }
    }
    expect(agree / total).toBeGreaterThan(0.99);
  });

  it('keeps the driver view clear: no part between the eye and the road ahead over the dash', () => {
    const eye = MOUNT_DEFS.buggy.cockpitEye!;
    // Straight ahead and 12° down (over the hood): no vertex of the cockpit within 5 cm of either line of sight
    // between 0.15 and 1.2 m out.
    for (const down of [0, 0.21]) {
      const dir: V3 = [0, -Math.sin(down), Math.cos(down)];
      for (const g of [...Object.values(built.groups)]) {
        for (let i = 0; i < g.positions.length; i += 3) {
          const rel: V3 = [g.positions[i]! - eye[0], g.positions[i + 1]! - eye[1], g.positions[i + 2]! - eye[2]];
          const t = rel[0] * dir[0] + rel[1] * dir[1] + rel[2] * dir[2];
          if (t < 0.15 || t > 1.2) continue;
          const off = Math.hypot(rel[0] - dir[0] * t, rel[1] - dir[1] * t, rel[2] - dir[2] * t);
          expect(off).toBeGreaterThan(0.05);
        }
      }
    }
  });

  it('rounds corners and keeps the ends', () => {
    const path: V3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ];
    const r = rounded(path, 0.2);
    expect(r[0]).toEqual([0, 0, 0]);
    expect(r[r.length - 1]).toEqual([1, 1, 0]);
    // The corner itself is cut off.
    expect(r.some((p) => Math.hypot(p[0] - 1, p[1]) < 0.02)).toBe(false);
  });

  it('needles sweep clockwise from bottom left to bottom right', () => {
    expect(needleAngle(0)).toBeCloseTo((-3 * Math.PI) / 4);
    expect(needleAngle(0.5)).toBeCloseTo(0);
    expect(needleAngle(2)).toBeCloseTo((3 * Math.PI) / 4);
  });
});
