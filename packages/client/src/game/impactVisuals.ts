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
import type { EffectsWorld, SurfaceTypeId, Vec3, WorldBox } from '@tiletrigger/shared';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshPool } from './meshPool.ts';
import { HoleBook, PROP_HOLE_CAP, PROP_HOLED_MAX, holeLook } from './propHoles.ts';

/** How fast drawn rounds fly (m/s): slow enough to see leave the muzzle and land, fast enough to feel like bullets. */
export const BULLET_SPEED = 260;
/** Bullet holes kept on one block the scenario drives (holeOn; the oldest reused first). */
const MAX_BLOCK_HOLES = 48;

/** Bullet holes kept per match (oldest reused first). */
const MAX_HOLES = 700;
const STREAK_LENGTH = 2.2;
/** Dust with no surface given: the grey-brown it always was. */
const DUST = new Color3(0.55, 0.52, 0.47);
const dustColours = new Map<string, Color3>();
function dustColour(hex: string | undefined): Color3 {
  if (!hex) return DUST;
  let c = dustColours.get(hex);
  if (!c) dustColours.set(hex, (c = Color3.FromHexString(hex)));
  return c;
}

interface Bullet {
  /** Null for rounds that fly without a tracer (they still land). */
  mesh: InstancedMesh | null;
  from: Vector3;
  dir: Vector3;
  dist: number;
  travelled: number;
  /** m/s: real muzzle velocity for bullets (GUNPLAY_SPEC §4), BULLET_SPEED for everything else. */
  speed: number;
  /** Streak length (m): faster rounds draw longer streaks so they still read. */
  length: number;
  onArrive?: () => void;
  /** Where it flies to (world). */
  to: Vector3;
  /** The gun it leaves, asked once when the frame it first shows is drawn (settleStarts): its start goes on the muzzle as drawn. */
  start?: () => Vec3 | null;
}

/** Streak instances kept for reuse (pooled: automatic fire would otherwise create and dispose one per round). */
const MAX_POOLED_STREAKS = 256;
/** Sparks alive at once at most: a 96-player brawl threw 1,500, and past a few hundred more add nothing to see. */
const MAX_SPARKS = 600;
/** Chips (splinters, leaves, grit) from wall hits alive at once at most. */
const MAX_CHIPS = 300;
/** Dust puffs from wall hits, and smoke puffs, alive at once at most. */
const MAX_DUST = 200;
const MAX_PUFFS = 120;
/** No shadows from effects or on them (see Atmosphere). */
const EFFECT = { effect: true };

interface Dust {
  mesh: InstancedMesh;
  age: number;
  life: number;
  grow: number;
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
  /** Drift (m/s) that dies away over the puff's life (a muzzle's smoke rolling out). */
  drift?: Vector3;
}

/**
 * Drawn-only shot feedback: each round is a bright streak that flies from
 * the muzzle to where the shot landed, then the surface reacts: a bullet
 * hole that stays for the whole match, sparks and a puff of dust. Bodies
 * are handled by the caller (blood) through `onArrive`.
 */
export class ImpactVisuals {
  private bullets: Bullet[] = [];
  private readonly streakPool: InstancedMesh[] = [];
  private sparks: Spark[] = [];
  /** Splinters, leaves and grit: lit flakes tinted per instance (the surface type's chip colour), falling like sparks. */
  private chips: Spark[] = [];
  private readonly chip: Mesh;
  private readonly chipPool: MeshPool<InstancedMesh>;
  private puffs: Puff[] = [];
  private readonly streak: Mesh;
  private readonly spark: Mesh;
  private readonly sparkPool: MeshPool<InstancedMesh>;
  /** Wall-hit dust: GPU instances of one sphere, faded by their instance colour's alpha (one draw for them all). */
  private readonly dust: Mesh;
  private readonly dustPool: MeshPool<InstancedMesh>;
  private dusts: Dust[] = [];
  /** Dust and smoke puffs (each its own mesh: they fade one by one). */
  private readonly puffPool: MeshPool<Mesh>;
  private readonly holes: Mesh;
  private readonly dustMat: StandardMaterial;
  private holeCount = 0;
  private holeNext = 0;
  /** Holes made since the last upload (first and last index): sent to the GPU once a frame, not the whole buffer per hit. */
  private holeDirty: [number, number] | null = null;
  private readonly holeMatrices = new Float32Array(MAX_HOLES * 16);
  /** Holes on blocks the scenario drives, by the block's body (holeOn); they go with the block's meshes. */
  private readonly blockHoles = new WeakMap<Mesh, { mesh: Mesh; buf: Float32Array; count: number; next: number }>();
  /** Holes on breakable props (propHoles.ts): which props have how many (a cap each, a budget of props), and their meshes. */
  private readonly propBook = new HoleBook<TransformNode>(PROP_HOLE_CAP, PROP_HOLED_MAX);
  private readonly propHoleMeshes = new Map<TransformNode, { mesh: Mesh; buf: Float32Array }>();
  /** The hole decal tinted for a surface (wood, metal, stone), made once each. */
  private readonly holeLookMats = new Map<string, StandardMaterial>();

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
    this.sparkPool = new MeshPool(() => {
      const m = this.spark.createInstance('spark');
      m.isPickable = false;
      return m;
    }, MAX_SPARKS);
    this.chip = CreateBox('impactChip', { width: 1, height: 0.35, depth: 0.5 }, scene);
    const chipMat = new StandardMaterial('impactChipMat', scene);
    // White: each chip takes its colour from its instance (the surface type's `chip` colour, content/vfx.json).
    chipMat.diffuseColor = new Color3(1, 1, 1);
    chipMat.specularColor = Color3.Black();
    this.chip.material = chipMat;
    this.chip.metadata = EFFECT;
    this.chip.registerInstancedBuffer('color', 4);
    this.chip.instancedBuffers.color = new Color4(1, 1, 1, 1);
    this.prepareSource(this.chip);
    this.chipPool = new MeshPool(() => {
      const m = this.chip.createInstance('chip');
      m.isPickable = false;
      m.metadata = EFFECT;
      m.instancedBuffers.color = new Color4(1, 1, 1, 1);
      return m;
    }, MAX_CHIPS);
    this.puffPool = new MeshPool(() => {
      const m = CreateSphere('puff', { diameter: 1, segments: 4 }, scene);
      m.isPickable = false;
      m.metadata = EFFECT;
      return m;
    }, MAX_PUFFS);

    this.dustMat = new StandardMaterial('impactDustMat', scene);
    // White: each puff takes its colour from its instance (the surface it rose from: impactVisuals' DUST).
    this.dustMat.diffuseColor = new Color3(1, 1, 1);
    this.dustMat.specularColor = Color3.Black();
    this.dustMat.alpha = 0.5;
    this.dust = CreateSphere('impactDust', { diameter: 1, segments: 4 }, scene);
    this.dust.material = this.dustMat;
    this.dust.metadata = EFFECT;
    this.dust.registerInstancedBuffer('color', 4);
    this.dust.instancedBuffers.color = new Color4(1, 1, 1, 1);
    this.dust.hasVertexAlpha = true;
    this.prepareSource(this.dust);
    this.dustPool = new MeshPool(() => {
      const m = this.dust.createInstance('dust');
      m.isPickable = false;
      m.metadata = EFFECT;
      m.instancedBuffers.color = new Color4(1, 1, 1, 1);
      return m;
    }, MAX_DUST);

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

  /**
   * A round flying from `from` to `to`; `onArrive` runs when it gets there.
   * `speed` is its real velocity (bullets) and `tracer: false` flies it
   * without a streak (tracer intervals, GUNPLAY_SPEC §31): it still lands.
   */
  fire(from: Vec3, to: Vec3, color: string, onArrive?: () => void, startAt = 0, opts: { speed?: number; tracer?: boolean; start?: (() => Vec3 | null) | null } = {}): void {
    const a = new Vector3(from.x, from.y, from.z);
    const d = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
    const dist = d.length();
    if (dist < 0.05) {
      onArrive?.();
      return;
    }
    d.scaleInPlace(1 / dist);
    const speed = opts.speed ?? BULLET_SPEED;
    const length = Math.min(12, STREAK_LENGTH * Math.max(1, speed / BULLET_SPEED));
    if (opts.tracer === false) {
      this.bullets.push({ mesh: null, from: a, dir: d, dist, travelled: Math.min(startAt, dist * 0.5), speed, length, onArrive, to: new Vector3(to.x, to.y, to.z), ...(opts.start ? { start: opts.start } : {}) });
      return;
    }
    const mesh = this.streakPool.pop() ?? this.streak.createInstance('bullet');
    mesh.setEnabled(true);
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
    this.bullets.push({ mesh, from: a, dir: d, dist, travelled: Math.min(startAt, dist * 0.5), speed, length, onArrive, to: new Vector3(to.x, to.y, to.z), ...(opts.start ? { start: opts.start } : {}) });
  }

  /** The last rounds' starts as settled, tracer or not (tests: the start against the muzzle as drawn that frame), newest last. */
  readonly settled: { from: Vec3; frame: number; n: number; tracer: boolean }[] = [];
  private settledCount = 0;

  /**
   * Tracers that leave a gun start on its muzzle as drawn (grips auto-fit, owner 2026-11-18: bullets out of the gun,
   * especially in third person). A shot is fired before the frame places the guns (your character's in third person
   * moves with you, everyone's with their aim), so the muzzle known then is the frame before's, up to 10 cm behind a
   * running gun. Run once the guns are placed (view.ts followMuzzles): each new tracer's start moves onto its gun's
   * muzzle, still flying to the same point (the hit comes from the aim, as before), the part already flown kept.
   */
  settleStarts(frame: number): void {
    for (const b of this.bullets) {
      if (!b.start) continue;
      const p = b.start();
      b.start = undefined;
      if (!p) continue;
      b.from.set(p.x, p.y, p.z);
      b.to.subtractToRef(b.from, b.dir);
      const dist = b.dir.length();
      if (dist < 0.05) continue;
      b.dir.scaleInPlace(1 / dist);
      b.dist = dist;
      b.travelled = Math.min(b.travelled, dist * 0.5);
      if (b.mesh) {
        Quaternion.FromUnitVectorsToRef(Vector3.Forward(), b.dir, b.mesh.rotationQuaternion ??= new Quaternion());
        const head = Math.min(b.travelled, b.dist);
        b.mesh.position.copyFrom(b.from.add(b.dir.scale(head)));
        b.mesh.scaling.z = Math.max(0.01, head - Math.max(0, head - b.length));
      }
      this.settled.push({ from: { x: p.x, y: p.y, z: p.z }, frame, n: ++this.settledCount, tracer: !!b.mesh });
      if (this.settled.length > 32) this.settled.shift();
    }
  }

  /** Done with a streak: back to the pool (hidden), or disposed past the pool's size. */
  private release(mesh: InstancedMesh): void {
    if (this.streakPool.length >= MAX_POOLED_STREAKS) {
      mesh.dispose();
      return;
    }
    mesh.setEnabled(false);
    this.streakPool.push(mesh);
  }

  /** Where a shot ending at `to` (coming from `from`) hits the level, if it does: point and surface normal. */
  surfaceHit(from: Vec3, to: Vec3): { point: Vec3; normal: Vec3; box?: WorldBox; surface?: SurfaceTypeId } | null {
    const world = this.physics();
    if (!world) return null;
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 0.05) return null;
    const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
    const hit = world.raycast(from, dir, len + 0.15);
    // Shots that ran out of range in the open, or stopped on something dynamic, leave no hole.
    if (!hit || Math.abs(hit.dist - len) > 0.35) return null;
    return { point: { x: from.x + dir.x * hit.dist, y: from.y + dir.y * hit.dist, z: from.z + dir.z * hit.dist }, normal: hit.normal, ...(hit.box ? { box: hit.box } : {}), ...(hit.surface ? { surface: hit.surface } : {}) };
  }

  /**
   * A round hitting a wall or floor: a hole that stays (not in foliage), sparks, chips and dust, as the surface type's
   * `style` says (content/vfx.json map.impacts and content/surface-types.json, game/fxMap.ts: metal throws sparks, wood
   * and bark splinters, foliage leaves, each its own dust).
   */
  wallImpact(point: Vec3, normal: Vec3, size = 1, style?: { sparks: number; dust: string | null; dustSize: number; chips?: number; chip?: string; hole?: boolean }): void {
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();
    if (style?.hole !== false) this.hole(point, n, size);
    for (let i = 0; i < (style?.sparks ?? 5) && this.sparks.length < MAX_SPARKS; i++) {
      const v = n.scale(2 + Math.random() * 3).add(new Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
      const mesh = this.sparkPool.take();
      mesh.scaling.setAll(0.025 + Math.random() * 0.02);
      const pos = new Vector3(point.x, point.y, point.z).add(n.scale(0.03));
      mesh.position.copyFrom(pos);
      this.sparks.push({ mesh, pos, vel: v, age: 0, life: 0.18 + Math.random() * 0.15 });
    }
    const chipColour = dustColour(style?.chip);
    for (let i = 0; i < (style?.chips ?? 0) && this.chips.length < MAX_CHIPS; i++) {
      const v = n.scale(1.5 + Math.random() * 2.5).add(new Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3));
      const mesh = this.chipPool.take();
      mesh.scaling.setAll((0.035 + Math.random() * 0.035) * Math.min(1.4, size));
      mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      (mesh.instancedBuffers.color as Color4).set(chipColour.r, chipColour.g, chipColour.b, 1);
      const pos = new Vector3(point.x, point.y, point.z).add(n.scale(0.04));
      mesh.position.copyFrom(pos);
      this.chips.push({ mesh, pos, vel: v, age: 0, life: 0.45 + Math.random() * 0.35 });
    }
    if (style?.dust === null || this.dusts.length >= MAX_DUST) return;
    const dust = this.dustPool.take();
    dust.position.set(point.x + n.x * 0.12, point.y + n.y * 0.12, point.z + n.z * 0.12);
    dust.scaling.setAll(0.05);
    const c = dustColour(style?.dust);
    (dust.instancedBuffers.color as Color4).set(c.r, c.g, c.b, 1);
    this.dusts.push({ mesh: dust, age: 0, life: 0.45, grow: 0.5 * size * (style?.dustSize ?? 1) });
  }

  /** A bullet hole that stays for the match (the oldest reused past MAX_HOLES). */
  private hole(point: Vec3, n: Vector3, size: number): void {
    holeMatrix(point, n, size).copyToArray(this.holeMatrices, this.holeNext * 16);
    this.holeDirty = this.holeDirty ? [Math.min(this.holeDirty[0], this.holeNext), Math.max(this.holeDirty[1], this.holeNext)] : [this.holeNext, this.holeNext];
    this.holeNext = (this.holeNext + 1) % MAX_HOLES;
    this.holeCount = Math.min(MAX_HOLES, this.holeCount + 1);
    this.holes.thinInstanceCount = this.holeCount;
  }

  /**
   * A bullet hole on a block the scenario drives (blockHoles.ts): `point` and `normal` in the block body's own frame.
   * The holes are thin instances of a disc parented to the body, so they ride a mover and break away with the block;
   * up to MAX_BLOCK_HOLES a block (the oldest reused). Cleared when the block comes back (clearHolesOn).
   */
  holeOn(body: Mesh, point: Vec3, normal: Vec3, size: number): void {
    let h = this.blockHoles.get(body);
    if (!h || h.mesh.isDisposed()) {
      const mesh = CreateDisc(`${body.name}_holes`, { radius: 0.05, tessellation: 10 }, this.scene);
      mesh.material = this.holes.material;
      mesh.isPickable = false;
      mesh.parent = body;
      const buf = new Float32Array(MAX_BLOCK_HOLES * 16);
      mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
      mesh.thinInstanceCount = 0;
      h = { mesh, buf, count: 0, next: 0 };
      this.blockHoles.set(body, h);
    }
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();
    holeMatrix(point, n, size).copyToArray(h.buf, h.next * 16);
    h.next = (h.next + 1) % MAX_BLOCK_HOLES;
    h.count = Math.min(MAX_BLOCK_HOLES, h.count + 1);
    h.mesh.thinInstanceCount = h.count;
    h.mesh.thinInstanceBufferUpdated('matrix');
  }

  /** A block came back (respawned, shown again): it is whole, with no holes. */
  clearHolesOn(body: Mesh): void {
    const h = this.blockHoles.get(body);
    if (!h || h.count === 0) return;
    h.count = 0;
    h.next = 0;
    if (!h.mesh.isDisposed()) h.mesh.thinInstanceCount = 0;
  }

  /** Bullet holes on a block the scenario drives (for tests). */
  holesOn(body: Mesh): number {
    return this.blockHoles.get(body)?.count ?? 0;
  }

  /**
   * A bullet hole on a breakable prop (propHoles.ts): `point` and `normal` in the prop root's own frame. Thin instances
   * of the wall decal under the root, so they ride the prop and go when it breaks (its root switched off); up to
   * PROP_HOLE_CAP a prop (the oldest reused) and PROP_HOLED_MAX props holed at once (the one holed longest ago gives
   * its holes up). The decal is tinted and sized by the prop's surface where it is known (holeLook).
   */
  holeOnProp(node: TransformNode, point: Vec3, normal: Vec3, size: number, surface: SurfaceTypeId | null): void {
    const { slot, count, evicted } = this.propBook.add(node);
    if (evicted) this.dropPropHoles(evicted);
    let h = this.propHoleMeshes.get(node);
    if (h && h.mesh.isDisposed()) {
      this.propHoleMeshes.delete(node);
      h = undefined;
    }
    const look = holeLook(surface);
    if (!h) {
      const mesh = CreateDisc(`${node.name}_holes`, { radius: 0.05, tessellation: 10 }, this.scene);
      mesh.material = this.holeMaterial(look.key, look.tint);
      mesh.isPickable = false;
      mesh.parent = node;
      // Holes on a prop cast no shadow and stay out of the merged shadow proxies (a broken prop's would stay).
      mesh.metadata = { castsNoShadow: true, breakable: true };
      const buf = new Float32Array(PROP_HOLE_CAP * 16);
      mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
      h = { mesh, buf };
      this.propHoleMeshes.set(node, h);
    }
    // The root is scaled with the prop: the hole is drawn its own size, a touch off the face, whatever the prop's scale.
    const k = 1 / (Math.abs(node.scaling.x) || 1);
    const n = new Vector3(normal.x, normal.y, normal.z).normalize();
    holeMatrix(point, n, size * look.scale * k, 0.01 * k).copyToArray(h.buf, slot * 16);
    h.mesh.thinInstanceCount = count;
    h.mesh.thinInstanceBufferUpdated('matrix');
  }

  /** A breakable prop broke or came back: no holes on it (its decal mesh goes, so the budget is free). */
  clearPropHoles(node: TransformNode): void {
    if (this.propBook.clear(node)) this.dropPropHoles(node);
  }

  /** Bullet holes on a breakable prop (for tests). */
  propHolesOn(node: TransformNode): number {
    return this.propBook.count(node);
  }

  /** Breakable props with holes now (for tests). */
  get holedProps(): number {
    return this.propBook.size;
  }

  private dropPropHoles(node: TransformNode): void {
    const h = this.propHoleMeshes.get(node);
    if (!h) return;
    this.propHoleMeshes.delete(node);
    if (!h.mesh.isDisposed()) h.mesh.dispose(false, false);
  }

  /** The wall decal's material, tinted for a surface look (shared by every prop of that look). */
  private holeMaterial(key: string, tint: readonly [number, number, number]): StandardMaterial {
    const base = this.holes.material as StandardMaterial;
    if (key === 'plain') return base;
    let m = this.holeLookMats.get(key);
    if (!m) {
      // The same decal texture (a clone would copy the texture too, as a blank canvas), tinted.
      m = new StandardMaterial(`bulletHoleMat_${key}`, this.scene);
      m.diffuseTexture = base.diffuseTexture;
      m.useAlphaFromDiffuseTexture = true;
      m.specularColor = base.specularColor.clone();
      m.zOffset = base.zOffset;
      m.backFaceCulling = false;
      m.diffuseColor = new Color3(tint[0], tint[1], tint[2]);
      this.holeLookMats.set(key, m);
    }
    return m;
  }

  /** A spray of hot sparks from a point (a badly damaged vehicle shorting out, a crash). */
  sparkBurst(at: Vec3, count: number, speed = 3): void {
    for (let i = 0; i < count && this.sparks.length < MAX_SPARKS; i++) {
      const vel = new Vector3((Math.random() - 0.5) * speed * 2, Math.random() * speed * 1.4, (Math.random() - 0.5) * speed * 2);
      const mesh = this.sparkPool.take();
      mesh.scaling.setAll(0.03 + Math.random() * 0.03);
      const pos = new Vector3(at.x, at.y, at.z);
      mesh.position.copyFrom(pos);
      this.sparks.push({ mesh, pos, vel, age: 0, life: 0.25 + Math.random() * 0.3 });
    }
  }

  private readonly puffMats = new Map<string, StandardMaterial>();

  /** A soft puff that grows, rises and fades (vehicle smoke and fire). */
  puff(at: Vec3, hex: string, size: number, life: number, rise: number, glow = false, drift?: Vec3): void {
    if (this.puffs.length >= MAX_PUFFS) return;
    let mat = this.puffMats.get(hex);
    if (!mat) {
      mat = new StandardMaterial(`puff_${hex}`, this.scene);
      mat.diffuseColor = Color3.FromHexString(hex);
      mat.specularColor = Color3.Black();
      if (glow) mat.emissiveColor = Color3.FromHexString(hex);
      mat.alpha = glow ? 0.85 : 0.55;
      this.puffMats.set(hex, mat);
    }
    const mesh = this.takePuff(mat);
    mesh.position.set(at.x, at.y, at.z);
    mesh.scaling.setAll(size * 0.3);
    this.puffs.push({ mesh, age: 0, life, grow: size, rise, base: size * 0.3, ...(drift ? { drift: new Vector3(drift.x, drift.y, drift.z) } : {}) });
  }

  private takePuff(mat: StandardMaterial): Mesh {
    const m = this.puffPool.take();
    m.material = mat;
    m.visibility = 1;
    return m;
  }

  /** Build the sparks' and dust's shaders while the match loads (see MeshPool.warm). */
  warm(): void {
    this.sparkPool.warm((m) => m.scaling.setAll(0.03));
    this.chipPool.warm((m) => m.scaling.setAll(0.03));
    this.dustPool.warm((m) => {
      m.scaling.setAll(0.3);
      (m.instancedBuffers.color as Color4).a = 0.5;
    });
    this.puffPool.warm((m) => {
      m.material = this.dustMat;
      m.scaling.setAll(0.3);
      m.visibility = 0.5;
    });
  }

  /** Bullet holes currently in the level (for tests). */
  get holesInLevel(): number {
    return this.holeCount;
  }

  update(dt: number): void {
    if (this.holeDirty) {
      const [first, last] = this.holeDirty;
      this.holes.thinInstancePartialBufferUpdate('matrix', last - first + 1, first);
      this.holeDirty = null;
    }
    this.bullets = this.bullets.filter((b) => {
      b.travelled += b.speed * dt;
      const head = Math.min(b.travelled, b.dist);
      const tail = Math.max(0, head - b.length);
      if (b.mesh) {
        b.mesh.position.copyFrom(b.from.add(b.dir.scale(head)));
        b.mesh.scaling.z = Math.max(0.01, head - tail);
      }
      if (b.travelled < b.dist) return true;
      if (b.mesh) this.release(b.mesh);
      b.onArrive?.();
      return false;
    });
    this.sparks = this.sparks.filter((s) => {
      s.age += dt;
      s.vel.y -= 14 * dt;
      s.pos.addInPlace(s.vel.scale(dt));
      s.mesh.position.copyFrom(s.pos);
      if (s.age < s.life) return true;
      this.sparkPool.give(s.mesh);
      return false;
    });
    this.chips = this.chips.filter((s) => {
      s.age += dt;
      s.vel.y -= 9.8 * dt;
      s.vel.scaleInPlace(Math.max(0, 1 - 1.5 * dt));
      s.pos.addInPlace(s.vel.scale(dt));
      s.mesh.position.copyFrom(s.pos);
      s.mesh.rotation.x += 9 * dt;
      s.mesh.rotation.z += 6 * dt;
      if (s.age < s.life) return true;
      this.chipPool.give(s.mesh);
      return false;
    });
    this.puffs = this.puffs.filter((p) => {
      p.age += dt;
      const f = p.age / p.life;
      p.mesh.scaling.setAll((p.base ?? 0.05) + p.grow * f);
      if (p.rise) p.mesh.position.y += p.rise * dt;
      if (p.drift) p.mesh.position.addInPlace(p.drift.scale(dt * (1 - f) * (1 - f)));
      p.mesh.visibility = Math.max(0, 1 - f);
      if (f < 1) return true;
      this.puffPool.give(p.mesh);
      return false;
    });
    this.dusts = this.dusts.filter((d) => {
      d.age += dt;
      const f = d.age / d.life;
      d.mesh.scaling.setAll(0.05 + d.grow * f);
      (d.mesh.instancedBuffers.color as Color4).a = Math.max(0, 1 - f);
      if (f < 1) return true;
      this.dustPool.give(d.mesh);
      return false;
    });
  }

  dispose(): void {
    for (const b of this.bullets) b.mesh?.dispose();
    for (const m of this.streakPool) m.dispose();
    for (const s of this.sparks) s.mesh.dispose();
    for (const s of this.chips) s.mesh.dispose();
    for (const p of this.puffs) p.mesh.dispose();
    for (const d of this.dusts) d.mesh.dispose();
    this.sparkPool.dispose();
    this.chipPool.dispose();
    this.chip.dispose();
    this.dustPool.dispose();
    this.dust.dispose();
    this.puffPool.dispose();
    this.streak.dispose();
    this.spark.dispose();
    for (const node of [...this.propHoleMeshes.keys()]) this.dropPropHoles(node);
    for (const m of this.holeLookMats.values()) m.dispose();
    this.holeLookMats.clear();
    this.holes.dispose();
  }
}

/** A hole's matrix: the disc facing out along `n` (unit), turned at random, a touch off the face. */
function holeMatrix(point: Vec3, n: Vector3, size: number, lift = 0.01): Matrix {
  const q = new Quaternion();
  Quaternion.FromUnitVectorsToRef(new Vector3(0, 0, -1), n, q);
  const twist = Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.random() * Math.PI * 2);
  const s = size * (0.8 + Math.random() * 0.4);
  return Matrix.Compose(new Vector3(s, s, s), q.multiply(twist), new Vector3(point.x + n.x * lift, point.y + n.y * lift, point.z + n.z * lift));
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
