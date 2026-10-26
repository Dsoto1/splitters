// Builds the weapon models listed in content/guns.json from pack downloads
// that stay out of the repo (Styloo's Guns Asset Pack, the CC0 Guns &
// Explosives pack): each GLB or FBX (tools/content/fbx.mjs) is turned so
// its barrel runs along +Z, centred on its bounds, scaled to `length` metres,
// its node transforms baked into the vertices, its colour map shrunk to a
// 512 px JPEG and its normal map to 256 px, metal/roughness made matte (the
// pack is painted for a diffuse look). Writes packages/client/public/models/guns
// and content/guns.lock.json (checked by `pnpm content:check`).
//
//   node tools/content/prepare-guns.mjs --downloads <dir holding the extracted pack>
//
// Without --downloads (or when the pack's folder is not there) the built
// files are kept and checked against the lock file.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, dedup, flatten, prune, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { fbxToDocument } from './fbx.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'content/guns.json'), 'utf8'));
const OUT = join(ROOT, 'packages/client/public/models/guns');
const LOCK = join(ROOT, 'content/guns.lock.json');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const arg = process.argv.indexOf('--downloads');
const downloads = arg > 0 ? resolve(process.argv[arg + 1] ?? '') : null;
const oldLock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { files: [] };
const built = new Map(oldLock.files.map((f) => [f.file, f]));
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

/** The folder of an extracted download: directly under the downloads dir or one level down. */
function downloadDir(folder) {
  if (!downloads) return null;
  if (existsSync(join(downloads, folder))) return join(downloads, folder);
  for (const d of readdirSync(downloads, { withFileTypes: true })) if (d.isDirectory() && existsSync(join(downloads, d.name, folder))) return join(downloads, d.name, folder);
  return null;
}

/** Quaternion turning the given source axis to +Z (about +Y). */
const FORWARD = { '+z': 0, '-z': 180, '+x': -90, '-x': 90 };
const yaw = (deg) => [0, Math.sin((deg * Math.PI) / 360), 0, Math.cos((deg * Math.PI) / 360)];

async function shrink(tex, size, mime) {
  const img = sharp(Buffer.from(tex.getImage())).resize(size, size, { fit: 'inside', kernel: 'lanczos3' });
  const data = mime === 'image/png' ? await img.png({ palette: true, quality: 90 }).toBuffer() : await img.removeAlpha().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  tex.setImage(data).setMimeType(mime).setURI('');
}

async function build(src, entry) {
  // FBX sources (the Guns & Explosives pack) keep their UVs; their colour and normal maps sit beside them
  // unlinked, so `baseColor` / `normal` name them and they go on every material.
  const doc = /\.fbx$/i.test(src) ? (await fbxToDocument(src, { keepUv: true })).doc : await io.read(src);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  for (const [key, slot] of [['baseColor', 'setBaseColorTexture'], ['normal', 'setNormalTexture']]) {
    if (!entry[key]) continue;
    const tex = doc.createTexture(key).setImage(readFileSync(join(dirname(src), entry[key]))).setMimeType('image/png');
    for (const mat of doc.getRoot().listMaterials()) mat[slot](tex).setBaseColorFactor([1, 1, 1, 1]);
  }
  const scene = doc.getRoot().listScenes()[0];
  const root = doc.createNode('model').setRotation(yaw(FORWARD[entry.forward]));
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);
  const b = getBounds(scene);
  const s = entry.length / (b.max[2] - b.min[2]);
  root.setScale([s, s, s]).setTranslation(b.min.map((v, i) => (-(v + b.max[i]) / 2) * s));
  await doc.transform(flatten());
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node);
  for (const node of doc.getRoot().listNodes()) if (!node.getMesh()) node.dispose();
  const holder = doc.createNode('model');
  for (const node of scene.listChildren()) {
    scene.removeChild(node);
    holder.addChild(node);
  }
  scene.addChild(holder);
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setMetallicFactor(0).setRoughnessFactor(0.85).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    for (const ext of mat.listExtensions()) ext.dispose();
    const base = mat.getBaseColorTexture();
    if (base) await shrink(base, 512, mat.getAlphaMode() === 'OPAQUE' ? 'image/jpeg' : 'image/png');
    const normal = mat.getNormalTexture();
    if (normal) await shrink(normal, 256, 'image/jpeg');
  }
  doc.getRoot().getAsset().generator = 'tiletrigger content build';
  await doc.transform(weld(), dedup(), prune());
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) triangles += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  return { glb: Buffer.from(await io.writeBinary(doc)), triangles };
}

mkdirSync(OUT, { recursive: true });
const lock = { $comment: 'Generated by tools/content/prepare-guns.mjs. Do not edit by hand.', files: [] };
for (const entry of manifest.models) {
  const pack = manifest.packs[entry.pack];
  const file = `models/${entry.out}`;
  const path = join(ROOT, 'packages/client/public', file);
  const dir = downloadDir(pack.download);
  let glb;
  let triangles;
  if (dir) {
    ({ glb, triangles } = await build(join(dir, pack.models, entry.file), entry));
    writeFileSync(path, glb);
  } else {
    if (!existsSync(path)) throw new Error(`${file} is missing; rebuild it with --downloads <dir> (see docs/CONTENT_PIPELINE.md)`);
    glb = readFileSync(path);
    const was = built.get(file);
    if (was?.sha256 !== sha(glb)) throw new Error(`${file} does not match content/guns.lock.json; rebuild it with --downloads <dir>`);
    triangles = was.triangles;
  }
  lock.files.push({ file, source: entry.pack, src: entry.file, triangles, bytes: glb.byteLength, sha256: sha(glb) });
  console.log(`${dir ? 'built' : 'kept '} ${file.padEnd(32)} ${String(triangles).padStart(5)} tris ${String(glb.byteLength).padStart(7)} B`);
}
writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
