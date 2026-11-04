// The placeable props, one file per content pack: content/props/<pack>.json (docs/CONTENT_PIPELINE.md,
// "Adding a prop pack"). Every tool that reads props reads them through here, so a new pack is a new
// file and two branches adding different packs touch different files.
//
// A pack file:
//   {
//     "pack": { "title", "creator", "url", "license", "licenseFile", ... },   what was packs[<pack>]
//     "order": 830,                                                            where its props sit in the prop table
//     "props": [ { "id", "src", "name", "category", ... }, ... ]               no `pack` field: the file names it
//   }
//
// The prop table (props.generated.ts, and so MapMaker's palette) lists the props by `order`, then pack
// id, then their place in the file. A prop may carry its own `order`: it and the props after it (until
// the next one with an `order`) sit there instead, which keeps a pack's props next to other packs' props
// of the same kind. Orders in a file only go up. A new pack takes a number above the others; two
// branches that pick the same one still give one order (by pack id) and never a merge conflict.
//
// content/props.json holds what all packs share: the budgets.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PROPS_DIR = join(ROOT, 'content/props');
export const PROPS_SETTINGS = join(ROOT, 'content/props.json');
const PACK_ID = /^[a-z0-9][a-z0-9-]*$/;

/** The pack files, by file name (pack id), as written: `{ id, pack, order, props }` (props without `pack`). */
export function readPropPacks(dir = PROPS_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const extra = readdirSync(dir).filter((f) => !f.endsWith('.json'));
  if (extra.length) throw new Error(`content/props: only <pack>.json files belong here (found ${extra.join(', ')})`);
  return files.map((f) => {
    const id = f.slice(0, -5);
    const where = `content/props/${f}`;
    if (!PACK_ID.test(id)) throw new Error(`${where}: a pack id is lower case letters, digits and dashes`);
    let data;
    try {
      data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`${where}: ${e.message}`);
    }
    const keys = Object.keys(data).filter((k) => !['$comment', 'pack', 'order', 'props'].includes(k));
    if (keys.length) throw new Error(`${where}: unknown fields ${keys.join(', ')} (a pack file holds pack, order and props)`);
    if (!data.pack || typeof data.pack !== 'object' || !data.pack.title || !data.pack.license || !data.pack.licenseFile) throw new Error(`${where}: pack must give at least title, license and licenseFile`);
    if (!Number.isFinite(data.order)) throw new Error(`${where}: order must be a number (where the pack's props sit in the prop table)`);
    if (!Array.isArray(data.props) || !data.props.length) throw new Error(`${where}: props must list the pack's props`);
    let order = data.order;
    for (const p of data.props) {
      if (!p || typeof p.id !== 'string') throw new Error(`${where}: every prop needs an id`);
      if ('pack' in p) throw new Error(`${where}: ${p.id} names a pack; the file is its pack`);
      if (p.order !== undefined) {
        if (!Number.isFinite(p.order)) throw new Error(`${where}: ${p.id}: order must be a number`);
        if (p.order < order) throw new Error(`${where}: ${p.id}: order ${p.order} is below the props before it (${order}); orders in a file only go up`);
        order = p.order;
      }
    }
    return { id, pack: data.pack, order: data.order, props: data.props };
  });
}

/**
 * Everything the prop tools read, in one object as the single content/props.json used to hold it:
 * `{ budgets, packs: { <id>: pack }, props: [{ id, pack: <id>, ... }] }`, props in prop-table order.
 */
export function loadPropManifest(dir = PROPS_DIR, settingsPath = PROPS_SETTINGS) {
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
  if (settings.props || settings.packs) throw new Error('content/props.json holds only the shared budgets now: move packs and props to content/props/<pack>.json (docs/CONTENT_PIPELINE.md, "Adding a prop pack")');
  const packFiles = readPropPacks(dir);
  const placed = [];
  for (const f of packFiles) {
    let order = f.order;
    f.props.forEach((p, i) => {
      if (p.order !== undefined) order = p.order;
      const { order: _, ...rest } = p;
      placed.push({ key: [order, f.id, i], prop: { id: rest.id, pack: f.id, ...rest } });
    });
  }
  placed.sort((a, b) => a.key[0] - b.key[0] || (a.key[1] < b.key[1] ? -1 : a.key[1] > b.key[1] ? 1 : 0) || a.key[2] - b.key[2]);
  const props = placed.map((x) => x.prop);
  const seen = new Map();
  for (const p of props) {
    if (seen.has(p.id)) throw new Error(`prop ${p.id} is in both content/props/${seen.get(p.id)}.json and content/props/${p.pack}.json`);
    seen.set(p.id, p.pack);
  }
  return { budgets: settings.budgets, packs: Object.fromEntries(packFiles.map((f) => [f.id, f.pack])), props };
}
