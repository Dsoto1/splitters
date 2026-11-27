// usage: node preview.mjs <glb> <out.png> ; side (from +z), top (from +y), front(from +x)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { rasterize } from './raster.mjs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [f, out] = process.argv.slice(2);
const doc = await io.read(f);
const pos = [], col = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const P = p.getAttribute('POSITION'), UV = p.getAttribute('TEXCOORD_0'), I = p.getIndices();
    const tex = p.getMaterial()?.getBaseColorTexture();
    let img = null, w = 0, h = 0;
    if (tex && UV) { const r = await sharp(Buffer.from(tex.getImage())).resize(1024, 1024).raw().ensureAlpha().toBuffer({ resolveWithObject: true }); img = r.data; w = r.info.width; h = r.info.height; }
    const n = I ? I.getCount() : P.getCount();
    const a = [0,0,0], uv=[0,0];
    const step = Math.max(1, Math.floor(n / 3 / 600000));
    for (let t = 0; t < n / 3; t += step) for (let k = 0; k < 3; k++) {
      const i = I ? I.getScalar(t * 3 + k) : t * 3 + k;
      P.getElement(i, a);
      const x = M[0]*a[0]+M[4]*a[1]+M[8]*a[2]+M[12], y = M[1]*a[0]+M[5]*a[1]+M[9]*a[2]+M[13], z = M[2]*a[0]+M[6]*a[1]+M[10]*a[2]+M[14];
      pos.push(x, y, z);
      if (img) { UV.getElement(i, uv); const px = Math.min(w-1, Math.max(0, Math.floor(((uv[0]%1)+1)%1*w))), py = Math.min(h-1, Math.max(0, Math.floor(((uv[1]%1)+1)%1*h))); const o = (py*w+px)*4; col.push((img[o]/255)**2.2, (img[o+1]/255)**2.2, (img[o+2]/255)**2.2); }
      else col.push(0.6, 0.6, 0.6);
    }
  }
}
const views = [['side', 0, 0], ['back', 180, 0], ['top', 0, 89.9], ['front', 90, 0]];
const tiles = [];
for (const [name, yaw, pitch] of views) {
  const r = rasterize(new Float32Array(pos), new Float32Array(col), { width: 900, height: 450, yaw, pitch, background: [40, 40, 48] });
  tiles.push(await sharp(Buffer.from(r.data), { raw: { width: 900, height: 450, channels: 4 } }).png().toBuffer());
}
await sharp({ create: { width: 1800, height: 900, channels: 4, background: '#202028' } }).composite(tiles.map((b, i) => ({ input: b, left: (i % 2) * 900, top: Math.floor(i / 2) * 450 }))).png().toFile(out);
console.log('ok', out);
