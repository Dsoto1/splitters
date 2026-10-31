import type { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Rendering/edgesRenderer';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import type { Material } from '@babylonjs/core/Materials/material';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';
import '@babylonjs/core/Lights/Clustered/clusteredLightingSceneComponent';
import {
  LIGHT_FLASH,
  LIGHT_ON,
  boxQuat,
  carriedTransform,
  dynamicBlockIds,
  lightBlinkOf,
  logicTargets,
  quatRotate,
  type MapDocument,
  type MoverEntity,
  type Movers,
  BUTTON,
  DESTRUCTIBLE_SPECS,
  rosterSize,
  mapLiquids,
  GLASS,
  DOOR,
  ELECTRIC_FENCE,
  TRAP_ACTIVE,
  TRAP_ENABLED,
  TRAP_SPECS,
  TRAP_SPENT,
  TRAP_WARNING,
  type AirplaneEntity,
  type LightEntity,
  type Liquid,
  type MapEntity,
} from '@tiletrigger/shared';
import { createFlagBase, createFlagModel, createHillModel, createBombsiteModel } from './flagVisuals.ts';
import { buildFence } from '../borderVisuals.ts';
import { GlassVisuals, glassMaterial } from './glassVisuals.ts';
import { WaterVisuals } from './waterVisuals.ts';
import { loadGraphicsQuality } from './atmosphere.ts';

/** How each liquid looks: colour, glow, surface and depth opacity, shine and how fast it flows. */
export const LIQUID_LOOKS: Record<Liquid, { color: string; glow: number; alpha: number; depthAlpha: number; shine: number; flow: number }> = {
  water: { color: '#3f8fb0', glow: 0.08, alpha: 0.62, depthAlpha: 0.28, shine: 0.8, flow: 0.02 },
  swamp: { color: '#5a6a32', glow: 0.05, alpha: 0.88, depthAlpha: 0.55, shine: 0.25, flow: 0.006 },
  acid: { color: '#8aff3a', glow: 0.45, alpha: 0.78, depthAlpha: 0.4, shine: 0.5, flow: 0.015 },
  lava: { color: '#ff5a1a', glow: 1, alpha: 0.97, depthAlpha: 0.85, shine: 0.2, flow: 0.01 },
};

/**
 * Procedural models for scenario entities: doors, buttons, crates, barrels,
 * breakable walls, traps and (editor only) zones. Built from simple shapes in
 * code, like the map materials, and shared by the game and MapMaker so both
 * show the same thing. `apply` animates them from replicated state.
 */

type Kind = Exclude<MapEntity['kind'], 'spawn' | 'pickup' | 'prop' | 'mount'>;
export const SCENARIO_KINDS: readonly Kind[] = ['door', 'button', 'destructible', 'zone', 'trap', 'pad', 'block', 'water', 'flag', 'hill', 'ladder', 'bombsite', 'hostage', 'rescue', 'light', 'mover', 'portal'];

/**
 * Place an entity's visual root: at its position, turned to its facing.
 * Tilted blocks turn about their centre (as in physics), so the root (at the
 * base) is offset to match; movers draw their route in world offsets, unturned.
 */
export function placeScenarioNode(node: TransformNode, e: MapEntity): void {
  node.position.set(e.position[0], e.position[1], e.position[2]);
  if (e.kind === 'block' && (e.pitch || e.roll)) {
    const q = boxQuat(e.yaw, e.pitch, e.roll);
    const h = e.size[1] / 2;
    const [ox, oy, oz] = quatRotate(q, 0, h, 0);
    node.position.set(e.position[0] - ox, e.position[1] + h - oy, e.position[2] - oz);
    node.rotationQuaternion = new Quaternion(q.x, q.y, q.z, q.w);
  } else if ('yaw' in e && e.kind !== 'mover') {
    node.rotationQuaternion = null;
    node.rotation.y = e.yaw;
  }
}
export const isScenarioEntity = (e: MapEntity): e is Extract<MapEntity, { kind: Kind }> => (SCENARIO_KINDS as readonly string[]).includes(e.kind);

interface Visual {
  root: TransformNode;
  /** Animate from replicated state [a, b] (see ScenarioSnapshot) and wall-clock time. */
  update?: (a: number, b: number, now: number, dt: number) => void;
  /** A destructible in the game: its meshes become GPU thin instances shared with every other one (see batchDestructibles). */
  batch?: { base: string };
}

/** One shape and material that destructibles share: every copy is a thin instance of `mesh`. */
interface DestructibleBatch {
  mesh: Mesh;
  matrices: Float32Array;
  /** Per-instance colour (bodies only: they darken with damage). */
  colors: Float32Array | null;
}

export interface VisualOptions {
  /** MapMaker view: zones are drawn, traps show their danger area, nothing animates. */
  editor?: boolean;
}

export class ScenarioVisuals {
  private readonly visuals = new Map<number, Visual>();
  private readonly mats = new Map<string, StandardMaterial>();
  private last = performance.now();

  constructor(
    private readonly scene: Scene,
    private readonly opts: VisualOptions = {},
  ) {
    this.glass = new GlassVisuals(scene);
    // MapMaker shows the medium look (no mirror, no extra depth pass).
    this.liquids = new WaterVisuals(scene, opts.editor ? 'medium' : loadGraphicsQuality(), !!opts.editor);
  }

  /** Liquid surfaces (water shader, lava and acid flow), splashes and ripples. */
  readonly liquids: WaterVisuals;

  /** Solid blocks the scenario drives (logic, movers, hidden at start): drawn here, not in the level mesh. */
  dynamicBlocks: ReadonlySet<string> = new Set();

  /** Every pane of glass (windows, glass blocks, Window pane destructibles), instanced; see glassVisuals.ts. */
  readonly glass: GlassVisuals;

  /** Blocks movers carry (they follow their mover, so they can't be instanced with the static glass). */
  private carriedBlocks: ReadonlySet<string> = new Set();

  /** (Re)build visuals for every scenario entity in the list. Indices match map.entities. */
  build(entities: readonly MapEntity[], map?: MapDocument): void {
    this.clear();
    this.dynamicBlocks = map ? dynamicBlockIds(map) : new Set();
    // Lights nothing ever changes (no logic aims at them, not off or blinking at the start) share their
    // glow material, and their fixtures are merged into a few meshes below.
    const targets = map && !this.opts.editor ? logicTargets(map.logic) : null;
    this.fixedLights = new Set(targets ? entities.filter((e) => e.kind === 'light' && !targets.has(e.id) && !e.off && !e.blink).map((e) => e.id) : []);
    const fixtures: Mesh[] = [];
    // Glass blocks a mover carries move with it, so they are drawn one by one (block()); every other pane is instanced.
    this.carriedBlocks = new Set(map ? map.entities.flatMap((e) => (e.kind === 'mover' ? e.blocks : [])) : []);
    if (map) this.glass.build(map, { windowsOnly: !!this.opts.editor, skip: this.carriedBlocks });
    if (map) {
      this.liquids.map = map;
      this.liquids.fx.liquids = mapLiquids(map.entities);
    }
    entities.forEach((e, i) => {
      if (!isScenarioEntity(e)) return;
      const v = this.create(e, `sc_${e.id}`);
      placeScenarioNode(v.root, e);
      for (const m of v.root.getChildMeshes()) m.isPickable = false;
      if (this.fixedLights.has(e.id)) for (const m of v.root.getChildMeshes()) if (m instanceof Mesh && !m.skeleton) fixtures.push(m);
      this.visuals.set(i, v);
    });
    this.mergeFixtures(fixtures);
    this.batchDestructibles([...this.visuals.values()].filter((v) => v.batch));
  }

  private batches: Mesh[] = [];

  /**
   * Destructibles are 3–6 small meshes each (a pane and its frame, a crate and
   * its bands): a map with a hundred of them was several hundred draw calls,
   * each mesh culled and drawn one by one. In the game every part of the same
   * shape and material becomes a GPU thin instance of one mesh (one draw for
   * all of them). A body darkens with damage through its instance colour; a
   * broken one's instances collapse to nothing. MapMaker keeps them as meshes.
   */
  private batchDestructibles(list: Visual[]): void {
    const groups = new Map<string, { meshes: Mesh[]; body: boolean }>();
    const owner = new Map<Mesh, Visual>();
    for (const v of list) {
      v.root.computeWorldMatrix(true);
      for (const m of v.root.getChildMeshes(false)) {
        if (!(m instanceof Mesh) || !m.material) continue;
        const body = m.name.endsWith('_body');
        const pos = m.getVerticesData('position');
        if (!pos) continue;
        // Same shape: same vertices (each part is built from its own box or cylinder).
        let h = pos.length;
        for (let k = 0; k < pos.length; k++) h = (Math.imul(h, 31) + Math.round(pos[k]! * 1000)) | 0;
        const key = `${m.material.uniqueId}|${body ? 1 : 0}|${pos.length}|${h}`;
        let g = groups.get(key);
        if (!g) groups.set(key, (g = { meshes: [], body }));
        g.meshes.push(m);
        owner.set(m, v);
      }
    }
    const slots = new Map<Visual, { batch: DestructibleBatch; index: number; body: boolean; matrix: Float32Array }[]>();
    for (const [key, g] of groups) {
      const first = g.meshes[0]!;
      const mesh = first.clone(`sc_destructibles_${this.batches.length}`, null, true, false)!;
      mesh.parent = null;
      mesh.position.setAll(0);
      mesh.rotationQuaternion = null;
      mesh.rotation.setAll(0);
      mesh.scaling.setAll(1);
      mesh.isPickable = false;
      const n = g.meshes.length;
      const batch: DestructibleBatch = { mesh, matrices: new Float32Array(n * 16), colors: g.body ? new Float32Array(n * 4).fill(1) : null };
      g.meshes.forEach((m, i) => {
        const w = m.computeWorldMatrix(true);
        w.copyToArray(batch.matrices, i * 16);
        const v = owner.get(m)!;
        let list = slots.get(v);
        if (!list) slots.set(v, (list = []));
        list.push({ batch, index: i, body: g.body, matrix: batch.matrices.slice(i * 16, i * 16 + 16) });
      });
      mesh.thinInstanceSetBuffer('matrix', batch.matrices, 16, false);
      if (batch.colors) mesh.thinInstanceSetBuffer('color', batch.colors, 4, false);
      mesh.thinInstanceRefreshBoundingInfo(false);
      mesh.freezeWorldMatrix();
      mesh.doNotSyncBoundingInfo = true;
      mesh.metadata = { key };
      this.batches.push(mesh);
    }
    for (const m of owner.keys()) m.dispose(false, false);
    const zero = new Float32Array(16);
    for (const [v, parts] of slots) {
      let last = 100;
      const dirty = new Set<DestructibleBatch>();
      v.update = (health) => {
        if (health === last) return;
        const was = last;
        last = health;
        const shade = 0.45 + 0.55 * (health / 100);
        for (const p of parts) {
          if ((health > 0) !== (was > 0)) {
            p.batch.matrices.set(health > 0 ? p.matrix : zero, p.index * 16);
            dirty.add(p.batch);
          }
          if (p.body && p.batch.colors) {
            // The body's own colour times this (diffuse only, as the per-pane material did before).
            p.batch.colors.set([shade, shade, shade, 1], p.index * 4);
            dirty.add(p.batch);
          }
        }
        for (const b of dirty) {
          b.mesh.thinInstanceBufferUpdated('matrix');
          if (b.colors) b.mesh.thinInstanceBufferUpdated('color');
        }
        dirty.clear();
      };
    }
  }

  /** Lights nothing changes (see build). */
  private fixedLights = new Set<string>();
  private merged: Mesh[] = [];

  /**
   * Light fixtures are a few small meshes each (a panel and its rim, a shade and
   * its plate, a sign's letters and tubes): a hundred lights were three hundred
   * draw calls. Fixed ones are merged into one mesh per material.
   */
  private mergeFixtures(meshes: Mesh[]): void {
    const byMat = new Map<Material | null, Mesh[]>();
    for (const m of meshes) {
      let list = byMat.get(m.material);
      if (!list) byMat.set(m.material, (list = []));
      list.push(m);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      for (const m of list) m.computeWorldMatrix(true);
      let one: Mesh | null = null;
      try {
        one = Mesh.MergeMeshes(list, false, true);
      } catch {
        // Meshes that can't be merged (different vertex layouts) stay as they are.
      }
      if (!one) continue;
      for (const m of list) m.dispose();
      one.name = `sc_fixtures_${mat?.name ?? 'plain'}`;
      one.material = mat;
      one.isPickable = false;
      one.freezeWorldMatrix();
      this.merged.push(one);
    }
  }

  /**
   * Carried blocks follow their movers. `tick` is fractional (drawing runs
   * between ticks); the game passes your own predicted tick so a platform
   * stays under your feet.
   */
  applyMovers(movers: Movers, tick: number): void {
    movers.defs.forEach((def, k) => {
      const pose = movers.pose(k, tick);
      for (const block of def.blocks) {
        const v = this.visuals.get(block.i);
        if (!v) continue;
        const t = carriedTransform(def, block, pose);
        // The visual's root is the block's base centre in its own frame.
        const [ox, oy, oz] = quatRotate(t.rot, 0, block.half.y, 0);
        v.root.position.set(t.center.x - ox, t.center.y - oy, t.center.z - oz);
        const q = (v.root.rotationQuaternion ??= new Quaternion());
        q.set(t.rot.x, t.rot.y, t.rot.z, t.rot.w);
      }
    });
  }

  /** A standalone visual for one entity (MapMaker keeps its own per-entity nodes). */
  createNode(e: Extract<MapEntity, { kind: Kind }>, name: string): TransformNode {
    const v = this.create(e, name);
    for (const m of v.root.getChildMeshes()) m.isPickable = false;
    return v.root;
  }

  /** Root node of an entity's visual (editor selection highlighting). */
  node(index: number): TransformNode | undefined {
    return this.visuals.get(index)?.root;
  }

  /** Animate from the latest entity states (index -> [a, b]). Entities without a state keep their start pose. */
  apply(states: ReadonlyMap<number, readonly [number, number]>): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    for (const [i, v] of this.visuals) {
      const s = states.get(i);
      if (s && v.update) v.update(s[0], s[1], now, dt);
    }
    this.glass.apply(states);
  }

  clear(): void {
    for (const v of this.visuals.values()) v.root.dispose(false, false);
    this.visuals.clear();
    for (const m of this.merged) m.dispose();
    this.merged = [];
    for (const m of this.batches) m.dispose();
    this.batches = [];
    this.glass.dispose();
  }

  dispose(): void {
    this.clear();
    this.liquids.dispose();
    this.lights?.dispose();
    this.lights = undefined;
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
  }

  // ---------------------------------------------------------------- materials

  private mat(key: string, hex: string, opts: { emissive?: number; alpha?: number; spec?: number } = {}): StandardMaterial {
    const k = `${key}|${hex}|${opts.emissive ?? 0}|${opts.alpha ?? 1}`;
    let m = this.mats.get(k);
    if (!m) {
      m = new StandardMaterial(`scmat_${this.mats.size}`, this.scene);
      const c = Color3.FromHexString(hex);
      m.diffuseColor = c;
      m.specularColor = new Color3(opts.spec ?? 0.15, opts.spec ?? 0.15, opts.spec ?? 0.15);
      if (opts.emissive) m.emissiveColor = c.scale(opts.emissive);
      if (opts.alpha !== undefined && opts.alpha < 1) {
        m.alpha = opts.alpha;
        m.backFaceCulling = false;
      }
      this.mats.set(k, m);
    }
    return m;
  }

  /** A per-visual material we tint at runtime (lights, damage). */
  private ownMat(hex: string, emissive = 0): StandardMaterial {
    const m = new StandardMaterial(`scown_${Math.random().toString(36).slice(2, 8)}`, this.scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.2, 0.2, 0.2);
    m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
    return m;
  }

  private box(name: string, parent: TransformNode, size: [number, number, number], pos: [number, number, number], mat: StandardMaterial): Mesh {
    const m = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, this.scene);
    m.parent = parent;
    m.position.set(...pos);
    m.material = mat;
    return m;
  }

  // ---------------------------------------------------------------- builders

  private create(e: Extract<MapEntity, { kind: Kind }>, name: string): Visual {
    switch (e.kind) {
      case 'door':
        return this.door(name, e);
      case 'button':
        return this.button(name);
      case 'destructible':
        return this.destructible(name, e);
      case 'zone':
        return this.zone(name, e);
      case 'trap':
        return this.trap(name, e);
      case 'encounter':
        return this.encounter(name, e);
      case 'pad':
        return this.pad(name);
      case 'ladder':
        return this.ladder(name, e);
      case 'block':
        return this.block(name, e);
      case 'water':
        return this.water(name, e);
      case 'flag':
      case 'hill':
      case 'bombsite':
      case 'hostage':
      case 'rescue':
        return this.objective(name, e);
      case 'light':
        return this.light(name, e);
      case 'airplane':
        return this.airplane(name, e);
      case 'mover':
        return this.mover(name, e);
      case 'portal':
        return this.portal(name, e);
    }
  }

  /**
   * A portal (Style Packs 03 and 09): a stone frame round a swirling disc of
   * light in the pair's colour, spinning and pulsing (a stylised effect: no
   * view through it). Switched off, the swirl drains away and the frame
   * stays. Its back is plain stone: portals are one-sided.
   */
  private portal(name: string, e: Extract<MapEntity, { kind: 'portal' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const [w, h] = e.size;
    const colour = e.color ?? '#3aa8ff';
    const stone = this.mat('portalFrame', '#cbb48a', { spec: 0.1 });
    const dark = this.mat('portalBack', '#3a3026');
    const t = 0.35;
    // Posts, lintel and sill, set back so the front of the disc is the portal's surface.
    for (const side of [-1, 1]) this.box(`${name}_post${side}`, root, [t, h + t, 0.5], [side * (w / 2 + t / 2), (h + t) / 2, -0.2], stone);
    this.box(`${name}_lintel`, root, [w + t * 2 + 0.2, t + 0.1, 0.6], [0, h + t / 2 + 0.05, -0.2], stone);
    this.box(`${name}_sill`, root, [w + t * 2, 0.08, 0.5], [0, 0.04, -0.2], stone);
    this.box(`${name}_back`, root, [w, h, 0.06], [0, h / 2, -0.42], dark);
    // The swirl: an emissive disc with a spiral painted on it, turning; a glowing rim.
    const tex = new DynamicTexture(`${name}_swirl`, { width: 256, height: 256 }, this.scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    const c = Color3.FromHexString(colour);
    const rgb = (k: number, a: number) => `rgba(${Math.round(Math.min(255, c.r * 255 * k))},${Math.round(Math.min(255, c.g * 255 * k))},${Math.round(Math.min(255, c.b * 255 * k))},${a})`;
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, rgb(1.6, 1));
    grad.addColorStop(0.55, rgb(1, 0.9));
    grad.addColorStop(1, rgb(0.5, 0.0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.lineWidth = 7;
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      for (let k = 0; k <= 60; k++) {
        const u = k / 60;
        const a = arm * (Math.PI / 2) + u * Math.PI * 2.2;
        const r = 10 + u * 112;
        const x = 128 + Math.cos(a) * r;
        const y = 128 + Math.sin(a) * r;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.55 - arm * 0.06})`;
      ctx.stroke();
    }
    tex.update();
    tex.hasAlpha = true;
    const swirlMat = new StandardMaterial(`${name}_swirlMat`, this.scene);
    swirlMat.diffuseTexture = tex;
    swirlMat.emissiveTexture = tex;
    swirlMat.opacityTexture = tex;
    swirlMat.disableLighting = true;
    swirlMat.backFaceCulling = false;
    const disc = CreatePlane(`${name}_disc`, { width: w, height: h }, this.scene);
    disc.parent = root;
    disc.position.set(0, h / 2, -0.12);
    disc.rotation.y = Math.PI;
    disc.material = swirlMat;
    const rim = this.mat(`portalRim${colour}`, colour, { emissive: 1 });
    for (const side of [-1, 1]) this.box(`${name}_rim${side}`, root, [0.08, h, 0.08], [side * (w / 2 - 0.04), h / 2, -0.06], rim);
    this.box(`${name}_rimTop`, root, [w, 0.08, 0.08], [0, h - 0.04, -0.06], rim);
    let on = e.startEnabled ? 1 : 0;
    let shown = on;
    const spin = this.opts.editor ? null : this.scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.1, this.scene.getEngine().getDeltaTime() / 1000);
      shown += Math.sign(on - shown) * Math.min(Math.abs(on - shown), dt * 2);
      tex.wAng += dt * 1.8;
      const pulse = 0.85 + Math.sin(performance.now() / 260) * 0.15;
      swirlMat.alpha = shown * pulse;
      disc.isVisible = shown > 0.02;
    });
    if (spin) root.onDisposeObservable.add(() => this.scene.onBeforeRenderObservable.remove(spin));
    root.onDisposeObservable.add(() => {
      tex.dispose();
      swirlMat.dispose();
    });
    return {
      root,
      update: (a) => {
        on = a > 0 ? 1 : 0;
      },
    };
  }

  /**
   * MapMaker's view of a mover: its hinge marker, the route its blocks take
   * (numbered stops) and, for drawbridges, the hinge axis. In play the blocks
   * themselves move; the mover draws nothing.
   */
  private mover(name: string, e: MoverEntity): Visual {
    const root = new TransformNode(name, this.scene);
    if (!this.opts.editor) return { root };
    const teal = this.mat('moverMark', '#2ec4b6', { emissive: 0.6 });
    this.box(`${name}_hub`, root, [0.5, 0.5, 0.5], [0, 0.25, 0], teal);
    const colour = new Color4(0.18, 0.77, 0.71, 1);
    const pts = e.points.map(([x, y, z]) => new Vector3(x, y + 0.3, z));
    if (e.mode === 'loop' && pts.length > 2) pts.push(pts[0]!.clone());
    const route = CreateLines(`${name}_route`, { points: pts, colors: pts.map(() => colour) }, this.scene);
    route.parent = root;
    e.points.forEach(([x, y, z], k) => this.box(`${name}_stop${k}`, root, [0.3, 0.3, 0.3], [x, y + 0.3, z], teal));
    if (e.angles?.some((a) => a !== 0)) {
      const ax = new Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw)).scale(2.5);
      const hinge = CreateLines(`${name}_hinge`, { points: [ax.scale(-1), ax], colors: [colour, colour] }, this.scene);
      hinge.parent = root;
    }
    return { root };
  }

  /**
   * MapMaker's view of a transport plane (in play the plane itself is a
   * mount): a marker on the ground at its anchor, a mast up to its flying
   * height and its route drawn in the sky, with the direction it flies.
   */
  private airplane(name: string, e: AirplaneEntity): Visual {
    const root = new TransformNode(name, this.scene);
    const orange = this.mat('planeMark', '#e2703a', { emissive: 0.5 });
    this.box(`${name}_base`, root, [1.6, 0.2, 1.6], [0, 0.1, 0], this.mat('planeBase', '#2a2f3a'));
    // A little plane on the marker: fuselage and wings.
    this.box(`${name}_body`, root, [0.35, 0.3, 1.6], [0, 0.55, 0], orange);
    this.box(`${name}_wing`, root, [1.8, 0.08, 0.45], [0, 0.6, 0.1], orange);
    this.box(`${name}_tail`, root, [0.7, 0.08, 0.25], [0, 0.65, -0.65], orange);
    const y = e.altitude;
    const pts = e.route.map(([x, z]) => new Vector3(x, y, z));
    if (e.closed && pts.length > 2) pts.push(pts[0]!.clone());
    const colour = new Color4(1, 0.55, 0.25, 1);
    const route = CreateLines(`${name}_route`, { points: pts, colors: pts.map(() => colour) }, this.scene);
    route.parent = root;
    const mast = CreateLines(`${name}_mast`, { points: [new Vector3(0, 0.8, 0), new Vector3(0, y, 0), ...(pts[0] ? [pts[0]] : [])], colors: [colour, colour, colour].slice(0, pts[0] ? 3 : 2) }, this.scene);
    mast.parent = root;
    // Arrow heads half-way along each leg show which way it flies.
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const mid = a.add(b).scale(0.5);
      const dir = b.subtract(a).normalize();
      const side = new Vector3(dir.z, 0, -dir.x);
      const back = mid.subtract(dir.scale(4));
      const arrow = CreateLines(`${name}_arrow${i}`, { points: [back.add(side.scale(3)), mid, back.subtract(side.scale(3))], colors: [colour, colour, colour] }, this.scene);
      arrow.parent = root;
    }
    return { root };
  }

  // ---------------------------------------------------------------- lights

  /**
   * Every map light goes into one clustered container, so a building full of
   * lamps costs about what one light does (each material sees the sun, the sky
   * and the container). Without clustered lighting (old GPUs) the fixtures
   * glow but cast no light.
   */
  private lights: ClusteredLightContainer | null | undefined;

  private container(): ClusteredLightContainer | null {
    if (this.lights === undefined) {
      const c = new ClusteredLightContainer('map_lights', [], this.scene);
      this.lights = c.isSupported ? c : null;
      if (!this.lights) c.dispose();
    }
    return this.lights;
  }

  private light(name: string, e: LightEntity): Visual {
    const root = new TransformNode(name, this.scene);
    const color = Color3.FromHexString(e.color);
    const glow = this.mat('lightfix', e.color, { emissive: 1.4 });
    glow.disableLighting = true;
    const housing = this.mat('lighthousing', '#3a3f48');
    // The light hangs just in front of its fixture, so it lights the room and not the wall behind.
    let offset = new Vector3(0, 0, 0);
    /** Signs and billboards: their lettered face, lit with the light (and dark when it is off). */
    let face: { mesh: Mesh; mat: StandardMaterial } | null = null;
    switch (e.fixture) {
      case 'ceiling': {
        const panel = CreateBox(`${name}_panel`, { width: 1.2, height: 0.06, depth: 1.2 }, this.scene);
        panel.material = glow;
        const rim = CreateBox(`${name}_rim`, { width: 1.32, height: 0.05, depth: 1.32 }, this.scene);
        rim.position.y = 0.04;
        rim.material = housing;
        panel.parent = rim.parent = root;
        offset = new Vector3(0, -0.4, 0);
        break;
      }
      case 'wall': {
        const plate = CreateBox(`${name}_plate`, { width: 0.32, height: 0.42, depth: 0.06 }, this.scene);
        plate.material = housing;
        const shade = CreateCylinder(`${name}_shade`, { diameterTop: 0.22, diameterBottom: 0.34, height: 0.26, tessellation: 12 }, this.scene);
        shade.material = glow;
        shade.position.set(0, 0.05, 0.18);
        plate.parent = shade.parent = root;
        offset = new Vector3(0, 0, 0.5);
        break;
      }
      case 'bulb': {
        const cord = CreateCylinder(`${name}_cord`, { diameter: 0.03, height: 0.6, tessellation: 6 }, this.scene);
        cord.material = housing;
        cord.position.y = 0.3;
        const bulb = CreateSphere(`${name}_bulb`, { diameter: 0.18, segments: 8 }, this.scene);
        bulb.material = glow;
        cord.parent = bulb.parent = root;
        break;
      }
      case 'strip': {
        const tube = CreateBox(`${name}_tube`, { width: 2.4, height: 0.07, depth: 0.14 }, this.scene);
        tube.material = glow;
        tube.parent = root;
        offset = new Vector3(0, -0.3, 0);
        break;
      }
      case 'sign':
      case 'billboard': {
        // A neon sign (lit letters on a dark box, a tube round the edge) or a holographic billboard
        // (a glowing, flickering screen of the words over bands of colour), facing +Z like a wall lamp.
        const board = e.fixture === 'billboard';
        const [w, h] = e.size ?? (board ? [6, 3.4] : [2.4, 0.8]);
        const back = CreateBox(`${name}_back`, { width: w + 0.12, height: h + 0.12, depth: board ? 0.25 : 0.14 }, this.scene);
        back.material = housing;
        back.parent = root;
        back.position.z = board ? 0.125 : 0.07;
        face = this.signFace(name, e.text ?? (board ? 'TILE TRIGGER' : 'OPEN'), w, h, e.color, board);
        face.mesh.parent = root;
        face.mesh.position.z = (board ? 0.25 : 0.14) + 0.012;
        if (!board) {
          // The neon tube border.
          for (const [bw, bh, x, y] of [[w, 0.05, 0, h / 2 - 0.05], [w, 0.05, 0, -h / 2 + 0.05], [0.05, h, w / 2 - 0.05, 0], [0.05, h, -w / 2 + 0.05, 0]] as const) {
            const tube = CreateBox(`${name}_tube`, { width: bw, height: bh, depth: 0.05 }, this.scene);
            tube.material = glow;
            tube.parent = root;
            tube.position.set(x, y, 0.17);
          }
        }
        offset = new Vector3(0, 0, board ? 1.5 : 0.8);
        break;
      }
      case 'candle':
      case 'chandelier': {
        // A three-branch candelabrum standing where the light is, or a brass ring of candles hanging below it.
        const brass = this.mat('candleBrass', '#b08d3a', { spec: 0.6 });
        const wax = this.mat('candleWax', '#efe6cf');
        const hanging = e.fixture === 'chandelier';
        const spots: [number, number, number][] = [];
        if (hanging) {
          const chain = CreateCylinder(`${name}_chain`, { diameter: 0.05, height: 0.7, tessellation: 6 }, this.scene);
          chain.material = brass;
          chain.position.y = -0.35;
          chain.parent = root;
          const ring = CreateCylinder(`${name}_ring`, { diameter: 1.3, height: 0.06, tessellation: 20 }, this.scene);
          ring.material = brass;
          ring.position.y = -0.8;
          ring.parent = root;
          for (let i = 0; i < 6; i++) spots.push([Math.cos((i / 6) * Math.PI * 2) * 0.6, -0.77, Math.sin((i / 6) * Math.PI * 2) * 0.6]);
          offset = new Vector3(0, -0.6, 0);
        } else {
          this.box(`${name}_stem`, root, [0.05, 0.36, 0.05], [0, 0.18, 0], brass);
          this.box(`${name}_arm`, root, [0.46, 0.04, 0.04], [0, 0.36, 0], brass);
          for (const x of [-0.22, 0, 0.22]) spots.push([x, 0.38, 0]);
          offset = new Vector3(0, 0.6, 0);
        }
        spots.forEach(([x, y, z], i) => {
          this.box(`${name}_wax${i}`, root, [0.05, 0.16, 0.05], [x, y + 0.08, z], wax);
          const flame = CreateSphere(`${name}_flame${i}`, { diameter: 0.06, segments: 4 }, this.scene);
          flame.scaling.y = 1.8;
          flame.position.set(x, y + 0.2, z);
          flame.material = glow;
          flame.parent = root;
        });
        break;
      }
      case 'none':
        if (this.opts.editor) {
          const marker = CreateSphere(`${name}_marker`, { diameter: 0.35, segments: 8 }, this.scene);
          marker.material = this.mat('lightmarker', e.color, { emissive: 1, alpha: 0.5 });
          marker.parent = root;
        }
        break;
    }
    // Without clustered lighting the fixture still glows, but casts no light: dozens of plain point lights
    // would each go into every material's shader (too big to compile, too slow to run).
    // Lights logic drives get their own glow material, so one can change colour, dim or blink alone.
    const ownGlow = this.opts.editor || this.fixedLights.has(e.id) ? null : this.ownMat(e.color, 1.4);
    if (ownGlow) {
      ownGlow.disableLighting = true;
      for (const m of root.getChildMeshes()) if (m.material === glow) m.material = ownGlow;
    }
    const container = this.container();
    let light: PointLight | null = null;
    // Candles flicker; blinking candles gutter and flare at random (seeded by the light, so each one is its own).
    const candle = e.fixture === 'candle' || e.fixture === 'chandelier';
    const seed = [...e.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);
    const update = (flags: number, rgb: number, now: number) => {
      const blink = lightBlinkOf(flags);
      const on = (flags & LIGHT_ON) !== 0 && (candle || !blink || Math.floor((now / 1000) * blink * 2) % 2 === 0);
      const flash = (flags & LIGHT_FLASH) !== 0;
      const c = new Color3(((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255);
      let level = flash ? 2.5 : on ? 1 : 0;
      if (candle && on && !flash) level *= candleFlicker(now / 1000, blink, seed);
      if (ownGlow) {
        ownGlow.emissiveColor = level ? c.scale(1.4 * Math.min(level, 1.6)) : c.scale(0.08);
        ownGlow.diffuseColor = c;
      }
      if (face) face.mat.emissiveColor = level ? c.scale(Math.min(level, 1.6)) : c.scale(0.06);
      if (light) {
        light.diffuse = c;
        light.specular = c.scale(0.25);
        light.intensity = e.intensity * level;
      }
    };
    if (!container) return { root, update };
    light = new PointLight(`${name}_light`, offset, this.scene);
    light.parent = root;
    light.diffuse = color;
    light.specular = color.scale(0.25);
    light.intensity = e.intensity;
    light.range = e.range;
    if (!ClusteredLightContainer.IsLightSupported(light)) {
      light.dispose();
      light = null;
      return { root, update };
    }
    container.addLight(light);
    const lit = light;
    root.onDisposeObservable.addOnce(() => {
      container.removeLight(lit);
      lit.dispose();
    });
    // Off or blinking from the start: show that before the first update arrives.
    if (e.off || e.blink || candle) update((e.off ? 0 : LIGHT_ON) | (Math.round((e.blink ?? 0) * 10) << 2), parseInt(e.color.slice(1), 16), performance.now());
    return { root, update };
  }

  /**
   * The face of a sign or billboard: the words in white on black (the light's
   * colour tints it through the emissive colour, so logic can recolour, dim or
   * blink it). Billboards add bands of colour and scanlines, drawn a little
   * see-through like a hologram.
   */
  private signFace(name: string, text: string, w: number, h: number, color: string, board: boolean): { mesh: Mesh; mat: StandardMaterial } {
    const px = 512;
    const py = Math.max(64, Math.min(512, Math.round((px * h) / w / 16) * 16));
    const tex = new DynamicTexture(`${name}_facetex`, { width: px, height: py }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, px, py);
    if (board) {
      for (let y = 0; y < py; y += 4) {
        const v = Math.round(40 + 40 * Math.sin((y / py) * Math.PI * 3));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(0, y, px, 2);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, px - 16, py - 16);
    }
    const words = text.toUpperCase();
    let size = Math.floor(py * (board ? 0.42 : 0.62));
    ctx.font = `bold ${size}px sans-serif`;
    while (size > 12 && ctx.measureText(words).width > px * 0.88) {
      size -= 4;
      ctx.font = `bold ${size}px sans-serif`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(words, px / 2, py / 2 + size * 0.04);
    tex.update();
    const mat = new StandardMaterial(`${name}_facemat`, this.scene);
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveTexture = tex;
    mat.emissiveColor = Color3.FromHexString(color);
    mat.disableLighting = true;
    if (board) mat.alpha = 0.92;
    this.mats.set(mat.name, mat);
    const mesh = CreatePlane(`${name}_face`, { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    // Planes face -Z; turn it to face +Z, out from the wall like a wall lamp.
    mesh.rotation.y = Math.PI;
    mesh.material = mat;
    return { mesh, mat };
  }

  /** Team colours for flag bases (MapMaker). */
  teamColor: (team: string) => string = () => '#888888';

  /**
   * Editor-only markers for mode objectives: a flag base with its flag in the
   * team's colour, or a hill's area. In a match the mode draws these itself
   * (and only in its own mode).
   */
  private objective(name: string, e: Extract<MapEntity, { kind: 'flag' | 'hill' | 'bombsite' | 'hostage' | 'rescue' }>): Visual {
    // Bomb sites and rescue zones always show (part of the level in every mode, like painted markings).
    if (e.kind === 'bombsite') return { root: createBombsiteModel(this.scene, e.radius, e.label, name) };
    if (e.kind === 'rescue') return { root: createBombsiteModel(this.scene, e.radius, 'EXIT', name, '#3ddc84') };
    // Hostages themselves are drawn by the mode in a match; MapMaker shows where they start.
    if (e.kind === 'hostage') return this.opts.editor ? { root: createBombsiteModel(this.scene, 0.6, 'H', name, '#e8d8a0') } : { root: new TransformNode(name, this.scene) };
    if (!this.opts.editor) return { root: new TransformNode(name, this.scene) };
    if (e.kind === 'hill') return { root: createHillModel(this.scene, e.radius, name) };
    const color = this.teamColor(e.team);
    const root = createFlagBase(this.scene, color, name);
    createFlagModel(this.scene, color, `${name}_flag`).parent = root;
    return { root };
  }

  /** Materials for free blocks (the map's library materials; set by the game and MapMaker views). */
  surface: ((material: string | null, tint: string | null) => Material) | null = null;

  /**
   * A free block that can go away: breakable, crumbling or a trapdoor (solid
   * blocks are part of the level mesh, so only MapMaker draws those here, as
   * a pick target). Crumbling blocks shake when stood on, then drop and break
   * up; trapdoors swing down on their hinge; all come back when respawned.
   */
  private block(name: string, e: Extract<MapEntity, { kind: 'block' }>): Visual {
    if (e.field && e.behaviour === 'solid') return this.field(name, e);
    if (e.glass && e.behaviour === 'solid') return this.glassBlock(name, e);
    const root = new TransformNode(name, this.scene);
    const driven = this.dynamicBlocks.has(e.id);
    if (e.behaviour === 'solid' && !this.opts.editor && !driven) return { root };
    const [w, h, d] = e.size;
    // Trapdoors hinge on their -X edge.
    const hinge = new TransformNode(`${name}_hinge`, this.scene);
    hinge.parent = root;
    hinge.position.x = e.behaviour === 'trapdoor' ? -w / 2 : 0;
    const body = CreateBox(`${name}_body`, { width: w, height: h, depth: d }, this.scene);
    body.parent = hinge;
    body.position.set(e.behaviour === 'trapdoor' ? w / 2 : 0, h / 2, 0);
    body.material = this.surface?.(e.material, e.tint) ?? this.mat('block', '#8a8f98');
    // A coloured lip tells the behaviour apart: amber crumbles, red drops away, grey breaks.
    const lip = e.behaviour === 'crumble' ? '#ffb03b' : e.behaviour === 'trapdoor' ? '#ff5a4f' : e.behaviour === 'breakable' ? '#c9ccd2' : null;
    if (lip) {
      // A thin frame round the top edge, so the surface itself still shows its material.
      const t = Math.min(0.12, w / 6, d / 6);
      const lipMat = this.mat(`lip${lip}`, lip, { emissive: 0.35 });
      for (const [sx, sz, px, pz] of [[w + 0.02, t, 0, d / 2 - t / 2], [w + 0.02, t, 0, -d / 2 + t / 2], [t, d + 0.02, w / 2 - t / 2, 0], [t, d + 0.02, -w / 2 + t / 2, 0]] as const) {
        const strip = CreateBox(`${name}_lip`, { width: sx, height: 0.03, depth: sz }, this.scene);
        strip.parent = body;
        strip.position.set(px, h / 2 + 0.012, pz);
        strip.material = lipMat;
      }
    }
    // Solid blocks are already in the level mesh: in MapMaker this copy is only an invisible pick target.
    // Logic-driven and carried ones are drawn here (in MapMaker too: they are not in its level mesh either).
    if (e.behaviour === 'solid' && !driven && !(this.opts.editor && (e.startHidden || e.pitch || e.roll))) {
      body.visibility = 0;
      return { root };
    }
    if (e.behaviour === 'solid') {
      if (this.opts.editor) {
        if (e.startHidden) body.visibility = 0.45;
        return { root };
      }
      return {
        root,
        update: (a) => hinge.setEnabled(a > 0),
      };
    }
    let gone = 0;
    return {
      root,
      update: (a, b, now, dt) => {
        if (a > 0) {
          gone = 0;
          hinge.setEnabled(true);
          hinge.rotation.z = 0;
          body.scaling.setAll(1);
          // Giving way: a nervous shake.
          const shake = b ? 0.035 : 0;
          body.position.set((e.behaviour === 'trapdoor' ? w / 2 : 0) + Math.sin(now * 0.07) * shake, h / 2 - (b ? 0.02 : 0), Math.cos(now * 0.09) * shake);
          return;
        }
        gone += dt;
        if (e.behaviour === 'trapdoor') hinge.rotation.z = -Math.min(Math.PI / 2, gone * 7);
        else {
          body.position.y = h / 2 - gone * gone * 9;
          body.scaling.setAll(Math.max(0.01, 1 - gone * 1.4));
        }
        hinge.setEnabled(gone < (e.behaviour === 'trapdoor' ? 2.5 : 0.75));
      },
    };
  }

  /**
   * A glass block. In play the instanced glass draws it (GlassVisuals), unless
   * a mover carries it; then, and in MapMaker, it is its own box in the shared
   * glass material (its own tint if it has one), frosting as bulletproof glass
   * cracks, gone when breakable glass shatters.
   */
  private glassBlock(name: string, e: Extract<MapEntity, { kind: 'block' }>): Visual {
    const root = new TransformNode(name, this.scene);
    if (!this.opts.editor && !this.carriedBlocks.has(e.id)) return { root };
    const [w, h, d] = e.size;
    const body = CreateBox(`${name}_body`, { width: w, height: h, depth: d }, this.scene);
    body.parent = root;
    body.position.y = h / 2;
    body.material = glassMaterial(this.scene, e.tint ?? undefined);
    let shown = 100;
    return {
      root,
      update: (a) => {
        if (a === shown) return;
        shown = a;
        body.setEnabled(a > 0);
        const c = Math.max(0, Math.min(1, 1 - a / 100));
        body.material = c > 0.05 ? this.frosted(e.tint ?? undefined, c) : glassMaterial(this.scene, e.tint ?? undefined);
      },
    };
  }

  /** Cracked glass, in four steps of frosting (shared per step and tint). */
  private frosted(tint: string | undefined, c: number): Material {
    const step = Math.min(4, Math.ceil(c * 4));
    const key = `frost|${tint ?? ''}|${step}`;
    let m = this.mats.get(key);
    if (!m) {
      m = glassMaterial(this.scene, tint).clone(`glassFrost_${tint ?? 'clear'}_${step}`) as StandardMaterial;
      m.alpha = 0.1 + step * 0.12;
      m.diffuseColor = m.diffuseColor.add(new Color3(0.08, 0.08, 0.08).scale(step));
      this.mats.set(key, m);
    }
    return m;
  }

  /** Water, lava, acid or swamp: a rippling surface over a tinted volume. */
  private water(name: string, e: Extract<MapEntity, { kind: 'water' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const [w, h, d] = e.size;
    const look = e.tint ? { ...LIQUID_LOOKS[e.liquid], color: e.tint } : LIQUID_LOOKS[e.liquid];
    if (this.liquids.shaded(e.liquid)) {
      // Medium and high graphics: the liquid shader (waves, reflection, depth colour, foam; lava and acid flow).
      const { mesh } = this.liquids.surface(name, e, look.color);
      mesh.parent = root;
      // The volume, for side views (a tank behind glass, a pool's wall): lava and acid glow; water and swamp leave out
      // the top, which the surface shader colours by depth. Same draw count as before the shader.
      const body = CreateBox(`${name}_body`, { width: w - 0.02, height: h - 0.06, depth: d - 0.02, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
      if (e.liquid === 'water' || e.liquid === 'swamp') dropBoxTop(body);
      body.parent = root;
      body.position.y = h / 2 - 0.03;
      body.material = this.mat(`liquidBody${e.liquid}`, look.color, { emissive: look.glow * 0.6, alpha: look.depthAlpha });
      body.isPickable = false;
      return { root };
    }
    const surface = CreateGround(`${name}_surface`, { width: w, height: d, subdivisions: 1 }, this.scene);
    surface.parent = root;
    surface.position.y = h - 0.03;
    surface.material = this.liquidMat(e.liquid, w, d, e.tint);
    const body = CreateBox(`${name}_body`, { width: w - 0.02, height: h - 0.06, depth: d - 0.02, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    body.parent = root;
    body.position.y = h / 2 - 0.03;
    body.material = this.mat(`liquidBody${e.liquid}`, look.color, { emissive: look.glow * 0.6, alpha: look.depthAlpha });
    return { root };
  }

  /** A liquid's surface; `tint` overrides its colour (green acid, murky sewer water). */
  private liquidMat(liquid: Liquid, w: number, d: number, tint?: string): StandardMaterial {
    const look = tint ? { ...LIQUID_LOOKS[liquid], color: tint } : LIQUID_LOOKS[liquid];
    const m = new StandardMaterial(`liquid_${liquid}_${this.mats.size}`, this.scene);
    const tex = this.ripples();
    const t = tex.clone();
    t.uScale = w / 6;
    t.vScale = d / 6;
    m.diffuseTexture = t;
    m.diffuseColor = Color3.FromHexString(look.color);
    m.emissiveColor = Color3.FromHexString(look.color).scale(look.glow);
    m.specularColor = new Color3(look.shine, look.shine, look.shine);
    m.specularPower = 96;
    m.alpha = look.alpha;
    m.backFaceCulling = false;
    this.flowing.push({ tex: t, speed: look.flow });
    this.mats.set(m.name, m);
    return m;
  }

  /** A soft ripple pattern, made once and scrolled per liquid. */
  private ripples(): Texture {
    if (this.rippleTex) return this.rippleTex;
    // Built while the match is being left: the scene (and its engine textures) are already gone.
    if (this.scene.isDisposed) return new Texture(null, this.scene);
    const n = 128;
    const px = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const a = (x / n) * Math.PI * 2;
        const b = (y / n) * Math.PI * 2;
        const v = 0.5 + 0.18 * Math.sin(a * 3 + Math.sin(b * 2) * 1.5) + 0.14 * Math.sin(b * 5 + Math.cos(a * 2) * 2) + 0.08 * Math.sin((a + b) * 7);
        const i = (y * n + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = Math.round(Math.max(0, Math.min(1, 0.72 + (v - 0.5) * 0.9)) * 255);
        px[i + 3] = 255;
      }
    }
    this.rippleTex = RawTexture.CreateRGBATexture(px, n, n, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    this.rippleTex.wrapU = this.rippleTex.wrapV = Texture.WRAP_ADDRESSMODE;
    this.startFlow();
    return this.rippleTex;
  }

  /** Scroll every flowing texture each frame (liquids drift both ways; fields and gravity motes only along v). */
  private startFlow(): void {
    if (this.flowStarted) return;
    this.flowStarted = true;
    this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      for (const f of this.flowing) {
        if (!f.vOnly) f.tex.uOffset = (f.tex.uOffset + dt * f.speed) % 1;
        f.tex.vOffset = (f.tex.vOffset + dt * f.speed * (f.vOnly ? 1 : 0.6)) % 1;
      }
    });
  }

  private flowStarted = false;
  private rippleTex: RawTexture | null = null;
  private flowing: { tex: Texture; speed: number; vOnly?: boolean }[] = [];

  /** Horizontal bands (force fields) or scattered motes (gravity zones), white on black, made once each. */
  private bandsTex: RawTexture | null = null;
  private motesTex: RawTexture | null = null;
  private pattern(kind: 'bands' | 'motes'): Texture {
    const have = kind === 'bands' ? this.bandsTex : this.motesTex;
    if (have) return have.clone();
    if (this.scene.isDisposed) return new Texture(null, this.scene);
    const n = 64;
    const px = new Uint8Array(n * n * 4);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const motes = kind === 'motes' ? Array.from({ length: 22 }, () => [rnd() * n, rnd() * n, 1 + rnd() * 1.6] as const) : [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let v: number;
        if (kind === 'bands') v = 0.35 + 0.35 * Math.pow(0.5 + 0.5 * Math.sin((y / n) * Math.PI * 2 * 6), 6) + 0.3 * Math.pow(0.5 + 0.5 * Math.sin((y / n) * Math.PI * 2 * 1 + x * 0.05), 12);
        else v = Math.max(0, ...motes.map(([mx, my, r]) => 1 - Math.hypot(Math.min(Math.abs(x - mx), n - Math.abs(x - mx)), Math.min(Math.abs(y - my), n - Math.abs(y - my))) / r));
        const i = (y * n + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = Math.round(Math.min(1, v) * 255);
        px[i + 3] = Math.round(Math.min(1, kind === 'bands' ? 0.5 + v * 0.5 : v) * 255);
      }
    }
    const tex = RawTexture.CreateRGBATexture(px, n, n, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    if (kind === 'bands') this.bandsTex = tex;
    else this.motesTex = tex;
    return tex.clone();
  }

  /**
   * A force field: a glowing sheet of scrolling bands between two emitter
   * posts, in the block's tint (cyan by default). Shots and sight pass
   * through it; players and vehicles don't. Logic switches it off and on.
   */
  private field(name: string, e: Extract<MapEntity, { kind: 'block' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const [w, h, d] = e.size;
    const color = e.tint ?? '#5ad8ff';
    const sheet = CreateBox(`${name}_sheet`, { width: w, height: h, depth: d }, this.scene);
    sheet.parent = root;
    sheet.position.y = h / 2;
    const m = new StandardMaterial(`${name}_fieldmat`, this.scene);
    const tex = this.pattern('bands');
    tex.uScale = Math.max(1, Math.round(Math.max(w, d) / 3));
    tex.vScale = Math.max(1, Math.round(h / 3));
    m.diffuseColor = Color3.Black();
    m.emissiveColor = Color3.FromHexString(color);
    m.emissiveTexture = tex;
    m.opacityTexture = tex;
    m.alpha = 0.55;
    m.disableLighting = true;
    m.backFaceCulling = false;
    this.mats.set(m.name, m);
    this.flowing.push({ tex, speed: 0.35, vOnly: true });
    this.startFlow();
    sheet.material = m;
    sheet.enableEdgesRendering();
    sheet.edgesWidth = 3;
    sheet.edgesColor = Color3.FromHexString(color).toColor4(0.9);
    // Emitter posts at both ends of its long side.
    const post = this.mat('fieldPost', '#2a2f3a');
    const core = this.mat('fieldCore', color, { emissive: 1.2 });
    const long = w >= d;
    const along = (long ? w : d) / 2;
    for (const sgn of [-1, 1]) {
      const at: [number, number, number] = long ? [sgn * (along + 0.12), h / 2, 0] : [0, h / 2, sgn * (along + 0.12)];
      this.box(`${name}_post${sgn}`, root, [0.24, h + 0.3, 0.24], at, post);
      this.box(`${name}_core${sgn}`, root, [0.1, h, 0.1], [at[0] * 0.995, h / 2, at[2] * 0.995], core).position.addInPlace(long ? new Vector3(-sgn * 0.08, 0, 0) : new Vector3(0, 0, -sgn * 0.08));
    }
    if (this.opts.editor) {
      if (e.startHidden) sheet.visibility = 0.35;
      return { root };
    }
    if (e.startHidden) sheet.setEnabled(false);
    return { root, update: (a) => sheet.setEnabled(a > 0) };
  }

  /** A low-gravity zone in play: a faint column of motes drifting up (MapMaker draws every zone as a box). */
  private gravityColumn(name: string, e: Extract<MapEntity, { kind: 'zone' }>, root: TransformNode): void {
    const [sx, sy, sz] = e.size;
    const heavy = (e.gravity ?? 1) > 1;
    const vol = CreateBox(`${name}_motes`, { width: sx, height: sy, depth: sz, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    vol.parent = root;
    vol.position.y = sy / 2;
    vol.isPickable = false;
    const m = new StandardMaterial(`${name}_gravmat`, this.scene);
    const tex = this.pattern('motes');
    tex.uScale = Math.max(1, Math.round(Math.max(sx, sz) / 4));
    tex.vScale = Math.max(1, Math.round(sy / 4));
    const color = Color3.FromHexString(heavy ? '#ff9a5a' : '#8fc4ff');
    m.diffuseColor = Color3.Black();
    m.emissiveColor = color;
    m.emissiveTexture = tex;
    m.opacityTexture = tex;
    m.alpha = 0.5;
    m.disableLighting = true;
    m.backFaceCulling = false;
    this.mats.set(m.name, m);
    // Motes rise where gravity is light and sink where it is heavy.
    this.flowing.push({ tex, speed: heavy ? 0.12 : -0.06, vOnly: true });
    this.startFlow();
    vol.material = m;
  }

  /** Jump pad: a glowing ring on a dark plate with a chevron pointing where it throws you. */
  /** Two wooden rails and rungs every 30 cm, standing just off the wall. */
  private ladder(name: string, e: Extract<MapEntity, { kind: 'ladder' }>): Visual {
    const root = new TransformNode(name, this.scene);
    if (e.style === 'vines') return this.vines(name, e, root);
    const wood = this.mat('ladderWood', '#8a5d33');
    const h = e.height + 0.9;
    for (const x of [-e.width / 2, e.width / 2]) this.box(`${name}_rail${x}`, root, [0.08, h, 0.08], [x, h / 2, 0.1], wood);
    for (let y = 0.3, i = 0; y < h - 0.1; y += 0.3, i++) this.box(`${name}_rung${i}`, root, [e.width, 0.05, 0.05], [0, y, 0.1], wood);
    return { root };
  }

  /** Climbing vines: twisting strands across the ladder's width, thick with leaves, hugging the wall. */
  private vines(name: string, e: Extract<MapEntity, { kind: 'ladder' }>, root: TransformNode): Visual {
    const stem = this.mat('vineStem', '#2e5a1a');
    const leafMats = [this.mat('vineLeaf', '#3c7a24'), this.mat('vineLeafLight', '#5a9a30'), this.mat('vineLeafDark', '#24561a')];
    const h = e.height + 0.6;
    const strands = Math.max(3, Math.round(e.width / 0.3));
    let n = 0;
    for (let k = 0; k < strands; k++) {
      const x0 = -e.width / 2 + (k + 0.5) * (e.width / strands);
      for (let y = 0; y < h - 0.05; y += 0.4, n++) {
        const seg = this.box(`${name}_v${n}`, root, [0.05, 0.44, 0.05], [x0 + Math.sin(y * 2.3 + k) * 0.08, y + 0.2, 0.06], stem);
        seg.rotation.z = Math.cos(y * 2.3 + k) * 0.25;
        if ((n + k) % 2 === 0) {
          const leaf = this.box(`${name}_l${n}`, root, [0.22, 0.02, 0.14], [x0 + (n % 3 === 0 ? 0.1 : -0.1), y + 0.25, 0.12], leafMats[n % 3]!);
          leaf.rotation.set(-0.6, n * 0.9, 0.3);
        }
      }
    }
    return { root };
  }

  private pad(name: string): Visual {
    const root = new TransformNode(name, this.scene);
    const plate = CreateCylinder(`${name}_plate`, { diameter: 2.2, height: 0.12, tessellation: 24 }, this.scene);
    plate.parent = root;
    plate.position.y = 0.06;
    plate.material = this.mat('padPlate', '#2a2f3a');
    const ring = CreateCylinder(`${name}_ring`, { diameter: 1.8, height: 0.14, tessellation: 24 }, this.scene);
    ring.parent = root;
    ring.position.y = 0.07;
    ring.material = this.mat('padGlow', '#36d6ff', { emissive: 1 });
    const core = CreateCylinder(`${name}_core`, { diameter: 1.4, height: 0.16, tessellation: 24 }, this.scene);
    core.parent = root;
    core.position.y = 0.08;
    core.material = this.mat('padCore', '#1a2a3a', { emissive: 0.2 });
    for (const [i, z] of [0.1, 0.45].entries()) {
      const a = this.box(`${name}_chev${i}a`, root, [0.12, 0.05, 0.5], [-0.17, 0.18, z], this.mat('padGlow', '#36d6ff', { emissive: 1 }));
      a.rotation.y = -0.7;
      const b = this.box(`${name}_chev${i}b`, root, [0.12, 0.05, 0.5], [0.17, 0.18, z], this.mat('padGlow', '#36d6ff', { emissive: 1 }));
      b.rotation.y = 0.7;
    }
    return { root };
  }

  /** Faction colours for encounter markers (MapMaker). */
  factionColor: (faction: string) => string = () => '#d04a3a';

  /** Editor-only marker: the spawn area in the faction's colour, a flag, and one figure per first-wave member. */
  private encounter(name: string, e: Extract<MapEntity, { kind: 'encounter' }>): Visual {
    const root = new TransformNode(name, this.scene);
    if (e.entrance && e.entrance !== 'none') this.entrance(name, root, e);
    if (!this.opts.editor) return { root };
    const color = this.factionColor(e.faction);
    // Squads with an entrance come out of it, not across an area.
    const disc = CreateCylinder(`${name}_area`, { diameter: e.radius * 2, height: 0.04, tessellation: 32 }, this.scene);
    disc.parent = root;
    disc.position.y = 0.03;
    disc.material = this.mat('encArea', color, { emissive: 0.4, alpha: 0.18 });
    disc.setEnabled((e.entrance ?? 'none') === 'none');
    this.box(`${name}_pole`, root, [0.08, 2.6, 0.08], [0, 1.3, 0], this.mat('pole', '#3a3f48'));
    this.box(`${name}_flag`, root, [0.7, 0.45, 0.03], [0.35, 2.3, 0], this.mat('encFlag', color, { emissive: 0.5 }));
    const count = Math.min(8, rosterSize(e.roster));
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * Math.PI * 2;
      const fig = CreateCylinder(`${name}_fig${i}`, { diameterTop: 0.35, diameterBottom: 0.5, height: 1.2, tessellation: 8 }, this.scene);
      fig.parent = root;
      fig.position.set(Math.cos(a) * Math.min(1.2, e.radius * 0.6), 0.6, Math.sin(a) * Math.min(1.2, e.radius * 0.6));
      fig.material = this.mat('encFig', color);
    }
    return { root };
  }

  /**
   * The way a squad comes in, built where the players can see it (local +z is
   * the squad's facing): a kicked-open ceiling vent, an open floor hatch, a
   * dug-out burrow, or a hole smashed through the wall behind the point with
   * its rubble spilling out.
   */
  private entrance(name: string, root: TransformNode, e: Extract<MapEntity, { kind: 'encounter' }>): void {
    const dark = this.mat('entranceDark', '#07080a');
    const steel = this.mat('entranceSteel', '#5d646d', { spec: 0.3 });
    // Fixed scatter, so every player sees the same rubble.
    let seed = 0;
    for (const c of e.id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const lump = (i: number, mat: StandardMaterial, x: number, y: number, z: number, size: number) => {
      const m = this.box(`${name}_lump${i}`, root, [size * (0.8 + rnd() * 0.6), size * (0.5 + rnd() * 0.5), size * (0.8 + rnd() * 0.6)], [x, y, z], mat);
      m.rotation.set(rnd() * 0.6, rnd() * Math.PI, rnd() * 0.6);
    };
    switch (e.entrance) {
      case 'vent': {
        const h = e.ventHeight ?? 3.5;
        this.box(`${name}_shaft`, root, [1.1, 0.04, 1.1], [0, h - 0.02, 0], dark);
        for (const s of [-1, 1]) {
          this.box(`${name}_frameX${s}`, root, [1.3, 0.08, 0.1], [0, h - 0.04, s * 0.6], steel);
          this.box(`${name}_frameZ${s}`, root, [0.1, 0.08, 1.3], [s * 0.6, h - 0.04, 0], steel);
        }
        // The grate, kicked open, hanging from its hinge.
        const hinge = new TransformNode(`${name}_hinge`, this.scene);
        hinge.parent = root;
        hinge.position.set(0, h - 0.08, -0.55);
        hinge.rotation.x = 1.25;
        for (let i = 0; i < 6; i++) this.box(`${name}_slat${i}`, hinge, [1.05, 0.03, 0.06], [0, 0, 0.1 + i * 0.18], steel);
        for (const x of [-0.5, 0.5]) this.box(`${name}_grateSide${x}`, hinge, [0.05, 0.04, 1.05], [x, 0, 0.52], steel);
        break;
      }
      case 'hatch': {
        this.box(`${name}_pit`, root, [1.0, 0.04, 1.0], [0, 0.02, 0], dark);
        for (const s of [-1, 1]) {
          this.box(`${name}_rimX${s}`, root, [1.2, 0.08, 0.1], [0, 0.04, s * 0.55], steel);
          this.box(`${name}_rimZ${s}`, root, [0.1, 0.08, 1.2], [s * 0.55, 0.04, 0], steel);
        }
        const hinge = new TransformNode(`${name}_hinge`, this.scene);
        hinge.parent = root;
        hinge.position.set(0, 0.08, -0.55);
        hinge.rotation.x = -1.85;
        this.box(`${name}_lid`, hinge, [1.05, 0.06, 1.05], [0, 0, 0.52], steel);
        this.box(`${name}_wheel`, hinge, [0.4, 0.05, 0.4], [0, 0.05, 0.52], this.mat('entranceHandle', '#a33a2a'));
        break;
      }
      case 'burrow': {
        const dirt = this.mat('entranceDirt', '#4e3a2a', { spec: 0 });
        const hole = CreateCylinder(`${name}_hole`, { diameter: 1.5, height: 0.03, tessellation: 18 }, this.scene);
        hole.parent = root;
        hole.position.y = 0.015;
        hole.material = this.mat('entranceHole', '#120c08');
        // A ring of thrown-up earth, low and rounded.
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2 + rnd() * 0.3;
          const d = 0.75 + rnd() * 0.3;
          const clod = CreateSphere(`${name}_clod${i}`, { diameter: 1, segments: 5 }, this.scene);
          clod.parent = root;
          clod.position.set(Math.cos(a) * d, 0.02, Math.sin(a) * d);
          clod.scaling.set(0.3 + rnd() * 0.25, 0.1 + rnd() * 0.12, 0.3 + rnd() * 0.25);
          clod.rotation.y = rnd() * Math.PI;
          clod.material = dirt;
        }
        break;
      }
      case 'breach': {
        // The point stands against the wall; the hole's face is just in front of it and reaches back into the wall. Rubble spills out towards +z.
        const concrete = this.mat('entranceConcrete', '#9a958c');
        this.box(`${name}_gap`, root, [1.3, 2.1, 0.7], [0, 1.05, -0.27], dark);
        for (let i = 0; i < 9; i++) {
          // Broken edges round the gap.
          const side = i % 3;
          const t = rnd();
          const [x, y] = side === 0 ? [-0.7, 0.3 + t * 1.8] : side === 1 ? [0.7, 0.3 + t * 1.8] : [-0.6 + t * 1.2, 2.15];
          const chunk = this.box(`${name}_edge${i}`, root, [0.25 + rnd() * 0.2, 0.25 + rnd() * 0.25, 0.3], [x, y, 0.02], concrete);
          chunk.rotation.z = rnd() * Math.PI;
        }
        for (let i = 0; i < 12; i++) lump(100 + i, concrete, (rnd() - 0.5) * 1.6, 0.06, 0.1 + rnd() * 0.8, 0.14 + rnd() * 0.2);
        break;
      }
    }
  }

  private door(name: string, e: Extract<MapEntity, { kind: 'door' }>): Visual {
    const style = e.style ?? 'sliding';
    if (style === 'saloon' || style === 'vault' || style === 'oak') return this.swingDoor(name, e, style);
    if (style === 'portcullis') return this.portcullis(name, e);
    const root = new TransformNode(name, this.scene);
    const w = DOOR.width / 2;
    const blast = style === 'blast';
    // Blast doors (Style Pack 01): thicker, darker, chevroned, in a heavy frame, and slower to move.
    const steel = blast ? this.mat('blastDoor', '#4c535b', { spec: 0.5 }) : this.mat('door', '#6f7884', { spec: 0.4 });
    const stripe = this.mat('hazard', '#e3b021');
    const dark = this.mat('doorRib', '#4b525c');
    const thick = blast ? DOOR.thickness + 0.2 : DOOR.thickness;
    const leaves = [-1, 1].map((side) => {
      const leaf = new TransformNode(`${name}_leaf${side}`, this.scene);
      leaf.parent = root;
      this.box(`${name}_panel${side}`, leaf, [w - 0.02, DOOR.height, thick], [0, DOOR.height / 2, 0], steel);
      if (blast) {
        for (const y of [0.35, DOOR.height - 0.35]) {
          this.box(`${name}_band${side}${y}`, leaf, [w - 0.06, 0.4, thick + 0.02], [0, y, 0], stripe);
          for (let k = 0; k < 3; k++) this.box(`${name}_chev${side}${y}${k}`, leaf, [0.12, 0.56, thick + 0.04], [-w / 2 + 0.3 + k * 0.45, y, 0], dark).rotation.z = 0.7 * side;
        }
        for (const y of [1.1, 1.9]) this.box(`${name}_bolt${side}${y}`, leaf, [0.22, 0.22, thick + 0.08], [side * -(w / 2 - 0.2), y, 0], dark);
      } else {
        this.box(`${name}_stripe${side}`, leaf, [w - 0.1, 0.18, DOOR.thickness + 0.02], [0, 1.1, 0], stripe);
        this.box(`${name}_rib${side}`, leaf, [0.08, DOOR.height - 0.3, DOOR.thickness + 0.03], [side * -(w / 2 - 0.1), DOOR.height / 2, 0], dark);
      }
      return { leaf, side };
    });
    if (blast) {
      // The frame: posts either side and a lintel, hazard-striped.
      const frame = this.mat('blastFrame', '#3a3f45', { spec: 0.3 });
      for (const side of [-1, 1]) {
        this.box(`${name}_post${side}`, root, [0.35, DOOR.height + 0.4, thick + 0.3], [side * (w + 0.17), (DOOR.height + 0.4) / 2, 0], frame);
        this.box(`${name}_postStripe${side}`, root, [0.37, 0.25, thick + 0.32], [side * (w + 0.17), 0.8, 0], stripe);
      }
      this.box(`${name}_lintel`, root, [DOOR.width + 0.7, 0.4, thick + 0.3], [0, DOOR.height + 0.2, 0], frame);
    }
    const lamp = CreateSphere(`${name}_lamp`, { diameter: 0.22, segments: 8 }, this.scene);
    lamp.parent = root;
    lamp.position.set(0, DOOR.height + 0.25, 0);
    const lampMat = this.ownMat(e.locked ? '#e0412f' : '#3fd26b', 0.9);
    lamp.material = lampMat;
    const place = (open: number) => {
      for (const { leaf, side } of leaves) leaf.position.x = side * (w / 2 + open * w);
    };
    place(e.startOpen ? 1 : 0);
    let shown = e.startOpen ? 1 : 0;
    return {
      root,
      update: (a, b, _now, dt) => {
        // Ease toward the replicated opening so 30 Hz updates look smooth.
        const target = a / 100;
        shown += Math.sign(target - shown) * Math.min(Math.abs(target - shown), dt * (blast ? 1.8 : 2.5));
        place(shown);
        const c = Color3.FromHexString(b ? '#e0412f' : e.auto ? '#3fd26b' : '#f2c14e');
        lampMat.diffuseColor = c;
        lampMat.emissiveColor = c.scale(0.9);
      },
    };
  }

  /**
   * A portcullis (Style Pack 03): an iron grille that winds up into a stone
   * lintel between two piers. It blocks like any door (the collider is the
   * door's); it rises instead of sliding apart.
   */
  private portcullis(name: string, e: Extract<MapEntity, { kind: 'door' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const w = DOOR.width;
    const H = DOOR.height;
    const iron = this.mat('portcullisIron', '#4a4440', { spec: 0.4 });
    const stone = this.mat('portcullisStone', '#cbb48a', { spec: 0.1 });
    const grille = new TransformNode(`${name}_grille`, this.scene);
    grille.parent = root;
    for (let i = 0; i < 7; i++) {
      const x = -w / 2 + 0.2 + (i * (w - 0.4)) / 6;
      this.box(`${name}_bar${i}`, grille, [0.09, H, 0.09], [x, H / 2, 0], iron);
      // Spiked feet.
      this.box(`${name}_spike${i}`, grille, [0.05, 0.25, 0.05], [x, -0.1, 0], iron);
    }
    for (const y of [0.6, 1.5, 2.4]) this.box(`${name}_rail${y}`, grille, [w - 0.2, 0.08, 0.12], [0, y, 0], iron);
    for (const side of [-1, 1]) this.box(`${name}_pier${side}`, root, [0.45, H + 0.6, 0.7], [side * (w / 2 + 0.22), (H + 0.6) / 2, 0], stone);
    this.box(`${name}_lintel`, root, [w + 0.9, 0.6, 0.7], [0, H + 0.3, 0], stone);
    const place = (open: number) => {
      grille.position.y = open * (H - 0.3);
      grille.getChildMeshes().forEach((m) => (m.isVisible = true));
    };
    let shown = e.startOpen ? 1 : 0;
    place(shown);
    return {
      root,
      update: (a, _b, _now, dt) => {
        const target = a / 100;
        shown += Math.sign(target - shown) * Math.min(Math.abs(target - shown), dt * 1.4);
        place(shown);
      },
    };
  }

  /**
   * Doors that swing on hinges (Style Pack 02): `saloon` louvred half-doors
   * hinged at both posts, or a round `vault` door hinged on one side. The
   * collider is the same as any door's; only the look differs.
   */
  private swingDoor(name: string, e: Extract<MapEntity, { kind: 'door' }>, style: 'saloon' | 'vault' | 'oak'): Visual {
    const root = new TransformNode(name, this.scene);
    const w = DOOR.width / 2;
    const hinges: { node: TransformNode; dir: number }[] = [];
    let lampMat: StandardMaterial | null = null;
    if (style === 'oak') {
      // Style Pack 10: an oak plank door, iron straps and a ring handle, hung from one post in an oak frame.
      const oak = this.mat('oakDoor', '#7a5232');
      const dark = this.mat('oakDoorDark', '#4e3420');
      const iron = this.mat('oakDoorIron', '#3a3634', { spec: 0.4 });
      for (const side of [-1, 1]) this.box(`${name}_post${side}`, root, [0.25, DOOR.height + 0.25, 0.4], [side * (w + 0.12), (DOOR.height + 0.25) / 2, 0], dark);
      this.box(`${name}_lintel`, root, [DOOR.width + 0.5, 0.25, 0.4], [0, DOOR.height + 0.12, 0], dark);
      const hinge = new TransformNode(`${name}_hinge`, this.scene);
      hinge.parent = root;
      hinge.position.set(w, 0, 0);
      const leafW = DOOR.width - 0.06;
      for (let k = 0; k < 6; k++) this.box(`${name}_plank${k}`, hinge, [leafW / 6 - 0.02, DOOR.height - 0.04, 0.12], [-0.03 - leafW / 12 - (k * leafW) / 6, DOOR.height / 2, 0], k % 2 ? oak : dark);
      for (const y of [0.45, DOOR.height / 2, DOOR.height - 0.45]) this.box(`${name}_strap${y}`, hinge, [leafW * 0.8, 0.12, 0.15], [-leafW * 0.4 - 0.03, y, 0], iron);
      const ring = CreateCylinder(`${name}_ringHandle`, { diameter: 0.18, height: 0.04, tessellation: 10 }, this.scene);
      ring.parent = hinge;
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-leafW + 0.3, 1.1, -0.1);
      ring.material = iron;
      hinges.push({ node: hinge, dir: 1 });
    } else if (style === 'saloon') {
      const wood = this.mat('saloonDoor', '#8a5a32');
      const slat = this.mat('saloonSlat', '#5e3c20');
      for (const side of [-1, 1]) {
        const hinge = new TransformNode(`${name}_hinge${side}`, this.scene);
        hinge.parent = root;
        hinge.position.x = side * w;
        const leafW = w - 0.06;
        const cx = -side * (leafW / 2 + 0.03);
        this.box(`${name}_rail${side}a`, hinge, [leafW, 0.12, 0.06], [cx, 0.75, 0], wood);
        this.box(`${name}_rail${side}b`, hinge, [leafW, 0.12, 0.06], [cx, 2.05, 0], wood);
        this.box(`${name}_stile${side}a`, hinge, [0.1, 1.42, 0.06], [cx - leafW / 2 + 0.05, 1.4, 0], wood);
        this.box(`${name}_stile${side}b`, hinge, [0.1, 1.42, 0.06], [cx + leafW / 2 - 0.05, 1.4, 0], wood);
        for (let k = 0; k < 8; k++) this.box(`${name}_slat${side}${k}`, hinge, [leafW - 0.16, 0.05, 0.03], [cx, 0.9 + k * 0.145, 0], slat).rotation.x = 0.5;
        hinges.push({ node: hinge, dir: side });
      }
    } else {
      // A round steel door in a square frame, its locking wheel on the front.
      const steel = this.mat('vaultDoor', '#8c939b', { spec: 0.7 });
      const dark = this.mat('vaultDark', '#41464c', { spec: 0.5 });
      const brass = this.mat('vaultBrass', '#b08d3a', { spec: 0.6 });
      for (const side of [-1, 1]) this.box(`${name}_post${side}`, root, [0.3, DOOR.height + 0.3, 0.7], [side * (w + 0.15), (DOOR.height + 0.3) / 2, 0], dark);
      this.box(`${name}_lintel`, root, [DOOR.width + 0.6, 0.3, 0.7], [0, DOOR.height + 0.15, 0], dark);
      const hinge = new TransformNode(`${name}_hinge`, this.scene);
      hinge.parent = root;
      hinge.position.set(w, 0, 0);
      const slab = CreateCylinder(`${name}_slab`, { diameter: DOOR.height - 0.05, height: 0.55, tessellation: 28 }, this.scene);
      slab.parent = hinge;
      slab.rotation.x = Math.PI / 2;
      slab.position.set(-w, DOOR.height / 2, 0);
      slab.scaling.x = (DOOR.width - 0.05) / (DOOR.height - 0.05);
      slab.material = steel;
      const ring = CreateCylinder(`${name}_ring`, { diameter: DOOR.height * 0.62, height: 0.12, tessellation: 24 }, this.scene);
      ring.parent = hinge;
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-w, DOOR.height / 2, -0.33);
      ring.material = dark;
      for (let k = 0; k < 3; k++) this.box(`${name}_spoke${k}`, hinge, [1.5, 0.09, 0.09], [-w, DOOR.height / 2, -0.42], brass).rotation.z = (k * Math.PI) / 3;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        this.box(`${name}_bolt${k}`, hinge, [0.14, 0.14, 0.62], [-w + Math.cos(a) * 1.25, DOOR.height / 2 + Math.sin(a) * 1.25, 0], brass);
      }
      hinges.push({ node: hinge, dir: 1 });
      const lamp = CreateSphere(`${name}_lamp`, { diameter: 0.22, segments: 8 }, this.scene);
      lamp.parent = root;
      lamp.position.set(0, DOOR.height + 0.45, 0);
      lampMat = this.ownMat(e.locked ? '#e0412f' : '#3fd26b', 0.9);
      lamp.material = lampMat;
    }
    // Saloon doors swing both halves out; the vault and oak doors swing wide on their one hinge.
    const swing = style === 'saloon' ? Math.PI / 2 : style === 'oak' ? Math.PI * 0.55 : Math.PI * 0.6;
    const place = (open: number) => {
      for (const h of hinges) h.node.rotation.y = h.dir * open * swing;
    };
    place(e.startOpen ? 1 : 0);
    let shown = e.startOpen ? 1 : 0;
    return {
      root,
      update: (a, b, _now, dt) => {
        const target = a / 100;
        shown += Math.sign(target - shown) * Math.min(Math.abs(target - shown), dt * (style === 'vault' ? 1.2 : 4));
        place(shown);
        if (lampMat) {
          const c = Color3.FromHexString(b ? '#e0412f' : e.auto ? '#3fd26b' : '#f2c14e');
          lampMat.diffuseColor = c;
          lampMat.emissiveColor = c.scale(0.9);
        }
      },
    };
  }

  private button(name: string): Visual {
    const root = new TransformNode(name, this.scene);
    this.box(`${name}_post`, root, [0.3, BUTTON.height - 0.15, 0.3], [0, (BUTTON.height - 0.15) / 2, 0], this.mat('post', '#3a3f48'));
    this.box(`${name}_plate`, root, [0.45, 0.5, 0.1], [0, BUTTON.height, 0.12], this.mat('plate', '#c9ccd2', { spec: 0.5 }));
    const cap = CreateCylinder(`${name}_cap`, { diameter: 0.24, height: 0.08, tessellation: 16 }, this.scene);
    cap.parent = root;
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, BUTTON.height, 0.2);
    const capMat = this.ownMat('#3fd26b', 0.7);
    cap.material = capMat;
    return {
      root,
      update: (enabled, lit) => {
        const c = Color3.FromHexString(lit ? '#ffffff' : enabled ? '#3fd26b' : '#5a5f68');
        capMat.diffuseColor = c;
        capMat.emissiveColor = c.scale(enabled || lit ? 0.8 : 0);
        cap.position.z = lit ? 0.17 : 0.2;
      },
    };
  }

  private destructible(name: string, e: Extract<MapEntity, { kind: 'destructible' }>): Visual {
    const root = new TransformNode(name, this.scene);
    // The game draws every destructible's parts as shared thin instances (batchDestructibles): bodies
    // share one material per colour and darken through their instance colour; MapMaker's each own one.
    const batched = !this.opts.editor;
    const bodyMaterial = (hex: string) => (batched ? this.mat('destructBody', hex, { spec: 0.2 }) : this.ownMat(hex));
    const spec = DESTRUCTIBLE_SPECS[e.model];
    const h = spec.half;
    let body: Mesh;
    let bodyMat: StandardMaterial;
    let base: string;
    if (e.model === 'crate') {
      base = '#9a6b3d';
      bodyMat = bodyMaterial(base);
      body = this.box(`${name}_body`, root, [h.x * 2, h.y * 2, h.z * 2], [0, h.y, 0], bodyMat);
      const plank = this.mat('plank', '#6e4a28');
      for (const s of [-1, 1]) {
        this.box(`${name}_bandz${s}`, root, [h.x * 2 + 0.02, 0.14, 0.04], [0, h.y + s * (h.y - 0.15), h.z], plank);
        this.box(`${name}_bandzb${s}`, root, [h.x * 2 + 0.02, 0.14, 0.04], [0, h.y + s * (h.y - 0.15), -h.z], plank);
      }
      const diag = this.box(`${name}_diag`, root, [0.14, h.y * 2.6, 0.04], [0, h.y, h.z + 0.01], plank);
      diag.rotation.z = Math.PI / 4;
    } else if (e.model === 'barrel') {
      base = '#c23b2a';
      bodyMat = bodyMaterial(base);
      body = CreateCylinder(`${name}_body`, { diameter: h.x * 2, height: h.y * 2, tessellation: 18 }, this.scene);
      body.parent = root;
      body.position.y = h.y;
      body.material = bodyMat;
      for (const y of [0.3, 1.0]) {
        const band = CreateCylinder(`${name}_band${y}`, { diameter: h.x * 2 + 0.04, height: 0.1, tessellation: 18 }, this.scene);
        band.parent = root;
        band.position.y = y;
        band.material = this.mat('barrelBand', '#f2c14e');
      }
    } else if (e.model === 'glass') {
      // A pane in a window: in play the instanced glass draws it with its frame (GlassVisuals); MapMaker draws it here.
      if (!this.opts.editor) return { root };
      const lift = spec.lift ?? 0;
      base = GLASS.tint;
      bodyMat = glassMaterial(this.scene, base);
      body = this.box(`${name}_body`, root, [h.x * 2, h.y * 2, h.z * 2], [0, lift + h.y, 0], bodyMat);
      const frame = this.mat('paneFrame', '#d9d6cf');
      this.box(`${name}_mullion`, root, [0.05, h.y * 2, h.z * 2 + 0.02], [0, lift + h.y, 0], frame);
      this.box(`${name}_transom`, root, [h.x * 2, 0.05, h.z * 2 + 0.02], [0, lift + h.y, 0], frame);
      return { root, update: (health) => root.setEnabled(health > 0) };
    } else if (e.model === 'boards') {
      // Planks nailed across a doorway at slight angles.
      base = '#8a5d33';
      bodyMat = bodyMaterial(base);
      body = this.box(`${name}_body`, root, [h.x * 2, 0.32, h.z * 2], [0, 0.55, 0], bodyMat);
      const plank = this.mat('boardPlank', '#9a6b3d');
      for (const [y, r] of [[1.3, 0.06], [2.05, -0.05], [2.7, 0.04]] as const) this.box(`${name}_plank${y}`, root, [h.x * 2 + 0.1, 0.3, h.z * 2], [0, y, 0], plank).rotation.z = r;
      this.box(`${name}_cross`, root, [0.25, h.y * 2.4, h.z * 2 + 0.02], [0, h.y, 0], plank).rotation.z = 0.55;
    } else if (e.model === 'gas') {
      base = '#d8d8d0';
      bodyMat = bodyMaterial(base);
      body = CreateCylinder(`${name}_body`, { diameter: h.x * 2, height: h.y * 2 - 0.2, tessellation: 16 }, this.scene);
      body.parent = root;
      body.position.y = h.y - 0.1;
      body.material = bodyMat;
      const dome = CreateCylinder(`${name}_valve`, { diameter: 0.14, height: 0.2, tessellation: 10 }, this.scene);
      dome.parent = root;
      dome.position.y = h.y * 2 - 0.1;
      dome.material = this.mat('gasValve', '#5a6066');
      this.box(`${name}_band`, root, [h.x * 2 + 0.02, 0.12, h.z * 2 + 0.02], [0, h.y * 1.3, 0], this.mat('gasBand', '#d8483a', { emissive: 0.2 }));
    } else if (e.model === 'generator') {
      base = '#5a6066';
      bodyMat = bodyMaterial(base);
      body = this.box(`${name}_body`, root, [h.x * 2, h.y * 2 - 0.2, h.z * 2], [0, h.y - 0.1, 0], bodyMat);
      this.box(`${name}_panel`, root, [0.7, 0.45, 0.04], [-0.4, h.y, h.z + 0.01], this.mat('genPanel', '#e3b021', { emissive: 0.35 }));
      this.box(`${name}_fan`, root, [0.6, 0.6, 0.04], [0.45, h.y, h.z + 0.01], this.mat('genFan', '#2a2e34'));
      this.box(`${name}_exhaust`, root, [0.2, 0.5, 0.2], [-0.6, h.y * 2, -0.3], this.mat('genFan', '#2a2e34'));
      this.box(`${name}_skid`, root, [h.x * 2 + 0.2, 0.12, h.z * 2 + 0.1], [0, 0.06, 0], this.mat('genSkid', '#e3b021'));
    } else {
      base = '#9b9a94';
      bodyMat = bodyMaterial(base);
      body = this.box(`${name}_body`, root, [h.x * 2, h.y * 2, h.z * 2], [0, h.y, 0], bodyMat);
      const crack = this.mat('crack', '#44433f');
      for (const [x, y, r, len] of [
        [-0.4, 1.9, 0.6, 1.1],
        [0.5, 1.1, -0.9, 0.9],
        [0.1, 0.6, 0.3, 0.7],
      ] as const) {
        const c = this.box(`${name}_crack${x}`, root, [0.05, len, h.z * 2 + 0.02], [x, y, 0], crack);
        c.rotation.z = r;
      }
      if (e.explosiveOnly) this.box(`${name}_mark`, root, [0.9, 0.9, h.z * 2 + 0.03], [0, 1.5, 0], this.mat('reinforced', '#e3b021'));
    }
    if (batched) return { root, batch: { base } };
    return {
      root,
      update: (health) => {
        root.setEnabled(health > 0);
        // Darken as it takes damage.
        bodyMat.diffuseColor = Color3.FromHexString(base).scale(0.45 + 0.55 * (health / 100));
        body.scaling.y = 1;
      },
    };
  }

  private zone(name: string, e: Extract<MapEntity, { kind: 'zone' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const gravity = e.gravity !== undefined && e.gravity !== 1;
    if (!this.opts.editor) {
      if (gravity) this.gravityColumn(name, e, root);
      return { root };
    }
    const [sx, sy, sz] = e.size;
    // Gravity zones are blue-violet in MapMaker, trigger zones cyan.
    const hue = gravity ? '#8f7bff' : '#36d6ff';
    const m = this.box(`${name}_vol`, root, [sx, sy, sz], [0, sy / 2, 0], this.mat('zone', hue, { emissive: 0.4, alpha: 0.16 }));
    m.enableEdgesRendering();
    m.edgesWidth = 2;
    m.edgesColor = Color3.FromHexString(hue).toColor4(0.9);
    return { root };
  }

  private trap(name: string, e: Extract<MapEntity, { kind: 'trap' }>): Visual {
    switch (e.trap) {
      case 'spikes':
        return this.spikes(name);
      case 'flames':
        return this.flames(name);
      case 'crusher':
        return e.style === 'rockfall' ? this.rockfall(name) : this.crusher(name);
      case 'mine':
        return this.mine(name);
      case 'laser':
        return this.laser(name);
      case 'shock':
        return this.shockFence(name, e);
    }
  }

  /** A placed electric fence: posts every 4 m along its run, live wires that glow while it is on. */
  private shockFence(name: string, e: Extract<MapEntity, { kind: 'trap' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const len = e.length ?? ELECTRIC_FENCE.defaultLength;
    const fence = buildFence(this.scene, name, [{ a: [-len / 2, 0], b: [len / 2, 0], ground: () => 0 }]);
    for (const m of fence.meshes) m.parent = root;
    root.onDisposeObservable.add(() => fence.materials.forEach((m) => m.dispose()));
    if (this.opts.editor) {
      const h = TRAP_SPECS.shock.hazard;
      this.box(`${name}_danger`, root, [len + 0.2, h.half[1] * 2, h.half[2] * 2], h.center, this.mat('danger', '#ff4040', { emissive: 0.5, alpha: 0.12 }));
    }
    fence.animate(0, true);
    return {
      root,
      update: (flags, _b, now) => fence.animate(now, !!(flags & TRAP_ACTIVE)),
    };
  }

  /** Editor-only danger area so creators see what a trap covers. */
  private dangerArea(name: string, root: TransformNode, kind: keyof typeof TRAP_SPECS): void {
    if (!this.opts.editor) return;
    const r = TRAP_SPECS[kind].trigger ?? TRAP_SPECS[kind].hazard;
    this.box(`${name}_danger`, root, [r.half[0] * 2, r.half[1] * 2, r.half[2] * 2], r.center, this.mat('danger', '#ff4040', { emissive: 0.5, alpha: 0.12 }));
  }

  private spikes(name: string): Visual {
    const root = new TransformNode(name, this.scene);
    this.box(`${name}_plate`, root, [3, 0.08, 3], [0, 0.04, 0], this.mat('spikePlate', '#3d4249', { spec: 0.4 }));
    const parts: Mesh[] = [];
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const c = CreateCylinder(`${name}_s`, { diameterTop: 0, diameterBottom: 0.16, height: 0.8, tessellation: 6 }, this.scene);
        c.position.set(x * 0.6, 0.4, z * 0.6);
        parts.push(c);
      }
    }
    const spikes = Mesh.MergeMeshes(parts, true)!;
    spikes.name = `${name}_spikes`;
    spikes.parent = root;
    spikes.material = this.mat('spike', '#b9bec6', { spec: 0.8 });
    this.dangerArea(name, root, 'spikes');
    const hidden = -0.78;
    spikes.position.y = this.opts.editor ? -0.3 : hidden;
    let y = hidden;
    return {
      root,
      update: (flags, _b, now, dt) => {
        const target = !(flags & TRAP_ENABLED) ? hidden : flags & TRAP_ACTIVE ? 0 : flags & TRAP_WARNING ? hidden + 0.12 + Math.sin(now * 0.08) * 0.03 : hidden;
        // Spikes shoot up fast and sink slowly.
        y += Math.sign(target - y) * Math.min(Math.abs(target - y), dt * (target > y ? 14 : 2));
        spikes.position.y = y;
      },
    };
  }

  private flames(name: string): Visual {
    const root = new TransformNode(name, this.scene);
    this.box(`${name}_base`, root, [0.6, 0.5, 0.6], [0, 0.25, 0], this.mat('nozzleBase', '#3a3f48'));
    const nozzle = CreateCylinder(`${name}_nozzle`, { diameterTop: 0.2, diameterBottom: 0.32, height: 0.5, tessellation: 12 }, this.scene);
    nozzle.parent = root;
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 1.1, 0.25);
    nozzle.material = this.mat('nozzle', '#2a2d33', { spec: 0.5 });
    const flame = CreateCylinder(`${name}_flame`, { diameterTop: 1.4, diameterBottom: 0.25, height: 5, tessellation: 14 }, this.scene);
    flame.parent = root;
    flame.rotation.x = Math.PI / 2;
    flame.position.set(0, 1.1, 3);
    flame.material = this.mat('flame', '#ff8a2a', { emissive: 1, alpha: 0.72 });
    const core = CreateCylinder(`${name}_core`, { diameterTop: 0.7, diameterBottom: 0.12, height: 4.4, tessellation: 10 }, this.scene);
    core.parent = root;
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 1.1, 2.7);
    core.material = this.mat('flameCore', '#ffe08a', { emissive: 1, alpha: 0.85 });
    const pilot = CreateSphere(`${name}_pilot`, { diameter: 0.18, segments: 6 }, this.scene);
    pilot.parent = root;
    pilot.position.set(0, 1.1, 0.55);
    pilot.material = this.mat('pilot', '#4aa3ff', { emissive: 1 });
    this.dangerArea(name, root, 'flames');
    const on = (v: boolean) => {
      flame.setEnabled(v);
      core.setEnabled(v);
    };
    on(!!this.opts.editor);
    return {
      root,
      update: (flags, _b, now) => {
        const active = !!(flags & TRAP_ACTIVE);
        on(active);
        pilot.setEnabled(!!(flags & TRAP_ENABLED));
        if (active) {
          const f = 1 + Math.sin(now * 0.05) * 0.06 + Math.sin(now * 0.031) * 0.05;
          flame.scaling.set(f, 1, f);
          core.scaling.set(1 / f, 1, 1 / f);
        }
        pilot.scaling.setAll(flags & TRAP_WARNING ? 2.2 : 1);
      },
    };
  }

  private crusher(name: string): Visual {
    const root = new TransformNode(name, this.scene);
    this.box(`${name}_floor`, root, [3, 0.03, 3], [0, 0.015, 0], this.mat('hazard', '#e3b021'));
    for (const s of [-1, 1]) this.box(`${name}_rail${s}`, root, [0.2, 3.8, 0.2], [s * 1.6, 1.9, 0], this.mat('rail', '#4b525c'));
    const block = new TransformNode(`${name}_blockRoot`, this.scene);
    block.parent = root;
    this.box(`${name}_block`, block, [3, 0.8, 3], [0, 0.4, 0], this.mat('crusher', '#5e636b', { spec: 0.5 }));
    this.box(`${name}_teeth`, block, [2.8, 0.1, 2.8], [0, -0.05, 0], this.mat('teeth', '#2a2d33'));
    this.dangerArea(name, root, 'crusher');
    const top = 3.0;
    const bottom = 0.1;
    block.position.y = top;
    let y = top;
    return {
      root,
      update: (flags, _b, now, dt) => {
        const active = !!(flags & TRAP_ACTIVE);
        const target = active ? bottom : top;
        y += Math.sign(target - y) * Math.min(Math.abs(target - y), dt * (active ? 24 : 1.5));
        // Shudder before it drops.
        block.position.x = flags & TRAP_WARNING ? Math.sin(now * 0.09) * 0.03 : 0;
        block.position.y = y;
      },
    };
  }

  /** Falling rocks: boulders lodged overhead that shudder, drop when it fires and are back up there once it rearms. */
  private rockfall(name: string): Visual {
    const root = new TransformNode(name, this.scene);
    const rocks = new TransformNode(`${name}_rocks`, this.scene);
    rocks.parent = root;
    const rock = [this.mat('rockfall', '#767261'), this.mat('rockfallDark', '#5e5e48')];
    for (const [i, [x, z, d]] of ([[-0.8, -0.5, 1.3], [0.7, -0.3, 1.1], [0.1, 0.7, 1.4], [-0.6, 0.9, 0.9], [0.9, 0.9, 0.8]] as const).entries()) {
      const r = CreateSphere(`${name}_rock${i}`, { diameter: d, segments: 3 }, this.scene);
      r.scaling.set(1, 0.75, 0.9);
      r.rotation.y = i;
      r.position.set(x, d * 0.35, z);
      r.material = rock[i % 2]!;
      r.parent = rocks;
    }
    for (const [x, z] of [[-1.2, 1.1], [1.0, -1.2], [0.3, 0.2]] as const) this.box(`${name}_scree${x}`, root, [0.4, 0.12, 0.3], [x, 0.06, z], rock[1]!);
    if (this.opts.editor) this.dangerArea(name, root, 'crusher');
    const top = 3.2;
    rocks.position.y = top;
    let y = top;
    return {
      root,
      update: (flags, _b, now, dt) => {
        const active = !!(flags & TRAP_ACTIVE);
        // Down fast when it fires; once it rearms the rocks are simply back up there.
        y = active ? Math.max(0.05, y - dt * 18) : top;
        rocks.position.x = flags & TRAP_WARNING ? Math.sin(now * 0.07) * 0.05 : 0;
        rocks.position.y = y;
      },
    };
  }

  private mine(name: string): Visual {
    const root = new TransformNode(name, this.scene);
    const disc = CreateCylinder(`${name}_disc`, { diameter: 0.55, height: 0.12, tessellation: 16 }, this.scene);
    disc.parent = root;
    disc.position.y = 0.06;
    disc.material = this.mat('mine', '#3b4033', { spec: 0.3 });
    const light = CreateSphere(`${name}_light`, { diameter: 0.1, segments: 6 }, this.scene);
    light.parent = root;
    light.position.y = 0.14;
    const lightMat = this.ownMat('#ff2a2a', 1);
    light.material = lightMat;
    this.dangerArea(name, root, 'mine');
    return {
      root,
      update: (flags, _b, now) => {
        root.setEnabled(!(flags & TRAP_SPENT) && !(flags & TRAP_ACTIVE));
        const period = flags & TRAP_WARNING ? 90 : 900;
        const on = !!(flags & TRAP_ENABLED) && now % period < period * 0.4;
        lightMat.emissiveColor = on ? Color3.FromHexString('#ff2a2a') : Color3.Black();
      },
    };
  }

  private laser(name: string): Visual {
    const root = new TransformNode(name, this.scene);
    for (const s of [-1, 1]) this.box(`${name}_post${s}`, root, [0.16, 2.1, 0.16], [s * 1.58, 1.05, 0], this.mat('laserPost', '#2a2d33', { spec: 0.6 }));
    const beams: Mesh[] = [];
    for (const y of [0.4, 0.85, 1.3, 1.75]) beams.push(this.box(`${name}_beam${y}`, root, [3.0, 0.03, 0.03], [0, y, 0], this.mat('laserBeam', '#ff2040', { emissive: 1 })));
    this.dangerArea(name, root, 'laser');
    const show = (v: boolean) => beams.forEach((b) => b.setEnabled(v));
    show(!!this.opts.editor);
    return {
      root,
      update: (flags, _b, now) => {
        const active = !!(flags & TRAP_ACTIVE);
        const warn = !!(flags & TRAP_WARNING);
        show(active || (warn && now % 120 < 50));
      },
    };
  }
}

/**
 * Candle light: a gentle flicker round full brightness; with `blink` (per
 * second) it gutters, dropping near dark and flaring back at random moments.
 */
function candleFlicker(t: number, blink: number, seed: number): number {
  let k = 0.9 + 0.06 * Math.sin(t * 13 + seed) + 0.04 * Math.sin(t * 31 + seed * 2);
  if (blink) {
    const step = Math.floor(t * blink * 3);
    const r = Math.abs(Math.sin(step * 12.9898 + seed * 78.233) * 43758.5453) % 1;
    k *= r < 0.45 ? 0.08 + 0.25 * r : 1.1;
  }
  return k;
}

/**
 * Leave out a box's top face (CreateBox: six faces of two triangles each, the
 * fifth is +Y; double-sided boxes repeat the list back-facing).
 */
function dropBoxTop(box: Mesh): void {
  const idx = box.getIndices();
  const pos = box.getVerticesData('position');
  if (!idx || !pos) return;
  const keep: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]!;
    const b = idx[t + 1]!;
    const c = idx[t + 2]!;
    // A triangle whose corners are all at the top.
    const top = pos[a * 3 + 1]! > 0 && pos[b * 3 + 1]! > 0 && pos[c * 3 + 1]! > 0;
    if (!top) keep.push(a, b, c);
  }
  box.setIndices(keep);
}
