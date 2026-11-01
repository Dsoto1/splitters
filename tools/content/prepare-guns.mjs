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
//   ONLY=guns/tommy_gun.glb node tools/content/prepare-guns.mjs --downloads <dir>   (just that one)
//
// Without --downloads (or when the pack's folder is not there) the built
// files are kept and checked against the lock file.
//
// Packs with `meshy: true` (Meshy community downloads, CC0 per the owner) are
// Meshy's textured FBX folders, one per model (`download` on the entry): read
// by tools/content/meshy-mesh.mjs and cut to `triangles` (`surface: rebake`:
// seams closed and the colour map painted afresh onto new flat charts, since
// Meshy's maps are cut into too many islands to keep), markings the generator
// painted on (lettering, logos) painted out first where `paintOut` lists
// colour rules for them: `{ light, chroma }` picks near-white pixels (every
// channel at least `light`, channels within `chroma` of each other), `{ warm:
// [r, r-b, r-g] }` orange and red ones. `label` names the model in the lock
// file and provenance instead of the download's file name. `centre: base`
// centres a turret on its pedestal (centreOnBase). `textureSize` (px, default 512) sizes the colour map of a
// bigger model (the buggy) or a first-person weapon (1024: seen from a hand's length); `sloppy: true` cuts a mesh
// of many small separate pieces (the tire's tread) to its budget regardless of its topology. Every Meshy model
// gets a normal map baked from the full download (`normalSize`, default 512 px; meshy-mesh.mjs bakeNormals).
// `budget: "hero"` holds an entry to `budgets.tiers.hero` instead of the default caps (content:check), and
// `lod: [share, metres]` adds a lower level of detail that instanced copies (a crowd's guns) draw from that far.
//
// Packs with `glb: true` too (the owner's own Meshy generations, licence Owned) are Meshy's textured GLB
// downloads instead: each entry names its file in `glb`, found directly in the downloads dir or one folder
// down (so the owner's download folders can sit side by side in it), and is read the same way.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, dedup, flatten, prune, quantize, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { fbxToDocument } from './fbx.mjs';
import { MESHY_QUANTIZE, meshyDocument, normalJpeg, paintOut } from './meshy-mesh.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'content/guns.json'), 'utf8'));
const OUT = join(ROOT, 'packages/client/public/models/guns');
const LOCK = join(ROOT, 'content/guns.lock.json');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const arg = process.argv.indexOf('--downloads');
const downloads = arg > 0 ? resolve(process.argv[arg + 1] ?? '') : null;
const oldLock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { files: [] };
const built = new Map(oldLock.files.map((f) => [f.file, f]));
const only = process.env.ONLY?.split(',').filter(Boolean) ?? null;
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

/** The folder of an extracted download: directly under the downloads dir or one level down. */
function downloadDir(folder) {
  if (!downloads) return null;
  if (existsSync(join(downloads, folder))) return join(downloads, folder);
  for (const d of readdirSync(downloads, { withFileTypes: true })) if (d.isDirectory() && existsSync(join(downloads, d.name, folder))) return join(downloads, d.name, folder);
  return null;
}

/** A downloaded file (Meshy's textured GLB): directly under the downloads dir or one level down. */
function downloadFile(name) {
  if (!downloads) return null;
  if (existsSync(join(downloads, name))) return join(downloads, name);
  // Folders or links to them (the owner's download folders linked side by side).
  for (const d of readdirSync(downloads)) if (existsSync(join(downloads, d, name))) return join(downloads, d, name);
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

/** The colour test for `paintOut` rules (see the header). */
function markings(rules) {
  const tests = rules.map((r) => (r.warm ? (R, G, B) => R >= r.warm[0] && R - B >= r.warm[1] && R - G >= r.warm[2] : (R, G, B) => Math.min(R, G, B) >= r.light && Math.max(R, G, B) - Math.min(R, G, B) < r.chroma));
  return (R, G, B) => tests.some((t) => t(R, G, B));
}

/**
 * `centre: base`: centre the model on its foot (the bottom 15% of its height) instead of its bounds, so a turret on
 * a pedestal turns about the pedestal (the mount turns the whole model, about the middle of its footprint).
 */
function centreOnBase(doc, given = null) {
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  let shift = given;
  if (!shift) {
    let [lo, hi] = [Infinity, -Infinity];
    for (const p of prims) {
      const a = p.getAttribute('POSITION').getArray();
      for (let i = 1; i < a.length; i += 3) [lo, hi] = [Math.min(lo, a[i]), Math.max(hi, a[i])];
    }
    const foot = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of prims) {
      const a = p.getAttribute('POSITION').getArray();
      for (let i = 0; i < a.length; i += 3) {
        if (a[i + 1] > lo + (hi - lo) * 0.15) continue;
        foot[0] = Math.min(foot[0], a[i]);
        foot[1] = Math.min(foot[1], a[i + 2]);
        foot[2] = Math.max(foot[2], a[i]);
        foot[3] = Math.max(foot[3], a[i + 2]);
      }
    }
    shift = [(foot[0] + foot[2]) / 2, (foot[1] + foot[3]) / 2];
  }
  const [cx, cz] = shift;
  for (const p of prims) {
    const pos = p.getAttribute('POSITION');
    const a = pos.getArray().slice();
    for (let i = 0; i < a.length; i += 3) {
      a[i] -= cx;
      a[i + 2] -= cz;
    }
    pos.setArray(a);
  }
  return shift;
}

/**
 * A box in the built model's frame (`interior.box`: [[x, y, z] min, [x, y, z] max], metres, +Z forward) taken back
 * into the download's own frame through the body's placement (yaw, scale, centring, `centre: base` shift).
 */
function boxToSource([min, max], place) {
  const th = (-FORWARD[place.forward] * Math.PI) / 180;
  const [c, s] = [Math.cos(th), Math.sin(th)];
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        // Undo the base shift and the centring/scale, then the yaw (a turn about +Y by -yaw).
        const q = [x + place.base[0], y, z + place.base[1]].map((v, i) => (v - place.t[i]) / place.s);
        const p = [q[0] * c + q[2] * s, q[1], -q[0] * s + q[2] * c];
        for (let k = 0; k < 3; k++) [lo[k], hi[k]] = [Math.min(lo[k], p[k]), Math.max(hi[k], p[k])];
      }
    }
  }
  return { min: lo, max: hi };
}

/**
 * Build one model. `place` (a body's placement, returned by its own build) puts an `interior` in exactly the body's
 * frame: the same yaw, scale, centring and base shift, so the two line up to the vertex. Returns the placement used.
 */
async function build(src, entry, pack, place = null) {
  let meshy = null;
  if (pack.meshy) {
    const recolor = entry.paintOut ? async (img) => console.log(`  painted out ${await paintOut(img, markings(entry.paintOut), { grow: entry.grow ?? 2, holes: entry.holes ?? 0 })} px of markings`) : null;
    const crop = place && entry.box ? boxToSource(entry.box, place) : null;
    ({ doc: meshy } = await meshyDocument(src, { triangles: entry.triangles, maxError: entry.maxError, surface: entry.surface, dropHidden: entry.dropHidden, recolor, sloppy: entry.sloppy, lod: entry.lod ?? null, crop, ...(entry.normalSize > 1024 ? { normalSize: entry.normalSize } : {}), ...(entry.textureSize ? { textureSize: entry.textureSize } : {}) }));
  }
  // FBX sources (the Guns & Explosives pack) keep their UVs; their colour and normal maps sit beside them
  // unlinked, so `baseColor` / `normal` name them and they go on every material.
  const doc = meshy ?? (/\.fbx$/i.test(src) ? (await fbxToDocument(src, { keepUv: true })).doc : await io.read(src));
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  for (const [key, slot] of [['baseColor', 'setBaseColorTexture'], ['normal', 'setNormalTexture']]) {
    if (!entry[key]) continue;
    const tex = doc.createTexture(key).setImage(readFileSync(join(dirname(src), entry[key]))).setMimeType('image/png');
    for (const mat of doc.getRoot().listMaterials()) mat[slot](tex).setBaseColorFactor([1, 1, 1, 1]);
  }
  const scene = doc.getRoot().listScenes()[0];
  const forward = place?.forward ?? entry.forward;
  const root = doc.createNode('model').setRotation(yaw(FORWARD[forward]));
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);
  let s = place?.s;
  let t = place?.t;
  if (!place) {
    root.setScale([1, 1, 1]);
    const b = getBounds(scene);
    s = entry.length / (b.max[2] - b.min[2]);
    t = b.min.map((v, i) => (-(v + b.max[i]) / 2) * s);
  }
  root.setScale([s, s, s]).setTranslation(t);
  await doc.transform(flatten());
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node);
  const base = entry.centre === 'base' || place?.centred ? centreOnBase(doc, place?.base ?? null) : [0, 0];
  for (const node of doc.getRoot().listNodes()) if (!node.getMesh()) node.dispose();
  const holder = doc.createNode('model');
  for (const node of scene.listChildren()) {
    scene.removeChild(node);
    holder.addChild(node);
  }
  scene.addChild(holder);
  // An interior says which part of the body it stands in for: the game hides the body's triangles inside `box`
  // while it draws the interior (packages/client/src/game/cockpitInterior.ts).
  if (place && entry.box) holder.setExtras({ cockpit: { box: entry.box } });
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setMetallicFactor(0).setRoughnessFactor(0.85).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    for (const ext of mat.listExtensions()) ext.dispose();
    const baseMap = mat.getBaseColorTexture();
    if (baseMap) await shrink(baseMap, entry.textureSize ?? 512, mat.getAlphaMode() === 'OPAQUE' ? 'image/jpeg' : 'image/png');
    const normal = mat.getNormalTexture();
    // A Meshy model's normal map is baked from the full download (meshy-mesh.mjs): `normalSize` px (default 512, a
    // first-person gun is seen from a hand's length away); a pack's own is shrunk to 256 px.
    if (normal && pack.meshy) normal.setImage(await normalJpeg(normal.getImage(), entry.normalSize ?? 512)).setMimeType('image/jpeg').setURI('');
    else if (normal) await shrink(normal, 256, 'image/jpeg');
  }
  doc.getRoot().getAsset().generator = 'tiletrigger content build';
  await doc.transform(weld(), dedup(), prune(), ...(meshy ? [quantize(MESHY_QUANTIZE)] : []));
  // The budget is for the full-detail model; a lower level of detail (`lod`) is counted apart.
  let triangles = 0;
  let lodTriangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    let n = 0;
    for (const p of mesh.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    if (mesh.listParents().some((node) => node.propertyType === 'Node' && node.getExtras()?.lod)) lodTriangles += n;
    else triangles += n;
  }
  const placed = { forward, s, t, base, centred: entry.centre === 'base' || !!place?.centred };
  return { glb: Buffer.from(await io.writeBinary(doc)), triangles, lodTriangles, normalMap: !!pack.meshy && doc.getRoot().listMaterials().some((m) => m.getNormalTexture()), place: placed };
}

mkdirSync(OUT, { recursive: true });
const lock = { $comment: 'Generated by tools/content/prepare-guns.mjs. Do not edit by hand.', files: [] };

/** Write (or keep and check) one output and add it to the lock file. */
function record(out, entry, pack, made, extra = {}) {
  const file = `models/${out}`;
  const path = join(ROOT, 'packages/client/public', file);
  let glb;
  let triangles;
  let lodTriangles = 0;
  let normalMap = false;
  if (made) {
    ({ glb, triangles, lodTriangles, normalMap } = made);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, glb);
  } else {
    if (!existsSync(path)) throw new Error(`${file} is missing; rebuild it with --downloads <dir> (see docs/CONTENT_PIPELINE.md)`);
    glb = readFileSync(path);
    const was = built.get(file);
    if (was?.sha256 !== sha(glb)) throw new Error(`${file} does not match content/guns.lock.json; rebuild it with --downloads <dir>`);
    triangles = was.triangles;
    lodTriangles = was.lodTriangles ?? 0;
    normalMap = !!was.normalMap;
  }
  lock.files.push({ file, source: entry.pack, ...(entry.budget ? { budget: entry.budget } : {}), src: entry.label ?? entry.file ?? entry.glb, ...extra, triangles, ...(lodTriangles ? { lodTriangles } : {}), ...(normalMap ? { normalMap } : {}), bytes: glb.byteLength, sha256: sha(glb) });
  console.log(`${made ? 'built' : 'kept '} ${file.padEnd(32)} ${String(triangles).padStart(5)} tris ${String(glb.byteLength).padStart(7)} B`);
}

for (const entry of manifest.models) {
  const pack = manifest.packs[entry.pack];
  // `interior` (Meshy entries): a second model of the part of this one inside `interior.box` (in the built model's
  // frame), cropped from the same download and cut far less, with colour and normal maps of its own; written to
  // `interior.out` in the body's exact frame. The game draws it only for the player looking out of a vehicle's
  // cockpit (MountDef.cockpitModel), and hides the body's triangles inside the box meanwhile. Built with its body.
  const interior = entry.interior ? { ...entry, lod: null, centre: undefined, paintOut: entry.paintOut, budget: undefined, ...entry.interior } : null;
  // ONLY=guns/a.glb,guns/b.glb rebuilds just those (the rest are kept and checked); naming an interior builds its body too.
  const skip = only && !only.includes(entry.out) && !(interior && only.includes(interior.out));
  const src = entry.glb && !skip ? downloadFile(entry.glb) : null;
  const dir = skip ? null : entry.glb ? src && dirname(src) : downloadDir(entry.download ?? pack.download);
  const from = dir ? (src ?? join(dir, pack.models ?? '.', entry.file)) : null;
  const made = from ? await build(from, entry, pack) : null;
  record(entry.out, entry, pack, made);
  if (interior) {
    console.log(`  interior ${interior.out}`);
    record(interior.out, interior, pack, made ? await build(from, interior, pack, made.place) : null, { interiorOf: `models/${entry.out}` });
  }
}
writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
