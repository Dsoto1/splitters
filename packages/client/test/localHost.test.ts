import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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
});
