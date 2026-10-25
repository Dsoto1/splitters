// Whole-body characters made on the owner's Meshy subscription (text-to-3d,
// textured, auto-rigged by Meshy), turned into parts that ride the game's own
// rig, so every clip in rig.glb drives them unchanged.
//
//   node tools/content/prepare-meshy-characters.mjs <downloads dir>
//
// The downloads dir holds each character's Meshy rigged GLB as <id>.glb (about
// 10 MB each, so they stay out of the repo; the Meshy task IDs below say where
// they came from). Outputs go to packages/client/public/characters/<id>.glb
// (the body, with a low-detail copy) and <id>_fparms.glb (its arms for the
// first-person view), recorded in content/meshy.lock.json, which
// `pnpm content:check` verifies.
//
// What it does to each:
// - skins the Meshy mesh in its rest pose, then turns its arms out level and its
//   legs straight down (Meshy poses vary; the rig stands in a T-pose), with
//   Meshy's own weights;
// - moves the rig's joints onto the character's (keeping the rig's joint
//   orientations, so the clips' rotations mean the same thing) and rebinds the
//   mesh to them, its weights carried over joint by joint;
// - keeps the base colour only (1024 px JPEG), simplifies the mesh and adds the
//   low-detail copy the game draws for distant characters.

import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, prune, quantize, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/characters');
const LOCK = join(ROOT, 'content/meshy.lock.json');
const downloads = process.argv[2];
if (!downloads) throw new Error('usage: prepare-meshy-characters.mjs <downloads dir>');

/** The characters: Meshy task IDs (preview, textured refine, rig) and the finish their one material gets. */
const CHARACTERS = [
  {
    id: 'meshy_knight',
    meshy: { preview: '01a173bc-08fd-7255-a545-bb6519425146', refine: '01a173bd-fc9c-7307-bff2-a15a52b42102', rig: '01a173c0-4d21-712b-97ba-7f08daf670c7' },
    metallic: 0.35,
    roughness: 0.45,
  },
];

/** Meshy's joints onto the rig's (its head's end markers fold into the head). */
const JOINT_MAP = {
  Hips: 'pelvis',
  Spine02: 'spine_01',
  Spine01: 'spine_02',
  Spine: 'spine_03',
  neck: 'neck_01',
  Head: 'Head',
  head_end: 'Head',
  headfront: 'Head',
  LeftShoulder: 'clavicle_l',
  LeftArm: 'upperarm_l',
  LeftForeArm: 'lowerarm_l',
  LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r',
  RightArm: 'upperarm_r',
  RightForeArm: 'lowerarm_r',
  RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l',
  LeftLeg: 'calf_l',
  LeftFoot: 'foot_l',
  LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r',
  RightLeg: 'calf_r',
  RightFoot: 'foot_r',
  RightToeBase: 'ball_r',
};

/** Bones turned to point the way the rig's do (Meshy joint, its child, rig joint, rig child). */
const REPOSE = ['l', 'r'].flatMap((s) => {
  const S = s === 'l' ? 'Left' : 'Right';
  return [
    [`${S}Arm`, `${S}ForeArm`, `upperarm_${s}`, `lowerarm_${s}`],
    [`${S}ForeArm`, `${S}Hand`, `lowerarm_${s}`, `hand_${s}`],
    [`${S}UpLeg`, `${S}Leg`, `thigh_${s}`, `calf_${s}`],
    [`${S}Leg`, `${S}Foot`, `calf_${s}`, `foot_${s}`],
  ];
});

/** Rig joints that make up the first-person arms (forearms and hands: bulky upper sleeves would fill the view). */
const ARM_JOINT = /^(lowerarm|hand|index|middle|pinky|ring|thumb)_/;

const LOD_RATIO = 0.3;
/** Standing height everyone is scaled to, feet on the ground (the rig's mannequin is this tall). */
const HEIGHT = 1.83;
/** Share of the Meshy triangles kept (their meshes are dense for a character this size). */
const FULL_RATIO = 0.5;

// ---------------------------------------------------------------- vector maths (quaternions [x, y, z, w])

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => {
  const t = scale(cross(q, v), 2);
  return add(add(v, scale(t, q[3])), cross(q, t));
};
/** The shortest rotation taking direction a onto direction b. */
function qFromTo(a, b) {
  const d = dot(a, b);
  if (d < -0.9999) {
    const axis = norm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
    return [...axis, 0];
  }
  const c = cross(a, b);
  const q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(...q);
  return q.map((x) => x / l);
}
/** Column-major 4x4 times a point. */
const mulPoint = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
const mulDir = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
function mat4Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
/** The inverse of a rigid transform (rotation q, then translation t) as a column-major matrix. */
function inverseRigid(q, t) {
  const qi = qinv(q);
  const ti = scale(qrot(qi, t), -1);
  const [x, y, z, w] = qi;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    ti[0], ti[1], ti[2], 1,
  ];
}

// ---------------------------------------------------------------- the build

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

/** World rotation and position of a node at rest (the rig has no scaling). */
function worldRest(node, cache = new Map()) {
  if (cache.has(node)) return cache.get(node);
  const parent = node.getParentNode();
  const p = parent ? worldRest(parent, cache) : { q: [0, 0, 0, 1], t: [0, 0, 0] };
  const r = { q: qmul(p.q, node.getRotation()), t: add(p.t, qrot(p.q, node.getTranslation())) };
  cache.set(node, r);
  return r;
}

/** The Meshy mesh in world space at rest, re-posed to the rig's stance, with its joints there too. */
async function readMeshy(file, ual, c) {
  const doc = await io.read(file);
  const skin = doc.getRoot().listSkins()[0];
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices().getArray();
  const names = joints.map((j) => j.getName());
  for (const n of names) if (!JOINT_MAP[n]) throw new Error(`${file}: unknown Meshy joint ${n}`);
  const world = joints.map((j) => j.getWorldMatrix());
  const skinMat = joints.map((_, i) => mat4Mul(world[i], Array.from(ibm.slice(i * 16, i * 16 + 16))));
  const rest = world.map((m) => [m[12], m[13], m[14]]);
  const mesh = doc.getRoot().listMeshes()[0];
  if (doc.getRoot().listMeshes().length !== 1 || mesh.listPrimitives().length !== 1) throw new Error(`${file}: expected one mesh with one primitive`);
  const prim = mesh.listPrimitives()[0];
  const P = prim.getAttribute('POSITION').getArray();
  const N = prim.getAttribute('NORMAL').getArray();
  const J = prim.getAttribute('JOINTS_0').getArray();
  const W = prim.getAttribute('WEIGHTS_0').getArray();
  const count = P.length / 3;

  // Re-pose: walk the joints parents first, turning the listed bones to the rig's directions.
  const index = new Map(names.map((n, i) => [n, i]));
  const rot = new Array(joints.length);
  const posed = new Array(joints.length);
  const visit = (i) => {
    if (rot[i]) return;
    const parent = joints[i].getParentNode();
    const pi = parent ? index.get(parent.getName()) : undefined;
    if (pi !== undefined) {
      visit(pi);
      rot[i] = rot[pi];
      posed[i] = add(posed[pi], qrot(rot[pi], sub(rest[i], rest[pi])));
    } else {
      rot[i] = [0, 0, 0, 1];
      posed[i] = rest[i];
    }
    const rule = REPOSE.find((r) => r[0] === names[i]);
    if (rule) {
      const c = index.get(rule[1]);
      const now = norm(qrot(rot[i], sub(rest[c], rest[i])));
      const want = norm(sub(ual.get(rule[3]).t, ual.get(rule[2]).t));
      rot[i] = qmul(qFromTo(now, want), rot[i]);
    }
  };
  // Children's positions depend on their parents' final turn, so settle every parent before its children.
  const depth = (i) => {
    let d = 0;
    for (let p = joints[i].getParentNode(); p && index.has(p.getName()); p = p.getParentNode()) d++;
    return d;
  };
  for (const i of [...names.keys()].sort((a, b) => depth(a) - depth(b))) visit(i);

  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const p0 = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    const n0 = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    let p = [0, 0, 0];
    let n = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = W[v * 4 + k];
      if (!w) continue;
      const j = J[v * 4 + k];
      // Rest pose in world space, then about the joint to its re-posed place.
      const pw = mulPoint(skinMat[j], p0);
      const nw = mulDir(skinMat[j], n0);
      p = add(p, scale(add(posed[j], qrot(rot[j], sub(pw, rest[j]))), w));
      n = add(n, scale(qrot(rot[j], nw), w));
    }
    n = norm(n);
    pos.set(p, v * 3);
    nrm.set(n, v * 3);
  }
  if (c.mitts) mitten(pos, nrm, J, W, names, posed, index);
  // Meshy sizes the model as it was posed (bent knees and all): stand it at the rig's height, feet on the ground.
  let [low, high] = [Infinity, -Infinity];
  for (let v = 1; v < pos.length; v += 3) [low, high] = [Math.min(low, pos[v]), Math.max(high, pos[v])];
  const k = HEIGHT / (high - low);
  const fit = (p) => [p[0] * k, (p[1] - low) * k, p[2] * k];
  for (let v = 0; v < pos.length; v += 3) pos.set(fit([pos[v], pos[v + 1], pos[v + 2]]), v);
  for (let i = 0; i < posed.length; i++) posed[i] = fit(posed[i]);
  const material = prim.getMaterial();
  const baseColor = material.getBaseColorTexture()?.getImage();
  if (!baseColor) throw new Error(`${file}: no base colour texture`);
  return {
    names,
    posed: new Map(names.map((n, i) => [n, posed[i]])),
    pos,
    nrm,
    uv: prim.getAttribute('TEXCOORD_0').getArray(),
    joints: J,
    weights: W,
    indices: prim.getIndices().getArray(),
    baseColor,
  };
}

/**
 * Close open, spread hands into mittens: past the knuckles everything is drawn
 * back towards them and together, and the whole hand shrinks a little (so a
 * gun grip reads, and a bulky glove doesn't fill the first-person view).
 */
function mitten(pos, nrm, J, W, names, posed, index) {
  for (const side of ['Left', 'Right']) {
    const h = index.get(`${side}Hand`);
    const H = posed[h];
    const d = norm(sub(H, posed[index.get(`${side}ForeArm`)]));
    const verts = [];
    for (let v = 0; v < pos.length / 3; v++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (W[v * 4 + k] > W[v * 4 + best]) best = k;
      if (J[v * 4 + best] === h) verts.push(v);
    }
    let L = 0;
    for (const v of verts) L = Math.max(L, dot(sub(pos.subarray(v * 3, v * 3 + 3), H), d));
    const knuckle = L * 0.4;
    for (const v of verts) {
      let p = sub(Array.from(pos.subarray(v * 3, v * 3 + 3)), H);
      const along = dot(p, d);
      const across = sub(p, scale(d, along));
      if (along > knuckle) p = add(scale(d, knuckle + (along - knuckle) * 0.4), scale(across, 0.75));
      pos.set(add(H, scale(p, 0.85)), v * 3);
    }
  }
  void nrm;
}

/** Recolour strongly blue pixels to `hex` (badges and insignia painted on by the generator), or leave the image as it is. */
async function scrub(image, hex) {
  if (!hex) return Buffer.from(image);
  const { data, info } = await sharp(Buffer.from(image)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const to = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (b > r + 35 && b > g + 15) data.set(to, i);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}

function triangles(doc) {
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  return tris;
}

/** A low-detail copy of every mesh, as `<node>_lod` on the same skin (see prepare-characters.mjs). */
function addLowDetail(doc) {
  const scene = doc.getRoot().listScenes()[0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const low = doc.createMesh(`${mesh.getName()}_lod`);
    for (const prim of mesh.listPrimitives()) {
      const p = doc.createPrimitive().setMode(prim.getMode()).setMaterial(prim.getMaterial());
      for (const sem of prim.listSemantics()) p.setAttribute(sem, prim.getAttribute(sem).clone());
      // Sloppy: it ignores the texture seams that stop the careful simplifier (fine at the distances this is drawn).
      const idx = new Uint32Array(prim.getIndices().getArray());
      const target = Math.floor((idx.length * LOD_RATIO) / 3) * 3;
      const [low3] = MeshoptSimplifier.simplifySloppy(idx, new Float32Array(prim.getAttribute('POSITION').getArray()), 3, null, target, 0.05);
      p.setIndices(prim.getIndices().clone().setArray(low3));
      compactPrimitive(p);
      low.addPrimitive(p);
    }
    (node.getParentNode() ?? scene).addChild(doc.createNode(`${node.getName()}_lod`).setMesh(low).setSkin(node.getSkin()));
  }
}

/**
 * The rig's skeleton fitted to this character, with its mesh bound to it.
 * `keep` filters triangles by the rig joint most of their vertices follow
 * (the first-person arms keep only arm triangles).
 */
async function build(c, src, out, { keep = () => true, ratio = FULL_RATIO, lod = true } = {}) {
  const doc = await io.read(join(OUT, 'rig.glb'));
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const rigNames = joints.map((j) => j.getName());
  const cache = new Map();
  const ual = new Map(joints.map((j) => [j.getName(), worldRest(j, cache)]));

  // Each rig joint onto its Meshy counterpart; the rest (fingers, leaf ends) keep their offsets from their parents.
  const target = new Map();
  const reverse = new Map(Object.entries(JOINT_MAP).filter(([m]) => !/head_end|headfront/.test(m)).map(([m, u]) => [u, m]));
  const place = (j) => {
    const name = j.getName();
    if (target.has(name)) return target.get(name);
    const parent = j.getParentNode();
    const parentIsJoint = parent && ual.has(parent.getName());
    let t;
    if (reverse.has(name)) t = src.posed.get(reverse.get(name));
    else if (parentIsJoint) t = add(place(parent), sub(ual.get(name).t, ual.get(parent.getName()).t));
    else t = ual.get(name).t;
    target.set(name, t);
    return t;
  };
  for (const j of joints) place(j);
  for (const j of joints) {
    const parent = j.getParentNode();
    const pw = parent ? worldRest(parent) : { q: [0, 0, 0, 1], t: [0, 0, 0] };
    const pt = parent && ual.has(parent.getName()) ? target.get(parent.getName()) : pw.t;
    j.setTranslation(qrot(qinv(pw.q), sub(target.get(j.getName()), pt)));
  }
  // Bind matrices at the fitted rest pose (rotations are the rig's own).
  const ibm = new Float32Array(joints.length * 16);
  joints.forEach((j, i) => ibm.set(inverseRigid(ual.get(j.getName()).q, target.get(j.getName())), i * 16));
  skin.getInverseBindMatrices().setArray(ibm);

  // Out with the mannequin and the clips; in with the character.
  for (const a of root.listAnimations()) {
    for (const ch of a.listChannels()) ch.dispose();
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  for (const n of root.listNodes()) if (n.getMesh()) n.dispose();
  for (const m of root.listMeshes()) m.dispose();
  for (const m of root.listMaterials()) m.dispose();

  const count = src.pos.length / 3;
  const rigIndex = new Map(rigNames.map((n, i) => [n, i]));
  const J = new Uint16Array(count * 4);
  const W = new Float32Array(count * 4);
  const major = new Array(count);
  for (let v = 0; v < count; v++) {
    const acc = new Map();
    for (let k = 0; k < 4; k++) {
      const w = src.weights[v * 4 + k];
      if (!w) continue;
      const u = rigIndex.get(JOINT_MAP[src.names[src.joints[v * 4 + k]]]);
      acc.set(u, (acc.get(u) ?? 0) + w);
    }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    top.forEach(([u, w], k) => {
      J[v * 4 + k] = u;
      W[v * 4 + k] = w / sum;
    });
    major[v] = rigNames[top[0]?.[0] ?? 0];
  }
  const kept = [];
  for (let i = 0; i < src.indices.length; i += 3) {
    const a = src.indices[i];
    const b = src.indices[i + 1];
    const d = src.indices[i + 2];
    const m = major[a] === major[b] || major[a] === major[d] ? major[a] : major[b];
    if (keep(m)) kept.push(a, b, d);
  }

  const buffer = root.listBuffers()[0] ?? doc.createBuffer();
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const jpeg = await sharp(await scrub(src.baseColor, c.scrubBlue)).resize(1024, 1024).jpeg({ quality: 86 }).toBuffer();
  const tex = doc.createTexture(`${c.id}_albedo`).setImage(new Uint8Array(jpeg)).setMimeType('image/jpeg');
  // The game leaves materials it doesn't recognise as they are (textureFor), so this one keeps its texture.
  const material = doc.createMaterial(`MI_Meshy_${c.id}`).setBaseColorTexture(tex).setMetallicFactor(c.metallic).setRoughnessFactor(c.roughness);
  const prim = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute('POSITION', acc('VEC3', src.pos))
    .setAttribute('NORMAL', acc('VEC3', src.nrm))
    .setAttribute('TEXCOORD_0', acc('VEC2', src.uv))
    .setAttribute('JOINTS_0', acc('VEC4', J))
    .setAttribute('WEIGHTS_0', acc('VEC4', W))
    .setIndices(acc('SCALAR', new Uint32Array(kept)));
  const node = doc.createNode(c.id).setMesh(doc.createMesh(c.id).addPrimitive(prim)).setSkin(skin);
  root.listScenes()[0].listChildren()[0].addChild(node);

  await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), prune({ keepAttributes: true }), weld());
  // Meshy's texture seams are everywhere, so they can't all be locked or the mesh barely simplifies.
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.008, lockBorder: false }));
  await doc.transform(prune({ keepAttributes: true }));
  const fullTris = triangles(doc);
  if (lod) addLowDetail(doc);
  // Smaller vertices (KHR_mesh_quantization, read natively by the game's loader).
  await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }));
  for (const a of root.listAccessors()) if (a.listParents().every((p) => p.propertyType === 'Root')) a.dispose();
  root.getAsset().generator = 'tiletrigger prepare-meshy-characters';
  const glb = await io.writeBinary(doc);
  writeFileSync(join(OUT, out), glb);
  const lodTris = triangles(doc) - fullTris;
  console.log(`${out.padEnd(28)} ${String(fullTris).padStart(6)} tris ${lod ? `(+${lodTris} low-detail)` : ''} ${(glb.byteLength / 1024).toFixed(0).padStart(6)} KB`);
  return { file: `characters/${out}`, sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), triangles: fullTris, ...(lod ? { lodTriangles: lodTris } : {}), bytes: glb.byteLength };
}

const lock = { $comment: 'Generated by tools/content/prepare-meshy-characters.mjs. Do not edit by hand.', files: [] };
const rigDoc = await io.read(join(OUT, 'rig.glb'));
const rigCache = new Map();
const ual = new Map(rigDoc.getRoot().listSkins()[0].listJoints().map((j) => [j.getName(), worldRest(j, rigCache)]));
for (const c of CHARACTERS) {
  const file = join(downloads, `${c.id}.glb`);
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  const src = await readMeshy(file, ual, c);
  const meshy = { meshy: c.meshy };
  lock.files.push({ role: 'meshy', id: c.id, source: 'meshy-owned', ...meshy, ...(await build(c, src, `${c.id}.glb`)) });
  lock.files.push({ role: 'meshy-fparms', id: `${c.id}_fparms`, source: 'meshy-owned', ...meshy, ...(await build(c, src, `${c.id}_fparms.glb`, { keep: (j) => ARM_JOINT.test(j), ratio: 0.8, lod: false })) });
}
writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`wrote ${lock.files.length} files and content/meshy.lock.json`);
