#!/usr/bin/env node
// Batch landing: merge several green branches onto origin/main as one candidate, test it on a check branch,
// then fast-forward main to it once that run is green.
//
//   node tools/ci/train.mjs wip/a wip/b check/c    candidate from origin/main, each branch merged in that order,
//                                                  pushed to check/train-<UTC timestamp> (CI runs there)
//   node tools/ci/train.mjs --no-push wip/a ...    the same, without pushing (prints the candidate's sha)
//   node tools/ci/train.mjs --land <sha> [--branch check/train-…]
//                                                  fast-forward main to <sha>, only if the latest CI run on its
//                                                  check/train-* branch is for <sha>, completed and successful,
//                                                  and origin/main is an ancestor of <sha>
//
// It never force-pushes, never changes your checkout (the merges happen in a temporary worktree) and pushes
// only to check/train-* (new branches) and main (a fast-forward). Tested in tools/ci/test/train.test.mjs.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const git = (args, cwd = ROOT) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (args, cwd = ROOT) => spawnSync('git', args, { cwd, stdio: 'ignore' }).status === 0;
class TrainError extends Error {}
// Thrown, not exit(): the temporary worktree is removed on the way out.
const die = (msg) => {
  throw new TrainError(msg);
};

function train(branches, { push }) {
  const names = branches.map((b) => trainBranch(b) ?? die(`${b}: not a wip/ or check/ branch`));
  if (!names.length) die('name the branches to merge (wip/… or check/…)');
  git(['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main', ...names.map((b) => `+refs/heads/${b}:refs/remotes/origin/${b}`)]);
  const dir = mkdtempSync(join(tmpdir(), 'train-'));
  try {
    git(['worktree', 'add', '--quiet', '--detach', dir, 'origin/main']);
    console.log(`Candidate from origin/main (${git(['rev-parse', '--short', 'HEAD'], dir)})`);
    for (const b of names) {
      const r = spawnSync('git', ['merge', '--no-ff', '--no-edit', '-m', `Train: merge ${b}`, `origin/${b}`], { cwd: dir, encoding: 'utf8' });
      if (r.status !== 0) {
        const files = git(['diff', '--name-only', '--diff-filter=U'], dir).split('\n').filter(Boolean);
        gitOk(['merge', '--abort'], dir);
        die(files.length
          ? `${b} conflicts with the candidate (origin/main + ${names.slice(0, names.indexOf(b)).join(', ') || 'nothing yet'}) in:\n  ${files.join('\n  ')}\nRebase ${b} onto origin/main (and the branches before it), then run the train again.`
          : `merging ${b} failed:\n${r.stderr || r.stdout}`);
      }
      console.log(`  merged ${b}`);
    }
    const sha = git(['rev-parse', 'HEAD'], dir);
    if (!push) {
      console.log(`Candidate ${sha} (not pushed: --no-push)`);
      return;
    }
    const branch = trainBranchName();
    // A new branch: a plain push (no force) fails rather than replace anything already there.
    git(['push', '--quiet', 'origin', `${sha}:refs/heads/${branch}`]);
    console.log(`Pushed ${sha.slice(0, 7)} to ${branch}: CI runs there.\nWhen it's green: node tools/ci/train.mjs --land ${sha} --branch ${branch}`);
  } finally {
    gitOk(['worktree', 'remove', '--force', dir]);
    rmSync(dir, { recursive: true, force: true });
  }
}

function latestRun(slug, branch) {
  const out = execFileSync('gh', ['api', `repos/${slug}/actions/workflows/ci.yml/runs?branch=${encodeURIComponent(branch)}&event=push&per_page=1`], { encoding: 'utf8' });
  return JSON.parse(out).workflow_runs?.[0] ?? null;
}

function land(shaArg, branchArg) {
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
  const slug = process.env.GH_REPO || repoSlug(git(['remote', 'get-url', 'origin'])) || die('cannot tell the GitHub repository from origin: set GH_REPO=owner/repo');
  const refusal = landRefusal({ sha, branch, run: latestRun(slug, branch), isAncestor: gitOk(['merge-base', '--is-ancestor', 'origin/main', sha]) });
  if (refusal) die(`not landing: ${refusal}`);
  // A fast-forward: without force, the push itself refuses anything else.
  git(['push', '--quiet', 'origin', `${sha}:refs/heads/main`]);
  console.log(`main fast-forwarded to ${sha.slice(0, 7)} (green on ${branch}); its CI run skips as already green.`);
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
  const noPush = argv.includes('--no-push');
  const rest = argv.filter((a) => a !== '--no-push');
  const unknown = rest.find((a) => a.startsWith('--'));
  if (unknown) die(`unknown option ${unknown}`);
  if (landSha) {
    if (rest.length) die('--land takes a sha (and --branch), not branches to merge');
    land(landSha, branch);
  } else train(rest, { push: !noPush });
}
