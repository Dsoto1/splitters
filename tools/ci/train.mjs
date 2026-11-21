#!/usr/bin/env node
// Batch landing: merge several green branches onto origin/main as one candidate, test it on a check branch,
// then fast-forward main to it once that run is green.
//
//   node tools/ci/train.mjs wip/a wip/b check/c    candidate from origin/main, each branch merged in that order,
//                                                  pushed to check/train-<UTC timestamp> (CI runs there)
//   node tools/ci/train.mjs --no-push wip/a ...    the same, without pushing (prints the candidate's sha)
//   node tools/ci/train.mjs --ready                which of QUEUE's "Ready to land" entries (on origin/main) GitHub
//                                                  confirms: the entry's run is completed+success for its sha and
//                                                  is its check branch's latest, the branch still at that sha
//                                                  (docs-only commits since are fine), not on main yet
//   node tools/ci/train.mjs --ready --run --holder X   the same, then a train of the landable ones, in list order
//   node tools/ci/train.mjs --land <sha> [--branch check/train-…]
//                                                  fast-forward main to <sha>, only if the latest CI run on its
//                                                  check/train-* branch is for <sha>, completed and successful,
//                                                  and origin/main is an ancestor of <sha>
//
// The landing lock (tools/ci/landingLock.mjs: the branch `landing-lock`): a train takes it as it starts and keeps it
// while its check runs; --land frees it once main is fast-forwarded; a train that stops before pushing (a conflict, a
// refusal) frees it. Every train and landing names its holder: --holder "<session>" or LANDING_LOCK_HOLDER.
//   node tools/ci/train.mjs --lock-status          who holds it, which train, for how long
//   node tools/ci/train.mjs --lock --holder X      take it for a landing by hand (merge, check, push main yourself)
//   node tools/ci/train.mjs --unlock --holder X    free it (only X's own)
//   node tools/ci/train.mjs --force-unlock --holder X   free anyone's lock held for 3 h or more (a warning is printed)
//
// A merge that conflicts only in HANDOFF.md and docs/QUEUE.md is resolved by itself (tools/ci/docMerge.mjs: the
// candidate's notes plus the lines the branch added, where that is a simple union); anything else stops the train
// and names the branch and files.
//
// It never force-pushes, never changes your checkout (the merges happen in a temporary worktree) and pushes
// only to check/train-* (new branches), main (a fast-forward) and landing-lock (a child commit). Tested in
// tools/ci/test/train.test.mjs and tools/ci/test/landingLock.test.mjs.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOC_FILES, resolveDocConflict } from './docMerge.mjs';
import { LockError, describeLock, freeLock, readLock, takeLock } from './landingLock.mjs';

// TRAIN_ROOT: another clone (the tests' scratch repositories).
const ROOT = process.env.TRAIN_ROOT || fileURLToPath(new URL('../../', import.meta.url));

/** A branch the train may merge: wip/… or check/… (an "origin/" prefix is fine). Null when not allowed. */
export function trainBranch(name) {
  const b = String(name).replace(/^origin\//, '');
  return /^(wip|check)\/[A-Za-z0-9._\/-]+$/.test(b) && !b.includes('..') ? b : null;
}

/** check/train-YYYYMMDD-HHMMSS (UTC). */
export function trainBranchName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `check/train-${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
}

/**
 * May main be fast-forwarded to `sha`? `run`: the latest CI run on the check branch (GitHub's workflow run
 * object, or null), `isAncestor`: whether origin/main is an ancestor of `sha`. Returns null (yes) or the reason.
 */
export function landRefusal({ sha, branch, run, isAncestor }) {
  if (!/^check\/train-/.test(branch ?? '')) return `${branch}: only check/train-* branches land`;
  if (!run) return `no CI run on ${branch} yet`;
  if (run.head_sha !== sha) return `the latest CI run on ${branch} is for ${String(run.head_sha).slice(0, 7)}, not ${sha.slice(0, 7)}`;
  if (run.status !== 'completed') return `the latest CI run on ${branch} is ${run.status}: wait for it (${run.html_url ?? ''})`;
  if (run.conclusion !== 'success') return `the latest CI run on ${branch} ended ${run.conclusion} (${run.html_url ?? ''})`;
  if (!isAncestor) return `origin/main is not an ancestor of ${sha.slice(0, 7)} (main moved: run the train again)`;
  return null;
}

/** owner/repo from a GitHub remote URL (https or ssh). */
export function repoSlug(url) {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * QUEUE's "Ready to land" entries: `- \`branch\` · sha · run (notes)`, in list order. An entry line that doesn't
 * read that way comes back with `error`.
 */
export function readyEntries(queue) {
  const lines = String(queue).split('\n');
  const start = lines.findIndex((l) => /^##\s+Ready to land\b/i.test(l));
  if (start < 0) return [];
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    if (!/^\s*-\s/.test(line)) continue;
    const m = /^\s*-\s+`([^`]+)`\s*·\s*([0-9a-f]{7,40})\s*·\s*(?:run\s+)?(\d{6,})/.exec(line);
    if (!m) {
      out.push({ line: line.trim(), error: 'not `branch` · sha · run' });
      continue;
    }
    const branch = trainBranch(m[1]);
    out.push(branch ? { branch, sha: m[2], run: Number(m[3]), line: line.trim() } : { line: line.trim(), error: `${m[1]}: not a wip/ or check/ branch` });
  }
  return out;
}

/**
 * May a Ready to land entry go in the next train? `run`: GitHub's run object for the entry's run id (or null),
 * `latest`: the latest push run on that run's branch, `tip`: the branch's sha on origin (null: gone), `onMain`:
 * the green sha is in origin/main already, `docsSince`: the commits from the green sha to the tip touch only docs.
 * Returns { ok, why }.
 */
export function readyVerdict({ entry, run, latest, tip, onMain, docsSince }) {
  const short = (s) => String(s ?? '').slice(0, 8);
  if (entry.error) return { ok: false, why: entry.error };
  if (!run) return { ok: false, why: `run ${entry.run} not found` };
  if (!String(run.head_sha).startsWith(entry.sha)) return { ok: false, why: `run ${entry.run} is for ${short(run.head_sha)}, not ${entry.sha}` };
  if (run.status !== 'completed') return { ok: false, why: `run ${entry.run} is ${run.status}` };
  if (run.conclusion !== 'success') return { ok: false, why: `run ${entry.run} ended ${run.conclusion}` };
  if (latest && latest.id !== run.id && latest.head_sha !== run.head_sha) return { ok: false, why: `${run.head_branch} has a newer run (${latest.id}, for ${short(latest.head_sha)}, ${latest.conclusion ?? latest.status})` };
  if (latest && latest.id === run.id && (latest.status !== 'completed' || latest.conclusion !== 'success')) return { ok: false, why: `run ${entry.run} was re-run and is now ${latest.conclusion ?? latest.status}` };
  if (onMain) return { ok: false, why: `${short(run.head_sha)} is on main already (landed: take it off the list)` };
  if (!tip) return { ok: false, why: `${entry.branch} is not on origin` };
  if (tip !== run.head_sha && !docsSince) return { ok: false, why: `${entry.branch} moved past the green sha to ${short(tip)} with code changes: check it again` };
  return { ok: true, why: `green on ${run.head_branch} (run ${run.id})${tip !== run.head_sha ? `; docs only since, at ${short(tip)}` : ''}` };
}

const git = (args, cwd = ROOT) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (args, cwd = ROOT) => spawnSync('git', args, { cwd, stdio: 'ignore' }).status === 0;
class TrainError extends Error {}
// Thrown, not exit(): the temporary worktree is removed on the way out.
const die = (msg) => {
  throw new TrainError(msg);
};

/** The time the lock sees (LANDING_LOCK_NOW: the tests' clock). */
const now = () => (process.env.LANDING_LOCK_NOW ? new Date(process.env.LANDING_LOCK_NOW) : new Date());
const lockCall = (fn) => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof LockError) die(e.message);
    throw e;
  }
};

function train(branches, { push, holder }) {
  const names = branches.map((b) => trainBranch(b) ?? die(`${b}: not a wip/ or check/ branch`));
  if (!names.length) die('name the branches to merge (wip/… or check/…)');
  if (!push) return candidate(names, { push });
  if (!holder) die('a train takes the landing lock: name yourself with --holder "<session>" (or LANDING_LOCK_HOLDER)');
  const branch = trainBranchName(now());
  const took = lockCall(() => takeLock(ROOT, { holder, train: branch, now: now() }));
  console.log(took.taken ? `Took the landing lock for ${branch}.` : `You hold the landing lock already (${branch}).`);
  try {
    candidate(names, { push, branch });
  } catch (e) {
    // Stopped before pushing: the lock goes back.
    lockCall(() => freeLock(ROOT, { holder, now: now() }));
    console.error('Freed the landing lock (the train stopped before pushing).');
    throw e;
  }
}

function candidate(names, { push, branch }) {
  git(['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main', ...names.map((b) => `+refs/heads/${b}:refs/remotes/origin/${b}`)]);
  const dir = mkdtempSync(join(tmpdir(), 'train-'));
  try {
    git(['worktree', 'add', '--quiet', '--detach', dir, 'origin/main']);
    console.log(`Candidate from origin/main (${git(['rev-parse', '--short', 'HEAD'], dir)})`);
    for (const b of names) {
      const r = spawnSync('git', ['merge', '--no-ff', '--no-edit', '-m', `Train: merge ${b}`, `origin/${b}`], { cwd: dir, encoding: 'utf8' });
      if (r.status !== 0) {
        const files = git(['diff', '--name-only', '--diff-filter=U'], dir).split('\n').filter(Boolean);
        // Only the shared notes: resolve them (the candidate's side plus the branch's added lines) and go on.
        const notesOnly = files.length > 0 && files.every((f) => DOC_FILES.includes(f));
        if (notesOnly && files.every((f) => resolveDocConflict(dir, f)) && gitOk(['commit', '--quiet', '--no-edit'], dir)) {
          console.log(`  merged ${b} (resolved ${files.join(', ')}: the candidate's notes plus ${b}'s added lines)`);
          continue;
        }
        gitOk(['merge', '--abort'], dir);
        die(files.length
          ? `${b} conflicts with the candidate (origin/main + ${names.slice(0, names.indexOf(b)).join(', ') || 'nothing yet'}) in:\n  ${files.join('\n  ')}\n${notesOnly ? '(only the notes, but not as a simple union of added lines: merge them by hand)\n' : ''}Merge origin/main (and the branches before it) into ${b}, re-check it, then run the train again.`
          : `merging ${b} failed:\n${r.stderr || r.stdout}`);
      }
      console.log(`  merged ${b}`);
    }
    const sha = git(['rev-parse', 'HEAD'], dir);
    if (!push) {
      console.log(`Candidate ${sha} (not pushed: --no-push)`);
      return;
    }
    // A new branch: a plain push (no force) fails rather than replace anything already there.
    git(['push', '--quiet', 'origin', `${sha}:refs/heads/${branch}`]);
    console.log(`Pushed ${sha.slice(0, 7)} to ${branch}: CI runs there. You hold the landing lock until it lands.\nWhen it's green: node tools/ci/train.mjs --land ${sha} --branch ${branch} --holder "<you>"\nIf it goes red: fix or drop a branch and run the train again (the lock stays yours), or --unlock.`);
  } finally {
    gitOk(['worktree', 'remove', '--force', dir]);
    rmSync(dir, { recursive: true, force: true });
  }
}

function latestRun(slug, branch) {
  const out = execFileSync('gh', ['api', `repos/${slug}/actions/workflows/ci.yml/runs?branch=${encodeURIComponent(branch)}&event=push&per_page=1`], { encoding: 'utf8' });
  return JSON.parse(out).workflow_runs?.[0] ?? null;
}

function getRun(slug, id) {
  const r = spawnSync('gh', ['api', `repos/${slug}/actions/runs/${id}`], { encoding: 'utf8' });
  return r.status === 0 ? JSON.parse(r.stdout) : null;
}

const slugOf = () => process.env.GH_REPO || repoSlug(git(['remote', 'get-url', 'origin'])) || die('cannot tell the GitHub repository from origin: set GH_REPO=owner/repo');

/** QUEUE's Ready to land entries (origin/main's copy), each confirmed or not from GitHub; prints them; returns the landable branches. */
function ready() {
  git(['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
  const entries = readyEntries(git(['show', 'origin/main:docs/QUEUE.md']));
  if (!entries.length) {
    console.log('QUEUE has nothing under "Ready to land".');
    return [];
  }
  const branches = [...new Set(entries.filter((e) => e.branch).map((e) => e.branch))];
  for (const b of branches) gitOk(['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${b}:refs/remotes/origin/${b}`]);
  const slug = slugOf();
  const landable = [];
  for (const entry of entries) {
    let v;
    if (entry.error) v = readyVerdict({ entry });
    else {
      const run = getRun(slug, entry.run);
      const latest = run?.head_branch ? latestRun(slug, run.head_branch) : null;
      const tip = gitOk(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${entry.branch}`]) ? git(['rev-parse', `refs/remotes/origin/${entry.branch}`]) : null;
      const sha = run?.head_sha;
      const known = sha && gitOk(['cat-file', '-e', `${sha}^{commit}`]);
      const onMain = !!known && gitOk(['merge-base', '--is-ancestor', sha, 'origin/main']);
      const changed = known && tip && tip !== sha ? git(['diff', '--name-only', sha, tip]).split('\n').filter(Boolean) : [];
      const docsSince = !!known && !!tip && gitOk(['merge-base', '--is-ancestor', sha, tip]) && changed.every((f) => f.endsWith('.md'));
      v = readyVerdict({ entry, run, latest, tip, onMain, docsSince });
    }
    console.log(`${v.ok ? 'LANDABLE' : 'NOT YET '}  ${entry.branch ?? entry.line.slice(0, 60)}  ${v.why}`);
    if (v.ok && !landable.includes(entry.branch)) landable.push(entry.branch);
  }
  console.log(landable.length ? `\nLandable, in list order: ${landable.join(' ')}` : '\nNothing landable yet.');
  return landable;
}

function land(shaArg, branchArg, holder) {
  if (!holder) die('landing frees the landing lock: name yourself with --holder "<session>" (or LANDING_LOCK_HOLDER)');
  const lock = lockCall(() => readLock(ROOT)).state;
  if (lock.held && lock.holder !== holder) die(`not landing: ${describeLock(lock, now())}`);
  git(['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main', '+refs/heads/check/train-*:refs/remotes/origin/check/train-*']);
  const sha = gitOk(['cat-file', '-e', `${shaArg}^{commit}`]) ? git(['rev-parse', `${shaArg}^{commit}`]) : die(`${shaArg}: no such commit (fetched origin)`);
  let branch = branchArg && trainBranch(branchArg);
  if (branchArg && !branch) die(`${branchArg}: not a check/train-* branch`);
  if (!branch) {
    const tips = git(['for-each-ref', '--format=%(objectname) %(refname:strip=3)', 'refs/remotes/origin/check/train-*']).split('\n').filter(Boolean).map((l) => l.split(' '));
    const hits = tips.filter(([s]) => s === sha).map(([, b]) => b);
    if (hits.length !== 1) die(hits.length ? `${sha.slice(0, 7)} is the tip of ${hits.join(', ')}: name one with --branch` : `${sha.slice(0, 7)} is the tip of no check/train-* branch: name it with --branch`);
    branch = hits[0];
  }
  const slug = slugOf();
  const refusal = landRefusal({ sha, branch, run: latestRun(slug, branch), isAncestor: gitOk(['merge-base', '--is-ancestor', 'origin/main', sha]) });
  if (refusal) die(`not landing: ${refusal}`);
  // A fast-forward: without force, the push itself refuses anything else.
  git(['push', '--quiet', 'origin', `${sha}:refs/heads/main`]);
  console.log(`main fast-forwarded to ${sha.slice(0, 7)} (green on ${branch}); its CI run skips as already green.`);
  const freed = lockCall(() => freeLock(ROOT, { holder, now: now() }));
  console.log(freed.freed ? 'Freed the landing lock.' : 'The landing lock was free.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`train: ${e instanceof TrainError ? e.message : e.stderr?.toString() || e.message}`);
    process.exit(1);
  }
}

function main(argv) {
  const opt = (name) => {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) die(`${name} needs a value`);
    argv.splice(i, 2);
    return v;
  };
  const landSha = opt('--land');
  const branch = opt('--branch');
  const holder = opt('--holder') ?? process.env.LANDING_LOCK_HOLDER ?? null;
  const flags = ['--no-push', '--lock', '--unlock', '--force-unlock', '--lock-status', '--ready', '--run'];
  const on = (f) => argv.includes(f);
  const rest = argv.filter((a) => !flags.includes(a));
  const unknown = rest.find((a) => a.startsWith('--'));
  if (unknown) die(`unknown option ${unknown}`);
  const lockOps = ['--lock', '--unlock', '--force-unlock', '--lock-status'].filter(on);
  if (lockOps.length > 1) die(`one of ${lockOps.join(', ')} at a time`);
  if (lockOps.length) {
    if (rest.length || landSha) die(`${lockOps[0]} takes no branches and no --land`);
    if (on('--lock-status')) return console.log(describeLock(lockCall(() => readLock(ROOT)).state, now()));
    if (on('--lock')) {
      const r = lockCall(() => takeLock(ROOT, { holder, train: branch ?? 'by hand', now: now() }));
      return console.log(r.taken ? `Took the landing lock (${holder}, ${branch ?? 'by hand'}). Free it when main is pushed: --unlock --holder "${holder}"` : 'You hold the landing lock already.');
    }
    if (on('--force-unlock')) {
      const was = lockCall(() => readLock(ROOT)).state;
      if (was.held) console.warn(`WARNING: forcing the landing lock free: ${describeLock(was, now())}. Make sure that train isn't still landing.`);
    }
    const r = lockCall(() => freeLock(ROOT, { holder, force: on('--force-unlock'), now: now() }));
    return console.log(r.freed ? 'Freed the landing lock.' : 'The landing lock was free.');
  }
  if (on('--run') && !on('--ready')) die('--run goes with --ready');
  if (on('--ready')) {
    if (rest.length || landSha) die('--ready reads its branches from QUEUE: name none, and no --land');
    const landable = ready();
    if (!on('--run')) return;
    if (!landable.length) die('nothing landable: no train');
    return train(landable, { push: !on('--no-push'), holder });
  }
  if (landSha) {
    if (rest.length) die('--land takes a sha (and --branch), not branches to merge');
    land(landSha, branch, holder);
  } else train(rest, { push: !on('--no-push'), holder });
}
