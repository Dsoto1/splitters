import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { regionForTimeZone, usernameProblem } from '@tiletrigger/shared';
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
    expect(store.get('a')).toEqual({ username: null, region: null });
    expect(store.update('a', { username: 'Toshi_92', region: 'na-east' })).toEqual({ username: 'Toshi_92', region: 'na-east' });
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
});
