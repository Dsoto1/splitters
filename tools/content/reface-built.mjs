// Fixes a built whole-body character's head in place, for a character whose download can't be rebuilt here (its
// Meshy rig task isn't on this machine): content/meshy.lock.json is updated.
//
//   ONLY=meshy_skeleton node tools/content/reface-built.mjs
//   ONLY=... OUT=<dir> node tools/content/reface-built.mjs      a trial: the files written to <dir>, the lock left alone
//
// What it does (owner, 2026-11-03: "distorted faces"):
// - Head skin off the arms: a vertex of the head (above the neck joint, near the head joint) that the rig left partly
//   on a collarbone, an arm or a hand follows the head alone. Rattles' skull was 9-13% on the collarbones, so raising
//   the gun pulled his jaw and cheek toward the shoulder.
// - `FLIP_GREEN=1`: the normal map's green channel inverted. A build made before meshy-mesh.mjs DOWNLOAD_GREEN read
//   the download's normal map upside down; on a body cut from the same layout the map is close to the download's own,
//   so inverting its green is close to the rebuild (not exact where the cut changed the surface). Rebuild instead
//   whenever the download is at hand.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = join(ROOT, 'packages/client/public/characters');
const LOCK = join(ROOT, 'content/meshy.lock.json');
const TRIAL = process.env.OUT;
const only = process.env.ONLY?.split(',').filter(Boolean);
if (!only?.length) throw new Error('ONLY=<character ids> (content/characters/<id>.json)');
const flip = !!process.env.FLIP_GREEN;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Joints a head vertex must not follow: the collarbones, the arms, the hands and fingers. */
const ARM = /^(clavicle|upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)_/;
/** A head vertex: above the neck joint by this share of the neck-to-head-joint length... */
const ABOVE = 0.5;
/** ...and within this many neck-to-head lengths of the head joint, sideways. */
const AROUND = 3;

function mat4Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
const point = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];

const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
for (const id of only) {
  const entry = lock.files.find((f) => f.id === id);
  if (!entry) throw new Error(`${id}: not in content/meshy.lock.json`);
  const file = join(ROOT, 'packages/client/public', entry.file);
  const doc = await io.read(file);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const names = joints.map((j) => j.getName());
  const ibm = skin.getInverseBindMatrices().getArray();
  // Bind-pose world position of a vertex: any of its joints' world matrix times that joint's inverse bind.
  const bind = joints.map((j, i) => mat4Mul(j.getWorldMatrix(), Array.from(ibm.slice(i * 16, i * 16 + 16))));
  const at = (n) => joints.find((j) => j.getName() === n).getWorldMatrix().slice(12, 15);
  const [head, neck] = [at('Head'), at('neck_01')];
  const len = Math.hypot(head[0] - neck[0], head[1] - neck[1], head[2] - neck[2]);
  const headIndex = names.indexOf('Head');
  let moved = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION');
      const J = prim.getAttribute('JOINTS_0');
      const W = prim.getAttribute('WEIGHTS_0');
      if (!J || !W) continue;
      const [v, j, w] = [[0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
      for (let i = 0; i < P.getCount(); i++) {
        J.getElement(i, j);
        W.getElement(i, w);
        const p = point(bind[j[0]], P.getElement(i, v));
        if (p[1] < neck[1] + ABOVE * len || Math.hypot(p[0] - head[0], p[2] - head[2]) > AROUND * len) continue;
        let off = 0;
        for (let k = 0; k < 4; k++) if (w[k] > 0 && ARM.test(names[j[k]])) [off, w[k]] = [off + w[k], 0];
        if (off <= 0) continue;
        const slot = j.findIndex((x, k) => x === headIndex && w[k] > 0);
        const free = slot >= 0 ? slot : w.findIndex((x) => x === 0);
        j[free] = headIndex;
        w[free] += off;
        const sum = w.reduce((a, b) => a + b, 0);
        J.setElement(i, j);
        W.setElement(i, w.map((x) => x / sum));
        moved++;
      }
    }
  }
  let flipped = 0;
  if (flip) {
    const seen = new Set();
    for (const m of root.listMaterials()) {
      const t = m.getNormalTexture();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      const { data, info } = await sharp(Buffer.from(t.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 1; i < data.length; i += 3) data[i] = 255 - data[i];
      t.setImage(new Uint8Array(await sharp(data, { raw: info }).jpeg({ quality: 85, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer()));
      flipped++;
    }
  }
  const glb = await io.writeBinary(doc);
  writeFileSync(join(TRIAL ?? DIR, `${id}.glb`), glb);
  Object.assign(entry, { sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), bytes: glb.byteLength });
  console.log(`${id}: ${moved} head vertices taken off the arms${flip ? `, ${flipped} normal map(s) with green inverted` : ''}`);
}
if (!TRIAL) writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
