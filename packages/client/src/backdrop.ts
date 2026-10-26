import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { CORE_THEMES, SKIES, borderStyleAt, boxBounds, resolveBackdrop, vertexY, type Backdrop, type MapDocument, type PropEntity, type SceneryId, type SkyDefinition, type TerrainMaterial, type WorldBox } from '@tiletrigger/shared';
import type { ModelLibrary } from './content/models.ts';
import { createPropNode } from './game/propVisuals.ts';
import type { MapStyler } from './mapMeshes.ts';
import { versioned } from './assetUrl.ts';

/**
 * Everything past the play area, drawn but never collided with: a photo sky
 * (or stars), the ground carrying on beyond the border, distant scenery
 * (hills, mountains, mesas, a city skyline, forest…) and haze that fades it
 * into the horizon. Built from the map's backdrop (or its theme's) and
 * rebuilt whole when that changes.
 */
export class BackdropVisuals {
  private meshes: Mesh[] = [];
  private materials: (StandardMaterial | Texture | RawTexture)[] = [];
  private key = '';

  constructor(
    private readonly scene: Scene,
    private readonly styler: MapStyler,
    /** With a model library, the belt past the border is dressed with props (in play, not in MapMaker). */
    private readonly models?: ModelLibrary,
  ) {}

  /** Props dressing the belt past the border (dropped with the rest). */
  private nodes: TransformNode[] = [];
  /** How the ground past the border rises, and what stands on it. */
  private profile: BeltProfile = BELTS.none!;

  /** (Re)build for this map; cheap to call again when nothing changed. `dim` darkens the sky (MapMaker). */
  /** The sky of the last build (its colours and sun drive the mist and light shafts). */
  sky: SkyDefinition | null = null;

  build(doc: MapDocument, boxes: readonly WorldBox[], dim = 1): Backdrop {
    const backdrop = resolveBackdrop(doc);
    const area = playArea(doc, boxes);
    const key = JSON.stringify([backdrop, area, doc.classicStructure.theme, dim]);
    if (key === this.key) return backdrop;
    this.dispose();
    this.key = key;
    const sky = skyFor(backdrop, doc);
    this.sky = sky;
    const horizon = Color3.FromHexString(sky.horizon);
    this.applyLighting(sky);
    this.scene.clearColor = new Color4(horizon.r * dim, horizon.g * dim, horizon.b * dim, 1);
    if (sky.file || sky.id === 'space') this.buildSky(sky, dim);
    // Haze: thin near the action, thick far out, so distant scenery melts into the horizon.
    if (backdrop.haze > 0 && sky.id !== 'space') {
      this.scene.fogMode = 2; // Scene.FOGMODE_EXP2
      this.scene.fogColor = horizon.scale(dim);
      this.scene.fogDensity = 0.0002 + backdrop.haze * 0.0014;
    } else this.scene.fogMode = 0;
    const rand = seeded(doc.metadata.id);
    this.profile = beltProfile(backdrop, doc.classicStructure.theme);
    if (backdrop.ground !== 'none') {
      this.buildGround(doc, backdrop, area);
      if (backdrop.ground !== 'water') this.buildBelt(doc, area, rand);
    }
    this.buildScenery(backdrop.scenery, area, sky, rand);
    return backdrop;
  }

  dispose(): void {
    for (const n of this.nodes) n.dispose();
    this.nodes = [];
    for (const m of this.meshes) m.dispose();
    for (const m of this.materials) m.dispose();
    this.meshes = [];
    this.materials = [];
    this.key = '';
  }

  private applyLighting(sky: SkyDefinition): void {
    const hemi = this.scene.getLightByName('hemi') as HemisphericLight | null;
    const sun = this.scene.getLightByName('sun') as DirectionalLight | null;
    // A stronger sun against a softer sky light, so shadows and the sunny sides of things read (tone mapping evens it out).
    if (hemi) {
      hemi.intensity = sky.light.hemi * 0.9;
      // Light bouncing up off the ground: without it every ceiling and underside is black (indoors, roofed maps).
      hemi.groundColor = new Color3(0.62, 0.58, 0.54);
    }
    if (sun) {
      sun.intensity = sky.light.sun * 1.5;
      sun.diffuse = Color3.FromHexString(sky.light.sunColor);
      const el = (sky.light.elevation * Math.PI) / 180;
      sun.direction = new Vector3(-0.8 * Math.cos(el), -Math.max(0.15, Math.sin(el)), 0.6 * Math.cos(el));
    }
  }

  private buildSky(sky: SkyDefinition, dim: number): void {
    const box = CreateBox('backdrop_sky', { size: 1800, sideOrientation: Mesh.BACKSIDE }, this.scene);
    box.infiniteDistance = true;
    box.isPickable = false;
    const mat = new StandardMaterial('backdrop_skyMat', this.scene);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mat.fogEnabled = false;
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    const tex = sky.file ? new Texture(versioned(`${import.meta.env.BASE_URL}${sky.file}`), this.scene, true, false) : starfield(this.scene);
    tex.coordinatesMode = Texture.FIXED_EQUIRECTANGULAR_MODE;
    mat.reflectionTexture = tex;
    mat.reflectionTexture.level = dim;
    box.material = mat;
    box.applyFog = false;
    this.meshes.push(box);
    this.materials.push(mat, tex);
  }

  /**
   * The ground past the border: a skirt that starts at the edge of the map
   * (following the terrain's edge heights, or just under the lowest floor)
   * and runs out 3 km, easing to a level plain with gentle swells.
   */
  private buildGround(doc: MapDocument, backdrop: Backdrop, area: PlayArea): void {
    const ground = backdrop.ground as TerrainMaterial | 'water';
    const t = doc.terrain;
    const per = perimeter(area.min, area.max, 4);
    const edgeHeights = per.map(([x, z]) => edgeHeight(doc, x, z, area.floor));
    const sorted = [...edgeHeights].sort((a, b) => a - b);
    const plain = t ? sorted[Math.floor(sorted.length / 2)]! - 0.5 : area.floor;
    this.ground = { per, edgeHeights, plain };
    const rings = [0, 4, 10, 18, 28, 40, 56, 80, 110, 160, 240, 360, 600, 1100, 2400];
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const water = ground === 'water';
    const scale = water ? 8 : this.styler.groundScale(ground as TerrainMaterial);
    // A shoreline border: the land past it drops under the border's sea.
    const shore = per.map(([x, z]) => borderStyleAt(doc, x, z) === 'water');
    const sea = Math.min(...edgeHeights.filter((_, i) => shore[i])) - 1.1;
    per.forEach(([x, z], i) => {
      const dx = x - area.centre[0];
      const dz = z - area.centre[1];
      const l = Math.hypot(dx, dz) || 1;
      for (const d of rings) {
        const px = x + (dx / l) * d;
        const pz = z + (dz / l) * d;
        const k = Math.min(1, d / 60);
        const swell = water ? 0 : Math.sin(px * 0.013) * Math.cos(pz * 0.011) * 2.5 * Math.min(1, d / 200);
        // Water sits flat; land leaves the map's edge and settles to the plain.
        let y = water ? Math.min(area.floor, plain) - 0.4 : edgeHeights[i]! * (1 - k) + plain * k + swell + this.rise(px, pz, d) - (d === 0 ? 0.02 : 0);
        if (shore[i] && d > 0) y = Math.min(y, sea - 1.5);
        positions.push(px, y, pz);
        uvs.push(px / scale, pz / scale);
      }
    });
    const n = rings.length;
    for (let i = 0; i < per.length; i++) {
      const a = i * n;
      const b = ((i + 1) % per.length) * n;
      for (let r = 0; r < n - 1; r++) indices.push(a + r, a + r + 1, b + r + 1, a + r, b + r + 1, b + r);
    }
    // Without terrain, the ground also runs under the map itself (just below the lowest floor), so gaps between tiles show ground, not sky.
    if (!t && !water) {
      const c = positions.length / 3;
      positions.push(area.centre[0], area.floor - 0.05, area.centre[1]);
      uvs.push(area.centre[0] / scale, area.centre[1] / scale);
      for (let i = 0; i < per.length; i++) indices.push(c, i * n, ((i + 1) % per.length) * n);
    }
    const mesh = new Mesh('backdrop_ground', this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.uvs = uvs;
    vd.indices = indices;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    // The perimeter runs either way round depending on the rectangle; make the faces point up.
    if ((normals[1] ?? 1) < 0) {
      for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
      normals.length = 0;
      VertexData.ComputeNormals(positions, indices, normals);
    }
    vd.normals = normals;
    vd.applyToMesh(mesh);
    if (water) {
      const mat = new StandardMaterial('backdrop_water', this.scene);
      mat.diffuseColor = Color3.FromHexString('#2f5f7a');
      mat.specularColor = new Color3(0.5, 0.55, 0.6);
      mat.specularPower = 64;
      this.materials.push(mat);
      mesh.material = mat;
    } else mesh.material = this.styler.groundMaterial(ground as TerrainMaterial);
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    this.meshes.push(mesh);
  }

  private ground: { per: [number, number][]; edgeHeights: number[]; plain: number } | null = null;

  /**
   * How far the ground past the border rises at a point `d` metres out: a
   * berm close in, so the map sits in a hollow instead of ending on a flat
   * plain, then rolling hills that settle back down far away, under the
   * distant scenery.
   */
  private rise(x: number, z: number, d: number): number {
    const p = this.profile;
    const n1 = Math.sin(x * 0.031 + 1.7) * Math.cos(z * 0.027 - 0.4) * 0.5 + 0.5;
    const n2 = (Math.sin(x * 0.0071) * Math.cos(z * 0.0083 + 2) + Math.sin((x + z) * 0.013) * 0.5) / 3 + 0.5;
    return 2 * p.berm * smooth(5, 42, d) * (0.55 + 0.45 * n1) + 1.8 * p.hills * smooth(35, 230, d) * n2 * (1 - smooth(550, 1300, d));
  }

  /** The ground height past the border at perimeter sample `i`, `d` metres out (the same surface the ground mesh draws). */
  private heightAt(i: number, x: number, z: number, d: number, area: PlayArea): number {
    const g = this.ground!;
    const k = Math.min(1, d / 60);
    const swell = Math.sin(x * 0.013) * Math.cos(z * 0.011) * 2.5 * Math.min(1, d / 200);
    return g.edgeHeights[i]! * (1 - k) + g.plain * k + swell + this.rise(x, z, d);
  }

  /**
   * Dress the belt past the border so the map's edge blends into the
   * scenery: trees and rocks, cacti, ruins, containers or low city blocks,
   * thick close in and thinning out, chosen by the theme and scenery.
   */
  private buildBelt(doc: MapDocument, area: PlayArea, rand: () => number): void {
    const p = this.profile;
    const g = this.ground;
    if (!g || (!p.props.length && !p.buildings)) return;
    const pick = <T>(xs: readonly T[]) => pick3(rand, xs);
    let placed = 0;
    const budget = Math.round(900 * p.density);
    g.per.forEach(([x, z], i) => {
      // Cliffs, city blocks, forest and sea along the border stand where the belt would.
      const border = borderStyleAt(doc, x, z);
      if (border !== 'none' && border !== 'fence') return;
      const dx = x - area.centre[0];
      const dz = z - area.centre[1];
      const l = Math.hypot(dx, dz) || 1;
      const ox = dx / l;
      const oz = dz / l;
      // Three bands: close in (kept a few metres off the wall line), middle, far (bigger, fewer); things grow in small clusters.
      for (const [d0, d1, chance] of [[7, 24, 0.75], [24, 55, 0.65], [55, 115, 0.5]] as const) {
        if (rand() > chance * p.density) continue;
        const cluster = 1 + Math.floor(rand() * 3);
        const d = d0 + rand() * (d1 - d0);
        const side = (rand() - 0.5) * 4;
        const model = pick(p.props);
        for (let c = 0; c < cluster && placed < budget; c++) {
          const cd = d + (rand() - 0.5) * 6;
          const cs = side + (rand() - 0.5) * 6;
          const px = x + ox * cd - oz * cs;
          const pz = z + oz * cd + ox * cs;
          const y = this.heightAt(i, px, pz, Math.max(cd, 6), area);
          const far = 1 + cd / 90;
          placed++;
          if (p.buildings && c === 0 && rand() < 0.55) {
            this.cityBlock(doc, px, y, pz, Math.atan2(ox, oz), rand, far);
            break;
          }
          if (!this.models || !p.props.length) continue;
          // Clusters mix in a neighbour or two from the same set.
          const m = c === 0 || rand() < 0.6 ? model : pick(p.props);
          const e: PropEntity = { id: `belt_${i}_${d0}_${c}`, kind: 'prop', model: `prop.${m}`, position: [px, y - 0.1, pz], yaw: rand() * Math.PI * 2, scale: (1 + rand() * 0.7) * far * (/^(rock|rocks|cliff)/.test(m) ? 1.5 : 1.2), solid: false, tint: null };
          this.nodes.push(createPropNode(this.scene, this.models, e, `backdrop_belt_${this.nodes.length}`, true, true, null));
        }
      }
    });
  }

  /** A low city block past the border: a box in façade materials, its long side to the map. */
  private cityBlock(doc: MapDocument, x: number, y: number, z: number, yaw: number, rand: () => number, far: number): void {
    const w = (8 + rand() * 10) * Math.min(1.6, far);
    const dpt = 8 + rand() * 8;
    const h = (6 + rand() * 16) * Math.min(1.8, far);
    const tile = 4;
    const uv = (a: number, b: number) => new Vector4(0, 0, a / tile, b / tile);
    const box = CreateBox(`backdrop_block_${this.meshes.length}`, { width: w, height: h, depth: dpt, faceUV: [uv(w, h), uv(w, h), uv(dpt, h), uv(dpt, h), uv(w, dpt), uv(w, dpt)], wrap: true }, this.scene);
    box.position.set(x, y + h / 2 - 0.3, z);
    box.rotation.y = yaw;
    box.material = this.styler.surfaceMaterial(doc, pick3(rand, ['pbr_glass_facade', 'pbr_brick_red', 'pbr_concrete', 'pbr_plaster', 'pbr_siding', 'pbr_brick_old']), null);
    box.isPickable = false;
    box.freezeWorldMatrix();
    this.meshes.push(box);
  }

  private buildScenery(kind: SceneryId, area: PlayArea, sky: SkyDefinition, rand: () => number): void {
    if (kind === 'none') return;
    const r0 = Math.max(220, area.radius + 140);
    const base = area.floor - 2;
    const night = sky.id === 'night' || sky.id === 'dusk' || sky.id === 'space';
    switch (kind) {
      case 'hills':
        this.ridge(area, r0 + 60, 420, base, rand, { height: [18, 55], roughness: 0.25, low: '#55703f', high: '#7a8f52' });
        break;
      case 'dunes':
        this.ridge(area, r0 + 40, 380, base, rand, { height: [10, 38], roughness: 0.15, low: '#c79b62', high: '#e0b97c' });
        break;
      case 'mountains':
        this.ridge(area, r0 + 160, 700, base, rand, { height: [90, 260], roughness: 0.9, low: '#5d6066', high: '#8a8d92', snow: 200 });
        this.ridge(area, r0 + 40, 260, base, rand, { height: [20, 60], roughness: 0.35, low: '#4d5f3c', high: '#68784c' });
        break;
      case 'peaks':
        this.ridge(area, r0 + 180, 750, base, rand, { height: [140, 340], roughness: 1, low: '#6c7682', high: '#9aa4b0', snow: 120 });
        this.ridge(area, r0 + 50, 280, base, rand, { height: [25, 70], roughness: 0.5, low: '#a7b2bd', high: '#e8eef4' });
        break;
      case 'mesas':
        this.ridge(area, r0 + 120, 560, base, rand, { height: [40, 140], roughness: 0.4, low: '#9a5a3a', high: '#c27a4e', mesa: true });
        break;
      case 'forest':
        this.ridge(area, r0 + 160, 520, base, rand, { height: [30, 90], roughness: 0.4, low: '#3d5232', high: '#4d6640' });
        this.trees(area, area.radius + 40, r0 + 180, base, rand);
        break;
      case 'city':
        this.city(area, r0, r0 + 520, base, rand, night);
        break;
      case 'ocean':
        this.ridge(area, r0 + 420, 380, base - 1, rand, { height: [0, 45], roughness: 0.3, low: '#4f6648', high: '#6a7d5a', islands: true });
        break;
    }
  }

  /** A ring of land round the map: a crest line from layered noise, coloured from its foot up. */
  private ridge(
    area: PlayArea,
    radius: number,
    depth: number,
    base: number,
    rand: () => number,
    o: { height: [number, number]; roughness: number; low: string; high: string; snow?: number; mesa?: boolean; islands?: boolean },
  ): void {
    const N = 360;
    const waves = Array.from({ length: 7 }, (_, i) => ({ f: [2, 3, 5, 8, 13, 21, 34][i]!, p: rand() * Math.PI * 2, a: i < 3 ? 1 / (i + 1) : (o.roughness * 0.6) / (i - 1) }));
    const total = waves.reduce((s, w) => s + w.a, 0);
    const crest = (a: number) => {
      let v = 0;
      for (const w of waves) v += Math.sin(a * w.f + w.p) * w.a;
      let u = (v / total) * 0.5 + 0.5; // 0..1
      if (o.mesa) u = u < 0.45 ? u * 0.3 : 0.55 + Math.round(u * 3) / 3 * 0.45; // flat tops, steep sides
      if (o.islands) u = Math.max(0, (u - 0.55) / 0.45);
      return o.height[0] + (o.height[1] - o.height[0]) * u;
    };
    // Profile across the ring: foot, shoulder, crest, back slope, far foot.
    const profile: [number, number][] = o.mesa
      ? [[0, 0], [0.16, 0.92], [0.22, 1], [0.7, 1], [0.78, 0.9], [1, 0.2]]
      : [[0, 0], [0.18, 0.35], [0.38, 0.8], [0.5, 1], [0.72, 0.7], [1, 0.25]];
    const low = Color3.FromHexString(o.low);
    const high = Color3.FromHexString(o.high);
    const snow = new Color3(0.93, 0.95, 0.98);
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const h = crest(a);
      const jitter = Math.sin(a * 47 + 1.3) * 0.04;
      for (const [d, k] of profile) {
        const r = radius + depth * (d + jitter * d);
        const y = base + h * k;
        positions.push(area.centre[0] + Math.sin(a) * r, y, area.centre[1] + Math.cos(a) * r);
        const c = o.snow !== undefined && h * k > o.snow ? snow : Color3.Lerp(low, high, k);
        colors.push(c.r, c.g, c.b, 1);
      }
    }
    const n = profile.length;
    for (let i = 0; i < N; i++) for (let r = 0; r < n - 1; r++) {
      const a = i * n + r;
      const b = (i + 1) * n + r;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    this.addMesh('backdrop_ridge', positions, indices, colors);
  }

  /** Dark pines on rolling ground round the map: one cone mesh, thousands of instances. */
  private trees(area: PlayArea, inner: number, outer: number, base: number, rand: () => number): void {
    const cone: number[] = [];
    const colors: number[] = [];
    const idx: number[] = [];
    const seg = 6;
    const ring = (y: number, r: number, c: string) => {
      const col = Color3.FromHexString(c);
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        cone.push(Math.sin(a) * r, y, Math.cos(a) * r);
        colors.push(col.r, col.g, col.b, 1);
      }
    };
    ring(0, 0.25, '#4a3524');
    ring(1.2, 0.25, '#4a3524');
    ring(1.2, 1.6, '#2f4a2c');
    ring(4.5, 0.9, '#36532f');
    ring(4.5, 1.2, '#36532f');
    ring(8, 0.05, '#45663a');
    for (const [a, b] of [[0, 1], [2, 3], [4, 5]] as const) for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      idx.push(a * seg + i, b * seg + i, a * seg + j, a * seg + j, b * seg + i, b * seg + j);
    }
    const mesh = this.addMesh('backdrop_trees', cone, idx, colors);
    const count = 2600;
    const matrices = new Float32Array(count * 16);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = inner + Math.sqrt(rand()) * (outer - inner);
      const s = 1.2 + rand() * 1.6 + (r - inner) / 160;
      Matrix.Compose(new Vector3(s, s * (0.8 + rand() * 0.5), s), Quaternion.Identity(), new Vector3(area.centre[0] + Math.sin(a) * r, base + 1.5, area.centre[1] + Math.cos(a) * r)).copyToArray(matrices, i * 16);
    }
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
    mesh.alwaysSelectAsActiveMesh = true;
  }

  /** A skyline of towers round the map, windows lit at night. */
  private city(area: PlayArea, inner: number, outer: number, base: number, rand: () => number, night: boolean): void {
    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const tints = ['#7d8794', '#8f8a82', '#6a7480', '#9aa3ad', '#5e6670', '#a39a8e'].map((c) => Color3.FromHexString(c));
    for (let i = 0; i < 520; i++) {
      const a = rand() * Math.PI * 2;
      const r = inner + rand() * (outer - inner);
      const w = 14 + rand() * 26;
      const d = 14 + rand() * 26;
      // Taller towers cluster in a few downtown directions.
      const downtown = Math.max(0, Math.cos(a * 3 + 1)) ** 3;
      const h = 12 + rand() * 40 + downtown * rand() * 140 + (r - inner) * 0.05;
      const cx = area.centre[0] + Math.sin(a) * r;
      const cz = area.centre[1] + Math.cos(a) * r;
      const yaw = a + (rand() - 0.5) * 0.3;
      const tint = tints[i % tints.length]!;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const corner = (x: number, z: number): [number, number] => [cx + x * c + z * s, cz - x * s + z * c];
      const pts = [corner(-w / 2, -d / 2), corner(w / 2, -d / 2), corner(w / 2, d / 2), corner(-w / 2, d / 2)];
      for (let f = 0; f < 4; f++) {
        const [x0, z0] = pts[f]!;
        const [x1, z1] = pts[(f + 1) % 4]!;
        const len = f % 2 === 0 ? w : d;
        const k = positions.length / 3;
        positions.push(x0, base, z0, x1, base, z1, x1, base + h, z1, x0, base + h, z0);
        // One texture repeat per 32 × 32 m of wall (8 storeys of 4 m windows).
        const u0 = rand();
        uvs.push(u0, 0, u0 + len / 32, 0, u0 + len / 32, h / 32, u0, h / 32);
        for (let v = 0; v < 4; v++) colors.push(tint.r, tint.g, tint.b, 1);
        indices.push(k, k + 2, k + 1, k, k + 3, k + 2);
      }
      const k = positions.length / 3;
      for (const [x, z] of pts) positions.push(x, base + h, z);
      uvs.push(0, 0, 0, 0, 0, 0, 0, 0);
      for (let v = 0; v < 4; v++) colors.push(tint.r * 0.8, tint.g * 0.8, tint.b * 0.8, 1);
      indices.push(k, k + 2, k + 1, k, k + 3, k + 2);
    }
    const mesh = this.addMesh('backdrop_city', positions, indices, colors, uvs);
    const mat = mesh.material as StandardMaterial;
    const tex = windows(this.scene, night);
    mat.diffuseTexture = tex;
    if (night) {
      mat.emissiveTexture = tex;
      mat.emissiveColor = new Color3(1, 0.85, 0.6);
    }
    this.materials.push(tex);
  }

  private addMesh(name: string, positions: number[], indices: number[], colors: number[], uvs?: number[]): Mesh {
    const mesh = new Mesh(name, this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.colors = colors;
    if (uvs) vd.uvs = uvs;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    vd.normals = normals;
    vd.applyToMesh(mesh);
    const mat = new StandardMaterial(`${name}_mat`, this.scene);
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    mat.emissiveColor = new Color3(0.12, 0.12, 0.12);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    this.meshes.push(mesh);
    this.materials.push(mat);
    return mesh;
  }
}

interface PlayArea {
  min: [number, number];
  max: [number, number];
  centre: [number, number];
  /** Distance from the centre to the farthest corner. */
  radius: number;
  /** Lowest floor (or terrain) height. */
  floor: number;
}

/** The map's footprint: its terrain, everything built, and its boundary. */
function playArea(doc: MapDocument, boxes: readonly WorldBox[]): PlayArea {
  const min: [number, number] = [Infinity, Infinity];
  const max: [number, number] = [-Infinity, -Infinity];
  let floor = Infinity;
  const grow = (x: number, z: number) => {
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], z);
  };
  for (const b of boxes) {
    if (b.kind === 'barrier') continue;
    const bb = boxBounds(b);
    grow(bb.min[0], bb.min[2]);
    grow(bb.max[0], bb.max[2]);
    floor = Math.min(floor, bb.max[1] < 0.5 ? bb.max[1] : bb.min[1]);
  }
  const t = doc.terrain;
  if (t) {
    grow(t.origin[0], t.origin[1]);
    grow(t.origin[0] + (t.cols - 1) * t.spacing, t.origin[1] + (t.rows - 1) * t.spacing);
    let low = Infinity;
    for (const h of t.heights) low = Math.min(low, h);
    floor = Math.min(floor, t.baseY + low / 100);
  }
  if (doc.bounds) {
    grow(doc.bounds.min[0], doc.bounds.min[1]);
    grow(doc.bounds.max[0], doc.bounds.max[1]);
  }
  if (!Number.isFinite(min[0])) {
    min[0] = min[1] = -16;
    max[0] = max[1] = 16;
  }
  if (!Number.isFinite(floor)) floor = 0;
  // A little apron round built maps so the ground doesn't start right at a wall.
  if (!t) {
    min[0] -= 2;
    min[1] -= 2;
    max[0] += 2;
    max[1] += 2;
  }
  const centre: [number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  return { min, max, centre, radius: Math.hypot(max[0] - centre[0], max[1] - centre[1]), floor: Math.round(floor * 100) / 100 };
}

/** Points round a rectangle's edge, about `step` metres apart, going round once. */
function perimeter(min: [number, number], max: [number, number], step: number): [number, number][] {
  const out: [number, number][] = [];
  const corners: [number, number][] = [min, [max[0], min[1]], max, [min[0], max[1]]];
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** Ground height where the map ends: the terrain's edge there, or the lowest floor. */
function edgeHeight(doc: MapDocument, x: number, z: number, floor: number): number {
  const t = doc.terrain;
  if (!t) return floor - 0.05;
  const c = Math.max(0, Math.min(t.cols - 1, Math.round((x - t.origin[0]) / t.spacing)));
  const r = Math.max(0, Math.min(t.rows - 1, Math.round((z - t.origin[1]) / t.spacing)));
  return vertexY(t, c, r);
}

function skyFor(backdrop: Backdrop, doc: MapDocument): SkyDefinition {
  const sky = SKIES.get(backdrop.sky) ?? SKIES.get('plain')!;
  if (sky.id !== 'plain') return sky;
  // The theme's flat colour.
  const theme = doc.classicStructure.theme;
  const colour = THEME_SKY.get(theme) ?? sky.horizon;
  return { ...sky, horizon: colour, zenith: colour };
}

const THEME_SKY = new Map(CORE_THEMES.map((t) => [t.id, t.sky]));

/** A deterministic random stream from a string (the same scenery every time a map loads). */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Stars and a faint band of galaxy, drawn into an equirectangular texture. */
function starfield(scene: Scene): RawTexture {
  const w = 2048;
  const h = 1024;
  const px = new Uint8Array(w * h * 4);
  const rand = seeded('stars');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // A soft diagonal band of the galaxy.
      const band = Math.exp(-(((y / h - 0.5 - Math.sin((x / w) * Math.PI * 2) * 0.18) * 7) ** 2));
      px[i] = 4 + band * 22;
      px[i + 1] = 5 + band * 18;
      px[i + 2] = 12 + band * 34;
      px[i + 3] = 255;
    }
  }
  for (let s = 0; s < 9000; s++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const b = rand() ** 3 * 255;
    const warm = rand();
    const i = (y * w + x) * 4;
    px[i] = Math.min(255, px[i]! + b * (0.8 + warm * 0.2));
    px[i + 1] = Math.min(255, px[i + 1]! + b * 0.85);
    px[i + 2] = Math.min(255, px[i + 2]! + b * (1 - warm * 0.2));
  }
  return RawTexture.CreateRGBATexture(px, w, h, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
}

/** A block of facade, 8 windows across and 8 storeys up; at night some windows are lit. */
export function windows(scene: Scene, night: boolean): RawTexture {
  const n = 256;
  const cell = 32;
  const px = new Uint8Array(n * n * 4);
  const rand = seeded('windows');
  const lit = Array.from({ length: 64 }, () => rand() > 0.6);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const wx = x % cell;
      const wy = y % cell;
      const inWindow = wy > 8 && wy < 25 && wx > 4 && wx < 28;
      const on = lit[Math.floor(y / cell) * 8 + Math.floor(x / cell)];
      const v = inWindow ? (night ? (on ? 255 : 22) : 110) : night ? 8 : 205;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  const tex = RawTexture.CreateRGBATexture(px, n, n, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function pick3<T>(rand: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length)]!;
}

/** The belt past the border: berm and hill heights (m), what stands on it, and how thickly. */
interface BeltProfile {
  berm: number;
  hills: number;
  props: readonly string[];
  buildings: boolean;
  density: number;
}

const NATURE = ['oak', 'oak_dark', 'tree_round', 'tree_detailed', 'tree_fat', 'pine_tall', 'oak', 'tree_round', 'bush_large', 'bush', 'rock_large', 'log_big'] as const;
const BELTS: Record<string, BeltProfile> = {
  none: { berm: 2, hills: 4, props: ['rock_large', 'rock_medium', 'bush_large', 'tree_round'], buildings: false, density: 0.6 },
  hills: { berm: 3.5, hills: 9, props: NATURE, buildings: false, density: 0.8 },
  forest: { berm: 4, hills: 11, props: ['pine_tall', 'pine_tall_b', 'pine_round', 'pine_tall', 'oak_dark', 'tree_detailed', 'tree_cone', 'pine_tall_b', 'oak', 'bush_large', 'rock_large', 'log_big'], buildings: false, density: 1.3 },
  mountains: { berm: 6, hills: 16, props: ['pine_tall', 'pine_round', 'pine_small', 'rock_large', 'rocks_tall', 'rock_spire_tall', 'cliff', 'rock_flat'], buildings: false, density: 0.85 },
  peaks: { berm: 7, hills: 18, props: ['pine_tall_b', 'pine_small', 'rock_large', 'rocks_tall', 'cliff', 'cliff_corner'], buildings: false, density: 0.7 },
  mesas: { berm: 5, hills: 10, props: ['rock_large', 'rocks_tall', 'rock_spire_tall', 'rock_flat', 'cactus_tall', 'cactus', 'debris'], buildings: false, density: 0.6 },
  dunes: { berm: 6, hills: 9, props: ['rock_flat', 'rock_large', 'cactus', 'palm_bent', 'debris'], buildings: false, density: 0.35 },
  city: { berm: 0.6, hills: 0, props: ['barrier', 'barrier_high', 'container', 'lightpost', 'trashcan', 'skip'], buildings: true, density: 0.9 },
  ocean: { berm: 0.5, hills: 0, props: ['palm_tall', 'palm_short', 'rock_large', 'rock_flat'], buildings: false, density: 0.4 },
};
/** Themes whose surroundings are their own, whatever the scenery past them. */
const THEME_BELTS: Record<string, Partial<BeltProfile>> = {
  'core.factory': { props: ['container', 'container_wide', 'container_tall', 'barrier_high', 'tank_car', 'factory_box_long', 'skip', 'cone'], buildings: true },
  'core.castle': { props: ['pine_tall', 'oak', 'pine_tall_b', 'tree_round', 'rock_large', 'stone_wall_damaged', 'bush_large', 'oak_dark'] },
  'core.ruins': { props: ['stone_wall_damaged', 'pillar', 'rocks_tall', 'oak_dark', 'tree_detailed', 'hanging_moss', 'bush_large'] },
  'core.manor': { props: ['iron_fence', 'iron_fence_damaged', 'pine_crooked', 'gravestone_round', 'oak_dark', 'hedge_large'] },
  'core.saloon': { props: ['cactus_tall', 'cactus', 'rock_large', 'cart', 'town_fence', 'rocks_tall'] },
  'core.arctic': { props: ['pine_tall_b', 'pine_small', 'rock_large', 'rocks_tall'] },
};

function beltProfile(backdrop: Backdrop, theme: string): BeltProfile {
  const base = BELTS[backdrop.scenery] ?? BELTS.none!;
  return { ...base, ...(THEME_BELTS[theme] ?? {}) };
}
