// Creature content preparation: turns the original Quaternius downloads into
// game-ready creature models for NPCs (see docs/CHARACTERS.md, "Creatures").
//
//   node tools/content/prepare-creatures.mjs <downloads dir>
//
// The downloads directory holds the extracted packs (directly or one level down):
// - "Bestiary - Dungeon Monsters Kit[Standard]" (Quaternius Asset License v1.0:
//   the raw files may not be redistributed, so they never go in the repo; only
//   these processed, game-ready models ship inside the game),
// - "Modular SciFi MegaKit[Standard]" (CC0),
// - "Zombie by @Quaternius" (CC0; the download's own folder name).
//
// A creature whose download is not in the directory is kept as built (its file
// must still match content/creatures.lock.json), so one pack can be rebuilt
// without the others.
//
// What it does:
// - Imp and Puglin are rigged to the same humanoid skeleton naming as our
//   character rig but ship without animations. Our rig's clips
//   (packages/client/public/characters/rig.glb) are retargeted onto each one:
//   every joint keeps its own rest pose and takes the rig's rotation relative to
//   the rig's rest pose; the hips' motion is scaled to the creature's leg length.
// - The three aliens keep their own spine-chain skeletons and their one idle
//   clip; the game adds walk, attack and death motion procedurally.
// - The zombie is an FBX with its own rig and clips (idle, walk, run, bite,
//   crawl): converted with tools/content/fbx.mjs, its clips renamed to ours
//   (the bite trimmed to its lunge), its 32 px palette texture embedded as it
//   is. It has no death clip; the game drops it procedurally.
// - Meshes are simplified with meshoptimizer, textures downscaled to JPEGs and
//   embedded, metal/roughness maps dropped.
// Outputs go to packages/client/public/creatures and content/creatures.lock.json,
// which `pnpm content:check` verifies (hashes, budgets, licences).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO, TextureInfo } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { fbxRiggedToGlb } from './fbx.mjs';

await MeshoptSimplifier.ready;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/creatures');
const LOCK = join(ROOT, 'content/creatures.lock.json');
const RIG = join(ROOT, 'packages/client/public/characters/rig.glb');
const downloads = process.argv[2] ? resolve(process.argv[2]) : null;
if (!downloads) throw new Error('usage: prepare-creatures.mjs <downloads dir>');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const quiet = new Logger(Logger.Verbosity.WARN);

/** The folder of an extracted download: directly under the downloads dir or one level down (null: not there). */
function downloadDir(folder) {
  const direct = join(downloads, folder);
  if (existsSync(direct)) return direct;
  for (const d of readdirSync(downloads, { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(join(downloads, d.name, folder))) return join(downloads, d.name, folder);
  }
  return null;
}
const BESTIARY = 'Bestiary - Dungeon Monsters Kit[Standard]';
const SCIFI = 'Modular SciFi MegaKit[Standard]';
const ZOMBIE = 'Zombie by @Quaternius';

/**
 * The creatures: [our id, pack, file in the download, simplify ratio, rig clips to retarget as [our clip, rig clip],
 * and for a rigged FBX its own clips as [our clip, its clip, first frame, last frame], its height and palette].
 * Clip names the game looks for: idle, walk, run, attack, hit, death.
 */
const CREATURES = [
  ['imp', 'quaternius-bestiary-dungeon-monsters', `${BESTIARY}/Exports/GLB (Godot-Unreal)/Imp.glb`, 0.5, [['idle', 'idle'], ['walk', 'walk'], ['run', 'run'], ['attack', 'melee_heavy'], ['hit', 'hit'], ['death', 'death']]],
  ['puglin', 'quaternius-bestiary-dungeon-monsters', `${BESTIARY}/Exports/GLB (Godot-Unreal)/Puglin.glb`, 0.6, [['idle', 'idle'], ['walk', 'walk'], ['run', 'run'], ['attack', 'melee'], ['hit', 'hit'], ['death', 'death']]],
  ['cyclops', 'quaternius-modular-scifi-megakit', `${SCIFI}/glTF/Aliens/Alien_Cyclop.gltf`, 1, null],
  ['oculus', 'quaternius-modular-scifi-megakit', `${SCIFI}/glTF/Aliens/Alien_Oculichrysalis.gltf`, 0.6, null],
  ['scolitex', 'quaternius-modular-scifi-megakit', `${SCIFI}/glTF/Aliens/Alien_Scolitex.gltf`, 0.5, null],
  [
    'zombie',
    'quaternius-zombie',
    `${ZOMBIE}/FBX/Zombie.fbx`,
    1,
    null,
    // The bite lunges in over its first 1.8 s (then holds and backs off for three more): that part is the attack.
    { clips: [['idle', 'ZombieIdle'], ['walk', 'ZombieWalk'], ['run', 'ZombieRun'], ['attack', 'ZombieBite', 0, 43]], height: 1.8, palette: `${ZOMBIE}/Blends/ZombieTexture.png` },
  ],
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

mkdirSync(OUT, { recursive: true });
const oldLock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { files: [] };
const rig = await io.read(RIG);
const lock = { $comment: 'Generated by tools/content/prepare-creatures.mjs. Do not edit by hand.', files: [] };
for (const [id, pack, src, ratio, clips, fbx] of CREATURES) {
  const folder = src.split('/')[0];
  const dir = downloadDir(folder);
  const file = `creatures/${id}.glb`;
  if (!dir) {
    // Not rebuilding this one: keep it as built.
    const was = oldLock.files.find((f) => f.file === file);
    const path = join(OUT, `${id}.glb`);
    if (!was || !existsSync(path) || createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16) !== was.sha256) throw new Error(`${folder} not found in ${downloads}, and ${file} is not built as content/creatures.lock.json records`);
    console.log(`${`${id}.glb`.padEnd(16)} kept (no ${folder} in the downloads)`);
    lock.files.push(was);
    continue;
  }
  const path = join(dir, src.slice(folder.length + 1));
  let doc;
  if (fbx) {
    doc = await io.readBinary(await fbxRiggedToGlb(path, fbx));
    doc.setLogger(quiet);
    // The FBX's UVs come out as three.js keeps them (V up, origin bottom left); glTF reads textures from the
    // top left, so they are flipped for the palette to land where the pack paints it (pale green skin, blue jeans).
    for (const m of doc.getRoot().listMeshes())
      for (const p of m.listPrimitives()) {
        const uv = p.getAttribute('TEXCOORD_0');
        if (!uv) continue;
        const a = uv.getArray().slice();
        for (let i = 1; i < a.length; i += 2) a[i] = 1 - a[i];
        uv.setArray(a);
      }
    // Its palette (a 32 px strip of flat colours) goes in as it is, sampled without blur.
    const tex = doc.createTexture('palette').setImage(readFileSync(join(downloadDir(fbx.palette.split('/')[0]), fbx.palette.slice(fbx.palette.indexOf('/') + 1)))).setMimeType('image/png');
    for (const mat of doc.getRoot().listMaterials()) {
      mat.setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.85);
      mat.getBaseColorTextureInfo().setMagFilter(TextureInfo.MagFilter.NEAREST).setMinFilter(TextureInfo.MinFilter.NEAREST);
    }
  } else {
    doc = await readSource(path);
    await bakeTextures(doc);
  }
  if (clips) {
    // Only our clips ship.
    for (const a of doc.getRoot().listAnimations()) a.dispose();
    retarget(rig, doc, clips);
  } else if (!fbx) {
    const [idle, ...rest] = doc.getRoot().listAnimations();
    idle.setName('idle');
    for (const a of rest) a.dispose();
  }
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) for (const a of ['TANGENT', 'TEXCOORD_1', 'COLOR_0']) p.setAttribute(a, null);
  await doc.transform(weld(), dedup(), ...(fbx ? [resample()] : []), prune());
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: true }), prune());
  doc.getRoot().getAsset().generator = 'tiletrigger prepare-creatures';
  const glb = await io.writeBinary(doc);
  writeFileSync(join(OUT, `${id}.glb`), glb);
  const tris = triangles(doc);
  const names = doc.getRoot().listAnimations().map((a) => a.getName());
  console.log(`${`${id}.glb`.padEnd(16)} ${String(tris).padStart(6)} tris ${(glb.byteLength / 1024).toFixed(0).padStart(5)} KB  clips: ${names.join(', ')}`);
  lock.files.push({ file, id, source: pack, src: src.split('/').at(-1), clips: names, triangles: tris, bytes: glb.byteLength, sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16) });
}
// Files of creatures no longer listed.
for (const f of readdirSync(OUT)) if (!lock.files.some((x) => x.file === `creatures/${f}`)) rmSync(join(OUT, f));
writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`wrote ${lock.files.length} creatures and content/creatures.lock.json`);
