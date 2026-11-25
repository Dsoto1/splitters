// node _geomcmp.mjs old.glb new.glb: whether the meshes are the same apart from texture coordinates and maps.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [a, b] = await Promise.all(process.argv.slice(2, 4).map((f) => io.read(f)));
const prims = (d) => d.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
const pa = prims(a), pb = prims(b);
const out = [];
if (pa.length !== pb.length) out.push(`prims ${pa.length}/${pb.length}`);
pa.forEach((p, i) => {
  const q = pb[i]; if (!q) return;
  for (const s of p.listSemantics()) {
    const x = p.getAttribute(s).getArray(), y = q.getAttribute(s)?.getArray();
    if (!y) { out.push(`${i}:${s} missing`); continue; }
    const same = x.length === y.length && x.every((v, k) => v === y[k]);
    if (!same) out.push(`${i}:${s}${x.length !== y.length ? ` len ${x.length}/${y.length}` : ''}`);
  }
  const x = p.getIndices().getArray(), y = q.getIndices().getArray();
  if (!(x.length === y.length && x.every((v, k) => v === y[k]))) out.push(`${i}:indices ${x.length}/${y.length}`);
});
const ja = a.getRoot().listNodes().map((n) => n.getTranslation().join()).join(';'), jb = b.getRoot().listNodes().map((n) => n.getTranslation().join()).join(';');
if (ja !== jb) out.push('nodes');
console.log(out.length ? 'DIFF ' + out.join(' ') : 'SAME');
