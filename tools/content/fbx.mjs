// FBX (binary, as Blender exports it) to a glTF document, for the packs that
// ship FBX only (Designersoup's cars, the household items, Elbolillo's PSX
// sets). three.js' FBXLoader does the parsing; this file bakes every mesh's
// world transform into its vertices and writes plain glTF primitives (one
// per material), so prepare-props.mjs can normalise them like any GLB.
//
// Textures: a material's colour map is embedded when the FBX names a file we
// can find (embedded in the FBX, beside it, in "<name>.fbm/" or a sibling
// "Textures/" folder). flatten.mjs can then swap them for flat colours.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { resolveObjectURL } from 'node:buffer';
import { Document } from '@gltf-transform/core';
import sharp from 'sharp';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// FBXLoader asks a TextureLoader for each map; in Node there is no DOM to load
// it, so record the URL instead and resolve the bytes ourselves.
THREE.TextureLoader.prototype.load = function load(url) {
  const t = new THREE.Texture();
  t.userData.url = url;
  return t;
};

async function textureBytes(url, fbxPath) {
  if (!url) return null;
  if (url.startsWith('blob:')) {
    const blob = resolveObjectURL(url);
    return blob ? Buffer.from(await blob.arrayBuffer()) : null;
  }
  const name = basename(decodeURIComponent(url).replace(/\\/g, '/'));
  const dir = dirname(fbxPath);
  const stem = basename(fbxPath).replace(/\.fbx$/i, '');
  if (!name) return null;
  for (const p of [join(dir, name), join(dir, `${stem}.fbm`, name), join(dir, '..', 'Textures', name), join(dir, 'Textures', name)]) if (existsSync(p) && statSync(p).isFile()) return readFileSync(p);
  return null;
}

// GLTFExporter reads its output blobs with a FileReader, which Node lacks.
globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
      this.onload?.();
    });
  }
  readAsDataURL(blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;
      this.onloadend?.();
      this.onload?.();
    });
  }
};

/**
 * A rigged, animated FBX (Quaternius' Zombie) as a GLB with its skeleton,
 * skin and the clips asked for, renamed: `clips` is [[our name, its clip name
 * (matched at the end, after Blender's "Armature|"), first frame, last frame]]
 * with the frame range optional (frames at `fps`). The model stands on y = 0
 * at `height` metres tall in the first clip's first frame, facing as it does
 * in the file (+Z for Quaternius' characters).
 */
export async function fbxRiggedToGlb(fbxPath, { clips, height, fps = 24 }) {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const buf = readFileSync(fbxPath);
  const group = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), dirname(fbxPath) + '/');
  const animations = clips.map(([ours, theirs, from, to]) => {
    const src = group.animations.find((a) => a.name === theirs || a.name.endsWith(`|${theirs}`));
    if (!src) throw new Error(`${basename(fbxPath)} has no clip ${theirs} (has ${group.animations.map((a) => a.name).join(', ')})`);
    const clip = from !== undefined ? THREE.AnimationUtils.subclip(src, ours, from, to, fps) : src.clone();
    clip.name = ours;
    // Scale tracks, and position tracks that never move (every bone but the hips), cost bytes and do nothing.
    const still = (t) => t.values.every((v, i) => Math.abs(v - t.values[i % 3]) < 1e-4);
    clip.tracks = clip.tracks.filter((t) => !/\.scale$/.test(t.name) && !(/\.position$/.test(t.name) && still(t)));
    return clip;
  });
  // Measure the posed body: the skinned bounds in the first clip's first frame.
  const mixer = new THREE.AnimationMixer(group);
  mixer.clipAction(animations[0]).play();
  mixer.setTime(0);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  group.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.computeBoundingBox();
    box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(group);
  const s = height / (box.max.y - box.min.y);
  const root = new THREE.Group();
  root.name = 'creature';
  root.scale.setScalar(s);
  root.position.y = -box.min.y * s;
  root.add(group);
  root.updateMatrixWorld(true);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, animations, onlyVisible: false });
  return new Uint8Array(glb);
}

/**
 * Parse an FBX and return { doc, names }: a glTF document with one node per
 * mesh object (world transform baked in, metres, +Y up) and the object names.
 * `pick` keeps only objects whose name (or an ancestor's name) matches it; `keepUv` keeps UVs on untextured
 * materials (packs whose maps sit beside the FBX without being linked from it).
 */
export async function fbxToDocument(fbxPath, { pick = null, keepUv = false } = {}) {
  const buf = readFileSync(fbxPath);
  const group = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), dirname(fbxPath) + '/');
  group.updateMatrixWorld(true);
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('scene');
  const materials = new Map();
  const names = [];
  const textures = new Map();

  const material = async (m) => {
    if (materials.has(m)) return materials.get(m);
    const c = m.color ? [m.color.r, m.color.g, m.color.b] : [0.8, 0.8, 0.8];
    const out = doc.createMaterial(m.name || 'material').setMetallicFactor(0).setRoughnessFactor(0.8).setDoubleSided(m.side === THREE.DoubleSide);
    const bytes = await textureBytes(m.map?.userData?.url, fbxPath);
    out.setBaseColorFactor([...c, m.opacity < 1 && m.transparent ? m.opacity : 1]);
    if (bytes) {
      const key = m.map.userData.url;
      if (!textures.has(key)) {
        const png = (await sharp(bytes).metadata()).hasAlpha;
        const data = png ? await sharp(bytes).png().toBuffer() : await sharp(bytes).jpeg({ quality: 85 }).toBuffer();
        textures.set(key, doc.createTexture(basename(key)).setImage(data).setMimeType(png ? 'image/png' : 'image/jpeg'));
      }
      out.setBaseColorFactor([1, 1, 1, out.getBaseColorFactor()[3]]).setBaseColorTexture(textures.get(key));
    }
    // The emissive colour counts only at its intensity: madduck's hospital set pairs a white emissive colour with factor 0.
    const glow = m.emissiveIntensity ?? 1;
    if (m.emissive && glow > 0 && (m.emissive.r || m.emissive.g || m.emissive.b)) out.setEmissiveFactor([m.emissive.r * glow, m.emissive.g * glow, m.emissive.b * glow]);
    if (m.transparent && m.opacity < 1) out.setAlphaMode('BLEND');
    materials.set(m, out);
    return out;
  };

  const meshes = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    let chain = '';
    for (let p = o; p && p !== group; p = p.parent) chain = `${p.name}/${chain}`;
    names.push(chain);
    if (pick && !chain.split('/').some((n) => pick.test(n))) return;
    meshes.push(o);
  });
  for (const o of meshes) {
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
    const world = o.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(world);
    const flip = world.determinant() < 0;
    const mesh = doc.createMesh(o.name);
    const v = new THREE.Vector3();
    for (const gr of groups) {
      const n = gr.count;
      if (!n) continue;
      const P = new Float32Array(n * 3);
      const N = new Float32Array(n * 3);
      const U = uv ? new Float32Array(n * 2) : null;
      for (let i = 0; i < n; i++) {
        // Mirrored transforms flip winding; swap two corners of each triangle to keep faces outward.
        const k = flip ? i - (i % 3) + [0, 2, 1][i % 3] : i;
        const s = gr.start + k;
        v.fromBufferAttribute(pos, s).applyMatrix4(world);
        P.set([v.x, v.y, v.z], i * 3);
        if (nrm) {
          v.fromBufferAttribute(nrm, s).applyMatrix3(normalMatrix).normalize();
          N.set([v.x, v.y, v.z], i * 3);
        }
        if (U) U.set([uv.getX(s), 1 - uv.getY(s)], i * 2);
      }
      const prim = doc
        .createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
        .setMaterial(await material(mats[gr.materialIndex ?? 0] ?? mats[0]));
      if (nrm) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer));
      if (U && (keepUv || prim.getMaterial().getBaseColorTexture())) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(U).setBuffer(buffer));
      mesh.addPrimitive(prim);
    }
    if (mesh.listPrimitives().length) scene.addChild(doc.createNode(o.name).setMesh(mesh));
    else mesh.dispose();
  }
  return { doc, names };
}
