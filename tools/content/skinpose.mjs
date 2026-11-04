// Pose a skinned glTF in Node, as the game draws it: a clip's first frame on the skeleton (the rig's clips
// retargeted the way packages/client/src/content/characters.ts `retarget` does), then linear blend skinning.
// Used by tools/content/hitboxes.mjs (measured hit shapes) and its audit test.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const cache = new Map();

/** A glTF document, read once per path. */
export async function readGlb(path) {
  let p = cache.get(path);
  if (!p) cache.set(path, (p = io.read(path)));
  return p;
}

// Column-major 4x4 matrices (glTF's layout).
export function compose(t, q, s) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
export function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
export const apply = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

/** A clip's first key for each node it moves: Map<node name, { rotation?, translation?, scale? }>. */
export function firstFrame(doc, clip) {
  const anim = doc.getRoot().listAnimations().find((a) => a.getName() === clip);
  if (!anim) return null;
  const out = new Map();
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    const path = ch.getTargetPath();
    if (!node || !['rotation', 'translation', 'scale'].includes(path)) continue;
    const s = ch.getSampler();
    const o = s.getOutput();
    const k = s.getInterpolation() === 'CUBICSPLINE' ? 1 : 0;
    const v = o.getElement(k, []);
    const e = out.get(node.getName()) ?? {};
    e[path] = v;
    out.set(node.getName(), e);
  }
  return out;
}

/**
 * The rig's clip frame put onto another skeleton (by joint name): rotations as they are, the hips' track shifted
 * (or scaled, for hips far off the rig's) to this body's hip height, as the game retargets.
 */
export function retargetFrame(frame, rigDoc, doc) {
  const rest = (d, name) => d.getRoot().listNodes().find((n) => n.getName() === name)?.getTranslation();
  const rp = rest(rigDoc, 'pelvis');
  const bp = rest(doc, 'pelvis');
  if (!rp || !bp) return frame;
  const len = (v) => Math.hypot(v[0], v[1], v[2]);
  const ratio = len(bp) / Math.max(1e-6, len(rp));
  const k = Math.abs(ratio - 1) > 0.1 ? ratio : 1;
  const offset = [bp[0] - rp[0] * k, bp[1] - rp[1] * k, bp[2] - rp[2] * k];
  const out = new Map();
  for (const [name, e] of frame) {
    const f = { ...e };
    if (name === 'pelvis' && e.translation) f.translation = [e.translation[0] * k + offset[0], e.translation[1] * k + offset[1], e.translation[2] * k + offset[2]];
    out.set(name, f);
  }
  return out;
}

/**
 * World matrices of every node with `frame` applied (null: the rest pose). Returns Map<Node, matrix>.
 */
export function worldMatrices(doc, frame) {
  const out = new Map();
  const visit = (node, parent) => {
    const f = frame?.get(node.getName());
    const local = compose(f?.translation ?? node.getTranslation(), f?.rotation ?? node.getRotation(), f?.scale ?? node.getScale());
    const world = parent ? mul(parent, local) : local;
    out.set(node, world);
    for (const c of node.listChildren()) visit(c, world);
  };
  for (const scene of doc.getRoot().listScenes()) for (const n of scene.listChildren()) visit(n, null);
  return out;
}

/**
 * Every skinned vertex of the document's full-detail meshes (`_lod` copies left out), posed by `frame` (null: rest),
 * with its strongest joint's name. Returns { x: Float64Array, y, z, joint: string[] }.
 */
export function skinnedVertices(doc, frame) {
  const world = worldMatrices(doc, frame);
  const xs = [], ys = [], zs = [], js = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh || /_lod/.test(mesh.getName()) || /_lod/.test(node.getName())) continue;
    const joints = skin?.listJoints() ?? [];
    const ibm = skin?.getInverseBindMatrices();
    const skinMats = joints.map((j, i) => mul(world.get(j), ibm ? ibm.getElement(i, []) : compose([0, 0, 0], [0, 0, 0, 1], [1, 1, 1])));
    const nodeWorld = world.get(node);
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const J = prim.getAttribute('JOINTS_0');
      const W = prim.getAttribute('WEIGHTS_0');
      const p = [], jj = [], ww = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p);
        if (!skin || !J || !W) {
          const v = apply(nodeWorld, p[0], p[1], p[2]);
          xs.push(v[0]); ys.push(v[1]); zs.push(v[2]); js.push(node.getName());
          continue;
        }
        J.getElement(i, jj);
        W.getElement(i, ww);
        let x = 0, y = 0, z = 0, best = -1, bw = -1;
        for (let k = 0; k < 4; k++) {
          const w = ww[k];
          if (!w) continue;
          const v = apply(skinMats[jj[k]], p[0], p[1], p[2]);
          x += v[0] * w; y += v[1] * w; z += v[2] * w;
          if (w > bw) { bw = w; best = jj[k]; }
        }
        const sum = ww[0] + ww[1] + ww[2] + ww[3] || 1;
        xs.push(x / sum); ys.push(y / sum); zs.push(z / sum);
        js.push(joints[best]?.getName() ?? '');
      }
    }
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), z: Float64Array.from(zs), joint: js };
}

/** World positions of named joints with `frame` applied. */
export function jointPositions(doc, frame) {
  const world = worldMatrices(doc, frame);
  const out = {};
  for (const [node, m] of world) out[node.getName()] = [m[12], m[13], m[14]];
  return out;
}

/** Joint name → parent joint name (for the skeleton's hierarchy). */
export function jointParents(doc) {
  const out = {};
  for (const n of doc.getRoot().listNodes()) for (const c of n.listChildren()) out[c.getName()] = n.getName();
  return out;
}
