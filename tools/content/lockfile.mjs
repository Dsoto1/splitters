// Lock files (content/*.lock.json) in one stable format, so parallel branches merge them line by line:
// the entries sorted by `file`, one entry per line. Two branches that add or rebuild different files
// change different lines; a branch that rebuilds the same file as another conflicts on that one line.
//
// readLock also reads a lock that still holds git's conflict markers: it keeps the entries of both
// sides (one per line, so each side's lines parse on their own), and where both sides list the same
// file, the entry whose sha256 matches the file on disk wins. `pnpm content:rebuild` uses this to
// settle a merge without anyone editing a lock by hand.
//
//   node tools/content/lockfile.mjs           rewrite every content/*.lock.json in the stable format (settling conflicts)
//   node tools/content/lockfile.mjs --check   fail if one isn't (content:check runs this check too)

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = join(ROOT, 'packages/client/public');
const CONFLICT = /^(<{7}|={7}|>{7}|\|{7})( |$)/m;
const byFile = (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0);

/** The lock's text in the stable format: top-level fields first (one line each), then `files` sorted by file, one per line. */
export function formatLock(lock) {
  const head = Object.entries(lock).filter(([k]) => k !== 'files');
  const files = [...(lock.files ?? [])].sort(byFile);
  const lines = head.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  lines.push(files.length ? `  "files": [\n${files.map((f) => `    ${JSON.stringify(f)}`).join(',\n')}\n  ]` : '  "files": []');
  return `{\n${lines.join(',\n')}\n}\n`;
}

export function writeLock(path, lock) {
  writeFileSync(path, formatLock(lock));
}

/** Short sha256 of a shipped file (as the locks record it), or null when it isn't there. */
function shippedSha(file) {
  const path = join(PUBLIC, file);
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16) : null;
}

/** Read a lock, settling git conflict markers left by a merge (see the top of this file). */
export function readLock(path) {
  const text = readFileSync(path, 'utf8');
  if (!CONFLICT.test(text)) return JSON.parse(text);
  const head = {};
  const entries = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/,$/, '');
    if (!line || CONFLICT.test(raw) || line === '{' || line === '}' || line === ']' || line === '"files": [') continue;
    if (line.startsWith('{')) {
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        throw new Error(`${path}: can't settle its merge conflict (an entry spans lines: resolve it by hand)`);
      }
      (entries.get(e.file) ?? entries.set(e.file, []).get(e.file)).push(e);
      continue;
    }
    const field = /^("[^"]+"): (.*)$/.exec(line);
    if (!field) throw new Error(`${path}: can't settle its merge conflict at "${line.slice(0, 60)}" (resolve it by hand)`);
    const key = JSON.parse(field[1]);
    const value = JSON.parse(field[2]);
    if (key in head && JSON.stringify(head[key]) !== JSON.stringify(value)) throw new Error(`${path}: both sides of the merge change "${key}" (resolve it by hand)`);
    head[key] = value;
  }
  const files = [];
  for (const [file, list] of entries) {
    const distinct = [...new Map(list.map((e) => [JSON.stringify(e), e])).values()];
    if (distinct.length === 1) {
      files.push(distinct[0]);
      continue;
    }
    const sha = shippedSha(file);
    const match = distinct.filter((e) => e.sha256 === sha);
    if (!match.length) throw new Error(`${path}: the merge has ${distinct.length} entries for ${file} and none matches the file on disk (rebuild it, then run pnpm content:rebuild)`);
    files.push(match[0]);
  }
  return { ...head, files };
}

/** Every content/*.lock.json. */
export const lockPaths = () => readdirSync(join(ROOT, 'content')).filter((f) => f.endsWith('.lock.json')).sort().map((f) => join(ROOT, 'content', f));

/** Locks not in the stable format (content:check). */
export function lockProblems() {
  const problems = [];
  for (const path of lockPaths()) {
    const text = readFileSync(path, 'utf8');
    const name = path.slice(ROOT.length + 1);
    if (CONFLICT.test(text)) problems.push(`${name}: has merge conflict markers (run pnpm content:rebuild)`);
    else if (formatLock(JSON.parse(text)) !== text) problems.push(`${name}: not in the stable lock format (run node tools/content/lockfile.mjs)`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const problems = lockProblems();
    for (const p of problems) console.error(`ERROR ${p}`);
    if (problems.length) process.exit(1);
    console.log('locks OK');
  } else {
    for (const path of lockPaths()) {
      const lock = readLock(path);
      const text = formatLock(lock);
      if (readFileSync(path, 'utf8') !== text) {
        writeFileSync(path, text);
        console.log(`wrote ${path.slice(ROOT.length + 1)}`);
      }
    }
  }
}
