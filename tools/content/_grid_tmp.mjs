// usage: node gridview.mjs <built glb> <out.png> [points json: [[name,[x,y,z]],...]]
// side view from +x (z right, y up) and top view (z right, x down), 1 cm grid fine, 5 cm bold, labelled
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { rasterize } from './raster.mjs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [f, out, ptsArg] = process.argv.slice(2);
const pts = ptsArg ? JSON.parse(ptsArg) : [];
const doc = await io.read(f);
const pos = [], col = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh || node.getExtras()?.lod) continue;
  const M = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const P = p.getAttribute('POSITION'), UV = p.getAttribute('TEXCOORD_0'), I = p.getIndices();
    const tex = p.getMaterial()?.getBaseColorTexture();
    let img = null, w = 0, h = 0;
    if (tex && UV) { const r = await sharp(Buffer.from(tex.getImage())).raw().ensureAlpha().toBuffer({ resolveWithObject: true }); img = r.data; w = r.info.width; h = r.info.height; }
    const n = I ? I.getCount() : P.getCount();
    const a = [0,0,0], uv=[0,0];
    for (let t = 0; t < n / 3; t++) for (let k = 0; k < 3; k++) {
      const i = I ? I.getScalar(t * 3 + k) : t * 3 + k;
      P.getElement(i, a);
      pos.push(M[0]*a[0]+M[4]*a[1]+M[8]*a[2]+M[12], M[1]*a[0]+M[5]*a[1]+M[9]*a[2]+M[13], M[2]*a[0]+M[6]*a[1]+M[10]*a[2]+M[14]);
      if (img) { UV.getElement(i, uv); const px = Math.min(w-1, Math.max(0, Math.floor(uv[0]*w))), py = Math.min(h-1, Math.max(0, Math.floor(uv[1]*h))); const o = (py*w+px)*4; col.push((img[o]/255)**2.2, (img[o+1]/255)**2.2, (img[o+2]/255)**2.2); }
      else col.push(0.6,0.6,0.6);
    }
  }
}
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
for (let i=0;i<pos.length;i+=3) for (let k=0;k<3;k++){mn[k]=Math.min(mn[k],pos[i+k]);mx[k]=Math.max(mx[k],pos[i+k]);}
console.log('bounds', mn.map(v=>v.toFixed(3)), mx.map(v=>v.toFixed(3)));
const W = 1600, pad = 0.03;
const views = [
  // side: view from +x: yaw -90 → screen x = z, y = y
  { name: 'side', yaw: -90, pitch: 0, sx: (p) => p[2], sy: (p) => p[1], fr: [mn[2]-pad, mn[1]-pad, mx[2]+pad, mx[1]+pad] },
  // top: yaw -90 pitch 90: screen x = z, screen y = ... (approx -x)
  { name: 'top', yaw: -90, pitch: 89.99, sx: (p) => p[2], sy: (p) => -p[0], fr: [mn[2]-pad, -mx[0]-pad, mx[2]+pad, -mn[0]+pad] },
];
const tiles = [];
let top = 0;
for (const v of views) {
  const fw = v.fr[2]-v.fr[0], fh = v.fr[3]-v.fr[1];
  const H = Math.round(W * fh / fw);
  const r = rasterize(new Float32Array(pos), new Float32Array(col), { width: W, height: H, yaw: v.yaw, pitch: v.pitch, frame: v.fr, background: [235,235,240] });
  const X = (x) => (x - r.frame[0]) / (r.frame[2]-r.frame[0]) * W, Y = (y) => H - (y - r.frame[1]) / (r.frame[3]-r.frame[1]) * H;
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for (let c = Math.ceil(r.frame[0]*100); c <= r.frame[2]*100; c++) svg += `<line x1="${X(c/100)}" y1="0" x2="${X(c/100)}" y2="${H}" stroke="${c%5?'#00000022':'#d0000088'}" stroke-width="1"/>` + (c%5?'':`<text x="${X(c/100)+2}" y="12" font-size="11" fill="#c00">${c}</text>`);
  for (let c = Math.ceil(r.frame[1]*100); c <= r.frame[3]*100; c++) svg += `<line x1="0" y1="${Y(c/100)}" x2="${W}" y2="${Y(c/100)}" stroke="${c%5?'#00000022':'#0000d088'}" stroke-width="1"/>` + (c%5?'':`<text x="2" y="${Y(c/100)-2}" font-size="11" fill="#00c">${c}</text>`);
  for (const [n, p] of pts) svg += `<circle cx="${X(v.sx(p))}" cy="${Y(v.sy(p))}" r="5" fill="none" stroke="#0a0" stroke-width="2"/><text x="${X(v.sx(p))+6}" y="${Y(v.sy(p))-6}" font-size="13" fill="#070">${n}</text>`;
  svg += '</svg>';
  const tile = await sharp(Buffer.from(r.data), { raw: { width: W, height: H, channels: 4 } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  tiles.push({ input: tile, left: 0, top }); top += H + 10;
}
await sharp({ create: { width: W, height: top, channels: 4, background: '#fff' } }).composite(tiles).png().toFile(out);
console.log('ok', out);
