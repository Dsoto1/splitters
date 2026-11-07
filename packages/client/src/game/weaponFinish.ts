import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';

/**
 * Weapons keep their source's metal and roughness (content/guns.json `pbr`: the new pack guns, grenades and Meshy
 * guns of the 11-06 intake). Babylon's PBR draws a bare-metal surface from what it reflects, and the game's scenes
 * have no environment map (characters and props are lit without one), so a steel receiver drew nearly black. A
 * weapon material with a metal/roughness map reflects this instead: a soft vertical gradient in the colours of the
 * map's own light (the hemispheric light's sky and ground colours and strength: dim at night), with a soft bright
 * band above, like a studio's light box, so polished steel shows a sheen and rough parts a dull grey. It has
 * mipmaps, so rougher parts see it blurred. One small texture per scene (128 × 64), shared by every weapon.
 */
export function weaponEnvironment(scene: Scene): BaseTexture {
  const cached = environments.get(scene);
  if (cached && !cached.isDisposed) return cached.tex;
  const tex = new DynamicTexture('weaponEnvironment', { width: 128, height: 64 }, scene, true);
  tex.coordinatesMode = Texture.EQUIRECTANGULAR_MODE;
  paint(tex, scene);
  const entry = { tex, isDisposed: false };
  environments.set(scene, entry);
  scene.onDisposeObservable.addOnce(() => {
    entry.isDisposed = true;
    environments.delete(scene);
  });
  return tex;
}

const environments = new WeakMap<Scene, { tex: DynamicTexture; isDisposed: boolean }>();

/** The gradient in the map's light: sky (top) to horizon to bounced ground light (bottom). */
function paint(tex: DynamicTexture, scene: Scene): void {
  const hemi = scene.getLightByName('hemi') as HemisphericLight | null;
  const k = Math.max(0.25, Math.min(1.2, hemi?.intensity ?? 0.8));
  const sky = (hemi?.diffuse ?? new Color3(0.85, 0.88, 0.95)).scale(0.75 * k);
  const ground = (hemi?.groundColor ?? new Color3(0.5, 0.47, 0.43)).scale(0.35 * k);
  const horizon = Color3.Lerp(sky, ground, 0.45);
  const band = sky.scale(1.6);
  const css = (c: Color3) => `rgb(${Math.round(Math.min(1, c.r) * 255)},${Math.round(Math.min(1, c.g) * 255)},${Math.round(Math.min(1, c.b) * 255)})`;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, css(sky));
  g.addColorStop(0.18, css(band));
  g.addColorStop(0.3, css(sky));
  g.addColorStop(0.5, css(horizon));
  g.addColorStop(0.62, css(ground));
  g.addColorStop(1, css(ground.scale(0.6)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 64);
  tex.update();
}

/** A loaded weapon model's metal materials reflect the weapon environment (see weaponEnvironment). */
export function finishWeapons(container: AssetContainer, scene: Scene): void {
  for (const m of container.materials) {
    if (!(m instanceof PBRMaterial) || !m.metallicTexture) continue;
    m.reflectionTexture = weaponEnvironment(scene);
  }
}
