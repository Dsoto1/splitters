// Audit: does each character's far copy (`<node>_lod`) move with its full body? For every built character with a
// low-detail level: whether it is on the body's own skin (one skeleton in the game), the share of far-copy vertices with no full-body vertex within 2 mm (bind pose), and in a few
// poses (the bind pose and seeded bends of every joint up to 35°, skinned as the game skins them) the drawn height
// of each and the worst gap between a far-copy vertex and its nearest full-body vertex moved by the same pose.
//
//   node tools/content/lod-audit.mjs              every built character
//   ONLY=<ids> node tools/content/lod-audit.mjs   just those
//   DIR=<dir> ...                                 the files in another folder (a relod-built.mjs trial)
//   --check                                       exit 1 when a far copy is off: on a skin of its own, a vertex with no full-body vertex
//                                                 under it, one 1 cm off its body's in a pose, or a pose 10% short
//                                                 (a cut loses a few % of height at tips: an antenna, a hat's brim)
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

/** a·b, column-major 4×4. */
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
/** a·b for quaternions [x, y, z, w]. */
function qmul([ax, ay, az, aw], [bx, by, bz, bw]) {
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}
/** A rotation by small angles about x, then y, then z. */
function qeuler(x, y, z) {
  const qx = [Math.sin(x / 2), 0, 0, Math.cos(x / 2)], qy = [0, Math.sin(y / 2), 0, Math.cos(y / 2)], qz = [0, 0, Math.sin(z / 2), Math.cos(z / 2)];
  return qmul(qmul(qz, qy), qx);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = process.env.DIR ? resolve(process.env.DIR) : join(ROOT, 'packages/client/public/characters');
const only = process.env.ONLY?.split(',').filter(Boolean);
const check = process.argv.includes('--check');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const POSES = 6;
/** The bend of each joint in the posed checks, up to (degrees); the last two poses bend twice as far. */
const BEND = 35;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Skinned positions of a primitive with the joints' current world matrices. */
function positions(prim) {
  const a = prim.getAttribute('POSITION');
  const out = new Float32Array(a.getCount() * 3);
  const e = [];
  for (let v = 0; v < a.getCount(); v++) out.set(a.getElement(v, e), v * 3);
  return out;
}

function skinned(prim, skin, jointMats) {
  const P = positions(prim);
  const J = prim.getAttribute('JOINTS_0')?.getArray();
  const Wa = prim.getAttribute('WEIGHTS_0');
  const W = Wa ? Float32Array.from({ length: Wa.getCount() * 4 }, (_, i) => Wa.getElement(Math.floor(i / 4), [])[i % 4]) : null;
  const n = P.length / 3;
  const out = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let ox = 0, oy = 0, oz = 0;
    for (let k = 0; k < 4; k++) {
      const w = W ? W[v * 4 + k] : k === 0 ? 1 : 0;
      if (!w) continue;
      const m = jointMats[J ? J[v * 4 + k] : 0];
      ox += w * (m[0] * x + m[4] * y + m[8] * z + m[12]);
      oy += w * (m[1] * x + m[5] * y + m[9] * z + m[13]);
      oz += w * (m[2] * x + m[6] * y + m[10] * z + m[14]);
    }
    out.set([ox, oy, oz], v * 3);
  }
  return out;
}

function jointMatrices(skin) {
  const ibm = skin.getInverseBindMatrices()?.getArray();
  return skin.listJoints().map((j, i) => {
    const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return mul(j.getWorldMatrix(), ibm ? Array.from(ibm.subarray(i * 16, i * 16 + 16)) : id);
  });
}

/** Grid hash for nearest-vertex lookups. */
function grid(P, cell) {
  const g = new Map();
  for (let v = 0; v < P.length / 3; v++) {
    const k = `${Math.floor(P[v * 3] / cell)},${Math.floor(P[v * 3 + 1] / cell)},${Math.floor(P[v * 3 + 2] / cell)}`;
    (g.get(k) ?? g.set(k, []).get(k)).push(v);
  }
  return (x, y, z, r = 1) => {
    let best = -1, bd = Infinity;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
      for (const v of g.get(`${cx + i},${cy + j},${cz + k}`) ?? []) {
        const d = (P[v * 3] - x) ** 2 + (P[v * 3 + 1] - y) ** 2 + (P[v * 3 + 2] - z) ** 2;
        if (d < bd) [bd, best] = [d, v];
      }
    }
    return [best, Math.sqrt(bd)];
  };
}

const height = (P) => {
  let lo = Infinity, hi = -Infinity;
  for (let v = 1; v < P.length; v += 3) [lo, hi] = [Math.min(lo, P[v]), Math.max(hi, P[v])];
  return hi - lo;
};

const files = readdirSync(DIR).filter((f) => f.endsWith('.glb') && (!only || only.includes(f.replace(/\.glb$/, ''))));
let bad = 0;
const rows = [];
for (const f of files) {
  const doc = await io.read(join(DIR, f));
  const nodes = doc.getRoot().listNodes();
  const pairs = nodes.filter((n) => n.getMesh() && !/_lod$/.test(n.getName())).map((n) => [n, nodes.find((m) => m.getName() === `${n.getName()}_lod`)]).filter(([, l]) => l);
  if (!pairs.length) continue;
  for (const [body, lod] of pairs) {
    const skin = body.getSkin();
    const bp = body.getMesh().listPrimitives(), lp = lod.getMesh().listPrimitives();
    const joints = [...new Set([...(skin?.listJoints() ?? []), ...(lod.getSkin()?.listJoints() ?? [])])];
    const rest = joints.map((j) => j.getRotation());
    const r = rng(7);
    let unmatched = 0, total = 0;
    const poseRows = [];
    const match = [];
    for (let pose = 0; pose < POSES; pose++) {
      joints.forEach((j, i) => {
        if (pose === 0) return j.setRotation(rest[i]);
        const deg = ((pose >= POSES - 2 ? 2 : 1) * BEND * Math.PI) / 180;
        j.setRotation(qmul(rest[i], qeuler((r() * 2 - 1) * deg, (r() * 2 - 1) * deg, (r() * 2 - 1) * deg)));
      });
      const mats = skin ? jointMatrices(skin) : null;
      // The far copy on its own skin (an import's quantizing gives each mesh one), as the game draws it.
      const lskin = lod.getSkin() ?? skin;
      const lmats = lskin ? jointMatrices(lskin) : null;
      let bh = 0, lh = 0, worst = 0, sumGap = 0, count = 0;
      for (let p = 0; p < bp.length; p++) {
        const B = mats ? skinned(bp[p], skin, mats) : positions(bp[p]), L = lmats ? skinned(lp[p], lskin, lmats) : positions(lp[p]);
        bh = Math.max(bh, height(B));
        lh = Math.max(lh, height(L));
        if (pose === 0) {
          const near = grid(B, 0.01);
          match[p] = [];
          for (let v = 0; v < L.length / 3; v++) {
            const [b, d] = near(L[v * 3], L[v * 3 + 1], L[v * 3 + 2]);
            total++;
            const ok = b >= 0 && d <= 0.002;
            if (!ok) unmatched++;
            match[p][v] = b;
          }
        }
        for (let v = 0; v < L.length / 3; v++) {
          const b = match[p][v];
          if (b < 0) continue;
          const gap = Math.hypot(L[v * 3] - B[b * 3], L[v * 3 + 1] - B[b * 3 + 1], L[v * 3 + 2] - B[b * 3 + 2]);
          worst = Math.max(worst, gap);
          sumGap += gap;
          count++;
        }
      }
      poseRows.push({ pose, body: bh, lod: lh, ratio: lh / bh, worstGap: worst, meanGap: count ? sumGap / count : 0 });
    }
    joints.forEach((j, i) => j.setRotation(rest[i]));
    const share = unmatched / Math.max(1, total);
    // On a skin of its own (an import quantizing each mesh on its own did that): the game gives it a skeleton of its own,
    // posed apart from the body's, and it was drawn in another pose than the body (Hyena Warrior 1.5-1.8 of 2.1 m).
    const ownSkin = !!lod.getSkin() && lod.getSkin() !== skin;
    const off = ownSkin || share > 0 || poseRows.some((p) => p.ratio < 0.9 || p.worstGap > 0.01);
    if (off) bad++;
    rows.push({ id: f.replace(/\.glb$/, ''), mesh: body.getName(), ownSkin, unmatched: share, poses: poseRows, off });
    console.log(`${off ? 'OFF ' : 'ok  '}${f.replace(/\.glb$/, '').padEnd(26)} ${body.getName().padEnd(20)}${ownSkin ? ' OWN SKIN' : ''} unmatched ${(share * 100).toFixed(1).padStart(5)}%  ` +
      poseRows.map((p) => `p${p.pose} ${p.body.toFixed(2)}/${p.lod.toFixed(2)} m gap ${(p.worstGap * 1000).toFixed(0)} mm`).join('  '));
  }
}
console.log(`${rows.length} far copies, ${bad} off`);
if (process.env.JSON) (await import('node:fs')).writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
if (check && bad) process.exit(1);
