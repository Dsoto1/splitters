// Meshy's textured FBX downloads ("Meshy_AI_<name>_<date>_texture_fbx": one
// mesh with one material, its maps beside it as <stem>.png, _normal.png,
// _metallic.png, _roughness.png and sometimes _emission.png) and textured GLB
// downloads ("Meshy_AI_<name>_<id>_texture.glb": the same mesh, its maps inside)
// turned into light game meshes. Used by prepare-guns.mjs (weapon models), prepare-props.mjs
// (props) and prepare-meshy-characters.mjs (the seam-aware simplifier).
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, compactPrimitive, flatten, prune, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { fbxToDocument } from './fbx.mjs';

await MeshoptSimplifier.ready;

/**
 * KHR_mesh_quantization for the Meshy models' vertices: normals and tangents in 8 bits (4 bytes each, against 8 at the
 * default 10 bits; the baked normal map carries the fine shading), positions and texture coordinates as usual.
 */
export const MESHY_QUANTIZE = { quantizeNormal: 8 };

/** Texture seams whose two sides, or the texture between them, differ by more than this (0-255 RGB distance, averaged over a few texels) stay put. */
const SEAM_COLOUR = 18;

/**
 * Simplify a mesh whose texture is cut into many small islands (the goblin's rags): the careful simplifier won't
 * collapse across a texture seam, so hundreds of islands stop it far short of the target. Here a seam may be
 * collapsed across where the texture matches on both sides of it (sampled round each side's UV, so a stretched
 * triangle there still samples the same colour), and is protected where it doesn't; texture coordinates weigh in the
 * error so the collapse keeps to where it shows least.
 */
export async function seamAwareSimplify(prim, jpeg, targetTris, maxError = 0.02, seamColour = SEAM_COLOUR) {
  const { data, info } = await sharp(jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const P = prim.getAttribute('POSITION').getArray();
  const UV = prim.getAttribute('TEXCOORD_0').getArray();
  const N = prim.getAttribute('NORMAL').getArray();
  const n = P.length / 3;
  // The colour round a texture coordinate (5 x 5 texels, 2 apart).
  const colour = (u, v) => {
    const out = [0, 0, 0];
    let k = 0;
    for (let dy = -4; dy <= 4; dy += 2) {
      for (let dx = -4; dx <= 4; dx += 2) {
        const x = Math.min(info.width - 1, Math.max(0, Math.round(u * info.width) + dx));
        const y = Math.min(info.height - 1, Math.max(0, Math.round(v * info.height) + dy));
        const i = (y * info.width + x) * 3;
        out[0] += data[i];
        out[1] += data[i + 1];
        out[2] += data[i + 2];
        k++;
      }
    }
    return out.map((x) => x / k);
  };
  // Vertices at one position with different texture coordinates are the sides of a seam.
  const byPos = new Map();
  for (let v = 0; v < n; v++) {
    const key = `${P[v * 3].toFixed(5)},${P[v * 3 + 1].toFixed(5)},${P[v * 3 + 2].toFixed(5)}`;
    (byPos.get(key) ?? byPos.set(key, []).get(key)).push(v);
  }
  const lock = new Uint8Array(n);
  let [seams, kept] = [0, 0];
  for (const group of byPos.values()) {
    if (group.length < 2) continue;
    seams++;
    // Each pair of sides, and the texture on the way between them (a triangle stretched across the seam samples that).
    let worst = 0;
    const diff = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
    for (let a = 0; a < group.length && worst <= seamColour; a++) {
      for (let b = a + 1; b < group.length && worst <= seamColour; b++) {
        const [ua, va, ub, vb] = [UV[group[a] * 2], UV[group[a] * 2 + 1], UV[group[b] * 2], UV[group[b] * 2 + 1]];
        const ca = colour(ua, va);
        const steps = Math.min(16, Math.ceil((Math.hypot(ub - ua, vb - va) * info.width) / 8));
        for (let k = 1; k <= steps; k++) worst = Math.max(worst, diff(ca, colour(ua + ((ub - ua) * k) / steps, va + ((vb - va) * k) / steps)));
      }
    }
    if (worst > seamColour) {
      kept++;
      // meshopt_SimplifyVertex_Protect: no collapse across the seam here.
      for (const v of group) lock[v] = 2;
    }
  }
  const attrs = new Float32Array(n * 5);
  for (let v = 0; v < n; v++) attrs.set([UV[v * 2], UV[v * 2 + 1], N[v * 3], N[v * 3 + 1], N[v * 3 + 2]], v * 5);
  const [out, error] = MeshoptSimplifier.simplifyWithAttributes(
    new Uint32Array(prim.getIndices().getArray()),
    new Float32Array(P),
    3,
    attrs,
    5,
    [1, 1, 0.3, 0.3, 0.3],
    lock,
    targetTris * 3,
    maxError,
    ['Permissive'],
  );
  prim.getIndices().setArray(out);
  compactPrimitive(prim);
  console.log(`  seams: ${seams} vertices on a seam, ${kept} kept apart (texture differs), ${out.length / 3} triangles, error ${error.toFixed(4)}`);
}

/** Downloads heavier than this are first cut to it with the plain simplifier (seams kept), so the later passes stay quick. */
const WORK_TRIANGLES = 200000;
/** The detail hiddenTriangles works at (it casts dozens of rays per triangle). */
const HIDDEN_WORK = 40000;

/**
 * A Meshy textured FBX as a glTF document holding one primitive, cut to `triangles`, with a plain matte material.
 * `recolor({ data, info })` may repaint the colour map's raw RGB pixels first (markings painted on by the generator,
 * a statue's stone). `maxError` (relative to the model's size) caps how far the simplifier may move the surface.
 * `surface` says how the colour map survives the cut:
 * - `texture`: the download's own texture coordinates and map (a 1024 px JPEG), the mesh cut with seamAwareSimplify.
 *   Meshy cuts its maps into thousands of islands scattered over the atlas, and every seam between them stays, so
 *   this stops well short of a prop's budget on most downloads.
 * - `rebake`: the mesh is cut with its seams closed (colour and normals weighing in), laid out afresh in flat charts
 *   (rebake) and its own `textureSize` map painted from the download's surface. Hard edges keep their crease.
 * - `vertex`: the colours go into the vertices instead (no image ships).
 * `dropHidden` drops the triangles no ray from outside can reach first (hiddenTriangles: a wreck's engine bay and
 * seat stuffing), so the budget goes to what shows.
 * The shape the cut takes away comes back as a normal map (`normalSize` px, lossless PNG: the builds re-encode it with
 * normalJpeg at its shipped size; 0 for none): baked from the full download's surface, its own normal map included,
 * onto the cut mesh's texture coordinates (bakeNormals), with the TANGENT attribute it is drawn with. Without it the
 * cut mesh shades as flat, lumpy facets. Returns { doc, sourceTriangles, triangles }.
 */
export async function meshyDocument(fbxPath, { triangles, recolor = null, metallic = 0, roughness = 0.75, maxError = 0.02, surface = 'texture', textureSize = 1024, normalSize = 1024, dropHidden = false, sloppy = false, lod = null } = {}) {
  const glb = /\.glb$/i.test(fbxPath);
  const { doc, normalImage } = glb ? await glbDocument(fbxPath) : { ...(await fbxToDocument(fbxPath, { keepUv: true })), normalImage: existsSync(fbxPath.replace(/\.fbx$/i, '_normal.png')) ? readFileSync(fbxPath.replace(/\.fbx$/i, '_normal.png')) : null };
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  if (prims.length !== 1) throw new Error(`${basename(fbxPath)}: expected one mesh with one material, found ${prims.length} primitives`);
  const prim = prims[0];
  // fbxToDocument writes unindexed triangles; a GLB is indexed.
  const sourceTriangles = (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
  // The GLB's colour map, taken before the old material goes.
  const glbMap = glb ? prim.getMaterial()?.getBaseColorTexture()?.getImage() : null;
  if (glb && !glbMap) throw new Error(`${basename(fbxPath)}: no base colour map in the GLB`);
  await doc.transform(weld());
  if (sourceTriangles > WORK_TRIANGLES) {
    const [cut] = MeshoptSimplifier.simplify(new Uint32Array(prim.getIndices().getArray()), new Float32Array(prim.getAttribute('POSITION').getArray()), 3, WORK_TRIANGLES * 3, Math.max(0.01, maxError), []);
    prim.getIndices().setArray(cut);
    compactPrimitive(prim);
  }
  const png = fbxPath.replace(/\.fbx$/i, '.png');
  if (!glb && !existsSync(png)) throw new Error(`${basename(fbxPath)}: no base colour map ${basename(png)} beside it`);
  const map = await sharp(glb ? Buffer.from(glbMap) : readFileSync(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (recolor) await recolor(map);
  const image = () => sharp(map.data, { raw: { width: map.info.width, height: map.info.height, channels: 3 } });
  const jpeg = await image().resize(1024, 1024, { fit: 'inside', kernel: 'lanczos3' }).jpeg({ quality: 88 }).toBuffer();
  const material = doc.createMaterial(prim.getMaterial()?.getName() || 'meshy').setMetallicFactor(metallic).setRoughnessFactor(roughness);
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  // The download's own normal map (raw RGB), bent into the baked one; and the bake onto the cut mesh.
  const hiMap = normalSize && normalImage ? await sharp(Buffer.from(normalImage)).removeAlpha().raw().toBuffer({ resolveWithObject: true }) : null;
  const bake = async (low, hi) => {
    if (!normalSize) return;
    let [lo, up] = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    for (let i = 0; i < hi.P.length; i += 3) for (let k = 0; k < 3; k++) [lo[k], up[k]] = [Math.min(lo[k], hi.P[i + k]), Math.max(up[k], hi.P[i + k])];
    const reach = Math.hypot(up[0] - lo[0], up[1] - lo[1], up[2] - lo[2]) * Math.max(0.03, maxError * 1.5);
    const { tangents, png } = await bakeNormals(low, hi, { size: normalSize, reach, hiMap });
    prim.setAttribute('TANGENT', acc('VEC4', tangents));
    material.setNormalTexture(doc.createTexture('normal').setImage(new Uint8Array(png)).setMimeType('image/png'));
  };
  const highCopy = () => ({ P: prim.getAttribute('POSITION').getArray().slice(), N: prim.getAttribute('NORMAL').getArray().slice(), UV: prim.getAttribute('TEXCOORD_0').getArray().slice(), I: prim.getIndices().getArray().slice() });
  if (surface === 'texture') {
    if (dropHidden) {
      // At the working detail (the plain simplifier keeps the texture seams), then the careful cut.
      const P = prim.getAttribute('POSITION').getArray();
      const [cut] = MeshoptSimplifier.simplify(new Uint32Array(prim.getIndices().getArray()), new Float32Array(P), 3, HIDDEN_WORK * 3, maxError, []);
      prim.getIndices().setArray(dropHiddenTriangles(P, cut));
      compactPrimitive(prim);
    }
    const hi = highCopy();
    if (prim.getIndices().getCount() / 3 > triangles) await seamAwareSimplify(prim, jpeg, triangles, maxError);
    prim.setAttribute('TANGENT', null);
    await bake({ P: prim.getAttribute('POSITION').getArray(), N: prim.getAttribute('NORMAL').getArray(), UV: prim.getAttribute('TEXCOORD_0').getArray(), idx: prim.getIndices().getArray() }, hi);
    material.setBaseColorTexture(doc.createTexture('albedo').setImage(new Uint8Array(jpeg)).setMimeType('image/jpeg'));
  } else {
    const hi = highCopy();
    prim.setAttribute('TANGENT', null);
    // Vertex colours need the vertices where the colour changes; a rebaked map carries the colour itself.
    const low = closeSeams(prim, map, triangles, maxError, dropHidden, surface === 'vertex' ? 2 : 0.25, sloppy);
    if (surface === 'vertex') {
      prim.setAttribute('TEXCOORD_0', null).setAttribute('POSITION', acc('VEC3', low.pos)).setAttribute('NORMAL', acc('VEC3', low.nrm)).setAttribute('COLOR_0', acc('VEC3', low.col)).setIndices(acc('SCALAR', low.idx));
      compactPrimitive(prim);
    } else {
      const out = await rebake(low, hi, map, textureSize, maxError);
      prim.setAttribute('POSITION', acc('VEC3', out.pos)).setAttribute('NORMAL', acc('VEC3', out.nrm)).setAttribute('TEXCOORD_0', acc('VEC2', out.uv)).setIndices(acc('SCALAR', out.idx));
      material.setBaseColorTexture(doc.createTexture('albedo').setImage(new Uint8Array(out.jpeg)).setMimeType('image/jpeg'));
      await bake({ P: out.pos, N: out.nrm, UV: out.uv, idx: out.idx }, hi);
    }
  }
  prim.setMaterial(material);
  if (lod) addLod(doc, prim, lod);
  await doc.transform(prune());
  return { doc, sourceTriangles, triangles: prim.getIndices().getCount() / 3 };
}

/**
 * `lod: [ratio, distance]`: a lower level of detail beside the mesh (a node whose extras say `lod: 1` and the
 * `distance` in metres from which it is drawn; the game's ModelLibrary takes it out of the model and hands it to
 * Babylon as the mesh's LOD level, see models.ts). Same material and texture coordinates (the colour and normal maps
 * fit it), cut to `ratio` of the triangles, the charts' seams allowed to collapse where their sides sit together.
 */
function addLod(doc, prim, [ratio, distance]) {
  const P = new Float32Array(prim.getAttribute('POSITION').getArray());
  const UV = new Float32Array(prim.getAttribute('TEXCOORD_0')?.getArray() ?? new Float32Array((P.length / 3) * 2));
  const idx = new Uint32Array(prim.getIndices().getArray());
  const target = Math.floor((idx.length / 3) * ratio) * 3;
  let [cut] = MeshoptSimplifier.simplifyWithAttributes(idx, P, 3, UV, 2, [0.5, 0.5], null, target, 0.05, ['Permissive']);
  if (cut.length > target * 1.5) [cut] = MeshoptSimplifier.simplifySloppy(idx, P, 3, null, target, 0.05);
  const low = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
  for (const sem of prim.listSemantics()) low.setAttribute(sem, prim.getAttribute(sem).clone());
  low.setIndices(prim.getIndices().clone().setArray(cut));
  compactPrimitive(low);
  const node = doc.getRoot().listNodes().find((n) => n.getMesh()?.listPrimitives().includes(prim));
  const lodNode = doc.createNode(`${node.getName() || 'mesh'}_lod`).setMesh(doc.createMesh('lod').addPrimitive(low)).setExtras({ lod: 1, distance });
  (node.getParentNode() ?? doc.getRoot().listScenes()[0]).addChild(lodNode);
  lodNode.setMatrix(node.getMatrix());
  console.log(`  level of detail: ${cut.length / 3} triangles from ${distance} m`);
}

/**
 * A Meshy textured GLB as a document like fbxToDocument's: its node transforms baked into the vertices, every map
 * but the base colour dropped (the build paints its own; the normal map, returned as `normalImage`, is baked into
 * the cut mesh's), the mesh left as Meshy wrote it.
 */
async function glbDocument(path) {
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
  await doc.transform(flatten());
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node);
  const normalImage = doc.getRoot().listMaterials().map((m) => m.getNormalTexture()?.getImage()).find(Boolean) ?? null;
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    for (const ext of mat.listExtensions()) ext.dispose();
  }
  return { doc, normalImage };
}

/** Raw RGB pixels from a colour test: 1 where `marked(r, g, b)`. */
function markMask({ data, info }, marked) {
  const n = info.width * info.height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (marked(data[i * 3], data[i * 3 + 1], data[i * 3 + 2])) mask[i] = 1;
  return mask;
}

/** Refill the masked pixels of a raw RGB image from the unmasked ones round them (a normalised blur, wider until every one is filled). */
async function fillMasked({ data, info }, mask) {
  const n = info.width * info.height;
  const raw = { raw: { width: info.width, height: info.height, channels: 3 } };
  let left = mask.reduce((s, m) => s + m, 0);
  for (let sigma = 1.5; left > 0 && sigma < 400; sigma *= 1.6) {
    const colour = Buffer.alloc(n * 3);
    const weight = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i++) {
      if (mask[i]) continue;
      colour.set([data[i * 3], data[i * 3 + 1], data[i * 3 + 2]], i * 3);
      weight.fill(255, i * 3, i * 3 + 3);
    }
    const c = await sharp(colour, raw).blur(sigma).raw().toBuffer();
    const k = await sharp(weight, raw).blur(sigma).raw().toBuffer();
    for (let i = 0; i < n; i++) {
      if (!mask[i] || k[i * 3] < 8) continue;
      for (let ch = 0; ch < 3; ch++) data[i * 3 + ch] = Math.min(255, Math.round((c[i * 3 + ch] * 255) / k[i * 3]));
      mask[i] = 0;
      left--;
    }
  }
}

/**
 * Paint out markings in a colour map (`{ data, info }`, raw RGB): every pixel `marked(r, g, b)` picks, grown by
 * `grow` pixels (and the holes enclosed within `holes` pixels: a skull's eyes, the counters of an O), is refilled
 * from the unmarked pixels round it, so lettering, logos and decals become the plain surface they sit on. Returns
 * the number of pixels refilled.
 */
export async function paintOut(map, marked, { grow = 2, holes = 0 } = {}) {
  const { width: w, height: h } = map.info;
  let mask = markMask(map, marked);
  if (holes > 0) {
    const hit = (x, y, dx, dy) => {
      for (let k = 1; k <= holes; k++) {
        const [u, v] = [x + dx * k, y + dy * k];
        if (u < 0 || v < 0 || u >= w || v >= h) return false;
        if (mask[v * w + u]) return true;
      }
      return false;
    };
    const filled = mask.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!mask[y * w + x] && hit(x, y, 1, 0) && hit(x, y, -1, 0) && hit(x, y, 0, 1) && hit(x, y, 0, -1)) filled[y * w + x] = 1;
    mask = filled;
  }
  for (let g = 0; g < grow; g++) {
    const next = mask.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x]) continue;
        if ((x > 0 && mask[y * w + x - 1]) || (x < w - 1 && mask[y * w + x + 1]) || (y > 0 && mask[(y - 1) * w + x]) || (y < h - 1 && mask[(y + 1) * w + x])) next[y * w + x] = 1;
      }
    }
    mask = next;
  }
  const total = mask.reduce((s, m) => s + m, 0);
  await fillMasked(map, mask);
  return total;
}

/**
 * The mesh with its texture seams closed and cut to `targetTris`: each vertex takes the colour round its texture
 * coordinate (linear light), the copies of a vertex on either side of a seam become one (colours and normals
 * averaged), and the simplifier weighs colour and normal in its error, so colour borders and creases keep their
 * vertices. With `dropHidden`, the triangles nothing outside can see go at a working detail first.
 * Returns { pos, nrm, col, idx } (welded).
 */
export function closeSeams(prim, map, targetTris, maxError, dropHidden, colourWeight, sloppy = false) {
  const { data, info } = map;
  const P = prim.getAttribute('POSITION').getArray();
  const UV = prim.getAttribute('TEXCOORD_0').getArray();
  const N = prim.getAttribute('NORMAL').getArray();
  const n = P.length / 3;
  const index = new Uint32Array(n);
  const keys = new Map();
  const sums = [];
  const r = Math.max(1, Math.round(info.width / 1024));
  for (let v = 0; v < n; v++) {
    const key = `${P[v * 3].toFixed(5)},${P[v * 3 + 1].toFixed(5)},${P[v * 3 + 2].toFixed(5)}`;
    let k = keys.get(key);
    if (k === undefined) {
      k = sums.length;
      keys.set(key, k);
      sums.push({ v, c: [0, 0, 0], nrm: [0, 0, 0], count: 0 });
    }
    index[v] = k;
    const s = sums[k];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.min(info.width - 1, Math.max(0, Math.round(UV[v * 2] * info.width) + dx));
        const y = Math.min(info.height - 1, Math.max(0, Math.round(UV[v * 2 + 1] * info.height) + dy));
        const i = (y * info.width + x) * 3;
        for (let ch = 0; ch < 3; ch++) s.c[ch] += (data[i + ch] / 255) ** 2.2;
        s.count++;
      }
    }
    for (let ch = 0; ch < 3; ch++) s.nrm[ch] += N[v * 3 + ch];
  }
  const m = sums.length;
  const pos = new Float32Array(m * 3);
  const nrm = new Float32Array(m * 3);
  const col = new Float32Array(m * 3);
  sums.forEach((s, k) => {
    pos.set([P[s.v * 3], P[s.v * 3 + 1], P[s.v * 3 + 2]], k * 3);
    const len = Math.hypot(...s.nrm) || 1;
    nrm.set(s.nrm.map((x) => x / len), k * 3);
    col.set(s.c.map((x) => x / s.count), k * 3);
  });
  const src = prim.getIndices().getArray();
  const tris = [];
  for (let i = 0; i < src.length; i += 3) {
    const [a, b, c] = [index[src[i]], index[src[i + 1]], index[src[i + 2]]];
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  const attrs = new Float32Array(m * 6);
  for (let k = 0; k < m; k++) attrs.set([col[k * 3], col[k * 3 + 1], col[k * 3 + 2], nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]], k * 6);
  const weights = [colourWeight, colourWeight, colourWeight, 0.5, 0.5, 0.5];
  let cut = new Uint32Array(tris);
  if (dropHidden) {
    [cut] = MeshoptSimplifier.simplifyWithAttributes(cut, pos, 3, attrs, 6, weights, null, Math.min(cut.length, HIDDEN_WORK * 3), maxError, []);
    cut = dropHiddenTriangles(pos, cut);
  }
  let [idx, error] = MeshoptSimplifier.simplifyWithAttributes(cut, pos, 3, attrs, 6, weights, null, Math.min(cut.length, targetTris * 3), maxError, []);
  // `sloppy`: a surface of many small separate pieces (a tire's tread blocks) that the careful cut can't join is cut
  // to the budget regardless of its topology (the rebake paints the colour back on).
  if (sloppy && idx.length > targetTris * 3 * 1.25) [idx, error] = MeshoptSimplifier.simplifySloppy(idx, pos, 3, null, targetTris * 3, 1);
  console.log(`  seams closed: ${n} vertices welded to ${m}, ${idx.length / 3} triangles, error ${error.toFixed(4)}`);
  return { pos, nrm, col, idx };
}

/** The triangles of `idx` that something outside can see (see hiddenTriangles), as a new index array. */
function dropHiddenTriangles(P, idx) {
  const hidden = hiddenTriangles(P, idx);
  const seen = [];
  for (let t = 0; t < idx.length / 3; t++) if (!hidden[t]) seen.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  console.log(`  hidden: ${(idx.length - seen.length) / 3} of ${idx.length / 3} triangles can't be seen from outside, dropped`);
  return new Uint32Array(seen);
}

/** Faces meeting at a sharper angle than this keep a crease (their own normals) in a rebaked mesh. */
const CREASE = Math.cos((40 * Math.PI) / 180);

/**
 * Lay a welded low-detail mesh out in flat charts and paint its colour map from the high-detail download.
 * Charts: the triangles facing the same way along x, y or z, joined across shared edges, each projected flat along
 * that axis (so a panel's face is one undistorted chart). They are packed into a `size` px square with a gutter
 * round each, at one scale for all. Each texel then takes the download's colour where a ray along the low mesh's
 * normal through the texel's point meets the high mesh (the hit nearest the point), sampled from its own texture
 * coordinates; texels no ray reached, and the gutters, are filled from their neighbours. Normals keep creases
 * sharper than CREASE. Returns { pos, nrm, uv, idx, jpeg } (unwelded where charts or creases split).
 */
export async function rebake(low, hi, map, size, maxError) {
  const { pos, idx } = low;
  const T = idx.length / 3;
  // Face normals and areas.
  const fn = new Float32Array(T * 3);
  const area = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    const [a, b, c] = [idx[t * 3] * 3, idx[t * 3 + 1] * 3, idx[t * 3 + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const x = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const len = Math.hypot(...x) || 1e-12;
    area[t] = len / 2;
    fn.set(x.map((v) => v / len), t * 3);
  }
  // Each triangle's axis (0-5: +x, -x, +y, -y, +z, -z), and charts joined across shared edges of the same axis.
  const axis = new Uint8Array(T);
  for (let t = 0; t < T; t++) {
    const k = [0, 1, 2].reduce((m, j) => (Math.abs(fn[t * 3 + j]) > Math.abs(fn[t * 3 + m]) ? j : m), 0);
    axis[t] = k * 2 + (fn[t * 3 + k] < 0 ? 1 : 0);
  }
  const parent = new Int32Array(T).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const edges = new Map();
  for (let t = 0; t < T; t++) {
    for (let e = 0; e < 3; e++) {
      const [a, b] = [idx[t * 3 + e], idx[t * 3 + ((e + 1) % 3)]];
      const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      const other = edges.get(key);
      if (other === undefined) edges.set(key, t);
      else if (axis[other] === axis[t]) parent[find(t)] = find(other);
    }
  }
  const charts = new Map();
  for (let t = 0; t < T; t++) {
    const r = find(t);
    (charts.get(r) ?? charts.set(r, []).get(r)).push(t);
  }
  // Projected corners (model units) and each chart's box.
  const PLANE = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]];
  const list = [...charts.values()].map((tris) => {
    const [pu, pv] = PLANE[axis[tris[0]]];
    let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const t of tris) {
      for (let c = 0; c < 3; c++) {
        const v = idx[t * 3 + c] * 3;
        u0 = Math.min(u0, pos[v + pu]);
        u1 = Math.max(u1, pos[v + pu]);
        v0 = Math.min(v0, pos[v + pv]);
        v1 = Math.max(v1, pos[v + pv]);
      }
    }
    return { tris, pu, pv, u0, v0, w: u1 - u0, h: v1 - v0, x: 0, y: 0 };
  });
  // Shelf packing at one scale, shrunk until everything fits.
  const PAD = 2;
  const total = list.reduce((s, c) => s + c.w * c.h, 0);
  let scale = Math.sqrt((0.6 * size * size) / Math.max(total, 1e-12));
  list.sort((a, b) => b.h - a.h);
  for (;;) {
    let [x, y, row] = [0, 0, 0];
    let fits = true;
    for (const c of list) {
      const [cw, ch] = [Math.ceil(c.w * scale) + PAD * 2 + 1, Math.ceil(c.h * scale) + PAD * 2 + 1];
      if (x + cw > size) [x, y, row] = [0, y + row, 0];
      if (cw > size || y + ch > size) {
        fits = false;
        break;
      }
      [c.x, c.y] = [x + PAD, y + PAD];
      x += cw;
      row = Math.max(row, ch);
    }
    if (fits) break;
    scale *= 0.93;
  }
  // Unweld: one vertex per (welded vertex, chart, crease side).
  const outPos = [];
  const outNrm = [];
  const outUv = [];
  const outIdx = new Uint32Array(T * 3);
  const faces = new Map();
  for (let t = 0; t < T; t++) for (let c = 0; c < 3; c++) (faces.get(idx[t * 3 + c]) ?? faces.set(idx[t * 3 + c], []).get(idx[t * 3 + c])).push(t);
  const texel = []; // per output triangle: the texel-space corners
  for (const ch of list) {
    const made = new Map();
    for (const t of ch.tris) {
      const corners = [];
      for (let c = 0; c < 3; c++) {
        const v = idx[t * 3 + c];
        // The normal: the faces round this vertex within the crease angle of this face, by area.
        const nrm = [0, 0, 0];
        const group = [];
        for (const f of faces.get(v)) {
          if (fn[f * 3] * fn[t * 3] + fn[f * 3 + 1] * fn[t * 3 + 1] + fn[f * 3 + 2] * fn[t * 3 + 2] < CREASE) continue;
          group.push(f);
          for (let k = 0; k < 3; k++) nrm[k] += fn[f * 3 + k] * area[f];
        }
        const key = `${v}:${group.sort((a, b) => a - b).join(',')}`;
        let out = made.get(key);
        if (out === undefined) {
          out = outPos.length / 3;
          made.set(key, out);
          const len = Math.hypot(...nrm) || 1;
          outPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
          outNrm.push(nrm[0] / len, nrm[1] / len, nrm[2] / len);
          const tx = ch.x + (pos[v * 3 + ch.pu] - ch.u0) * scale;
          const ty = ch.y + (pos[v * 3 + ch.pv] - ch.v0) * scale;
          outUv.push(tx / size, ty / size);
        }
        outIdx[t * 3 + c] = out;
        corners.push(out);
      }
      texel.push(corners);
    }
  }
  const uv = new Float32Array(outUv);
  const P2 = new Float32Array(outPos);
  const N2 = new Float32Array(outNrm);
  // Paint: every texel inside (or within a texel of) a triangle, from the high mesh along the normal.
  const caster = bvh(hi.P, hi.I);
  const { data: src, info } = map;
  const sample = (u, v) => {
    const x = Math.min(info.width - 1.001, Math.max(0, u * info.width - 0.5));
    const y = Math.min(info.height - 1.001, Math.max(0, v * info.height - 0.5));
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const [fx, fy] = [x - x0, y - y0];
    const out = [0, 0, 0];
    for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const i = ((y0 + dy) * info.width + x0 + dx) * 3;
      for (let ch = 0; ch < 3; ch++) out[ch] += src[i + ch] * w;
    }
    return out;
  };
  // As far as the simplifier may have moved the surface, and a little more.
  const reach = caster.size * Math.max(0.03, maxError * 1.5);
  const img = Buffer.alloc(size * size * 3);
  const empty = new Uint8Array(size * size).fill(1);
  let [missed, painted] = [0, 0];
  for (const [a, b, c] of texel) {
    const A = [uv[a * 2] * size, uv[a * 2 + 1] * size];
    const B = [uv[b * 2] * size, uv[b * 2 + 1] * size];
    const C = [uv[c * 2] * size, uv[c * 2 + 1] * size];
    const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    if (Math.abs(den) < 1e-9) continue;
    const xs = [Math.floor(Math.min(A[0], B[0], C[0]) - 1), Math.ceil(Math.max(A[0], B[0], C[0]) + 1)];
    const ys = [Math.floor(Math.min(A[1], B[1], C[1]) - 1), Math.ceil(Math.max(A[1], B[1], C[1]) + 1)];
    // A texel counts when its centre is within a texel of the triangle (barycentrics slightly negative).
    const slack = 1.2 / Math.sqrt(Math.abs(den));
    for (let y = Math.max(0, ys[0]); y <= Math.min(size - 1, ys[1]); y++) {
      for (let x = Math.max(0, xs[0]); x <= Math.min(size - 1, xs[1]); x++) {
        if (!empty[y * size + x]) continue;
        const [px, py] = [x + 0.5, y + 0.5];
        let l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den;
        let l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den;
        let l3 = 1 - l1 - l2;
        if (l1 < -slack || l2 < -slack || l3 < -slack) continue;
        [l1, l2, l3] = [Math.max(0, l1), Math.max(0, l2), Math.max(0, l3)];
        const s = l1 + l2 + l3;
        [l1, l2, l3] = [l1 / s, l2 / s, l3 / s];
        const p = [0, 1, 2].map((k) => P2[a * 3 + k] * l1 + P2[b * 3 + k] * l2 + P2[c * 3 + k] * l3);
        const nn = [0, 1, 2].map((k) => N2[a * 3 + k] * l1 + N2[b * 3 + k] * l2 + N2[c * 3 + k] * l3);
        const len = Math.hypot(...nn) || 1;
        const d = nn.map((v) => v / len);
        const hit = caster.nearest([p[0] - d[0] * reach, p[1] - d[1] * reach, p[2] - d[2] * reach], d, 2 * reach, reach);
        if (!hit) {
          missed++;
          continue;
        }
        const [i0, i1, i2] = [hi.I[hit.tri * 3], hi.I[hit.tri * 3 + 1], hi.I[hit.tri * 3 + 2]];
        const w0 = 1 - hit.u - hit.v;
        const rgb = sample(hi.UV[i0 * 2] * w0 + hi.UV[i1 * 2] * hit.u + hi.UV[i2 * 2] * hit.v, hi.UV[i0 * 2 + 1] * w0 + hi.UV[i1 * 2 + 1] * hit.u + hi.UV[i2 * 2 + 1] * hit.v);
        img.set(rgb.map((v) => Math.round(v)), (y * size + x) * 3);
        empty[y * size + x] = 0;
        painted++;
      }
    }
  }
  console.log(`  rebaked: ${list.length} charts, ${painted} texels painted, ${missed} missed (filled from their neighbours)`);
  await fillMasked({ data: img, info: { width: size, height: size } }, empty);
  const jpeg = await sharp(img, { raw: { width: size, height: size, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
  return { pos: P2, nrm: N2, uv, idx: outIdx, jpeg };
}

/**
 * Per-vertex tangents (glTF TANGENT: xyz along increasing u, w the handedness, so that cross(normal, tangent) * w
 * runs along increasing v) from a mesh's positions, normals and texture coordinates: each triangle's tangent and
 * bitangent summed at its corners (by surface area), then made perpendicular to the vertex normal.
 * Returns Float32Array(n * 4).
 */
export function vertexTangents(P, N, UV, idx) {
  const n = P.length / 3;
  const tan = new Float64Array(n * 3);
  const bit = new Float64Array(n * 3);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
    const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]];
    const e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
    const [du1, dv1, du2, dv2] = [UV[b * 2] - UV[a * 2], UV[b * 2 + 1] - UV[a * 2 + 1], UV[c * 2] - UV[a * 2], UV[c * 2 + 1] - UV[a * 2 + 1]];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-14) continue;
    // dP/du and dP/dv times |det|: summed by surface area.
    const s = Math.sign(det);
    for (let k = 0; k < 3; k++) {
      const t = (e1[k] * dv2 - e2[k] * dv1) * s;
      const bt = (e2[k] * du1 - e1[k] * du2) * s;
      for (const v of [a, b, c]) {
        tan[v * 3 + k] += t;
        bit[v * 3 + k] += bt;
      }
    }
  }
  const out = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const nv = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    let t = [tan[v * 3], tan[v * 3 + 1], tan[v * 3 + 2]];
    const d = t[0] * nv[0] + t[1] * nv[1] + t[2] * nv[2];
    t = [t[0] - nv[0] * d, t[1] - nv[1] * d, t[2] - nv[2] * d];
    let len = Math.hypot(...t);
    if (len < 1e-12) {
      // No usable texture direction: any direction across the normal.
      t = Math.abs(nv[0]) < 0.9 ? [0, -nv[2], nv[1]] : [nv[2], 0, -nv[0]];
      const d2 = t[0] * nv[0] + t[1] * nv[1] + t[2] * nv[2];
      t = [t[0] - nv[0] * d2, t[1] - nv[1] * d2, t[2] - nv[2] * d2];
      len = Math.hypot(...t) || 1;
    }
    t = t.map((x) => x / len);
    const cx = [nv[1] * t[2] - nv[2] * t[1], nv[2] * t[0] - nv[0] * t[2], nv[0] * t[1] - nv[1] * t[0]];
    const w = cx[0] * bit[v * 3] + cx[1] * bit[v * 3 + 1] + cx[2] * bit[v * 3 + 2] < 0 ? -1 : 1;
    out.set([t[0], t[1], t[2], w], v * 4);
  }
  return out;
}

/**
 * A baked normal map (PNG, or any image sharp reads) as the JPEG that ships: `size` px, chroma kept at full
 * resolution (the red and green channels are the normal's direction).
 */
export async function normalJpeg(image, size, quality = 85) {
  return sharp(Buffer.from(image)).resize(size, size, { fit: 'inside', kernel: 'lanczos3' }).removeAlpha().jpeg({ quality, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
}

/**
 * Which way a normal map's green channel points against cross(normal, tangent) * w (vertexTangents' bitangent, along
 * increasing v), as Babylon (the game's loader) draws a glTF normal map with a TANGENT attribute. Checked by rendering
 * cut props against their full download with the shading only (no colour map): this sign tracks the download, the
 * other lights every dent from the wrong side and came out further from it than no normal map at all. The download's
 * own map is read with the same sign (Babylon draws it the same way).
 */
const GREEN = 1;

/**
 * A tangent-space normal map for a low-detail mesh, from the high-detail surface it was cut from: every texel a
 * triangle of `low` covers (its `UV`, in a `size` px square) casts a ray along the low mesh's normal through its
 * point (as rebake does), takes the high mesh's normal where it lands (its vertex normals interpolated, bent by the
 * download's own normal map `hiMap` when there is one: raw RGB in the high mesh's texture coordinates and tangent
 * space) and writes it in the low mesh's tangent space (`vertexTangents`, shipped as its TANGENT attribute). Texels
 * nothing reached, and the gutters, are filled from their neighbours. `low`: { P, N, UV, idx }, `hi`: { P, N, UV, I };
 * `reach`: how far from the low surface the high one may be. Returns { tangents, png }.
 */
export async function bakeNormals(low, hi, { size, reach, hiMap = null, caster = null }) {
  const T = vertexTangents(low.P, low.N, low.UV, low.idx);
  caster ??= bvh(hi.P, hi.I);
  const HT = hiMap ? vertexTangents(hi.P, hi.N, hi.UV, hi.I) : null;
  const img = Buffer.alloc(size * size * 3);
  const empty = new Uint8Array(size * size).fill(1);
  const sampleMap = (u, v) => {
    const { data, info } = hiMap;
    const x = Math.min(info.width - 1.001, Math.max(0, u * info.width - 0.5));
    const y = Math.min(info.height - 1.001, Math.max(0, v * info.height - 0.5));
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const [fx, fy] = [x - x0, y - y0];
    const out = [0, 0, 0];
    for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const i = ((y0 + dy) * info.width + x0 + dx) * 3;
      for (let ch = 0; ch < 3; ch++) out[ch] += data[i + ch] * w;
    }
    return out.map((c) => (c / 255) * 2 - 1);
  };
  const { P, N, UV, idx } = low;
  let [painted, missed, bent] = [0, 0, 0];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const A = [UV[a * 2] * size, UV[a * 2 + 1] * size];
    const B = [UV[b * 2] * size, UV[b * 2 + 1] * size];
    const C = [UV[c * 2] * size, UV[c * 2 + 1] * size];
    const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    if (Math.abs(den) < 1e-9) continue;
    const xs = [Math.floor(Math.min(A[0], B[0], C[0]) - 1), Math.ceil(Math.max(A[0], B[0], C[0]) + 1)];
    const ys = [Math.floor(Math.min(A[1], B[1], C[1]) - 1), Math.ceil(Math.max(A[1], B[1], C[1]) + 1)];
    // A texel counts when its centre is within a texel of the triangle (barycentrics slightly negative).
    const slack = 1.2 / Math.sqrt(Math.abs(den));
    for (let y = Math.max(0, ys[0]); y <= Math.min(size - 1, ys[1]); y++) {
      for (let x = Math.max(0, xs[0]); x <= Math.min(size - 1, xs[1]); x++) {
        if (!empty[y * size + x]) continue;
        const [px, py] = [x + 0.5, y + 0.5];
        let l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den;
        let l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den;
        let l3 = 1 - l1 - l2;
        if (l1 < -slack || l2 < -slack || l3 < -slack) continue;
        [l1, l2, l3] = [Math.max(0, l1), Math.max(0, l2), Math.max(0, l3)];
        const s = l1 + l2 + l3;
        [l1, l2, l3] = [l1 / s, l2 / s, l3 / s];
        const lerp = (arr, stride, k) => arr[a * stride + k] * l1 + arr[b * stride + k] * l2 + arr[c * stride + k] * l3;
        const p = [0, 1, 2].map((k) => lerp(P, 3, k));
        const n = unit([0, 1, 2].map((k) => lerp(N, 3, k)));
        // The texel's tangent frame as the shader builds it (the interpolated tangent made perpendicular to the normal).
        const tg = unit(across([0, 1, 2].map((k) => lerp(T, 4, k)), n));
        const bt = cross3(n, tg).map((v) => v * T[a * 4 + 3]);
        const hit = caster.nearest([p[0] - n[0] * reach, p[1] - n[1] * reach, p[2] - n[2] * reach], n, 2 * reach, reach);
        let h = n;
        if (hit) {
          const [i0, i1, i2] = [hi.I[hit.tri * 3], hi.I[hit.tri * 3 + 1], hi.I[hit.tri * 3 + 2]];
          const w0 = 1 - hit.u - hit.v;
          const at = (arr, stride, k) => arr[i0 * stride + k] * w0 + arr[i1 * stride + k] * hit.u + arr[i2 * stride + k] * hit.v;
          h = unit([0, 1, 2].map((k) => at(hi.N, 3, k)));
          if (hiMap) {
            const m = sampleMap(at(hi.UV, 2, 0), at(hi.UV, 2, 1));
            const ht = unit(across([0, 1, 2].map((k) => at(HT, 4, k)), h));
            const hb = cross3(h, ht).map((v) => v * HT[i0 * 4 + 3] * GREEN);
            const bentN = [0, 1, 2].map((k) => ht[k] * m[0] + hb[k] * m[1] + h[k] * m[2]);
            if (Math.hypot(...bentN) > 1e-6) {
              h = unit(bentN);
              bent++;
            }
          }
          painted++;
        } else missed++;
        // Into the low mesh's tangent space (green as GREEN says), kept on the outside of the surface.
        let ts = [dot3(h, tg), dot3(h, bt) * GREEN, dot3(h, n)];
        if (ts[2] < 0.2) ts = unit([ts[0], ts[1], 0.2 * Math.hypot(ts[0], ts[1]) + 1e-6]);
        img.set(ts.map((v) => Math.round((v * 0.5 + 0.5) * 255)), (y * size + x) * 3);
        empty[y * size + x] = 0;
      }
    }
  }
  await fillMasked({ data: img, info: { width: size, height: size } }, empty);
  // Lossless here: the builds re-encode it at its shipped size (normalJpeg).
  const png = await sharp(img, { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 3 }).toBuffer();
  console.log(`  normal map: ${size} px, ${painted} texels from the high mesh${hiMap ? ` (${bent} bent by its normal map)` : ''}, ${missed} missed`);
  return { tangents: T, png };
}

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};
/** `a` with its part along the unit vector `n` taken out. */
const across = (a, n) => {
  const d = dot3(a, n);
  return [a[0] - n[0] * d, a[1] - n[1] * d, a[2] - n[2] * d];
};

/**
 * A bounding-volume hierarchy over a triangle mesh, for rays: `blocked(o, d, self)` says whether a ray from `o`
 * along `d` hits any triangle but `self`; `nearest(o, d, tMax, tRef)` the hit within [0, tMax] whose distance is
 * closest to `tRef` (triangles facing along `d` first), as { tri, t, u, v } (u, v: the barycentrics of the second and third corners), or null.
 */
function bvh(P, idx) {
  const T = idx.length / 3;
  const box = new Float32Array(T * 6);
  const mid = new Float32Array(T * 3);
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < 3; k++) {
      const lo = Math.min(P[idx[t * 3] * 3 + k], P[idx[t * 3 + 1] * 3 + k], P[idx[t * 3 + 2] * 3 + k]);
      const hi = Math.max(P[idx[t * 3] * 3 + k], P[idx[t * 3 + 1] * 3 + k], P[idx[t * 3 + 2] * 3 + k]);
      box[t * 6 + k] = lo;
      box[t * 6 + 3 + k] = hi;
      mid[t * 3 + k] = (lo + hi) / 2;
    }
  }
  const order = new Uint32Array(T).map((_, i) => i);
  const build = (from, to) => {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = from; i < to; i++) {
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], box[order[i] * 6 + k]);
        hi[k] = Math.max(hi[k], box[order[i] * 6 + 3 + k]);
      }
    }
    const node = { lo, hi, from, to, a: null, b: null };
    if (to - from <= 8) return node;
    const axis = [0, 1, 2].reduce((m, k) => (hi[k] - lo[k] > hi[m] - lo[m] ? k : m), 0);
    order.set(order.slice(from, to).sort((x, y) => mid[x * 3 + axis] - mid[y * 3 + axis]), from);
    const half = (from + to) >> 1;
    node.a = build(from, half);
    node.b = build(half, to);
    return node;
  };
  const root = build(0, T);
  const hitBox = (n, o, inv, tMax) => {
    let t0 = 0;
    let t1 = tMax;
    for (let k = 0; k < 3; k++) {
      let a = (n.lo[k] - o[k]) * inv[k];
      let b = (n.hi[k] - o[k]) * inv[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    return true;
  };
  // Möller–Trumbore, either face: [t, u, v] or null.
  const hitTri = (t, o, d) => {
    const [i0, i1, i2] = [idx[t * 3] * 3, idx[t * 3 + 1] * 3, idx[t * 3 + 2] * 3];
    const e1x = P[i1] - P[i0], e1y = P[i1 + 1] - P[i0 + 1], e1z = P[i1 + 2] - P[i0 + 2];
    const e2x = P[i2] - P[i0], e2y = P[i2 + 1] - P[i0 + 1], e2z = P[i2 + 2] - P[i0 + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-14) return null;
    const sx = o[0] - P[i0], sy = o[1] - P[i0 + 1], sz = o[2] - P[i0 + 2];
    const u = (sx * px + sy * py + sz * pz) / det;
    if (u < 0 || u > 1) return null;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) / det;
    if (v < 0 || u + v > 1) return null;
    const dist = (e2x * qx + e2y * qy + e2z * qz) / det;
    return dist > 1e-9 ? [dist, u, v] : null;
  };
  const blocked = (o, d, self) => {
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (!hitBox(n, o, inv, Infinity)) continue;
      if (n.a) stack.push(n.a, n.b);
      else for (let i = n.from; i < n.to; i++) if (order[i] !== self && hitTri(order[i], o, d)) return true;
    }
    return false;
  };
  const facing = (t, d) => {
    const [i0, i1, i2] = [idx[t * 3] * 3, idx[t * 3 + 1] * 3, idx[t * 3 + 2] * 3];
    const e1 = [P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]];
    const e2 = [P[i2] - P[i0], P[i2 + 1] - P[i0 + 1], P[i2 + 2] - P[i0 + 2]];
    return (e1[1] * e2[2] - e1[2] * e2[1]) * d[0] + (e1[2] * e2[0] - e1[0] * e2[2]) * d[1] + (e1[0] * e2[1] - e1[1] * e2[0]) * d[2] > 0;
  };
  const nearest = (o, d, tMax, tRef) => {
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
    const stack = [root];
    let best = null;
    while (stack.length) {
      const n = stack.pop();
      if (!hitBox(n, o, inv, tMax)) continue;
      if (n.a) stack.push(n.a, n.b);
      else {
        for (let i = n.from; i < n.to; i++) {
          const h = hitTri(order[i], o, d);
          if (!h || h[0] > tMax) continue;
          // Surfaces facing the way the ray points (the outside of a panel, not the inside behind it) come first.
          const score = Math.abs(h[0] - tRef) + (facing(order[i], d) ? 0 : tMax);
          if (!best || score < best.score) best = { tri: order[i], t: h[0], u: h[1], v: h[2], score };
        }
      }
    }
    return best;
  };
  const size = Math.hypot(root.hi[0] - root.lo[0], root.hi[1] - root.lo[1], root.hi[2] - root.lo[2]);
  return { blocked, nearest, size };
}

/** Ray directions spread evenly over the sphere (a Fibonacci spiral). */
function sphereDirections(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return out;
}

/**
 * Triangles nothing outside can see: from points on each triangle, rays in `rays` directions over the whole sphere
 * (both faces count: Meshy's sheet metal is one-sided) all hit the model again. Returns a flag per triangle.
 */
export function hiddenTriangles(P, idx, rays = 40) {
  const T = idx.length / 3;
  const caster = bvh(P, idx);
  const dirs = sphereDirections(rays);
  const hidden = new Uint8Array(T);
  // Rays start a little off the surface, so a skin lying right on another (a roof and its lining) still sees out.
  const eps = caster.size * 3e-3;
  // From the centre and from points towards each corner (a sliver showing past an edge still counts as seen).
  const at = [[1 / 3, 1 / 3, 1 / 3], [0.7, 0.15, 0.15], [0.15, 0.7, 0.15], [0.15, 0.15, 0.7]];
  for (let t = 0; t < T; t++) {
    const [i0, i1, i2] = [idx[t * 3] * 3, idx[t * 3 + 1] * 3, idx[t * 3 + 2] * 3];
    let seen = false;
    for (const w of at) {
      const o = [0, 1, 2].map((k) => P[i0 + k] * w[0] + P[i1 + k] * w[1] + P[i2 + k] * w[2]);
      for (const d of dirs) {
        if (!caster.blocked([o[0] + d[0] * eps, o[1] + d[1] * eps, o[2] + d[2] * eps], d, t)) {
          seen = true;
          break;
        }
      }
      if (seen) break;
    }
    if (!seen) hidden[t] = 1;
  }
  return hidden;
}
