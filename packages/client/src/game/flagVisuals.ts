import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Mesh as MeshClass } from '@babylonjs/core/Meshes/mesh';
import { BOMB_CARRIED, BOMB_DROPPED, BOMB_PLANTED, BT_IN_BOTH, BT_OBJ_ACTIVE, BT_OBJ_PLANTED, FLAG_CARRIED, FLAG_DROPPED, type Faction, type MapDocument, type ModeSnapshot, type Vec3 } from '@tiletrigger/shared';
import type { RemotePose } from './interpolation.ts';
import { blinkLevel, reduceFlashing } from './reduceFlashing.ts';

const materials = new WeakMap<Scene, Map<string, StandardMaterial>>();

function mat(scene: Scene, hex: string, glow = 0, alpha = 1): StandardMaterial {
  let cache = materials.get(scene);
  if (!cache) materials.set(scene, (cache = new Map()));
  const key = `${hex}|${glow}|${alpha}`;
  let m = cache.get(key);
  if (!m) {
    m = new StandardMaterial(`mode_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.15, 0.15, 0.15);
    m.emissiveColor = Color3.FromHexString(hex).scale(glow);
    if (alpha < 1) {
      m.alpha = alpha;
      m.backFaceCulling = false;
    }
    cache.set(key, m);
  }
  return m;
}

const part = <T extends Mesh>(m: T, parent: TransformNode, material: StandardMaterial): T => {
  m.parent = parent;
  m.material = material;
  m.isPickable = false;
  return m;
};

/** The flag itself: a pole with a cloth in the team colour (built from primitives). Origin at the foot of the pole. */
export function createFlagModel(scene: Scene, color: string, name: string): TransformNode {
  const root = new TransformNode(name, scene);
  part(CreateCylinder(`${name}_pole`, { diameter: 0.07, height: 2.6, tessellation: 8 }, scene), root, mat(scene, '#c9ccd2')).position.y = 1.3;
  part(CreateSphere(`${name}_tip`, { diameter: 0.16, segments: 6 }, scene), root, mat(scene, '#f2c14e', 0.4)).position.y = 2.65;
  // The cloth hangs from a hinge at the pole so it can flutter.
  const hinge = new TransformNode(`${name}_hinge`, scene);
  hinge.parent = root;
  hinge.position.y = 2.2;
  const cloth = part(CreateBox(`${name}_cloth`, { width: 1.05, height: 0.68, depth: 0.04 }, scene), hinge, mat(scene, color, 0.35));
  cloth.position.x = 0.55;
  const stripe = part(CreateBox(`${name}_stripe`, { width: 1.06, height: 0.12, depth: 0.05 }, scene), hinge, mat(scene, '#f2f2f2', 0.2));
  stripe.position.x = 0.55;
  return root;
}

/** A flag base: a plate with a glowing ring in the team colour (the flag stands on it when home). */
export function createFlagBase(scene: Scene, color: string, name: string): TransformNode {
  const root = new TransformNode(name, scene);
  part(CreateCylinder(`${name}_plate`, { diameter: 2.2, height: 0.1, tessellation: 24 }, scene), root, mat(scene, '#2a2f3a')).position.y = 0.05;
  part(CreateTorus(`${name}_ring`, { diameter: 2.0, thickness: 0.09, tessellation: 32 }, scene), root, mat(scene, color, 0.9)).position.y = 0.11;
  return root;
}

/** A hill spot: a translucent disc and a glowing rim of the given radius. */
export function createHillModel(scene: Scene, radius: number, name: string, color = '#f2f2f2'): TransformNode {
  const root = new TransformNode(name, scene);
  part(CreateCylinder(`${name}_area`, { diameter: radius * 2, height: 0.04, tessellation: 48 }, scene), root, mat(scene, color, 0.3, 0.18)).position.y = 0.04;
  part(CreateTorus(`${name}_rim`, { diameter: radius * 2, thickness: 0.12, tessellation: 64 }, scene), root, mat(scene, color, 0.9)).position.y = 0.08;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const post = part(CreateBox(`${name}_post${i}`, { width: 0.12, height: 1.4, depth: 0.12 }, scene), root, mat(scene, color, 0.7, 0.6));
    post.position.set(Math.sin(a) * radius, 0.7, Math.cos(a) * radius);
  }
  return root;
}

/** A bomb site: an orange area with its letter floating over it. */
export function createBombsiteModel(scene: Scene, radius: number, label: string, name: string, color = '#ff7a2a'): TransformNode {
  const root = createHillModel(scene, radius, name, color);
  labelPlane(scene, label, name, color).parent = root;
  return root;
}

/** A label floating 2.8 m up, always turned to face you (a bomb site's letter, an objective's name). */
function labelPlane(scene: Scene, label: string, name: string, color: string): Mesh {
  const tex = new DynamicTexture(`${name}_tex`, { width: 128, height: 128 }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = color;
  ctx.font = `bold ${label.length > 1 ? 64 : 104}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 2), 64, 70);
  tex.update();
  const m = new StandardMaterial(`${name}_labelmat`, scene);
  m.diffuseTexture = tex;
  m.emissiveColor = Color3.FromHexString(color);
  m.useAlphaFromDiffuseTexture = true;
  m.disableLighting = true;
  m.backFaceCulling = false;
  const plane = CreatePlane(`${name}_label`, { size: 1.6 }, scene);
  plane.material = m;
  plane.billboardMode = MeshClass.BILLBOARDMODE_Y;
  plane.position.y = 2.8;
  plane.isPickable = false;
  return plane;
}

/** Breakthrough objectives' colours by kind (a zone gold, a target red, the final hold violet), in the world, the HUD and MapMaker. */
export const BT_COLORS = { zone: '#f2c14e', target: '#ff5a3a', final: '#c38bff' } as const;

/**
 * A Breakthrough target: a demolition point (a charge plate on the floor, a striped post with a lamp on it) and its
 * area, with its label floating over it.
 */
export function createTargetModel(scene: Scene, radius: number, label: string, name: string, color: string = BT_COLORS.target): TransformNode {
  const root = createBombsiteModel(scene, radius, label, name, color);
  part(CreateBox(`${name}_plate`, { width: 0.9, height: 0.06, depth: 0.9 }, scene), root, mat(scene, '#3a3530')).position.y = 0.03;
  const post = part(CreateBox(`${name}_post`, { width: 0.16, height: 1.1, depth: 0.16 }, scene), root, mat(scene, '#d8b41a', 0.15));
  post.position.y = 0.55;
  for (let k = 0; k < 3; k++) part(CreateBox(`${name}_band${k}`, { width: 0.17, height: 0.12, depth: 0.17 }, scene), root, mat(scene, '#1e1e1e')).position.y = 0.2 + k * 0.32;
  part(CreateSphere(`${name}_lamp`, { diameter: 0.18, segments: 8 }, scene), root, mat(scene, color, 0.9)).position.y = 1.18;
  return root;
}

/** A Breakthrough sector line (MapMaker only): a dashed line across the map with an arrow the way the attackers push, and its order. */
export function createSectorModel(scene: Scene, order: number, name: string, length = 96): TransformNode {
  const root = new TransformNode(name, scene);
  const color = '#ffd24a';
  const dash = 3;
  for (let x = -length / 2; x < length / 2; x += dash * 2) {
    const m = part(CreateBox(`${name}_dash`, { width: dash, height: 0.08, depth: 0.35 }, scene), root, mat(scene, color, 0.8));
    m.position.set(x + dash / 2, 0.06, 0);
  }
  // Chevrons pointing the way the attackers push (+z), every 16 m.
  for (let x = -length / 2 + 8; x < length / 2; x += 16) {
    for (const s of [-1, 1]) {
      const c = part(CreateBox(`${name}_chev`, { width: 1.4, height: 0.08, depth: 0.25 }, scene), root, mat(scene, color, 0.6, 0.85));
      c.position.set(x + s * 0.5, 0.07, 1.4);
      c.rotation.y = s * 0.7;
    }
  }
  const pole = part(CreateBox(`${name}_pole`, { width: 0.14, height: 3.2, depth: 0.14 }, scene), root, mat(scene, color, 0.5));
  pole.position.y = 1.6;
  const tag = labelPlane(scene, String(order), `${name}_tag`, color);
  tag.parent = root;
  tag.position.y = 4;
  return root;
}

interface FlagVisual {
  team: string;
  base: TransformNode;
  flag: TransformNode;
  hinge: TransformNode;
}

/**
 * In-match visuals of the objective modes: flag bases and flags (at home, on
 * a carrier's back or lying where they fell) for Capture the Flag, and the
 * active hill for King of the Hill, tinted by whoever holds it.
 */
export class ModeVisuals {
  private readonly flags: FlagVisual[] = [];
  private readonly hills = new Map<number, { node: TransformNode; radius: number; holder: number }>();

  constructor(
    private readonly scene: Scene,
    private readonly map: MapDocument,
    private readonly teams: readonly Faction[],
    mode: string,
  ) {
    if (mode === 'core.ctf' || mode === 'core.forts') {
      for (const t of teams.slice(0, 2)) {
        const e = map.entities.find((x) => x.kind === 'flag' && x.team === t.id);
        if (!e) continue;
        const base = createFlagBase(scene, t.color, `flagbase_${t.id}`);
        base.position.set(e.position[0], e.position[1], e.position[2]);
        const flag = createFlagModel(scene, t.color, `flag_${t.id}`);
        flag.position.copyFrom(base.position);
        this.flags.push({ team: t.id, base, flag, hinge: flag.getChildTransformNodes(true).find((n) => n.name.endsWith('_hinge'))! });
      }
    }
  }

  /** Number of flags drawn (for tests). */
  get flagCount(): number {
    return this.flags.length;
  }

  update(md: ModeSnapshot | undefined, poses: readonly RemotePose[], localSlot: number, localPos: Vec3 | null, now: number): void {
    const t = now / 1000;
    for (const [i, row] of (md?.fl ?? []).entries()) {
      const v = this.flags.find((f) => f.team === this.teams[row[0]]?.id) ?? this.flags[i];
      if (!v) continue;
      const [, state, x, y, z, carrier] = row;
      const flag = v.flag;
      flag.setEnabled(true);
      flag.rotation.set(0, 0, 0);
      flag.scaling.setAll(1);
      if (state === FLAG_CARRIED) {
        // On the carrier's back, a bit smaller; hidden in your own first-person view.
        const pose = poses.find((p) => p.slot === carrier);
        const at = carrier === localSlot ? localPos : pose ? { x: pose.x, y: pose.y, z: pose.z } : { x, y, z };
        if (carrier === localSlot || !at) flag.setEnabled(false);
        else {
          const yaw = pose?.yaw ?? 0;
          flag.position.set(at.x - Math.sin(yaw) * 0.3, at.y + 0.5, at.z - Math.cos(yaw) * 0.3);
          flag.rotation.y = yaw + Math.PI / 2;
          flag.scaling.setAll(0.75);
        }
      } else if (state === FLAG_DROPPED) {
        // Lying on the ground at an angle, bobbing a little so it catches the eye.
        flag.position.set(x, y + 0.15 + Math.sin(t * 3) * 0.05, z);
        flag.rotation.set(0, t * 0.8, 1.1);
      } else flag.position.set(x, y, z);
      v.hinge.rotation.y = Math.sin(t * 4 + i) * 0.25;
      v.hinge.rotation.x = Math.sin(t * 2.7 + i) * 0.05;
    }
    // King of the Hill: only the active hill shows, in the holder's colour (white: nobody, amber: contested).
    const hl = md?.hl;
    for (const [index, h] of this.hills) h.node.setEnabled(index === hl?.[0]);
    if (hl && hl[0] >= 0) {
      const holder = hl[1];
      let h = this.hills.get(hl[0]);
      if (!h || h.holder !== holder) {
        h?.node.dispose(false, false);
        const e = this.map.entities[hl[0]];
        const radius = e?.kind === 'hill' ? e.radius : 5;
        const color = holder >= 0 ? (this.teams[holder]?.color ?? '#f2f2f2') : holder === -2 ? '#ffb03b' : '#f2f2f2';
        const node = createHillModel(this.scene, radius, `hill_${hl[0]}`, color);
        if (e) node.position.set(e.position[0], e.position[1], e.position[2]);
        h = { node, radius, holder };
        this.hills.set(hl[0], h);
      }
      h.node.rotation.y = t * 0.3;
    }
    // Bomb: a dark case with a red light, on the carrier's back, lying where it fell, or planted (blinking faster as the fuse runs down).
    const bm = md?.bm;
    if (bm) {
      this.bomb ??= createBombModel(this.scene);
      const [state, x, y, z, carrier, secs] = bm;
      const pose = state === BOMB_CARRIED ? poses.find((p) => p.slot === carrier) : undefined;
      const show = state === BOMB_DROPPED || state === BOMB_PLANTED || (state === BOMB_CARRIED && carrier !== localSlot && !!pose);
      this.bomb.root.setEnabled(show);
      if (pose) {
        this.bomb.root.position.set(pose.x - Math.sin(pose.yaw) * 0.32, pose.y + 1.05, pose.z - Math.cos(pose.yaw) * 0.32);
        this.bomb.root.rotation.y = pose.yaw;
      } else this.bomb.root.position.set(x, y + 0.12, z);
      const rate = state === BOMB_PLANTED ? Math.max(1.5, 12 - secs * 0.25) : 1;
      // Reduce flashing: a gentle pulse at most once a second (the HUD's fuse timer tells the time left).
      if (reduceFlashing()) {
        this.bomb.light.setEnabled(true);
        this.bomb.light.visibility = blinkLevel(t, rate, true);
      } else {
        this.bomb.light.setEnabled(Math.sin(t * Math.PI * 2 * rate) > 0);
        this.bomb.light.visibility = 1;
      }
    } else this.bomb?.root.setEnabled(false);
    // Breakthrough: the objectives in play (a zone tinted as it is taken, a target with its charge blinking faster as
    // the fuse burns down); the rest of the map's objectives wait unseen, done ones go.
    for (const [i, state, progress, extra] of md?.bo ?? []) {
      const live = state === BT_OBJ_ACTIVE || state === BT_OBJ_PLANTED;
      let v = this.objectives.get(i);
      if (!live) {
        v?.node.setEnabled(false);
        v?.charge?.root.setEnabled(false);
        continue;
      }
      const e = this.map.entities[i];
      if (e?.kind !== 'objective') continue;
      const attackers = this.teams[md?.bt?.[2] ?? 0]?.color ?? '#ff8a3a';
      const tint = e.objective === 'target' ? (state === BT_OBJ_PLANTED ? '#ff2a2a' : BT_COLORS.target) : extra === BT_IN_BOTH ? '#ffb03b' : progress > 0 ? attackers : BT_COLORS[e.objective];
      if (!v || v.tint !== tint) {
        v?.node.dispose(false, false);
        const name = `btobj_${i}`;
        const node = e.objective === 'target' ? createTargetModel(this.scene, e.radius, e.label, name, tint) : createBombsiteModel(this.scene, e.radius, e.label, name, tint);
        node.position.set(e.position[0], e.position[1], e.position[2]);
        v = { node, tint, charge: v?.charge };
        this.objectives.set(i, v);
      }
      v.node.setEnabled(true);
      if (e.objective !== 'target') v.node.rotation.y = t * 0.3;
      if (state === BT_OBJ_PLANTED) {
        v.charge ??= createBombModel(this.scene);
        v.charge.root.setEnabled(true);
        v.charge.root.position.set(e.position[0] + 0.25, e.position[1] + 0.07, e.position[2]);
        v.charge.light.setEnabled(Math.sin(t * Math.PI * 2 * Math.max(1.5, 12 - extra * 0.4)) > 0);
      } else v.charge?.root.setEnabled(false);
    }
  }

  private bomb?: { root: TransformNode; light: Mesh };
  /** Breakthrough objectives drawn so far, by entity index: the model in its tint, and a planted charge. */
  private readonly objectives = new Map<number, { node: TransformNode; tint: string; charge?: { root: TransformNode; light: Mesh } }>();

  /** Breakthrough objectives drawn and showing (for tests). */
  get objectiveCount(): number {
    return [...this.objectives.values()].filter((v) => v.node.isEnabled()).length;
  }

  dispose(): void {
    this.bomb?.root.dispose(false, false);
    for (const v of this.objectives.values()) {
      v.node.dispose(false, false);
      v.charge?.root.dispose(false, false);
    }
    this.objectives.clear();
    for (const f of this.flags) {
      f.base.dispose(false, false);
      f.flag.dispose(false, false);
    }
    for (const h of this.hills.values()) h.node.dispose(false, false);
    this.flags.length = 0;
    this.hills.clear();
  }
}

/** The bomb: a small dark case with a blinking red light on top. */
function createBombModel(scene: Scene): { root: TransformNode; light: Mesh } {
  const root = new TransformNode('bomb', scene);
  part(CreateBox('bomb_case', { width: 0.42, height: 0.2, depth: 0.28 }, scene), root, mat(scene, '#2d2a26'));
  const pad = part(CreateBox('bomb_pad', { width: 0.2, height: 0.03, depth: 0.14 }, scene), root, mat(scene, '#3a6a3a', 0.3));
  pad.position.y = 0.115;
  const light = part(CreateSphere('bomb_light', { diameter: 0.07, segments: 8 }, scene), root, mat(scene, '#ff2a2a', 1));
  light.position.set(0.13, 0.13, 0.07);
  return { root, light };
}
