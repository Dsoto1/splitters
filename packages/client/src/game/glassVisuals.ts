import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { GLASS, destructibleBox, glassBlocks, glassCracks, rayOBox, windowPanes, type GlassKind, type MapDocument, type OBox, type Vec3 } from '@tiletrigger/shared';
import { skyReflection } from './reflections.ts';

/**
 * How glass is drawn. Every pane in a map (glass in windows, glass blocks and
 * the older Window pane destructibles) is a thin instance of one unit box in a
 * shared material per tint:
 *
 * - see-through with a slight tint, clearer face on and more opaque towards
 *   grazing angles (Fresnel opacity), a little darker and greener at its edges
 *   (a small edge texture, like the thickness of float glass seen at the rim);
 * - a Fresnel reflection of the map's sky picture (no render target: it shares
 *   the backdrop's texture) and a sharp specular glint from the lights.
 *
 * Panes are grouped in 32 m squares, one mesh per square and tint, so the
 * transparent pass sorts them by distance against water and effects, and
 * squares out of view are culled. A building full of windows is a handful of
 * draw calls. Bulletproof glass frosts as it cracks (per-instance colour) and
 * keeps a star crack where each round struck (one thin-instanced decal mesh);
 * broken panes drop out (zero scale) and shatter into shards (the game view).
 */

/** Edge length of the squares panes are grouped in (m). */
const CHUNK = 32;
/** Crack decals kept (oldest reused first). */
const MAX_CRACKS = 192;

/** The shared glass material for a tint (one per tint per scene). */
export function glassMaterial(scene: Scene, tint: string = GLASS.tint): StandardMaterial {
  const name = `glassMat_${tint}`;
  const have = scene.getMaterialByName(name) as StandardMaterial | null;
  if (have) return have;
  const m = new StandardMaterial(name, scene);
  const c = Color3.FromHexString(tint);
  m.diffuseColor = c;
  m.specularColor = new Color3(0.9, 0.9, 0.9);
  m.specularPower = 256;
  m.emissiveColor = c.scale(0.05);
  // The edge texture: alpha (and a slightly darker, greener colour) rises at the rim of each pane.
  m.diffuseTexture = edgeTexture(scene);
  m.diffuseTexture.hasAlpha = true;
  m.useAlphaFromDiffuseTexture = true;
  m.alpha = 0.32;
  m.useSpecularOverAlpha = true;
  m.useReflectionOverAlpha = true;
  m.backFaceCulling = false;
  // Babylon adds the Fresnel opacity on top: about nothing face on ("right"), most of the way to opaque edge on ("left").
  m.opacityFresnelParameters = new FresnelParameters({ leftColor: new Color3(0.48, 0.48, 0.48), rightColor: new Color3(0.0, 0.0, 0.0), bias: 0, power: 2.6 });
  const sky = skyReflection(scene);
  if (sky) {
    m.reflectionTexture = sky;
    // About 6 % face on (real glass is ~4 %), a mirror at grazing angles.
    m.reflectionFresnelParameters = new FresnelParameters({ leftColor: new Color3(0.72, 0.72, 0.72), rightColor: new Color3(0.06, 0.06, 0.06), bias: 0, power: 3 });
  }
  return m;
}

/** A pane's rim: a soft frame of more opaque, darker glass (64 px, made in code once per scene). */
function edgeTexture(scene: Scene): Texture {
  const have = scene.getTextureByName('glassEdgeTex') as Texture | null;
  if (have) return have;
  const n = 64;
  const px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      const d = Math.min(u, 1 - u, v, 1 - v);
      // 1 at the rim, easing to 0 a few percent in.
      const t = Math.min(1, d / 0.045);
      const rim = 1 - t * t * (3 - 2 * t);
      const i = (y * n + x) * 4;
      px[i] = Math.round(255 * (1 - rim * 0.45));
      px[i + 1] = Math.round(255 * (1 - rim * 0.3));
      px[i + 2] = Math.round(255 * (1 - rim * 0.38));
      // Times the material's alpha (0.32): about 0.1 in the middle, 0.3 at the rim.
      px[i + 3] = Math.round(255 * (0.32 + rim * 0.6));
    }
  }
  const tex = RawTexture.CreateRGBATexture(px, n, n, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.name = 'glassEdgeTex';
  tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}

/**
 * A star crack round a punched hole (white cracks on clear, 128 px): jagged
 * radial cracks that thin out, broken rings of the spider web between them,
 * and a crushed, dark spot where the round struck. Drawn in code once per
 * scene (anti-aliased lines into a pixel buffer).
 */
function crackTexture(scene: Scene): Texture {
  const have = scene.getTextureByName('glassCrackTex') as Texture | null;
  if (have) return have;
  const n = 128;
  const alpha = new Float32Array(n * n);
  const c = n / 2;
  let seed = 917;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const line = (x0: number, y0: number, x1: number, y1: number, width: number, a: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    const r = width / 2 + 1;
    for (let y = Math.max(0, Math.floor(Math.min(y0, y1) - r)); y <= Math.min(n - 1, Math.ceil(Math.max(y0, y1) + r)); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(x0, x1) - r)); x <= Math.min(n - 1, Math.ceil(Math.max(x0, x1) + r)); x++) {
        const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / len2));
        const d = Math.hypot(x + 0.5 - (x0 + dx * t), y + 0.5 - (y0 + dy * t));
        const cover = Math.max(0, Math.min(1, width / 2 + 0.5 - d)) * a;
        const i = y * n + x;
        if (cover > alpha[i]!) alpha[i] = cover;
      }
    }
  };
  // Radial cracks, each a jagged line that thins out.
  const rays = 11;
  for (let k = 0; k < rays; k++) {
    const len = c * (0.55 + rnd() * 0.42);
    let x = c;
    let y = c;
    let ang = (k / rays) * Math.PI * 2 + rnd() * 0.4;
    const steps = 6;
    for (let st = 1; st <= steps; st++) {
      ang += (rnd() - 0.5) * 0.35;
      const r = (len * st) / steps;
      const nx = c + Math.cos(ang) * r;
      const ny = c + Math.sin(ang) * r;
      line(x, y, nx, ny, Math.max(0.7, 2.2 - st * 0.28), 0.95 - st * 0.1);
      x = nx;
      y = ny;
    }
  }
  // Broken rings between neighbouring rays (the spider web).
  for (const ring of [0.22, 0.4]) {
    for (let k = 0; k < rays; k++) {
      if (rnd() < 0.3) continue;
      const a0 = (k / rays) * Math.PI * 2 + rnd() * 0.2;
      const a1 = a0 + ((Math.PI * 2) / rays) * (0.7 + rnd() * 0.3);
      const r = c * ring * (0.85 + rnd() * 0.3);
      line(c + Math.cos(a0) * r, c + Math.sin(a0) * r, c + Math.cos(a1) * r * (0.9 + rnd() * 0.2), c + Math.sin(a1) * r * (0.9 + rnd() * 0.2), 1, 0.75 - ring * 0.6);
    }
  }
  const px = new Uint8Array(n * n * 4);
  const hole = c * 0.16;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / hole;
      // The crushed spot: a dark hole inside a frosted ring that fades out.
      const dark = d < 0.4 ? 1 : d < 0.55 ? (0.55 - d) / 0.15 : 0;
      const frost = d < 1 ? Math.min(1, (1 - d) / 0.5) * 0.9 : 0;
      const a = Math.max(alpha[i]!, frost, dark);
      const v = Math.round(255 * (0.93 - dark * 0.77));
      px[i * 4] = v;
      px[i * 4 + 1] = Math.min(255, v + 4);
      px[i * 4 + 2] = Math.min(255, v + 6);
      px[i * 4 + 3] = Math.round(255 * a);
    }
  }
  const tex = RawTexture.CreateRGBATexture(px, n, n, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.name = 'glassCrackTex';
  tex.hasAlpha = true;
  tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}

export interface PaneLook {
  /** Scenario index (state and events). */
  index: number;
  box: OBox;
  kind: GlassKind | 'pane';
  tint: string;
  /** A Window pane destructible: drawn with its cross frame. */
  framed: boolean;
  /** Health % it starts at (0 for glass blocks hidden at the start). */
  start: number;
}

interface Chunk {
  mesh: Mesh;
  matrices: Float32Array;
  colors: Float32Array;
  count: number;
}

interface Pane extends PaneLook {
  chunk: Chunk;
  slot: number;
  /** Frame instances (mullion, transom) in the frame mesh, for framed panes. */
  frame: number;
  shown: number;
}

interface Crack {
  pane: number;
  matrix: Float32Array;
}

/**
 * Every pane of glass in a map, instanced. Built with the map; `apply`
 * follows the replicated health of each pane, `strike` puts a crack where a
 * round stopped on a pane.
 */
export class GlassVisuals {
  private panes: Pane[] = [];
  private readonly byIndex = new Map<number, Pane>();
  private chunks: Chunk[] = [];
  private frames: { mesh: Mesh; matrices: Float32Array } | null = null;
  private cracks: { mesh: Mesh; matrices: Float32Array; list: Crack[] } | null = null;

  constructor(private readonly scene: Scene) {}

  /**
   * (Re)build for this map. In play every kind of pane is drawn here; MapMaker
   * (`windowsOnly`) draws its entities itself, so only the window glass.
   */
  build(map: MapDocument, opts: { windowsOnly?: boolean; skip?: ReadonlySet<string> } = {}): void {
    this.dispose();
    if (this.scene.isDisposed) return;
    const looks: PaneLook[] = windowPanes(map).map((p, k) => ({ index: map.entities.length + k, box: p.box, kind: p.kind, tint: GLASS.tint, framed: false, start: 100 }));
    if (!opts.windowsOnly) {
      for (const p of glassBlocks(map)) {
        if (p.entity === undefined || opts.skip?.has(p.id)) continue;
        const e = map.entities[p.entity];
        looks.push({ index: p.entity, box: p.box, kind: p.kind, tint: p.tint ?? GLASS.tint, framed: false, start: e?.kind === 'block' && e.startHidden ? 0 : 100 });
      }
      map.entities.forEach((e, i) => {
        if (e.kind === 'destructible' && e.model === 'glass') looks.push({ index: i, box: destructibleBox(e), kind: 'pane', tint: GLASS.tint, framed: true, start: 100 });
      });
    }
    if (!looks.length) return;
    // Group by tint and 32 m square.
    const groups = new Map<string, PaneLook[]>();
    for (const l of looks) {
      const key = `${l.tint}|${Math.floor(l.box.center.x / CHUNK)}|${Math.floor(l.box.center.z / CHUNK)}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = []));
      g.push(l);
    }
    for (const [key, list] of groups) {
      const mesh = CreateBox(`glass_panes_${this.chunks.length}`, { size: 1 }, this.scene);
      mesh.material = glassMaterial(this.scene, list[0]!.tint);
      mesh.isPickable = false;
      mesh.hasVertexAlpha = true;
      // Glass catches no shadow-map work (atmosphere leaves see-through things out of casting anyway).
      mesh.receiveShadows = false;
      mesh.metadata = { glassChunk: key };
      const chunk: Chunk = { mesh, matrices: new Float32Array(list.length * 16), colors: new Float32Array(list.length * 4), count: list.length };
      list.forEach((l, slot) => {
        const pane: Pane = { ...l, chunk, slot, frame: -1, shown: l.start };
        this.panes.push(pane);
        this.byIndex.set(l.index, pane);
      });
      this.chunks.push(chunk);
    }
    const framed = this.panes.filter((p) => p.framed);
    if (framed.length) {
      const mesh = CreateBox('glass_frames', { size: 1 }, this.scene);
      const fm = new StandardMaterial('glassFrameMat', this.scene);
      fm.diffuseColor = Color3.FromHexString('#d9d6cf');
      fm.specularColor = new Color3(0.15, 0.15, 0.15);
      mesh.material = fm;
      mesh.isPickable = false;
      this.frames = { mesh, matrices: new Float32Array(framed.length * 2 * 16) };
      framed.forEach((p, k) => (p.frame = k * 2));
    }
    for (const p of this.panes) this.write(p, p.start);
    for (const c of this.chunks) {
      c.mesh.thinInstanceSetBuffer('matrix', c.matrices, 16, false);
      c.mesh.thinInstanceSetBuffer('color', c.colors, 4, false);
      c.mesh.thinInstanceRefreshBoundingInfo(false);
    }
    if (this.frames) {
      this.frames.mesh.thinInstanceSetBuffer('matrix', this.frames.matrices, 16, false);
      this.frames.mesh.thinInstanceRefreshBoundingInfo(false);
    }
  }

  /** The rotation of a pane's box. */
  private static turn(box: OBox): Quaternion {
    return box.rot ? new Quaternion(box.rot.x, box.rot.y, box.rot.z, box.rot.w) : Quaternion.RotationYawPitchRoll(box.yaw, 0, 0);
  }

  private write(p: Pane, health: number): void {
    const gone = health <= 0;
    const b = p.box;
    const q = GlassVisuals.turn(b);
    const at = new Vector3(b.center.x, b.center.y, b.center.z);
    Matrix.ComposeToRef(gone ? Vector3.ZeroReadOnly : new Vector3(b.half.x * 2, b.half.y * 2, b.half.z * 2), q, at, tmp);
    tmp.copyToArray(p.chunk.matrices, p.slot * 16);
    // Bulletproof glass frosts as it cracks: whiter and more opaque.
    const c = gone || p.kind !== 'reinforced' ? 0 : glassCracks(health);
    p.chunk.colors.set([1 + c * 0.5, 1 + c * 0.5, 1 + c * 0.5, 1 + c * 2.2], p.slot * 4);
    if (this.frames && p.frame >= 0) {
      // The cross frame of a Window pane: a mullion and a transom through its middle.
      const thick = b.half.z * 2 + 0.02;
      Matrix.ComposeToRef(gone ? Vector3.ZeroReadOnly : new Vector3(0.05, b.half.y * 2, thick), q, at, tmp);
      tmp.copyToArray(this.frames.matrices, p.frame * 16);
      Matrix.ComposeToRef(gone ? Vector3.ZeroReadOnly : new Vector3(b.half.x * 2, 0.05, thick), q, at, tmp);
      tmp.copyToArray(this.frames.matrices, (p.frame + 1) * 16);
    }
  }

  /** Follow replicated pane states (scenario index -> [health %, …]). */
  apply(states: ReadonlyMap<number, readonly [number, number]>): void {
    if (!this.panes.length) return;
    const dirty = new Set<Chunk>();
    let frames = false;
    for (const p of this.panes) {
      const s = states.get(p.index);
      const health = s ? s[0] : p.start;
      if (health === p.shown) continue;
      // Whole again (a new round, a respawn) or gone: its cracks go with it.
      if (health <= 0 || health >= 100) this.clearCracks(p.index);
      p.shown = health;
      this.write(p, health);
      dirty.add(p.chunk);
      frames ||= p.frame >= 0;
    }
    for (const c of dirty) {
      c.mesh.thinInstanceBufferUpdated('matrix');
      c.mesh.thinInstanceBufferUpdated('color');
    }
    if (frames) this.frames!.mesh.thinInstanceBufferUpdated('matrix');
  }

  /** The pane at a scenario index (window glass, a glass block or a Window pane), if it is drawn here. */
  paneAt(index: number): PaneLook | null {
    return this.byIndex.get(index) ?? null;
  }

  /**
   * A round from `from` that stopped at `to`: if it stopped on a standing
   * pane, leave a star crack there and return the point and the pane's
   * normal (facing the shooter); null when it ended somewhere else.
   */
  strike(from: Vec3, to: Vec3): { point: Vec3; normal: Vec3 } | null {
    if (!this.panes.length) return null;
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 0.05) return null;
    const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
    let best: Pane | null = null;
    let bestT = Infinity;
    for (const p of this.panes) {
      if (p.shown <= 0) continue;
      const t = rayOBox(from, dir, len + 0.2, p.box);
      if (t === null || t < len - 0.25 || t >= bestT) continue;
      best = p;
      bestT = t;
    }
    if (!best) return null;
    const point = { x: from.x + dir.x * bestT, y: from.y + dir.y * bestT, z: from.z + dir.z * bestT };
    // The pane's thin axis, turned to face the shooter.
    const q = GlassVisuals.turn(best.box);
    const h = best.box.half;
    const axis = h.z <= h.x && h.z <= h.y ? new Vector3(0, 0, 1) : h.x <= h.y ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const n = axis.rotateByQuaternionToRef(q, new Vector3());
    if (n.x * dir.x + n.y * dir.y + n.z * dir.z > 0) n.scaleInPlace(-1);
    this.addCrack(best.index, point, n);
    return { point, normal: { x: n.x, y: n.y, z: n.z } };
  }

  private addCrack(pane: number, at: Vec3, n: Vector3): void {
    if (!this.cracks) {
      const mesh = CreatePlane('glass_cracks', { size: 1, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
      const m = new StandardMaterial('glassCrackMat', this.scene);
      m.diffuseTexture = crackTexture(this.scene);
      m.useAlphaFromDiffuseTexture = true;
      m.diffuseColor = new Color3(0.95, 0.97, 0.98);
      m.emissiveColor = new Color3(0.25, 0.27, 0.28);
      m.specularColor = new Color3(0.6, 0.6, 0.6);
      m.specularPower = 128;
      m.zOffset = -2;
      m.backFaceCulling = false;
      m.disableDepthWrite = true;
      mesh.material = m;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      const matrices = new Float32Array(MAX_CRACKS * 16);
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      mesh.thinInstanceCount = 0;
      this.cracks = { mesh, matrices, list: [] };
    }
    const c = this.cracks;
    // The plane faces -z: turn it to the pane's normal, with a random twist.
    const q = new Quaternion();
    Quaternion.FromUnitVectorsToRef(new Vector3(0, 0, -1), n, q);
    q.multiplyInPlace(Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.random() * Math.PI * 2));
    const s = 0.3 + Math.random() * 0.22;
    const matrix = new Float32Array(16);
    Matrix.ComposeToRef(new Vector3(s, s, s), q, new Vector3(at.x + n.x * 0.004, at.y + n.y * 0.004, at.z + n.z * 0.004), tmp);
    tmp.copyToArray(matrix);
    // Full: the oldest crack goes.
    if (c.list.length >= MAX_CRACKS) c.list.shift();
    c.list.push({ pane, matrix });
    this.packCracks();
  }

  /** Write the live cracks to the instance buffer, in order. */
  private packCracks(): void {
    const c = this.cracks!;
    c.list.forEach((k, i) => c.matrices.set(k.matrix, i * 16));
    c.mesh.thinInstanceCount = c.list.length;
    c.mesh.thinInstanceBufferUpdated('matrix');
  }

  /** Remove a pane's cracks. */
  private clearCracks(pane: number): void {
    const c = this.cracks;
    if (!c) return;
    const before = c.list.length;
    c.list = c.list.filter((k) => k.pane !== pane);
    if (c.list.length !== before) this.packCracks();
  }

  /** How many panes are standing (automation). */
  standing(): number {
    return this.panes.filter((p) => p.shown > 0).length;
  }

  /** Panes drawn here, and crack decals showing (automation). */
  get counts(): { panes: number; chunks: number; cracks: number } {
    return { panes: this.panes.length, chunks: this.chunks.length, cracks: this.cracks?.list.length ?? 0 };
  }

  dispose(): void {
    for (const c of this.chunks) c.mesh.dispose(false, false);
    this.chunks = [];
    this.frames?.mesh.material?.dispose();
    this.frames?.mesh.dispose();
    this.frames = null;
    this.cracks?.mesh.material?.dispose();
    this.cracks?.mesh.dispose();
    this.cracks = null;
    this.panes = [];
    this.byIndex.clear();
  }
}

const tmp = new Matrix();
