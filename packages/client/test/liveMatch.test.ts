// The tab's live match (liveMatch.ts; docs/MOBILE_AUDIT.md, round 3): a reload during an online match goes back in
// while the place is held, a local one says it can't; and the iPhone check for the Add to Home Screen line (phone.ts).
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PLACE_HELD_MS, forgetLiveMatch, liveMatchOnLoad, parseLiveMatch, readLiveMatch, rememberLiveMatch } from '../src/liveMatch.ts';
import { iPhoneInBrowser } from '../src/phone.ts';

const store = new Map<string, string>();
const win = new EventTarget();
beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = win;
  g.document = Object.assign(new EventTarget(), { hidden: false });
  g.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
});
beforeEach(() => {
  store.clear();
  win.dispatchEvent(new Event('pageshow'));
});

describe('the live match', () => {
  it('remembers an online match and rejoins it on load while the place is held', () => {
    rememberLiveMatch({ kind: 'server', url: 'wss://play.example/ws', name: 'Rita' });
    const m = readLiveMatch();
    expect(m).toMatchObject({ kind: 'server', url: 'wss://play.example/ws', name: 'Rita' });
    expect(liveMatchOnLoad(m!.seen + 5000)).toMatchObject({ what: 'rejoin', match: { kind: 'server' } });
    // Used up: a second load (the rejoin failed and the menu came back) doesn't try again.
    expect(liveMatchOnLoad()).toBeNull();
  });

  it('keeps a friend’s game by code and party', () => {
    rememberLiveMatch({ kind: 'code', code: 'K7QX4M', name: 'Rita', party: 'pt_abc' });
    expect(liveMatchOnLoad()).toMatchObject({ what: 'rejoin', match: { kind: 'code', code: 'K7QX4M', party: 'pt_abc' } });
  });

  it('says the place has gone once it has been away longer than the hold', () => {
    rememberLiveMatch({ kind: 'server', url: 'ws://127.0.0.1:7787', name: 'Rita' });
    const seen = readLiveMatch()!.seen;
    expect(liveMatchOnLoad(seen + PLACE_HELD_MS + 1)?.what).toBe('gone');
  });

  it('a local match (solo or hosted in this tab) is remembered only to say it ended', () => {
    rememberLiveMatch({ kind: 'local' });
    expect(liveMatchOnLoad()?.what).toBe('local');
  });

  it('leaving forgets it, but not while the page is going away (a reload keeps it)', () => {
    rememberLiveMatch({ kind: 'server', url: 'ws://h', name: 'A' });
    forgetLiveMatch();
    expect(readLiveMatch()).toBeNull();
    rememberLiveMatch({ kind: 'server', url: 'ws://h', name: 'A' });
    win.dispatchEvent(new Event('pagehide'));
    // The link closing as the page unloads ends the session: the record stays for the reload.
    forgetLiveMatch();
    expect(readLiveMatch()).toMatchObject({ kind: 'server' });
  });

  it('reads damaged or foreign values as nothing', () => {
    expect(parseLiveMatch(null)).toBeNull();
    expect(parseLiveMatch('{nope')).toBeNull();
    expect(parseLiveMatch('{"kind":"server","url":"javascript:alert(1)","seen":1}')).toBeNull();
    expect(parseLiveMatch('{"kind":"code","code":"short","seen":1}')).toBeNull();
    expect(parseLiveMatch('{"kind":"server","url":"ws://x","name":"N"}')).toBeNull();
  });
});

describe('Add to Home Screen line', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  it('is for an iPhone in its browser, not from the Home Screen, an iPad or Android', () => {
    expect(iPhoneInBrowser(iphone, false)).toBe(true);
    expect(iPhoneInBrowser(iphone, true)).toBe(false);
    expect(iPhoneInBrowser('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', false)).toBe(false);
    expect(iPhoneInBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile', false)).toBe(false);
  });
});
