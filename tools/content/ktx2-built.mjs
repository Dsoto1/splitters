// A built character's maps to KTX2 in place (ktx2.mjs), for a character whose download isn't on this machine (its
// Meshy rig task, or a download no longer on the owner's Drive): its colour and normal maps keep their size (the
// 2048 px colour map needs the download: prepare-meshy-characters.mjs), but take a quarter of the GPU memory.
// content/meshy.lock.json is updated. The first-person arms (unused by the game) are left as they are.
//
//   node tools/content/ktx2-built.mjs             every character whose body still has JPEG/PNG maps
//   ONLY=<ids> node tools/content/ktx2-built.mjs  just those
//   COLOUR_FROM=<dir> ...                         the colour map from <dir>/<id>.glb, a fresh build of the same
//                                                 character from its download, where the fresh build's mesh isn't
//                                                 the one shipped (built by an older pipeline, or changed by the
//                                                 *-built.mjs tools since: its hands, skin and grips were approved
//                                                 on it), so the shipped mesh is kept and only its colour map is
//                                                 the 2048 one. Taken only if it is the same picture in the same
//                                                 layout: shrunk to the shipped map's size, within COLOUR_DB (30 dB)
//                                                 over the texels the body's triangles cover.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { buildSpec, readManifests } from './character-manifests.mjs';
import sharp from 'sharp';
import { readPicture, texturesToKtx2 } from './ktx2.mjs';
import { writeLock } from './lockfile.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = join(ROOT, 'packages/client/public/characters');
const LOCK = join(ROOT, 'content/meshy.lock.json');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const only = process.env.ONLY?.split(',').filter(Boolean);
const specs = readManifests({ ready: true }).map(buildSpec);
for (const id of only ?? []) if (!specs.some((c) => c.id === id)) throw new Error(`ONLY: no manifest content/characters/${id}.json`);
const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
const FROM = process.env.COLOUR_FROM ? resolve(process.env.COLOUR_FROM) : null;
const MIN_DB = Number(process.env.COLOUR_DB ?? 30);

/**
 * Which texels of a `size`² map the body's triangles cover (its first primitive's texture coordinates, read
 * dequantized from a second copy), with a texel of margin: where the two maps must agree. The gutters between charts
 * may differ (padCharts fills them differently from the oldest builds).
 */
async function covered(path, size) {
  const doc = await io.read(path);
  await doc.transform(dequantize());
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const uv = prim.getAttribute('TEXCOORD_0').getArray();
  const idx = prim.getIndices().getArray();
  const mask = new Uint8Array(size * size);
  for (let t = 0; t < idx.length; t += 3) {
    const p = [0, 1, 2].map((k) => [uv[idx[t + k] * 2] * size, uv[idx[t + k] * 2 + 1] * size]);
    const [x0, x1] = [Math.floor(Math.min(...p.map((q) => q[0]))) - 1, Math.ceil(Math.max(...p.map((q) => q[0]))) + 1];
    const [y0, y1] = [Math.floor(Math.min(...p.map((q) => q[1]))) - 1, Math.ceil(Math.max(...p.map((q) => q[1]))) + 1];
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 1e-12) continue;
    for (let y = Math.max(0, y0); y <= Math.min(size - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(size - 1, x1); x++) {
        const [px, py] = [x + 0.5, y + 0.5];
        const w = [0, 1, 2].map((k) => {
          const [a, b] = [p[(k + 1) % 3], p[(k + 2) % 3]];
          return ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / area;
        });
        if (w.every((v) => v >= -0.5 / Math.sqrt(Math.abs(area)) - 1e-6)) mask[y * size + x] = 1;
      }
  }
  return mask;
}

/** PSNR (dB) of picture `b` against `a` over `mask`'s texels, `b` shrunk to `a`'s size first; and the share covered. */
async function psnr(a, b, path) {
  const A = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).resize(A.info.width, A.info.height, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  const mask = await covered(path, A.info.width);
  let [e, n] = [0, 0];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    for (let c = 0; c < 3; c++) e += (A.data[i * 3 + c] - B[i * 3 + c]) ** 2;
    n += 3;
  }
  return { db: 10 * Math.log10((255 * 255) / Math.max(e / Math.max(n, 1), 1e-9)), share: n / 3 / mask.length };
}

for (const c of specs) {
  if (only && !only.includes(c.id)) continue;
  const entry = lock.files.find((f) => f.id === c.id);
  const path = join(DIR, `${c.id}.glb`);
  if (!entry || !existsSync(path)) continue;
  const doc = await io.read(path);
  if (doc.getRoot().listTextures().every((t) => t.getMimeType() === 'image/ktx2')) continue;
  let note = '';
  if (FROM && existsSync(join(FROM, `${c.id}.glb`))) {
    const fresh = await io.read(join(FROM, `${c.id}.glb`));
    const mine = doc.getRoot().listMaterials().map((m) => m.getBaseColorTexture()).find(Boolean);
    const theirs = fresh.getRoot().listMaterials().map((m) => m.getBaseColorTexture()).find(Boolean);
    const { db, share } = mine && theirs ? await psnr(readPicture(mine), readPicture(theirs), path) : { db: 0, share: 0 };
    if (db >= MIN_DB) {
      mine.setImage(new Uint8Array(await sharp(readPicture(theirs)).png({ compressionLevel: 1 }).toBuffer())).setMimeType('image/png');
      note = `, colour map ${theirs.getSize()?.[0]} px from the fresh build (${db.toFixed(1)} dB over the ${(share * 100).toFixed(0)}% the body covers)`;
    } else note = `, fresh build's colour map not taken (${db.toFixed(1)} dB over the ${(share * 100).toFixed(0)}% the body covers: another layout)`;
  }
  await texturesToKtx2(doc);
  const glb = await io.writeBinary(doc);
  writeFileSync(path, glb);
  console.log(`${c.id.padEnd(24)} maps to KTX2: ${(entry.bytes / 1024).toFixed(0)} → ${(glb.byteLength / 1024).toFixed(0)} KB${note}`);
  Object.assign(entry, { sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), bytes: glb.byteLength });
}
writeLock(LOCK, lock);
