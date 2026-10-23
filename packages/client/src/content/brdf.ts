import type { Scene } from '@babylonjs/core/scene';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
// Babylon.js's own environment BRDF lookup table, RGBD-encoded (tools/content/extract-brdf-lut.mjs).
import envBrdfRgbd from './envBrdfRgbd.png?inline';

/**
 * Give a scene an environment BRDF lookup table that PBR materials can use
 * without any GPU pre-pass. Call before the scene creates PBR materials (each
 * material picks up the scene's table when it is constructed).
 *
 * Why: every PBR material (all glTF characters, weapons and props) samples
 * this table even with no environment map, and its green channel divides
 * the direct-light energy-conservation term (1 + F0 * (1 / brdf.y - 1)).
 * If the table reads as zeros, 1 / 0 makes every lit pixel +Inf: a flat,
 * pure-white silhouette with correct alpha (what WebGPU on macOS showed for
 * characters and portraits; a zeroed table reproduces it exactly).
 * Babylon's default table ships RGBD-encoded and is "expanded" to half float
 * by an asynchronous render pass whose result is swapped in place of the
 * texture after load. On WebGPU that pass is just more commands in the
 * engine's batched per-frame command buffer, shared by every scene, and our
 * portrait and weapon-icon scenes render outside the frame loop, so the
 * table's contents depend on GPU-side ordering we don't control.
 *
 * Here the same RGBD table is an ordinary 8-bit texture with a plain upload,
 * decoded in the PBR shader itself (ENVIRONMENTBRDF_RGBD): no pass, no swap,
 * nothing to lose or race, on WebGPU or WebGL2 (where portraits differ from
 * the expanded table by a mean of 0.2/255 per channel).
 */
export function installEnvironmentBrdf(scene: Scene): void {
  if (scene.environmentBRDFTexture) return;
  const t = new Texture(envBrdfRgbd, scene, true, false, Texture.BILINEAR_SAMPLINGMODE);
  t.name = 'envBrdfRgbd';
  t.isRGBD = true;
  t.wrapU = Texture.CLAMP_ADDRESSMODE;
  t.wrapV = Texture.CLAMP_ADDRESSMODE;
  scene.environmentBRDFTexture = t;
}
