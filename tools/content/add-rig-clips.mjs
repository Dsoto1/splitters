// Add clips from Quaternius' Universal Animation Library 2 (CC0) to the
// shared rig without rebuilding every character (that needs all the source
// packs; see prepare-characters.mjs, whose CLIPS list includes these too):
//
//   node tools/content/add-rig-clips.mjs <path to UAL2_Standard.glb>
//
// The clips get the same treatment as in prepare-characters.mjs: only the
// root and pelvis keep translations (so they fit every body), finger tracks
// beyond the roots and scale tracks go, and keys are resampled. Clips already
// in the rig are replaced. Updates the rig's entry in characters.lock.json.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample } from '@gltf-transform/functions';

/** [UAL2 clip, name in the rig]. */
export const UAL2_EXTRA_CLIPS = [
  ['Zombie_Idle_Loop', 'zombie_idle'],
  ['Zombie_Walk_Fwd_Loop', 'zombie_walk'],
  ['Zombie_Scratch', 'zombie_attack'],
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RIG = join(ROOT, 'packages/client/public/characters/rig.glb');
const LOCK = join(ROOT, 'content/characters.lock.json');
const source = process.argv[2];
if (!source) throw new Error('usage: add-rig-clips.mjs <UAL2_Standard.glb>');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(RIG);
const src = await io.read(source);
const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
const buffer = doc.getRoot().listBuffers()[0];

for (const [clip, name] of UAL2_EXTRA_CLIPS) {
  const from = src.getRoot().listAnimations().find((a) => a.getName() === clip);
  if (!from) throw new Error(`UAL2 has no clip ${clip}`);
  doc.getRoot().listAnimations().find((a) => a.getName() === name)?.dispose();
  const anim = doc.createAnimation(name);
  for (const ch of from.listChannels()) {
    const n = ch.getTargetNode()?.getName() ?? '';
    const target = nodes.get(n);
    const path = ch.getTargetPath();
    // Translations would impose the mannequin's proportions on other bodies; only the hips move.
    if (!target || path === 'scale' || (path === 'translation' && n !== 'root' && n !== 'pelvis') || /_0[234](_leaf)?_[lr]$/.test(n)) continue;
    const s = ch.getSampler();
    const input = doc.createAccessor().setType(s.getInput().getType()).setArray(s.getInput().getArray().slice()).setBuffer(buffer);
    const output = doc.createAccessor().setType(s.getOutput().getType()).setArray(s.getOutput().getArray().slice()).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(path).setSampler(sampler));
  }
}
await doc.transform(resample({ tolerance: 4e-3 }));
for (const acc of doc.getRoot().listAccessors()) if (acc.listParents().every((p) => p.propertyType === 'Root')) acc.dispose();
const glb = await io.writeBinary(doc);
writeFileSync(RIG, glb);

const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
const entry = lock.files.find((f) => f.role === 'rig');
entry.sha256 = createHash('sha256').update(glb).digest('hex').slice(0, 16);
entry.bytes = glb.byteLength;
writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`rig.glb: ${doc.getRoot().listAnimations().length} clips, ${(glb.byteLength / 1024).toFixed(0)} KB`);
