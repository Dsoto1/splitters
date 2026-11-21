// The landing lock (tools/ci/landingLock.mjs, the branch `landing-lock`): its messages and rules, and take / free /
// races against a scratch bare repository with two clones (two sessions).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LockError, STALE_MS, describeLock, freeLock, heldMessage, lockAge, parseLock, readLock, takeLock, unlockRefusal } from '../landingLock.mjs';

const at = new Date('2026-11-17T18:00:00.000Z');
const later = (ms) => new Date(at.getTime() + ms);

describe('the lock\'s messages and rules', () => {
  it('reads what it writes: held by whom, which train, since when; or free', () => {
    const msg = heldMessage({ holder: 'lane B splitters22', train: 'check/train-20261117-180000', at });
    expect(msg).toBe('held by lane B splitters22, train check/train-20261117-180000, 2026-11-17T18:00:00.000Z');
    expect(parseLock(msg)).toEqual({ held: true, holder: 'lane B splitters22', train: 'check/train-20261117-180000', at });
    expect(parseLock(heldMessage({ holder: 'x', at }))).toMatchObject({ holder: 'x', train: 'by hand' });
    expect(parseLock('free')).toEqual({ held: false });
    expect(parseLock('free\n\nWas: …')).toEqual({ held: false });
    expect(() => heldMessage({ holder: 'a, b', at })).toThrow(LockError);
    expect(() => heldMessage({ holder: '', at })).toThrow(LockError);
  });

  it('ages and descriptions', () => {
    expect(lockAge(at, later(42 * 60000))).toBe('42 min');
    expect(lockAge(at, later(195 * 60000))).toBe('3 h 15 min');
    expect(describeLock({ held: false })).toBe('the landing lock is free');
    expect(describeLock(parseLock(heldMessage({ holder: 'x', train: 'check/t', at })), later(60000))).toBe('the landing lock is held by x, train check/t, for 1 min');
  });

  it('only the holder frees it; anyone may force-free one held for 3 h or more', () => {
    const held = parseLock(heldMessage({ holder: 'x', at }));
    expect(unlockRefusal(held, { holder: 'x', now: later(1) })).toBeNull();
    expect(unlockRefusal(held, { holder: 'y', now: later(1) })).toMatch(/held by x.*not by y/);
    expect(unlockRefusal(held, { now: later(1) })).toMatch(/--holder/);
    expect(unlockRefusal(held, { holder: 'y', force: true, now: later(STALE_MS - 60000) })).toMatch(/3 h or more/);
    expect(unlockRefusal(held, { holder: 'y', force: true, now: later(STALE_MS) })).toBeNull();
    expect(unlockRefusal({ held: false }, { holder: 'y' })).toBeNull();
  });
});

describe('take and free on a scratch repository', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tt-lock-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }), 60_000);
  const origin = join(tmp, 'origin.git');
  const a = join(tmp, 'a');
  const b = join(tmp, 'b');
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(tmp, 'init', '-q', '--bare', '-b', 'main', origin);
  git(tmp, 'clone', '-q', origin, a);
  git(a, 'commit', '-q', '--allow-empty', '-m', 'base');
  git(a, 'push', '-q', 'origin', 'HEAD:main');
  git(tmp, 'clone', '-q', origin, b);
  const tip = () => git(origin, 'rev-parse', 'landing-lock');
  const subjects = () => git(origin, 'log', '--format=%s', 'landing-lock').split('\n');

  it('the first take creates the branch; a second session is refused, told who holds it', () => {
    expect(readLock(a)).toEqual({ tip: null, state: { held: false } });
    expect(takeLock(a, { holder: 'session-a', train: 'check/train-1', now: at }).taken).toBe(true);
    expect(subjects()).toEqual(['held by session-a, train check/train-1, 2026-11-17T18:00:00.000Z']);
    expect(() => takeLock(b, { holder: 'session-b', now: later(5 * 60000) })).toThrow(/held by session-a, train check\/train-1, for 5 min/);
    // Taking again for the same train is nothing to do; for another train it records the new one.
    expect(takeLock(a, { holder: 'session-a', train: 'check/train-1', now: later(1) }).taken).toBe(false);
    expect(takeLock(a, { holder: 'session-a', train: 'check/train-2', now: later(2) }).taken).toBe(true);
  });

  it('only the holder frees it, with a child commit; then the other session takes it', () => {
    const before = tip();
    expect(() => freeLock(b, { holder: 'session-b', now: later(1) })).toThrow(/not by session-b/);
    expect(tip()).toBe(before);
    expect(freeLock(a, { holder: 'session-a', now: later(10 * 60000) }).freed).toBe(true);
    expect(git(origin, 'rev-parse', 'landing-lock^')).toBe(before);
    expect(subjects()[0]).toBe('free');
    expect(freeLock(a, { holder: 'session-a', now: later(1) }).freed).toBe(false);
    expect(takeLock(b, { holder: 'session-b', now: later(11 * 60000) }).taken).toBe(true);
  });

  it('a race: both saw it free, the second push is not a fast-forward and loses, naming the winner', () => {
    freeLock(b, { holder: 'session-b', now: later(12 * 60000) });
    // Session a looks (sees free), then session b takes it, then a pushes its own child of the old tip.
    expect(readLock(a).state.held).toBe(false);
    const stale = git(a, 'rev-parse', 'refs/remotes/origin/landing-lock');
    expect(takeLock(b, { holder: 'session-b', train: 'check/train-3', now: later(13 * 60000) }).taken).toBe(true);
    const child = git(a, 'commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-p', stale, '-m', heldMessage({ holder: 'session-a', at: later(13 * 60000) }));
    expect(spawnSync('git', ['push', '-q', 'origin', `${child}:refs/heads/landing-lock`], { cwd: a }).status).not.toBe(0);
    expect(parseLock(git(origin, 'log', '-1', '--format=%B', 'landing-lock'))).toMatchObject({ holder: 'session-b', train: 'check/train-3' });
    expect(() => takeLock(a, { holder: 'session-a', now: later(14 * 60000) })).toThrow(/held by session-b, train check\/train-3/);
  });

  it('--force-unlock frees only a lock held for 3 h or more; the branch only ever grows', () => {
    const n = subjects().length;
    expect(() => freeLock(a, { holder: 'session-a', force: true, now: later(2 * 60 * 60000) })).toThrow(/3 h or more/);
    expect(freeLock(a, { holder: 'session-a', force: true, now: later(4 * 60 * 60000) }).freed).toBe(true);
    expect(git(origin, 'log', '-1', '--format=%B', 'landing-lock')).toMatch(/^free\n\nWas: the landing lock is held by session-b.*freed by session-a with --force-unlock/);
    expect(subjects().length).toBe(n + 1);
  });
});
