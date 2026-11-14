import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { mergeRigidParts } from '../src/game/scenarioVisuals.ts';
import { mergePathMeshes, PATH_MERGE_SQUARE } from '../src/pathMeshes.ts';
import { coversSun, sunInView } from '../src/game/skyEffects.ts';
import { sectorSize } from '../src/environment/environmentVisuals.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

/** World-space corners of every mesh under `root` (sorted), to compare a look before and after merging. */
function corners(meshes: readonly Mesh[]): string[] {
  const out: string[] = [];
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    const pos = m.getVerticesData('position')!;
    for (let i = 0; i < pos.length; i += 3) {
      const p = Vector3.TransformCoordinates(new Vector3(pos[i], pos[i + 1], pos[i + 2]), m.getWorldMatrix());
      out.push(`${m.material?.name}:${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`);
    }
  }
  return out.sort();
}

describe('draw merges', () => {
  it("merges a door's parts that move together and share a material, under their node, where they were", () => {
    const s = scene();
    const oak = new StandardMaterial('oak', s);
    const iron = new StandardMaterial('iron', s);
    const root = new TransformNode('door', s);
    root.position.set(10, 0, -4);
    root.rotation.y = 0.7;
    const hinge = new TransformNode('hinge', s);
    hinge.parent = root;
    hinge.position.set(1, 0, 0);
    const box = (name: string, parent: TransformNode, x: number, mat: StandardMaterial) => {
      const b = CreateBox(name, { width: 0.3, height: 2, depth: 0.1 }, s);
      b.parent = parent;
      b.position.set(x, 1, 0);
      b.material = mat;
      return b;
    };
    for (let k = 0; k < 4; k++) box(`plank${k}`, hinge, -0.2 - k * 0.3, oak);
    box('strap', hinge, -0.5, iron);
    box('post0', root, -1, oak);
    box('post1', root, 1, oak);
    const before = corners(root.getChildMeshes(false) as Mesh[]);
    mergeRigidParts(root);
    const after = root.getChildMeshes(false) as Mesh[];
    // Planks (hinge, oak) one mesh, the strap alone, the posts (frame, oak) one mesh.
    expect(after.length).toBe(3);
    expect(after.filter((m) => m.parent === hinge).length).toBe(2);
    expect(corners(after)).toEqual(before);
    // Swinging the hinge still swings the planks.
    hinge.rotation.y = 1;
    const planks = after.find((m) => m.parent === hinge && m.material === oak)!;
    planks.computeWorldMatrix(true);
    expect(planks.getWorldMatrix().equalsWithEpsilon(hinge.computeWorldMatrix(true), 1e-6)).toBe(true);
  });

  it('merges path ribbons by material and square, and keeps each square apart', () => {
    const s = scene();
    const cobble = new StandardMaterial('cobble', s);
    const paint = new StandardMaterial('paint', s);
    const strip = (name: string, x: number, mat: StandardMaterial) => {
      const b = CreateBox(name, { width: 4, height: 0.05, depth: 20 }, s);
      b.position.set(x, 0, 0);
      b.material = mat;
      b.freezeWorldMatrix();
      return b;
    };
    const list = [strip('a', 10, cobble), strip('b', 30, cobble), strip('c', 20, paint), strip('d', PATH_MERGE_SQUARE + 10, cobble)];
    const before = corners(list);
    const out = mergePathMeshes(list);
    expect(out.length).toBe(3);
    expect(corners(out)).toEqual(before);
  });

  it('counts the sun in view only within the corner of the view and a margin', () => {
    const s = scene();
    const cam = new FreeCamera('c', new Vector3(0, 0, 0), s);
    cam.fov = 1.35;
    cam.setTarget(new Vector3(0, 0, 10));
    expect(sunInView(cam, new Vector3(0, 0, 1))).toBe(true);
    expect(sunInView(cam, new Vector3(0, 0, -1))).toBe(false);
    expect(sunInView(cam, new Vector3(0, 1, 0))).toBe(false);
    expect(sunInView(cam, new Vector3(0, Math.sin(0.5), Math.cos(0.5)))).toBe(true);
  });

  it('batches far environment copies by wider squares', () => {
    expect([0, 1, 2, 3, 4].map((l) => sectorSize(64, l))).toEqual([64, 128, 256, 512, 512]);
  });
  it('lets only what reaches the cone toward the sun hide its disc', () => {
    const s = scene();
    const eye = new Vector3(0, 2, 0);
    const toSun = new Vector3(0, 1, 1).normalize();
    const at = (x: number, y: number, z: number, size: number) => {
      const b = CreateBox('b', { size }, s);
      b.position.set(x, y, z);
      b.computeWorldMatrix(true);
      return b;
    };
    // In the way (a tower 20 m along the sun's line), beside it, behind the camera, and around the camera.
    expect(coversSun(at(0, 2 + 20 * toSun.y, 20 * toSun.z, 4), eye, toSun)).toBe(true);
    expect(coversSun(at(30, 2 + 20 * toSun.y, 20 * toSun.z, 4), eye, toSun)).toBe(false);
    expect(coversSun(at(0, 2, -30, 4), eye, toSun)).toBe(false);
    expect(coversSun(at(0, 2, 0, 400), eye, toSun)).toBe(true);
  });
});
