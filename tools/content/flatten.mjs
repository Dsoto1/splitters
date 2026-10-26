// Replace a model's colour textures with one flat colour per triangle (vertex
// colours), sampled from the texture under it. Used for packs whose models
// are free to use but whose textures are photos from third-party sites
// (Elbolillo's PSX sets): only the geometry ships, plus a few colours per
// face read off the photo, never the image itself.
import { unweld } from '@gltf-transform/functions';
import sharp from 'sharp';

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Decode an image to { w, h, px } (RGBA bytes). */
async function decode(bytes) {
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, px: data };
}

/** Average linear colour of the texture round a UV point (a 3 × 3 texel box, wrapping). */
function sample(img, u, v) {
  const x = Math.floor((u - Math.floor(u)) * img.w);
  const y = Math.floor((v - Math.floor(v)) * img.h);
  const out = [0, 0, 0, 0];
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const i = ((((y + dy) % img.h) + img.h) % img.h) * img.w + ((((x + dx) % img.w) + img.w) % img.w);
      for (let k = 0; k < 3; k++) out[k] += srgbToLinear(img.px[i * 4 + k] / 255);
      out[3] += img.px[i * 4 + 3] / 255;
      n++;
    }
  return out.map((c) => c / n);
}

/**
 * Every primitive with a base colour texture gets COLOR_0 (one colour per
 * triangle: the mean of the texture at its corners and centre) and loses the
 * texture and its UVs. Returns the number of textures removed.
 */
export async function flattenTextures(doc) {
  await doc.transform(unweld());
  const images = new Map();
  const buffer = doc.getRoot().listBuffers()[0];
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const tex = mat?.getBaseColorTexture();
      const uv = prim.getAttribute('TEXCOORD_0');
      if (!tex || !uv) continue;
      if (!images.has(tex)) images.set(tex, await decode(tex.getImage()));
      const img = images.get(tex);
      const uvs = uv.getArray();
      const n = prim.getAttribute('POSITION').getCount();
      const colours = new Float32Array(n * 4);
      for (let t = 0; t + 2 < n; t += 3) {
        const pts = [0, 1, 2].map((k) => [uvs[(t + k) * 2], uvs[(t + k) * 2 + 1]]);
        pts.push([(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3]);
        // Corners pulled a little toward the centre so seams don't bleed in.
        const c = [0, 0, 0, 0];
        for (const [i, p] of pts.entries()) {
          const q = i < 3 ? [p[0] * 0.7 + pts[3][0] * 0.3, p[1] * 0.7 + pts[3][1] * 0.3] : p;
          const s = sample(img, q[0], q[1]);
          for (let k = 0; k < 4; k++) c[k] += s[k] / 4;
        }
        for (let k = 0; k < 3; k++) colours.set(c, (t + k) * 4);
      }
      prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(colours).setBuffer(buffer));
      prim.setAttribute('TEXCOORD_0', null);
    }
  for (const mat of doc.getRoot().listMaterials()) {
    if (!mat.getBaseColorTexture()) continue;
    mat.setBaseColorTexture(null).setNormalTexture(null).setEmissiveTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null);
    // Cut-out textures (glass, leaves) become see-through glass or solid faces.
    if (mat.getAlphaMode() === 'MASK') mat.setAlphaMode('OPAQUE');
  }
  for (const t of doc.getRoot().listTextures()) t.dispose();
  return images.size;
}
