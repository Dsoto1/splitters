// Builds MapMaker's palette picture atlases: every shipped tile, prop and vehicle/turret, rendered
// from its real model by the game's own thumbnail renderer (frontend/modelThumbs.ts, through
// EditorApp.thumbFor), shrunk to small cells and packed into WebP sprite sheets, one per content
// source (editor/paletteCatalog.ts atlasGroup: `tiles-<style pack>`, `props-<content pack>`,
// `vehicles`), so two branches adding different packs write different files:
//   packages/client/public/thumbs/<atlas>.<hash>.webp   16 cells a row, transparent background
//   packages/client/public/thumbs/palette.json          the index: one line per atlas, sorted, with its
//                                                       file, rows, bytes, pack name (props, for search)
//                                                       and its pieces in cell order as [key, source hash]
// MapMaker loads an atlas the first time one of its pictures scrolls into view, and renders a
// picture at runtime only for a piece the atlas lacks. content:check fails when a shipped piece is
// missing or its model/definition changed since (the hash), so re-run this after adding or
// changing tiles, props or vehicles. A piece whose hash is unchanged keeps its picture (taken from
// whichever atlas held it, an older index format, or either side of a merge conflict in the index);
// atlases with no change keep their file as it is.
//
// Run against a built client being served (pnpm build, then vite preview):
//   pnpm --filter @tiletrigger/client exec vite preview --port 4799
//   node tools/content/build-palette-atlas.mjs http://localhost:4799 [--all]
// --all re-renders everything; ATLAS_JOBS=2 renders in two pages at once.
//   node tools/content/build-palette-atlas.mjs --offline
// renders nothing: rewrites the atlases from the pictures already made, or exits with code 3 (and
// lists them) when some piece needs rendering (pnpm content:rebuild then builds and serves the client).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { loadPropManifest } from './props-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/thumbs');
const MANIFEST = join(OUT, 'palette.json');
/** Cell size in the atlas, the size it is rendered at (supersampled), cells per row. */
const CELL = 80;
const RENDER = 160;
const COLS = 16;
const base = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'http://localhost:4799';
const all = process.argv.includes('--all');
const offline = process.argv.includes('--offline');
const JOBS = Number(process.env.ATLAS_JOBS ?? 1);
/** Pages are recycled after this many renders (each model stays loaded in the page). */
const PER_PAGE = 200;

/** Every piece with its group and source hash (shared with content:check). */
function paletteItems() {
  return JSON.parse(execFileSync(process.execPath, ['--experimental-transform-types', '--no-warnings', join(ROOT, 'tools/content/palette-items.ts')], { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
}

const items = paletteItems();
const CONFLICT = /^(<{7}|={7}|>{7}|\|{7})( |$)/;

/**
 * The atlases of the index on disk, as [{ name, file, cell, cols, items: [[key, hash], ...] }] (cell
 * order). Reads the per-atlas index (version 2), the older one-index-for-all format (version 1), and
 * an index git left with conflict markers (every atlas line of both sides: their files are both there,
 * as the hash in a file's name keeps them apart).
 */
function oldAtlases() {
  if (!existsSync(MANIFEST)) return [];
  const text = readFileSync(MANIFEST, 'utf8');
  if (text.split('\n').some((l) => CONFLICT.test(l))) {
    const list = [];
    for (const line of text.split('\n')) {
      const m = /^\s*("[^"]+"): (\{"file".*\}),?$/.exec(line);
      if (m) list.push({ name: JSON.parse(m[1]), cell: CELL, cols: COLS, ...JSON.parse(m[2]), conflicted: true });
    }
    return list;
  }
  const m = JSON.parse(text);
  if (m.version === 2) return Object.entries(m.atlases).map(([name, a]) => ({ name, cell: m.cell, cols: m.cols, ...a }));
  // Version 1: items { key: [atlas, cell, hash, pack] }.
  return Object.entries(m.atlases).map(([name, a]) => {
    const cells = Object.entries(m.items).filter(([, it]) => it[0] === name).sort((x, y) => x[1][1] - y[1][1]);
    return { name, file: a.file, cell: m.cell, cols: m.cols, items: cells.map(([key, it]) => [key, it[2]]) };
  });
}
const old = oldAtlases();

// Pack names for search: the content pack each prop atlas holds.
const propManifest = loadPropManifest();
const packName = (id) => {
  const pack = propManifest.packs[id];
  return pack ? `${pack.title.replace(/^FREE - /, '')} (${pack.creator})` : undefined;
};

const groups = new Map();
for (const it of items) {
  if (!groups.has(it.group)) groups.set(it.group, []);
  groups.get(it.group).push(it);
}

/** The old atlas a group keeps as it is: same pieces, order and hashes, file still there (null: write it afresh). */
function kept(group, list) {
  if (all) return null;
  return (
    old.find(
      (a) => a.name === group && a.items.length === list.length && existsSync(join(OUT, a.file)) && list.every((it, i) => a.items[i][0] === it.key && a.items[i][1] === it.hash),
    ) ?? null
  );
}

/** Cells (raw RGBA) of every old atlas, by `key@hash`, for pieces whose hash hasn't changed (whichever atlas held them). */
async function oldCells() {
  const cells = new Map();
  if (all) return cells;
  for (const a of old) {
    if (a.cell !== CELL || !existsSync(join(OUT, a.file))) continue;
    const { data, info } = await sharp(join(OUT, a.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    a.items.forEach(([key, hash], i) => {
      if (cells.has(`${key}@${hash}`)) return;
      const cell = Buffer.alloc(CELL * CELL * 4);
      const x0 = (i % a.cols) * CELL;
      const y0 = Math.floor(i / a.cols) * CELL;
      for (let y = 0; y < CELL; y++) data.copy(cell, y * CELL * 4, ((y0 + y) * info.width + x0) * 4, ((y0 + y) * info.width + x0 + CELL) * 4);
      cells.set(`${key}@${hash}`, cell);
    });
  }
  return cells;
}

const cells = new Map();
const todo = [];
const reuse = [...groups].every(([g, list]) => kept(g, list)) ? new Map() : await oldCells();
for (const [group, list] of groups) {
  if (kept(group, list)) continue;
  for (const it of list) {
    const c = reuse.get(`${it.key}@${it.hash}`);
    if (c) cells.set(it.key, c);
    else todo.push(it);
  }
}

if (offline && todo.length) {
  console.error(`${todo.length} palette pictures need rendering: ${todo.slice(0, 8).map((it) => it.key).join(', ')}${todo.length > 8 ? ` and ${todo.length - 8} more` : ''}`);
  process.exit(3);
}
console.log(`${items.length} pieces in ${groups.size} groups; rendering ${todo.length}`);
const failed = [];
if (todo.length) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let done = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const batch = queue.splice(0, PER_PAGE);
      const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
      const page = await context.newPage();
      await page.goto(`${base}/?mode=editor`);
      await page.waitForFunction(() => window.__editor, null, { timeout: 120000 });
      for (const it of batch) {
        const url = await page
          .evaluate(
            ([key, size]) => Promise.race([window.__editor.thumbFor(key, size), new Promise((_, no) => setTimeout(() => no(new Error('timed out')), 60000))]),
            [it.key, RENDER],
          )
          .catch((e) => (console.error(`  ${it.key}: ${e.message.split('\n')[0]}`), null));
        if (!url) {
          failed.push(it.key);
          continue;
        }
        const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        cells.set(it.key, await sharp(png).resize(CELL, CELL, { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer());
        if (++done % 50 === 0) console.log(`  ${done}/${todo.length}`);
      }
      await context.close();
    }
  };
  await Promise.all(Array.from({ length: JOBS }, worker));
  await browser.close();
}

mkdirSync(OUT, { recursive: true });
const atlases = {};
let total = 0;
for (const [group, list] of [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  let file;
  let bytes;
  const keep = kept(group, list);
  if (keep) {
    file = keep.file;
    bytes = readFileSync(join(OUT, file)).length;
  } else {
    const present = list.filter((it) => cells.has(it.key));
    const rows = Math.ceil(present.length / COLS);
    const buf = await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(present.map((it, i) => ({ input: cells.get(it.key), raw: { width: CELL, height: CELL, channels: 4 }, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL })))
      .webp({ quality: 78, alphaQuality: 70, effort: 6, smartSubsample: true })
      .toBuffer();
    file = `${group}.${createHash('sha256').update(buf).digest('hex').slice(0, 10)}.webp`;
    bytes = buf.length;
    writeFileSync(join(OUT, file), buf);
    list.splice(0, list.length, ...present);
  }
  const pack = group.startsWith('props-') ? packName(group.slice(6)) : undefined;
  atlases[group] = { file, rows: Math.ceil(list.length / COLS), bytes, ...(pack ? { pack } : {}), items: list.map((it) => [it.key, it.hash]) };
  total += bytes;
  console.log(`${group.padEnd(44)} ${String(list.length).padStart(4)} pieces  ${COLS * CELL}×${Math.ceil(list.length / COLS) * CELL}  ${(bytes / 1024).toFixed(0).padStart(4)} KB  ${file}`);
}
const keepFiles = new Set(Object.values(atlases).map((a) => a.file));
for (const f of readdirSync(OUT)) if (f.endsWith('.webp') && !keepFiles.has(f)) rmSync(join(OUT, f));
writeFileSync(MANIFEST, formatIndex({ version: 2, cell: CELL, cols: COLS, atlases }));
console.log(`total ${(total / 1024).toFixed(0)} KB in ${groups.size} atlases; index ${(readFileSync(MANIFEST).length / 1024).toFixed(0)} KB`);
if (failed.length) {
  console.error(`${failed.length} pieces failed to render: ${failed.join(', ')}`);
  process.exit(1);
}

/** The index's text: one line per atlas (sorted), so branches that change different atlases change different lines. */
function formatIndex(m) {
  const lines = Object.entries(m.atlases).map(([name, a]) => `    ${JSON.stringify(name)}: ${JSON.stringify(a)}`);
  return `{\n  "version": ${m.version},\n  "cell": ${m.cell},\n  "cols": ${m.cols},\n  "atlases": {\n${lines.join(',\n')}\n  }\n}\n`;
}
