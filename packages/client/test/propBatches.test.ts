import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/meshLODLevel';
import { PROP_SECTOR, PropBatches } from '../src/game/propBatches.ts';
import { buildShadowProxies, proxyable } from '../src/game/shadowProxy.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

/** A model's merged sources as ModelLibrary.staticSources gives them: parked, one per material. */
function sources(s: Scene, name: string, lod = false): Mesh[] {
  const a = CreateBox(`${name}_a`, { size: 1 }, s);
  a.material = new StandardMaterial(`${name}_ma`, s);
  const b = CreateBox(`${name}_b`, { width: 0.5, height: 2, depth: 0.5 }, s);
  b.material = new StandardMaterial(`${name}_mb`, s);
  for (const m of [a, b]) m.position.y = -10000;
  if (lod) {
    const low = CreateBox(`${name}_low`, { size: 1 }, s);
    low.material = a.material;
    low.position.y = -10000;
    a.addLODLevel(30, low);
    return [a];
  }
  return [a, b];
}

function placed(s: Scene, name: string, x: number, z: number, yaw = 0, scale = 1): TransformNode {
  const n = new TransformNode(name, s);
  n.position.set(x, 0, z);
  n.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), yaw);
  n.scaling.setAll(scale);
  return n;
}

const batchMeshes = (s: Scene) => s.meshes.filter((m) => m.name.startsWith('static_batch_') && !m.name.startsWith('static_batch_near')) as Mesh[];

describe('static prop batches', () => {
  it('draws the copies of a model in a square as thin instances: one mesh per material, at each copy\'s place, tint in the instance colour', async () => {
    const s = scene();
    const src = sources(s, 'crate');
    const batches = new PropBatches(s, async () => src, 15);
    const roots = [placed(s, 'p1', 5, 5), placed(s, 'p2', 20, 10, Math.PI / 2, 2), placed(s, 'p3', PROP_SECTOR + 5, 5)];
    const ok = await Promise.all([batches.add('crate', roots[0]!, false, null), batches.add('crate', roots[1]!, false, '#ff0000'), batches.add('crate', roots[2]!, false, null)]);
    expect(ok).toEqual([true, true, true]);
    batches.update(new Vector3(0, 2, 0));
    const meshes = batchMeshes(s);
    // Two squares, two materials each.
    expect(meshes.length).toBe(4);
    const near = meshes.filter((m) => m.name.endsWith('_0:0'));
    expect(near.map((m) => m.thinInstanceCount)).toEqual([2, 2]);
    // The second copy's matrix: turned, doubled, placed.
    const m = near[0]!.thinInstanceGetWorldMatrices()[1]!;
    const p = Vector3.TransformCoordinates(new Vector3(1, 0, 0), m);
    expect(p.x).toBeCloseTo(20, 4);
    expect(p.z).toBeCloseTo(10 - 2, 4);
    // Tinted: the instance colour carries it (white for the untinted copy).
    const colors = (near[0] as unknown as { _userThinInstanceBuffersStorage: { data: Record<string, Float32Array> } })._userThinInstanceBuffersStorage.data.instanceColor!;
    expect([...colors.slice(0, 8)]).toEqual([1, 1, 1, 1, 1, 0, 0, 1]);
    expect(batches.stats()).toEqual({ meshes: 4, copies: 3, models: 1 });
    // Static (no levels of detail): merged into the shadow proxies like the instances were.
    expect(near.every((x) => proxyable(x))).toBe(true);
    const { sources: merged } = buildShadowProxies(s, near);
    expect(merged.length).toBe(2);
  });

  it('copies pick their level of detail by distance; a model the library can\'t merge stays with the caller', async () => {
    const s = scene();
    const src = sources(s, 'tree', true);
    const batches = new PropBatches(s, async (path) => (path === 'tree' ? src : null), 15);
    const a = placed(s, 'near', 5, 0);
    const b = placed(s, 'far', 60, 0);
    expect(await batches.add('tree', a, false, null)).toBe(true);
    expect(await batches.add('tree', b, false, null)).toBe(true);
    expect(await batches.add('skinned', placed(s, 'x', 0, 0), false, null)).toBe(false);
    batches.update(new Vector3(0, 0, 0));
    const shown = batchMeshes(s).filter((m) => m.isEnabled());
    expect(shown.map((m) => [m.name.includes('_l0_') ? 0 : 1, m.thinInstanceCount]).sort()).toEqual([
      [0, 1],
      [1, 1],
    ]);
    // Walk up to the far one: both at full detail.
    batches.update(new Vector3(33, 0, 0));
    const full = batchMeshes(s).filter((m) => m.isEnabled());
    expect(full.length).toBe(1);
    expect(full[0]!.thinInstanceCount).toBe(2);
  });

  it('keeps the lifts the map applies after placing (a box flush on a crate, a hung chandelier) in the copy drawn', async () => {
    const s = scene();
    const src = sources(s, 'box');
    // The model is already loaded (the library's promise settled): the copy still joins only after the caller's loop.
    const batches = new PropBatches(s, () => Promise.resolve(src), 15);
    const root = placed(s, 'onCrate', 4, 6);
    const joined = batches.add('box', root, false, null);
    // GameView.buildMap lifts flush and hung props right after createPropNode, in the same loop.
    root.position.addInPlaceFromFloats(0.002, 0.004, -0.001);
    root.position.y += 0.5;
    expect(await joined).toBe(true);
    batches.update(new Vector3(0, 2, 0));
    const at = Vector3.TransformCoordinates(Vector3.Zero(), batchMeshes(s)[0]!.thinInstanceGetWorldMatrices()[0]!);
    expect(at.x).toBeCloseTo(4.002, 5);
    expect(at.y).toBeCloseTo(0.504, 5);
    expect(at.z).toBeCloseTo(5.999, 5);
  });

  it('small clutter casts only near the camera, through a shadow-only batch', async () => {
    const s = scene();
    const src = sources(s, 'grass');
    const batches = new PropBatches(s, async () => src, 15);
    await batches.add('grass', placed(s, 'g1', 3, 0), true, null);
    await batches.add('grass', placed(s, 'g2', 50, 0), true, null);
    batches.update(new Vector3(0, 0, 0));
    const drawn = batchMeshes(s);
    expect(drawn.every((m) => (m.metadata as { castsNoShadow?: boolean }).castsNoShadow)).toBe(true);
    const near = s.meshes.filter((m) => m.name.startsWith('static_batch_near')) as Mesh[];
    expect(near.length).toBe(2);
    expect(near.every((m) => m.layerMask === 0 && m.isEnabled() && m.thinInstanceCount === 1)).toBe(true);
    batches.update(new Vector3(200, 0, 0));
    expect(near.every((m) => !m.isEnabled())).toBe(true);
  });
});
