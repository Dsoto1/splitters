import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyCareer, regionForTimeZone, usernameProblem, type MatchSummary } from '@tiletrigger/shared';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ProfileStore, profileHandler } from '../src/profiles.ts';
import { TicketSigner, verifyTicket } from '../src/tickets.ts';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup.splice(0)) f();
});
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'tt-profiles-'));
  cleanup.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
};

describe('profiles', () => {
  it('keeps Story campaign progress, merged by union so no device takes wins away, kept across restarts', () => {
    const dir = temp();
    const store = new ProfileStore(dir);
    store.update('a', { campaign: { maps: ['jade_empire/jungle_steps'], characters: ['core.chimp_aztec'] } });
    // Another device that never saw that win sends its own.
    const p = store.update('a', { campaign: { maps: ['lockdown/runway_nine'], sectors: [], convergences: [], characters: ['core.usgrunt'] } });
    expect(p.campaign).toEqual({ maps: ['jade_empire/jungle_steps', 'lockdown/runway_nine'], sectors: [], convergences: [], characters: ['core.chimp_aztec', 'core.usgrunt'] });
    store.flush();
    expect(new ProfileStore(dir).get('a').campaign.maps).toEqual(['jade_empire/jungle_steps', 'lockdown/runway_nine']);
    expect(() => store.update('a', { campaign: { maps: 'all' } })).toThrow(/campaign/);
  });

  it('gives each account a unique username (whatever the case) and a region, kept across restarts', () => {
    const dir = temp();
    const store = new ProfileStore(dir);
    expect(store.get('a')).toEqual({ username: null, region: null, favClass: null, career: emptyCareer(), emblem: null, title: null, vouched: { matches: 0, wins: 0, kills: 0, deaths: 0, seconds: 0 }, optics: {}, keys: {}, prefs: {}, campaign: { maps: [], sectors: [], convergences: [], characters: [] } });
    expect(store.update('a', { username: 'Toshi_92', region: 'na-east' })).toMatchObject({ username: 'Toshi_92', region: 'na-east' });
    // Taken, whatever the case; but the owner may change its own case.
    expect(store.problem('b', 'toshi_92')).toBe('that name is taken');
    expect(() => store.update('b', { username: 'TOSHI_92' })).toThrow(/taken/);
    expect(store.update('a', { username: 'toshi_92' }).username).toBe('toshi_92');
    // A new name frees the old one.
    store.update('a', { username: 'Flavius' });
    expect(store.problem('b', 'toshi_92')).toBeNull();
    expect(() => store.update('a', { region: 'mars' })).toThrow(/region/);
    // Started again: still there.
    const again = new ProfileStore(dir);
    expect(again.username('a')).toBe('Flavius');
    expect(again.problem('b', 'flavius')).toBe('that name is taken');
  });

  it('refuses usernames that are malformed, reserved or claim to be official', () => {
    expect(usernameProblem('ab')).toMatch(/at least 3/);
    expect(usernameProblem('a'.repeat(17))).toMatch(/at most 16/);
    expect(usernameProblem('has space')).toMatch(/letters/);
    expect(usernameProblem('_under')).toMatch(/starting/);
    expect(usernameProblem('Admin')).toMatch(/reserved/);
    expect(usernameProblem('guest7')).toMatch(/reserved/);
    expect(usernameProblem('0fficialBob')).toMatch(/official/);
    expect(usernameProblem('ToshiroFan')).toMatch(/official/);
    expect(usernameProblem('Sniper.Wolf-9')).toBeNull();
  });

  it('guesses a region from the time zone', () => {
    expect(regionForTimeZone('America/New_York')).toBe('na-east');
    expect(regionForTimeZone('America/Los_Angeles')).toBe('na-west');
    expect(regionForTimeZone('America/Sao_Paulo')).toBe('sa');
    expect(regionForTimeZone('Europe/Berlin')).toBe('eu');
    expect(regionForTimeZone('Asia/Tokyo')).toBe('asia-east');
    expect(regionForTimeZone('Asia/Kolkata')).toBe('asia-south');
    expect(regionForTimeZone('Asia/Dubai')).toBe('me');
    expect(regionForTimeZone('Australia/Sydney')).toBe('oceania');
  });

  it('signs the username into account tickets, and a host refuses a ticket with a bad one', () => {
    const signer = new TicketSigner();
    const keys = new Map([[signer.kid, signer.publicKey]]);
    const { ticket } = signer.sign('acct-1', 'ABC234', 1_000_000, 'Flavius');
    expect(verifyTicket(ticket, 'ABC234', keys, 1_000_000)).toMatchObject({ sub: 'acct-1', name: 'Flavius' });
    expect(verifyTicket(signer.sign('acct-2', 'ABC234', 1_000_000).ticket, 'ABC234', keys, 1_000_000)?.name).toBeUndefined();
    expect(verifyTicket(signer.sign('acct-3', 'ABC234', 1_000_000, 'no spaces allowed').ticket, 'ABC234', keys, 1_000_000)).toBeNull();
  });

  const match = (o: Partial<MatchSummary> = {}): MatchSummary => ({ mode: 'core.tdm', result: 'win', kills: 12, deaths: 5, shots: 300, hits: 90, headshots: 3, bestStreak: 4, seconds: 600, weaponKills: { 'core.rifle': 9, 'core.pistol': 2 }, ...o });

  it('keeps a favourite class (a real one) and sums career stats match by match, across restarts', () => {
    const dir = temp();
    const store = new ProfileStore(dir);
    expect(store.update('a', { favClass: 'medic' }).favClass).toBe('medic');
    expect(() => store.update('a', { favClass: 'wizard' })).toThrow(/class/);
    store.addMatch('a', match());
    const c = store.addMatch('a', match({ result: 'loss', kills: 3, deaths: 9, bestStreak: 2, headshots: 0, weaponKills: { 'core.shotgun': 3 } }));
    expect(c).toMatchObject({ matches: 2, wins: 1, kills: 15, deaths: 14, shots: 600, hits: 180, headshots: 3, bestStreak: 4, seconds: 1200 });
    expect(c.weaponKills).toEqual({ 'core.rifle': 9, 'core.shotgun': 3, 'core.pistol': 2 });
    store.flush();
    const again = new ProfileStore(dir);
    expect(again.get('a')).toMatchObject({ favClass: 'medic', career: { matches: 2, kills: 15 } });
  });

  it('refuses match summaries out of bounds', () => {
    const store = new ProfileStore(temp());
    expect(() => store.addMatch('a', match({ hits: 301 }))).toThrow(/hits/);
    expect(() => store.addMatch('a', match({ kills: 501 }))).toThrow(/range/);
    expect(() => store.addMatch('a', match({ seconds: 10 }))).toThrow(/short/);
    expect(() => store.addMatch('a', match({ weaponKills: { 'core.rifle': 13 } }))).toThrow(/more than kills/);
    expect(() => store.addMatch('a', match({ result: 'champion' as 'win' }))).toThrow(/result/);
    expect(() => store.addMatch('a', match({ kills: 1.5 }))).toThrow(/range/);
    expect(store.get('a').career.matches).toBe(0);
  });

  it("moves a guest's career onto an account once, only while it has none", () => {
    const store = new ProfileStore(temp());
    const guest = { ...emptyCareer(), matches: 3, wins: 1, kills: 20, deaths: 10, shots: 500, hits: 120, seconds: 1500, weaponKills: { 'core.rifle': 15 } };
    expect(() => store.importCareer('a', { ...guest, kills: 3 * 501 })).toThrow(/range/);
    expect(store.importCareer('a', guest)).toMatchObject({ matches: 3, kills: 20 });
    expect(() => store.importCareer('a', guest)).toThrow(/already/);
  });

  it('keeps an emblem and an earned title, and shows a public card by username', () => {
    const dir = temp();
    const store = new ProfileStore(dir);
    store.update('a', { username: 'Toshi_92', favClass: 'medic' });
    expect(store.update('a', { emblem: 'bolt.3' }).emblem).toBe('bolt.3');
    expect(() => store.update('a', { emblem: 'unicorn.1' })).toThrow(/emblem/);
    expect(() => store.update('a', { emblem: 'bolt.99' })).toThrow(/emblem/);
    // A title only once the career has earned it.
    expect(() => store.update('a', { title: 'recruit' })).toThrow(/not earned/);
    expect(() => store.update('a', { title: 'emperor' })).toThrow(/unknown title/);
    store.addMatch('a', match());
    expect(store.update('a', { title: 'recruit' }).title).toBe('recruit');
    expect(() => store.update('a', { title: 'veteran' })).toThrow(/not earned/);
    const card = store.card('toshi_92');
    expect(card).toMatchObject({ username: 'Toshi_92', emblem: 'bolt.3', title: 'recruit', favClass: 'medic', career: { matches: 1, kills: 12 } });
    // Public fields only: no account id, no region.
    expect(Object.keys(card!).sort()).toEqual(['career', 'emblem', 'favClass', 'title', 'username', 'vouched']);
    expect(store.card('nobody')).toBeNull();
    expect(store.update('a', { emblem: null }).emblem).toBeNull();
    store.flush();
    expect(new ProfileStore(dir).get('a')).toMatchObject({ title: 'recruit', emblem: null });
  });

  it('serves a public card to anyone, without sign-in', async () => {
    const store = new ProfileStore(temp());
    store.update('a', { username: 'Toshi_92', emblem: 'star.2' });
    const handle = profileHandler(store, { verify: null, trustProxy: false });
    const server = createServer((req, res) => void handle(req, res, () => ((res.statusCode = 404), res.end())));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    cleanup.push(() => server.close());
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/profile`;
    const ok = await fetch(`${base}/card?u=TOSHI_92`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ username: 'Toshi_92', emblem: 'star.2' });
    expect((await fetch(`${base}/card?u=nobody`)).status).toBe(404);
    // The rest still needs sign-in (here: none set up).
    expect((await fetch(base)).status).toBe(404);
  });

  it("Phase 3: a match's history line keeps its time when it's believable, else the hub's", () => {
    const store = new ProfileStore(temp());
    const now = Math.floor(Date.now() / 1000);
    store.addMatch('a', match({ at: now - 3600, map: 'Sky Islands', weaponRounds: { 'core.rifle': [100, 30] } }));
    store.addMatch('a', match({ at: now + 86_400 }));
    const c = store.addMatch('a', match({ at: 5 }));
    expect(c.history.map((h) => h.at - now)).toEqual([expect.closeTo(0, -1), expect.closeTo(0, -1), -3600]);
    expect(c.history[2]!.map).toBe('Sky Islands');
    expect(c.modes['core.tdm']?.matches ?? Object.values(c.modes)[0]!.matches).toBe(3);
    expect(c.weaponRounds['core.rifle']).toEqual([100, 30]);
  });

  it('Phase 4: counts a host\'s standings only for accounts it gave a ticket for that game, never the host, never faster than play', () => {
    const store = new ProfileStore(temp());
    let t = 1_000_000_000;
    store.now = () => t;
    store.ticketIssued('ABCD', 'p1');
    store.ticketIssued('ABCD', 'host');
    t += 10 * 60_000;
    const line = (sub: string, o: object = {}) => ({ sub, result: 'win', kills: 7, deaths: 3, seconds: 300, ...o });
    expect(store.vouch('host', { code: 'ABCD', mode: 'core.tdm', lines: [line('p1'), line('host'), line('p2'), line('p1')] })).toEqual({ counted: 1 });
    expect(store.get('p1').vouched).toEqual({ matches: 1, wins: 1, kills: 7, deaths: 3, seconds: 300 });
    expect(store.get('host').vouched.matches).toBe(0);
    expect(store.get('p2').vouched.matches).toBe(0);
    // Another match at once: no time has passed for it.
    expect(store.vouch('host', { code: 'ABCD', mode: 'core.tdm', lines: [line('p1')] }).counted).toBe(0);
    t += 6 * 60_000;
    expect(store.vouch('host', { code: 'ABCD', mode: 'core.tdm', lines: [line('p1', { result: 'loss' })] }).counted).toBe(1);
    // Another game's code: no ticket for it.
    expect(store.vouch('host', { code: 'WXYZ', mode: 'core.tdm', lines: [line('p1')] }).counted).toBe(0);
    // Hours later the hub has forgotten the ticket.
    t += 7 * 3600_000;
    expect(store.vouch('host', { code: 'ABCD', mode: 'core.tdm', lines: [line('p1')] }).counted).toBe(0);
    expect(() => store.vouch('host', { code: 'ABCD', mode: 'core.tdm', lines: [line('p1', { kills: 501 })] })).toThrow(/range/);
    expect(() => store.vouch('host', { code: 'ABCD', mode: 'core.tdm', lines: [line('p1', { seconds: 5 })] })).toThrow(/short/);
    expect(store.get('p1').vouched).toMatchObject({ matches: 2, wins: 1 });
    store.update('p1', { username: 'Toshi_92' });
    expect(store.card('toshi_92')?.vouched.matches).toBe(2);
  });

  it('keeps optic picks with the account (owner, 2026-11-22, "3a")', () => {
    const store = new ProfileStore(temp());
    expect(store.get('a').optics).toEqual({});
    expect(store.update('a', { optics: { 'core.rifle': 'holo' } }).optics).toEqual({ 'core.rifle': 'holo' });
    expect(() => store.update('a', { optics: { 'core.rifle': '<img>' } })).toThrow(/optic/);
    expect(() => store.update('a', { optics: ['holo'] })).toThrow(/optic/);
    expect(store.update('a', { optics: {} }).optics).toEqual({});
    // Not on the public card.
    store.update('a', { username: 'Toshi_92', optics: { 'core.rifle': 'holo' } });
    expect(store.card('toshi_92')).not.toHaveProperty('optics');
  });

  it('keeps key bindings with the account (owner, 2026-11-23: "saved with the profile")', () => {
    const store = new ProfileStore(temp());
    expect(store.get('a').keys).toEqual({});
    expect(store.update('a', { keys: { leanLeft: 'KeyP,', fire: 'Mouse0,KeyI' } }).keys).toEqual({ leanLeft: 'KeyP,', fire: 'Mouse0,KeyI' });
    // Odd entries are dropped, a non-map refused.
    expect(store.update('a', { keys: { leanLeft: '<img>', 'bad key': 'KeyQ,' } }).keys).toEqual({});
    expect(() => store.update('a', { keys: ['KeyQ'] })).toThrow(/key bindings/);
    store.update('a', { username: 'Toshi_92', keys: { leanLeft: 'KeyP,' } });
    expect(store.get('a').keys).toEqual({ leanLeft: 'KeyP,' });
    expect(store.card('toshi_92')).not.toHaveProperty('keys');
  });
});
