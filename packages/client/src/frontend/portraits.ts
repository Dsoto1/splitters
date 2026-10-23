import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CharacterLibrary } from '../content/characters.ts';

const SIZE = 256;

/**
 * Character portraits rendered from our own 3D characters (never painted
 * art): each look is built in a private scene, framed head and shoulders,
 * rendered once into a texture and kept as a PNG data URL. Renders run one at
 * a time so the menus never stall.
 */
export class PortraitRenderer {
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly lib: CharacterLibrary;
  private readonly cache = new Map<string, Promise<string>>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    // Never draws to the screen: only into the portrait texture.
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false;
    const hidden = new FreeCamera('portraitHidden', Vector3.Zero(), this.scene);
    hidden.viewport = new Viewport(0, 0, 0.0001, 0.0001);
    this.scene.activeCamera = hidden;
    this.camera = new FreeCamera('portraitCam', new Vector3(0, 1.6, 1), this.scene);
    this.camera.fov = 0.42;
    this.camera.minZ = 0.02;
    const hemi = new HemisphericLight('portraitHemi', new Vector3(0, 1, 0.5), this.scene);
    hemi.intensity = 0.7;
    hemi.groundColor = new Color3(0.12, 0.14, 0.2);
    const key = new DirectionalLight('portraitKey', new Vector3(-0.5, -0.4, -1), this.scene);
    key.intensity = 1.05;
    const rim = new PointLight('portraitRim', new Vector3(0.8, 2, -0.8), this.scene);
    rim.diffuse = Color3.FromHexString('#00d1ff');
    rim.intensity = 6;
    this.lib = new CharacterLibrary(this.scene);
  }

  /** A portrait (PNG data URL) of a look; cached per look. */
  get(look: string): Promise<string> {
    let p = this.cache.get(look);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.render(look))) as Promise<string>;
      p.catch(() => this.cache.delete(look));
      this.cache.set(look, p);
    }
    return p;
  }

  private async render(look: string): Promise<string> {
    const ch = await this.lib.create({ look }, 'portrait');
    try {
      // Bind pose is fine: the frame shows only the head and shoulders.
      ch.root.computeWorldMatrix(true);
      for (const n of ch.root.getDescendants(false)) (n as TransformNode).computeWorldMatrix?.(true);
      const head = ch.joints.get('Head');
      const at = head ? head.getAbsolutePosition().clone() : new Vector3(0, 1.6, 0);
      at.y += 0.06;
      this.camera.position.copyFrom(at.add(new Vector3(0.22, 0.04, 0.85)));
      this.camera.setTarget(at.add(new Vector3(0, -0.06, 0)));

      // Textures (shared JPEGs) load asynchronously: wait for them, up to a few seconds.
      const textures = ch.meshes.flatMap((m) => (m.material ? m.material.getActiveTextures() : []));
      const deadline = performance.now() + 4000;
      while (textures.some((t) => !t.isReady()) && performance.now() < deadline) await new Promise((r) => setTimeout(r, 50));

      const rtt = new RenderTargetTexture('portraitRT', SIZE, this.scene, false);
      rtt.activeCamera = this.camera;
      rtt.renderList = ch.meshes;
      rtt.clearColor = new Color4(0, 0, 0, 0);
      this.scene.customRenderTargets.push(rtt);
      // The first frames compile shaders; draw until something shows (or give up).
      let pixels: Uint8Array | null = null;
      for (let attempt = 0; attempt < 12 && !covered(pixels); attempt++) {
        this.scene.render();
        await new Promise((r) => setTimeout(r, 30));
        if (attempt >= 2) pixels = (await rtt.readPixels()) as Uint8Array | null;
      }
      this.scene.customRenderTargets.splice(this.scene.customRenderTargets.indexOf(rtt), 1);
      rtt.dispose();
      if (!pixels) throw new Error('portrait render failed');
      return toDataUrl(pixels, SIZE);
    } finally {
      ch.dispose();
    }
  }

  dispose(): void {
    this.scene.dispose();
  }
}

/** Whether a render drew the character (any opaque pixel), rather than an empty frame. */
function covered(pixels: Uint8Array | null): boolean {
  if (!pixels) return false;
  for (let i = 3; i < pixels.length; i += 64) if (pixels[i]! > 0) return true;
  return false;
}

/** RGBA pixels (bottom row first) to a PNG data URL. */
function toDataUrl(pixels: Uint8Array, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(size, size);
  const row = size * 4;
  for (let y = 0; y < size; y++) img.data.set(pixels.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  g.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
