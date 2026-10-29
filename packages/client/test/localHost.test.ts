import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BROWSER_HOST_MAX_GUESTS, DEFAULT_RULES, PROTOCOL_VERSION, type ServerMessage } from '@tiletrigger/shared';
import { makeMap } from '../../shared/test/helpers.ts';
import { LocalTransport, type RemoteLink } from '../src/game/localTransport.ts';
import { MAX_CATCH_UP_TICKS, simWake } from '../src/game/matchHost.ts';

// The browser match runs on timers and reads the tab's visibility: enough of a window for it.
beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.window ??= globalThis;
  g.document ??= { hidden: false };
});

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
};

/** A friend's connection (Host game) that records what the host sends. */
function friend(): { link: RemoteLink; got: ServerMessage[]; say: (m: object) => void; closed: () => boolean } {
  const got: ServerMessage[] = [];
  let onMsg: ((t: string) => void) | null = null;
  const early: string[] = [];
  let closed = false;
  const link: RemoteLink = {
    send: (text) => got.push(JSON.parse(text) as ServerMessage),
    onMessage: (cb) => {
      onMsg = cb;
      for (const t of early.splice(0)) cb(t);
    },
    onClose: () => undefined,
    close: () => (closed = true),
  };
  return { link, got, say: (m) => (onMsg ? onMsg(JSON.stringify(m)) : early.push(JSON.stringify(m))), closed: () => closed };
}

const until = async (cond: () => boolean, ms = 15000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
};

const open: LocalTransport[] = [];
afterEach(() => open.splice(0).forEach((t) => t.close()));

const host = async (botFill: number) => {
  const t = new LocalTransport(yard(), { name: 'Host', botFill, difficulty: 'normal', rules: { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] } });
  open.push(t);
  const got: ServerMessage[] = [];
  t.start((m) => got.push(m), () => undefined);
  await until(() => got.some((m) => m.t === 'host'));
  return { t, got };
};

describe('host controls in a browser match (offline, Host game)', () => {
  it('the host changes bots live; a friend may not', async () => {
    const { t, got } = await host(4);
    expect(t.hostState()).toMatchObject({ teams: 2, teamSize: 2, fill: 4 });
    const f = friend();
    t.accept(f.link);
    f.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Friend' });
    expect(f.got.find((m) => m.t === 'welcome')).toBeTruthy();
    // The friend tries: refused, nothing changes.
    f.say({ t: 'host', cmd: { c: 'bots', teamSize: 8 } });
    expect(f.got.find((m) => m.t === 'host')).toEqual({ t: 'host', state: null, error: 'Only the host can change the match' });
    expect(t.hostState()!.teamSize).toBe(2);
    // The host can: everyone gets the notice.
    expect(t.host({ c: 'bots', teamSize: 8 })).toBeNull();
    expect(got.some((m) => m.t === 'notice' && m.text === 'Host set teams to 8v8')).toBe(true);
    expect(f.got.some((m) => m.t === 'notice' && m.text === 'Host set teams to 8v8')).toBe(true);
    expect(f.got.some((m) => m.t === 'host' && m.state)).toBe(false);
    expect(t.capacity).toBe(Math.min(16, 1 + BROWSER_HOST_MAX_GUESTS));
    expect(t.liveRules()!.teamSizes).toEqual([8, 8]);
  });

  it('a browser host keeps 48 v 48 with friends in, and takes up to BROWSER_HOST_MAX_GUESTS of them', async () => {
    const t = new LocalTransport(yard(), { name: 'Host', botFill: 96, difficulty: 'normal', rules: { ...DEFAULT_RULES['core.tdm'], teamSizes: [48, 48] } });
    open.push(t);
    const got: ServerMessage[] = [];
    t.start((m) => got.push(m), () => undefined);
    await until(() => got.some((m) => m.t === 'host'));
    expect(t.hostState()).toMatchObject({ fill: 96, max: 96 });
    // Seats for people: the host and its friends (the host's upload carries their snapshots).
    expect(t.capacity).toBe(1 + BROWSER_HOST_MAX_GUESTS);
    const friends = Array.from({ length: BROWSER_HOST_MAX_GUESTS + 1 }, () => friend());
    friends.forEach((f, i) => {
      t.accept(f.link);
      f.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: `Friend${i}` });
    });
    // Friends take bots' places: still 48 v 48.
    for (const f of friends.slice(0, -1)) expect(f.got.find((m) => m.t === 'welcome')).toBeTruthy();
    expect(t.guests).toBe(BROWSER_HOST_MAX_GUESTS);
    expect(t.hostState()).toMatchObject({ fill: 96, teamSize: 48, max: 96 });
    const last = friends[friends.length - 1]!;
    expect(last.got.find((m) => m.t === 'welcome')).toBeUndefined();
    expect(last.got.find((m) => m.t === 'reject')).toMatchObject({ reason: expect.stringContaining('match full') });
  }, 60_000);

  it('a slow moment does not snowball: the loop catches up a few ticks at most, then drops the backlog', async () => {
    const { got } = await host(4);
    await until(() => got.some((m) => m.t === 'snapshot'));
    simWake.reset();
    // Half a second with the thread busy (a long frame, a GC pause).
    const end = Date.now() + 500;
    while (Date.now() < end) {
      // busy
    }
    await new Promise((r) => setTimeout(r, 200));
    expect(simWake.maxBatch).toBeLessThanOrEqual(MAX_CATCH_UP_TICKS);
    expect(simWake.dropped).toBeGreaterThan(15);
  });

  it('going offline tells friends why, disconnects them and hands their places back to bots', async () => {
    const { t } = await host(4);
    const f = friend();
    t.accept(f.link);
    f.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Friend' });
    expect(t.guests).toBe(1);
    t.dropGuests('The host took the game offline');
    expect(f.got.at(-1)).toEqual({ t: 'reject', reason: 'The host took the game offline' });
    expect(t.guests).toBe(0);
    expect(t.hostState()!.fill).toBe(4);
    await until(() => f.closed());
  });

  it('a map change sends friends travel, and the next match lets them back in as soon as it runs', async () => {
    const { t } = await host(4);
    const f = friend();
    t.accept(f.link);
    f.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Friend' });
    t.travelGuests('Yard 2');
    expect(f.got.at(-1)).toEqual({ t: 'travel', map: 'Yard 2' });
    t.close();
    // Their link stays open a moment so the travel message gets there.
    expect(f.closed()).toBe(false);
    // They reconnect to the same code before the next match has loaded: held, then let in.
    const next = new LocalTransport(yard(), { name: 'Host', botFill: 4, difficulty: 'normal' });
    open.push(next);
    const back = friend();
    next.accept(back.link);
    back.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Friend' });
    expect(back.got).toHaveLength(0);
    next.start(() => undefined, () => undefined);
    await until(() => back.got.some((m) => m.t === 'welcome'));
    expect(next.guests).toBe(1);
  });

  it('a host leaving says goodbye to its friends before their links close', async () => {
    const { t } = await host(4);
    const f = friend();
    t.accept(f.link);
    f.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Friend' });
    t.close();
    expect(f.got.at(-1)).toEqual({ t: 'bye' });
    expect(f.closed()).toBe(false);
    await until(() => f.closed());
  });

  it('host handoff: a friend is named successor and checkpointed; restored from it, the others take their places back', async () => {
    const { t } = await host(4);
    const ann = friend();
    const bo = friend();
    t.accept(ann.link);
    ann.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Ann', pk: 'p_annkey1234' });
    t.accept(bo.link);
    bo.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Bo', pk: 'p_bokey12345' });
    // Within a second or so the host asks one friend to stand by.
    await until(() => [ann, bo].some((f) => f.got.some((m) => m.t === 'standby')));
    const [heir, other] = ann.got.some((m) => m.t === 'standby') ? [ann, bo] : [bo, ann];
    // Only the friend asked may answer: the other's claim is ignored.
    other.say({ t: 'standby', code: 'ZZZZZZ' });
    heir.say({ t: 'standby', code: 'ABC234' });
    for (const f of [ann, bo]) expect(f.got.filter((m) => m.t === 'successor').at(-1)).toMatchObject({ t: 'successor', code: 'ABC234' });
    const cp = heir.got.filter((m) => m.t === 'checkpoint').at(-1);
    expect(other.got.some((m) => m.t === 'checkpoint')).toBe(false);
    if (cp?.t !== 'checkpoint') throw new Error('no checkpoint');
    const otherName = heir === ann ? 'Bo' : 'Ann';
    const otherKey = heir === ann ? 'p_bokey12345' : 'p_annkey1234';
    expect(JSON.stringify(cp.cp)).not.toContain(otherKey);
    const mine = cp.cp.players.find((p) => p.succ === 1)!;
    expect(cp.cp.players.find((p) => p.name === otherName)?.key).toMatch(/^h:/);
    // The host goes; the heir carries the match on from the checkpoint, and the other friend reconnects to it.
    t.close();
    const next = new LocalTransport(yard(), { name: mine.name, botFill: cp.cp.fill, difficulty: 'normal', restore: { ...cp.cp, players: cp.cp.players.map((p) => (p.name === otherName ? { ...p, k: 4 } : p)) } });
    open.push(next);
    const got: ServerMessage[] = [];
    next.start((m) => got.push(m), () => undefined);
    await until(() => got.some((m) => m.t === 'welcome'));
    expect(next.hostState()!.fill).toBe(cp.cp.fill);
    const again = friend();
    next.accept(again.link);
    again.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: otherName, pk: otherKey });
    await until(() => again.got.some((m) => m.t === 'welcome'));
    const roster = again.got.filter((m) => m.t === 'roster').at(-1);
    if (roster?.t !== 'roster') throw new Error('no roster');
    const welcome = again.got.find((m) => m.t === 'welcome');
    if (welcome?.t !== 'welcome') throw new Error('no welcome');
    // Their own place (not a bot's), with the score the checkpoint had.
    expect(roster.players.find((p) => p.slot === welcome.slot)).toMatchObject({ name: otherName, bot: false });
    expect(roster.players.filter((p) => !p.bot).map((p) => p.name).sort()).toEqual([mine.name, otherName].sort());
    await until(() => again.got.some((m) => m.t === 'snapshot' && m.score.some((s) => s.s === welcome.slot && s.k === 4)));
  }, 60_000);

  it('host handoff: a better connection replaces a ready successor only now and then, and the old one stays named until it answers', async () => {
    const { t } = await host(4);
    const ann = friend();
    const bo = friend();
    t.accept(ann.link);
    ann.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Ann', pk: 'p_annkey1234' });
    t.accept(bo.link);
    bo.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Bo', pk: 'p_bokey12345' });
    const ping = (f: ReturnType<typeof friend>, rtt: number) => f.say({ t: 'ping', id: 0, ct: 0, rtt });
    ping(ann, 300);
    ping(bo, 300);
    await until(() => [ann, bo].some((f) => f.got.some((m) => m.t === 'standby')));
    const [heir, other] = ann.got.some((m) => m.t === 'standby') ? [ann, bo] : [bo, ann];
    heir.say({ t: 'standby', code: 'ABC234' });
    const named = (f: ReturnType<typeof friend>) => f.got.filter((m) => m.t === 'successor').at(-1);
    expect(named(other)).toMatchObject({ code: 'ABC234' });
    // A much better connection right away: no swap yet (a loaded machine's pings swing by seconds).
    ping(other, 20);
    ping(heir, 900);
    await new Promise((r) => setTimeout(r, 2500));
    expect(other.got.some((m) => m.t === 'standby')).toBe(false);
    // Half a minute on, it is asked to stand by; the successor stays named (and checkpointed) until it answers.
    const real = Date.now.bind(Date);
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => real() + 31_000);
    try {
      ping(other, 20);
      ping(heir, 900);
      await until(() => other.got.some((m) => m.t === 'standby'));
      for (const f of [ann, bo]) expect(named(f)).toMatchObject({ code: 'ABC234' });
      const checkpoints = heir.got.filter((m) => m.t === 'checkpoint').length;
      await until(() => heir.got.filter((m) => m.t === 'checkpoint').length > checkpoints);
      other.say({ t: 'standby', code: 'DEF567' });
      for (const f of [ann, bo]) expect(named(f)).toMatchObject({ code: 'DEF567' });
      expect(other.got.some((m) => m.t === 'checkpoint')).toBe(true);
    } finally {
      clock.mockRestore();
    }
  }, 60_000);
});
