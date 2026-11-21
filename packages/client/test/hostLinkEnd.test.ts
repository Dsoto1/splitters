import { describe, expect, it } from 'vitest';
import { endedReaders } from '../src/game/endedHooks.ts';
import { DEDICATED_SILENT_MS, HOST_SILENT_MS, hostSilent } from '../src/game/hostSilence.ts';

describe('a host link that goes quiet', () => {
  it('a browser host is gone after 20 s of silence, or 60 s with the connection up (its page stalled)', () => {
    expect(hostSilent(20_000, 0, false, false)).toBe(false);
    expect(hostSilent(20_001, 0, false, false)).toBe(true);
    expect(hostSilent(59_000, 0, false, true)).toBe(false);
    expect(hostSilent(60_001, 0, false, true)).toBe(true);
  });
  it('a dedicated host after 30 s, up or not: past its own 20 s and 5 s close, within the 60 s it keeps the place', () => {
    // It drops a page it hasn't heard from and closes the link 5 s later: the page gives up only after that, then
    // reconnects into its kept place, even when the close never reached it.
    expect(DEDICATED_SILENT_MS).toBeGreaterThan(HOST_SILENT_MS + 5_000);
    expect(DEDICATED_SILENT_MS).toBeLessThan(60_000);
    expect(hostSilent(29_000, 0, true, true)).toBe(false);
    expect(hostSilent(30_001, 0, true, true)).toBe(true);
    expect(hostSilent(30_001, 0, true, false)).toBe(true);
  });
});

describe('window.__cs between sessions', () => {
  it('keeps the readers tests poll, answering "no match", and holds nothing', () => {
    const r = endedReaders();
    expect(r.phase()).toBe('ended');
    expect(r.spec().spectator).toBe(false);
    expect(r.spec().following).toBe(-1);
    expect(r.rules()).toBeNull();
    expect(r.timeLeft()).toBe(0);
    expect(r.host()).toBeNull();
  });
});
