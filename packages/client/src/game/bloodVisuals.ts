import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DEFAULT_BLOOD, type BloodAmount, type EffectsWorld, type Vec3 } from '@chronosplit/shared';

/** The player's own switch (pause menu); the map's setting decides the rest. */
export const BLOOD_PREF_KEY = 'cs.blood';
export function bloodPreference(): boolean {
  try {
    return localStorage.getItem(BLOOD_PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

interface Drop {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  age: number;
}

interface Splat {
  mesh: Mesh;
  born: number;
}

const GRAVITY = 16;
const DROP_LIFE = 0.9;
/** Splats stay this long, then fade over SPLAT_FADE. */
const SPLAT_STAY = 7;
const SPLAT_FADE = 2;

/**
 * Light blood: a quick spray of droplets on a hit, a puff of mist, and small
 * splats where drops land (on floors and walls, along the shot), fading
 * after a few seconds. Colour and amount come from the map (green for
 * aliens, oil for robots, off for a clean map); players can switch it off.
 */
export class BloodVisuals {
  private drops: Drop[] = [];
  private splats: Splat[] = [];
  private mist: { mesh: Mesh; age: number }[] = [];
  private readonly dropBase: Mesh;
  private readonly splatMat: StandardMaterial;
  private readonly dropMat: StandardMaterial;
  private readonly mistMat: StandardMaterial;
  private amount: BloodAmount = DEFAULT_BLOOD.amount;
  enabled = true;

  constructor(
    private readonly scene: Scene,
    private readonly physics: () => EffectsWorld | null,
  ) {
    this.dropMat = new StandardMaterial('bloodDrop', scene);
    this.splatMat = new StandardMaterial('bloodSplat', scene);
    this.splatMat.zOffset = -2;
    this.mistMat = new StandardMaterial('bloodMist', scene);
    this.mistMat.alpha = 0.35;
    for (const m of [this.dropMat, this.splatMat, this.mistMat]) m.specularColor = new Color3(0.25, 0.25, 0.25);
    this.dropBase = CreateSphere('bloodDropBase', { diameter: 1, segments: 3 }, scene);
    this.dropBase.material = this.dropMat;
    this.dropBase.isPickable = false;
    // Instances only draw while their source is enabled, so the source stays on, shrunk to nothing.
    this.dropBase.scaling.setAll(0);
    this.dropBase.alwaysSelectAsActiveMesh = true;
    this.setLook(DEFAULT_BLOOD.color, DEFAULT_BLOOD.amount);
  }

  setLook(color: string, amount: BloodAmount): void {
    this.amount = amount;
    const c = Color3.FromHexString(color);
    this.dropMat.diffuseColor = c;
    this.dropMat.emissiveColor = c.scale(0.15);
    this.splatMat.diffuseColor = c.scale(0.8);
    this.mistMat.diffuseColor = c;
    this.mistMat.emissiveColor = c.scale(0.2);
  }

  /** Blood is drawn (the map allows it and the player hasn't switched it off). */
  get on(): boolean {
    return this.enabled && this.amount !== 'off';
  }

  /** A hit at `at`, the shot travelling along `dir`; `strength` 1 for a bullet, more for big hits. */
  hit(at: Vec3, dir: Vec3, strength = 1): void {
    if (!this.on) return;
    const heavy = this.amount === 'heavy';
    const n = Math.round((heavy ? 14 : 6) * Math.min(2.5, strength));
    const d = new Vector3(dir.x, dir.y, dir.z).normalize();
    for (let i = 0; i < n; i++) {
      const v = d.scale(2 + Math.random() * 3 * strength).add(new Vector3((Math.random() - 0.5) * 3, Math.random() * 2.2, (Math.random() - 0.5) * 3));
      this.drop(new Vector3(at.x, at.y, at.z), v);
    }
    const puff = CreateSphere('bloodMist', { diameter: 1, segments: 4 }, this.scene);
    puff.material = this.mistMat;
    puff.isPickable = false;
    puff.position.set(at.x, at.y, at.z);
    this.mist.push({ mesh: puff, age: 0 });
    // A splat on whatever is right behind the target, along the shot.
    const wall = this.physics()?.raycast(at, { x: d.x, y: d.y, z: d.z }, heavy ? 3 : 1.8);
    if (wall) this.splat(new Vector3(at.x + d.x * wall.dist, at.y + d.y * wall.dist, at.z + d.z * wall.dist), wall.normal, 0.25 + Math.random() * 0.2 * strength);
  }

  /** A kill: a bigger burst, and a small pool on the ground under the body. */
  kill(at: Vec3): void {
    if (!this.on) return;
    this.hit(at, { x: 0, y: 0.4, z: 0 }, 1.6);
    const ground = this.physics()?.raycast(at, { x: 0, y: -1, z: 0 }, 3);
    if (ground) this.splat(new Vector3(at.x, at.y - ground.dist, at.z), ground.normal, this.amount === 'heavy' ? 0.9 : 0.55);
  }

  private drop(pos: Vector3, vel: Vector3): void {
    const mesh = this.dropBase.createInstance('bloodDrop') as unknown as Mesh;
    mesh.scaling.setAll(0.03 + Math.random() * 0.05);
    mesh.position.copyFrom(pos);
    mesh.isPickable = false;
    this.drops.push({ mesh, pos, vel, age: 0 });
  }

  private splat(at: Vector3, normal: Vec3, radius: number): void {
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();
    const disc = CreateDisc('bloodSplat', { radius, tessellation: 9 }, this.scene);
    disc.material = this.splatMat;
    disc.isPickable = false;
    disc.position = at.add(n.scale(0.015));
    // Discs face -Z; turn them to face out of the surface, with a random twist.
    const q = new Quaternion();
    Quaternion.FromUnitVectorsToRef(new Vector3(0, 0, -1), n, q);
    disc.rotationQuaternion = q.multiply(Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.random() * Math.PI * 2));
    disc.scaling.set(1, 0.6 + Math.random() * 0.5, 1);
    this.splats.push({ mesh: disc, born: performance.now() });
    const cap = this.amount === 'heavy' ? 120 : 50;
    while (this.splats.length > cap) this.splats.shift()!.mesh.dispose();
  }

  /** Move drops, fade mist and old splats. Call every frame. */
  update(dt: number): void {
    const physics = this.physics();
    this.drops = this.drops.filter((d) => {
      d.age += dt;
      d.vel.y -= GRAVITY * dt;
      const step = d.vel.scale(dt);
      const len = step.length();
      const hit = len > 0 && physics ? physics.raycast(d.pos, { x: step.x / len, y: step.y / len, z: step.z / len }, len) : null;
      if (hit || d.age > DROP_LIFE) {
        if (hit && Math.random() < 0.6) this.splat(d.pos.add(step.scale(hit.dist / len)), hit.normal, 0.05 + Math.random() * 0.09);
        d.mesh.dispose();
        return false;
      }
      d.pos.addInPlace(step);
      d.mesh.position.copyFrom(d.pos);
      return true;
    });
    this.mist = this.mist.filter((m) => {
      m.age += dt;
      m.mesh.scaling.setAll(0.15 + m.age * 2.2);
      m.mesh.visibility = Math.max(0, 1 - m.age / 0.25);
      if (m.age < 0.25) return true;
      m.mesh.dispose();
      return false;
    });
    const now = performance.now();
    this.splats = this.splats.filter((s) => {
      const age = (now - s.born) / 1000;
      if (age > SPLAT_STAY + SPLAT_FADE) {
        s.mesh.dispose();
        return false;
      }
      s.mesh.visibility = age > SPLAT_STAY ? 1 - (age - SPLAT_STAY) / SPLAT_FADE : 1;
      return true;
    });
  }

  dispose(): void {
    for (const d of this.drops) d.mesh.dispose();
    for (const s of this.splats) s.mesh.dispose();
    for (const m of this.mist) m.mesh.dispose();
    this.dropBase.dispose();
    for (const m of [this.dropMat, this.splatMat, this.mistMat]) m.dispose();
  }
}
