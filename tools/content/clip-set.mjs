// A clip set: clips from rigged Meshy "All Animations" downloads (Mixamo joint names), retargeted onto the game's
// rig (retarget.mjs) and written as one small GLB of the rig's joints and those clips
// (packages/client/public/characters/<id>_clips.glb). Every character built on the rig plays them: looks move with
// the default set (DEFAULT_CLIP_SET in packages/shared/src/content/looks.ts) unless their manifest names another
// (`clips`) or opts out (`clips: false`); docs/CHARACTERS.md. Two kinds of set:
//   - a shared set, content/clip-sets/<id>.json: each clip taken from whichever download does it best (`sources`
//     record each download's model and licence, `clips` which clip comes from which). Built here:
//       node tools/content/clip-set.mjs --build <downloads dir> [<id> ...]
//     (writes the set and its entry in content/clip-sets.lock.json; pnpm content:build then records its provenance);
//   - one character's own (`clipsFrom` in its manifest), built with it by prepare-meshy-characters.mjs.
// Run on one download it only reports what its clips would give (speeds, directions):
//
//   node tools/content/clip-set.mjs <download.glb> [out.glb] [as=Source_Clip ...]
//
// The clips' natural ground speeds (m/s at the rig's size, from the planted foot) and directions go in the top
// node's extras ({ clips: { <as>: { speed, dir: [x, z], seconds, from } } }): the game plays each at the rate that
// keeps the feet still.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { RIG_FROM_MESHY, meshyName, retargetClip } from './retarget.mjs';
import { CLIP_SETS_LOCK, readClipSets } from './character-manifests.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/characters');
const RIG = join(OUT, 'rig.glb');
/** Frames a second the clips are sampled at (the downloads' own rate). */
const FPS = 30;

/** A skeleton (retarget.mjs) of a document's joints and every node above them, named by `nameOf`. */
function skeletonOf(doc, nameOf) {
  const joints = doc.getRoot().listSkins()[0]?.listJoints() ?? [];
  const nodes = [];
  const seen = new Set();
  const add = (n) => {
    if (seen.has(n)) return;
    const p = n.getParentNode();
    if (p) add(p);
    seen.add(n);
    nodes.push(n);
  };
  for (const j of joints) add(j);
  const index = new Map(nodes.map((n, i) => [n, i]));
  const names = nodes.map((n) => nameOf(n.getName()));
  return {
    nodes,
    names,
    parent: nodes.map((n) => (n.getParentNode() ? (index.get(n.getParentNode()) ?? -1) : -1)),
    rest: nodes.map((n) => ({ t: n.getTranslation(), q: n.getRotation(), s: n.getScale()[0] })),
  };
}

/** Each source joint's tracks in one animation: { r: [times, values], t: [times, values] } by Meshy name. */
function tracksOf(anim) {
  const tracks = {};
  let end = 0;
  for (const ch of anim.listChannels()) {
    const path = ch.getTargetPath();
    if (path !== 'rotation' && path !== 'translation') continue;
    const s = ch.getSampler();
    if (s.getInterpolation() === 'CUBICSPLINE') throw new Error(`${anim.getName()}: cubic spline keys are not read`);
    const name = meshyName(ch.getTargetNode().getName());
    const times = Array.from(s.getInput().getArray());
    end = Math.max(end, times[times.length - 1]);
    (tracks[name] ??= {})[path === 'rotation' ? 'r' : 't'] = [times, Array.from(s.getOutput().getArray())];
  }
  return { tracks, end };
}

/**
 * Retarget `clips` onto the rig: { as: source clip name } from `srcDoc`, or { as: { doc, clip, src } } each from its
 * own download (`src`: which one, recorded with the clip's measurements). Returns the clip set's document and each
 * clip's measurements.
 */
export async function clipSet(srcDoc, clips, rigDoc) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  rigDoc ??= await io.read(RIG);
  const skeletons = new Map();
  const skeleton = (doc) => {
    if (!skeletons.has(doc)) skeletons.set(doc, skeletonOf(doc, meshyName));
    return skeletons.get(doc);
  };
  const rig = skeletonOf(rigDoc, (n) => n);
  const out = new Document();
  const buffer = out.createBuffer();
  const scene = out.createScene('clips');
  // The rig's joints that the clips drive and every joint above them, at the rig's rest.
  const used = new Set();
  for (const name of Object.keys(RIG_FROM_MESHY)) for (let i = rig.names.indexOf(name); i >= 0 && !used.has(i); i = rig.parent[i]) used.add(i);
  const nodes = new Map();
  rig.nodes.forEach((n, i) => {
    if (!used.has(i)) return;
    const node = out.createNode(n.getName()).setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale());
    nodes.set(n.getName(), node);
    if (rig.parent[i] >= 0) nodes.get(rig.names[rig.parent[i]]).addChild(node);
    else scene.addChild(node);
  });
  const report = {};
  for (const [as, what] of Object.entries(clips)) {
    const { doc, clip: from, src: source } = typeof what === 'string' ? { doc: srcDoc, clip: what } : what;
    const anim = doc.getRoot().listAnimations().find((a) => a.getName() === from);
    if (!anim) throw new Error(`no clip ${from}${source ? ` in ${source}` : ''} (has ${doc.getRoot().listAnimations().map((a) => a.getName()).join(', ')})`);
    const src = skeleton(doc);
    const { tracks, end } = tracksOf(anim);
    const count = Math.max(2, Math.round(end * FPS) + 1);
    const times = Array.from({ length: count }, (_, i) => (i * end) / (count - 1));
    const r = retargetClip(src, tracks, times, rig);
    const input = out.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
    const a = out.createAnimation(as);
    const channel = (node, path, type, values) => {
      const output = out.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
      const sampler = out.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
      a.addSampler(sampler).addChannel(out.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
    };
    for (const name of Object.keys(RIG_FROM_MESHY)) {
      const node = nodes.get(name);
      if (!node || !r.frames[0].has(name)) continue;
      // Each key on the same side as the one before (no long way round between keys).
      const values = [];
      let prev = null;
      for (const f of r.frames) {
        let q = f.get(name);
        if (prev && q[0] * prev[0] + q[1] * prev[1] + q[2] * prev[2] + q[3] * prev[3] < 0) q = q.map((x) => -x);
        values.push(...q);
        prev = q;
      }
      channel(node, 'rotation', 'VEC4', values);
    }
    channel(nodes.get('pelvis'), 'translation', 'VEC3', r.pelvis.flat());
    report[as] = { from, ...(source ? { src: source } : {}), seconds: +end.toFixed(3), speed: +r.speed.toFixed(3), dir: r.dir.map((x) => +x.toFixed(3)), footDown: +r.footDown.toFixed(3) };
  }
  scene.listChildren()[0].setExtras({ clips: report });
  return { doc: out, report };
}

/** Write a clip set; returns its bytes. */
export async function writeClipSet(doc, path) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const glb = await io.writeBinary(doc);
  writeFileSync(path, glb);
  return glb;
}

/**
 * Build the shared clip sets (content/clip-sets/<id>.json; `only`: just these ids) from the downloads in `dir`:
 * each set's file in packages/client/public/characters and its entry in content/clip-sets.lock.json (the others
 * kept as they were).
 */
export async function buildClipSets(dir, only) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const rigDoc = await io.read(RIG);
  const sets = readClipSets();
  for (const id of only ?? []) if (!sets.some((s) => s.id === id)) throw new Error(`no clip set content/clip-sets/${id}.json`);
  const old = existsSync(CLIP_SETS_LOCK) ? JSON.parse(readFileSync(CLIP_SETS_LOCK, 'utf8')) : { files: [] };
  const lock = { $comment: 'Generated by tools/content/clip-set.mjs --build. Do not edit by hand.', files: [] };
  const files = readdirSync(dir);
  for (const set of sets) {
    if (only && !only.includes(set.id)) {
      lock.files.push(...old.files.filter((f) => f.id === `${set.id}_clips`));
      continue;
    }
    // Each download the set takes a clip from, read once.
    const docs = new Map();
    const docOf = async (key) => {
      if (!docs.has(key)) {
        const s = set.sources[key];
        const re = new RegExp(s.file);
        const file = files.filter((f) => re.test(f)).sort().pop();
        if (!file) throw new Error(`${set.id}: no download for ${key} (${s.file}) in ${dir}`);
        docs.set(key, { file, doc: await io.read(join(dir, file)) });
      }
      return docs.get(key);
    };
    const clips = {};
    for (const [as, c] of Object.entries(set.clips)) clips[as] = { doc: (await docOf(c.from)).doc, clip: c.clip, src: set.sources[c.from].community.model };
    const { doc, report } = await clipSet(null, clips, rigDoc);
    const out = `${set.id}_clips.glb`;
    const glb = await writeClipSet(doc, join(OUT, out));
    for (const [as, r] of Object.entries(report)) console.log(`  ${as.padEnd(16)} ${r.src}, ${r.from}: ${r.seconds} s, ${r.speed} m/s`);
    console.log(`${out.padEnd(28)} ${Object.keys(report).length} clips ${(glb.byteLength / 1024).toFixed(0).padStart(6)} KB`);
    const used = [...docs.keys()];
    const dates = [...new Set(used.map((k) => set.sources[k].date))].sort();
    lock.files.push({
      role: 'meshy-clips',
      id: `${set.id}_clips`,
      source: 'meshy-community-characters',
      model: used.map((k) => set.sources[k].community.model).join(', '),
      date: dates[dates.length - 1],
      src: used.map((k) => docs.get(k).file).join(', '),
      ...(used.every((k) => set.sources[k].rig === 'owner') ? { rig: 'owner' } : {}),
      file: `characters/${out}`,
      sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16),
      triangles: 0,
      bytes: glb.byteLength,
      clips: report,
    });
  }
  writeFileSync(CLIP_SETS_LOCK, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`wrote ${lock.files.length} clip sets and ${basename(CLIP_SETS_LOCK)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === '--build') {
  const [dir, ...ids] = process.argv.slice(3);
  if (!dir) throw new Error('usage: clip-set.mjs --build <downloads dir> [<set id> ...]');
  await buildClipSets(dir, ids.length ? ids : undefined);
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, outPath, ...pairs] = process.argv.slice(2);
  if (!file) throw new Error('usage: clip-set.mjs <download.glb> [out.glb] [as=Source_Clip ...]');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(file);
  const names = doc.getRoot().listAnimations().map((a) => a.getName());
  const clips = pairs.length ? Object.fromEntries(pairs.map((p) => p.split('='))) : Object.fromEntries(names.map((n) => [n, n]));
  const { doc: set, report } = await clipSet(doc, clips);
  for (const [as, r] of Object.entries(report)) console.log(`${as.padEnd(40)} ${r.seconds.toFixed(2)} s  ${r.speed.toFixed(2)} m/s toward [${r.dir.join(', ')}], left foot down at ${r.footDown}  (from ${r.from})`);
  if (outPath && outPath !== '-') console.log(`wrote ${outPath}: ${((await writeClipSet(set, outPath)).byteLength / 1024).toFixed(0)} KB`);
}
