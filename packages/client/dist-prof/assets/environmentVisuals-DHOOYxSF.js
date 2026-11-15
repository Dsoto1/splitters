import { Q as Quaternion, V as Vector3, M as Matrix } from "./babylon-PnzH6wcM.js";
import { l as loadEnvModel, p as partMesh } from "./shadowGenerator-_IcnNyty.js";
import { E as ENV_TIERS, a as EnvMaterials } from "./envMaterials-BVmVluEo.js";
import { a as getEnvSpecies, e as envModelFile, c as envTilts, d as groundNormal } from "./settle-BDJE4VMF.js";
import { W as terrainHeightAt } from "./index-BAsW2uYW.js";
import "./rapier-BmnBVapV.js";
import "./thinInstanceMesh.pure-BG4P9X5v.js";
import "./scenarioDefs-BcDISE-R.js";
import "./vendor-BIr0ad6t.js";
import "./babylonFileParser.function-CbkFZ5Hm.js";
import "./materialPluginBase-Dhlt5oKE.js";
const SECTOR = 64;
const GROWTH = 2;
const MAX_GROWTH = 8;
function sectorSize(sector, level) {
  return sector * Math.min(MAX_GROWTH, GROWTH ** Math.max(0, level));
}
const HYSTERESIS = 0.1;
class EnvironmentVisuals {
  constructor(scene, quality, options = {}) {
    this.scene = scene;
    this.tier = ENV_TIERS[quality] ?? ENV_TIERS.medium;
    this.materials = new EnvMaterials(scene, this.tier);
    this.sector = options.sector ?? SECTOR;
  }
  scene;
  materials;
  models = /* @__PURE__ */ new Map();
  loaded = /* @__PURE__ */ new Map();
  templates = /* @__PURE__ */ new Map();
  groups = [];
  /** Batches by `<file>|<level>|<square>`, made on first use. */
  batches = /* @__PURE__ */ new Map();
  build = 0;
  lastX = Infinity;
  lastZ = Infinity;
  lastY = Infinity;
  forced = null;
  tier;
  visible = true;
  sector;
  /** Show or hide every copy (the bench's border-off comparison). */
  setVisible(on) {
    this.visible = on;
    for (const b of this.batches.values()) for (const m of b.meshes) m.isVisible = on;
  }
  /** Whether a placement is drawn here (an env species), not as a prop node. */
  static draws(e) {
    return !!getEnvSpecies(e.model);
  }
  /** (Re)build for these placements. Resolves when every model is in and drawn. */
  async setPlacements(entities, terrain) {
    const build = ++this.build;
    this.clearBatches();
    const byFile = /* @__PURE__ */ new Map();
    for (const e of entities) {
      const species = getEnvSpecies(e.model);
      if (!species) continue;
      const file = envModelFile(e.model, e.variant);
      const matrix = placementMatrix(e, species, terrain);
      let g = byFile.get(file);
      if (!g) byFile.set(file, g = { file, copies: [] });
      g.copies.push({ matrix, x: e.position[0], y: e.position[1], z: e.position[2], level: -1 });
    }
    await Promise.all([...byFile.keys()].map((f) => this.model(f)));
    if (build !== this.build) return;
    this.groups = [...byFile.values()].filter((g) => this.loaded.has(g.file));
    this.lastX = this.lastY = this.lastZ = Infinity;
  }
  model(file) {
    let p = this.models.get(file);
    if (!p) {
      p = loadEnvModel(this.scene, file).then(
        (m) => {
          this.loaded.set(file, m);
          this.templates.set(
            file,
            m.levels.map((l, li) => l.parts.map((part, pi) => partMesh(this.scene, `env_tpl_${file}_${li}_${pi}`, part, this.materials)))
          );
          return m;
        },
        (e) => {
          console.warn(`environment: ${file} failed to load`, e);
          return null;
        }
      );
      this.models.set(file, p);
    }
    return p;
  }
  /** Every level from `level` on (envlab: see one level everywhere); null for distance as usual. */
  forceLevel(level) {
    this.forced = level;
    this.lastX = Infinity;
  }
  setTier(quality) {
    this.tier = ENV_TIERS[quality] ?? this.tier;
    this.materials.setWind(this.tier.wind);
    this.lastX = Infinity;
  }
  get currentTier() {
    return this.tier;
  }
  /** Pick each copy's level from the camera. Cheap when the camera hasn't moved a metre. */
  update(camera) {
    if ((camera.x - this.lastX) ** 2 + (camera.y - this.lastY) ** 2 + (camera.z - this.lastZ) ** 2 < 1) return;
    this.lastX = camera.x;
    this.lastY = camera.y;
    this.lastZ = camera.z;
    const scale = this.tier.lodScale;
    for (const g of this.groups) {
      const m = this.loaded.get(g.file);
      const n = m.levels.length;
      for (const c of g.copies) {
        let level;
        if (this.forced !== null) level = Math.min(n - 1, this.forced);
        else {
          const d = Math.hypot(c.x - camera.x, c.y - camera.y, c.z - camera.z) / scale;
          level = 0;
          for (let i = 1; i < n; i++) if (d >= m.levels[i].distance) level = i;
          if (c.level >= 0 && level !== c.level) {
            const edge = m.levels[Math.max(level, c.level)].distance;
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
        mesh.thinInstanceBufferUpdated("matrix");
        mesh.thinInstanceRefreshBoundingInfo(false);
      }
    }
  }
  /** Batches a copy joined or left this update. */
  changed = [];
  dirty(b) {
    if (b.dirty) return;
    b.dirty = true;
    this.changed.push(b);
  }
  /** The batch drawing copy `c` of group `g` at `level` (made on first use: one clone of each part's template). */
  batch(g, level, c) {
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
      const mesh = tpl.clone(`env_${species}_l${level}_p${pi}_${sector}`, null, true);
      mesh.makeGeometryUnique();
      mesh.thinInstanceSetBuffer("matrix", buffer, 16, false);
      mesh.freezeWorldMatrix();
      mesh.doNotSyncBoundingInfo = true;
      mesh.isPickable = false;
      mesh.isVisible = this.visible;
      if (far) mesh.metadata = { ...mesh.metadata, castsNoShadow: true };
      return mesh;
    });
    b = { level, copies, meshes, buffer, dirty: false };
    this.batches.set(key, b);
    return b;
  }
  /** Counts for diagnostics (F3, client-perf.mjs groups meshes named env_*). */
  stats() {
    const perLevel = [];
    const lastLevel = [];
    let batches = 0;
    let drawn = 0;
    let copies = 0;
    let triangles = 0;
    for (const g of this.groups) {
      const m = this.loaded.get(g.file);
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
  clearBatches() {
    for (const b of this.batches.values()) for (const m of b.meshes) m.dispose();
    this.batches.clear();
    this.changed.length = 0;
    this.groups = [];
  }
  dispose() {
    this.build++;
    this.clearBatches();
    for (const list of this.templates.values()) for (const l of list) for (const m of l) m.dispose();
    this.templates.clear();
    this.materials.dispose();
  }
}
const UP = new Vector3(0, 1, 0);
function placementMatrix(e, species, terrain) {
  const yaw = Quaternion.RotationAxis(UP, e.yaw);
  let rot = yaw;
  if (terrain && envTilts(e.model)) {
    const ground = terrainHeightAt(terrain, e.position[0], e.position[2]);
    if (ground !== null && Math.abs(e.position[1] - ground) < 0.6) {
      const n = groundNormal(terrain, e.position[0], e.position[2], Math.max(0.4, species.variants[0].size[0] * e.scale * 0.5));
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
export {
  EnvironmentVisuals,
  placementMatrix,
  sectorSize
};
