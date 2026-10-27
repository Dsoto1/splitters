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
//
// Some models came as Meshy's textured FBX download with no rig (FBX_CHARACTERS:
// the unzipped "Meshy_AI_<name>_..._texture_fbx" folders, anywhere under the
// downloads dir, 2.5–61 MB each). Those are rigged here first: the mesh is
// welded and pre-simplified, the joints go where FBX_CHARACTERS places them
// (by hand, read off front and side views, in units of the model's height),
// and each vertex follows the bone nearest to it along the surface (measured
// from vertices close to the bone's middle, so an arm hanging by the body
// doesn't take the torso with it; see autoSkin), blended across the joints by
// smoothing the weights over the mesh; a tail rides on the hips and the feet
// are turned to the rig's too (bent knees leave toes pointing down once the
// legs are straightened). SKIN_DEBUG=<dir> writes each rest mesh coloured by
// its joints, to check the weights. Then it goes through the same
// steps as the rest. Their first-person arms are the universal ones (looks.ts),
// so they get no _fparms file. A character whose download isn't there is kept
// as built (checked against the lock).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, prune, quantize, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { fbxToDocument } from './fbx.mjs';

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
  {
    id: 'meshy_nova',
    meshy: { preview: '01a17408-6ee3-7596-80cc-44711c118d2f', refine: '01a17409-5c80-7338-a476-32f6a5f454ec', remesh: '01a1740b-3c5d-7717-8fc8-6a15ce6dce9a', rig: '01a1740c-f882-7213-bc97-68ffda286170' },
    metallic: 0.05,
    roughness: 0.6,
  },
  {
    id: 'meshy_dapper',
    meshy: { preview: '01a17408-78ca-7473-b379-648d7e9aa349', refine: '01a17409-66cf-7542-bf7f-d39040dd0f4f', remesh: '01a1740b-3ff1-71f3-8005-cd3e767884b8', rig: '01a1740d-0845-7780-8c84-b7f26c5ea616' },
    metallic: 0.05,
    roughness: 0.7,
  },
];

/**
 * Landmarks in model space, in units of the model's height with the feet at
 * y = 0 (+x is the character's left, +z its front): the body's joints (Meshy's
 * names, so JOINT_MAP and REPOSE apply), plus the ends of the head, hands and
 * toes. `L`/`R` give the left and right side's joints in the same order.
 */
const SIDE_JOINTS = ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'HandTip', 'UpLeg', 'Leg', 'Foot', 'ToeBase', 'ToeTip'];
const landmarks = ({ spine, L, R }) => {
  const out = Object.fromEntries(['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end'].map((n, i) => [n, spine[i]]));
  SIDE_JOINTS.forEach((n, i) => {
    out[`Left${n}`] = L[i];
    out[`Right${n}`] = R[i];
  });
  return out;
};

/**
 * Unrigged Meshy FBX downloads, rigged here: the download's file name, the
 * triangles to keep, the finish, and the landmarks (spine: hips to head end;
 * each side: clavicle, shoulder, elbow, wrist, hand tip, hip, knee, ankle, ball, toe tip).
 */
const FBX_CHARACTERS = [
  {
    id: 'meshy_goblin',
    fbx: /^Meshy_AI_Goblin_.*_texture\.fbx$/,
    triangles: 11000,
    feet: true,
    // Its rags are hundreds of small UV islands, whose seams stop the simplifier near 20k triangles (within the
    // creature budget); collapsing across them scrambles the texture.
    metallic: 0,
    roughness: 0.75,
    joints: landmarks({
      spine: [[0, 0.43, -0.03], [0, 0.5, -0.03], [0, 0.58, -0.01], [0, 0.65, 0.02], [0, 0.7, 0.07], [0, 0.74, 0.11], [0, 0.95, 0.14]],
      L: [[0.05, 0.665, 0.03], [0.217, 0.667, 0.04], [0.317, 0.525, 0.075], [0.3, 0.408, 0.15], [0.258, 0.317, 0.2], [0.085, 0.41, -0.01], [0.13, 0.32, 0.17], [0.24, 0.083, 0.06], [0.26, 0.025, 0.23], [0.27, 0.02, 0.3]],
      R: [[-0.05, 0.665, 0], [-0.217, 0.667, -0.08], [-0.308, 0.52, -0.25], [-0.317, 0.4, -0.19], [-0.3, 0.3, -0.17], [-0.085, 0.41, -0.03], [-0.183, 0.333, -0.2], [-0.15, 0.083, -0.25], [-0.16, 0.025, -0.13], [-0.16, 0.02, -0.083]],
    }),
  },
  {
    id: 'meshy_otter',
    fbx: /^Meshy_AI_Wealthy_Otter_.*_texture\.fbx$/,
    tail: [[-0.03, 0.3, -0.06], [0.18, 0.13, -0.18], [0.36, 0.22, -0.3]],
    triangles: 11000,
    feet: true,
    metallic: 0.1,
    roughness: 0.6,
    joints: landmarks({
      spine: [[-0.07, 0.36, 0.06], [-0.07, 0.45, 0.05], [-0.07, 0.55, 0.09], [-0.07, 0.66, 0.1], [-0.07, 0.78, 0.08], [-0.06, 0.82, 0.07], [-0.05, 0.98, 0.1]],
      L: [[-0.02, 0.74, 0.08], [0.06, 0.72, 0.07], [0.142, 0.608, 0.08], [0.175, 0.525, 0.1], [0.208, 0.45, 0.12], [0.03, 0.32, 0.06], [0.09, 0.17, 0.05], [0.11, 0.05, 0.03], [0.11, 0.025, 0.12], [0.11, 0.02, 0.23]],
      R: [[-0.12, 0.74, 0.08], [-0.2, 0.72, 0.07], [-0.25, 0.608, 0.08], [-0.29, 0.525, 0.1], [-0.342, 0.458, 0.12], [-0.16, 0.32, 0.06], [-0.2, 0.17, 0.05], [-0.22, 0.05, 0.03], [-0.22, 0.025, 0.1], [-0.22, 0.02, 0.17]],
    }),
  },
  {
    id: 'meshy_toad',
    fbx: /^Meshy_AI_Boglurker_the_toad_.*_texture\.fbx$/,
    triangles: 11000,
    feet: true,
    metallic: 0,
    roughness: 0.7,
    joints: landmarks({
      spine: [[0, 0.46, -0.07], [0, 0.54, -0.08], [0, 0.62, -0.07], [0, 0.7, -0.07], [0, 0.77, -0.03], [0, 0.8, 0], [0, 0.97, 0.05]],
      L: [[0.06, 0.74, -0.03], [0.17, 0.74, -0.01], [0.3, 0.533, 0.03], [0.325, 0.4, 0.05], [0.342, 0.308, 0.05], [0.09, 0.44, -0.06], [0.167, 0.267, 0.06], [0.2, 0.08, -0.12], [0.21, 0.025, 0], [0.22, 0.02, 0.07]],
      R: [[-0.06, 0.74, -0.03], [-0.17, 0.74, -0.01], [-0.308, 0.533, 0.03], [-0.342, 0.408, 0.05], [-0.367, 0.35, 0.05], [-0.09, 0.44, -0.06], [-0.15, 0.267, 0.06], [-0.183, 0.08, -0.12], [-0.2, 0.025, 0], [-0.21, 0.02, 0.07]],
    }),
  },
  {
    id: 'meshy_salamander',
    fbx: /^Meshy_AI_Salamander_Warlord_.*_texture\.fbx$/,
    triangles: 11000,
    feet: true,
    metallic: 0.3,
    roughness: 0.5,
    joints: landmarks({
      spine: [[0, 0.52, -0.02], [0, 0.58, -0.03], [0, 0.65, -0.03], [0, 0.72, -0.04], [0, 0.79, -0.02], [0, 0.83, 0], [0, 0.94, 0]],
      L: [[0.05, 0.76, -0.02], [0.15, 0.725, -0.03], [0.217, 0.6, 0], [0.233, 0.49, 0], [0.242, 0.367, 0.04], [0.07, 0.5, -0.03], [0.083, 0.325, -0.02], [0.1, 0.1, -0.05], [0.1, 0.025, 0.03], [0.1, 0.02, 0.07]],
      R: [[-0.05, 0.76, -0.02], [-0.15, 0.725, -0.03], [-0.217, 0.6, 0], [-0.233, 0.49, 0], [-0.242, 0.367, 0.04], [-0.07, 0.5, -0.03], [-0.083, 0.325, -0.02], [-0.1, 0.1, -0.05], [-0.1, 0.025, 0.03], [-0.1, 0.02, 0.07]],
    }),
  },
  {
    id: 'meshy_hyena',
    fbx: /^Meshy_AI_Hyena_Warrior_.*_texture\.fbx$/,
    tail: [[0, 0.5, -0.06], [0, 0.33, -0.11], [0, 0.22, -0.17], [0, 0.15, -0.14]],
    triangles: 10000,
    feet: true,
    metallic: 0.15,
    roughness: 0.6,
    joints: landmarks({
      spine: [[0, 0.53, -0.02], [0, 0.6, -0.02], [0, 0.67, 0], [0, 0.74, 0], [0, 0.83, 0], [0, 0.87, 0.03], [0, 0.99, 0.05]],
      L: [[0.04, 0.8, 0], [0.11, 0.78, 0], [0.158, 0.642, 0], [0.175, 0.508, 0.02], [0.183, 0.442, 0.03], [0.06, 0.51, -0.01], [0.108, 0.325, 0.1], [0.11, 0.15, 0], [0.11, 0.025, 0.07], [0.11, 0.02, 0.12]],
      R: [[-0.04, 0.8, 0], [-0.11, 0.78, 0], [-0.158, 0.642, 0], [-0.175, 0.508, 0.02], [-0.183, 0.442, 0.03], [-0.06, 0.51, -0.01], [-0.108, 0.325, 0.1], [-0.11, 0.15, 0], [-0.11, 0.025, 0.07], [-0.11, 0.02, 0.12]],
    }),
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

/** Feet turned to point the way the rig's do (FBX characters, whose knees are often bent with the toes pointing down once straightened). */
const REPOSE_FEET = ['l', 'r'].map((s) => {
  const S = s === 'l' ? 'Left' : 'Right';
  return [`${S}Foot`, `${S}ToeBase`, `foot_${s}`, `ball_${s}`];
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

/** A Meshy rigged GLB at rest (its joints, and each vertex's world position as each joint holding it puts it), re-posed to the rig's stance. */
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
  const material = prim.getMaterial();
  const baseColor = material.getBaseColorTexture()?.getImage();
  if (!baseColor) throw new Error(`${file}: no base colour texture`);
  const index = new Map(names.map((n, i) => [n, i]));
  const skel = { names, parent: joints.map((j) => index.get(j.getParentNode()?.getName()) ?? -1), rest };
  const verts = {
    count: P.length / 3,
    joints: J,
    weights: prim.getAttribute('WEIGHTS_0').getArray(),
    // Rest pose in world space as joint j holds the vertex.
    at: (v, j) => [mulPoint(skinMat[j], [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]), mulDir(skinMat[j], [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]])],
    uv: prim.getAttribute('TEXCOORD_0').getArray(),
    indices: prim.getIndices().getArray(),
    baseColor,
  };
  return pose(skel, verts, ual, c);
}

/**
 * A skinned mesh at rest re-posed to the rig's stance (arms out level, legs
 * straight down), then stood at the rig's height with its feet on the ground.
 * `skel` is the source joints (Meshy names, parent indices, world positions),
 * `verts` the mesh (`at(v, j)`: vertex v's world position and normal as joint j holds it).
 */
function pose(skel, verts, ual, c) {
  const { names, parent, rest } = skel;
  const { count, joints: J, weights: W } = verts;
  // Re-pose: walk the joints parents first, turning the listed bones to the rig's directions.
  const index = new Map(names.map((n, i) => [n, i]));
  const rot = new Array(names.length);
  const posed = new Array(names.length);
  const visit = (i) => {
    if (rot[i]) return;
    const pi = parent[i];
    if (pi >= 0) {
      visit(pi);
      rot[i] = rot[pi];
      posed[i] = add(posed[pi], qrot(rot[pi], sub(rest[i], rest[pi])));
    } else {
      rot[i] = [0, 0, 0, 1];
      posed[i] = rest[i];
    }
    const rule = (c.feet ? [...REPOSE, ...REPOSE_FEET] : REPOSE).find((r) => r[0] === names[i]);
    if (rule) {
      const child = index.get(rule[1]);
      const now = norm(qrot(rot[i], sub(rest[child], rest[i])));
      const want = norm(sub(ual.get(rule[3]).t, ual.get(rule[2]).t));
      rot[i] = qmul(qFromTo(now, want), rot[i]);
    }
  };
  // Children's positions depend on their parents' final turn, so settle every parent before its children.
  const depth = (i) => {
    let d = 0;
    for (let p = parent[i]; p >= 0; p = parent[p]) d++;
    return d;
  };
  for (const i of [...names.keys()].sort((a, b) => depth(a) - depth(b))) visit(i);

  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    let p = [0, 0, 0];
    let n = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = W[v * 4 + k];
      if (!w) continue;
      const j = J[v * 4 + k];
      // Rest pose in world space, then about the joint to its re-posed place.
      const [pw, nw] = verts.at(v, j);
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
  return {
    names,
    posed: new Map(names.map((n, i) => [n, posed[i]])),
    pos,
    nrm,
    uv: verts.uv,
    joints: J,
    weights: W,
    indices: verts.indices,
    baseColor: verts.baseColor,
  };
}

/** The joints an FBX character is rigged with (Meshy's names) and their parents. */
const FBX_JOINTS = [
  ['Hips', null],
  ['Spine02', 'Hips'],
  ['Spine01', 'Spine02'],
  ['Spine', 'Spine01'],
  ['neck', 'Spine'],
  ['Head', 'neck'],
  ...['Left', 'Right'].flatMap((S) => [
    [`${S}Shoulder`, 'Spine'],
    [`${S}Arm`, `${S}Shoulder`],
    [`${S}ForeArm`, `${S}Arm`],
    [`${S}Hand`, `${S}ForeArm`],
    [`${S}UpLeg`, 'Hips'],
    [`${S}Leg`, `${S}UpLeg`],
    [`${S}Foot`, `${S}Leg`],
    [`${S}ToeBase`, `${S}Foot`],
  ]),
];
/** The bones that hold the mesh, as [joint, from landmark, to landmark] (the pelvis spans both hips too). */
const FBX_BONES = [
  ['Hips', 'Hips', 'Spine02'],
  ['Hips', 'LeftUpLeg', 'RightUpLeg'],
  ['Spine02', 'Spine02', 'Spine01'],
  ['Spine01', 'Spine01', 'Spine'],
  ['Spine', 'Spine', 'neck'],
  ['neck', 'neck', 'Head'],
  ['Head', 'Head', 'head_end'],
  ...['Left', 'Right'].flatMap((S) =>
    [
      ['Shoulder', 'Arm'],
      ['Arm', 'ForeArm'],
      ['ForeArm', 'Hand'],
      ['Hand', 'HandTip'],
      ['UpLeg', 'Leg'],
      ['Leg', 'Foot'],
      ['Foot', 'ToeBase'],
      ['ToeBase', 'ToeTip'],
    ].map(([a, b]) => [`${S}${a}`, `${S}${a}`, `${S}${b}`]),
  ),
];
/** Triangles the FBX mesh is cut to before rigging (the rig is fitted at this detail, then build() simplifies further). */
const WORK_TRIANGLES = 40000;
/** How far the weights blend across a joint (share of the height). */
const BLEND = 0.035;
/** Seeds: vertices within SEED_REACH times the SEED_PERCENTILE distance of their nearest bone's middle. */
const SEED_PERCENTILE = 0.25;
const SEED_REACH = 1.4;
/** How much a bone's straight-line distance counts against its distance along the surface. */
const STRAIGHT_WEIGHT = 1.5;

/** An unrigged Meshy FBX, rigged from its landmarks and re-posed to the rig's stance. */
async function readFbx(file, c, ual) {
  const { doc } = await fbxToDocument(file);
  const mesh = doc.getRoot().listMeshes()[0];
  if (doc.getRoot().listMeshes().length !== 1 || mesh.listPrimitives().length !== 1) throw new Error(`${file}: expected one mesh with one material`);
  // fbxToDocument writes unindexed triangles.
  const sourceTriangles = mesh.listPrimitives()[0].getAttribute('POSITION').getCount() / 3;
  await doc.transform(weld());
  {
    // Cut to the working detail (texture seams are kept, so the base colour still fits).
    const p = mesh.listPrimitives()[0];
    const target = Math.min(p.getIndices().getCount(), WORK_TRIANGLES * 3);
    const [cut] = MeshoptSimplifier.simplify(new Uint32Array(p.getIndices().getArray()), new Float32Array(p.getAttribute('POSITION').getArray()), 3, target, 0.01, []);
    p.getIndices().setArray(cut);
    compactPrimitive(p);
  }
  await doc.transform(prune({ keepAttributes: true }));
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const P = prim.getAttribute('POSITION').getArray();
  const N = prim.getAttribute('NORMAL').getArray();
  const indices = prim.getIndices().getArray();
  let [low, high] = [Infinity, -Infinity];
  for (let v = 1; v < P.length; v += 3) [low, high] = [Math.min(low, P[v]), Math.max(high, P[v])];
  const H = high - low;
  const at = (name) => {
    const l = c.joints[name];
    if (!l) throw new Error(`${c.id}: no landmark ${name}`);
    return [l[0] * H, low + l[1] * H, l[2] * H];
  };
  const names = FBX_JOINTS.map(([n]) => n);
  const index = new Map(names.map((n, i) => [n, i]));
  const bones = FBX_BONES.map(([j, a, b]) => ({ joint: index.get(j), a: at(a), b: at(b) }));
  // A tail rides on the hips.
  const tail = (c.tail ?? []).map((l) => [l[0] * H, low + l[1] * H, l[2] * H]);
  for (let i = 1; i < tail.length; i++) bones.push({ joint: index.get('Hips'), a: tail[i - 1], b: tail[i] });
  const { joints, weights } = autoSkin(P, N, indices, bones, H, names.length);
  if (process.env.SKIN_DEBUG) {
    await writeSkinDebug(join(process.env.SKIN_DEBUG, `${c.id}.glb`), P, indices, joints, weights);
    writeFileSync(join(process.env.SKIN_DEBUG, `${c.id}.marks.json`), JSON.stringify(c.joints));
  }
  // The base colour map sits beside the FBX (Meshy embeds it too, but not every download links it).
  const png = file.replace(/\.fbx$/i, '.png');
  if (!existsSync(png)) throw new Error(`${file}: no base colour map ${basename(png)} beside it`);
  const src = pose(
    { names, parent: FBX_JOINTS.map(([, p]) => (p ? index.get(p) : -1)), rest: names.map(at) },
    {
      count: P.length / 3,
      joints,
      weights,
      at: (v) => [[P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]]],
      uv: prim.getAttribute('TEXCOORD_0').getArray(),
      indices,
      baseColor: readFileSync(png),
    },
    ual,
    c,
  );
  return { src, sourceTriangles, workTriangles: indices.length / 3 };
}

const SKIN_DEBUG_COLORS = [
  [0.5, 0.3, 0.1], [0.4, 0.4, 0.4], [0.65, 0.65, 0.65], [0.9, 0.9, 0.9], [0.8, 0.7, 0.5], [1, 0.95, 0.6],
  [0.5, 0, 0], [1, 0, 0], [1, 0.5, 0], [1, 1, 0], [0, 0.4, 0], [0, 0.8, 0], [0.6, 1, 0.2], [0.5, 0.6, 0],
  [0, 0, 0.5], [0, 0.2, 1], [0, 0.8, 1], [0.6, 1, 1], [0.4, 0, 0.5], [0.8, 0, 0.8], [1, 0.5, 0.8], [0.6, 0.4, 1],
];

/** With SKIN_DEBUG=<dir>: the rest mesh coloured by the joint each vertex mostly follows, to check the weights. */
async function writeSkinDebug(path, P, indices, joints, weights) {
  const { Document } = await import('@gltf-transform/core');
  const doc = new Document();
  const buffer = doc.createBuffer();
  const n = P.length / 3;
  const col = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    let k = 0;
    for (let i = 1; i < 4; i++) if (weights[v * 4 + i] > weights[v * 4 + k]) k = i;
    // FBX_JOINTS order: spine in greys (pelvis brown, head beige), left arm reds, left leg greens, right arm blues, right leg purples; darker where shared.
    const c = SKIN_DEBUG_COLORS[joints[v * 4 + k]];
    const f = 0.35 + 0.65 * weights[v * 4 + k];
    col.set([c[0] * f, c[1] * f, c[2] * f, 1], v * 4);
  }
  const acc = (type, a) => doc.createAccessor().setType(type).setArray(a).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', new Float32Array(P))).setAttribute('COLOR_0', acc('VEC4', col)).setIndices(acc('SCALAR', new Uint32Array(indices))).setMaterial(doc.createMaterial('debug'));
  doc.createScene().addChild(doc.createNode('debug').setMesh(doc.createMesh('debug').addPrimitive(prim)));
  writeFileSync(path, await io.writeBinary(doc));
}

/** A binary min-heap of [key, value] for Dijkstra. */
class Heap {
  a = [];
  push(k, v) {
    const a = this.a;
    a.push([k, v]);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

/**
 * Skin weights for a mesh from its bones (segments, each driving a joint).
 * A bone's straight-line distance to a vertex counts three times over when the
 * surface faces the bone (the side of the body under a hanging arm faces the
 * arm). Vertices close to a bone's middle by that measure seed it; each vertex
 * then goes to the bone with the least distance along the surface from its
 * seeds plus its straight-line distance (so a limb resting against the body
 * stays separate from it; pieces with no seed take the nearest bone), and the
 * weights are smoothed over the surface so they blend across the joints.
 * Returns four joints and weights per vertex.
 */
function autoSkin(P, N, indices, bones, H, jointCount) {
  const n = P.length / 3;
  // Vertices split by texture seams count as one point on the surface.
  const canon = new Int32Array(n);
  const byPos = new Map();
  const q = H * 1e-5;
  for (let v = 0; v < n; v++) {
    const key = `${Math.round(P[v * 3] / q)},${Math.round(P[v * 3 + 1] / q)},${Math.round(P[v * 3 + 2] / q)}`;
    const c = byPos.get(key);
    if (c === undefined) byPos.set(key, v);
    canon[v] = c ?? v;
  }
  const adj = new Map();
  let edgeSum = 0;
  let edges = 0;
  const link = (a, b) => {
    if (a === b) return;
    const d = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
    for (const [x, y] of [[a, b], [b, a]]) {
      let l = adj.get(x);
      if (!l) adj.set(x, (l = []));
      l.push(y, d);
    }
    edgeSum += d;
    edges++;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [canon[indices[i]], canon[indices[i + 1]], canon[indices[i + 2]]];
    link(a, b);
    link(b, c);
    link(c, a);
  }
  const pts = [...new Set(canon)];

  // Every bone's straight-line distance to each vertex, three times as far when the surface faces the bone
  // (the side of the body under a hanging arm faces the arm, so it isn't the arm's); the nearest by that.
  const B = bones.length;
  const cost = new Float32Array(n * B);
  const near = new Int32Array(n).fill(-1);
  const dist = new Float32Array(n);
  const along = new Float32Array(n);
  const facing = new Float32Array(n);
  for (const v of pts) {
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    const nv = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    let best = Infinity;
    bones.forEach((b, i) => {
      const ab = sub(b.b, b.a);
      const t = Math.min(1, Math.max(0, dot(sub(p, b.a), ab) / (dot(ab, ab) || 1)));
      const off = sub(p, add(b.a, scale(ab, t)));
      const d = Math.hypot(...off);
      const f = dot(nv, off) / (d || 1);
      const c = f < 0 ? d * 3 : d;
      cost[v * B + i] = c;
      if (c < best) {
        best = c;
        near[v] = i;
        dist[v] = d;
        along[v] = t;
        facing[v] = f;
      }
    });
  }
  // Each bone's thickness: a low percentile of its nearest vertices' distances (the median would count the body beside a hanging arm).
  const radius = bones.map((_, i) => {
    const ds = pts.filter((v) => near[v] === i && along[v] > 0.25 && along[v] < 0.75 && facing[v] > 0.3).map((v) => dist[v]).sort((a, b) => a - b);
    return ds.length ? ds[Math.floor(ds.length * SEED_PERCENTILE)] : 0.05 * H;
  });
  const seed = (v) => along[v] > 0.1 && along[v] < 0.9 && dist[v] <= radius[near[v]] * SEED_REACH && facing[v] > 0.3;
  // Each bone's distance along the surface from its seeds; a vertex goes to the bone with the least of that plus its straight-line cost.
  const score = new Float64Array(n).fill(Infinity);
  const label = new Int32Array(n).fill(-1);
  for (let b = 0; b < B; b++) {
    const geo = new Float64Array(n).fill(Infinity);
    const heap = new Heap();
    for (const v of pts) {
      if (near[v] === b && seed(v)) {
        geo[v] = 0;
        heap.push(0, v);
      }
    }
    while (heap.size) {
      const [d, v] = heap.pop();
      if (d > geo[v]) continue;
      const l = adj.get(v) ?? [];
      for (let i = 0; i < l.length; i += 2) {
        const u = l[i];
        const du = d + l[i + 1];
        if (du < geo[u]) {
          geo[u] = du;
          heap.push(du, u);
        }
      }
    }
    for (const v of pts) {
      const sc = geo[v] + cost[v * B + b] * STRAIGHT_WEIGHT;
      if (sc < score[v]) {
        score[v] = sc;
        label[v] = b;
      }
    }
  }
  if (process.env.SKIN_DEBUG) {
    const count = (f) => bones.map((_, i) => pts.filter((v) => f(v) === i).length);
    console.log('bone radius', radius.map((r) => (r / H).toFixed(3)).join(' '));
    console.log('near  ', count((v) => near[v]).join(' '));
    console.log('seeds ', count((v) => (seed(v) ? near[v] : -2)).join(' '));
    console.log('label ', count((v) => label[v]).join(' '));
  }
  // One-hot by joint, then smoothed over the surface.
  const J = jointCount;
  let w = new Float32Array(n * J);
  for (const v of pts) w[v * J + bones[label[v] >= 0 ? label[v] : near[v]].joint] = 1;
  const meanEdge = edgeSum / Math.max(1, edges);
  const rounds = Math.min(60, Math.max(3, Math.round(((BLEND * H) / meanEdge) ** 2)));
  for (let r = 0; r < rounds; r++) {
    const next = new Float32Array(n * J);
    for (const v of pts) {
      const l = adj.get(v) ?? [];
      const k = 1 + l.length / 2;
      for (let j = 0; j < J; j++) {
        let s = w[v * J + j];
        for (let i = 0; i < l.length; i += 2) s += w[l[i] * J + j];
        next[v * J + j] = s / k;
      }
    }
    w = next;
  }
  const joints = new Uint16Array(n * 4);
  const weights = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const c = canon[v];
    const top = [...w.subarray(c * J, c * J + J)].map((x, j) => [j, x]).sort((a, b) => b[1] - a[1]).slice(0, 4).filter(([, x]) => x > 0.01);
    const sum = top.reduce((s, [, x]) => s + x, 0);
    top.forEach(([j, x], k) => {
      joints[v * 4 + k] = j;
      weights[v * 4 + k] = x / sum;
    });
  }
  return { joints, weights };
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

/** How much of the first-person arms shows and how bulky: the elbow end goes, sleeves pull in towards the bone, hands shrink. */
const FP_KEEP_FROM = 0.4;
const FP_SLEEVE = 0.6;
const FP_HAND = 0.78;

/**
 * Arms for the first-person view, which sit right in front of the camera:
 * bulky sleeves, gauntlets and gloves covered the sights. Only the wrist half
 * of each forearm stays, pulled in towards the bone, and the hands shrink
 * about their joint (so the grip stays where the weapon is).
 */
function slimArms(src, major) {
  const pos = new Float32Array(src.pos);
  const drop = new Uint8Array(pos.length / 3);
  for (const [s, S] of [['l', 'Left'], ['r', 'Right']]) {
    const E = src.posed.get(`${S}ForeArm`);
    const H = src.posed.get(`${S}Hand`);
    const axis = sub(H, E);
    const len = Math.hypot(...axis);
    const d = scale(axis, 1 / len);
    for (let v = 0; v < drop.length; v++) {
      const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
      if (major[v] === `lowerarm_${s}`) {
        const t = Math.min(1, Math.max(0, dot(sub(p, E), d) / len));
        if (t < FP_KEEP_FROM) drop[v] = 1;
        const a = add(E, scale(d, t * len));
        pos.set(add(a, scale(sub(p, a), FP_SLEEVE)), v * 3);
      } else if (/^(hand|index|middle|pinky|ring|thumb)_/.test(major[v]) && major[v].endsWith(`_${s}`)) {
        pos.set(add(H, scale(sub(p, H), FP_HAND)), v * 3);
      }
    }
  }
  return { pos, drop };
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
async function build(c, src, out, { keep = () => true, ratio = FULL_RATIO, lod = true, firstPerson = false } = {}) {
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
  const fp = firstPerson ? slimArms(src, major) : null;
  const kept = [];
  for (let i = 0; i < src.indices.length; i += 3) {
    const a = src.indices[i];
    const b = src.indices[i + 1];
    const d = src.indices[i + 2];
    const m = major[a] === major[b] || major[a] === major[d] ? major[a] : major[b];
    if (keep(m) && !(fp && (fp.drop[a] || fp.drop[b] || fp.drop[d]))) kept.push(a, b, d);
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
    .setAttribute('POSITION', acc('VEC3', fp ? fp.pos : src.pos))
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
const oldLock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { files: [] };
const rigDoc = await io.read(join(OUT, 'rig.glb'));
const rigCache = new Map();
const ual = new Map(rigDoc.getRoot().listSkins()[0].listJoints().map((j) => [j.getName(), worldRest(j, rigCache)]));

/** Keep a character whose download isn't in the downloads dir as built (its files must still match the lock). */
function keepAsBuilt(id) {
  const was = oldLock.files.filter((f) => f.id === id || f.id === `${id}_fparms`);
  if (!was.length) throw new Error(`no download for ${id} in ${downloads}, and it was never built`);
  for (const f of was) {
    const path = join(ROOT, 'packages/client/public', f.file);
    if (!existsSync(path) || createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16) !== f.sha256) throw new Error(`no download for ${id} in ${downloads}, and ${f.file} is not built as content/meshy.lock.json records`);
  }
  console.log(`${id.padEnd(28)} kept (no download)`);
  lock.files.push(...was);
}

for (const c of CHARACTERS) {
  const file = join(downloads, `${c.id}.glb`);
  if (!existsSync(file)) {
    keepAsBuilt(c.id);
    continue;
  }
  const src = await readMeshy(file, ual, c);
  const meshy = { meshy: c.meshy };
  lock.files.push({ role: 'meshy', id: c.id, source: 'meshy-owned', ...meshy, ...(await build(c, src, `${c.id}.glb`)) });
  lock.files.push({ role: 'meshy-fparms', id: `${c.id}_fparms`, source: 'meshy-owned', ...meshy, ...(await build(c, src, `${c.id}_fparms.glb`, { keep: (j) => ARM_JOINT.test(j), ratio: 0.8, lod: false, firstPerson: true })) });
}

// The unrigged FBX downloads (found by file name anywhere under the downloads dir).
const downloaded = readdirSync(downloads, { recursive: true }).map((f) => join(downloads, String(f)));
for (const c of FBX_CHARACTERS) {
  const file = downloaded.find((f) => c.fbx.test(basename(f)));
  if (!file) {
    keepAsBuilt(c.id);
    continue;
  }
  const { src, sourceTriangles, workTriangles } = await readFbx(file, c, ual);
  const built = await build(c, src, `${c.id}.glb`, { ratio: c.triangles / workTriangles });
  lock.files.push({ role: 'meshy-autorig', id: c.id, source: 'meshy-owned', src: basename(file), sourceTriangles, ...built });
}
writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`wrote ${lock.files.length} files and content/meshy.lock.json`);
