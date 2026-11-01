// The low-detail copy of characters already built (packages/client/public/characters/<id>.glb), made again from
// the body in the file (character-lod.mjs), without the raw download: for a share set in the manifest
// (`fixes.lod`) or a change in how the copy is cut. content/meshy.lock.json is updated.
//
//   node tools/content/relod-built.mjs            every built character with a manifest
//   ONLY=<ids> node tools/content/relod-built.mjs just those
//   OUT=<dir> ...                                 a trial: the files written to <dir>, the lock left alone
//
// prepare-meshy-characters.mjs makes the same copy at import, so a rebuild from the download keeps it.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { buildSpec, readManifests } from './character-manifests.mjs';
import { addLowDetail } from './character-lod.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = join(ROOT, 'packages/client/public/characters');
const TRIAL = process.env.OUT ? resolve(process.env.OUT) : null;
const LOCK = join(ROOT, 'content/meshy.lock.json');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const only = process.env.ONLY?.split(',').filter(Boolean);
const specs = readManifests({ ready: true }).map(buildSpec);
for (const id of only ?? []) if (!specs.some((c) => c.id === id)) throw new Error(`ONLY: no manifest content/characters/${id}.json`);
const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
if (TRIAL) mkdirSync(TRIAL, { recursive: true });

for (const c of specs) {
  if (only && !only.includes(c.id)) continue;
  const entry = lock.files.find((f) => f.id === c.id);
  const path = join(DIR, `${c.id}.glb`);
  if (!entry || !existsSync(path)) {
    console.log(`${c.id.padEnd(24)} not built`);
    continue;
  }
  const doc = await io.read(path);
  const root = doc.getRoot();
  // Out with the old copy.
  for (const node of root.listNodes()) {
    if (!/_lod$/.test(node.getName())) continue;
    const mesh = node.getMesh();
    node.dispose();
    mesh?.dispose();
  }
  await doc.transform(prune({ keepAttributes: true }));
  const lodTriangles = addLowDetail(doc, c.lod, (l) => console.log(`  ${c.id} ${l}`));
  root.getAsset().generator = 'tiletrigger prepare-meshy-characters';
  const glb = await io.writeBinary(doc);
  const out = join(TRIAL ?? DIR, `${c.id}.glb`);
  writeFileSync(out, glb);
  console.log(`${c.id.padEnd(24)} low detail ${entry.lodTriangles} → ${lodTriangles} triangles, ${(entry.bytes / 1024).toFixed(0)} → ${(glb.byteLength / 1024).toFixed(0)} KB`);
  if (!TRIAL) Object.assign(entry, { sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), lodTriangles, bytes: glb.byteLength });
}
if (!TRIAL) writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
