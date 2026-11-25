import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyCareer, type Profile } from '@tiletrigger/shared';

const store = new Map<string, string>();
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });

// Signed in as one account whose profile the test sets; saves are recorded.
const profile: { p: Profile } = { p: { username: 'Toshi_92', region: null, favClass: null, career: emptyCareer(), emblem: null, title: null, vouched: { matches: 0, wins: 0, kills: 0, deaths: 0, seconds: 0 }, optics: {}, keys: {}, prefs: {}, campaign: { maps: [], sectors: [], convergences: [], characters: [] } } };
const saved: unknown[] = [];
vi.mock('../src/account.ts', () => ({ currentAccount: () => ({ sub: 's1' }) }));
vi.mock('../src/profile.ts', () => ({
  cachedProfile: () => profile.p,
  loadProfile: async () => profile.p,
  setCachedCareer: () => undefined,
  call: async () => {
    throw new Error('offline');
  },
  saveProfile: async (patch: unknown) => {
    saved.push(patch);
    return profile.p;
  },
}));
const { syncOptics } = await import('../src/careerStats.ts');
const { myOptics, resetOpticPrefsCache, setMyOptic } = await import('../src/opticPrefs.ts');

describe('optic picks on the account (player profiles, owner 2026-11-22 "3a")', () => {
  beforeEach(() => {
    store.clear();
    saved.length = 0;
    resetOpticPrefsCache();
  });

  it("signed in, the account's picks are yours here, and changes go to the account", () => {
    store.set('tiletrigger.optics', JSON.stringify({ 'core.rifle': 'reddot' }));
    profile.p = { ...profile.p, optics: { 'core.sniper': 'scope8' } };
    syncOptics();
    expect(myOptics()).toEqual({ 'core.sniper': 'scope8' });
    expect(saved).toEqual([]);
    setMyOptic('core.rifle', 'holo');
    expect(saved).toEqual([{ optics: { 'core.sniper': 'scope8', 'core.rifle': 'holo' } }]);
  });

  it("an account with no picks takes this browser's", () => {
    store.set('tiletrigger.optics', JSON.stringify({ 'core.rifle': 'reddot' }));
    profile.p = { ...profile.p, optics: {} };
    syncOptics();
    expect(myOptics()).toEqual({ 'core.rifle': 'reddot' });
    expect(saved).toEqual([{ optics: { 'core.rifle': 'reddot' } }]);
  });
});
