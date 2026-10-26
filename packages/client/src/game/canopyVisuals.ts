import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CHUTE_GLIDER } from '@tiletrigger/shared';

/**
 * Canopies drawn over anyone under a parachute or a glider (see
 * shared/sim/parachute.ts), built from simple shapes in code: a striped
 * dome on rigging lines, or a delta wing with a control bar. The root sits
 * at the wearer's feet and turns with them.
 */
export function createCanopy(scene: Scene, name: string, kind: number): TransformNode {
  const root = new TransformNode(name, scene);
  const mat = (key: string, hex: string) => {
    const m = new StandardMaterial(`${name}_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    m.backFaceCulling = false;
    return m;
  };
  const rig = new Color4(0.15, 0.15, 0.15, 1);
  if (kind === CHUTE_GLIDER) {
    // A hang-glider wing above the shoulders: a flat triangle, nose forward.
    const wing = CreateCylinder(`${name}_wing`, { diameter: 6.4, height: 0.06, tessellation: 3 }, scene);
    wing.parent = root;
    wing.rotation.y = -Math.PI / 2;
    wing.position.set(0, 2.9, -0.4);
    wing.scaling.set(1, 1, 0.75);
    wing.material = mat('wing', '#e2703a');
    const keel = CreateCylinder(`${name}_keel`, { diameter: 0.08, height: 3.4, tessellation: 6 }, scene);
    keel.parent = root;
    keel.rotation.x = Math.PI / 2;
    keel.position.set(0, 2.85, -0.4);
    keel.material = mat('keel', '#2a2d33');
    const lines = CreateLineSystem(`${name}_frame`, {
      lines: [
        [new Vector3(-0.55, 1.6, 0.35), new Vector3(0.55, 1.6, 0.35)],
        [new Vector3(-0.55, 1.6, 0.35), new Vector3(0, 2.85, 0.2)],
        [new Vector3(0.55, 1.6, 0.35), new Vector3(0, 2.85, 0.2)],
      ],
      colors: [[rig, rig], [rig, rig], [rig, rig]],
    }, scene);
    lines.parent = root;
  } else {
    // A round canopy: a flattened half dome in two colours, with lines down to the shoulders.
    const dome = CreateSphere(`${name}_dome`, { diameter: 5.2, segments: 12, slice: 0.5 }, scene);
    dome.parent = root;
    dome.position.y = 5.2;
    dome.scaling.y = 0.45;
    dome.material = mat('dome', '#d8483a');
    const band = CreateSphere(`${name}_band`, { diameter: 5.25, segments: 12, slice: 0.18 }, scene);
    band.parent = root;
    band.position.y = 5.2;
    band.scaling.y = 0.46;
    band.material = mat('band', '#f2f2f2');
    const lines: Vector3[][] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      lines.push([new Vector3(Math.sin(a) * 0.25, 1.45, Math.cos(a) * 0.15), new Vector3(Math.sin(a) * 2.5, 5.2, Math.cos(a) * 2.5)]);
    }
    const rigging = CreateLineSystem(`${name}_lines`, { lines, colors: lines.map(() => [rig, rig]) }, scene);
    rigging.parent = root;
  }
  for (const m of root.getChildMeshes()) m.isPickable = false;
  return root;
}

/** Put a canopy over its wearer (feet `pos`, facing `yaw`) with a gentle swing, so it reads as fabric in the wind. */
export function placeCanopy(node: TransformNode, pos: { x: number; y: number; z: number }, yaw: number, now: number, seed: number): void {
  node.position.set(pos.x, pos.y, pos.z);
  node.rotation.set(Math.sin(now / 900 + seed * 1.7) * 0.04, yaw, Math.sin(now / 700 + seed) * 0.06);
}
