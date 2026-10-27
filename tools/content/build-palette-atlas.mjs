// Builds MapMaker's palette picture atlases: every shipped tile, prop and vehicle/turret, rendered
// from its real model by the game's own thumbnail renderer (frontend/modelThumbs.ts, through
// EditorApp.thumbFor), shrunk to small cells and packed into one WebP sprite sheet per palette group
// (editor/paletteCatalog.ts: tiles, vehicles, nature and the prop theme groups):
//   packages/client/public/thumbs/<group>.<hash>.webp   16 cells a row, transparent background
//   packages/client/public/thumbs/palette.json          key → [atlas, cell, source hash, pack]
// MapMaker loads an atlas the first time one of its pictures scrolls into view, and renders a
// picture at runtime only for a piece the atlas lacks. content:check fails when a shipped piece is
// missing or its model/definition changed since (the hash), so re-run this after adding or
// changing tiles, props or vehicles. Pieces whose hash is unchanged keep their cells; groups with
// no change keep their file as it is.
//
// Run against a built client being served (pnpm build, then vite preview):
//   pnpm --filter @tiletrigger/client exec vite preview --port 4799
//   node tools/content/build-palette-atlas.mjs http://localhost:4799 [--all]
// --all re-renders everything; ATLAS_JOBS=2 renders in two pages at once.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/thumbs');
const MANIFEST = join(OUT, 'palette.json');
/** Cell size in the atlas, the size it is rendered at (supersampled), cells per row. */
const CELL = 80;
const RENDER = 160;
const COLS = 16;
const base = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'http://localhost:4799';
const all = process.argv.includes('--all');
const JOBS = Number(process.env.ATLAS_JOBS ?? 1);
/** Pages are recycled after this many renders (each model stays loaded in the page). */
const PER_PAGE = 200;

/** Every piece with its group and source hash (shared with content:check). */
function paletteItems() {
  return JSON.parse(execFileSync(process.execPath, ['--experimental-transform-types', '--no-warnings', join(ROOT, 'tools/content/palette-items.ts')], { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
}

const items = paletteItems();
const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;

// Pack names for search: the content pack each prop comes from.
const propsJson = JSON.parse(readFileSync(join(ROOT, 'content/props.json'), 'utf8'));
const packNames = [];
const packOf = new Map();
for (const p of propsJson.props) {
  const pack = propsJson.packs[p.pack];
  if (!pack) continue;
  const name = `${pack.title.replace(/^FREE - /, '')} (${pack.creator})`;
  if (!packNames.includes(name)) packNames.push(name);
  packOf.set(`prop:prop.${p.id}`, packNames.indexOf(name));
}

const groups = new Map();
for (const it of items) {
  if (!groups.has(it.group)) groups.set(it.group, []);
  groups.get(it.group).push(it);
}

/** A group whose pieces, order and hashes are all as before keeps its file. */
function unchanged(group, list) {
  const a = old?.atlases?.[group];
  if (all || !a || a.count !== list.length || !existsSync(join(OUT, a.file))) return false;
  return list.every((it, i) => {
    const o = old.items[it.key];
    return o && o[0] === group && o[1] === i && o[2] === it.hash;
  });
}

/** Cells (raw RGBA) of an old atlas, for pieces whose hash hasn't changed. */
async function oldCells(group) {
  const a = old?.atlases?.[group];
  if (all || !a || !existsSync(join(OUT, a.file))) return new Map();
  const { data, info } = await sharp(join(OUT, a.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cells = new Map();
  for (const [key, o] of Object.entries(old.items)) {
    if (o[0] !== group) continue;
    const cell = Buffer.alloc(CELL * CELL * 4);
    const x0 = (o[1] % old.cols) * old.cell;
    const y0 = Math.floor(o[1] / old.cols) * old.cell;
    if (old.cell !== CELL) continue;
    for (let y = 0; y < CELL; y++) data.copy(cell, y * CELL * 4, ((y0 + y) * info.width + x0) * 4, ((y0 + y) * info.width + x0 + CELL) * 4);
    cells.set(`${key}@${o[2]}`, cell);
  }
  return cells;
}

const cells = new Map();
const todo = [];
for (const [group, list] of groups) {
  if (unchanged(group, list)) continue;
  const reuse = await oldCells(group);
  for (const it of list) {
    const c = reuse.get(`${it.key}@${it.hash}`);
    if (c) cells.set(it.key, c);
    else todo.push(it);
  }
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
const manifest = { version: 1, cell: CELL, cols: COLS, atlases: {}, items: {}, packs: packNames };
let total = 0;
for (const [group, list] of groups) {
  let file;
  let bytes;
  if (unchanged(group, list)) {
    file = old.atlases[group].file;
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
  list.forEach((it, i) => {
    const entry = [group, i, it.hash];
    if (packOf.has(it.key)) entry.push(packOf.get(it.key));
    manifest.items[it.key] = entry;
  });
  manifest.atlases[group] = { file, count: list.length, rows: Math.ceil(list.length / COLS), bytes };
  total += bytes;
  console.log(`${group.padEnd(12)} ${String(list.length).padStart(4)} pieces  ${COLS * CELL}×${Math.ceil(list.length / COLS) * CELL}  ${(bytes / 1024).toFixed(0).padStart(4)} KB  ${file}`);
}
const keep = new Set(Object.values(manifest.atlases).map((a) => a.file));
for (const f of readdirSync(OUT)) if (f.endsWith('.webp') && !keep.has(f)) rmSync(join(OUT, f));
writeFileSync(MANIFEST, `${JSON.stringify(manifest)}\n`);
console.log(`total ${(total / 1024).toFixed(0)} KB in ${groups.size} atlases; manifest ${(readFileSync(MANIFEST).length / 1024).toFixed(0)} KB`);
if (failed.length) {
  console.error(`${failed.length} pieces failed to render: ${failed.join(', ')}`);
  process.exit(1);
}
