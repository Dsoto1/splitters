// The landing lock (QUEUE Bugs, "The landing lock as a branch"; owner, 2026-11-17): one train or hand landing at a
// time, held on a git branch instead of a line in HANDOFF.
//
// The lock is the branch `landing-lock` on origin. It never merges anywhere and only ever grows: each take or free
// is a new child commit of its tip (an empty tree), whose message's first line says the state:
//   held by <holder>, train <check branch or "by hand">, <UTC time, ISO 8601>
//   free
// Taking pushes a "held" child of a "free" tip; a push that isn't a fast-forward means someone else got there first,
// and the take reports who. Freeing pushes a "free" child. Nothing is ever force-pushed or deleted; the first take
// creates the branch. Used by tools/ci/train.mjs (--lock, --unlock, --lock-status, --force-unlock, and around a
// train and --land). Tested in tools/ci/test/landingLock.test.mjs against scratch repositories.
import { execFileSync, spawnSync } from 'node:child_process';

export const LOCK_BRANCH = 'landing-lock';
/** A held lock older than this may be freed by anyone with --force-unlock (a session that died holding it). */
export const STALE_MS = 3 * 60 * 60 * 1000;
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** The lock's state from its tip commit's message: free, or held (by whom, which train, since when). */
export function parseLock(message) {
  const first = String(message ?? '').split('\n')[0].trim();
  if (!first || /^free\b/i.test(first)) return { held: false };
  const m = /^held by (.+), train (\S+(?: \S+)*?), (\d{4}-\d\d-\d\dT[\d:.]+Z)$/.exec(first);
  if (!m) return { held: true, holder: first, train: null, at: null };
  return { held: true, holder: m[1], train: m[2], at: new Date(m[3]) };
}

/** The first line of a held lock's commit. */
export function heldMessage({ holder, train = 'by hand', at = new Date() }) {
  if (!holder || /[\n,]/.test(holder)) throw new LockError('a lock holder is a name without commas or line breaks (--holder "<session>")');
  return `held by ${holder}, train ${train}, ${at.toISOString()}`;
}

/** "3 h 12 min" for a lock taken at `at` (now: `now`). */
export function lockAge(at, now = new Date()) {
  if (!at) return 'unknown age';
  const min = Math.max(0, Math.round((now - at) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

/** One line for people: who holds it, which train, how long. */
export function describeLock(state, now = new Date()) {
  if (!state.held) return 'the landing lock is free';
  return `the landing lock is held by ${state.holder}${state.train ? `, train ${state.train}` : ''}, for ${lockAge(state.at, now)}`;
}

/**
 * May `holder` free the lock? Null (yes) or the reason. Anyone may free a lock older than STALE_MS with `force`;
 * the holder may free their own at any time; freeing a free lock is nothing to do.
 */
export function unlockRefusal(state, { holder, force = false, now = new Date() }) {
  if (!state.held) return null;
  if (force) {
    if (!state.at || now - state.at >= STALE_MS) return null;
    return `${describeLock(state, now)}: --force-unlock frees only a lock held for 3 h or more`;
  }
  if (!holder) return 'name yourself: --holder "<session>"';
  if (state.holder !== holder) return `${describeLock(state, now)}, not by ${holder}`;
  return null;
}

export class LockError extends Error {}

/** Git in `root`, with an identity if none is set (scratch clones, fresh containers). */
function runGit(root, args, { ok = false } = {}) {
  const env = { ...process.env };
  if (!env.GIT_AUTHOR_NAME && spawnSync('git', ['config', 'user.name'], { cwd: root }).status !== 0) {
    Object.assign(env, { GIT_AUTHOR_NAME: 'landing-lock', GIT_AUTHOR_EMAIL: 'landing-lock@invalid', GIT_COMMITTER_NAME: 'landing-lock', GIT_COMMITTER_EMAIL: 'landing-lock@invalid' });
  }
  if (ok) return spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
  return execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** The lock as origin has it now: its tip (null when the branch doesn't exist yet) and state. */
export function readLock(root) {
  const f = runGit(root, ['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${LOCK_BRANCH}:refs/remotes/origin/${LOCK_BRANCH}`], { ok: true });
  if (f.status !== 0) {
    // No such branch yet (a fresh repository): free, and the first take creates it.
    if (/couldn't find remote ref|not found/i.test(f.stderr ?? '')) return { tip: null, state: { held: false } };
    throw new LockError(`cannot fetch ${LOCK_BRANCH}: ${(f.stderr || '').trim()}`);
  }
  const tip = runGit(root, ['rev-parse', `refs/remotes/origin/${LOCK_BRANCH}`]);
  return { tip, state: parseLock(runGit(root, ['log', '-1', '--format=%B', tip])) };
}

/** A child of `tip` (or a first commit) with `message`, pushed without force. True if it went in. */
function pushChild(root, tip, message) {
  const sha = runGit(root, ['commit-tree', EMPTY_TREE, ...(tip ? ['-p', tip] : []), '-m', message]);
  const r = runGit(root, ['push', '--quiet', 'origin', `${sha}:refs/heads/${LOCK_BRANCH}`], { ok: true });
  return r.status === 0;
}

/**
 * Take the lock for `holder` (and `train`, a check branch or "by hand"). Throws LockError when someone else holds it
 * (saying who and for how long), or when someone else took it between our look and our push. Taking a lock you hold
 * already is fine (a train after `--lock`).
 */
export function takeLock(root, { holder, train = 'by hand', now = new Date() }) {
  if (!holder) throw new LockError('name yourself: --holder "<session>" (or LANDING_LOCK_HOLDER)');
  const message = heldMessage({ holder, train, at: now });
  const { tip, state } = readLock(root);
  if (state.held && state.holder !== holder) throw new LockError(`${describeLock(state, now)}: wait for it, or ask them`);
  if (state.held && state.train === train) return { taken: false, state };
  if (!pushChild(root, tip, message)) {
    const again = readLock(root);
    throw new LockError(`someone took the lock first: ${describeLock(again.state, now)}`);
  }
  return { taken: true, state: parseLock(message) };
}

/** Free the lock (see unlockRefusal). Throws LockError when not allowed, or when the lock moved meanwhile. */
export function freeLock(root, { holder, force = false, now = new Date() }) {
  const { tip, state } = readLock(root);
  const refusal = unlockRefusal(state, { holder, force, now });
  if (refusal) throw new LockError(`not freeing: ${refusal}`);
  if (!state.held) return { freed: false, state };
  const by = holder ?? 'someone';
  const note = force ? `freed by ${by} with --force-unlock after ${lockAge(state.at, now)}` : `freed by ${by}`;
  if (!pushChild(root, tip, `free\n\nWas: ${describeLock(state, now)}; ${note}, ${now.toISOString()}.`)) {
    throw new LockError(`the lock moved while freeing it: ${describeLock(readLock(root).state, now)}`);
  }
  return { freed: true, state };
}
