// Converts the props picked from Quaternius' OBJ-only packs (Survival, Ultimate
// House Interior, Ultimate Nature, Modular Ruins, Modular Dungeon) into small
// GLBs in assets-src/<pack>/, which prepare-props.mjs then builds like any
// other prop. Only the props listed in content/props.json are converted; the
// packs themselves (FBX, OBJ and Blender files for every piece) stay out of
// the repo.
//
//   node tools/content/prepare-obj-props.mjs --downloads <dir holding the extracted packs>
//
// A pack opts in with `objSource` in content/props.json: the folder of OBJ
// files inside its download, e.g. "Survival Pack - Sept 2020/OBJ".
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { dedup, weld } from '@gltf-transform/functions';
import { objToDocument } from './obj.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'content/props.json'), 'utf8'));
const arg = process.argv.indexOf('--downloads');
if (arg < 0) throw new Error('usage: prepare-obj-props.mjs --downloads <dir>');
const downloads = resolve(process.argv[arg + 1]);
const io = new NodeIO();
const identity = { point: (x, y, z) => [x, y, z], normal: (x, y, z) => [x, y, z] };

/** An OBJ folder directly under the downloads dir or one level down. */
function sourceDir(folder) {
  if (existsSync(join(downloads, folder))) return join(downloads, folder);
  for (const d of readdirSync(downloads, { withFileTypes: true })) if (d.isDirectory() && existsSync(join(downloads, d.name, folder))) return join(downloads, d.name, folder);
  throw new Error(`${folder} not found in ${downloads}`);
}

for (const [packId, pack] of Object.entries(manifest.packs)) {
  if (!pack.objSource) continue;
  const dir = sourceDir(pack.objSource);
  const out = join(ROOT, 'assets-src', packId);
  mkdirSync(out, { recursive: true });
  copyFileSync(join(dir, '..', 'License.txt'), join(out, 'License.txt'));
  let n = 0;
  for (const p of manifest.props.filter((p) => p.pack === packId)) {
    const doc = objToDocument(join(dir, p.src.replace(/\.glb$/, '.obj')), identity);
    await doc.transform(weld(), dedup());
    writeFileSync(join(out, p.src), await io.writeBinary(doc));
    n++;
  }
  console.log(`${packId}: ${n} props`);
}
