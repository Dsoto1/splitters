import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, blockedWord, loadMap, mapIdentity, mapTextProblem, missingForPick, parseThresholds, reportsHide, serializeMap, type PlayReport } from '@tiletrigger/shared';
import { TokenError, type VerifiedUser } from '../src/auth.ts';
import { CommunityStore, communityHandler, summaryText, type PickCheck } from '../src/community.ts';
import { checkCommunityMap, checkInWorker } from '../src/communityCheck.ts';
import { LobbyStore } from '../src/lobby.ts';
import { PublishedMaps } from '../src/publish.ts';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup.splice(0)) f();
});
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'tt-community-'));
  cleanup.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
};

const HASH = `sha256:${'a'.repeat(64)}`;
const HASH2 = `sha256:${'b'.repeat(64)}`;
const advert = (over: Record<string, unknown> = {}) => ({ code: 'ABC234', name: 'Friday night', host: 'Dave', map: 'Dune Run', mode: 'core.tdm' as const, players: 2, max: 8, version: 2, relay: false, community: true, mapId: 'm_abcdefghijklmnop', versionId: 'v_abcdefghijklmnop', contentHash: HASH, ...over });
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const okCheck = async (): Promise<PickCheck> => ({ ok: true, name: 'Dune Run', description: 'Sand.', modes: ['core.tdm'], recommendedPlayers: { min: 2, max: 12 } });

/** A store, a clock, and a hub that listed the map (creator `creator`) under join code `code`. */
function setup(o: { creator?: string; thresholds?: Partial<typeof DEFAULT_THRESHOLDS> } = {}) {
  const clock = { t: Date.UTC(2026, 10, 1, 12) };
  const store = new CommunityStore(temp(), { ...DEFAULT_THRESHOLDS, ...o.thresholds }, [], () => clock.t);
  store.listed(advert(), o.creator ?? 'creator-sub', 'MapMaker99');
  return { clock, store };
}

/** A match hosted by `host` with these accounts (each given a ticket for the code first), reported at its end. */
function play(store: CommunityStore, host: string, players: { sub: string; minutes?: number; early?: boolean }[], code = 'ABC234', hash = HASH) {
  for (const p of players) store.ticketIssued(code, p.sub);
  const r: PlayReport = { code, contentHash: hash, players: players.map((p) => ({ sub: p.sub, minutes: p.minutes ?? 10, early: !!p.early })) };
  return store.report(host, r);
}

describe('community map play statistics', () => {
  it('counts each signed-in account once per map version, and the time played', () => {
    const { clock, store } = setup();
    expect(play(store, 'host-1', [{ sub: 'p1' }, { sub: 'p2', minutes: 5 }]).counted).toBe(2);
    clock.t += 2 * HOUR;
    play(store, 'host-1', [{ sub: 'p1' }, { sub: 'p3' }]);
    const row = store.mine('creator-sub')[0]!.versions[0]!;
    expect(row).toMatchObject({ players: 3, hosts: 1, days: 1, matches: 2, minutes: 35 });
  });

  it("doesn't count accounts the hub gave no ticket for this game (a host can't make players up), bots or the creator", () => {
    const { store } = setup();
    // p-fake never asked the hub to join; a bot has no account; the creator's own play doesn't count.
    store.ticketIssued('ABC234', 'p1');
    store.ticketIssued('ABC234', 'creator-sub');
    const r = store.report('host-1', { code: 'ABC234', contentHash: HASH, players: [{ sub: 'p1', minutes: 9, early: false }, { sub: 'p-fake', minutes: 9, early: false }, { sub: 'creator-sub', minutes: 9, early: false }] });
    expect(r.counted).toBe(1);
    // The host's own account counts (its sign-in proves it).
    const { store: s2 } = setup();
    expect(s2.report('host-2', { code: 'ABC234', contentHash: HASH, players: [{ sub: 'host-2', minutes: 9, early: false }] }).counted).toBe(1);
  });

  it('takes at most one match an hour from each host', () => {
    const { clock, store } = setup();
    expect(play(store, 'host-1', [{ sub: 'p1' }]).counted).toBe(1);
    clock.t += 30 * 60_000;
    const again = play(store, 'host-1', [{ sub: 'p2' }]);
    expect(again.counted).toBe(0);
    expect(again.reason).toMatch(/within the hour/);
    expect(play(store, 'host-2', [{ sub: 'p2' }]).counted).toBe(1);
    clock.t += 31 * 60_000;
    expect(play(store, 'host-1', [{ sub: 'p3' }]).counted).toBe(1);
  });

  it("refuses a report for a code that wasn't a community listing of that map", () => {
    const { store } = setup();
    expect(() => play(store, 'host-1', [{ sub: 'p1' }], 'ZZZ234')).toThrow(/no community listing/);
    expect(() => play(store, 'host-1', [{ sub: 'p1' }], 'ABC234', HASH2)).toThrow(/no community listing/);
  });

  it('keeps an early quitter as one only while every counted play of theirs was early', () => {
    const { clock, store } = setup();
    play(store, 'host-1', [{ sub: 'p1', minutes: 1, early: true }, { sub: 'p2', minutes: 1, early: true }]);
    clock.t += 2 * HOUR;
    play(store, 'host-1', [{ sub: 'p1', minutes: 20 }]);
    expect(store.mine('creator-sub')[0]!.versions[0]!.earlyQuits).toBe(1);
  });

  it("doesn't count the creator as one of the hosts", () => {
    const { store } = setup();
    play(store, 'creator-sub', [{ sub: 'p1' }]);
    expect(store.mine('creator-sub')[0]!.versions[0]).toMatchObject({ players: 1, hosts: 0 });
  });

  it('survives a hub restart', () => {
    const { store } = setup();
    play(store, 'host-1', [{ sub: 'p1' }]);
    store.saveNow();
    const again = new CommunityStore(store.dir);
    expect(again.mine('creator-sub')[0]!.versions[0]!.players).toBe(1);
    // No account is kept in the clear.
    const file = readFileSync(join(store.dir, 'community.json'), 'utf8');
    expect(file).not.toContain('creator-sub');
    expect(file).not.toContain('"p1"');
  });
});

describe('promotion thresholds', () => {
  const tally = { players: 25, earlyQuits: 7, hosts: 5, days: 3, reports: 0 };
  it('are the plan\'s starting values, and each one holds a map back', () => {
    expect(DEFAULT_THRESHOLDS).toMatchObject({ players: 25, hosts: 5, days: 3, earlyQuitRate: 0.3, reportsPer100: 3 });
    expect(missingForPick(tally)).toEqual([]);
    expect(missingForPick({ ...tally, players: 24 })).toEqual(['24/25 players']);
    expect(missingForPick({ ...tally, hosts: 4 })).toEqual(['4/5 hosts']);
    expect(missingForPick({ ...tally, days: 2 })).toEqual(['2/3 days']);
    expect(missingForPick({ ...tally, earlyQuits: 8 })[0]).toMatch(/early quits 32%/);
    // 3 per 100 is not under 3: one report in 25 players (4 per 100) holds it back, none doesn't.
    expect(missingForPick({ ...tally, reports: 1 })[0]).toMatch(/reports per 100/);
  });

  it('are tunable from the hub config (bad values keep the default)', () => {
    expect(parseThresholds({ players: 10, hosts: 'x', days: -1, earlyQuitRate: 0.5 })).toMatchObject({ players: 10, hosts: 5, days: 3, earlyQuitRate: 0.5 });
    expect(parseThresholds(null)).toEqual(DEFAULT_THRESHOLDS);
  });

  it('promote a map that clears them: the hub asks for its file once, checks it, then lists it as a Community Pick', async () => {
    const { clock, store } = setup({ thresholds: { players: 4, hosts: 2, days: 2 } });
    play(store, 'host-1', [{ sub: 'p1' }, { sub: 'p2' }]);
    clock.t += DAY;
    // Another host's listing, a day later (a listing's check-ins keep its join code known to the hub).
    store.listed(advert({ code: 'DEF567' }), null, null);
    const r = play(store, 'host-2', [{ sub: 'p3' }, { sub: 'p4' }], 'DEF567');
    expect(r.wantFile).toBe(true);
    expect(store.wantsFile(HASH)).toBe(true);
    expect(store.picks()).toEqual([]);
    // A file that isn't the version: turned down, still wanted from the next client.
    await expect(store.receiveFile(HASH, '{}', async () => ({ ok: false, reason: "the file's content hash is not the version that earned the pick" }))).rejects.toThrow(/content hash/);
    expect(store.wantsFile(HASH)).toBe(true);
    expect(await store.receiveFile(HASH, '{"the":"map"}', okCheck)).toBe('pick');
    expect(store.wantsFile(HASH)).toBe(false);
    await expect(store.receiveFile(HASH, '{"the":"map"}', okCheck)).rejects.toThrow(/not asking/);
    expect(store.picks()).toEqual([expect.objectContaining({ contentHash: HASH, name: 'Dune Run', creator: 'MapMaker99', players: 4, modes: ['core.tdm'] })]);
    expect(store.pickFile(HASH)).toBe('{"the":"map"}');
    expect(store.decorate(HASH, 'm_abcdefghijklmnop')).toEqual({ creator: 'MapMaker99', pick: true });
  });

  it("keep a map that fails the hub's check out of the picks, with the reason for the owner", async () => {
    const { clock, store } = setup({ thresholds: { players: 1, hosts: 1, days: 1 } });
    clock.t += 1;
    play(store, 'host-1', [{ sub: 'p1' }]);
    expect(await store.receiveFile(HASH, '{}', async () => ({ ok: false, reason: 'logic loop: rules set each other off' }))).toBe('failed');
    expect(store.picks()).toEqual([]);
    expect(store.summary().failed[0]).toMatchObject({ reason: 'logic loop: rules set each other off' });
  });
});

describe("the hub's check of a pick's file", () => {
  const text = readFileSync(new URL('../../../maps/phase0_arena.json', import.meta.url), 'utf8');
  const doc = () => {
    const r = loadMap(text);
    if (!r.ok) throw new Error('arena failed to load');
    return r.map;
  };
  it('passes a valid map whose content hash is the version, and turns down another version', async () => {
    const map = { ...doc(), metadata: { ...doc().metadata, id: 'dune_run', name: 'Dune Run' } };
    const file = serializeMap(map);
    const hash = mapIdentity(loadMap(file).ok ? (loadMap(file) as { map: typeof map }).map : map).contentHash;
    expect(await checkCommunityMap(file, hash)).toMatchObject({ ok: true, name: 'Dune Run' });
    expect(await checkCommunityMap(file, HASH)).toMatchObject({ ok: false, reason: expect.stringMatching(/content hash/) });
    expect(await checkCommunityMap('{"nope":1}', HASH)).toMatchObject({ ok: false, reason: expect.stringMatching(/load/) });
  }, 60_000);

  it('runs off the hub\'s thread, in a worker', async () => {
    const r = loadMap(text);
    if (!r.ok) throw new Error('arena failed to load');
    expect(await checkInWorker(text, mapIdentity(r.map).contentHash)).toMatchObject({ ok: true, name: 'Phase 0 Arena' });
  }, 60_000);

  it('turns down a map whose text has a blocked word', async () => {
    const map = { ...doc(), metadata: { ...doc().metadata, id: 'dune_run', name: 'Sh1t Hole' } };
    const file = serializeMap(map);
    const loaded = loadMap(file);
    if (!loaded.ok) throw new Error('failed to load');
    expect(await checkCommunityMap(file, mapIdentity(loaded.map).contentHash)).toMatchObject({ ok: false, reason: expect.stringMatching(/word/) });
  }, 60_000);
});

describe('word filter', () => {
  it('catches blocked words through case, accents, look-alikes, spacing and repeats', () => {
    for (const t of ['Fuck yeah', 'F U C K', 'fuuuuck', 'Sh1t Creek', 'b!tch arena', 'ŠHIT', 'the a s s hall']) expect(blockedWord(t), t).not.toBeNull();
  });
  it('leaves ordinary names alone (whole words only for the short ones)', () => {
    for (const t of ['Scunthorpe Docks', 'Class Act', 'Assassin Alley', 'Cocktail Lounge', 'Grass Hill', 'Titan Arena', 'Dickens Lane', 'Classic Arena', 'Raptor Ridge']) expect(blockedWord(t), t).toBeNull();
  });
  it("takes the owner's own words, and finds them in a map's own text", () => {
    expect(blockedWord('Moonbase Wibble', ['wibble'])).toBe('wibble');
    const map = { metadata: { name: 'Fine', description: 'Fine too' }, entities: [{ kind: 'sign', text: 'go to hell b1tch' }], logic: { rules: [{ name: 'ok', do: [{ type: 'message', text: 'hi' }] }] } };
    expect(mapTextProblem(map)).toMatchObject({ word: 'bitch' });
    expect(mapTextProblem({ metadata: { name: 'Fine' }, tiles: [{ tile: 'core.ass_wall' }] })).toBeNull();
  });
  it('turns down a game browser listing with a blocked word', () => {
    const store = new CommunityStore(temp());
    const lobby = new LobbyStore(() => 0, { community: store });
    expect(lobby.add(advert({ name: 'Fuck this' }), '1.1.1.1')).toMatchObject({ status: 400 });
    expect(lobby.add(advert({ map: 'Shit Hole' }), '1.1.1.1')).toMatchObject({ status: 400 });
    expect(lobby.add(advert({ community: false, mapId: undefined, versionId: undefined, contentHash: undefined, name: 'b1tch' }), '1.1.1.1')).toMatchObject({ status: 400 });
    expect('id' in lobby.add(advert(), '1.1.1.1')).toBe(true);
  });
});

describe('reports and auto-hide', () => {
  it('hides a map past the report threshold, until the owner looks at it', () => {
    const { store } = setup();
    for (const s of ['r1', 'r2', 'r3', 'r4']) expect(store.reportMap(s, HASH).hidden).toBe(false);
    // The same account again, and the creator, don't add up.
    store.reportMap('r1', HASH);
    store.reportMap('creator-sub', HASH);
    expect(store.reportMap('r5', HASH)).toEqual({ reports: 5, hidden: true });
    // Hidden: not listed, not a pick, waiting in the owner's summary.
    const lobby = new LobbyStore(() => 0, { community: store });
    expect(lobby.add(advert({ code: 'DEF567' }), '2.2.2.2')).toMatchObject({ status: 400, error: expect.stringMatching(/hidden/) });
    expect(store.summary().hidden).toHaveLength(1);
    // The owner lets it back: those reports no longer count toward hiding it.
    expect(store.restore(HASH).status).toBe('open');
    expect(store.reportMap('r6', HASH).hidden).toBe(false);
    expect('id' in lobby.add(advert({ code: 'DEF567' }), '2.2.2.2')).toBe(true);
  });

  it('hides by reports per player as well as their number', () => {
    expect(reportsHide({ players: 0, earlyQuits: 0, hosts: 0, days: 0, reports: 5 })).toBe(true);
    expect(reportsHide({ players: 40, earlyQuits: 0, hosts: 0, days: 0, reports: 4 })).toBe(false);
    expect(reportsHide({ players: 100, earlyQuits: 0, hosts: 0, days: 0, reports: 9 })).toBe(false);
    expect(reportsHide({ players: 100, earlyQuits: 0, hosts: 0, days: 0, reports: 10 })).toBe(true);
    expect(reportsHide({ players: 100, earlyQuits: 0, hosts: 0, days: 0, reports: 12, reviewedReports: 10 })).toBe(false);
  });

  it("lets only the creator withdraw a map: every version unlisted, out of the picks, its file gone", async () => {
    const { store } = setup({ thresholds: { players: 1, hosts: 1, days: 1 } });
    play(store, 'host-1', [{ sub: 'p1' }]);
    await store.receiveFile(HASH, '{"m":1}', okCheck);
    expect(store.picks()).toHaveLength(1);
    expect(() => store.withdraw('someone-else', 'm_abcdefghijklmnop')).toThrow(/creator/);
    store.withdraw('creator-sub', 'm_abcdefghijklmnop');
    expect(store.picks()).toEqual([]);
    expect(store.pickFile(HASH)).toBeNull();
    const lobby = new LobbyStore(() => 0, { community: store });
    expect(lobby.add(advert({ code: 'DEF567', contentHash: HASH2 }), '2.2.2.2')).toMatchObject({ status: 400, error: expect.stringMatching(/withdrew/) });
  });
});

describe('the game browser', () => {
  it("shows a community map's creator (the first signed-in account to list it), never one the host claims", () => {
    const store = new CommunityStore(temp());
    const lobby = new LobbyStore(() => 0, { community: store });
    // A guest's listing names no creator; the first signed-in lister of the map ID becomes it; a later one doesn't.
    lobby.add(advert({ code: 'AAA234', creator: 'Faker' }), '1.1.1.1');
    expect(lobby.list()[0]!.creator).toBeUndefined();
    lobby.add(advert({ code: 'BBB234' }), '2.2.2.2', { sub: 'creator-sub', username: 'MapMaker99' });
    lobby.add(advert({ code: 'CCC234' }), '3.3.3.3', { sub: 'other-sub', username: 'Copycat' });
    expect(lobby.list().map((g) => g.creator)).toEqual(['MapMaker99', 'MapMaker99', 'MapMaker99']);
    expect(store.mine('creator-sub')).toHaveLength(1);
    expect(store.mine('other-sub')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- HTTP

async function serve(store: CommunityStore, published: PublishedMaps | null = null): Promise<{ url: string; server: Server }> {
  const verify = async (t: string): Promise<VerifiedUser> => {
    if (!t.startsWith('tok-')) throw new TokenError('bad signature');
    return { sub: t.slice(4), tokenUse: 'access', exp: 0 } as VerifiedUser;
  };
  const handler = communityHandler(store, { verify, owners: new Set(['owner']), trustProxy: false, check: okCheck, published });
  const server = createServer((req, res) => void handler(req, res, () => ((res.statusCode = 404), res.end())));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  cleanup.push(() => server.close());
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/community`, server };
}
const as = (who: string, init: RequestInit = {}) => ({ ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer tok-${who}`, 'Content-Type': 'application/json' } });

describe('the community API', () => {
  it('takes reports from signed-in hosts, asks for the file once, and lists the pick', async () => {
    const { store } = setup({ thresholds: { players: 1, hosts: 1, days: 1 } });
    const { url } = await serve(store);
    store.ticketIssued('ABC234', 'p1');
    const body = JSON.stringify({ code: 'ABC234', contentHash: HASH, players: [{ sub: 'p1', minutes: 12, early: false }] });
    expect((await fetch(`${url}/plays`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })).status).toBe(401);
    const r = await fetch(`${url}/plays`, as('host-1', { method: 'POST', body }));
    expect(await r.json()).toMatchObject({ counted: 1, wantFile: true });
    expect(await (await fetch(`${url}/wants/${'a'.repeat(64)}`)).json()).toEqual({ want: true });
    const put = await fetch(`${url}/maps/${'a'.repeat(64)}/file`, { method: 'PUT', body: '{"m":1}', headers: { 'Content-Type': 'application/json' } });
    expect(await put.json()).toEqual({ status: 'pick' });
    expect(((await (await fetch(`${url}/picks`)).json()) as { picks: unknown[] }).picks).toHaveLength(1);
    expect(await (await fetch(`${url}/picks/${'a'.repeat(64)}`)).text()).toBe('{"m":1}');
  });

  it("gives the owner the weekly summary and Official / take down / restore, and nobody else", async () => {
    const { store } = setup({ thresholds: { players: 1, hosts: 1, days: 1 } });
    play(store, 'host-1', [{ sub: 'p1' }]);
    const arena = readFileSync(new URL('../../../maps/phase0_arena.json', import.meta.url), 'utf8');
    const r = loadMap(arena);
    if (!r.ok) throw new Error('arena failed to load');
    const file = serializeMap({ ...r.map, metadata: { ...r.map.metadata, id: 'dune_run', name: 'Dune Run' } });
    await store.receiveFile(HASH, file, okCheck);
    const published = new PublishedMaps(temp(), new Set(['phase0_arena']));
    const { url } = await serve(store, published);
    expect((await fetch(`${url}/summary`, as('p1'))).status).toBe(403);
    const summary = (await (await fetch(`${url}/summary?days=7`, as('owner'))).json()) as { newPicks: { name: string }[] };
    expect(summary.newPicks.map((p) => p.name)).toEqual(['Dune Run']);
    const text = await (await fetch(`${url}/summary?format=text`, as('owner'))).text();
    expect(text).toMatch(/New Community Picks \(1\)/);
    expect(text).toMatch(/Dune Run \(by MapMaker99/);
    expect((await fetch(`${url}/maps/${'a'.repeat(64)}/official`, as('p1', { method: 'POST' }))).status).toBe(403);
    const official = await fetch(`${url}/maps/${'a'.repeat(64)}/official`, as('owner', { method: 'POST' }));
    expect(await official.json()).toMatchObject({ id: 'dune_run', name: 'Dune Run', added: true });
    expect(published.list().map((e) => e.id)).toEqual(['dune_run']);
    expect(store.picks()).toEqual([]);
    expect(await (await fetch(`${url}/maps/${'a'.repeat(64)}/takedown`, as('owner', { method: 'POST' }))).json()).toEqual({ status: 'removed' });
    expect(summaryText(store.summary())).toMatch(/Community maps, the 7 days/);
  });

  it("lets a creator see their own maps and withdraw them", async () => {
    const { store } = setup();
    const { url } = await serve(store);
    const mine = (await (await fetch(`${url}/mine`, as('creator-sub'))).json()) as { maps: { mapId: string }[] };
    expect(mine.maps.map((m) => m.mapId)).toEqual(['m_abcdefghijklmnop']);
    expect((await fetch(`${url}/withdraw/m_abcdefghijklmnop`, as('p1', { method: 'POST' }))).status).toBe(403);
    expect((await fetch(`${url}/withdraw/m_abcdefghijklmnop`, as('creator-sub', { method: 'POST' }))).status).toBe(200);
    expect(await (await fetch(`${url}/maps/${'a'.repeat(64)}/report`, as('p2', { method: 'POST' }))).json()).toEqual({ reports: 1, hidden: false });
  });
});
