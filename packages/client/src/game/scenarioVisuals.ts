import type { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Rendering/edgesRenderer';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import type { Material } from '@babylonjs/core/Materials/material';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';
import '@babylonjs/core/Lights/Clustered/clusteredLightingSceneComponent';
import {
  BUTTON,
  DESTRUCTIBLE_SPECS,
  rosterSize,
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
export const SCENARIO_KINDS: readonly Kind[] = ['door', 'button', 'destructible', 'zone', 'trap', 'pad', 'block', 'water', 'flag', 'hill', 'ladder', 'bombsite', 'hostage', 'rescue', 'light'];
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
    }
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
    const container = this.container();
    if (!container) return { root };
    const light = new PointLight(`${name}_light`, offset, this.scene);
    light.parent = root;
    light.diffuse = color;
    light.specular = color.scale(0.25);
    light.intensity = e.intensity;
    light.range = e.range;
    if (!ClusteredLightContainer.IsLightSupported(light)) {
      light.dispose();
      return { root };
    }
    container.addLight(light);
    root.onDisposeObservable.addOnce(() => {
      container.removeLight(light);
      light.dispose();
    });
    return { root };
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
    const root = new TransformNode(name, this.scene);
    if (e.behaviour === 'solid' && !this.opts.editor) return { root };
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
    if (e.behaviour === 'solid') {
      body.visibility = 0;
      return { root };
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

  /** Water, lava, acid or swamp: a rippling surface over a tinted volume. */
  private water(name: string, e: Extract<MapEntity, { kind: 'water' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const [w, h, d] = e.size;
    const look = LIQUID_LOOKS[e.liquid];
    const surface = CreateGround(`${name}_surface`, { width: w, height: d, subdivisions: 1 }, this.scene);
    surface.parent = root;
    surface.position.y = h - 0.03;
    surface.material = this.liquidMat(e.liquid, w, d);
    const body = CreateBox(`${name}_body`, { width: w - 0.02, height: h - 0.06, depth: d - 0.02, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    body.parent = root;
    body.position.y = h / 2 - 0.03;
    body.material = this.mat(`liquidBody${e.liquid}`, look.color, { emissive: look.glow * 0.6, alpha: look.depthAlpha });
    return { root };
  }

  private liquidMat(liquid: Liquid, w: number, d: number): StandardMaterial {
    const look = LIQUID_LOOKS[liquid];
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
    this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      for (const f of this.flowing) {
        f.tex.uOffset = (f.tex.uOffset + dt * f.speed) % 1;
        f.tex.vOffset = (f.tex.vOffset + dt * f.speed * 0.6) % 1;
      }
    });
    return this.rippleTex;
  }

  private rippleTex: RawTexture | null = null;
  private flowing: { tex: Texture; speed: number }[] = [];

  /** Jump pad: a glowing ring on a dark plate with a chevron pointing where it throws you. */
  /** Two wooden rails and rungs every 30 cm, standing just off the wall. */
  private ladder(name: string, e: Extract<MapEntity, { kind: 'ladder' }>): Visual {
    const root = new TransformNode(name, this.scene);
    const wood = this.mat('ladderWood', '#8a5d33');
    const h = e.height + 0.9;
    for (const x of [-e.width / 2, e.width / 2]) this.box(`${name}_rail${x}`, root, [0.08, h, 0.08], [x, h / 2, 0.1], wood);
    for (let y = 0.3, i = 0; y < h - 0.1; y += 0.3, i++) this.box(`${name}_rung${i}`, root, [e.width, 0.05, 0.05], [0, y, 0.1], wood);
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
    } else if (e.model === 'glass') {
      // A pane in a window: translucent, with a thin frame.
      const lift = spec.lift ?? 0;
      base = '#bfe6f5';
      bodyMat = this.ownMat(base);
      bodyMat.alpha = 0.35;
      bodyMat.specularColor = new Color3(0.9, 0.9, 0.9);
      bodyMat.specularPower = 96;
      body = this.box(`${name}_body`, root, [h.x * 2, h.y * 2, h.z * 2], [0, lift + h.y, 0], bodyMat);
      const frame = this.mat('paneFrame', '#d9d6cf');
      this.box(`${name}_mullion`, root, [0.05, h.y * 2, h.z * 2 + 0.02], [0, lift + h.y, 0], frame);
      this.box(`${name}_transom`, root, [h.x * 2, 0.05, h.z * 2 + 0.02], [0, lift + h.y, 0], frame);
    } else if (e.model === 'boards') {
      // Planks nailed across a doorway at slight angles.
      base = '#8a5d33';
      bodyMat = this.ownMat(base);
      body = this.box(`${name}_body`, root, [h.x * 2, 0.32, h.z * 2], [0, 0.55, 0], bodyMat);
      const plank = this.mat('boardPlank', '#9a6b3d');
      for (const [y, r] of [[1.3, 0.06], [2.05, -0.05], [2.7, 0.04]] as const) this.box(`${name}_plank${y}`, root, [h.x * 2 + 0.1, 0.3, h.z * 2], [0, y, 0], plank).rotation.z = r;
      this.box(`${name}_cross`, root, [0.25, h.y * 2.4, h.z * 2 + 0.02], [0, h.y, 0], plank).rotation.z = 0.55;
    } else if (e.model === 'gas') {
      base = '#d8d8d0';
      bodyMat = this.ownMat(base);
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
      bodyMat = this.ownMat(base);
      body = this.box(`${name}_body`, root, [h.x * 2, h.y * 2 - 0.2, h.z * 2], [0, h.y - 0.1, 0], bodyMat);
      this.box(`${name}_panel`, root, [0.7, 0.45, 0.04], [-0.4, h.y, h.z + 0.01], this.mat('genPanel', '#e3b021', { emissive: 0.35 }));
      this.box(`${name}_fan`, root, [0.6, 0.6, 0.04], [0.45, h.y, h.z + 0.01], this.mat('genFan', '#2a2e34'));
      this.box(`${name}_exhaust`, root, [0.2, 0.5, 0.2], [-0.6, h.y * 2, -0.3], this.mat('genFan', '#2a2e34'));
      this.box(`${name}_skid`, root, [h.x * 2 + 0.2, 0.12, h.z * 2 + 0.1], [0, 0.06, 0], this.mat('genSkid', '#e3b021'));
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
