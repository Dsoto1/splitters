// Minimal Wavefront OBJ + MTL reading (flat-coloured low-poly packs: Quaternius'
// OBJ exports), shared by build.mjs and prepare-obj-props.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Document } from '@gltf-transform/core';


/** Minimal OBJ + MTL reader: positions, normals, faces (fan-triangulated), grouped by material. */
export function readObj(objPath) {
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
export function objToDocument(objPath, transform) {
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

