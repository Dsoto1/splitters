import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { Unzipper } from '@tiletrigger/shared/peerZip';
import { claimsOfficial, parseAdvert } from '@tiletrigger/shared';
import { TicketSigner, verifyTicket } from '@tiletrigger/server/tickets';
import { LobbyAdvertiser } from '../src/advertiser.ts';
import { BanList } from '../src/bans.ts';
import { COMMANDS, complete, findMap, findPlayer, parseCommand, parseDuration, runMatchCommand, type MatchCommandTarget } from '../src/commands.ts';
import { ConfigError, DEFAULT_HUB, loadConfig, parseConfig } from '../src/config.ts';
import { originAllowed, ownPage, startConfig } from '../src/control.ts';
import { LogBuffer, launcherCsp, launcherPage, mapCatalog } from '../src/launcher.ts';
import { DEFAULT_MAPS_DIR, suiteIds } from '../src/host.ts';
import { syncMaps } from '../src/published.ts';
import { loadMap as loadMapDoc, serializeMap } from '@tiletrigger/shared';
import { admitWhenOpen, iceForLibdatachannel, makeJoinCode } from '../src/hubLink.ts';
import { LINK_LIMITS, peerConn, type DataLike } from '../src/peerConn.ts';
import { Supervisor } from '../src/supervisor.ts';
import type { PlayerInfo } from '@tiletrigger/server/server';

const tmp = () => mkdtempSync(join(tmpdir(), 'tt-host-'));

describe('Host Service settings', () => {
  it('defaults to the official hub, Frost Basin, listed, 16 people', () => {
    const c = parseConfig({});
    expect(c).toMatchObject({ hub: DEFAULT_HUB, map: 'frost_basin', visibility: 'listed', maxPlayers: 16, botFill: 24 });
  });

  it('reads the environment over a JSON file, and refuses what is off', () => {
    const files: Record<string, string> = { '/cfg/host.json': JSON.stringify({ MAP: 'sandgate', botFill: 10, SERVER_NAME: 'From file' }) };
    const c = loadConfig({ HOST_CONFIG: 'host.json', BOT_FILL: '96', MODE: 'core.tdm' }, '/cfg', (p) => files[p]!);
    expect(c).toMatchObject({ map: 'sandgate', botFill: 96, mode: 'core.tdm', name: 'From file' });
    expect(() => loadConfig({ HOST_CONFIG: 'host.json' }, '/cfg', () => '{"SHELL":"rm -rf"}')).toThrow(ConfigError);
    expect(() => parseConfig({ botFill: 97 })).toThrow(/BOT_FILL/);
    expect(() => parseConfig({ mode: 'core.chess' })).toThrow(/MODE/);
    expect(() => parseConfig({ joinCode: 'ABCDE1' })).toThrow(/JOIN_CODE/);
    expect(() => parseConfig({ adminToken: 'short' })).toThrow(/ADMIN_TOKEN/);
    // Plain http only for a hub on this machine or the home network.
    expect(() => parseConfig({ hub: 'http://example.com' })).toThrow(/https/);
    expect(parseConfig({ hub: 'http://127.0.0.1:9000/' }).hub).toBe('http://127.0.0.1:9000');
    // A map that isn't a suite ID is a file path (a community map), resolved from where it was started.
    expect(parseConfig({ map: 'my maps/arena.json' }, '/home/me').map).toBe('/home/me/my maps/arena.json');
  });

  it("lets the /host page set only checked settings, a suite map by ID, never a path or the hub", () => {
    const base = parseConfig({ hub: 'http://127.0.0.1:9000' });
    const suite = new Set(['frost_basin', 'sandgate']);
    expect(startConfig({ map: 'sandgate', botFill: 32, visibility: 'code', adminToken: 'longenough' }, base, suite)).toMatchObject({ map: 'sandgate', botFill: 32, visibility: 'code', hub: 'http://127.0.0.1:9000', adminToken: 'longenough' });
    expect(() => startConfig({ map: '../../etc/passwd' }, base, suite)).toThrow(ConfigError);
    expect(() => startConfig({ map: 'not_ours' }, base, suite)).toThrow(ConfigError);
    expect(() => startConfig({ hub: 'https://evil.example' }, base, suite)).toThrow(/unknown setting/);
    expect(() => startConfig({ playlist: '/tmp/x.json' }, base, suite)).toThrow(/unknown setting/);
  });
});

describe('server console commands', () => {
  it('parses commands, quoted words, and suggests near misses', () => {
    expect(parseCommand('  kick "Big Bob" camping  ')).toEqual({ ok: true, name: 'kick', args: ['Big Bob', 'camping'], rest: '"Big Bob" camping' });
    expect(parseCommand('/say hello all')).toMatchObject({ ok: true, name: 'say', rest: 'hello all' });
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('kik bob')).toMatchObject({ ok: false });
    expect((parseCommand('rm -rf /') as { error: string }).error).toMatch(/unknown command/);
  });

  it('completes command names and maps', () => {
    expect(complete('ba', [])[0]).toEqual(['ban', 'bans']);
    expect(complete('map fr', ['frost_basin', 'sandgate'])[0]).toEqual(['frost_basin']);
  });

  it('reads durations and finds players and maps', () => {
    expect([parseDuration('30'), parseDuration('2h'), parseDuration('7d'), parseDuration('1w'), parseDuration('soon')]).toEqual([30, 120, 10080, 10080, null]);
    const players = [{ slot: 3, name: 'Bob' }, { slot: 7, name: 'Bobby' }, { slot: 9, name: 'Ann' }] as PlayerInfo[];
    expect((findPlayer(players, '#7') as PlayerInfo).name).toBe('Bobby');
    expect((findPlayer(players, 'bob') as PlayerInfo).slot).toBe(3);
    expect(findPlayer(players, 'bo')).toMatch(/matches/);
    expect((findPlayer(players, 'an') as PlayerInfo).slot).toBe(9);
    const maps = new Map([['frost_basin', 'Frost Basin'], ['sandgate', 'Sandgate']]);
    expect(findMap(maps, 'Frost Basin')).toBe('frost_basin');
    expect(findMap(maps, 'sand')).toBe('sandgate');
    expect(findMap(maps, 'moon')).toBeNull();
  });

  it('turns console commands into the admin commands in-game admins have', () => {
    const sent: unknown[] = [];
    const t: MatchCommandTarget = {
      players: () => [{ slot: 4, name: 'Griefer', pk: 'p_abcdefgh', kills: 0, deaths: 0, ping: 50, team: null, admin: false }],
      command: (cmd) => (sent.push(cmd), null),
      say: (text) => sent.push({ say: text }),
      currentMapId: () => 'frost_basin',
      teams: () => 'teams',
      setVisibility: (v) => sent.push({ v }),
      setName: (n) => sent.push({ n }),
      maps: new Map([['sandgate', 'Sandgate']]),
    };
    expect(runMatchCommand('kick', ['griefer', 'spawn', 'camping'], '', t)).toBe('kicked Griefer');
    expect(runMatchCommand('ban', ['#4', '1d', 'cheating'], '', t)).toMatch(/banned Griefer for 1d \(guest/);
    expect(runMatchCommand('map', ['sandgate'], 'sandgate', t)).toMatch(/Sandgate/);
    expect(runMatchCommand('mode', ['ctf'], 'ctf', t)).toMatch(/Capture/);
    expect(runMatchCommand('bots', ['32'], '32', t)).toMatch(/32/);
    expect(runMatchCommand('teams', ['8'], '8', t)).toMatch(/8 each/);
    runMatchCommand('say', ['hi'], 'hi there', t);
    runMatchCommand('visibility', ['code'], 'code', t);
    expect(sent).toEqual([
      { c: 'kick', slot: 4, reason: 'spawn camping' },
      { c: 'ban', slot: 4, minutes: 1440, reason: 'cheating' },
      { c: 'map', map: 'sandgate' },
      { c: 'map', map: 'frost_basin', mode: 'core.ctf' },
      { c: 'bots', fill: 32 },
      { c: 'bots', teamSize: 8 },
      { say: 'hi there' },
      { v: 'code' },
    ]);
    expect(runMatchCommand('kick', ['nobody'], '', t)).toMatch(/no player/);
  });
});

describe('ban list', () => {
  it('bans accounts by account and guests by browser key or address, and survives a restart', () => {
    const file = join(tmp(), 'bans.json');
    let now = 1_000_000;
    const bans = new BanList(file, () => now);
    bans.add({ name: 'Signed', sub: 'acct-1', pk: 'p_aaaaaaaa', address: '203.0.113.5' }, 0, 'cheating', 'Console');
    bans.add({ name: 'Guest', pk: 'p_bbbbbbbb', address: '198.51.100.7' }, 60, '', 'Admin');
    // An account ban holds on to the account only (the same person on a shared address isn't caught by it).
    expect(bans.check({ name: 'x', sub: 'acct-1' })).toMatch(/banned.*cheating/);
    expect(bans.check({ name: 'x', address: '203.0.113.5' })).toBeNull();
    expect(bans.check({ name: 'x', pk: 'p_bbbbbbbb' })).toMatch(/banned/);
    expect(bans.check({ name: 'x', address: '198.51.100.7' })).toMatch(/until/);
    expect(JSON.parse(readFileSync(file, 'utf8')).bans).toHaveLength(2);
    // Another process (the match process) reads the same file.
    const again = new BanList(file, () => now);
    expect(again.list().map((b) => b.name)).toEqual(['Signed', 'Guest']);
    now += 61 * 60_000;
    expect(again.check({ name: 'x', pk: 'p_bbbbbbbb' })).toBeNull();
    expect(again.remove('signed')).toBe(1);
    utimesSync(file, new Date(), new Date(Date.now() + 5000));
    expect(bans.list()).toHaveLength(0);
    expect(() => bans.add({ name: 'Nobody' }, 0, '', 'x')).toThrow(/nothing to ban/);
  });
});

describe('listing', () => {
  it('lists the host as a dedicated host, and refuses names that pass for official', () => {
    const ad = { code: 'ABC234', name: 'Dave’s 48v48', host: 'Dave', map: 'Frost Basin', mode: 'core.tdm', players: 1, max: 16, version: 4, relay: true };
    expect(parseAdvert({ ...ad, hostType: 'dedicated' })?.hostType).toBe('dedicated');
    expect(parseAdvert({ ...ad, hostType: 'official' })?.hostType).toBeUndefined();
    expect(parseAdvert({ ...ad, official: true })).not.toHaveProperty('official');
    for (const fake of ['Official EU #1', 'ToshiroPlay servers', 'T1le Tr1gger 0fficial', 'tile-trigger staff', 'OFFICIAL']) expect(claimsOfficial(fake), fake).toBe(true);
    for (const fine of ["Dave's 48v48", 'Frost Friday', 'Trigger happy', 'Tiles and more']) expect(claimsOfficial(fine), fine).toBe(false);
  });

  it('keeps the listing up: lists, checks in, lists again after the hub forgot it, takes it down', async () => {
    const calls: string[] = [];
    let forgotten = false;
    const fetcher = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url.replace('http://hub/lobby/games', '')}`);
      if (init?.method === 'POST') return new Response(JSON.stringify({ id: 'abc123abc123', secret: 's' }), { status: 201 });
      if (init?.method === 'PUT') return new Response(null, { status: forgotten ? 404 : 204 });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const ad = new LobbyAdvertiser('http://hub', () => ({ code: 'ABC234', name: 'n', host: 'h', map: 'm', mode: 'core.tdm', players: 0, max: 16, relay: false }), () => undefined, fetcher, 1e9);
    await ad.tick();
    await ad.tick();
    forgotten = true;
    await ad.tick();
    expect(ad.listed).toBe(true);
    await ad.stop();
    expect(calls).toEqual(['POST ', 'PUT /abc123abc123', 'PUT /abc123abc123', 'POST ', 'DELETE /abc123abc123']);
  });

  it('keeps trying while the hub is down', async () => {
    let down = true;
    const fetcher = (async () => {
      if (down) throw new Error('ECONNREFUSED');
      return new Response(JSON.stringify({ id: 'abc123abc123', secret: 's' }), { status: 201 });
    }) as unknown as typeof fetch;
    const ad = new LobbyAdvertiser('http://hub', () => ({ code: 'ABC234', name: 'n', host: 'h', map: 'm', mode: 'core.tdm', players: 0, max: 16, relay: false }), () => undefined, fetcher, 1e9);
    await ad.tick();
    expect(ad.listed).toBe(false);
    expect(ad.error).toMatch(/couldn't reach/);
    down = false;
    await ad.tick();
    expect(ad.listed).toBe(true);
  });
});

/** A fake PeerJS DataConnection. */
class FakeDc extends EventEmitter implements DataLike {
  open = true;
  sent: (string | Uint8Array)[] = [];
  closed = false;
  bufferSize = 0;
  constructor(readonly metadata: unknown) {
    super();
  }
  send(d: string | Uint8Array) {
    this.sent.push(d);
  }
  close() {
    this.closed = true;
    this.open = false;
    this.emit('close');
  }
}

describe("a player's WebRTC link", () => {
  it('sends the compressed stream the browser expects, and counts its bytes', () => {
    const dc = new FakeDc({ z: 1 });
    const conn = peerConn(dc);
    const text = JSON.stringify({ t: 'snapshot', players: Array.from({ length: 50 }, (_, i) => ({ s: i, p: [i, 1, i] })) });
    const bytes = conn.send(text);
    const unzip = new Unzipper();
    const out = dc.sent.map((p) => unzip.piece(p as Uint8Array)).filter(Boolean);
    expect(out).toEqual([text]);
    expect(bytes).toBeLessThan(text.length / 2);
  });

  it("refuses binary or oversized messages from a player, and drops a player who can't keep up", async () => {
    vi.useFakeTimers();
    const dc = new FakeDc({ z: 1 });
    const conn = peerConn(dc);
    const got: string[] = [];
    conn.onMessage((t) => got.push(t));
    let closed = false;
    conn.onClose(() => (closed = true));
    dc.emit('data', '{"t":"ready"}');
    dc.emit('data', new Uint8Array([1, 2]));
    vi.advanceTimersByTime(LINK_LIMITS.closeDelayMs + 1);
    expect(got).toEqual(['{"t":"ready"}']);
    expect(dc.closed && closed).toBe(true);
    const slow = new FakeDc({ z: 1 });
    const c2 = peerConn(slow);
    slow.bufferSize = LINK_LIMITS.maxBacklog + 1;
    expect(c2.send('{"t":"snapshot"}')).toBe(0);
    vi.advanceTimersByTime(LINK_LIMITS.closeDelayMs + 1);
    expect(slow.closed).toBe(true);
    const big = new FakeDc({});
    peerConn(big).onMessage(() => undefined);
    big.emit('data', 'x'.repeat(70 * 1024));
    vi.advanceTimersByTime(LINK_LIMITS.closeDelayMs + 1);
    expect(big.closed).toBe(true);
    vi.useRealTimers();
  });
});

describe('WebRTC and relay details', () => {
  it("escapes coturn's REST usernames for libdatachannel", () => {
    const [stun, turn] = iceForLibdatachannel([{ urls: 'stun:x:3478' }, { urls: ['turn:x:3478'], username: '1798403600:s_ABC234.host', credential: 'a+b/c=' }]);
    expect(stun).toEqual({ urls: 'stun:x:3478' });
    expect(turn).toEqual({ urls: ['turn:x:3478'], username: '1798403600%3As_ABC234.host', credential: 'a%2Bb%2Fc%3D' });
    expect(makeJoinCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });

  it('checks account tickets: signature, join code, expiry', () => {
    const hub = new TicketSigner();
    const keys = new Map(hub.keys().keys.map((k) => [k.kid, k.x]));
    const { ticket } = hub.sign('acct-42', 'ABC234', 1_000_000);
    expect(verifyTicket(ticket, 'ABC234', keys, 1_000_000)?.sub).toBe('acct-42');
    expect(verifyTicket(ticket, 'XYZ789', keys, 1_000_000)).toBeNull();
    expect(verifyTicket(ticket, 'ABC234', keys, 1_000_000 + 121_000)).toBeNull();
    const forged = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(ticket.split('.')[0]!, 'base64url').toString()), sub: 'admin' })).toString('base64url')}.${ticket.split('.')[1]}`;
    expect(verifyTicket(forged, 'ABC234', keys, 1_000_000)).toBeNull();
    expect(verifyTicket(new TicketSigner().sign('a', 'ABC234', 1_000_000).ticket, 'ABC234', keys, 1_000_000)).toBeNull();
  });
});

describe('control API', () => {
  it('lets only the official site and local pages use it', () => {
    expect(originAllowed('https://trigger.toshiroplay.com')).toBe(true);
    expect(originAllowed('http://localhost:5173')).toBe(true);
    expect(originAllowed('http://127.0.0.1:4173')).toBe(true);
    expect(originAllowed('https://evil.example')).toBe(false);
    expect(originAllowed('https://trigger.toshiroplay.com.evil.example')).toBe(false);
    expect(originAllowed('http://trigger.toshiroplay.com')).toBe(false);
    expect(originAllowed('null')).toBe(false);
    expect(originAllowed('https://friend.example', ['https://friend.example'])).toBe(true);
  });

  it("gives the console only to the launcher's own page", () => {
    expect(ownPage('http://127.0.0.1:7797', 7797)).toBe(true);
    expect(ownPage('http://localhost:7797', 7797)).toBe(true);
    expect(ownPage(undefined, 7797)).toBe(true);
    // The site's /host page and other local pages use the API, not the console.
    expect(ownPage('https://trigger.toshiroplay.com', 7797)).toBe(false);
    expect(ownPage('http://localhost:5173', 7797)).toBe(false);
  });
});

describe('launcher', () => {
  it('keeps the last console lines, numbered, and starts a page over after a restart', () => {
    const b = new LogBuffer(5);
    b.push('log', 'a\nb');
    b.push('cmd', 'status', 'launcher');
    expect(b.since(0)).toMatchObject({ next: 3, reset: false, lines: [{ n: 1, text: 'a' }, { n: 2, text: 'b' }, { n: 3, kind: 'cmd', from: 'launcher' }] });
    for (let i = 0; i < 10; i++) b.push('out', `x${i}`);
    const r = b.since(3);
    expect(r.lines).toHaveLength(5);
    expect(r.lines[0]!.n).toBe(9);
    expect(b.since(13)).toEqual({ lines: [], next: 13, reset: false });
    expect(b.since(500)).toMatchObject({ reset: true, next: 13 });
  });

  it("lists our maps with their names and modes, and nothing in the page's data can end its script", () => {
    const maps = mapCatalog(DEFAULT_MAPS_DIR, suiteIds(DEFAULT_MAPS_DIR));
    expect(maps.length).toBeGreaterThan(20);
    expect(maps.find((m) => m.id === 'frost_basin')).toMatchObject({ name: 'Frost Basin', modes: expect.arrayContaining([expect.objectContaining({ id: 'core.tdm', team: true })]) });
    const html = launcherPage({ version: '1.0.0', commands: COMMANDS, maps: [{ id: 'x', name: '</script><script>alert(1)</script>', modes: [] }], site: 'https://trigger.toshiroplay.com' }, 'N0NCE');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html.match(/<script nonce="N0NCE">/g)).toHaveLength(1);
    expect(launcherCsp('N0NCE', 'https://trigger.toshiroplay.com')).toMatch(/script-src 'nonce-N0NCE'.*connect-src 'self'.*frame-ancestors 'none'/);
  });

  it('opens from the console with launcher', () => {
    expect(parseCommand('launcher')).toMatchObject({ ok: true, name: 'launcher' });
  });
});

/** A fake match process. */
class FakeChild extends EventEmitter {
  sent: unknown[] = [];
  killed: string | null = null;
  send(m: unknown) {
    this.sent.push(m);
    return true;
  }
  kill(sig: string) {
    this.killed = sig;
    queueMicrotask(() => this.emit('exit', null, sig));
    return true;
  }
}

describe('supervisor', () => {
  const config = parseConfig({});
  const policy = { firstDelayMs: 10, maxDelayMs: 40, maxCrashes: 3, windowMs: 60_000, hangMs: 60_000, stopGraceMs: 50 };

  it('restarts a crashed match under the same join code, and stops after a crash loop', async () => {
    const children: FakeChild[] = [];
    const sup = new Supervisor(() => (children.push(new FakeChild()), children.at(-1) as unknown as ChildProcess), () => undefined, policy);
    await sup.start(config);
    children[0]!.emit('message', { t: 'up', code: 'ABC234', token: 'tok123456' });
    expect(sup.state).toBe('running');
    children[0]!.emit('exit', 1, null);
    expect(sup.state).toBe('restarting');
    await vi.waitFor(() => expect(children).toHaveLength(2));
    expect(children[1]!.sent[0]).toMatchObject({ t: 'start', resume: { code: 'ABC234', token: 'tok123456' } });
    children[1]!.emit('exit', 1, null);
    await vi.waitFor(() => expect(children).toHaveLength(3));
    children[2]!.emit('exit', 1, null);
    expect(sup.state).toBe('crashloop');
    expect(sup.status().lastError?.summary).toMatch(/stopped unexpectedly/);
  });

  it("doesn't restart a server that can't start (a bad setting), and stops cleanly", async () => {
    const children: FakeChild[] = [];
    const sup = new Supervisor(() => (children.push(new FakeChild()), children.at(-1) as unknown as ChildProcess), () => undefined, policy);
    await sup.start(config);
    children[0]!.emit('message', { t: 'failed', error: 'MAP x is not one of our maps' });
    children[0]!.emit('exit', 3, null);
    expect(sup.state).toBe('stopped');
    expect(sup.status().lastError?.summary).toMatch(/MAP x/);
    await sup.start(config);
    children[1]!.emit('message', { t: 'up', code: 'ABC234', token: 'tok123456' });
    const stopping = sup.stop();
    expect(children[1]!.sent.at(-1)).toMatchObject({ t: 'stop' });
    children[1]!.emit('exit', 0, null);
    await stopping;
    expect(sup.state).toBe('stopped');
    expect(children).toHaveLength(2);
  });

  it('kills a hung match process (no status) and restarts it', async () => {
    const children: FakeChild[] = [];
    const sup = new Supervisor(() => (children.push(new FakeChild()), children.at(-1) as unknown as ChildProcess), () => undefined, { ...policy, hangMs: 60 });
    await sup.start(config);
    await vi.waitFor(() => expect(children[0]!.killed).toBe('SIGKILL'), { timeout: 2000 });
    await vi.waitFor(() => expect(children.length).toBeGreaterThanOrEqual(2), { timeout: 2000 });
    expect(sup.status().lastError?.summary).toMatch(/stopped responding/);
    await sup.stop();
  });
});

describe("a friend's connection is admitted once", () => {
  /** A PeerJS DataConnection whose channel is already open when handed over (node-datachannel), its own open event late. */
  class LateOpenConn extends EventEmitter {
    open = false;
    closed = false;
    dataChannel = { readyState: 'open', onopen: null as ((e: unknown) => void) | null };
    constructor() {
      super();
      // What PeerJS does with the channel's open event: mark the connection open and say so.
      this.dataChannel.onopen = () => {
        this.open = true;
        this.emit('open');
      };
    }
    close() {
      this.closed = true;
    }
  }

  it('admits on the first "open" only, whether PeerJS saw the event or hubLink supplied it', async () => {
    const conn = new LateOpenConn();
    const admitted: unknown[] = [];
    admitWhenOpen(conn, (c) => admitted.push(c), 5000);
    // hubLink gives PeerJS the open event it missed...
    await vi.waitFor(() => expect(admitted).toHaveLength(1), { timeout: 2000 });
    // ...then libdatachannel's replayed event arrives and PeerJS says "open" again: one player, not two.
    conn.dataChannel.onopen?.({ type: 'open' });
    expect(admitted).toHaveLength(1);
    expect(conn.closed).toBe(false);
  });

  it("refuses a second player on one channel (two deflate streams would garble the friend's)", () => {
    const dc = new FakeDc({ z: 1 });
    peerConn(dc);
    expect(() => peerConn(dc)).toThrow(/already has a player/);
  });
});

describe('published maps on a Host Service', () => {
  it('lays the published versions over its own maps, follows take-downs, and keeps going offline', async () => {
    const bundled = tmp();
    const dir = tmp();
    const { copyFileSync, readFileSync: read, existsSync } = await import('node:fs');
    for (const id of ['frost_basin', 'sandgate']) copyFileSync(join(DEFAULT_MAPS_DIR, `${id}.json`), join(bundled, `${id}.json`));
    const doc = (id: string, name: string, newId = id) => {
      const r = loadMapDoc(read(join(DEFAULT_MAPS_DIR, `${id}.json`), 'utf8'));
      if (!r.ok) throw new Error('map failed to load');
      return serializeMap({ ...r.map, metadata: { ...r.map.metadata, id: newId, name } });
    };
    let hub: Record<string, { text: string; hash: string; at: number }> | null = {};
    const fetcher = (async (url: string) => {
      if (!hub) throw new Error('offline');
      const m = /\/api\/v1\/maps(?:\/(\w+))?/.exec(url)!;
      if (!m[1]) return new Response(JSON.stringify({ maps: Object.entries(hub).map(([id, v]) => ({ id, hash: v.hash, at: v.at })) }));
      return hub[m[1]] ? new Response(hub[m[1]]!.text) : new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;
    const name = (id: string) => JSON.parse(read(join(dir, `${id}.json`), 'utf8')).metadata.name;

    expect(await syncMaps(bundled, dir, 'http://hub', fetcher)).toMatchObject({ published: 0, online: true });
    expect(name('frost_basin')).toBe('Frost Basin');
    hub = { frost_basin: { text: doc('frost_basin', 'Frost Basin Fixed'), hash: 'h1', at: 1 }, owner_new: { text: doc('sandgate', 'New One', 'owner_new'), hash: 'h2', at: 2 } };
    expect(await syncMaps(bundled, dir, 'http://hub', fetcher)).toMatchObject({ published: 2, added: ['owner_new'] });
    expect(name('frost_basin')).toBe('Frost Basin Fixed');
    expect(suiteIds(dir).has('owner_new')).toBe(true);
    // The hub can't be reached: everything stays as it was.
    const saved = hub;
    hub = null;
    expect(await syncMaps(bundled, dir, 'http://hub', fetcher)).toMatchObject({ online: false, published: 2 });
    expect(name('frost_basin')).toBe('Frost Basin Fixed');
    // Taken down: back to the map that came with it; the added one goes.
    expect(Object.keys(saved)).toHaveLength(2);
    hub = {};
    await syncMaps(bundled, dir, 'http://hub', fetcher);
    expect(name('frost_basin')).toBe('Frost Basin');
    expect(existsSync(join(dir, 'owner_new.json'))).toBe(false);
  });
});
