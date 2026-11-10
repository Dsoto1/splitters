// The kit props' GLB writer: one material per model (the piece's surface: its roughness, metalness and the shared
// detail picture, as tools/content/surfaces.mjs gives the Kenney props), vertex colours for everything else, and lower
// levels of detail as nodes with glTF extras { lod, distance } (the contract ModelLibrary and the prop batches read,
// as tools/content/nature.mjs and env/mesh.mjs write it). One material keeps every level one mesh, so instances and
// batched copies pick their level by distance.
//
// The detail picture reads the second set of texture coordinates (TEXCOORD_1), box-projected in metres along the
// axis each face looks most (surfaces.mjs does the same for the Kenney props), stored as whole millimetres.

import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { norm } from '../env/mesh.mjs';

const R = (x, q = 1e4) => {
  const v = Math.round(x * q) / q;
  return Object.is(v, -0) ? 0 : v;
};
const byte = (list) => Uint8Array.from(list, (x) => Math.round(Math.min(1, Math.max(0, x)) * 255));
/** Metres per unit of the detail coordinates. */
export const UV_UNIT = 0.001;

/**
 * Write a kit prop. `levels`: [{ distance, mesh }] (level 0 first; `distance` where the level takes over). `surface`:
 * the content/surfaces.json entry ({ id, tile, roughness, metallic, detail }). Returns the GLB bytes.
 */
export async function writeKitModel(name, levels, surface) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('scene');
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const material = doc
    .createMaterial(`kit_${surface.id}`)
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(surface.metallic)
    .setRoughnessFactor(surface.roughness)
    .setExtras({ surface: surface.id, ...(surface.tile ? { tile: surface.tile, uv: UV_UNIT, detail: [surface.detail.albedo, surface.detail.roughness, surface.detail.bump] } : {}) });
  levels.forEach((level, i) => {
    const m = level.mesh;
    const mesh = doc.createMesh(i ? `${name}_lod${i}` : name);
    // Game space → glTF space: x mirrored (Babylon's importer mirrors it back), so faces turn the other way.
    const P = new Float32Array(m.P.length);
    const N = new Int8Array(m.N.length);
    const UV = new Int16Array((m.P.length / 3) * 2);
    for (let v = 0; v < m.P.length; v += 3) {
      const x = m.P[v];
      const y = m.P[v + 1];
      const z = m.P[v + 2];
      P[v] = R(-x);
      P[v + 1] = R(y);
      P[v + 2] = R(z);
      const n = norm([m.N[v], m.N[v + 1], m.N[v + 2]]);
      N[v] = Math.round(-n[0] * 127);
      N[v + 1] = Math.round(n[1] * 127);
      N[v + 2] = Math.round(n[2] * 127);
      const [ax, ay, az] = n.map(Math.abs);
      // In the drawn space (x mirrored), as surfaces.mjs projects a built Kenney prop.
      const [u, w] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [-x, z] : [-x, y];
      const k = (v / 3) * 2;
      UV[k] = Math.max(-32767, Math.min(32767, Math.round(u / UV_UNIT)));
      UV[k + 1] = Math.max(-32767, Math.min(32767, Math.round(-w / UV_UNIT)));
    }
    const I = m.vertexCount > 65535 ? new Uint32Array(m.I.length) : new Uint16Array(m.I.length);
    for (let t = 0; t < m.I.length; t += 3) {
      I[t] = m.I[t];
      I[t + 1] = m.I[t + 2];
      I[t + 2] = m.I[t + 1];
    }
    const prim = doc
      .createPrimitive()
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(I).setBuffer(buffer))
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setNormalized(true).setBuffer(buffer))
      .setAttribute('TEXCOORD_1', doc.createAccessor().setType('VEC2').setArray(UV).setBuffer(buffer))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(byte(m.C)).setNormalized(true).setBuffer(buffer))
      .setMaterial(material);
    mesh.addPrimitive(prim);
    const node = doc.createNode(i ? `${name}_lod${i}` : name).setMesh(mesh);
    if (i) node.setExtras({ lod: i, distance: level.distance });
    scene.addChild(node);
  });
  return Buffer.from(await new NodeIO().registerExtensions([KHRMeshQuantization]).writeBinary(doc));
}
