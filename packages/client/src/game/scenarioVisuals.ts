import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Rendering/edgesRenderer';
import {
  BUTTON,
  DESTRUCTIBLE_SPECS,
  DOOR,
  TRAP_ACTIVE,
  TRAP_ENABLED,
  TRAP_SPECS,
  TRAP_SPENT,
  TRAP_WARNING,
  type MapEntity,
} from '@chronosplit/shared';

/**
 * Procedural models for scenario entities: doors, buttons, crates, barrels,
 * breakable walls, traps and (editor only) zones. Built from simple shapes in
 * code, like the map materials, and shared by the game and MapMaker so both
 * show the same thing. `apply` animates them from replicated state.
 */

type Kind = Exclude<MapEntity['kind'], 'spawn' | 'pickup' | 'prop'>;
export const SCENARIO_KINDS: readonly Kind[] = ['door', 'button', 'destructible', 'zone', 'trap'];
export const isScenarioEntity = (e: MapEntity): e is Extract<MapEntity, { kind: Kind }> => (SCENARIO_KINDS as readonly string[]).includes(e.kind);

interface Visual {
  root: TransformNode;
  /** Animate from replicated state [a, b] (see ScenarioSnapshot) and wall-clock time. */
  update?: (a: number, b: number, now: number, dt: number) => void;
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
  ) {}

  /** (Re)build visuals for every scenario entity in the list. Indices match map.entities. */
  build(entities: readonly MapEntity[]): void {
    this.clear();
    entities.forEach((e, i) => {
      if (!isScenarioEntity(e)) return;
      const v = this.create(e, `sc_${e.id}`);
      v.root.position.set(e.position[0], e.position[1], e.position[2]);
      if ('yaw' in e) v.root.rotation.y = e.yaw;
      for (const m of v.root.getChildMeshes()) m.isPickable = false;
      this.visuals.set(i, v);
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
  }

  clear(): void {
    for (const v of this.visuals.values()) v.root.dispose(false, false);
    this.visuals.clear();
  }

  dispose(): void {
    this.clear();
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
    }
  }

  /** Faction colours for encounter markers (MapMaker). */
  factionColor: (faction: string) => string = () => '#d04a3a';

  /** Editor-only marker: the spawn area in the faction's colour, a flag, and one figure per first-wave member. */
  private encounter(name: string, e: Extract<MapEntity, { kind: 'encounter' }>): Visual {
    const root = new TransformNode(name, this.scene);
    if (!this.opts.editor) return { root };
    const color = this.factionColor(e.faction);
    const disc = CreateCylinder(`${name}_area`, { diameter: e.radius * 2, height: 0.04, tessellation: 32 }, this.scene);
    disc.parent = root;
    disc.position.y = 0.03;
    disc.material = this.mat('encArea', color, { emissive: 0.4, alpha: 0.18 });
    this.box(`${name}_pole`, root, [0.08, 2.6, 0.08], [0, 1.3, 0], this.mat('pole', '#3a3f48'));
    this.box(`${name}_flag`, root, [0.7, 0.45, 0.03], [0.35, 2.3, 0], this.mat('encFlag', color, { emissive: 0.5 }));
    const count = Math.min(8, e.roster.trooper + e.roster.gunner + e.roster.heavy);
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * Math.PI * 2;
      const fig = CreateCylinder(`${name}_fig${i}`, { diameterTop: 0.35, diameterBottom: 0.5, height: 1.2, tessellation: 8 }, this.scene);
      fig.parent = root;
      fig.position.set(Math.cos(a) * Math.min(1.2, e.radius * 0.6), 0.6, Math.sin(a) * Math.min(1.2, e.radius * 0.6));
      fig.material = this.mat('encFig', color);
    }
    return { root };
  }

  private door(name: string, e: Extract<MapEntity, { kind: 'door' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const w = DOOR.width / 2;
    const steel = this.mat('door', '#6f7884', { spec: 0.4 });
    const stripe = this.mat('hazard', '#e3b021');
    const leaves = [-1, 1].map((side) => {
      const leaf = new TransformNode(`${name}_leaf${side}`, this.scene);
      leaf.parent = root;
      this.box(`${name}_panel${side}`, leaf, [w - 0.02, DOOR.height, DOOR.thickness], [0, DOOR.height / 2, 0], steel);
      this.box(`${name}_stripe${side}`, leaf, [w - 0.1, 0.18, DOOR.thickness + 0.02], [0, 1.1, 0], stripe);
      this.box(`${name}_rib${side}`, leaf, [0.08, DOOR.height - 0.3, DOOR.thickness + 0.03], [side * -(w / 2 - 0.1), DOOR.height / 2, 0], this.mat('doorRib', '#4b525c'));
      return { leaf, side };
    });
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
        shown += Math.sign(target - shown) * Math.min(Math.abs(target - shown), dt * 2.5);
        place(shown);
        const c = Color3.FromHexString(b ? '#e0412f' : e.auto ? '#3fd26b' : '#f2c14e');
        lampMat.diffuseColor = c;
        lampMat.emissiveColor = c.scale(0.9);
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
    const spec = DESTRUCTIBLE_SPECS[e.model];
    const h = spec.half;
    let body: Mesh;
    let bodyMat: StandardMaterial;
    let base: string;
    if (e.model === 'crate') {
      base = '#9a6b3d';
      bodyMat = this.ownMat(base);
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
      bodyMat = this.ownMat(base);
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
    } else {
      base = '#9b9a94';
      bodyMat = this.ownMat(base);
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
    if (!this.opts.editor) return { root };
    const [sx, sy, sz] = e.size;
    const m = this.box(`${name}_vol`, root, [sx, sy, sz], [0, sy / 2, 0], this.mat('zone', '#36d6ff', { emissive: 0.4, alpha: 0.16 }));
    m.enableEdgesRendering();
    m.edgesWidth = 2;
    m.edgesColor = Color3.FromHexString('#36d6ff').toColor4(0.9);
    return { root };
  }

  private trap(name: string, e: Extract<MapEntity, { kind: 'trap' }>): Visual {
    switch (e.trap) {
      case 'spikes':
        return this.spikes(name);
      case 'flames':
        return this.flames(name);
      case 'crusher':
        return this.crusher(name);
      case 'mine':
        return this.mine(name);
      case 'laser':
        return this.laser(name);
    }
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
