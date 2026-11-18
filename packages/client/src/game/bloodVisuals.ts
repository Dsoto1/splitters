import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { DEFAULT_BLOOD, type BloodAmount, type BloodKind, type EffectsWorld, type Vec3 } from '@tiletrigger/shared';
import { MeshPool } from './meshPool.ts';

/** The player's own switch (pause menu); the map's setting decides the rest. */
export const BLOOD_PREF_KEY = 'cs.blood';
export function bloodPreference(): boolean {
  try {
    return localStorage.getItem(BLOOD_PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * How a character's blood is drawn (its `blood` kind; docs/CHARACTERS.md, "Blood"; null: the map's). `color` null is
 * the map's colour; `drops` scales the spray; `splats` leaves splats and a pool (liquids only); `puff` is the cloud at
 * the hit (a quick mist, a bone-dust cloud that drifts, a pale wisp that rises and lingers); `fx` a pack effect played
 * with it (content/vfx.json map.gameplay: oil's Electric FX sparks, a spirit's wisp); `wet` the splat sound on a kill.
 */
export interface BloodStyle {
  color: string | null;
  drops: number;
  splats: boolean;
  puff: PuffKind;
  fx?: 'blood.oil' | 'blood.spirit';
  wet: boolean;
}
type PuffKind = 'mist' | 'dust' | 'wisp';
const LIQUID = { drops: 1, splats: true, puff: 'mist', wet: true } as const;
const STYLES: Readonly<Record<BloodKind | 'map', BloodStyle>> = {
  map: { color: null, ...LIQUID },
  red: { color: DEFAULT_BLOOD.color, ...LIQUID },
  // MapMaker's quick picks (Alien, Coolant, Oil).
  green: { color: '#3f9b1f', ...LIQUID },
  blue: { color: '#2a7fd0', ...LIQUID },
  oil: { color: '#1b1b1f', ...LIQUID, drops: 0.8, fx: 'blood.oil' },
  // Bone dust: a few pale chips and a dusty cloud, no splats.
  bone: { color: '#d4c8aa', drops: 0.5, splats: false, puff: 'dust', wet: false },
  // A ghost: no drops, no splats; a pale wisp that rises and fades (and the pack's, tinted pale).
  spirit: { color: '#dcebff', drops: 0, splats: false, puff: 'wisp', fx: 'blood.spirit', wet: false },
};
export const bloodStyle = (kind: BloodKind | null | undefined): BloodStyle => STYLES[kind ?? 'map'];

/** Each puff's start size (m), growth (m/s), rise (m/s), life (s) and how many: a quick mist, a drifting dust cloud, a wisp. */
const PUFFS: Readonly<Record<PuffKind, { size: number; grow: number; rise: number; life: number; count: number; easeIn: number }>> = {
  mist: { size: 0.15, grow: 2.2, rise: 0, life: 0.25, count: 1, easeIn: 0 },
  dust: { size: 0.22, grow: 1.1, rise: 0.35, life: 0.7, count: 2, easeIn: 0 },
  // Eased in over a fifth of a second (no pop, Reduce flashing or not), then fading as it rises.
  wisp: { size: 0.18, grow: 0.8, rise: 0.8, life: 0.9, count: 2, easeIn: 0.2 },
};

interface Drop {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  age: number;
  /** The colour its splat takes where it lands; null: it leaves none (bone chips). */
  color: Color3 | null;
}

interface Splat {
  /** Its world matrix (a row in the splats' thin-instance buffer). */
  matrix: Float32Array;
  born: number;
  /** Its colour (the splats' thin-instance colours; the material is white). */
  color: Color3;
}

interface Puff {
  mesh: InstancedMesh;
  age: number;
  kind: PuffKind;
}

/** A puff's opacity `age` seconds in: eased in (a wisp), then fading out over its life. */
export function puffAlpha(kind: PuffKind, age: number): number {
  const p = PUFFS[kind];
  const fade = Math.max(0, 1 - age / p.life);
  return p.easeIn > 0 ? Math.min(1, age / p.easeIn) * fade : fade;
}

/** Splats at once at most (heavy blood's cap). */
const MAX_SPLATS = 120;

const GRAVITY = 16;
const DROP_LIFE = 0.9;
/** Splats stay this long, then fade over SPLAT_FADE. */
const SPLAT_STAY = 7;
const SPLAT_FADE = 2;
/** Drops in the air at once at most (a 96-player brawl threw more than its pool held; past this nobody sees more). */
const MAX_DROPS = 500;
const MAX_MIST = 64;
/** Drops and mist are effects: no shadows from them or on them (see Atmosphere). */
const EFFECT = { effect: true };

/**
 * Light blood: a quick spray of droplets on a hit, a puff of mist, and small
 * splats where drops land (on floors and walls, along the shot), fading
 * after a few seconds. Colour and amount come from the map (green for
 * aliens, oil for robots, off for a clean map); players can switch it off.
 */
export class BloodVisuals {
  private drops: Drop[] = [];
  private splats: Splat[] = [];
  private mist: Puff[] = [];
  private readonly dropBase: Mesh;
  private readonly dropPool: MeshPool<Mesh>;
  /** Mist: GPU instances of one sphere, faded by their instance colour's alpha (one draw for them all). */
  private readonly mistBase: Mesh;
  private readonly mistPool: MeshPool<InstancedMesh>;
  /**
   * Splats: thin instances of one unit disc, scaled to their size and faded by their instance colour's alpha (one draw
   * and one mesh for them all; each was a mesh and a draw of its own, 50 in a busy fight's frame, then a GPU instance:
   * one draw, but still 50 meshes Babylon looked at every frame).
   */
  private readonly splatBase: Mesh;
  private readonly splatMatrices = new Float32Array(MAX_SPLATS * 16);
  private readonly splatColors = new Float32Array(MAX_SPLATS * 4).fill(1);
  private splatsDirty = false;
  private readonly splatMat: StandardMaterial;
  private readonly dropMat: StandardMaterial;
  private readonly mistMat: StandardMaterial;
  private amount: BloodAmount = DEFAULT_BLOOD.amount;
  /** The map's colour: blood for anyone whose character has no `blood` of its own. */
  private mapColor = Color3.FromHexString(DEFAULT_BLOOD.color);
  private readonly kindColors = new Map<string, Color3>();
  enabled = true;
  /** Plays a pack effect at a hit (content/vfx.json map.gameplay `blood.oil`, `blood.spirit`); View sets it (and calms it with Reduce flashing). */
  onFx: ((key: 'blood.oil' | 'blood.spirit', at: Vec3) => void) | null = null;

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
    // White materials, coloured per drop, puff and splat (their instance colours multiply the lit colour and the
    // emissive alike, so a drop is lit as it was when the material carried the map's colour).
    this.dropMat.diffuseColor = Color3.White();
    this.dropMat.emissiveColor = new Color3(0.15, 0.15, 0.15);
    this.splatMat.diffuseColor = Color3.White();
    this.mistMat.diffuseColor = Color3.White();
    this.mistMat.emissiveColor = new Color3(0.2, 0.2, 0.2);
    this.dropBase = CreateSphere('bloodDropBase', { diameter: 1, segments: 3 }, scene);
    this.dropBase.material = this.dropMat;
    this.dropBase.isPickable = false;
    // Instances only draw while their source is enabled, so the source stays on, shrunk to nothing.
    this.dropBase.scaling.setAll(0);
    this.dropBase.alwaysSelectAsActiveMesh = true;
    this.dropBase.metadata = EFFECT;
    this.dropBase.registerInstancedBuffer('color', 4);
    this.dropBase.instancedBuffers.color = new Color4(1, 1, 1, 1);
    this.dropPool = new MeshPool(() => {
      const m = this.dropBase.createInstance('bloodDrop') as unknown as Mesh;
      m.isPickable = false;
      m.metadata = EFFECT;
      (m as unknown as InstancedMesh).instancedBuffers.color = new Color4(1, 1, 1, 1);
      return m;
    }, MAX_DROPS);
    this.mistBase = CreateSphere('bloodMistBase', { diameter: 1, segments: 4 }, scene);
    this.mistBase.material = this.mistMat;
    this.mistBase.isPickable = false;
    this.mistBase.metadata = EFFECT;
    this.mistBase.registerInstancedBuffer('color', 4);
    this.mistBase.instancedBuffers.color = new Color4(1, 1, 1, 1);
    this.mistBase.hasVertexAlpha = true;
    this.mistBase.scaling.setAll(0);
    this.mistBase.alwaysSelectAsActiveMesh = true;
    this.mistPool = new MeshPool(() => {
      const m = this.mistBase.createInstance('bloodMist');
      m.isPickable = false;
      m.metadata = EFFECT;
      m.instancedBuffers.color = new Color4(1, 1, 1, 1);
      return m;
    }, MAX_MIST);
    this.splatBase = CreateDisc('bloodSplatBase', { radius: 1, tessellation: 9 }, scene);
    this.splatBase.material = this.splatMat;
    this.splatBase.isPickable = false;
    // Flat on a surface: it catches shadows but casts none.
    this.splatBase.metadata = { castsNoShadow: true };
    this.splatBase.thinInstanceSetBuffer('matrix', this.splatMatrices, 16, false);
    this.splatBase.thinInstanceSetBuffer('color', this.splatColors, 4, false);
    this.splatBase.thinInstanceCount = 0;
    this.splatBase.hasVertexAlpha = true;
    this.splatBase.alwaysSelectAsActiveMesh = true;
    this.splatBase.doNotSyncBoundingInfo = true;
    this.splatBase.freezeWorldMatrix();
    this.setLook(DEFAULT_BLOOD.color, DEFAULT_BLOOD.amount);
  }

  /** Build blood's shaders while the match loads (see MeshPool.warm): a drop, mist, a splat and a fading splat. */
  warm(): void {
    this.dropPool.warm((m) => m.scaling.setAll(0.05));
    this.mistPool.warm((m) => m.scaling.setAll(0.3));
    // A splat out of sight (its shader, with the thin instances' colours, is built with the rest): gone in a frame.
    this.splats.push({ matrix: Float32Array.from(Matrix.Compose(new Vector3(0.3, 0.25, 0.3), Quaternion.Identity(), new Vector3(0, -10000, 0)).m), born: performance.now() - (SPLAT_STAY + SPLAT_FADE) * 1000 + 50, color: this.mapColor });
    this.splatsDirty = true;
    this.flushSplats();
  }

  setLook(color: string, amount: BloodAmount): void {
    this.amount = amount;
    this.mapColor = Color3.FromHexString(color);
  }

  /** Blood is drawn (the map allows it and the player hasn't switched it off). */
  get on(): boolean {
    return this.enabled && this.amount !== 'off';
  }

  /** A kill of a character of this kind makes the wet splat sound (blood is on and it bleeds a liquid). */
  wet(kind: BloodKind | null = null): boolean {
    return this.on && bloodStyle(kind).wet;
  }

  private colorOf(style: BloodStyle): Color3 {
    if (!style.color) return this.mapColor;
    let c = this.kindColors.get(style.color);
    if (!c) this.kindColors.set(style.color, (c = Color3.FromHexString(style.color)));
    return c;
  }

  /**
   * A hit at `at`, the shot travelling along `dir`; `strength` 1 for a bullet, more for big hits; `kind` what the
   * character hit bleeds (its `blood`; null: the map's).
   */
  hit(at: Vec3, dir: Vec3, strength = 1, kind: BloodKind | null = null): void {
    if (!this.on) return;
    const style = bloodStyle(kind);
    const color = this.colorOf(style);
    const heavy = this.amount === 'heavy';
    const n = Math.round((heavy ? 14 : 6) * Math.min(2.5, strength) * style.drops);
    const d = new Vector3(dir.x, dir.y, dir.z).normalize();
    for (let i = 0; i < n; i++) {
      const v = d.scale(2 + Math.random() * 3 * strength).add(new Vector3((Math.random() - 0.5) * 3, Math.random() * 2.2, (Math.random() - 0.5) * 3));
      this.drop(new Vector3(at.x, at.y, at.z), v, color, style.splats);
    }
    const puff = PUFFS[style.puff];
    for (let i = 0; i < puff.count && this.mist.length < MAX_MIST; i++) {
      const m = this.mistPool.take();
      m.scaling.setAll(puff.size);
      const c = m.instancedBuffers.color as Color4;
      c.set(color.r, color.g, color.b, puff.easeIn ? 0 : 1);
      // Further puffs of a cloud a little off the first, along the shot.
      const k = i * 0.12;
      m.position.set(at.x + d.x * k + (Math.random() - 0.5) * k, at.y + d.y * k + Math.random() * k, at.z + d.z * k + (Math.random() - 0.5) * k);
      this.mist.push({ mesh: m, age: 0, kind: style.puff });
    }
    if (style.fx) this.onFx?.(style.fx, at);
    if (!style.splats) return;
    // A splat on whatever is right behind the target, along the shot.
    const wall = this.physics()?.raycast(at, { x: d.x, y: d.y, z: d.z }, heavy ? 3 : 1.8);
    if (wall) this.splat(new Vector3(at.x + d.x * wall.dist, at.y + d.y * wall.dist, at.z + d.z * wall.dist), wall.normal, 0.25 + Math.random() * 0.2 * strength, color);
  }

  /** A kill: a bigger burst, and a small pool on the ground under the body (liquids only). */
  kill(at: Vec3, kind: BloodKind | null = null): void {
    if (!this.on) return;
    this.hit(at, { x: 0, y: 0.4, z: 0 }, 1.6, kind);
    const style = bloodStyle(kind);
    if (!style.splats) return;
    const ground = this.physics()?.raycast(at, { x: 0, y: -1, z: 0 }, 3);
    if (ground) this.splat(new Vector3(at.x, at.y - ground.dist, at.z), ground.normal, this.amount === 'heavy' ? 0.9 : 0.55, this.colorOf(style));
  }

  private drop(pos: Vector3, vel: Vector3, color: Color3, splats: boolean): void {
    if (this.drops.length >= MAX_DROPS) return;
    const mesh = this.dropPool.take();
    mesh.scaling.setAll(0.03 + Math.random() * 0.05);
    mesh.position.copyFrom(pos);
    ((mesh as unknown as InstancedMesh).instancedBuffers.color as Color4).set(color.r, color.g, color.b, 1);
    this.drops.push({ mesh, pos, vel, age: 0, color: splats ? color : null });
  }

  private splat(at: Vector3, normal: Vec3, radius: number, color: Color3): void {
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();
    // Discs face -Z; turn them to face out of the surface, with a random twist.
    const q = new Quaternion();
    const turn = new Quaternion();
    Quaternion.FromUnitVectorsToRef(new Vector3(0, 0, -1), n, q);
    q.multiplyToRef(Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.random() * Math.PI * 2), turn);
    const m = Matrix.Compose(new Vector3(radius, radius * (0.6 + Math.random() * 0.5), radius), turn, at.add(n.scale(0.015)));
    // Splats a fifth darker than the drops, as they were.
    this.splats.push({ matrix: Float32Array.from(m.m), born: performance.now(), color: color.scale(0.8) });
    const cap = this.amount === 'heavy' ? MAX_SPLATS : 50;
    while (this.splats.length > cap) this.splats.shift();
    this.splatsDirty = true;
  }

  /** Splats lying now (tests). */
  get splatCount(): number {
    return this.splats.length;
  }

  /** The splats into their thin-instance buffers (when one came, went or is fading). */
  private flushSplats(): void {
    if (!this.splatsDirty) return;
    this.splatsDirty = false;
    const now = performance.now();
    let i = 0;
    for (const s of this.splats) {
      const age = (now - s.born) / 1000;
      this.splatMatrices.set(s.matrix, i * 16);
      this.splatColors[i * 4] = s.color.r;
      this.splatColors[i * 4 + 1] = s.color.g;
      this.splatColors[i * 4 + 2] = s.color.b;
      this.splatColors[i * 4 + 3] = age > SPLAT_STAY ? Math.max(0, 1 - (age - SPLAT_STAY) / SPLAT_FADE) : 1;
      i++;
    }
    this.splatBase.thinInstanceCount = i;
    this.splatBase.thinInstanceBufferUpdated('matrix');
    this.splatBase.thinInstanceBufferUpdated('color');
    // Always drawn when any are there (alwaysSelectAsActiveMesh): no bounds to keep.
    this.splatBase.setEnabled(i > 0);
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
        if (hit && d.color && Math.random() < 0.6) this.splat(d.pos.add(step.scale(hit.dist / len)), hit.normal, 0.05 + Math.random() * 0.09, d.color);
        this.dropPool.give(d.mesh);
        return false;
      }
      d.pos.addInPlace(step);
      d.mesh.position.copyFrom(d.pos);
      return true;
    });
    this.mist = this.mist.filter((m) => {
      m.age += dt;
      const p = PUFFS[m.kind];
      m.mesh.scaling.setAll(p.size + m.age * p.grow);
      m.mesh.position.y += p.rise * dt;
      (m.mesh.instancedBuffers.color as Color4).a = puffAlpha(m.kind, m.age);
      if (m.age < p.life) return true;
      this.mistPool.give(m.mesh);
      return false;
    });
    const now = performance.now();
    const before = this.splats.length;
    this.splats = this.splats.filter((s) => (now - s.born) / 1000 <= SPLAT_STAY + SPLAT_FADE);
    if (this.splats.length !== before || this.splats.some((s) => (now - s.born) / 1000 > SPLAT_STAY)) this.splatsDirty = true;
    this.flushSplats();
  }

  dispose(): void {
    for (const d of this.drops) d.mesh.dispose();
    this.splats = [];
    for (const m of this.mist) m.mesh.dispose();
    for (const p of [this.dropPool, this.mistPool]) p.dispose();
    this.mistBase.dispose();
    this.splatBase.dispose();
    this.dropBase.dispose();
    for (const m of [this.dropMat, this.splatMat, this.mistMat]) m.dispose();
  }
}
