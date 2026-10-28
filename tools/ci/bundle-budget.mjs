// The menu's first JavaScript, against a budget: what a first visit must download and run before it can draw
// the main menu (index.html's entry script and everything it imports statically, i.e. its modulepreloads).
// The game, MapMaker, Character Designer, maps and physics load later, on demand (docs/LOADING.md), so a
// static import that drags one of them back into the first load fails this check.
//   node tools/ci/bundle-budget.mjs [dist dir]      (after pnpm build; default packages/client/dist)
// Sizes are gzip level 6, as the hub serves them (packages/server/src/site.ts). BUDGET_GZIP_KB / BUDGET_RAW_KB
// override the budgets; raise them on purpose, in the same commit as the change that needs it.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Budgets, a little above the first JS as of the loading split (0.3.x: 740 kB gzipped, 2.68 MB raw). */
const BUDGET_GZIP_KB = Number(process.env.BUDGET_GZIP_KB ?? 800);
const BUDGET_RAW_KB = Number(process.env.BUDGET_RAW_KB ?? 2900);

const dist = process.argv[2] ?? 'packages/client/dist';
const html = join(dist, 'index.html');
if (!existsSync(html)) {
  console.error(`bundle-budget: ${html} not found (run pnpm build first)`);
  process.exit(2);
}
const page = readFileSync(html, 'utf8');
const entry = /<script type="module"[^>]*\ssrc="([^"]+)"/.exec(page)?.[1];
if (!entry) {
  console.error('bundle-budget: no module entry script in index.html');
  process.exit(2);
}
/** A URL in the page or a chunk as a file under dist (Vite's base may be a path or ./). */
const fileOf = (url, from = '/') => {
  const path = url.startsWith('/') ? url : posix.join(posix.dirname(from), url);
  return join(dist, posix.normalize(path).replace(/^(\.\.\/)+/, '').replace(/^\//, ''));
};

// The entry and its static imports, transitively (dynamic import() calls are left out: they load on demand).
const STATIC_IMPORT = /(?:^|[;\n}])\s*import\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+\.js)["']/g;
const first = new Map();
const todo = [entry.startsWith('/') ? entry : `/${entry.replace(/^\.\//, '')}`];
while (todo.length) {
  const url = todo.pop();
  if (first.has(url)) continue;
  const file = fileOf(url);
  const code = readFileSync(file);
  first.set(url, { raw: code.length, gzip: gzipSync(code, { level: 6 }).length });
  for (const m of code.toString('utf8').matchAll(STATIC_IMPORT)) todo.push(posix.join(posix.dirname(url), m[1]));
}
// Vite lists the same set as modulepreloads: a mismatch means this check no longer sees what the browser fetches.
const preloads = [...page.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => (m[1].startsWith('/') ? m[1] : `/${m[1].replace(/^\.\//, '')}`));
const missing = preloads.filter((p) => !first.has(p));

const kb = (n) => (n / 1000).toFixed(1);
const rows = [...first].sort((a, b) => b[1].raw - a[1].raw);
const raw = rows.reduce((a, [, s]) => a + s.raw, 0);
const gzip = rows.reduce((a, [, s]) => a + s.gzip, 0);
console.log(`The menu's first JS (${dirname(html)}): ${rows.length} files`);
for (const [url, s] of rows) console.log(`  ${kb(s.raw).padStart(9)} kB  ${kb(s.gzip).padStart(8)} kB gzip  ${url}`);
console.log(`  ${kb(raw).padStart(9)} kB  ${kb(gzip).padStart(8)} kB gzip  total (budget ${BUDGET_RAW_KB} kB, ${BUDGET_GZIP_KB} kB gzip)`);
let ok = true;
if (missing.length) {
  console.error(`bundle-budget: index.html preloads files the import scan missed: ${missing.join(', ')}`);
  ok = false;
}
if (gzip / 1000 > BUDGET_GZIP_KB || raw / 1000 > BUDGET_RAW_KB) {
  console.error(`bundle-budget: over budget. Something the menu doesn't draw is imported statically on the way to it: make it a dynamic import() at the mode switch that needs it (docs/LOADING.md).`);
  ok = false;
}
process.exit(ok ? 0 : 1);
