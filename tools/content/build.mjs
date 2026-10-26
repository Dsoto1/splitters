// Content build: converts selected third-party source models into normalised
// GLB files for the client, copies selected sound files, and writes a
// provenance/credits ledger.
//
//   node tools/content/build.mjs           build everything
//   node tools/content/build.mjs --check   verify outputs exist, are up to date, within budget, and licensed
//
// Normalisation: the model's barrel axis becomes +Z (glTF forward), it is
// centred on its bounding box and scaled to the manifest `length` in metres.
// Material names are kept so runtime recolouring can target them.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { PNG } from 'pngjs';
import { objToDocument } from './obj.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = join(ROOT, 'content/models.json');
const OUT_DIR = join(ROOT, 'packages/client/public/models');
const LEDGER = join(ROOT, 'content/provenance.json');
const SOUND_MANIFEST = join(ROOT, 'content/sounds.json');
const SOUND_DIR = join(ROOT, 'packages/client/public/sounds');
const check = process.argv.includes('--check');

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const problems = [];

// ---------------------------------------------------------------- math

/** Rotation taking the given source axis to +Z (proper rotations only, no mirroring). */
function forwardRotation(axis) {
  switch (axis) {
    case '+z': return (x, y, z) => [x, y, z];
    case '-z': return (x, y, z) => [-x, y, -z];
    case '+x': return (x, y, z) => [-z, y, x];
    case '-x': return (x, y, z) => [z, y, -x];
    default: throw new Error(`unsupported forward axis ${axis}`);
  }
}

function mat4Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

const xf = (m, x, y, z, w) => [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];

// ---------------------------------------------------------------- OBJ -> triangles (tools/content/obj.mjs)

// ---------------------------------------------------------------- GLB sources

/** Bake node transforms and the normalising transform into vertices; flatten to one node. */
function bakeGlb(doc, transform) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const meshes = [];
  const visit = (node, parent) => {
    const world = mat4Mul(parent, node.getMatrix());
    if (node.getMesh()) meshes.push({ mesh: node.getMesh(), world });
    for (const c of node.listChildren()) visit(c, world);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const n of scene.listChildren()) visit(n, I);
  const done = new Set();
  for (const { mesh, world } of meshes) {
    for (const prim of mesh.listPrimitives()) {
      for (const [semantic, fn] of [['POSITION', 'point'], ['NORMAL', 'normal']]) {
        const acc = prim.getAttribute(semantic);
        if (!acc || done.has(acc)) continue;
        done.add(acc);
        const arr = acc.getArray().slice();
        for (let i = 0; i < arr.length; i += 3) {
          const w = semantic === 'POSITION' ? 1 : 0;
          const p = xf(world, arr[i], arr[i + 1], arr[i + 2], w);
          arr.set(transform[fn](p[0], p[1], p[2]), i);
        }
        acc.setArray(arr);
      }
    }
  }
  for (const n of scene.listChildren()) n.dispose();
  for (const node of root.listNodes()) node.dispose();
  const holder = doc.createNode('model');
  scene.addChild(holder);
  for (const { mesh } of meshes) holder.addChild(doc.createNode(mesh.getName() || 'part').setMesh(mesh));
}

function recolorTextures(doc, { desaturate = 0, tint = '#ffffff' }) {
  const t = [1, 3, 5].map((i) => parseInt(tint.slice(i, i + 2), 16) / 255);
  for (const tex of doc.getRoot().listTextures()) {
    if (tex.getMimeType() !== 'image/png') continue;
    const png = PNG.sync.read(Buffer.from(tex.getImage()));
    for (let i = 0; i < png.data.length; i += 4) {
      const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      for (let c = 0; c < 3; c++) {
        const base = [r, g, b][c] * (1 - desaturate) + l * desaturate;
        png.data[i + c] = Math.round(Math.min(255, base * t[c]));
      }
    }
    tex.setImage(new Uint8Array(PNG.sync.write(png)));
  }
}

// ---------------------------------------------------------------- normalise

/** Compute the normalising transform: rotate forward to +Z, centre, scale to `length` along Z. */
async function normaliser(entry, rawPoints) {
  const rot = forwardRotation(entry.forward);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const [x, y, z] of rawPoints) {
    const p = rot(x, y, z);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
    }
  }
  const s = entry.length / (max[2] - min[2]);
  const c = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  return {
    point: (x, y, z) => rot(x, y, z).map((v, i) => (v - c[i]) * s),
    normal: (x, y, z) => {
      const n = rot(x, y, z);
      const l = Math.hypot(...n) || 1;
      return n.map((v) => v / l);
    },
  };
}

function objPoints(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('v '))
    .map((l) => l.trim().split(/\s+/).slice(1, 4).map(Number));
}

async function glbPoints(doc) {
  const pts = [];
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const visit = (node, parent) => {
    const world = mat4Mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION').getArray();
      for (let i = 0; i < a.length; i += 3) pts.push(xf(world, a[i], a[i + 1], a[i + 2], 1));
    }
    for (const c of node.listChildren()) visit(c, world);
  };
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  for (const n of scene.listChildren()) visit(n, I);
  return pts;
}

function triangleCount(doc) {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  }
  return tris;
}

// ---------------------------------------------------------------- main

const ledger = { $comment: 'Generated by tools/content/build.mjs. Do not edit by hand.', assets: [] };

for (const entry of manifest.models) {
  const pack = manifest.packs[entry.pack];
  if (!pack) {
    problems.push(`${entry.out}: unknown pack ${entry.pack}`);
    continue;
  }
  if (!existsSync(join(ROOT, pack.licenseFile))) problems.push(`${entry.out}: licence file missing (${pack.licenseFile})`);
  if (!/^CC0-1\.0$|^CC-BY-(3|4)\.0$/.test(pack.license)) problems.push(`${entry.out}: licence ${pack.license} is not an approved tier`);

  const src = join(ROOT, 'assets-src', entry.pack, entry.file);
  const outPath = join(OUT_DIR, entry.out);
  let doc;
  if (src.endsWith('.obj')) {
    doc = objToDocument(src, await normaliser(entry, objPoints(src)));
  } else {
    doc = await io.read(src);
    bakeGlb(doc, await normaliser(entry, await glbPoints(doc)));
    if (entry.recolor) recolorTextures(doc, entry.recolor);
    // Flat-coloured kits (Quaternius' sci-fi guns): one accent material ("Main") per weapon, so each reads apart.
    if (entry.accent) for (const mat of doc.getRoot().listMaterials()) if (mat.getName() === 'Main') mat.setBaseColorFactor([...[1, 3, 5].map((i) => (parseInt(entry.accent.slice(i, i + 2), 16) / 255) ** 2.2), 1]);
  }
  doc.getRoot().getAsset().generator = 'tiletrigger content build';
  const glb = await io.writeBinary(doc);
  const hash = createHash('sha256').update(glb).digest('hex').slice(0, 16);
  const tris = triangleCount(doc);
  if (tris > manifest.budgets.maxTriangles) problems.push(`${entry.out}: ${tris} triangles exceeds budget ${manifest.budgets.maxTriangles}`);
  if (glb.byteLength > manifest.budgets.maxBytes) problems.push(`${entry.out}: ${glb.byteLength} bytes exceeds budget ${manifest.budgets.maxBytes}`);

  if (check) {
    if (!existsSync(outPath)) problems.push(`${entry.out}: not built (run pnpm content:build)`);
    else if (createHash('sha256').update(readFileSync(outPath)).digest('hex').slice(0, 16) !== hash) problems.push(`${entry.out}: out of date (run pnpm content:build)`);
  } else {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, glb);
  }
  ledger.assets.push({
    file: `models/${entry.out}`,
    sha256: hash,
    triangles: tris,
    bytes: glb.byteLength,
    source: `${entry.pack}/${entry.file}`,
    title: pack.title,
    creator: pack.creator,
    url: pack.url,
    license: pack.license,
    modifications: ['converted to glTF', 'reoriented and scaled', ...(entry.recolor || entry.accent ? ['recoloured'] : [])],
  });
  console.log(`${check ? 'checked' : 'built  '} ${entry.out.padEnd(26)} ${String(tris).padStart(5)} tris ${String(glb.byteLength).padStart(7)} B  ${pack.creator} (${pack.license})`);
}

// ---------------------------------------------------------------- sounds

// Sound files are shipped as-is (Ogg Vorbis): copied byte for byte, so the
// check needs no audio tools. Synthesised sounds have no files.
const sounds = JSON.parse(readFileSync(SOUND_MANIFEST, 'utf8'));
const soundFiles = new Set();
for (const [id, sound] of Object.entries(sounds.sounds)) {
  if (sound.synth) continue;
  sound.variants.forEach((variant, i) => {
    const out = `${id}_${i}.ogg`;
    soundFiles.add(out);
    const pack = sounds.packs[variant.pack];
    if (!pack) return void problems.push(`sounds/${out}: unknown pack ${variant.pack}`);
    if (!existsSync(join(ROOT, pack.licenseFile))) problems.push(`sounds/${out}: licence file missing (${pack.licenseFile})`);
    if (!/^CC0-1\.0$|^CC-BY-(3|4)\.0$/.test(pack.license)) problems.push(`sounds/${out}: licence ${pack.license} is not an approved tier`);
    const src = join(ROOT, 'assets-src', variant.pack, variant.file);
    if (!existsSync(src)) return void problems.push(`sounds/${out}: source missing (${variant.pack}/${variant.file})`);
    const data = readFileSync(src);
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
    if (data.byteLength > sounds.budgets.maxBytes) problems.push(`sounds/${out}: ${data.byteLength} bytes exceeds budget ${sounds.budgets.maxBytes}`);
    const outPath = join(SOUND_DIR, out);
    if (check) {
      if (!existsSync(outPath)) problems.push(`sounds/${out}: not built (run pnpm content:build)`);
      else if (createHash('sha256').update(readFileSync(outPath)).digest('hex').slice(0, 16) !== hash) problems.push(`sounds/${out}: out of date (run pnpm content:build)`);
    } else {
      mkdirSync(SOUND_DIR, { recursive: true });
      writeFileSync(outPath, data);
    }
    ledger.assets.push({
      file: `sounds/${out}`,
      sha256: hash,
      bytes: data.byteLength,
      source: `${variant.pack}/${variant.file}`,
      title: pack.title,
      creator: pack.creator,
      url: pack.url,
      license: pack.license,
      modifications: [],
    });
  });
}
// Files left behind by renamed or removed sounds.
for (const f of existsSync(SOUND_DIR) ? readdirSync(SOUND_DIR) : []) {
  if (soundFiles.has(f)) continue;
  if (check) problems.push(`sounds/${f}: not in content/sounds.json (run pnpm content:build)`);
  else rmSync(join(SOUND_DIR, f));
}
console.log(`${check ? 'checked' : 'built  '} ${soundFiles.size} sound files`);

// ---------------------------------------------------------------- characters
// Characters are prepared from the full pack downloads by
// tools/content/prepare-characters.mjs (too large to keep in assets-src); its
// lock file records what it wrote, and this checks the shipped files against it.
const CHAR_LOCK = join(ROOT, 'content/characters.lock.json');
const CHAR_MODS = {
  rig: ['clips selected, renamed and resampled', 'mannequin simplified'],
  head: ['cut from the base body', 'rebound to the regular body pose', 'materials simplified'],
  hair: ['rebound to the regular body pose', 'simplified', 'materials simplified'],
  part: ['rebound to the regular body pose', 'simplified', 'materials simplified', 'textures made shared'],
  npc: ['rebound to the rig pose', 'simplified'],
  fparms: ['arms cut from the base body', 'rebound to the regular body pose', 'simplified'],
  meshy: ['re-posed to the rig\'s T-pose', 'rebound to the rig\'s skeleton', 'simplified', 'base colour only, downscaled to a JPEG', 'vertices quantized'],
  'meshy-fparms': ['arms cut from the body', 're-posed to the rig\'s T-pose', 'rebound to the rig\'s skeleton', 'vertices quantized'],
  texture: ['downscaled to a JPEG'],
};
const charLock = JSON.parse(readFileSync(CHAR_LOCK, 'utf8'));
// Whole-body characters made on the owner's Meshy subscription (tools/content/prepare-meshy-characters.mjs).
const meshyLock = JSON.parse(readFileSync(join(ROOT, 'content/meshy.lock.json'), 'utf8'));
const charFiles = new Set();
const charEntries = [...charLock.files, ...meshyLock.files];
for (const f of charEntries) {
  charFiles.add(f.file);
  const packIds = f.source.split(/,\s*/);
  const packs = packIds.map((id) => manifest.packs[id]);
  if (packs.some((p) => !p)) {
    problems.push(`${f.file}: unknown pack in ${f.source}`);
    continue;
  }
  for (const pack of packs) {
    if (!existsSync(join(ROOT, pack.licenseFile))) problems.push(`${f.file}: licence file missing (${pack.licenseFile})`);
    if (!/^CC0-1\.0$|^CC-BY-(3|4)\.0$|^Owned$/.test(pack.license)) problems.push(`${f.file}: licence ${pack.license} is not an approved tier`);
  }
  const path = join(ROOT, 'packages/client/public', f.file);
  if (!existsSync(path)) problems.push(`${f.file}: missing (run node tools/content/prepare-characters.mjs)`);
  else if (createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16) !== f.sha256) problems.push(`${f.file}: does not match content/characters.lock.json`);
  if (f.triangles > manifest.characterBudgets.maxTriangles) problems.push(`${f.file}: ${f.triangles} triangles exceeds budget ${manifest.characterBudgets.maxTriangles}`);
  if (f.bytes > manifest.characterBudgets.maxBytes) problems.push(`${f.file}: ${f.bytes} bytes exceeds budget ${manifest.characterBudgets.maxBytes}`);
  ledger.assets.push({
    file: f.file,
    sha256: f.sha256,
    triangles: f.triangles,
    bytes: f.bytes,
    source: f.source,
    title: packs.map((p) => p.title).join(' + '),
    creator: [...new Set(packs.map((p) => p.creator))].join(', '),
    url: packs.map((p) => p.url).join(' '),
    license: [...new Set(packs.map((p) => p.license))].join(', '),
    modifications: [...(CHAR_MODS[f.role] ?? []), ...(f.lodTriangles ? ['low-detail copy of each mesh added'] : [])],
  });
}
const CHAR_DIR = join(ROOT, 'packages/client/public/characters');
for (const f of existsSync(CHAR_DIR) ? readdirSync(CHAR_DIR, { recursive: true }) : []) {
  const rel = `characters/${String(f).replaceAll('\\', '/')}`;
  if (/\.(glb|jpg|png)$/.test(rel) && !charFiles.has(rel)) problems.push(`${rel}: not in content/characters.lock.json`);
}
console.log(`checked ${charEntries.length} character files`);

// ---------------------------------------------------------------- creatures
// NPC creature models, prepared from the pack downloads by
// tools/content/prepare-creatures.mjs (the Bestiary pack's licence forbids
// redistributing its raw files, so they never enter the repo). Besides the
// free tiers, creatures may come from a pack under the Quaternius Asset
// Licence: game-ready models inside the game, raw files never redistributed.
const CREATURE_LICENCE = /^CC0-1\.0$|^CC-BY-(3|4)\.0$|^LicenseRef-Quaternius-QAL-1\.0$/;
const creatureLock = JSON.parse(readFileSync(join(ROOT, 'content/creatures.lock.json'), 'utf8'));
const creatureFiles = new Set();
for (const f of creatureLock.files) {
  creatureFiles.add(f.file);
  const pack = manifest.packs[f.source];
  if (!pack) {
    problems.push(`${f.file}: unknown pack ${f.source}`);
    continue;
  }
  if (!existsSync(join(ROOT, pack.licenseFile))) problems.push(`${f.file}: licence file missing (${pack.licenseFile})`);
  if (!CREATURE_LICENCE.test(pack.license)) problems.push(`${f.file}: licence ${pack.license} is not an approved tier`);
  const path = join(ROOT, 'packages/client/public', f.file);
  if (!existsSync(path)) problems.push(`${f.file}: missing (run node tools/content/prepare-creatures.mjs <downloads dir>)`);
  else if (createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16) !== f.sha256) problems.push(`${f.file}: does not match content/creatures.lock.json`);
  if (f.triangles > manifest.characterBudgets.maxTriangles) problems.push(`${f.file}: ${f.triangles} triangles exceeds budget ${manifest.characterBudgets.maxTriangles}`);
  if (f.bytes > manifest.characterBudgets.maxBytes) problems.push(`${f.file}: ${f.bytes} bytes exceeds budget ${manifest.characterBudgets.maxBytes}`);
  ledger.assets.push({
    file: f.file,
    sha256: f.sha256,
    triangles: f.triangles,
    bytes: f.bytes,
    source: `${f.source}/${f.src}`,
    title: pack.title,
    creator: pack.creator,
    url: pack.url,
    license: pack.license,
    modifications: ['simplified', 'textures downscaled and embedded', f.clips.length > 1 ? 'our character rig clips retargeted onto its skeleton' : 'idle clip kept'],
  });
}
const CREATURE_DIR = join(ROOT, 'packages/client/public/creatures');
for (const f of existsSync(CREATURE_DIR) ? readdirSync(CREATURE_DIR) : []) if (!creatureFiles.has(`creatures/${f}`)) problems.push(`creatures/${f}: not in content/creatures.lock.json`);
console.log(`checked ${creatureLock.files.length} creatures`);

// ---------------------------------------------------------------- textures and props
// Prepared by tools/content/prepare-textures.mjs and prepare-props.mjs; their
// lock files record what they wrote, and this checks the shipped files against them.
function checkLocked(lockPath, dir, packFor, budgets, modifications, prepare) {
  const lockFile = JSON.parse(readFileSync(join(ROOT, lockPath), 'utf8'));
  const files = new Set();
  for (const f of lockFile.files) {
    files.add(f.file);
    const pack = packFor(f);
    if (!pack) {
      problems.push(`${f.file}: unknown pack`);
      continue;
    }
    if (!existsSync(join(ROOT, pack.licenseFile))) problems.push(`${f.file}: licence file missing (${pack.licenseFile})`);
    // `Owned`: pieces the team made itself (the Style Pack props and facades, modelled in code).
    if (!/^CC0-1\.0$|^CC-BY-(3|4)\.0$|^Owned$/.test(pack.license)) problems.push(`${f.file}: licence ${pack.license} is not an approved tier`);
    const path = join(ROOT, 'packages/client/public', f.file);
    if (!existsSync(path)) problems.push(`${f.file}: missing (run ${prepare})`);
    else if (createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16) !== f.sha256) problems.push(`${f.file}: does not match ${lockPath}`);
    if (budgets.maxBytes && f.bytes > budgets.maxBytes) problems.push(`${f.file}: ${f.bytes} bytes exceeds budget ${budgets.maxBytes}`);
    if (budgets.maxTriangles && f.triangles > budgets.maxTriangles) problems.push(`${f.file}: ${f.triangles} triangles exceeds budget ${budgets.maxTriangles}`);
    ledger.assets.push({
      file: f.file,
      sha256: f.sha256,
      ...(f.triangles !== undefined ? { triangles: f.triangles } : {}),
      bytes: f.bytes,
      source: f.asset ? `${pack.id ?? 'ambientcg'}:${f.asset}` : `${f.source}/${f.src}`,
      title: f.asset ? `${pack.title}: ${f.asset}` : pack.title,
      creator: pack.creator,
      url: f.asset ? `https://ambientcg.com/view?id=${f.asset}` : pack.url,
      license: pack.license,
      modifications: typeof modifications === 'function' ? modifications(f, pack) : modifications,
    });
  }
  const full = join(ROOT, 'packages/client/public', dir);
  for (const f of existsSync(full) ? readdirSync(full) : []) if (!files.has(`${dir}/${f}`)) problems.push(`${dir}/${f}: not in ${lockPath}`);
  return lockFile.files.length;
}
const textureManifest = JSON.parse(readFileSync(join(ROOT, 'content/textures.json'), 'utf8'));
const textureCount = checkLocked('content/textures.lock.json', 'textures', () => textureManifest.pack, textureManifest.budgets, ['downscaled to 512 px', 'colour, normal and emission maps only'], 'node tools/content/prepare-textures.mjs');
const propManifest = JSON.parse(readFileSync(join(ROOT, 'content/props.json'), 'utf8'));
const propCount = checkLocked(
  'content/props.lock.json',
  'props',
  (f) => propManifest.packs[f.source],
  propManifest.budgets,
  (f, pack) => (pack.download && pack.images ? ['turned to face +Z, centred and stood on the ground', 'textures downscaled and embedded, metal/roughness maps dropped', ...(f.src.includes(' + ') ? ['kit pieces combined'] : [])] : pack.license === 'Owned' ? [`built in code by ${pack.url}`, 'centred, stood on the ground and scaled to metres'] : ['centred, stood on the ground and scaled to metres', 'texture embedded']),
  'node tools/content/prepare-props.mjs',
);
const skyManifest = JSON.parse(readFileSync(join(ROOT, 'content/skies.json'), 'utf8'));
const skyPacks = Object.fromEntries(
  skyManifest.skies.map((s) => [s.id, { title: s.title, creator: s.authors, url: `https://polyhaven.com/a/${s.source}`, license: skyManifest.license, licenseFile: 'assets-src/polyhaven/License.txt' }]),
);
const skyCount = checkLocked('content/skies.lock.json', 'skies', (f) => skyPacks[f.source], { maxBytes: 400000 }, ['tonemapped photo scaled to a 2048 × 1024 equirectangular JPEG', 'colour graded where content/skies.json gives a grade (night)'], 'node tools/content/prepare-skies.mjs');
const cityManifest = JSON.parse(readFileSync(join(ROOT, 'content/city.json'), 'utf8'));
const cityCount = checkLocked('content/city.lock.json', 'city', () => cityManifest.pack, cityManifest.budgets, ['scaled by 4/3 (buildings fitted to whole cells)', 'variant materials merged, normal and ORM maps dropped, colour maps shrunk', 'interior wall faces removed; buildings simplified'], 'node tools/content/prepare-city.mjs <kit folder>');
const packsManifest = JSON.parse(readFileSync(join(ROOT, 'content/packs.json'), 'utf8'));
const packFileCount = checkLocked(
  'content/packs.lock.json',
  'packs',
  (f) => packsManifest.packs[f.source],
  packsManifest.budgets,
  (f, pack) => (pack.download ? ['fitted to whole cells (centred, stood on the ground, uniform scale)', 'colour map embedded as a palette PNG and reused as a faint emissive map (night city)'] : ['modelled in code by tools/content/prepare-packs.mjs']),
  'node tools/content/prepare-packs.mjs [--downloads <dir>]',
);
console.log(`checked ${textureCount} texture files, ${propCount} props, ${skyCount} skies, ${cityCount} city files and ${packFileCount} style pack files`);

const ledgerText = `${JSON.stringify(ledger, null, 2)}\n`;
if (check) {
  if (!existsSync(LEDGER) || readFileSync(LEDGER, 'utf8') !== ledgerText) problems.push('content/provenance.json is out of date (run pnpm content:build)');
} else writeFileSync(LEDGER, ledgerText);

if (problems.length) {
  for (const p of problems) console.error(`ERROR ${p}`);
  process.exit(1);
}
console.log(check ? 'content OK' : `wrote ${manifest.models.length} models, ${soundFiles.size} sounds and content/provenance.json`);
