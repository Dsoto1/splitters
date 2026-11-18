import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyCareer, regionForTimeZone, usernameProblem, type MatchSummary } from '@tiletrigger/shared';
import { ProfileStore } from '../src/profiles.ts';
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
  it('gives each account a unique username (whatever the case) and a region, kept across restarts', () => {
    const dir = temp();
    const store = new ProfileStore(dir);
    expect(store.get('a')).toEqual({ username: null, region: null, favClass: null, career: emptyCareer() });
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
});
