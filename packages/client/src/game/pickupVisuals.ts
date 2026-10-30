import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh as MeshClass, type Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/instancedMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { getItem, getWeapon , type AmmoType, type DiscPower } from '@tiletrigger/shared';
import type { ModelLibrary } from '../content/models.ts';

/** The health pickups' model: the medkit (it falls back to the boxes-in-code case when it can't load). */
const HEALTH_MODEL = 'guns/medkit.glb';

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
 * place is exactly what players see: models on a glowing ring for weapons
 * and health (the medkit), and simple in-house shapes for armor, ammo and
 * powerups.
 * The returned root is centred on the item; place it PICKUP_HOVER above the floor.
 */
export function createPickupVisual(scene: Scene, models: ModelLibrary, itemId: string, name: string, instanced = false): TransformNode {
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
    void models.instantiate(getWeapon(fx.weapon).view.model, `${name}_gun`, instanced).then((model) => {
      if (root.isDisposed()) return model.dispose();
      model.parent = root;
      model.rotation.y = Math.PI / 2;
    });
    part(CreateCylinder(`${name}_ring`, { diameter: 0.9, height: 0.03, tessellation: 24 }, scene), mat(scene, '#ffb03b', 0.5)).position.y = -0.5;
  } else if (fx.kind === 'health') {
    // The medkit model (the owner's Meshy medkit, content/guns.json); large health is a bigger case.
    const s = fx.amount >= 50 ? 1.6 : 1.25;
    void models.instantiate(HEALTH_MODEL, `${name}_hp`, instanced).then((model) => {
      if (root.isDisposed()) return model.dispose();
      model.parent = root;
      model.scaling.setAll(s);
    });
    part(CreateCylinder(`${name}_ring`, { diameter: 0.7, height: 0.03, tessellation: 24 }, scene), mat(scene, '#e23b3b', 0.5)).position.y = -0.4;
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
      else part(CreateSphere(`${name}_g${x}`, { diameter: 0.18, segments: 8 }, scene), mat(scene, THROWABLE_COLORS[fx.throwable] ?? '#5e6a46', fx.throwable === 'frag' ? 0 : 0.35)).position.set(x, 0, z);
    }
    part(CreateCylinder(`${name}_ring`, { diameter: 0.7, height: 0.03, tessellation: 24 }, scene), mat(scene, '#ff7a3d', 0.5)).position.y = -0.3;
  } else if (fx.kind === 'jetpack') {
    // Twin tanks on a back plate, with nozzles and a glow underneath.
    part(CreateBox(`${name}_jpplate`, { width: 0.5, height: 0.55, depth: 0.08 }, scene), mat(scene, '#3a3f48')).position.z = -0.12;
    for (const x of [-0.13, 0.13]) {
      part(CreateCylinder(`${name}_jptank${x}`, { diameter: 0.2, height: 0.55, tessellation: 12 }, scene), mat(scene, '#c9ccd2')).position.set(x, 0.02, 0);
      part(CreateCylinder(`${name}_jpcap${x}`, { diameter: 0.21, height: 0.08, tessellation: 12 }, scene), mat(scene, '#ff7a2a', 0.4)).position.set(x, 0.3, 0);
      part(CreateCylinder(`${name}_jpnoz${x}`, { diameterTop: 0.1, diameterBottom: 0.16, height: 0.1, tessellation: 10 }, scene), mat(scene, '#2a2d33')).position.set(x, -0.3, 0);
    }
    part(CreateCylinder(`${name}_jpglow`, { diameter: 0.6, height: 0.03, tessellation: 24 }, scene), mat(scene, '#ff9a3d', 0.7)).position.y = -0.42;
  } else if (fx.kind === 'glider') {
    // A folded hang-glider wing: a flat delta of fabric over a pack.
    const wing = part(CreateCylinder(`${name}_glwing`, { diameter: 0.9, height: 0.03, tessellation: 3 }, scene), mat(scene, '#e2703a', 0.25));
    wing.rotation.y = Math.PI / 2;
    wing.position.y = 0.12;
    part(CreateBox(`${name}_glpack`, { width: 0.3, height: 0.2, depth: 0.16 }, scene), mat(scene, '#3a3f48')).position.y = -0.05;
    part(CreateBox(`${name}_glbar`, { width: 0.6, height: 0.03, depth: 0.03 }, scene), mat(scene, '#c9ccd2')).position.set(0, 0.06, 0.18);
  } else if (fx.kind === 'uav') {
    // A little quad drone: body, four arms and rotor discs.
    part(CreateBox(`${name}_uavbody`, { width: 0.26, height: 0.1, depth: 0.26 }, scene), mat(scene, '#3a3f48'));
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const arm = part(CreateBox(`${name}_uavarm${x}${z}`, { width: 0.04, height: 0.03, depth: 0.26 }, scene), mat(scene, '#2a2d33'));
      arm.position.set(x * 0.09, 0, z * 0.09);
      arm.rotation.y = Math.atan2(x, z);
      const rotor = part(CreateCylinder(`${name}_uavrotor${x}${z}`, { diameter: 0.22, height: 0.01, tessellation: 16 }, scene), mat(scene, '#9fe8ff', 0.6));
      rotor.position.set(x * 0.18, 0.07, z * 0.18);
    }
    part(CreateSphere(`${name}_uaveye`, { diameter: 0.08, segments: 8 }, scene), mat(scene, '#ff3b3b', 0.9)).position.set(0, -0.06, 0.1);
  } else if (fx.kind === 'disc') {
    // A power disc (Disc Arena): a glowing disc standing on edge, in its power's colour, over a ring.
    const color = DISC_COLORS[fx.power];
    const disc = part(CreateCylinder(`${name}_disc`, { diameter: 0.5, height: 0.06, tessellation: 24 }, scene), mat(scene, color, 0.9));
    disc.rotation.x = Math.PI / 2;
    part(CreateCylinder(`${name}_hub`, { diameter: 0.18, height: 0.08, tessellation: 12 }, scene), mat(scene, '#10161f')).rotation.x = Math.PI / 2;
    // Triple and split show their extra discs either side.
    if (fx.power === 'triple' || fx.power === 'split') {
      for (const x of [-0.3, 0.3]) {
        const d = part(CreateCylinder(`${name}_disc${x}`, { diameter: 0.28, height: 0.04, tessellation: 18 }, scene), mat(scene, color, 0.7));
        d.rotation.x = Math.PI / 2;
        d.position.x = x;
      }
    }
    part(CreateCylinder(`${name}_ring`, { diameter: 0.8, height: 0.03, tessellation: 24 }, scene), mat(scene, color, 0.5)).position.y = -0.45;
  } else {
    part(CreateSphere(`${name}_pu`, { diameter: 0.5, segments: 12 }, scene), mat(scene, fx.powerup === 'speed' ? '#36d6ff' : '#c03cff', 0.9));
  }
  if (instanced) instanceParts(scene, root);
  return root;
}

const sources = new WeakMap<Scene, Map<string, Mesh>>();

/**
 * In the game, a pickup's shapes are GPU instances of one mesh per shape and
 * material, shared by every pickup on the map (a map's dozens of pickups were
 * a draw call per box, ring and cross, drawn again into the shadow map).
 */
function instanceParts(scene: Scene, root: TransformNode): void {
  let cache = sources.get(scene);
  if (!cache) sources.set(scene, (cache = new Map()));
  for (const m of root.getChildMeshes(false)) {
    if (!(m instanceof MeshClass) || m.isAnInstance || !m.material) continue;
    const pos = m.getVerticesData('position');
    if (!pos) continue;
    let h = pos.length;
    for (let k = 0; k < pos.length; k++) h = (Math.imul(h, 31) + Math.round(pos[k]! * 1000)) | 0;
    const key = `${m.material.uniqueId}|${pos.length}|${h}`;
    let src = cache.get(key);
    if (!src || src.isDisposed()) {
      src = m.clone(`pickupShape_${cache.size}`, null, true, false)!;
      src.parent = null;
      // Parked out of sight: only its instances draw.
      src.position.set(0, -10000, 0);
      src.rotationQuaternion = null;
      src.rotation.setAll(0);
      src.scaling.setAll(1);
      src.isPickable = false;
      src.freezeWorldMatrix();
      cache.set(key, src);
    }
    const inst = src.createInstance(m.name);
    inst.parent = m.parent;
    inst.position.copyFrom(m.position);
    if (m.rotationQuaternion) inst.rotationQuaternion = m.rotationQuaternion.clone();
    else inst.rotation.copyFrom(m.rotation);
    inst.scaling.copyFrom(m.scaling);
    inst.isPickable = false;
    m.dispose(false, false);
  }
}

/** Power disc colours (pickups, MapMaker icons and the HUD). */
export const DISC_COLORS: Record<DiscPower, string> = { fast: '#ffe14a', triple: '#5ff2ff', split: '#ff6ad0', freeze: '#bff0ff' };

/** Grenade colour per kind on pickups. */
const THROWABLE_COLORS: Partial<Record<string, string>> = { frag: '#5e6a46', sticky: '#5ad24a', incendiary: '#ff7a2a', toxic: '#a8ff3a', vortex: '#b07aff', holy: '#ffd24a', cluster: '#f5d33a', sheep: '#f4f2ea', airstrike: '#ff4a2a', sandbag: '#b39b6b', dynamite: '#b3261e' };

/** Stripe colour per ammo type (pickups and MapMaker icons). */
const AMMO_COLORS: Record<AmmoType, string> = { light: '#f2e28a', rifle: '#e8a33a', shells: '#d8483a', sniper: '#5ab4e6', explosive: '#7a8a3a', cells: '#7dffb0', fuel: '#ff7a2a', chem: '#9a5ae0' };

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
    case 'jetpack':
      return '#ff9a3d';
    case 'glider':
      return '#e2703a';
    case 'uav':
      return '#9fe8ff';
    case 'disc':
      return DISC_COLORS[fx.power];
  }
}
