import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { envModelFile, envTilts, getEnvSpecies, groundNormal, terrainHeightAt, type EnvSpeciesData, type PropEntity, type TerrainData } from '@tiletrigger/shared';
import { EnvMaterials, ENV_TIERS, type EnvTier } from './envMaterials.ts';
import { loadEnvModel, partMesh, type EnvModel } from './envModels.ts';

/**
 * The environment renderer (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §9.3), behind `?env=1` until Phase 4: every placed
 * `env.*` species drawn as thin instances, batched by (species variant, level of detail, material, sector), so
 * each batch is culled on its own and there is never a map-wide batch. Sectors grow with the level (64 m for the
 * nearest, twice as wide a level: `sectorSize`): far copies are small on screen and few to a square, so a fine grid
 * made a draw (and a shadow and light-shaft draw) for every one or two of them (St. John's 139 trees were 133 batches). Each copy picks its level of detail from its
 * distance to the camera (hysteresis ±10 %) whenever the camera has moved a metre; a batch's buffer is rebuilt only
 * when a copy joins or leaves it. Babylon's mesh LOD is not used (it doesn't see thin instances).
 *
 * Gameplay rule: no graphics tier removes a `cover` or `blocking` species. They are never culled by distance (the
 * farthest level is a two-card stand-in, then fog); tiers only move where levels change. Ground cover (grass) is
 * grown by foliage.ts from the terrain's painted plants, thinned there.
 */

/** Side of the squares the nearest copies are batched by (m); the border's and backdrop's scatters use bigger ones (fewer batches). */
const SECTOR = 64;
/** Each level's squares are this many times as wide as the level before's, up to MAX_GROWTH times the nearest's. */
const GROWTH = 2;
const MAX_GROWTH = 8;

/** Side of the squares a level's copies are batched by: the nearest level's `sector`, doubling a level, at most 8 times. */
export function sectorSize(sector: number, level: number): number {
  return sector * Math.min(MAX_GROWTH, GROWTH ** Math.max(0, level));
}
/** A copy changes level only once it is this share past the boundary (no flicker at the edge). */
const HYSTERESIS = 0.1;

interface Copy {
  matrix: Float32Array;
  x: number;
  y: number;
  z: number;
  level: number;
}

/** The copies of one species variant. */
interface Group {
  file: string;
  copies: Copy[];
}

/** The meshes (one per part) drawing one species variant's copies at one level in one square of that level's size. */
interface Batch {
  level: number;
  /** Every copy of the variant in the square, at whatever level (those at this level are drawn). */
  copies: Copy[];
  meshes: Mesh[];
  buffer: Float32Array;
  dirty: boolean;
}

export interface EnvStats {
  batches: number;
  drawnBatches: number;
  copies: number;
  /** Copies drawn at each level (nearest first; the last is the stand-in where there is one). */
  perLevel: number[];
  /** Copies by their species' lightest level (a forced level stops there: grass has one level, shrubs three). */
  lastLevel: number[];
  triangles: number;
}

export class EnvironmentVisuals {
  readonly materials: EnvMaterials;
  private models = new Map<string, Promise<EnvModel | null>>();
  private loaded = new Map<string, EnvModel>();
  private templates = new Map<string, Mesh[][]>();
  private groups: Group[] = [];
  /** Batches by `<file>|<level>|<square>`, made on first use. */
  private batches = new Map<string, Batch>();
  private build = 0;
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastY = Infinity;
  private forced: number | null = null;
  private tier: EnvTier;
  private visible = true;
  private readonly sector: number;

  constructor(
    private readonly scene: Scene,
    quality: string,
    options: { sector?: number } = {},
  ) {
    this.tier = ENV_TIERS[quality] ?? ENV_TIERS.medium!;
    this.materials = new EnvMaterials(scene, this.tier);
    this.sector = options.sector ?? SECTOR;
  }

  /** Show or hide every copy (the bench's border-off comparison). */
  setVisible(on: boolean): void {
    this.visible = on;
    for (const b of this.batches.values()) for (const m of b.meshes) m.isVisible = on;
  }

  /** Whether a placement is drawn here (an env species), not as a prop node. */
  static draws(e: PropEntity): boolean {
    return !!getEnvSpecies(e.model);
  }

  /** (Re)build for these placements. Resolves when every model is in and drawn. */
  async setPlacements(entities: readonly PropEntity[], terrain: TerrainData | null): Promise<void> {
    const build = ++this.build;
    this.clearBatches();
    const byFile = new Map<string, Group>();
    for (const e of entities) {
      const species = getEnvSpecies(e.model);
      if (!species) continue;
      const file = envModelFile(e.model, e.variant)!;
      const matrix = placementMatrix(e, species, terrain);
      let g = byFile.get(file);
      if (!g) byFile.set(file, (g = { file, copies: [] }));
      g.copies.push({ matrix, x: e.position[0], y: e.position[1], z: e.position[2], level: -1 });
    }
    await Promise.all([...byFile.keys()].map((f) => this.model(f)));
    if (build !== this.build) return;
    this.groups = [...byFile.values()].filter((g) => this.loaded.has(g.file));
    this.lastX = this.lastY = this.lastZ = Infinity;
  }

  private model(file: string): Promise<EnvModel | null> {
    let p = this.models.get(file);
    if (!p) {
      p = loadEnvModel(this.scene, file).then(
        (m) => {
          this.loaded.set(file, m);
          // One hidden template per level and part, cloned per batch.
          this.templates.set(
            file,
            m.levels.map((l, li) => l.parts.map((part, pi) => partMesh(this.scene, `env_tpl_${file}_${li}_${pi}`, part, this.materials))),
          );
          return m;
        },
        (e: unknown) => {
          console.warn(`environment: ${file} failed to load`, e);
          return null;
        },
      );
      this.models.set(file, p);
    }
    return p;
  }

  /** Every level from `level` on (envlab: see one level everywhere); null for distance as usual. */
  forceLevel(level: number | null): void {
    this.forced = level;
    this.lastX = Infinity;
  }

  setTier(quality: string): void {
    this.tier = ENV_TIERS[quality] ?? this.tier;
    this.materials.setWind(this.tier.wind);
    this.lastX = Infinity;
  }

  get currentTier(): EnvTier {
    return this.tier;
  }

  /** Pick each copy's level from the camera. Cheap when the camera hasn't moved a metre. */
  update(camera: Vector3): void {
    if ((camera.x - this.lastX) ** 2 + (camera.y - this.lastY) ** 2 + (camera.z - this.lastZ) ** 2 < 1) return;
    this.lastX = camera.x;
    this.lastY = camera.y;
    this.lastZ = camera.z;
    const scale = this.tier.lodScale;
    for (const g of this.groups) {
      const m = this.loaded.get(g.file)!;
      const n = m.levels.length;
      for (const c of g.copies) {
        let level: number;
        if (this.forced !== null) level = Math.min(n - 1, this.forced);
        else {
          const d = Math.hypot(c.x - camera.x, c.y - camera.y, c.z - camera.z) / scale;
          level = 0;
          for (let i = 1; i < n; i++) if (d >= m.levels[i]!.distance) level = i;
          // Hysteresis: stay at the old level until clearly past the boundary between them.
          if (c.level >= 0 && level !== c.level) {
            const edge = m.levels[Math.max(level, c.level)]!.distance;
            if (Math.abs(d - edge) < edge * HYSTERESIS) level = c.level;
          }
        }
        if (level === c.level) continue;
        if (c.level >= 0) this.dirty(this.batch(g, c.level, c));
        this.dirty(this.batch(g, level, c));
        c.level = level;
      }
    }
    for (const b of this.changed.splice(0)) {
      b.dirty = false;
      let count = 0;
      for (const c of b.copies) if (c.level === b.level) b.buffer.set(c.matrix, 16 * count++);
      for (const mesh of b.meshes) {
        mesh.setEnabled(count > 0);
        if (!count) continue;
        mesh.thinInstanceCount = count;
        mesh.thinInstanceBufferUpdated('matrix');
        // Bounds over the copies drawn, so the batch is culled on its own.
        mesh.thinInstanceRefreshBoundingInfo(false);
      }
    }
  }

  /** Batches a copy joined or left this update. */
  private readonly changed: Batch[] = [];

  private dirty(b: Batch): void {
    if (b.dirty) return;
    b.dirty = true;
    this.changed.push(b);
  }

  /** The batch drawing copy `c` of group `g` at `level` (made on first use: one clone of each part's template). */
  private batch(g: Group, level: number, c: Copy): Batch {
    const size = sectorSize(this.sector, level);
    const sx = Math.floor(c.x / size);
    const sz = Math.floor(c.z / size);
    const sector = `${sx}:${sz}`;
    const key = `${g.file}|${level}|${sector}`;
    let b = this.batches.get(key);
    if (b) return b;
    const copies = g.copies.filter((o) => Math.floor(o.x / size) === sx && Math.floor(o.z / size) === sz);
    const buffer = new Float32Array(copies.length * 16);
    const species = g.file.slice(4, -4);
    const far = level >= Math.max(2, (this.loaded.get(g.file)?.levels.length ?? 0) - 1);
    const meshes = (this.templates.get(g.file)?.[level] ?? []).map((tpl, pi) => {
      // Instance buffers live on the geometry: each batch has its own copy.
      const mesh = tpl.clone(`env_${species}_l${level}_p${pi}_${sector}`, null, true)!;
      mesh.makeGeometryUnique();
      mesh.thinInstanceSetBuffer('matrix', buffer, 16, false);
      mesh.freezeWorldMatrix();
      mesh.doNotSyncBoundingInfo = true;
      mesh.isPickable = false;
      mesh.isVisible = this.visible;
      // Light levels and the stand-in cast no shadow (a far shadow is a smudge; near levels cast).
      if (far) mesh.metadata = { ...(mesh.metadata as object | null), castsNoShadow: true };
      return mesh;
    });
    b = { level, copies, meshes, buffer, dirty: false };
    this.batches.set(key, b);
    return b;
  }

  /** Counts for diagnostics (F3, client-perf.mjs groups meshes named env_*). */
  stats(): EnvStats {
    const perLevel: number[] = [];
    const lastLevel: number[] = [];
    let batches = 0;
    let drawn = 0;
    let copies = 0;
    let triangles = 0;
    for (const g of this.groups) {
      const m = this.loaded.get(g.file)!;
      copies += g.copies.length;
      const last = m.levels.length - 1;
      lastLevel[last] = (lastLevel[last] ?? 0) + g.copies.length;
      for (const c of g.copies) {
        if (c.level < 0) continue;
        perLevel[c.level] = (perLevel[c.level] ?? 0) + 1;
        triangles += m.triangles[c.level] ?? 0;
      }
    }
    for (const b of this.batches.values()) {
      batches += b.meshes.length;
      drawn += b.meshes.filter((x) => x.isEnabled() && x.isVisible).length;
    }
    return { batches, drawnBatches: drawn, copies, perLevel: [...perLevel].map((v) => v ?? 0), lastLevel: [...lastLevel].map((v) => v ?? 0), triangles };
  }

  private clearBatches(): void {
    for (const b of this.batches.values()) for (const m of b.meshes) m.dispose();
    this.batches.clear();
    this.changed.length = 0;
    this.groups = [];
  }

  dispose(): void {
    this.build++;
    this.clearBatches();
    for (const list of this.templates.values()) for (const l of list) for (const m of l) m.dispose();
    this.templates.clear();
    this.materials.dispose();
  }
}

const UP = new Vector3(0, 1, 0);

/**
 * A placement's matrix: scale, yaw (like a mesh's rotation.y: local +Z goes to (sin, cos), the same turn as its
 * collision shapes), position. Plants lean with the ground (drawn only); anything that collides stands upright as
 * its collision does.
 */
export function placementMatrix(e: PropEntity, species: EnvSpeciesData, terrain: TerrainData | null): Float32Array {
  const yaw = Quaternion.RotationAxis(UP, e.yaw);
  let rot = yaw;
  if (terrain && envTilts(e.model)) {
    const ground = terrainHeightAt(terrain, e.position[0], e.position[2]);
    if (ground !== null && Math.abs(e.position[1] - ground) < 0.6) {
      const n = groundNormal(terrain, e.position[0], e.position[2], Math.max(0.4, species.variants[0]!.size[0] * e.scale * 0.5));
      if (n && n.y < 0.9995) {
        const lean = new Quaternion();
        Quaternion.FromUnitVectorsToRef(UP, new Vector3(n.x, n.y, n.z), lean);
        rot = lean.multiply(yaw);
      }
    }
  }
  const m = Matrix.Compose(new Vector3(e.scale, e.scale, e.scale), rot, new Vector3(e.position[0], e.position[1], e.position[2]));
  return Float32Array.from(m.asArray());
}
