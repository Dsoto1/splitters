import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { PLAYER, type MapDocument, type Vec3, type WorldBox } from '@chronosplit/shared';
import { MapStyler } from '../mapMeshes.ts';
import type { RemotePose } from './interpolation.ts';

const SLOT_COLORS = ['#e6544a', '#4aa3e6', '#f2c14e', '#5cc77a', '#b276e0', '#f28f3b', '#46c9c0', '#e872b0'];
export const slotColor = (slot: number): string => SLOT_COLORS[slot % SLOT_COLORS.length]!;

interface Tracer {
  mesh: LinesMesh;
  expires: number;
}

/** First-person match scene: map, remote avatars, tracers, viewmodel. */
export class GameView {
  readonly scene: Scene;
  readonly camera: FreeCamera;
  private readonly avatars = new Map<number, Mesh>();
  private tracers: Tracer[] = [];

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.52, 0.62, 0.72, 1);
    this.scene.skipPointerMovePicking = true;
    this.camera = new FreeCamera('camera', new Vector3(0, 10, -10), this.scene);
    this.camera.minZ = 0.05;
    this.camera.fov = 1.35; // ~77° vertical; FOV slider comes with the options screen
    this.camera.inputs.clear();

    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.75;
    hemi.groundColor = new Color3(0.35, 0.33, 0.3);
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), this.scene);
    sun.intensity = 0.6;

    // Viewmodel placeholder so first person has a weapon in view.
    const gun = CreateBox('viewmodel', { width: 0.06, height: 0.08, depth: 0.4 }, this.scene);
    gun.parent = this.camera;
    gun.position = new Vector3(0.22, -0.2, 0.5);
    gun.material = solid(this.scene, 'gunMat', '#2c2f36');
    gun.renderingGroupId = 1;
  }

  buildMap(doc: MapDocument, boxes: readonly WorldBox[]): void {
    new MapStyler(this.scene).build(doc, boxes);
    const sky = MapStyler.skyColor(doc);
    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
  }

  setCamera(eye: Vec3, yaw: number, pitch: number): void {
    this.camera.position.set(eye.x, eye.y, eye.z);
    // Babylon: rotation.y is yaw (0 = +Z), positive rotation.x looks down.
    this.camera.rotation.set(-pitch, yaw, 0);
  }

  /** Update remote player avatars from interpolated poses. */
  updateAvatars(poses: readonly RemotePose[], localSlot: number): void {
    const seen = new Set<number>();
    for (const p of poses) {
      if (p.slot === localSlot) continue;
      seen.add(p.slot);
      let mesh = this.avatars.get(p.slot);
      if (!mesh) {
        mesh = this.createAvatar(p.slot);
        this.avatars.set(p.slot, mesh);
      }
      mesh.setEnabled(p.alive);
      mesh.position.set(p.x, p.y + PLAYER.height / 2, p.z);
      mesh.rotation.y = p.yaw;
    }
    for (const [slot, mesh] of this.avatars) {
      if (!seen.has(slot)) {
        mesh.dispose(false, true);
        this.avatars.delete(slot);
      }
    }
  }

  private createAvatar(slot: number): Mesh {
    const body = CreateCapsule(`avatar_${slot}`, { height: PLAYER.height, radius: PLAYER.radius, tessellation: 12, subdivisions: 2 }, this.scene);
    body.material = solid(this.scene, `avatar_${slot}_mat`, slotColor(slot));
    // Visor shows facing direction at a glance.
    const visor = CreateBox(`visor_${slot}`, { width: 0.5, height: 0.14, depth: 0.2 }, this.scene);
    visor.parent = body;
    visor.position = new Vector3(0, PLAYER.eyeHeight - PLAYER.height / 2, PLAYER.radius - 0.05);
    visor.material = solid(this.scene, `visor_${slot}_mat`, '#1c1f26');
    body.isPickable = false;
    return body;
  }

  addTracer(from: Vec3, to: Vec3, color: string, ttlMs = 90): void {
    const mesh = CreateLines('tracer', { points: [new Vector3(from.x, from.y - 0.08, from.z), new Vector3(to.x, to.y, to.z)] }, this.scene);
    mesh.color = Color3.FromHexString(color);
    mesh.isPickable = false;
    this.tracers.push({ mesh, expires: performance.now() + ttlMs });
  }

  render(): void {
    const now = performance.now();
    this.tracers = this.tracers.filter((t) => {
      if (t.expires > now) return true;
      t.mesh.dispose();
      return false;
    });
    this.scene.render();
  }

  dispose(): void {
    this.scene.dispose();
  }
}

function solid(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  return m;
}
