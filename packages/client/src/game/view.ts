import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import {
  PLAYER,
  POWERUP_DAMAGE_BIT,
  POWERUP_SPEED_BIT,
  WEAPONS_BY_SLOT,
  getWeapon,
  type MapDocument,
  type PickupEntity,
  type Vec3,
  type WeaponDefinition,
  type WorldBox,
} from '@chronosplit/shared';
import { MapStyler } from '../mapMeshes.ts';
import { ModelLibrary } from '../content/models.ts';
import { PICKUP_HOVER, createPickupVisual } from './pickupVisuals.ts';
import { ScenarioVisuals } from './scenarioVisuals.ts';
import type { RemotePose } from './interpolation.ts';

const SLOT_COLORS = ['#e6544a', '#4aa3e6', '#f2c14e', '#5cc77a', '#b276e0', '#f28f3b', '#46c9c0', '#e872b0'];
export const slotColor = (slot: number): string => SLOT_COLORS[slot % SLOT_COLORS.length]!;

/** Default vertical FOV (~77°); an options screen will expose it. */
export const DEFAULT_FOV = 1.35;

interface Fx {
  mesh: Mesh | LinesMesh;
  born: number;
  ttl: number;
  /** Per-frame update with age fraction 0..1. */
  update?: (f: number) => void;
}

interface Avatar {
  body: Mesh;
  mat: StandardMaterial;
  weaponSlot: number;
  weaponNode?: TransformNode;
}

interface PickupVisual {
  root: TransformNode;
  baseY: number;
  phase: number;
}

/** First-person match scene: map, viewmodel, remote avatars, pickups, projectiles and effects. */
export class GameView {
  readonly scene: Scene;
  readonly camera: FreeCamera;
  readonly models: ModelLibrary;
  readonly scenario: ScenarioVisuals;
  private readonly avatars = new Map<number, Avatar>();
  private readonly pickups = new Map<string, PickupVisual>();
  private readonly projectiles = new Map<number, TransformNode>();
  private effects: Fx[] = [];
  private readonly viewRoot: TransformNode;
  private viewmodel?: TransformNode;
  private viewWeapon?: string;
  private viewLoad = 0;
  /** Front of the loaded viewmodel along its forward axis, for the muzzle flash. */
  private muzzleZ = 0.2;
  private kickAmount = 0;
  private bobPhase = 0;
  private readonly flash: Mesh;
  private flashUntil = 0;

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.52, 0.62, 0.72, 1);
    this.scene.skipPointerMovePicking = true;
    this.camera = new FreeCamera('camera', new Vector3(0, 10, -10), this.scene);
    this.camera.minZ = 0.03;
    this.camera.fov = DEFAULT_FOV;
    this.camera.inputs.clear();
    this.models = new ModelLibrary(this.scene);
    this.scenario = new ScenarioVisuals(this.scene);

    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.8;
    hemi.groundColor = new Color3(0.35, 0.33, 0.3);
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), this.scene);
    sun.intensity = 0.6;

    this.viewRoot = new TransformNode('viewRoot', this.scene);
    this.viewRoot.parent = this.camera;
    this.flash = CreateSphere('muzzleFlash', { diameter: 0.09, segments: 6 }, this.scene);
    this.flash.material = glow(this.scene, 'flashMat', '#ffd27a');
    this.flash.renderingGroupId = 1;
    this.flash.isPickable = false;
    this.flash.setEnabled(false);
  }

  buildMap(doc: MapDocument, boxes: readonly WorldBox[]): void {
    new MapStyler(this.scene).build(doc, boxes);
    const sky = MapStyler.skyColor(doc);
    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    for (const e of doc.entities) if (e.kind === 'pickup') this.addPickup(e);
    this.scenario.build(doc.entities);
    // Warm the model cache so first switches and pickups don't hitch.
    for (const w of WEAPONS_BY_SLOT) void this.models.load(w.view.model);
    void this.models.load('projectiles/grenade.glb');
  }

  setCamera(eye: Vec3, yaw: number, pitch: number, fov: number): void {
    this.camera.position.set(eye.x, eye.y, eye.z);
    // Babylon: rotation.y is yaw (0 = +Z), positive rotation.x looks down.
    this.camera.rotation.set(-pitch, yaw, 0);
    this.camera.fov = fov;
  }

  // ---------------------------------------------------------------- viewmodel

  /** Show the held weapon in first person (undefined hides it, e.g. while dead or scoped). */
  setViewmodel(def: WeaponDefinition | undefined): void {
    if (def?.id === this.viewWeapon) return;
    this.viewWeapon = def?.id;
    const load = ++this.viewLoad;
    this.viewmodel?.dispose();
    this.viewmodel = undefined;
    if (!def) return;
    void this.models.instantiate(def.view.model, `view_${def.id}`).then((node) => {
      if (load !== this.viewLoad) return node.dispose();
      // Measure before parenting, in the model's own space.
      this.muzzleZ = node.getHierarchyBoundingVectors(true).max.z;
      node.parent = this.viewRoot;
      // Draw on top of the world so the gun never clips into walls.
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      this.viewmodel = node;
    });
  }

  /** Recoil kick and muzzle flash for a predicted shot. */
  kick(def: WeaponDefinition): void {
    this.kickAmount = Math.min(1, this.kickAmount + (def.kind === 'melee' ? 0.9 : def.pellets > 1 || def.projectile ? 1 : 0.45));
    if (def.kind !== 'melee') this.flashUntil = performance.now() + 50;
  }

  /** Position the viewmodel: offset, bob while moving, recoil, and dips for raising/reloading. */
  updateViewmodel(dt: number, o: { moving: boolean; raise: number; reload: number; hidden: boolean }): void {
    const def = this.viewWeapon ? getWeapon(this.viewWeapon) : undefined;
    this.viewRoot.setEnabled(!o.hidden && !!def);
    if (!def) return;
    this.kickAmount = Math.max(0, this.kickAmount - dt * 6);
    if (o.moving) this.bobPhase += dt * 9;
    const bob = o.moving ? 1 : 0;
    const [x, y, z] = def.view.viewOffset;
    const melee = def.kind === 'melee';
    this.viewRoot.position.set(
      x + Math.sin(this.bobPhase) * 0.012 * bob,
      y + Math.abs(Math.cos(this.bobPhase)) * 0.01 * bob - o.raise * 0.25 - o.reload * 0.08,
      z - this.kickAmount * (melee ? -0.25 : 0.06),
    );
    this.viewRoot.rotation.set(-this.kickAmount * (melee ? -0.6 : 0.12) + o.reload * 0.6, melee ? this.kickAmount * 0.5 : 0, o.reload * 0.4);
    const flashing = performance.now() < this.flashUntil;
    this.flash.setEnabled(flashing);
    if (flashing) {
      this.flash.parent = this.viewRoot;
      this.flash.position.set(0, 0.02, this.muzzleZ + 0.03);
    }
  }

  // ---------------------------------------------------------------- avatars

  /** Update remote player avatars from interpolated poses. */
  updateAvatars(poses: readonly RemotePose[], localSlot: number, npcLook: (id: number) => { color: string; scale: number } | undefined = () => undefined): void {
    const seen = new Set<number>();
    for (const p of poses) {
      if (p.slot === localSlot) continue;
      seen.add(p.slot);
      let a = this.avatars.get(p.slot);
      if (!a) {
        a = this.createAvatar(p.slot, npcLook(p.slot));
        this.avatars.set(p.slot, a);
      }
      a.body.setEnabled(p.alive);
      a.body.position.set(p.x, p.y + PLAYER.height / 2, p.z);
      a.body.rotation.y = p.yaw;
      // Powerups glow: cyan for speed, magenta for damage.
      const glowColor = p.powerups & POWERUP_DAMAGE_BIT ? '#c03cff' : p.powerups & POWERUP_SPEED_BIT ? '#36d6ff' : null;
      a.mat.emissiveColor = glowColor ? Color3.FromHexString(glowColor).scale(0.55) : Color3.Black();
      if (p.weapon !== a.weaponSlot) this.setAvatarWeapon(a, p.weapon);
    }
    for (const [slot, a] of this.avatars) {
      if (!seen.has(slot)) {
        a.body.dispose(false, true);
        this.avatars.delete(slot);
      }
    }
  }

  private setAvatarWeapon(a: Avatar, slot: number): void {
    a.weaponSlot = slot;
    a.weaponNode?.dispose();
    a.weaponNode = undefined;
    const def = WEAPONS_BY_SLOT.find((w) => w.slot === slot);
    if (!def) return;
    void this.models.instantiate(def.view.model, `held_${slot}`).then((node) => {
      if (a.weaponSlot !== slot || a.body.isDisposed()) return node.dispose();
      node.parent = a.body;
      // Right hand, chest height, pointing where the player faces.
      node.position.set(0.3, 0.25, 0.35);
      a.weaponNode = node;
    });
  }

  /** Players are capsules in their slot colour; NPCs wear their faction colour, a helmet and a red visor. */
  private createAvatar(slot: number, npc?: { color: string; scale: number }): Avatar {
    const body = CreateCapsule(`avatar_${slot}`, { height: PLAYER.height, radius: PLAYER.radius, tessellation: 12, subdivisions: 2 }, this.scene);
    const mat = solid(this.scene, `avatar_${slot}_mat`, npc?.color ?? slotColor(slot));
    body.material = mat;
    if (npc) {
      body.scaling.set(npc.scale, 1, npc.scale);
      const helmet = CreateSphere(`helmet_${slot}`, { diameter: PLAYER.radius * 2.3, segments: 8, slice: 0.5 }, this.scene);
      helmet.parent = body;
      helmet.position.y = PLAYER.height / 2 - 0.3;
      helmet.material = solid(this.scene, `helmet_${slot}_mat`, '#2b2f36');
      const pads = CreateBox(`pads_${slot}`, { width: PLAYER.radius * 2.6, height: 0.18, depth: PLAYER.radius * 1.3 }, this.scene);
      pads.parent = body;
      pads.position.y = 0.38;
      pads.material = helmet.material;
      for (const m of [helmet, pads]) m.isPickable = false;
    }
    // Visor shows facing direction at a glance.
    const visor = CreateBox(`visor_${slot}`, { width: 0.5, height: 0.14, depth: 0.2 }, this.scene);
    visor.parent = body;
    visor.position = new Vector3(0, PLAYER.eyeHeight - PLAYER.height / 2, PLAYER.radius - 0.05);
    visor.material = npc ? glow(this.scene, `visor_${slot}_mat`, '#ff3b30', 0.8) : solid(this.scene, `visor_${slot}_mat`, '#1c1f26');
    body.isPickable = false;
    return { body, mat, weaponSlot: -1 };
  }

  // ---------------------------------------------------------------- pickups

  private addPickup(e: PickupEntity): void {
    const root = createPickupVisual(this.scene, this.models, e.item, `pickup_${e.id}`);
    const baseY = e.position[1] + PICKUP_HOVER;
    root.position.set(e.position[0], baseY, e.position[2]);
    this.pickups.set(e.id, { root, baseY, phase: (e.position[0] * 7 + e.position[2] * 3) % (Math.PI * 2) });
  }

  /** Spin and bob pickups; hide the ones currently taken. */
  updatePickups(taken: ReadonlySet<string>, now: number): void {
    for (const [id, p] of this.pickups) {
      p.root.setEnabled(!taken.has(id));
      p.root.rotation.y = now * 0.0015 + p.phase;
      p.root.position.y = p.baseY + Math.sin(now * 0.003 + p.phase) * 0.08;
    }
  }

  // ---------------------------------------------------------------- projectiles & effects

  updateProjectiles(positions: ReadonlyMap<number, [number, number, number]>): void {
    for (const [id, pos] of positions) {
      let node = this.projectiles.get(id);
      if (!node) {
        node = new TransformNode(`proj_${id}`, this.scene);
        this.projectiles.set(id, node);
        const holder = node;
        void this.models.instantiate('projectiles/grenade.glb', `grenade_${id}`).then((m) => {
          if (holder.isDisposed()) return m.dispose();
          m.parent = holder;
        });
      }
      node.position.set(pos[0], pos[1], pos[2]);
      node.rotation.x += 0.3;
    }
    for (const [id, node] of this.projectiles) {
      if (!positions.has(id)) {
        node.dispose();
        this.projectiles.delete(id);
      }
    }
  }

  explosion(at: Vec3, radius: number): void {
    const ball = CreateSphere('boom', { diameter: 1, segments: 12 }, this.scene);
    const mat = glow(this.scene, 'boomMat', '#ffb347', 1);
    ball.material = mat;
    ball.position.set(at.x, at.y, at.z);
    ball.isPickable = false;
    this.effects.push({
      mesh: ball,
      born: performance.now(),
      ttl: 380,
      update: (f) => {
        ball.scaling.setAll(radius * 2 * (0.3 + 0.7 * Math.sqrt(f)));
        mat.alpha = 0.85 * (1 - f);
      },
    });
  }

  /** Chunks flying out of a broken crate, barrel or wall. */
  debris(at: Vec3, color: string, size: number): void {
    for (let k = 0; k < 10; k++) {
      const s = size * (0.15 + Math.random() * 0.2);
      const chunk = CreateBox('debris', { size: s }, this.scene);
      // Each effect disposes its own material when it ends.
      chunk.material = solid(this.scene, 'debrisMat', color);
      chunk.isPickable = false;
      const v = new Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6);
      const spin = new Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      const start = new Vector3(at.x, at.y, at.z);
      this.effects.push({
        mesh: chunk,
        born: performance.now(),
        ttl: 900,
        update: (f) => {
          const t = f * 0.9;
          chunk.position.set(start.x + v.x * t, Math.max(0.05 + at.y - size, start.y + v.y * t - 10 * t * t), start.z + v.z * t);
          chunk.rotation.set(spin.x * t, spin.y * t, spin.z * t);
          chunk.scaling.setAll(f > 0.7 ? (1 - f) / 0.3 : 1);
        },
      });
    }
  }

  /** Screen position (CSS px) of a world point, or null when it is behind the camera. */
  project(p: Vec3): { x: number; y: number } | null {
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const v = Vector3.Project(new Vector3(p.x, p.y, p.z), Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(w, h));
    if (v.z < 0 || v.z > 1) return null;
    const canvas = engine.getRenderingCanvas();
    const scale = canvas ? canvas.clientWidth / w : 1;
    return { x: v.x * scale, y: v.y * scale };
  }

  addTracer(from: Vec3, to: Vec3, color: string, ttlMs = 90): void {
    const mesh = CreateLines('tracer', { points: [new Vector3(from.x, from.y - 0.08, from.z), new Vector3(to.x, to.y, to.z)] }, this.scene);
    mesh.color = Color3.FromHexString(color);
    mesh.isPickable = false;
    this.effects.push({ mesh, born: performance.now(), ttl: ttlMs });
  }

  render(): void {
    const now = performance.now();
    this.effects = this.effects.filter((fx) => {
      const f = (now - fx.born) / fx.ttl;
      if (f >= 1) {
        fx.mesh.material?.dispose();
        fx.mesh.dispose();
        return false;
      }
      fx.update?.(f);
      return true;
    });
    this.scene.render();
  }

  dispose(): void {
    this.scene.dispose();
  }
}

function solid(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  return m;
}

function glow(scene: Scene, name: string, hex: string, strength = 1): StandardMaterial {
  const m = solid(scene, name, hex);
  m.emissiveColor = Color3.FromHexString(hex).scale(strength);
  return m;
}
