import type { Scene } from '@babylonjs/core/scene';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

/**
 * What shiny see-through things (glass panes, water) reflect when they don't
 * render a reflection of their own: the scene's environment texture if it has
 * one, else the map's photo sky (the backdrop's equirectangular sky, sampled
 * along the reflected view ray). It shares the sky's GPU texture, so it costs
 * no memory and no render pass. Null when the map has no sky picture.
 */
export function skyReflection(scene: Scene): BaseTexture | null {
  if (scene.environmentTexture) return scene.environmentTexture;
  const sky = scene.getMaterialByName('backdrop_skyMat') as StandardMaterial | null;
  const src = sky?.reflectionTexture as Texture | null | undefined;
  if (!src || !(src instanceof Texture)) return null;
  const cached = reflections.get(scene);
  if (cached && cached.src === src) return cached.tex;
  const tex = src.clone();
  tex.coordinatesMode = Texture.EQUIRECTANGULAR_MODE;
  // As bright as the sky looks (night skies are dimmed).
  tex.level = src.level;
  reflections.set(scene, { src, tex });
  scene.onDisposeObservable.addOnce(() => reflections.delete(scene));
  return tex;
}

const reflections = new WeakMap<Scene, { src: Texture; tex: Texture }>();
