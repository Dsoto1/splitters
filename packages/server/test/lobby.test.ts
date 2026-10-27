import { describe, expect, it } from 'vitest';
import { LOBBY_EXPIRY_SECONDS } from '@tiletrigger/shared';
import { LobbyStore } from '../src/lobby.ts';

const advert = (over: Record<string, unknown> = {}) => ({ code: 'ABC234', name: 'Friday night', host: 'Dave', map: 'Sandgate', mode: 'core.tdm', players: 2, max: 8, version: 2, relay: false, ...over });

describe('game browser list', () => {
  it('lists, refreshes and removes a game; only its secret can change it', () => {
    let now = 0;
    const store = new LobbyStore(() => now);
    const r = store.add(advert(), '1.1.1.1');
    if ('error' in r) throw new Error(r.error);
    expect(store.list(2).map((g) => g.name)).toEqual(['Friday night']);
    expect(store.list(3)).toEqual([]);
    expect(store.update(r.id, 'wrong', advert({ players: 5 }))).toBe(403);
    expect(store.update(r.id, r.secret, advert({ players: 5 }))).toBe(204);
    expect(store.list()[0]!.players).toBe(5);
    // A listing can't be switched to another game's code.
    expect(store.update(r.id, r.secret, advert({ code: 'XYZ789' }))).toBe(400);
    expect(store.remove(r.id, 'wrong')).toBe(403);
    expect(store.remove(r.id, r.secret)).toBe(204);
    expect(store.size).toBe(0);
    now += 1;
  });

  it('keeps a well-formed map ID (for the map picture and plan) and drops anything else', () => {
    const store = new LobbyStore(() => 0);
    store.add(advert({ code: 'ABC234', mapId: 'sandgate' }), 'a');
    store.add(advert({ code: 'DEF567', mapId: '../../etc/passwd' }), 'b');
    const byCode = Object.fromEntries(store.list().map((g) => [g.code, g.mapId]));
    expect(byCode).toEqual({ ABC234: 'sandgate', DEF567: undefined });
  });

  it('drops a game whose host stops checking in', () => {
    let now = 0;
    const store = new LobbyStore(() => now);
    store.add(advert(), '1.1.1.1');
    now += (LOBBY_EXPIRY_SECONDS - 5) * 1000;
    expect(store.list().length).toBe(1);
    now += 10_000;
    expect(store.list().length).toBe(0);
  });

  it('rejects bad listings and limits each address', () => {
    const store = new LobbyStore(() => 0);
    expect(store.add(advert({ code: 'abc' }), 'a')).toMatchObject({ status: 400 });
    expect(store.add(advert({ mode: 'core.nonsense' }), 'a')).toMatchObject({ status: 400 });
    expect(store.add(advert({ players: 1.5 }), 'a')).toMatchObject({ status: 400 });
    for (const code of ['AAA222', 'BBB333', 'CCC444']) expect(store.add(advert({ code }), 'a')).toHaveProperty('secret');
    expect(store.add(advert({ code: 'DDD555' }), 'a')).toMatchObject({ status: 429 });
    // The same game listed again (a host reloading) replaces its old entry instead.
    expect(store.add(advert({ code: 'AAA222', name: 'Renamed' }), 'a')).toHaveProperty('secret');
    expect(store.list().filter((g) => g.code === 'AAA222').map((g) => g.name)).toEqual(['Renamed']);
    // Names lose control characters and are capped.
    store.add(advert({ code: 'EEE666', name: `x\u0000y${'z'.repeat(80)}` }), 'b');
    expect(store.list().find((g) => g.code === 'EEE666')!.name).toMatch(/^xyz+$/);
  });
});
