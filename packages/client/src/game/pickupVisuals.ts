import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh as MeshClass, type Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/instancedMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { AMMO_BOX_KIT_SCALE, THROWABLE_DEFS, getItem, getWeapon, throwableModel, type AmmoType, type DiscPower } from '@tiletrigger/shared';
import type { ModelLibrary } from '../content/models.ts';
import { castSmall } from './shadowFlags.ts';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { LOOT_OUTLINE } from './lootGlow.ts';

/** The small health pickup's model: the medkit (it falls back to the boxes-in-code case when it can't load). */
const HEALTH_MODEL = 'guns/medkit.glb';
/** The large health pickup's model: a medical bag (Meshy community, content/guns.json), built to its size (0.5 m long). */
const HEALTH_LARGE_MODEL = 'pickups/health_large.glb';
/** The rifle rounds pickup's model: an ammo box (Meshy community, content/guns.json), built to its size (0.5 m long). */
const AMMO_RIFLE_MODEL = 'pickups/ammo_rifle.glb';

/**
 * Guns waiting on the map are drawn this much bigger than in the hand, so they read at a distance (owner, 2026-11-14;
 * the MapMaker lane agreed 2026-11-13), but never longer than PICKUP_GUN_MAX_LENGTH: the weapon glow's ring is 1.375 m
 * across (lootGlow.ts LOOT_RING times its scale 1.25), and a long gun turning on the spot stays inside it. Looks only:
 * a pickup's reach is unchanged.
 */
export const PICKUP_GUN_SCALE = 1.4;
export const PICKUP_GUN_MAX_LENGTH = 1.3;

/** How much bigger a gun `length` metres long (its longest side) is drawn on the map: PICKUP_GUN_SCALE, less for long guns, never smaller than in the hand. */
export function pickupGunScale(length: number): number {
  if (!(length > 0)) return PICKUP_GUN_SCALE;
  return Math.max(1, Math.min(PICKUP_GUN_SCALE, PICKUP_GUN_MAX_LENGTH / length));
}

/** A loaded model's longest side (metres; read before it is parented, while it stands unturned at its own scale). */
function modelLength(model: TransformNode): number {
  const { min, max } = model.getHierarchyBoundingVectors(true);
  return Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
}

/** Height of a pickup's centre above the floor. */
export const PICKUP_HOVER = 0.55;
/** A dropped weapon lies on its side: its centre this high above the ground. */
export const DROP_LIE_HEIGHT = 0.08;

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
 * and health (the medkit, and the medical bag for large health), the ammo box
 * model for rifle rounds, and simple in-house shapes for armor, other ammo and
 * powerups.
 * The returned root is centred on the item; place it PICKUP_HOVER above the floor.
 * `lying`: a weapon dropped by the fallen, on its side on a small ring (place it DROP_LIE_HEIGHT above the ground).
 * `look`: the match's weapon set, whose looks grenades wear (the Military frag, the Sci-fi smoke canister).
 */
export function createPickupVisual(scene: Scene, models: ModelLibrary, itemId: string, name: string, instanced = false, lying = false, look?: string): TransformNode {
  const root = new TransformNode(name, scene);
  // Small and floating: its shadow is cast only near the camera (Atmosphere).
  castSmall(root);
  const item = getItem(itemId);
  const part = (m: Mesh, material: StandardMaterial) => {
    m.material = material;
    m.parent = root;
    m.isPickable = false;
    return m;
  };
  // In the game, a model's copies are GPU instances of it merged into one mesh (ModelLibrary.instantiateWhole).
  const copy = (path: string, part: string) => (instanced ? models.instantiateWhole(path, `${name}_${part}`) : models.instantiate(path, `${name}_${part}`));
  const fx = item?.effect;
  if (!fx) {
    part(CreateBox(`${name}_unknown`, { size: 0.4 }, scene), mat(scene, '#ff00ff', 0.5));
  } else if (fx.kind === 'weapon') {
    void copy(getWeapon(fx.weapon).view.model, 'gun').then((model) => {
      if (root.isDisposed()) return model.dispose();
      // (Measured before it is placed: the root turns, and a turned box reads longer.)
      const length = lying ? 0 : modelLength(model);
      model.parent = root;
      model.rotation.y = Math.PI / 2;
      // Rolled onto its side about the barrel.
      if (lying) model.rotation.z = Math.PI / 2;
      // Waiting on the map, drawn bigger so it reads at a distance (dropped ones lie at their own size).
      else model.scaling.setAll(pickupGunScale(length));
    });
    if (lying) part(CreateCylinder(`${name}_ring`, { diameter: 0.6, height: 0.02, tessellation: 20 }, scene), mat(scene, '#ffb03b', 0.5)).position.y = -DROP_LIE_HEIGHT + 0.01;
    else part(CreateCylinder(`${name}_ring`, { diameter: 0.9, height: 0.03, tessellation: 24 }, scene), mat(scene, '#ffb03b', 0.5)).position.y = -0.5;
  } else if (fx.kind === 'health') {
    // Small health is the medkit (the owner's Meshy medkit); large health is the medical bag, or a bigger medkit
    // when the bag can't load.
    const large = fx.amount >= 50;
    const attach = (s: number) => (model: TransformNode) => {
      if (root.isDisposed()) return model.dispose();
      model.parent = root;
      model.scaling.setAll(s);
    };
    if (large) void copy(HEALTH_LARGE_MODEL, 'hp').then(attach(1), () => copy(HEALTH_MODEL, 'hp').then(attach(1.6)));
    else void copy(HEALTH_MODEL, 'hp').then(attach(1.25));
    part(CreateCylinder(`${name}_ring`, { diameter: 0.7, height: 0.03, tessellation: 24 }, scene), mat(scene, '#3fbf5a', 0.5)).position.y = -0.4;
  } else if (fx.kind === 'armor') {
    const s = fx.amount >= 50 ? 1.25 : 1;
    part(CreateCylinder(`${name}_ar`, { diameter: 0.6 * s, height: 0.12, tessellation: 6 }, scene), mat(scene, '#3c8dff', 0.35)).rotation.x = Math.PI / 2;
  } else if (fx.kind === 'ammo' && fx.ammo === 'rifle') {
    // Rifle rounds: the ammo box model (the striped box in code when it can't load).
    void copy(AMMO_RIFLE_MODEL, 'ammo').then(
      (model) => {
        if (root.isDisposed()) return model.dispose();
        model.parent = root;
      },
      () => {
        if (!root.isDisposed()) ammoBoxes(scene, root, name, fx.ammo);
      },
    );
  } else if (fx.kind === 'ammo') {
    ammoBoxes(scene, root, name, fx.ammo, part);
  } else if (fx.kind === 'throwable') {
    // The thing itself: two of its model side by side (content/throwables.json `view`), a little bigger than in the
    // hand so it reads from across a room; the code-built ones a small cluster of coloured shapes.
    // (As the match's weapon set shows it, `look`: content/throwables.json `view.looks`.)
    const model = THROWABLE_DEFS[fx.throwable] ? throwableModel(fx.throwable, look) : null;
    const shapes = () => {
      for (const [x, z] of [[-0.12, 0], [0.12, 0.04], [0, -0.13]] as const) {
        if (fx.throwable === 'mine') part(CreateCylinder(`${name}_m${x}`, { diameter: 0.26, height: 0.08, tessellation: 12 }, scene), mat(scene, '#3c4038')).position.set(x, 0, z);
        else part(CreateSphere(`${name}_g${x}`, { diameter: 0.18, segments: 8 }, scene), mat(scene, THROWABLE_COLORS[fx.throwable] ?? '#5e6a46', fx.throwable === 'frag' ? 0 : 0.35)).position.set(x, 0, z);
      }
    };
    if (model) {
      // (The Ammo Box Kit: one small crate, its model being the full-size one.)
      const kit = fx.throwable === 'ammo_box';
      const scale = kit ? AMMO_BOX_KIT_SCALE : fx.throwable === 'mine' ? 0.7 : 1.5;
      for (const [i, [x, z, yaw]] of ((kit ? [[0, 0, 0.3]] : [[-0.09, 0, 0.5], [0.09, 0.03, -0.7]]) as readonly (readonly [number, number, number])[]).entries()) {
        void copy(model, `nade${i}`).then(
          (m) => {
            if (root.isDisposed()) return m.dispose();
            m.parent = root;
            m.position.set(x, 0, z);
            m.rotation.y = yaw;
            m.scaling.setAll(scale);
          },
          () => {
            if (i === 0 && !root.isDisposed()) shapes();
          },
        );
      }
    } else shapes();
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

/** The ammo box in code: an olive box with a stripe that tells the ammo type apart (general boxes are yellow). */
function ammoBoxes(scene: Scene, root: TransformNode, name: string, ammo: AmmoType | undefined, part?: (m: Mesh, material: StandardMaterial) => Mesh): void {
  const add =
    part ??
    ((m: Mesh, material: StandardMaterial) => {
      m.material = material;
      m.parent = root;
      m.isPickable = false;
      return m;
    });
  add(CreateBox(`${name}_ammo`, { width: 0.5, height: 0.3, depth: 0.32 }, scene), mat(scene, '#6b7048'));
  add(CreateBox(`${name}_stripe`, { width: 0.51, height: 0.06, depth: 0.33 }, scene), mat(scene, ammo ? AMMO_COLORS[ammo] : '#f2c14e', 0.4)).position.y = 0.05;
}

const outlineSources = new WeakMap<Scene, Map<string, Mesh>>();

/**
 * The dark outline under a pickup's floor glow (game/lootGlow.ts LOOT_OUTLINE): a flat ring from `inner` to `outer`
 * metres, black, soft at both edges, lying 1.5 cm over the floor. Its darkness is the mesh's `visibility` (set each
 * frame from the glow's level); unlit, casts no shadow, not pickable. One geometry per size, shared by its copies.
 */
export function createLootOutline(scene: Scene, inner: number, outer: number, name: string): Mesh {
  let cache = outlineSources.get(scene);
  if (!cache) outlineSources.set(scene, (cache = new Map()));
  const key = `${inner.toFixed(3)}|${outer.toFixed(3)}`;
  let src = cache.get(key);
  if (!src || src.isDisposed()) {
    const f = Math.min(LOOT_OUTLINE.feather, (outer - inner) / 3);
    const radii = [inner, inner + f, outer - f, outer];
    const alpha = [0, 1, 1, 0];
    const SEG = 48;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      for (let k = 0; k < 4; k++) {
        positions.push(Math.cos(a) * radii[k]!, 0, Math.sin(a) * radii[k]!);
        colors.push(0, 0, 0, alpha[k]!);
      }
      if (i < SEG) for (let k = 0; k < 3; k++) {
        const v = i * 4 + k;
        indices.push(v, v + 1, v + 5, v, v + 5, v + 4);
      }
    }
    const vd = new VertexData();
    vd.positions = positions;
    vd.colors = colors;
    vd.indices = indices;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    vd.normals = normals;
    src = new MeshClass(`lootOutline_${key}`, scene);
    vd.applyToMesh(src);
    src.hasVertexAlpha = true;
    const m = new StandardMaterial(`lootOutline_${key}`, scene);
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.emissiveColor = Color3.Black();
    m.disableLighting = true;
    m.backFaceCulling = false;
    m.zOffset = -2;
    src.material = m;
    src.isPickable = false;
    src.setEnabled(false);
    cache.set(key, src);
  }
  const mesh = src.clone(name, null, true, false)!;
  mesh.setEnabled(true);
  mesh.isPickable = false;
  mesh.receiveShadows = false;
  mesh.hasVertexAlpha = true;
  return mesh;
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
const THROWABLE_COLORS: Partial<Record<string, string>> = { frag: '#5e6a46', sticky: '#5ad24a', incendiary: '#ff7a2a', toxic: '#a8ff3a', vortex: '#b07aff', holy: '#ffd24a', cluster: '#f5d33a', sheep: '#f4f2ea', airstrike: '#ff4a2a', sandbag: '#b39b6b', dynamite: '#b3261e', smoke: '#9aa0a6' };

/** Stripe colour per ammo type (pickups and MapMaker icons). */
const AMMO_COLORS: Record<AmmoType, string> = { light: '#f2e28a', rifle: '#e8a33a', shells: '#d8483a', sniper: '#5ab4e6', explosive: '#7a8a3a', cells: '#7dffb0', fuel: '#ff7a2a', chem: '#9a5ae0' };

/** Palette swatch colour for an item (MapMaker icons). */
export function itemColor(itemId: string): string {
  const fx = getItem(itemId)?.effect;
  if (!fx) return '#ff00ff';
  switch (fx.kind) {
    case 'health':
      return '#3fbf5a';
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
