import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { getItem, getWeapon , type AmmoType } from '@chronosplit/shared';
import type { ModelLibrary } from '../content/models.ts';

/** Height of a pickup's centre above the floor. */
export const PICKUP_HOVER = 0.55;

const materials = new WeakMap<Scene, Map<string, StandardMaterial>>();

/** Shared flat or glowing material per colour, cached per scene. */
function mat(scene: Scene, hex: string, glow = 0): StandardMaterial {
  let cache = materials.get(scene);
  if (!cache) materials.set(scene, (cache = new Map()));
  const key = `${hex}|${glow}`;
  let m = cache.get(key);
  if (!m) {
    m = new StandardMaterial(`pickup_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    m.emissiveColor = Color3.FromHexString(hex).scale(glow);
    cache.set(key, m);
  }
  return m;
}

/**
 * The look of a pickup, shared by the game and MapMaker so what creators
 * place is exactly what players see: weapon models on a glowing ring, and
 * simple in-house shapes for health, armor, ammo and powerups.
 * The returned root is centred on the item; place it PICKUP_HOVER above the floor.
 */
export function createPickupVisual(scene: Scene, models: ModelLibrary, itemId: string, name: string): TransformNode {
  const root = new TransformNode(name, scene);
  const item = getItem(itemId);
  const part = (m: Mesh, material: StandardMaterial) => {
    m.material = material;
    m.parent = root;
    m.isPickable = false;
    return m;
  };
  const fx = item?.effect;
  if (!fx) {
    part(CreateBox(`${name}_unknown`, { size: 0.4 }, scene), mat(scene, '#ff00ff', 0.5));
  } else if (fx.kind === 'weapon') {
    void models.instantiate(getWeapon(fx.weapon).view.model, `${name}_gun`).then((model) => {
      if (root.isDisposed()) return model.dispose();
      model.parent = root;
      model.rotation.y = Math.PI / 2;
    });
    part(CreateCylinder(`${name}_ring`, { diameter: 0.9, height: 0.03, tessellation: 24 }, scene), mat(scene, '#ffb03b', 0.5)).position.y = -0.5;
  } else if (fx.kind === 'health') {
    const s = fx.amount >= 50 ? 1.25 : 1;
    part(CreateBox(`${name}_hp`, { size: 0.42 * s }, scene), mat(scene, '#f2f2f2'));
    const red = mat(scene, '#e23b3b', 0.6);
    part(CreateBox(`${name}_hpx`, { width: 0.44 * s, height: 0.12 * s, depth: 0.43 * s }, scene), red);
    part(CreateBox(`${name}_hpy`, { width: 0.12 * s, height: 0.44 * s, depth: 0.43 * s }, scene), red);
  } else if (fx.kind === 'armor') {
    const s = fx.amount >= 50 ? 1.25 : 1;
    part(CreateCylinder(`${name}_ar`, { diameter: 0.6 * s, height: 0.12, tessellation: 6 }, scene), mat(scene, '#3c8dff', 0.35)).rotation.x = Math.PI / 2;
  } else if (fx.kind === 'ammo') {
    part(CreateBox(`${name}_ammo`, { width: 0.5, height: 0.3, depth: 0.32 }, scene), mat(scene, '#6b7048'));
    // The stripe tells the ammo type apart (general boxes are yellow).
    part(CreateBox(`${name}_stripe`, { width: 0.51, height: 0.06, depth: 0.33 }, scene), mat(scene, fx.ammo ? AMMO_COLORS[fx.ammo] : '#f2c14e', 0.4)).position.y = 0.05;
  } else if (fx.kind === 'throwable') {
    // A small cluster of the thing itself.
    for (const [x, z] of [[-0.12, 0], [0.12, 0.04], [0, -0.13]] as const) {
      if (fx.throwable === 'mine') part(CreateCylinder(`${name}_m${x}`, { diameter: 0.26, height: 0.08, tessellation: 12 }, scene), mat(scene, '#3c4038')).position.set(x, 0, z);
      else part(CreateSphere(`${name}_g${x}`, { diameter: 0.18, segments: 8 }, scene), mat(scene, '#5e6a46')).position.set(x, 0, z);
    }
    part(CreateCylinder(`${name}_ring`, { diameter: 0.7, height: 0.03, tessellation: 24 }, scene), mat(scene, '#ff7a3d', 0.5)).position.y = -0.3;
  } else {
    part(CreateSphere(`${name}_pu`, { diameter: 0.5, segments: 12 }, scene), mat(scene, fx.powerup === 'speed' ? '#36d6ff' : '#c03cff', 0.9));
  }
  return root;
}

/** Stripe colour per ammo type (pickups and MapMaker icons). */
const AMMO_COLORS: Record<AmmoType, string> = { light: '#f2e28a', rifle: '#e8a33a', shells: '#d8483a', sniper: '#5ab4e6', explosive: '#7a8a3a', cells: '#7dffb0' };

/** Palette swatch colour for an item (MapMaker icons). */
export function itemColor(itemId: string): string {
  const fx = getItem(itemId)?.effect;
  if (!fx) return '#ff00ff';
  switch (fx.kind) {
    case 'health':
      return '#e23b3b';
    case 'armor':
      return '#3c8dff';
    case 'ammo':
      return fx.ammo ? AMMO_COLORS[fx.ammo] : '#c9b33a';
    case 'throwable':
      return '#ff7a3d';
    case 'weapon':
      return '#ffb03b';
    case 'powerup':
      return fx.powerup === 'speed' ? '#36d6ff' : '#c03cff';
  }
}
