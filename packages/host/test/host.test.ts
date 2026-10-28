import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createBroker } from '@tiletrigger/server/broker';
import { LobbyStore, lobbyHandler } from '@tiletrigger/server/lobby';
import { iceFromEnv } from '@tiletrigger/server/ice';
import { TicketSigner } from '@tiletrigger/server/tickets';
import { accountHandler } from '@tiletrigger/server/auth';
import { BanList } from '../src/bans.ts';
import { parseConfig } from '../src/config.ts';
import { DEFAULT_MAPS_DIR, startHost, suiteIds, type RunningHost } from '../src/host.ts';
import { joinAsGuest, type Guest } from './guest.ts';

/** The hub's pieces in this process (as hub.ts wires them), on a port of its own; `port` reuses one (a hub restart). */
async function startHub(port = 0, tickets = new TicketSigner()): Promise<{ url: string; port: number; store: LobbyStore; tickets: TicketSigner; close(): Promise<void> }> {
  const server: Server = createServer();
  // Every socket, upgraded ones (the broker's WebSockets) included: closing the hub cuts them all, as a hub restart does.
  const sockets = new Set<import('node:net').Socket>();
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  const broker = createBroker(server, false);
  const store = new LobbyStore(Date.now, { suite: suiteIds(DEFAULT_MAPS_DIR) });
  const ice = iceFromEnv({ TURN_SECRET: 'test-secret', TURN_URLS: 'turn:127.0.0.1:3478' } as NodeJS.ProcessEnv);
  const lobby = lobbyHandler(store, { ice, isLive: (code) => broker.isLive(code) });
  const account = accountHandler(null, false, undefined, tickets);
  server.on('request', (req, res) => {
    const notFound = () => void ((res.statusCode = 404), res.end());
    if ((req.url ?? '').startsWith('/broker')) return broker.handle(req, res, notFound);
    void lobby(req, res, () => void account(req, res, notFound));
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', () => r()));
  const p = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${p}`,
    port: p,
    store,
    tickets,
    close: () =>
      new Promise<void>((r) => {
        server.close(() => r());
        for (const s of sockets) s.destroy();
      }),
  };
}

/**
 * node-datachannel can hand the host a friend's channel already open, its open event replayed later (after
 * PeerJS has, or hasn't, attached its handler). Delaying every channel's open event recreates that order on
 * any machine: hubLink supplies the missed event, then the real one arrives. Undone by the returned function.
 */
async function lateOpenEvents(ms: number): Promise<() => void> {
  const poly = (await import('node-datachannel/polyfill')) as unknown as { RTCDataChannel: { prototype: { dispatchEvent(e: Event): boolean } } };
  const proto = poly.RTCDataChannel.prototype;
  const real = proto.dispatchEvent;
  proto.dispatchEvent = function (this: unknown, e: Event) {
    if (e.type !== 'open') return real.call(this, e);
    setTimeout(() => real.call(this, e), ms);
    return true;
  };
  return () => void (proto.dispatchEvent = real);
}

const until = (fn: () => unknown, timeout = 20_000) => vi.waitFor(() => expect(fn(), fn.toString()).toBeTruthy(), { timeout, interval: 100 });

describe('Host Service: a channel handed over already open', () => {
  it('gets one player and one intact stream (no second admission interleaving deflate streams)', async () => {
    const restore = await lateOpenEvents(400);
    const hub = await startHub();
    const host = await startHost(parseConfig({ hub: hub.url, map: 'sandgate', botFill: 4, name: 'Late open' }), { log: () => undefined });
    try {
      const guests = await Promise.all(['A', 'B', 'C'].map((n) => joinAsGuest(hub.url, host.code, n)));
      for (const g of guests) {
        await until(() => g.welcome);
        g.send({ t: 'ready' });
      }
      // A garbled stream throws in the guest's JSON.parse (the test fails) and stops its snapshots.
      for (const g of guests) await until(() => g.snapshots > 30);
      expect(host.server.players().map((p) => p.name).sort()).toEqual(['A', 'B', 'C']);
      for (const g of guests) g.close();
    } finally {
      restore();
      await host.stop();
      await hub.close();
    }
  }, 90_000);
});

describe('Host Service: a Node player joins whatever order the network delivers in', () => {
  it("can't be reached before it has recorded the host's answer (libdatachannel offerer race), and joins with a late answer", async () => {
    const hub = await startHub();
    const host = await startHost(parseConfig({ hub: hub.url, map: 'sandgate', botFill: 4, name: 'Late answer' }), { log: () => undefined });
    try {
      // What the player sends, and its signaling state each time (have-local-offer until the answer is recorded).
      const sent: { type: string; state?: string; sdp?: string }[] = [];
      const g = await joinAsGuest(hub.url, host.code, 'Patient', {}, { answerDelayMs: 600, onSignal: (type, state, sdp) => sent.push({ type, state, sdp }) });
      const offer = sent.find((m) => m.type === 'OFFER');
      // The offer gives the host no address: it can't start ICE (and DTLS) towards this player early...
      expect(offer?.sdp).toBeTruthy();
      expect(offer!.sdp).not.toMatch(/a=candidate:/);
      // ...and the candidates go only once the answer is recorded (signaling back to stable).
      const candidates = sent.filter((m) => m.type === 'CANDIDATE');
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.every((m) => m.state === 'stable')).toBe(true);
      await until(() => g.welcome);
      g.send({ t: 'ready' });
      await until(() => g.snapshots > 10);
      g.close();
    } finally {
      await host.stop();
      await hub.close();
    }
  }, 90_000);
});

describe('Host Service end to end (hub, host and players in this process)', () => {
  const cleanup: (() => unknown)[] = [];
  afterAll(async () => {
    for (const f of cleanup.reverse()) await f();
  });

  it('registers, lists itself as a dedicated host with a relay, and players join, play, get kicked and banned', async () => {
    let hub = await startHub();
    cleanup.push(() => hub.close());
    const bans = new BanList(join(mkdtempSync(join(tmpdir(), 'tt-bans-')), 'bans.json'));
    const events: string[] = [];
    const host: RunningHost = await startHost(parseConfig({ hub: hub.url, map: 'sandgate', botFill: 8, name: 'Test dedicated', adminToken: 'sesame-123' }), { bans, onEvent: (l) => events.push(l), log: () => undefined });
    cleanup.push(() => host.stop());
    expect(host.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    await until(() => hub.store.list().length === 1);
    const listing = hub.store.list()[0]!;
    expect(listing).toMatchObject({ code: host.code, name: 'Test dedicated', hostType: 'dedicated', mapId: 'sandgate', community: false, relay: true, max: 16 });

    const ana: Guest = await joinAsGuest(hub.url, host.code, 'Ana', { pk: 'p_anaanaana' });
    cleanup.push(() => ana.close());
    await until(() => ana.welcome);
    expect(ana.welcome).toMatchObject({ dedicated: true, protocol: 4 });
    ana.send({ t: 'ready' });
    await until(() => ana.snapshots > 10);
    expect(host.status().players).toBe(1);
    await until(() => hub.store.list()[0]?.players === 1, 30_000);

    // A signed-in player: the hub's ticket names the account; the host never sees a sign-in token.
    const { ticket } = hub.tickets.sign('acct-bob', host.code);
    const bob = await joinAsGuest(hub.url, host.code, 'Bob', { pk: 'p_bobbobbob', ticket });
    cleanup.push(() => bob.close());
    await until(() => bob.welcome);
    await until(() => host.server.players().find((p) => p.name === 'Bob')?.sub === 'acct-bob');
    expect(host.server.players().find((p) => p.name === 'Ana')?.sub).toBeUndefined();

    // Kick: told why, and out; may come back.
    const anaSlot = host.server.players().find((p) => p.name === 'Ana')!.slot;
    expect(host.commands.command({ c: 'kick', slot: anaSlot, reason: 'test' }, 'Console')).toBeNull();
    await until(() => ana.rejected);
    expect(ana.rejected).toMatch(/kicked.*test/);
    await until(() => !host.server.players().some((p) => p.name === 'Ana'));

    // Ban by account: Bob can't come back, even under another name and browser key.
    const bobSlot = host.server.players().find((p) => p.name === 'Bob')!.slot;
    expect(host.commands.command({ c: 'ban', slot: bobSlot, reason: 'cheating' }, 'Console')).toBeNull();
    await until(() => bob.rejected);
    expect(bans.list()[0]).toMatchObject({ name: 'Bob', sub: 'acct-bob', reason: 'cheating' });
    const again = await joinAsGuest(hub.url, host.code, 'NotBob', { pk: 'p_otherkey1', ticket: hub.tickets.sign('acct-bob', host.code).ticket });
    cleanup.push(() => again.close());
    await until(() => again.rejected);
    expect(again.rejected).toMatch(/banned.*cheating/);
    expect(events.some((e) => /Bob joined \(signed in/.test(e)) && events.some((e) => /refused NotBob/.test(e))).toBe(true);

    // The hub goes away and comes back (a restart: same address, new key): the host re-registers its code and re-lists.
    const stay = await joinAsGuest(hub.url, host.code, 'Stay');
    cleanup.push(() => stay.close());
    await until(() => stay.welcome);
    stay.send({ t: 'ready' });
    await hub.close();
    await until(() => !host.status().online);
    // Players already in play on over their own connection while the hub is away.
    const before = stay.snapshots;
    await until(() => stay.snapshots > before + 30);
    expect(stay.closed).toBe(false);
    hub = await startHub(hub.port);
    await until(() => host.status().online, 40_000);
    await until(() => hub.store.list().some((g) => g.code === host.code), 40_000);
    const late = await joinAsGuest(hub.url, host.code, 'Late');
    cleanup.push(() => late.close());
    await until(() => late.welcome);

    await host.stop();
    await until(() => hub.store.list().length === 0);
  }, 120_000);
});
