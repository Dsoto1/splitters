// What each built character's maps take on the GPU, and its download (docs/CONTENT_PIPELINE.md, "GPU-compressed
// textures"): a JPEG or PNG map is uploaded as RGBA8 (4 bytes a texel), a KTX2 one stays compressed (BC7 or ASTC 4x4
// on most GPUs: 1 byte a texel; ETC1 on phones without either, half that), each with its mip chain.
//
//   node tools/content/texture-memory.mjs [dir]   every body in packages/client/public/characters (or dir), and totals
//   ONLY=<ids> ...                                just those
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { gpuBytes } from './ktx2.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = resolve(process.argv[2] ?? join(ROOT, 'packages/client/public/characters'));
const only = process.env.ONLY?.split(',').filter(Boolean);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const MB = (b) => (b / 1e6).toFixed(2);

let [gpu, bytes, n] = [0, 0, 0];
for (const f of readdirSync(DIR).filter((x) => /^meshy_.*\.glb$/.test(x) && !/_(fparms|clips)\.glb$/.test(x)).sort()) {
  const id = f.replace(/\.glb$/, '');
  if (only && !only.includes(id)) continue;
  const doc = await io.read(join(DIR, f));
  const maps = doc.getRoot().listTextures().map((t) => {
    const [w, h] = t.getSize() ?? [0, 0];
    const ktx = t.getMimeType() === 'image/ktx2';
    return { label: `${t.getName().replace(`${id}_`, '')} ${w}${ktx ? ' ktx2' : ''}`, gpu: gpuBytes(w, h, ktx) };
  });
  const g = maps.reduce((s, m) => s + m.gpu, 0);
  const size = statSync(join(DIR, f)).size;
  [gpu, bytes, n] = [gpu + g, bytes + size, n + 1];
  console.log(`${id.padEnd(28)} GPU ${MB(g).padStart(6)} MB  file ${MB(size).padStart(5)} MB  ${maps.map((m) => m.label).join(', ')}`);
}
console.log(`${n} characters: GPU ${MB(gpu)} MB (${MB(gpu / n)} each), files ${MB(bytes)} MB (${MB(bytes / n)} each)`);
