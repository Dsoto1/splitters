// Disk clean-up (tools/dev/cleanup.mjs): which worktrees may go. Uncommitted work never does.
import { describe, expect, it } from 'vitest';
import { parseWorktrees, worktreeVerdict } from '../../dev/cleanup.mjs';

describe('worktree clean-up', () => {
  it('reads git worktree list --porcelain', () => {
    const text = 'worktree /r\nHEAD aaa\nbranch refs/heads/main\n\nworktree /w1\nHEAD bbb\ndetached\nlocked\n\nworktree /w2\nHEAD ccc\nbranch refs/heads/wip/x\nprunable gitdir file points to non-existent location\n';
    expect(parseWorktrees(text)).toEqual([
      { path: '/r', head: 'aaa', branch: 'main', locked: false, prunable: false, bare: false },
      { path: '/w1', head: 'bbb', branch: null, locked: true, prunable: false, bare: false },
      { path: '/w2', head: 'ccc', branch: 'wip/x', locked: false, prunable: true, bare: false },
    ]);
  });
  it('removes only a clean, idle worktree whose commit is merged or pushed', () => {
    const w = { main: false, current: false, locked: false, dirty: false, merged: true, pushed: true, idleHours: 5 };
    expect(worktreeVerdict(w)).toEqual({ remove: true, why: 'clean, merged into main' });
    expect(worktreeVerdict({ ...w, merged: false })).toEqual({ remove: true, why: 'clean, pushed' });
    expect(worktreeVerdict({ ...w, dirty: true }).remove).toBe(false);
    expect(worktreeVerdict({ ...w, merged: false, pushed: false }).why).toMatch(/not pushed/);
    expect(worktreeVerdict({ ...w, idleHours: 1 }).why).toMatch(/another session/);
    expect(worktreeVerdict({ ...w, idleHours: 1 }, 0.5).remove).toBe(true);
    for (const k of ['main', 'current', 'locked']) expect(worktreeVerdict({ ...w, [k]: true }).remove).toBe(false);
  });
});
