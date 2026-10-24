import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { EffectsWorld, Vec3 } from '@chronosplit/shared';

/** How fast drawn rounds fly (m/s): slow enough to see leave the muzzle and land, fast enough to feel like bullets. */
export const BULLET_SPEED = 260;
/** Bullet holes kept per match (oldest reused first). */
const MAX_HOLES = 700;
const STREAK_LENGTH = 2.2;

interface Bullet {
  mesh: InstancedMesh;
  from: Vector3;
  dir: Vector3;
  dist: number;
  travelled: number;
  onArrive?: () => void;
}

interface Spark {
  mesh: InstancedMesh;
  pos: Vector3;
  vel: Vector3;
  age: number;
  life: number;
}

interface Puff {
  mesh: Mesh;
  age: number;
  life: number;
  grow: number;
  rise?: number;
  base?: number;
}

/**
 * Drawn-only shot feedback: each round is a bright streak that flies from
 * the muzzle to where the shot landed, then the surface reacts: a bullet
 * hole that stays for the whole match, sparks and a puff of dust. Bodies
 * are handled by the caller (blood) through `onArrive`.
 */
export class ImpactVisuals {
  private bullets: Bullet[] = [];
  private sparks: Spark[] = [];
  private puffs: Puff[] = [];
  private readonly streak: Mesh;
  private readonly spark: Mesh;
  private readonly holes: Mesh;
  private readonly dustMat: StandardMaterial;
  private holeCount = 0;
  private holeNext = 0;
  private readonly holeMatrices = new Float32Array(MAX_HOLES * 16);

  constructor(
    private readonly scene: Scene,
    private readonly physics: () => EffectsWorld | null,
  ) {
    // Streaks: unit-length boxes along +z, tinted per instance.
    this.streak = CreateBox('bulletStreak', { width: 0.025, height: 0.025, depth: 1 }, scene);
    this.streak.bakeTransformIntoVertices(Matrix.Translation(0, 0, -0.5));
    const streakMat = new StandardMaterial('bulletStreakMat', scene);
    streakMat.disableLighting = true;
    streakMat.emissiveColor = Color3.White();
    this.streak.material = streakMat;
    this.streak.registerInstancedBuffer('color', 4);
    this.streak.instancedBuffers.color = new Color4(1, 0.9, 0.6, 1);
    this.prepareSource(this.streak);

    this.spark = CreateSphere('impactSpark', { diameter: 1, segments: 2 }, scene);
    const sparkMat = new StandardMaterial('impactSparkMat', scene);
    sparkMat.disableLighting = true;
    sparkMat.emissiveColor = new Color3(1, 0.78, 0.35);
    this.spark.material = sparkMat;
    this.prepareSource(this.spark);

    this.dustMat = new StandardMaterial('impactDustMat', scene);
    this.dustMat.diffuseColor = new Color3(0.55, 0.52, 0.47);
    this.dustMat.specularColor = Color3.Black();
    this.dustMat.alpha = 0.5;

    // Bullet holes: one mesh, one thin instance per hole.
    this.holes = CreateDisc('bulletHoles', { radius: 0.05, tessellation: 10 }, scene);
    const holeMat = new StandardMaterial('bulletHoleMat', scene);
    holeMat.diffuseTexture = holeTexture(scene);
    holeMat.diffuseTexture.hasAlpha = true;
    holeMat.useAlphaFromDiffuseTexture = true;
    holeMat.specularColor = new Color3(0.05, 0.05, 0.05);
    holeMat.zOffset = -3;
    holeMat.backFaceCulling = false;
    this.holes.material = holeMat;
    this.holes.isPickable = false;
    this.holes.alwaysSelectAsActiveMesh = true;
    this.holes.thinInstanceSetBuffer('matrix', this.holeMatrices, 16, false);
    this.holes.thinInstanceCount = 0;
  }

  /** Sources stay enabled (instances draw only while their source does) but shrunk away. */
  private prepareSource(m: Mesh): void {
    m.isPickable = false;
    m.alwaysSelectAsActiveMesh = true;
    m.scaling.setAll(0);
  }

  /** A round flying from `from` to `to`; `onArrive` runs when it gets there. */
  fire(from: Vec3, to: Vec3, color: string, onArrive?: () => void, startAt = 0): void {
    const a = new Vector3(from.x, from.y, from.z);
    const d = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
    const dist = d.length();
    if (dist < 0.05) {
      onArrive?.();
      return;
    }
    d.scaleInPlace(1 / dist);
    const mesh = this.streak.createInstance('bullet');
    mesh.scaling.set(1, 1, 0.01);
    const c = Color3.FromHexString(color);
    // Brighter than the team colour, so rounds read against any background.
    mesh.instancedBuffers.color = new Color4(Math.min(1, c.r * 0.6 + 0.5), Math.min(1, c.g * 0.6 + 0.5), Math.min(1, c.b * 0.6 + 0.45), 1);
    mesh.isPickable = false;
    // From +z to the flight direction directly: a look-at with an "up" breaks for shots fired
    // nearly straight up or down, which turned the streak sideways into a flat disc.
    mesh.rotationQuaternion = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Forward(), d, mesh.rotationQuaternion);
    mesh.position.copyFrom(a);
    // Your own rounds start a little out from the muzzle: right at the gun they'd smear across the view.
    this.bullets.push({ mesh, from: a, dir: d, dist, travelled: Math.min(startAt, dist * 0.5), onArrive });
  }

  /** Where a shot ending at `to` (coming from `from`) hits the level, if it does: point and surface normal. */
  surfaceHit(from: Vec3, to: Vec3): { point: Vec3; normal: Vec3 } | null {
    const world = this.physics();
    if (!world) return null;
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 0.05) return null;
    const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
    const hit = world.raycast(from, dir, len + 0.15);
    // Shots that ran out of range in the open, or stopped on something dynamic, leave no hole.
    if (!hit || Math.abs(hit.dist - len) > 0.35) return null;
    return { point: { x: from.x + dir.x * hit.dist, y: from.y + dir.y * hit.dist, z: from.z + dir.z * hit.dist }, normal: hit.normal };
  }

  /** A round hitting a wall or floor: a hole that stays, sparks and dust. */
  wallImpact(point: Vec3, normal: Vec3, size = 1): void {
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();
    const q = new Quaternion();
    Quaternion.FromUnitVectorsToRef(new Vector3(0, 0, -1), n, q);
    const twist = Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.random() * Math.PI * 2);
    const s = size * (0.8 + Math.random() * 0.4);
    const m = Matrix.Compose(new Vector3(s, s, s), q.multiply(twist), new Vector3(point.x + n.x * 0.01, point.y + n.y * 0.01, point.z + n.z * 0.01));
    m.copyToArray(this.holeMatrices, this.holeNext * 16);
    this.holeNext = (this.holeNext + 1) % MAX_HOLES;
    this.holeCount = Math.min(MAX_HOLES, this.holeCount + 1);
    this.holes.thinInstanceCount = this.holeCount;
    this.holes.thinInstanceBufferUpdated('matrix');
    for (let i = 0; i < 5; i++) {
      const v = n.scale(2 + Math.random() * 3).add(new Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
      const mesh = this.spark.createInstance('spark');
      mesh.isPickable = false;
      mesh.scaling.setAll(0.025 + Math.random() * 0.02);
      const pos = new Vector3(point.x, point.y, point.z).add(n.scale(0.03));
      mesh.position.copyFrom(pos);
      this.sparks.push({ mesh, pos, vel: v, age: 0, life: 0.18 + Math.random() * 0.15 });
    }
    const puff = CreateSphere('impactDust', { diameter: 1, segments: 4 }, this.scene);
    puff.material = this.dustMat;
    puff.isPickable = false;
    puff.position.set(point.x + n.x * 0.12, point.y + n.y * 0.12, point.z + n.z * 0.12);
    puff.scaling.setAll(0.05);
    this.puffs.push({ mesh: puff, age: 0, life: 0.45, grow: 0.5 * size });
  }

  private readonly puffMats = new Map<string, StandardMaterial>();

  /** A soft puff that grows, rises and fades (vehicle smoke and fire). */
  puff(at: Vec3, hex: string, size: number, life: number, rise: number, glow = false): void {
    let mat = this.puffMats.get(hex);
    if (!mat) {
      mat = new StandardMaterial(`puff_${hex}`, this.scene);
      mat.diffuseColor = Color3.FromHexString(hex);
      mat.specularColor = Color3.Black();
      if (glow) mat.emissiveColor = Color3.FromHexString(hex);
      mat.alpha = glow ? 0.85 : 0.55;
      this.puffMats.set(hex, mat);
    }
    const mesh = CreateSphere('puff', { diameter: 1, segments: 4 }, this.scene);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.position.set(at.x, at.y, at.z);
    mesh.scaling.setAll(size * 0.3);
    this.puffs.push({ mesh, age: 0, life, grow: size, rise, base: size * 0.3 });
  }

  /** Bullet holes currently in the level (for tests). */
  get holesInLevel(): number {
    return this.holeCount;
  }

  update(dt: number): void {
    this.bullets = this.bullets.filter((b) => {
      b.travelled += BULLET_SPEED * dt;
      const head = Math.min(b.travelled, b.dist);
      const tail = Math.max(0, head - STREAK_LENGTH);
      b.mesh.position.copyFrom(b.from.add(b.dir.scale(head)));
      b.mesh.scaling.z = Math.max(0.01, head - tail);
      if (b.travelled < b.dist) return true;
      b.mesh.dispose();
      b.onArrive?.();
      return false;
    });
    this.sparks = this.sparks.filter((s) => {
      s.age += dt;
      s.vel.y -= 14 * dt;
      s.pos.addInPlace(s.vel.scale(dt));
      s.mesh.position.copyFrom(s.pos);
      if (s.age < s.life) return true;
      s.mesh.dispose();
      return false;
    });
    this.puffs = this.puffs.filter((p) => {
      p.age += dt;
      const f = p.age / p.life;
      p.mesh.scaling.setAll((p.base ?? 0.05) + p.grow * f);
      if (p.rise) p.mesh.position.y += p.rise * dt;
      p.mesh.visibility = Math.max(0, 1 - f);
      if (f < 1) return true;
      p.mesh.dispose();
      return false;
    });
  }

  dispose(): void {
    for (const b of this.bullets) b.mesh.dispose();
    for (const s of this.sparks) s.mesh.dispose();
    for (const p of this.puffs) p.mesh.dispose();
    this.streak.dispose();
    this.spark.dispose();
    this.holes.dispose();
  }
}

/** A dark, ragged hole with a lighter chipped rim (drawn once, in code). */
function holeTexture(scene: Scene): DynamicTexture {
  const size = 64;
  const tex = new DynamicTexture('bulletHoleTex', { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;
  const rim = ctx.createRadialGradient(c, c, 4, c, c, c);
  rim.addColorStop(0, 'rgba(20,18,16,1)');
  rim.addColorStop(0.3, 'rgba(35,32,28,0.95)');
  rim.addColorStop(0.55, 'rgba(120,112,100,0.55)');
  rim.addColorStop(1, 'rgba(120,112,100,0)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  // A few cracks radiating out.
  ctx.strokeStyle = 'rgba(30,27,24,0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + i * 0.7;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 7, c + Math.sin(a) * 7);
    ctx.lineTo(c + Math.cos(a) * (14 + (i % 3) * 5), c + Math.sin(a) * (14 + (i % 3) * 5));
    ctx.stroke();
  }
  tex.update();
  return tex;
}
