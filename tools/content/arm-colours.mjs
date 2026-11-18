// The universal first-person arms' colours for each whole-body character, read off its own model (grips auto-fit,
// owner 2026-11-18, "1a": every character holds every gun with the same arms in first person, gloves and sleeves
// tinted to the character). For each built character file (packages/client/public/characters/<id>.glb):
//   skin   the hands: the texture under the skin that is mostly on the hand and finger joints (a glove's colour on a
//          gloved hand, fur on a paw)
//   cloth  the sleeves: the forearms' skin (lower arm joints)
//   trim   the upper arms' skin, darkened toward the cloth when it is near it (a cuff or strap reads as trim)
// Each is the median of the texture's colour at those vertices (robust to a stray seam or a ring), in sRGB.
//
//   node tools/content/arm-colours.mjs            print them
//   import { armColours } from './arm-colours.mjs' (tools/content/grip-fit.mjs writes them to content/grip-fit.json)
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CHARACTERS = join(ROOT, 'packages/client/public/characters');

const HAND = /^(hand|index|middle|ring|pinky|thumb)_[lr]$|^(index|middle|ring|pinky|thumb)_0\d_[lr]$/;
const FOREARM = /^lowerarm(_twist\d*)?_[lr]$/;
const UPPER = /^upperarm(_twist\d*)?_[lr]$/;

const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The decoded pictures of a document's textures (RGBA, by texture). */
async function pictures(doc) {
  const out = new Map();
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage();
    if (!img) continue;
    const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    out.set(t, { data, w: info.width, h: info.height });
  }
  return out;
}

/** One sampled colour per vertex group: the median of each channel over the vertices whose skin is mostly on `re`'s joints. */
export async function armColours(file) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(file);
  await doc.transform(dequantize());
  const pics = await pictures(doc);
  const groups = { hand: [[], [], []], forearm: [[], [], []], upper: [[], [], []] };
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh || !skin) continue;
    const names = skin.listJoints().map((j) => j.getName());
    const pick = names.map((n) => (HAND.test(n) ? 'hand' : FOREARM.test(n) ? 'forearm' : UPPER.test(n) ? 'upper' : null));
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const tex = mat?.getBaseColorTexture();
      const pic = tex ? pics.get(tex) : null;
      const factor = mat?.getBaseColorFactor() ?? [1, 1, 1, 1];
      const uv = prim.getAttribute('TEXCOORD_0');
      const joints = prim.getAttribute('JOINTS_0');
      const weights = prim.getAttribute('WEIGHTS_0');
      if (!joints || !weights) continue;
      const j = [0, 0, 0, 0];
      const w = [0, 0, 0, 0];
      const t = [0, 0];
      for (let v = 0; v < joints.getCount(); v++) {
        joints.getElement(v, j);
        weights.getElement(v, w);
        const share = { hand: 0, forearm: 0, upper: 0 };
        for (let k = 0; k < 4; k++) {
          const g = pick[j[k]];
          if (g) share[g] += w[k];
        }
        const g = Object.keys(share).find((x) => share[x] > 0.6);
        if (!g) continue;
        let c = [factor[0] * 255, factor[1] * 255, factor[2] * 255];
        if (pic && uv) {
          uv.getElement(v, t);
          const x = Math.min(pic.w - 1, Math.max(0, Math.floor((((t[0] % 1) + 1) % 1) * pic.w)));
          const y = Math.min(pic.h - 1, Math.max(0, Math.floor((((t[1] % 1) + 1) % 1) * pic.h)));
          const i = (y * pic.w + x) * 4;
          c = [pic.data[i] * factor[0], pic.data[i + 1] * factor[1], pic.data[i + 2] * factor[2]];
        }
        for (let k = 0; k < 3; k++) groups[g][k].push(c[k]);
      }
    }
  }
  const col = (g) => (groups[g][0].length ? groups[g].map(median) : null);
  const hand = col('hand');
  const forearm = col('forearm') ?? hand;
  const upper = col('upper') ?? forearm;
  if (!hand || !forearm) return null;
  // Trim: the upper arm's colour, unless it is the sleeve's own (one long sleeve): then a darker shade of the sleeve,
  // so the arms' leather and belts still read apart from the cloth.
  const near = Math.hypot(upper[0] - forearm[0], upper[1] - forearm[1], upper[2] - forearm[2]) < 24;
  const trim = near ? forearm.map((v) => v * 0.62) : upper;
  return { skin: hex(hand), cloth: hex(forearm), trim: hex(trim), counts: { hand: groups.hand[0].length, forearm: groups.forearm[0].length, upper: groups.upper[0].length }, dark: luma(hand) < 40 };
}

/** The colours of the character file `<id>.glb`. */
export const armColoursOf = (id) => armColours(join(CHARACTERS, `${id}.glb`));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2);
  const all = ids.length ? ids : JSON.parse(readFileSync(join(ROOT, 'content/meshy.lock.json'), 'utf8')).files.filter((f) => f.role === 'meshy').map((f) => f.id);
  for (const id of all) {
    try {
      console.log(id, JSON.stringify(await armColoursOf(id)));
    } catch (e) {
      console.log(id, 'error', e.message);
    }
  }
}
