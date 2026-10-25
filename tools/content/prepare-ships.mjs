// Trim Quaternius' Ultimate Spaceships (CC0) down to the ships the game uses:
// the pack is 260 MB (Blender files and five 2048² colour textures per ship).
// Each chosen ship keeps its mesh and one colour texture, shrunk to 512² JPEG,
// and is written as a GLB to assets-src/quaternius-ultimate-spaceships, where
// content/models.json picks it up like any other source model.
//
//   node tools/content/prepare-ships.mjs <extracted "Ultimate Spaceships - May 2021" folder>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import sharp from 'sharp';

/** [ship, colour texture]. */
export const SHIPS = [
  ['Striker', 'Red'],
  ['Dispatcher', 'Orange'],
  ['Spitfire', 'Blue'],
  ['Imperial', 'Green'],
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'assets-src/quaternius-ultimate-spaceships');
const source = process.argv[2];
if (!source) throw new Error('usage: prepare-ships.mjs <Ultimate Spaceships folder>');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'License.txt'), readFileSync(join(source, 'License.txt')));
for (const [ship, colour] of SHIPS) {
  const doc = await io.read(join(source, ship, 'glTF', `${ship}.gltf`));
  const png = readFileSync(join(source, ship, 'Textures', `${ship}_${colour}.png`));
  const jpg = await sharp(png).resize(512, 512, { kernel: 'lanczos3' }).removeAlpha().jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  for (const tex of doc.getRoot().listTextures()) tex.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg').setName(`${ship}_${colour}`);
  await doc.transform(prune());
  const glb = await io.writeBinary(doc);
  writeFileSync(join(OUT, `${ship}.glb`), glb);
  console.log(`${ship}.glb ${glb.byteLength} B`);
}
