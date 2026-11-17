import { afterEach, describe, expect, it } from 'vitest';
import { BODY_POOL_BIG, BODY_POOL_SMALL, bodyPoolTotal } from '../src/game/bodyPool.ts';

describe('body pool size (bodyPool.ts)', () => {
  afterEach(() => {
    delete (globalThis as { __bodyPoolTotal?: number }).__bodyPoolTotal;
  });

  it('keeps 16 in a small match', () => {
    for (const n of [0, 1, 8, 16, 24, 32]) expect(bodyPoolTotal(n, true)).toBe(BODY_POOL_SMALL);
  });

  it('keeps one for every two players in a big match, up to 32', () => {
    expect(bodyPoolTotal(40, true)).toBe(20);
    expect(bodyPoolTotal(47, true)).toBe(24);
    expect(bodyPoolTotal(63, true)).toBe(BODY_POOL_BIG);
    expect(bodyPoolTotal(64, true)).toBe(BODY_POOL_BIG);
    expect(bodyPoolTotal(200, true)).toBe(BODY_POOL_BIG);
  });

  it('never shrinks as the match grows', () => {
    let last = 0;
    for (let n = 0; n <= 128; n++) {
      const t = bodyPoolTotal(n, true);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
  });

  it('keeps the old 16 with ?perfoff=bodypool, whatever the match', () => {
    expect(bodyPoolTotal(64, false)).toBe(BODY_POOL_SMALL);
    (globalThis as { __bodyPoolTotal?: number }).__bodyPoolTotal = 24;
    expect(bodyPoolTotal(64, false)).toBe(BODY_POOL_SMALL);
  });

  it("takes a measurement's own size when one is set", () => {
    (globalThis as { __bodyPoolTotal?: number }).__bodyPoolTotal = 24;
    expect(bodyPoolTotal(64, true)).toBe(24);
    expect(bodyPoolTotal(4, true)).toBe(24);
  });
});
