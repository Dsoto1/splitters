// Trains resolve conflicts that are only in the shared notes (owner, 2026-11-18): HANDOFF.md and docs/QUEUE.md are
// edited by every session, so two green branches often clash there and nowhere else. tools/ci/train.mjs calls
// resolveDocConflict on each conflicted file when every conflicted file is one of DOC_FILES.
//
// The rule, per conflicting hunk (base = the merge base, ours = the candidate, theirs = the branch being merged):
// the candidate's side, plus the lines the branch added, when the branch only added lines there (the base's lines
// are all still in its side, in order). Lines the branch added that the candidate already has are not repeated.
// A hunk where the branch changed or removed a base line isn't a simple union: the whole file is left unresolved
// and the train stops and names the branch as before. Tested in tools/ci/test/docMerge.test.mjs.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The files a train may resolve by itself. */
export const DOC_FILES = ['HANDOFF.md', 'docs/QUEUE.md'];

const M = 13; // conflict marker size: longer than anything the notes contain
const OPEN = '<'.repeat(M);
const BASE = '|'.repeat(M);
const MID = '='.repeat(M);
const CLOSE = '>'.repeat(M);

/** Is `sub` a subsequence of `seq` (same order, gaps allowed)? */
function isSubsequence(sub, seq) {
  let i = 0;
  for (const line of seq) if (i < sub.length && line === sub[i]) i++;
  return i === sub.length;
}

/** The lines of `seq` that aren't part of `base` matched as a subsequence (the added lines, in order). */
function addedLines(base, seq) {
  const out = [];
  let i = 0;
  for (const line of seq) {
    if (i < base.length && line === base[i]) i++;
    else out.push(line);
  }
  return out;
}

/** One hunk resolved: the candidate's lines and the branch's additions, or null when it isn't a simple union. */
export function resolveHunk({ ours, base, theirs }) {
  if (!isSubsequence(base, theirs)) return null;
  const have = new Set(ours);
  const extra = addedLines(base, theirs).filter((l) => l.trim() === '' || !have.has(l));
  return [...ours, ...extra];
}

/**
 * A diff3-style merge result (markers of M characters, as `git merge-file --diff3 --marker-size=13` writes) with
 * every hunk resolved, or null when one can't be. Text outside the hunks is kept as is.
 */
export function resolveMerged(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith(OPEN)) {
      out.push(lines[i]);
      continue;
    }
    const part = { ours: [], base: [], theirs: [] };
    let where = 'ours';
    let closed = false;
    for (i++; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith(BASE) && where === 'ours') where = 'base';
      else if (l.startsWith(MID) && where === 'base') where = 'theirs';
      else if (l.startsWith(CLOSE) && where === 'theirs') {
        closed = true;
        break;
      } else if (l.startsWith(OPEN)) return null;
      else part[where].push(l);
    }
    if (!closed) return null;
    const r = resolveHunk(part);
    if (!r) return null;
    out.push(...r);
  }
  return out.join('\n');
}

/** Three versions of a file (base may be '' for none) merged and resolved by the rule, or null when it can't be. */
export function mergeDoc({ ours, base, theirs }) {
  const dir = mkdtempSync(join(tmpdir(), 'docmerge-'));
  try {
    const f = (n, t) => (writeFileSync(join(dir, n), t), join(dir, n));
    const r = spawnSync('git', ['merge-file', '-p', '--diff3', `--marker-size=${M}`, '-L', 'candidate', '-L', 'base', '-L', 'branch', f('ours', ours), f('base', base), f('theirs', theirs)], { encoding: 'utf8', maxBuffer: 64 << 20 });
    if (r.status < 0 || r.status === null || r.status > 127) return null;
    return r.status === 0 ? r.stdout : resolveMerged(r.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const show = (cwd, spec) => {
  const r = spawnSync('git', ['show', spec], { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
  return r.status === 0 ? r.stdout : null;
};

/**
 * In a worktree stopped mid-merge, resolve `file` (one of DOC_FILES) from its index stages and stage it. True when
 * resolved; false (nothing changed) when the file is missing a side or a hunk isn't a simple union.
 */
export function resolveDocConflict(cwd, file) {
  if (!DOC_FILES.includes(file)) return false;
  const ours = show(cwd, `:2:${file}`);
  const theirs = show(cwd, `:3:${file}`);
  if (ours === null || theirs === null) return false; // deleted on one side: not ours to decide
  const base = show(cwd, `:1:${file}`) ?? '';
  const merged = mergeDoc({ ours, base, theirs });
  if (merged === null) return false;
  writeFileSync(join(cwd, file), merged);
  execFileSync('git', ['add', '--', file], { cwd, stdio: 'ignore' });
  return true;
}
