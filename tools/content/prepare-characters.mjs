// Character content preparation: turns the original Quaternius downloads
// (Universal Base Characters, Modular Character Outfits – Fantasy, Universal
// Animation Library 1 + 2; all CC0) into game-ready parts that share one rig.
//
//   node tools/content/prepare-characters.mjs <downloads dir>
//
// The downloads are ~500 MB, so they stay out of the repo; this script is the
// record of exactly what we did to them. Outputs go to
// packages/client/public/characters and content/characters.lock.json, which
// `pnpm content:check` verifies (hashes, budgets, licences).
//
// What it does:
// - rig.glb: the mannequin body + 65-joint skeleton + a trimmed set of animation
//   clips from both libraries (in-place versions, no root motion).
// - heads: cut out of the full base bodies by keeping only triangles skinned
//   mostly to the neck/head bones (the outfit readme says to use only the head).
// - outfits and hair: simplified with meshoptimizer, normal/roughness maps
//   dropped, base colour downscaled to 1024 px JPEG.
// - every part's skin uses the rig's joint order, so the game can attach any
//   part to one shared skeleton (the basis of the Character Designer).

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/characters');
const LOCK = join(ROOT, 'content/characters.lock.json');
const downloads = process.argv[2];
if (!downloads) throw new Error('usage: prepare-characters.mjs <downloads dir>');

const find = (rel) => {
  const p = join(downloads, rel);
  if (!existsSync(p)) throw new Error(`missing ${p}`);
  return p;
};
const BASE = 'x_UniversalBaseCharactersStandardzip/Universal Base Characters[Standard]';
const OUTFITS = 'x_outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)';
const OUTFIT_TEX = 'x_outfits/Modular Character Outfits - Fantasy[Standard]/Textures';
const UAL1 = 'x_UniversalAnimationLibraryStandardzip/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';
const UAL2 = 'x_UniversalAnimationLibrary2Standardzip/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb';

/** Clips the game uses, renamed to stable IDs. [source library, clip, our name]. */
const CLIPS = [
  [UAL1, 'Idle_Loop', 'idle'],
  [UAL1, 'Pistol_Idle_Loop', 'aim_idle'],
  [UAL1, 'Walk_Loop', 'walk'],
  [UAL1, 'Jog_Fwd_Loop', 'run'],
  [UAL1, 'Sprint_Loop', 'sprint'],
  [UAL1, 'Jump_Start', 'jump_start'],
  [UAL1, 'Jump_Loop', 'jump_air'],
  [UAL1, 'Jump_Land', 'jump_land'],
  [UAL1, 'Death01', 'death'],
  [UAL1, 'Hit_Chest', 'hit'],
  [UAL1, 'Pistol_Shoot', 'shoot'],
  [UAL1, 'Pistol_Reload', 'reload'],
  [UAL1, 'Punch_Cross', 'melee'],
  [UAL1, 'Sword_Attack', 'melee_heavy'],
  [UAL1, 'Interact', 'interact'],
  [UAL1, 'Dance_Loop', 'dance'],
  [UAL2, 'Hit_Knockback', 'knockback'],
  [UAL2, 'OverhandThrow', 'throw'],
  [UAL2, 'Yes', 'cheer'],
  [UAL2, 'Idle_FoldArms_Loop', 'idle_arms'],
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const tmp = mkdtempSync(join(tmpdir(), 'chars-'));

/** Read a .gltf whose image URIs may be wrong (the base pack references "X_png.png" files that ship as "X.png"). */
async function readGltf(path) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const dir = dirname(path);
  const resources = {};
  for (const b of json.buffers ?? []) resources[b.uri] = new Uint8Array(readFileSync(join(dir, decodeURIComponent(b.uri))));
  for (const img of json.images ?? []) {
    let file = join(dir, decodeURIComponent(img.uri));
    if (!existsSync(file)) file = file.replace(/_png\.png$/, '.png');
    // Normal/roughness maps are dropped later; a placeholder keeps the reader happy if one is missing.
    resources[img.uri] = existsSync(file) ? new Uint8Array(readFileSync(file)) : new Uint8Array();
  }
  return io.readJSON({ json, resources });
}

/** Downscale a PNG to a 1024 px JPEG (ffmpeg; this script only runs on a dev machine). */
function jpeg(pngPath, size = 1024) {
  const out = join(tmp, `${basename(pngPath, '.png')}_${size}.jpg`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', pngPath, '-vf', `scale=${size}:${size}:flags=lanczos`, '-q:v', '3', out]);
  return new Uint8Array(readFileSync(out));
}

/** Keep base colour only: drop normal/ORM/roughness maps and set a matte finish. */
function simplifyMaterials(doc, baseColors) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null);
    mat.setMetallicFactor(0).setRoughnessFactor(0.85);
    const replacement = baseColors[mat.getName()];
    if (replacement) {
      const tex = doc.createTexture(`${mat.getName()}_base`).setImage(replacement).setMimeType('image/jpeg');
      mat.setBaseColorTexture(tex);
    } else {
      const t = mat.getBaseColorTexture();
      if (t && t.getMimeType() === 'image/png' && t.getImage()?.byteLength > 600_000) throw new Error(`material ${mat.getName()} needs a downscaled base colour`);
    }
  }
}

/** Remap a part's JOINTS_0 to the rig's joint order (by joint name) and make its skin list match. */
function conformSkin(doc, rigJointNames) {
  for (const skin of doc.getRoot().listSkins()) {
    const names = skin.listJoints().map((j) => j.getName());
    const map = names.map((n) => {
      const i = rigJointNames.indexOf(n);
      if (i < 0) throw new Error(`joint ${n} is not in the rig`);
      return i;
    });
    const identity = map.every((m, i) => m === i) && names.length === rigJointNames.length;
    if (identity) continue;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const acc = prim.getAttribute('JOINTS_0');
        if (!acc) continue;
        const a = acc.getArray().slice();
        for (let i = 0; i < a.length; i++) a[i] = map[a[i]];
        acc.setArray(a);
      }
    }
    // Rebuild the skin in rig order, reusing the part's own joint nodes.
    const byName = new Map(skin.listJoints().map((j) => [j.getName(), j]));
    for (const j of skin.listJoints()) skin.removeJoint(j);
    for (const n of rigJointNames) {
      const node = byName.get(n);
      if (!node) throw new Error(`part skeleton lacks ${n}`);
      skin.addJoint(node);
    }
    skin.setInverseBindMatrices(null);
  }
}

// ---------------------------------------------------------------- matrices (column-major 4x4)

function mul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function invert(m) {
  const inv = new Float64Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  for (let i = 0; i < 16; i++) inv[i] /= det;
  return inv;
}

/**
 * Move a skinned part into another bind pose (same joints, different body
 * proportions): each vertex is carried by its bones from the old rest pose to
 * the new one, then the part takes the new inverse bind matrices. Afterwards it
 * can share a skeleton with every other part made for that body.
 */
function rebind(doc, targetIbm) {
  const skin = doc.getRoot().listSkins()[0];
  const src = skin.getInverseBindMatrices().getArray();
  const n = src.length / 16;
  const M = [];
  for (let j = 0; j < n; j++) M.push(mul(invert(targetIbm.subarray(j * 16, j * 16 + 16)), src.subarray(j * 16, j * 16 + 16)));
  const done = new Set();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION');
      const N = prim.getAttribute('NORMAL');
      const J = prim.getAttribute('JOINTS_0')?.getArray();
      const W = prim.getAttribute('WEIGHTS_0')?.getArray();
      if (!J || done.has(P)) continue;
      done.add(P);
      const p = P.getArray().slice();
      const nr = N && !done.has(N) ? N.getArray().slice() : null;
      if (N) done.add(N);
      for (let v = 0; v < P.getCount(); v++) {
        let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
        for (let k = 0; k < 4; k++) {
          const w = W[v * 4 + k];
          if (!w) continue;
          const m = M[J[v * 4 + k]];
          const [px, py, pz] = [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]];
          x += w * (m[0] * px + m[4] * py + m[8] * pz + m[12]);
          y += w * (m[1] * px + m[5] * py + m[9] * pz + m[13]);
          z += w * (m[2] * px + m[6] * py + m[10] * pz + m[14]);
          if (nr) {
            const [qx, qy, qz] = [nr[v * 3], nr[v * 3 + 1], nr[v * 3 + 2]];
            nx += w * (m[0] * qx + m[4] * qy + m[8] * qz);
            ny += w * (m[1] * qx + m[5] * qy + m[9] * qz);
            nz += w * (m[2] * qx + m[6] * qy + m[10] * qz);
          }
        }
        p[v * 3] = x;
        p[v * 3 + 1] = y;
        p[v * 3 + 2] = z;
        if (nr) {
          const l = Math.hypot(nx, ny, nz) || 1;
          nr[v * 3] = nx / l;
          nr[v * 3 + 1] = ny / l;
          nr[v * 3 + 2] = nz / l;
        }
      }
      P.setArray(p);
      if (nr) N.setArray(nr);
    }
  }
  skin.getInverseBindMatrices().setArray(new Float32Array(targetIbm));
}

/** Inverse bind matrices of a source glTF (the reference body for its sex). */
async function bindPose(path) {
  return new Float32Array((await readGltf(path)).getRoot().listSkins()[0].getInverseBindMatrices().getArray());
}

/** Keep only triangles whose three vertices are skinned mostly to one of `bones`. */
function keepByBones(doc, meshName, bones) {
  const mesh = doc.getRoot().listMeshes().find((m) => m.getName() === meshName);
  if (!mesh) throw new Error(`no mesh ${meshName}`);
  const skin = doc.getRoot().listSkins()[0];
  const jointNames = skin.listJoints().map((j) => j.getName());
  for (const prim of mesh.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0').getArray();
    const W = prim.getAttribute('WEIGHTS_0').getArray();
    const dominant = (v) => {
      let best = 0;
      for (let k = 1; k < 4; k++) if (W[v * 4 + k] > W[v * 4 + best]) best = k;
      return jointNames[J[v * 4 + best]];
    };
    const idx = prim.getIndices().getArray();
    const keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      if ([idx[i], idx[i + 1], idx[i + 2]].every((v) => bones.has(dominant(v)))) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    prim.getIndices().setArray(new Uint32Array(keep));
  }
}

async function finish(doc, out, { ratio = 1 } = {}) {
  await doc.transform(dedup(), prune({ keepAttributes: false }), weld());
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: true }));
  await doc.transform(prune());
  // Accessors left behind by discarded animation tracks (prune keeps some of them).
  for (const acc of doc.getRoot().listAccessors()) if (acc.listParents().every((p) => p.propertyType === 'Root')) acc.dispose();
  doc.getRoot().getAsset().generator = 'chronosplit prepare-characters';
  const glb = await io.writeBinary(doc);
  writeFileSync(join(OUT, out), glb);
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  console.log(`${out.padEnd(28)} ${String(tris).padStart(6)} tris ${(glb.byteLength / 1024).toFixed(0).padStart(6)} KB`);
  return { file: `characters/${out}`, sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), triangles: tris, bytes: glb.byteLength };
}

await MeshoptSimplifier.ready;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const lock = { $comment: 'Generated by tools/content/prepare-characters.mjs. Do not edit by hand.', rigJoints: [], files: [] };

// ---------------------------------------------------------------- rig + animations

{
  const doc = await io.read(find(UAL1));
  const rigJointNames = doc.getRoot().listSkins()[0].listJoints().map((j) => j.getName());
  lock.rigJoints = rigJointNames;
  const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const wanted = new Map(CLIPS.filter(([lib]) => lib === UAL1).map(([, clip, name]) => [clip, name]));
  for (const anim of doc.getRoot().listAnimations()) {
    const name = wanted.get(anim.getName());
    if (name) anim.setName(name);
    else {
      // Samplers outlive their animation otherwise, and keep every keyframe accessor alive.
      for (const c of anim.listChannels()) c.dispose();
      for (const smp of anim.listSamplers()) smp.dispose();
      anim.dispose();
    }
  }
  // Clips from the second library: copy channels onto the same-named joints.
  const doc2 = await io.read(find(UAL2));
  const buffer = doc.getRoot().listBuffers()[0];
  for (const [lib, clip, name] of CLIPS) {
    if (lib !== UAL2) continue;
    const src = doc2.getRoot().listAnimations().find((a) => a.getName() === clip);
    if (!src) throw new Error(`UAL2 has no clip ${clip}`);
    const anim = doc.createAnimation(name);
    for (const ch of src.listChannels()) {
      const target = nodes.get(ch.getTargetNode().getName());
      if (!target) continue;
      const s = ch.getSampler();
      const input = doc.createAccessor().setType(s.getInput().getType()).setArray(s.getInput().getArray().slice()).setBuffer(buffer);
      const output = doc.createAccessor().setType(s.getOutput().getType()).setArray(s.getOutput().getArray().slice()).setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
  }
  const missing = CLIPS.filter(([, , name]) => !doc.getRoot().listAnimations().some((a) => a.getName() === name));
  if (missing.length) throw new Error(`missing clips: ${missing.map((m) => m[1])}`);
  // Fingers only need the clips' broad pose: drop their tracks except the finger roots, and strip redundant keys.
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const n = ch.getTargetNode()?.getName() ?? '';
      // Translations would impose the mannequin's proportions on other bodies; only the hips move.
      const translationOk = n === 'root' || n === 'pelvis';
      if (/_0[234](_leaf)?_[lr]$/.test(n) || ch.getTargetPath() === 'scale' || (ch.getTargetPath() === 'translation' && !translationOk)) ch.dispose();
    }
    const used = new Set(anim.listChannels().map((c) => c.getSampler()));
    for (const smp of anim.listSamplers()) if (!used.has(smp)) smp.dispose();
  }
  await doc.transform(resample({ tolerance: 4e-3 }));
  // The mannequin stays in the rig: it's the NPC body, recoloured per faction.
  for (const m of doc.getRoot().listMaterials()) m.setMetallicFactor(0).setRoughnessFactor(0.7);
  lock.files.push({ role: 'rig', source: 'quaternius-universal-animation-library, quaternius-universal-animation-library-2', ...(await finish(doc, 'rig.glb')) });
}

// ---------------------------------------------------------------- heads

// Every part is rebound to the "Regular" body of its sex, which the outfits are made for.
const BIND = { Male: await bindPose(find(`${OUTFITS}/Outfits/Male_Ranger.gltf`)), Female: await bindPose(find(`${OUTFITS}/Outfits/Female_Ranger.gltf`)) };

const skin = (sex) => jpeg(find(`${OUTFIT_TEX}/Base/T_Regular_${sex}_Dark_BaseColor.png`));
for (const sex of ['Male', 'Female']) {
  const doc = await readGltf(find(`${BASE}/Base Characters/Godot - UE/Superhero_${sex}_FullBody.gltf`));
  const body = doc.getRoot().listMeshes().find((m) => /SuperHero|Superhero/.test(m.getName()) || m.getName().startsWith('Sphere'));
  keepByBones(doc, body.getName(), new Set(['Head', 'neck_01']));
  conformSkin(doc, lock.rigJoints);
  rebind(doc, BIND[sex]);
  const hairTex = (n) => jpeg(find(`${BASE}/Base Characters/Godot - UE/T_Hair_${n}_BaseColor.png`), 512);
  simplifyMaterials(doc, { [`MI_Superhero_${sex}`]: skin(sex), MI_Hair_1: hairTex(1), MI_Hair_2: hairTex(2) });
  lock.files.push({ role: 'head', id: `head_${sex.toLowerCase()}`, body: sex.toLowerCase(), source: 'quaternius-universal-base-characters', ...(await finish(doc, `head_${sex.toLowerCase()}.glb`)) });
}

// ---------------------------------------------------------------- outfits

const OUTFIT_LIST = [
  ['Male_Ranger', 'outfit_ranger_m', 0.45],
  ['Female_Ranger', 'outfit_ranger_f', 0.45],
  ['Male_Peasant', 'outfit_peasant_m', 0.7],
  ['Female_Peasant', 'outfit_peasant_f', 0.7],
];
const rangerBase = jpeg(find(`${OUTFIT_TEX}/Ranger/T_Ranger_BaseColor.png`));
const peasantBase = jpeg(find(`${OUTFIT_TEX}/Peasant/T_Peasant_BaseColor.png`));
for (const [src, id, ratio] of OUTFIT_LIST) {
  const doc = await readGltf(find(`${OUTFITS}/Outfits/${src}.gltf`));
  conformSkin(doc, lock.rigJoints);
  simplifyMaterials(doc, { MI_Ranger: rangerBase, MI_Peasant: peasantBase, MI_Regular_Male: skin('Male'), MI_Regular_Female: skin('Female') });
  lock.files.push({ role: 'outfit', id, body: id.endsWith('_m') ? 'male' : 'female', source: 'quaternius-modular-outfits-fantasy', ...(await finish(doc, `${id}.glb`, { ratio })) });
}

// Alternative colourways: just the base colour texture, swapped in at runtime.
mkdirSync(join(OUT, 'textures'), { recursive: true });
for (const [png, id] of [
  ['Ranger/T_Ranger_3_BaseColor.png', 'ranger_moss'],
  ['Peasant/T_Peasant_2_BaseColor.png', 'peasant_dusk'],
]) {
  const data = jpeg(find(`${OUTFIT_TEX}/${png}`));
  writeFileSync(join(OUT, 'textures', `${id}.jpg`), data);
  lock.files.push({ role: 'texture', id, source: 'quaternius-modular-outfits-fantasy', file: `characters/textures/${id}.jpg`, sha256: createHash('sha256').update(data).digest('hex').slice(0, 16), triangles: 0, bytes: data.byteLength });
  console.log(`textures/${id}.jpg ${(data.byteLength / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------- hair

/** Hairstyles and the body they are fitted to. */
const HAIR = [
  ['Hair_SimpleParted', 'Male'],
  ['Hair_Buzzed', 'Male'],
  ['Hair_Beard', 'Male'],
  ['Hair_Long', 'Female'],
  ['Hair_Buns', 'Female'],
];
const hairDir = `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
for (const [h, sex] of HAIR) {
  const doc = await readGltf(find(`${hairDir}/${h}.gltf`));
  conformSkin(doc, lock.rigJoints);
  rebind(doc, BIND[sex]);
  const mats = Object.fromEntries(doc.getRoot().listMaterials().map((m) => [m.getName(), jpeg(find(`${hairDir}/T_Hair_${m.getName().endsWith('1') ? 1 : 2}_BaseColor.png`), 512)]));
  simplifyMaterials(doc, mats);
  const id = h.toLowerCase();
  lock.files.push({ role: 'hair', id, body: sex.toLowerCase(), source: 'quaternius-universal-base-characters', ...(await finish(doc, `${id}.glb`, { ratio: 0.6 })) });
}

writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${lock.files.length} files and content/characters.lock.json`);
void readdirSync;
void Document;
