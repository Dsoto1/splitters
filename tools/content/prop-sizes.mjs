// Real-world sizes of furniture and everyday props (docs/CONTENT_PIPELINE.md, "Real-world sizes"): each piece's
// functional size measured from its built model, against the reference for its kind (tools/content/furniture.mjs).
// A chair is judged by its seat, a table by its top, a bed by its mattress, a fridge or a bookcase by its height: the
// seat and the top are the largest upward-facing area in the band of the model's height where they sit, not the
// bounding box (a tall back over a small, low seat reads as a child's chair beside a 1.8 m body).
//
//   node tools/content/prop-sizes.mjs          the table: each prop's kind, height, the measured seat or top, the
//                                              reference, the height that would bring it there, its width then, and
//                                              how the maps place it (count, mean instance scale)
//   node tools/content/prop-sizes.mjs --json   the same as JSON
//   PACKS=<pack ids> or ONLY=<prop ids> limits it.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { furnitureKind, isFurniture, REFERENCES } from './furniture.mjs';
import { loadPropManifest } from './props-manifest.mjs';
import { sceneTriangles } from './voxel-collision.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
/** Height bins of the upward-facing area (metres). */
const BIN = 0.01;
/** A face counts as upward-facing when its normal is within this of straight up (cosine). */
const UP = 0.9;

/** The model's upward-facing area by height: Float64Array of m² per BIN, and the model's height. */
function upwardArea(tris) {
  let top = 0;
  for (const t of tris) for (const p of t) top = Math.max(top, p[1]);
  const bins = new Float64Array(Math.ceil(top / BIN) + 2);
  for (const [a, b, c] of tris) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n);
    if (!len || n[1] / len < UP) continue;
    const y = (a[1] + b[1] + c[1]) / 3;
    bins[Math.max(0, Math.min(bins.length - 1, Math.round(y / BIN)))] += len / 2;
  }
  return { bins, top };
}

/** The height (metres) of the largest upward-facing area between lo and hi (shares of the model's height). */
export function functionalPlane(tris, [lo, hi]) {
  const { bins, top } = upwardArea(tris);
  let best = -1;
  let at = null;
  for (let i = Math.floor((lo * top) / BIN); i <= Math.ceil((hi * top) / BIN) && i < bins.length; i++) {
    // A seat or a top is a few faces at about one height: neighbouring bins count with it.
    const area = (bins[i - 1] ?? 0) + bins[i] + (bins[i + 1] ?? 0);
    if (area > best + 1e-9) [best, at] = [area, i * BIN];
  }
  return best > 0 ? { y: at, area: best } : null;
}

/** Each furniture prop: its kind, size, the measure, the reference and the height that would meet it. */
export async function measure({ only = null, packs = null } = {}) {
  const manifest = loadPropManifest();
  const table = readFileSync(join(ROOT, 'packages/shared/src/content/props.generated.ts'), 'utf8');
  const body = table.slice(table.indexOf('CORE_PROPS: readonly PropDefinition[] = [') + 'CORE_PROPS: readonly PropDefinition[] = '.length, table.lastIndexOf('];') + 1);
  const defs = new Map(new Function(`return ${body}`)().map((d) => [d.id, d]));
  // Every placement on the maps: how many, and at what instance scales.
  const placed = {};
  for (const f of readdirSync(join(ROOT, 'maps'))) {
    if (!f.endsWith('.json')) continue;
    for (const e of JSON.parse(readFileSync(join(ROOT, 'maps', f), 'utf8')).entities ?? []) if (e.kind === 'prop') (placed[e.model] ??= []).push(e.scale ?? 1);
  }
  const rows = [];
  for (const p of manifest.props) {
    if (only ? !only.includes(p.id) : !isFurniture(p) || (packs && !packs.includes(p.pack))) continue;
    const def = defs.get(`prop.${p.id}`);
    if (!def) continue;
    const kind = furnitureKind(p);
    const ref = kind ? REFERENCES[kind] : null;
    const doc = await io.read(join(ROOT, 'packages/client/public', def.file));
    const tris = sceneTriangles(doc.getRoot().listScenes()[0]);
    const [w, h, d] = def.size;
    let measured = null;
    if (ref?.measure === 'height') measured = h;
    else if (ref) measured = functionalPlane(tris, ref.band)?.y ?? null;
    const factor = measured ? ref.at / measured : null;
    const scales = placed[def.id] ?? [];
    rows.push({
      id: p.id,
      pack: p.pack,
      name: p.name,
      kind,
      size: def.size,
      entry: p.height !== undefined ? { height: p.height } : { scale: p.scale ?? manifest.packs[p.pack]?.scale ?? 1 },
      measured,
      reference: ref?.at ?? null,
      factor: factor && Math.round(factor * 1000) / 1000,
      height: factor ? Math.round(h * factor * 1000) / 1000 : null,
      width: factor ? Math.round(w * factor * 1000) / 1000 : w,
      depth: factor ? Math.round(d * factor * 1000) / 1000 : d,
      placed: scales.length,
      meanScale: scales.length ? Math.round((scales.reduce((a, b) => a + b, 0) / scales.length) * 100) / 100 : null,
    });
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = await measure({ only: process.env.ONLY?.split(',').filter(Boolean) ?? null, packs: process.env.PACKS?.split(',').filter(Boolean) ?? null });
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else {
    const f = (v, n = 2) => (v === null || v === undefined ? '-' : v.toFixed(n));
    for (const r of rows) {
      const narrow = (r.kind === 'chair' || r.kind === 'office_chair') && r.width < 0.42 ? '  NARROW SEAT' : '';
      console.log(`${r.id.padEnd(28)} ${(r.kind ?? '-').padEnd(12)} h ${f(r.size[1])} ${(REFERENCES[r.kind]?.measure ?? '').padEnd(6)} ${f(r.measured)} -> ${f(r.reference)}  ×${f(r.factor, 3)}  h ${f(r.height)} w ${f(r.width)}  placed ${r.placed}${r.placed ? ` (mean scale ${r.meanScale})` : ''}${narrow}`);
    }
  }
}
