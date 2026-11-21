// Hands for characters already built (packages/client/public/characters/<id>.glb), without their raw
// downloads: (with fixes.armCloth) armweights.mjs hands cloth hanging off an arm to the body, hands.mjs measures each hand, fits the finger joints to it, re-skins the hand region with
// finger weights and writes the measurements on the hand joints (`extras.hand`), in place, for the body
// and its first-person arms. A character with no first-person arms yet gets them cut from its body, as
// prepare-meshy-characters.mjs cuts them from a download (forearms and hands; the elbow half of each
// forearm dropped, sleeves pulled in, hands a little smaller). content/meshy.lock.json is updated.
//
//   node tools/content/rehand-built.mjs            every character with a manifest
//   ONLY=<ids> node tools/content/rehand-built.mjs just those
//   OUT=<dir> ...                                 a trial: the files written to <dir>, the lock left alone
//   SIDES=r ...                                   refit only those hands (l, r); the other is kept as built
//                                                 (a refit from the built file measures a hand a little differently
//                                                 from the download, so a fix for one hand needn't move the other)
//
// Running it again gives the same files (the hand chain's weights are shared out afresh each time).
// prepare-meshy-characters.mjs does the same at import, so a rebuild from the downloads keeps all this.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, prune } from '@gltf-transform/functions';
import { buildSpec, readManifests } from './character-manifests.mjs';
import { fitHands } from './hands.mjs';
import { keepArmsToArms } from './armweights.mjs';
import { bodySkin, fingerSkin, fixBodySkin } from './skinfix.mjs';
import { writeLock } from './lockfile.mjs';
import { graftHands } from './handgraft.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/characters');
/** OUT=<dir>: a trial, the refitted files written there instead (outside the repo) and the lock left alone. */
const TRIAL = process.env.OUT ? resolve(process.env.OUT) : null;
const LOCK = join(ROOT, 'content/meshy.lock.json');
const SIDES = process.env.SIDES ? process.env.SIDES.split(',').filter((x) => x === 'l' || x === 'r') : ['l', 'r'];
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
      const UV = prim.getAttribute('TEXCOORD_0');
      const N = prim.getAttribute('NORMAL');
      const uv = UV ? new Float32Array(n * 2) : null;
      const nrm = N ? new Float32Array(n * 3) : null;
      const el = [0, 0, 0, 0];
      for (let v = 0; v < n; v++) {
        pos.set(mulPoint(Q, P.getElement(v, el)), v * 3);
        J.set(prim.getAttribute('JOINTS_0').getElement(v, el), v * 4);
        W.set(prim.getAttribute('WEIGHTS_0').getElement(v, el), v * 4);
        if (uv) uv.set(UV.getElement(v, el).slice(0, 2), v * 2);
        if (nrm) nrm.set(N.getElement(v, el).slice(0, 3), v * 3);
      }
      meshes.push({ node, prim, pos, J, W, uv, nrm, idx: prim.getIndices()?.getArray() ?? null, lod: /_lod$/.test(node.getName()) });
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

/** The donor of new hand geometry (`fixes.hands.graft`, handgraft.mjs): the athlete body part, as shipped. */
let donorDoc = null;
const DONOR = process.env.GRAFT_DONOR ?? 'athlete_torso_m';
/** Levels of subdivision of the donor's hand (handgraft.mjs `subdivide`; GRAFT_SMOOTH for a trial). */
const GRAFT_SMOOTH = Number(process.env.GRAFT_SMOOTH ?? 1);
const donor = async () => (donorDoc ??= await io.read(join(OUT, `${DONOR}.glb`)));

/** Per-vertex tangents from positions, normals and texture coordinates (the normal map's frame on new vertices). */
function tangents(pos, nrm, uv, idx) {
  const n = pos.length / 3;
  const t = new Float64Array(n * 3);
  const b = new Float64Array(n * 3);
  for (let i = 0; i < idx.length; i += 3) {
    const [i0, i1, i2] = [idx[i], idx[i + 1], idx[i + 2]];
    const e1 = sub(pos.slice(i1 * 3, i1 * 3 + 3), pos.slice(i0 * 3, i0 * 3 + 3));
    const e2 = sub(pos.slice(i2 * 3, i2 * 3 + 3), pos.slice(i0 * 3, i0 * 3 + 3));
    const [du1, dv1] = [uv[i1 * 2] - uv[i0 * 2], uv[i1 * 2 + 1] - uv[i0 * 2 + 1]];
    const [du2, dv2] = [uv[i2 * 2] - uv[i0 * 2], uv[i2 * 2 + 1] - uv[i0 * 2 + 1]];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    const r = 1 / det;
    const T = scale(sub(scale(e1, dv2), scale(e2, dv1)), r);
    const B = scale(sub(scale(e2, du1), scale(e1, du2)), r);
    for (const v of [i0, i1, i2]) for (let k = 0; k < 3; k++) [t[v * 3 + k], b[v * 3 + k]] = [t[v * 3 + k] + T[k], b[v * 3 + k] + B[k]];
  }
  const out = [];
  for (let v = 0; v < n; v++) {
    const N = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    let T = [t[v * 3], t[v * 3 + 1], t[v * 3 + 2]];
    T = sub(T, scale(N, dot(N, T)));
    let len = Math.hypot(...T);
    if (len < 1e-9) {
      // No texture slope (a flat-coloured triangle): any direction square to the normal.
      T = cross(N, Math.abs(N[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
      len = Math.hypot(...T) || 1;
    }
    T = scale(T, 1 / len);
    const w = dot(cross(N, T), [b[v * 3], b[v * 3 + 1], b[v * 3 + 2]]) < 0 ? -1 : 1;
    out.push([...T, w]);
  }
  return out;
}

/**
 * New hand geometry (`fixes.hands.graft`: true, or 'l' / 'r'): the old hands replaced by the rig's own, fitted
 * (handgraft.mjs), before they are measured. Once per file (`extras.graft` on its skin records the sides).
 */
async function graft(doc, which, label) {
  const want = which === true ? ['l', 'r'] : [which];
  const skin = doc.getRoot().listSkins()[0];
  const had = skin.getExtras()?.graft ?? [];
  const sides = want.filter((s) => !had.includes(s));
  if (!sides.length) return;
  const c = open(doc);
  const d = open(await donor());
  // The donor's skin: of its primitives (a part's sleeve and skin are two), the one its hands are on, each detail.
  const handVerts = (m2) => {
    let k = 0;
    for (let v = 0; v < m2.pos.length / 3; v++) {
      let w = 0;
      for (let q = 0; q < 4; q++) if (/^(hand|index|middle|ring|pinky|thumb)_/.test(d.jointNames[m2.J[v * 4 + q]])) w += m2.W[v * 4 + q];
      if (w >= 0.5) k++;
    }
    return k;
  };
  d.meshes = [false, true].map((lod) => d.meshes.filter((m2) => m2.lod === lod).sort((a, b) => handVerts(b) - handVerts(a))[0]).filter(Boolean);
  const measure = (x, ss) => fitHands({ meshes: x.meshes, jointNames: x.jointNames, world: x.world, rig, sides: ss, keep: ss }).data;
  const { moved, sides: done } = graftHands({ target: c, donor: d, sides, measure, smooth: GRAFT_SMOOTH, log: (l) => console.log(`  ${label} ${l}`) });
  const Qinv = affineInverse(c.Q);
  for (const m of c.meshes) {
    if (!m.added?.length) continue;
    const n = m.pos.length / 3;
    const extra = m.added.reduce((k, a) => k + a.pos.length, 0);
    // Every attribute grown by the new vertices (written below, in the accessors' own encodings).
    for (const sem of m.prim.listSemantics()) {
      const a = m.prim.getAttribute(sem);
      const old = a.getArray();
      const grown = new old.constructor((n + extra) * a.getElementSize());
      grown.set(old);
      a.setArray(grown);
    }
    const kept = [];
    for (let i = 0; i < m.idx.length; i += 3) if (!m.drop?.has(i)) kept.push(m.idx[i], m.idx[i + 1], m.idx[i + 2]);
    let at = n;
    const P = m.prim.getAttribute('POSITION');
    for (const a of m.added) {
      const flatPos = a.pos.flat();
      const flatN = a.nrm.flat();
      const flatUV = a.uv.flat();
      const tan = tangents(flatPos, flatN, flatUV, a.idx);
      a.pos.forEach((p, i) => {
        const v = at + i;
        P.setElement(v, mulPoint(Qinv, p).map((x) => Math.max(-1, Math.min(1, x))));
        m.prim.getAttribute('NORMAL')?.setElement(v, a.nrm[i]);
        m.prim.getAttribute('TEXCOORD_0')?.setElement(v, a.uv[i]);
        m.prim.getAttribute('TANGENT')?.setElement(v, tan[i]);
        m.prim.getAttribute('JOINTS_0').setElement(v, a.J[i]);
        m.prim.getAttribute('WEIGHTS_0').setElement(v, a.W[i]);
      });
      for (const i of a.idx) kept.push(at + i);
      at += a.pos.length;
    }
    m.prim.getIndices().setArray(new Uint32Array(kept));
    compactPrimitive(m.prim);
  }
  await doc.transform(prune({ keepAttributes: true }));
  for (const a of doc.getRoot().listAccessors()) if (a.listParents().every((p) => p.propertyType === 'Root')) a.dispose();
  // The rig's finger and thumb joints onto the new hands (as rehand moves them: translations, bind matrices).
  const byName = new Map(c.joints.map((j) => [j.getName(), j]));
  const depth = (j) => (j.getParentNode() ? 1 + depth(j.getParentNode()) : 0);
  const newT = new Map();
  const tOf = (name) => newT.get(name) ?? c.world.get(name)?.t;
  for (const name of [...moved.keys()].sort((a, b) => depth(byName.get(a)) - depth(byName.get(b)))) {
    const j = byName.get(name);
    const pw = c.world.get(j.getParentNode().getName());
    newT.set(name, moved.get(name));
    j.setTranslation(qrot(qinv(pw.q), sub(moved.get(name), tOf(j.getParentNode().getName()))));
  }
  const ibm = c.skin.getInverseBindMatrices();
  const arr = ibm.getArray().slice();
  c.joints.forEach((j, i) => {
    if (newT.has(j.getName())) arr.set(mat4Mul(inverseRigid(c.world.get(j.getName()).q, newT.get(j.getName())), c.Q), i * 16);
  });
  ibm.setArray(arr);
  // Measured only from now on: the rig's own finger weights are kept (hands.mjs `keep`).
  for (const s of done) byName.get(`hand_${s}`).setExtras({ ...byName.get(`hand_${s}`).getExtras(), hand: { ...(byName.get(`hand_${s}`).getExtras()?.hand ?? {}), fingers: 'own' } });
  skin.setExtras({ ...skin.getExtras(), graft: [...had, ...done].sort() });
}

/** Fit a built character's hands in place; returns the measurements. */
function rehand(doc, overrides, label, skinFix) {
  const c = open(doc);
  // Cloth hanging off an arm goes with the body (armweights.mjs), then the hands are fitted without it.
  // Opt-in (fixes.armCloth), by distance along the surface (armweights.mjs).
  if (label === 'body' && overrides?.armCloth) keepArmsToArms({ meshes: c.meshes, jointNames: c.jointNames, world: c.world, log: (l) => console.log(`  ${label} ${l}`) });
  // A hand built with the download's own fingers (`fixes.fingers: own`, extras.hand.fingers 'own') keeps them: measured only.
  const keep = ['l', 'r'].filter((s) => c.joints.find((j) => j.getName() === `hand_${s}`)?.getExtras()?.hand?.fingers === 'own');
  const { moved, data } = fitHands({ meshes: c.meshes, jointNames: c.jointNames, world: c.world, rig, overrides, skin: fingerSkin(skinFix), sides: SIDES, keep, log: (l) => console.log(`  ${label} ${l}`) });
  // This look's body skin fixes (fixes.skin; skinfix.mjs), once: a file records the ones it was given.
  const body = bodySkin(skinFix);
  const had = c.skin.getExtras()?.skinFix;
  if (body && JSON.stringify(had) !== JSON.stringify(body)) {
    if (had) console.log(`  ${label} skin fixes were ${JSON.stringify(had)}: the new ones go on top (start from the file before them to replace them)`);
    const parentOf = new Map(c.joints.map((j) => [j.getName(), j.getParentNode()?.getName()]));
    fixBodySkin({ meshes: c.meshes.map((m) => ({ ...m, idx: m.idx ?? new Uint32Array(0) })), jointNames: c.jointNames, parentOf, fix: body, world: c.world, hands: { l: data.l ?? c.joints.find((j) => j.getName() === 'hand_l')?.getExtras()?.hand, r: data.r ?? c.joints.find((j) => j.getName() === 'hand_r')?.getExtras()?.hand }, log: (l) => console.log(`  ${label} ${l}`) });
    c.skin.setExtras({ ...c.skin.getExtras(), skinFix: body });
  }
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

/**
 * A built hand was scaled at import (`fixes.hands.scale`, prepare-meshy-characters.mjs): scaled again here, every
 * run shrank it further (Saint Nick's, Rattles', Anubis', Ashwalker's and Agent Zhao's hands, 2026-11-01).
 */
function withoutScale(hands) {
  if (!hands) return hands;
  const { scale: _s, l, r, ...rest } = hands;
  const side = (h) => {
    if (!h) return h;
    const { scale: _x, ...k } = h;
    return k;
  };
  return { ...rest, ...(l ? { l: side(l) } : {}), ...(r ? { r: side(r) } : {}) };
}

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
    writeFileSync(join(TRIAL ?? OUT, `${id}.glb`), glb);
    // (`graft`: the sides with new hand geometry, handgraft.mjs; provenance names the hands' source.)
    const grafted = doc.getRoot().listSkins()[0]?.getExtras()?.graft;
    Object.assign(entry, { sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), triangles: triangles(doc), ...(entry.lodTriangles !== undefined ? { lodTriangles: lodTriangles(doc) } : {}), bytes: glb.byteLength, hands: true, ...(grafted?.length ? { graft: grafted.join(' ') } : {}) });
    console.log(`  ${`${id}.glb`.padEnd(26)} ${String(entry.triangles).padStart(6)} tris ${(glb.byteLength / 1024).toFixed(0).padStart(6)} KB`);
  };
  const doc = await io.read(join(OUT, `${m.id}.glb`));
  if (spec.hands?.graft) await graft(doc, spec.hands.graft, 'body');
  rehand(doc, { ...withoutScale(spec.hands), armCloth: !!spec.armCloth }, 'body', spec.skin);
  await write(doc, m.id, body);
  let arms = lock.files.find((f) => f.id === `${m.id}_fparms`);
  const armsDoc = arms && existsSync(join(OUT, `${m.id}_fparms.glb`)) ? await io.read(join(OUT, `${m.id}_fparms.glb`)) : await io.read(join(OUT, `${m.id}.glb`));
  if (!arms) {
    await cutArms(armsDoc);
    const { file: _f, sha256: _s, triangles: _t, lodTriangles: _l, bytes: _b, hands: _h, role: _r, id: _i, ...from } = body;
    arms = { role: 'meshy-fparms', id: `${m.id}_fparms`, ...from, file: `characters/${m.id}_fparms.glb` };
    lock.files.splice(lock.files.indexOf(body) + 1, 0, arms);
  }
  // (Arms cut here from the body just now are already scaled as the body is; arms built at import were scaled then.)
  if (spec.hands?.graft) await graft(armsDoc, spec.hands.graft, 'arms');
  rehand(armsDoc, withoutScale(spec.hands), 'arms', spec.skin);
  await write(armsDoc, `${m.id}_fparms`, arms);
  files.push(m.id);
}
if (TRIAL) console.log(`hands fitted on ${files.length} characters, written to ${TRIAL} (trial: lock unchanged)`);
else {
  writeLock(LOCK, lock);
  console.log(`hands fitted on ${files.length} characters; content/meshy.lock.json updated`);
}
