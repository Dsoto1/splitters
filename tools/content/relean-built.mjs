// Sits a built whole-body character up in place (its manifest's `fixes.lean`), for a character whose rigged download
// can't be rebuilt here (its Meshy rig task isn't on this key): content/meshy.lock.json is updated.
//
//   ONLY=meshy_skeleton node tools/content/relean-built.mjs
//   ONLY=... OUT=<dir> node tools/content/relean-built.mjs      a trial: the files written to <dir>, the lock left alone
//
// What it does, as prepare-meshy-characters.mjs does with `lean` when it re-poses a download: each spine joint named
// in `lean` (the download's joint names: Spine02 the lowest, Spine01, Spine, neck) turns back by its degrees about the
// body's left-right axis, carrying everything above it; the head keeps the way it faced (or turns back by `lean.Head`),
// and the collarbones and arms ride the chest without turning, so they stay level as the rig's arms are. The skin
// follows (each vertex by its own weights), the joints move to where the turned chain puts them (keeping the rig's
// orientations, so the clips mean the same thing), and the bind matrices follow the joints. The body and its far copy
// change together; the first-person arms (forearms and hands) are untouched.
//
// The file remembers the lean it was given (the skin's `extras.lean`): running it again with the same `lean` changes
// nothing; with another, it fails (rebuild from the download, or put the shipped file back first). A rebuild from the
// rigged download applies `lean` itself, so this is only for shipped files.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { writeLock } from './lockfile.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = join(ROOT, 'packages/client/public/characters');
const LOCK = join(ROOT, 'content/meshy.lock.json');
const TRIAL = process.env.OUT ? resolve(process.env.OUT) : null;
const only = process.env.ONLY?.split(',').filter(Boolean);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** The download's spine joints (as `lean` names them) and the rig's (prepare-meshy-characters.mjs JOINT_MAP). */
export const LEAN_RIG = { Spine02: 'spine_01', Spine01: 'spine_02', Spine: 'spine_03', neck: 'neck_01', Head: 'Head' };
/** Joints that ride the chest without turning: the collarbones and everything below them. */
const ARM_ROOT = /^clavicle_[lr]$/;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
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
/** Back by `deg` about the body's left-right axis (world x; the body faces +z): the top tips toward -z. */
const back = (deg) => [Math.sin((-deg * Math.PI) / 360), 0, 0, Math.cos((-deg * Math.PI) / 360)];
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
  const o = [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, 0, 0, 0, 1];
  const t = mulPoint(o, [m[12], m[13], m[14]]);
  o[12] = -t[0];
  o[13] = -t[1];
  o[14] = -t[2];
  return o;
}
/** World rotation and position of a node at rest. */
function worldRest(node, cache) {
  if (cache.has(node)) return cache.get(node);
  const parent = node.getParentNode();
  const p = parent ? worldRest(parent, cache) : { q: [0, 0, 0, 1], t: [0, 0, 0] };
  const r = { q: qmul(p.q, node.getRotation()), t: add(p.t, qrot(p.q, node.getTranslation())) };
  cache.set(node, r);
  return r;
}

/**
 * Each joint's move (a rotation `q` about its own bind place `at`, then that place carried to `to`): the spine joints
 * in `lean` turn back by their degrees on top of their parent's turn, the head turns back by its own `Head` only, the
 * collarbones and arms ride without turning, everything else (pelvis, legs) as its parent. `parentOf(name)` and
 * `at(name)` describe the bind skeleton; `names` are in parent-before-child order.
 */
export function leanMoves(names, parentOf, at, lean) {
  const deg = Object.fromEntries(Object.entries(lean).map(([k, v]) => [LEAN_RIG[k] ?? k, v]));
  const moves = new Map();
  for (const n of names) {
    const p = parentOf(n);
    const pm = p ? moves.get(p) : null;
    const here = at(n);
    const to = pm ? add(qrot(pm.q, sub(here, pm.at)), pm.to) : here;
    let q = pm ? pm.q : [0, 0, 0, 1];
    if (n === 'Head') q = back(deg.Head ?? 0);
    else if (ARM_ROOT.test(n)) q = [0, 0, 0, 1];
    else if (deg[n]) q = qmul(back(deg[n]), q);
    moves.set(n, { q, at: here, to });
  }
  return moves;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!only?.length) throw new Error('ONLY=<character ids> (content/characters/<id>.json with fixes.lean)');
  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  for (const id of only) {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'content/characters', `${id}.json`), 'utf8'));
    const lean = manifest.fixes?.lean;
    if (!lean) throw new Error(`${id}: no fixes.lean in its manifest`);
    const entry = lock.files.find((f) => f.id === id);
    if (!entry) throw new Error(`${id}: not in content/meshy.lock.json`);
    const file = join(DIR, `${id}.glb`);
    const doc = await io.read(file);
    const root = doc.getRoot();
    const skin = root.listSkins()[0];
    const done = skin.getExtras()?.lean;
    if (done) {
      if (JSON.stringify(done) === JSON.stringify(lean)) {
        console.log(`${id}: already leaned ${JSON.stringify(lean)}`);
        continue;
      }
      throw new Error(`${id}: the shipped file was leaned ${JSON.stringify(done)}; put it back (git) before another lean`);
    }
    const joints = skin.listJoints();
    const names = joints.map((j) => j.getName());
    const cache = new Map();
    const world = new Map(joints.map((j) => [j.getName(), worldRest(j, cache)]));
    const byName = new Map(joints.map((j) => [j.getName(), j]));
    const parentOf = (n) => {
      const p = byName.get(n).getParentNode();
      return p && byName.has(p.getName()) ? p.getName() : null;
    };
    const order = [];
    const seen = new Set();
    const visit = (n) => {
      if (seen.has(n)) return;
      const p = parentOf(n);
      if (p) visit(p);
      seen.add(n);
      order.push(n);
    };
    names.forEach(visit);
    const moves = leanMoves(order, parentOf, (n) => world.get(n).t, lean);
    const ibmAcc = skin.getInverseBindMatrices();
    const ibm = ibmAcc.getArray();
    // The bind transform every vertex takes (quantization folds a scale and offset into the bind matrices).
    const Q = mat4Mul(joints[0].getWorldMatrix(), Array.from(ibm.slice(0, 16)));
    const Qinv = affineInverse(Q);
    const moveOf = names.map((n) => moves.get(n));
    let clamped = 0;
    let verts = 0;
    for (const node of root.listNodes()) {
      if (!node.getMesh() || node.getSkin() !== skin) continue;
      for (const prim of node.getMesh().listPrimitives()) {
        const P = prim.getAttribute('POSITION');
        const N = prim.getAttribute('NORMAL');
        const T = prim.getAttribute('TANGENT');
        const J = prim.getAttribute('JOINTS_0');
        const W = prim.getAttribute('WEIGHTS_0');
        const [v, j, w, nv, tv] = [[0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0], [0, 0, 0, 0]];
        for (let i = 0; i < P.getCount(); i++) {
          J.getElement(i, j);
          W.getElement(i, w);
          const p = mulPoint(Q, P.getElement(i, v));
          let out = [0, 0, 0];
          let qn = [0, 0, 0];
          let qt = [0, 0, 0];
          const sum = w.reduce((a, b) => a + b, 0) || 1;
          if (N) N.getElement(i, nv);
          if (T) T.getElement(i, tv);
          for (let k = 0; k < 4; k++) {
            if (!(w[k] > 0)) continue;
            const m = moveOf[j[k]];
            const s = w[k] / sum;
            out = add(out, scale(add(qrot(m.q, sub(p, m.at)), m.to), s));
            if (N) qn = add(qn, scale(qrot(m.q, nv), s));
            if (T) qt = add(qt, scale(qrot(m.q, [tv[0], tv[1], tv[2]]), s));
          }
          const q = mulPoint(Qinv, out);
          if (q.some((x) => Math.abs(x) > 1)) clamped++;
          P.setElement(i, q.map((x) => Math.max(-1, Math.min(1, x))));
          if (N) {
            const l = Math.hypot(...qn) || 1;
            N.setElement(i, scale(qn, 1 / l));
          }
          if (T) {
            const l = Math.hypot(...qt) || 1;
            T.setElement(i, [...scale(qt, 1 / l), tv[3]]);
          }
          verts++;
        }
      }
    }
    if (clamped) throw new Error(`${id}: ${clamped} vertices left the quantized volume; lean less`);
    // Joints to where the chain puts them, keeping their world orientations (their parents' do not change).
    for (const n of order) {
      const p = parentOf(n);
      const node = byName.get(n);
      const pw = p ? moves.get(p).to : null;
      const pq = p ? world.get(p).q : null;
      if (p) node.setTranslation(qrot(qinv(pq), sub(moves.get(n).to, pw)));
    }
    // Bind matrices: the joint's new place, the same quantization.
    const out = new Float32Array(ibm.length);
    joints.forEach((jn, i) => out.set(mat4Mul(affineInverse(jn.getWorldMatrix()), Q), i * 16));
    ibmAcc.setArray(out);
    skin.setExtras({ ...(skin.getExtras() ?? {}), lean });
    const glb = await io.writeBinary(doc);
    writeFileSync(join(TRIAL ?? DIR, `${id}.glb`), glb);
    Object.assign(entry, { sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), bytes: glb.byteLength });
    const head = moves.get('Head');
    console.log(`${id}: leaned ${JSON.stringify(lean)}; ${verts} vertices; head joint moved ${(Math.hypot(...sub(head.to, head.at)) * 100).toFixed(1)} cm (${head.to.map((x) => x.toFixed(3)).join(', ')})`);
  }
  if (!TRIAL) writeLock(LOCK, lock);
}
