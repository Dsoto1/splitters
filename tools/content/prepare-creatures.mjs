// Creature content preparation: turns the original Quaternius downloads into
// game-ready creature models for NPCs (see docs/CHARACTERS.md, "Creatures").
//
//   node tools/content/prepare-creatures.mjs <downloads dir>
//
// The downloads directory holds the extracted packs (directly or one level down):
// - "Bestiary - Dungeon Monsters Kit[Standard]" (Quaternius Asset License v1.0:
//   the raw files may not be redistributed, so they never go in the repo; only
//   these processed, game-ready models ship inside the game),
// - "Modular SciFi MegaKit[Standard]" (CC0).
//
// What it does:
// - Imp and Puglin are rigged to the same humanoid skeleton naming as our
//   character rig but ship without animations. Our rig's clips
//   (packages/client/public/characters/rig.glb) are retargeted onto each one:
//   every joint keeps its own rest pose and takes the rig's rotation relative to
//   the rig's rest pose; the hips' motion is scaled to the creature's leg length.
// - The three aliens keep their own spine-chain skeletons and their one idle
//   clip; the game adds walk, attack and death motion procedurally.
// - Meshes are simplified with meshoptimizer, textures downscaled to JPEGs and
//   embedded, metal/roughness maps dropped.
// Outputs go to packages/client/public/creatures and content/creatures.lock.json,
// which `pnpm content:check` verifies (hashes, budgets, licences).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

await MeshoptSimplifier.ready;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/creatures');
const LOCK = join(ROOT, 'content/creatures.lock.json');
const RIG = join(ROOT, 'packages/client/public/characters/rig.glb');
const downloads = process.argv[2] ? resolve(process.argv[2]) : null;
if (!downloads) throw new Error('usage: prepare-creatures.mjs <downloads dir>');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const quiet = new Logger(Logger.Verbosity.WARN);

/** The folder of an extracted download: directly under the downloads dir or one level down. */
function downloadDir(folder) {
  const direct = join(downloads, folder);
  if (existsSync(direct)) return direct;
  for (const d of readdirSync(downloads, { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(join(downloads, d.name, folder))) return join(downloads, d.name, folder);
  }
  throw new Error(`${folder} not found in ${downloads}`);
}
const BESTIARY = 'Bestiary - Dungeon Monsters Kit[Standard]';
const SCIFI = 'Modular SciFi MegaKit[Standard]';

/**
 * The creatures: [our id, pack, file in the download, simplify ratio, rig clips to retarget as [our clip, rig clip]].
 * Clip names the game looks for: idle, walk, run, attack, hit, death.
 */
const CREATURES = [
  ['imp', 'quaternius-bestiary-dungeon-monsters', `${BESTIARY}/Exports/GLB (Godot-Unreal)/Imp.glb`, 0.5, [['idle', 'idle'], ['walk', 'walk'], ['run', 'run'], ['attack', 'melee_heavy'], ['hit', 'hit'], ['death', 'death']]],
  ['puglin', 'quaternius-bestiary-dungeon-monsters', `${BESTIARY}/Exports/GLB (Godot-Unreal)/Puglin.glb`, 0.6, [['idle', 'idle'], ['walk', 'walk'], ['run', 'run'], ['attack', 'melee'], ['hit', 'hit'], ['death', 'death']]],
  ['cyclops', 'quaternius-modular-scifi-megakit', `${SCIFI}/glTF/Aliens/Alien_Cyclop.gltf`, 1, null],
  ['oculus', 'quaternius-modular-scifi-megakit', `${SCIFI}/glTF/Aliens/Alien_Oculichrysalis.gltf`, 0.6, null],
  ['scolitex', 'quaternius-modular-scifi-megakit', `${SCIFI}/glTF/Aliens/Alien_Scolitex.gltf`, 0.5, null],
];

// ---------------------------------------------------------------- quaternions [x, y, z, w]

function qmul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
function qnorm(q) {
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
}

// ---------------------------------------------------------------- retargeting

/**
 * Copy rig clips onto a creature that shares the rig's joint names: rotations
 * as offsets from each skeleton's own rest pose, the hips' movement scaled by
 * leg length. Joints the creature lacks (fingers) are skipped; the rig's root
 * motion is not used (clips are in place).
 */
function retarget(rig, doc, clips) {
  const rigNodes = new Map(rig.getRoot().listNodes().map((n) => [n.getName(), n]));
  const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = doc.getRoot().listBuffers()[0];
  const hip = (n) => Math.hypot(...n.getTranslation());
  const ratio = hip(nodes.get('pelvis')) / hip(rigNodes.get('pelvis'));
  for (const [ours, theirs] of clips) {
    const src = rig.getRoot().listAnimations().find((a) => a.getName() === theirs);
    if (!src) throw new Error(`rig has no clip ${theirs}`);
    const anim = doc.createAnimation(ours);
    for (const ch of src.listChannels()) {
      const name = ch.getTargetNode().getName();
      const path = ch.getTargetPath();
      const node = nodes.get(name);
      if (!node || name === 'root' || (path === 'translation' && name !== 'pelvis') || path === 'scale') continue;
      const sampler = ch.getSampler();
      const input = sampler.getInput().getArray();
      const output = sampler.getOutput().getArray();
      const out = new Float32Array(output.length);
      if (path === 'rotation') {
        const delta = qinv(rigNodes.get(name).getRotation());
        const rest = node.getRotation();
        for (let i = 0; i < output.length; i += 4) out.set(qnorm(qmul(rest, qmul(delta, [output[i], output[i + 1], output[i + 2], output[i + 3]]))), i);
      } else {
        const r0 = rigNodes.get(name).getTranslation();
        const c0 = node.getTranslation();
        for (let i = 0; i < output.length; i += 3) for (let k = 0; k < 3; k++) out[i + k] = c0[k] + (output[i + k] - r0[k]) * ratio;
      }
      const s = doc
        .createAnimationSampler()
        .setInterpolation(sampler.getInterpolation())
        .setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array(input)).setBuffer(buffer))
        .setOutput(doc.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(out).setBuffer(buffer));
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
    }
  }
}

// ---------------------------------------------------------------- materials

/** Base colour, normal and glow maps downscaled to JPEGs; metal/roughness maps dropped for a matte finish. */
async function bakeTextures(doc) {
  const shrink = async (tex, size) => {
    const data = await sharp(Buffer.from(tex.getImage())).resize(size, size, { kernel: 'lanczos3' }).removeAlpha().jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    tex.setImage(data).setMimeType('image/jpeg').setURI('');
  };
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setMetallicRoughnessTexture(null).setOcclusionTexture(null).setMetallicFactor(0).setRoughnessFactor(0.75);
    for (const ext of mat.listExtensions()) ext.dispose();
    if (mat.getBaseColorTexture()) await shrink(mat.getBaseColorTexture(), 512);
    if (mat.getNormalTexture()) await shrink(mat.getNormalTexture(), 512);
    if (mat.getEmissiveTexture()) await shrink(mat.getEmissiveTexture(), 256);
    // The aliens' eyes glow a little.
    if (/Eyes/.test(mat.getName()) && !mat.getEmissiveTexture()) mat.setEmissiveFactor(mat.getBaseColorFactor().slice(0, 3).map((v) => v * 0.6));
  }
}

async function readSource(path) {
  let doc;
  if (path.endsWith('.gltf')) {
    const json = JSON.parse(readFileSync(path, 'utf8'));
    const resources = {};
    for (const b of json.buffers ?? []) resources[b.uri] = new Uint8Array(readFileSync(join(dirname(path), decodeURIComponent(b.uri))));
    doc = await io.readJSON({ json, resources });
  } else doc = await io.read(path);
  doc.setLogger(quiet);
  return doc;
}

const triangles = (doc) => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);

// ---------------------------------------------------------------- main

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const rig = await io.read(RIG);
const lock = { $comment: 'Generated by tools/content/prepare-creatures.mjs. Do not edit by hand.', files: [] };
for (const [id, pack, src, ratio, clips] of CREATURES) {
  const folder = src.split('/')[0];
  const doc = await readSource(join(downloadDir(folder), src.slice(folder.length + 1)));
  await bakeTextures(doc);
  if (clips) {
    // Only our clips ship.
    for (const a of doc.getRoot().listAnimations()) a.dispose();
    retarget(rig, doc, clips);
  } else {
    const [idle, ...rest] = doc.getRoot().listAnimations();
    idle.setName('idle');
    for (const a of rest) a.dispose();
  }
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) for (const a of ['TANGENT', 'TEXCOORD_1', 'COLOR_0']) p.setAttribute(a, null);
  await doc.transform(weld(), dedup(), prune());
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: true }), prune());
  doc.getRoot().getAsset().generator = 'chronosplit prepare-creatures';
  const glb = await io.writeBinary(doc);
  writeFileSync(join(OUT, `${id}.glb`), glb);
  const tris = triangles(doc);
  const names = doc.getRoot().listAnimations().map((a) => a.getName());
  console.log(`${`${id}.glb`.padEnd(16)} ${String(tris).padStart(6)} tris ${(glb.byteLength / 1024).toFixed(0).padStart(5)} KB  clips: ${names.join(', ')}`);
  lock.files.push({ file: `creatures/${id}.glb`, id, source: pack, src: src.split('/').at(-1), clips: names, triangles: tris, bytes: glb.byteLength, sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16) });
}
writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`wrote ${lock.files.length} creatures and content/creatures.lock.json`);
