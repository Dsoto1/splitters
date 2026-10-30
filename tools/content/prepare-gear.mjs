// Builds the gear models listed in content/gear.json (helmets and hats worn
// over the part-built characters) from the owner's Meshy downloads, which
// stay out of the repo: each textured GLB (one mesh, one material, 2048 px
// maps) is cut to `triangles` with its texture seams closed and its colour
// map painted afresh onto new flat charts at `textureSize` px
// (tools/content/meshy-mesh.mjs: closeSeams, rebake); the other maps are
// dropped. It is then turned (`rotate`) and fitted to a head in skull radii
// (`fit`, see the manifest's comment), so the game only scales it by the
// wearer's skull and hangs it on the Head joint. Writes
// packages/client/public/gear/<id>.glb and content/gear.lock.json (checked
// by `pnpm content:check`).
//
//   node tools/content/prepare-gear.mjs --downloads <dir> [--only <id>]
//
// A new helmet is one manifest entry (`src` is the download's file name in
// <dir>) plus a GEAR entry naming it. Without --downloads (or when an entry's
// download is not there) the built file is kept and checked against the lock.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, quantize, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { closeSeams, rebake } from './meshy-mesh.mjs';

await MeshoptSimplifier.ready;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'content/gear.json'), 'utf8'));
const OUT = join(ROOT, 'packages/client/public/gear');
const LOCK = join(ROOT, 'content/gear.lock.json');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const downloads = flag('--downloads') ? resolve(flag('--downloads')) : null;
const only = flag('--only');
const oldLock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { files: [] };
const built = new Map(oldLock.files.map((f) => [f.file, f]));
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
/** The download is cut to this many triangles first (plainly: its seams stay), the source the colour map is painted from. */
const WORK_TRIANGLES = 200000;

/** Rotation (degrees about x, then y, then z) as a function on points. */
function rotation([rx = 0, ry = 0, rz = 0] = []) {
  const [a, b, c] = [rx, ry, rz].map((d) => (d * Math.PI) / 180);
  return (x, y, z) => {
    [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
    [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
    [x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)];
    return [x, y, z];
  };
}

async function prepare(entry) {
  const src = join(downloads, entry.src);
  const doc = await io.read(src);
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  if (prims.length !== 1) throw new Error(`${entry.src}: expected one mesh with one material, found ${prims.length} primitives`);
  const prim = prims[0];
  const colour = prim.getMaterial()?.getBaseColorTexture();
  if (!colour) throw new Error(`${entry.src}: no base colour map`);
  const map = await sharp(Buffer.from(colour.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const s of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(s)) prim.setAttribute(s, null);
  await doc.transform(weld());
  const sourceTriangles = prim.getIndices().getCount() / 3;
  if (sourceTriangles > WORK_TRIANGLES) {
    const [cut] = MeshoptSimplifier.simplify(new Uint32Array(prim.getIndices().getArray()), new Float32Array(prim.getAttribute('POSITION').getArray()), 3, WORK_TRIANGLES * 3, 0.01, []);
    prim.getIndices().setArray(cut);
    compactPrimitive(prim);
  }
  const hi = { P: prim.getAttribute('POSITION').getArray().slice(), UV: prim.getAttribute('TEXCOORD_0').getArray().slice(), I: prim.getIndices().getArray().slice() };
  // A busy model (rivets, straps) stops short of the budget at the usual error: allow more until it fits.
  let maxError = entry.maxError ?? 0.02;
  let low = closeSeams(prim, map, entry.triangles, maxError, false, 0.25);
  while (low.idx.length / 3 > entry.triangles * 1.05 && maxError < 0.2) {
    maxError *= 1.6;
    low = closeSeams(prim, map, entry.triangles, maxError, false, 0.25);
  }
  const out = await rebake(low, hi, map, entry.textureSize ?? 512, maxError);

  // Turn, then fit to the head in skull radii.
  const turn = rotation(entry.rotate);
  const pos = new Float32Array(out.pos.length);
  const nrm = new Float32Array(out.nrm.length);
  const lo = [Infinity, Infinity, Infinity];
  const hiB = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    const p = turn(out.pos[i], out.pos[i + 1], out.pos[i + 2]);
    pos.set(p, i);
    nrm.set(turn(out.nrm[i], out.nrm[i + 1], out.nrm[i + 2]), i);
    for (let k = 0; k < 3; k++) [lo[k], hiB[k]] = [Math.min(lo[k], p[k]), Math.max(hiB[k], p[k])];
  }
  const { width, top, z } = entry.fit;
  const s = width / (hiB[0] - lo[0]);
  const shift = [-(lo[0] + hiB[0]) / 2, top / s - hiB[1], z / s - (lo[2] + hiB[2]) / 2];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) pos[i + k] = (pos[i + k] + shift[k]) * s;

  const outDoc = new Document();
  const buffer = outDoc.createBuffer();
  const acc = (type, array) => outDoc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const material = outDoc
    .createMaterial(`gear_${entry.id}`)
    .setMetallicFactor(entry.metallic ?? 0)
    .setRoughnessFactor(entry.roughness ?? 0.7)
    .setBaseColorTexture(outDoc.createTexture('albedo').setImage(new Uint8Array(out.jpeg)).setMimeType('image/jpeg'));
  const outPrim = outDoc.createPrimitive().setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nrm)).setAttribute('TEXCOORD_0', acc('VEC2', out.uv)).setIndices(acc('SCALAR', out.idx)).setMaterial(material);
  const mesh = outDoc.createMesh(entry.id).addPrimitive(outPrim);
  outDoc.createScene('gear').addChild(outDoc.createNode(entry.id).setMesh(mesh));
  await outDoc.transform(quantize({ quantizeNormal: 8, quantizeTexcoord: 12 }));
  const glb = Buffer.from(await io.writeBinary(outDoc));
  return { glb, sourceTriangles, triangles: out.idx.length / 3 };
}

mkdirSync(OUT, { recursive: true });
const files = [];
for (const entry of manifest.models) {
  const file = `gear/${entry.id}.glb`;
  const path = join(ROOT, 'packages/client/public', file);
  if (!downloads || (only && only !== entry.id) || !existsSync(join(downloads, entry.src))) {
    const old = built.get(file);
    if (!old || !existsSync(path)) throw new Error(`${file}: not built yet (needs --downloads with ${entry.src})`);
    files.push(old);
    continue;
  }
  console.log(`${entry.id}: ${entry.src}`);
  const { glb, sourceTriangles, triangles } = await prepare(entry);
  writeFileSync(path, glb);
  const record = { file, source: entry.pack ?? 'meshy-owned-gear', src: entry.src, title: entry.title, sourceTriangles, triangles, bytes: glb.length, sha256: sha(glb) };
  console.log(`  ${triangles} triangles (from ${sourceTriangles}), ${(glb.length / 1024).toFixed(0)} KB`);
  files.push(record);
}
writeFileSync(LOCK, `${JSON.stringify({ $comment: 'Generated by tools/content/prepare-gear.mjs. Do not edit by hand.', files }, null, 2)}\n`);
console.log(`wrote ${files.length} gear models`);
