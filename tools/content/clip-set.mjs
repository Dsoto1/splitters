// A clip set: clips from a rigged Meshy "All Animations" download (Mixamo joint names), retargeted onto the game's
// rig (retarget.mjs) and written as one small GLB of the rig's joints and those clips
// (packages/client/public/characters/<id>_clips.glb). Any character built on the rig plays them: a look names the
// set with `clips` in its manifest (docs/CHARACTERS.md). prepare-meshy-characters.mjs writes the set of a manifest
// with `clipsFrom` when it builds that character; run alone it only reports what a download's clips would give:
//
//   node tools/content/clip-set.mjs <download.glb> [out.glb] [as=Source_Clip ...]
//
// The clips' natural ground speeds (m/s at the rig's size, from the planted foot) and directions go in the top
// node's extras ({ clips: { <as>: { speed, dir: [x, z], seconds, from } } }): the game plays each at the rate that
// keeps the feet still.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { RIG_FROM_MESHY, meshyName, retargetClip } from './retarget.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RIG = join(ROOT, 'packages/client/public/characters/rig.glb');
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
 * Retarget `clips` ({ as: source clip name }) from a source document onto the rig; returns the clip set's
 * document and each clip's measurements.
 */
export async function clipSet(srcDoc, clips, rigDoc) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  rigDoc ??= await io.read(RIG);
  const src = skeletonOf(srcDoc, meshyName);
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
  for (const [as, from] of Object.entries(clips)) {
    const anim = srcDoc.getRoot().listAnimations().find((a) => a.getName() === from);
    if (!anim) throw new Error(`no clip ${from} (has ${srcDoc.getRoot().listAnimations().map((a) => a.getName()).join(', ')})`);
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
    report[as] = { from, seconds: +end.toFixed(3), speed: +r.speed.toFixed(3), dir: r.dir.map((x) => +x.toFixed(3)), footDown: +r.footDown.toFixed(3) };
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
