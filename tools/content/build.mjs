// Content build: converts selected third-party source models into normalised
// GLB files for the client, and writes a provenance/credits ledger.
//
//   node tools/content/build.mjs           build everything
//   node tools/content/build.mjs --check   verify outputs exist, are up to date, within budget, and licensed
//
// Normalisation: the model's barrel axis becomes +Z (glTF forward), it is
// centred on its bounding box and scaled to the manifest `length` in metres.
// Material names are kept so runtime recolouring can target them.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = join(ROOT, 'content/models.json');
const OUT_DIR = join(ROOT, 'packages/client/public/models');
const LEDGER = join(ROOT, 'content/provenance.json');
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

// ---------------------------------------------------------------- OBJ -> triangles

/** Minimal OBJ + MTL reader: positions, normals, faces (fan-triangulated), grouped by material. */
function readObj(objPath) {
  const text = readFileSync(objPath, 'utf8');
  const v = [];
  const vn = [];
  const groups = new Map(); // material -> { positions, normals }
  let current = 'default';
  let mtlFile = null;
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    switch (p[0]) {
      case 'v': v.push([+p[1], +p[2], +p[3]]); break;
      case 'vn': vn.push([+p[1], +p[2], +p[3]]); break;
      case 'usemtl': current = p[1]; break;
      case 'mtllib': mtlFile = p.slice(1).join(' '); break;
      case 'f': {
        const verts = p.slice(1).map((s) => s.split('/').map((n) => (n ? parseInt(n, 10) : 0)));
        if (!groups.has(current)) groups.set(current, { positions: [], normals: [] });
        const g = groups.get(current);
        for (let i = 1; i + 1 < verts.length; i++) {
          for (const k of [0, i, i + 1]) {
            const [vi, , ni] = verts[k];
            g.positions.push(...v[vi - 1]);
            g.normals.push(...(ni ? vn[ni - 1] : [0, 1, 0]));
          }
        }
        break;
      }
    }
  }
  const materials = new Map();
  if (mtlFile) {
    let name = null;
    for (const line of readFileSync(join(dirname(objPath), mtlFile), 'utf8').split('\n')) {
      const p = line.trim().split(/\s+/);
      if (p[0] === 'newmtl') materials.set((name = p[1]), { color: [0.8, 0.8, 0.8], alpha: 1, shininess: 0 });
      else if (name && p[0] === 'Kd') materials.get(name).color = [+p[1], +p[2], +p[3]];
      else if (name && p[0] === 'd') materials.get(name).alpha = +p[1];
      else if (name && p[0] === 'Ns') materials.get(name).shininess = +p[1];
    }
  }
  return { groups, materials };
}

/** Build a glTF document from OBJ groups, applying a vertex transform. */
function objToDocument(objPath, transform) {
  const { groups, materials } = readObj(objPath);
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh('model');
  for (const [name, g] of groups) {
    const pos = new Float32Array(g.positions.length);
    const nrm = new Float32Array(g.normals.length);
    for (let i = 0; i < g.positions.length; i += 3) {
      pos.set(transform.point(g.positions[i], g.positions[i + 1], g.positions[i + 2]), i);
      nrm.set(transform.normal(g.normals[i], g.normals[i + 1], g.normals[i + 2]), i);
    }
    const m = materials.get(name) ?? { color: [0.8, 0.8, 0.8], alpha: 1, shininess: 0 };
    const metal = /metal|steel|iron/i.test(name);
    const mat = doc
      .createMaterial(name)
      .setBaseColorFactor([...m.color, m.alpha])
      .setMetallicFactor(metal ? 0.6 : 0)
      .setRoughnessFactor(metal ? 0.45 : 0.75);
    if (m.alpha < 1) mat.setAlphaMode('BLEND');
    mesh.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer))
        .setMaterial(mat),
    );
  }
  doc.createScene('scene').addChild(doc.createNode('model').setMesh(mesh));
  return doc;
}

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
  }
  doc.getRoot().getAsset().generator = 'chronosplit content build';
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
    modifications: ['converted to glTF', 'reoriented and scaled', ...(entry.recolor ? ['recoloured'] : [])],
  });
  console.log(`${check ? 'checked' : 'built  '} ${entry.out.padEnd(26)} ${String(tris).padStart(5)} tris ${String(glb.byteLength).padStart(7)} B  ${pack.creator} (${pack.license})`);
}

const ledgerText = `${JSON.stringify(ledger, null, 2)}\n`;
if (check) {
  if (!existsSync(LEDGER) || readFileSync(LEDGER, 'utf8') !== ledgerText) problems.push('content/provenance.json is out of date (run pnpm content:build)');
} else writeFileSync(LEDGER, ledgerText);

if (problems.length) {
  for (const p of problems) console.error(`ERROR ${p}`);
  process.exit(1);
}
console.log(check ? 'content OK' : `wrote ${manifest.models.length} models and content/provenance.json`);
