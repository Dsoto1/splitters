#!/usr/bin/env node
// Disk clean-up for a crowded container (owner, 2026-11-18): finished git worktrees, their build output, and the
// /tmp compile caches. Lists by default; --yes removes. Prints the space freed.
//
//   node tools/dev/cleanup.mjs                 what it would remove, and how much
//   node tools/dev/cleanup.mjs --yes           remove it
//   node tools/dev/cleanup.mjs --min-age 6     leave worktrees used in the last 6 hours alone (default 2)
//
// A worktree goes only when all of these hold: it isn't the main checkout, the one you're in, or locked; `git status`
// shows nothing (no changes, no untracked files: uncommitted work is never touched); its commit is in origin/main
// or on a branch on origin (merged or pushed); and nobody has used it for --min-age hours (its index and HEAD
// unchanged), since another session may be working in it. Removal is `git worktree remove` without --force, so git
// refuses anything unclean as well. Build output (dist/, .vite/, e2e-artifacts/: all ignored, all rebuilt) goes
// from worktrees that stay but are idle as long. The caches: node-compile-cache and tsx-* in the temp directory.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (cwd, ...a) => spawnSync('git', a, { cwd, stdio: 'ignore' }).status === 0;

/** `git worktree list --porcelain` as [{ path, head, branch, locked, prunable, bare }]. */
export function parseWorktrees(text) {
  const out = [];
  let cur = null;
  for (const line of String(text).split('\n')) {
    if (line.startsWith('worktree ')) out.push((cur = { path: line.slice(9), head: null, branch: null, locked: false, prunable: false, bare: false }));
    else if (!cur) continue;
    else if (line.startsWith('HEAD ')) cur.head = line.slice(5);
    else if (line.startsWith('branch ')) cur.branch = line.slice(7).replace(/^refs\/heads\//, '');
    else if (line === 'bare') cur.bare = true;
    else if (line.startsWith('locked')) cur.locked = true;
    else if (line.startsWith('prunable')) cur.prunable = true;
  }
  return out;
}

/**
 * Should a worktree go? { remove, why }. `w`: { main, current, locked, dirty, merged, pushed, idleHours }.
 * Uncommitted work (dirty) always stays.
 */
export function worktreeVerdict(w, minAgeHours = 2) {
  if (w.main) return { remove: false, why: 'the main checkout' };
  if (w.current) return { remove: false, why: "you're in it" };
  if (w.locked) return { remove: false, why: 'locked' };
  if (w.dirty) return { remove: false, why: 'uncommitted work' };
  if (!w.merged && !w.pushed) return { remove: false, why: 'its commit is on no branch on origin (not pushed)' };
  if (w.idleHours < minAgeHours) return { remove: false, why: `used ${w.idleHours.toFixed(1)} h ago (another session may be in it)` };
  return { remove: true, why: w.merged ? 'clean, merged into main' : 'clean, pushed' };
}

/** Build output inside a checkout (ignored, rebuilt by pnpm build / e2e). */
export const BUILD_DIRS = ['dist', '.vite', 'e2e-artifacts', 'host-release'];

function sizeOf(p) {
  const r = spawnSync('du', ['-sb', p], { encoding: 'utf8' });
  return r.status === 0 ? Number(r.stdout.split('\t')[0]) || 0 : 0;
}

/** Build output folders under a checkout: its root and each packages/<name>. */
function buildDirs(wt) {
  const roots = [wt, ...(existsSync(join(wt, 'packages')) ? readdirSync(join(wt, 'packages')).map((p) => join(wt, 'packages', p)) : [])];
  return roots.flatMap((r) => BUILD_DIRS.map((d) => join(r, d))).filter((p) => existsSync(p));
}

const mb = (n) => `${(n / 1048576).toFixed(n >= 1048576 * 100 ? 0 : 1)} MB`;

function main(argv) {
  const yes = argv.includes('--yes');
  const i = argv.indexOf('--min-age');
  const minAge = i >= 0 ? Number(argv[i + 1]) : 2;
  if (!(minAge >= 0)) throw new Error('--min-age needs a number of hours');
  gitOk(ROOT, 'fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main');
  gitOk(ROOT, 'worktree', 'prune');
  const all = parseWorktrees(git(ROOT, 'worktree', 'list', '--porcelain'));
  const here = resolve(process.cwd());
  const now = Date.now();
  let freed = 0;
  const act = (what, bytes, fn) => {
    console.log(`${yes ? 'removing' : 'would remove'}  ${mb(bytes).padStart(9)}  ${what}`);
    if (yes && fn() !== false) freed += bytes;
    else if (!yes) freed += bytes;
  };
  all.forEach((w, n) => {
    if (w.bare || w.prunable || !existsSync(w.path)) return;
    const current = here === w.path || here.startsWith(`${w.path}/`);
    // Idle time first, and a status that doesn't refresh the index: reading must not make a worktree look used.
    const marks = ['index', 'HEAD', 'logs/HEAD'].map((f) => join(git(w.path, 'rev-parse', '--absolute-git-dir'), f)).filter(existsSync);
    const idleHours = (now - Math.max(0, ...marks.map((f) => statSync(f).mtimeMs))) / 3600000;
    const dirty = !current && n > 0 ? git(w.path, '--no-optional-locks', 'status', '--porcelain', '--untracked-files=normal') !== '' : false;
    const merged = !!w.head && gitOk(ROOT, 'merge-base', '--is-ancestor', w.head, 'origin/main');
    const pushed = !!w.head && git(ROOT, 'branch', '-r', '--contains', w.head).split('\n').some((b) => b.trim().startsWith('origin/'));
    const v = worktreeVerdict({ main: n === 0, current, locked: w.locked, dirty, merged, pushed, idleHours }, minAge);
    const name = `${w.path} (${w.branch ?? `detached ${String(w.head).slice(0, 8)}`})`;
    if (v.remove) {
      act(`worktree ${name}: ${v.why}`, sizeOf(w.path), () => {
        const r = spawnSync('git', ['worktree', 'remove', w.path], { cwd: ROOT, encoding: 'utf8' });
        if (r.status !== 0) console.log(`  kept: git said ${(r.stderr || '').trim()}`);
        return r.status === 0;
      });
      return;
    }
    console.log(`keeping              ${name}: ${v.why}`);
    // Build output in an idle checkout that stays (never in the one you're in, nor one in use).
    if (!current && idleHours >= minAge) for (const d of buildDirs(w.path)) act(`build output ${d}`, sizeOf(d), () => rmSync(d, { recursive: true, force: true }));
  });
  const tmp = tmpdir();
  for (const d of readdirSync(tmp).filter((n) => n === 'node-compile-cache' || /^tsx-\d+$/.test(n))) {
    const p = join(tmp, d);
    act(`cache ${p}`, sizeOf(p), () => rmSync(p, { recursive: true, force: true }));
  }
  console.log(`${yes ? 'Freed' : 'Would free'} ${mb(freed)}.${yes ? '' : ' Run again with --yes to remove it.'}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`cleanup: ${e.stderr?.toString() || e.message}`);
    process.exit(1);
  }
}
