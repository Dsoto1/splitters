// Builds the city pieces from Quaternius' Downtown City MegaKit [Standard]
// (CC0) at 4/3 scale, so the kit's 3 m storeys become our 4 m levels and three
// 2 m bays fit an 8 m cell side:
//
//   packages/client/public/city/facades.glb   wall skins, cornices and corner
//                                             columns (one node per piece; see
//                                             FACADE_PIECES in the shared map code)
//   packages/client/public/city/<building>.glb the three whole buildings, fitted
//                                             to whole cells (city.* tiles)
//   packages/client/public/city/<street>.glb  street and crossroads tiles
//
// Every piece keeps its pivot (bottom centre of the street face, facing +Z).
// Materials are merged to a handful (the Standard export's variants share
// textures), normal and ORM maps are dropped, colour maps are shrunk, and the
// interior-wall faces (hidden behind our own walls) are removed. Writes
// content/city.lock.json, checked by `pnpm content:check`. The 200 MB kit
// stays out of the repo:
//
//   node tools/content/prepare-city.mjs <kit folder holding "Exports/glTF (Godot)">
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Logger, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

await MeshoptSimplifier.ready;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const kit = process.argv[2];
if (!kit) throw new Error('usage: prepare-city.mjs <Downtown City MegaKit folder>');
const SRC = join(kit, 'Exports', 'glTF (Godot)');
const OUT = join(ROOT, 'packages/client/public/city');
const LICENSE_DIR = join(ROOT, 'assets-src/quaternius-downtown-city');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const quiet = new Logger(Logger.Verbosity.WARN);
const SCALE = 4 / 3;

/** Facade pieces shipped in facades.glb (names match FACADE_PIECES in packages/shared). */
const FACADES = [
  'Brick_Plain_3', 'Brick_Plain_1', 'Brick_Window_Trim_Single', 'Brick_Window_Square_Single', 'Brick_BottomTrim', 'Cornice_Brick_Center',
  'Metal_FirstFloor_Window', 'Metal_FullWindow', 'Metal_Plain_1', 'Cornice_Metal_Center', 'Metal_Column_Center',
  'Trim_Plain_3', 'Trim_Window', 'Trim_FirstFloor_Wall', 'Trim_FirstFloor_Window_001', 'Cornice_Trim_Center', 'Trim_Column_Center',
];
/** Whole buildings: [source, out name, scale, footprint cells]. The street face is +Z; the core is centred on its cells. */
const BUILDINGS = [
  ['Building_Small_1', 'brownstone', 4 / 3, [2, 2]],
  ['Building_Medium_2_001', 'midrise', 8 / 7, [2, 2]],
  ['Building_Large_2', 'highrise', 1.2, [3, 3]],
];
/** Street tiles: [source, out name, scale]. */
const STREETS = [
  ['Street_2Lane', 'street', 4 / 3],
  ['Street_4WayIntersection', 'crossroads', 32 / 24.667],
];

/** Canonical materials: [base colour tint, keeps texture]. Variants of one texture differ only by tint. */
const CANON = {
  MI_RedBrick: 'Brick', MI_RedBrick_Pale: 'BrickPale', MI_Trim: 'Trim', MI_Trim_Dark: 'TrimDark', MI_Trim_Green: 'TrimGreen',
  MI_Trim_MetalConcrete: 'Metal', MI_Glass: 'Glass', MI_Concrete: 'Concrete', MI_Asphalt: 'Asphalt', MI_Roof_Slate: 'Slate',
  MI_StreetDecals: 'Decals', MI_Ornaments: 'Ornaments', MI_Dirt: 'Dirt', MI_InteriorFloor: 'Floor',
};
const TINT = { Brick: [0.92, 0.86, 0.84], BrickPale: [1, 1, 1], Trim: [1, 1, 1], TrimDark: [0.32, 0.32, 0.34], TrimGreen: [0.42, 0.56, 0.46] };
const DROP = /^MI_InteriorWall/;

async function read(name) {
  const doc = await io.read(join(SRC, `${name}.gltf`));
  doc.setLogger(quiet);
  return doc;
}

/** Bake a uniform scale (and an offset) into every vertex, drop the extra attributes, the hidden interior faces and the variant materials. */
function clean(doc, scale, offset = [0, 0, 0], squashY = 1) {
  const root = doc.getRoot();
  const canon = new Map();
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? '';
      if (DROP.test(name)) {
        prim.dispose();
        continue;
      }
      for (const a of ['TEXCOORD_1', 'COLOR_0', 'COLOR_1']) prim.setAttribute(a, null);
      const key = /^MI_FakeInterior/.test(name) ? name.replace('MI_FakeInterior', 'Interior') : (CANON[name] ?? name);
      let mat = canon.get(key);
      if (!mat) {
        mat = prim.getMaterial().clone().setName(key).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null);
        if (key !== 'Glass') mat.setMetallicFactor(0).setRoughnessFactor(0.88);
        if (TINT[key]) mat.setBaseColorFactor([...TINT[key], 1]);
        canon.set(key, mat);
      }
      prim.setMaterial(mat);
    }
  }
  const done = new Set();
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos && !done.has(pos)) {
        done.add(pos);
        const a = pos.getArray().slice();
        for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) a[i + k] = (a[i + k] + offset[k]) * scale * (k === 1 ? squashY : 1);
        pos.setArray(a);
      }
    }
  }
}

/** Shrink colour maps (JPEG unless they carry alpha). */
async function shrinkTextures(doc, size) {
  for (const tex of doc.getRoot().listTextures()) {
    const img = sharp(Buffer.from(tex.getImage()));
    const meta = await img.metadata();
    const s = Math.min(size, meta.width ?? size);
    if (/Decals/.test(tex.getName())) {
      tex.setImage(new Uint8Array(await img.resize(s, s).png({ compressionLevel: 9, palette: true }).toBuffer())).setMimeType('image/png');
    } else {
      tex.setImage(new Uint8Array(await img.resize(s, s).removeAlpha().jpeg({ quality: 82, mozjpeg: true }).toBuffer())).setMimeType('image/jpeg');
    }
  }
}

async function finish(doc, file, textureSize) {
  await doc.transform(prune(), dedup(), weld());
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  for (const acc of doc.getRoot().listAccessors()) acc.setBuffer(buffer);
  for (const b of doc.getRoot().listBuffers()) if (b !== buffer) b.dispose();
  await shrinkTextures(doc, textureSize);
  doc.getRoot().getAsset().generator = 'tiletrigger prepare-city';
  const glb = await io.writeBinary(doc);
  writeFileSync(join(OUT, file), glb);
  let triangles = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) triangles += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  console.log(`${file.padEnd(22)} ${String(triangles).padStart(6)} tris ${String(glb.byteLength).padStart(8)} B`);
  return { file: `city/${file}`, source: 'quaternius-downtown-city', sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), triangles, bytes: glb.byteLength };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(LICENSE_DIR, { recursive: true });
copyFileSync(join(kit, 'License_Standard.txt'), join(LICENSE_DIR, 'License.txt'));
const files = [];

// Facades: one document, one node per piece.
const facades = new Document();
facades.setLogger(quiet);
facades.createBuffer();
const scene = facades.createScene('facades');
for (const name of FACADES) {
  const doc = await read(name);
  clean(doc, SCALE);
  const map = mergeDocuments(facades, doc);
  const node = facades.createNode(name);
  for (const n of doc.getRoot().listScenes()[0].listChildren()) {
    const mesh = map.get(n.getMesh());
    if (mesh) node.setMesh(mesh);
  }
  scene.addChild(node);
}
for (const s of facades.getRoot().listScenes()) if (s !== scene) s.dispose();
for (const b of facades.getRoot().listBuffers().slice(1)) b.dispose();
for (const n of facades.getRoot().listNodes()) if (!n.getMesh() && !FACADES.includes(n.getName())) n.dispose();
// Same canonical materials from different pieces: merge them.
const byName = new Map();
for (const mat of facades.getRoot().listMaterials()) {
  const first = byName.get(mat.getName());
  if (!first) {
    byName.set(mat.getName(), mat);
    continue;
  }
  for (const parent of mat.listParents()) if (parent.propertyType === 'Primitive') parent.setMaterial(first);
  mat.dispose();
}
files.push(await finish(facades, 'facades.glb', 1024));

// Whole buildings: centred on their core footprint, standing on y = 0, simplified.
for (const [src, out, scale, cells] of BUILDINGS) {
  const doc = await read(src);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  // The core runs back from the street face at z = 0; centre it on the footprint (x centre of the bounds, z half the cells back).
  const depth = (cells[1] * 8) / scale;
  clean(doc, scale, [-(b.min[0] + b.max[0]) / 2, -b.min[1], depth / 2]);
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.4, error: 0.002 }));
  files.push(await finish(doc, `${out}.glb`, 512));
}
for (const [src, out, scale] of STREETS) {
  const doc = await read(src);
  // The asphalt (0.15 below the kerb tops) becomes the floor at y = 0, and the kerbs are flattened to a few
  // centimetres: the whole tile is walked at floor height (no kerb collision), so nobody floats over the road.
  clean(doc, scale, [0, 0.15, 0], 0.25);
  files.push(await finish(doc, `${out}.glb`, 512));
}

writeFileSync(join(ROOT, 'content/city.lock.json'), `${JSON.stringify({ $comment: 'Generated by tools/content/prepare-city.mjs. Do not edit by hand.', files }, null, 2)}\n`);
