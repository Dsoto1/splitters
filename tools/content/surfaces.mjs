// Real surfaces on man-made kit props (docs/CONTENT_PIPELINE.md, "Prop surfaces"). Kenney's models paint every
// part one flat colour: a flat material per colour (the older kits: "wood", "metalDark", "carpet") or one palette
// texture whose swatches the faces point at (the newer kits' `colormap`). This maps each colour to a surface from
// content/surfaces.json (wood, painted metal, concrete, fabric, plastic, glass...) and gives the part:
//   - the surface's roughness and metalness,
//   - a second set of texture coordinates, box-projected in metres in the prop's frame as the game draws it,
//   - material extras `{ surface, tile, uv, detail: [albedo, roughness, bump] }` (`uv`: metres per coordinate unit), which the game turns into a Babylon
//     detail map (content/propSurfaces.ts): grain, normal relief and grime from a shared 256 px picture per surface
//     (packages/client/public/surfaces/<id>.webp, built here from our ambientCG sets).
// The part keeps its own colour as the tint, so props stay recognisable. Nothing per prop is added to the download
// but the coordinates: the surface pictures are shared by every prop.
//
// The mapping is data, one file per pack: content/surfaces/<pack>.json
//   {
//     "default": "<surface>",              what any colour not listed below becomes (or "none": left as it is)
//     "materials": { "<name>": "<surface>" },   flat-material kits, by material name
//     "colors": { "#rrggbb": "<surface>" },     palette kits, by the swatch a face points at (nearest within 40)
//     "minShare": 0.18,                     a palette prop's surfaces under this share of its area join its largest
//     "skip": ["<prop id>", ...],           props left alone (natural pieces: trees, plants, rocks)
//     "props": { "<prop id>": { "default", "materials", "colors" } }   per-prop overrides, over the pack's
//   }
// A palette prop whose colours land on several surfaces is split into one part per surface (one draw each);
// `minShare` folds the small ones into the largest so most props stay at one or two.
//
//   node tools/content/surfaces.mjs                 the surface pictures and content/surfaces.lock.json
//   node tools/content/surfaces.mjs --palette <pack> the colours a pack's props use (area share, which props),
//                                                    to write its mapping (PALETTE_PNG=<file>: the swatches as a picture)
// prepare-props.mjs applies the mapping to every prop it builds (and, once, to kit props kept as built).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unweld } from '@gltf-transform/functions';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { readLock, writeLock } from './lockfile.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/surfaces');
const LOCK = join(ROOT, 'content/surfaces.lock.json');
const MAP_DIR = join(ROOT, 'content/surfaces');
/** A palette colour this close (RGB distance) to a listed one counts as it (Kenney's swatches are gradients). */
const NEAR = 40;
const HEX = /^#[0-9a-f]{6}$/;
/** The surface coordinates are whole centimetres in 16 bits (KHR_mesh_quantization): half the bytes of floats, ±327 m. */
export const UV_UNIT = 0.01;

let cache = null;
/** content/surfaces.json and content/surfaces/<pack>.json, checked. */
export function loadSurfaces() {
  if (cache) return cache;
  const file = JSON.parse(readFileSync(join(ROOT, 'content/surfaces.json'), 'utf8'));
  const textures = new Set(JSON.parse(readFileSync(join(ROOT, 'content/textures.json'), 'utf8')).textures);
  const defs = new Map();
  for (const s of file.surfaces) {
    const where = `content/surfaces.json: ${s.id}`;
    const keys = Object.keys(s).filter((k) => !['id', 'name', 'texture', 'tile', 'roughness', 'metallic', 'detail', 'grime', 'notes'].includes(k));
    if (keys.length) throw new Error(`${where}: unknown fields ${keys.join(', ')}`);
    if (!/^[a-z][a-z_]*$/.test(s.id) || s.id === 'none') throw new Error(`${where}: an id is lower case letters and _ (not "none")`);
    if (defs.has(s.id)) throw new Error(`${where}: listed twice`);
    if (s.texture !== undefined && !textures.has(s.texture)) throw new Error(`${where}: texture ${s.texture} is not in content/textures.json`);
    if (!(s.roughness >= 0 && s.roughness <= 1) || !(s.metallic >= 0 && s.metallic <= 1)) throw new Error(`${where}: roughness and metallic are 0-1`);
    if (s.texture !== undefined) {
      if (!(s.tile > 0)) throw new Error(`${where}: tile (metres per repeat) must be above 0`);
      if (!s.detail || !['albedo', 'roughness', 'bump'].every((k) => s.detail[k] >= 0 && s.detail[k] <= 1)) throw new Error(`${where}: detail needs albedo, roughness and bump, 0-1`);
      if (!(s.grime >= 0 && s.grime <= 1)) throw new Error(`${where}: grime is 0-1`);
    }
    defs.set(s.id, s);
  }
  const surface = (where, v) => {
    if (v !== 'none' && !defs.has(v)) throw new Error(`${where}: no surface ${v} in content/surfaces.json`);
    return v;
  };
  const rules = (where, r) => {
    const keys = Object.keys(r).filter((k) => !['default', 'materials', 'colors', 'minShare', 'skip', 'props', '$comment'].includes(k));
    if (keys.length) throw new Error(`${where}: unknown fields ${keys.join(', ')}`);
    if (r.default !== undefined) surface(`${where} default`, r.default);
    for (const [k, v] of Object.entries(r.materials ?? {})) surface(`${where} materials.${k}`, v);
    for (const [k, v] of Object.entries(r.colors ?? {})) {
      if (!HEX.test(k)) throw new Error(`${where}: colour ${k} must be lower-case #rrggbb`);
      surface(`${where} colors.${k}`, v);
    }
    if (r.minShare !== undefined && !(r.minShare >= 0 && r.minShare < 0.5)) throw new Error(`${where}: minShare is 0-0.5`);
  };
  const packs = new Map();
  const propPacks = new Map(readdirSync(join(ROOT, 'content/props')).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(ROOT, 'content/props', f), 'utf8'))]));
  for (const f of existsSync(MAP_DIR) ? readdirSync(MAP_DIR).sort() : []) {
    const id = f.replace(/\.json$/, '');
    const where = `content/surfaces/${f}`;
    if (!f.endsWith('.json')) throw new Error(`content/surfaces: only <pack>.json files belong here (found ${f})`);
    const pack = propPacks.get(id);
    if (!pack) throw new Error(`${where}: no prop pack ${id} in content/props`);
    const m = JSON.parse(readFileSync(join(MAP_DIR, f), 'utf8'));
    rules(where, m);
    if (m.default === undefined) throw new Error(`${where}: default is required`);
    const ids = new Set(pack.props.map((p) => p.id));
    for (const p of m.skip ?? []) if (!ids.has(p)) throw new Error(`${where}: skip names ${p}, not a prop of the pack`);
    for (const [p, r] of Object.entries(m.props ?? {})) {
      if (!ids.has(p)) throw new Error(`${where}: props names ${p}, not a prop of the pack`);
      if (r.skip || r.props || r.minShare) throw new Error(`${where}: props.${p} takes default, materials and colors only`);
      rules(`${where} props.${p}`, r);
    }
    packs.set(id, m);
  }
  cache = { size: file.size, defs, packs };
  return cache;
}

/** The mapping for one prop (null: the prop is left as it is). */
export function surfaceRules(packId, propId) {
  const { packs } = loadSurfaces();
  const m = packs.get(packId);
  if (!m || (m.skip ?? []).includes(propId)) return null;
  const own = m.props?.[propId] ?? {};
  return {
    default: own.default ?? m.default,
    materials: { ...(m.materials ?? {}), ...(own.materials ?? {}) },
    colors: { ...(m.colors ?? {}), ...(own.colors ?? {}) },
    // A prop's own colours are matched first (exactly or nearly), then the pack's.
    ownColors: own.colors ?? {},
    minShare: m.minShare ?? 0.18,
  };
}

/** Whether a built prop already carries surfaces (a kit prop kept as built is surfaced once). */
export function isSurfaced(doc) {
  return doc.getRoot().listMaterials().some((m) => m.getExtras()?.surface);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexOf = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
function nearest(hex, table) {
  if (table[hex]) return table[hex];
  const [r, g, b] = rgb(hex);
  let best = null;
  let bestD = NEAR;
  for (const [k, v] of Object.entries(table)) {
    const [r2, g2, b2] = rgb(k);
    const d = Math.hypot(r - r2, g - g2, b - b2);
    if (d < bestD) (bestD = d), (best = v);
  }
  return best;
}

/** A palette texture's pixels, decoded once per image. */
const pixels = new WeakMap();
async function decoded(texture) {
  let p = pixels.get(texture);
  if (!p) {
    const { data, info } = await sharp(Buffer.from(texture.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    p = { data, w: info.width, h: info.height };
    pixels.set(texture, p);
  }
  return p;
}
function sample(img, u, v) {
  const x = Math.min(img.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.w)));
  const y = Math.min(img.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.h)));
  const i = (y * img.w + x) * 4;
  return hexOf(img.data[i], img.data[i + 1], img.data[i + 2]);
}

function transform(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

/**
 * Every triangle of the scene's meshes (the document unwelded first): its primitive, node matrix, palette colour
 * (or material name) and area in metres.
 */
async function triangles(doc) {
  const out = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos || prim.getIndices() || prim.getMode() !== 4) continue;
      const mat = prim.getMaterial();
      const tex = mat?.getBaseColorTexture();
      const uv = prim.getAttribute(`TEXCOORD_${mat?.getBaseColorTextureInfo()?.getTexCoord() ?? 0}`);
      const img = tex && uv ? await decoded(tex) : null;
      const n = pos.getCount() / 3;
      const a = [0, 0, 0];
      const b = [0, 0, 0];
      const c = [0, 0, 0];
      for (let t = 0; t < n; t++) {
        const [p0, p1, p2] = [pos.getElement(t * 3, a), pos.getElement(t * 3 + 1, b), pos.getElement(t * 3 + 2, c)].map((p) => transform(m, ...p));
        const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const area = Math.hypot(...cr) / 2;
        let colour = null;
        if (img) {
          const t0 = uv.getElement(t * 3, [0, 0]);
          const t1 = uv.getElement(t * 3 + 1, [0, 0]);
          const t2 = uv.getElement(t * 3 + 2, [0, 0]);
          colour = sample(img, (t0[0] + t1[0] + t2[0]) / 3, (t0[1] + t1[1] + t2[1]) / 3);
        }
        out.push({ prim, node, t, p: [p0, p1, p2], normal: cr, area, colour, material: mat?.getName() ?? '' });
      }
    }
  }
  return out;
}

/** The colours (palette swatches or flat materials) a prop's faces use, with their area (m²): for `--palette`. */
export async function colourAreas(doc) {
  await doc.transform(unweld());
  const areas = new Map();
  for (const tri of await triangles(doc)) {
    const mat = tri.prim.getMaterial();
    const key = tri.colour ?? `${tri.material} ${mat ? hexOf(...mat.getBaseColorFactor().slice(0, 3).map((v) => Math.round(255 * v ** (1 / 2.2)))) : ''}`;
    areas.set(key, (areas.get(key) ?? 0) + tri.area);
  }
  return areas;
}

/**
 * Apply a prop's surfaces to its document (after it is scaled and placed as the game draws it, before it is welded
 * and written). Returns the surfaces it used, or null when nothing applied.
 */
export async function applySurfaces(doc, packId, propId) {
  const r = surfaceRules(packId, propId);
  if (!r) return null;
  const { defs } = loadSurfaces();
  await doc.transform(unweld());
  const tris = await triangles(doc);
  const surfaceOf = (tri) => {
    if (tri.colour) return nearest(tri.colour, r.ownColors) ?? nearest(tri.colour, r.colors) ?? r.default;
    return r.materials[tri.material] ?? r.default;
  };
  // Per primitive: its triangles' surfaces, the small ones (palette parts) folded into the largest.
  const byPrim = new Map();
  for (const tri of tris) {
    tri.surface = surfaceOf(tri);
    let list = byPrim.get(tri.prim);
    if (!list) byPrim.set(tri.prim, (list = []));
    list.push(tri);
  }
  const used = new Set();
  const materials = new Map();
  const buffer = doc.getRoot().listBuffers()[0];
  const materialFor = (base, id) => {
    const key = `${base?.getName()}|${id}`;
    let m = materials.get(key);
    if (m) return m;
    const s = defs.get(id);
    // Shared by the primitives that had this material; a palette material split by surface gets one copy per surface.
    m = base ? base.clone().setName(`${base.getName()}_${id}`) : doc.createMaterial(id);
    m.setRoughnessFactor(s.roughness).setMetallicFactor(s.metallic);
    m.setExtras({ ...(m.getExtras() ?? {}), surface: id, ...(s.texture ? { tile: s.tile, uv: UV_UNIT, detail: [s.detail.albedo, s.detail.roughness, s.detail.bump] } : {}) });
    materials.set(key, m);
    return m;
  };
  for (const [prim, list] of byPrim) {
    const area = new Map();
    for (const tri of list) area.set(tri.surface, (area.get(tri.surface) ?? 0) + tri.area);
    const total = [...area.values()].reduce((a, b) => a + b, 0) || 1;
    const main = [...area].filter(([s]) => s !== 'none').sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';
    // Only palette primitives split; a flat material is one surface by its name anyway.
    for (const tri of list) if (tri.surface !== 'none' && tri.surface !== main && area.get(tri.surface) / total < r.minShare) tri.surface = main;
    const groups = new Map();
    for (const tri of list) {
      let g = groups.get(tri.surface);
      if (!g) groups.set(tri.surface, (g = []));
      g.push(tri);
    }
    const base = prim.getMaterial();
    const mesh = prim.listParents().find((p) => p.propertyType === 'Mesh');
    const attrs = prim.listSemantics().map((sem) => [sem, prim.getAttribute(sem)]);
    const make = (group) => {
      if (groups.size === 1) return prim;
      const q = doc.createPrimitive().setMode(prim.getMode());
      for (const [sem, acc] of attrs) {
        const size = acc.getElementSize();
        const src = acc.getArray();
        const arr = new src.constructor(group.length * 3 * size);
        group.forEach((tri, i) => {
          for (let k = 0; k < 3; k++) arr.set(src.subarray((tri.t * 3 + k) * size, (tri.t * 3 + k + 1) * size), (i * 3 + k) * size);
        });
        q.setAttribute(sem, doc.createAccessor().setType(acc.getType()).setArray(arr).setNormalized(acc.getNormalized()).setBuffer(acc.getBuffer() ?? buffer));
      }
      mesh.addPrimitive(q);
      return q;
    };
    for (const [id, group] of groups) {
      const q = make(group);
      if (id === 'none') {
        q.setMaterial(base);
        continue;
      }
      used.add(id);
      q.setMaterial(materialFor(base, id));
      // Box-projected coordinates in metres, along whichever axis the face looks most.
      const uv = new Int16Array(group.length * 6);
      group.forEach((tri, i) => {
        const [nx, ny, nz] = tri.normal.map(Math.abs);
        for (let k = 0; k < 3; k++) {
          const [x, y, z] = tri.p[k];
          const [u, v] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y];
          uv[i * 6 + k * 2] = Math.round(u / UV_UNIT);
          uv[i * 6 + k * 2 + 1] = Math.round(-v / UV_UNIT);
        }
      });
      q.setAttribute('TEXCOORD_1', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer));
      doc.createExtension(KHRMeshQuantization).setRequired(true);
    }
    if (groups.size > 1) {
      mesh.removePrimitive(prim);
      prim.dispose();
    }
  }
  for (const m of doc.getRoot().listMaterials()) if (!m.listParents().some((p) => p.propertyType === 'Primitive')) m.dispose();
  // The file is pruned keeping attributes (TEXCOORD_1 is read by the game, not by a texture in it): drop by hand
  // what nothing reads, as prune would have.
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      if (!m?.getNormalTexture()) prim.setAttribute('TANGENT', null);
      const textured = m && [m.getBaseColorTexture(), m.getMetallicRoughnessTexture(), m.getNormalTexture(), m.getOcclusionTexture(), m.getEmissiveTexture()].some(Boolean);
      if (!textured) prim.setAttribute('TEXCOORD_0', null);
    }
  }
  return used.size ? [...used].sort() : null;
}

// ---------------------------------------------------------------- the surface pictures

/** Tileable value noise, `cells` across, 0..1. */
function noise(size, cells, seed) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const g = Array.from({ length: cells * cells }, rand);
  const at = (i, j) => g[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const fy = (y / size) * cells;
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const sx = (fx - i) ** 2 * (3 - 2 * (fx - i));
      const sy = (fy - j) ** 2 * (3 - 2 * (fy - j));
      const top = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
      const bot = at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx;
      out[y * size + x] = top * (1 - sy) + bot * sy;
    }
  }
  return out;
}

/** A grey picture blurred with wrap-around (the sets tile), as floats. */
async function blurWrapped(grey, size, sigma) {
  const big = Buffer.alloc(size * 3 * size * 3);
  for (let y = 0; y < size * 3; y++) for (let x = 0; x < size * 3; x++) big[y * size * 3 + x] = grey[(y % size) * size + (x % size)];
  const out = await sharp(big, { raw: { width: size * 3, height: size * 3, channels: 1 } }).blur(sigma).extract({ left: size, top: size, width: size, height: size }).raw().toBuffer();
  return out;
}

/**
 * A surface's Babylon detail map (RGBA: R albedo around 0.5, G normal y, B roughness around 0.5, A normal x) from
 * its ambientCG colour and normal maps, with grime (rougher, a little darker blotches) worked into R and B.
 */
async function detailPicture(s, size) {
  const dir = join(ROOT, 'packages/client/public/textures');
  const grey = await sharp(join(dir, `${s.texture}_color.jpg`)).resize(size, size).greyscale().raw().toBuffer();
  const normal = await sharp(join(dir, `${s.texture}_normal.jpg`)).resize(size, size).removeAlpha().raw().toBuffer();
  const low = await blurWrapped(grey, size, size / 10);
  const seed = [...s.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 100000;
  const grimeA = noise(size, 4, seed + 1);
  const grimeB = noise(size, 9, seed + 2);
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    // High-passed brightness: the grain without the set's own overall colour.
    const hp = (grey[i] + 1) / (low[i] + 1);
    const grime = Math.max(0, Math.min(1, (grimeA[i] * 0.65 + grimeB[i] * 0.35 - 0.45) * 2.6)) * s.grime;
    const albedo = 0.5 + (hp - 1) * 0.9 - grime * 0.16;
    const rough = 0.5 - (hp - 1) * 0.3 + grime * 0.38;
    out[i * 4] = Math.round(255 * Math.max(0, Math.min(1, albedo)));
    out[i * 4 + 1] = normal[i * 3 + 1];
    out[i * 4 + 2] = Math.round(255 * Math.max(0, Math.min(1, rough)));
    out[i * 4 + 3] = normal[i * 3];
  }
  // Near-lossless WebP keeps the four channels apart (lossy WebP would blur them into each other) at a quarter of a PNG.
  return sharp(out, { raw: { width: size, height: size, channels: 4 } }).webp({ nearLossless: true, quality: 60, effort: 6 }).toBuffer();
}

/** Writes packages/client/public/surfaces/<id>.webp and content/surfaces.lock.json. */
export async function buildSurfaceTextures() {
  const { defs, size } = loadSurfaces();
  const sources = new Map(readLock(join(ROOT, 'content/textures.lock.json')).files.map((f) => [f.asset, f.source]));
  mkdirSync(OUT, { recursive: true });
  const lock = { $comment: 'Generated by tools/content/surfaces.mjs from content/surfaces.json. Do not edit by hand.', files: [] };
  for (const s of defs.values()) {
    if (!s.texture) continue;
    const png = await detailPicture(s, size);
    const file = `surfaces/${s.id}.webp`;
    writeFileSync(join(ROOT, 'packages/client/public', file), png);
    lock.files.push({ file, asset: s.texture, map: 'detail', source: sources.get(s.texture), bytes: png.byteLength, sha256: createHash('sha256').update(png).digest('hex').slice(0, 16) });
  }
  const keep = new Set(lock.files.map((f) => f.file));
  for (const f of readdirSync(OUT)) if (!keep.has(`surfaces/${f}`)) rmSync(join(OUT, f), { force: true });
  writeLock(LOCK, lock);
  return lock.files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--palette');
  if (i > 0) {
    const { NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const packId = process.argv[i + 1];
    const pack = JSON.parse(readFileSync(join(ROOT, 'content/props', `${packId}.json`), 'utf8'));
    const total = new Map();
    for (const p of pack.props) {
      const local = !Array.isArray(p.src) && join(ROOT, 'assets-src', packId, p.src);
      const path = local && existsSync(local) ? local : join(ROOT, 'packages/client/public/props', `${p.id}.glb`);
      const doc = await io.read(path);
      for (const [k, a] of await colourAreas(doc)) {
        const t = total.get(k) ?? { area: 0, props: new Set() };
        t.area += a;
        t.props.add(p.id);
        total.set(k, t);
      }
    }
    // Kenney's swatches are gradients: colours within NEAR of a bigger one are listed under it (one line a family).
    const rows = [];
    for (const [k, t] of [...total].sort((a, b) => b[1].area - a[1].area)) {
      const hex = k.match(/#[0-9a-f]{6}/)?.[0];
      const near = hex && rows.find(([r]) => /^#/.test(r) && /^#/.test(k) && Math.hypot(...rgb(r).map((v, n) => v - rgb(hex)[n])) < NEAR);
      if (near) {
        near[1].area += t.area;
        for (const p of t.props) near[1].props.add(p);
      } else rows.push([k, { area: t.area, props: new Set(t.props) }]);
    }
    for (const [k, t] of rows) console.log(`${k}\t${t.area.toFixed(2)} m²\t${[...t.props].slice(0, 8).join(' ')}${t.props.size > 8 ? ` +${t.props.size - 8}` : ''}`);
    const swatches = rows.map(([k]) => k.match(/#[0-9a-f]{6}/)?.[0]).filter(Boolean);
    if (process.env.PALETTE_PNG && swatches.length) {
      const w = 48;
      const img = Buffer.alloc(swatches.length * w * w * 3);
      swatches.forEach((h, n) => {
        const [r, g, b] = rgb(h);
        for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) img.set([r, g, b], (y * swatches.length * w + n * w + x) * 3);
      });
      await sharp(img, { raw: { width: swatches.length * w, height: w, channels: 3 } }).png().toFile(process.env.PALETTE_PNG);
    }
  } else {
    console.log(`wrote ${await buildSurfaceTextures()} surface pictures`);
  }
}

