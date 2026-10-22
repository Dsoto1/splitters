import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { PLAYER, type BoxKind, type Vec3, type WorldBox } from '@chronosplit/shared';
import type { RemotePose } from './interpolation.ts';

export type RendererKind = 'WebGPU' | 'WebGL2';

/** Creates a WebGPU engine where available, otherwise WebGL2 (MASTER_SPEC_V2 header). `?renderer=webgl2` forces the fallback. */
async function createEngine(canvas: HTMLCanvasElement): Promise<{ engine: AbstractEngine; kind: RendererKind }> {
  const forced = new URLSearchParams(location.search).get('renderer');
  if (forced !== 'webgl2') {
    try {
      if (await WebGPUEngine.IsSupportedAsync) {
        const engine = new WebGPUEngine(canvas, { antialias: true, stencil: true });
        await engine.initAsync();
        return { engine, kind: 'WebGPU' };
      }
    } catch (e) {
      console.warn('WebGPU unavailable, falling back to WebGL2', e);
    }
  }
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, true);
  return { engine, kind: 'WebGL2' };
}

const SLOT_COLORS = ['#e6544a', '#4aa3e6', '#f2c14e', '#5cc77a', '#b276e0', '#f28f3b', '#46c9c0', '#e872b0'];
export const slotColor = (slot: number): string => SLOT_COLORS[slot % SLOT_COLORS.length]!;

interface Tracer {
  mesh: LinesMesh;
  expires: number;
}

export class Renderer {
  readonly scene: Scene;
  readonly camera: FreeCamera;
  private readonly avatars = new Map<number, Mesh>();
  private tracers: Tracer[] = [];

  private constructor(
    readonly engine: AbstractEngine,
    readonly kind: RendererKind,
  ) {
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

  static async create(canvas: HTMLCanvasElement): Promise<Renderer> {
    const { engine, kind } = await createEngine(canvas);
    const r = new Renderer(engine, kind);
    window.addEventListener('resize', () => engine.resize());
    return r;
  }

  /** Build static map meshes: one merged mesh per box kind, with world-scale grid UVs. */
  buildMap(boxes: readonly WorldBox[]): void {
    const grid = gridTexture(this.scene);
    const tints: Record<BoxKind, string> = { floor: '#9aa0a8', wall: '#d9d6cf', solid: '#d98b3a' };
    for (const kind of ['floor', 'wall', 'solid'] as const) {
      const ofKind = boxes.filter((b) => b.kind === kind);
      if (!ofKind.length) continue;
      const mesh = new Mesh(`map_${kind}`, this.scene);
      boxVertexData(ofKind).applyToMesh(mesh);
      const mat = new StandardMaterial(`map_${kind}_mat`, this.scene);
      mat.diffuseTexture = grid;
      mat.diffuseColor = Color3.FromHexString(tints[kind]);
      mat.specularColor = new Color3(0.05, 0.05, 0.05);
      mesh.material = mat;
      mesh.freezeWorldMatrix();
      mesh.isPickable = false;
    }
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
}

function solid(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  return m;
}

/** 1 m grid texture, the classic "dev theme" look that makes scale readable. */
function gridTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture('grid', { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 8;
  return tex;
}

/** Box faces with flat normals and UVs in world metres (1 texture repeat per 2 m). */
function boxVertexData(boxes: readonly WorldBox[]): VertexData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const uvScale = 0.5;
  for (const b of boxes) {
    const [x0, y0, z0] = b.min;
    const [x1, y1, z1] = b.max;
    // Each face: 4 corners and the outward normal. Babylon treats clockwise-from-outside as front-facing.
    const faces: [number[][], number[]][] = [
      [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
      [[[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]],
      [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]],
      [[[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], [0, -1, 0]],
      [[[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1]],
      [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]],
    ];
    for (const [corners, n] of faces) {
      const base = positions.length / 3;
      for (const c of corners) {
        positions.push(c[0]!, c[1]!, c[2]!);
        normals.push(n[0]!, n[1]!, n[2]!);
        // Project onto the two axes perpendicular to the normal.
        const u = n[0] !== 0 ? c[2]! : c[0]!;
        const v = n[1] !== 0 ? c[2]! : c[1]!;
        uvs.push(u * uvScale, v * uvScale);
      }
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.indices = indices;
  return vd;
}
