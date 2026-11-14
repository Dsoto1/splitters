import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { offscreenCamera, offscreenProjection } from './offscreen.ts';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 as V3 } from '@babylonjs/core/Maths/math.vector';
import type { MapDocument, MountDef, TileDefinition } from '@tiletrigger/shared';
import { ModelLibrary } from '../content/models.ts';
import type { MapStyler } from '../mapMeshes.ts';
import { loadMapContent } from '../mapContentLoader.ts';

const SIZE = 96;

/** How to frame a thumbnail: three-quarter (props) or a side-on strip (weapons, barrel to the right). */
export type ThumbView = 'three-quarter' | 'side';
export type AnyThumbView = ThumbView | 'tile' | 'piece';
/**
 * How the camera is fitted: round the sphere about the meshes' bounding box (`box`: every picture but the ones below),
 * or close on the outline the model itself draws from that side (`mesh`: a part of a larger build modelled where it
 * stands in it, the dome kit's panels, drum quarters, trims and cap, which is thin and far from square in its box).
 */
export type ThumbFit = 'box' | 'mesh';
const VIEWS: Record<AnyThumbView, { dir: [number, number, number]; width: number; height: number }> = {
  'three-quarter': { dir: [0.75, 0.6, -1], width: SIZE, height: SIZE },
  // Building pieces: steeper, so you see into rooms over their walls.
  tile: { dir: [0.55, 1.7, -0.9], width: SIZE, height: SIZE },
  // Set pieces (several cells and storeys): a little less steep, so their fronts read too.
  piece: { dir: [0.7, 1.15, -1], width: SIZE, height: SIZE },
  side: { dir: [-1, 0.12, 0], width: 128, height: 56 },
};

/** A model placed in a map thumbnail (a set piece's props): its file, where it stands, its facing and scale. */
export interface ThumbModel {
  file: string;
  position: readonly [number, number, number];
  yaw: number;
  scale: number;
}

/**
 * Small three-quarter thumbnails of our own models (props in the MapMaker),
 * rendered in a private scene into a texture, one at a time, and cached as
 * PNG data URLs. Nothing here is painted art: it is the shipped model.
 */
export class ModelThumbnails {
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly models: ModelLibrary;
  private styler?: MapStyler;
  private readonly cache = new Map<string, Promise<string>>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false;
    // Renders between the app's frames: never onto the screen (see offscreenCamera).
    this.scene.activeCamera = offscreenCamera(this.scene, 'thumbHidden');
    this.camera = new FreeCamera('thumbCam', new Vector3(0, 1, 2), this.scene);
    this.camera.minZ = 0.02;
    this.camera.freezeProjectionMatrix(offscreenProjection(engine, 0.6, 1, 0.02, 200));
    const hemi = new HemisphericLight('thumbHemi', new Vector3(0.2, 1, -0.4), this.scene);
    hemi.intensity = 0.9;
    hemi.groundColor = new Color3(0.25, 0.27, 0.32);
    const key = new DirectionalLight('thumbKey', new Vector3(-0.5, -0.8, 0.6), this.scene);
    key.intensity = 1.2;
    this.models = new ModelLibrary(this.scene);
  }

  /** A thumbnail (PNG data URL) of a model file; cached. `size` (square views) is in pixels. */
  get(path: string, view: ThumbView = 'three-quarter', size = SIZE, fit: ThumbFit = 'box'): Promise<string> {
    const key = `${view}:${size}:${fit === 'box' ? '' : `${fit}:`}${path}`;
    let p = this.cache.get(key);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.render(path, view, size, fit))) as Promise<string>;
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
    }
    return p;
  }

  /** A thumbnail of a MapMaker building piece, drawn from its real geometry in the default theme; cached. */
  getTile(def: TileDefinition, size = SIZE): Promise<string> {
    const key = `tile:${size}:${def.id}`;
    let p = this.cache.get(key);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.renderTile(def, size))) as Promise<string>;
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
    }
    return p;
  }

  /**
   * A thumbnail of a small map (a set piece in MapMaker's Set pieces tab, its parts expanded): its tiles, blocks and
   * trim as the game draws them, and `models` (its props) standing in it; cached by `key`.
   */
  getMap(key: string, doc: MapDocument, models: readonly ThumbModel[], size = SIZE): Promise<string> {
    const k = `map:${size}:${key}`;
    let p = this.cache.get(k);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.renderMap(doc, models, size))) as Promise<string>;
      p.catch(() => this.cache.delete(k));
      this.cache.set(k, p);
    }
    return p;
  }

  /**
   * A thumbnail of a vehicle or turret as the game draws it (game/mountVisuals.ts createMountNode): its body at its
   * drawn size, and a body without tires of its own with its tire model on every hub (`wheels`); cached.
   */
  getMount(def: Pick<MountDef, 'id' | 'model' | 'scale' | 'rideHeight' | 'wheels'>, size = SIZE): Promise<string> {
    if (!def.wheels) return this.get(def.model, 'three-quarter', size);
    const key = `mount:${size}:${def.id}`;
    let p = this.cache.get(key);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.renderMount(def, size))) as Promise<string>;
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
    }
    return p;
  }

  /** How many pictures have been rendered here (MapMaker's palette uses its prebuilt atlas instead where it can). */
  get rendered(): number {
    return this.cache.size;
  }

  private async renderMap(doc: MapDocument, models: readonly ThumbModel[], size: number): Promise<string> {
    const [{ MapStyler }, { buildMapGeometry }] = await Promise.all([import('../mapMeshes.ts'), loadMapContent()]);
    this.styler ??= new MapStyler(this.scene);
    const meshes = this.styler.build(doc, buildMapGeometry(doc), 'thumbmap');
    const nodes = await Promise.all(
      models.map(async (m, i) => {
        const node = await this.models.instantiate(m.file, `thumbmodel${i}`).catch((e: unknown) => {
          console.warn(`set piece picture: ${m.file} didn't load (${(e as Error)?.message ?? e})`);
          return null;
        });
        if (!node) return null;
        node.position.set(m.position[0], m.position[1], m.position[2]);
        node.rotation.y = m.yaw;
        node.scaling.setAll(m.scale);
        node.getHierarchyBoundingVectors(true);
        return node;
      }),
    );
    try {
      return await this.renderMeshes([...meshes, ...nodes.flatMap((n) => n?.getChildMeshes() ?? [])], 'piece', size, 30000);
    } finally {
      for (const m of meshes) m.setEnabled(false);
      for (const n of nodes) n?.dispose();
    }
  }

  private async renderTile(def: TileDefinition, size: number): Promise<string> {
    // Tile pictures are MapMaker's (weapon icons, on the menu, draw models): the map content is in by then.
    const [{ MapStyler }, { buildMapGeometry, newMapDocument }] = await Promise.all([import('../mapMeshes.ts'), loadMapContent()]);
    const base = newMapDocument('thumb');
    const doc = { ...base, classicStructure: { ...base.classicStructure, tiles: [{ id: 'thumb_tile', tile: def.id, x: 0, y: 0, z: 0, rotation: 0 as const }] } };
    this.styler ??= new MapStyler(this.scene);
    // A buried tunnel piece (shared map/groundBore.ts) is drawn with its cap off: from above every one is the same slab,
    // and what tells a curve from a junction is the passage under it.
    const boxes = buildMapGeometry(doc);
    const shown = def.bore ? boxes.filter((b) => !(b.kind !== 'floor' && b.min[1] >= 3.25 && b.max[1] <= 3.8 && b.max[0] - b.min[0] >= 3.4 && b.max[2] - b.min[2] >= 3.4)) : boxes;
    const meshes = this.styler.build(doc, shown, 'thumbtile');
    try {
      return await this.renderMeshes(meshes, 'tile', size);
    } finally {
      for (const m of meshes) m.setEnabled(false);
    }
  }

  private async renderMount(def: Pick<MountDef, 'model' | 'scale' | 'rideHeight' | 'wheels'>, size: number): Promise<string> {
    const { tireScale } = await import('../game/mountVisuals.ts');
    const wheels = def.wheels!;
    const body = await this.models.instantiate(def.model, 'thumbbody');
    const tires = await Promise.all(wheels.at.map((_, i) => this.models.instantiate(wheels.model, `thumbtire${i}`)));
    try {
      // The body at its drawn size, its lowest point at its ride height over the ground (y 0), as createMountNode does.
      const scale = def.scale ?? 1;
      if (scale !== 1) body.scaling.scaleInPlace(scale);
      const { min } = body.getHierarchyBoundingVectors(true);
      body.position.y -= min.y - (def.rideHeight ?? 0);
      tires.forEach((tire, i) => {
        const [x, y, z] = wheels.at[i]!;
        // The tire model is built with its axle along Z: sized to `wheels.radius` / `width`, turned across the body.
        const own = tire.getHierarchyBoundingVectors(true);
        const [across, , along] = tireScale({ radius: (own.max.y - own.min.y) / 2, width: own.max.z - own.min.z }, wheels);
        tire.scaling.set(tire.scaling.x * across, tire.scaling.y * across, tire.scaling.z * along);
        tire.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
        tire.position.set(x, y, z);
      });
      const nodes = [body, ...tires];
      for (const n of nodes) n.getHierarchyBoundingVectors(true);
      return await this.renderMeshes(nodes.flatMap((n) => n.getChildMeshes()), 'three-quarter', size);
    } finally {
      body.dispose();
      for (const t of tires) t.dispose();
    }
  }

  private async render(path: string, view: ThumbView, size: number, fit: ThumbFit): Promise<string> {
    const node = await this.models.instantiate(path, 'thumb');
    try {
      node.getHierarchyBoundingVectors(true); // brings every world matrix in the model up to date
      return await this.renderMeshes(node.getChildMeshes(), view, size, 8000, fit);
    } finally {
      node.dispose();
    }
  }

  private async renderMeshes(meshes: AbstractMesh[], view: AnyThumbView, size: number, readyMs = 8000, fit: ThumbFit = 'box'): Promise<string> {
    const { dir: d } = VIEWS[view];
    const W = view === 'side' ? VIEWS.side.width : size;
    const H = view === 'side' ? VIEWS.side.height : size;
    const aspect = W / H;
    this.camera.freezeProjectionMatrix(offscreenProjection(this.scene.getEngine(), 0.6, aspect, 0.02, 200));
    {
      let min = new V3(Infinity, Infinity, Infinity);
      let max = new V3(-Infinity, -Infinity, -Infinity);
      for (const m of meshes) {
        m.computeWorldMatrix(true);
        const b = m.getBoundingInfo().boundingBox;
        min = V3.Minimize(min, b.minimumWorld);
        max = V3.Maximize(max, b.maximumWorld);
      }
      if (!meshes.length) throw new Error('nothing to draw');
      const centre = min.add(max).scale(0.5);
      const radius = Math.max(0.2, max.subtract(min).length() / 2);
      const dir = new Vector3(d[0], d[1], d[2]).normalize();
      // Long, thin models (side view) fill the width: frame by the horizontal half-angle.
      const half = view === 'side' ? Math.atan(Math.tan(0.3) * aspect) : 0.3;
      const tight = fit === 'mesh' ? fitOutline(meshes, dir, Math.tan(0.3) * aspect, Math.tan(0.3)) : null;
      if (tight) {
        this.camera.position.copyFrom(tight.target.add(dir.scale(tight.distance * 1.08)));
        this.camera.setTarget(tight.target);
      } else {
        this.camera.position.copyFrom(centre.add(dir.scale((radius / Math.tan(half)) * 1.05)));
        this.camera.setTarget(centre);
      }
      const deadline = performance.now() + readyMs;
      while (!meshes.every((m) => m.isReady(true)) && performance.now() < deadline) {
        this.scene.render();
        await new Promise((r) => setTimeout(r, 30));
      }
      const rtt = new RenderTargetTexture('thumbRT', { width: W, height: H }, this.scene, false);
      rtt.activeCamera = this.camera;
      rtt.renderList = meshes;
      rtt.clearColor = new Color4(0, 0, 0, 0);
      this.scene.customRenderTargets.push(rtt);
      let pixels: Uint8Array | null = null;
      for (let i = 0; i < 6 && !pixels; i++) {
        this.scene.render();
        await new Promise((r) => setTimeout(r, 20));
        if (i >= 1) pixels = (await rtt.readPixels()) as Uint8Array | null;
      }
      this.scene.customRenderTargets.splice(this.scene.customRenderTargets.indexOf(rtt), 1);
      rtt.dispose();
      if (!pixels) throw new Error('thumbnail render failed');
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const g = canvas.getContext('2d')!;
      const img = g.createImageData(W, H);
      const row = W * 4;
      for (let y = 0; y < H; y++) img.data.set(pixels.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      g.putImageData(img, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }
}

/**
 * Where a camera looking along -`dir` stands to hold the meshes' own outline (every vertex, not their box) centred and
 * just inside the frame: the point it looks at and its distance from it. `tanX` and `tanY` are the tangents of the
 * frame's half-angles. Null when the meshes have no vertices to read.
 */
function fitOutline(meshes: readonly AbstractMesh[], dir: Vector3, tanX: number, tanY: number): { target: Vector3; distance: number } | null {
  // The camera's axes, as FreeCamera.setTarget lays them (up is +Y).
  const right = Vector3.Cross(Vector3.Up(), dir.scale(-1)).normalize();
  const up = Vector3.Cross(dir.scale(-1), right).normalize();
  // Every vertex as [across, up, toward the camera].
  const pts: number[] = [];
  const p = new Vector3();
  for (const m of meshes) {
    const data = m.getVerticesData('position');
    if (!data) continue;
    const world = m.getWorldMatrix();
    for (let i = 0; i + 2 < data.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(data[i]!, data[i + 1]!, data[i + 2]!, world, p);
      pts.push(Vector3.Dot(p, right), Vector3.Dot(p, up), Vector3.Dot(p, dir));
    }
  }
  if (!pts.length) return null;
  // Start on the middle of the outline as seen from far away, then settle: the distance that holds every vertex, and
  // the sideways shift that centres what the lens then shows (nearer parts spread wider).
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    x0 = Math.min(x0, pts[i]!);
    x1 = Math.max(x1, pts[i]!);
    y0 = Math.min(y0, pts[i + 1]!);
    y1 = Math.max(y1, pts[i + 1]!);
    z1 = Math.max(z1, pts[i + 2]!);
  }
  let cx = (x0 + x1) / 2;
  let cy = (y0 + y1) / 2;
  let cam = z1;
  for (let pass = 0; pass < 6; pass++) {
    cam = -Infinity;
    for (let i = 0; i < pts.length; i += 3) cam = Math.max(cam, pts[i + 2]! + Math.abs(pts[i]! - cx) / tanX, pts[i + 2]! + Math.abs(pts[i + 1]! - cy) / tanY);
    cam = Math.max(cam, z1 + 0.05);
    let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity, depth = 0;
    for (let i = 0; i < pts.length; i += 3) {
      const d = cam - pts[i + 2]!;
      const sx = (pts[i]! - cx) / d;
      const sy = (pts[i + 1]! - cy) / d;
      if (sx < l) l = sx;
      if (sx > r) r = sx;
      if (sy < b) b = sy;
      if (sy > t) t = sy;
      depth += d;
    }
    depth /= pts.length / 3;
    cx += ((l + r) / 2) * depth;
    cy += ((b + t) / 2) * depth;
  }
  // The look-at point: on the camera's line, at the vertices' middle depth.
  let za = Infinity;
  for (let i = 2; i < pts.length; i += 3) za = Math.min(za, pts[i]!);
  const zc = (za + z1) / 2;
  return { target: right.scale(cx).add(up.scale(cy)).add(dir.scale(zc)), distance: Math.max(0.1, cam - zc) };
}
