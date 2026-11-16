import { describe, expect, it } from 'vitest';
import { silentLimitMs } from '../src/server.ts';

describe('a silent player', () => {
  it('is closed after 20 s, 60 s while loading, and 60 s with the connection up (a stalled page, not a gone one)', () => {
    expect(silentLimitMs({ loaded: true, conn: {} })).toBe(20_000);
    expect(silentLimitMs({ loaded: true, conn: { up: () => false } })).toBe(20_000);
    expect(silentLimitMs({ loaded: true, conn: { up: () => true } })).toBe(60_000);
    expect(silentLimitMs({ loaded: false, conn: { up: () => false } })).toBe(60_000);
  });
});
