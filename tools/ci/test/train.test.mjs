// Batch landing (tools/ci/train.mjs): the landing checks, and the merge train on scratch repositories.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { landRefusal, readyEntries, readyVerdict, repoSlug, trainBranch, trainBranchName } from '../train.mjs';

const script = new URL('../train.mjs', import.meta.url).pathname;
const sha = 'a'.repeat(40);
const branch = 'check/train-20261103-120000';
const run = { head_sha: sha, status: 'completed', conclusion: 'success', html_url: 'u' };

describe('landing checks', () => {
  it('lands only a completed, successful latest run for that sha, on top of main', () => {
    expect(landRefusal({ sha, branch, run, isAncestor: true })).toBeNull();
    expect(landRefusal({ sha, branch, run: null, isAncestor: true })).toMatch(/no CI run/);
    expect(landRefusal({ sha, branch, run: { ...run, head_sha: 'b'.repeat(40) }, isAncestor: true })).toMatch(/is for bbbbbbb/);
    expect(landRefusal({ sha, branch, run: { ...run, status: 'in_progress', conclusion: null }, isAncestor: true })).toMatch(/in_progress/);
    expect(landRefusal({ sha, branch, run: { ...run, conclusion: 'failure' }, isAncestor: true })).toMatch(/failure/);
    expect(landRefusal({ sha, branch, run, isAncestor: false })).toMatch(/not an ancestor/);
    expect(landRefusal({ sha, branch: 'check/other', run, isAncestor: true })).toMatch(/only check\/train-/);
  });

  it('merges only wip/ and check/ branches; names its own branch by UTC time', () => {
    expect(trainBranch('wip/a')).toBe('wip/a');
    expect(trainBranch('origin/check/b')).toBe('check/b');
    for (const b of ['main', 'release/x', 'wip/../main', '-rf', 'wip/a b']) expect(trainBranch(b)).toBeNull();
    expect(trainBranchName(new Date(Date.UTC(2026, 10, 3, 9, 5, 7)))).toBe('check/train-20261103-090507');
    expect(repoSlug('https://github.com/o/r.git')).toBe('o/r');
    expect(repoSlug('git@github.com:o/r')).toBe('o/r');
  });
});

describe('--ready', () => {
  const queue = ['# Q', '## In flight', '- `wip/x` · 1234567 · 44000000001', '## Ready to land', '(`branch · green sha · run`)', '', '- `wip/a` · 79480282 · 44224399843 (lane B: notes)', '- `check/b` · abcdef12 · run 44226740750', '- something else', '## Maps', '- `wip/m` · 1234567 · 44000000002'].join('\n');
  const full = '79480282' + 'f'.repeat(32);
  const entry = { branch: 'wip/a', sha: '79480282', run: 44224399843 };
  const green = { id: 44224399843, head_sha: full, head_branch: 'check/a', status: 'completed', conclusion: 'success' };

  it("reads QUEUE's Ready to land entries in order, and only those", () => {
    const e = readyEntries(queue);
    expect(e.map((x) => x.branch ?? x.error)).toEqual(['wip/a', 'check/b', 'not `branch` · sha · run']);
    expect(e[0]).toMatchObject(entry);
    expect(e[1].run).toBe(44226740750);
    expect(readyEntries('# nothing')).toEqual([]);
  });

  it('confirms an entry only from a completed, successful latest run for its sha, the branch still there, not on main', () => {
    const ok = { entry, run: green, latest: green, tip: full, onMain: false, docsSince: false };
    expect(readyVerdict(ok).ok).toBe(true);
    expect(readyVerdict({ ...ok, tip: 'e'.repeat(40), docsSince: true })).toMatchObject({ ok: true, why: expect.stringMatching(/docs only since/) });
    expect(readyVerdict({ ...ok, run: null }).why).toMatch(/not found/);
    expect(readyVerdict({ ...ok, run: { ...green, head_sha: 'b'.repeat(40) } }).why).toMatch(/is for bbbbbbbb/);
    expect(readyVerdict({ ...ok, run: { ...green, status: 'in_progress', conclusion: null } }).why).toMatch(/in_progress/);
    expect(readyVerdict({ ...ok, run: { ...green, conclusion: 'failure' } }).why).toMatch(/ended failure/);
    expect(readyVerdict({ ...ok, latest: { ...green, id: 1, head_sha: 'c'.repeat(40), conclusion: 'failure' } }).why).toMatch(/newer run/);
    expect(readyVerdict({ ...ok, latest: { ...green, conclusion: 'failure' } }).why).toMatch(/re-run/);
    expect(readyVerdict({ ...ok, onMain: true }).why).toMatch(/on main already/);
    expect(readyVerdict({ ...ok, tip: null }).why).toMatch(/not on origin/);
    expect(readyVerdict({ ...ok, tip: 'e'.repeat(40) }).why).toMatch(/moved past/);
    expect(readyVerdict({ entry: { line: 'x', error: 'bad' } })).toEqual({ ok: false, why: 'bad' });
  });
});

describe('the train (scratch repositories)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tt-train-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const origin = join(tmp, 'origin.git');
  const clone = join(tmp, 'clone');
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const env = { ...process.env, TRAIN_ROOT: clone, LANDING_LOCK_HOLDER: 'session-a', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' };
  const trainRun = (...a) => spawnSync('node', [script, ...a], { cwd: clone, env, encoding: 'utf8' });
  const branchOff = (name, file, text) => {
    git(clone, 'checkout', '-q', '-B', name, 'origin/main');
    writeFileSync(join(clone, file), text);
    git(clone, 'commit', '-qam', name);
    git(clone, 'push', '-q', 'origin', name);
  };

  git(tmp, 'init', '-q', '--bare', '-b', 'main', origin);
  git(tmp, 'clone', '-q', origin, clone);
  writeFileSync(join(clone, 'a.txt'), 'a\n');
  writeFileSync(join(clone, 'b.txt'), 'b\n');
  git(clone, 'add', '-A');
  git(clone, 'commit', '-qm', 'base');
  git(clone, 'push', '-q', 'origin', 'HEAD:main');
  git(clone, 'fetch', '-q', 'origin');
  branchOff('wip/one', 'a.txt', 'a one\n');
  branchOff('wip/two', 'b.txt', 'b two\n');
  branchOff('wip/clash', 'a.txt', 'a clash\n');
  // The shared notes: two branches adding to the same list, and one rewriting a line another added to.
  git(clone, 'checkout', '-q', '-B', 'notes-base', 'origin/main');
  writeFileSync(join(clone, 'HANDOFF.md'), '# H\n\n- claim a\n');
  git(clone, 'add', '-A');
  git(clone, 'commit', '-qm', 'notes');
  git(clone, 'push', '-q', 'origin', 'HEAD:main');
  git(clone, 'fetch', '-q', 'origin');
  branchOff('wip/notes1', 'HANDOFF.md', '# H\n\n- claim a\n- claim one\n');
  branchOff('wip/notes2', 'HANDOFF.md', '# H\n\n- claim a\n- claim two\n');
  branchOff('wip/notes3', 'HANDOFF.md', '# H\n\n- claim a (done)\n');
  const mainBefore = git(origin, 'rev-parse', 'main');

  it('merges the branches in order and pushes a new check/train-* branch, nothing else', () => {
    const r = trainRun('wip/one', 'wip/two');
    expect(r.status, r.stderr).toBe(0);
    const heads = git(origin, 'for-each-ref', '--format=%(refname:strip=2)', 'refs/heads').split('\n');
    const train = heads.find((h) => h.startsWith('check/train-'));
    expect(train).toBeTruthy();
    expect(git(origin, 'show', `${train}:a.txt`)).toBe('a one');
    expect(git(origin, 'show', `${train}:b.txt`)).toBe('b two');
    expect(git(origin, 'rev-parse', 'main')).toBe(mainBefore);
    expect(git(origin, 'rev-parse', 'wip/one')).toBe(git(clone, 'rev-parse', 'origin/wip/one'));
    // It holds the landing lock for that train while its check runs.
    expect(git(origin, 'log', '-1', '--format=%s', 'landing-lock')).toMatch(new RegExp(`^held by session-a, train ${train}, `));
  });

  it('a train needs a holder, refuses while another holds the lock, and gives the lock back when it stops before pushing', () => {
    const noHolder = spawnSync('node', [script, 'wip/one'], { cwd: clone, env: { ...env, LANDING_LOCK_HOLDER: '' }, encoding: 'utf8' });
    expect(noHolder.status).toBe(1);
    expect(noHolder.stderr).toMatch(/--holder/);
    const other = spawnSync('node', [script, '--holder', 'session-b', 'wip/two'], { cwd: clone, env, encoding: 'utf8' });
    expect(other.status).toBe(1);
    expect(other.stderr).toMatch(/held by session-a, train check\/train-\d{8}-\d{6}, for \d+ min/);
    expect(trainRun('--unlock').status).toBe(0);
    const clash = trainRun('wip/one', 'wip/clash');
    expect(clash.status).toBe(1);
    expect(clash.stderr).toMatch(/Freed the landing lock/);
    expect(git(origin, 'log', '-1', '--format=%s', 'landing-lock')).toBe('free');
    expect(trainRun('--lock-status').stdout).toMatch(/the landing lock is free/);
  });

  it('stops on a conflict, naming the branch and the files, and leaves no worktree behind', () => {
    const before = git(origin, 'for-each-ref', 'refs/heads');
    const r = trainRun('--no-push', 'wip/one', 'wip/clash');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/wip\/clash conflicts with the candidate \(origin\/main \+ wip\/one\)/);
    expect(r.stderr).toMatch(/^\s+a\.txt$/m);
    expect(git(origin, 'for-each-ref', 'refs/heads')).toBe(before);
    expect(git(clone, 'worktree', 'list').split('\n')).toHaveLength(1);
    expect(readdirSync(tmpdir()).filter((d) => d.startsWith('train-')).every((d) => !existsSync(join(tmpdir(), d, '.git')))).toBe(true);
  });

  it('resolves a conflict only in HANDOFF/QUEUE as a union of added lines; stops when it is not one', () => {
    const r = trainRun('--no-push', 'wip/notes1', 'wip/notes2');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/merged wip\/notes2 \(resolved HANDOFF\.md/);
    const sha = r.stdout.match(/Candidate ([0-9a-f]{40})/)[1];
    expect(git(clone, 'show', `${sha}:HANDOFF.md`)).toBe('# H\n\n- claim a\n- claim one\n- claim two');
    const stop = trainRun('--no-push', 'wip/notes1', 'wip/notes3');
    expect(stop.status).toBe(1);
    expect(stop.stderr).toMatch(/wip\/notes3 conflicts with the candidate[\s\S]*HANDOFF\.md[\s\S]*not as a simple union/);
    expect(git(clone, 'worktree', 'list').split('\n')).toHaveLength(1);
  });

  it('refuses branches that are not wip/ or check/, and --land off a train branch', () => {
    expect(trainRun('--no-push', 'main').stderr).toMatch(/main: not a wip\/ or check\/ branch/);
    expect(trainRun('--land', 'HEAD', '--branch', 'main').stderr).toMatch(/not a check\/train-\* branch/);
  });
});
