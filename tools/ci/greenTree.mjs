// "Already green?" by code, not by commit: a candidate whose files, docs left out, are exactly those of a
// commit that passed CI on a check branch needs nothing run again (CI's plan job, .github/workflows/ci.yml).
// Docs are what e2e/flowMap.mjs's DOC_PATTERNS name (docs/, *.md at the top or of a package, LICENSE).
// Any other difference, a new or deleted file included, runs CI as usual. Tested in tools/ci/test/greenTree.test.mjs.
import { execFileSync } from 'node:child_process';
import { isDocPath } from '../../e2e/flowMap.mjs';

/**
 * The decision: given the paths that differ between the candidate and a green commit, is it the same code?
 * True only when every differing path is docs (no difference at all counts as the same code).
 */
export function sameCode(differingPaths) {
  return differingPaths.every((p) => isDocPath(p));
}

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * Paths that differ between two commits' trees (adds, deletes, edits, mode changes; a rename is its delete and
 * its add). Null when git can't compare them (a commit that isn't there): never the same code then.
 */
export function differingPaths(a, b, cwd) {
  try {
    return git(cwd, 'diff', '--name-only', '--no-renames', '-z', a, b, '--').split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function haveCommit(sha, cwd, fetch) {
  try {
    git(cwd, 'cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    if (!fetch) return false;
  }
  // A deleted check branch's commit: GitHub still serves it by id.
  try {
    git(cwd, 'fetch', '--quiet', '--no-tags', 'origin', sha);
    git(cwd, 'cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * The first of `greenShas` (commits that passed CI on a check branch, newest first) whose code equals the
 * candidate's, with the docs that differ; null when none does.
 */
export function findGreenTwin(candidate, greenShas, { cwd = process.cwd(), fetch = false, limit = 30 } = {}) {
  for (const sha of [...new Set(greenShas)].slice(0, limit)) {
    if (!haveCommit(sha, cwd, fetch)) continue;
    const paths = differingPaths(sha, candidate, cwd);
    if (paths !== null && sameCode(paths)) return { sha, docs: paths };
  }
  return null;
}
