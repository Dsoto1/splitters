import { afterEach, describe, expect, it } from 'vitest';
import { autoReloadOn, damageNumbersOn, saveAutoReload, saveDamageNumbers, saveSprayReadout, sprayReadoutOn } from '../src/game/combatReadouts.ts';

const g = globalThis as { localStorage?: Storage };

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
}

describe('gunplay readout options', () => {
  afterEach(() => delete g.localStorage);

  it('auto-reload is on by default; damage numbers and the spray pattern are off (also with no storage at all)', () => {
    expect(autoReloadOn()).toBe(true);
    expect(damageNumbersOn()).toBe(false);
    expect(sprayReadoutOn()).toBe(false);
    g.localStorage = fakeStorage();
    expect(autoReloadOn()).toBe(true);
    expect(damageNumbersOn()).toBe(false);
  });

  it('each is saved and read back', () => {
    g.localStorage = fakeStorage();
    saveAutoReload(false);
    saveDamageNumbers(true);
    saveSprayReadout(true);
    expect(autoReloadOn()).toBe(false);
    expect(damageNumbersOn()).toBe(true);
    expect(sprayReadoutOn()).toBe(true);
  });
});
