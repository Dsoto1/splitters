// Hands for characters already built (packages/client/public/characters/<id>.glb), without their raw
// downloads: hands.mjs measures each hand, fits the finger joints to it, re-skins the hand region with
// finger weights and writes the measurements on the hand joints (`extras.hand`), in place, for the body
// and its first-person arms. A character with no first-person arms yet gets them cut from its body, as
// prepare-meshy-characters.mjs cuts them from a download (forearms and hands; the elbow half of each
// forearm dropped, sleeves pulled in, hands a little smaller). content/meshy.lock.json is updated.
//
//   node tools/content/rehand-built.mjs            every character with a manifest
//   ONLY=<ids> node tools/content/rehand-built.mjs just those
//
// Running it again gives the same files (the hand chain's weights are shared out afresh each time).
// prepare-meshy-characters.mjs does the same at import, so a rebuild from the downloads keeps all this.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, prune } from '@gltf-transform/functions';
import { buildSpec, readManifests } from './character-manifests.mjs';
import { fitHands } from './hands.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/characters');
const LOCK = join(ROOT, 'content/meshy.lock.json');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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
const mulPoint = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
function mat4Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
/** The inverse of an affine column-major matrix. */
function affineInverse(m) {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const r = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((x) => x / det);
  // r is row-major 3x3.
  const o = [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, 0, 0, 0, 1];
  const t = mulPoint(o, [m[12], m[13], m[14]]);
  o[12] = -t[0];
  o[13] = -t[1];
  o[14] = -t[2];
  return o;
}
/** The inverse of a rigid transform (rotation q, then translation t), column-major. */
function inverseRigid(q, t) {
  const qi = qinv(q);
  const ti = scale(qrot(qi, t), -1);
  const [x, y, z, w] = qi;
  return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, ti[0], ti[1], ti[2], 1];
}
/** World rotation and position of a node at rest (skeletons here carry no scaling). */
function worldRest(node, cache) {
  if (cache.has(node)) return cache.get(node);
  const parent = node.getParentNode();
  const p = parent ? worldRest(parent, cache) : { q: [0, 0, 0, 1], t: [0, 0, 0] };
  const r = { q: qmul(p.q, node.getRotation()), t: add(p.t, qrot(p.q, node.getTranslation())) };
  cache.set(node, r);
  return r;
}

/** Rig joints that make up the first-person arms, and how they are slimmed (as prepare-meshy-characters.mjs). */
const ARM_JOINT = /^(lowerarm|hand|index|middle|pinky|ring|thumb)_/;
const FP_KEEP_FROM = 0.4;
const FP_SLEEVE = 0.6;
const FP_HAND = 0.78;

const rigDoc = await io.read(join(OUT, 'rig.glb'));
const rigCache = new Map();
const rig = new Map(rigDoc.getRoot().listSkins()[0].listJoints().map((j) => [j.getName(), worldRest(j, rigCache)]));

/** A built character's skeleton and meshes in bind space. */
function open(doc) {
  const skin = doc.getRoot().listSkins()[0];
  const joints = skin.listJoints();
  const jointNames = joints.map((j) => j.getName());
  const cache = new Map();
  const world = new Map(joints.map((j) => [j.getName(), worldRest(j, cache)]));
  const ibm = skin.getInverseBindMatrices();
  // The bind transform every vertex takes (quantization folds a scale and offset into the bind matrices).
  const hi = jointNames.indexOf('hand_r');
  const Wh = joints[hi].getWorldMatrix();
  const Q = mat4Mul(Wh, Array.from(ibm.getArray().slice(hi * 16, hi * 16 + 16)));
  const meshes = [];
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh() || node.getSkin() !== skin) continue;
    for (const prim of node.getMesh().listPrimitives()) {
      const P = prim.getAttribute('POSITION');
      const n = P.getCount();
      const pos = new Float32Array(n * 3);
      const J = new Uint16Array(n * 4);
      const W = new Float32Array(n * 4);
      const el = [0, 0, 0, 0];
      for (let v = 0; v < n; v++) {
        pos.set(mulPoint(Q, P.getElement(v, el)), v * 3);
        J.set(prim.getAttribute('JOINTS_0').getElement(v, el), v * 4);
        W.set(prim.getAttribute('WEIGHTS_0').getElement(v, el), v * 4);
      }
      meshes.push({ node, prim, pos, J, W, lod: /_lod$/.test(node.getName()) });
    }
  }
  meshes.sort((a, b) => Number(a.lod) - Number(b.lod));
  return { skin, joints, jointNames, world, Q, meshes };
}

/** Write bind-space positions back through the bind transform into the (quantized) accessor. */
function writePositions(m, Qinv) {
  const P = m.prim.getAttribute('POSITION');
  for (let v = 0; v < P.getCount(); v++) {
    const q = mulPoint(Qinv, [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]);
    P.setElement(v, q.map((x) => Math.max(-1, Math.min(1, x))));
  }
}

/** Weights back into the accessors' own types (8-bit normalized weights sum to exactly 255). */
function writeWeights(m) {
  const J = m.prim.getAttribute('JOINTS_0');
  const W = m.prim.getAttribute('WEIGHTS_0');
  const Wa = W.getArray();
  const Ja = J.getArray();
  for (let v = 0; v < J.getCount(); v++) {
    for (let k = 0; k < 4; k++) Ja[v * 4 + k] = m.J[v * 4 + k];
    if (W.getNormalized() && Wa instanceof Uint8Array) {
      const raw = [0, 1, 2, 3].map((k) => m.W[v * 4 + k] * 255);
      const q = raw.map(Math.floor);
      let left = 255 - q.reduce((a, b) => a + b, 0);
      for (const k of [0, 1, 2, 3].sort((a, b) => raw[b] - q[b] - (raw[a] - q[a]))) if (left-- > 0) q[k]++;
      for (let k = 0; k < 4; k++) Wa[v * 4 + k] = q[k];
    } else for (let k = 0; k < 4; k++) W.setElement(v, [0, 1, 2, 3].map((q) => m.W[v * 4 + q]));
  }
  J.setArray(Ja);
  W.setArray(Wa);
}

/** Cut first-person arms out of a body (its full mesh), as prepare-meshy-characters.mjs does from a download. */
async function cutArms(doc) {
  const root = doc.getRoot();
  for (const node of root.listNodes()) if (node.getMesh() && /_lod$/.test(node.getName())) {
    const mesh = node.getMesh();
    node.dispose();
    mesh.dispose();
  }
  const c = open(doc);
  const m = c.meshes[0];
  const count = m.pos.length / 3;
  const major = new Array(count);
  for (let v = 0; v < count; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (m.W[v * 4 + k] > m.W[v * 4 + best]) best = k;
    major[v] = c.jointNames[m.J[v * 4 + best]];
  }
  const drop = new Uint8Array(count);
  for (const s of ['l', 'r']) {
    const E = c.world.get(`lowerarm_${s}`).t;
    const H = c.world.get(`hand_${s}`).t;
    const axis = sub(H, E);
    const len = Math.hypot(...axis);
    const d = scale(axis, 1 / len);
    for (let v = 0; v < count; v++) {
      const p = [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
      if (major[v] === `lowerarm_${s}`) {
        const t = Math.min(1, Math.max(0, dot(sub(p, E), d) / len));
        if (t < FP_KEEP_FROM) drop[v] = 1;
        const a = add(E, scale(d, t * len));
        m.pos.set(add(a, scale(sub(p, a), FP_SLEEVE)), v * 3);
      } else if (/^(hand|index|middle|pinky|ring|thumb)_/.test(major[v]) && major[v].endsWith(`_${s}`)) {
        m.pos.set(add(H, scale(sub(p, H), FP_HAND)), v * 3);
      }
    }
  }
  writePositions(m, affineInverse(c.Q));
  const idx = m.prim.getIndices().getArray();
  const kept = [];
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, d] = [idx[i], idx[i + 1], idx[i + 2]];
    const mj = major[a] === major[b] || major[a] === major[d] ? major[a] : major[b];
    if (ARM_JOINT.test(mj) && !drop[a] && !drop[b] && !drop[d]) kept.push(a, b, d);
  }
  m.prim.getIndices().setArray(new Uint32Array(kept));
  compactPrimitive(m.prim);
  await doc.transform(prune({ keepAttributes: true }));
  for (const a of root.listAccessors()) if (a.listParents().every((p) => p.propertyType === 'Root')) a.dispose();
}

/** Fit a built character's hands in place; returns the measurements. */
function rehand(doc, overrides, label) {
  const c = open(doc);
  const { moved, data } = fitHands({ meshes: c.meshes, jointNames: c.jointNames, world: c.world, rig, overrides, log: (l) => console.log(`  ${label} ${l}`) });
  if (overrides?.scale || overrides?.l?.scale || overrides?.r?.scale) {
    const Qinv = affineInverse(c.Q);
    for (const m of c.meshes) writePositions(m, Qinv);
  }
  for (const m of c.meshes) writeWeights(m);
  // Finger joints onto the hand: parents first, translations in the parent's frame (rotations stay the rig's).
  const byName = new Map(c.joints.map((j) => [j.getName(), j]));
  const depth = (j) => (j.getParentNode() ? 1 + depth(j.getParentNode()) : 0);
  const newT = new Map();
  const tOf = (name) => newT.get(name) ?? c.world.get(name)?.t;
  for (const name of [...moved.keys()].sort((a, b) => depth(byName.get(a)) - depth(byName.get(b)))) {
    const j = byName.get(name);
    const parent = j.getParentNode();
    const pw = c.world.get(parent.getName());
    newT.set(name, moved.get(name));
    j.setTranslation(qrot(qinv(pw.q), sub(moved.get(name), tOf(parent.getName()))));
  }
  const ibm = c.skin.getInverseBindMatrices();
  const arr = ibm.getArray().slice();
  c.joints.forEach((j, i) => {
    if (!newT.has(j.getName())) return;
    arr.set(mat4Mul(inverseRigid(c.world.get(j.getName()).q, newT.get(j.getName())), c.Q), i * 16);
  });
  ibm.setArray(arr);
  for (const s of ['l', 'r']) if (data[s]) byName.get(`hand_${s}`).setExtras({ ...byName.get(`hand_${s}`).getExtras(), hand: data[s] });
  return data;
}

const triangles = (doc) => doc.getRoot().listMeshes().filter((m) => !/_lod$/.test(m.getName())).reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + p.getIndices().getCount() / 3, 0), 0);
const lodTriangles = (doc) => doc.getRoot().listMeshes().filter((m) => /_lod$/.test(m.getName())).reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + p.getIndices().getCount() / 3, 0), 0);

const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
const only = process.env.ONLY?.split(',').filter(Boolean);
const files = [];
for (const m of readManifests({ ready: true })) {
  if (only && !only.includes(m.id)) continue;
  const spec = buildSpec(m);
  const body = lock.files.find((f) => f.id === m.id);
  if (!body) {
    console.log(`${m.id}: not built yet (prepare-meshy-characters.mjs)`);
    continue;
  }
  console.log(m.id);
  const write = async (doc, id, entry) => {
    doc.getRoot().getAsset().generator = 'tiletrigger prepare-meshy-characters';
    const glb = await io.writeBinary(doc);
    writeFileSync(join(OUT, `${id}.glb`), glb);
    Object.assign(entry, { sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), triangles: triangles(doc), ...(entry.lodTriangles !== undefined ? { lodTriangles: lodTriangles(doc) } : {}), bytes: glb.byteLength, hands: true });
    console.log(`  ${`${id}.glb`.padEnd(26)} ${String(entry.triangles).padStart(6)} tris ${(glb.byteLength / 1024).toFixed(0).padStart(6)} KB`);
  };
  const doc = await io.read(join(OUT, `${m.id}.glb`));
  rehand(doc, spec.hands, 'body');
  await write(doc, m.id, body);
  let arms = lock.files.find((f) => f.id === `${m.id}_fparms`);
  const armsDoc = arms && existsSync(join(OUT, `${m.id}_fparms.glb`)) ? await io.read(join(OUT, `${m.id}_fparms.glb`)) : await io.read(join(OUT, `${m.id}.glb`));
  if (!arms) {
    await cutArms(armsDoc);
    const { file: _f, sha256: _s, triangles: _t, lodTriangles: _l, bytes: _b, hands: _h, role: _r, id: _i, ...from } = body;
    arms = { role: 'meshy-fparms', id: `${m.id}_fparms`, ...from, file: `characters/${m.id}_fparms.glb` };
    lock.files.splice(lock.files.indexOf(body) + 1, 0, arms);
  }
  rehand(armsDoc, spec.hands, 'arms');
  await write(armsDoc, `${m.id}_fparms`, arms);
  files.push(m.id);
}
writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`hands fitted on ${files.length} characters; content/meshy.lock.json updated`);
