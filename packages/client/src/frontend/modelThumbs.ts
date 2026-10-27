import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { offscreenCamera } from './offscreen.ts';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 as V3 } from '@babylonjs/core/Maths/math.vector';
import { buildMapGeometry, newMapDocument, type TileDefinition } from '@tiletrigger/shared';
import { ModelLibrary } from '../content/models.ts';
import { MapStyler } from '../mapMeshes.ts';

const SIZE = 96;

/** How to frame a thumbnail: three-quarter (props) or a side-on strip (weapons, barrel to the right). */
export type ThumbView = 'three-quarter' | 'side';
export type AnyThumbView = ThumbView | 'tile';
const VIEWS: Record<AnyThumbView, { dir: [number, number, number]; width: number; height: number }> = {
  'three-quarter': { dir: [0.75, 0.6, -1], width: SIZE, height: SIZE },
  // Building pieces: steeper, so you see into rooms over their walls.
  tile: { dir: [0.55, 1.7, -0.9], width: SIZE, height: SIZE },
  side: { dir: [-1, 0.12, 0], width: 128, height: 56 },
};

/**
 * Small three-quarter thumbnails of our own models (props in the MapMaker),
 * rendered in a private scene into a texture, one at a time, and cached as
 * PNG data URLs. Nothing here is painted art: it is the shipped model.
 */
export class ModelThumbnails {
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly models: ModelLibrary;
  private styler?: MapStyler;
  private readonly cache = new Map<string, Promise<string>>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false;
    // Renders between the app's frames: never onto the screen (see offscreenCamera).
    this.scene.activeCamera = offscreenCamera(this.scene, 'thumbHidden');
    this.camera = new FreeCamera('thumbCam', new Vector3(0, 1, 2), this.scene);
    this.camera.minZ = 0.02;
    this.camera.freezeProjectionMatrix(Matrix.PerspectiveFovLH(0.6, 1, 0.02, 200, engine.isNDCHalfZRange));
    const hemi = new HemisphericLight('thumbHemi', new Vector3(0.2, 1, -0.4), this.scene);
    hemi.intensity = 0.9;
    hemi.groundColor = new Color3(0.25, 0.27, 0.32);
    const key = new DirectionalLight('thumbKey', new Vector3(-0.5, -0.8, 0.6), this.scene);
    key.intensity = 1.2;
    this.models = new ModelLibrary(this.scene);
  }

  /** A thumbnail (PNG data URL) of a model file; cached. */
  get(path: string, view: ThumbView = 'three-quarter'): Promise<string> {
    const key = `${view}:${path}`;
    let p = this.cache.get(key);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.render(path, view))) as Promise<string>;
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
    }
    return p;
  }

  /** A thumbnail of a MapMaker building piece, drawn from its real geometry in the default theme; cached. */
  getTile(def: TileDefinition): Promise<string> {
    const key = `tile:${def.id}`;
    let p = this.cache.get(key);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.renderTile(def))) as Promise<string>;
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
    }
    return p;
  }

  private async renderTile(def: TileDefinition): Promise<string> {
    const base = newMapDocument('thumb');
    const doc = { ...base, classicStructure: { ...base.classicStructure, tiles: [{ id: 'thumb_tile', tile: def.id, x: 0, y: 0, z: 0, rotation: 0 as const }] } };
    this.styler ??= new MapStyler(this.scene);
    const meshes = this.styler.build(doc, buildMapGeometry(doc), 'thumbtile');
    try {
      return await this.renderMeshes(meshes, 'tile');
    } finally {
      for (const m of meshes) m.setEnabled(false);
    }
  }

  private async render(path: string, view: ThumbView): Promise<string> {
    const node = await this.models.instantiate(path, 'thumb');
    try {
      node.getHierarchyBoundingVectors(true); // brings every world matrix in the model up to date
      return await this.renderMeshes(node.getChildMeshes(), view);
    } finally {
      node.dispose();
    }
  }

  private async renderMeshes(meshes: AbstractMesh[], view: AnyThumbView): Promise<string> {
    const { dir: d, width: W, height: H } = VIEWS[view];
    const aspect = W / H;
    this.camera.freezeProjectionMatrix(Matrix.PerspectiveFovLH(0.6, aspect, 0.02, 200, this.scene.getEngine().isNDCHalfZRange));
    {
      let min = new V3(Infinity, Infinity, Infinity);
      let max = new V3(-Infinity, -Infinity, -Infinity);
      for (const m of meshes) {
        m.computeWorldMatrix(true);
        const b = m.getBoundingInfo().boundingBox;
        min = V3.Minimize(min, b.minimumWorld);
        max = V3.Maximize(max, b.maximumWorld);
      }
      if (!meshes.length) throw new Error('nothing to draw');
      const centre = min.add(max).scale(0.5);
      const radius = Math.max(0.2, max.subtract(min).length() / 2);
      const dir = new Vector3(d[0], d[1], d[2]).normalize();
      // Long, thin models (side view) fill the width: frame by the horizontal half-angle.
      const half = view === 'side' ? Math.atan(Math.tan(0.3) * aspect) : 0.3;
      this.camera.position.copyFrom(centre.add(dir.scale((radius / Math.tan(half)) * 1.05)));
      this.camera.setTarget(centre);
      const deadline = performance.now() + 8000;
      while (!meshes.every((m) => m.isReady(true)) && performance.now() < deadline) {
        this.scene.render();
        await new Promise((r) => setTimeout(r, 30));
      }
      const rtt = new RenderTargetTexture('thumbRT', { width: W, height: H }, this.scene, false);
      rtt.activeCamera = this.camera;
      rtt.renderList = meshes;
      rtt.clearColor = new Color4(0, 0, 0, 0);
      this.scene.customRenderTargets.push(rtt);
      let pixels: Uint8Array | null = null;
      for (let i = 0; i < 6 && !pixels; i++) {
        this.scene.render();
        await new Promise((r) => setTimeout(r, 20));
        if (i >= 1) pixels = (await rtt.readPixels()) as Uint8Array | null;
      }
      this.scene.customRenderTargets.splice(this.scene.customRenderTargets.indexOf(rtt), 1);
      rtt.dispose();
      if (!pixels) throw new Error('thumbnail render failed');
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const g = canvas.getContext('2d')!;
      const img = g.createImageData(W, H);
      const row = W * 4;
      for (let y = 0; y < H; y++) img.data.set(pixels.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      g.putImageData(img, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }
}
