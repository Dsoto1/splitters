import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TERRAIN_MATERIALS, boxBounds, cellFoliage, getProp, terrainHeightAt, type TerrainData, type TerrainMaterial, type WorldBox } from '@tiletrigger/shared';
import type { ModelLibrary } from './content/models.ts';
import { loadGraphicsQuality } from './game/atmosphere.ts';

/** Plants by the job they do: carpet grass, taller tufts, flowers, low shrubs, bushes, and pebbles on bare ground. */
const KINDS = {
  grass: ['prop.grass_patch', 'prop.grass_leafy'],
  tall: ['prop.grass_tall'],
  flower: ['prop.flower_red', 'prop.flower_yellow', 'prop.flower_purple'],
  shrub: ['prop.bush_small', 'prop.fern', 'prop.plant_low'],
  bush: ['prop.bush', 'prop.bush_leafy'],
  pebbles: ['prop.stones'],
} as const;
type Kind = keyof typeof KINDS;

/**
 * How many of each kind a cell grows (fractions are chances), by its cover
 * level 0–4. Soft ground grows grass and flowers; sand a few shrubs; stone,
 * gravel and snow only pebbles.
 */
function recipe(material: TerrainMaterial, level: number): Partial<Record<Kind, number>> {
  if (level <= 0) return {};
  switch (material) {
    case 'grass':
    case 'moss':
    case 'dirt':
    case 'mud':
      return [
        {},
        { grass: 0.7 },
        { grass: 1.2, tall: 0.25, flower: 0.08 },
        { grass: 1.6, tall: 0.5, flower: 0.4, shrub: 0.08 },
        { grass: 2, tall: 0.8, flower: 0.5, shrub: 0.3, bush: 0.12 },
      ][level]!;
    case 'sand':
      return [{}, { shrub: 0.08 }, { shrub: 0.2, pebbles: 0.1 }, { shrub: 0.35, grass: 0.3 }, { shrub: 0.5, grass: 0.6, bush: 0.08 }][level]!;
    default:
      return [{}, { pebbles: 0.1 }, { pebbles: 0.25 }, { pebbles: 0.35, shrub: 0.05 }, { pebbles: 0.4, shrub: 0.15 }][level]!;
  }
}

/** Draw distance (m) per kind: grass pops in close, bushes further out. */
const RANGE: Record<Kind, number> = { grass: 60, tall: 70, flower: 70, shrub: 90, pebbles: 50, bush: 130 };
/** Decoration only, thinned by distance and graphics setting; shrubs and bushes always grow in full. */
const THINNED: ReadonlySet<Kind> = new Set<Kind>(['grass', 'tall', 'flower', 'pebbles']);
/**
 * Graphics setting: how far thinned kinds reach (share of RANGE), how many
 * grow close by, and how many are left at the far edge (fading out between
 * FULL_NEAR of the range and its end). Grass was most of the triangles on a
 * meadow map: 0.6 M at 60 m on Norman Shores.
 */
const DETAIL: Record<string, { range: number; density: number; far: number }> = {
  low: { range: 0.5, density: 0.35, far: 0.5 },
  medium: { range: 0.8, density: 0.75, far: 0.3 },
  high: { range: 1, density: 1, far: 0.35 },
};
const FULL_NEAR = 0.35;
const CHUNK = 32;
const FOLIAGE_TINT = new Color3(0.82, 0.86, 0.42);

interface Chunk {
  x: number;
  z: number;
  kind: Kind;
  /** Each mesh and how many plants its buffer holds (they are shuffled, so drawing the first n thins evenly). */
  meshes: { mesh: Mesh; total: number }[];
  /** Plants drawn now, as a share of the chunk's (0: hidden). */
  shown: number;
}

/**
 * Grass, flowers and bushes growing on the terrain from its foliage layer
 * (painted in MapMaker, or chosen from each cell's material). Drawn only, and
 * the same on every machine (placement is seeded by the map). Plants are
 * instanced in 32 m chunks and drawn only near the camera.
 */
export class FoliageVisuals {
  private chunks: Chunk[] = [];
  private bases: Mesh[] = [];
  private materials: StandardMaterial[] = [];
  private build = 0;
  private readonly detail = DETAIL[loadGraphicsQuality()] ?? DETAIL.high!;
  /** Where the camera was at the last update (chunks are only looked at again after it moves a metre). */
  private lastX = Infinity;
  private lastZ = Infinity;

  constructor(
    private readonly scene: Scene,
    private readonly models: ModelLibrary,
  ) {}

  /** (Re)grow everything for this terrain; `boxes` are floors and walls plants must not poke through. */
  async grow(t: TerrainData | null, boxes: readonly WorldBox[], seed: string): Promise<void> {
    const build = ++this.build;
    this.clear();
    if (!t) return;
    const placements = place(t, boxes, seed);
    if (!placements.size) return;
    const geometry = new Map<string, Mesh[]>();
    await Promise.all(
      [...new Set([...placements.values()].flatMap((byModel) => [...byModel.keys()]))].map(async (model) => {
        const def = getProp(model);
        if (def) geometry.set(model, await this.bake(def.file, model));
      }),
    );
    if (build !== this.build) {
      for (const list of geometry.values()) for (const m of list) m.dispose();
      return;
    }
    for (const list of geometry.values()) this.bases.push(...list);
    for (const [key, byModel] of placements) {
      const [kind, cx, cz] = key.split(':') as [Kind, string, string];
      const chunk: Chunk = { x: (+cx + 0.5) * CHUNK, z: (+cz + 0.5) * CHUNK, kind, meshes: [], shown: 1 };
      for (const [model, matrices] of byModel) {
        const buf = shuffled(matrices, key + model);
        for (const base of geometry.get(model) ?? []) {
          // Instance buffers live on the geometry, so each chunk needs its own copy (a few hundred vertices).
          const mesh = base.clone(`${base.name}_${key}`, null, true)!;
          mesh.makeGeometryUnique();
          mesh.setEnabled(true);
          mesh.thinInstanceSetBuffer('matrix', buf, 16, true);
          // Bounds over every plant in the chunk, so the chunk is culled when out of view.
          mesh.thinInstanceRefreshBoundingInfo(false);
          mesh.freezeWorldMatrix();
          mesh.doNotSyncBoundingInfo = true;
          chunk.meshes.push({ mesh, total: buf.length / 16 });
        }
      }
      this.chunks.push(chunk);
    }
    this.lastX = this.lastZ = Infinity;
  }

  /**
   * Show the chunks near the camera. Call every frame (cheap: nothing to do
   * until the camera has moved a metre). Decorative kinds thin out with
   * distance: all of them (times the setting's density) up to FULL_NEAR of
   * their range, then fewer and fewer to the setting's far share at its end.
   */
  update(camera: Vector3): void {
    if ((camera.x - this.lastX) ** 2 + (camera.z - this.lastZ) ** 2 < 1) return;
    this.lastX = camera.x;
    this.lastZ = camera.z;
    const d = this.detail;
    for (const c of this.chunks) {
      const thin = THINNED.has(c.kind);
      const range = RANGE[c.kind] * (thin ? d.range : 1);
      // Distance to the chunk's nearest edge, roughly (its centre less half a diagonal).
      const dist = Math.max(0, Math.hypot(c.x - camera.x, c.z - camera.z) - CHUNK * 0.71);
      let shown = dist < range ? 1 : 0;
      if (shown && thin) {
        const t = Math.max(0, (dist / range - FULL_NEAR) / (1 - FULL_NEAR));
        // In steps of an eighth, so buffers are recounted only now and then.
        shown = Math.max(1, Math.round(d.density * (1 - t * (1 - d.far)) * 8)) / 8;
      }
      if (shown === c.shown) continue;
      c.shown = shown;
      for (const { mesh, total } of c.meshes) {
        mesh.setEnabled(shown > 0);
        if (shown > 0) mesh.thinInstanceCount = Math.max(1, Math.round(total * shown));
      }
    }
  }

  dispose(): void {
    this.build++;
    this.clear();
  }

  private clear(): void {
    for (const c of this.chunks) for (const m of c.meshes) m.mesh.dispose();
    for (const m of this.bases) m.dispose();
    for (const m of this.materials) m.dispose();
    this.chunks = [];
    this.bases = [];
    this.materials = [];
  }

  /** The model's meshes with its own transform baked in, hidden, ready to be cloned per chunk. */
  private async bake(file: string, model: string): Promise<Mesh[]> {
    const container = await this.models.load(file);
    const inst = container.instantiateModelsToScene((n) => `foliage_${model}_${n}`, false, { doNotInstantiate: true });
    const out: Mesh[] = [];
    for (const root of inst.rootNodes) {
      root.computeWorldMatrix(true);
      for (const m of root.getChildMeshes(false)) {
        if (!(m instanceof Mesh) || !m.getTotalVertices()) continue;
        m.computeWorldMatrix(true);
        m.setParent(null);
        // Its own copy of the vertices: the model's are shared with placed props.
        m.makeGeometryUnique();
        m.bakeCurrentTransformIntoVertices();
        m.isPickable = false;
        m.setEnabled(false);
        // A plain lambert material instead of the model's PBR one (most of a plant's cost is its
        // pixels, and thousands of them cover the ground), no specular, few lights. Kenney's greens
        // are teal; pull them toward the ground's olive so plants sit in the grass.
        if (m.material && 'albedoColor' in m.material) {
          const pbr = m.material as PBRMaterial;
          const mat = new StandardMaterial(`${pbr.name}_foliage`, this.scene);
          mat.diffuseColor = pbr.albedoColor.multiply(FOLIAGE_TINT);
          if (pbr.albedoTexture) mat.diffuseTexture = pbr.albedoTexture as BaseTexture;
          mat.specularColor = Color3.Black();
          mat.backFaceCulling = pbr.backFaceCulling;
          mat.maxSimultaneousLights = 2;
          if (pbr.albedoTexture?.hasAlpha || pbr.needAlphaTesting()) {
            // Cut-outs are alpha-tested, never blended (no sorting, no overdraw blending).
            mat.useAlphaFromDiffuseTexture = false;
            mat.transparencyMode = 1;
            if (mat.diffuseTexture) mat.diffuseTexture.hasAlpha = true;
          }
          m.material = mat;
          this.materials.push(mat);
        }
        out.push(m);
      }
      root.dispose();
    }
    return out;
  }
}

/** Every plant's model and matrix, grouped by `kind:chunkX:chunkZ`. Deterministic for a given terrain and seed. */
export function place(t: TerrainData, boxes: readonly WorldBox[], seed: string): Map<string, Map<string, number[]>> {
  const out = new Map<string, Map<string, number[]>>();
  const rand = seeded(seed);
  const covered = coverage(boxes);
  const w = t.cols - 1;
  const m = new Matrix();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  for (let i = 0; i < t.materials.length; i++) {
    const level = cellFoliage(t, i);
    if (!level) continue;
    const material = TERRAIN_MATERIALS[t.materials[i]!] ?? 'grass';
    const c = i % w;
    const r = Math.floor(i / w);
    for (const [kind, amount] of Object.entries(recipe(material, level)) as [Kind, number][]) {
      let n = Math.floor(amount) + (rand() < amount % 1 ? 1 : 0);
      while (n-- > 0) {
        const x = t.origin[0] + (c + rand()) * t.spacing;
        const z = t.origin[1] + (r + rand()) * t.spacing;
        const y = terrainHeightAt(t, x, z);
        const models = KINDS[kind];
        const model = models[Math.floor(rand() * models.length)]!;
        const yaw = rand() * Math.PI * 2;
        // Kept low (ankle to shin height) so plants never hide a player.
        const size = kind === 'grass' ? 0.45 + rand() * 0.35 : kind === 'tall' ? 0.5 + rand() * 0.25 : kind === 'bush' ? 0.7 + rand() * 0.4 : 0.6 + rand() * 0.3;
        if (y === null || covered(x, y, z)) continue;
        // Steep slopes (cliff faces) stay bare.
        const dy = Math.abs((terrainHeightAt(t, x + 0.5, z) ?? y) - y) + Math.abs((terrainHeightAt(t, x, z + 0.5) ?? y) - y);
        if (dy > 0.7) continue;
        Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, q);
        s.setAll(size);
        p.set(x, y - 0.03, z);
        Matrix.ComposeToRef(s, q, p, m);
        const key = `${kind}:${Math.floor(x / CHUNK)}:${Math.floor(z / CHUNK)}`;
        let byModel = out.get(key);
        if (!byModel) out.set(key, (byModel = new Map()));
        let list = byModel.get(model);
        if (!list) byModel.set(model, (list = []));
        list.push(...m.asArray());
      }
    }
  }
  return out;
}

/** A chunk's plant matrices in a seeded random order, so drawing only the first n thins them evenly. */
function shuffled(matrices: readonly number[], seed: string): Float32Array {
  const n = matrices.length / 16;
  const order = Array.from({ length: n }, (_, i) => i);
  const rand = seeded(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const out = new Float32Array(matrices.length);
  order.forEach((from, to) => {
    for (let k = 0; k < 16; k++) out[to * 16 + k] = matrices[from * 16 + k]!;
  });
  return out;
}

/** Whether a floor, wall or block sits on the ground at a point (plants there would poke through). */
function coverage(boxes: readonly WorldBox[]): (x: number, y: number, z: number) => boolean {
  const cell = 8;
  const grid = new Map<string, { min: [number, number, number]; max: [number, number, number] }[]>();
  for (const b of boxes) {
    if (b.kind === 'barrier') continue;
    const bb = boxBounds(b);
    for (let gx = Math.floor(bb.min[0] / cell); gx <= Math.floor(bb.max[0] / cell); gx++) {
      for (let gz = Math.floor(bb.min[2] / cell); gz <= Math.floor(bb.max[2] / cell); gz++) {
        const k = `${gx}:${gz}`;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(bb);
      }
    }
  }
  return (x, y, z) => {
    for (const bb of grid.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`) ?? []) {
      if (x >= bb.min[0] - 0.3 && x <= bb.max[0] + 0.3 && z >= bb.min[2] - 0.3 && z <= bb.max[2] + 0.3 && bb.min[1] < y + 1 && bb.max[1] > y - 0.5) return true;
    }
    return false;
  };
}

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
