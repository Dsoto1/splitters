// `pnpm test:changed`: vitest on what changed since the merge base with origin/main (vitest --changed), plus the
// unit tests that read a changed map file (maps/**/*.json). vitest follows imports, not files a test reads, so
// a map edit alone would otherwise run none of them. CI's plan runs every unit test for a map change anyway.
//
//   node tools/ci/testChanged.mjs [--base <ref>] [extra vitest args]
//
// A test reads a map when its source (or a test helper it imports) names `maps/<id>.json`, reads the maps/ folder
// (`maps/` then a quote, or `maps/${…}`), names the maps/rotations or maps/botsets folder, or uses the arena
// helpers (ARENA_PATH, loadArena: maps/phase0_arena.json). Tested in tools/ci/test/testChanged.test.mjs.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** Where unit tests live (vitest.config.ts's include). */
export const TEST_DIRS = ['packages/client/test', 'packages/server/test', 'packages/shared/test', 'packages/host/test', 'tools/ci/test', 'tools/content/test'];

function walk(dir, out = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|mjs|js)$/.test(n)) out.push(p);
  }
  return out;
}

/** Repo-relative path → source, for every file in the test folders (tests and their helpers). */
export function readTestSources(root = ROOT) {
  const out = {};
  for (const d of TEST_DIRS) for (const f of walk(join(root, d))) out[relative(root, f).split('\\').join('/')] = readFileSync(f, 'utf8');
  return out;
}

/** What a source reads from maps/: { any: reads the folder or a computed map, ids: maps it names, dirs: sub-folders }. */
export function mapReads(src) {
  const ids = new Set([...src.matchAll(/maps\/([A-Za-z0-9_-]+)\.json/g)].map((m) => m[1]));
  if (/\b(ARENA_PATH|loadArena)\b/.test(src)) ids.add('phase0_arena');
  const dirs = new Set([...src.matchAll(/maps\/(rotations|botsets|playlists)\b/g)].map((m) => m[1]));
  // Also `new URL('rotations/', mapsDir)`: a sub-folder of a maps/ folder variable.
  for (const m of src.matchAll(/['"`](rotations|botsets|playlists)\/['"`]/g)) dirs.add(m[1]);
  return { any: /maps\/(['"`]|\$\{)/.test(src), ids, dirs };
}

/**
 * The test files (repo-relative, sorted) a set of changed paths needs because they read changed map files.
 * `sources`: readTestSources(). A test inherits what the helper files it imports (`./name`) read.
 */
export function mapTestsFor(changed, sources) {
  const maps = changed.map((p) => /^maps\/(?:(rotations|botsets|playlists)\/)?([^/]+)\.json$/.exec(p)).filter(Boolean);
  const other = changed.some((p) => /^maps\//.test(p) && !/^maps\/(?:(rotations|botsets|playlists)\/)?[^/]+\.json$/.test(p));
  if (!maps.length && !other) return [];
  const reads = Object.fromEntries(Object.entries(sources).map(([f, src]) => [f, mapReads(src)]));
  const helperOf = (file, name) => Object.keys(sources).find((f) => f !== file && f.startsWith(file.slice(0, file.lastIndexOf('/') + 1)) && f.slice(f.lastIndexOf('/') + 1).replace(/\.(ts|mjs|js)$/, '') === name);
  const hits = [];
  for (const [file, src] of Object.entries(sources)) {
    if (!/\.test\.(ts|mjs|js)$/.test(file)) continue;
    const r = [reads[file]];
    for (const m of src.matchAll(/from ['"]\.\/([A-Za-z0-9_-]+)(?:\.(?:ts|mjs|js))?['"]/g)) {
      const h = helperOf(file, m[1]);
      if (h && !/\.test\./.test(h)) r.push(reads[h]);
    }
    const needs = other || r.some((x) => x.any) || maps.some(([, dir, id]) => r.some((x) => (dir ? x.dirs.has(dir) : x.ids.has(id))));
    if (needs) hits.push(file);
  }
  return hits.sort();
}

function changedFiles(base) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
  let mergeBase;
  try {
    mergeBase = git('merge-base', 'HEAD', base);
  } catch {
    return null;
  }
  const files = new Set();
  for (const out of [git('diff', '--name-only', mergeBase, 'HEAD'), git('diff', '--name-only', 'HEAD'), git('ls-files', '--others', '--exclude-standard')]) for (const f of out.split('\n')) if (f) files.add(f);
  return [...files];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--base');
  const base = i >= 0 ? argv.splice(i, 2)[1] : 'origin/main';
  const run = (args) => spawnSync('pnpm', ['exec', 'vitest', 'run', ...args], { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
  let status = run(['--changed', base, ...argv]);
  const changed = changedFiles(base);
  const extra = changed === null ? [] : mapTestsFor(changed, readTestSources());
  if (extra.length) {
    console.log(`\nMaps changed: also the ${extra.length} unit test files that read them:\n  ${extra.join('\n  ')}\n`);
    status = run([...extra, ...argv]) || status;
  }
  process.exit(status);
}
