import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyCareer, prefsShape, type Profile } from '@tiletrigger/shared';

const store = new Map<string, string>();
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
Object.assign(globalThis, { localStorage: storage, sessionStorage: storage, window: new EventTarget() });

// Signed in as one account whose profile the test sets; saves are recorded.
const profile: { p: Profile } = { p: { username: 'Toshi_92', region: null, favClass: null, career: emptyCareer(), emblem: null, title: null, vouched: { matches: 0, wins: 0, kills: 0, deaths: 0, seconds: 0 }, optics: {}, keys: {}, prefs: {} } };
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
const { captionMode, resetCaptionModeCache, saveCaptionMode } = await import('../src/game/captionPrefs.ts');

describe('Sound captions on the account (the profile\'s prefs)', () => {
  beforeEach(() => {
    store.clear();
    saved.length = 0;
    resetCaptionModeCache();
  });

  it("signed in, the account's setting is yours here, and a change goes to the account", () => {
    store.set('tiletrigger.captions', 'on');
    profile.p = { ...profile.p, prefs: { captions: 'dir' } };
    syncPrefs();
    expect(captionMode()).toBe('dir');
    expect(store.get('tiletrigger.captions')).toBe('dir');
    expect(saved).toEqual([]);
    saveCaptionMode('off');
    expect(saved).toEqual([{ prefs: { captions: 'off' } }]);
  });

  it("an account with none takes this browser's, unless it is the default", () => {
    profile.p = { ...profile.p, prefs: {} };
    syncPrefs();
    expect(saved).toEqual([]);
    store.set('tiletrigger.captions', 'on');
    resetCaptionModeCache();
    syncPrefs();
    expect(saved).toEqual([{ prefs: { captions: 'on' } }]);
  });

  it('the hub keeps only short settings', () => {
    expect(prefsShape({ captions: 'dir', 'Bad Key': 'x', long: 'x'.repeat(40), n: 3 })).toEqual({ captions: 'dir' });
    expect(prefsShape([])).toBeNull();
  });
});
