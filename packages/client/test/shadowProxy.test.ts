import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/instancedMesh';
import { PROXY_CELL, buildShadowProxies, proxyable, sortIntoCells } from '../src/game/shadowProxy.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

function box(s: Scene, name: string, at: Vector3, size = 2, material = new StandardMaterial(`${name}_mat`, s)): Mesh {
  const m = CreateBox(name, { size }, s);
  m.position.copyFrom(at);
  m.material = material;
  m.computeWorldMatrix(true);
  m.freezeWorldMatrix();
  return m;
}

describe('shadow proxies for the static level', () => {
  it('merges static meshes of many materials into one mesh per square, triangles kept in world space', () => {
    const s = scene();
    const meshes = [box(s, 'a', new Vector3(5, 1, 5)), box(s, 'b', new Vector3(10, 1, 10)), box(s, 'c', new Vector3(PROXY_CELL + 5, 1, 5))];
    const { cells, merged } = sortIntoCells(meshes);
    expect(merged).toBe(3);
    expect(cells.size).toBe(2);
    const tris = [...cells.values()].reduce((n, c) => n + c.indices.length / 3, 0);
    expect(tris).toBe(3 * 12);
    // The first square holds both near boxes, at their world places.
    const near = [...cells].find(([k]) => k.endsWith(':0:0'))![1];
    const xs = near.positions.filter((_, i) => i % 3 === 0);
    expect(Math.min(...xs)).toBeCloseTo(4);
    expect(Math.max(...xs)).toBeCloseTo(11);
  });

  it('leaves out what cannot stand in: moving, see-through, alpha-tested and instanced meshes', () => {
    const s = scene();
    const moving = CreateBox('moving', { size: 1 }, s);
    moving.material = new StandardMaterial('m1', s);
    const glass = box(s, 'glass', Vector3.Zero());
    (glass.material as StandardMaterial).alpha = 0.4;
    const plain = box(s, 'plain', Vector3.Zero());
    const shared = box(s, 'shared', Vector3.Zero());
    shared.createInstance('copy');
    expect(proxyable(moving)).toBe(false);
    expect(proxyable(glass)).toBe(false);
    expect(proxyable(shared)).toBe(false);
    expect(proxyable(plain)).toBe(true);
  });

  it('builds meshes no camera draws, one per square, and reports the meshes it stands in for', () => {
    const s = scene();
    const a = box(s, 'a', new Vector3(1, 1, 1));
    const b = box(s, 'b', new Vector3(PROXY_CELL * 2 + 1, 1, 1));
    const glass = box(s, 'glass', new Vector3(3, 1, 3));
    (glass.material as StandardMaterial).alpha = 0.3;
    const { proxies, sources } = buildShadowProxies(s, [a, b, glass]);
    expect(sources).toEqual([a, b]);
    expect(proxies.length).toBe(2);
    for (const p of proxies) {
      expect(p.layerMask).toBe(0);
      expect(p.getTotalIndices()).toBe(36);
    }
  });

  it('keeps faces facing the same way under a mirrored placement', () => {
    const s = scene();
    const at = new Vector3(5, 1, 5);
    const m = box(s, 'mirrored', at);
    m.unfreezeWorldMatrix();
    m.scaling.set(-1, 1, 1);
    m.computeWorldMatrix(true);
    m.freezeWorldMatrix();
    const { cells } = sortIntoCells([m]);
    const c = [...cells.values()][0]!;
    // Every triangle's winding against its outward normal agrees with an unmirrored box's.
    const p = (i: number) => new Vector3(c.positions[i * 3]!, c.positions[i * 3 + 1]!, c.positions[i * 3 + 2]!);
    let agree = 0;
    for (let t = 0; t < c.indices.length; t += 3) {
      const [i0, i1, i2] = [c.indices[t]!, c.indices[t + 1]!, c.indices[t + 2]!];
      const face = Vector3.Cross(p(i1).subtract(p(i0)), p(i2).subtract(p(i0)));
      const centre = p(i0).add(p(i1)).add(p(i2)).scale(1 / 3).subtract(at);
      agree += Math.sign(Vector3.Dot(face, centre));
    }
    const plain = sortIntoCells([box(s, 'plain', at)]);
    const q = [...plain.cells.values()][0]!;
    const pq = (i: number) => new Vector3(q.positions[i * 3]!, q.positions[i * 3 + 1]!, q.positions[i * 3 + 2]!);
    let agreePlain = 0;
    for (let t = 0; t < q.indices.length; t += 3) {
      const [i0, i1, i2] = [q.indices[t]!, q.indices[t + 1]!, q.indices[t + 2]!];
      const face = Vector3.Cross(pq(i1).subtract(pq(i0)), pq(i2).subtract(pq(i0)));
      const centre = pq(i0).add(pq(i1)).add(pq(i2)).scale(1 / 3).subtract(at);
      agreePlain += Math.sign(Vector3.Dot(face, centre));
    }
    expect(agree).toBe(agreePlain);
    expect(Math.abs(agree)).toBe(12);
  });
});
