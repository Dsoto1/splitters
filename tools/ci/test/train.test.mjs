// Batch landing (tools/ci/train.mjs): the landing checks, and the merge train on scratch repositories.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { landRefusal, repoSlug, trainBranch, trainBranchName } from '../train.mjs';

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

describe('the train (scratch repositories)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tt-train-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const origin = join(tmp, 'origin.git');
  const clone = join(tmp, 'clone');
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const env = { ...process.env, TRAIN_ROOT: clone, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' };
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

  it('refuses branches that are not wip/ or check/, and --land off a train branch', () => {
    expect(trainRun('--no-push', 'main').stderr).toMatch(/main: not a wip\/ or check\/ branch/);
    expect(trainRun('--land', 'HEAD', '--branch', 'main').stderr).toMatch(/not a check\/train-\* branch/);
  });
});
