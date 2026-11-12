import { describe, expect, it } from 'vitest';
import { prepushRefusal, prepushSteps } from '../prepush.mjs';

describe('pnpm prepush', () => {
  const sha = '0123456789abcdef';
  it('refuses a commit that origin/main is not merged into: checks before the merge do not count', () => {
    expect(prepushRefusal({ mainInHead: false, mainSha: sha, dirty: [] })).toMatch(/origin\/main \(01234567\) is not in this commit: merge it first/);
    // (Not merged comes first: a dirty tree matters only for the commit that would be checked.)
    expect(prepushRefusal({ mainInHead: false, mainSha: sha, dirty: ['a.ts'] })).toMatch(/merge it first/);
  });
  it('refuses uncommitted changes, naming a few', () => {
    expect(prepushRefusal({ mainInHead: true, mainSha: sha, dirty: ['a.ts', 'b.ts'] })).toMatch(/uncommitted changes \(a\.ts, b\.ts\): commit them first/);
    expect(prepushRefusal({ mainInHead: true, mainSha: sha, dirty: ['a', 'b', 'c', 'd', 'e'] })).toMatch(/\(a, b, c, and 2 more\)/);
  });
  it('runs on a clean commit with main merged', () => {
    expect(prepushRefusal({ mainInHead: true, mainSha: sha, dirty: [] })).toBeNull();
  });
  it('typecheck, content check, the unit tests for the change, then the plan; the flows only when asked', () => {
    expect(prepushSteps({ e2e: false }).map((s) => s[1].join(' '))).toEqual(['pnpm typecheck', 'pnpm content:check', 'pnpm test:changed', 'pnpm ci:plan']);
    expect(prepushSteps({ e2e: true }).map((s) => s[1].join(' ')).slice(4)).toEqual(['pnpm build', 'pnpm e2e:changed']);
  });
});
