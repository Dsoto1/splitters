import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { BUILD_LEVELS, buildLimitRect, playableRect, type AreaRect, type MapDocument, type Vec3 } from '@tiletrigger/shared';

/** The level grid's selection cyan, the playable boundary's orange (as before), the build limit's white. */
const GRID = Color3.FromHexString('#00d1ff');
const BOUNDARY = new Color3(1, 0.55, 0.1);
const LIMIT = Color3.FromHexString('#eef3f8');
/** Every 4th line is a major one, drawn stronger. */
const MAJOR = 4;
/** The local grid moves in steps of this many cells (so it is rebuilt only when its centre moves that far). */
const STEP = 4;
/** The local grid's radius in cells: grows with the camera's distance from the level, within these. */
const MIN_RADIUS = 12;
const MAX_RADIUS = 40;
/** The scenery zone's band just outside the playable boundary (m): hatched, fading outwards. */
const BAND = 24;

type Rect = AreaRect;

/**
 * MapMaker's build area (docs/BUILDING_KIT.md, "Where you can build"): a grid local to where the camera looks, at the
 * level being edited (or the whole build area on demand: top bar Full grid), and two outlines that are always there:
 * the playable boundary (orange: the map's bounds, else its terrain's extent) and the build limit (white, dashed:
 * where placement stops), with a hatched "scenery zone" band just outside the boundary, since building there is
 * intended (owner, 2026-11-05). Cheap: the grid is one line system rebuilt only when its centre moves STEP cells, its
 * radius changes or the level does; the outlines only when the map's rectangles or the level change.
 */
export class BuildAreaVisuals {
  /** Everything here (photo mode hides it). */
  readonly root: TransformNode;
  /** The grid alone (top bar Grid). */
  private readonly gridRoot: TransformNode;
  private grid?: LinesMesh;
  private gridKey = '';
  private outlines: Mesh[] = [];
  private outlineKey = '';
  private full = false;
  private cellSize = 8;
  private levelHeight = 4;
  private level = 0;
  private limit: Rect = { min: [-2052, -2052], max: [2052, 2052] };
  private hatchMat?: StandardMaterial;
  private labelMats = new Map<string, { mat: StandardMaterial; aspect: number }>();

  constructor(private readonly scene: Scene) {
    this.root = new TransformNode('edBuildArea', scene);
    this.gridRoot = new TransformNode('edGridRoot', scene);
    this.gridRoot.parent = this.root;
  }

  /** How far the camera may roam: the build limit and a little more. */
  get reach(): number {
    return this.limit.max[0] + 120;
  }

  /** The map or level changed: outlines now, the grid on the next update. */
  setMap(doc: MapDocument, level: number): void {
    const { cellSize, levelHeight } = doc.classicStructure;
    this.cellSize = cellSize;
    this.levelHeight = levelHeight;
    this.level = level;
    this.limit = buildLimitRect(doc);
    const play = playableRect(doc);
    const key = JSON.stringify([cellSize, levelHeight, level, play]);
    if (key === this.outlineKey) return;
    this.outlineKey = key;
    for (const m of this.outlines) m.dispose();
    this.outlines = [];
    const y = level * levelHeight;
    this.buildLimitOutline(y);
    if (play) this.boundaryOutline(play, y);
  }

  setGridVisible(on: boolean): void {
    this.gridRoot.setEnabled(on);
  }

  get gridFull(): boolean {
    return this.full;
  }

  /** Top bar Full grid: the grid over the whole build area, or back to the local one. */
  setGridFull(on: boolean): void {
    this.full = on;
    this.gridKey = '';
  }

  /** Per frame: follow the camera's look point on the level (rebuilding only when it moved far enough). */
  update(pos: Vec3, dir: Vec3): void {
    const cs = this.cellSize;
    const y = this.level * this.levelHeight;
    let cx = pos.x + dir.x * 60;
    let cz = pos.z + dir.z * 60;
    let dist = Math.abs(pos.y - y);
    if (Math.abs(dir.y) > 0.02) {
      const t = (y - pos.y) / dir.y;
      if (t > 0) {
        const tt = Math.min(t, 400);
        cx = pos.x + dir.x * tt;
        cz = pos.z + dir.z * tt;
        dist = tt;
      }
    }
    const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.ceil((dist * 1.1) / cs / STEP) * STEP));
    const lim = this.limit.max[0] / cs - 0.5;
    const snapC = (v: number) => Math.max(-lim, Math.min(lim, Math.round(v / cs / STEP) * STEP));
    const gx = snapC(cx);
    const gz = snapC(cz);
    const key = this.full ? `full|${cs}|${y}|${lim}` : `${gx},${gz}|${radius}|${cs}|${y}|${lim}`;
    if (key === this.gridKey) return;
    this.gridKey = key;
    this.grid?.dispose();
    this.grid = this.full ? this.fullGrid(y) : this.localGrid(gx, gz, radius, y);
    this.grid.parent = this.gridRoot;
  }

  /** Lines at cell edges ((i - 0.5) × cellSize), every 4th a major one, alpha fading out from the centre. */
  private localGrid(gx: number, gz: number, radius: number, y: number): LinesMesh {
    const cs = this.cellSize;
    const lim = this.limit.max[0] / cs + 0.5;
    const lo = (c: number) => Math.max(c - radius, -lim + 1);
    const hi = (c: number) => Math.min(c + radius + 1, lim);
    const fadeFrom = radius * 0.45 * cs;
    const fadeTo = radius * cs;
    const alphaAt = (x: number, z: number, major: boolean) => {
      const d = Math.hypot(x - gx * cs, z - gz * cs);
      const k = Math.max(0, Math.min(1, 1 - (d - fadeFrom) / (fadeTo - fadeFrom)));
      return k * k * (major ? 0.85 : 0.4);
    };
    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    const yy = y + 0.03;
    for (const along of [0, 1]) {
      const [a, b] = along ? [gz, gx] : [gx, gz];
      for (let i = lo(a); i <= hi(a); i++) {
        const v = (i - 0.5) * cs;
        const major = i % MAJOR === 0;
        const pts: Vector3[] = [];
        const cols: Color4[] = [];
        for (let j = lo(b); j <= hi(b); j++) {
          const w = (j - 0.5) * cs;
          const [x, z] = along ? [w, v] : [v, w];
          pts.push(new Vector3(x, yy, z));
          cols.push(new Color4(GRID.r, GRID.g, GRID.b, alphaAt(x, z, major)));
        }
        lines.push(pts);
        colors.push(cols);
      }
    }
    const mesh = CreateLineSystem('grid', { lines, colors, useVertexAlpha: true }, this.scene);
    mesh.isPickable = false;
    return mesh;
  }

  /** Every cell across the build area: minor lines faint, majors stronger (no fade). */
  private fullGrid(y: number): LinesMesh {
    const cs = this.cellSize;
    const n = Math.round(this.limit.max[0] / cs - 0.5);
    const e = (n + 0.5) * cs;
    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    const yy = y + 0.03;
    for (let i = -n; i <= n + 1; i++) {
      const v = (i - 0.5) * cs;
      const c = new Color4(GRID.r, GRID.g, GRID.b, i % MAJOR === 0 ? 0.5 : 0.16);
      lines.push([new Vector3(v, yy, -e), new Vector3(v, yy, e)], [new Vector3(-e, yy, v), new Vector3(e, yy, v)]);
      colors.push([c, c], [c, c]);
    }
    const mesh = CreateLineSystem('grid', { lines, colors, useVertexAlpha: true }, this.scene);
    mesh.isPickable = false;
    return mesh;
  }

  /** A line system here, and a faint copy drawn over everything, so hills and buildings never hide it. */
  private outline(name: string, lines: Vector3[][], color: Color3, xray: number): void {
    const m = CreateLineSystem(name, { lines }, this.scene);
    m.color = color;
    m.isPickable = false;
    m.parent = this.root;
    this.outlines.push(m);
    if (!xray) return;
    const over = CreateLineSystem(`${name}Over`, { lines }, this.scene);
    over.color = color;
    over.alpha = xray;
    over.isPickable = false;
    over.renderingGroupId = 1;
    over.parent = this.root;
    this.outlines.push(over);
  }

  /** The build limit: a dashed white rectangle on the level, posts at its corners spanning the levels a tile may take. */
  private buildLimitOutline(y: number): void {
    const cs = this.cellSize;
    const [x0, z0] = this.limit.min;
    const [x1, z1] = this.limit.max;
    const yy = y + 0.1;
    const dashes: Vector3[][] = [];
    // A dash per cell along each side, 5/8 of the cell long.
    const dash = cs * 0.625;
    for (let t = x0; t < x1 - 1e-6; t += cs) {
      const t1 = Math.min(t + dash, x1);
      dashes.push([new Vector3(t, yy, z0), new Vector3(t1, yy, z0)], [new Vector3(t, yy, z1), new Vector3(t1, yy, z1)]);
    }
    for (let t = z0; t < z1 - 1e-6; t += cs) {
      const t1 = Math.min(t + dash, z1);
      dashes.push([new Vector3(x0, yy, t), new Vector3(x0, yy, t1)], [new Vector3(x1, yy, t), new Vector3(x1, yy, t1)]);
    }
    const bottom = BUILD_LEVELS.min * this.levelHeight;
    const top = (BUILD_LEVELS.max + 1) * this.levelHeight;
    const posts: Vector3[][] = [];
    for (const [x, z, sx, sz] of [[x0, z0, 1, 1], [x1, z0, -1, 1], [x1, z1, -1, -1], [x0, z1, 1, -1]] as const) {
      posts.push([new Vector3(x, bottom, z), new Vector3(x, top, z)]);
      // Ticks at the lowest and highest level, pointing in along both sides.
      for (const h of [bottom, top]) posts.push([new Vector3(x + sx * cs, h, z), new Vector3(x, h, z), new Vector3(x, h, z + sz * cs)]);
    }
    this.outline('buildLimit', dashes, LIMIT, 0.4);
    this.outline('buildLimitPosts', posts, LIMIT, 0);
    // Its name, inside each side, read from within.
    const size = Math.max(6, cs);
    this.sideLabels('BUILD LIMIT', 'limit', { min: [x0 + size, z0 + size], max: [x1 - size, z1 - size] }, yy, size, '#eef3f8');
  }

  /** The playable boundary: orange at the level and 6 m up with corner posts, and the scenery band outside it. */
  private boundaryOutline(r: Rect, y: number): void {
    const [x0, z0] = r.min;
    const [x1, z1] = r.max;
    const loop = (h: number) => [new Vector3(x0, h, z0), new Vector3(x1, h, z0), new Vector3(x1, h, z1), new Vector3(x0, h, z1), new Vector3(x0, h, z0)];
    const posts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [new Vector3(x!, y + 0.05, z!), new Vector3(x!, y + 6, z!)]);
    this.outline('bounds', [loop(y + 0.08)], BOUNDARY, 0.45);
    this.outline('boundsTop', [loop(y + 6), ...posts], BOUNDARY, 0);
    this.sceneryBand(r, y + 0.04);
    this.sideLabels('SCENERY ZONE · outside play, building here is fine', 'scenery', { min: [x0 - BAND / 2, z0 - BAND / 2], max: [x1 + BAND / 2, z1 + BAND / 2] }, y + 0.06, 3, '#ffb36b');
  }

  /** A hatched orange band round the boundary, fading out over BAND m: what lies outside is scenery, not an error. */
  private sceneryBand(r: Rect, y: number): void {
    const [x0, z0] = r.min;
    const [x1, z1] = r.max;
    const w = BAND;
    const inner = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const outer = [[x0 - w, z0 - w], [x1 + w, z0 - w], [x1 + w, z1 + w], [x0 - w, z1 + w]];
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let s = 0; s < 4; s++) {
      const base = positions.length / 3;
      const n = (s + 1) % 4;
      for (const [[x, z], a] of [[inner[s]!, 1], [inner[n]!, 1], [outer[n]!, 0], [outer[s]!, 0]] as const) {
        positions.push(x!, y, z!);
        colors.push(1, 1, 1, a);
        uvs.push(x! / 6, z! / 6);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.colors = colors;
    vd.uvs = uvs;
    const mesh = new Mesh('sceneryBand', this.scene);
    vd.applyToMesh(mesh);
    mesh.hasVertexAlpha = true;
    mesh.material = this.hatch();
    mesh.isPickable = false;
    mesh.parent = this.root;
    this.outlines.push(mesh);
  }

  private hatch(): StandardMaterial {
    if (this.hatchMat) return this.hatchMat;
    const tex = new DynamicTexture('edHatchTex', { width: 64, height: 64 }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 10;
    // Diagonal stripes that tile.
    for (const o of [-64, 0, 64]) {
      ctx.beginPath();
      ctx.moveTo(o, 64);
      ctx.lineTo(o + 64, 0);
      ctx.stroke();
    }
    tex.update();
    tex.hasAlpha = true;
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    const mat = new StandardMaterial('edHatchMat', this.scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.diffuseColor = Color3.Black();
    mat.emissiveColor = BOUNDARY;
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.alpha = 0.32;
    this.hatchMat = mat;
    return mat;
  }

  /** A text material (made once per text). */
  private label(text: string, colour: string): { mat: StandardMaterial; aspect: number } {
    const have = this.labelMats.get(text);
    if (have) return have;
    const h = 64;
    const font = `bold ${h * 0.62}px sans-serif`;
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width + h * 0.6);
    const tex = new DynamicTexture(`edLabel_${text}`, { width: w, height: h }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, w, h);
    ctx.font = font;
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    tex.update();
    tex.hasAlpha = true;
    const mat = new StandardMaterial(`edLabelMat_${text}`, this.scene);
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    mat.alpha = 0.85;
    const made = { mat, aspect: w / h };
    this.labelMats.set(text, made);
    return made;
  }

  /** `text` flat on the ground at the middle of each side of `r`, its top towards the outside (read from within). */
  private sideLabels(text: string, name: string, r: Rect, y: number, height: number, colour: string): void {
    const { mat, aspect } = this.label(text, colour);
    const [x0, z0] = r.min;
    const [x1, z1] = r.max;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    // Each label's middle, and its "up" (the way out of the rectangle).
    const sides: [number, number, number, number][] = [[mx, z1, 0, 1], [x1, mz, 1, 0], [mx, z0, 0, -1], [x0, mz, -1, 0]];
    const width = height * aspect;
    for (const [cx, cz, ux, uz] of sides) {
      // Right of the text = up turned a quarter clockwise seen from above.
      const rx = uz;
      const rz = -ux;
      const corner = (s: number, t: number) => [cx + rx * s * width / 2 + ux * t * height / 2, y, cz + rz * s * width / 2 + uz * t * height / 2];
      const positions = [...corner(-1, -1), ...corner(1, -1), ...corner(1, 1), ...corner(-1, 1)];
      const vd = new VertexData();
      vd.positions = positions;
      vd.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
      vd.indices = [0, 2, 1, 0, 3, 2];
      const mesh = new Mesh(`edLabel_${name}`, this.scene);
      vd.applyToMesh(mesh);
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.parent = this.root;
      this.outlines.push(mesh);
    }
  }
}
