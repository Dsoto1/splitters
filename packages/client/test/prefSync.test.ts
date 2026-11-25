import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyCareer, prefsShape, type Profile } from '@tiletrigger/shared';

const store = new Map<string, string>();
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
Object.assign(globalThis, { localStorage: storage, sessionStorage: storage, window: new EventTarget() });

// Signed in as one account whose profile the test sets; saves are recorded.
const profile: { p: Profile } = { p: { username: 'Toshi_92', region: null, favClass: null, career: emptyCareer(), emblem: null, title: null, vouched: { matches: 0, wins: 0, kills: 0, deaths: 0, seconds: 0 }, optics: {}, keys: {}, prefs: {}, campaign: { maps: [], sectors: [], convergences: [], characters: [] } } };
const saved: unknown[] = [];
vi.mock('../src/account.ts', () => ({ currentAccount: () => ({ sub: 's1' }) }));
vi.mock('../src/profile.ts', () => ({
  cachedProfile: () => profile.p,
  saveProfile: async (patch: unknown) => {
    saved.push(patch);
    return profile.p;
  },
}));
const { syncPrefs } = await import('../src/game/prefSync.ts');
const { captionMode } = await import('../src/game/captionPrefs.ts');
const { colourVision, resetColourVisionCache } = await import('../src/game/colourVision.ts');

describe('Sound captions on the account (the profile\'s prefs)', () => {
  beforeEach(() => {
    store.clear();
    saved.length = 0;
    resetColourVisionCache();
  });

  it("signed in, the account's setting is yours here as a match starts", () => {
    store.set('tiletrigger.captions', 'on');
    profile.p = { ...profile.p, prefs: { captions: 'dir' } };
    let heard = 0;
    window.addEventListener('tiletrigger:captions', () => heard++);
    syncPrefs();
    expect(captionMode()).toBe('dir');
    expect(store.get('tiletrigger.captions')).toBe('dir');
    expect(saved).toEqual([]);
    expect(heard).toBe(1);
    // Already in step: nothing to do.
    syncPrefs();
    expect(heard).toBe(1);
    expect(saved).toEqual([]);
  });

  it("an account with none takes this browser's, unless it is the default", () => {
    profile.p = { ...profile.p, prefs: {} };
    syncPrefs();
    expect(saved).toEqual([]);
    store.set('tiletrigger.captions', 'on');
    syncPrefs();
    expect(saved).toEqual([{ prefs: { captions: 'on' } }]);
  });

  it('Colour vision comes along the same way', () => {
    store.set('tiletrigger.colourVision', 'tritan');
    profile.p = { ...profile.p, prefs: { colourVision: 'redgreen' } };
    syncPrefs();
    expect(colourVision()).toBe('redgreen');
    expect(store.get('tiletrigger.colourVision')).toBe('redgreen');
    expect(saved).toEqual([]);
    // An account with neither takes both of this browser's in one save.
    store.set('tiletrigger.captions', 'on');
    profile.p = { ...profile.p, prefs: {} };
    syncPrefs();
    expect(saved).toEqual([{ prefs: { captions: 'on', colourVision: 'redgreen' } }]);
  });

  it('the hub keeps only short settings', () => {
    expect(prefsShape({ captions: 'dir', 'Bad Key': 'x', long: 'x'.repeat(40), n: 3 })).toEqual({ captions: 'dir' });
    expect(prefsShape([])).toBeNull();
  });
});
