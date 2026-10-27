import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { Bone } from '@babylonjs/core/Bones/bone';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { mergeSkinnedParts, skinGear } from '../src/content/mergeParts.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

/** A two-joint rig (hips, head) under a mirrored anchor, as glTF imports come in, with skinned parts bound to the hips. */
function rig(mirror = true) {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const anchor = new TransformNode('anchor', scene);
  if (mirror) anchor.scaling.set(1, 1, -1);
  const hipsNode = new TransformNode('hips', scene);
  hipsNode.parent = anchor;
  hipsNode.position.set(0, 1, 0);
  const headNode = new TransformNode('Head', scene);
  headNode.parent = hipsNode;
  headNode.position.set(0, 0.6, 0);
  const skeleton = new Skeleton('s', 's', scene);
  const hips = new Bone('hips', skeleton, null, Matrix.Translation(0, 1, 0));
  const head = new Bone('Head', skeleton, hips, Matrix.Translation(0, 0.6, 0));
  hips.linkTransformNode(hipsNode);
  head.linkTransformNode(headNode);
  const part = (name: string, mat: PBRMaterial, size = 0.3) => {
    const m = CreateBox(name, { size }, scene);
    const n = m.getTotalVertices();
    m.setVerticesData(VertexBuffer.MatricesIndicesKind, new Float32Array(n * 4));
    m.setVerticesData(VertexBuffer.MatricesWeightsKind, new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)));
    m.skeleton = skeleton;
    m.parent = anchor;
    m.material = mat;
    return m;
  };
  const cloth = (name: string, hex = '#556b2f') => {
    const m = new PBRMaterial(name, scene);
    m.albedoColor = Color3.FromHexString(hex);
    return m;
  };
  return { scene, anchor, hipsNode, headNode, skeleton, part, cloth };
}

describe('mergeSkinnedParts', () => {
  it('merges parts with identical materials into one mesh, low-detail copies included, and keeps others apart', () => {
    const { part, cloth } = rig();
    const torso = part('torso', cloth('MI_Ranger'));
    const legs = part('legs', cloth('MI_Ranger'));
    const skin = part('skin', cloth('MI_Skin', '#c08060'));
    const lowT = part('torso_lod', torso.material as PBRMaterial, 0.2);
    const lowL = part('legs_lod', legs.material as PBRMaterial, 0.2);
    torso.addLODLevel(18, lowT);
    legs.addLODLevel(18, lowL);
    const verts = torso.getTotalVertices() + legs.getTotalVertices();
    const lowVerts = lowT.getTotalVertices() + lowL.getTotalVertices();
    const out = mergeSkinnedParts([torso, legs, lowT, skin, lowL], 'char');
    // The merged mesh, its low-detail copy, and the skin part.
    expect(out).toHaveLength(3);
    expect(out).toContain(skin);
    const merged = out[0] as Mesh;
    expect(out[1]).toBe(merged.getLODLevels()[0]!.mesh);
    expect(merged.getTotalVertices()).toBe(verts);
    expect(merged.skeleton).toBe(skin.skeleton);
    expect(merged.material?.name).toBe('MI_Ranger');
    const lods = merged.getLODLevels();
    expect(lods).toHaveLength(1);
    expect(lods[0]!.distanceOrScreenCoverage).toBe(18);
    expect(lods[0]!.mesh!.getTotalVertices()).toBe(lowVerts);
    for (const m of [torso, legs, lowT, lowL]) expect(m.isDisposed()).toBe(true);
    expect(skin.isDisposed()).toBe(false);
  });

  it('merges parts whose vertex attributes differ (missing colours come in white)', () => {
    const { part, cloth } = rig();
    const a = part('a', cloth('MI_Hair_2'));
    const b = part('b', cloth('MI_Hair_2'));
    b.setVerticesData(VertexBuffer.ColorKind, new Float32Array(b.getTotalVertices() * 4).fill(0.5), false, 4);
    b.setVerticesData(VertexBuffer.UV2Kind, new Float32Array(b.getTotalVertices() * 2));
    const out = mergeSkinnedParts([a, b], 'hair');
    expect(out).toHaveLength(1);
    const colors = out[0]!.getVerticesData(VertexBuffer.ColorKind)!;
    expect(colors[0]).toBe(1);
    expect(colors[colors.length - 1]).toBe(0.5);
    expect(out[0]!.isVerticesDataPresent(VertexBuffer.UV2Kind)).toBe(false);
  });

  it('leaves rigid meshes and lone parts as they are', () => {
    const { part, cloth, scene } = rig();
    const body = part('body', cloth('MI_Ranger'));
    const hat = CreateBox('hat', { size: 0.2 }, scene);
    const out = mergeSkinnedParts([body, hat], 'char');
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(body);
    expect(out[1]).toBe(hat);
  });
});

describe('skinGear', () => {
  for (const mirror of [true, false]) {
    it(`gear skinned onto the head joint follows it exactly as when it hung there${mirror ? ' (mirrored import)' : ''}`, () => {
      const { scene, headNode, hipsNode, part, cloth } = rig(mirror);
      const body = part('body', cloth('MI_Ranger'));
      const material = (hex: string) => {
        const m = new PBRMaterial(`gear_${hex}`, scene);
        m.albedoColor = Color3.FromHexString(hex);
        // Cloth and metal: different finishes still share the one gear mesh.
        m.roughness = hex === '#ff0000' ? 0.9 : 0.35;
        m.metallic = hex === '#ff0000' ? 0 : 0.7;
        return m;
      };
      const hang = (m: Mesh, at: Vector3, hex: string) => {
        m.parent = headNode;
        m.position.copyFrom(at);
        m.rotationQuaternion = Quaternion.RotationAxis(Vector3.Right(), 0.3);
        m.material = material(hex);
        return m;
      };
      const cap = hang(CreateSphere('cap', { diameter: 0.3, segments: 4 }, scene), new Vector3(0, 0.15, 0), '#ff0000');
      const brim = hang(CreateBox('brim', { width: 0.3, height: 0.02, depth: 0.15 }, scene), new Vector3(0, 0.1, 0.15), '#00ff00');
      // References that stay rigid, to compare against once the head moves.
      const refs = [cap.clone('capRef', headNode)!, brim.clone('brimRef', headNode)!];
      const out = skinGear([cap, brim], body, 'gear');
      expect(out).toHaveLength(1);
      const merged = out[0]!;
      expect(cap.isDisposed() && brim.isDisposed()).toBe(true);
      expect(merged.getTotalVertices()).toBe(refs[0]!.getTotalVertices() + refs[1]!.getTotalVertices());
      const uvs = merged.getVerticesData(VertexBuffer.UVKind)!;
      expect(uvs[0]).not.toBeCloseTo(uvs[uvs.length - 2]!, 5);
      const table = (merged.material as PBRMaterial).metallicTexture!;
      expect(table).toBeTruthy();
      const colors = merged.getVerticesData(VertexBuffer.ColorKind)!;
      expect(colors[0]).toBeCloseTo(1, 5);
      expect(colors[(merged.getTotalVertices() - 1) * 4 + 1]).toBeCloseTo(1, 5);

      // Turn the head and lean the hips: the skinned gear lands where the rigid copies are.
      headNode.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.7, -0.4, 0.2);
      hipsNode.rotationQuaternion = Quaternion.RotationYawPitchRoll(-0.3, 0.25, 0);
      hipsNode.position.set(0.2, 0.9, 0.1);
      merged.skeleton!.prepare(true);
      const skinned = merged.getPositionData(true, true)!;
      merged.computeWorldMatrix(true);
      const world = merged.getWorldMatrix();
      let i = 0;
      for (const ref of refs) {
        ref.computeWorldMatrix(true);
        const pos = ref.getVerticesData(VertexBuffer.PositionKind)!;
        for (let v = 0; v < pos.length; v += 3, i += 3) {
          const want = Vector3.TransformCoordinates(Vector3.FromArray(pos, v), ref.getWorldMatrix());
          const got = Vector3.TransformCoordinates(Vector3.FromArray(skinned, i), world);
          expect(Vector3.Distance(want, got)).toBeLessThan(1e-4);
        }
      }
    });
  }
});
