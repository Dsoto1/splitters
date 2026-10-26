import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Observer } from '@babylonjs/core/Misc/observable';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import {
  ELECTRIC_FENCE,
  borderEdges,
  borderFloor,
  borderGround,
  borderNoise,
  borderSeed,
  borderStyles,
  getProp,
  resolveBackdrop,
  type BorderEdge,
  type BorderSide,
  type BorderStyle,
  type MapDocument,
  type WorldBox,
} from '@tiletrigger/shared';
import type { ModelLibrary } from './content/models.ts';
import type { MapStyler } from './mapMeshes.ts';
import { windows } from './backdrop.ts';
import { loadGraphicsQuality } from './game/atmosphere.ts';

type V3 = [number, number, number];

/**
 * Borders that blend in: what stands just outside the boundary (see
 * shared/map/border.ts). Every style is a handful of draw calls however long
 * the boundary is: cliffs are one merged mesh, city blocks one merged mesh
 * plus GPU-instanced city-kit facades on the front row, the forest instanced
 * trees close in and instanced low-poly cones further out (its far rows), the
 * fence instanced posts and signs with one mesh of glowing wire, the shore one
 * beach and one sea mesh. Rebuilt whole when the map's border or boundary
 * changes; the collision lives in shared (borderBoxes).
 */
export class BorderVisuals {
  private meshes: Mesh[] = [];
  private materials: StandardMaterial[] = [];
  private textures: BaseTexture[] = [];
  private nodes: TransformNode[] = [];
  private key = '';
  private build = 0;
  private pulse: Observer<Scene> | null = null;
  /** Settles once the instanced models (trees, facades) of the latest build are in. */
  ready: Promise<void> = Promise.resolve();
  /** What the last build made: meshes (draw calls before materials split them) and instances. */
  stats = { meshes: 0, instances: 0, vertices: 0 };

  constructor(
    private readonly scene: Scene,
    private readonly styler: MapStyler,
    private readonly models?: ModelLibrary,
  ) {}

  /** (Re)build for this map; cheap to call again when nothing changed. */
  update(doc: MapDocument, boxes: readonly WorldBox[]): void {
    const edges = borderEdges(doc);
    const floorY = edges.length ? borderFloor(doc, boxes) : 0;
    const backdrop = resolveBackdrop(doc);
    const key = JSON.stringify([edges, floorY, backdrop.sky, backdrop.ground, doc.classicStructure.theme, doc.metadata.id, doc.terrain ? doc.terrain.heights.length + doc.terrain.heights[0]! : 0]);
    if (key === this.key) return;
    this.dispose();
    this.key = key;
    if (!edges.length) return;
    const build = ++this.build;
    const styles = borderStyles(doc);
    const ctx: Ctx = {
      doc,
      floorY,
      seed: borderSeed(doc.metadata.id),
      ground: (x, z) => borderGround(doc, x, z, floorY),
      night: ['night', 'dusk', 'space'].includes(backdrop.sky),
      snowy: backdrop.ground === 'snow' || backdrop.sky === 'snowy' || doc.classicStructure.theme === 'core.arctic',
      sandy: backdrop.ground === 'sand',
      redRock: backdrop.ground === 'sand' || ['core.desert', 'core.saloon', 'core.tomb', 'core.canyon'].includes(doc.classicStructure.theme),
      neighbours: (e) => {
        const i = SIDE_RING.indexOf(e.side);
        return [styles[SIDE_RING[(i + 3) % 4]!], styles[SIDE_RING[(i + 1) % 4]!]];
      },
    };
    const of = (s: BorderStyle) => edges.filter((e) => e.style === s);
    const waits: Promise<unknown>[] = [];
    if (of('cliffs').length) this.cliffs(of('cliffs'), ctx);
    if (of('skyline').length) waits.push(this.skyline(of('skyline'), ctx, build));
    if (of('forest').length) waits.push(this.forest(of('forest'), ctx, build));
    if (of('fence').length) this.fence(of('fence'), ctx);
    if (of('water').length) this.water(of('water'), ctx);
    this.ready = Promise.all(waits).then(() => this.count());
    this.count();
  }

  dispose(): void {
    this.build++;
    if (this.pulse) this.scene.onBeforeRenderObservable.remove(this.pulse);
    this.pulse = null;
    for (const m of this.meshes) m.dispose();
    for (const n of this.nodes) n.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.textures = [];
    this.meshes = [];
    this.nodes = [];
    this.materials = [];
    this.key = '';
    this.stats = { meshes: 0, instances: 0, vertices: 0 };
  }

  /** Show or hide the whole border (the fps comparison in the bench hides it). */
  setEnabled(on: boolean): void {
    for (const m of this.meshes) m.setEnabled(on);
  }

  private count(): void {
    this.stats = {
      meshes: this.meshes.filter((m) => !m.isDisposed()).length,
      instances: this.meshes.reduce((n, m) => n + (m.thinInstanceCount || 1), 0),
      vertices: this.meshes.reduce((n, m) => n + m.getTotalVertices() * Math.max(1, m.thinInstanceCount || 1), 0),
    };
  }

  private material(name: string, o: { color?: string; texture?: BaseTexture | null; emissive?: string; spec?: number; unlit?: boolean } = {}): StandardMaterial {
    const m = new StandardMaterial(`border_${name}`, this.scene);
    m.diffuseColor = Color3.FromHexString(o.color ?? '#ffffff');
    m.specularColor = new Color3(o.spec ?? 0.04, o.spec ?? 0.04, o.spec ?? 0.04);
    if (o.texture) m.diffuseTexture = o.texture;
    if (o.emissive) m.emissiveColor = Color3.FromHexString(o.emissive);
    if (o.unlit) m.disableLighting = true;
    // Two-sided: generated surfaces are seen from the play area and from above.
    m.backFaceCulling = false;
    m.twoSidedLighting = true;
    this.materials.push(m);
    return m;
  }

  private add(mesh: Mesh): Mesh {
    for (const m of splitThin(mesh)) {
      m.isPickable = false;
      m.freezeWorldMatrix();
      this.meshes.push(m);
    }
    return mesh;
  }

  // ---------------------------------------------------------------- cliffs

  /**
   * Towering rock walls following the boundary: a ragged face that leaps up a
   * few metres out, a crest 22–80 m high with spires, and a back slope; rock
   * strata in the colours of the land (red sandstone in the desert, grey
   * granite with snow on top in the cold), all one mesh.
   */
  private cliffs(edges: BorderEdge[], ctx: Ctx): void {
    // Travertine: banded stone that reads as strata on a cliff face.
    const rock = this.styler.surfaceMaterial(ctx.doc, 'core.pbr_travertine', null);
    const scale = 3;
    // Over the travertine's own tan: red in desert country, cold grey under snow, warm grey elsewhere.
    const [dark, light] = ctx.redRock ? ['#b0623c', '#e8a878'] : ctx.snowy ? ['#7a889c', '#cad4e0'] : ['#858890', '#c4c6cc'];
    const lo = Color3.FromHexString(dark);
    const hi = Color3.FromHexString(light);
    const snow = new Color3(0.94, 0.96, 1);
    const moss = Color3.FromHexString(ctx.redRock ? '#b08a52' : '#5f7a44');
    // Smooth value noise along the wall (0..1), `size` metres per feature.
    const vnoise = (s: number, size: number, salt: number) => {
      const t = s / size;
      const i0 = Math.floor(t);
      const f = t - i0;
      const w = f * f * (3 - 2 * f);
      return borderNoise(ctx.seed, i0 * 7 + salt) * (1 - w) + borderNoise(ctx.seed, (i0 + 1) * 7 + salt) * w;
    };
    // Across the wall: [metres out, share of the crest height]. The face leaps up within a few metres.
    const rows: [number, number][] = [[0.25, -0.02], [0.5, 0.12], [1.4, 0.36], [3, 0.6], [5, 0.78], [8, 0.92], [12, 1], [20, 0.95], [34, 0.8], [55, 0.62], [90, 0.42]];
    const all = new Geo();
    let around = 0;
    for (const e of edges) {
      const [prev, next] = ctx.neighbours(e);
      const u0 = prev === 'cliffs' ? -95 : -26;
      const u1 = e.length + (next === 'cliffs' ? 95 : 26);
      const n = Math.max(2, Math.ceil((u1 - u0) / 2.5));
      const g = new Geo();
      const f = frame(e);
      const ph = [0, 1, 2, 3].map((k) => borderNoise(ctx.seed, 900 + k + around) * Math.PI * 2);
      for (let i = 0; i <= n; i++) {
        const u = u0 + ((u1 - u0) * i) / n;
        const s = around + u;
        // Free ends (no cliff round the corner) taper down into a buttress.
        const taper = Math.min(1, prev === 'cliffs' ? 1 : (u - u0) / 26 + 0.2, next === 'cliffs' ? 1 : (u1 - u) / 26 + 0.2);
        const wave = 0.6 * vnoise(s, 70, 1) + 0.25 * vnoise(s, 23, 2) + 0.15 * vnoise(s, 7, 3);
        const spire = 26 * Math.max(0, Math.sin(s * 0.034 + ph[0]!)) ** 12 + 10 * vnoise(s, 4, 4) ** 3;
        const crest = (22 + 52 * wave + spire) * taper;
        const [lx, lz] = f.at(Math.min(e.length, Math.max(0, u)), 0);
        const ground = ctx.ground(lx, lz);
        // Buttresses and gullies: the face stands out and steps back along the wall.
        const buttress = 3.2 * vnoise(s, 9, 5) + 1.2 * vnoise(s, 3, 6);
        rows.forEach(([d, k], r) => {
          const j = borderNoise(ctx.seed, i * 31 + r + Math.round(around));
          const dd = r === 0 ? d : d + buttress * Math.min(1, d / 2) + (j - 0.5) * 0.8 * Math.min(1, d / 2);
          let y = r === 0 ? ground - 0.8 : ground + crest * k + (r >= 2 ? (j - 0.5) * 2.2 : 0);
          // Ledges: the face steps in strata.
          if (r >= 2 && r <= 6) y = y * 0.6 + (Math.round((y - ground) / 5.5) * 5.5 + ground) * 0.4;
          const [x, z] = f.at(u, dd);
          const band = 0.5 + 0.5 * Math.sin((y - ground) * 0.9 + vnoise(s, 30, 7) * 3);
          let c = Color3.Lerp(lo, hi, Math.min(1, 0.2 + 0.5 * band + 0.3 * Math.max(0, k) * j));
          if (r >= 5 && ctx.snowy && y - ground > 28) c = Color3.Lerp(c, snow, 0.85);
          else if (r >= 6 && j > 0.4) c = Color3.Lerp(c, moss, 0.5);
          // Rock texture at three times the ground's scale: boulders, not gravel.
          g.vert(x, y, z, c, s / (scale * 3), (y - ground + dd * 0.6) / (scale * 3));
        });
      }
      g.grid(n + 1, rows.length);
      g.orient(new Vector3(-e.out[0], 0.6, -e.out[1]));
      all.append(g);
      around += e.length + 40;
    }
    const mat = this.material('rock', { texture: rock.diffuseTexture, spec: 0.05, emissive: '#3c3834' });
    this.add(all.mesh('border_cliffs', this.scene, mat));
  }

  // ---------------------------------------------------------------- skyline

  /**
   * City blocks lining the boundary in three rows, taller further out: the
   * front row in the city kit's facades (brick, shopfront, plaster), every
   * block's other faces in a window texture that lights up at night.
   */
  private async skyline(edges: BorderEdge[], ctx: Ctx, build: number): Promise<void> {
    const g = new Geo();
    const pieces: Piece[] = [];
    const tints = ['#8b8f96', '#9a8f84', '#7a838e', '#a7a29a', '#6e7680', '#b0a594', '#8d7a6c'].map((c) => Color3.FromHexString(c));
    let r = 0;
    const rand = () => borderNoise(ctx.seed, 5000 + r++);
    // Rows: [front, depth range, height range, width range]
    const ROWS: [number, [number, number], [number, number], [number, number]][] = [
      [1.2, [12, 18], [12, 30], [10, 22]],
      [24, [14, 22], [26, 62], [14, 26]],
      [52, [18, 30], [44, 120], [16, 32]],
    ];
    for (const e of edges) {
      const [prev, next] = ctx.neighbours(e);
      const f = frame(e);
      ROWS.forEach(([front, depth, height, width], row) => {
        const reach = front + depth[1];
        const u0 = prev === 'skyline' ? -reach : -6 - row * 8;
        const u1 = e.length + (next === 'skyline' ? reach : 6 + row * 8);
        let u = u0 + rand() * 3;
        while (u < u1 - 4) {
          let w = width[0] + rand() * (width[1] - width[0]);
          w = Math.min(w, u1 - u);
          const d = depth[0] + rand() * (depth[1] - depth[0]);
          const v0 = front + (row ? rand() * 6 : 0);
          const [gx, gz] = f.at(Math.min(e.length, Math.max(0, u + w / 2)), 0);
          const base = ctx.ground(gx, gz) - (row ? 1.5 : 0.25);
          const storeys = Math.max(3, Math.round((height[0] + rand() * (height[1] - height[0])) / 4));
          const h = storeys * 4;
          const tint = tints[Math.floor(rand() * tints.length)]!;
          g.block(f, u, u + w, v0, v0 + d, base, base + h, tint, rand() * 4, row === 0 && this.models ? FACADE_STOREYS * 4 : 0);
          // A water tank or plant room on some roofs breaks up the line.
          if (rand() < 0.35) g.block(f, u + w * 0.3, u + w * 0.3 + 3 + rand() * 3, v0 + 3, v0 + 7, base + h, base + h + 2.5 + rand() * 2, tint.scale(0.7), 0);
          if (row === 0) {
            const set = FACADE_KIT[Math.floor(rand() * FACADE_KIT.length)]!;
            const bays = Math.max(1, Math.round(w / BAY));
            const bw = w / bays;
            for (let b = 0; b < bays; b++) {
              const [px, pz] = f.at(u + (b + 0.5) * bw, v0 - FACADE_OUT);
              // The kit's pieces on the storeys you see up close; the window texture above (its LOD, at a fraction of the triangles).
              for (let s = 0; s < FACADE_STOREYS; s++) {
                const kinds = s === 0 ? set.ground : set.upper;
                pieces.push({ piece: b % 2 === 0 ? kinds[0]! : kinds[kinds.length - 1]!, at: [px, base + s * 4, pz], yaw: f.facing, sx: bw / BAY, sy: 1 });
              }
              pieces.push({ piece: set.cornice, at: [px, base + FACADE_STOREYS * 4, pz], yaw: f.facing, sx: bw / BAY, sy: 1 });
            }
          }
          u += w + (row ? rand() * 2 : rand() * 1.2);
        }
      });
    }
    const tex = windows(this.scene, ctx.night);
    this.textures.push(tex);
    const mat = this.material('blocks', { texture: tex, spec: 0.1 });
    if (ctx.night) {
      mat.emissiveTexture = mat.diffuseTexture;
      mat.emissiveColor = new Color3(1, 0.85, 0.6);
    } else mat.emissiveColor = new Color3(0.08, 0.08, 0.08);
    this.add(g.mesh('border_skyline', this.scene, mat, false));
    if (!this.models || !pieces.length) return;
    const meshes = await thinFacades(this.models, pieces, 'border_facade').catch(() => [] as Mesh[]);
    if (build !== this.build) return meshes.forEach((m) => m.dispose());
    for (const m of meshes) this.add(m);
  }

  // ---------------------------------------------------------------- forest

  /**
   * A dense wall of trees: undergrowth along the line, three or four rows of
   * the nature kit's trees (instanced, one draw call per model part), then
   * low-poly cones thinning out behind (the far rows) in front of a dark
   * canopy band, so you never see daylight through it.
   */
  private async forest(edges: BorderEdge[], ctx: Ctx, build: number): Promise<void> {
    let r = 0;
    const rand = () => borderNoise(ctx.seed, 9000 + r++);
    const kit = ctx.snowy ? FOREST_KITS.snow : ctx.sandy ? FOREST_KITS.sand : FOREST_KITS.green;
    const near = new Map<string, Matrix[]>();
    const far: Matrix[] = [];
    const canopy = new Geo();
    const dark = Color3.FromHexString(ctx.snowy ? '#3a4a44' : ctx.sandy ? '#4f5a2e' : '#24361f');
    const darker = dark.scale(0.7);
    const put = (model: string, x: number, y: number, z: number, s: number) => {
      const list = near.get(model) ?? near.set(model, []).get(model)!;
      list.push(Matrix.Compose(new Vector3(s, s * (0.9 + rand() * 0.25), s), Quaternion.RotationAxis(Vector3.Up(), rand() * Math.PI * 2), new Vector3(x, y, z)));
    };
    const models = !!this.models;
    for (const e of edges) {
      const [prev, next] = ctx.neighbours(e);
      const f = frame(e);
      const u0 = prev === 'forest' ? -40 : -10;
      const u1 = e.length + (next === 'forest' ? 40 : 10);
      // Undergrowth right along the line.
      for (let u = u0; u < u1; u += 2.8 + rand() * 1.6) {
        const v = 0.7 + rand() * 1.8;
        const [x, z] = f.at(u, v);
        if (models) put(kit.bushes[Math.floor(rand() * kit.bushes.length)]!, x, ctx.ground(x, z) - 0.05, z, 0.9 + rand() * 0.7);
      }
      // The front row: the kit's trees (the only full models, ~2 k triangles each), every few metres, low-poly conifers between.
      for (let u = u0 + rand() * 3; u < u1; u += 2.6 + rand() * 1.4) {
        const v = 2.6 + rand() * 2.2;
        const [x, z] = f.at(u, v);
        const y = ctx.ground(x, z) - 0.15;
        const s = 1.1 + rand() * 0.6;
        if (models && rand() < 0.55) put(kit.trees[Math.floor(rand() * kit.trees.length)]!, x, y, z, s);
        else far.push(Matrix.Compose(new Vector3(s, s * (0.9 + rand() * 0.4), s), Quaternion.Identity(), new Vector3(x, y, z)));
      }
      // Behind it, the far rows (its LOD): low-poly conifers at ~70 triangles, packed close, then bigger and sparser.
      for (let v = 6.5; v < 72; v += v < 15 ? 3 : 5 + v * 0.06) {
        for (let u = u0 - v * 0.5; u < u1 + v * 0.5; u += 3 + v * 0.04 + rand() * 2) {
          const [x, z] = f.at(u, v + rand() * 2.5);
          const s = 1.3 + rand() * 0.9 + v / 70;
          far.push(Matrix.Compose(new Vector3(s, s * (0.85 + rand() * 0.5), s), Quaternion.Identity(), new Vector3(x, ctx.ground(x, z) - 0.3, z)));
        }
      }
      // Canopy band behind the near rows.
      const n = Math.max(2, Math.ceil((u1 - u0 + 80) / 6));
      const bandRows: [number, number][] = [[13, 0], [16, 9], [24, 13], [48, 15], [90, 12]];
      const g = new Geo();
      for (let i = 0; i <= n; i++) {
        const u = u0 - 40 + ((u1 - u0 + 80) * i) / n;
        const ground = ctx.ground(...f.at(Math.min(e.length, Math.max(0, u)), 0));
        bandRows.forEach(([v, k], b) => {
          const [x, z] = f.at(u, v);
          g.vert(x, ground + k * (0.75 + 0.5 * borderNoise(ctx.seed, i * 7 + b)), z, b === 0 ? darker : dark);
        });
      }
      g.grid(n + 1, bandRows.length);
      g.orient(new Vector3(-e.out[0], 1, -e.out[1]));
      canopy.append(g);
    }
    const band = this.material('canopy', { color: '#ffffff', spec: 0 });
    this.add(canopy.mesh('border_canopy', this.scene, band));
    const cone = coneMesh(this.scene, 'border_trees_far', ctx.snowy);
    const coneMat = this.material('cones', { spec: 0 });
    cone.material = coneMat;
    const buf = new Float32Array(far.length * 16);
    far.forEach((m, i) => m.copyToArray(buf, i * 16));
    cone.thinInstanceSetBuffer('matrix', buf, 16, true);
    cone.thinInstanceRefreshBoundingInfo(false);
    this.add(cone);
    if (!this.models) return;
    const made = await Promise.all(
      [...near].map(([model, mats]) => {
        const def = getProp(`prop.${model}`);
        return def ? thinModel(this.models!, def.file, `border_tree_${model}`, mats).catch(() => [] as Mesh[]) : Promise.resolve([] as Mesh[]);
      }),
    );
    if (build !== this.build) return made.flat().forEach((m) => m.dispose());
    for (const m of made.flat()) this.add(m);
  }

  // ---------------------------------------------------------------- fence

  /**
   * A park-style electric fence just inside the line: dark posts every 4 m
   * (instanced) with white insulators, five live wires (one mesh) that glow
   * and flicker, and a yellow high-voltage sign every few posts.
   */
  private fence(edges: BorderEdge[], ctx: Ctx): void {
    const runs: FenceRun[] = [];
    for (const e of edges) {
      const f = frame(e);
      runs.push({ a: f.at(0, -ELECTRIC_FENCE.inset), b: f.at(e.length, -ELECTRIC_FENCE.inset), ground: ctx.ground });
    }
    const made = buildFence(this.scene, 'border_fence', runs);
    for (const m of made.meshes) this.add(m);
    this.materials.push(...made.materials);
    this.pulse = this.scene.onBeforeRenderObservable.add(() => made.animate(performance.now(), true));
  }

  // ---------------------------------------------------------------- water

  /** A beach that runs down from the line into the sea, and the sea out to the horizon. */
  private water(edges: BorderEdge[], ctx: Ctx): void {
    const beach = new Geo();
    const sea = new Geo();
    const scale = this.styler.groundScale('sand');
    const dry = Color3.FromHexString(ctx.snowy ? '#b9bcc0' : '#dcc58f');
    const wet = Color3.FromHexString(ctx.snowy ? '#7d8288' : '#9c875c');
    const deep = Color3.FromHexString('#1f4f6b');
    const shallow = Color3.FromHexString('#3f8a9c');
    for (const e of edges) {
      const f = frame(e);
      const [prev, next] = ctx.neighbours(e);
      const u0 = prev === 'water' ? -60 : -8;
      const u1 = e.length + (next === 'water' ? 60 : 8);
      let low = Infinity;
      for (let u = 0; u <= e.length; u += 4) low = Math.min(low, ctx.ground(...f.at(u, 0)));
      // The map's own sea, where one reaches the line, carries on at its own level; otherwise the sea lies just under the lowest shore.
      const [mx, mz] = f.at(e.length / 2, 0);
      const own = ctx.doc.entities.filter((w) => w.kind === 'water' && w.liquid === 'water' && Math.abs(mx - w.position[0]) <= w.size[0] / 2 + 1 && Math.abs(mz - w.position[2]) <= w.size[2] / 2 + 1);
      const sea0 = own.length ? Math.max(...own.map((w) => (w.kind === 'water' ? w.position[1] + w.size[1] : -Infinity))) - 0.05 : low - 1.1;
      const n = Math.max(2, Math.ceil((u1 - u0) / 4));
      const rows: [number, number][] = [[0.1, 0], [3, 0.15], [8, 0.45], [14, 0.75], [22, 1], [34, 1.4]];
      const g = new Geo();
      for (let i = 0; i <= n; i++) {
        const u = u0 + ((u1 - u0) * i) / n;
        // (A shore already under the map's sea just slopes on down to the sea bed.)
        const top = ctx.ground(...f.at(Math.min(e.length, Math.max(0, u)), 0)) - 0.04;
        rows.forEach(([v, k]) => {
          const [x, z] = f.at(u, v);
          const y = top + (Math.min(sea0, top) - 1.2 - top) * k + (k > 0 && k < 1 ? Math.sin(u * 0.2) * 0.15 : 0);
          g.vert(x, y, z, Color3.Lerp(dry, wet, Math.min(1, k * 1.4)), x / scale, z / scale);
        });
      }
      g.grid(n + 1, rows.length);
      g.orient(new Vector3(0, 1, 0));
      beach.append(g);
      // The sea: a strip from the shallows to the horizon, overlapping at corners.
      const s = new Geo();
      const far = 2600;
      for (const u of [u0 - far, u1 + far]) {
        for (const [v, c] of [[6, shallow], [60, deep], [far, deep]] as const) {
          const [x, z] = f.at(u, v);
          s.vert(x, sea0, z, c);
        }
      }
      s.grid(2, 3);
      s.orient(new Vector3(0, 1, 0));
      sea.append(s);
    }
    const sand = this.material('beach', { texture: this.styler.groundMaterial('sand').diffuseTexture, spec: 0.08 });
    this.add(beach.mesh('border_beach', this.scene, sand));
    const water = this.material('sea', { spec: 0.6 });
    water.specularPower = 96;
    this.add(sea.mesh('border_sea', this.scene, water));
  }
}

/** The order of the sides going round (each edge runs from its previous side to its next). */
const SIDE_RING: readonly BorderSide[] = ['north', 'west', 'south', 'east'];

interface Ctx {
  doc: MapDocument;
  floorY: number;
  seed: number;
  ground: (x: number, z: number) => number;
  night: boolean;
  snowy: boolean;
  sandy: boolean;
  /** Desert country: cliffs in red sandstone. */
  redRock: boolean;
  /** Styles of the sides before and after this edge (round the corners at its a and b ends). */
  neighbours: (e: BorderEdge) => [BorderStyle, BorderStyle];
}

interface Frame {
  /** World X, Z of a point `u` metres along the edge and `v` metres out from it. */
  at: (u: number, v: number) => [number, number];
  dir: [number, number];
  out: [number, number];
  /** Yaw that faces back into the play area. */
  facing: number;
}

function frame(e: BorderEdge): Frame {
  const dir: [number, number] = [(e.b[0] - e.a[0]) / e.length, (e.b[1] - e.a[1]) / e.length];
  return {
    at: (u, v) => [e.a[0] + dir[0] * u + e.out[0] * v, e.a[1] + dir[1] * u + e.out[1] * v],
    dir,
    out: e.out,
    facing: Math.atan2(-e.out[0], -e.out[1]),
  };
}

/** Vertex buffers built up piece by piece and turned into one mesh. */
class Geo {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  uv: number[] = [];
  i: number[] = [];

  get count(): number {
    return this.p.length / 3;
  }

  vert(x: number, y: number, z: number, c: Color3, u = 0, v = 0): void {
    this.p.push(x, y, z);
    this.c.push(c.r, c.g, c.b, 1);
    this.uv.push(u, v);
  }

  /** Triangles over vertices laid out as `cols` columns of `rows` each (column-major), from the first vertex. */
  grid(cols: number, rows: number): void {
    for (let i = 0; i < cols - 1; i++) {
      for (let r = 0; r < rows - 1; r++) {
        const a = i * rows + r;
        const b = (i + 1) * rows + r;
        this.i.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }

  /** Smooth normals, the triangles wound so they face `towards` on the whole. */
  orient(towards: Vector3): void {
    const normals: number[] = [];
    VertexData.ComputeNormals(this.p, this.i, normals);
    let dot = 0;
    for (let k = 0; k < normals.length; k += 3) dot += normals[k]! * towards.x + normals[k + 1]! * towards.y + normals[k + 2]! * towards.z;
    if (dot < 0) {
      for (let k = 0; k < this.i.length; k += 3) [this.i[k + 1], this.i[k + 2]] = [this.i[k + 2]!, this.i[k + 1]!];
      normals.length = 0;
      VertexData.ComputeNormals(this.p, this.i, normals);
    }
    this.n = normals;
  }

  append(o: Geo): void {
    const base = this.count;
    this.p.push(...o.p);
    this.n.push(...o.n);
    this.c.push(...o.c);
    this.uv.push(...o.uv);
    for (const k of o.i) this.i.push(k + base);
  }

  /** A flat quad (corners in order round it) with one normal and window-texture UVs (`len` × `h` metres). */
  quad(a: V3, b: V3, c: V3, d: V3, normal: V3, col: Color3, len: number, h: number, u0: number): void {
    // len = h = 0: one plain texel (off the windows).
    const k = this.count;
    for (const q of [a, b, c, d]) {
      this.p.push(...q);
      this.n.push(...normal);
      this.c.push(col.r, col.g, col.b, 1);
    }
    // One texture repeat per 32 × 32 m (8 storeys of 4 m windows, 8 across).
    this.uv.push(u0, 0, u0 + len / 32, 0, u0 + len / 32, h / 32, u0, h / 32);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }

  /** A box in an edge's frame: u along it, v out from it, y up. */
  block(f: Frame, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, tint: Color3, uo: number, facaded = 0): void {
    const P = (u: number, v: number, y: number): V3 => {
      const [x, z] = f.at(u, v);
      return [x, y, z];
    };
    const o = f.out;
    const d = f.dir;
    const h = y1 - y0;
    const w = u1 - u0;
    const dp = v1 - v0;
    // Front (facing the map), back, both ends, roof.
    // `facaded` metres of it stand behind city-kit facades: there the front is a dark interior wall set back behind their glass.
    const fy = Math.min(y1, y0 + facaded);
    if (facaded) this.quad(P(u0, v0 + 0.8, y0), P(u1, v0 + 0.8, y0), P(u1, v0 + 0.8, fy), P(u0, v0 + 0.8, fy), [-o[0], 0, -o[1]], tint.scale(0.22), 0, 0, 0.01);
    if (fy < y1) this.quad(P(u0, v0, fy), P(u1, v0, fy), P(u1, v0, y1), P(u0, v0, y1), [-o[0], 0, -o[1]], tint, w, y1 - fy, uo);
    this.quad(P(u1, v1, y0), P(u0, v1, y0), P(u0, v1, y1), P(u1, v1, y1), [o[0], 0, o[1]], tint.scale(0.85), w, h, uo);
    this.quad(P(u0, v1, y0), P(u0, v0, y0), P(u0, v0, y1), P(u0, v1, y1), [-d[0], 0, -d[1]], tint.scale(0.92), dp, h, uo);
    this.quad(P(u1, v0, y0), P(u1, v1, y0), P(u1, v1, y1), P(u1, v0, y1), [d[0], 0, d[1]], tint.scale(0.92), dp, h, uo);
    const roof = tint.scale(0.55);
    const k = this.count;
    for (const q of [P(u0, v0, y1), P(u1, v0, y1), P(u1, v1, y1), P(u0, v1, y1)]) {
      this.p.push(...q);
      this.n.push(0, 1, 0);
      this.c.push(roof.r, roof.g, roof.b, 1);
      // Off the windows: a plain corner of the texture.
      this.uv.push(0.01, 0.01);
    }
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }

  mesh(name: string, scene: Scene, mat: StandardMaterial, normals = true): Mesh {
    const m = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = this.p;
    vd.indices = this.i;
    vd.colors = this.c;
    if (this.uv.length) vd.uvs = this.uv;
    if (this.n.length === this.p.length) vd.normals = this.n;
    else if (normals) {
      const n: number[] = [];
      VertexData.ComputeNormals(this.p, this.i, n);
      vd.normals = n;
    }
    vd.applyToMesh(m);
    m.material = mat;
    return m;
  }
}

// ---------------------------------------------------------------- the electric fence (border and placed)

export interface FenceRun {
  a: [number, number];
  b: [number, number];
  /** Ground height under a point (the fence follows it). */
  ground: (x: number, z: number) => number;
}

const WIRE = Color3.FromHexString('#ffe9a0');

/**
 * Posts, live wires and warning signs along fence runs: posts and signs are
 * GPU instances of one small mesh each, the wires one mesh. `animate` makes
 * the wires hum with light (and go dark when switched off).
 */
export function buildFence(scene: Scene, name: string, runs: readonly FenceRun[]): { meshes: Mesh[]; materials: StandardMaterial[]; animate: (now: number, live: boolean) => void } {
  const H = ELECTRIC_FENCE.height;
  const posts: Matrix[] = [];
  const signs: Matrix[] = [];
  const wires = new Geo();
  let k = 0;
  for (const run of runs) {
    const len = Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]);
    const n = Math.max(1, Math.ceil(len / ELECTRIC_FENCE.postSpacing));
    const yaw = Math.atan2(run.b[0] - run.a[0], run.b[1] - run.a[1]);
    const pts: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const x = run.a[0] + ((run.b[0] - run.a[0]) * i) / n;
      const z = run.a[1] + ((run.b[1] - run.a[1]) * i) / n;
      const y = run.ground(x, z);
      pts.push([x, y, z]);
      posts.push(Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(Vector3.Up(), yaw), new Vector3(x, y, z)));
      if (i < n && k++ % 5 === 2) {
        const sx = x + ((run.b[0] - run.a[0]) / n) * 0.5;
        const sz = z + ((run.b[1] - run.a[1]) / n) * 0.5;
        signs.push(Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(Vector3.Up(), yaw), new Vector3(sx, run.ground(sx, sz), sz)));
      }
    }
    for (let i = 0; i < n; i++) {
      const [x0, y0, z0] = pts[i]!;
      const [x1, y1, z1] = pts[i + 1]!;
      for (const h of ELECTRIC_FENCE.wires) {
        // A thin cross-shaped ribbon that sags a touch between posts.
        const segs = 4;
        for (const [ox, oy] of [[0, 0.025], [0.025, 0]] as const) {
          const base = wires.count;
          for (let s = 0; s <= segs; s++) {
            const t = s / segs;
            const sag = Math.sin(t * Math.PI) * 0.06;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t + h - sag;
            const z = z0 + (z1 - z0) * t;
            // Sideways is across the run.
            const cx = Math.cos(yaw) * ox;
            const cz = -Math.sin(yaw) * ox;
            wires.vert(x - cx, y - oy, z - cz, WIRE);
            wires.vert(x + cx, y + oy, z + cz, WIRE);
          }
          for (let s = 0; s < segs; s++) {
            const a = base + s * 2;
            wires.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          }
        }
      }
    }
  }
  const postMat = new StandardMaterial(`${name}_postMat`, scene);
  postMat.diffuseColor = Color3.White();
  postMat.specularColor = new Color3(0.2, 0.2, 0.2);
  const wireMat = new StandardMaterial(`${name}_wireMat`, scene);
  wireMat.diffuseColor = Color3.Black();
  wireMat.specularColor = Color3.Black();
  wireMat.emissiveColor = WIRE;
  wireMat.disableLighting = true;
  wireMat.backFaceCulling = false;
  const post = postMesh(scene, `${name}_posts`, H);
  post.material = postMat;
  const sign = signMesh(scene, `${name}_signs`);
  sign.material = postMat;
  const meshes: Mesh[] = [post, sign];
  for (const [m, list] of [[post, posts], [sign, signs]] as const) {
    const buf = new Float32Array(list.length * 16);
    list.forEach((x, i) => x.copyToArray(buf, i * 16));
    m.thinInstanceSetBuffer('matrix', buf, 16, true);
    m.thinInstanceRefreshBoundingInfo(false);
    m.isPickable = false;
  }
  if (!signs.length) sign.setEnabled(false);
  const wireMesh = wires.mesh(`${name}_wires`, scene, wireMat);
  wireMesh.isPickable = false;
  meshes.push(wireMesh);
  let flick = 1;
  return {
    meshes,
    materials: [postMat, wireMat],
    animate: (now, live) => {
      if (!live) {
        wireMat.emissiveColor = new Color3(0.12, 0.12, 0.11);
        return;
      }
      // A steady hum of light with now and then a crackling flicker.
      if (Math.random() < 0.02) flick = 1.6;
      flick += (1 - flick) * 0.2;
      wireMat.emissiveColor = WIRE.scale((0.72 + 0.18 * Math.sin(now * 0.012) + 0.1 * Math.sin(now * 0.047)) * flick);
    },
  };
}

/** One post: a dark steel upright, an outward-leaning top arm, white insulators at each wire. */
function postMesh(scene: Scene, name: string, h: number): Mesh {
  const g = new Geo();
  const steel = Color3.FromHexString('#3a4038');
  const white = Color3.FromHexString('#e8e4d8');
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Color3) => {
    const f: Frame = { at: (u, v) => [u, v], dir: [1, 0], out: [0, 1], facing: 0 };
    g.block(f, x0, x1, z0, z1, y0, y1, c, 0);
  };
  // Local X is across the run (out of the play area on the border), Z along it.
  box(-0.07, -0.4, -0.07, 0.07, h, 0.07, steel);
  box(0.02, h - 0.1, -0.05, 0.45, h + 0.05, 0.05, steel);
  for (const y of ELECTRIC_FENCE.wires) box(-0.12, y - 0.05, -0.05, 0.04, y + 0.05, 0.05, white);
  // Uniform UVs: the material has no texture.
  const m = g.mesh(name, scene, new StandardMaterial(`${name}_tmp`, scene), false);
  m.material?.dispose();
  return m;
}

/** A yellow "high voltage" plate hung on the wires between posts, a black bolt on both faces. */
function signMesh(scene: Scene, name: string): Mesh {
  const g = new Geo();
  const yellow = Color3.FromHexString('#f2c200');
  const black = Color3.FromHexString('#141414');
  const f: Frame = { at: (u, v) => [u, v], dir: [1, 0], out: [0, 1], facing: 0 };
  // In the plane of the fence: thin across it (local X), wide along it (local Z).
  g.block(f, -0.03, 0.03, -0.32, 0.32, 1.2, 1.62, yellow, 0);
  // The bolt, standing just proud of each face.
  const bolt: [number, number][] = [[0.05, 1.58], [-0.1, 1.38], [0.0, 1.38], [-0.06, 1.24], [0.11, 1.45], [0.01, 1.45]];
  for (const side of [-1, 1]) {
    const x = side * 0.035;
    const k = g.count;
    for (const [z, y] of bolt) {
      g.p.push(x, y, z);
      g.n.push(side, 0, 0);
      g.c.push(black.r, black.g, black.b, 1);
      g.uv.push(0, 0);
    }
    g.i.push(k, k + 1, k + 2, k + 2, k + 3, k + 4, k + 2, k + 4, k + 5);
  }
  const m = g.mesh(name, scene, new StandardMaterial(`${name}_tmp`, scene), false);
  m.material?.dispose();
  return m;
}

/** A low-poly conifer (trunk and three tiers), vertex-coloured, for the far rows of a forest. */
function coneMesh(scene: Scene, name: string, snowy: boolean): Mesh {
  const g = new Geo();
  const seg = 5;
  const rings: [number, number, string][] = [
    [0, 0.28, '#4a3524'],
    [1.4, 0.28, '#4a3524'],
    [1.4, 2.2, '#2c4a2a'],
    [4.2, 1.1, '#33532f'],
    [4.2, 1.7, '#2f4e2c'],
    [7, 0.7, '#3a5e34'],
    [7, 1.15, '#3a5e34'],
    [10, 0.05, snowy ? '#e8eef2' : '#45663a'],
  ];
  for (const [y, r, c] of rings) {
    const col = Color3.FromHexString(c);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      g.vert(Math.sin(a) * r, y, Math.cos(a) * r, snowy && y >= 4.2 ? Color3.Lerp(col, Color3.White(), 0.35) : col);
    }
  }
  for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7]] as const) {
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      g.i.push(a * seg + i, b * seg + i, a * seg + j, a * seg + j, b * seg + i, b * seg + j);
    }
  }
  g.orient(new Vector3(0, 0.2, 0));
  const tmp = new StandardMaterial(`${name}_tmp`, scene);
  const m = g.mesh(name, scene, tmp);
  m.material = null;
  tmp.dispose();
  return m;
}

// ---------------------------------------------------------------- instanced models

/** Width of one facade bay and how far a facade stands proud of its wall (as in shared geometry's city kit). */
const BAY = 8 / 3;
/** Storeys of a front-row block dressed in city-kit facades (the rest of its front is the window texture). */
const FACADE_STOREYS = 2;
const FACADE_OUT = 0.32;
const FACADE_KIT = [
  { ground: ['Brick_Window_Trim_Single', 'Brick_BottomTrim'], upper: ['Brick_Window_Trim_Single', 'Brick_Plain_3'], cornice: 'Cornice_Brick_Center' },
  { ground: ['Metal_FullWindow', 'Metal_FirstFloor_Window'], upper: ['Brick_Window_Square_Single', 'Brick_Plain_3'], cornice: 'Cornice_Metal_Center' },
  { ground: ['Trim_FirstFloor_Window_001', 'Trim_FirstFloor_Wall'], upper: ['Trim_Window', 'Trim_Plain_3'], cornice: 'Cornice_Trim_Center' },
] as const;

interface Piece {
  piece: string;
  at: V3;
  yaw: number;
  sx: number;
  sy: number;
}

const FOREST_KITS = {
  green: { trees: ['nt_pine_tall', 'nt_common_tree', 'nt_pine_tall', 'nt_birch'], bushes: ['nt_bush_leafy', 'nt_fern_wide', 'nt_bush_leafy'] },
  snow: { trees: ['nt_pine_snow_tall', 'nt_pine_snow_tall', 'nt_birch_snow', 'nt_common_tree_snow'], bushes: ['nt_bush_snow', 'nt_rock_snow'] },
  sand: { trees: ['nt_palm_tall', 'nt_palm_curved', 'nt_palm_tall', 'nt_saguaro'], bushes: ['nt_cactus_round', 'nt_bush_leafy', 'nt_rock_flat'] },
} as const satisfies Record<string, { trees: readonly string[]; bushes: readonly string[] }>;

/** Every mesh of a model, GPU-instanced at each of `matrices` (one draw call per mesh, however many copies). */
/** Side of the squares (m) detailed instanced border models are split into (splitThin). */
const SECTOR = 120;
/** Below this many triangles a model's instances stay in one draw call (cones, posts, signs). */
const SPLIT_TRIANGLES = 300;
/** Past this distance (m) split chunks of detailed models aren't drawn, by graphics setting (the cones behind stand in). */
const SECTOR_FAR: Record<string, number> = { low: 160, medium: 260, high: 0 };

/**
 * A thin-instanced mesh is drawn whole or not at all. Detailed models (the
 * forest's front-row trees, ~2 k triangles each, the skyline's facades) that
 * run along the whole boundary were all drawn wherever you looked: 0.6 M
 * triangles on Apex Ring. Split into SECTOR squares, the ones behind you are
 * culled, and on low and medium graphics far ones drop out.
 */
function splitThin(mesh: Mesh): Mesh[] {
  const n = mesh.thinInstanceCount;
  if (n < 8 || mesh.getTotalIndices() / 3 < SPLIT_TRIANGLES) return [mesh];
  const all = mesh.thinInstanceGetWorldMatrices();
  const groups = new Map<string, Matrix[]>();
  for (const m of all) {
    const key = `${Math.floor(m.m[12]! / SECTOR)},${Math.floor(m.m[14]! / SECTOR)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  }
  const far = SECTOR_FAR[loadGraphicsQuality()] ?? 0;
  const out: Mesh[] = [];
  for (const list of groups.values()) {
    const m = out.length === 0 ? mesh : mesh.clone(`${mesh.name}_${out.length}`, null, true, false);
    // The instance buffer lives on the geometry: each chunk needs its own.
    if (m !== mesh) m.makeGeometryUnique();
    const buf = new Float32Array(list.length * 16);
    list.forEach((x, i) => x.copyToArray(buf, i * 16));
    m.thinInstanceSetBuffer('matrix', buf, 16, true);
    m.thinInstanceRefreshBoundingInfo(false);
    if (far) m.addLODLevel(far, null);
    out.push(m);
  }
  return out;
}

async function thinModel(models: ModelLibrary, file: string, name: string, matrices: readonly Matrix[]): Promise<Mesh[]> {
  const container = await models.load(file);
  const inst = container.instantiateModelsToScene((n) => `${name}_${n}`, false, { doNotInstantiate: true });
  const roots = inst.rootNodes as TransformNode[];
  for (const r of roots) r.computeWorldMatrix(true);
  const meshes = roots.flatMap((r) => r.getChildMeshes(false) as Mesh[]).filter((m) => m.getTotalVertices() > 0);
  const bases = meshes.map((m) => m.computeWorldMatrix(true).clone());
  meshes.forEach((m, i) => {
    m.parent = null;
    m.position.setAll(0);
    m.rotationQuaternion = null;
    m.rotation.setAll(0);
    m.scaling.setAll(1);
    // Thin-instance buffers live on the geometry: copies made from the same model elsewhere (props, city kit) must not share it.
    m.makeGeometryUnique();
    const buf = new Float32Array(matrices.length * 16);
    matrices.forEach((x, j) => bases[i]!.multiply(x).copyToArray(buf, j * 16));
    m.thinInstanceSetBuffer('matrix', buf, 16, true);
    m.thinInstanceRefreshBoundingInfo(false);
    m.isPickable = false;
  });
  for (const r of roots) r.dispose();
  return meshes;
}

/** The city kit's facade pieces, each GPU-instanced at every bay that uses it (as CityVisuals does for rooms). */
async function thinFacades(models: ModelLibrary, pieces: readonly Piece[], name: string): Promise<Mesh[]> {
  const container = await models.load('city/facades.glb');
  const inst = container.instantiateModelsToScene((n) => `${name}_${n}`, false, { doNotInstantiate: true });
  const byPiece = new Map<string, Piece[]>();
  for (const p of pieces) (byPiece.get(p.piece) ?? byPiece.set(p.piece, []).get(p.piece)!).push(p);
  const roots = inst.rootNodes as TransformNode[];
  for (const r of roots) r.computeWorldMatrix(true);
  const out: Mesh[] = [];
  for (const root of roots) {
    for (const node of root.getChildTransformNodes(false)) {
      const list = byPiece.get(node.name.replace(`${name}_`, ''));
      if (!list) continue;
      const meshes = node.getChildMeshes(false) as Mesh[];
      if (node.getClassName() === 'Mesh') meshes.push(node as Mesh);
      for (const mesh of meshes) {
        if (!mesh.getTotalVertices()) continue;
        const base = mesh.computeWorldMatrix(true).clone();
        mesh.parent = null;
        mesh.position.setAll(0);
        mesh.rotationQuaternion = null;
        mesh.rotation.setAll(0);
        mesh.scaling.setAll(1);
        // The map's own city-kit facades instance the same pieces: own geometry, own instance buffer.
        mesh.makeGeometryUnique();
        const buf = new Float32Array(list.length * 16);
        list.forEach((p, i) => base.multiply(Matrix.Compose(new Vector3(p.sx, p.sy, 1), Quaternion.RotationAxis(Vector3.Up(), p.yaw), new Vector3(...p.at))).copyToArray(buf, i * 16));
        mesh.thinInstanceSetBuffer('matrix', buf, 16, true);
        mesh.thinInstanceRefreshBoundingInfo(false);
        mesh.isPickable = false;
        out.push(mesh);
      }
    }
  }
  for (const m of roots.flatMap((r) => r.getChildMeshes(false))) if (!out.includes(m as Mesh)) m.dispose();
  for (const r of roots) r.dispose();
  return out;
}
