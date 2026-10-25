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
// - base bodies: the base characters below the neck, cut into torso, legs and
//   feet (the "athlete" parts).
// - outfit parts (arms, torso, legs, feet, hood, pauldrons) and hair: simplified
//   with meshoptimizer, normal/roughness maps dropped, base colour downscaled
//   to 1024 px JPEG.
// - mannequin_f.glb: the female mannequin, rebound to the rig (NPC bodies).
// - every part's skin uses the rig's joint order and its body's bind and rest
//   pose, so the game can attach any part to one shared skeleton (the basis
//   of the Character Designer).

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, prune, resample, simplify, simplifyPrimitive, weld } from '@gltf-transform/functions';
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
// The Source edition of the first library (a superset: same skeleton, 120 clips including crawling and
// directional crouching) is used when it's in the downloads; otherwise the free Standard edition.
const UAL1_SOURCE = 'x_UniversalAnimationLibrarySourcezip/Unreal-Godot/UAL1.glb';
const UAL1 = existsSync(join(downloads, UAL1_SOURCE)) ? UAL1_SOURCE : 'x_UniversalAnimationLibraryStandardzip/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';
const SOURCE_EDITION = UAL1 === UAL1_SOURCE;
const UAL2 = 'x_UniversalAnimationLibrary2Standardzip/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb';
const UAL2_F = 'x_UniversalAnimationLibrary2Standardzip/Universal Animation Library 2[Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb';

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
  [UAL1, 'Crouch_Idle_Loop', 'crouch_idle'],
  [UAL1, 'Crouch_Fwd_Loop', 'crouch_walk'],
  // Source edition only: lying prone and crawling.
  ...(SOURCE_EDITION
    ? [
        [UAL1, 'Crawl_Idle_Loop', 'prone_idle'],
        [UAL1, 'Crawl_Fwd_Loop', 'prone_crawl'],
      ]
    : []),
  [UAL2, 'Hit_Knockback', 'knockback'],
  [UAL2, 'OverhandThrow', 'throw'],
  [UAL2, 'Yes', 'cheer'],
  [UAL2, 'Idle_FoldArms_Loop', 'idle_arms'],
  // Zombies (also added on their own by add-rig-clips.mjs).
  [UAL2, 'Zombie_Idle_Loop', 'zombie_idle'],
  [UAL2, 'Zombie_Walk_Fwd_Loop', 'zombie_walk'],
  [UAL2, 'Zombie_Scratch', 'zombie_attack'],
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

/** Materials whose base colour is a shared texture (textures/<id>.jpg), assigned by the game. */
const SHARED_MATERIAL = /^MI_(Ranger|Peasant|Regular|Superhero|Athlete|Hair)/;

/**
 * Keep base colour only: drop normal/ORM/roughness maps and set a matte finish.
 * Shared textures are removed too, so parts don't each carry a copy.
 */
function simplifyMaterials(doc) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null);
    mat.setMetallicFactor(0).setRoughnessFactor(0.85);
    if (SHARED_MATERIAL.test(mat.getName())) {
      mat.setBaseColorTexture(null);
      continue;
    }
    const t = mat.getBaseColorTexture();
    if (t && t.getImage()?.byteLength > 300_000) throw new Error(`material ${mat.getName()} has a large texture; make it shared`);
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

/** Inverse bind matrices and joint rest transforms of a reference body. */
async function bindPose(path) {
  const doc = path.endsWith('.glb') ? await io.read(path) : await readGltf(path);
  const skin = doc.getRoot().listSkins()[0];
  const rest = new Map(skin.listJoints().map((j) => [j.getName(), { t: j.getTranslation(), r: j.getRotation(), s: j.getScale() }]));
  return { ibm: new Float32Array(skin.getInverseBindMatrices().getArray()), rest };
}

/**
 * Rebind a part to a reference body and give its joint nodes that body's rest
 * transforms, so whichever part carries the skeleton in game, every part fits it.
 */
function conformTo(doc, ref) {
  rebind(doc, ref.ibm);
  for (const j of doc.getRoot().listSkins()[0].listJoints()) {
    const r = ref.rest.get(j.getName());
    if (r) j.setTranslation(r.t).setRotation(r.r).setScale(r.s);
  }
}

/**
 * Keep the triangles of one body region: each triangle belongs to the region
 * most of its vertices are skinned to, so regions cut from one mesh meet
 * without gaps or overlaps.
 */
function keepRegion(doc, meshName, regionOf, region) {
  const mesh = doc.getRoot().listMeshes().find((m) => m.getName() === meshName);
  const jointNames = doc.getRoot().listSkins()[0].listJoints().map((j) => j.getName());
  for (const prim of mesh.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0').getArray();
    const W = prim.getAttribute('WEIGHTS_0').getArray();
    const of = (v) => {
      let best = 0;
      for (let k = 1; k < 4; k++) if (W[v * 4 + k] > W[v * 4 + best]) best = k;
      return regionOf(jointNames[J[v * 4 + best]]);
    };
    const idx = prim.getIndices().getArray();
    const keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      const r = [of(idx[i]), of(idx[i + 1]), of(idx[i + 2])];
      const major = r[0] === r[1] || r[0] === r[2] ? r[0] : r[1] === r[2] ? r[1] : r[0];
      if (major === region) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    prim.getIndices().setArray(new Uint32Array(keep));
  }
}

/** Triangle share of the low-detail versions the game draws for distant characters. */
const LOD_RATIO = 0.3;

async function finish(doc, out, { ratio = 1, error = 0.002, lod = true } = {}) {
  // Materials are matched by name in game, so identical-looking ones (all textures are shared) must stay apart.
  const propertyTypes = [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE, PropertyType.SKIN];
  // UVs stay even though the parts carry no textures (the game assigns shared ones); tangents go.
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) for (const a of ['TANGENT', 'TEXCOORD_1']) p.setAttribute(a, null);
  await doc.transform(dedup({ propertyTypes }), prune({ keepAttributes: true }), weld());
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: true }));
  await doc.transform(prune({ keepAttributes: true }));
  const fullTris = triangles(doc);
  if (lod) addLowDetail(doc);
  // Accessors left behind by discarded animation tracks (prune keeps some of them).
  for (const acc of doc.getRoot().listAccessors()) if (acc.listParents().every((p) => p.propertyType === 'Root')) acc.dispose();
  doc.getRoot().getAsset().generator = 'tiletrigger prepare-characters';
  const glb = await io.writeBinary(doc);
  writeFileSync(join(OUT, out), glb);
  const lodTris = triangles(doc) - fullTris;
  console.log(`${out.padEnd(28)} ${String(fullTris).padStart(6)} tris ${lod ? `(+${lodTris} low-detail)` : ''} ${(glb.byteLength / 1024).toFixed(0).padStart(6)} KB`);
  return { file: `characters/${out}`, sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), triangles: fullTris, ...(lod ? { lodTriangles: lodTris } : {}), bytes: glb.byteLength };
}

function triangles(doc) {
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  return tris;
}

/**
 * Add a low-detail copy of every mesh to the same file, as a sibling node
 * named `<node>_lod` on the same skin and materials. The game draws it for
 * distant characters, so it loads with the part and needs no request of its own.
 */
function addLowDetail(doc) {
  const scene = doc.getRoot().listScenes()[0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const low = doc.createMesh(`${mesh.getName()}_lod`);
    for (const prim of mesh.listPrimitives()) {
      const p = doc.createPrimitive().setMode(prim.getMode()).setMaterial(prim.getMaterial());
      for (const sem of prim.listSemantics()) p.setAttribute(sem, prim.getAttribute(sem).clone());
      p.setIndices(prim.getIndices().clone());
      // Borders unlocked: seams between parts don't show at the distances these are drawn.
      simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: LOD_RATIO, error: 0.04, lockBorder: false });
      compactPrimitive(p);
      low.addPrimitive(p);
    }
    const lodNode = doc
      .createNode(`${node.getName()}_lod`)
      .setMesh(low)
      .setSkin(node.getSkin())
      .setTranslation(node.getTranslation())
      .setRotation(node.getRotation())
      .setScale(node.getScale());
    (node.getParentNode() ?? scene).addChild(lodNode);
  }
}

await MeshoptSimplifier.ready;
// Clear out what this script made before; the Meshy characters (prepare-meshy-characters.mjs) stay.
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (!f.startsWith('meshy_')) rmSync(join(OUT, f), { recursive: true, force: true });
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
  // Write the clips in CLIPS order: loaders start the first one, so 'idle' must come first
  // (the pose a character loads in is what its size and first-person placement are measured in).
  for (const [, , name] of CLIPS) {
    const old = doc.getRoot().listAnimations().find((a) => a.getName() === name);
    const anim = doc.createAnimation(name);
    for (const ch of old.listChannels()) {
      anim.addSampler(ch.getSampler());
      anim.addChannel(ch);
    }
    old.dispose();
  }
  // Fingers only need the clips' broad pose: drop their tracks except the finger roots
  // (clips that hold a weapon keep the middle joints so the hands close on the grip),
  // and strip redundant keys.
  const GRIP_CLIPS = new Set(['idle', 'aim_idle', 'shoot', 'reload', 'melee', 'melee_heavy', 'throw', 'interact']);
  for (const anim of doc.getRoot().listAnimations()) {
    const fingerTracks = GRIP_CLIPS.has(anim.getName()) ? /_04(_leaf)?_[lr]$/ : /_0[234](_leaf)?_[lr]$/;
    for (const ch of anim.listChannels()) {
      const n = ch.getTargetNode()?.getName() ?? '';
      // Translations would impose the mannequin's proportions on other bodies; only the hips move.
      const translationOk = n === 'root' || n === 'pelvis';
      if (fingerTracks.test(n) || ch.getTargetPath() === 'scale' || (ch.getTargetPath() === 'translation' && !translationOk)) ch.dispose();
    }
    const used = new Set(anim.listChannels().map((c) => c.getSampler()));
    for (const smp of anim.listSamplers()) if (!used.has(smp)) smp.dispose();
  }
  await doc.transform(resample({ tolerance: 4e-3 }));
  // The mannequin stays in the rig: it's the NPC body, recoloured per faction.
  for (const m of doc.getRoot().listMaterials()) m.setMetallicFactor(0).setRoughnessFactor(0.7);
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('TEXCOORD_0', null);
  lock.files.push({ role: 'rig', source: 'quaternius-universal-animation-library, quaternius-universal-animation-library-2', ...(await finish(doc, 'rig.glb', { ratio: 0.5 })) });
}

// ---------------------------------------------------------------- heads

// Every part is rebound to the "Regular" body of its sex, which the outfits are made for.
const BIND = { Male: await bindPose(find(`${OUTFITS}/Outfits/Male_Ranger.gltf`)), Female: await bindPose(find(`${OUTFITS}/Outfits/Female_Ranger.gltf`)) };
const SEX = { Male: 'm', Female: 'f' };
const HEAD_BONES = new Set(['Head', 'neck_01']);
/**
 * Body regions of the base characters, by joint (the head and the athlete parts
 * are cut along these). The hips stay with the torso so trousers never leave a gap.
 */
const athleteRegion = (joint) =>
  HEAD_BONES.has(joint) ? 'head' : /^(foot|ball)/.test(joint) ? 'feet' : /^(thigh|calf)/.test(joint) ? 'legs' : 'torso';

const superBody = (doc) => doc.getRoot().listMeshes().find((m) => /SuperHero|Superhero/.test(m.getName()) || m.getName().startsWith('Sphere'));
for (const sex of ['Male', 'Female']) {
  const doc = await readGltf(find(`${BASE}/Base Characters/Godot - UE/Superhero_${sex}_FullBody.gltf`));
  keepRegion(doc, superBody(doc).getName(), athleteRegion, 'head');
  conformSkin(doc, lock.rigJoints);
  conformTo(doc, BIND[sex]);
  simplifyMaterials(doc);
  lock.files.push({ role: 'head', id: `head_${sex.toLowerCase()}`, body: sex.toLowerCase(), source: 'quaternius-universal-base-characters', ...(await finish(doc, `head_${sex.toLowerCase()}.glb`)) });
}

// ---------------------------------------------------------------- base bodies

// The base characters below the neck (sportswear), cut into the same regions
// as the outfit parts so they mix with them: upper body (torso and arms),
// legs and feet. The material is renamed so colourways can target it.
const BASE_TEX = `${BASE}/Base Characters/Textures`;
const ATHLETE_TEX = { Male: ['T_Superhero_Male_Dark.png', 'T_Superhero_Male_Ligh.png'], Female: ['T_Superhero_Female_Dark_BaseColor.png', 'T_Superhero_Female_Light_BaseColor.png'] };
for (const sex of ['Male', 'Female']) {
  for (const region of ['torso', 'legs', 'feet']) {
    const doc = await readGltf(find(`${BASE}/Base Characters/Godot - UE/Superhero_${sex}_FullBody.gltf`));
    const body = superBody(doc);
    for (const m of doc.getRoot().listMeshes()) if (m !== body) m.dispose();
    await doc.transform(prune({ keepAttributes: true }));
    keepRegion(doc, body.getName(), athleteRegion, region);
    conformSkin(doc, lock.rigJoints);
    conformTo(doc, BIND[sex]);
    body.listPrimitives()[0].getMaterial().setName(`MI_Athlete_${sex}`);
    simplifyMaterials(doc);
    const id = `athlete_${region}_${SEX[sex]}`;
    lock.files.push({ role: 'part', id, body: sex.toLowerCase(), slot: region, source: 'quaternius-universal-base-characters', ...(await finish(doc, `${id}.glb`, { ratio: 0.5 })) });
  }
}

// Bare arms for the first-person view of a sportswear top (the top itself would
// put the chest in front of the camera). Not a wearable part.
const armJoint = (joint) => /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)_/.test(joint);
for (const sex of ['Male', 'Female']) {
  const doc = await readGltf(find(`${BASE}/Base Characters/Godot - UE/Superhero_${sex}_FullBody.gltf`));
  const body = superBody(doc);
  for (const m of doc.getRoot().listMeshes()) if (m !== body) m.dispose();
  await doc.transform(prune({ keepAttributes: true }));
  keepRegion(doc, body.getName(), (j) => (armJoint(j) ? 'arms' : 'rest'), 'arms');
  conformSkin(doc, lock.rigJoints);
  conformTo(doc, BIND[sex]);
  body.listPrimitives()[0].getMaterial().setName(`MI_Athlete_${sex}`);
  simplifyMaterials(doc);
  const id = `athlete_fparms_${SEX[sex]}`;
  lock.files.push({ role: 'fparms', id, body: sex.toLowerCase(), source: 'quaternius-universal-base-characters', ...(await finish(doc, `${id}.glb`, { ratio: 0.6, lod: false })) });
}

// ---------------------------------------------------------------- outfit parts

/** Modular outfit parts: [file, our slot, simplify ratio]. Any part fits any other part for the same body. */
const PARTS = {
  Male: [
    ['Male_Ranger_Arms', 'ranger', 'arms', 0.6],
    ['Male_Ranger_Body', 'ranger', 'torso', 0.6],
    ['Male_Ranger_Legs', 'ranger', 'legs', 0.8],
    ['Male_Ranger_Feet_Boots', 'ranger', 'feet', 0.3],
    ['Male_Ranger_Head_Hood', 'ranger', 'hood', 0.6],
    ['Male_Ranger_Acc_Pauldron', 'ranger', 'pauldron', 0.7],
    ['Male_Peasant_Arms', 'peasant', 'arms', 0.6],
    ['Male_Peasant_Body', 'peasant', 'torso', 0.7],
    ['Male_Peasant_Legs', 'peasant', 'legs', 0.8],
    ['Male_Peasant_Feet', 'peasant', 'feet', 0.6],
  ],
  Female: [
    ['Female_Ranger_Arms', 'ranger', 'arms', 0.6],
    ['Female_Ranger_Body', 'ranger', 'torso', 0.6],
    ['Female_Ranger_Legs', 'ranger', 'legs', 0.8],
    ['Female_Ranger_Feet', 'ranger', 'feet', 0.3],
    ['Female_Ranger_Head_Hood', 'ranger', 'hood', 0.6],
    ['Female_Ranger_Acc_Pauldrons', 'ranger', 'pauldron', 0.7],
    ['Female_Peasant_Arms', 'peasant', 'arms', 0.5],
    ['Female_Peasant_Body', 'peasant', 'torso', 0.7],
    ['Female_Peasant_Legs', 'peasant', 'legs', 0.8],
    ['Female_Peasant_Feet', 'peasant', 'feet', 0.6],
  ],
};
for (const sex of ['Male', 'Female']) {
  for (const [src, outfit, slot, ratio] of PARTS[sex]) {
    const doc = await readGltf(find(`${OUTFITS}/Modular Parts/${src}.gltf`));
    conformSkin(doc, lock.rigJoints);
    conformTo(doc, BIND[sex]);
    simplifyMaterials(doc);
    const id = `${outfit}_${slot}_${SEX[sex]}`;
    // The boots are very dense; let them simplify further.
    const error = slot === 'feet' ? 0.01 : 0.002;
    lock.files.push({ role: 'part', id, body: sex.toLowerCase(), slot, source: 'quaternius-modular-outfits-fantasy', ...(await finish(doc, `${id}.glb`, { ratio, error })) });
  }
}

// Shared textures: base colour maps used by many parts, loaded once by the game.
// The ID's first word names the material family it belongs to (see
// textureFor in packages/shared/src/content/looks.ts); IDs with a further
// word are alternative colourways.
mkdirSync(join(OUT, 'textures'), { recursive: true });
const HAIR_TEX = `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
for (const [png, id, size, source] of [
  [`${OUTFIT_TEX}/Ranger/T_Ranger_BaseColor.png`, 'ranger', 1024, 'quaternius-modular-outfits-fantasy'],
  [`${OUTFIT_TEX}/Ranger/T_Ranger_3_BaseColor.png`, 'ranger_moss', 1024, 'quaternius-modular-outfits-fantasy'],
  [`${OUTFIT_TEX}/Peasant/T_Peasant_BaseColor.png`, 'peasant', 1024, 'quaternius-modular-outfits-fantasy'],
  [`${OUTFIT_TEX}/Peasant/T_Peasant_2_BaseColor.png`, 'peasant_dusk', 1024, 'quaternius-modular-outfits-fantasy'],
  [`${OUTFIT_TEX}/Base/T_Regular_Male_Dark_BaseColor.png`, 'skin_m', 1024, 'quaternius-modular-outfits-fantasy'],
  [`${OUTFIT_TEX}/Base/T_Regular_Female_Dark_BaseColor.png`, 'skin_f', 1024, 'quaternius-modular-outfits-fantasy'],
  [`${BASE_TEX}/${ATHLETE_TEX.Male[0]}`, 'athlete_m', 1024, 'quaternius-universal-base-characters'],
  [`${BASE_TEX}/${ATHLETE_TEX.Female[0]}`, 'athlete_f', 1024, 'quaternius-universal-base-characters'],
  [`${BASE_TEX}/${ATHLETE_TEX.Male[1]}`, 'athlete_light_m', 1024, 'quaternius-universal-base-characters'],
  [`${BASE_TEX}/${ATHLETE_TEX.Female[1]}`, 'athlete_light_f', 1024, 'quaternius-universal-base-characters'],
  [`${HAIR_TEX}/T_Hair_1_BaseColor.png`, 'hair_1', 512, 'quaternius-universal-base-characters'],
  [`${HAIR_TEX}/T_Hair_2_BaseColor.png`, 'hair_2', 512, 'quaternius-universal-base-characters'],
]) {
  const data = jpeg(find(png), size);
  writeFileSync(join(OUT, 'textures', `${id}.jpg`), data);
  lock.files.push({ role: 'texture', id, source, file: `characters/textures/${id}.jpg`, sha256: createHash('sha256').update(data).digest('hex').slice(0, 16), triangles: 0, bytes: data.byteLength });
  console.log(`textures/${id}.jpg ${(data.byteLength / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------- hair

/** Hairstyles and the body they are fitted to (eyebrows already come with the heads). */
const HAIR = [
  ['Hair_SimpleParted', 'Male'],
  ['Hair_Buzzed', 'Male'],
  ['Hair_Beard', 'Male'],
  ['Hair_Long', 'Female'],
  ['Hair_Buns', 'Female'],
  ['Hair_BuzzedFemale', 'Female'],
];
const hairDir = `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
for (const [h, sex] of HAIR) {
  const doc = await readGltf(find(`${hairDir}/${h}.gltf`));
  conformSkin(doc, lock.rigJoints);
  conformTo(doc, BIND[sex]);
  simplifyMaterials(doc);
  const id = h.toLowerCase();
  lock.files.push({ role: 'hair', id, body: sex.toLowerCase(), source: 'quaternius-universal-base-characters', ...(await finish(doc, `${id}.glb`, { ratio: 0.6 })) });
}

// ---------------------------------------------------------------- female mannequin (NPCs)

{
  const doc = await io.read(find(UAL2_F));
  for (const a of doc.getRoot().listAnimations()) {
    for (const c of a.listChannels()) c.dispose();
    for (const smp of a.listSamplers()) smp.dispose();
    a.dispose();
  }
  conformSkin(doc, lock.rigJoints);
  conformTo(doc, await bindPose(find(UAL1)));
  for (const m of doc.getRoot().listMaterials()) m.setMetallicFactor(0).setRoughnessFactor(0.7);
  // Untextured: drop the UVs so their seams don't stop the simplifier.
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('TEXCOORD_0', null);
  lock.files.push({ role: 'npc', id: 'mannequin_f', body: 'female', source: 'quaternius-universal-animation-library-2', ...(await finish(doc, 'mannequin_f.glb', { ratio: 0.5 })) });
}

writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${lock.files.length} files and content/characters.lock.json`);
void Document;
