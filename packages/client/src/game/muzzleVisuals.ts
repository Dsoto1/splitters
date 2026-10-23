import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Mesh as MeshClass } from '@babylonjs/core/Meshes/mesh';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const textures = new WeakMap<Scene, DynamicTexture>();

/** A hot four-point star with a white core (drawn once per scene, in code). */
function flashTexture(scene: Scene): DynamicTexture {
  const cached = textures.get(scene);
  if (cached) return cached;
  const size = 128;
  const tex = new DynamicTexture('muzzleFlashTex', { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,240,1)');
  glow.addColorStop(0.18, 'rgba(255,220,120,0.95)');
  glow.addColorStop(0.45, 'rgba(255,140,40,0.45)');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow;
  // Spikes: long thin diamonds at irregular angles, then a round core.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.3;
    const len = c * (i % 2 ? 0.65 : 0.98);
    const w = c * 0.1;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
    ctx.lineTo(c + Math.cos(a + Math.PI / 2) * w, c + Math.sin(a + Math.PI / 2) * w);
    ctx.lineTo(c - Math.cos(a) * w, c - Math.sin(a) * w);
    ctx.lineTo(c + Math.cos(a - Math.PI / 2) * w, c + Math.sin(a - Math.PI / 2) * w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(c, c, c * 0.32, 0, Math.PI * 2);
  ctx.fill();
  tex.hasAlpha = true;
  tex.update();
  textures.set(scene, tex);
  return tex;
}

/**
 * A muzzle flash: an additive star sprite that always faces the camera. Call
 * `kickFlash` each shot to give it a new random turn and size.
 */
export function createStarFlash(scene: Scene, name: string, size: number): Mesh {
  const plane = CreatePlane(name, { size }, scene);
  const mat = new StandardMaterial(`${name}Mat`, scene);
  mat.diffuseTexture = flashTexture(scene);
  mat.emissiveTexture = mat.diffuseTexture;
  mat.opacityTexture = mat.diffuseTexture;
  mat.emissiveColor = new Color3(1, 0.85, 0.6);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.alphaMode = Constants.ALPHA_ADD;
  plane.material = mat;
  plane.billboardMode = MeshClass.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.setEnabled(false);
  return plane;
}

/** A new random look for the next flash. */
export function kickFlash(flash: Mesh, scale: number): void {
  flash.scaling.setAll(scale * (0.75 + Math.random() * 0.5));
  const tex = (flash.material as StandardMaterial).diffuseTexture as DynamicTexture | null;
  if (tex) tex.wAng = Math.random() * Math.PI * 2;
}
