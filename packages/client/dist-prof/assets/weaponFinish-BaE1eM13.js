import { aB as PBRMaterial, G as Texture, a as Color3 } from "./babylon-PnzH6wcM.js";
import { D as DynamicTexture } from "./dynamicTexture.pure-Sh-mex-9.js";
function weaponEnvironment(scene) {
  const cached = environments.get(scene);
  if (cached && !cached.isDisposed) return cached.tex;
  const tex = new DynamicTexture("weaponEnvironment", { width: 128, height: 64 }, scene, true);
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
const environments = /* @__PURE__ */ new WeakMap();
function paint(tex, scene) {
  const hemi = scene.getLightByName("hemi");
  const k = Math.max(0.25, Math.min(1.2, hemi?.intensity ?? 0.8));
  const sky = (hemi?.diffuse ?? new Color3(0.85, 0.88, 0.95)).scale(1.15 * k);
  const ground = (hemi?.groundColor ?? new Color3(0.5, 0.47, 0.43)).scale(0.5 * k);
  const horizon = Color3.Lerp(sky, ground, 0.4);
  const band = sky.scale(1.8);
  const css = (c) => `rgb(${Math.round(Math.min(1, c.r) * 255)},${Math.round(Math.min(1, c.g) * 255)},${Math.round(Math.min(1, c.b) * 255)})`;
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
function finishWeapons(container, scene) {
  for (const m of container.materials) {
    if (!(m instanceof PBRMaterial) || !m.metallicTexture) continue;
    m.reflectionTexture = weaponEnvironment(scene);
  }
}
export {
  finishWeapons,
  weaponEnvironment
};
