// Per-pack material atlases for placed props (docs/PERF_PROPS_2026-11-23.md; docs/CONTENT_PIPELINE.md, "Prop material
// atlases"). A prop from a pack that paints each part one flat colour (the household items: a material per colour,
// the cupboard sink three of them) was a draw per material in every square it stood in. Here, at build time:
//
//   - every flat-colour material's colour goes into the vertices it paints (COLOR_0, three floats, multiplied into
//     any colour already there), and the material keeps white in its place (its alpha, roughness, metalness,
//     emission, culling and surface stay as they were): the same colour on screen, from the vertices;
//   - each material is given its pack's atlas key, `extras.atlas = "<pack>/<kind>"`, where the kind is a hash of
//     everything the material draws with apart from that colour: alpha and how it is used, both sides or not,
//     roughness, metalness, emission, extensions, the surface's detail map (content/propSurfaces.ts) and, for a
//     textured material, its textures' pixels, sampler and coordinates. Every material of a pack with the same key
//     draws the same way, so the game shares one material between them (content/models.ts, `?perfoff=propatlas`): a
//     prop is a draw per kind, not per colour, and props of a pack sharing a key can be merged into one draw where
//     they stand together (game/propBatches.ts, `?perfoff=propmerge`).
//
// Textured materials keep their pictures and coordinates (no repacking: a texture's coordinates may repeat, which an
// atlas cell would break): they only get the key, so the Kenney kits' shared colour map is one material for every
// prop of the pack that uses it with the same surface. The materials stay separate in the file (each keeps its name
// and, in `extras.atlasColor`, the colour it had), so a model drawn with `?perfoff=propatlas` draws exactly as before.
// `skip` names materials left alone (a fire prop's own flame, which the game hides by its material's name).

import { createHash } from 'node:crypto';

/** Bumped when the atlas changes what it writes (a prop atlased by an older version is atlased again). */
export const ATLAS_VERSION = 1;

const round = (v) => Math.round(v * 1e5) / 1e5;
const hash = (v) => createHash('sha256').update(typeof v === 'string' || v instanceof Uint8Array ? v : JSON.stringify(v)).digest('hex').slice(0, 10);

/** Whether a material draws any picture (a flat-colour material doesn't). */
function textured(mat) {
  return !!(mat.getBaseColorTexture() || mat.getNormalTexture() || mat.getMetallicRoughnessTexture() || mat.getOcclusionTexture() || mat.getEmissiveTexture());
}

/** Whether every material of the document already carries this version's atlas key (or was left alone on purpose). */
export function isAtlased(doc) {
  const mats = doc.getRoot().listMaterials();
  return mats.length > 0 && mats.every((m) => m.getExtras()?.atlasVersion === ATLAS_VERSION);
}

/** A texture slot's identity: the picture's pixels, its sampler and its coordinates. */
function slot(info, tex) {
  if (!tex) return null;
  return {
    image: hash(tex.getImage() ?? new Uint8Array()),
    type: tex.getMimeType(),
    texCoord: info?.getTexCoord() ?? 0,
    wrap: info ? [info.getWrapS(), info.getWrapT()] : null,
    filter: info ? [info.getMinFilter(), info.getMagFilter()] : null,
  };
}

/**
 * The kind of a material: everything it draws with but a flat material's colour (which moves to the vertices).
 * Two materials of a pack with the same kind draw the same way.
 */
export function materialKind(mat) {
  const flat = !textured(mat);
  const extras = { ...(mat.getExtras() ?? {}) };
  for (const k of ['atlas', 'atlasColor', 'atlasVersion']) delete extras[k];
  const base = mat.getBaseColorFactor();
  return {
    // A flat material's colour is in its vertices; a textured one's factor tints its picture, so it stays in the kind.
    color: flat ? [round(base[3])] : base.map(round),
    alphaMode: mat.getAlphaMode(),
    alphaCutoff: mat.getAlphaMode() === 'MASK' ? round(mat.getAlphaCutoff()) : null,
    doubleSided: mat.getDoubleSided(),
    metallic: round(mat.getMetallicFactor()),
    roughness: round(mat.getRoughnessFactor()),
    emissive: mat.getEmissiveFactor().map(round),
    extensions: mat.listExtensions().map((e) => [e.extensionName, JSON.stringify(e.toJSON?.() ?? null)]).sort(),
    extras,
    textures: flat
      ? null
      : {
          base: slot(mat.getBaseColorTextureInfo(), mat.getBaseColorTexture()),
          normal: slot(mat.getNormalTextureInfo(), mat.getNormalTexture()),
          normalScale: mat.getNormalTexture() ? round(mat.getNormalScale()) : null,
          mr: slot(mat.getMetallicRoughnessTextureInfo(), mat.getMetallicRoughnessTexture()),
          occlusion: slot(mat.getOcclusionTextureInfo(), mat.getOcclusionTexture()),
          emissive: slot(mat.getEmissiveTextureInfo(), mat.getEmissiveTexture()),
        },
  };
}

/** The colours a vertex array becomes: `color` (linear RGB) times what it held (RGB or RGBA; none: white). */
export function bakeColours(count, color, before = null, components = 3) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) out[i * 3 + k] = color[k] * (before ? before[i * components + k] : 1);
  }
  return out;
}

const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/**
 * Linear colours as unsigned normalised values: 8 bits where every value shows within half a step of its own shade
 * once on screen (sRGB), else 16 bits (the near-blacks: 8 linear bits would lift a 0.003 to 0.004, two steps on
 * screen). Floats would cost three times the bytes of 8 bits.
 */
export function packColours(values) {
  let fine = true;
  for (let i = 0; i < values.length && fine; i++) {
    const c = Math.min(1, Math.max(0, values[i]));
    fine = Math.abs(srgb(Math.round(c * 255) / 255) - srgb(c)) * 255 < 0.5;
  }
  const scale = fine ? 255 : 65535;
  const out = fine ? new Uint8Array(values.length) : new Uint16Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, values[i])) * scale);
  return out;
}

/**
 * The vertices a primitive uses, as its own accessors (its indices renumbered): for a part whose vertex list is shared
 * with other parts. Only the vertices it draws are copied.
 */
export function ownVertices(doc, prim, users) {
  const idx = prim.getIndices();
  const count = prim.getAttribute('POSITION').getCount();
  const order = [];
  const remap = new Int32Array(count).fill(-1);
  const old = idx ? idx.getArray() : null;
  const n = old ? old.length : count;
  const next = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const v = old ? old[i] : i;
    if (remap[v] < 0) {
      remap[v] = order.length;
      order.push(v);
    }
    next[i] = remap[v];
  }
  for (const sem of prim.listSemantics()) {
    const a = prim.getAttribute(sem);
    const size = a.getElementSize();
    const src = a.getArray();
    const dst = new src.constructor(order.length * size);
    for (let i = 0; i < order.length; i++) for (let k = 0; k < size; k++) dst[i * size + k] = src[order[i] * size + k];
    const copy = doc.createAccessor().setType(a.getType()).setArray(dst).setNormalized(a.getNormalized()).setBuffer(a.getBuffer());
    prim.setAttribute(sem, copy);
    users.get(a)?.delete(prim);
    users.set(copy, new Set([prim]));
  }
  const indices = order.length > 65535 ? next : Uint16Array.from(next);
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(idx?.getBuffer() ?? prim.getAttribute('POSITION').getBuffer()));
}

/**
 * Give every material of `doc` (a prop of pack `packId`) its atlas key and move flat colours into the vertices.
 * Returns the number of kinds the prop's materials fall into, or null when nothing was done (no materials).
 */
export function applyAtlas(doc, packId, { skip = [] } = {}) {
  const root = doc.getRoot();
  const mats = root.listMaterials();
  if (!mats.length) return null;
  // Which primitives use each accessor: one shared by primitives of different materials is copied for each first.
  const users = new Map();
  const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
  for (const p of prims) {
    for (const a of p.listAttributes()) {
      let s = users.get(a);
      if (!s) users.set(a, (s = new Set()));
      s.add(p);
    }
  }
  const kinds = new Set();
  for (const mat of mats) {
    const extras = mat.getExtras() ?? {};
    if (extras.atlasVersion === ATLAS_VERSION) {
      if (extras.atlas) kinds.add(extras.atlas);
      continue;
    }
    if (skip.includes(mat.getName())) {
      mat.setExtras({ ...extras, atlasVersion: ATLAS_VERSION });
      continue;
    }
    const flat = !textured(mat);
    const base = mat.getBaseColorFactor();
    if (flat) {
      const color = [base[0], base[1], base[2]];
      for (const p of prims) {
        if (p.getMaterial() !== mat) continue;
        if (!p.getAttribute('POSITION')) continue;
        // Shared with another primitive (the household items' converter shares one vertex list between parts): this
        // part gets its own copy of the vertices it uses, so its colour doesn't paint the other's.
        if (p.listAttributes().some((a) => (users.get(a)?.size ?? 0) > 1)) ownVertices(doc, p, users);
        const was = p.getAttribute('COLOR_0');
        const count = p.getAttribute('POSITION').getCount();
        let before = null;
        let components = 3;
        if (was) {
          components = was.getElementSize();
          before = new Float32Array(count * components);
          const el = [];
          for (let i = 0; i < count; i++) {
            was.getElement(i, el);
            for (let k = 0; k < components; k++) before[i * components + k] = el[k];
          }
        }
        const colours = packColours(bakeColours(count, color, before, components));
        const acc = doc.createAccessor().setType('VEC3').setArray(colours).setNormalized(true).setBuffer(p.getAttribute('POSITION').getBuffer());
        p.setAttribute('COLOR_0', acc);
      }
      mat.setBaseColorFactor([1, 1, 1, base[3]]);
    }
    const kind = `${packId}/${hash(materialKind(mat))}`;
    kinds.add(kind);
    mat.setExtras({ ...extras, atlas: kind, atlasVersion: ATLAS_VERSION, ...(flat ? { atlasColor: base.slice(0, 3).map(round) } : {}) });
  }
  return kinds.size;
}
